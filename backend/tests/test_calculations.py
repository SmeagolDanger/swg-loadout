"""Unit tests for the calculation engine (pure functions)."""

from calculations import (
    calc_mass_summary,
    calc_overload_multipliers,
    calc_propulsion,
    calc_throttle_profile,
    ceil_custom,
    try_float,
)


class TestTryFloat:
    def test_valid_float(self):
        assert try_float("3.14") == 3.14

    def test_valid_int_string(self):
        assert try_float("42") == 42.0

    def test_none(self):
        assert try_float(None) == 0.0

    def test_empty_string(self):
        assert try_float("") == 0.0

    def test_garbage(self):
        assert try_float("abc") == 0.0

    def test_actual_float(self):
        assert try_float(2.71) == 2.71


class TestCeilCustom:
    def test_rounds_up(self):
        assert ceil_custom(2.1) == 3

    def test_rounds_half_up(self):
        assert ceil_custom(2.5) == 3

    def test_integer(self):
        assert ceil_custom(3.0) == 4  # 3.0 + 0.5 = 3.5 → round = 4

    def test_zero(self):
        # round(0.5) == 0 in Python (banker's rounding to even) — matches original desktop app behavior
        assert ceil_custom(0) == 0


class TestThrottleProfile:
    def test_basic_profile(self):
        chassis = {
            "min_throttle": 0.8,
            "opt_throttle": 0.8,
            "max_throttle": 1.6,
        }
        profile = calc_throttle_profile(chassis)
        assert len(profile) == 11

        # At 100% throttle, should be max_throttle
        assert profile[0]["throttle"] == "100%"
        assert profile[0]["pyr_modifier"] > 100  # Max > 1.0

        # At 0% throttle, should be min_throttle
        assert profile[-1]["throttle"] == "0%"
        assert profile[-1]["pyr_modifier"] <= 100

    def test_profile_values_bounded(self):
        chassis = {
            "min_throttle": 0.05,
            "opt_throttle": 0.8,
            "max_throttle": 1.6,
        }
        profile = calc_throttle_profile(chassis)
        for entry in profile:
            assert entry["pyr_modifier"] >= 0
            assert entry["pyr_modifier"] <= 200


class TestMassSummary:
    def test_empty_components(self):
        result = calc_mass_summary({}, 100000)
        assert result["total_mass"] == 0
        assert result["chassis_mass"] == 100000
        assert result["percent"] == 0
        assert result["over_limit"] is False

    def test_under_limit(self):
        components = {
            "reactor": {"mass": 500},
            "engine": {"mass": 300},
        }
        result = calc_mass_summary(components, 1000)
        assert result["total_mass"] == 800
        assert result["remaining"] == 200
        assert result["percent"] == 80.0
        assert result["over_limit"] is False

    def test_over_limit(self):
        components = {
            "reactor": {"mass": 700},
            "engine": {"mass": 500},
        }
        result = calc_mass_summary(components, 1000)
        assert result["total_mass"] == 1200
        assert result["over_limit"] is True

    def test_zero_chassis_mass(self):
        result = calc_mass_summary({"reactor": {"mass": 100}}, 0)
        assert result["total_mass"] == 100
        assert result["percent"] == 0


class TestOverloadMultipliers:
    def test_no_overloads(self):
        result = calc_overload_multipliers(None, None, None, None)
        assert result["ro_gen_eff"] == 1
        assert result["eo_eff"] == 1
        assert result["co_eff"] == 1
        assert result["wo_eff"] == 1

    def test_none_string_overloads(self):
        result = calc_overload_multipliers("None", "None", "None", "None")
        assert result["ro_gen_eff"] == 1

    def test_reactor_overload(self):
        result = calc_overload_multipliers(1, None, None, None)
        # RO level 1 → gen_efficiency = 1.1x from game data
        assert result["ro_gen_eff"] == 1.1
        assert "ro_desc" in result

    def test_all_overloads(self):
        result = calc_overload_multipliers(2, 2, 2, 2)
        assert "ro_desc" in result
        assert "eo_desc" in result
        assert "co_desc" in result
        assert "wo_desc" in result


class TestPropulsion:
    def test_no_engine(self):
        chassis = {
            "speed_mod": 0.95,
            "speed_foils": 0,
            "accel": 25,
            "decel": 30,
            "pitch_accel": 300,
            "yaw_accel": 200,
            "roll_accel": 150,
            "slide": 1.5,
        }
        result = calc_propulsion(chassis, None, None, None)
        assert result["top_speed"] is None
        assert result["accel"] == 25
        assert result["decel"] == 30

    def test_engine_only(self):
        chassis = {
            "speed_mod": 0.95,
            "speed_foils": 0,
            "accel": 25,
            "decel": 30,
            "pitch_accel": 300,
            "yaw_accel": 200,
            "roll_accel": 150,
            "slide": 1.5,
        }
        engine = {"top_speed": 80.0}
        result = calc_propulsion(chassis, engine, None, None)
        assert result["top_speed"] is not None
        assert result["top_speed"] == int(80.0 * 0.95 * 10)  # 760
        assert result["boosted_top_speed"] is None

    def test_engine_and_booster(self):
        chassis = {
            "speed_mod": 1.0,
            "speed_foils": 0,
            "accel": 25,
            "decel": 30,
            "pitch_accel": 300,
            "yaw_accel": 200,
            "roll_accel": 150,
            "slide": 1.5,
        }
        engine = {"top_speed": 80.0}
        booster = {
            "top_speed": 20.0,
            "energy": 500.0,
            "recharge_rate": 10.0,
            "consumption": 15.0,
            "acceleration": 5.0,
        }
        result = calc_propulsion(chassis, engine, booster, None)
        assert result["top_speed"] == 800
        assert result["boosted_top_speed"] == 1000
        assert result["boost_distance"] is not None
        assert result["booster_uptime"] is not None

    def test_foils(self):
        chassis = {
            "speed_mod": 0.95,
            "speed_foils": 0.9025,
            "accel": 25,
            "decel": 30,
            "pitch_accel": 300,
            "yaw_accel": 200,
            "roll_accel": 150,
            "slide": 1.5,
        }
        engine = {"top_speed": 80.0}
        result = calc_propulsion(chassis, engine, None, None)
        assert result["top_speed"] is not None
        assert result["top_speed_foils"] is not None
        assert result["top_speed_foils"] != result["top_speed"]
