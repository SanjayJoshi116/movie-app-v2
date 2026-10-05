import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

base = Path(__file__).resolve().parent
load_dotenv(base / ".env")
# settings.py defaults DEBUG off (fail closed); this is the local-dev launcher,
# so turn it on here for every manage.py subprocess unless .env/env says otherwise.
os.environ.setdefault("DEBUG", "True")

db_name     = os.environ.get("DB_NAME", "cinedb")
db_user     = os.environ.get("DB_USER", "postgres")
db_password = os.environ.get("DB_PASSWORD", "")
db_host     = os.environ.get("DB_HOST", "localhost")
db_port     = os.environ.get("DB_PORT", "5432")

# Step 1: Create database if it doesn't exist
conn = psycopg2.connect(dbname="postgres", user=db_user, password=db_password,
                        host=db_host, port=db_port)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
if not cur.fetchone():
    cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
    print(f"[cinedb] Created database '{db_name}'")
cur.close()
conn.close()

# Step 2: Run migrations
# To generate new migrations after changing models, run this explicitly:
#   python backend/manage.py makemigrations userdata
manage = str(base / "manage.py")
subprocess.run([sys.executable, manage, "migrate", "--run-syncdb"], check=True)
# Idempotent; only used when DEBUG is off (DatabaseCache), harmless otherwise.
subprocess.run([sys.executable, manage, "createcachetable"], check=True)

# Step 3: Pre-compute recommendation cache (best-effort — failure or a hung
# TMDB call won't block startup)
try:
    subprocess.run([sys.executable, manage, "compute_recommendations"], check=False, timeout=30)
except subprocess.TimeoutExpired:
    print("[cinedb] compute_recommendations timed out after 30s, skipping (best-effort)")

# Step 4: Start server
subprocess.run([sys.executable, manage, "runserver", "0.0.0.0:8000"], check=True)
