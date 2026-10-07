import json
import os
import subprocess
import sys
from pathlib import Path
from unittest import TestCase

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROD = {"SECRET_KEY": "test-only-not-the-default-key", "ALLOWED_HOSTS": "testserver"}
# Same isolation as test_settings_fail_closed: dotenv off, so a developer's
# backend/.env with DEBUG=True can't turn the production cases into DEBUG ones.
NO_DOTENV = "import dotenv; dotenv.load_dotenv = lambda *a, **k: False; "
# Reports DRF's *effective* renderer list (its defaults merged with ours).
SETTINGS_PROBE = NO_DOTENV + (
    "import os, json; os.environ['DJANGO_SETTINGS_MODULE'] = 'cinedb.settings'; "
    "from django.conf import settings; from rest_framework.settings import api_settings; "
    "print(json.dumps({'renderers': [c.__name__ for c in api_settings.DEFAULT_RENDERER_CLASSES], "
    "'static_root': str(settings.STATIC_ROOT or '')}))"
)
# DRF binds renderer_classes onto each view class at import, so override_settings
# can't switch them after the fact — the request has to run in an interpreter
# that imported the views under production settings. /api/health/ touches no DB.
REQUEST_PROBE = NO_DOTENV + (
    "import os, json; os.environ['DJANGO_SETTINGS_MODULE'] = 'cinedb.settings'; "
    "import django; django.setup(); "
    "import sys; from django.test import Client; "
    "r = Client().get('/api/health/', HTTP_ACCEPT=sys.argv[1]); "
    "print(json.dumps({'status': r.status_code, 'type': r['Content-Type'], "
    "'body': r.content.decode()}))"
)

# What a browser sends when opening an API URL directly.
BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"


def _run(probe, *args, **env):
    full_env = {k: v for k, v in os.environ.items() if k not in ("DEBUG", "ALLOWED_HOSTS")}
    full_env.update(env)
    res = subprocess.run(
        [sys.executable, "-c", probe, *args], cwd=BACKEND_DIR, env=full_env,
        capture_output=True, text=True, timeout=60,
    )
    if res.returncode != 0:
        raise AssertionError(res.stderr)
    return json.loads(res.stdout.strip().splitlines()[-1])


class ProductionRenderingTests(TestCase):
    def test_production_renders_json_only(self):
        out = _run(SETTINGS_PROBE, **PROD)
        self.assertEqual(out["renderers"], ["JSONRenderer"])

    def test_production_has_static_root(self):
        out = _run(SETTINGS_PROBE, **PROD)
        self.assertTrue(out["static_root"])

    def test_debug_keeps_browsable_api(self):
        out = _run(SETTINGS_PROBE, DEBUG="True")
        self.assertIn("BrowsableAPIRenderer", out["renderers"])

    def test_browser_accept_gets_json_in_production(self):
        out = _run(REQUEST_PROBE, BROWSER_ACCEPT, **PROD)
        self.assertEqual(out["status"], 200)
        self.assertTrue(out["type"].startswith("application/json"), out["type"])
        self.assertEqual(json.loads(out["body"]), {"status": "ok"})

    def test_html_only_accept_gets_json_error_not_html(self):
        # No HTML renderer left to satisfy it: DRF answers 406, still as JSON.
        out = _run(REQUEST_PROBE, "text/html", **PROD)
        self.assertEqual(out["status"], 406)
        self.assertTrue(out["type"].startswith("application/json"), out["type"])
        self.assertIn("detail", json.loads(out["body"]))
