import os
import subprocess
import sys
from pathlib import Path
from unittest import TestCase

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROD = {"SECRET_KEY": "test-only-not-the-default-key"}
# dotenv is disabled before settings import: load_dotenv() never overrides
# variables that are set, but it *fills in* ones we deliberately left unset —
# so a developer's backend/.env with DEBUG=True (the documented local setup)
# would silently turn the "DEBUG unset" cases into DEBUG=True ones.
PROBE = (
    "import dotenv; dotenv.load_dotenv = lambda *a, **k: False; "
    "import cinedb.settings as s; print(s.DEBUG, s.ALLOWED_HOSTS)"
)


def _import_settings(**env):
    """Import settings in a fresh interpreter whose environment is exactly
    os.environ minus DEBUG/ALLOWED_HOSTS, plus `env` (backend/.env ignored)."""
    full_env = {k: v for k, v in os.environ.items() if k not in ("DEBUG", "ALLOWED_HOSTS")}
    full_env.update(env)
    return subprocess.run(
        [sys.executable, "-c", PROBE], cwd=BACKEND_DIR, env=full_env,
        capture_output=True, text=True, timeout=60,
    )


class FailClosedSettingsTests(TestCase):
    def test_debug_defaults_off_when_unset(self):
        res = _import_settings(**PROD, ALLOWED_HOSTS="localhost,cinedb.example.com")
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(res.stdout.strip(), "False ['localhost', 'cinedb.example.com']")

    def test_wildcard_hosts_refused_without_debug(self):
        res = _import_settings(**PROD, DEBUG="False", ALLOWED_HOSTS="*")
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("ImproperlyConfigured", res.stderr)
        self.assertIn("ALLOWED_HOSTS", res.stderr)

    def test_empty_hosts_refused_without_debug(self):
        res = _import_settings(**PROD, ALLOWED_HOSTS="")
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("ALLOWED_HOSTS", res.stderr)

    def test_debug_keeps_lan_wildcard(self):
        res = _import_settings(DEBUG="True")
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertTrue(res.stdout.startswith("True"))
        self.assertIn("'*'", res.stdout)
