import logging

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Profile, WatchedEntry

logger = logging.getLogger(__name__)


def schedule_refresh(user_id):
    # Deferred to commit so the refresh sees the change (and never runs for a
    # rollback); request_refresh coalesces a bulk delete's N triggers into <=2 runs.
    from .recommendations import request_refresh
    transaction.on_commit(lambda: request_refresh(user_id, rerun_if_running=True))


def delete_avatar_on_commit(name):
    """Delete a stored avatar file once the current transaction commits, so a
    rollback never leaves a row pointing at a missing file."""
    if not name:
        return
    storage = Profile._meta.get_field("avatar").storage

    def delete():
        try:
            storage.delete(name)
        except OSError as e:
            logger.warning("Could not delete avatar file %s: %s", name, e)

    transaction.on_commit(delete)


@receiver(post_save, sender=WatchedEntry)
def watched_entry_saved(sender, instance, created, **kwargs):
    if created:
        schedule_refresh(instance.user_id)


@receiver(post_delete, sender=WatchedEntry)
def watched_entry_deleted(sender, instance, **kwargs):
    # Account deletion cascades through here; nothing left to recommend for.
    if isinstance(kwargs.get("origin"), User):
        return
    schedule_refresh(instance.user_id)


@receiver(post_delete, sender=Profile)
def profile_deleted(sender, instance, **kwargs):
    # Covers account deletion (cascade) too: the photo must stop being served.
    if instance.avatar:
        delete_avatar_on_commit(instance.avatar.name)
