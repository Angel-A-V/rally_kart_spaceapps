#!/usr/bin/env python3
"""Fetch the Sun's and Earth's direction (azimuth, elevation) as seen from a Moon site.

Asks NASA JPL Horizons, standing at a point on the Moon's surface. Horizons does the
whole frame chain for us (space -> Moon-fixed incl. libration -> local east/north/up).
Results are cached in data/ so the demo works offline. No third-party packages needed.

Azimuth: compass direction, 0 = north, 90 = east. Elevation: angle above the flat
horizon (negative = below). No atmosphere on the Moon, so no refraction (AIRLESS).

Run:  python3 scripts/fetch_horizons.py                        (30 days, hourly)
      python3 scripts/fetch_horizons.py --days 365 --step "6 h"  (a full year)
"""
import argparse
import csv
import datetime as dt
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

from sites import SITE_HEIGHT_M, SITES

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
BODIES = {"sun": "10", "earth": "399"}
# Repo root (four levels up from this file): the shared data/ folder lives there.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def build_params(body_id, lat, lon_east, height_m, start, stop, step):
    """The exact Horizons query. Saved next to the data for anyone who wants to re-run it."""
    return {
        "format": "json",
        "COMMAND": f"'{body_id}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",            # observer on the Moon (body 301)
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon_east},{lat},{height_m / 1000:.4f}'",  # east lon, lat, km
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": "'4'",                # 4 = azimuth and elevation
        "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'",            # no atmosphere on the Moon
        "CSV_FORMAT": "'YES'",
    }


def parse_result(text):
    """Pull (time, az, el) rows out of the Horizons text between $$SOE and $$EOE."""
    if "$$SOE" not in text:
        raise ValueError("Horizons reply has no data block:\n" + text[:800])
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    rows = []
    for line in block.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        rows.append((parts[0], float(parts[3]), float(parts[4])))
    return rows


def query(params, retries=2, pause_s=3.0):
    """One Horizons request. Returns (reply text, the exact URL asked).

    Retries only when Horizons says it is busy (HTTP 500 = database unavailable,
    503 = overloaded or maintenance; see docs/software-architecture.md section 5d).
    Input mistakes come back as HTTP 200 with an "error" field, so check for that too.
    """
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code not in (500, 503) or attempt == retries:
                raise
            time.sleep(pause_s)
    if "error" in data:
        raise RuntimeError(f"Horizons error: {data['error']}")
    if "result" not in data:
        raise RuntimeError(f"Horizons error: {data}")
    return data["result"], url


def fetch_rows(lat, lon_east, height_m, start, stop, step):
    """Ask Horizons for the Sun and the Earth as seen from (lat, lon_east, height_m).

    Returns (rows, urls). rows: list of dicts with the same keys as
    analysis.visibility.load_horizons() gives, so the analysis cannot tell them apart.
    urls: {"sun": ..., "earth": ...}, the exact queries (for the data-sources panel).
    """
    series, urls = {}, {}
    for name, body in BODIES.items():
        text, urls[name] = query(build_params(body, lat, lon_east, height_m, start, stop, step))
        series[name] = parse_result(text)
    sun, earth = series["sun"], series["earth"]
    if [r[0] for r in sun] != [r[0] for r in earth]:
        raise RuntimeError("Horizons returned different times for the Sun and the Earth")
    rows = [
        {"time_utc": t, "sun_az_deg": saz, "sun_el_deg": sel, "earth_az_deg": eaz, "earth_el_deg": eel}
        for (t, saz, sel), (_, eaz, eel) in zip(sun, earth)
    ]
    return rows, urls


def write_csv(path, rows):
    """Save rows in the cached-CSV format that analysis.visibility.load_horizons() reads."""
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time_utc", "sun_az_deg", "sun_el_deg", "earth_az_deg", "earth_el_deg"])
        for r in rows:
            w.writerow([r["time_utc"], f"{r['sun_az_deg']:.4f}", f"{r['sun_el_deg']:.4f}",
                        f"{r['earth_az_deg']:.4f}", f"{r['earth_el_deg']:.4f}"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="shackleton_rim", choices=SITES)
    ap.add_argument("--start", default="2026-11-10", help="UTC date, YYYY-MM-DD")
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--step", default="1 h", help='Horizons step, e.g. "1 h" or "6 h"')
    ap.add_argument("--refresh", action="store_true", help="ignore the cache")
    a = ap.parse_args()

    lat, lon = SITES[a.site]
    start = a.start
    stop = (dt.date.fromisoformat(a.start) + dt.timedelta(days=a.days)).isoformat()
    tag = f"{a.site}_{a.start}_{a.days}d_{a.step.replace(' ', '')}"
    out_csv = os.path.join(ROOT, "data", f"horizons_{tag}.csv")
    out_meta = os.path.join(ROOT, "data", f"horizons_{tag}.meta.json")
    if os.path.exists(out_csv) and not a.refresh:
        print("cached:", out_csv)
        return

    rows, urls = fetch_rows(lat, lon, SITE_HEIGHT_M[a.site], start, stop, a.step)
    os.makedirs(os.path.dirname(out_csv), exist_ok=True)
    write_csv(out_csv, rows)
    meta = {
        "site": a.site, "lat_deg": lat, "lon_deg_east": lon,
        "site_height_m": SITE_HEIGHT_M[a.site],
        "start_utc": start, "stop_utc": stop, "step": a.step, "rows": len(rows),
        "source": "NASA JPL Horizons API (ssd.jpl.nasa.gov), ephemeris DE441, "
                  "Moon orientation MEAN_ME high precision (includes libration)",
        "azimuth": "0 = north, 90 = east",
        "retrieved_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "queries": urls,
    }
    with open(out_meta, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"wrote {out_csv} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
