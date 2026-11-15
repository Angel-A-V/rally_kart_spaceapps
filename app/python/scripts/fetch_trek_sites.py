"""Look up named lunar features in NASA Moon Trek and cache them in data/sites_moontrek.json.

Moon Trek's search service returns the official (IAU) feature names with coordinates.
The coordinate is the CENTRE of the named feature (for a crater: the middle of its floor),
not a chosen landing spot.

Run from app/python:  python3 scripts/fetch_trek_sites.py      (needs internet once)
"""
import datetime as dt
import json
import math
import os
import urllib.parse
import urllib.request

API = "https://trek.nasa.gov/moon/TrekServices/ws/index/eq/searchItems"
R_KM = 1737.4

# Named features near the poles to offer on the website. Add a name and re-run.
FEATURES = ["Shackleton", "de Gerlache", "Haworth", "Nobile", "Mons Mouton", "Malapert", "Cabeus"]
# North pole: large permanently shadowed craters and the sunlit Peary rim region (often named as
# candidate polar sites alongside the south pole ones).
FEATURES += ["Peary", "Hermite", "Whipple", "Rozhdestvenskiy", "Byrd"]
# Past landing sites, stored in Moon Trek as "bookmark" items (a small box around the landing area).
LANDING_SITES = ["Apollo 11", "Apollo 12", "Apollo 14", "Apollo 15", "Apollo 16", "Apollo 17"]

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = os.path.join(ROOT, "data", "sites_moontrek.json")


def slug(name):
    """'Mons Mouton' -> 'mons_mouton' (used in file names)."""
    return "_".join(name.lower().split())


def nearest_pole_km(lat_deg):
    """Distance from the nearer pole (north for north latitudes), in km, same formula as pole_distance_km."""
    return pole_distance_km(-abs(lat_deg))


def pole_distance_km(lat_deg):
    """Distance from the south pole on the polar map, in km (same formula the terrain maps use)."""
    return 2 * R_KM * math.tan(math.radians(90.0 + lat_deg) / 2)


def pick_feature(docs, name):
    """Find the named feature called exactly `name` in a Moon Trek reply -> (lat_deg, east_lon_deg).

    Moon Trek gives a box "west,south,east,north" in degrees with longitude from -180 to 180.
    A point feature has a zero-size box; for an area we take the centre.
    """
    for doc in docs:
        if doc.get("itemType") == "nomenclature" and (doc.get("title") or "").lower() == name.lower():
            west, south, east, north = (float(v) for v in doc["bbox"].split(","))
            return (south + north) / 2, ((west + east) / 2) % 360
    raise LookupError(f"Moon Trek has no named feature called {name!r}")


def pick_landing_site(docs, name):
    """Find the landing-site bookmark called exactly `name` (e.g. "Apollo 11") -> (lat_deg, east_lon_deg).

    Moon Trek stores past landing sites as "bookmark" items whose box surrounds the landing area;
    the centre of that box is the landing point (Apollo 11: 0.671 N, 23.484 E).
    """
    for doc in docs:
        if doc.get("itemType") == "bookmark" and (doc.get("title") or "").lower() == name.lower():
            west, south, east, north = (float(v) for v in doc["bbox"].split(","))
            return (south + north) / 2, ((west + east) / 2) % 360
    raise LookupError(f"Moon Trek has no landing-site bookmark called {name!r}")


def search_url(name, item_type="nomenclature"):
    if item_type == "bookmark":
        query = {"start": 0, "rows": 40, "q": name}
    else:
        query = {"start": 0, "rows": 25, "key": name, "facetKeys": "itemType", "facetValues": item_type}
    return API + "?" + urllib.parse.urlencode(query)


def search(name, item_type="nomenclature"):
    with urllib.request.urlopen(search_url(name, item_type), timeout=60) as r:
        return json.load(r)["response"]["docs"]


def main():
    sites = []
    lookups = [(n, "feature", "nomenclature", pick_feature) for n in FEATURES]
    lookups += [(n, "landing_site", "bookmark", pick_landing_site) for n in LANDING_SITES]
    for name, kind, item_type, pick in lookups:
        lat, lon = pick(search(name, item_type), name)
        sites.append({
            "id": slug(name),
            "name": name,
            "kind": kind,
            "lat_deg": round(lat, 6),
            "lon_deg_east": round(lon, 6),
            "pole_distance_km": round(pole_distance_km(lat), 1),
            "nearest_pole": "south" if lat < 0 else "north",
            "nearest_pole_km": round(nearest_pole_km(lat), 1),
            "query": search_url(name, item_type),
        })
        print(f"{name:12s} lat {lat:9.4f}  lon_E {lon:9.4f}  {nearest_pole_km(lat):6.1f} km from the nearer pole")
    payload = {
        "source": "NASA Moon Trek search service (IAU nomenclature and landing-site bookmarks), https://trek.nasa.gov/moon/",
        "note": "Named features: the centre of the feature, not a chosen landing spot. "
                "Landing sites: the centre of Moon Trek's bookmark box around the landing area.",
        "retrieved_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
        "sites": sites,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=2)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
