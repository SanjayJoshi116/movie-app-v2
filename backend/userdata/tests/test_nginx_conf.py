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

    def test_hashed_static_assets_are_cached_long_term(self):
        static_map = _blocks(self.conf, "map")["$uri $static_cache_control"]
        self.assertRegex(static_map, r'~\^/static/\s+"public, max-age=31536000, immutable"\s*;')
        self.assertRegex(static_map, r'default\s+""\s*;')
        # Only /static/ (content-hashed names): one rule plus the default.
        self.assertEqual(len(re.findall(r";", static_map)), 2)
        server = _blocks(self.conf, "server")[""]
        outside_locations = re.sub(r"\blocation\b[^{]*\{[^{}]*\}", "", server)
        # Without `always`, so a missing chunk's 404 is never cached for a year.
        self.assertRegex(outside_locations, r"add_header\s+Cache-Control\s+\$static_cache_control\s*;")

    def test_compression_covers_app_assets_not_proxied_paths(self):
        server = _blocks(self.conf, "server")[""]
        outside_locations = re.sub(r"\blocation\b[^{]*\{[^{}]*\}", "", server)
        self.assertRegex(outside_locations, r"\bgzip\s+on\s*;")
        types = re.search(r"\bgzip_types\s+([^;]+);", outside_locations)
        self.assertIsNotNone(types)
        for mime in ("application/javascript", "text/javascript", "text/css"):
            with self.subTest(mime=mime):
                self.assertIn(mime, types.group(1).split())
        for name in ("/api/", "/media/"):
            with self.subTest(location=name):
                self.assertRegex(self.locations[name], r"\bgzip\s+off\s*;")

    def test_server_version_is_hidden(self):
        self.assertRegex(self.conf, r"(?m)^    server_tokens off;$")

    def test_security_headers_stay_server_level(self):
        server = _blocks(self.conf, "server")[""]
        outside_locations = re.sub(r"\blocation\b[^{]*\{[^{}]*\}", "", server)
        for header in SECURITY_HEADERS:
            with self.subTest(header=header):
                self.assertRegex(outside_locations, rf"add_header\s+{header}\s")


class HstsTests(SimpleTestCase):
    """container-deployment: HSTS only when the TLS terminator reports HTTPS."""

    def setUp(self):
        self.conf = _strip_comments(NGINX_CONF.read_text())
        self.hsts_map = _blocks(self.conf, "map")["$http_x_forwarded_proto $hsts_header"]

    def test_https_gets_at_least_180_days(self):
        m = re.search(r'^\s*https\s+"max-age=(\d+)[^"]*"\s*;', self.hsts_map, re.M)
        self.assertIsNotNone(m, self.hsts_map)
        self.assertGreaterEqual(int(m.group(1)), 180 * 24 * 3600)

    def test_everything_else_gets_none(self):
        # nginx skips an add_header whose value is empty.
        self.assertRegex(self.hsts_map, r'(?m)^\s*default\s+""\s*;')
        self.assertEqual(len(re.findall(r"^\s*\S+\s+\S.*;", self.hsts_map, re.M)), 2, self.hsts_map)

    def test_sent_from_server_level_with_always(self):
        server = _blocks(self.conf, "server")[""]
        outside_locations = re.sub(r"\blocation\b[^{]*\{[^{}]*\}", "", server)
        self.assertRegex(outside_locations, r"add_header\s+Strict-Transport-Security\s+\$hsts_header\s+always\s*;")
        self.assertEqual(self.conf.count("Strict-Transport-Security"), 1)


class AccessLogRedactionTests(SimpleTestCase):
    """Reset tokens and TMDB request tokens never reach the access log."""

    def setUp(self):
        self.conf = _strip_comments(NGINX_CONF.read_text())
        self.maps = _blocks(self.conf, "map")

    def test_server_logs_through_redacted_format(self):
        server = _blocks(self.conf, "server")[""]
        self.assertRegex(server, r"access_log\s+\S+\s+redacted\s*;")

    def test_log_format_uses_only_redacted_uri_and_referer(self):
        fmt = re.search(r"log_format\s+redacted\s+(.*?);", self.conf, re.S)
        self.assertIsNotNone(fmt)
        body = fmt.group(1)
        self.assertIn("$log_request_uri", body)
        self.assertIn("$log_referer", body)
        for raw in ("$request_uri", "$http_referer", '"$request"', "$args", "$query_string"):
            with self.subTest(raw=raw):
                self.assertNotIn(raw, body)

    def test_uri_map_redacts_reset_and_callback(self):
        uri_map = self.maps["$request_uri $log_request_uri"]
        self.assertRegex(uri_map, r"~\^/reset-password/\s+\"/reset-password/\[redacted\]\"\s*;")
        self.assertRegex(uri_map, r"~\^/tmdb-callback\s+\"[^\"$]*\[redacted\]\"\s*;")
        self.assertRegex(uri_map, r"default\s+\$request_uri\s*;")

    def test_referer_map_redacts_reset_and_callback(self):
        ref_map = self.maps["$http_referer $log_referer"]
        for path in ("reset-password/", "tmdb-callback"):
            with self.subTest(path=path):
                self.assertRegex(ref_map, rf"~\^https\?://\[\^/\]\+/{path}\s+\"[^\"$]*redacted[^\"$]*\"\s*;")
        self.assertRegex(ref_map, r"default\s+\$http_referer\s*;")


class ContentSecurityPolicyTests(SimpleTestCase):
    """container-deployment: images only from self, data:, TMDB and the trailer thumbnail host."""

    def setUp(self):
        conf = _strip_comments(NGINX_CONF.read_text())
        m = re.search(r'add_header\s+Content-Security-Policy\s+"([^"]+)"', conf)
        self.assertIsNotNone(m, "nginx.conf must send a Content-Security-Policy")
        self.directives = {
            d.split()[0]: d.split()[1:] for d in (p.strip() for p in m.group(1).split(";")) if d
        }

    def test_img_src_allows_exactly_the_app_image_hosts(self):
        self.assertEqual(
            sorted(self.directives["img-src"]),
            sorted(["'self'", "data:", "https://image.tmdb.org", "https://i.ytimg.com"]),
        )

    def test_scripts_and_frames_stay_locked_down(self):
        self.assertEqual(self.directives["script-src"], ["'self'"])
        self.assertEqual(self.directives["frame-src"], ["https://www.youtube-nocookie.com"])
        self.assertEqual(self.directives["object-src"], ["'none'"])
