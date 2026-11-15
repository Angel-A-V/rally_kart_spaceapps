"""Tests for scripts/crosscheck_pgda.py: our numbers against NASA's published polar maps (issue #1).

The projection tests need no data. The last test reads the real NASA maps if they are downloaded.
Run (from app/python):  python3 -m unittest tests.test_crosscheck -v     (needs numpy)
"""
import os
import sys
import unittest

PYDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/python
sys.path.insert(0, PYDIR)
sys.path.insert(0, os.path.join(PYDIR, "scripts"))

import crosscheck_pgda as C  # noqa: E402


class Projection(unittest.TestCase):
    def test_pole_is_the_centre_pixel(self):
        # The label offset 2528.5 = (5058 - 1) / 2 is already the 0-based centre. A half-pixel slip
        # here moved the check 30 m and once made the model site look wrong.
        for lat in (-90.0, 90.0):
            row, col = C.to_pixel(lat, 0.0)
            self.assertAlmostEqual(row, 2528.5)
            self.assertAlmostEqual(col, 2528.5)

    def test_orientation_follows_the_pds_polar_stereographic_rule(self):
        # 60 m from the pole along 0 deg E: one pixel towards the top (south map) or bottom (north map).
        ang = 0.060 / 1737.4 * 180 / 3.141592653589793
        row_s, col_s = C.to_pixel(-90 + ang, 0.0)
        row_n, col_n = C.to_pixel(90 - ang, 0.0)
        self.assertAlmostEqual(row_s, 2527.5, places=2)
        self.assertAlmostEqual(row_n, 2529.5, places=2)
        # 90 deg E is to the right on both maps.
        self.assertAlmostEqual(C.to_pixel(-90 + ang, 90.0)[1], 2529.5, places=2)
        self.assertAlmostEqual(C.to_pixel(90 - ang, 90.0)[1], 2529.5, places=2)


class Verdict(unittest.TestCase):
    def test_three_outcomes(self):
        self.assertEqual(C.verdict(37, {"at": 35, "min": 35, "max": 35}), "agrees")
        self.assertEqual(C.verdict(84, {"at": 70, "min": 6, "max": 85}), "agrees_within_60m")
        self.assertEqual(C.verdict(17, {"at": 27, "min": 24, "max": 28}), "differs")


@unittest.skipUnless(C.load_map(C.MAPS[("south", "sun")]) is not None,
                     "NASA south-pole maps not downloaded (data/raw/AVGVISIB_85S_060M_201608*.IMG)")
class RealMaps(unittest.TestCase):
    def test_shadowed_crater_and_model_site(self):
        grids = {k: C.load_map(p) for k, p in C.MAPS.items()}
        shackleton = C.check_site("shackleton", grids)        # permanently shadowed floor
        self.assertEqual(shackleton["nasa"]["sun"]["max"], 0.0)
        self.assertEqual(shackleton["ours"]["sun"], 0.0)
        rim = C.check_site("shackleton_rim", grids)
        self.assertNotEqual(rim["verdict"]["sun"], "differs")
        self.assertEqual(rim["verdict"]["earth"], "agrees")


import crosscheck_nonpolar as NP  # noqa: E402


class ApolloRecords(unittest.TestCase):
    def test_journal_table_was_copied_whole(self):
        import json
        with open(NP.ALSJ_FILE) as f:
            alsj = json.load(f)
        self.assertEqual([m["mission"] for m in alsj["missions"]],
                         ["Apollo 11", "Apollo 12", "Apollo 14", "Apollo 15", "Apollo 16", "Apollo 17"])
        self.assertEqual(sum(len(m["events"]) for m in alsj["missions"]), 42)
        a11 = alsj["missions"][0]["events"][0]
        self.assertEqual((a11["event"], a11["time_utc"], a11["sun_alt_deg"]), ("Landing", "1969-07-20 20:17:39", 10.65))

    def test_angle_difference_wraps(self):
        self.assertAlmostEqual(NP.ang_diff(359.0, 1.0), -2.0)
        self.assertAlmostEqual(NP.ang_diff(1.0, 359.0), 2.0)


class Physics(unittest.TestCase):
    def test_sunrises_found_between_samples(self):
        rows = [{"time_utc": f"2026-Nov-{10 + i // 4:02d} {6 * (i % 4):02d}:00", "sun_margin_deg": m}
                for i, m in enumerate([-2, -1, 1, 2, 1, -1, -2, -1, 1])]
        rises = NP._rises(rows)
        self.assertEqual(len(rises), 2)
        self.assertAlmostEqual(rises[0], 0.375)        # halfway between the 06:00 and 12:00 samples

    def test_far_side_site_never_sees_earth(self):
        res = NP.check_physics("change_4")
        share = next(c for c in res["checks"] if c["id"] == "earth_share")
        self.assertEqual(share["expected"], 0.0)
        self.assertTrue(res["all_ok"])


LROC_A12 = os.path.join(NP.LROC_DIR, "NAC_DTM_APOLLO12.TIF")


@unittest.skipUnless(os.path.exists(LROC_A12), "LROC Apollo terrain models not downloaded (data/raw/lroc/)")
class LrocModels(unittest.TestCase):
    def test_label_byte_offset_is_one_based(self):
        # PDS counts bytes from 1; the TIFF's own strip table must agree once 1 is taken off.
        lab = NP.read_label(os.path.join(NP.LROC_DIR, "NAC_DTM_APOLLO11.LBL"))
        offsets, _ = NP.tiff_strips(os.path.join(NP.LROC_DIR, lab["file"]))
        self.assertEqual(offsets[0], lab["label_offset"])

    def test_apollo12_rows_stored_out_of_order_are_read_in_order(self):
        grid, lab = NP.open_dtm("12")
        self.assertIsNotNone(grid)
        h = NP.dtm_heights(grid, lab, *NP.SITES["apollo_12"])[0]
        self.assertAlmostEqual(h, -1425.5, delta=1.0)  # matches the LOLA height there (-1425.1 m)


if __name__ == "__main__":
    unittest.main()
