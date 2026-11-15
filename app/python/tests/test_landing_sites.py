"""Tests for scripts/fetch_landing_sites.py: past landings read from Wikipedia's list of artificial
objects on the Moon. Offline: uses small made-up pieces of the page source.

Run (from app/python):  python3 -m unittest tests.test_landing_sites -v
"""
import json
import os
import sys
import unittest

PYDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/python
ROOT = os.path.dirname(os.path.dirname(PYDIR))
sys.path.insert(0, os.path.join(PYDIR, "scripts"))
import fetch_landing_sites as F  # noqa: E402

# Two rows for the same mission: a crashed part (red) and the landed lander (cream). The landed one
# must win, the 1960 inside the flag template is not the year, and the cited link is kept.
SAMPLE = """intro
===Table of objects===
{| class="wikitable"
|-style="background:#ffb7b7"
| [[Luna 9]] rocket stage
| {{flag|USSR}}
| align=center| 1966
| align=left  | Crashed
| align=left  | {{Coord|5|N|60|W|globe:Moon}}
|-style="background:#FCF2CF"
| [[Luna 9]] lander
| {{flag|USSR}}
| align=center| 1966
| align=left  | Landed
| align=left  | {{Coord|7.08|N|64.37|W|globe:Moon|display=inline}}
| <ref>{{cite web|url = https://nssdc.example/luna9|title = x}}</ref>
|-style="background:#FCF2CF"
| [[Surveyor 1]] (separate from descent stage)
| {{flag|United States|1960}}
| align=center| 1966
| align=left  | Landed
| align=left  | {{Lunar coords and quad cat|2|28|S|43|20|W}}
|}
==Image gallery==
"""


class ParseCoord(unittest.TestCase):
    def test_decimal_with_hemispheres(self):
        self.assertEqual(F.parse_coord("84.7906|S|29.1957|E|globe:moon"), (-84.7906, 29.1957))

    def test_degrees_minutes(self):
        lat, lon = F.parse_coord("2|28|S|43|20|W")
        self.assertAlmostEqual(lat, -(2 + 28 / 60))
        self.assertAlmostEqual(lon, -(43 + 20 / 60))

    def test_unreadable(self):
        with self.assertRaises(ValueError):
            F.parse_coord("no|numbers")


class Pick(unittest.TestCase):
    def setUp(self):
        self.saved = F.WANTED
        F.WANTED = {"luna_9": ("Luna 9", "[[Luna 9]]"), "surveyor_1": ("Surveyor 1", "[[Surveyor 1]]")}

    def tearDown(self):
        F.WANTED = self.saved

    def test_uses_the_landed_row_and_converts_to_east_longitude(self):
        luna = F.pick(SAMPLE)[0]
        self.assertEqual(luna["lat_deg"], 7.08)
        self.assertEqual(luna["lon_deg_east"], round(360 - 64.37, 4))   # 64.37 W = 295.63 E
        self.assertEqual(luna["source_url"], "https://nssdc.example/luna9")
        self.assertEqual(luna["status_on_page"], "landed")

    def test_year_is_not_taken_from_the_flag(self):
        surveyor = F.pick(SAMPLE)[1]
        self.assertEqual(surveyor["year"], 1966)
        self.assertEqual(surveyor["source_url"], "")   # the page gives no link for this one

    def test_missing_landed_row_is_an_error(self):
        F.WANTED = {"x": ("Nothing", "[[Nothing]]")}
        with self.assertRaises(LookupError):
            F.pick(SAMPLE)


@unittest.skipUnless(os.path.exists(os.path.join(ROOT, "data", "sites_landings.json")), "not fetched yet")
class CachedFile(unittest.TestCase):
    def test_every_site_is_complete_and_on_the_moon(self):
        with open(os.path.join(ROOT, "data", "sites_landings.json")) as f:
            sites = json.load(f)["sites"]
        self.assertEqual(len(sites), len(F.WANTED))
        for s in sites:
            with self.subTest(site=s["id"]):
                self.assertTrue(-90 <= s["lat_deg"] <= 90)
                self.assertTrue(0 <= s["lon_deg_east"] < 360)
                self.assertTrue(1959 <= s["year"] <= 2030)
                self.assertIn(s["status_on_page"], ("landed", "operational"))


if __name__ == "__main__":
    unittest.main()
