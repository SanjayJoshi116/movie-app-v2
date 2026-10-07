## 1. Image contents and startup

- [ ] 1.1 `backend/.dockerignore`: add `media/`, `staticfiles/`, `.pytest_cache/`, `**/__pycache__/`
- [ ] 1.2 `docker-compose.yml`: remove the `./backend/userdata/migrations:/app/userdata/migrations` volume (keep `media_data`)
- [ ] 1.3 `backend/docker-entrypoint.sh`: `migrate --run-syncdb` → `migrate --noinput`; leave the gunicorn line byte-identical; run `pytest backend/userdata/tests/test_tmdb_proxy.py`

## 2. Non-root backend

- [ ] 2.1 `backend/Dockerfile` final stage: `ENV PYTHONDONTWRITEBYTECODE=1`; create system user `app` (uid 10001); `mkdir -p /app/media && chown app:app /app/media`; `USER app` after `chmod +x docker-entrypoint.sh`

## 3. Settings

- [ ] 3.1 `settings.py`: `STATIC_ROOT = BASE_DIR / "staticfiles"`; add `backend/staticfiles/` to `.gitignore`
- [ ] 3.2 `settings.py`: when not `DEBUG`, `REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = ("rest_framework.renderers.JSONRenderer",)`
- [ ] 3.3 Tests in `test_settings_fail_closed.py` style (fresh interpreter): production settings expose only `JSONRenderer` and a non-empty `STATIC_ROOT`; DEBUG keeps the browsable renderer. Plus an API test with `Accept: text/html` under `override_settings` returning JSON
- [ ] 3.4 `G:/Anaconda/envs/django/python.exe -m pytest backend` all green

## 4. Security headers

- [ ] 4.1 `nginx.conf`: top-level `map $http_x_forwarded_proto $hsts_header` (https → `max-age=31536000`, default empty); server-level `add_header Strict-Transport-Security $hsts_header always;`
- [ ] 4.2 `nginx.conf`: add the D2 `Content-Security-Policy` (`always`); change `X-XSS-Protection` to `"0"`; add `proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;` to `/api/` and `/media/`
- [ ] 4.3 `Dockerfile.frontend`: `ENV INLINE_RUNTIME_CHUNK=false` before `npm run build`
- [ ] 4.4 Local CSP check without Docker: `INLINE_RUNTIME_CHUNK=false npm run build`, confirm `build/index.html` has no inline `<script>` body; serve `build/` with a throwaway `verify_csp.js` static server that sends the D2 header and proxies `/api` + `/media` to `npm run dev`'s Django; Playwright walks login → Movies → `/movie/550` (trailer section) → Stats → profile with an uploaded avatar → TV/anime/search, collecting `securitypolicyviolation` events and console CSP errors; expect none. Delete the scripts afterwards

## 5. Docs

- [ ] 5.1 `README.md` Docker section: upgrade note (one-time `docker compose run --rm --user root backend chown -R app:app /app/media`; check `git status backend/userdata/migrations` before upgrading since the mount is gone); HSTS is sent only when the TLS terminator sets `X-Forwarded-Proto: https`
- [ ] 5.2 `docs/ARCHITECTURE.md`: rationale bullets for headers-in-nginx + XFP-keyed HSTS, non-root + manual volume fix, image-only migrations, JSON-only production API
- [ ] 5.3 CLAUDE.md: note that the backend container runs as non-root with read-only `/app` (only `/app/media` writable), and that CSP lives in `nginx.conf` — a new external origin (image host, embed, font) must be added there

## 6. Container verification (needs Docker — not installed here; for the user)

- [ ] 6.1 `docker compose build` succeeds; `docker run --rm --entrypoint ls <backend-image> -A /app/media` is empty
- [ ] 6.2 `docker compose up -d`; all three services healthy (`docker compose ps`)
- [ ] 6.3 `docker compose exec backend id` shows uid 10001, not 0
- [ ] 6.4 `curl -sI http://localhost/` shows `Content-Security-Policy` and no `Strict-Transport-Security`; `curl -sI -H "X-Forwarded-Proto: https" http://localhost/` shows `Strict-Transport-Security: max-age=31536000`; `curl -s -H "Accept: text/html" http://localhost/api/health/` returns JSON
- [ ] 6.5 In a browser against `http://localhost/`: register, upload an avatar (succeeds and displays), open a movie with a trailer; DevTools console shows no CSP violations
- [ ] 6.6 Upgrade path on an existing volume: before the chown, avatar upload fails; after the README chown, it succeeds
