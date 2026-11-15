"""Is the Sun (or Earth) above the real terrain skyline?

Pure functions: data in, numbers out. No web server and no hardware code in here.
This is Steps 2 and 3 of docs/software-architecture.md.

Words used here:
  azimuth      compass direction, 0 = north, 90 = east, clockwise, in degrees
  elevation    angle above a flat horizon, in degrees (negative = below it)
  skyline      for each direction, the angle of the highest terrain you can see
  margin       body elevation minus skyline there. Above 0 = visible, below 0 = blocked.
"""
import csv
import math


def load_skyline(path):
    """Read the skyline CSV into a list of 360 angles. Index = whole-degree azimuth."""
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    if len(rows) != 360:
        raise ValueError(f"expected 360 skyline rows, got {len(rows)}")
    for i, row in enumerate(rows):
        if float(row["azimuth_deg"]) != i:
            raise ValueError(f"skyline row {i} has azimuth {row['azimuth_deg']}, expected {i}")
    return [float(row["skyline_deg"]) for row in rows]


def skyline_at(skyline, az_deg):
    """Skyline angle at any azimuth, blending the two nearest whole-degree rows.

    Example: az 213.4 = 60% of the 213 row + 40% of the 214 row.
    The % 360 and the (low + 1) % 360 make it wrap, so az 359.5 blends rows 359 and 0.
    """
    az = az_deg % 360
    low = math.floor(az)
    high = (low + 1) % 360
    frac = az - low
    return skyline[low] * (1 - frac) + skyline[high] * frac


def load_horizons(path):
    """Read a cached Horizons CSV into a list of dicts with real numbers."""
    rows = []
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            rows.append({
                "time_utc": r["time_utc"],
                "sun_az_deg": float(r["sun_az_deg"]),
                "sun_el_deg": float(r["sun_el_deg"]),
                "earth_az_deg": float(r["earth_az_deg"]),
                "earth_el_deg": float(r["earth_el_deg"]),
            })
    return rows


# The Sun's apparent radius seen from the Earth-Moon system: about 16 arcminutes (it varies by about
# 1.7% over the year as our distance from the Sun changes). Used by the Sun rules below.
SUN_RADIUS_DEG = 0.2666

# When does the Sun count as "up"? The margin it needs above the skyline, in degrees.
#   centre      its centre is above the skyline (the Sun treated as a point; the default)
#   any_part    any part of the disc shows: the top edge is above the skyline (first light)
#   whole_disc  the whole disc is above the skyline (full sunlight on a solar panel)
SUN_RULES = {"centre": 0.0, "any_part": -SUN_RADIUS_DEG, "whole_disc": SUN_RADIUS_DEG}

# The default settings reproduce the original results exactly.
DEFAULT_SETTINGS = {"sun_rule": "centre", "earth_margin_deg": 0.0}


def thresholds(settings=None):
    """Settings -> (margin the Sun needs, margin Earth needs), in degrees above the skyline.

    settings: {"sun_rule": one of SUN_RULES, "earth_margin_deg": >= 0}. Missing keys use the defaults.
    earth_margin_deg is a safety margin: Earth must be at least that far above the skyline, because a
    radio link grazing the terrain is unreliable.
    """
    s = {**DEFAULT_SETTINGS, **(settings or {})}
    if s["sun_rule"] not in SUN_RULES:
        raise ValueError(f"sun_rule must be one of {sorted(SUN_RULES)}, got {s['sun_rule']!r}")
    if s["earth_margin_deg"] < 0:
        raise ValueError("earth_margin_deg must be 0 or more")
    return SUN_RULES[s["sun_rule"]], float(s["earth_margin_deg"])


def analyse(horizons_rows, skyline, settings=None):
    """Add skyline, margin and visible yes/no for the Sun and for Earth to every row.

    settings: see thresholds(). The default treats the Sun as a point and gives Earth no
    safety margin (also stated on the site).
    """
    needed = dict(zip(("sun", "earth"), thresholds(settings)))
    out = []
    for r in horizons_rows:
        row = dict(r)
        for body in ("sun", "earth"):
            sky = skyline_at(skyline, r[f"{body}_az_deg"])
            margin = r[f"{body}_el_deg"] - sky
            row[f"{body}_skyline_deg"] = sky
            row[f"{body}_margin_deg"] = margin
            row[f"{body}_visible"] = margin > needed[body]
        row["both_visible"] = row["sun_visible"] and row["earth_visible"]
        out.append(row)
    return out


def summarise(rows):
    """Percent of the time samples where the Sun, Earth and both are visible."""
    n = len(rows)
    return {
        "samples": n,
        "sun_visible_pct": 100 * sum(r["sun_visible"] for r in rows) / n,
        "earth_visible_pct": 100 * sum(r["earth_visible"] for r in rows) / n,
        "both_visible_pct": 100 * sum(r["both_visible"] for r in rows) / n,
    }
