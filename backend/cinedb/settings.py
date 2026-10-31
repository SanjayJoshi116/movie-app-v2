import base64
import hashlib
import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

from corsheaders.defaults import default_headers
from cryptography.fernet import Fernet
from django.core.checks.security.base import (
    SECRET_KEY_INSECURE_PREFIX,
    SECRET_KEY_MIN_LENGTH,
    SECRET_KEY_MIN_UNIQUE_CHARACTERS,
)
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

_TRUE = ("true", "1", "yes", "on")
_FALSE = ("false", "0", "no", "off")


def _env_bool(name, default):
    """A boolean env var. A value outside _TRUE/_FALSE (any case) is refused
    rather than read as off: `EMAIL_USE_TLS=ture` used to turn STARTTLS off.
    Unset or blank (`DEBUG=` in an env file) means the default."""
    value = os.environ.get(name, "").strip().lower()
    if not value:
        return default
    if value in _TRUE:
        return True
    if value in _FALSE:
        return False
    raise ImproperlyConfigured(f"{name} must be one of {', '.join(_TRUE + _FALSE)} (any case).")


def _is_weak_secret(value):
    """Django's `check --deploy` W009 rule (its own constants), made fatal with DEBUG off."""
    return (
        len(value) < SECRET_KEY_MIN_LENGTH
        or len(set(value)) < SECRET_KEY_MIN_UNIQUE_CHARACTERS
        or value.startswith(SECRET_KEY_INSECURE_PREFIX)
    )


SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-dev-key-change-in-production")
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")

# Fail closed: debug is off unless explicitly enabled. `npm run dev` (start.py)
# and CI set DEBUG=True themselves; a bare `manage.py` on a server stays safe.
DEBUG = _env_bool("DEBUG", False)

# An unset ALLOWED_HOSTS env var means no hosts are allowed in production. In
# DEBUG, wildcard so LAN devices (e.g. phone at 192.168.x.x) hitting the dev
# server directly aren't rejected by the Host header check — same relaxation
# CORS_ALLOW_ALL_ORIGINS already gets below.
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "").split(",") if h.strip()]
if DEBUG:
    ALLOWED_HOSTS.append("*")
elif not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS must list this deployment's real hostnames (comma-separated, "
        "e.g. ALLOWED_HOSTS=localhost,cinedb.example.com) when DEBUG is off; "
        "empty or '*' is refused."
    )

# The JWT key defaults to SECRET_KEY, so a guessable one makes tokens forgeable.
# Blank JWT_SIGNING_KEY counts as unset, never as an empty signing key.
JWT_SIGNING_KEY = os.environ.get("JWT_SIGNING_KEY") or SECRET_KEY
if not DEBUG:
    # Never put a key value in an error message.
    for _name, _value in (("SECRET_KEY", SECRET_KEY), ("JWT_SIGNING_KEY", JWT_SIGNING_KEY)):
        if _is_weak_secret(_value):
            raise ImproperlyConfigured(
                f"{_name} must be a random value with at least {SECRET_KEY_MIN_LENGTH} characters, "
                f"{SECRET_KEY_MIN_UNIQUE_CHARACTERS} distinct ones, and no '{SECRET_KEY_INSECURE_PREFIX}' "
                "prefix when DEBUG is off."
            )
    if not TMDB_API_KEY.strip():
        raise ImproperlyConfigured("Set TMDB_API_KEY when DEBUG is off; every TMDB call fails without it.")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "userdata.apps.UserdataConfig",
]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"redacting": {"()": "userdata.logging.RedactingFormatter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "redacting"}},
    # Every logger reaches the redacting handler through root: urllib3 logs
    # retried URLs (TMDB api_key included) at WARNING, and Django's default
    # handlers are debug-only, so prod 500s otherwise left no trace at all.
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        # Drop Django's debug-only console and mail_admins; propagate to root.
        "django": {"handlers": [], "level": "INFO", "propagate": True},
        # ERROR keeps unhandled 500s; 4xx (401 refresh churn, 404s) stay quiet.
        "django.request": {"level": "ERROR"},
        "userdata": {"level": "INFO"},
    },
}

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "cinedb.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "cinedb.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "cinedb"),
        "USER": os.environ.get("DB_USER", "postgres"),
        # Docker keeps the password only in .env.db as POSTGRES_PASSWORD (the
        # name the postgres image reads), shared by the db and backend services.
        "PASSWORD": os.environ.get("DB_PASSWORD") or os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        # Re-validate connections before use; helps recover after network blips
        "CONN_HEALTH_CHECKS": True,
        # Reuse a worker's connection instead of opening one per request (~50 ms
        # each). Off under DEBUG: runserver handles every request on a new
        # thread, so a kept connection is never reused, only left open.
        "CONN_MAX_AGE": 0 if DEBUG else int(os.environ.get("CONN_MAX_AGE", "60")),
        "OPTIONS": {
            "connect_timeout": 5,
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    # Not too close to the account's username, email or names.
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
# collectstatic target. Nothing serves /static/ in production (nginx sends it
# to the SPA, there's no admin, the API is JSON-only), so it's never run in
# the image — this just keeps the command working.
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
# The app sends the device's IANA time zone on every authenticated request
# (userdata/timezones.py). Dev and the Docker stack are same-origin, so no
# preflight runs there; this keeps the custom header allowed for a frontend
# whose REACT_APP_* base URL points at another origin.
CORS_ALLOW_HEADERS = (*default_headers, "x-timezone")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "300/day",
        "user": "5000/day",
        "login": "10/min",
        "register": "5/min",
        "password_reset": "5/hour",
        "password_reset_confirm": "10/hour",
        "tmdb_proxy": "120/min",
        "notifications": "30/min",
        "followed_recs": "30/min",
        "token_refresh": "60/min",
    },
    # How many reverse proxies sit in front of Django. DRF then takes the
    # client address from that position in X-Forwarded-For (counting from the
    # right, i.e. the entry our own proxy appended). 0 = ignore XFF entirely and
    # use REMOTE_ADDR, the safe default for a deploy with no proxy. `npm run dev`
    # gets 1 from start.py (CRA's proxy adds one hop), and compose sets 1 too.
    # Leaving it unset used to make the whole client-supplied XFF string the
    # throttle key, so any made-up header value got a fresh rate-limit bucket.
    "NUM_PROXIES": int(os.environ.get("TRUSTED_PROXY_COUNT", "0")),
    "DEFAULT_PAGINATION_CLASS": "userdata.pagination.DefaultPagination",
    "PAGE_SIZE": 100,
}
# The browsable HTML API is dev-only: its static assets aren't served in
# production, so a browser opening an API URL gets JSON instead.
if not DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = ("rest_framework.renderers.JSONRenderer",)

# Throttle counters live in the cache. Per-process LocMem under gunicorn's 3
# workers effectively tripled every rate limit, so production shares one
# DB-backed cache (table created by `manage.py createcachetable` at boot).
# DEBUG's single runserver process is fine with LocMem.
# MAX_ENTRIES: DatabaseCache's default of 300 culls a third of all keys once
# exceeded (after dropping expired ones), which reset live throttle counters as
# soon as a few hundred clients were active. One key per client per scope.
PRODUCTION_CACHE = {
    "BACKEND": "django.core.cache.backends.db.DatabaseCache",
    "LOCATION": "cinedb_cache",
    "OPTIONS": {"MAX_ENTRIES": 50_000},
}
# TMDB proxy responses (tmdb_proxy_views) get their own alias, so filling or
# culling it can never evict throttle counters from `default`. Bounded by entry
# count; bodies are mostly 10-50 kB, combined detail responses up to ~300 kB.
# The LocMem LOCATION must differ from default's, or the two share one store.
TMDB_CACHE_DEV = {
    "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    "LOCATION": "tmdb-proxy",
    "OPTIONS": {"MAX_ENTRIES": 1000},
}
TMDB_CACHE_PRODUCTION = {
    "BACKEND": "django.core.cache.backends.db.DatabaseCache",
    "LOCATION": "tmdb_proxy_cache",
    "OPTIONS": {"MAX_ENTRIES": 2000},
}
# Followed people's TMDB credits (social_views): their own alias too. In
# `default` they outnumbered the throttle counters, and past MAX_ENTRIES every
# cull dropped a third of `default`, counters first (they sort first). In `tmdb`
# a big follow list and the proxy would cull each other. Two small rows per
# person (new and upcoming work + recent summary), so 10k entries ~ 5k people.
PERSON_CREDITS_CACHE_DEV = {
    "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    "LOCATION": "person-credits",
    "OPTIONS": {"MAX_ENTRIES": 2000},
}
PERSON_CREDITS_CACHE_PRODUCTION = {
    "BACKEND": "django.core.cache.backends.db.DatabaseCache",
    "LOCATION": "person_credits_cache",
    "OPTIONS": {"MAX_ENTRIES": 10_000},
}
if DEBUG:
    CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
        "tmdb": TMDB_CACHE_DEV,
        "person_credits": PERSON_CREDITS_CACHE_DEV,
    }
else:
    CACHES = {
        "default": PRODUCTION_CACHE,
        "tmdb": TMDB_CACHE_PRODUCTION,
        "person_credits": PERSON_CREDITS_CACHE_PRODUCTION,
    }

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    # Stamps a password-hash claim on every token. JWTAuthentication rejects a
    # stale one on access; SafeTokenRefreshSerializer does the same on refresh,
    # which closes a refresh racing _revoke_all_refresh_tokens' snapshot.
    "CHECK_REVOKE_TOKEN": True,
    "SIGNING_KEY": JWT_SIGNING_KEY,
    "ALGORITHM": "HS256",
}

# Console mail is the dev default only. In production the backend must be
# chosen explicitly: a forgotten setting would print every live password-reset
# link to the container log. An explicit console value is still allowed.
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "")
if not EMAIL_BACKEND:
    if not DEBUG:
        raise ImproperlyConfigured(
            "Set EMAIL_BACKEND when DEBUG is off (e.g. django.core.mail.backends.smtp.EmailBackend)."
        )
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = _env_bool("EMAIL_USE_TLS", True)
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "noreply@cinedb.app")
# Seconds before an SMTP connect or socket operation gives up. Without it a
# stalled mail server holds a reset-mail thread forever.
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))
# Base of password-reset links. Fail closed with DEBUG off: an unset value used
# to default to localhost, so production reset emails pointed at nothing. The
# trailing slash is dropped so links never read "//reset-password".
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000" if DEBUG else "").strip().rstrip("/")
if not DEBUG:
    _frontend = urlsplit(FRONTEND_URL)
    if _frontend.scheme not in ("http", "https") or not _frontend.netloc:
        raise ImproperlyConfigured(
            "FRONTEND_URL must be the app's absolute http(s) address when DEBUG is off "
            "(e.g. FRONTEND_URL=https://cinedb.example.com); password-reset links are built from it."
        )

# Fernet keys for TMDB session ids at rest (userdata/secret_fields.py),
# comma-separated: the first encrypts, every one decrypts, so a key can be
# rotated without disconnecting anyone. Required with DEBUG off; under DEBUG a
# key derived from SECRET_KEY is always added last. Never put a key value in an
# error message.
TMDB_SESSION_KEYS = [k.strip() for k in os.environ.get("TMDB_SESSION_KEYS", "").split(",") if k.strip()]
if DEBUG:
    # Last, so it only decrypts once real keys are set: sessions stored under
    # it in development stay readable after TMDB_SESSION_KEYS is added.
    _dev_key = base64.urlsafe_b64encode(hashlib.sha256(b"tmdb-session:" + SECRET_KEY.encode()).digest()).decode()
    if _dev_key not in TMDB_SESSION_KEYS:
        TMDB_SESSION_KEYS.append(_dev_key)
try:
    if not TMDB_SESSION_KEYS:
        raise ValueError
    for _key in TMDB_SESSION_KEYS:
        Fernet(_key)
except ValueError:
    raise ImproperlyConfigured(
        "TMDB_SESSION_KEYS must be one or more comma-separated Fernet keys (required when DEBUG is off; "
        "generate one with: python -c \"from cryptography.fernet import Fernet; "
        "print(Fernet.generate_key().decode())\")."
    ) from None

# Reset links expire after 1 hour (Django default is 3 days); the reset
# email builds its "expires in" sentence from this value.
PASSWORD_RESET_TIMEOUT = 3600

# Per-username login failures (across all IPs and workers, in the LoginFailure table)
# before that username gets 429 until the window, counted from the first
# failure, passes. On top of the per-IP `login` throttle.
LOGIN_FAILURE_LIMIT = 20
LOGIN_FAILURE_WINDOW_SECONDS = 3600
