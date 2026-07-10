from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


MEDIA_TYPES = [("movie", "Movie"), ("tv", "TV Show")]


class WatchlistEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="watchlist")
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    title = models.CharField(max_length=500)
    poster_path = models.CharField(max_length=500, blank=True, null=True)
    vote_average = models.FloatField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "media_id", "media_type")

    def __str__(self):
        return f"{self.user.username} — {self.title}"


class WatchedEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="watched")
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    title = models.CharField(max_length=500)
    poster_path = models.CharField(max_length=500, blank=True, null=True)
    vote_average = models.FloatField(default=0)
    genre_ids = models.JSONField(default=list)
    original_language = models.CharField(max_length=10, null=True, blank=True)
    release_year = models.IntegerField(null=True, blank=True)
    watched_at = models.DateTimeField(auto_now_add=True, db_index=True)
    runtime_minutes = models.IntegerField(null=True, blank=True)
    platform = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        unique_together = ("user", "media_id", "media_type")

    def __str__(self):
        return f"{self.user.username} — {self.title}"


class RatingEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ratings")
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    title = models.CharField(max_length=500)
    user_rating = models.FloatField(validators=[MinValueValidator(0.5), MaxValueValidator(10)])
    review = models.TextField(blank=True, default="")
    rated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "media_id", "media_type")

    def __str__(self):
        return f"{self.user.username} — {self.title} ({self.user_rating})"


class UserList(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="lists")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} — {self.name}"


class UserListItem(models.Model):
    user_list = models.ForeignKey(UserList, on_delete=models.CASCADE, related_name="items")
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    title = models.CharField(max_length=500)
    poster_path = models.CharField(max_length=500, blank=True, null=True)
    vote_average = models.FloatField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)
    watched = models.BooleanField(default=False)

    class Meta:
        unique_together = ("user_list", "media_id", "media_type")

    def __str__(self):
        return f"{self.user_list.name} — {self.title}"


class TMDBMediaCache(models.Model):
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10)
    genre_ids = models.JSONField(default=list)
    top_cast = models.JSONField(default=list)  # [{id, name}, ...]
    cached_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("media_id", "media_type")

    def __str__(self):
        return f"{self.media_type}/{self.media_id}"


class UserRecommendationCache(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="rec_cache")
    for_you_json = models.JSONField(default=list)
    personalized_json = models.JSONField(default=list)
    computed_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} — rec cache ({self.computed_at:%Y-%m-%d %H:%M})"


class TMDBProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="tmdb_profile")
    session_id = models.CharField(max_length=200, blank=True, default="")

    def __str__(self):
        return f"{self.user.username} — TMDB {'connected' if self.session_id else 'disconnected'}"


def avatar_upload_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower()
    return f"avatars/user_{instance.user_id}.{ext}"


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    avatar = models.ImageField(upload_to=avatar_upload_path, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} — profile"


class FollowedPerson(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="followed_people")
    person_id = models.IntegerField()
    name = models.CharField(max_length=500)
    profile_path = models.CharField(max_length=500, blank=True, null=True)
    followed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "person_id")

    def __str__(self):
        return f"{self.user.username} follows {self.name}"


class EpisodeProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="episode_progress")
    show_id = models.IntegerField()
    season_number = models.PositiveIntegerField(default=1)
    episode_number = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "show_id")

    def __str__(self):
        return f"{self.user.username} — show {self.show_id} S{self.season_number:02d}E{self.episode_number:02d}"
