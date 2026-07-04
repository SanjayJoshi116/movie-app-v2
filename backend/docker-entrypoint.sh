#!/bin/sh
set -e

python manage.py migrate --run-syncdb
python manage.py compute_recommendations || true

exec gunicorn cinedb.wsgi:application --bind 0.0.0.0:8000 --workers 3
