import datetime
import hashlib
import json
import logging
import os
import secrets
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as URLRequest
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi import Request as FastAPIRequest
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import SESSION_COOKIE_NAME, create_user_access_token, get_password_hash, require_user, verify_password
from database import User, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_ME_URL = "https://discord.com/api/users/@me"

POSTMARK_EMAIL_URL = "https://api.postmarkapp.com/email"
RESEND_EMAIL_URL = "https://api.resend.com/emails"

DISCORD_HTTP_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "SWGL-Tools/1.0 (+https://jawatracks.com)",
}
DISCORD_STATE_COOKIE = "discord_oauth_state"
DISCORD_STATE_MAX_AGE = 600

PASSWORD_RESET_EXPIRY_MINUTES = 60

PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "10"))
SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7


class DiscordOAuthError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    display_name: str = ""


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class MessageResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    display_name: str
    is_admin: bool = False
    role: str = "user"
    auth_provider: str = "local"
    discord_username: str | None = None
    discord_avatar: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class AuthProvidersResponse(BaseModel):
    discord: bool


def _request_extra(request: FastAPIRequest, **extra: object) -> dict[str, object]:
    base = {
        "request_id": getattr(request.state, "request_id", request.headers.get("x-request-id", "-")),
        "path": request.url.path,
        "method": request.method,
    }
    base.update(extra)
    return base


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC).replace(tzinfo=None)


def _get_public_base_url() -> str:
    return os.getenv("PUBLIC_BASE_URL", "http://localhost:5173").rstrip("/")


def _get_discord_redirect_uri(request: FastAPIRequest | None = None) -> str:
    configured = os.getenv("DISCORD_REDIRECT_URI", "").strip()
    if configured:
        return configured
    if request is not None:
        return str(request.url_for("discord_callback"))
    return ""


def _discord_enabled(request: FastAPIRequest | None = None) -> bool:
    return bool(
        os.getenv("DISCORD_CLIENT_ID", "").strip()
        and os.getenv("DISCORD_CLIENT_SECRET", "").strip()
        and _get_discord_redirect_uri(request)
    )


def _postmark_enabled() -> bool:
    return bool(
        os.getenv("POSTMARK_SERVER_TOKEN", "").strip()
        and os.getenv("POSTMARK_FROM_EMAIL", "").strip()
        and _get_public_base_url()
    )


def _resend_enabled() -> bool:
    return bool(
        os.getenv("RESEND_API_KEY", "").strip()
        and os.getenv("RESEND_FROM_EMAIL", "").strip()
        and _get_public_base_url()
    )


def _email_provider() -> str:
    configured = os.getenv("EMAIL_PROVIDER", "").strip().lower()
    if configured in {"resend", "postmark"}:
        return configured
    if _resend_enabled():
        return "resend"
    if _postmark_enabled():
        return "postmark"
    return ""


def _email_enabled() -> bool:
    return bool(_email_provider())


def _session_cookie_domain() -> str | None:
    return os.getenv("SESSION_COOKIE_DOMAIN", "").strip() or None


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        path="/api",
        domain=_session_cookie_domain(),
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/api", domain=_session_cookie_domain(), samesite="lax")


def _validate_password_strength(password: str) -> None:
    if len(password or "") < PASSWORD_MIN_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {PASSWORD_MIN_LENGTH} characters")


def _with_state_cookie(
    response: RedirectResponse, state: str | None = None, *, clear: bool = False
) -> RedirectResponse:
    if clear:
        response.delete_cookie(DISCORD_STATE_COOKIE, path="/", samesite="lax")
        return response
    if state:
        response.set_cookie(
            DISCORD_STATE_COOKIE,
            state,
            max_age=DISCORD_STATE_MAX_AGE,
            httponly=True,
            secure=_cookie_secure(),
            samesite="lax",
            path="/",
        )
    return response


def _redirect_frontend(
    *, error: str | None = None, clear_state: bool = True, session_token: str | None = None
) -> RedirectResponse:
    response = RedirectResponse(_build_frontend_redirect(error=error))
    if session_token:
        _set_session_cookie(response, session_token)
    if clear_state:
        return _with_state_cookie(response, clear=True)
    return response


def _build_frontend_redirect(error: str | None = None) -> str:
    qs = {}
    if error:
        qs["error"] = error
    suffix = f"?{urlencode(qs)}" if qs else ""
    return f"{_get_public_base_url()}/auth/discord/callback{suffix}"


def _coalesce_user(user: User) -> UserResponse:
    return UserResponse.model_validate(user)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _unique_username(base: str, db: Session) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "_" for ch in (base or "discord_user")).strip("_")
    slug = slug[:40] or "discord_user"
    candidate = slug
    counter = 1
    while db.query(User).filter(User.username == candidate).first():
        suffix = f"_{counter}"
        candidate = f"{slug[: max(1, 40 - len(suffix))]}{suffix}"
        counter += 1
    return candidate


def _load_json(req: URLRequest, *, error_code: str, context: str, request_id: str | None = None) -> dict:
    start = time.perf_counter()
    try:
        with urlopen(req, timeout=15) as response:
            payload = response.read().decode("utf-8")
            logger.info(
                f"discord_{context.replace(' ', '_')}_complete",
                extra={
                    "request_id": request_id or "-",
                    "status_code": getattr(response, "status", 200),
                    "duration_ms": round((time.perf_counter() - start) * 1000, 3),
                },
            )
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning(
            f"discord_{context.replace(' ', '_')}_http_error",
            extra={
                "request_id": request_id or "-",
                "status_code": exc.code,
                "duration_ms": round((time.perf_counter() - start) * 1000, 3),
                "body_preview": body,
            },
        )
        lowered = body.lower()
        if "rate limited" in lowered or "too many tokens" in lowered or exc.code == 429:
            raise DiscordOAuthError("discord_rate_limited") from exc
        raise DiscordOAuthError(error_code) from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.exception(
            f"discord_{context.replace(' ', '_')}_network_error",
            extra={
                "request_id": request_id or "-",
                "duration_ms": round((time.perf_counter() - start) * 1000, 3),
                "error_type": type(exc).__name__,
            },
        )
        raise DiscordOAuthError(error_code) from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        logger.warning(
            f"discord_{context.replace(' ', '_')}_json_error",
            extra={
                "request_id": request_id or "-",
                "payload_preview": payload[:500],
            },
        )
        raise DiscordOAuthError(error_code) from exc


def _exchange_discord_code(code: str, redirect_uri: str, request_id: str | None = None) -> dict:
    payload = urlencode(
        {
            "client_id": os.getenv("DISCORD_CLIENT_ID", "").strip(),
            "client_secret": os.getenv("DISCORD_CLIENT_SECRET", "").strip(),
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }
    ).encode("utf-8")
    req = URLRequest(
        DISCORD_TOKEN_URL,
        data=payload,
        headers={
            **DISCORD_HTTP_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    return _load_json(req, error_code="discord_token_exchange_failed", context="token exchange", request_id=request_id)


def _get_discord_me(access_token: str, request_id: str | None = None) -> dict:
    req = URLRequest(
        DISCORD_ME_URL,
        headers={
            **DISCORD_HTTP_HEADERS,
            "Authorization": f"Bearer {access_token}",
        },
    )
    return _load_json(req, error_code="discord_profile_fetch_failed", context="profile fetch", request_id=request_id)


def _create_discord_user(
    db: Session,
    discord_id: str,
    discord_username: str,
    avatar_url: str | None,
    real_email: str | None,
) -> User:
    stored_email = real_email or f"discord_{discord_id}@users.invalid"
    last_error = None

    for _ in range(8):
        user = User(
            username=_unique_username(discord_username, db),
            email=stored_email,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            display_name=discord_username,
            discord_id=discord_id,
            discord_username=discord_username,
            discord_avatar=avatar_url,
            auth_provider="discord",
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError as exc:
            db.rollback()
            last_error = exc
            if real_email:
                existing = db.query(User).filter(User.email == real_email).first()
                if existing:
                    existing.discord_id = discord_id
                    existing.discord_username = discord_username
                    existing.discord_avatar = avatar_url
                    if not existing.display_name:
                        existing.display_name = discord_username
                    if existing.auth_provider != "local":
                        existing.auth_provider = "discord"
                    db.commit()
                    db.refresh(existing)
                    return existing
            continue

    raise last_error or RuntimeError("discord_user_create_failed")


def _send_postmark_email(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    payload = {
        "From": os.getenv("POSTMARK_FROM_EMAIL", "").strip(),
        "To": to_email,
        "Subject": subject,
        "TextBody": text_body,
        "HtmlBody": html_body,
    }

    stream = os.getenv("POSTMARK_MESSAGE_STREAM", "").strip()
    if stream:
        payload["MessageStream"] = stream

    req = URLRequest(
        POSTMARK_EMAIL_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": os.getenv("POSTMARK_SERVER_TOKEN", "").strip(),
            "User-Agent": "SWGL-Tools/1.0 (+https://jawatracks.com)",
        },
    )

    try:
        with urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8", errors="replace")
            if response.status >= 400:
                logger.warning(
                    "postmark_send_failed", extra={"status_code": response.status, "body_preview": body[:500]}
                )
                raise HTTPException(status_code=502, detail="Failed to send reset email")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning("postmark_http_error", extra={"status_code": exc.code, "body_preview": body})
        raise HTTPException(status_code=502, detail="Failed to send reset email") from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.exception("postmark_network_error", extra={"error_type": type(exc).__name__})
        raise HTTPException(status_code=502, detail="Failed to send reset email") from exc


def _send_resend_email(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    payload = {
        "from": os.getenv("RESEND_FROM_EMAIL", "").strip(),
        "to": [to_email],
        "subject": subject,
        "text": text_body,
        "html": html_body,
    }

    reply_to = os.getenv("RESEND_REPLY_TO_EMAIL", "").strip()
    if reply_to:
        payload["reply_to"] = reply_to

    req = URLRequest(
        RESEND_EMAIL_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.getenv('RESEND_API_KEY', '').strip()}",
            "User-Agent": "SWGL-Tools/1.0 (+https://jawatracks.com)",
        },
    )

    try:
        with urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8", errors="replace")
            if response.status >= 400:
                logger.warning("resend_send_failed", extra={"status_code": response.status, "body_preview": body[:500]})
                raise HTTPException(status_code=502, detail="Failed to send reset email")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning("resend_http_error", extra={"status_code": exc.code, "body_preview": body})
        raise HTTPException(status_code=502, detail="Failed to send reset email") from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.exception("resend_network_error", extra={"error_type": type(exc).__name__})
        raise HTTPException(status_code=502, detail="Failed to send reset email") from exc


def _send_email(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    provider = _email_provider()
    if provider == "resend":
        _send_resend_email(to_email, subject, text_body, html_body)
        return
    if provider == "postmark":
        _send_postmark_email(to_email, subject, text_body, html_body)
        return
    raise HTTPException(status_code=503, detail="Password reset email is not configured")


def _build_reset_url(raw_token: str) -> str:
    return f"{_get_public_base_url()}/auth/reset-password?token={raw_token}"


@router.get("/providers", response_model=AuthProvidersResponse)
def providers(request: FastAPIRequest):
    enabled = _discord_enabled(request)
    logger.info("auth_providers_checked", extra=_request_extra(request, discord_enabled=enabled))
    return AuthProvidersResponse(discord=enabled)


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    _validate_password_strength(req.password)

    user = User(
        username=req.username,
        email=req.email,
        hashed_password=get_password_hash(req.password),
        display_name=req.display_name or req.username,
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_user_access_token(user)
    _set_session_cookie(response, token)
    return TokenResponse(access_token=token, token_type="bearer", user=_coalesce_user(user))


@router.post("/login", response_model=TokenResponse)
def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_user_access_token(user)
    _set_session_cookie(response, token)
    return TokenResponse(access_token=token, token_type="bearer", user=_coalesce_user(user))


@router.get("/discord/login")
def discord_login(request: FastAPIRequest):
    if not _discord_enabled(request):
        logger.warning("discord_login_unavailable", extra=_request_extra(request))
        raise HTTPException(status_code=503, detail="Discord login is not configured")

    redirect_uri = _get_discord_redirect_uri(request)
    state = secrets.token_urlsafe(24)
    url = f"{DISCORD_AUTHORIZE_URL}?{urlencode({'client_id': os.getenv('DISCORD_CLIENT_ID', '').strip(), 'response_type': 'code', 'redirect_uri': redirect_uri, 'scope': 'identify email', 'state': state})}"
    logger.info("discord_login_redirect_created", extra=_request_extra(request, redirect_uri=redirect_uri))
    return _with_state_cookie(RedirectResponse(url), state)


@router.get("/discord/callback", name="discord_callback", response_model=None)
def discord_callback(
    request: FastAPIRequest,
    code: str | None = None,
    error: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
):
    logger.info(
        "discord_callback_started",
        extra=_request_extra(
            request,
            has_code=bool(code),
            has_error=bool(error),
            has_state=bool(state),
        ),
    )
    state_cookie = request.cookies.get(DISCORD_STATE_COOKIE, "")
    if error:
        logger.warning("discord_callback_denied", extra=_request_extra(request, provider_error=error))
        return _redirect_frontend(error=error)
    if not code:
        logger.warning("discord_callback_missing_code", extra=_request_extra(request))
        return _redirect_frontend(error="missing_code")
    if not _discord_enabled(request):
        logger.warning("discord_callback_not_configured", extra=_request_extra(request))
        return _redirect_frontend(error="discord_not_configured")
    if not state or not state_cookie or not secrets.compare_digest(state_cookie, state):
        logger.warning(
            "discord_state_validation_failed",
            extra=_request_extra(
                request,
                has_state_cookie=bool(state_cookie),
                has_state=bool(state),
            ),
        )
        return _redirect_frontend(error="invalid_state")

    logger.info("discord_state_validated", extra=_request_extra(request))
    redirect_uri = _get_discord_redirect_uri(request)
    request_id = getattr(request.state, "request_id", request.headers.get("x-request-id", "-"))
    try:
        token_data = _exchange_discord_code(code, redirect_uri, request_id=request_id)
        access_token = token_data.get("access_token")
        if not access_token:
            logger.warning("discord_token_missing", extra=_request_extra(request, token_payload=token_data))
            return _redirect_frontend(error="token_exchange_failed")
        discord_user = _get_discord_me(access_token, request_id=request_id)
    except DiscordOAuthError as exc:
        logger.warning("discord_callback_failed", extra=_request_extra(request, error_code=exc.code))
        return _redirect_frontend(error=exc.code)

    discord_id = str(discord_user.get("id") or "").strip()
    if not discord_id:
        logger.warning("discord_identity_missing", extra=_request_extra(request, profile_payload=discord_user))
        return _redirect_frontend(error="discord_identity_failed")

    discord_username = discord_user.get("global_name") or discord_user.get("username") or f"discord_{discord_id}"
    avatar_hash = discord_user.get("avatar")
    avatar_url = f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png?size=128" if avatar_hash else None
    email = (discord_user.get("email") or "").strip().lower()
    verified = bool(discord_user.get("verified"))
    real_email = email if verified and email else None

    user = db.query(User).filter(User.discord_id == discord_id).first()
    if not user and real_email:
        user = db.query(User).filter(User.email == real_email).first()

    if user is None:
        try:
            user = _create_discord_user(
                db,
                discord_id=discord_id,
                discord_username=discord_user.get("username") or discord_username,
                avatar_url=avatar_url,
                real_email=real_email,
            )
            logger.info("auth_user_created", extra=_request_extra(request, auth_provider="discord", user_id=user.id))
        except (IntegrityError, RuntimeError):
            logger.exception("discord_account_conflict_create", extra=_request_extra(request, discord_id=discord_id))
            return _redirect_frontend(error="discord_account_conflict")
    else:
        user.discord_id = discord_id
        user.discord_username = discord_user.get("username") or discord_username
        user.discord_avatar = avatar_url
        if not user.display_name:
            user.display_name = discord_username
        if user.auth_provider != "local":
            user.auth_provider = "discord"
        try:
            db.commit()
            db.refresh(user)
            logger.info(
                "auth_user_updated", extra=_request_extra(request, auth_provider=user.auth_provider, user_id=user.id)
            )
        except IntegrityError:
            db.rollback()
            logger.exception("discord_account_conflict_update", extra=_request_extra(request, discord_id=discord_id))
            return _redirect_frontend(error="discord_account_conflict")

    if not user.is_active:
        logger.warning("discord_user_inactive", extra=_request_extra(request, user_id=user.id))
        return _redirect_frontend(error="account_disabled")
    token = create_user_access_token(user)
    logger.info("auth_session_created", extra=_request_extra(request, user_id=user.id, auth_provider="discord"))
    return _redirect_frontend(session_token=token)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    if not _email_enabled():
        raise HTTPException(status_code=503, detail="Password reset email is not configured")

    normalized_email = req.email.strip().lower()
    generic_message = "If that email exists, a reset link has been sent."

    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not user.is_active:
        return MessageResponse(message=generic_message)

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = _utcnow() + datetime.timedelta(minutes=PASSWORD_RESET_EXPIRY_MINUTES)

    user.password_reset_token_hash = token_hash
    user.password_reset_expires_at = expires_at
    user.password_reset_sent_at = _utcnow()
    db.commit()

    reset_url = _build_reset_url(raw_token)
    subject = "Reset your SWG:L Tools password"
    text_body = (
        f"We received a request to reset your password.\n\n"
        f"Use this link to reset it:\n{reset_url}\n\n"
        f"This link expires in {PASSWORD_RESET_EXPIRY_MINUTES} minutes.\n"
        f"If you did not request this, you can ignore this email."
    )
    html_body = f"""
    <p>We received a request to reset your password.</p>
    <p><a href="{reset_url}">Reset your password</a></p>
    <p>This link expires in {PASSWORD_RESET_EXPIRY_MINUTES} minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
    """

    _send_email(user.email, subject, text_body, html_body)
    return MessageResponse(message=generic_message)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(req.token)
    now = _utcnow()

    user = (
        db.query(User)
        .filter(User.password_reset_token_hash == token_hash)
        .filter(User.password_reset_expires_at.isnot(None))
        .first()
    )

    if not user or not user.password_reset_expires_at or user.password_reset_expires_at < now:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    _validate_password_strength(req.password)
    user.hashed_password = get_password_hash(req.password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.password_reset_sent_at = None
    if user.auth_provider != "local":
        user.auth_provider = "local"

    db.commit()
    return MessageResponse(message="Password reset successful")


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response):
    _clear_session_cookie(response)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserResponse)
def get_me(request: FastAPIRequest, user: User = Depends(require_user)):
    logger.info("auth_me_succeeded", extra=_request_extra(request, user_id=user.id, auth_provider=user.auth_provider))
    return _coalesce_user(user)
