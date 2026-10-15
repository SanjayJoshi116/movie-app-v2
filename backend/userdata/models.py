from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


MEDIA_TYPES = [("movie", "Movie"), ("tv", "TV Show")]


class WatchlistEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="watchlist")
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    title = models.CharField(max_length=500)
    poster_path = models.CharField(max_length=500, blank=True, null=True)
    vote_average = models.FloatField(default=0)
    # default, not auto_now_add: a backup restore supplies the original time.
    added_at = models.DateTimeField(default=timezone.now)

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
    # TMDB answered with no genres (a 404, or a title it lists none for), so the
    # metadata backfill never fetches this entry again. See metadata_backfill.py.
    metadata_settled = models.BooleanField(default=False)
    # When metadata was last fetched. A title TMDB lists without genres isn't
    # settled: it's fetched again METADATA_RECHECK_DAYS after this.
    metadata_checked_at = models.DateTimeField(null=True, blank=True)
    watched_at = models.DateTimeField(default=timezone.now, db_index=True)
    # IANA zone the watch was logged in (decides its day on every device);
    # blank for entries logged before zones were recorded. See timezones.py.
    watched_tz = models.CharField(max_length=64, blank=True, default="")
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
    rated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("user", "media_id", "media_type")

    def __str__(self):
        return f"{self.user.username} — {self.title} ({self.user_rating})"


class UserList(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="lists")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    # A default, not auto_now_add: a backup restore supplies the original time.
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.user.username} — {self.name}"


class UserListItem(models.Model):
    user_list = models.ForeignKey(UserList, on_delete=models.CASCADE, related_name="items")
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    title = models.CharField(max_length=500)
    poster_path = models.CharField(max_length=500, blank=True, null=True)
    vote_average = models.FloatField(default=0)
    # A default, not auto_now_add: bulk imports supply the original time.
    added_at = models.DateTimeField(default=timezone.now)

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
    # Set when a refresh starts on any process, cleared when it ends; see
    # recommendations.REFRESH_STATUS_WINDOW.
    refreshing_since = models.DateTimeField(null=True, blank=True)
    # When the compute that produced this row started: an older compute
    # finishing later must not replace it (save_recommendations).
    source_started_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} — rec cache ({self.computed_at:%Y-%m-%d %H:%M})"


class TMDBProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="tmdb_profile")
    session_id = models.CharField(max_length=200, blank=True, default="")

    def __str__(self):
        return f"{self.user.username} — TMDB {'connected' if self.session_id else 'disconnected'}"


AVATAR_EXTENSIONS = {"jpg", "png", "webp"}


def avatar_upload_path(instance, filename):
    # The avatar view already renames uploads from the decoded image format;
    # this is defense in depth so no other code path can store e.g. `.html`.
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in AVATAR_EXTENSIONS:
        raise ValueError(f"Refusing to store avatar with extension {ext!r}")
    # Versioned per upload, so a replaced photo gets a new URL that no cache
    # can answer with the old image.
    stamp = int(timezone.now().timestamp() * 1000)
    return f"avatars/user_{instance.user_id}_{stamp}.{ext}"


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
    followed_at = models.DateTimeField(default=timezone.now)

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


class NotificationCheckpoint(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="notification_checkpoint")
    last_seen_at = models.DateTimeField()
    # [id, media_type] of every notification the user had at the last
    # mark-seen: an item not among them is unread, whatever its date. Null for
    # a checkpoint from before this rule, which keeps the date rule (unread
    # when released after the last mark-seen day) until its next mark-seen.
    seen_items = models.JSONField(null=True, blank=True, default=None)

    def __str__(self):
        return f"{self.user.username} — notifications last seen {self.last_seen_at}"


class LoginFailure(models.Model):
    """Failed password attempts for one username, across all IPs and workers.

    A table rather than the cache: DatabaseCache's incr is a non-atomic
    get + set that resets the expiry, and culling evicts entries. Written only
    through auth_views' single-statement upsert, which keeps `window_start` at
    the window's first failure.
    """

    key = models.CharField(max_length=64, primary_key=True)  # sha256 of the folded username
    count = models.PositiveIntegerField()
    window_start = models.DateTimeField(db_index=True)

    def __str__(self):
        return f"{self.key[:12]}… — {self.count} since {self.window_start}"


class TmdbTitleBudget(models.Model):
    """Background TMDB title fetches spent for one user today (UTC): metadata
    backfill and the recommendation cache fill share it (tmdb_budget.take)."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="tmdb_title_budget")
    day = models.DateField()
    used = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user_id}: {self.used} title fetches on {self.day}"
