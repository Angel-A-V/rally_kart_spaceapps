"""The site list shared by the scripts. Standard library only, on purpose.

Two kinds of site:
  1. The MODEL SITE (shackleton_rim): the point the tabletop model is built for. It was found from
     LOLA terrain data and is NOT a named feature or an official landing site.
  2. NAMED FEATURES from NASA Moon Trek (IAU nomenclature), cached in data/sites_moontrek.json by
     fetch_trek_sites.py. Each coordinate is the centre of the feature, not a chosen landing spot.

Coordinates are (latitude_deg, east_longitude_deg), south latitude negative.
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DATA = os.path.join(ROOT, "data")
R_KM = 1737.4
MODEL_SITE = "shackleton_rim"
BAND_REACH_KM = 50.0   # the cut-down 85S 20 m band covers this far from the pole
SKYLINE_RANGE_KM = 35.0


def _pole_distance_km(lat_deg):
    """Distance from the south pole ON THE POLAR MAP (stereographic), for choosing terrain maps only.
    It overshoots away from the pole; never show it to people. Use surface_km_from_pole() for that."""
    return 2 * R_KM * math.tan(math.radians(90.0 + lat_deg) / 2)


def surface_km_from_pole(lat_deg, pole="nearest"):
    """Distance along the Moon's surface from a pole, in km (arc length). pole: "south", "north" or "nearest"."""
    if pole == "nearest":
        pole = "south" if lat_deg < 0 else "north"
    angle = 90.0 + lat_deg if pole == "south" else 90.0 - lat_deg
    return R_KM * math.radians(angle)


SITES = {
    # Highest point on the Shackleton crater rim, on the ridge facing the pole.
    MODEL_SITE: (-89.781, 203.743),
}
# Names and one-line descriptions shown on the website.
SITE_INFO = {
    MODEL_SITE: ("Shackleton rim (model site)",
                 "Highest point on the Shackleton crater rim, 6.6 km from the pole. Found from NASA LOLA terrain "
                 "data; the tabletop model shows this site. Not a named feature or an official landing site."),
}
# Where each coordinate came from, shown in the data-sources panel.
SITE_SOURCE = {
    MODEL_SITE: "Found from NASA LOLA terrain data (highest rim point); not a named feature",
}

_trek_path = os.path.join(DATA, "sites_moontrek.json")
if os.path.exists(_trek_path):
    with open(_trek_path) as _f:
        _trek = json.load(_f)
    for _s in _trek["sites"]:
        SITES[_s["id"]] = (_s["lat_deg"], _s["lon_deg_east"])
        if _s.get("kind") == "landing_site":
            _ns = "N" if _s["lat_deg"] >= 0 else "S"
            SITE_INFO[_s["id"]] = (
                f"{_s['name']} landing site",
                f"Where {_s['name']} landed ({abs(_s['lat_deg']):.3f}° {_ns}, {_s['lon_deg_east']:.3f}° E). "
                "Coordinate: the centre of NASA Moon Trek's bookmark for the landing area.",
            )
            SITE_SOURCE[_s["id"]] = f"NASA Moon Trek (landing-site bookmark), retrieved {_trek['retrieved_utc']}"
        else:
            SITE_INFO[_s["id"]] = (
                _s["name"],
                f"Centre of the named lunar feature {_s['name']}, "
                f"{surface_km_from_pole(_s['lat_deg']):.0f} km from the {'south' if _s['lat_deg'] < 0 else 'north'} pole. "
                "A named place, not a chosen landing spot.",
            )
            SITE_SOURCE[_s["id"]] = f"NASA Moon Trek (IAU nomenclature), retrieved {_trek['retrieved_utc']}"

# Other past soft landings (Surveyor, Luna, Chang'e, Chandrayaan-3, SLIM, Blue Ghost, IM-2), cached in
# data/sites_landings.json by fetch_landing_sites.py from Wikipedia's list of artificial objects on the
# Moon. Each site keeps the source that list cites for its coordinate (mostly NASA LROC or NSSDC).
_land_path = os.path.join(DATA, "sites_landings.json")
if os.path.exists(_land_path):
    with open(_land_path) as _f:
        _land = json.load(_f)
    for _s in _land["sites"]:
        SITES[_s["id"]] = (_s["lat_deg"], _s["lon_deg_east"])
        _ns = "N" if _s["lat_deg"] >= 0 else "S"
        _note = f" {_s['note']}" if _s.get("note") else ""
        SITE_INFO[_s["id"]] = (
            f"{_s['name']} landing site",
            f"Where {_s['name']} landed ({_s['country']}, {_s['year']}), "
            f"{abs(_s['lat_deg']):.3f}° {_ns}, {_s['lon_deg_east']:.3f}° E.{_note}",
        )
        _cited = _s["source_url"] or "no link given there"
        SITE_SOURCE[_s["id"]] = (f"Wikipedia's list of artificial objects on the Moon (retrieved "
                                 f"{_land['retrieved_utc']}), which cites {_cited}")

POLAR_REACH_KM = 303.0  # the 40 m polar map covers about 304 km from the pole


def grid_for(lat):
    """Which terrain map a site's skyline is built from: the finest one that covers the site and its
    35 km look-out. The 20 m band reaches 50 km from the pole, the 40 m map 304 km; anywhere else on
    the Moon uses the whole-Moon map LDEM_128 (about 237 m per pixel)."""
    km = _pole_distance_km(lat)
    if lat <= 0 and km + SKYLINE_RANGE_KM <= BAND_REACH_KM:
        return "85S_20M"
    if lat <= 0 and km + SKYLINE_RANGE_KM <= POLAR_REACH_KM:
        return "80S_40M"
    return "LDEM_128"


SITE_GRID = {site: grid_for(lat) for site, (lat, _lon) in SITES.items()}
# IM-2 is inside the 40 m polar map, but that map was not downloaded on the machine that built its
# skyline (2026-11-14), so it uses the whole-Moon map for now. Remove this line and re-run
# make_skyline.py --site im_2 after downloading LDEM_80S_40M for finer near-field detail.
if "im_2" in SITE_GRID:
    SITE_GRID["im_2"] = "LDEM_128"

# The skyline file the WEBSITE uses for each site (near terrain plus far terrain out to 250 km).
# The model site has two files on purpose:
#   skyline_shackleton_rim.csv           the original 35 km skyline; the printed wall is built from it
#   skyline_shackleton_rim_extended.csv  the website's version, which also sees mountains beyond 35 km
SKYLINE_FILE = {site: f"skyline_{site}.csv" for site in SITES}
SKYLINE_FILE[MODEL_SITE] = f"skyline_{MODEL_SITE}_extended.csv"

# Site height above the 1737.4 km reference sphere, in metres, read from the skyline meta file
# (make_skyline.py writes it). Horizons needs a height. A site is missing here until its skyline
# has been built.
SITE_HEIGHT_M = {MODEL_SITE: 1738.0}
for _site in SITES:
    _meta = os.path.join(DATA, SKYLINE_FILE[_site][:-4] + ".meta.json")
    if _site != MODEL_SITE and os.path.exists(_meta):  # the model site keeps the height its cached data used
        with open(_meta) as _f:
            SITE_HEIGHT_M[_site] = round(json.load(_f)["site_height_m_above_1737.4km_sphere"], 1)
