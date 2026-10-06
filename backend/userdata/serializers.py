import math
from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from .models import MEDIA_TYPES, WatchlistEntry, WatchedEntry, RatingEntry, UserList, UserListItem


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate_email(self, value):
        # Django's built-in User.email has no unique=True, so nothing stops duplicate
        # registrations by default -- a second account with the same email makes
        # password_reset_request's User.objects.get(email__iexact=...) raise
        # MultipleObjectsReturned and 500 instead of sending a reset link.
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "is_staff", "avatar_url")

    def get_avatar_url(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and profile.avatar:
            return profile.avatar.url
        return None


class UserProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    last_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    # Same rules as User.username/User.email, which this plain Serializer doesn't inherit.
    username = serializers.CharField(max_length=150, required=False, validators=[UnicodeUsernameValidator()])
    email = serializers.EmailField(max_length=254, required=False)
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False)

    def validate_username(self, value):
        user = self.context["request"].user
        if User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        user = self.context["request"].user
        # Skip the check on an unchanged resubmit: legacy accounts from before
        # registration enforced uniqueness may share an email, and they'd
        # otherwise be unable to save any profile edit at all.
        if value.lower() == (user.email or "").lower():
            return value
        if User.objects.exclude(pk=user.pk).filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def _require_current_password(self, data, purpose):
        if not data.get("current_password"):
            raise serializers.ValidationError({"current_password": f"Required to change {purpose}."})
        if not self.context["request"].user.check_password(data["current_password"]):
            raise serializers.ValidationError({"current_password": "Incorrect password."})

    def validate(self, data):
        user = self.context["request"].user
        # Email is where password resets go, so changing it with only a (possibly
        # stolen) access token would be a full account takeover. The profile form
        # resubmits the unchanged email on every save, so compare case-insensitively.
        if "email" in data and data["email"].lower() != (user.email or "").lower():
            self._require_current_password(data, "email")
        if data.get("new_password"):
            self._require_current_password(data, "password")
            try:
                validate_password(data["new_password"], user=user)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"new_password": exc.messages}) from exc
        return data


INT32_MAX = 2_147_483_647  # Postgres `integer` columns


class FiniteFloatField(serializers.FloatField):
    """FloatField that rejects NaN/Infinity.

    Plain FloatField accepts the string "NaN" (float() parses it, and min/max
    comparisons against NaN are always false). Postgres stores it, and then the
    strict JSON renderer 500s every later read of that row."""

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not math.isfinite(value):
            raise serializers.ValidationError("Must be a finite number.")
        return value


def _validate_half_step(value):
    # Multiples of 0.5 are exact in binary floating point, so this is exact.
    if not (value * 2).is_integer():
        raise serializers.ValidationError("Must be a multiple of 0.5.")


class MediaIdentityMixin(serializers.Serializer):
    """mediaId/mediaType with the model's bounds and choices, which hand-declared
    camelCase fields otherwise drop. A record's identity can't change on update:
    moving it could collide with unique_together, and silently ignoring the value
    would report success for a change that never happened."""

    mediaId = serializers.IntegerField(source="media_id", min_value=1, max_value=INT32_MAX)
    mediaType = serializers.ChoiceField(source="media_type", choices=MEDIA_TYPES)

    def validate(self, data):
        data = super().validate(data)
        if self.instance is not None:
            errors = {}
            if "media_id" in data and data["media_id"] != self.instance.media_id:
                errors["mediaId"] = "Can't be changed."
            if "media_type" in data and data["media_type"] != self.instance.media_type:
                errors["mediaType"] = "Can't be changed."
            if errors:
                raise serializers.ValidationError(errors)
        return data


class WatchlistEntrySerializer(MediaIdentityMixin, serializers.ModelSerializer):
    posterPath = serializers.CharField(source="poster_path", allow_null=True, max_length=500)
    voteAverage = FiniteFloatField(source="vote_average")
    addedAt = serializers.DateTimeField(source="added_at", read_only=True)

    class Meta:
        model = WatchlistEntry
        fields = ("id", "mediaId", "mediaType", "title", "posterPath", "voteAverage", "addedAt")
        read_only_fields = ("id", "addedAt")


class WatchedEntrySerializer(MediaIdentityMixin, serializers.ModelSerializer):
    posterPath = serializers.CharField(source="poster_path", allow_null=True, max_length=500)
    voteAverage = FiniteFloatField(source="vote_average")
    watchedAt = serializers.DateTimeField(source="watched_at", read_only=True)
    originalLanguage = serializers.CharField(
        source="original_language", allow_null=True, allow_blank=True, required=False, max_length=10
    )
    releaseYear = serializers.IntegerField(
        source="release_year", allow_null=True, required=False, min_value=1800, max_value=3000
    )
    runtimeMinutes = serializers.IntegerField(
        source="runtime_minutes", allow_null=True, required=False, min_value=0, max_value=INT32_MAX
    )
    platform = serializers.CharField(allow_null=True, allow_blank=True, required=False, max_length=100)

    class Meta:
        model = WatchedEntry
        fields = (
            "id",
            "mediaId",
            "mediaType",
            "title",
            "posterPath",
            "voteAverage",
            "watchedAt",
            "originalLanguage",
            "releaseYear",
            "runtimeMinutes",
            "platform",
        )
        read_only_fields = ("id", "watchedAt")


class RatingEntrySerializer(MediaIdentityMixin, serializers.ModelSerializer):
    # Half steps only: TMDB silently rejects anything else on sync.
    userRating = FiniteFloatField(
        source="user_rating", min_value=0.5, max_value=10, validators=[_validate_half_step]
    )
    ratedAt = serializers.DateTimeField(source="rated_at", read_only=True)

    class Meta:
        model = RatingEntry
        fields = ("id", "mediaId", "mediaType", "title", "userRating", "review", "ratedAt")
        read_only_fields = ("id", "ratedAt")


class UserListItemSerializer(MediaIdentityMixin, serializers.ModelSerializer):
    posterPath = serializers.CharField(source="poster_path", allow_null=True, max_length=500)
    voteAverage = FiniteFloatField(source="vote_average")
    addedAt = serializers.DateTimeField(source="added_at", read_only=True)

    class Meta:
        model = UserListItem
        fields = ("id", "mediaId", "mediaType", "title", "posterPath", "voteAverage", "addedAt")
        read_only_fields = ("id", "addedAt")


BULK_TIMESTAMP_SKEW = timedelta(minutes=5)


def _validate_not_future(value):
    # A small margin for client/server clock skew; backups carry server times anyway.
    if value > timezone.now() + BULK_TIMESTAMP_SKEW:
        raise serializers.ValidationError("Can't be in the future.")


def _past_timestamp():
    return serializers.DateTimeField(required=False, allow_null=True, validators=[_validate_not_future])


class BulkEntrySerializer(serializers.Serializer):
    """Fields every bulk-import entry shares. mediaType is optional per entry
    and falls back to the request-level default."""

    mediaId = serializers.IntegerField(min_value=1, max_value=INT32_MAX)
    mediaType = serializers.ChoiceField(choices=MEDIA_TYPES, required=False)
    title = serializers.CharField(max_length=500, allow_blank=True, default="")


class BulkMediaEntrySerializer(BulkEntrySerializer):
    posterPath = serializers.CharField(max_length=500, allow_null=True, allow_blank=True, required=False)
    # The CSV import sends null for an unparseable score; it's stored as 0.
    voteAverage = FiniteFloatField(allow_null=True, required=False)


class BulkWatchedEntrySerializer(BulkMediaEntrySerializer):
    watchedAt = _past_timestamp()
    runtimeMinutes = serializers.IntegerField(allow_null=True, required=False, min_value=0, max_value=INT32_MAX)
    platform = serializers.CharField(allow_null=True, allow_blank=True, required=False, max_length=100)


class BulkWatchlistEntrySerializer(BulkMediaEntrySerializer):
    addedAt = _past_timestamp()


class BulkRatingEntrySerializer(BulkEntrySerializer):
    userRating = FiniteFloatField(min_value=0.5, max_value=10, validators=[_validate_half_step])
    review = serializers.CharField(allow_blank=True, default="", trim_whitespace=False)
    ratedAt = _past_timestamp()


class BulkImportSerializer(serializers.Serializer):
    entries = serializers.JSONField(default=list)  # shape checked in bulk_import
    mediaType = serializers.ChoiceField(choices=MEDIA_TYPES, default="movie")


# Input serializers for endpoints that read fields straight off the body. They
# check type and shape only (a JSON array body, or a non-string value, gets a
# 400 instead of an AttributeError 500). Each view keeps its own "required"
# checks and messages, so well-formed requests behave exactly as before.

def _optional_text(**kwargs):
    return serializers.CharField(allow_blank=True, default="", **kwargs)


class LoginInputSerializer(serializers.Serializer):
    username = _optional_text(trim_whitespace=False)
    password = _optional_text(trim_whitespace=False)


class PasswordInputSerializer(serializers.Serializer):
    password = _optional_text(trim_whitespace=False)


class PasswordResetRequestInputSerializer(serializers.Serializer):
    email = _optional_text(max_length=254)


class PasswordResetConfirmInputSerializer(serializers.Serializer):
    uid = _optional_text()
    token = _optional_text()
    new_password = _optional_text(trim_whitespace=False)


class TMDBSessionInputSerializer(serializers.Serializer):
    request_token = _optional_text(max_length=200)


class FollowPersonInputSerializer(serializers.Serializer):
    personId = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=INT32_MAX)
    name = serializers.CharField(max_length=500, allow_blank=True, default="")
    profilePath = serializers.CharField(max_length=500, allow_null=True, allow_blank=True, required=False)


class EpisodeProgressInputSerializer(serializers.Serializer):
    season = serializers.IntegerField(min_value=1, max_value=INT32_MAX, default=1)
    episode = serializers.IntegerField(min_value=1, max_value=INT32_MAX, default=1)


class UserListSerializer(serializers.ModelSerializer):
    items = UserListItemSerializer(many=True, read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = UserList
        fields = ("id", "name", "description", "items", "createdAt")
        read_only_fields = ("id", "createdAt")
