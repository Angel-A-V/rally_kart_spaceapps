"""Combine the cached Horizons tables and skylines into the JSON files the web page reads.

Run from app/python:  python3 scripts/export_site_json.py
Writes into app/public/data/:
  sites.json              one entry per site (name, position, yearly statistics)
  <site>_analysis.json    one file per site: the 30-day hourly rows, skyline, yearly statistics,
                          and the planning data (windows over the year, best mission starts)
"""
import json
import math
import os
import sys

PY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/python
APP_DIR = os.path.dirname(PY_DIR)                                      # app
ROOT = os.path.dirname(APP_DIR)                                        # repo root (shared data/ lives here)
sys.path.insert(0, PY_DIR)
sys.path.insert(0, os.path.join(PY_DIR, "scripts"))

from analysis.events import annotate_events  # noqa: E402
from analysis.visibility import (  # noqa: E402
    DEFAULT_SETTINGS, SUN_RADIUS_DEG, analyse, load_horizons, load_skyline, summarise, thresholds,
)
from analysis.windows import best_mission_windows, find_windows, month_starts, window_stats  # noqa: E402
from sites import MODEL_SITE, SITE_INFO, SITE_SOURCE, SITES, SKYLINE_FILE  # noqa: E402

START = "2026-11-10"
MONTH = {"days": 30, "step": "1h", "step_hours": 1.0}   # the slider data
YEAR = {"days": 365, "step": "6h", "step_hours": 6.0}   # the yearly statistics and planning
MISSION_DAYS = (7, 14, 30)                              # mission lengths offered on the page
TOP_STARTS = 5
OUT_DIR = os.path.join(APP_DIR, "public", "data")


def _horizons_name(site, cfg):
    return f"horizons_{site}_{START}_{cfg['days']}d_{cfg['step']}.csv"


def _round(obj, digits):
    """Round every float in a dict so the JSON files stay small."""
    return {k: (round(v, digits) if isinstance(v, float) else v) for k, v in obj.items()}


def _skyline_path(site):
    return os.path.join(ROOT, "data", SKYLINE_FILE[site])


def _terrain(site):
    """Which terrain maps the skyline came from and how far out it looked (from its meta file)."""
    with open(_skyline_path(site)[:-4] + ".meta.json") as f:
        meta = json.load(f)
    return {
        "site_height_m": round(meta["site_height_m_above_1737.4km_sphere"], 1),
        "near_map": meta["near_map"],
        "near_range_km": meta["near_range_km"],
        "far_map": meta["far_map"],
        "far_range_km": round(meta["far_range_km"], 1),
        "far_range_limited_by_map_edge": meta["far_range_limited_by_map_edge"],
    }


def _queries(site, cfg):
    """The exact Horizons query URLs used for a cached table ({"sun": url, "earth": url})."""
    path = os.path.join(ROOT, "data", _horizons_name(site, cfg)[:-4] + ".meta.json")
    with open(path) as f:
        return json.load(f)["queries"]


def _pole_distance_km(lat):
    """Distance along the surface from the SOUTH pole, in km (arc length), for display.
    (Not the polar-map formula 2R tan(...), which is only right close to the pole.)"""
    return round(1737.4 * math.radians(90.0 + lat), 1)


def _year_rows(site, skyline):
    return analyse(load_horizons(os.path.join(ROOT, "data", _horizons_name(site, YEAR))), skyline)


def _plan(year_rows):
    """Planning data from the yearly rows: when the windows are, and the best mission starts."""
    step = YEAR["step_hours"]
    return {
        "year_start_utc": year_rows[0]["time_utc"],
        "year_end_utc": year_rows[-1]["time_utc"],
        "samples": len(year_rows),
        "step_hours": step,
        "months": month_starts(year_rows),
        "windows": {
            "sun": find_windows(year_rows, "sun_visible", True, step),
            "earth": find_windows(year_rows, "earth_visible", True, step),
            "both": find_windows(year_rows, "both_visible", True, step),
        },
        "best_starts": {
            str(days): [_round(w, 1) for w in best_mission_windows(year_rows, days, step, TOP_STARTS)]
            for days in MISSION_DAYS
        },
    }


def resolved_settings(settings=None):
    """The full settings used, written into every payload so the page can say what "visible" meant."""
    s = {**DEFAULT_SETTINGS, **(settings or {})}
    thresholds(s)   # checks the values
    return {"sun_rule": s["sun_rule"], "earth_margin_deg": float(s["earth_margin_deg"]),
            "sun_radius_deg": SUN_RADIUS_DEG}


def assemble_payload(site, label, description, lat, lon, skyline, month_raw, year_raw,
                     coordinate_source, terrain, sources, is_model_site=False, settings=None):
    """Everything the page needs for one place, from raw inputs.

    Pure: data in, dict out. Used for the curated sites (below) and for typed-in
    coordinates (app/python/server/custom_point.py), so both give the page the same shape.
    month_raw / year_raw: Horizons rows (30 days hourly / 365 days 6-hourly).
    skyline: 360 angles, index = whole-degree azimuth.
    settings: Sun rule and Earth margin (analysis.visibility.thresholds); default = Sun as a point,
    no Earth margin. The page can re-apply other settings to the 30-day rows itself.
    """
    month_rows = analyse(month_raw, skyline, settings)
    year_rows = analyse(year_raw, skyline, settings)
    return {
        "site": site,
        "label": label,
        "description": description,
        "lat_deg": lat,
        "lon_deg_east": lon,
        "pole_distance_km": _pole_distance_km(lat),
        "is_model_site": is_model_site,
        "coordinate_source": coordinate_source,
        "terrain": terrain,
        "sources": sources,
        "summary": _round(summarise(month_rows), 1),
        "year": _round(window_stats(year_rows, YEAR["step_hours"]), 1),
        "plan": _plan(year_rows),
        "settings": resolved_settings(settings),
        "skyline_deg": [round(v, 3) for v in skyline],  # index = whole-degree azimuth
        "rows": [_round(r, 4) for r in annotate_events(month_rows, MONTH["step_hours"], settings)],
    }


def index_entry(site, label, description, lat, lon, site_height_m, coordinate_source, year,
                is_model_site=False):
    """One line of the sites index (what the pickers, the globe and the yearly table read)."""
    return {
        "id": site,
        "label": label,
        "description": description,
        "lat_deg": lat,
        "lon_deg_east": lon,
        "pole_distance_km": _pole_distance_km(lat),
        "site_height_m": site_height_m,
        "is_model_site": is_model_site,
        "coordinate_source": coordinate_source,
        "year": year,
    }


def build_site_payload(site):
    """Everything the page needs for one curated site (read from the cached files)."""
    label, description = SITE_INFO[site]
    lat, lon = SITES[site]
    return assemble_payload(
        site, label, description, lat, lon,
        skyline=load_skyline(_skyline_path(site)),
        month_raw=load_horizons(os.path.join(ROOT, "data", _horizons_name(site, MONTH))),
        year_raw=load_horizons(os.path.join(ROOT, "data", _horizons_name(site, YEAR))),
        coordinate_source=SITE_SOURCE[site],
        terrain=_terrain(site),
        sources={
            "horizons_30d": _horizons_name(site, MONTH),
            "horizons_year": _horizons_name(site, YEAR),
            "skyline": SKYLINE_FILE[site],
            # The exact Horizons queries, from the .meta.json saved next to each cached table (#6).
            "horizons_queries": {"30d": _queries(site, MONTH), "year": _queries(site, YEAR)},
        },
        is_model_site=site == MODEL_SITE,
    )


def build_sites_index():
    """A short list of every site with its yearly statistics, for the site pickers."""
    index = []
    for site in SITES:
        skyline = load_skyline(_skyline_path(site))
        label, description = SITE_INFO[site]
        lat, lon = SITES[site]
        index.append(index_entry(
            site, label, description, lat, lon,
            site_height_m=_terrain(site)["site_height_m"],
            coordinate_source=SITE_SOURCE[site],
            year=_round(window_stats(_year_rows(site, skyline), YEAR["step_hours"]), 1),
            is_model_site=site == MODEL_SITE,
        ))
    return index


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "sites.json"), "w") as f:
        json.dump(build_sites_index(), f)
    print("wrote sites.json")
    for site in SITES:
        payload = build_site_payload(site)
        path = os.path.join(OUT_DIR, f"{site}_analysis.json")
        with open(path, "w") as f:
            json.dump(payload, f)
        y = payload["year"]
        best = payload["plan"]["best_starts"]["14"]
        top = f"{best[0]['start_time_utc']} ({best[0]['both_pct']}% both)" if best else "none"
        print(f"wrote {os.path.basename(path)}: year Sun {y['sun_visible_days']} d in {y['sun_window_count']} windows, "
              f"Earth {y['earth_visible_days']} d in {y['earth_window_count']} windows; best 14-day start {top}")


if __name__ == "__main__":
    main()
