"""Tests for health check and authentication endpoints."""


class TestHealth:
    def test_health_endpoint(self, client):
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestAuthRegister:
    def test_register_success(self, client):
        res = client.post(
            "/api/auth/register",
            json={
                "username": "newpilot",
                "email": "newpilot@swg.com",
                "password": "mynewpassword",
                "display_name": "New Pilot",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["user"]["username"] == "newpilot"
        assert data["user"]["email"] == "newpilot@swg.com"
        assert data["user"]["display_name"] == "New Pilot"

    def test_register_duplicate_username(self, client):
        payload = {"username": "dupeuser", "email": "dupe1@swg.com", "password": "password123"}
        res1 = client.post("/api/auth/register", json=payload)
        assert res1.status_code == 200

        payload["email"] = "dupe2@swg.com"
        res2 = client.post("/api/auth/register", json=payload)
        assert res2.status_code == 400
        assert "username" in res2.json()["detail"].lower()

    def test_register_duplicate_email(self, client):
        payload = {"username": "user1", "email": "same@swg.com", "password": "password123"}
        client.post("/api/auth/register", json=payload)

        payload["username"] = "user2"
        res = client.post("/api/auth/register", json=payload)
        assert res.status_code == 400
        assert "email" in res.json()["detail"].lower()


class TestAuthLogin:
    def test_login_success(self, client):
        # Register first
        client.post(
            "/api/auth/register", json={"username": "logintest", "email": "login@swg.com", "password": "testpass123"}
        )

        # Login
        res = client.post("/api/auth/login", data={"username": "logintest", "password": "testpass123"})
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_login_wrong_password(self, client):
        client.post(
            "/api/auth/register", json={"username": "wrongpass", "email": "wrong@swg.com", "password": "correctpass"}
        )

        res = client.post("/api/auth/login", data={"username": "wrongpass", "password": "incorrectpass"})
        assert res.status_code == 401

    def test_login_nonexistent_user(self, client):
        res = client.post("/api/auth/login", data={"username": "ghost", "password": "doesntmatter"})
        assert res.status_code == 401


class TestAuthMe:
    def test_get_me_authenticated(self, auth_client):
        res = auth_client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.json()["username"] == "testpilot"

    def test_get_me_unauthenticated(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_get_me_invalid_token(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert res.status_code == 401
