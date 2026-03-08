"""Tests for curated mod endpoints."""

from database import SessionLocal, User


class TestMods:
    def _promote_admin(self):
        db = SessionLocal()
        user = db.query(User).filter(User.username == "testpilot").first()
        user.role = "admin"
        user.is_admin = True
        db.commit()
        db.close()

    def test_create_publish_and_download_mod(self, auth_client, client):
        self._promote_admin()

        create_res = auth_client.post(
            "/api/admin/mods",
            json={
                "title": "Minimal UI Pack",
                "slug": "minimal-ui-pack",
                "author_name": "Seraph",
                "summary": "Slimmer UI textures.",
                "description": "Clean pack for testing.",
                "category": "ui",
                "tags": "ui,pack",
                "version": "1.0",
                "compatibility": "SWG Legends",
                "install_instructions": "Drop files into ui/.",
                "is_published": True,
                "is_featured": True,
            },
        )
        assert create_res.status_code == 200
        mod_id = create_res.json()["id"]

        upload_res = auth_client.post(
            f"/api/admin/mods/{mod_id}/files",
            files=[("files", ("readme.txt", b"hello mod", "text/plain"))],
        )
        assert upload_res.status_code == 200
        assert len(upload_res.json()["files"]) == 1

        list_res = client.get("/api/mods")
        assert list_res.status_code == 200
        assert list_res.json()[0]["title"] == "Minimal UI Pack"

        detail_res = client.get("/api/mods/minimal-ui-pack")
        assert detail_res.status_code == 200
        assert detail_res.json()["files"][0]["original_filename"] == "readme.txt"

        download_res = client.get("/api/mods/minimal-ui-pack/download")
        assert download_res.status_code == 200
        assert download_res.headers["content-type"].startswith("application/zip")
