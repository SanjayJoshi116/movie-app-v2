import threading
import logging

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import WatchedEntry

logger = logging.getLogger(__name__)


def _trigger_cache_refresh(user):
    from .recommendations import _refresh_cache
    threading.Thread(target=_refresh_cache, args=(user,), daemon=True).start()


@receiver(post_save, sender=WatchedEntry)
def watched_entry_saved(sender, instance, created, **kwargs):
    if created:
        _trigger_cache_refresh(instance.user)


@receiver(post_delete, sender=WatchedEntry)
def watched_entry_deleted(sender, instance, **kwargs):
    _trigger_cache_refresh(instance.user)
