#!/bin/sh
set -e

python manage.py migrate --run-syncdb
# Shared throttle-counter table for the DatabaseCache backend (idempotent).
python manage.py createcachetable
# Best-effort cache warm-up, capped like start.py so a hung TMDB call can't
# keep gunicorn from ever starting.
timeout 30 python manage.py compute_recommendations || echo "[cinedb] compute_recommendations skipped (failed or timed out after 30s)"

# --timeout is gunicorn's default, made explicit: tmdb_proxy_views sizes its
# retry budget under it (enforced by test_tmdb_proxy).
exec gunicorn cinedb.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 30
