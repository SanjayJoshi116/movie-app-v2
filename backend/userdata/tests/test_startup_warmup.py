"""service-health: the recommendation warm-up can't block startup.

start.py (local) goes through warmup.run_warmup; docker-entrypoint.sh has its
own `timeout 30 ... || echo ...` line, checked statically everywhere and run
for real on POSIX (CI) with the command swapped for a stub.
"""
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from unittest import TestCase, skipUnless

from warmup import run_warmup

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENTRYPOINT = (BACKEND_DIR / "docker-entrypoint.sh").read_text(encoding="utf-8")
WARMUP_LINE = next(line for line in ENTRYPOINT.splitlines() if "compute_recommendations" in line)


class RunWarmupTests(TestCase):
    def test_hang_is_stopped_and_skipped(self):
        started = time.monotonic()
        ok = run_warmup([sys.executable, "-c", "import time; time.sleep(30)"], timeout=0.5)
        self.assertFalse(ok)
        self.assertLess(time.monotonic() - started, 10)

    def test_non_zero_exit_is_skipped(self):
        self.assertFalse(run_warmup([sys.executable, "-c", "raise SystemExit(3)"], timeout=30))

    def test_clean_exit(self):
        self.assertTrue(run_warmup([sys.executable, "-c", "pass"], timeout=30))

    def test_start_py_uses_it_with_the_30s_bound(self):
        start = (BACKEND_DIR / "start.py").read_text(encoding="utf-8")
        self.assertRegex(start, r'run_warmup\(\[sys\.executable, manage, "compute_recommendations"\], timeout=30\)')


class EntrypointWarmupTests(TestCase):
    def test_line_is_bounded_and_cannot_fail_the_script(self):
        self.assertIn("set -e", ENTRYPOINT)
        self.assertRegex(WARMUP_LINE, r"^timeout 30 python manage\.py compute_recommendations \|\| echo ")
        # The server starts after it, in the same script.
        self.assertLess(ENTRYPOINT.index(WARMUP_LINE), ENTRYPOINT.index("exec gunicorn"))

    @skipUnless(os.name == "posix" and shutil.which("timeout"), "needs POSIX sh and coreutils timeout (runs in CI)")
    def test_hang_and_failure_still_reach_the_server_step(self):
        for stub in ("sleep 5", "false"):
            with self.subTest(stub=stub):
                line = WARMUP_LINE.replace("python manage.py compute_recommendations", stub)
                line = re.sub(r"^timeout 30 ", "timeout 1 ", line)
                res = subprocess.run(
                    ["sh", "-ec", f"{line}\necho started"], capture_output=True, text=True, timeout=30,
                )
                self.assertEqual(res.returncode, 0, res.stderr)
                self.assertIn("skipped", res.stdout)
                self.assertTrue(res.stdout.rstrip().endswith("started"))
