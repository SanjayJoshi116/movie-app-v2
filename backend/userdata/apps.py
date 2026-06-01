from django.apps import AppConfig


class UserdataConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "userdata"

    def ready(self):
        import userdata.signals  # noqa: F401
