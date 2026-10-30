from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef
from django.utils import timezone

from userdata.models import CACHE_TTL_DAYS, TMDBMediaCache, WatchedEntry


class Command(BaseCommand):
    help = "Delete stale title-cache rows that no watched entry uses (run at every start)."

    def handle(self, *args, **options):
        # A watched title's stale row is kept: it's the fallback when its
        # refetch fails. An unwatched one would only be refetched on use.
        watched = WatchedEntry.objects.filter(media_id=OuterRef("media_id"), media_type=OuterRef("media_type"))
        cutoff = timezone.now() - timedelta(days=CACHE_TTL_DAYS)
        deleted, _ = TMDBMediaCache.objects.filter(cached_at__lt=cutoff).filter(~Exists(watched)).delete()
        self.stdout.write(f"Pruned {deleted} title-cache rows.")
