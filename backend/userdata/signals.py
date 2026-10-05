from django.contrib.auth.models import User
from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import WatchedEntry


def _schedule_refresh(user_id):
    # Deferred to commit so the refresh sees the change (and never runs for a
    # rollback); request_refresh coalesces a bulk delete's N triggers into <=2 runs.
    from .recommendations import request_refresh
    transaction.on_commit(lambda: request_refresh(user_id, rerun_if_running=True))


@receiver(post_save, sender=WatchedEntry)
def watched_entry_saved(sender, instance, created, **kwargs):
    if created:
        _schedule_refresh(instance.user_id)


@receiver(post_delete, sender=WatchedEntry)
def watched_entry_deleted(sender, instance, **kwargs):
    # Account deletion cascades through here; nothing left to recommend for.
    if isinstance(kwargs.get("origin"), User):
        return
    _schedule_refresh(instance.user_id)
