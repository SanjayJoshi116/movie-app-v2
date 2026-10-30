from django.core.management.base import BaseCommand
from django.db import transaction

from userdata.models import TMDBProfile


class Command(BaseCommand):
    help = (
        "Re-encrypt every stored TMDB session under the first key in TMDB_SESSION_KEYS. "
        "Run after putting a new key first, before dropping the old one."
    )

    def handle(self, *args, **options):
        # Reading decrypts with any configured key; saving encrypts with the first.
        profiles = list(TMDBProfile.objects.exclude(session_id=""))
        readable = [p for p in profiles if p.session_id]  # "" = no configured key can read it
        with transaction.atomic():
            TMDBProfile.objects.bulk_update(readable, ["session_id"], batch_size=500)
        rotated, unreadable = len(readable), len(profiles) - len(readable)
        self.stdout.write(f"Re-encrypted {rotated} TMDB sessions; {unreadable} unreadable with the configured keys.")
