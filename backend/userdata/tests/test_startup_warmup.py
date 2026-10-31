"""service-health: the recommendation warm-up can't block startup.

start.py (local) goes through warmup.run_warmup; docker-entrypoint.sh has its
own `timeout 30 ... || echo ...` line, checked statically everywhere and run
for real on POSIX (CI) with the command swapped for a stub. In the entrypoint
the best-effort steps run in a background block beside gunicorn.
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
START_PY = (BACKEND_DIR / "start.py").read_text(encoding="utf-8")
# Stripped: the best-effort lines are indented inside the background block.
ENTRYPOINT_LINES = [line.strip() for line in ENTRYPOINT.splitlines() if not line.strip().startswith("#")]


def _entrypoint_line(needle):
    return next(line for line in ENTRYPOINT_LINES if needle in line)


WARMUP_LINE = _entrypoint_line("compute_recommendations")


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
        self.assertRegex(START_PY, r'run_warmup\(\[sys\.executable, manage, "compute_recommendations"\], timeout=30\)')


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


FLUSH_LINE = _entrypoint_line("flushexpiredtokens")
PRUNE_LINE = _entrypoint_line("prune_media_cache")
GUNICORN_LINE = _entrypoint_line("exec gunicorn")


class ExpiredTokenFlushTests(TestCase):
    """bound-background-load: expired session records are dropped at every
    start, bounded and best-effort."""

    def test_entrypoint_flush_is_bounded_and_cannot_fail_the_script(self):
        self.assertRegex(FLUSH_LINE, r"^timeout \d+ python manage\.py flushexpiredtokens \|\| echo ")
        self.assertLess(ENTRYPOINT.index(FLUSH_LINE), ENTRYPOINT.index("exec gunicorn"))

    def test_start_py_runs_it_through_the_bounded_helper(self):
        self.assertRegex(START_PY, r'run_warmup\(\[sys\.executable, manage, "flushexpiredtokens"\], timeout=\d+')
        self.assertLess(START_PY.index('"runserver"'), START_PY.index('"flushexpiredtokens"'))

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
        self.assertRegex(START_PY, r'run_warmup\(\[sys\.executable, manage, "prune_media_cache"\], timeout=\d+')
        self.assertLess(START_PY.index('"flushexpiredtokens"'), START_PY.index('"prune_media_cache"'))


class StartupPathsTests(TestCase):
    """fix-deploy-sweep-i1: both startup paths run the same best-effort steps,
    and in Docker they run beside the server instead of before it."""

    def test_both_paths_run_the_same_steps_with_the_same_bounds(self):
        entrypoint = [(name, int(secs)) for secs, name in re.findall(
            r"^\s*timeout (\d+) python manage\.py (\w+) \|\| echo ", ENTRYPOINT, re.M)]
        start = [(name, int(secs)) for name, secs in re.findall(
            r'run_warmup\(\[sys\.executable, manage, "(\w+)"\], timeout=(\d+)', START_PY)]
        self.assertEqual(len(entrypoint), 3)
        self.assertEqual(entrypoint, start)

    def test_best_effort_steps_run_in_the_background_after_the_required_ones(self):
        opening, closing = ENTRYPOINT_LINES.index("("), ENTRYPOINT_LINES.index(") &")
        block = ENTRYPOINT_LINES[opening:closing]
        for line in (FLUSH_LINE, PRUNE_LINE, WARMUP_LINE):
            self.assertIn(line, block)
        self.assertLess(ENTRYPOINT_LINES.index("python manage.py migrate --noinput"), opening)
        self.assertLess(ENTRYPOINT_LINES.index("python manage.py createcachetable"), opening)
        self.assertEqual([line for line in ENTRYPOINT_LINES if line][-1], GUNICORN_LINE)
        # gunicorn reaps the block as a child and halts on exit code 3 or 4.
        self.assertEqual([line for line in block if line and not line.startswith("#")][-1], "exit 0")

    def test_start_py_starts_the_server_before_the_best_effort_steps(self):
        # fix-config-sweep-b7: same as the entrypoint, without a shell.
        server = START_PY.index('subprocess.Popen([sys.executable, manage, "runserver"')
        self.assertLess(START_PY.index('"createcachetable"'), server)
        first_step = START_PY.index("run_warmup([")
        self.assertLess(server, first_step)
        # Django's exit status is passed on once the steps are done.
        self.assertGreater(START_PY.index("sys.exit(server.wait())"), START_PY.rindex("run_warmup(["))

    def test_start_py_stops_warming_once_the_server_exits_and_never_orphans_it(self):
        loop = START_PY.index("for step in steps:")
        self.assertIn("if server.poll() is not None:\n            break", START_PY[loop:])
        self.assertRegex(
            START_PY, r"finally:\n(?:    #.*\n)*    if server\.poll\(\) is None:\n        server\.terminate\(\)",
        )

    def test_start_py_trusts_the_dev_proxy_hop(self):
        self.assertIn('os.environ.setdefault("TRUSTED_PROXY_COUNT", "1")', START_PY)


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
        self.assertGreaterEqual(tmdb_proxy_views.PROXY_POOL_SIZE, threads)
        self.assertEqual(tmdb_proxy_views.PROXY_POOL._max_workers, tmdb_proxy_views.PROXY_POOL_SIZE)
        self.assertGreaterEqual(tmdb_client.SESSION_POOL_SIZE, threads)
        adapter = tmdb_client._session.get_adapter("https://api.tmdb.org")
        self.assertEqual(adapter._pool_maxsize, tmdb_client.SESSION_POOL_SIZE)
