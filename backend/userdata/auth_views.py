import hashlib
import io
import logging
import math
import threading
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User, update_last_login
from django.core.files.base import ContentFile
from django.db import IntegrityError, connection, transaction
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.utils import get_md5_hash_password

from . import tmdb_client
from .models import LoginFailure, Profile, TMDBProfile
from .signals import delete_avatar_on_commit
from .serializers import (
    LoginInputSerializer,
    PasswordInputSerializer,
    PasswordResetConfirmInputSerializer,
    PasswordResetRequestInputSerializer,
    RegisterSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
)

MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}
AVATAR_EXT_BY_FORMAT = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
AVATAR_MAX_PIXELS = 16_000_000
AVATAR_MAX_SIDE = 1024  # stored avatars are scaled down to fit this square

logger = logging.getLogger(__name__)

_FAILURE_TABLE = connection.ops.quote_name(LoginFailure._meta.db_table)


def _in_background(target):
    """Run `target` on a daemon thread. It must not touch the DB or the cache."""
    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    return thread


def _mail_in_background(address, subject, message, what, user_pk):
    """Send one plain-text mail off the request thread (best-effort). Takes
    plain values only: the thread never touches the DB or the cache."""
    from django.core.mail import send_mail

    def send():
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[address],
                fail_silently=False,
            )
        except Exception:
            # Broad on purpose: the configured EMAIL_BACKEND varies by deploy
            # (console/SMTP/a 3rd-party API), each with its own exception types
            # (smtplib.SMTPException, socket/OSError, SDK-specific errors), and
            # the action this mail reports has already succeeded.
            logger.exception("Failed to send %s email to user %s", what, user_pk)

    return _in_background(send)


class LoginThrottle(AnonRateThrottle):
    scope = "login"


def _login_failure_key(username):
    # Hashed so raw usernames are never stored. Exact, as sign-in matches
    # usernames: folding case let failures on "Alice" lock out "alice".
    return hashlib.sha256(username.encode()).hexdigest()


def _failure_window():
    return timedelta(seconds=settings.LOGIN_FAILURE_WINDOW_SECONDS)


def _login_failure_state(key):
    """(count, seconds left in the window) for key; (0, 0) once it has passed.
    The DB clock decides, as it does when recording."""
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT count, EXTRACT(EPOCH FROM window_start + %s - now()) FROM {_FAILURE_TABLE} "
            "WHERE key = %s AND window_start > now() - %s",
            [_failure_window(), key, _failure_window()],
        )
        row = cursor.fetchone()
    return (row[0], max(1, math.ceil(row[1]))) if row else (0, 0)


def _login_failures(key):
    return _login_failure_state(key)[0]


def _record_login_failure(key):
    """Count one failure, atomically. The window runs from its first failure:
    later failures never move it, and the first one after it has passed starts
    a new one. Concurrent upserts on one key serialize on its row, so a
    parallel burst counts every failure."""
    window = _failure_window()
    with connection.cursor() as cursor:
        cursor.execute(
            f"INSERT INTO {_FAILURE_TABLE} AS f (key, count, window_start) VALUES (%s, 1, now()) "
            "ON CONFLICT (key) DO UPDATE SET "
            "count = CASE WHEN f.window_start <= now() - %s THEN 1 ELSE f.count + 1 END, "
            "window_start = CASE WHEN f.window_start <= now() - %s THEN now() ELSE f.window_start END",
            [key, window, window],
        )
        # Keeps the table at about the usernames failing within the last window.
        cursor.execute(f"DELETE FROM {_FAILURE_TABLE} WHERE window_start <= now() - %s", [window])


def _clear_login_failures(key):
    LoginFailure.objects.filter(key=key).delete()


def _login_limited_response(key):
    """The 429 for a username at the per-username limit, or None. Shared by
    login and the password-gated account actions so they can't drift apart."""
    count, seconds_left = _login_failure_state(key)
    if count < settings.LOGIN_FAILURE_LIMIT:
        return None
    response = Response(
        {"detail": "Too many failed login attempts for this account. Try again later."},
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )
    response["Retry-After"] = str(seconds_left)
    return response


class RegisterThrottle(AnonRateThrottle):
    scope = "register"


class PasswordResetThrottle(AnonRateThrottle):
    scope = "password_reset"


class PasswordResetConfirmThrottle(AnonRateThrottle):
    """Separate from requesting a link, so a few rejected passwords on the
    confirm form don't use up the request allowance, or the reverse."""

    scope = "password_reset_confirm"


class TokenSessionThrottle(AnonRateThrottle):
    """Token refresh and logout. Set as the views' *only* throttle, replacing
    the defaults: under the shared anon 300/day bucket, ~12 users behind one NAT
    refreshing hourly ran it dry and got logged out. Anon-based on purpose:
    these views set authentication_classes=(), so request.user is always
    anonymous and the key is the client IP either way."""

    scope = "token_refresh"


def _reset_link_lifetime():
    """PASSWORD_RESET_TIMEOUT as the reset email states it, so the two can't drift apart."""
    hours = settings.PASSWORD_RESET_TIMEOUT // 3600
    return f"{hours} hour{'' if hours == 1 else 's'}"


def _tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _revoke_all_refresh_tokens(user):
    """Blacklist every refresh token ever issued to user, rotated ones included.

    Defense in depth since fix-password-revoke-race: the primary guard is the
    CHECK_REVOKE_TOKEN password claim, which SafeTokenRefreshSerializer and
    JWTAuthentication check on every use, so a token this snapshot misses
    still dies. This keeps the blacklist table consistent with what's revoked.

    Relies on simplejwt >= 5.5.0 recording
    rotated refresh tokens as outstanding — older versions would miss them.

    Only live, not-yet-blacklisted tokens: expired ones already fail validation,
    and expired rows pile up between the startup flushexpiredtokens runs, so a
    per-row loop over the whole history grew without bound. Two queries regardless of history;
    ignore_conflicts covers a concurrent logout blacklisting one of them.
    """
    live = OutstandingToken.objects.filter(
        user=user, expires_at__gt=timezone.now(), blacklistedtoken__isnull=True,
    )
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=t) for t in live], ignore_conflicts=True,
    )


class SafeTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        try:
            self._check_password_claim(attrs["refresh"])
            return super().validate(attrs)
        except User.DoesNotExist:
            raise InvalidToken("No account found for this token.") from None

    def _check_password_claim(self, raw):
        """Reject a refresh token minted under a since-changed password.

        Stock simplejwt checks CHECK_REVOKE_TOKEN's claim only on access tokens.
        Without this, a refresh that passed the blacklist check just before a
        password change could record its rotated token after the revoke snapshot
        and keep rotating forever. Runs before super() so a stale token is never
        rotated or recorded. A missing claim (pre-rollout token) is rejected too.
        """
        token = self.token_class(raw)
        user = User.objects.get(**{jwt_settings.USER_ID_FIELD: token[jwt_settings.USER_ID_CLAIM]})
        if token.get(jwt_settings.REVOKE_TOKEN_CLAIM) != get_md5_hash_password(user.password):
            raise InvalidToken("Password changed; sign in again.")


class SafeTokenRefreshView(TokenRefreshView):
    serializer_class = SafeTokenRefreshSerializer
    throttle_classes = (TokenSessionThrottle,)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def password_reset_request(request):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes

    body = PasswordResetRequestInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    email = body.validated_data["email"].strip()
    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Every active account on the address gets its own link: accounts from
    # before registration enforced unique emails can share one. Inactive and
    # password-less accounts get none, as in Django's PasswordResetForm.
    for user in User.objects.filter(email__iexact=email, is_active=True):
        if not user.has_usable_password():
            continue
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
        message = (
            f"Hi {user.username},\n\n"
            f"Click the link below to reset your password:\n{reset_url}\n\n"
            f"This link expires in {_reset_link_lifetime()}.\n\n"
            f"If you didn't request this, you can ignore this email."
        )
        # Off the request thread: waiting for the mail server only on the
        # registered-email path would make response time reveal account existence.
        _mail_in_background(user.email, "Reset your CINE DB password", message, "password reset", user.pk)
    # The same answer whether zero, one or several accounts matched.
    return Response({"detail": "If that email is registered, a reset link has been sent."})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetConfirmThrottle])
def password_reset_confirm(request):
    from django.contrib.auth.tokens import default_token_generator
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError
    from django.utils.http import urlsafe_base64_decode
    from django.utils.encoding import force_str

    body = PasswordResetConfirmInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    uid = body.validated_data["uid"]
    token = body.validated_data["token"]
    new_password = body.validated_data["new_password"]

    if not uid or not token or not new_password:
        return Response({"detail": "uid, token, and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({"detail": "Reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        return Response({"detail": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    # All or nothing: a failure leaves the old password (so the link still
    # works) rather than a new password with the old sessions on record.
    with transaction.atomic():
        user.set_password(new_password)
        # Only the password: `user` was read before validation, and a full save
        # would revert a profile edit committed meanwhile.
        user.save(update_fields=["password"])
        # Whoever triggered the reset may be locking out an attacker: end every
        # existing session (at its next refresh) along with the old password.
        _revoke_all_refresh_tokens(user)
        # Someone else's guessing may have locked this username; the new password
        # must work straight away.
        _clear_login_failures(_login_failure_key(user.username))
    return Response({"detail": "Password reset successfully."})


EMAIL_TAKEN = "An account with this email already exists."


def _email_taken_under_lock(email, exclude_pk=None):
    """Re-check an email's uniqueness with writers of that address serialized.

    auth_user.email has no unique index (older accounts may already share
    one), so the serializers' check alone races: two requests for the same new
    address can both pass it. A transaction-scoped advisory lock on the
    upper-cased address (the fold email__iexact compares with on PostgreSQL)
    makes the second wait and then see the first's row.
    Call inside transaction.atomic(); PostgreSQL only.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtext(upper(%s)))", [email])
    others = User.objects.filter(email__iexact=email)
    if exclude_pk is not None:
        others = others.exclude(pk=exclude_pk)
    return others.exists()


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data.get("email") or ""
    try:
        with transaction.atomic():
            if email and _email_taken_under_lock(email):
                return Response({"email": [EMAIL_TAKEN]}, status=status.HTTP_400_BAD_REQUEST)
            user = serializer.save()
    except IntegrityError:
        return Response({"detail": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)
    tokens = _tokens_for_user(user)
    return Response(
        {"user": UserSerializer(user).data, **tokens},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login(request):
    from django.contrib.auth import authenticate

    body = LoginInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    username = body.validated_data["username"]
    password = body.validated_data["password"]
    # Per-username limit across all IPs, checked before the password so a
    # distributed guesser learns nothing once it trips (existing or not).
    failure_key = _login_failure_key(username)
    limited = _login_limited_response(failure_key)
    if limited:
        return limited
    user = authenticate(username=username, password=password)
    if user is None:
        _record_login_failure(failure_key)
        return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
    # The right password ends this username's failure run, as a reset does.
    _clear_login_failures(failure_key)
    # As Django's own login does: last_login is part of the reset-token hash,
    # so signing in ends any reset link mailed before.
    update_last_login(None, user)
    tokens = _tokens_for_user(user)
    return Response({"user": UserSerializer(user).data, **tokens})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    body = PasswordInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    password = body.validated_data["password"]
    # Same per-username limit as login, so a stolen session can't guess the
    # password here without bound.
    failure_key = _login_failure_key(request.user.username)
    limited = _login_limited_response(failure_key)
    if limited:
        return limited
    # Setter-less check: user.check_password() would rehash and commit outside
    # the delete's transaction, so a failed delete could still end the session.
    if not password or not check_password(password, request.user.password):
        if password:
            _record_login_failure(failure_key)
        return Response({"detail": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)
    # Read before the account (and its TMDB profile) is gone; revoke only after
    # the deletion, in the background, so a slow TMDB can never stop it.
    session_id = TMDBProfile.objects.filter(user=request.user).values_list("session_id", flat=True).first()
    user_id = request.user.id
    with transaction.atomic():
        request.user.delete()
        # The username is free again: whoever registers it next must not
        # inherit this account's failed attempts (a rename clears it too).
        _clear_login_failures(failure_key)
    if session_id:
        tmdb_client.revoke_in_background(user_id, session_id)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)

    # A current_password is checked against the same per-username limit as
    # login (before it is verified), and a wrong one counts toward it. Edits
    # that send no password are unaffected.
    failure_key = _login_failure_key(request.user.username)
    if isinstance(request.data, dict) and request.data.get("current_password"):
        limited = _login_limited_response(failure_key)
        if limited:
            return limited
    serializer = UserProfileUpdateSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        if serializer.password_rejected:
            _record_login_failure(failure_key)
        raise ValidationError(serializer.errors)
    data = serializer.validated_data

    user = request.user
    old_email = user.email
    old_username = user.username
    new_email = data.get("email") or ""
    email_changed = bool(new_email) and new_email.lower() != (old_email or "").lower()
    # Only what this update changes: request.user was read at authentication,
    # and a full save would put back anything committed since, a password
    # reset's new hash included.
    changed = [f for f in ("first_name", "last_name", "username", "email") if f in data]
    for field in changed:
        setattr(user, field, data[field])
    if data.get("new_password"):
        user.set_password(data["new_password"])
        changed.append("password")
    try:
        # The serializer's uniqueness check can't see a concurrent rename that
        # commits first; the DB constraint can. atomic() keeps the connection
        # usable after the failed INSERT/UPDATE.
        with transaction.atomic():
            if email_changed and _email_taken_under_lock(new_email, exclude_pk=user.pk):
                return Response({"email": [EMAIL_TAKEN]}, status=status.HTTP_400_BAD_REQUEST)
            if changed:
                user.save(update_fields=changed)
            if old_email and user.email.lower() != old_email.lower():
                # After commit and off the request thread: a stalled mail
                # server must not keep the token revoke/reissue below from running.
                username, user_pk = user.username, user.pk
                transaction.on_commit(lambda: _notify_email_changed(user_pk, username, old_email))
            if user.username != old_username:
                # The old name is free again, as after a deletion.
                _clear_login_failures(failure_key)
            if old_email and user.username != old_username:
                # To the address on file before this update, so a rename plus
                # an email change made with a stolen token still reaches the owner.
                new_username, user_pk = user.username, user.pk
                transaction.on_commit(
                    lambda: _notify_username_changed(user_pk, old_username, new_username, old_email)
                )
    except IntegrityError:
        return Response(
            {"username": ["This username is already taken."]}, status=status.HTTP_400_BAD_REQUEST
        )
    body = dict(UserSerializer(user).data)
    if data.get("new_password"):
        # Revoke first, then issue the fresh pair, so this session survives
        # while every other session ends at its next refresh.
        _revoke_all_refresh_tokens(user)
        body.update(_tokens_for_user(user))
    return Response(body)


def _notify_email_changed(user_pk, username, old_email):
    """Tell the previous address its account email changed (best-effort; the
    change already succeeded and is never reported as failed because of this)."""
    _mail_in_background(
        old_email,
        "Your CINE DB email was changed",
        f"Hi {username},\n\n"
        "The email address on your CINE DB account was just changed from this "
        "address to a new one.\n\n"
        "If you didn't do this, reset your password and contact support right away.",
        "email-change notice",
        user_pk,
    )


def _notify_username_changed(user_pk, old_username, new_username, address):
    """Tell the account's address its username changed (best-effort, like
    _notify_email_changed)."""
    _mail_in_background(
        address,
        "Your CINE DB username was changed",
        "Hi,\n\n"
        f"The username on your CINE DB account was just changed from {old_username} "
        f"to {new_username}. Use the new username to sign in.\n\n"
        "If you didn't do this, reset your password and contact support right away.",
        "username-change notice",
        user_pk,
    )


def _reencode_avatar(file, image_format):
    """Decode and re-save the upload in its own format, so EXIF (GPS, camera
    serial, timestamps) and anything else embedded is dropped. The EXIF
    orientation is applied to the pixels first, so the photo still displays
    upright. Animated images keep their first frame. The result is scaled down
    to fit AVATAR_MAX_SIDE, before the transpose, which copies the image."""
    file.seek(0)
    with Image.open(file) as img:
        icc_profile = img.info.get("icc_profile")
        bound = (AVATAR_MAX_SIDE, AVATAR_MAX_SIDE)
        if image_format == "JPEG":
            img.draft(img.mode, bound)  # decode at a reduced scale where JPEG allows
        img.thumbnail(bound)
        img = ImageOps.exif_transpose(img)
        if image_format == "JPEG" and img.mode not in ("RGB", "L", "CMYK"):
            img = img.convert("RGB")
        elif image_format == "WEBP" and img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        out = io.BytesIO()
        options = {"quality": 90} if image_format in ("JPEG", "WEBP") else {}
        if icc_profile:
            options["icc_profile"] = icc_profile
        img.save(out, format=image_format, **options)
    return out.getvalue()


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def avatar(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == "DELETE":
        with transaction.atomic():
            # Locked like a replace, so it can't race one into an orphan.
            locked = Profile.objects.select_for_update().get(pk=profile.pk)
            if locked.avatar:
                old_name = locked.avatar.name
                locked.avatar = None
                locked.save()
                delete_avatar_on_commit(old_name)
        request.user.profile = locked  # the response reads the row just saved
        return Response(UserSerializer(request.user).data)

    file = request.FILES.get("avatar")
    if not file:
        return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        return Response(
            {"detail": "Unsupported image type. Use JPEG, PNG, or WebP."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if file.size > MAX_AVATAR_BYTES:
        return Response({"detail": "Image must be smaller than 5MB."}, status=status.HTTP_400_BAD_REQUEST)
    invalid = Response({"detail": "File is not a valid image."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        with Image.open(file) as img:
            # Pillow raises DecompressionBombError only above 2x MAX_IMAGE_PIXELS
            # and merely warns between 1x and 2x; reject that band too. An
            # explicit check rather than warnings.catch_warnings(), which mutates
            # process-global state and isn't thread-safe.
            if img.width * img.height > Image.MAX_IMAGE_PIXELS:
                return invalid
            # Far below the decoder limit: a few-hundred-KB single-colour PNG
            # of ~90M px decodes to several hundred MB. Checked from the header,
            # before any pixels are decoded.
            if img.width * img.height > AVATAR_MAX_PIXELS:
                return Response(
                    {"detail": "Image is too large. Use one under 16 megapixels."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            image_format = img.format
            img.verify()
        file.seek(0)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError, ValueError, IndexError):
        # DecompressionBombError isn't an OSError. Several Pillow plugins raise
        # SyntaxError/ValueError on malformed headers or chunks during verify(),
        # and PNG verify() raises IndexError on a file with no IDAT chunk.
        return invalid
    # The stored extension (and so the served Content-Type) comes from the
    # decoded format, never the client's filename — `x.html` that decodes as a
    # PNG polyglot must not be served back as text/html on our origin.
    ext = AVATAR_EXT_BY_FORMAT.get(image_format)
    if ext is None:
        return Response(
            {"detail": "Unsupported image type. Use JPEG, PNG, or WebP."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        data = _reencode_avatar(file, image_format)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError, ValueError, IndexError):
        # verify() doesn't decode pixels; a truncated or corrupt body fails here.
        return invalid
    file = ContentFile(data, name=f"avatar.{ext}")

    # The old file goes only after the new one is stored and the row committed,
    # so a failed replace leaves the current photo in place and served.
    locked = None
    try:
        with transaction.atomic():
            # Locked, so a concurrent upload waits and then sees this one's
            # file as its old one, instead of both deleting the same old file
            # and orphaning one new file. Decoding stays outside the lock.
            locked = Profile.objects.select_for_update().get(pk=profile.pk)
            old_name = locked.avatar.name if locked.avatar else ""
            locked.avatar = file
            locked.save()  # stores the file first, then the row
            if old_name != locked.avatar.name:
                delete_avatar_on_commit(old_name)
    except Exception:
        # Broad on purpose, and re-raised: storage and DB errors both land
        # here, and either way the newly written file must not be orphaned.
        # `locked` is None if the lock itself failed: nothing new was stored.
        if locked is not None and locked.avatar._committed and locked.avatar.name != old_name:
            locked.avatar.storage.delete(locked.avatar.name)
        raise
    request.user.profile = locked  # the response reads the row just saved
    return Response(UserSerializer(request.user).data)
