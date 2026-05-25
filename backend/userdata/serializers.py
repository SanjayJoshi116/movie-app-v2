from django.contrib.auth.models import User
from rest_framework import serializers
from .models import WatchlistEntry, WatchedEntry, RatingEntry, UserList, UserListItem


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "is_staff")


class UserProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    last_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, min_length=6, required=False)

    def validate_username(self, value):
        user = self.context["request"].user
        if User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate(self, data):
        if data.get("new_password"):
            if not data.get("current_password"):
                raise serializers.ValidationError({"current_password": "Required to change password."})
            user = self.context["request"].user
            if not user.check_password(data["current_password"]):
                raise serializers.ValidationError({"current_password": "Incorrect password."})
        return data


class WatchlistEntrySerializer(serializers.ModelSerializer):
    mediaId = serializers.IntegerField(source="media_id")
    mediaType = serializers.CharField(source="media_type")
    posterPath = serializers.CharField(source="poster_path", allow_null=True)
    voteAverage = serializers.FloatField(source="vote_average")
    addedAt = serializers.DateTimeField(source="added_at", read_only=True)

    class Meta:
        model = WatchlistEntry
        fields = ("id", "mediaId", "mediaType", "title", "posterPath", "voteAverage", "addedAt", "watched")
        read_only_fields = ("id", "addedAt")


class WatchedEntrySerializer(serializers.ModelSerializer):
    mediaId = serializers.IntegerField(source="media_id")
    mediaType = serializers.CharField(source="media_type")
    posterPath = serializers.CharField(source="poster_path", allow_null=True)
    voteAverage = serializers.FloatField(source="vote_average")
    watchedAt = serializers.DateTimeField(source="watched_at", read_only=True)
    originalLanguage = serializers.CharField(source="original_language", allow_null=True, allow_blank=True, required=False)
    releaseYear = serializers.IntegerField(source="release_year", allow_null=True, required=False)

    class Meta:
        model = WatchedEntry
        fields = ("id", "mediaId", "mediaType", "title", "posterPath", "voteAverage", "watchedAt", "originalLanguage", "releaseYear")
        read_only_fields = ("id", "watchedAt")


class RatingEntrySerializer(serializers.ModelSerializer):
    mediaId = serializers.IntegerField(source="media_id")
    mediaType = serializers.CharField(source="media_type")
    userRating = serializers.FloatField(source="user_rating")
    ratedAt = serializers.DateTimeField(source="rated_at", read_only=True)

    class Meta:
        model = RatingEntry
        fields = ("id", "mediaId", "mediaType", "title", "userRating", "review", "ratedAt")
        read_only_fields = ("id", "ratedAt")


class UserListItemSerializer(serializers.ModelSerializer):
    mediaId = serializers.IntegerField(source="media_id")
    mediaType = serializers.CharField(source="media_type")
    posterPath = serializers.CharField(source="poster_path", allow_null=True)
    voteAverage = serializers.FloatField(source="vote_average")
    addedAt = serializers.DateTimeField(source="added_at", read_only=True)

    class Meta:
        model = UserListItem
        fields = ("id", "mediaId", "mediaType", "title", "posterPath", "voteAverage", "addedAt", "watched")
        read_only_fields = ("id", "addedAt")


class UserListSerializer(serializers.ModelSerializer):
    items = UserListItemSerializer(many=True, read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = UserList
        fields = ("id", "name", "description", "items", "createdAt")
        read_only_fields = ("id", "createdAt")
