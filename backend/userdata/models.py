from django.db import models
from django.contrib.auth.models import User


MEDIA_TYPES = [("movie", "Movie"), ("tv", "TV Show")]


class WatchlistEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="watchlist")
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    title = models.CharField(max_length=500)
    poster_path = models.CharField(max_length=500, blank=True, null=True)
    vote_average = models.FloatField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)
    watched = models.BooleanField(default=False)

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
    watched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "media_id", "media_type")

    def __str__(self):
        return f"{self.user.username} — {self.title}"


class RatingEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ratings")
    media_id = models.IntegerField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    title = models.CharField(max_length=500)
    user_rating = models.FloatField()
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
