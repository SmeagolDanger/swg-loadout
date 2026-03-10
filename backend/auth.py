import datetime
import hashlib
import logging
import os
from typing import Any

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import User, get_db

logger = logging.getLogger(__name__)

_ENV = os.getenv("ENV", "development").lower()
_secret = os.getenv("SECRET_KEY", "")
if not _secret and _ENV in ("production", "prod"):
    raise RuntimeError("SECRET_KEY environment variable must be set in production")
SECRET_KEY = _secret or "slt-dev-only-secret-do-not-use-in-prod"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days



SESSION_COOKIE_NAME = "slt_session"


def token_password_fingerprint(hashed_password: str) -> str:
    return hashlib.sha256(hashed_password.encode("utf-8")).hexdigest()[:16]


def create_user_access_token(user: User, expires_delta: datetime.timedelta | None = None) -> str:
    return create_access_token(
        data={
            "sub": user.username,
            "pwh": token_password_fingerprint(user.hashed_password),
        },
        expires_delta=expires_delta,
    )


def get_token_from_request(request: Request) -> str | None:
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            return token
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME, "").strip()
    return cookie_token or None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict[str, Any], expires_delta: datetime.timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.UTC) + (
        expires_delta or datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = get_token_from_request(request)
    if token is None:
        logger.info("auth_token_missing")
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        password_fingerprint: str | None = payload.get("pwh")
        if username is None:
            logger.warning("auth_token_missing_subject")
            return None
    except JWTError:
        logger.warning("auth_token_invalid")
        return None
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        logger.warning("auth_user_lookup_failed", extra={"username": username})
        return None
    if not user.is_active:
        logger.warning("auth_user_inactive", extra={"username": username, "user_id": user.id})
        return None
    if password_fingerprint != token_password_fingerprint(user.hashed_password):
        logger.warning("auth_token_password_fingerprint_mismatch", extra={"username": username, "user_id": user.id})
        return None
    return user


async def require_user(user: User = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def has_role(user: User, *roles: str) -> bool:
    """Check if user has any of the given roles. 'admin' always passes."""
    if not user:
        return False
    user_role = getattr(user, "role", None) or ("admin" if user.is_admin else "user")
    return user_role == "admin" or user_role in roles


def require_role(*roles: str):
    """FastAPI dependency: require the user to have one of the specified roles."""

    async def _check(user: User = Depends(require_user)) -> User:
        if not has_role(user, *roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return _check
