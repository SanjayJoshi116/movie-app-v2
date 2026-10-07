# Python 3.12 matches dev and CI; constraints.txt pins every transitive
# package, so the image installs exactly what the tests run on.
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt -c constraints.txt

FROM python:3.12-slim

WORKDIR /app
COPY --from=builder /install /usr/local
COPY . .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000
CMD ["./docker-entrypoint.sh"]
