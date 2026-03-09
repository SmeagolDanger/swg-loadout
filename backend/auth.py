import datetime
import os

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import User, get_db

_ENV = os.getenv("ENV", "development").lower()
_secret = os.getenv("SECRET_KEY", "")
if not _secret and _ENV in ("production", "prod"):
    raise RuntimeError("SECRET_KEY environment variable must be set in production")
SECRET_KEY = _secret or "slt-dev-only-secret-do-not-use-in-prod"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: datetime.timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.UTC) + (
        expires_delta or datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User | None:
    if token is None:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    user = db.query(User).filter(User.username == username).first()
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
