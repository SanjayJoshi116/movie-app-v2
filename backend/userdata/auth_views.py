import hashlib
import io
import logging
import threading

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import status
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
from .models import Profile, TMDBProfile
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

logger = logging.getLogger(__name__)


def _in_background(target):
    """Run `target` on a daemon thread. It must not touch the DB or the cache."""
    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    return thread


class LoginThrottle(AnonRateThrottle):
    scope = "login"


def _login_failure_key(username):
    # Hashed so raw usernames never sit in the cache table.
    return "login_fail:" + hashlib.sha256(username.strip().lower().encode()).hexdigest()


def _login_failures(key):
    return cache.get(key, 0)


def _record_login_failure(key):
    cache.add(key, 0, settings.LOGIN_FAILURE_WINDOW_SECONDS)  # the window starts at the first failure
    try:
        cache.incr(key)
    except ValueError:  # expired between add() and incr()
        cache.add(key, 1, settings.LOGIN_FAILURE_WINDOW_SECONDS)


class RegisterThrottle(AnonRateThrottle):
    scope = "register"


class PasswordResetThrottle(AnonRateThrottle):
    scope = "password_reset"


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
    and OutstandingToken is never flushed, so a per-row loop over the whole
    history grew without bound. Two queries regardless of history;
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
    from django.core.mail import send_mail
    from django.conf import settings

    body = PasswordResetRequestInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    email = body.validated_data["email"].strip()
    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # filter().first() rather than get(): registration didn't enforce email
        # uniqueness until now, so accounts created before that fix can still have a
        # duplicate email in the DB. get() would raise MultipleObjectsReturned in that
        # case -- an unhandled 500 that surfaces to the user as a generic
        # "Something went wrong" with no indication of the real cause.
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise User.DoesNotExist
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
        user_pk, username, address = user.pk, user.username, user.email
        message = (
            f"Hi {username},\n\n"
            f"Click the link below to reset your password:\n{reset_url}\n\n"
            f"This link expires in {_reset_link_lifetime()}.\n\n"
            f"If you didn't request this, you can ignore this email."
        )

        def send():
            # Everything is computed above: no DB or cache access on this thread.
            try:
                send_mail(
                    subject="Reset your CINE DB password",
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[address],
                    fail_silently=False,
                )
            except Exception:
                # Broad on purpose: the configured EMAIL_BACKEND varies by deploy
                # (console/SMTP/a 3rd-party API), each with its own exception
                # types (smtplib.SMTPException, socket/OSError, SDK-specific
                # errors) — narrowing would mean missing whichever backend isn't
                # anticipated.
                logger.exception("Failed to send password reset email to user %s", user_pk)

        # Off the request thread: waiting for the mail server only on the
        # registered-email path would make response time reveal account existence.
        _in_background(send)
    except User.DoesNotExist:
        pass  # Don't reveal whether the email is registered

    return Response({"detail": "If that email is registered, a reset link has been sent."})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
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

    user.set_password(new_password)
    user.save()
    # Whoever triggered the reset may be locking out an attacker: end every
    # existing session (at its next refresh) along with the old password.
    _revoke_all_refresh_tokens(user)
    return Response({"detail": "Password reset successfully."})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
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
    if _login_failures(failure_key) >= settings.LOGIN_FAILURE_LIMIT:
        response = Response(
            {"detail": "Too many failed login attempts for this account. Try again later."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
        response["Retry-After"] = str(settings.LOGIN_FAILURE_WINDOW_SECONDS)
        return response
    user = authenticate(username=username, password=password)
    if user is None:
        _record_login_failure(failure_key)
        return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
    tokens = _tokens_for_user(user)
    return Response({"user": UserSerializer(user).data, **tokens})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    body = PasswordInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    password = body.validated_data["password"]
    if not password or not request.user.check_password(password):
        return Response({"detail": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)
    session_id = TMDBProfile.objects.filter(user=request.user).values_list("session_id", flat=True).first()
    if session_id:
        # Best-effort, before the id is gone with the account; never blocks deletion.
        tmdb_client.revoke_tmdb_session(request.user.id, session_id)
    request.user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)

    # Verifying current_password (in is_valid) can rehash the stored password
    # when the hasher's parameters changed, which changes the CHECK_REVOKE_TOKEN
    # claim and kills this session's tokens. Snapshot it before that happens.
    claim_before = get_md5_hash_password(request.user.password)
    serializer = UserProfileUpdateSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    user = request.user
    old_email = user.email
    for field in ("first_name", "last_name", "username", "email"):
        if field in data:
            setattr(user, field, data[field])
    if data.get("new_password"):
        user.set_password(data["new_password"])
    try:
        # The serializer's uniqueness check can't see a concurrent rename that
        # commits first; the DB constraint can. atomic() keeps the connection
        # usable after the failed INSERT/UPDATE.
        with transaction.atomic():
            user.save()
    except IntegrityError:
        return Response(
            {"username": ["This username is already taken."]}, status=status.HTTP_400_BAD_REQUEST
        )
    if old_email and user.email.lower() != old_email.lower():
        _notify_email_changed(user, old_email)
    body = dict(UserSerializer(user).data)
    if data.get("new_password"):
        # Revoke first, then issue the fresh pair, so this session survives
        # while every other session ends at its next refresh.
        _revoke_all_refresh_tokens(user)
        body.update(_tokens_for_user(user))
    elif get_md5_hash_password(user.password) != claim_before:
        # Rehash only: same password, so nothing to revoke, but this session
        # needs tokens carrying the new claim to stay signed in.
        body.update(_tokens_for_user(user))
    return Response(body)


def _notify_email_changed(user, old_email):
    """Tell the previous address its account email changed (best-effort)."""
    from django.core.mail import send_mail

    try:
        send_mail(
            subject="Your CINE DB email was changed",
            message=(
                f"Hi {user.username},\n\n"
                f"The email address on your CINE DB account was just changed from this "
                f"address to a new one.\n\n"
                f"If you didn't do this, reset your password and contact support right away."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[old_email],
            fail_silently=False,
        )
    except Exception:
        # Broad on purpose: same EMAIL_BACKEND-varies-by-deploy rationale as
        # password_reset_request's send_mail. The email change itself already
        # succeeded and must not be reported as failed because of this.
        logger.exception("Failed to send email-change notice for user %s", user.pk)


def _reencode_avatar(file, image_format):
    """Decode and re-save the upload in its own format, so EXIF (GPS, camera
    serial, timestamps) and anything else embedded is dropped. The EXIF
    orientation is applied to the pixels first, so the photo still displays
    upright. Animated images keep their first frame."""
    file.seek(0)
    with Image.open(file) as img:
        icc_profile = img.info.get("icc_profile")
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
        if profile.avatar:
            old_name = profile.avatar.name
            profile.avatar = None
            with transaction.atomic():
                profile.save()
                delete_avatar_on_commit(old_name)
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
    old_name = profile.avatar.name if profile.avatar else ""
    profile.avatar = file
    try:
        with transaction.atomic():
            profile.save()  # stores the file first, then the row
            if old_name != profile.avatar.name:
                delete_avatar_on_commit(old_name)
    except Exception:
        # Broad on purpose, and re-raised: storage and DB errors both land
        # here, and either way the newly written file must not be orphaned.
        if profile.avatar._committed and profile.avatar.name != old_name:
            profile.avatar.storage.delete(profile.avatar.name)
        raise
    return Response(UserSerializer(request.user).data)
