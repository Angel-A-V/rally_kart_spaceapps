"""Cross-check our Sun and Earth visibility against NASA's own published maps (GitHub issue #1).

NASA GSFC PGDA "Lunar Polar Illumination" (Mazarico et al. 2011, Icarus 211, 1066-1081):
average solar illumination and average Earth visibility of both poles (85-90 deg, 60 m per
pixel), computed from LOLA terrain hourly over about 18.6 years. Product page:
https://pgda.gsfc.nasa.gov/products/69

Their method is independent of ours (their own horizon code, their own 60 m elevation map, their
own Sun/Earth positions), so agreement is real evidence that our numbers are right.

Fair comparison: NASA counts a pixel as lit when ANY part of the Sun's disc shows, and Earth as
visible when ANY part of Earth's disc shows. So here the Sun uses our "any part" rule and Earth
uses Earth's apparent radius (about 0.95 deg). Our numbers cover one year (2026-27, 6-hourly);
theirs are an 18.6-year average, so a few points of difference are expected.

Download once (51 MB each) into data/raw/, from http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/ :
  AVGVISIB_85S_060M_201608.IMG  AVGVISIB_85S_060M_201608_EARTH.IMG   (south)
  AVGVISIB_85N_060M_201608.IMG  AVGVISIB_85N_060M_201608_EARTH.IMG   (north)
Labels (projection and scaling): same names with .LBL.

Run (from the repo root):  .venv/bin/python app/python/scripts/crosscheck_pgda.py
Writes docs/crosscheck-pgda.md (for people) and app/public/data/crosscheck.json (for the website).
"""
import json
import math
import os
import sys

import numpy as np

PY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PY_DIR)
sys.path.insert(0, os.path.join(PY_DIR, "scripts"))

from analysis.visibility import SUN_RADIUS_DEG, analyse, load_horizons, load_skyline  # noqa: E402
from export_site_json import ROOT, YEAR, _horizons_name, _skyline_path  # noqa: E402
from sites import MODEL_SITE, SITE_INFO, SITES  # noqa: E402

R_M = 1737400.0
EARTH_RADIUS_DEG = math.degrees(math.asin(6371.0 / 384400.0))   # about 0.95 deg at mean distance

# From the PDS labels: polar stereographic, 5058 x 5058 pixels of 60 m. LINE/SAMPLE_PROJECTION_OFFSET
# = 2528.5 = (5058 - 1) / 2, the 0-based centre of the image (same convention as make_skyline.py).
N = 5058
PX_M = 60.0
CENTER = 2528.5
SCALE = 0.00004              # stored number * SCALE = fraction of time visible (0 to 1)
RAW = os.path.join(ROOT, "data", "raw")
MAPS = {
    ("south", "sun"): os.path.join(RAW, "AVGVISIB_85S_060M_201608.IMG"),
    ("south", "earth"): os.path.join(RAW, "AVGVISIB_85S_060M_201608_EARTH.IMG"),
    ("north", "sun"): os.path.join(RAW, "AVGVISIB_85N_060M_201608.IMG"),
    ("north", "earth"): os.path.join(RAW, "AVGVISIB_85N_060M_201608_EARTH.IMG"),
}
SOURCE = "https://pgda.gsfc.nasa.gov/products/69"
AGREE_POINTS = 5.0           # within this many percentage points counts as agreeing
JSON_OUT = os.path.join(ROOT, "app", "public", "data", "crosscheck.json")
MD_OUT = os.path.join(ROOT, "docs", "crosscheck-pgda.md")


def to_pixel(lat, lon):
    """(row, col) on the map of the site's own pole. PDS polar stereographic:
    south  row = c - rho cos(lon) / px;  north  row = c + rho cos(lon) / px;  col = c + rho sin(lon) / px."""
    lo = math.radians(lon)
    if lat < 0:
        rho = 2 * R_M * math.tan(math.radians(90.0 + lat) / 2)
        return CENTER - rho * math.cos(lo) / PX_M, CENTER + rho * math.sin(lo) / PX_M
    rho = 2 * R_M * math.tan(math.radians(90.0 - lat) / 2)
    return CENTER + rho * math.cos(lo) / PX_M, CENTER + rho * math.sin(lo) / PX_M


def load_map(path):
    if not os.path.exists(path) or os.path.getsize(path) != N * N * 2:
        return None
    return np.memmap(path, dtype="<i2", mode="r", shape=(N, N))


def sample(grid, lat, lon):
    """{"at": value at the site, "min"/"max": lowest and highest within one pixel (about 60 m)}, percent."""
    row, col = to_pixel(lat, lon)
    r, c = int(round(row)), int(round(col))
    if not (2 <= r < N - 2 and 2 <= c < N - 2):
        return None
    r0, c0 = int(math.floor(row)), int(math.floor(col))
    fr, fc = row - r0, col - c0
    g = grid[r0:r0 + 2, c0:c0 + 2].astype(float)
    at = (g[0, 0] * (1 - fr) * (1 - fc) + g[0, 1] * (1 - fr) * fc
          + g[1, 0] * fr * (1 - fc) + g[1, 1] * fr * fc)
    near = grid[r - 1:r + 2, c - 1:c + 2].astype(float)
    pct = 100 * SCALE
    return {"at": round(at * pct, 1), "min": round(near.min() * pct, 1), "max": round(near.max() * pct, 1)}


def ours(site):
    """Our one-year percentages with NASA's rule (any part of the disc): {"sun": .., "earth": ..}."""
    rows = analyse(load_horizons(os.path.join(ROOT, "data", _horizons_name(site, YEAR))),
                   load_skyline(_skyline_path(site)))
    n = len(rows)
    return {
        "sun": round(100 * sum(r["sun_margin_deg"] > -SUN_RADIUS_DEG for r in rows) / n, 1),
        "earth": round(100 * sum(r["earth_margin_deg"] > -EARTH_RADIUS_DEG for r in rows) / n, 1),
    }


def verdict(mine, nasa):
    """"agrees", "agrees_within_60m" (only somewhere within 60 m: landing accuracy matters) or "differs"."""
    if abs(mine - nasa["at"]) <= AGREE_POINTS:
        return "agrees"
    if nasa["min"] - AGREE_POINTS <= mine <= nasa["max"] + AGREE_POINTS:
        return "agrees_within_60m"
    return "differs"


def check_site(site, grids):
    lat, lon = SITES[site]
    pole = "south" if lat < 0 else "north"
    if grids[(pole, "sun")] is None or grids[(pole, "earth")] is None:
        return None
    nasa = {body: sample(grids[(pole, body)], lat, lon) for body in ("sun", "earth")}
    if nasa["sun"] is None:
        return None   # outside the 85-90 deg map
    mine = ours(site)
    return {
        "pole": pole,
        "ours": mine,
        "nasa": nasa,
        "diff": {b: round(mine[b] - nasa[b]["at"], 1) for b in ("sun", "earth")},
        "verdict": {b: verdict(mine[b], nasa[b]) for b in ("sun", "earth")},
    }


def neighbourhood(grid, lat, lon, half=2):
    row, col = to_pixel(lat, lon)
    r, c = int(round(row)), int(round(col))
    return (grid[r - half:r + half + 1, c - half:c + half + 1].astype(float) * 100 * SCALE).round(0).tolist()


def main():
    grids = {key: load_map(path) for key, path in MAPS.items()}
    missing = [os.path.basename(p) for k, p in MAPS.items() if grids[k] is None]
    if missing:
        print("missing NASA maps (those poles are skipped):", ", ".join(missing))
    results = {}
    for site in SITES:
        res = check_site(site, grids)
        if res:
            results[site] = res

    sun_d = [r["diff"]["sun"] for r in results.values()]
    earth_d = [r["diff"]["earth"] for r in results.values()]
    lat, lon = SITES[MODEL_SITE]
    payload = {
        "source": SOURCE,
        "reference": "Mazarico, E., et al. (2011), Illumination conditions of the lunar polar regions using LOLA "
                     "topography, Icarus 211, 1066-1081",
        "method": "Our one-year (2026-27) percentages against NASA GSFC's 18.6-year average Sun and Earth visibility "
                  "maps (LOLA, 60 m per pixel). Both count the Sun or Earth as visible when any part of its disc "
                  f"shows. 'Agrees' = within {AGREE_POINTS:g} percentage points at the site; 'agrees within 60 m' = "
                  "NASA's value matches ours only somewhere within one 60 m pixel, so the answer depends on landing "
                  "within about 60 m of the point.",
        "agree_points": AGREE_POINTS,
        "summary": {
            "sites": len(results),
            "sun_mean_diff": round(float(np.mean(sun_d)), 1) if sun_d else None,
            "earth_mean_diff": round(float(np.mean(earth_d)), 1) if earth_d else None,
            "sun_mean_abs_diff": round(float(np.mean(np.abs(sun_d))), 1) if sun_d else None,
            "earth_mean_abs_diff": round(float(np.mean(np.abs(earth_d))), 1) if earth_d else None,
        },
        "sites": results,
        "model_site_neighbourhood": {
            "site": MODEL_SITE, "pixel_m": PX_M,
            "sun_pct": neighbourhood(grids[("south", "sun")], lat, lon),
        } if grids[("south", "sun")] is not None else None,
    }
    with open(JSON_OUT, "w") as f:
        json.dump(payload, f, indent=1)

    words = {"agrees": "agrees", "agrees_within_60m": "agrees within 60 m", "differs": "DIFFERS"}
    rng = lambda n: f"{n['at']:.0f}% ({n['min']:.0f}–{n['max']:.0f})"  # noqa: E731
    out = [
        "# Cross-check against NASA's published illumination maps (issue #1)",
        "",
        "Made by `app/python/scripts/crosscheck_pgda.py` (the website shows the same numbers from",
        "`app/public/data/crosscheck.json`). Our one-year numbers (2026-27, terrain from LOLA, positions",
        "from JPL Horizons) against NASA GSFC's average Sun and Earth visibility maps (Mazarico et al. 2011,",
        f"LOLA, 60 m/pixel, 18.6-year average): {SOURCE}",
        "",
        "Both sides count the Sun (or Earth) as visible when any part of its disc shows. NASA's column",
        "gives the value at the site and, in brackets, the lowest and highest within about 60 m.",
        "",
        "| Site | Pole | Sun: ours | Sun: NASA | | Earth: ours | Earth: NASA | |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for site, r in results.items():
        name = SITE_INFO.get(site, (site,))[0]
        out.append(f"| {name} | {r['pole']} | {r['ours']['sun']:.0f}% | {rng(r['nasa']['sun'])} | "
                   f"{words[r['verdict']['sun']]} | {r['ours']['earth']:.0f}% | {rng(r['nasa']['earth'])} | "
                   f"{words[r['verdict']['earth']]} |")
    s = payload["summary"]
    out += [
        "",
        f"Sites compared: {s['sites']} (every curated site inside 85-90 deg at either pole).",
        f"Sun, ours minus NASA: mean {s['sun_mean_diff']:+.1f} points (mean size {s['sun_mean_abs_diff']:.1f}).",
        f"Earth, ours minus NASA: mean {s['earth_mean_diff']:+.1f} points (mean size {s['earth_mean_abs_diff']:.1f}).",
        "",
        "Expected differences: one year against 18.6 years, our terrain (20-40 m south, about 237 m for the",
        "whole-Moon map used at the north pole) against their 60 m, and ridge-top sites where the value",
        "changes fast within one 60 m pixel (see the bracketed range).",
        "",
        "Not in NASA's 85-90 deg maps: Malapert (outside the square map) and all non-polar sites.",
    ]
    nb = payload["model_site_neighbourhood"]
    if nb:
        out += ["", f"## Around the model site ({SITE_INFO[MODEL_SITE][0]})", "",
                "NASA's Sun percentage in a 5 x 5 block of 60 m pixels, the site in the middle (bold):", "",
                "| " + " | ".join(" " for _ in range(5)) + " |", "|" + "---|" * 5]
        for i, line in enumerate(nb["sun_pct"]):
            out.append("| " + " | ".join(f"**{v:.0f}**" if (i, j) == (2, 2) else f"{v:.0f}"
                                         for j, v in enumerate(line)) + " |")
    with open(MD_OUT, "w") as f:
        f.write("\n".join(out) + "\n")
    print("\n".join(out))


if __name__ == "__main__":
    main()
