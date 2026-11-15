"""Fetch the coordinates of past soft landings on the Moon and cache them in data/sites_landings.json.

Source: Wikipedia's "List of artificial objects on the Moon" (raw page source). Each coordinate there
cites its own source, mostly NASA's LRO camera team (lroc.asu.edu, LROC QuickMap) or the NASA NSSDC
catalog; that cited link is kept with every site so it can be checked. NASA Moon Trek only has the
Apollo sites (see fetch_trek_sites.py), which is why this second source is needed.

Only rows the page marks as landed or operational are used, one per landing (rovers parked at their
lander are skipped). Left out on purpose:
  Luna 23    damaged on landing, and the page gives exactly the same coordinate as Luna 24.
  IM-1       the page's coordinate cites a social-media post and disagrees with the published landing
             site; add it once it is checked against an LROC page.
  Apollo     already come from NASA Moon Trek.

Run from app/python:  python3 scripts/fetch_landing_sites.py      (needs internet once)
"""
import datetime as dt
import json
import os
import re
import urllib.request

PAGE = "List_of_artificial_objects_on_the_Moon"
RAW_URL = f"https://en.wikipedia.org/w/index.php?title={PAGE}&action=raw"
PAGE_URL = f"https://en.wikipedia.org/wiki/{PAGE}"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = os.path.join(ROOT, "data", "sites_landings.json")

# id -> (name shown on the page, text that starts that row's first cell on Wikipedia)
WANTED = {
    "luna_9": ("Luna 9", "[[Luna 9]]"),
    "surveyor_1": ("Surveyor 1", "[[Surveyor 1]]"),
    "luna_13": ("Luna 13", "[[Luna 13]]"),
    "surveyor_3": ("Surveyor 3", "[[Surveyor 3]]"),
    "surveyor_5": ("Surveyor 5", "[[Surveyor 5]]"),
    "surveyor_6": ("Surveyor 6", "[[Surveyor 6]]"),
    "surveyor_7": ("Surveyor 7", "[[Surveyor 7]]"),
    "luna_16": ("Luna 16", "[[Luna 16]]"),
    "luna_17": ("Luna 17 / Lunokhod 1", "[[Luna 17]]"),
    "luna_20": ("Luna 20", "[[Luna 20]]"),
    "luna_21": ("Luna 21 / Lunokhod 2", "[[Luna 21]]"),
    "luna_24": ("Luna 24", "[[Luna 24]]"),
    "change_3": ("Chang'e 3", "[[Chang'e 3]] lander"),
    "change_4": ("Chang'e 4", "[[Chang'e 4]] lander"),
    "change_5": ("Chang'e 5", "[[Chang'e 5]] descent stage"),
    "change_6": ("Chang'e 6", "[[Chang'e 6]]"),
    "chandrayaan_3": ("Chandrayaan-3 (Vikram)", "[[Chandrayaan-3]]"),
    "slim": ("SLIM", "[[Smart Lander for Investigating Moon|SLIM]]"),
    "blue_ghost_m1": ("Blue Ghost Mission 1", "[[Blue Ghost M1]]"),
    "im_2": ("IM-2 Athena", "[[IM-2|IM-2 ''Athena'']]"),
}
LANDED_COLORS = {"#fcf2cf": "landed", "#ddf2d8": "operational"}   # the page's row colours (its legend)
COORD = re.compile(r"\{\{\s*(?:[Cc]oords?|Lunar coords and quad cat)\s*\|([^{}]*)\}\}")
NOTES = {"im_2": "Landed on its side (tipped over)."}


def parse_coord(args):
    """'84.7906|S|29.1957|E|...' or '0|28|S|...' (degrees, minutes, seconds) -> (lat, east lon)."""
    parts = [p.strip() for p in args.split("|") if "=" not in p and ":" not in p and p.strip()]
    for i, p in enumerate(parts):
        if p in ("N", "S"):
            for j, q in enumerate(parts[i + 1:]):
                if q in ("E", "W"):
                    dms = lambda xs: sum(float(x) / 60 ** k for k, x in enumerate(xs))
                    lat = dms(parts[:i]) * (1 if p == "N" else -1)
                    lon = dms(parts[i + 1:i + 1 + j]) * (1 if q == "E" else -1)
                    return lat, lon
    raise ValueError(f"cannot read the coordinate {args!r}")


def find_rows(wikitext):
    """Every table row: (row colour, first cell text, whole row text)."""
    table = wikitext.split("===Table of objects===", 1)[1]
    for row in table.split("\n|-")[1:]:
        head, _, body = row.partition("\n|")
        color = re.search(r"background:\s*(#[0-9A-Fa-f]{6})", head)
        yield (color.group(1).lower() if color else ""), body.strip(), row


def pick(wikitext):
    rows = list(find_rows(wikitext))
    sites = []
    for sid, (name, starts) in WANTED.items():
        # A mission can have several rows (lander, descent stage, crashed rocket stage...): use the one
        # the page marks as landed or operational.
        match = [(c, r) for c, first, r in rows
                 if first.startswith(starts) and COORD.search(r) and c in LANDED_COLORS]
        if not match:
            raise LookupError(f"no landed row with a coordinate starts with {starts!r}")
        color, row = match[0]
        coord = COORD.search(row)
        lat, lon = parse_coord(coord.group(1))
        flag = re.search(r"\{\{[Ff]lag(?:icon)?\|([^}|]*)", row)
        before = re.sub(r"\{\{[^{}]*\}\}", "", row[:coord.start()])   # {{flag|United States|1960}} is not a year
        year = re.search(r"\b((?:19|20)\d\d)\b", before)
        url = re.search(r"url\s*=\s*(https?://[^\s|}]+)", row[coord.start():])
        sites.append({
            "id": sid,
            "name": name,
            "country": flag.group(1).strip() if flag else "",
            "year": int(year.group(1)) if year else None,
            "lat_deg": round(lat, 4),
            "lon_deg_east": round(lon % 360, 4),
            "status_on_page": LANDED_COLORS[color],
            "source_url": url.group(1) if url else "",   # "" = the page gives no link for this coordinate
            "note": NOTES.get(sid, ""),
        })
    return sites


def main():
    req = urllib.request.Request(RAW_URL, headers={"User-Agent": "lunar-site-navigator-hackathon/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        wikitext = r.read().decode("utf-8")
    sites = pick(wikitext)
    for s in sites:
        print(f"{s['name']:24s} {s['year']}  lat {s['lat_deg']:9.4f}  lon_E {s['lon_deg_east']:9.4f}  {s['source_url'][:60]}")
    payload = {
        "source": f"Wikipedia, '{PAGE.replace('_', ' ')}' ({PAGE_URL}); each site keeps the source that page cites",
        "retrieved_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
        "sites": sites,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=2)
    print("wrote", OUT, f"({len(sites)} sites)")


if __name__ == "__main__":
    main()
