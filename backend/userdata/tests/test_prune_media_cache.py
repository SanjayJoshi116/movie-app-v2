"""fix-db-layer: prune_media_cache (run at every start) drops stale title-cache
rows nobody has watched and keeps the rest."""
import os
import subprocess
import sys
from datetime import timedelta
from io import StringIO
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from userdata.models import CACHE_TTL_DAYS, TMDBMediaCache, WatchedEntry


class PruneMediaCacheTests(TestCase):
    def _row(self, media_id, media_type, age_days):
        row = TMDBMediaCache.objects.create(media_id=media_id, media_type=media_type)
        # cached_at is auto_now, so age it with an update.
        TMDBMediaCache.objects.filter(pk=row.pk).update(cached_at=timezone.now() - timedelta(days=age_days))

    def test_stale_unwatched_rows_go_the_rest_stay(self):
        user = User.objects.create_user(username="prune", password="Xk9#mQ2vTz8p")
        WatchedEntry.objects.create(user=user, media_id=550, media_type="movie", title="Fight Club")
        stale = CACHE_TTL_DAYS + 1
        self._row(550, "movie", stale)    # stale, watched: kept (outage fallback)
        self._row(550, "tv", stale)       # same id, other type, unwatched: pruned
        self._row(13, "movie", stale)     # stale, unwatched: pruned
        self._row(680, "movie", 1)        # fresh, unwatched: kept

        call_command("prune_media_cache", stdout=StringIO())

        kept = set(TMDBMediaCache.objects.values_list("media_id", "media_type"))
        self.assertEqual(kept, {(550, "movie"), (680, "movie")})


def test_command_does_not_load_the_recommender():
    """It runs inside a 60 s startup budget: importing it must not pull in
    numpy and scikit-learn (recommendations.py) for one constant."""
    probe = (
        "import os, sys; os.environ['DJANGO_SETTINGS_MODULE'] = 'cinedb.settings'; "
        "import django; django.setup(); "
        "import userdata.management.commands.prune_media_cache; "
        "print('sklearn' in sys.modules)"
    )
    res = subprocess.run(
        [sys.executable, "-c", probe], cwd=Path(__file__).resolve().parents[2],
        env={**os.environ, "DEBUG": "True"}, capture_output=True, text=True, timeout=60,
    )
    assert res.returncode == 0, res.stderr
    assert res.stdout.strip() == "False"
