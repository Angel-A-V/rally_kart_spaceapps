"""Tests for server/custom_point.py and server/app.py (typed-in coordinates, issue #17).

Offline: Horizons is replaced by the cached rows of a curated site, so no network is needed.
Run (from app/python):  python3 -m unittest tests.test_custom_point -v
"""
import json
import os
import sys
import tempfile
import unittest

PYDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/python
sys.path.insert(0, PYDIR)
sys.path.insert(0, os.path.join(PYDIR, "scripts"))

from analysis.visibility import load_horizons  # noqa: E402
from export_site_json import MONTH, ROOT, YEAR, _horizons_name, build_site_payload  # noqa: E402
from server import custom_point as cp  # noqa: E402
from sites import SITES  # noqa: E402

SITE = "shackleton_rim"


def fake_fetch(calls):
    """Stands in for fetch_rows: returns the cached rows of SITE for the matching time span."""
    def fetch(lat, lon, height_m, start, stop, step):
        calls.append((lat, lon, height_m, start, stop, step))
        cfg = MONTH if step == "1 h" else YEAR
        rows = load_horizons(os.path.join(ROOT, "data", _horizons_name(SITE, cfg)))
        return rows, {"sun": "https://example/sun", "earth": "https://example/earth"}
    return fetch


def flat(lat, lon):
    return [0.0] * 360, 0.0, None


class Normalise(unittest.TestCase):
    def test_rounds_and_wraps_longitude(self):
        self.assertEqual(cp.normalise("-89.78149", "-156.257"), (-89.781, 203.743))
        self.assertEqual(cp.normalise(10, 360), (10.0, 0.0))
        self.assertEqual(cp.normalise(10, 359.9996), (10.0, 0.0))

    def test_rejects_bad_input(self):
        for lat, lon in [("abc", 0), (None, 0), (91, 0), (-90.5, 0), ("nan", 0), (0, "inf")]:
            with self.assertRaises(cp.BadInput, msg=(lat, lon)):
                cp.normalise(lat, lon)

    def test_point_id_is_html_and_file_safe(self):
        self.assertEqual(cp.point_id(-89.781, 203.743), "custom_s89_781_e203_743")
        self.assertEqual(cp.point_id(0.674, 23.473), "custom_n0_674_e23_473")


class TerrainPlan(unittest.TestCase):
    def test_finest_map_that_covers_the_point(self):
        self.assertEqual(cp.terrain_plan(-89.781, True, True), "85S_20M")   # 6.6 km from the pole
        self.assertEqual(cp.terrain_plan(-89.781, False, True), "80S_40M")  # band not downloaded
        self.assertEqual(cp.terrain_plan(-85.0, True, True), "80S_40M")     # ~152 km out

    def test_whole_moon_map_everywhere_else(self):
        self.assertEqual(cp.terrain_plan(0.674, True, True, True), "LDEM_128")    # Apollo 11 area
        self.assertEqual(cp.terrain_plan(45.0, False, False, True), "LDEM_128")   # northern hemisphere
        self.assertEqual(cp.terrain_plan(-80.0, True, True, True), "LDEM_128")    # past the polar map edge
        self.assertEqual(cp.terrain_plan(-89.781, False, False, True), "LDEM_128")  # no polar maps yet

    def test_polar_maps_win_when_they_cover_the_point(self):
        self.assertEqual(cp.terrain_plan(-89.781, True, True, True), "85S_20M")

    def test_flat_only_when_no_map_is_downloaded(self):
        self.assertIsNone(cp.terrain_plan(-89.781, True, False))  # polar far field needs the 40 m map
        self.assertIsNone(cp.terrain_plan(-80.0, True, True))     # ~304 km: too close to the polar map edge
        self.assertIsNone(cp.terrain_plan(0.674, True, True))     # Apollo 11 area, no whole-Moon map


class Build(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.calls = []
        lat, lon = SITES[SITE]
        cls.result = cp.build(lat, lon, fetch=fake_fetch(cls.calls), skyline_fn=flat)
        cls.curated = build_site_payload(SITE)

    def test_same_shape_as_a_curated_site(self):
        a = self.result["analysis"]
        for key in self.curated:
            self.assertIn(key, a)
        self.assertEqual(len(a["rows"]), len(self.curated["rows"]))
        self.assertEqual(len(a["skyline_deg"]), 360)
        self.assertEqual(self.result["site"]["id"], a["site"])

    def test_asks_horizons_for_both_spans(self):
        steps = sorted(c[5] for c in self.calls)
        self.assertEqual(steps, ["1 h", "6 h"])
        self.assertTrue(all(c[2] == 0.0 for c in self.calls))  # flat horizon -> height 0

    def test_flat_horizon_is_labelled(self):
        a = self.result["analysis"]
        self.assertEqual(a["horizon"], "flat")
        self.assertIsNone(a["terrain"])
        self.assertIn("FLAT", a["description"])
        self.assertEqual(self.result["site"]["horizon"], "flat")

    def test_flat_horizon_means_elevation_above_zero(self):
        # Flat horizon: visible exactly when the elevation is above 0. (Not an upper bound on real
        # terrain: from a high point like the Shackleton rim the real skyline dips below 0 in places,
        # so the rim really sees MORE Sun than a flat horizon: about 78% vs 54% over the year.)
        rows = self.result["analysis"]["rows"]
        self.assertEqual([r["sun_visible"] for r in rows], [r["sun_el_deg"] > 0 for r in rows])
        self.assertEqual([r["earth_visible"] for r in rows], [r["earth_el_deg"] > 0 for r in rows])

    def test_json_serialisable(self):
        json.dumps(self.result)


class Cache(unittest.TestCase):
    def test_second_ask_reads_the_file(self):
        calls = []
        with tempfile.TemporaryDirectory() as d:
            first = cp.cached_build(-89.781, 203.743, cache_dir=d, fetch=fake_fetch(calls), skyline_fn=flat)
            n = len(calls)
            second = cp.cached_build("-89.7810", "-156.257", cache_dir=d,
                                     fetch=fake_fetch(calls), skyline_fn=flat)
            self.assertEqual(len(calls), n)  # no new Horizons requests
            self.assertEqual(first["site"]["id"], second["site"]["id"])

    def test_a_newly_downloaded_map_replaces_a_flat_answer(self):
        calls = []
        with tempfile.TemporaryDirectory() as d:
            cp.cached_build(0.674, 23.473, cache_dir=d, map_now=None, fetch=fake_fetch(calls), skyline_fn=flat)
            n = len(calls)
            cp.cached_build(0.674, 23.473, cache_dir=d, map_now=None, fetch=fake_fetch(calls), skyline_fn=flat)
            self.assertEqual(len(calls), n)       # same map (none): reused
            cp.cached_build(0.674, 23.473, cache_dir=d, map_now="LDEM_128", fetch=fake_fetch(calls), skyline_fn=flat)
            self.assertGreater(len(calls), n)     # the whole-Moon map is there now: built again


class Routes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            from server.app import create_app
        except ImportError as e:
            raise unittest.SkipTest(f"Flask not installed ({e})")

        def build(lat, lon):
            return cp.build(lat, lon, fetch=fake_fetch([]), skyline_fn=flat)

        def down(lat, lon):
            cp.normalise(lat, lon)
            raise RuntimeError("Horizons error: test")

        cls.client = create_app(build=build).test_client()
        cls.down = create_app(build=down).test_client()

    def test_health(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.get_json()["ok"])

    def test_custom_ok(self):
        r = self.client.get("/api/custom?lat=-89.781&lon=203.743")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["site"]["id"], "custom_s89_781_e203_743")

    def test_custom_bad_input_is_400(self):
        for q in ["", "?lat=-89", "?lat=abc&lon=1", "?lat=95&lon=1"]:
            r = self.client.get("/api/custom" + q)
            self.assertEqual(r.status_code, 400, q)
            self.assertIn("error", r.get_json())

    def test_horizons_down_is_502(self):
        r = self.down.get("/api/custom?lat=-89&lon=10")
        self.assertEqual(r.status_code, 502)
        self.assertIn("Horizons", r.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
