"""encrypt-tmdb-session: TMDB session ids are stored encrypted, keys rotate
without disconnecting anyone, and an unreadable value reads as disconnected."""
import base64
import importlib
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import TMDBProfile

SESSION = "0123456789abcdef0123456789abcdef01234567"
OLD_KEY = base64.urlsafe_b64encode(b"o" * 32).decode()
NEW_KEY = base64.urlsafe_b64encode(b"n" * 32).decode()
migration = importlib.import_module("userdata.migrations.0031_encrypt_tmdb_session")


def stored(user):
    """The column exactly as the database holds it."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT session_id FROM userdata_tmdbprofile WHERE user_id = %s", [user.id])
        return cursor.fetchone()[0]


def set_stored(user, value):
    with connection.cursor() as cursor:
        cursor.execute("UPDATE userdata_tmdbprofile SET session_id = %s WHERE user_id = %s", [value, user.id])


class StoredEncryptedTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="enc", password="Xk9#mQ2vTz8p")

    def test_column_holds_a_token_reads_return_the_session(self):
        TMDBProfile.objects.create(user=self.user, session_id=SESSION)
        raw = stored(self.user)
        self.assertNotIn(SESSION, raw)
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, SESSION)
        self.assertEqual(
            TMDBProfile.objects.filter(user=self.user).values_list("session_id", flat=True).first(), SESSION
        )

    def test_blank_stays_blank(self):
        TMDBProfile.objects.create(user=self.user)
        self.assertEqual(stored(self.user), "")
        TMDBProfile.objects.filter(user=self.user).update(session_id="")
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "")
        self.assertTrue(TMDBProfile.objects.filter(user=self.user, session_id="").exists())

    def test_removed_key_reads_as_disconnected_and_logs_no_token(self):
        with override_settings(TMDB_SESSION_KEYS=[OLD_KEY]):
            TMDBProfile.objects.create(user=self.user, session_id=SESSION)
        raw = stored(self.user)
        unreadable = override_settings(TMDB_SESSION_KEYS=[NEW_KEY])
        with unreadable, self.assertLogs("userdata.secret_fields", "WARNING") as logs:
            self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "")
        self.assertIn("InvalidToken", logs.output[0])
        self.assertNotIn(raw, "".join(logs.output))

    def test_rotation_reads_old_writes_new(self):
        with override_settings(TMDB_SESSION_KEYS=[OLD_KEY]):
            TMDBProfile.objects.create(user=self.user, session_id=SESSION)
        with override_settings(TMDB_SESSION_KEYS=[NEW_KEY, OLD_KEY]):
            profile = TMDBProfile.objects.get(user=self.user)
            self.assertEqual(profile.session_id, SESSION)
            profile.save()
        self.assertEqual(Fernet(NEW_KEY).decrypt(stored(self.user).encode()).decode(), SESSION)

    def test_rotate_command_moves_rows_to_the_first_key(self):
        other = User.objects.create_user(username="lost", password="Xk9#mQ2vTz8p")
        with override_settings(TMDB_SESSION_KEYS=[OLD_KEY]):
            TMDBProfile.objects.create(user=self.user, session_id=SESSION)
        TMDBProfile.objects.create(user=other)
        set_stored(other, Fernet(base64.urlsafe_b64encode(b"x" * 32)).encrypt(b"gone").decode())
        out = StringIO()
        rotated = override_settings(TMDB_SESSION_KEYS=[NEW_KEY, OLD_KEY])
        with rotated, self.assertLogs("userdata.secret_fields", "WARNING"):
            call_command("rotate_tmdb_sessions", stdout=out)
        self.assertIn("Re-encrypted 1", out.getvalue())
        self.assertIn("1 unreadable", out.getvalue())
        self.assertEqual(Fernet(NEW_KEY).decrypt(stored(self.user).encode()).decode(), SESSION)


class DataMigrationTests(TestCase):
    """The 0031 data step, run directly against plain rows."""

    def setUp(self):
        self.user = User.objects.create_user(username="mig", password="Xk9#mQ2vTz8p")
        TMDBProfile.objects.create(user=self.user)
        set_stored(self.user, SESSION)  # a row as it was before this change
        self.editor = SimpleNamespace(connection=connection)

    def test_forward_encrypts_rerun_is_safe_reverse_decrypts(self):
        migration.encrypt_existing(None, self.editor)
        first = stored(self.user)
        self.assertNotEqual(first, SESSION)
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, SESSION)

        migration.encrypt_existing(None, self.editor)
        self.assertEqual(stored(self.user), first)

        migration.decrypt_existing(None, self.editor)
        self.assertEqual(stored(self.user), SESSION)

    def test_token_under_a_removed_key_is_not_wrapped_again(self):
        foreign = Fernet(base64.urlsafe_b64encode(b"x" * 32)).encrypt(SESSION.encode()).decode()
        set_stored(self.user, foreign)
        migration.encrypt_existing(None, self.editor)
        self.assertEqual(stored(self.user), foreign)

    def test_reverse_refuses_a_token_it_cannot_read(self):
        set_stored(self.user, Fernet(base64.urlsafe_b64encode(b"x" * 32)).encrypt(SESSION.encode()).decode())
        with self.assertRaises(RuntimeError) as err:
            migration.decrypt_existing(None, self.editor)
        self.assertIn("TMDB_SESSION_KEYS", str(err.exception))
        self.assertNotIn(SESSION, str(err.exception))


class UnreadableSessionBehaviourTests(APITestCase):
    """A session no key can read: disconnected, no error, reconnect works."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="ken", password="Xk9#mQ2vTz8p")
        TMDBProfile.objects.create(user=self.user)
        set_stored(self.user, Fernet(base64.urlsafe_b64encode(b"x" * 32)).encrypt(SESSION.encode()).decode())
        # Fresh instance: create() cached the in-memory profile on self.user.
        self.user = User.objects.get(pk=self.user.pk)
        self.client.force_authenticate(user=self.user)

    def test_status_rating_and_reconnect(self):
        with self.assertLogs("userdata.secret_fields", "WARNING"):
            self.assertEqual(self.client.get("/api/tmdb-auth/status/").json(), {"connected": False})

        with patch("userdata.tmdb_client.post_rating") as post:
            res = self.client.post("/api/ratings/", {
                "mediaId": 550, "mediaType": "movie", "title": "Fight Club", "userRating": 8, "review": "",
            }, format="json")
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        post.assert_not_called()

        with patch("userdata.tmdb_client.get_request_token", return_value={"request_token": "tok"}):
            self.client.get("/api/tmdb-auth/request-token/")
        with patch("userdata.tmdb_client.create_session", return_value={"session_id": "sess-new"}), \
                patch("userdata.tmdb_client.revoke_in_background") as revoke:
            res = self.client.post("/api/tmdb-auth/create-session/", {"request_token": "tok"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        revoke.assert_not_called()  # nothing readable to revoke
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "sess-new")
