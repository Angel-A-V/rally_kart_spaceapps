# Lunar Landing Site Navigator (NASA Space Apps 2026, Challenge 11)

A website that compares two spots on the Moon's south pole and shows which is
better for a landing: is the Sun up (power) and is Earth up (radio link)?
A small tabletop model shows one site with a lamp as the Sun and a printed copy
of the real horizon.

Team: Angel (code, electronics), Gustavo (disc and terrain wall), Darren (stand and lamp).
Start with `CLAUDE.md` (short project brief) and `docs/context-handoff.md` (full context).

## Setup

You need Python 3.10+, numpy and Flask (Flask only for the backend).

```
# Mac or anywhere (recommended): a project virtual environment, git-ignored
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Ubuntu / WSL / Arduino UNO Q
sudo apt install python3-numpy python3-flask

# or without a virtual environment
python3 -m pip install --user -r requirements.txt
# if pip says "externally-managed-environment":
#   python3 -m pip install --user --break-system-packages -r requirements.txt
```

## Run the self-test

```
cd app/python
python3 -m unittest discover -s tests -t . -v
```

All tests should pass. Three of them skip if the terrain file is not downloaded yet.

## Make the skyline for the model

```
python3 app/python/scripts/make_skyline.py
```

Downloads about 150 MB of NASA LOLA terrain into `data/raw/` (not committed) and
writes `data/skyline_shackleton_rim.csv` and a `.meta.json` next to it.
The CSV is what the CAD script for the printed wall reads.

## Build the data files the website reads

```
cd app/python
python3 scripts/export_site_json.py
```

Writes `app/public/data/sites.json` and one `<site>_analysis.json` per site. Run it again after changing the data or the analysis code. Then `cd app && npm install && npm run dev`.

## Run the backend (custom coordinates)

The website works without it, but the "Analyse your own point" card needs it.
Two terminals, from the repo root:

```
.venv/bin/python app/python/server/app.py     # backend on http://127.0.0.1:8000
cd app && npm run dev                          # website; Vite forwards /api to the backend
```

`GET /api/custom?lat=..&lon=..` asks NASA JPL Horizons live (a few seconds) and answers in the same
shape as the curated sites' JSON. Answers are cached in `data/custom/` (git-ignored), so a point asked
before works offline. The skyline is real LOLA terrain anywhere on the Moon once the whole-Moon map is
downloaded (2.1 GB, once): `python3 app/python/scripts/make_skyline.py --grid LDEM_128`. Near the south pole
the finer polar maps are used instead when they are downloaded too (`make_skyline.py`, about 610 MB).
With no map at all, the page says it is using a flat horizon. `GET /api/health` shows which maps are present.

## Set up the Arduino UNO Q (or any new machine) to match the Mac

Git holds all the computed results (every site, skyline, Horizons file and accuracy check). Three things
are NOT in git and must be added on each machine:

| What | Why not in git | How to get it |
|---|---|---|
| `data/raw/` NASA data files (3.7 GB) | GitHub refuses files over 100 MB | `python3 app/python/scripts/fetch_raw_data.py`, or copy the folder from the Mac |
| `app/dist/` the built website | made from the source | build on the Mac (`cd app && npm run build`) and copy it; Node is not needed on the UNO Q |
| Python packages | installed per machine | `sudo apt install python3-numpy python3-flask` |

On the UNO Q (Linux side), from the repo root:

```
git pull                                               # or git clone the first time
sudo apt install python3-numpy python3-flask
python3 app/python/scripts/fetch_raw_data.py           # everything the Mac has (3.7 GB); add "terrain" for only the 2.0 GB the website needs
# from the Mac:  cd app && npm run build && scp -r dist <user>@<uno-q-address>:<repo>/app/
HOST=0.0.0.0 python3 app/python/server/app.py          # the whole site on port 8000
curl http://localhost:8000/api/health                  # "LDEM_128": true means click-anywhere has real terrain
```

`fetch_raw_data.py --list` shows what is present; it skips complete files and resumes broken downloads.
Only `LDEM_128.IMG` is used while the site runs; the other files are for re-running the accuracy checks.
Copying `data/raw/` over USB or `scp` is faster than downloading; run `--list` afterwards to confirm.

## Get the Sun and Earth directions (NASA JPL Horizons)

```
python3 app/python/scripts/fetch_horizons.py                          # 30 days, hourly
python3 app/python/scripts/fetch_horizons.py --days 365 --step "6 h"  # a full year
```

Needs internet once; results are cached in `data/horizons_*.csv` (with a `.meta.json`
holding the exact queries) so the app answers instantly and every number can be re-checked. No numpy needed.
Columns: `time_utc, sun_az_deg, sun_el_deg, earth_az_deg, earth_el_deg`.

## Folders

| Folder | What |
| --- | --- |
| `app/` | **All code lives here.** Web app (Vite: `src/`, `public/`) and Python (`app/python/`: `analysis/` calculation core, `scripts/` data jobs, `tests/`) |
| `data/` | Small committed outputs (CSV). Big raw downloads go in `data/raw/` and are ignored |
| `docs/` | Plan, hardware inventory, software architecture, handoffs, explainer (index: `docs/README.md`) |
| `cad/` | Gustavo's terrain wall files (STL, SolidWorks curves) |
| `for_gustavo/` | One-page wall note and the skyline CSV for Gustavo |
| `NasaSpaceApps-Challenges/` | Challenge text (11 primary, 3 backup) |

Everything outside `app/` is team context (docs, CAD, handoffs, shared data). Planned inside `app/`, not created yet: a Python server and the `sketch/` firmware.

## Data sources

NASA LRO LOLA gridded elevation (LDEM_85S_20M, PDS Geosciences Node).
NASA JPL Horizons (ephemeris DE441, Moon orientation including libration) for Sun/Earth directions.
