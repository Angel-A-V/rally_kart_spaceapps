"""Tests for the whole-Moon terrain map in scripts/make_skyline.py (LDEM_128, any point on the Moon).

Part 1 uses small made-up maps with known answers. Part 2 checks the real map against the
skylines already built from the finer south-polar maps; it is skipped until
data/raw/LDEM_128.IMG has been downloaded (python3 scripts/make_skyline.py --grid LDEM_128).

Run (from app/python):  python3 -m unittest tests.test_skyline_global -v     (needs numpy)
"""
import csv
import math
import os
import sys
import unittest

import numpy as np

PYDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/python
ROOT = os.path.dirname(os.path.dirname(PYDIR))                       # repo root
sys.path.insert(0, os.path.join(PYDIR, "scripts"))
import make_skyline as M  # noqa: E402
from sites import SITES, SKYLINE_FILE  # noqa: E402

PPD = 4   # made-up maps: 4 pixels per degree (720 x 1440), small enough to build in memory


def flat_map(value=0):
    return np.full((180 * PPD, 360 * PPD), value, dtype="<i2")


class PixelGeometry(unittest.TestCase):
    def test_matches_the_label_offsets(self):
        # LDEM_128.LBL: equator at line 11519.5, 180 E at sample 23039.5 (pixel-centre coordinates).
        row, col = M.to_pixel_global(0.0, 180.0)
        self.assertAlmostEqual(row, 11519.5)
        self.assertAlmostEqual(col, 23039.5)

    def test_first_pixel_centre(self):
        row, col = M.to_pixel_global(90 - 0.5 / 128, 0.5 / 128)
        self.assertAlmostEqual(row, 0.0)
        self.assertAlmostEqual(col, 0.0)

    def test_west_longitude_wraps(self):
        self.assertAlmostEqual(M.to_pixel_global(10.0, -10.0)[1], M.to_pixel_global(10.0, 350.0)[1])

    def test_real_map_size(self):
        self.assertEqual((M.GLOBAL_ROWS, M.GLOBAL_COLS), (23040, 46080))
        self.assertEqual(M.GLOBAL_ROWS * M.GLOBAL_COLS * 2, 2123366400)   # bytes, from the server


class Sampling(unittest.TestCase):
    def test_bilinear_between_pixels(self):
        h = flat_map()
        h[100, 200], h[100, 201] = 0, 1000
        self.assertAlmostEqual(float(M.sample_global(h, np.array(100.0), np.array(200.25))), 250.0)

    def test_wraps_across_0_east(self):
        # Halfway between the last column and the first one.
        h = flat_map()
        h[:, -1], h[:, 0] = 0, 1000
        last = h.shape[1] - 1
        self.assertAlmostEqual(float(M.sample_global(h, np.array(300.0), np.array(last + 0.5))), 500.0)
        self.assertAlmostEqual(float(M.sample_global(h, np.array(300.0), np.array(-0.5))), 500.0)

    def test_does_not_fall_off_a_pole(self):
        h = flat_map(7)
        for row in (-0.5, h.shape[0] - 0.5):
            self.assertAlmostEqual(float(M.sample_global(h, np.array(row), np.array(10.0))), 7.0)


class KnownSkylines(unittest.TestCase):
    def test_smooth_sphere_dips_below_zero(self):
        # No terrain at all: the nearest ground sits just below the flat horizon (the Moon curves away).
        prof, h_site = M.skyline_global(flat_map(), 0.0, 90.0, step_deg=30, max_km=50, step_m=500, ppd=PPD)
        self.assertEqual(h_site, 0.0)
        expected = -math.degrees(500 / (2 * M.R))   # the first sample, 500 m out
        for _, el in prof:
            self.assertAlmostEqual(el, expected, places=3)

    def test_ridge_to_the_north(self):
        # A 1 km high band of terrain from 0.5 to 1 degree north, seen from the equator.
        h = flat_map()
        top, bottom = int((90 - 1.0) * PPD), int((90 - 0.5) * PPD)
        h[top:bottom, :] = 2000   # 2000 * 0.5 = 1000 m
        prof, _ = M.skyline_global(h, 0.0, 90.0, step_deg=90, max_km=60, step_m=200, ppd=PPD)
        north = dict(prof)[0.0]
        south = dict(prof)[180.0]
        # The near edge of the ridge (~0.5 deg = ~15 km away, blending in over one pixel) at 1 km high.
        near_km = math.radians(0.5 - 0.5 / PPD) * M.R / 1000
        self.assertGreater(north, 1.0)
        self.assertLess(north, math.degrees(math.atan(1.0 / near_km)) + 0.1)
        self.assertLess(south, 0.0)   # nothing to the south


@unittest.skipUnless(M.global_present(), "whole-Moon map not downloaded (data/raw/LDEM_128.IMG)")
class RealMap(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.h = M.load_global()

    def height(self, lat, lon):
        r, c = M.to_pixel_global(lat, lon)
        return float(M.sample_global(self.h, np.array(r), np.array(c))) * M.GLOBAL_SCALE

    def test_known_heights(self):
        self.assertAlmostEqual(self.height(-89.781, 203.743), 1738.0, delta=50)   # rim pick (polar map: 1738 m)
        self.assertLess(self.height(-89.654, 128.31), -2000)                      # Shackleton crater floor

    def test_agrees_with_the_polar_map_skylines(self):
        # Same LOLA data at 237 m vs 20-40 m per pixel: the shapes must match closely everywhere.
        for site, (lat, lon) in SITES.items():
            with open(os.path.join(ROOT, "data", SKYLINE_FILE[site])) as f:
                ref = np.array([float(r["skyline_deg"]) for r in csv.DictReader(f)])
            prof, _ = M.skyline_global(self.h, lat, lon, max_km=250.0)
            got = np.array([el for _, el in prof])
            with self.subTest(site=site):
                self.assertLess(np.mean(np.abs(got - ref)), 0.6)
                self.assertGreater(np.corrcoef(got, ref)[0, 1], 0.8)


if __name__ == "__main__":
    unittest.main()
