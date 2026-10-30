"""TMDB session ids encrypted at rest (encrypt-tmdb-session).

A session id can write to the user's TMDB account, so the database (a dump, a
backup, read access) must never hold a usable one. The field encrypts on save
and decrypts on read, so views use `profile.session_id` as plain text.
"""
import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)


@lru_cache(maxsize=4)
def _box(keys):
    return MultiFernet([Fernet(key) for key in keys])


def session_box():
    """MultiFernet over settings.TMDB_SESSION_KEYS: the first key encrypts,
    every key decrypts. Cached per key list (settings can change in tests)."""
    return _box(tuple(settings.TMDB_SESSION_KEYS))


def encrypt_session(value):
    return session_box().encrypt(value.encode()).decode() if value else ""


def decrypt_session(stored):
    """The plain session id, or "" (not connected) for a value no configured
    key can read, such as one whose key was removed. Logs the type only."""
    if not stored:
        return ""
    try:
        return session_box().decrypt(stored.encode()).decode()
    except InvalidToken as e:
        logger.warning("Stored TMDB session unreadable with the configured keys (%s)", type(e).__name__)
        return ""


class EncryptedSessionField(models.TextField):
    """Text column holding a Fernet token; "" stays "" (not connected).

    Encryption is randomized, so filtering on a session value never matches;
    only `""` (not connected) works in a lookup."""

    def from_db_value(self, value, expression, connection):
        return decrypt_session(value)

    def get_prep_value(self, value):
        return encrypt_session(super().get_prep_value(value))
