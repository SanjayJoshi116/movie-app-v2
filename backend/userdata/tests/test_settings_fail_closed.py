import base64
import os
import subprocess
import sys
from pathlib import Path
from unittest import TestCase, mock

from django.core.exceptions import ImproperlyConfigured

from cinedb import settings as loaded_settings

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROD = {
    # Passes the W009 strength rule (50+ characters, 5+ distinct, no prefix).
    "SECRET_KEY": "test-only-not-the-default-key-" + "0123456789abcdefghij",
    "TMDB_API_KEY": "test-only-tmdb-key",
    "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
    "FRONTEND_URL": "https://cinedb.example.com",
    # A valid Fernet key generated for these tests only (32 bytes, urlsafe base64).
    "TMDB_SESSION_KEYS": base64.urlsafe_b64encode(b"k" * 32).decode(),
}
# Every variable a case sets or deliberately leaves unset; the probe's env drops
# the developer's own values for all of them.
CONTROLLED = (
    "DEBUG", "ALLOWED_HOSTS", "EMAIL_BACKEND", "FRONTEND_URL", "TMDB_SESSION_KEYS",
    "TMDB_API_KEY", "JWT_SIGNING_KEY", "EMAIL_USE_TLS",
)
# dotenv is disabled before settings import: load_dotenv() never overrides
# variables that are set, but it *fills in* ones we deliberately left unset —
# so a developer's backend/.env with DEBUG=True (the documented local setup)
# would silently turn the "DEBUG unset" cases into DEBUG=True ones.
PROBE = (
    "import dotenv; dotenv.load_dotenv = lambda *a, **k: False; "
    "import cinedb.settings as s; print(s.DEBUG, s.ALLOWED_HOSTS)"
)


def _import_settings(probe=PROBE, unset=(), **env):
    """Run `probe` (settings imported) in a fresh interpreter whose environment
    is exactly os.environ minus CONTROLLED and `unset`, plus `env`
    (backend/.env ignored)."""
    full_env = {k: v for k, v in os.environ.items() if k not in (*CONTROLLED, *unset)}
    full_env.update(env)
    return subprocess.run(
        [sys.executable, "-c", probe], cwd=BACKEND_DIR, env=full_env,
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

    def test_default_secret_key_refused_without_debug(self):
        # SECRET_KEY unset → the built-in development default, which signs JWTs.
        env = {k: v for k, v in PROD.items() if k != "SECRET_KEY"}
        res = _import_settings(unset=("SECRET_KEY",), **env, ALLOWED_HOSTS="localhost")
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("ImproperlyConfigured", res.stderr)
        self.assertIn("SECRET_KEY", res.stderr)

    def test_weak_secret_key_refused_without_debug(self):
        for key in (
            "your-secret-key-here-change-in-production",  # backend/.env.example
            "short-but-random-Zx9",
            "a" * 30 + "b" * 30,  # long, two distinct characters
            "django-insecure-" + "q8Zr2mXv7LpT4wNc0sYb5KdHf3GjA6eU",
        ):
            with self.subTest(key=key):
                res = _import_settings(**{**PROD, "SECRET_KEY": key}, ALLOWED_HOSTS="localhost")
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("ImproperlyConfigured", res.stderr)
                self.assertIn("SECRET_KEY", res.stderr)
                self.assertNotIn(key, res.stderr)

    def test_weak_secret_key_allowed_under_debug(self):
        res = _import_settings(SECRET_KEY="changeme", DEBUG="True")
        self.assertEqual(res.returncode, 0, res.stderr)

    def test_weak_jwt_signing_key_refused_without_debug(self):
        res = _import_settings(**PROD, JWT_SIGNING_KEY="changeme", ALLOWED_HOSTS="localhost")
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("JWT_SIGNING_KEY", res.stderr)
        self.assertNotIn("changeme", res.stderr)

    def test_blank_jwt_signing_key_falls_back_to_secret_key(self):
        probe = PROBE.replace(
            "print(s.DEBUG, s.ALLOWED_HOSTS)", "print(s.SIMPLE_JWT['SIGNING_KEY'] == s.SECRET_KEY)"
        )
        for debug in ("True", "False"):
            with self.subTest(debug=debug):
                res = _import_settings(probe, **PROD, DEBUG=debug, ALLOWED_HOSTS="localhost", JWT_SIGNING_KEY="")
                self.assertEqual(res.returncode, 0, res.stderr)
                self.assertEqual(res.stdout.strip(), "True")

    def test_missing_tmdb_api_key_refused_without_debug(self):
        env = {k: v for k, v in PROD.items() if k != "TMDB_API_KEY"}
        for extra in ({}, {"TMDB_API_KEY": ""}, {"TMDB_API_KEY": "  "}):
            with self.subTest(extra=extra):
                res = _import_settings(**env, **extra, ALLOWED_HOSTS="localhost")
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("ImproperlyConfigured", res.stderr)
                self.assertIn("TMDB_API_KEY", res.stderr)

    def test_missing_tmdb_api_key_allowed_under_debug(self):
        res = _import_settings(DEBUG="True")
        self.assertEqual(res.returncode, 0, res.stderr)

    def test_boolean_spellings(self):
        # The parser itself, in-process; the import-time cases below cover wiring.
        for raw, expected in (
            ("true", True), (" YES ", True), ("1", True), ("On", True),
            ("false", False), ("no", False), ("0", False), ("OFF", False),
        ):
            with self.subTest(raw=raw), mock.patch.dict(os.environ, {"CINEDB_TEST_BOOL": raw}):
                self.assertIs(loaded_settings._env_bool("CINEDB_TEST_BOOL", not expected), expected)
        with mock.patch.dict(os.environ, {"CINEDB_TEST_BOOL": "maybe"}), self.assertRaises(ImproperlyConfigured):
            loaded_settings._env_bool("CINEDB_TEST_BOOL", False)
        os.environ.pop("CINEDB_TEST_BOOL", None)
        self.assertIs(loaded_settings._env_bool("CINEDB_TEST_BOOL", True), True)
        # Blank (`DEBUG=` in an env file) is unset, not an error.
        for blank in ("", "  "):
            with self.subTest(raw=blank), mock.patch.dict(os.environ, {"CINEDB_TEST_BOOL": blank}):
                self.assertIs(loaded_settings._env_bool("CINEDB_TEST_BOOL", True), True)
                self.assertIs(loaded_settings._env_bool("CINEDB_TEST_BOOL", False), False)

    def test_lower_case_booleans_reach_settings(self):
        probe = PROBE.replace("print(s.DEBUG, s.ALLOWED_HOSTS)", "print(s.DEBUG, s.EMAIL_USE_TLS)")
        res = _import_settings(probe, DEBUG="true", EMAIL_USE_TLS="true")
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(res.stdout.strip(), "True True")

    def test_unrecognised_boolean_refused(self):
        cases = (({"DEBUG": "maybe"}, "DEBUG"), ({"DEBUG": "True", "EMAIL_USE_TLS": "ture"}, "EMAIL_USE_TLS"))
        for extra, name in cases:
            with self.subTest(extra=extra):
                res = _import_settings(**extra)
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("ImproperlyConfigured", res.stderr)
                self.assertIn(name, res.stderr)

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

    def test_missing_frontend_url_refused_without_debug(self):
        env = {k: v for k, v in PROD.items() if k != "FRONTEND_URL"}
        for extra in ({}, {"FRONTEND_URL": ""}, {"FRONTEND_URL": "   "}):
            with self.subTest(extra=extra):
                res = _import_settings(**env, **extra, ALLOWED_HOSTS="localhost")
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("ImproperlyConfigured", res.stderr)
                self.assertIn("FRONTEND_URL", res.stderr)

    def test_malformed_frontend_url_refused_without_debug(self):
        for url in ("cinedb.example.com", "ftp://cinedb.example.com", "https://", "/reset"):
            with self.subTest(url=url):
                res = _import_settings(**{**PROD, "FRONTEND_URL": url}, ALLOWED_HOSTS="localhost")
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("FRONTEND_URL", res.stderr)

    def test_frontend_url_trailing_slash_dropped(self):
        probe = PROBE.replace("print(s.DEBUG, s.ALLOWED_HOSTS)", "print(s.FRONTEND_URL)")
        for debug in ("True", "False"):
            with self.subTest(debug=debug):
                env = {k: v for k, v in os.environ.items() if k not in CONTROLLED}
                env.update({**PROD, "DEBUG": debug, "ALLOWED_HOSTS": "localhost", "FRONTEND_URL": "https://cinedb.example.com/"})
                res = subprocess.run(
                    [sys.executable, "-c", probe], cwd=BACKEND_DIR, env=env,
                    capture_output=True, text=True, timeout=60,
                )
                self.assertEqual(res.returncode, 0, res.stderr)
                self.assertEqual(res.stdout.strip(), "https://cinedb.example.com")

    def test_debug_defaults_frontend_url_to_dev_server(self):
        probe = PROBE.replace("print(s.DEBUG, s.ALLOWED_HOSTS)", "print(s.FRONTEND_URL)")
        env = {k: v for k, v in os.environ.items() if k not in CONTROLLED}
        env["DEBUG"] = "True"
        res = subprocess.run(
            [sys.executable, "-c", probe], cwd=BACKEND_DIR, env=env,
            capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(res.stdout.strip(), "http://localhost:3000")

    def test_missing_or_invalid_session_keys_refused_without_debug(self):
        env = {k: v for k, v in PROD.items() if k != "TMDB_SESSION_KEYS"}
        valid = PROD["TMDB_SESSION_KEYS"]
        for extra in ({}, {"TMDB_SESSION_KEYS": ""}, {"TMDB_SESSION_KEYS": " , "},
                      {"TMDB_SESSION_KEYS": "not-a-key"}, {"TMDB_SESSION_KEYS": f"{valid},not-a-key"}):
            with self.subTest(extra=extra):
                res = _import_settings(**env, **extra, ALLOWED_HOSTS="localhost")
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("ImproperlyConfigured", res.stderr)
                self.assertIn("TMDB_SESSION_KEYS", res.stderr)
                self.assertNotIn(valid, res.stderr)

    def test_session_key_list_loads_in_order(self):
        first = PROD["TMDB_SESSION_KEYS"]
        second = base64.urlsafe_b64encode(b"j" * 32).decode()
        probe = f"k = {first!r}; " + PROBE.replace(
            "print(s.DEBUG, s.ALLOWED_HOSTS)", "print(len(s.TMDB_SESSION_KEYS), s.TMDB_SESSION_KEYS[0] == k)"
        )
        env = {k: v for k, v in os.environ.items() if k not in CONTROLLED}
        env.update({**PROD, "ALLOWED_HOSTS": "localhost", "TMDB_SESSION_KEYS": f" {first} ,{second},"})
        res = subprocess.run(
            [sys.executable, "-c", probe], cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(res.stdout.strip(), "2 True")

    def test_debug_keeps_the_dev_key_after_real_keys(self):
        first = PROD["TMDB_SESSION_KEYS"]
        probe = f"k = {first!r}; " + PROBE.replace(
            "print(s.DEBUG, s.ALLOWED_HOSTS)", "print(len(s.TMDB_SESSION_KEYS), s.TMDB_SESSION_KEYS[0] == k)"
        )
        env = {k: v for k, v in os.environ.items() if k not in CONTROLLED}
        env.update({"DEBUG": "True", "TMDB_SESSION_KEYS": first})
        res = subprocess.run(
            [sys.executable, "-c", probe], cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(res.stdout.strip(), "2 True")

    def test_debug_derives_a_session_key_when_unset(self):
        probe = PROBE.replace(
            "print(s.DEBUG, s.ALLOWED_HOSTS)",
            "from cryptography.fernet import Fernet; f = Fernet(s.TMDB_SESSION_KEYS[0]); "
            "print(f.decrypt(f.encrypt(b'ok')).decode())",
        )
        env = {k: v for k, v in os.environ.items() if k not in CONTROLLED}
        env["DEBUG"] = "True"
        res = subprocess.run(
            [sys.executable, "-c", probe], cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(res.stdout.strip(), "ok")

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


CONN_PROBE = (
    "import dotenv; dotenv.load_dotenv = lambda *a, **k: False; "
    "import cinedb.settings as s; print(s.DATABASES['default']['CONN_MAX_AGE'])"
)


class PersistentConnectionSettingsTests(TestCase):
    """Production reuses DB connections; runserver (DEBUG) can't, so it doesn't."""

    def _conn_max_age(self, **env):
        full_env = {k: v for k, v in os.environ.items()
                    if k not in (*CONTROLLED, "CONN_MAX_AGE")}
        full_env.update(env)
        res = subprocess.run(
            [sys.executable, "-c", CONN_PROBE], cwd=BACKEND_DIR, env=full_env,
            capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(res.returncode, 0, res.stderr)
        return res.stdout.strip()

    def test_off_under_debug(self):
        self.assertEqual(self._conn_max_age(DEBUG="True"), "0")

    def test_production_defaults_to_60_and_is_overridable(self):
        prod = {**PROD, "ALLOWED_HOSTS": "localhost"}
        self.assertEqual(self._conn_max_age(**prod), "60")
        self.assertEqual(self._conn_max_age(**prod, CONN_MAX_AGE="0"), "0")
