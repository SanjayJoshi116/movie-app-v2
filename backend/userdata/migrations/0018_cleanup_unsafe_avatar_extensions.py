# Hand-written data migration: before avatar extensions were derived from the
# decoded image format, the client's filename picked them, so an upload named
# `x.html` was stored (and served by /media/) as text/html. Rename any such
# file to its real image extension, or delete it if it doesn't decode as one.

import logging

from django.db import migrations
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

SAFE_EXTENSIONS = {"jpg", "png", "webp"}
EXT_BY_FORMAT = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


def _decoded_ext(storage, name):
    try:
        with storage.open(name, "rb") as fh, Image.open(fh) as img:
            fmt = img.format
            img.verify()
    except (FileNotFoundError, UnidentifiedImageError, OSError):
        return None
    return EXT_BY_FORMAT.get(fmt)


def cleanup_unsafe_avatars(apps, schema_editor):
    Profile = apps.get_model("userdata", "Profile")
    for profile in Profile.objects.exclude(avatar="").exclude(avatar__isnull=True):
        name = profile.avatar.name
        if name.rsplit(".", 1)[-1].lower() in SAFE_EXTENSIONS:
            continue
        storage = profile.avatar.storage
        ext = _decoded_ext(storage, name)
        if ext:
            with storage.open(name, "rb") as fh:
                new_name = storage.save(f"avatars/user_{profile.user_id}.{ext}", fh)
            storage.delete(name)
            profile.avatar.name = new_name
            logger.info("Renamed unsafe avatar %s -> %s", name, new_name)
        else:
            if storage.exists(name):
                storage.delete(name)
            profile.avatar = None
            logger.info("Removed unsafe avatar %s", name)
        profile.save(update_fields=["avatar"])


class Migration(migrations.Migration):

    dependencies = [
        ("userdata", "0017_notificationcheckpoint"),
    ]

    operations = [
        migrations.RunPython(cleanup_unsafe_avatars, migrations.RunPython.noop),
    ]
