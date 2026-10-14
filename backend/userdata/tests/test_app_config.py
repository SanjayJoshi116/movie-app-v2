import re
from pathlib import Path

from django.apps import apps
from django.test import SimpleTestCase


class NoAdminTests(SimpleTestCase):
    """The Django admin was mounted but unused and unrouted in production; in dev
    it was an unthrottled password form. It's gone, not just unlinked."""

    def test_admin_paths_are_404(self):
        for path in ("/admin/", "/admin/login/"):
            with self.subTest(path=path):
                res = self.client.get(path)
                self.assertEqual(res.status_code, 404)
                self.assertNotIn(b"password", res.content.lower())

    def test_admin_app_not_installed(self):
        self.assertFalse(apps.is_installed("django.contrib.admin"))


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_READ = re.compile(
    r"""os\.(?:environ\.get|environ\.setdefault|getenv)\(\s*["']([A-Z0-9_]+)["']"""
    r"""|os\.environ\[\s*["']([A-Z0-9_]+)["']\s*\]"""
)


class EnvExampleCoverageTests(SimpleTestCase):
    """backend/.env.example documents every variable settings.py reads, so a
    new setting can't ship undocumented (FRONTEND_URL, JWT_SIGNING_KEY,
    CONN_MAX_AGE, DEFAULT_FROM_EMAIL and EMAIL_TIMEOUT once did)."""

    def test_every_settings_variable_is_in_the_example(self):
        source = (BACKEND_DIR / "cinedb" / "settings.py").read_text(encoding="utf-8")
        names = {a or b for a, b in ENV_READ.findall(source)}
        self.assertIn("FRONTEND_URL", names)  # the scan itself still works
        example = (BACKEND_DIR / ".env.example").read_text(encoding="utf-8")
        mentioned = set(re.findall(r"\b([A-Z][A-Z0-9_]+)=", example))
        missing = sorted(names - mentioned)
        self.assertEqual(missing, [], f"Add to backend/.env.example: {', '.join(missing)}")
