"""Tests for game data API endpoints (read-only, no auth required)."""


class TestChassis:
    def test_list_chassis(self, client):
        res = client.get("/api/gamedata/chassis")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 52  # Known count from tables.db

        # Verify structure
        chassis = data[0]
        assert "name" in chassis
        assert "mass" in chassis
        assert "slots" in chassis
        assert len(chassis["slots"]) == 8
        assert "speed_mod" in chassis
        assert "min_throttle" in chassis
        assert "opt_throttle" in chassis
        assert "max_throttle" in chassis

    def test_get_chassis_detail(self, client):
        res = client.get("/api/gamedata/chassis/A-Wing")
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "A-Wing"
        assert data["mass"] > 0
        assert "throttle_profile" in data
        assert len(data["throttle_profile"]) == 11  # 100% to 0% in 10% steps

    def test_get_chassis_detail_with_spaces(self, client):
        res = client.get("/api/gamedata/chassis/Advanced%20X-Wing")
        assert res.status_code == 200
        assert res.json()["name"] == "Advanced X-Wing"

    def test_get_chassis_not_found(self, client):
        res = client.get("/api/gamedata/chassis/NonExistent")
        assert res.status_code == 200
        assert "error" in res.json()


class TestComponentTypes:
    def test_list_component_types(self, client):
        res = client.get("/api/gamedata/component-types")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 13  # Known count

        comp = data[0]
        assert "type" in comp
        assert "stat_names" in comp
        assert "stat_display_names" in comp


class TestFCPrograms:
    def test_list_fc_programs(self, client):
        res = client.get("/api/gamedata/fc-programs")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 42

        prog = data[0]
        assert "name" in prog
        assert "energy_efficiency" in prog
        assert "gen_efficiency" in prog


class TestOverloadLevels:
    def test_get_overload_levels(self, client):
        res = client.get("/api/gamedata/overload-levels")
        assert res.status_code == 200
        data = res.json()
        for key in ["reactor", "engine", "capacitor", "weapon"]:
            assert key in data
            assert len(data[key]) == 5  # None + levels 1-4


class TestShieldAdjust:
    def test_get_shield_adjust_options(self, client):
        res = client.get("/api/gamedata/shield-adjust-options")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert data[0]["value"] == "None"
        assert len(data) > 1


class TestComplib:
    def test_list_complib(self, client):
        res = client.get("/api/gamedata/complib")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 296  # Known count

    def test_filter_complib(self, client):
        res = client.get("/api/gamedata/complib?comp_type=armor")
        assert res.status_code == 200
        data = res.json()
        assert all("armor" in item["type"].lower() for item in data if item["type"])


class TestCalculate:
    def test_calculate_basic(self, client):
        res = client.post("/api/gamedata/calculate", json={
            "chassis_name": "A-Wing",
            "components": {},
            "ro_level": "None",
            "eo_level": "None",
            "co_level": "None",
            "wo_level": "None",
        })
        assert res.status_code == 200
        data = res.json()
        assert "overloads" in data
        assert "throttle_profile" in data
        assert "propulsion" in data
        assert "mass" in data
        assert "drain" in data

    def test_calculate_with_overloads(self, client):
        res = client.post("/api/gamedata/calculate", json={
            "chassis_name": "X-Wing",
            "components": {},
            "ro_level": "2",
            "eo_level": "1",
            "co_level": "None",
            "wo_level": "3",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["overloads"]["ro_gen_eff"] != 1
        assert data["overloads"]["eo_gen_eff"] != 1
        assert data["overloads"]["wo_gen_eff"] != 1

    def test_calculate_invalid_chassis(self, client):
        res = client.post("/api/gamedata/calculate", json={
            "chassis_name": "FakeShip",
            "components": {},
        })
        assert res.status_code == 200
        assert "error" in res.json()


class TestLootLookup:
    def test_loot_lookup_by_component(self, client):
        res = client.get("/api/gamedata/loot-lookup?query=armor&search_type=component")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_loot_lookup_by_npc(self, client):
        res = client.get("/api/gamedata/loot-lookup?query=tier&search_type=npc")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_loot_lookup_empty(self, client):
        res = client.get("/api/gamedata/loot-lookup?query=xyznonexistent123&search_type=component")
        assert res.status_code == 200
        assert res.json() == []
