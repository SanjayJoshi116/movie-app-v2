from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from userdata.models import WatchedEntry
from userdata.recommendations import FetchHealth, _compute_for_you, _compute_personalized, save_recommendations


class Command(BaseCommand):
    help = "Pre-compute recommendation cache for all users with watch history"

    def handle(self, *args, **options):
        user_ids = (
            WatchedEntry.objects.values_list("user_id", flat=True).distinct()
        )
        users = User.objects.filter(id__in=user_ids)
        total = users.count()

        if total == 0:
            self.stdout.write("No users with watch history. Skipping.")
            return

        self.stdout.write(f"Computing recommendations for {total} user(s)...")

        for i, user in enumerate(users, 1):
            try:
                health = FetchHealth()
                for_you = _compute_for_you(user, health)
                personalized = _compute_personalized(user, health)
                saved = save_recommendations(user, for_you, personalized, health)
                outcome = "done" if saved else "kept previous (TMDB failed)"
                self.stdout.write(f"  [{i}/{total}] {user.username} — {outcome}")
            except Exception as e:
                # Broad on purpose: same heterogeneous TMDB/numpy/DB surface
                # as recommendations.py's _refresh_cache, plus this loop's
                # own job — one user's failure must not abort the batch for
                # everyone else.
                self.stderr.write(f"  [{i}/{total}] {user.username} — failed: {e}")

        self.stdout.write(self.style.SUCCESS("Recommendation cache computation complete."))
