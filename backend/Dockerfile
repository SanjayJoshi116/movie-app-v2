# Python 3.12 matches dev and CI; constraints.txt pins every transitive
# package, so the image installs exactly what the tests run on.
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt -c constraints.txt

FROM python:3.12-slim

# /app stays root-owned and read-only to the app user, so skip __pycache__ writes.
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
COPY --from=builder /install /usr/local
COPY . .
RUN chmod +x docker-entrypoint.sh

# Unprivileged runtime user; only /app/media (the media_data volume) is
# writable. A fresh volume inherits this ownership; existing root-owned
# volumes need the one-time chown in the README.
RUN useradd --system --uid 10001 --user-group --no-create-home app \
 && mkdir -p /app/media && chown app:app /app/media
USER app

EXPOSE 8000
CMD ["./docker-entrypoint.sh"]
