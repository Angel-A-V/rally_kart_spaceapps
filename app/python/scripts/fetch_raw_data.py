"""Download every big NASA data file the project uses into data/raw/, so any machine (the Arduino UNO Q,
a teammate's laptop) has exactly what the Mac has. These files are too big for git (GitHub refuses
files over 100 MB), so data/raw/ is git-ignored and filled by this script instead.

Groups:
  terrain  LOLA whole-Moon terrain map LDEM_128 (2.0 GB). Needed at RUN time for "click anywhere on
           the Moon": the backend builds a skyline for the clicked point from it.
  checks   NASA GSFC polar illumination maps (4 x 51 MB) and NASA LROC Apollo terrain models (1.6 GB).
           Only needed to RE-RUN the accuracy checks (crosscheck_pgda.py, crosscheck_nonpolar.py);
           their results are already in git.

Files already complete are skipped; a broken download resumes where it stopped. Standard library only.

Run (from the repo root):
  python3 app/python/scripts/fetch_raw_data.py            everything (about 3.7 GB), same as the Mac
  python3 app/python/scripts/fetch_raw_data.py terrain    only what the website needs (2.0 GB)
  python3 app/python/scripts/fetch_raw_data.py --list     show what is there and what is missing
Copying data/raw/ from another machine (USB stick, scp) works just as well; this script then
confirms every file is complete.
"""
import argparse
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
RAW = os.path.join(ROOT, "data", "raw")
PGDA = "http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/"
LROC = "https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/"
LROC_TIF_BYTES = {11: 118142727, 12: 13506631, 14: 124301471, 15: 146373579, 16: 750530715, 17: 463397471}

# (group, path inside data/raw, URL, exact size in bytes or None for small label files)
FILES = [("terrain", "LDEM_128.IMG", "https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_128.IMG",
          2123366400)]
FILES += [("checks", name, PGDA + name, 51166728)
          for name in ("AVGVISIB_85S_060M_201608.IMG", "AVGVISIB_85S_060M_201608_EARTH.IMG",
                       "AVGVISIB_85N_060M_201608.IMG", "AVGVISIB_85N_060M_201608_EARTH.IMG")]
for _m, _size in LROC_TIF_BYTES.items():
    FILES += [("checks", f"lroc/NAC_DTM_APOLLO{_m}.LBL", f"{LROC}APOLLO{_m}/NAC_DTM_APOLLO{_m}.LBL", None),
              ("checks", f"lroc/NAC_DTM_APOLLO{_m}.TIF", f"{LROC}APOLLO{_m}/NAC_DTM_APOLLO{_m}.TIF", _size)]


def complete(path, size):
    return os.path.exists(path) and (os.path.getsize(path) == size if size else os.path.getsize(path) > 0)


def download(url, path, size):
    """Stream url to path via path + '.part', resuming a partial file. Checks the final size."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    part = path + ".part"
    have = os.path.getsize(part) if os.path.exists(part) else 0
    req = urllib.request.Request(url, headers={"Range": f"bytes={have}-"} if have else {})
    with urllib.request.urlopen(req, timeout=120) as r:
        if have and r.status != 206:   # the server ignored the resume request: start again
            have = 0
        with open(part, "ab" if have else "wb") as f:
            done = have
            while chunk := r.read(1 << 20):
                f.write(chunk)
                done += len(chunk)
                if size:
                    print(f"\r  {done / 1e6:8.1f} / {size / 1e6:.1f} MB", end="", flush=True)
    if size:
        print()
    if size and os.path.getsize(part) != size:
        raise RuntimeError(f"{os.path.basename(path)}: got {os.path.getsize(part)} bytes, expected {size}. Run again to resume.")
    os.replace(part, path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("group", nargs="?", choices=["all", "terrain", "checks"], default="all")
    ap.add_argument("--list", action="store_true", help="only show what is present and what is missing")
    a = ap.parse_args(argv)
    todo = [f for f in FILES if a.group == "all" or f[0] == a.group]
    missing = [f for f in todo if not complete(os.path.join(RAW, f[1]), f[3])]
    for group, rel, _url, size in todo:
        state = "missing" if (group, rel, _url, size) in missing else "ok"
        print(f"{state:8s} {group:8s} {rel:42s} {size / 1e6 if size else 0:9.1f} MB")
    need = sum(f[3] or 0 for f in missing)
    print(f"{len(todo) - len(missing)} of {len(todo)} files present; {need / 1e9:.2f} GB to download.")
    if a.list or not missing:
        return 0
    for _group, rel, url, size in missing:
        print(f"downloading {rel} from {url}")
        download(url, os.path.join(RAW, rel), size)
    print("done: every file is complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
