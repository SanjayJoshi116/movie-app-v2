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


FLUSH_LINE = next(line for line in ENTRYPOINT.splitlines() if "flushexpiredtokens" in line and not line.startswith("#"))
PRUNE_LINE = next(line for line in ENTRYPOINT.splitlines() if "prune_media_cache" in line and not line.startswith("#"))
GUNICORN_LINE = next(line for line in ENTRYPOINT.splitlines() if line.startswith("exec gunicorn"))


class ExpiredTokenFlushTests(TestCase):
    """bound-background-load: expired session records are dropped at every
    start, bounded and best-effort."""

    def test_entrypoint_flush_is_bounded_and_cannot_fail_the_script(self):
        self.assertRegex(FLUSH_LINE, r"^timeout \d+ python manage\.py flushexpiredtokens \|\| echo ")
        self.assertLess(ENTRYPOINT.index(FLUSH_LINE), ENTRYPOINT.index("exec gunicorn"))

    def test_start_py_runs_it_through_the_bounded_helper(self):
        start = (BACKEND_DIR / "start.py").read_text(encoding="utf-8")
        self.assertRegex(start, r'run_warmup\(\[sys\.executable, manage, "flushexpiredtokens"\], timeout=\d+')
        self.assertLess(start.index("flushexpiredtokens"), start.index('"runserver"'))

    def test_messages_name_the_step(self):
        from io import StringIO
        from contextlib import redirect_stdout
        out = StringIO()
        with redirect_stdout(out):
            run_warmup([sys.executable, "-c", "raise SystemExit(2)"], timeout=30, label="flushexpiredtokens")
        self.assertIn("flushexpiredtokens exited with 2", out.getvalue())


class MediaCachePruneStepTests(TestCase):
    """fix-db-layer: stale title-cache rows are pruned at every start, bounded
    and best-effort, after the token flush."""

    def test_entrypoint_prune_is_bounded_and_cannot_fail_the_script(self):
        self.assertRegex(PRUNE_LINE, r"^timeout \d+ python manage\.py prune_media_cache \|\| echo ")
        self.assertLess(ENTRYPOINT.index(FLUSH_LINE), ENTRYPOINT.index(PRUNE_LINE))
        self.assertLess(ENTRYPOINT.index(PRUNE_LINE), ENTRYPOINT.index("exec gunicorn"))

    def test_start_py_runs_it_through_the_bounded_helper(self):
        start = (BACKEND_DIR / "start.py").read_text(encoding="utf-8")
        self.assertRegex(start, r'run_warmup\(\[sys\.executable, manage, "prune_media_cache"\], timeout=\d+')
        self.assertLess(start.index('"flushexpiredtokens"'), start.index('"prune_media_cache"'))
        self.assertLess(start.index('"prune_media_cache"'), start.index('"runserver"'))


class ThreadedServerTests(TestCase):
    """bound-background-load: threaded workers, and TMDB pools sized for them."""

    def test_gunicorn_runs_threaded_workers(self):
        self.assertIn("--worker-class gthread", GUNICORN_LINE)
        threads = int(re.search(r"--threads (\d+)", GUNICORN_LINE).group(1))
        self.assertGreaterEqual(threads, 4)
        self.assertRegex(GUNICORN_LINE, r"--timeout \d+")  # still explicit: the budget pins read it

    def test_tmdb_pools_cover_the_request_threads(self):
        import django
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cinedb.settings")
        django.setup()
        from userdata import tmdb_client, tmdb_proxy_views
        threads = int(re.search(r"--threads (\d+)", GUNICORN_LINE).group(1))
        self.assertGreaterEqual(tmdb_client.DEADLINE_POOL_SIZE, threads)
        self.assertGreaterEqual(tmdb_proxy_views.SESSION_POOL_SIZE, threads)
        adapter = tmdb_proxy_views._session.get_adapter("https://api.tmdb.org")
        self.assertEqual(adapter._pool_maxsize, tmdb_proxy_views.SESSION_POOL_SIZE)
