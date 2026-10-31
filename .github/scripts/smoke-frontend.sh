#!/usr/bin/env bash
# Checks the built frontend image's real nginx (container-deployment spec):
# security headers, a revalidated entry page, 404 for a missing chunk, a
# gzip'd, immutably cached hashed bundle, HSTS only over HTTPS, and no
# referrer on the one-time-token pages.
# Usage: smoke-frontend.sh [base-url] [container-name]
set -uo pipefail

BASE="${1:-http://localhost:8080}"
CONTAINER="${2:-}"
failures=0

fail() {
  echo "FAIL: $*"
  failures=$((failures + 1))
}

# headers <path> [curl args...]: status line + headers of a GET, body discarded.
headers() {
  local path="$1"
  shift
  curl -sS -o /dev/null -D - "$@" "$BASE$path" | tr -d '\r'
}

status_of() { head -n 1 <<<"$1" | awk '{print $2}'; }

# has <headers> <name> <value-regex> <label>
has() {
  grep -qiE "^$2: .*$3" <<<"$1" || fail "$4: expected '$2' matching '$3'"
}

lacks() {
  if grep -qiE "^$2: .*$3" <<<"$1"; then fail "$4: unexpected '$2' matching '$3'"; fi
}

security_headers() {
  has "$1" "Content-Security-Policy" "default-src 'self'" "$2"
  has "$1" "X-Content-Type-Options" "nosniff" "$2"
  has "$1" "X-Frame-Options" "SAMEORIGIN" "$2"
  has "$1" "Referrer-Policy" "strict-origin-when-cross-origin" "$2"
}

for path in / /movies; do
  h="$(headers "$path")"
  [ "$(status_of "$h")" = "200" ] || fail "$path: status $(status_of "$h"), expected 200"
  has "$h" "Cache-Control" "no-cache" "$path"
  lacks "$h" "Cache-Control" "immutable" "$path"
  security_headers "$h" "$path"
done

bundle="$(curl -sS "$BASE/" | grep -oE '/static/js/main\.[0-9a-f]+\.js' | head -n 1)"
if [ -z "$bundle" ]; then
  fail "no /static/js/main.<hash>.js referenced from index.html"
else
  h="$(headers "$bundle" -H "Accept-Encoding: gzip")"
  [ "$(status_of "$h")" = "200" ] || fail "$bundle: status $(status_of "$h"), expected 200"
  has "$h" "Content-Encoding" "gzip" "$bundle"
  has "$h" "Cache-Control" "public, max-age=31536000, immutable" "$bundle"
  security_headers "$h" "$bundle"
fi

# Pages carrying a one-time token in their URL send no Referer (their API calls
# would otherwise put it in an error-log line); security_headers above checks
# every other page keeps strict-origin-when-cross-origin.
for path in "/reset-password/x/y/" "/tmdb-callback?request_token=x&approved=true"; do
  h="$(headers "$path")"
  [ "$(status_of "$h")" = "200" ] || fail "$path: status $(status_of "$h"), expected 200"
  has "$h" "Referrer-Policy" "no-referrer$" "$path"
  has "$h" "Content-Security-Policy" "default-src 'self'" "$path"
done

# HSTS only when the TLS terminator in front says the request came over HTTPS.
h="$(headers / -H "X-Forwarded-Proto: https")"
has "$h" "Strict-Transport-Security" "max-age=[0-9]+" "/ over https"
h="$(headers /)"
lacks "$h" "Strict-Transport-Security" "" "/ over plain http"

h="$(headers /static/js/main.deadbeef.js)"
[ "$(status_of "$h")" = "404" ] || fail "missing chunk: status $(status_of "$h"), expected 404"
lacks "$h" "Cache-Control" "immutable" "missing chunk"
security_headers "$h" "missing chunk"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed."
  if [ -n "$CONTAINER" ]; then
    echo "--- docker logs $CONTAINER ---"
    docker logs "$CONTAINER" 2>&1 | tail -n 50
  fi
  exit 1
fi
echo "All frontend image checks passed."
