import hashlib
import json
import logging
import os
import secrets
from datetime import UTC, datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request as FastAPIRequest
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import create_access_token, get_password_hash, require_user, verify_password
from database import User, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_ME_URL = "https://discord.com/api/users/@me"
DISCORD_HTTP_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "SWGL-Tools/1.0 (+https://jawatracks.com)",
}
POSTMARK_SEND_URL = "https://api.postmarkapp.com/email"
RESET_TOKEN_TTL_MINUTES = 60


class DiscordOAuthError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: str = ""


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class MessageResponse(BaseModel):
    detail: str


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
    return bool(os.getenv("POSTMARK_SERVER_TOKEN", "").strip() and os.getenv("POSTMARK_FROM_EMAIL", "").strip())


def _build_frontend_redirect(token: str | None = None, error: str | None = None) -> str:
    qs = {}
    if token:
        qs["token"] = token
    if error:
        qs["error"] = error
    suffix = f"?{urlencode(qs)}" if qs else ""
    return f"{_get_public_base_url()}/auth/discord/callback{suffix}"


def _load_json(req: Request, *, error_code: str, context: str) -> dict:
    try:
        with urlopen(req, timeout=15) as response:
            payload = response.read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning("Discord OAuth HTTP error during %s: status=%s body=%s", context, exc.code, body)
        if context == "token exchange" and "rate limited" in body.lower():
            raise DiscordOAuthError("discord_rate_limited") from exc
        raise DiscordOAuthError(error_code) from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.exception("Discord OAuth network error during %s", context)
        raise DiscordOAuthError(error_code) from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        logger.warning("Discord OAuth JSON parse error during %s: payload=%s", context, payload[:500])
        raise DiscordOAuthError(error_code) from exc


def _exchange_discord_code(code: str, redirect_uri: str) -> dict:
    payload = urlencode(
        {
            "client_id": os.getenv("DISCORD_CLIENT_ID", "").strip(),
            "client_secret": os.getenv("DISCORD_CLIENT_SECRET", "").strip(),
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }
    ).encode("utf-8")
    req = Request(
        DISCORD_TOKEN_URL,
        data=payload,
        headers={
            **DISCORD_HTTP_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    return _load_json(req, error_code="discord_token_exchange_failed", context="token exchange")


def _get_discord_me(access_token: str) -> dict:
    req = Request(
        DISCORD_ME_URL,
        headers={
            **DISCORD_HTTP_HEADERS,
            "Authorization": f"Bearer {access_token}",
        },
    )
    return _load_json(req, error_code="discord_profile_fetch_failed", context="profile fetch")


def _coalesce_user(user: User) -> UserResponse:
    return UserResponse.model_validate(user)


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


def _create_discord_user(
    db: Session, discord_id: str, discord_username: str, avatar_url: str | None, real_email: str | None
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


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generate_reset_link(token: str) -> str:
    return f"{_get_public_base_url()}/auth/reset-password?token={token}"


def _send_postmark_email(*, to_email: str, subject: str, text_body: str, html_body: str) -> None:
    payload = json.dumps(
        {
            "From": os.getenv("POSTMARK_FROM_EMAIL", "").strip(),
            "To": to_email,
            "Subject": subject,
            "TextBody": text_body,
            "HtmlBody": html_body,
            "MessageStream": os.getenv("POSTMARK_MESSAGE_STREAM", "outbound").strip() or "outbound",
        }
    ).encode("utf-8")
    req = Request(
        POSTMARK_SEND_URL,
        data=payload,
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
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning("Postmark send failed: status=%s body=%s", exc.code, body)
        raise HTTPException(status_code=502, detail="Failed to send password reset email") from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.exception("Postmark request failed")
        raise HTTPException(status_code=502, detail="Failed to send password reset email") from exc

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        parsed = {}
    if parsed.get("ErrorCode", 0) != 0:
        logger.warning("Postmark returned error payload=%s", parsed)
        raise HTTPException(status_code=502, detail="Failed to send password reset email")


def _build_reset_email(username: str, reset_link: str) -> tuple[str, str]:
    text_body = (
        f"Hello {username},\n\n"
        f"Use this link to reset your Jawatracks password:\n{reset_link}\n\n"
        f"This link expires in {RESET_TOKEN_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.\n"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #d9e6f2; background: #0c1320; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background: #121b2c; border: 1px solid #22314f; border-radius: 14px; padding: 24px;">
          <h1 style="margin-top: 0; color: #88d7ff; font-size: 24px;">Reset your Jawatracks password</h1>
          <p>Hello {username},</p>
          <p>We received a request to reset your password. Use the button below to choose a new one.</p>
          <p style="margin: 28px 0;">
            <a href="{reset_link}" style="background: #21b4ff; color: #05121f; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: bold;">Reset password</a>
          </p>
          <p style="font-size: 14px; color: #b7c7d9;">This link expires in {RESET_TOKEN_TTL_MINUTES} minutes.</p>
          <p style="font-size: 14px; color: #b7c7d9;">If you did not request this, you can safely ignore this email.</p>
          <p style="font-size: 13px; color: #8ea4bc; word-break: break-all;">{reset_link}</p>
        </div>
      </body>
    </html>
    """
    return text_body, html_body


@router.get("/providers", response_model=AuthProvidersResponse)
def providers(request: FastAPIRequest):
    return AuthProvidersResponse(discord=_discord_enabled(request))


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=req.username,
        email=req.email.lower(),
        hashed_password=get_password_hash(req.password),
        display_name=req.display_name or req.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=token, token_type="bearer", user=_coalesce_user(user))


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not user.hashed_password or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=token, token_type="bearer", user=_coalesce_user(user))


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    if not _postmark_enabled():
        raise HTTPException(status_code=503, detail="Password reset email is not configured")

    normalized_email = req.email.lower()
    generic = MessageResponse(detail="If that account exists, a password reset email has been sent.")
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not user.is_active:
        return generic

    raw_token = secrets.token_urlsafe(32)
    user.password_reset_token_hash = _hash_reset_token(raw_token)
    user.password_reset_sent_at = datetime.now(UTC).replace(tzinfo=None)
    user.password_reset_expires_at = (datetime.now(UTC) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)).replace(tzinfo=None)
    db.commit()

    reset_link = _generate_reset_link(raw_token)
    text_body, html_body = _build_reset_email(user.display_name or user.username, reset_link)
    _send_postmark_email(
        to_email=user.email,
        subject="Reset your Jawatracks password",
        text_body=text_body,
        html_body=html_body,
    )
    return generic


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = _hash_reset_token(req.token)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()
    now = datetime.now(UTC).replace(tzinfo=None)
    if (
        not user
        or not user.password_reset_expires_at
        or user.password_reset_expires_at < now
    ):
        raise HTTPException(status_code=400, detail="Password reset link is invalid or expired")

    user.hashed_password = get_password_hash(req.password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.password_reset_sent_at = None
    if user.auth_provider == "discord":
        user.auth_provider = "local"
    db.commit()
    return MessageResponse(detail="Password updated successfully")


@router.get("/discord/login")
def discord_login(request: FastAPIRequest):
    if not _discord_enabled(request):
        raise HTTPException(status_code=503, detail="Discord OAuth is not configured")

    redirect_uri = _get_discord_redirect_uri(request)
    state = secrets.token_urlsafe(24)
    auth_url = (
        f"{DISCORD_AUTHORIZE_URL}?"
        f"{urlencode({'client_id': os.getenv('DISCORD_CLIENT_ID', '').strip(), 'response_type': 'code', 'redirect_uri': redirect_uri, 'scope': 'identify email', 'prompt': 'consent', 'state': state})}"
    )
    response = RedirectResponse(auth_url)
    response.set_cookie(
        "discord_oauth_state",
        state,
        max_age=600,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return response


@router.get("/discord/callback", name="discord_callback")
def discord_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    request: FastAPIRequest | None = None,
    db: Session = Depends(get_db),
):
    if error:
        return RedirectResponse(_build_frontend_redirect(error=error))
    if not code:
        return RedirectResponse(_build_frontend_redirect(error="missing_code"))
    if not _discord_enabled(request):
        return RedirectResponse(_build_frontend_redirect(error="discord_not_configured"))

    state_cookie = request.cookies.get("discord_oauth_state") if request else None
    if not state or not state_cookie or not secrets.compare_digest(state, state_cookie):
        return RedirectResponse(_build_frontend_redirect(error="invalid_state"))

    redirect_uri = _get_discord_redirect_uri(request)
    try:
        token_data = _exchange_discord_code(code, redirect_uri)
        access_token = token_data.get("access_token")
        if not access_token:
            logger.warning("Discord token exchange returned no access_token: payload=%s", token_data)
            return RedirectResponse(_build_frontend_redirect(error="discord_token_exchange_failed"))
        discord_user = _get_discord_me(access_token)
    except DiscordOAuthError as exc:
        return RedirectResponse(_build_frontend_redirect(error=exc.code))

    discord_id = str(discord_user.get("id") or "").strip()
    if not discord_id:
        logger.warning("Discord profile response missing id: payload=%s", discord_user)
        return RedirectResponse(_build_frontend_redirect(error="discord_identity_failed"))

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
        except (IntegrityError, RuntimeError):
            logger.exception("Discord account conflict while creating/linking user")
            return RedirectResponse(_build_frontend_redirect(error="discord_account_conflict"))
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
        except IntegrityError:
            db.rollback()
            logger.exception("Discord account conflict while updating existing user")
            return RedirectResponse(_build_frontend_redirect(error="discord_account_conflict"))

    token = create_access_token(data={"sub": user.username})
    response = RedirectResponse(_build_frontend_redirect(token=token))
    response.delete_cookie("discord_oauth_state", path="/")
    return response


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(require_user)):
    return _coalesce_user(user)
