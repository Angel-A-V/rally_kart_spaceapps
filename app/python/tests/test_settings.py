"""Tests for the visibility settings (GitHub issue #2): the Sun rule and the Earth safety margin.

Offline, made-up rows with known answers, plus a real-data check that the defaults change nothing.
Run (from app/python):  python3 -m unittest tests.test_settings -v
"""
import os
import sys
import unittest

PYDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/python
sys.path.insert(0, PYDIR)
sys.path.insert(0, os.path.join(PYDIR, "scripts"))

from analysis.events import annotate_events, next_event  # noqa: E402
from analysis.visibility import SUN_RADIUS_DEG, analyse, thresholds  # noqa: E402

FLAT = [0.0] * 360


def row(sun_el, earth_el, t="2026-Nov-10 00:00"):
    return {"time_utc": t, "sun_az_deg": 100.0, "sun_el_deg": sun_el, "earth_az_deg": 150.0, "earth_el_deg": earth_el}


class Thresholds(unittest.TestCase):
    def test_defaults_are_the_original_rule(self):
        self.assertEqual(thresholds(), (0.0, 0.0))
        self.assertEqual(thresholds({}), (0.0, 0.0))

    def test_sun_rules(self):
        self.assertEqual(thresholds({"sun_rule": "any_part"})[0], -SUN_RADIUS_DEG)
        self.assertEqual(thresholds({"sun_rule": "whole_disc"})[0], SUN_RADIUS_DEG)

    def test_bad_settings(self):
        with self.assertRaises(ValueError):
            thresholds({"sun_rule": "half"})
        with self.assertRaises(ValueError):
            thresholds({"earth_margin_deg": -1})


class Analyse(unittest.TestCase):
    def test_sun_half_set(self):
        # Sun centre 0.1 deg BELOW a flat horizon: only its top edge shows.
        sun = lambda rule: analyse([row(-0.1, 5)], FLAT, {"sun_rule": rule})[0]["sun_visible"]
        self.assertFalse(sun("centre"))
        self.assertTrue(sun("any_part"))
        self.assertFalse(sun("whole_disc"))

    def test_sun_just_risen(self):
        # Centre 0.1 deg ABOVE the horizon: centre counts, but the bottom edge is still hidden.
        sun = lambda rule: analyse([row(0.1, 5)], FLAT, {"sun_rule": rule})[0]["sun_visible"]
        self.assertTrue(sun("centre"))
        self.assertTrue(sun("any_part"))
        self.assertFalse(sun("whole_disc"))

    def test_earth_margin(self):
        # Earth 1.5 deg above the skyline: fine with no margin, not with a 2 deg safety margin.
        self.assertTrue(analyse([row(5, 1.5)], FLAT)[0]["earth_visible"])
        out = analyse([row(5, 1.5)], FLAT, {"earth_margin_deg": 2.0})[0]
        self.assertFalse(out["earth_visible"])
        self.assertFalse(out["both_visible"])
        self.assertAlmostEqual(out["earth_margin_deg"], 1.5)   # the margin itself does not change


class EventsFollowTheThreshold(unittest.TestCase):
    def test_crossing_time_uses_the_threshold(self):
        # Earth margin falls 3 -> 1 deg over one hour. With a 2 deg safety margin the "earthset" is
        # where the margin crosses 2: exactly halfway. (With no margin it never sets here.)
        rows = analyse([row(5, 3.0), row(5, 1.0, "2026-Nov-10 01:00")], FLAT, {"earth_margin_deg": 2.0})
        e = next_event(rows, 0, "earth", threshold=2.0)
        self.assertEqual(e["event"], "earthset")
        self.assertAlmostEqual(e["hours"], 0.5)

    def test_annotate_passes_the_settings_through(self):
        settings = {"earth_margin_deg": 2.0}
        rows = analyse([row(5, 3.0), row(5, 1.0, "2026-Nov-10 01:00")], FLAT, settings)
        self.assertAlmostEqual(annotate_events(rows, 1.0, settings)[0]["earth_event_hours"], 0.5)


class DefaultsChangeNothing(unittest.TestCase):
    def test_real_site_same_as_before(self):
        from export_site_json import build_site_payload
        a = build_site_payload("shackleton_rim")
        self.assertEqual(a["settings"]["sun_rule"], "centre")
        self.assertEqual(a["settings"]["earth_margin_deg"], 0.0)
        self.assertEqual(a["year"]["sun_visible_pct"], 78.2)     # same yearly numbers as before #2
        self.assertEqual(a["year"]["earth_visible_pct"], 50.0)
        self.assertIn("horizons_queries", a["sources"])           # #6: the exact queries are included
        self.assertTrue(a["sources"]["horizons_queries"]["30d"]["sun"].startswith("https://ssd.jpl.nasa.gov/api/horizons.api?"))


if __name__ == "__main__":
    unittest.main()
