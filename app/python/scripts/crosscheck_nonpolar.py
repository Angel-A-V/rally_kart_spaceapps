"""Independent checks for the sites that NASA's polar illumination maps do not cover (issue #1).

Three checks, each against a source that is not our own pipeline:

1. APOLLO RECORDS. The Apollo Lunar Surface Journal (NASA) lists the Sun's and Earth's altitude and
   azimuth at every Apollo landing, EVA start/end and liftoff (computed by Jim Scotti and Paul Fjeld,
   independently of each other). We ask JPL Horizons the same question for OUR site coordinates at
   those exact times. This checks our coordinates, our Horizons request and our angle conventions.
   (They spot-checked with Horizons too, so the ephemeris itself is not fully independent.)
   Data: data/apollo_sun_earth_alsj.json, copied from
   https://www.apollojournals.org/alsj/alsj-EarthSun_AltAz.html

2. PHYSICS. Simple rules our numbers must obey, worked out by hand rather than by our pipeline:
   - Earth hangs almost still in the lunar sky: its average altitude over a year is 90 deg minus the
     site's angular distance from the point facing Earth (0 N, 0 E), minus a tiny parallax term.
   - The Sun rises once per synodic month (29.53 days), so sunrises are 29.53 days apart on average.
   - Away from the poles the Sun is up half the time on a flat horizon; a skyline of h_rise degrees
     where the Sun rises and h_set where it sets costs (h_rise + h_set) / (360 cos(latitude)) of it.
   - Near side sites see Earth all the time; far side sites never do.

3. TERRAIN. NASA LROC NAC stereo terrain models (2-5 m per pixel, from camera images, a different
   instrument than the LOLA laser our skylines use) at the six Apollo sites. For every direction we
   walk outward to the edge of the LROC model and compare the steepest terrain angle with the one our
   whole-Moon LOLA map gives over the same distance. (LROC models are tied to LOLA for absolute height,
   so the shapes are independent but the overall level is not.)
   Data: data/raw/lroc/NAC_DTM_APOLLO*.TIF and .LBL (0.01-0.75 GB each) from
   https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/

Run (from the repo root):  .venv/bin/python app/python/scripts/crosscheck_nonpolar.py
Writes app/public/data/checks.json (for the website), data/checks_detail.json (every direction of the
terrain comparison) and docs/crosscheck-nonpolar.md.
"""
import datetime as dt
import json
import math
import os
import re
import sys

import numpy as np

PY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PY_DIR)
sys.path.insert(0, os.path.join(PY_DIR, "scripts"))

import make_skyline as ms  # noqa: E402
from analysis.visibility import analyse, load_horizons, load_skyline, skyline_at  # noqa: E402
from export_site_json import ROOT, YEAR, _horizons_name, _skyline_path  # noqa: E402
from fetch_horizons import BODIES, build_params, parse_result, query  # noqa: E402
from sites import SITE_HEIGHT_M, SITE_INFO, SITES  # noqa: E402

R_M = 1737400.0
EARTH_MOON_KM = 384400.0
SYNODIC_DAYS = 29.530589
ALSJ_FILE = os.path.join(ROOT, "data", "apollo_sun_earth_alsj.json")
LROC_DIR = os.path.join(ROOT, "data", "raw", "lroc")
LROC_SOURCE = "https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/"
JSON_OUT = os.path.join(ROOT, "app", "public", "data", "checks.json")
DETAIL_OUT = os.path.join(ROOT, "data", "checks_detail.json")
MD_OUT = os.path.join(ROOT, "docs", "crosscheck-nonpolar.md")

APOLLO_TOL_DEG = 0.5      # the two ALSJ calculations agree with each other to 0.5 deg
EARTH_TOL_DEG = 1.0       # libration makes the yearly mean slightly lower than the formula
LUNAR_DAY_TOL_D = 0.1
SUN_TOL_POINTS = 1.5


def ang_diff(a, b):
    """a - b for angles in degrees, in -180..180."""
    return (a - b + 180.0) % 360.0 - 180.0


def gc_km(lat1, lon1, lat2, lon2):
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    c = math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl)
    return R_M / 1000 * math.acos(max(-1.0, min(1.0, c)))


# ---------- 1. Apollo records ----------

def horizons_at(lat, lon, height_m, times):
    """Sun and Earth (az, el) from JPL Horizons at a list of exact UTC times (TLIST, Julian dates)."""
    jds = [t.replace(tzinfo=dt.timezone.utc).timestamp() / 86400 + 2440587.5 for t in times]
    out, urls = {}, {}
    for name, body in BODIES.items():
        p = build_params(body, lat, lon, height_m, "", "", "")
        for key in ("START_TIME", "STOP_TIME", "STEP_SIZE"):
            p.pop(key)
        p["TLIST"] = " ".join(f"'{jd:.8f}'" for jd in jds)
        p["TIME_TYPE"] = "'UT'"
        text, urls[name] = query(p)
        out[name] = [(az, el) for _, az, el in parse_result(text)]
        if len(out[name]) != len(times):
            raise RuntimeError(f"Horizons returned {len(out[name])} rows for {len(times)} times")
    return out, urls


def check_apollo():
    with open(ALSJ_FILE) as f:
        alsj = json.load(f)
    missions = []
    for m in alsj["missions"]:
        site = "apollo_" + m["mission"].split()[1]
        lat, lon = SITES[site]
        times = [dt.datetime.strptime(e["time_utc"], "%Y-%m-%d %H:%M:%S") for e in m["events"]]
        ours, urls = horizons_at(lat, lon, SITE_HEIGHT_M.get(site, 0.0), times)
        events = []
        for i, e in enumerate(m["events"]):
            (saz, sel), (eaz, eel) = ours["sun"][i], ours["earth"][i]
            events.append({
                "event": e["event"], "time_utc": e["time_utc"],
                "ours": {"sun_alt": round(sel, 2), "sun_az": round(saz, 2),
                         "earth_alt": round(eel, 2), "earth_az": round(eaz, 2)},
                "nasa": {"sun_alt": e["sun_alt_deg"], "sun_az": e["sun_az_deg"],
                         "earth_alt": e["earth_alt_deg"], "earth_az": e["earth_az_deg"]},
                "diff": {"sun_alt": round(sel - e["sun_alt_deg"], 2), "sun_az": round(ang_diff(saz, e["sun_az_deg"]), 2),
                         "earth_alt": round(eel - e["earth_alt_deg"], 2),
                         "earth_az": round(ang_diff(eaz, e["earth_az_deg"]), 2)},
            })
        worst = {k: max(abs(ev["diff"][k]) for ev in events) for k in ("sun_alt", "sun_az", "earth_alt", "earth_az")}
        missions.append({
            "mission": m["mission"], "site": site,
            "coordinate_offset_km": round(gc_km(lat, lon, m["alsj_lat"], m["alsj_lon_east"]), 2),
            "events": events, "max_abs_diff_deg": worst,
            "agrees": all(v <= APOLLO_TOL_DEG for v in worst.values()),
            "horizons_queries": urls,
        })
    every = [abs(ev["diff"][k]) for m in missions for ev in m["events"] for k in ev["diff"]]
    return {
        "source": alsj["source"], "title": alsj["title"], "computed_by": alsj["computed_by"],
        "tolerance_deg": APOLLO_TOL_DEG, "missions": missions,
        "summary": {"events": sum(len(m["events"]) for m in missions), "max_abs_diff_deg": round(max(every), 2),
                    "mean_abs_diff_deg": round(float(np.mean(every)), 3)},
    }


# ---------- 2. Physics ----------

def _rises(rows):
    """Times (days from the first row) where the Sun's margin crosses 0 upward, by straight-line estimate."""
    t0 = dt.datetime.strptime(rows[0]["time_utc"], "%Y-%b-%d %H:%M")
    out = []
    for a, b in zip(rows, rows[1:]):
        if a["sun_margin_deg"] <= 0 < b["sun_margin_deg"]:
            ta = (dt.datetime.strptime(a["time_utc"], "%Y-%b-%d %H:%M") - t0).total_seconds() / 86400
            tb = (dt.datetime.strptime(b["time_utc"], "%Y-%b-%d %H:%M") - t0).total_seconds() / 86400
            f = -a["sun_margin_deg"] / (b["sun_margin_deg"] - a["sun_margin_deg"])
            out.append(ta + f * (tb - ta))
    return out


def check_physics(site):
    lat, lon = SITES[site]
    skyline = load_skyline(_skyline_path(site))
    rows = analyse(load_horizons(os.path.join(ROOT, "data", _horizons_name(site, YEAR))), skyline)
    n = len(rows)
    checks = []
    # Earth's mean altitude
    d = math.degrees(math.acos(math.cos(math.radians(lat)) * math.cos(math.radians(lon))))
    expected = 90.0 - d - math.degrees(R_M / 1000 / EARTH_MOON_KM * math.sin(math.radians(d)))
    # Average Earth's DIRECTION (unit vectors), then take its altitude. Averaging the altitude itself
    # would be biased low near the Earth-facing point, where Earth circles around the zenith.
    az = np.radians([r["earth_az_deg"] for r in rows])
    el = np.radians([r["earth_el_deg"] for r in rows])
    v = np.array([np.cos(el) * np.sin(az), np.cos(el) * np.cos(az), np.sin(el)]).mean(axis=1)
    mean_el = float(np.degrees(np.arcsin(v[2] / np.linalg.norm(v))))
    checks.append({
        "id": "earth_altitude", "name": "Earth's average altitude",
        "rule": f"90° minus the distance from the Earth-facing point ({d:.1f}°)",
        "expected": round(expected, 2), "ours": round(mean_el, 2), "unit": "°",
        "ok": abs(mean_el - expected) <= EARTH_TOL_DEG, "tolerance": EARTH_TOL_DEG,
    })
    # Earth visible share: near side always, far side never
    earth_pct = 100 * sum(r["earth_visible"] for r in rows) / n
    if d <= 75 or d >= 105:
        want = 100.0 if d <= 75 else 0.0
        checks.append({
            "id": "earth_share", "name": "Earth visible",
            "rule": "near side: always (Earth never moves more than about 8° in the sky)" if want
            else "far side: never",
            "expected": want, "ours": round(earth_pct, 1), "unit": "%", "ok": abs(earth_pct - want) <= 0.5,
            "tolerance": 0.5,
        })
    # Lunar day length
    rises = _rises(rows)
    if abs(lat) <= 60 and len(rises) >= 3:   # near the poles the Sun skims the horizon instead
        mean_gap = (rises[-1] - rises[0]) / (len(rises) - 1)
        checks.append({
            "id": "lunar_day", "name": "Time between sunrises",
            "rule": "one synodic month, 29.53 days",
            "expected": SYNODIC_DAYS, "ours": round(mean_gap, 3), "unit": " d",
            "ok": abs(mean_gap - SYNODIC_DAYS) <= LUNAR_DAY_TOL_D, "tolerance": LUNAR_DAY_TOL_D,
        })
    # Sun share from the skyline at sunrise and sunset (not near the poles, where the Sun skims the horizon)
    # Counted over whole lunar days only (first sunrise to last sunrise): the year of data holds 12.36
    # lunar days, and the leftover part-day would tip a plain yearly share by up to about 1.5 points.
    if abs(lat) <= 60 and len(rises) >= 3:
        h_rise, h_set = skyline_at(skyline, 90.0), skyline_at(skyline, 270.0)
        expected_sun = 50.0 - 100.0 * (h_rise + h_set) / (360.0 * math.cos(math.radians(lat)))
        step_d = 1.0 / 4                      # the yearly rows are 6 hours apart
        first, last = int(math.ceil(rises[0] / step_d)), int(math.floor(rises[-1] / step_d))
        whole = rows[first:last + 1]
        sun_pct = 100 * sum(r["sun_visible"] for r in whole) / len(whole)
        checks.append({
            "id": "sun_share", "name": "Sun visible (whole lunar days)",
            "rule": f"half the time, minus the skyline at sunrise ({h_rise:.1f}°) and sunset ({h_set:.1f}°)",
            "expected": round(expected_sun, 2), "ours": round(sun_pct, 2), "unit": "%",
            "ok": abs(sun_pct - expected_sun) <= SUN_TOL_POINTS, "tolerance": SUN_TOL_POINTS,
        })
    return {"distance_from_earth_facing_point_deg": round(d, 1), "checks": checks,
            "all_ok": all(c["ok"] for c in checks)}


# ---------- 3. Terrain (LROC stereo models at the Apollo sites) ----------

def read_label(path):
    text = open(path).read()
    get = lambda key: re.search(rf"^\s*{key}\s*=\s*([^\n<]+)", text, re.M).group(1).strip()  # noqa: E731
    image = re.search(r'\^IMAGE\s*=\s*\("([^"]+)",\s*(\d+)', text)
    return {
        "file": image.group(1), "label_offset": int(image.group(2)) - 1,   # PDS byte positions start at 1
        "lines": int(get("LINES")), "samples": int(get("LINE_SAMPLES")),
        "scale": float(get("MAP_SCALE")), "clat": float(get("CENTER_LATITUDE")),
        "clon": float(get("CENTER_LONGITUDE")),
        "loff": float(get("LINE_PROJECTION_OFFSET")), "soff": float(get("SAMPLE_PROJECTION_OFFSET")),
    }


def tiff_strips(path):
    """(strip byte offsets, rows per strip) of an uncompressed TIFF, from its own tags; None if compressed.
    More reliable than the PDS label: the Apollo 12 label points past the end of its file, and that
    file stores its first row last."""
    import struct
    with open(path, "rb") as f:
        head = f.read(8)
        bo = "<" if head[:2] == b"II" else ">"
        f.seek(struct.unpack(bo + "I", head[4:8])[0])
        tags = {}
        for _ in range(struct.unpack(bo + "H", f.read(2))[0]):
            tag, typ, cnt, val = struct.unpack(bo + "HHII", f.read(12))
            tags[tag] = (typ, cnt, val)
        if tags.get(259, (0, 0, 1))[2] != 1 or 273 not in tags:
            return None
        typ, cnt, val = tags[273]
        if cnt == 1:
            offsets = [val]
        else:
            f.seek(val)
            fmt = "I" if typ == 4 else "H"
            offsets = list(struct.unpack(bo + fmt * cnt, f.read(cnt * struct.calcsize(fmt))))
        rows_per_strip = tags[278][2] if 278 in tags else None
    return offsets, rows_per_strip


def open_dtm(mission_number):
    """The LROC model as a (lines, samples) float32 array (memory-mapped when its rows are back to back)."""
    lbl = os.path.join(LROC_DIR, f"NAC_DTM_APOLLO{mission_number}.LBL")
    if not os.path.exists(lbl):
        return None, None
    lab = read_label(lbl)
    path = os.path.join(LROC_DIR, lab["file"])
    strips = tiff_strips(path) if os.path.exists(path) else None
    if strips is None:
        return None, None
    offsets, rps = strips
    lines, samples = lab["lines"], lab["samples"]
    rps = rps or lines // len(offsets)
    strip_bytes = rps * samples * 4
    if max(offsets) + strip_bytes > os.path.getsize(path):
        return None, None                                  # incomplete download
    if all(b - a == strip_bytes for a, b in zip(offsets, offsets[1:])):
        lab["offset"] = offsets[0]
        grid = np.memmap(path, dtype="<f4", mode="r", offset=offsets[0], shape=(lines, samples))
    else:                                                  # strips out of order: read them one by one
        grid = np.empty((lines, samples), dtype="<f4")
        with open(path, "rb") as f:
            for i, off in enumerate(offsets):
                f.seek(off)
                rows = min(rps, lines - i * rps)
                grid[i * rps:i * rps + rows] = np.frombuffer(f.read(rows * samples * 4), dtype="<f4").reshape(rows, samples)
    return grid, lab


def dtm_pixel(lab, lat, lon):
    """Equirectangular (PDS): line = LOFF - y / scale, sample = SOFF + x / scale."""
    dlon = (np.asarray(lon) - lab["clon"] + 180.0) % 360.0 - 180.0
    x = R_M * np.radians(dlon) * math.cos(math.radians(lab["clat"]))
    y = R_M * np.radians(lat)
    return lab["loff"] - y / lab["scale"], lab["soff"] + x / lab["scale"]


def dtm_heights(grid, lab, lat, lon):
    """Bilinear heights (m); NaN outside the model or where it has no data."""
    row, col = dtm_pixel(lab, lat, lon)
    row, col = np.atleast_1d(row), np.atleast_1d(col)
    ok = (row >= 0) & (col >= 0) & (row < lab["lines"] - 1) & (col < lab["samples"] - 1)
    out = np.full(row.shape, np.nan)
    r0, c0 = np.floor(row[ok]).astype(int), np.floor(col[ok]).astype(int)
    fr, fc = row[ok] - r0, col[ok] - c0
    g = [grid[r0 + i, c0 + j].astype(float) for i in (0, 1) for j in (0, 1)]
    v = g[0] * (1 - fr) * (1 - fc) + g[1] * (1 - fr) * fc + g[2] * fr * (1 - fc) + g[3] * fr * fc
    bad = np.any([gi < -1e30 for gi in g], axis=0) | ~np.isfinite(v)
    v[bad] = np.nan
    out[ok] = v
    return out


def angles(heights, h_site, d):
    theta = d / R_M
    return np.degrees(np.arctan2((R_M + heights) * np.cos(theta) - (R_M + h_site), (R_M + heights) * np.sin(theta)))


NEAR_M = 250.0   # closer than about one whole-Moon-map pixel (237 m): boulders and small craters that map
                 # cannot show, and that a lander's solar panels sit above. Compared separately.


def check_terrain(site, step_m=10.0, max_km=40.0, min_reach_m=1000.0):
    number = site.split("_")[1]
    grid, lab = open_dtm(number)
    if grid is None:
        return None
    lat, lon = SITES[site]
    h_dtm = float(dtm_heights(grid, lab, lat, lon)[0])
    if not np.isfinite(h_dtm):
        return {"covered": False, "note": "the LROC model does not cover our site coordinate"}
    h_lola = ms.load_global()
    hr, hc = ms.to_pixel_global(np.array(lat), np.array(lon))
    h_site_lola = float(ms.sample_global(h_lola, hr, hc)) * ms.GLOBAL_SCALE
    skyline = load_skyline(_skyline_path(site))
    d = np.arange(step_m, max_km * 1000, step_m)
    d_far = np.arange(ms.GLOBAL_STEP_M, ms.FAR_CAP_KM * 1000, ms.GLOBAL_STEP_M)
    per_az = []
    for az in range(360):
        la2, lo2 = ms.destination(lat, lon, float(az), d)
        hd = dtm_heights(grid, lab, la2, lo2)
        bad = np.where(~np.isfinite(hd))[0]
        n = int(bad[0]) if len(bad) else len(d)
        if n * step_m < min_reach_m:
            continue
        far_part = d[:n] >= NEAR_M
        reach = d[:n][far_part]
        a_all = angles(hd[:n], h_dtm, d[:n])
        a_dtm = float(a_all[far_part].max())
        a_near = float(a_all[~far_part].max())
        r, c = ms.to_pixel_global(la2[:n][far_part], lo2[:n][far_part])
        a_lola = float(angles(ms.sample_global(h_lola, r, c) * ms.GLOBAL_SCALE, h_site_lola, reach).max())
        # Where along the full 250 km ray does our skyline's highest point sit? Inside the LROC model?
        lf, of = ms.destination(lat, lon, float(az), d_far)
        r, c = ms.to_pixel_global(lf, of)
        far = angles(ms.sample_global(h_lola, r, c) * ms.GLOBAL_SCALE, h_site_lola, d_far)
        far[d_far < NEAR_M] = -90.0
        at_km = float(d_far[int(np.argmax(far))] / 1000)
        per_az.append({"az": az, "reach_km": round(n * step_m / 1000, 2), "lroc_deg": round(a_dtm, 2),
                       "lola_deg": round(a_lola, 2), "lroc_near_deg": round(a_near, 2), "skyline_deg": round(skyline[az], 2),
                       "skyline_at_km": round(at_km, 1), "skyline_inside": bool(at_km <= n * step_m / 1000)})
    if not per_az:
        return {"covered": False, "note": "the LROC model is too small around our site to compare"}
    diff = np.array([p["lola_deg"] - p["lroc_deg"] for p in per_az])
    inside = [p for p in per_az if p["skyline_inside"]]
    inside_diff = np.array([p["skyline_deg"] - p["lroc_deg"] for p in inside]) if inside else np.array([])
    corr = float(np.corrcoef([p["lola_deg"] for p in per_az], [p["lroc_deg"] for p in per_az])[0, 1]) \
        if len(per_az) > 2 else None
    return {
        "covered": True,
        "lroc_model": f"NAC_DTM_APOLLO{number}", "pixel_m": round(lab["scale"], 1),
        "site_height_m": {"lroc": round(h_dtm, 1), "lola": round(h_site_lola, 1)},
        "directions_compared": len(per_az),
        "near_excluded_m": NEAR_M,
        "near_field_max_deg": round(max(p["lroc_near_deg"] for p in per_az), 1),
        "near_field_mean_deg": round(float(np.mean([p["lroc_near_deg"] for p in per_az])), 2),
        "reach_km": {"min": min(p["reach_km"] for p in per_az), "max": max(p["reach_km"] for p in per_az)},
        "terrain_angle_diff_deg": {"mean": round(float(diff.mean()), 2), "rms": round(float(np.sqrt((diff ** 2).mean())), 2),
                                   "max_abs": round(float(np.abs(diff).max()), 2)},
        "correlation": round(corr, 3) if corr is not None and np.isfinite(corr) else None,
        "skyline_directions_inside_model": len(inside),
        "skyline_vs_lroc_deg": {"mean": round(float(inside_diff.mean()), 2),
                                "rms": round(float(np.sqrt((inside_diff ** 2).mean())), 2),
                                "max_abs": round(float(np.abs(inside_diff).max()), 2)} if len(inside) else None,
        "directions": per_az,
    }


# ---------- report ----------

def main():
    apollo = check_apollo()
    physics = {site: check_physics(site) for site in SITES}
    terrain = {}
    for site in SITES:
        if site.startswith("apollo_"):
            res = check_terrain(site)
            if res is not None:
                terrain[site] = res
    payload = {
        "made_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
        "apollo": apollo,
        "physics": {"sites": physics,
                    "summary": {"sites": len(physics),
                                "checks": sum(len(p["checks"]) for p in physics.values()),
                                "passed": sum(c["ok"] for p in physics.values() for c in p["checks"])}},
        "terrain": {"source": LROC_SOURCE,
                    "about": "NASA LROC NAC stereo terrain models (2 m per pixel, 5 m for Apollo 17), made from "
                             "camera images; a different instrument than the LOLA laser our skylines use.",
                    "sites": terrain},
    }
    # Full detail (every direction of the terrain comparison) for anyone re-checking; the page gets a slim copy.
    with open(DETAIL_OUT, "w") as f:
        json.dump(payload, f, indent=1)
    slim = json.loads(json.dumps(payload))
    for t in slim["terrain"]["sites"].values():
        t.pop("directions", None)
    with open(JSON_OUT, "w") as f:
        json.dump(slim, f, separators=(",", ":"))

    name = lambda s: SITE_INFO.get(s, (s,))[0]  # noqa: E731
    out = ["# Independent checks beyond the poles (issue #1)", "",
           "Made by `app/python/scripts/crosscheck_nonpolar.py`; the website shows the same numbers from",
           "`app/public/data/checks.json`.", "",
           "## 1. Apollo records: Sun and Earth at each landing, EVA and liftoff", "",
           f"Source: {apollo['title']}, {apollo['source']} ({apollo['computed_by']}).",
           "Ours: JPL Horizons asked for our site coordinates at the same moments.", "",
           "| Mission | Events | Our site vs journal coordinate | Largest difference: Sun alt / az, Earth alt / az | |",
           "|---|---|---|---|---|"]
    for m in apollo["missions"]:
        w = m["max_abs_diff_deg"]
        out.append(f"| {m['mission']} | {len(m['events'])} | {m['coordinate_offset_km']:.2f} km | "
                   f"{w['sun_alt']:.2f}° / {w['sun_az']:.2f}°, {w['earth_alt']:.2f}° / {w['earth_az']:.2f}° | "
                   f"{'agrees' if m['agrees'] else 'DIFFERS'} |")
    s = apollo["summary"]
    out += ["", f"{s['events']} moments; largest difference {s['max_abs_diff_deg']:.2f}°, mean {s['mean_abs_diff_deg']:.3f}° "
            f"(the journal's two calculations differ from each other by up to {APOLLO_TOL_DEG}°).", "",
            "## 2. Physics checks", "",
            "| Site | Check | Rule | Expected | Ours | |", "|---|---|---|---|---|---|"]
    for site, p in physics.items():
        for c in p["checks"]:
            out.append(f"| {name(site)} | {c['name']} | {c['rule']} | {c['expected']}{c['unit']} | "
                       f"{c['ours']}{c['unit']} | {'ok' if c['ok'] else 'FAILS'} |")
    ps = payload["physics"]["summary"]
    out += ["", f"{ps['passed']} of {ps['checks']} checks pass across {ps['sites']} sites.", "",
            "## 3. Terrain: our LOLA terrain angles against LROC stereo models", "",
            "| Site | LROC model | Directions | Reach | LOLA minus LROC (mean / RMS / max) | Correlation | "
            "Directions where our skyline's highest point is inside the model: skyline minus LROC (mean / RMS) |",
            "|---|---|---|---|---|---|---|"]
    for site, t in terrain.items():
        if not t["covered"]:
            out.append(f"| {name(site)} | – | – | – | {t['note']} | – | – |")
            continue
        dd, sv = t["terrain_angle_diff_deg"], t["skyline_vs_lroc_deg"]
        out.append(f"| {name(site)} | {t['lroc_model']} ({t['pixel_m']} m) | {t['directions_compared']} | "
                   f"{t['reach_km']['min']}–{t['reach_km']['max']} km | {dd['mean']:+.2f}° / {dd['rms']:.2f}° / "
                   f"{dd['max_abs']:.2f}° | {t['correlation']} | "
                   + (f"{t['skyline_directions_inside_model']} directions: {sv['mean']:+.2f}° / {sv['rms']:.2f}° |"
                      if sv else "none |"))
    with open(MD_OUT, "w") as f:
        f.write("\n".join(out) + "\n")
    print("\n".join(out))


if __name__ == "__main__":
    main()
