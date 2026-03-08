import json
import os
import secrets
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request as FastAPIRequest
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import create_access_token, get_password_hash, require_user, verify_password
from database import User, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_ME_URL = "https://discord.com/api/users/@me"


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    display_name: str = ""


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


def _build_frontend_redirect(token: str | None = None, error: str | None = None) -> str:
    qs = {}
    if token:
        qs["token"] = token
    if error:
        qs["error"] = error
    suffix = f"?{urlencode(qs)}" if qs else ""
    return f"{_get_public_base_url()}/auth/discord/callback{suffix}"


def _load_json(req: Request) -> dict:
    with urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


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
    req = Request(DISCORD_TOKEN_URL, data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
    return _load_json(req)


def _get_discord_me(access_token: str) -> dict:
    req = Request(DISCORD_ME_URL, headers={"Authorization": f"Bearer {access_token}"})
    return _load_json(req)


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
        email=req.email,
        hashed_password=get_password_hash(req.password),
        display_name=req.display_name or req.username,
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=token, token_type="bearer", user=_coalesce_user(user))


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=token, token_type="bearer", user=_coalesce_user(user))


@router.get("/discord/login")
def discord_login(request: FastAPIRequest):
    if not _discord_enabled(request):
        raise HTTPException(status_code=503, detail="Discord login is not configured")

    redirect_uri = _get_discord_redirect_uri(request)
    url = f"{DISCORD_AUTHORIZE_URL}?{urlencode({'client_id': os.getenv('DISCORD_CLIENT_ID', '').strip(), 'response_type': 'code', 'redirect_uri': redirect_uri, 'scope': 'identify email'})}"
    return RedirectResponse(url)


@router.get("/discord/callback", name="discord_callback")
def discord_callback(
    request: FastAPIRequest, code: str | None = None, error: str | None = None, db: Session = Depends(get_db)
):
    if error:
        return RedirectResponse(_build_frontend_redirect(error=error))
    if not code:
        return RedirectResponse(_build_frontend_redirect(error="missing_code"))
    if not _discord_enabled(request):
        return RedirectResponse(_build_frontend_redirect(error="discord_not_configured"))

    redirect_uri = _get_discord_redirect_uri(request)
    try:
        token_data = _exchange_discord_code(code, redirect_uri)
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(_build_frontend_redirect(error="token_exchange_failed"))
        discord_user = _get_discord_me(access_token)
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError):
        return RedirectResponse(_build_frontend_redirect(error="discord_request_failed"))

    discord_id = str(discord_user.get("id") or "").strip()
    if not discord_id:
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
            return RedirectResponse(_build_frontend_redirect(error="discord_account_conflict"))

    token = create_access_token(data={"sub": user.username})
    return RedirectResponse(_build_frontend_redirect(token=token))


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(require_user)):
    return _coalesce_user(user)
