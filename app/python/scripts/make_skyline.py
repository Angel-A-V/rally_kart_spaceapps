#!/usr/bin/env python3
"""Build a skyline (horizon profile) for a Moon site from NASA LOLA terrain data.

For each compass direction (azimuth, 0 = north, 90 = east) it walks outward from
the site across the terrain map and records the highest angle above the flat
horizon that any terrain blocks. Output CSV: azimuth_deg, skyline_deg.

Data: LOLA LDEM_85S_20M (20 m per pixel, polar stereographic, heights in metres
above a 1737.4 km sphere). Source: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/
Only the central band of rows is downloaded (about 150 MB instead of 460 MB).

Run:  python3 scripts/make_skyline.py            (needs numpy)
"""
import argparse
import csv
import json
import os
import urllib.request

import numpy as np

URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_85S_20M.IMG"
N = 15168                 # map is N x N pixels, 16-bit little-endian
PX_M = 20.0               # metres per pixel
CENTER = 7583.5           # pole is at this pixel (row and column)
R = 1737400.0             # reference sphere radius in metres
BAND_ROWS = 5000          # rows kept: +/- 50 km from the pole
ROW0 = 5084               # first row of the band
# Repo root (four levels up from this file): the shared data/ folder lives there.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
RAW = os.path.join(ROOT, "data", "raw", "band_85S_20M.bin")

from sites import MODEL_SITE, SITE_GRID, SITES, SKYLINE_FILE  # noqa: E402  (see scripts/sites.py)


class Grid:
    """One NASA LOLA south-polar map (polar stereographic, pole at the centre).

    n       the map is n x n pixels
    px_m    metres per pixel
    center  the pole is at this pixel (row and column)
    row0    first row held in memory (only used by the cut-down 85S band)
    scale   stored number * scale = height in metres
    """

    def __init__(self, name, n, px_m, center, row0=0, scale=1.0, url=None, path=None, rows=None):
        self.name, self.n, self.px_m, self.center = name, n, px_m, center
        self.row0, self.scale, self.url, self.path = row0, scale, url, path
        self.rows = rows if rows is not None else n

    @property
    def half_width_km(self):
        return self.n / 2 * self.px_m / 1000


GRIDS = {
    # 80 degrees south to the pole at 40 m per pixel: reaches 304 km from the pole.
    # Label: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_40M.LBL
    "80S_40M": Grid(
        "80S_40M", n=15200, px_m=40.0, center=7599.5, scale=0.5,
        url="https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_40M.IMG",
        path=os.path.join(ROOT, "data", "raw", "LDEM_80S_40M.IMG"),
    ),
}
GRID_SOURCE = {
    "85S_20M": "NASA LRO LOLA LDEM_85S_20M (PDS Geosciences Node GDR)",
    "80S_40M": "NASA LRO LOLA LDEM_80S_40M (PDS Geosciences Node GDR)",
}


def load_grid(name):
    """Open a whole map file without reading it all into memory (downloads it once, about 460 MB)."""
    g = GRIDS[name]
    size = g.n * g.n * 2
    if not (os.path.exists(g.path) and os.path.getsize(g.path) == size):
        os.makedirs(os.path.dirname(g.path), exist_ok=True)
        print(f"downloading terrain map {name} (~{size // 1_000_000} MB)...")
        with urllib.request.urlopen(g.url) as r, open(g.path, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
    return np.memmap(g.path, dtype="<i2", mode="r", shape=(g.n, g.n))


def fetch_band():
    if os.path.exists(RAW) and os.path.getsize(RAW) == BAND_ROWS * N * 2:
        return
    os.makedirs(os.path.dirname(RAW), exist_ok=True)
    start = ROW0 * N * 2
    end = (ROW0 + BAND_ROWS) * N * 2 - 1
    req = urllib.request.Request(URL, headers={"Range": f"bytes={start}-{end}"})
    print("downloading terrain band (~150 MB)...")
    with urllib.request.urlopen(req) as r, open(RAW, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)


def to_pixel(lat, lon, grid=None):
    """Latitude/longitude (degrees, south negative) -> fractional (row, col).

    With no grid this is the cut-down 85S 20 m band (the original behaviour).
    """
    center, px_m, row0 = (CENTER, PX_M, ROW0) if grid is None else (grid.center, grid.px_m, grid.row0)
    rho = 2 * R * np.tan(np.radians(90.0 + lat) / 2)
    lo = np.radians(lon)
    x, y = rho * np.sin(lo), rho * np.cos(lo)
    return center - y / px_m - row0, center + x / px_m


def _check_inside(h, row, col, what):
    """Refuse to read outside the map: a negative index would silently wrap to the other side."""
    row, col = np.atleast_1d(row), np.atleast_1d(col)
    if row.min() < 0 or col.min() < 0 or row.max() >= h.shape[0] - 1 or col.max() >= h.shape[1] - 1:
        raise ValueError(f"{what} is outside the terrain map")


def sample(h, row, col):
    """Bilinear height lookup (metres)."""
    r0, c0 = np.floor(row).astype(int), np.floor(col).astype(int)
    fr, fc = row - r0, col - c0
    return (h[r0, c0] * (1 - fr) * (1 - fc) + h[r0, c0 + 1] * (1 - fr) * fc
            + h[r0 + 1, c0] * fr * (1 - fc) + h[r0 + 1, c0 + 1] * fr * fc)


def destination(lat, lon, az, dist):
    """Point reached from (lat, lon) going `dist` metres on bearing `az` (great circle)."""
    la, lo, b, t = np.radians(lat), np.radians(lon), np.radians(az), dist / R
    la2 = np.arcsin(np.sin(la) * np.cos(t) + np.cos(la) * np.sin(t) * np.cos(b))
    lo2 = lo + np.arctan2(np.sin(b) * np.sin(t) * np.cos(la),
                          np.cos(t) - np.sin(la) * np.sin(la2))
    return np.degrees(la2), np.degrees(lo2)


def _walk_rays(height_at, h_site, lat, lon, step_deg, d):
    """The skyline itself, for any terrain map.

    For each azimuth, walk outward along the ground (distances `d`, metres), ask
    height_at(lats, lons, az) for the terrain heights there, and keep the steepest angle.
    Same maths for every map; only the height lookup differs.
    """
    out = []
    theta = d / R   # angle at the Moon's centre; accounts for curvature exactly
    for az in np.arange(0, 360, step_deg):
        la2, lo2 = destination(lat, lon, az, d)
        ht = height_at(la2, lo2, az)
        up = (R + ht) * np.cos(theta) - (R + h_site)
        out_ = (R + ht) * np.sin(theta)
        out.append((az, float(np.degrees(np.arctan2(up, out_)).max())))
    return out


def skyline(h, lat, lon, step_deg=1.0, max_km=35.0, step_m=40.0, mast_m=0.0, grid=None, min_m=None):
    scale = 1.0 if grid is None else grid.scale   # the 85S band is already in metres
    row, col = to_pixel(lat, lon, grid)
    if grid is not None:
        _check_inside(h, row, col, f"the site ({lat}, {lon})")
    h_site = sample(h, np.array(row), np.array(col)) * scale + mast_m
    # min_m: nearest terrain looked at (default: one step). Used to compare maps beyond the near field.
    d = np.arange(step_m if min_m is None else min_m, max_km * 1000, step_m)

    def height_at(la2, lo2, az):
        r, c = to_pixel(la2, lo2, grid)
        if grid is not None:
            _check_inside(h, r, c, f"a {max_km} km ray from ({lat}, {lon}) toward azimuth {az}")
        return sample(h, r, c) * scale

    return _walk_rays(height_at, h_site, lat, lon, step_deg, d), float(h_site)


# ---------- The whole-Moon map: LDEM_128 (simple cylindrical, 128 pixels per degree) ----------
# Same NASA LOLA data as Moon Trek's "LRO LOLA DEM" (LRO_LOLA_DEM_Global_128ppd_v04).
# Layout from its label (https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_128.LBL):
#   23040 rows x 46080 columns, 16-bit little-endian, height (m) = number * 0.5 above the 1737.4 km
#   sphere (the same units as the polar maps). Row 0 is the top (90 N), column 0 starts at 0 E,
#   east positive. About 237 m per pixel at the equator.
GLOBAL_PPD = 128
GLOBAL_ROWS, GLOBAL_COLS = 180 * GLOBAL_PPD, 360 * GLOBAL_PPD
GLOBAL_SCALE = 0.5
GLOBAL_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_128.IMG"
GLOBAL_PATH = os.path.join(ROOT, "data", "raw", "LDEM_128.IMG")
GLOBAL_STEP_M = 118.0   # half a pixel at the equator: no terrain pixel is skipped along a ray
GRID_SOURCE["LDEM_128"] = ("NASA LRO LOLA LDEM_128 (PDS Geosciences Node GDR, 128 pixels per degree; "
                           "the same map as Moon Trek's LRO LOLA DEM)")


def to_pixel_global(lat, lon, ppd=GLOBAL_PPD):
    """Latitude/longitude -> fractional (row, col) on the whole-Moon map.

    Whole numbers are pixel centres. The label puts the equator at row 11519.5 and 180 E at
    column 23039.5 (its LINE/SAMPLE_PROJECTION_OFFSET), which this reproduces.
    """
    return (90.0 - lat) * ppd - 0.5, (np.asarray(lon) % 360.0) * ppd - 0.5


def sample_global(h, row, col):
    """Bilinear height lookup on the whole-Moon map (raw numbers; multiply by GLOBAL_SCALE).

    Longitude wraps: the pixel right of the last column is column 0. Within half a pixel of
    a pole there is no row beyond the edge, so the edge row is used.
    """
    rows, cols = h.shape
    row = np.clip(row, 0.0, rows - 1 - 1e-9)
    r0, c0 = np.floor(row).astype(int), np.floor(col).astype(int)
    fr, fc = row - r0, col - c0
    c0 = c0 % cols
    c1 = (c0 + 1) % cols
    return (h[r0, c0] * (1 - fr) * (1 - fc) + h[r0, c1] * (1 - fr) * fc
            + h[r0 + 1, c0] * fr * (1 - fc) + h[r0 + 1, c1] * fr * fc)


def global_present():
    """Is the whole-Moon map downloaded and complete? Never downloads anything."""
    return os.path.exists(GLOBAL_PATH) and os.path.getsize(GLOBAL_PATH) == GLOBAL_ROWS * GLOBAL_COLS * 2


def load_global(download=False):
    """Open the whole-Moon map without reading it into memory (2.1 GB). Downloads only if asked."""
    if not global_present():
        if not download:
            raise FileNotFoundError(f"{GLOBAL_PATH} is missing or incomplete; run make_skyline.py --grid LDEM_128")
        os.makedirs(os.path.dirname(GLOBAL_PATH), exist_ok=True)
        print("downloading the whole-Moon terrain map LDEM_128 (~2.1 GB)...")
        with urllib.request.urlopen(GLOBAL_URL) as r, open(GLOBAL_PATH, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
    return np.memmap(GLOBAL_PATH, dtype="<i2", mode="r", shape=(GLOBAL_ROWS, GLOBAL_COLS))


def skyline_global(h, lat, lon, step_deg=1.0, max_km=250.0, step_m=GLOBAL_STEP_M, mast_m=0.0,
                   ppd=GLOBAL_PPD, scale=GLOBAL_SCALE):
    """Skyline anywhere on the Moon from a whole-Moon (cylindrical) map. Returns (profile, site_height_m)."""
    row, col = to_pixel_global(lat, lon, ppd)
    h_site = float(sample_global(h, np.array(row), np.array(col))) * scale + mast_m
    d = np.arange(step_m, max_km * 1000, step_m)

    def height_at(la2, lo2, az):
        r, c = to_pixel_global(la2, lo2, ppd)
        return sample_global(h, r, c) * scale

    return _walk_rays(height_at, h_site, lat, lon, step_deg, d), h_site


NEAR_KM = 35.0      # near field: the finest map, 40 m steps
FAR_CAP_KM = 250.0  # far field: the 40 m map, 80 m steps. Measured 2026-11-14: nothing beyond
                    # about 200 km changes the skyline at the sites checked.


def combine(near, far):
    """The higher of two skylines in each direction (terrain can only block more, never less)."""
    if [az for az, _ in near] != [az for az, _ in far]:
        raise ValueError("the two skylines use different directions")
    return [(az, max(a, b)) for (az, a), (_, b) in zip(near, far)]


def far_reach_km(lat):
    """How far out to look from a site: up to FAR_CAP_KM, less if the 40 m map ends sooner."""
    pole_km = 2 * R * np.tan(np.radians(90.0 + lat) / 2) / 1000
    return float(min(FAR_CAP_KM, GRIDS["80S_40M"].half_width_km - pole_km - 1.0))


def site_skyline(grid_name, lat, lon, step_deg=1.0):
    """The skyline used by the website: near field from the site's finest map, far field
    (beyond NEAR_KM) from the 40 m map. Returns (profile, site_height_m, info)."""
    wide = GRIDS["80S_40M"]
    h_wide = load_grid("80S_40M")
    if grid_name == "85S_20M":
        fetch_band()
        band = np.fromfile(RAW, dtype="<i2").reshape(BAND_ROWS, N) * 0.5
        near, h_site = skyline(band, lat, lon, step_deg, NEAR_KM)
    else:
        near, h_site = skyline(h_wide, lat, lon, step_deg, NEAR_KM, grid=wide)
    reach = far_reach_km(lat)
    far, _ = skyline(h_wide, lat, lon, step_deg, reach, step_m=80.0, grid=wide, min_m=NEAR_KM * 1000)
    info = {
        "near_map": grid_name, "near_range_km": NEAR_KM,
        "far_map": "80S_40M", "far_range_km": reach,
        "far_range_limited_by_map_edge": reach < 200.0,
    }
    return combine(near, far), h_site, info


def global_site_skyline(lat, lon, step_deg=1.0, download=False):
    """The skyline for any point on the Moon from the whole-Moon map, out to FAR_CAP_KM.
    Coarser than the polar maps (about 237 m per pixel) but covers everywhere.
    Returns (profile, site_height_m, info) like site_skyline()."""
    prof, h_site = skyline_global(load_global(download), lat, lon, step_deg, FAR_CAP_KM)
    info = {
        "near_map": "LDEM_128", "near_range_km": NEAR_KM,
        "far_map": "LDEM_128", "far_range_km": FAR_CAP_KM,
        "far_range_limited_by_map_edge": False,
    }
    return prof, h_site, info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="shackleton_rim", choices=SITES)
    ap.add_argument("--step-deg", type=float, default=1.0)
    ap.add_argument("--max-km", type=float, default=35.0)
    ap.add_argument("--grid", choices=["85S_20M", *GRIDS, "LDEM_128"],
                    help="terrain map (default: the site's map in sites.py). LDEM_128 = the whole-Moon map")
    ap.add_argument("--model-wall", action="store_true",
                    help="rebuild the ORIGINAL 35 km skyline of the model site that the printed wall uses "
                         "(data/skyline_shackleton_rim.csv) instead of the website's extended one")
    a = ap.parse_args()

    grid_name = a.grid or SITE_GRID[a.site]
    lat, lon = SITES[a.site]
    info = {}
    if a.model_wall:
        if a.site != MODEL_SITE:
            ap.error("--model-wall only applies to the model site")
        fetch_band()
        h = np.fromfile(RAW, dtype="<i2").reshape(BAND_ROWS, N) * 0.5
        prof, h_site = skyline(h, lat, lon, a.step_deg, a.max_km)
        out_name = f"skyline_{a.site}.csv"
    elif grid_name == "LDEM_128":
        prof, h_site, info = global_site_skyline(lat, lon, a.step_deg, download=True)
        # A site outside the polar maps (e.g. Apollo 11) uses this as its website skyline. For a polar
        # site, asking for LDEM_128 is a comparison run and must never overwrite the polar-map skyline.
        out_name = SKYLINE_FILE[a.site] if SITE_GRID[a.site] == "LDEM_128" else f"skyline_{a.site}_global.csv"
    else:
        prof, h_site, info = site_skyline(grid_name, lat, lon, a.step_deg)
        out_name = SKYLINE_FILE[a.site]

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    path = os.path.join(ROOT, "data", out_name)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["azimuth_deg", "skyline_deg"])
        for az, el in prof:
            w.writerow([f"{az:.1f}", f"{el:.3f}"])
    els = [e for _, e in prof]
    meta = {
        "site": a.site, "lat_deg": lat, "lon_deg_east": lon,
        "site_height_m_above_1737.4km_sphere": h_site,
        "azimuth": "0 = north, 90 = east, step %.1f deg" % a.step_deg,
        "max_range_km": info.get("far_range_km", a.max_km),
        **info,
        "skyline_min_deg": min(els), "skyline_max_deg": max(els),
        "skyline_mean_deg": sum(els) / len(els),
        "terrain_map": grid_name,
        "source": GRID_SOURCE[grid_name],
    }
    with open(path[:-4] + ".meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(path)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
