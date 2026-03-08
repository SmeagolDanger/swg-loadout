"""Tests for loadout and component CRUD endpoints (auth required)."""


class TestLoadoutCRUD:
    LOADOUT_PAYLOAD = {
        "name": "My A-Wing Build",
        "chassis": "A-Wing",
        "mass": 66625,
        "reactor": "Test Reactor",
        "engine": "Test Engine",
        "booster": "None",
        "shield": "None",
        "front_armor": "None",
        "rear_armor": "None",
        "capacitor": "None",
        "cargo_hold": "None",
        "droid_interface": "None",
        "slot1": "None",
        "slot2": "None",
        "slot3": "None",
        "slot4": "None",
        "slot5": "None",
        "slot6": "None",
        "slot7": "None",
        "slot8": "None",
        "pack1": "None",
        "pack2": "None",
        "pack3": "None",
        "pack4": "None",
        "pack5": "None",
        "pack6": "None",
        "pack7": "None",
        "pack8": "None",
        "ro_level": "None",
        "eo_level": "None",
        "co_level": "None",
        "wo_level": "None",
        "shield_adjust": "None",
        "is_public": False,
    }

    def test_create_loadout(self, auth_client):
        res = auth_client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "My A-Wing Build"
        assert data["chassis"] == "A-Wing"
        assert data["id"] > 0

    def test_create_loadout_unauthenticated(self, client):
        res = client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        assert res.status_code == 401

    def test_create_duplicate_name(self, auth_client):
        auth_client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        res = auth_client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        assert res.status_code == 400
        assert "already exists" in res.json()["detail"].lower()

    def test_list_loadouts(self, auth_client):
        auth_client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        res = auth_client.get("/api/loadouts")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["name"] == "My A-Wing Build"

    def test_list_loadouts_unauthenticated(self, client):
        res = client.get("/api/loadouts")
        assert res.status_code == 401

    def test_get_loadout_by_id(self, auth_client):
        create_res = auth_client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        loadout_id = create_res.json()["id"]

        res = auth_client.get(f"/api/loadouts/{loadout_id}")
        assert res.status_code == 200
        assert res.json()["name"] == "My A-Wing Build"

    def test_update_loadout(self, auth_client):
        create_res = auth_client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        loadout_id = create_res.json()["id"]

        updated = {**self.LOADOUT_PAYLOAD, "name": "Updated Build", "reactor": "Big Reactor"}
        res = auth_client.put(f"/api/loadouts/{loadout_id}", json=updated)
        assert res.status_code == 200
        assert res.json()["name"] == "Updated Build"
        assert res.json()["reactor"] == "Big Reactor"

    def test_delete_loadout(self, auth_client):
        create_res = auth_client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        loadout_id = create_res.json()["id"]

        res = auth_client.delete(f"/api/loadouts/{loadout_id}")
        assert res.status_code == 200

        list_res = auth_client.get("/api/loadouts")
        assert len(list_res.json()) == 0

    def test_delete_nonexistent(self, auth_client):
        res = auth_client.delete("/api/loadouts/99999")
        assert res.status_code == 404

    def test_duplicate_loadout(self, auth_client):
        create_res = auth_client.post("/api/loadouts", json=self.LOADOUT_PAYLOAD)
        loadout_id = create_res.json()["id"]

        res = auth_client.post(f"/api/loadouts/{loadout_id}/duplicate?new_name=Cloned%20Build")
        assert res.status_code == 200
        assert res.json()["name"] == "Cloned Build"
        assert res.json()["chassis"] == "A-Wing"

        list_res = auth_client.get("/api/loadouts")
        assert len(list_res.json()) == 2


class TestPublicLoadouts:
    def test_public_loadouts_empty(self, client):
        res = client.get("/api/loadouts/public")
        assert res.status_code == 200
        assert res.json() == []

    def test_public_loadout_visible(self, auth_client, client):
        payload = {**TestLoadoutCRUD.LOADOUT_PAYLOAD, "is_public": True}
        auth_client.post("/api/loadouts", json=payload)

        res = client.get("/api/loadouts/public")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["name"] == "My A-Wing Build"
        assert data[0]["owner_name"] == "Test Pilot"

    def test_private_loadout_not_visible(self, auth_client, client):
        auth_client.post("/api/loadouts", json=TestLoadoutCRUD.LOADOUT_PAYLOAD)

        res = client.get("/api/loadouts/public")
        assert res.status_code == 200
        assert len(res.json()) == 0

    def test_public_loadout_with_null_is_starter_still_visible(self, auth_client, client):
        create_res = auth_client.post("/api/loadouts", json={**TestLoadoutCRUD.LOADOUT_PAYLOAD, "is_public": True})
        assert create_res.status_code == 200

        from database import SessionLocal, Loadout

        loadout_id = create_res.json()["id"]
        db = SessionLocal()
        loadout = db.query(Loadout).filter(Loadout.id == loadout_id).first()
        loadout.is_starter = None
        db.commit()
        db.close()

        res = client.get("/api/loadouts/public")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["name"] == "My A-Wing Build"


class TestComponentCRUD:
    COMP_PAYLOAD = {
        "comp_type": "reactor",
        "name": "Mark V Reactor, Elite",
        "stat1": 850.0,
        "stat2": 15000.0,
        "stat3": 0,
        "stat4": 0,
        "stat5": 0,
        "stat6": 0,
        "stat7": 0,
        "stat8": 0,
    }

    def test_create_component(self, auth_client):
        res = auth_client.post("/api/components", json=self.COMP_PAYLOAD)
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "Mark V Reactor, Elite"
        assert data["comp_type"] == "reactor"
        assert data["stat1"] == 850.0
        assert data["stat2"] == 15000.0

    def test_create_component_unauthenticated(self, client):
        res = client.post("/api/components", json=self.COMP_PAYLOAD)
        assert res.status_code == 401

    def test_create_duplicate_component(self, auth_client):
        auth_client.post("/api/components", json=self.COMP_PAYLOAD)
        res = auth_client.post("/api/components", json=self.COMP_PAYLOAD)
        assert res.status_code == 400

    def test_list_components(self, auth_client):
        auth_client.post("/api/components", json=self.COMP_PAYLOAD)
        auth_client.post("/api/components", json={**self.COMP_PAYLOAD, "comp_type": "engine", "name": "Fast Engine"})

        res = auth_client.get("/api/components")
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_filter_components_by_type(self, auth_client):
        auth_client.post("/api/components", json=self.COMP_PAYLOAD)
        auth_client.post("/api/components", json={**self.COMP_PAYLOAD, "comp_type": "engine", "name": "Fast Engine"})

        res = auth_client.get("/api/components?comp_type=reactor")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["comp_type"] == "reactor"

    def test_update_component(self, auth_client):
        create_res = auth_client.post("/api/components", json=self.COMP_PAYLOAD)
        comp_id = create_res.json()["id"]

        updated = {**self.COMP_PAYLOAD, "stat2": 16000.0}
        res = auth_client.put(f"/api/components/{comp_id}", json=updated)
        assert res.status_code == 200
        assert res.json()["stat2"] == 16000.0

    def test_delete_component(self, auth_client):
        create_res = auth_client.post("/api/components", json=self.COMP_PAYLOAD)
        comp_id = create_res.json()["id"]

        res = auth_client.delete(f"/api/components/{comp_id}")
        assert res.status_code == 200

        list_res = auth_client.get("/api/components")
        assert len(list_res.json()) == 0

    def test_delete_nonexistent_component(self, auth_client):
        res = auth_client.delete("/api/components/99999")
        assert res.status_code == 404


class TestStarterLoadouts:
    def test_starter_loadouts_are_separate_from_public(self, auth_client, client):
        starter_payload = {
            **TestLoadoutCRUD.LOADOUT_PAYLOAD,
            "name": "Starter Nova",
            "is_public": True,
            "is_starter": True,
            "starter_description": "Good entry build",
            "starter_tags": "Beginner, PvE",
        }

        # Promote test user to admin directly in the test database
        from database import SessionLocal, User

        me = auth_client.get("/api/auth/me")
        user_id = me.json()["id"]
        db = SessionLocal()
        user = db.query(User).filter(User.id == user_id).first()
        user.role = "admin"
        user.is_admin = True
        db.commit()
        db.close()

        create_res = auth_client.post("/api/loadouts", json=starter_payload)
        assert create_res.status_code == 200
        assert create_res.json()["is_starter"] is True

        public_res = client.get("/api/loadouts/public")
        assert public_res.status_code == 200
        assert public_res.json() == []

        starter_res = client.get("/api/loadouts/starters")
        assert starter_res.status_code == 200
        data = starter_res.json()
        assert len(data) == 1
        assert data[0]["name"] == "Starter Nova"
        assert data[0]["starter_description"] == "Good entry build"

    def test_non_admin_cannot_create_starter_build(self, auth_client):
        starter_payload = {
            **TestLoadoutCRUD.LOADOUT_PAYLOAD,
            "name": "Starter Attempt",
            "is_starter": True,
        }
        res = auth_client.post("/api/loadouts", json=starter_payload)
        assert res.status_code == 403
