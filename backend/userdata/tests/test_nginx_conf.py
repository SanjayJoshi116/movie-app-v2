"""Static checks on the production nginx.conf (Docker isn't needed to run them).

nginx inherits server-level add_header lines into a location only while that
location declares none of its own, so one stray add_header in a location
silently drops every security header for its responses.
"""
import re
from pathlib import Path

from django.test import SimpleTestCase

NGINX_CONF = Path(__file__).resolve().parents[3] / "nginx.conf"
SECURITY_HEADERS = (
    "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Content-Security-Policy",
)


def _strip_comments(text):
    return "\n".join(line.split("#", 1)[0] for line in text.splitlines())


def _blocks(text, opener):
    """{header: body} for every `<opener> ... {` block, braces matched."""
    blocks = {}
    for m in re.finditer(rf"\b{opener}\b([^{{;]*)\{{", text):
        depth, i = 1, m.end()
        while depth:
            depth += {"{": 1, "}": -1}.get(text[i], 0)
            i += 1
        blocks[m.group(1).strip()] = text[m.end():i - 1]
    return blocks


class NginxConfTests(SimpleTestCase):
    def setUp(self):
        self.conf = _strip_comments(NGINX_CONF.read_text())
        self.locations = _blocks(self.conf, "location")

    def test_no_location_declares_add_header(self):
        self.assertIn("/static/", self.locations)
        for name, body in self.locations.items():
            with self.subTest(location=name):
                self.assertNotIn("add_header", body)

    def test_missing_static_asset_is_404(self):
        self.assertRegex(self.locations["/static/"], r"try_files\s+\$uri\s+=404\s*;")
        self.assertNotIn("index.html", self.locations["/static/"])

    def test_entry_page_is_revalidated(self):
        entry_map = _blocks(self.conf, "map")["$uri $entry_cache_control"]
        self.assertRegex(entry_map, r'/index\.html\s+"no-cache"\s*;')
        self.assertRegex(entry_map, r'default\s+""\s*;')  # empty: header not sent elsewhere
        server = _blocks(self.conf, "server")[""]
        self.assertRegex(server, r"add_header\s+Cache-Control\s+\$entry_cache_control\s+always\s*;")

    def test_security_headers_stay_server_level(self):
        server = _blocks(self.conf, "server")[""]
        outside_locations = re.sub(r"\blocation\b[^{]*\{[^{}]*\}", "", server)
        for header in SECURITY_HEADERS:
            with self.subTest(header=header):
                self.assertRegex(outside_locations, rf"add_header\s+{header}\s")
