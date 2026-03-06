"""Test fixtures and configuration."""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Override database URL before importing app modules
os.environ.setdefault("DATABASE_URL", "postgresql://slt_test:slt_test_pass@localhost:5432/slt_test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from database import Base, get_db  # noqa: E402
from main import app  # noqa: E402

# Test database engine (lazy — created but not connected until first use)
TEST_DATABASE_URL = os.environ["DATABASE_URL"]
test_engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

# Track whether DB tables have been created this session
_tables_created = False


def _ensure_tables():
    """Create tables on first use (not at import time)."""
    global _tables_created  # noqa: PLW0603
    if not _tables_created:
        Base.metadata.create_all(bind=test_engine)
        _tables_created = True


def _clean_user_tables():
    """Truncate user-data tables between tests."""
    _ensure_tables()
    db = TestingSessionLocal()
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()
    db.close()


@pytest.fixture
def client():
    """Test client for the FastAPI app. Creates DB tables on first use."""
    _clean_user_tables()
    return TestClient(app)


@pytest.fixture
def auth_client(client):
    """Authenticated test client with a pre-created user."""
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testpilot",
            "email": "testpilot@swg.com",
            "password": "hyperspace123",
            "display_name": "Test Pilot",
        },
    )
    assert res.status_code == 200
    token = res.json()["access_token"]

    class AuthClient:
        def __init__(self, inner_client, auth_token):
            self._client = inner_client
            self._headers = {"Authorization": f"Bearer {auth_token}"}
            self.token = auth_token

        def get(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers)
            return self._client.get(url, **kwargs)

        def post(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers)
            return self._client.post(url, **kwargs)

        def put(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers)
            return self._client.put(url, **kwargs)

        def delete(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers)
            return self._client.delete(url, **kwargs)

    return AuthClient(client, token)
