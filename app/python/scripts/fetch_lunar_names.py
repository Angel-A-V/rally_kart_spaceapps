"""Official lunar feature names for the 3D Moon's zoom labels (UI overhaul phase 3).

Source: the IAU/USGS Gazetteer of Planetary Nomenclature, the same names NASA Moon Trek shows.
Moon Trek's search service lists them too but without sizes; the Gazetteer's centre-point file has
each feature's centre and diameter, which the globe needs to decide which names to show at which
zoom (big features from far away, small ones close up).

Kept: every IAU-adopted primary feature (craters, maria, montes, valles...) and lettered "satellite"
craters (e.g. "Marco Polo P") of at least 20 km, so close-up views have names without thousands of
tiny labels. Written as compact rows, biggest first: [name, lat, east_lon, diameter_km, type_code].

Run (from the repo root):  python3 app/python/scripts/fetch_lunar_names.py
Writes app/public/data/lunar_names.json. Standard library only.
"""
import datetime as dt
import io
import json
import os
import struct
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = os.path.join(ROOT, "app", "public", "data", "lunar_names.json")
URL = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip"
GAZETTEER = "https://planetarynames.wr.usgs.gov/"
MIN_SATELLITE_KM = 20.0


def read_dbf(data):
    """Rows of a dBASE III table (the attribute part of a shapefile) as dicts of strings."""
    count = struct.unpack("<I", data[4:8])[0]
    header_len, record_len = struct.unpack("<HH", data[8:12])
    fields, pos = [], 32
    while data[pos] != 0x0D:
        fields.append((data[pos:pos + 11].split(b"\0")[0].decode(), data[pos + 16]))
        pos += 32
    rows = []
    for i in range(count):
        rec = data[header_len + i * record_len: header_len + (i + 1) * record_len]
        if rec[:1] == b"*":          # deleted record
            continue
        row, p = {}, 1
        for name, length in fields:
            row[name] = rec[p:p + length].decode("utf-8", "replace").strip()
            p += length
        rows.append(row)
    return rows


def keep(row):
    if row["approval"] != "Adopted by IAU" or not row["diameter"]:
        return False
    return row["code"] != "SF" or float(row["diameter"]) >= MIN_SATELLITE_KM


def compact(rows):
    out = [[" ".join((r["clean_name"] or r["name"]).split()), round(float(r["center_lat"]), 3), round(float(r["center_lon"]) % 360, 3),
            round(float(r["diameter"]), 1), r["code"]] for r in rows if keep(r)]
    return sorted(out, key=lambda f: -f[3])


def main():
    with urllib.request.urlopen(URL, timeout=120) as r:
        archive = zipfile.ZipFile(io.BytesIO(r.read()))
    name = next(n for n in archive.namelist() if n.lower().endswith(".dbf"))
    names = compact(read_dbf(archive.read(name)))
    payload = {
        "source": "IAU / USGS Gazetteer of Planetary Nomenclature (as shown in NASA Moon Trek)",
        "url": GAZETTEER, "file": URL,
        "retrieved_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
        "columns": ["name", "lat_deg", "lon_deg_east", "diameter_km", "type_code"],
        "note": f"IAU-adopted primary features, plus lettered satellite craters of {MIN_SATELLITE_KM:g} km or more. "
                "Biggest first.",
        "features": names,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {OUT}: {len(names)} names, {os.path.getsize(OUT) / 1e3:.0f} kB")


if __name__ == "__main__":
    main()
