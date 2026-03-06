"""Test fixtures and configuration."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Override database URL before importing app modules
os.environ.setdefault("DATABASE_URL", "postgresql://slt_test:slt_test_pass@localhost:5432/slt_test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from database import Base, get_db
from main import app


# Test database engine
TEST_DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create tables at start, drop at end."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_tables():
    """Truncate user-data tables between tests (keep game data)."""
    db = TestingSessionLocal()
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()
    db.close()


@pytest.fixture
def client():
    """Test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def auth_client(client):
    """Authenticated test client with a pre-created user."""
    # Register a test user
    res = client.post("/api/auth/register", json={
        "username": "testpilot",
        "email": "testpilot@swg.com",
        "password": "hyperspace123",
        "display_name": "Test Pilot"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]

    # Return a helper that injects the auth header
    class AuthClient:
        def __init__(self, client, token):
            self._client = client
            self._headers = {"Authorization": f"Bearer {token}"}
            self.token = token

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
