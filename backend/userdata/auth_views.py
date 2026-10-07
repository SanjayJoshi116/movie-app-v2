import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.utils import timezone
from PIL import Image, UnidentifiedImageError
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

from .models import Profile
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


class LoginThrottle(AnonRateThrottle):
    scope = "login"


class RegisterThrottle(AnonRateThrottle):
    scope = "register"


class PasswordResetThrottle(AnonRateThrottle):
    scope = "password_reset"


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
        try:
            send_mail(
                subject="Reset your CINE DB password",
                message=(
                    f"Hi {user.username},\n\n"
                    f"Click the link below to reset your password:\n{reset_url}\n\n"
                    f"This link expires in {_reset_link_lifetime()}.\n\n"
                    f"If you didn't request this, you can ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:
            # Broad on purpose: the configured EMAIL_BACKEND varies by deploy
            # (console/SMTP/a 3rd-party API), each with its own exception
            # types (smtplib.SMTPException, socket/OSError, SDK-specific
            # errors) — narrowing would mean missing whichever backend isn't
            # anticipated. Also: log but don't surface a distinct response —
            # a different status here vs. the unregistered-email path would
            # leak account existence.
            logger.exception("Failed to send password reset email to user %s", user.pk)
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
    user = authenticate(username=username, password=password)
    if user is None:
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
    request.user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)

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


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def avatar(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == "DELETE":
        if profile.avatar:
            profile.avatar.delete(save=False)
            profile.avatar = None
            profile.save()
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
    file.name = f"avatar.{ext}"

    if profile.avatar:
        profile.avatar.delete(save=False)
    profile.avatar = file
    profile.save()
    return Response(UserSerializer(request.user).data)
