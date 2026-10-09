import os
import subprocess
import sys
from pathlib import Path
from unittest import TestCase

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROD = {"SECRET_KEY": "test-only-not-the-default-key", "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend"}
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
    os.environ minus DEBUG/ALLOWED_HOSTS/EMAIL_BACKEND, plus `env` (backend/.env ignored)."""
    full_env = {k: v for k, v in os.environ.items() if k not in ("DEBUG", "ALLOWED_HOSTS", "EMAIL_BACKEND")}
    full_env.update(env)
    return subprocess.run(
        [sys.executable, "-c", PROBE], cwd=BACKEND_DIR, env=full_env,
        capture_output=True, text=True, timeout=60,
    )


PASSWORD_PROBE = (
    "import dotenv; dotenv.load_dotenv = lambda *a, **k: False; "
    "import cinedb.settings as s; print(repr(s.DATABASES['default']['PASSWORD']))"
)


class DatabasePasswordSettingsTests(TestCase):
    """Docker keeps the password only in .env.db (POSTGRES_PASSWORD)."""

    def _password(self, **env):
        full_env = {k: v for k, v in os.environ.items() if k not in ("DB_PASSWORD", "POSTGRES_PASSWORD")}
        full_env.update(DEBUG="True", **env)
        res = subprocess.run(
            [sys.executable, "-c", PASSWORD_PROBE], cwd=BACKEND_DIR, env=full_env,
            capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(res.returncode, 0, res.stderr)
        return res.stdout.strip()

    def test_falls_back_to_postgres_password(self):
        self.assertEqual(self._password(POSTGRES_PASSWORD="from-env-db"), "'from-env-db'")

    def test_db_password_wins_when_both_set(self):
        self.assertEqual(self._password(DB_PASSWORD="explicit", POSTGRES_PASSWORD="from-env-db"), "'explicit'")

    def test_neither_set_is_empty(self):
        self.assertEqual(self._password(), "''")


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

    def test_missing_email_backend_refused_without_debug(self):
        env = {k: v for k, v in PROD.items() if k != "EMAIL_BACKEND"}
        res = _import_settings(**env, ALLOWED_HOSTS="localhost")
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("ImproperlyConfigured", res.stderr)
        self.assertIn("EMAIL_BACKEND", res.stderr)

    def test_explicit_console_email_allowed_without_debug(self):
        res = _import_settings(
            **{**PROD, "EMAIL_BACKEND": "django.core.mail.backends.console.EmailBackend"}, ALLOWED_HOSTS="localhost"
        )
        self.assertEqual(res.returncode, 0, res.stderr)

    def test_debug_defaults_to_console_email(self):
        probe = PROBE.replace("print(s.DEBUG, s.ALLOWED_HOSTS)", "print(s.EMAIL_BACKEND)")
        full_env = {k: v for k, v in os.environ.items() if k not in ("DEBUG", "EMAIL_BACKEND")}
        full_env["DEBUG"] = "True"
        res = subprocess.run(
            [sys.executable, "-c", probe], cwd=BACKEND_DIR, env=full_env,
            capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(res.stdout.strip(), "django.core.mail.backends.console.EmailBackend")
