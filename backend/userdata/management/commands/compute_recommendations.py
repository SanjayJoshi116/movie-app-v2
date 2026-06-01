from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from userdata.models import WatchedEntry
from userdata.recommendations import _compute_for_you, _compute_personalized, UserRecommendationCache


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
                for_you = _compute_for_you(user)
                personalized = _compute_personalized(user)
                UserRecommendationCache.objects.update_or_create(
                    user=user,
                    defaults={"for_you_json": for_you, "personalized_json": personalized},
                )
                self.stdout.write(f"  [{i}/{total}] {user.username} — done")
            except Exception as e:
                self.stderr.write(f"  [{i}/{total}] {user.username} — failed: {e}")

        self.stdout.write(self.style.SUCCESS("Recommendation cache computation complete."))
