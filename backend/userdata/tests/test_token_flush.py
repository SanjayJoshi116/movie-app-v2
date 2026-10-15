"""bound-background-load: flushexpiredtokens (run at every start) removes
expired session records and their blacklist rows, and keeps live ones."""
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken


class FlushExpiredTokensTests(TestCase):
    def test_expired_rows_go_live_ones_stay(self):
        user = User.objects.create_user(username="flush", password="Xk9#mQ2vTz8p")
        now = timezone.now()
        expired = OutstandingToken.objects.create(user=user, jti="old", token="t1", expires_at=now - timedelta(days=1))
        BlacklistedToken.objects.create(token=expired)
        live = OutstandingToken.objects.create(user=user, jti="new", token="t2", expires_at=now + timedelta(days=6))
        BlacklistedToken.objects.create(token=live)

        call_command("flushexpiredtokens")

        self.assertEqual(list(OutstandingToken.objects.values_list("jti", flat=True)), ["new"])
        self.assertEqual(BlacklistedToken.objects.get().token_id, live.id)
