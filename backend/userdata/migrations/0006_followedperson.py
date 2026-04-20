from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("userdata", "0005_episodeprogress"),
    ]

    operations = [
        migrations.CreateModel(
            name="FollowedPerson",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("person_id", models.IntegerField()),
                ("name", models.CharField(max_length=500)),
                ("profile_path", models.CharField(blank=True, max_length=500, null=True)),
                ("followed_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="followed_people",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("user", "person_id")},
            },
        ),
    ]
