# CLAUDE.md: Lunar Landing Site Navigator (NASA Space Apps 2026, Challenge 11)

Team: Angel (CS/CE, owns all code, electronics, integration), Gustavo (ME, Sun mechanism), Darren (ME, Earth arm, base, electronics bay).
The MEs do not write code. All main code (ephemeris, web app, main firmware) lives with Angel to avoid merge conflicts.
Backup: Challenge 3 (Junior Astronaut Mission Trainer). Go/no-go at the end of Phase 1; see the plan.

**Event is live (Nov 14 to 15, 2026, UC Merced). Read `docs/event-day.md` first:** submission cutoff **1:30 PM Sunday** (not NASA's 11:59 PM), room closes 11:30 PM Saturday with no overnight, Makerspace 1 to 7 PM Saturday only, judging is an **8-minute demo + 3-minute Q&A** against NASA's five criteria (Impact, Creativity, Validity, Relevance, Presentation), 3 of the 7 judges are online, hardware go/no-go at **9:30 AM Sunday**. That file overrides the older timelines in the plan and handoff, and also covers the awards, the AWS question, the submission checklist and the 8-minute demo outline.

Source docs in this folder (read them for detail, do not duplicate them here):
- `docs/event-day.md`: event constraints, timeline to the cutoff, demo outline, awards, AWS, submission checklist.
- `docs/project-plan.md`: full plan, interface contract, assignments, risks.
- `docs/hardware-inventory.md`: what we own.
- `docs/software-architecture.md`: how the analysis works (calculation steps with a real worked example), the proposed software stack, server interface, hosting options, and the decision to build ONE codebase that runs in two modes (public Cloudflare Pages, no hardware; and local on the UNO Q with the hardware). Index of all docs: `docs/README.md`.
- `docs/how-the-calculations-work.md`: plain-language learning guide to every calculation (skyline, visibility margin, sunset/Earthset search, sensitivity) with real numbers and by-hand exercises. Angel wants to understand these under the hood so he can design the dashboard and review what teammates' agents produce. When asked about the calculations, teach from this doc; do not just hand over code.
- `NasaSpaceApps-Challenges/nasachall11.pdf` (primary), `nasachall3.pdf` (backup). Challenge 11 text was read directly and matches the plan. Notes from it: no required deliverable list (everything is "you may consider"); the Moon has no atmosphere, so the horizon is local terrain plus the edge of the lunar sphere; it names libration and lunar orbital variation as accuracy factors; audiences are mission planners, educators, and the public; the Resources tab on the challenge page can still gain links before the hackathon. To extract PDF text here: `pip install --target <dir> pypdf` (poppler is not installed).

## How we work (collaborators: you may build and push)

Updated 2026-11-13. Collaborators (Gustavo, Darren) may write code and files for their own parts and push to GitHub. The earlier "planning phase" restrictions no longer apply to them. Angel keeps his own stricter learning-first rules locally.
- **Ownership still applies:** all main code (ephemeris, web app, main firmware) lives with Angel to avoid merge conflicts. Collaborators work in their own folders (`cad/`, `for_gustavo/`, docs, handoffs) and send anything touching `app/` (all code lives there, including `app/python/` and the firmware sketch) through a branch and pull request instead of pushing to `main`.
- **Pull before you push** (`git pull --rebase`) so pushes are not rejected.
- **History to be aware of:** `app/python/scripts/make_skyline.py`, `app/python/scripts/fetch_horizons.py`, `app/python/scripts/sites.py`, `app/python/tests/`, and `data/` were written by an earlier AI session. Treat them as reference material.
- **Target hardware:** all of the code is meant to run on the **Arduino UNO Q (4 GB)**: Linux side (Python server, data, web app) plus the STM32 microcontroller side (Arduino sketch for stepper/LED). Details of the UNO Q software bridge are [verify].

## What we are building

The problem: lunar south pole missions must pick a landing **site** and **date**. That decides (1) solar power, via the Sun's elevation above the local horizon, and (2) direct-to-Earth communication, via whether Earth is above the local horizon.

NASA tools exist (JPL Horizons, Quickmap, Moon Trek) but are hard for non-specialists to use for fast scenario comparison. We build an intuitive tool:
- Pick a site (curated list, optionally custom coordinates) and a date/time.
- Show Sun and Earth relative to the horizon (az/el diagram).
- Show numbers: Sun elevation, sunlight duration, time to sunset, Earth visible yes/no, time to Earthset.
- Compare sites or dates side by side. Explain data sources in the tool.

Two parts:
1. **Software core** (web app on the Arduino UNO Q Linux side). This answers the challenge and is judged first.
2. **Physical companion**: tabletop south pole model. Lamp on a stepper-driven ring = Sun (azimuth, 360°). SG90 servo arm = Earth (small libration wobble). Moves in sync with the app.

**Hard rule: the software must work fully without the hardware.** Hardware is a companion, never a dependency.

## The core concept (how the team should think about it)

The observer is **standing at the landing site on the Moon**, not on Earth. The computation answers: "from this spot, at this time, in which direction (azimuth, elevation) do I see the Sun and Earth?"

Frame chain:
1. **Space frame (inertial, e.g. ICRF/J2000).** Sun, Earth, Moon positions come from an ephemeris (JPL Horizons, or SPICE/Skyfield kernels).
2. **Moon-fixed frame** (body-fixed, lat/lon on the Moon). The rotation from inertial to Moon-fixed (a rotation matrix or quaternion) comes from the lunar orientation model and includes **libration**. This is where the quaternion lives.
3. **Site-local frame (east, north, up) at (lat, lon).** Dot the Sun/Earth direction vector (in the Moon-fixed frame) with the site's east/north/up basis. Then elevation = asin(up), azimuth = atan2(east, north).

The same operation gives both Sun and Earth. Sun mostly changes with hour angle (one lunar day = ~29.53 Earth days). Earth wobbles within a few degrees (libration), which at the pole decides whether Earth is above the horizon.

Practical consequence: JPL Horizons can already do the whole chain for an observer at lunar surface coordinates and return az/el. Prefer an API or library (Horizons, Skyfield) over hand-written orbital math. Precompute and cache results for demo sites so the demo works offline.

Terrain matters at the pole: a flat horizon (up if elevation > 0) is the first version; LOLA-derived horizon profiles (list of azimuth, skyline elevation) come next for 2 to 3 sites. The terrain silhouette ring (Gustavo) is printed from that same data.

An interactive explainer of this lives in the artifact built for the team (frames chain, globe, site sky, lunar-day timeline). It uses a simplified teaching model, not real ephemeris data.

## MUST / SHOULD / COULD

MUST: 3 to 5 curated sites; date/time picker; Sun and Earth vs horizon diagram; numbers (Sun elevation, time to sunset, Earth visible, time to Earthset); compare two sites or dates; data sources explained in-app.
SHOULD: timeline over one lunar day; custom coordinates; LOLA terrain horizon for the main site; plain-language explain mode.
COULD: 3D surface view; rigorous libration; many sites with "best date" suggestions.
Build MUST first. Do not add SHOULD/COULD before MUST works.

## Architecture and contract

Browser web app <-> (HTTP/WebSocket, Wi-Fi) <-> Arduino UNO Q.
- Linux side (Python): ephemeris math, serves the web app, sends motor commands.
- MCU side (STM32, Arduino sketch): drives stepper (28BYJ-48 + ULN2003) and servo (SG90) in real time; reads pot (timeline scrub), buttons (site select), photoresistor (solar power reading); LCD1602 status.
- Motors powered from the breadboard supply module, never from UNO Q pins.

Command format (draft, plain text lines over serial or UNO Q Bridge):
```
SUN <azimuth_deg> <elevation_deg>
EARTH <azimuth_deg> <elevation_deg>
HOME
STATUS
```
Interface contract fields still blank in the plan: model footprint, stepper/servo measured dimensions, degrees per step after gearing, Earth arm range, home switch location, wire exits and electronics bay. Do not invent values; ask or leave blank.

## Conventions for working in this repo

- **Website UI work:** read `app/CLAUDE.md` first (design direction, layout, file ownership, globe API,
  how to verify). The UI overhaul lives on the `ui-overhaul` branch until it beats `main`.
- Items tagged **[verify]** in the plan are unconfirmed (site coordinates, part dimensions, pin numbers, UNO Q Bridge API, orbital numbers). Do not treat them as fact. Check before depending on them.
- Build small testable pieces first: stepper moves N degrees, then reads pot, then parses `SUN 215 1.2`, then the app.
- Explain things in plain language for a mixed ME/software team. Define terms (azimuth, elevation, libration, LOLA, DTE) when used.
- Keep a screen-recorded backup demo and an offline data cache. Attribute all data sources in the submission.
- Hardware: Arduino UNO Q, ELEGOO UNO R3, "Tiny" mini board, ELEGOO kit, perfboards, soldering kit, Bambu Lab A1 (about 256 mm bed, [verify]). See the inventory file.

## Current state (updated 2026-11-10) and decisions since the plan

Read `docs/context-handoff.md` for the full story. Short version:
- **No machine learning.** Everything is physics and geometry from NASA data, so numbers can be traced and checked. Do not add ML.
- **Time is about 2 days** (in practice about 12 hours on Saturday and 5 on Sunday; see `docs/event-day.md`). The hardware was cut to a two-day design: the Moon surface (a ~140 mm disc with the printed terrain wall) rotates on the stepper under a fixed lamp. Nothing electrical rides on the disc. One site only for the model. The older plan text still describes the moving Sun ring and servo Earth arm; the handoff file overrides it.
- **Model site: Shackleton crater rim, working pick at -89.781, 203.743 E.** Found from LOLA data as the highest rim point on the ridge facing the pole. It is NOT an official landing site. [verify] against a published candidate list before the pitch.
- **Website vision:** compare two spots, chosen from curated sites first, then typed coordinates, then clicking a 3D Moon (the last two are SHOULD/COULD; see MUST list).
- **Done:** `app/python/scripts/make_skyline.py` builds `data/skyline_shackleton_rim.csv` (azimuth_deg, skyline_deg; 360 rows) from real LOLA terrain. `app/python/tests/` has 16 passing checks (skyline: made-up terrain with known answers plus real-data checks; Horizons: parser, query and physics sanity). Gustavo's wall script reads that CSV. Raw terrain (`data/raw/`) is git-ignored; the script re-downloads it.
- **Done (Horizons):** `app/python/scripts/fetch_horizons.py` queries JPL Horizons as an observer on the Moon (`CENTER='coord@301'`, `SITE_COORD` east-lon,lat,km, `QUANTITIES=4`, `APPARENT=AIRLESS`) and caches `data/horizons_<site>_<start>_<days>d_<step>.csv` + `.meta.json` (exact queries). Cached: 30 days hourly and 365 days 6-hourly from 2026-11-10. Horizons uses DE441 and the high-precision Moon orientation (includes libration), so no hand-written orbital math. Findings at the Shackleton rim pick: Sun elevation stays within about -1.75 to +1.74 deg over a year; Earth elevation about -7.3 to +6.4 deg, azimuth about 148 to 164 deg. First rough result over the year (Sun as a point, Earth with no margin): Sun above the real skyline ~80% (54% on a flat horizon), Earth ~51%, both ~41%. Not yet cross-checked against Quickmap illumination maps.
- **Done (2026-11-14, website first version):** `app/` is a Vite page with a site picker and time slider per scenario (compare two sites or two moments), a horizon strip diagram (SVG), numbers incl. time to sunset/Earthset, a yearly comparison table, a table view and a data-sources panel. Python in `app/python/`: `analysis/` (`visibility.py` skyline lookup + margin, `events.py` next sunset/Earthset, `windows.py` yearly stats), `scripts/export_site_json.py` writes `app/public/data/*.json`. Three south-pole sites, all data-derived working picks (`shackleton_rim`, `polar_ridge` at -89.914/219.721, `crater_floor` at -89.627/118.582), each with skyline and 30-day and 365-day Horizons data. Planning section (added after Angel's feedback that the tool must say how good a site is and when to go): windows over the year (start, end, length) for Sun, Earth and both, days visible and window counts, longest stretch with both, and the best non-overlapping landing windows for 7, 14 or 30 day missions (scored by share of the mission with both visible; `analysis/windows.py`: `find_windows`, `best_mission_windows`), shown as a year timeline strip plus tables. 90 Python tests + 9 JS tests pass (`cd app && node --test src/format.test.js`). Rim yearly check: Sun 79.7%, Earth 50.7%, both 41.1% (matches the earlier rough numbers).
- **Done (2026-11-14, backend):** Flask server `app/python/server/app.py` (Decision A = Flask). `GET /api/custom?lat=..&lon=..` analyses any point on the Moon (`server/custom_point.py`): live Horizons via `fetch_horizons.fetch_rows`; LOLA terrain skyline ANYWHERE on the Moon from the whole-Moon map `LDEM_128` (128 px/deg, ~237 m/px, same data as Moon Trek's "LRO LOLA DEM", downloaded to `data/raw/LDEM_128.IMG` on the Mac; reader `make_skyline.skyline_global`), finer polar maps preferred near the pole when downloaded (not yet on the Mac), flat horizon only if no map at all; checked against the polar-map skylines of all 8 curated sites (correlation 0.83 to 1.00, mean difference under 0.5 deg); Apollo 17 valley skyline 14 deg, far side Earth 0%; same JSON shape as the curated sites via `export_site_json.assemble_payload`; cached in `data/custom/` (git-ignored). Page: "Analyse your own point" card adds the point to every picker. Vite proxies `/api` to port 8000. Verified live: model-site coords match the cache to 0.0003 deg; Apollo 11 area gives Earth 100%, Sun 50%. Run: see README "Run the backend". Mac setup uses `.venv` (Python 3.12 from Homebrew).
- **Done (2026-11-14, whole Moon on the page):** click anywhere on the 3D Moon (`globe.js` `onPick`, raycast + `geo.xyzToLatLon`) to analyse that spot; yellow dot while working, then a green marker (`addSite`) and the point joins every picker, the plan and scenario A (`main.js` `analysePoint`, shared with the typed-coordinates form). Heading "Pick any point on the Moon"; intro no longer says south pole only. Covers GitHub issue #19. Verified in a browser: a click at the globe centre picked exactly -25.000, 20.000.
- **Done (2026-11-14, Apollo sites):** 6 curated Apollo landing sites (11, 12, 14, 15, 16, 17) added through the normal pipeline: coordinates from NASA Moon Trek landing-site bookmarks (`fetch_trek_sites.py` `LANDING_SITES`, `pick_landing_site`), skylines from `LDEM_128` (`sites.grid_for` picks it outside the polar maps), Horizons 30 d + 365 d cached, precomputed JSON. 14 sites total; existing 8 site files unchanged. Globe opens on the whole-Moon view. User-added points have a "Remove this point" button (`main.js` `removePoint`, `globe.removeSite`). Then 20 more past soft landings (2026-11-14): Luna 9, 13, 16, 17/Lunokhod 1, 20, 21/Lunokhod 2, 24; Surveyor 1, 3, 5, 6, 7; Chang'e 3, 4, 5, 6; Chandrayaan-3; SLIM; Blue Ghost M1; IM-2. Coordinates parsed by code (`fetch_landing_sites.py`) from the raw source of Wikipedia's "List of artificial objects on the Moon", only rows it marks landed/operational, each keeping the source it cites (mostly LROC or NSSDC; Luna 9 and Chang'e 5 have no link there). Left out on purpose: IM-1 (page coordinate cites a social-media post and disagrees with the published site), Luna 23 (same coordinate as Luna 24). IM-2 uses `LDEM_128` until the 40 m polar map is downloaded (override in `sites.py`). 34 sites total. Far-side Chang'e 4 and 6 correctly show Earth 0%.
- **Done (2026-11-14, issues #2, #5, #6):** #2 visibility settings: `analysis/visibility.py` `thresholds()`, `SUN_RULES` (centre / any_part / whole_disc, Sun radius 0.2666 deg) and `earth_margin_deg`; `analyse(..., settings)` and `annotate_events(..., settings)` (event crossing uses the threshold). Defaults reproduce the old numbers exactly (all 34 sites checked); every payload records its `settings`. #5: `src/settings.js` mirrors the Python rules in the browser (cross-checked against the Python output in `settings.test.js`); controls above the scenarios (Sun rule, Earth margin 0 to 5 deg) re-work the scenarios, table and a plain-language "Which is better?" verdict. Yearly sections still use the default rule (stated on the page). #6: curated sites' `sources.horizons_queries` (from the .meta.json files) shown as links in the sources panel, plus a live "Rules in use" sentence.
- **Done (2026-11-14/15, issue #1 part, north pole, review fixes):** `scripts/crosscheck_pgda.py` compares our yearly Sun/Earth % (rule: any part of the disc, Earth radius 0.95 deg) with NASA GSFC PGDA average illumination and Earth visibility maps (Mazarico et al. 2011, 60 m, 85-90 deg, both poles; `data/raw/AVGVISIB_85{S,N}_060M_201608*.IMG`, 51 MB each) and writes `docs/crosscheck-pgda.md` plus `app/public/data/crosscheck.json`. The page shows it: a "Checked against NASA" block per site (`src/accuracy.js` `accuracyNote`, with a landing-accuracy warning where NASA varies a lot within 60 m) and a full "How accurate is this?" section (`accuracyPanel`). Results: 13 polar sites, Sun mean +2.1 points (mean size 3.7), Earth +2.0 (2.4). South: all agree; model site Sun 84% vs NASA 78% (85% at the pixel, 6-85% within 60 m), Earth 54% vs 53%. North (terrain = whole-Moon LDEM_128, ~237 m, coarser): Peary/Hermite agree only within 60 m, Rozhdestvenskiy Sun differs (17% vs 27%). Pixel convention: label offset 2528.5 IS the 0-based centre (an extra -0.5 once shifted the check 30 m; `tests/test_crosscheck.py` guards it). North pole sites added from Moon Trek: Peary, Hermite, Whipple, Rozhdestvenskiy, Byrd (39 sites now); globe has a "North pole view" button. Next for the north: LOLA north polar maps (20/40 m) would need make_skyline polar grids generalised to the north. Still manual for #1: Quickmap profile checks at azimuth 30 and 240. Code review fixes: `custom_point.cached_build` unique temp file per request (threaded server race) and damaged cache files rebuilt (2 tests); escaped one error message in `main.js`.
- **Done (2026-11-15, issue #1: checks beyond the poles):** `scripts/crosscheck_nonpolar.py` writes `app/public/data/checks.json` + `docs/crosscheck-nonpolar.md`. (1) Apollo records: `data/apollo_sun_earth_alsj.json` (Apollo Lunar Surface Journal, Scotti/Fjeld, 42 moments: landings, EVAs, liftoffs) vs Horizons (TLIST, exact times) at our coordinates: mean 0.08 deg, max 0.44 deg (journal's own two calcs differ by up to 0.5). (2) Physics, 112/112 pass on 39 sites: Earth mean DIRECTION altitude = 90 - distance from (0N,0E) - parallax (averaging altitude itself is biased near the sub-Earth point); sunrises 29.53 d apart (|lat|<=60 only); Sun share over WHOLE lunar days = 50% - (sky at az90 + az270)/(360 cos lat) (365 d = 12.36 lunar days, so plain yearly shares carry up to ~1.5 points of part-day bias, stated on the page); near side Earth 100%, far side 0%. (3) Terrain vs NASA LROC NAC stereo DTMs at all 6 Apollo sites (`data/raw/lroc/`, 1.6 GB; PDS ^IMAGE byte offsets are 1-based; Apollo 12 TIFF stores row 0 last, read via TIFF strip table): terrain angles beyond 250 m agree RMS 0.21-0.56 deg (corr 0.85-0.999). Within 250 m LROC shows boulders/small craters up to 12.8 deg at Apollo 12 (7-8 deg at 14/16): shown as a warning. Page: `accuracyNote(entry, site, checks)` shows polar / Apollo / terrain / physics blocks per site; `accuracyPanel` has 4 sections.
- **Not done yet:** polar terrain maps not downloaded on the Mac (only matters for the finest detail near the pole), firmware, Quickmap/Moon Trek cross-check (#1), the CAD script, Darren's lamp-height number (derive from the Sun elevation data).
- **Repo:** https://github.com/Angel-A-V/rally_kart_spaceapps (private; this is the only remote, push here). Work is tracked in GitHub Issues and Milestones.
- **Teammate needs:** Gustavo needs only the skyline CSV (+ `r_wall`, `k`, pedestal height). Darren needs lamp height/distance and spin direction, not the terrain data. Neither needs the ephemeris code.
- **Run it:** needs numpy (`sudo apt install python3-numpy`), then `cd app/python && python3 -m unittest discover -s tests -t . -v`. **All code lives in `app/`; everything outside it is team context.** See `README.md`.
- **Recent commits:** `e7db387` Horizons Sun/Earth fetch, cached data, tests; `efbbbb4` initial commit (plan, LOLA skyline script, tests); `c2efda3` `for_gustavo/` (one-page horizon wall note + copy of `skyline_shackleton_rim.csv`); `a683393` CLAUDE.md update + `docs/handoffs/gustavo-to-angel.md`; `506336e` "Horizon cad file" (Gustavo's `cad/` folder: wall-only STL, SolidWorks wall-top curve .txt files, preview PNG; pulled 2026-11-11, not yet reviewed). All pushed to GitHub.
- **Gustavo handoff (2026-11-10):** Gustavo CADs the wall himself from `for_gustavo/`: horizon only (flat ground), wall top = `pedestal_h + r_wall * k * tan(skyline_deg)`, defaults 140 mm disc, r_wall 60 mm, k = 10, pedestal about 33 mm. His agent's `make_wall.py` never reached this repo (only the `cad/` outputs did, in `506336e`); his note is `docs/handoffs/gustavo-to-angel.md`. Sun elevation at the site stays within about -1.75 to +1.74 deg (for Darren's lamp); Earth mean az about 156 deg (swings 148 to 164). Proposal, to confirm with Darren: photoresistor at eye height at disc centre on a fixed overhead arm, not on the spinning disc. Spin direction still [verify].
- **Moon Trek check (2026-11-11):** NOT done, and optional. Moon Trek's "Site07: Peak Near Shackleton" DEM (Barker et al. 2020, doi:10.1016/j.pss.2020.105119, bbox about 25 to 47 km from the pole) is a different place from our rim pick (6.6 km from the pole); it does not confirm or contradict it. If checking later: Moon Trek labels longitude -180 to 180, so 203.743 E = -156.257; find the line between 155W and 160W about 6.6 km from the pole and read lat -89.781 off the bottom-right readout. Pitch wording: demo site found from NASA LOLA data, not an official landing site.
- **Website planning (next, not started):** Angel wants to plan the website architecture, then a low-fidelity and a high-fidelity Figma wireframe, before any code (planning phase rules still apply). Suggested order: (1) one-page architecture/site-map diagram covering the MUST list (site picker, date picker, Sun/Earth vs horizon diagram, numbers, compare two sites, data sources); (2) low-fi Figma (grey boxes, layout and flow); (3) hi-fi Figma (colour, type, real sample numbers from the Horizons cache). Tools available: Figma MCP (needs the Figma account connected and a team/project to put the file in), plus planning skills (`ecc:architect`, `ecc:frontend-design-direction`, `dataviz`, `design:design-critique`). Ask Angel before creating any Figma file.
- **Repo hygiene:** `.claude/`, `data/raw/`, caches, and the 12 unused challenge PDFs are git-ignored on purpose.

## Open questions (from the plan)

- Which 3 to 5 sites and exact coordinates [verify]
- USB-C supply, monitor, camera for the UNO Q
- Filament type, colors, amount
- Extra SG90 servos and LED strip (optional)
- Read the Resources tab on each challenge page and add links to the plan
- For Scope Check (11:45 Saturday): challenge name (the slides say "CLPS Lunar Mission Browser"), the rule on work done before the start, team lead. See `docs/event-day.md` section 7.
- Does the Liftoff award require using AWS? Ask at the 12:50 workshop (`docs/event-day.md` section 6).
- The repo is private: judges need a link they can open (`docs/event-day.md` submission checklist).
