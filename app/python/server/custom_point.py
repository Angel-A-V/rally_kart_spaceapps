"""Analyse any point on the Moon that someone types in (GitHub issue #17).

Same calculation as the curated sites, done on request instead of ahead of time:
  1. Ask NASA JPL Horizons for the Sun and Earth directions from the point
     (30 days hourly for the scenarios, 365 days 6-hourly for the yearly planning).
  2. Get a skyline: from NASA LOLA terrain if a terrain map covers the point and is
     downloaded, otherwise a FLAT horizon (0 deg everywhere), clearly labelled.
  3. Build the page's JSON with the same builder the curated sites use
     (scripts/export_site_json.py: assemble_payload, index_entry).

Answers are cached in data/custom/ (git-ignored), so asking again is instant and works offline.
No web code in here: server/app.py is the thin Flask layer on top.
"""
import datetime as dt
import json
import math
import os
import sys

PY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/python
sys.path.insert(0, PY_DIR)
sys.path.insert(0, os.path.join(PY_DIR, "scripts"))

from export_site_json import MONTH, ROOT, START, YEAR, assemble_payload, index_entry  # noqa: E402
from fetch_horizons import fetch_rows  # noqa: E402

CACHE_DIR = os.path.join(ROOT, "data", "custom")
CACHE_VERSION = 2          # bump when the payload shape or the analysis changes, to ignore old answers
R_KM = 1737.4
NEAR_KM = 35.0             # same look-out distances as make_skyline.py
BAND_REACH_KM = 50.0       # the cut-down 20 m band covers this far from the pole
WIDE_REACH_KM = 303.0      # the 40 m map (LDEM_80S_40M) covers about 304 km from the pole


class BadInput(ValueError):
    """The coordinates cannot be used (not numbers, or out of range)."""


def normalise(lat, lon):
    """Check and tidy typed-in coordinates. Returns (lat, east_lon) rounded to 0.001 deg (about 30 m).

    Latitude: -90 (south pole) to 90. Longitude: any value, east positive; -45 becomes 315.
    """
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        raise BadInput("latitude and longitude must be numbers") from None
    if not (math.isfinite(lat) and math.isfinite(lon)):
        raise BadInput("latitude and longitude must be finite numbers")
    if not -90.0 <= lat <= 90.0:
        raise BadInput("latitude must be between -90 and 90")
    lat = round(lat, 3)
    lon = round(lon % 360.0, 3) % 360.0   # second % turns 359.9996 -> 360.0 back into 0.0
    return lat, lon


def point_id(lat, lon):
    """A stable id that is safe in HTML and file names, e.g. custom_s89_781_e203_743."""
    ns = "s" if lat < 0 else "n"
    return f"custom_{ns}{abs(lat):.3f}_e{lon:.3f}".replace(".", "_")


def pole_distance_km(lat):
    return 2 * R_KM * math.tan(math.radians(90.0 + lat) / 2)


def terrain_plan(lat, band_present, wide_present, global_present=False):
    """Which terrain map gives this point a real skyline? "85S_20M", "80S_40M", "LDEM_128" or None.

    Finest map first. The south-polar maps (20 m and 40 m per pixel) are used when they cover the
    point plus its look-out (same rule as scripts/sites.py). Everywhere else, the whole-Moon map
    LDEM_128 (about 237 m per pixel). None only when no suitable map is downloaded: flat horizon.
    """
    if lat <= 0 and wide_present:   # the polar far field always needs the 40 m map
        km = pole_distance_km(lat)
        if band_present and km + NEAR_KM <= BAND_REACH_KM:
            return "85S_20M"
        if km + NEAR_KM <= WIDE_REACH_KM:
            return "80S_40M"
    return "LDEM_128" if global_present else None


def _terrain_files_present():
    """(band, wide, global): which terrain maps are downloaded? Never downloads anything."""
    try:
        import make_skyline as ms  # needs numpy
    except ImportError:
        return False, False, False
    band = os.path.exists(ms.RAW) and os.path.getsize(ms.RAW) == ms.BAND_ROWS * ms.N * 2
    g = ms.GRIDS["80S_40M"]
    wide = os.path.exists(g.path) and os.path.getsize(g.path) == g.n * g.n * 2
    return band, wide, ms.global_present()


def get_skyline(lat, lon):
    """Returns (skyline, site_height_m, terrain_info_or_None).

    terrain_info is None for a flat horizon. A flat horizon puts the site at height 0
    (the 1737.4 km reference sphere), which shifts Horizons' angles by far less than 0.01 deg.
    """
    grid = terrain_plan(lat, *_terrain_files_present())
    if grid is None:
        return [0.0] * 360, 0.0, None
    import make_skyline as ms
    if grid == "LDEM_128":
        profile, h_site, info = ms.global_site_skyline(lat, lon)
    else:
        profile, h_site, info = ms.site_skyline(grid, lat, lon)
    terrain = {
        "site_height_m": round(h_site, 1),
        "near_map": info["near_map"],
        "near_range_km": info["near_range_km"],
        "far_map": info["far_map"],
        "far_range_km": round(info["far_range_km"], 1),
        "far_range_limited_by_map_edge": info["far_range_limited_by_map_edge"],
    }
    return [el for _, el in profile], h_site, terrain


def _span(cfg):
    stop = dt.date.fromisoformat(START) + dt.timedelta(days=cfg["days"])
    return START, stop.isoformat(), f"{cfg['step_hours']:g} h"


def _describe(lat, lon, terrain):
    where = f"{pole_distance_km(lat):.0f} km from the south pole" if lat < 0 else "in the northern hemisphere"
    if terrain is None:
        return (f"A point chosen by you ({where}). No downloaded terrain map covers this point, so the "
                "horizon is treated as FLAT (0 deg everywhere). Real terrain can change the answer either way: "
                "hills and crater walls block more, while a high peak sees below 0 deg and gets more Sun.")
    detail = ("the whole-Moon map, about 237 m per pixel" if terrain["near_map"] == "LDEM_128"
              else "the south-polar maps, 20 to 40 m per pixel")
    return (f"A point chosen by you ({where}). Skyline built on request from NASA LOLA terrain "
            f"({detail}), the same way as the curated sites.")


def build(lat, lon, fetch=fetch_rows, skyline_fn=get_skyline):
    """Analyse one point. Returns {"site": <index entry>, "analysis": <page payload>}.

    fetch and skyline_fn can be swapped out in tests so they run offline.
    """
    lat, lon = normalise(lat, lon)
    sid = point_id(lat, lon)
    skyline, height_m, terrain = skyline_fn(lat, lon)
    month_raw, month_urls = fetch(lat, lon, height_m, *_span(MONTH))
    year_raw, year_urls = fetch(lat, lon, height_m, *_span(YEAR))

    label = f"Custom point {lat:.3f}°, {lon:.3f}° E"
    description = _describe(lat, lon, terrain)
    source = "Chosen on this page (clicked on the 3D Moon or typed in)"
    analysis = assemble_payload(
        sid, label, description, lat, lon, skyline, month_raw, year_raw,
        coordinate_source=source,
        terrain=terrain,
        sources={
            "horizons_queries": {"30d": month_urls, "year": year_urls},
            "skyline": "LOLA terrain, computed on request" if terrain else "flat horizon (no terrain map)",
        },
    )
    analysis["horizon"] = "terrain" if terrain else "flat"
    analysis["retrieved_utc"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    site = index_entry(sid, label, description, lat, lon,
                       site_height_m=round(height_m, 1), coordinate_source=source,
                       year=analysis["year"])
    site["horizon"] = analysis["horizon"]
    return {"site": site, "analysis": analysis}


def _map_used(result):
    """Which terrain map a saved answer was built with ("85S_20M", "80S_40M", "LDEM_128" or None = flat)."""
    terrain = result["analysis"]["terrain"]
    return terrain["near_map"] if terrain else None


def cached_build(lat, lon, cache_dir=CACHE_DIR, map_now=None, **kwargs):
    """build(), but reuse a saved answer for the same point. Saves new answers.

    A saved answer is reused only if it was built with the map that would be used now, so
    downloading a terrain map later upgrades old flat-horizon answers automatically.
    map_now: which map would be used now (tests pass it; normally worked out from data/raw/).
    """
    lat, lon = normalise(lat, lon)
    path = os.path.join(cache_dir, point_id(lat, lon) + ".json")
    if os.path.exists(path):
        with open(path) as f:
            saved = json.load(f)
        if map_now is None and "skyline_fn" not in kwargs:
            map_now = terrain_plan(lat, *_terrain_files_present())
        if saved.get("cache_version") == CACHE_VERSION and _map_used(saved["result"]) == map_now:
            return saved["result"]
    result = build(lat, lon, **kwargs)
    os.makedirs(cache_dir, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"cache_version": CACHE_VERSION, "result": result}, f)
    os.replace(tmp, path)   # a half-written file never looks like a finished answer
    return result
