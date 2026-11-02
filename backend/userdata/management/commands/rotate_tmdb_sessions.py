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
        # Rows are locked from read to write, so a connect or disconnect that
        # commits meanwhile waits instead of being overwritten with the old value.
        # (`exclude("")` is safe on the encrypted column: "" is stored as "".)
        with transaction.atomic():
            profiles = list(TMDBProfile.objects.select_for_update().exclude(session_id=""))
            readable = [p for p in profiles if p.session_id]  # "" = no configured key can read it
            TMDBProfile.objects.bulk_update(readable, ["session_id"], batch_size=500)
        rotated, unreadable = len(readable), len(profiles) - len(readable)
        self.stdout.write(f"Re-encrypted {rotated} TMDB sessions; {unreadable} unreadable with the configured keys.")
