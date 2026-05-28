from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("userdata", "0007_watchedentry_original_language_and_more"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="watchedentry",
            index=models.Index(fields=["user", "watched_at"], name="watched_user_date_idx"),
        ),
        migrations.AddIndex(
            model_name="watchedentry",
            index=models.Index(fields=["user", "release_year"], name="watched_user_year_idx"),
        ),
        migrations.AddIndex(
            model_name="watchlistentry",
            index=models.Index(fields=["user", "added_at"], name="watchlist_user_date_idx"),
        ),
        migrations.AddIndex(
            model_name="ratingentry",
            index=models.Index(fields=["user", "rated_at"], name="rating_user_date_idx"),
        ),
        migrations.AddIndex(
            model_name="followedperson",
            index=models.Index(fields=["user", "followed_at"], name="followed_user_date_idx"),
        ),
        migrations.AddIndex(
            model_name="episodeprogress",
            index=models.Index(fields=["user", "updated_at"], name="episode_user_date_idx"),
        ),
    ]
