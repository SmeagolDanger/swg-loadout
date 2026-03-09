"""Tests for health check and authentication endpoints."""

from unittest.mock import patch


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
        client.post(
            "/api/auth/register", json={"username": "logintest", "email": "login@swg.com", "password": "testpass123"}
        )
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


class TestDiscordAuth:
    def test_providers_disabled_by_default(self, client):
        res = client.get("/api/auth/providers")
        assert res.status_code == 200
        assert res.json() == {"discord": False}

    def test_discord_login_requires_configuration(self, client):
        res = client.get("/api/auth/discord/login")
        assert res.status_code == 503

    def test_discord_callback_creates_user(self, client, monkeypatch):
        monkeypatch.setenv("DISCORD_CLIENT_ID", "cid")
        monkeypatch.setenv("DISCORD_CLIENT_SECRET", "secret")
        monkeypatch.setenv("DISCORD_REDIRECT_URI", "http://testserver/api/auth/discord/callback")
        monkeypatch.setenv("PUBLIC_BASE_URL", "http://frontend.test")

        with (
            patch("routers.auth_router._exchange_discord_code", return_value={"access_token": "discord-token"}),
            patch(
                "routers.auth_router._get_discord_me",
                return_value={
                    "id": "12345",
                    "username": "DiscordPilot",
                    "global_name": "Discord Pilot",
                    "email": "discord@swg.com",
                    "verified": True,
                    "avatar": "avatarhash",
                },
            ),
        ):
            res = client.get("/api/auth/discord/callback?code=testcode", follow_redirects=False)

        assert res.status_code in (302, 307)
        location = res.headers["location"]
        assert location.startswith("http://frontend.test/auth/discord/callback?token=")

        providers = client.get("/api/auth/providers")
        assert providers.json() == {"discord": True}

    def test_discord_callback_duplicate_username_generates_unique_user(self, client, monkeypatch):
        client.post(
            "/api/auth/register",
            json={
                "username": "discordpilot",
                "email": "local-only@swg.com",
                "password": "password123",
                "display_name": "Local Discord Pilot",
            },
        )
        monkeypatch.setenv("DISCORD_CLIENT_ID", "cid")
        monkeypatch.setenv("DISCORD_CLIENT_SECRET", "secret")
        monkeypatch.setenv("DISCORD_REDIRECT_URI", "http://testserver/api/auth/discord/callback")
        monkeypatch.setenv("PUBLIC_BASE_URL", "http://frontend.test")

        with (
            patch("routers.auth_router._exchange_discord_code", return_value={"access_token": "discord-token"}),
            patch(
                "routers.auth_router._get_discord_me",
                return_value={
                    "id": "77777",
                    "username": "discordpilot",
                    "global_name": "Discord Pilot",
                    "verified": False,
                    "avatar": None,
                },
            ),
        ):
            res = client.get("/api/auth/discord/callback?code=testcode", follow_redirects=False)

        assert res.status_code in (302, 307)
        assert "token=" in res.headers["location"]

    def test_discord_callback_links_existing_email(self, client, monkeypatch):
        client.post(
            "/api/auth/register",
            json={
                "username": "localpilot",
                "email": "shared@swg.com",
                "password": "password123",
                "display_name": "Local Pilot",
            },
        )
        monkeypatch.setenv("DISCORD_CLIENT_ID", "cid")
        monkeypatch.setenv("DISCORD_CLIENT_SECRET", "secret")
        monkeypatch.setenv("DISCORD_REDIRECT_URI", "http://testserver/api/auth/discord/callback")
        monkeypatch.setenv("PUBLIC_BASE_URL", "http://frontend.test")

        with (
            patch("routers.auth_router._exchange_discord_code", return_value={"access_token": "discord-token"}),
            patch(
                "routers.auth_router._get_discord_me",
                return_value={
                    "id": "99999",
                    "username": "DiscordPilot",
                    "global_name": "Discord Pilot",
                    "email": "shared@swg.com",
                    "verified": True,
                    "avatar": None,
                },
            ),
        ):
            client.get("/api/auth/discord/callback?code=testcode", follow_redirects=False)

        res = client.post("/api/auth/login", data={"username": "localpilot", "password": "password123"})
        assert res.status_code == 200
        assert res.json()["user"]["auth_provider"] == "local"


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


class TestForgotPassword:
    def test_forgot_password_requires_postmark_config(self, client):
        res = client.post('/api/auth/forgot-password', json={'email': 'nobody@swg.com'})
        assert res.status_code == 503

    def test_forgot_password_sends_email_and_stores_token(self, client, monkeypatch):
        client.post(
            '/api/auth/register',
            json={'username': 'resetpilot', 'email': 'reset@swg.com', 'password': 'secret123', 'display_name': 'Reset Pilot'},
        )
        monkeypatch.setenv('POSTMARK_SERVER_TOKEN', 'pm-token')
        monkeypatch.setenv('POSTMARK_FROM_EMAIL', 'noreply@jawatracks.com')
        monkeypatch.setenv('PUBLIC_BASE_URL', 'http://frontend.test')

        with patch('routers.auth_router._send_postmark_email') as mocked_send:
            res = client.post('/api/auth/forgot-password', json={'email': 'reset@swg.com'})

        assert res.status_code == 200
        assert mocked_send.called

    def test_reset_password_updates_password(self, client, monkeypatch):
        client.post(
            '/api/auth/register',
            json={'username': 'resetpilot2', 'email': 'reset2@swg.com', 'password': 'secret123', 'display_name': 'Reset Pilot 2'},
        )
        monkeypatch.setenv('POSTMARK_SERVER_TOKEN', 'pm-token')
        monkeypatch.setenv('POSTMARK_FROM_EMAIL', 'noreply@jawatracks.com')

        captured = {}

        def fake_send(*, to_email, subject, text_body, html_body):
            captured['text_body'] = text_body

        with patch('routers.auth_router._send_postmark_email', side_effect=fake_send):
            res = client.post('/api/auth/forgot-password', json={'email': 'reset2@swg.com'})
        assert res.status_code == 200
        link_line = [line for line in captured['text_body'].splitlines() if line.startswith('http')][0]
        token = link_line.rsplit('token=', 1)[1]

        reset = client.post('/api/auth/reset-password', json={'token': token, 'password': 'newsecret456'})
        assert reset.status_code == 200

        login = client.post('/api/auth/login', data={'username': 'resetpilot2', 'password': 'newsecret456'})
        assert login.status_code == 200
