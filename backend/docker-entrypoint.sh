#!/bin/sh
set -e

python manage.py migrate --noinput
# Shared throttle-counter table for the DatabaseCache backend (idempotent).
python manage.py createcachetable
# Best-effort, bounded steps, the same ones start.py runs (a test keeps the
# two lists in step). They run beside the server, not before it, so a slow
# one can't hold gunicorn back past the compose healthcheck. Each is safe
# next to live requests.
(
  # Expired session-token rows (simplejwt OutstandingToken/BlacklistedToken)
  # grow with every sign-in and refresh.
  timeout 60 python manage.py flushexpiredtokens || echo "[cinedb] flushexpiredtokens skipped (failed or timed out after 60s)"
  # Stale title-cache rows that no watched entry uses.
  timeout 60 python manage.py prune_media_cache || echo "[cinedb] prune_media_cache skipped (failed or timed out after 60s)"
  # Cache warm-up, capped so a hung TMDB call can't run on forever.
  timeout 30 python manage.py compute_recommendations || echo "[cinedb] compute_recommendations skipped (failed or timed out after 30s)"
  # gunicorn (PID 1 after exec) reaps this block like one of its workers,
  # and halts on a worker exit code of 3 or 4: always end it with 0.
  exit 0
) &

# Threaded workers (3 x 8): a request waiting on TMDB holds one thread, not a
# whole worker, so a TMDB slowdown can't stall sign-in and library loads.
# With gthread, --timeout guards a hung worker process rather than killing a
# slow request; the endpoint TMDB budgets (pinned under it by the tests,
# e.g. test_tmdb_proxy) are what bound each request.
exec gunicorn cinedb.wsgi:application --bind 0.0.0.0:8000 --workers 3 --worker-class gthread --threads 8 --timeout 30
