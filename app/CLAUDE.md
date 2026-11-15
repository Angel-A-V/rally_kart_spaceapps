# app/CLAUDE.md: UI and design guide (read this before touching anything in app/)

This file is for any agent or teammate helping with the website. The repo-wide rules are in the root
`CLAUDE.md` (no Claude co-author lines in commits, push only to `rally_kart_spaceapps`, commit only when
asked). This file covers how the website should LOOK and BEHAVE, and how to change it without
breaking anyone else's work.

## Status (2026-11-15)

- Branch: **`ui-overhaul`**. `main` stays demo-safe; merge only when the overhaul is better than `main`.
- Deadline: submission 1:30 PM Sunday 2026-11-15; hardware go/no-go 9:30 AM.
- Phases (in order of demo value):
  1. Full-screen Moon + ☰ menu + floating panels. **done**
  2. Fly-to animation, pulsing pin, slide-in analysis panel, right-click "Analyse this point". **done**
  3. IAU feature names that appear as you zoom (Moon Trek style). **done** (`src/features.js`,
     `public/data/lunar_names.json` from `app/python/scripts/fetch_lunar_names.py`)
  4. Compare mode: "A vs B at a glance", "Same time" box, play/pause timeline (Gustavo's wireframe v2,
     `docs/handoffs/gustavo-wireframe-v2.md`). **done** (`src/compare.js`, `src/timeline.js`; the
     player and event ticks are on the analysis panel's slider and both compare cards)
  5. Polish. **partly done:** sharp close-ups (a patch of higher-zoom Moon Trek tiles loads for the area
     in view once the camera rests: `detailWindow` in `src/geo.js`, `updatePatch` in `src/globe.js`),
     flat dot-and-ring markers, centred pole views, San Francisco type. day/night shading from the real Sun position (on/off) and the LOLA elevation layer (on/off) are in the bottom bar.
- Update this list when you finish or start a phase.

## Design direction (the contract)

- **Purpose:** pick a landing site and a time; see whether the Sun (power) and Earth (direct radio link)
  are above the local skyline, and how good the site is over a year.
- **Audience:** hackathon judges in an 8-minute live demo, and curious public users. First screen must
  show the Moon and make clicking it obvious.
- **Tone:** calm mission control. Near-black space, cool neutral glass panels, one typeface (San
  Francisco). Technical, not flashy.
- **Memorable detail:** the descent. Clicking a site or point flies the camera down to it, a pin pulses,
  and the analysis panel slides in with that spot's live horizon strip. A small readout always shows the
  latitude/longitude under the cursor.
- **Inspiration:** https://github.com/smford/fly-around-the-moon (full-screen globe, glass panels,
  quick-orientation toolbar, landmark jump). It is **AGPL-3.0: take ideas only, never copy its code**
  (and the Space Apps prior-work rule). Its NASA textures are public domain if we ever need them.

## Visual rules

- **Colour tokens live in `src/style.css` `:root`** (always dark). Never hard-code colours elsewhere.
  - Data colours, and ONLY for data: Sun `--sun` (orange), Earth `--earth` (blue), both `--both` (green).
    Sun and Earth were checked with the dataviz palette validator; keep them.
  - Status: `--yes` green, `--no` red, `--warn` amber. Always pair colour with a word or ✓/✗.
  - Markers on the globe: named feature blue, model site orange, your points green, working-on-it yellow,
    selected white (see `COLORS` in `src/globe.js`; keep the legend in sync).
- **Glass panels:** `--glass` background + `backdrop-filter: blur()` + 1px `--glass-line` border,
  rounded 12 px. No cards inside cards. No gradients, glows or decorative blobs.
- **Type:** San Francisco via `--font` (`-apple-system` first; other systems fall back to their UI font).
  No monospace, no tracked uppercase; numbers use `tabular-nums`. Headings small and quiet; the Moon is
  the hero. Angel's feedback 2026-11-15: mono readouts and letter-spaced caps "look straight AI".
- **Motion:** only to explain a change of state (fly-to, panel slide, pin pulse). Respect
  `prefers-reduced-motion`: jump instead of flying, no pulsing.
- **Copy:** plain English for non-experts; explain jargon once (glossary). Never describe a feature in the
  UI when the control already says it.

## Layout map (desktop; under 760 px the panels become bottom sheets)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [☰] Lunar Landing Site Navigator        [search sites…]             │  .hud-top
│                                                                      │
│ ┌ drawer (☰) ┐      full-screen 3D Moon (#globe)    ┌ analysis ┐    │
│ │ Sites       │                                       │ panel    │    │  #drawer (left)
│ │ Compare     │   ┌ sheet: the page for the menu    │ (#panel) │    │  #sheet (left, wide)
│ │ Add a point │   │ item (plan, compare, tables…)   │          │    │  #panel (right)
│ │ Plan…       │   └──────────────────────────────    └──────────┘    │
│ └─────────────┘                                                      │
│ [Near][Far][South pole][North pole][Whole Moon]   lat/lon readout   │  .quick-views, #readout
└──────────────────────────────────────────────────────────────────────┘
```

- Left click a marker: fly there, open its analysis panel.
- Left click bare surface: fly there, drop a pin, panel offers "Analyse this point".
- Right click (or long press) anywhere: context menu "Analyse this point" / "Fly here" / "Copy
  coordinates". The "Add a point" menu page is the keyboard/touch alternative.
- Esc closes the context menu, then the sheet, then the drawer.

## Who owns what (to avoid two agents editing the same file)

| File | Owns | Notes |
|---|---|---|
| `src/main.js` | page shell, state (`view`), wiring of events, menu/sheet/panel switching | the busiest file: coordinate before big edits |
| `src/globe.js` | three.js scene, markers, labels, fly-to, pins, picking, right-click, hover readout | API below; keep it free of page HTML |
| `src/style.css` | all styling and tokens | group new rules under a comment per component |
| `src/data.js` | the only file that fetches | add loaders here, nowhere else |
| `src/settings.js` | visibility rules in the browser (mirror of Python) | pure; tested against Python output |
| `src/accuracy.js`, `planPanel.js`, `statsPanel.js`, `skyDiagram.js`, `numbersPanel.js`, `siteInfo.js`, `tableView.js` | content panels: data in, HTML out | pure functions; reuse them in new layouts instead of rewriting |
| `src/geo.js`, `format.js` | small helpers | pure, tested |
| `app/public/data/*.json` | made by Python (`app/python/scripts/`) | never edit by hand; re-run the script |

New UI pieces go in their own pure modules (for example `src/ui/contextMenu.js`, `src/features.js`)
with a `*.test.js` next to them.

## Globe API (`src/globe.js`)

```js
const globe = createGlobe(container, sites, {
  onSelect(siteId),            // marker clicked
  onPick(lat, lon),            // bare surface left-clicked
  onContext(lat, lon, x, y),   // right-click / long press on the surface (screen x, y for the menu)
  onHover(lat, lon | null),    // cursor over the surface (for the readout)
});
globe.select(siteId)           // highlight a marker (white, bigger)
globe.flyTo(lat, lon, dist?)   // eased camera flight (instant with reduced motion)
globe.setView("near" | "far" | "pole" | "north" | "moon")   // poles are centred on the pole; whole-Moon
                               // views pick the distance that fits the free space (fitDistance)
globe.addSite(site) / removeSite(id)
globe.markPending(lat, lon) / markPending(null)   // yellow dot while the backend works
globe.setPin(lat, lon) / setPin(null)             // pulsing ring on the selected site or clicked point
globe.setSun([x, y, z] | null)                     // day/night shading; direction from geo.js sunDirection
globe.setLayer("photo" | "lola")                   // the picture the Moon wears (geo.js LAYERS)
globe.setInset(rightPx, bottomPx)                  // centre the Moon beside a panel / above a bottom sheet
```

## States every panel must handle

| State | What the user sees |
|---|---|
| Loading | Moon preview tiles first, then sharp tiles; panels show "Analysing… asking NASA JPL Horizons" |
| Empty | No site chosen: panel hint "Click a site, or right-click anywhere on the Moon" |
| Error | Backend down / Horizons failed: the exact message and what to do (start the backend, try again) |
| Partial | Custom point with no terrain map: "flat horizon" clearly labelled; sites NASA's maps don't cover say so |
| Success | Analysis panel with numbers, sky strip, accuracy check; point added to every picker |
| No WebGL | Globe replaced by a message; menu pages still work |

## How to check your change (before you say it works)

```bash
cd app && node --test src/*.test.js            # JS tests (all must pass)
cd app/python && ../../.venv/bin/python -m unittest discover -s tests   # Python tests
cd app && npm run build                        # must build
```

- Run it: backend `.venv/bin/python app/python/server/app.py` (port 8000), then `cd app && npm run dev`
  (http://localhost:5173, proxies /api).
- Look at it in a real browser at **1440x900 and 390x844**: no console errors, keyboard can reach the
  menu and close everything with Esc, text does not overflow, focus is visible.
- ECC skills that fit: `frontend-design-direction` (this contract), `frontend-a11y`, `browser-qa`,
  `make-interfaces-feel-better`, `motion-patterns`, `tdd-workflow` for pure modules, `code-review` before
  merging.

## Do not

- Do not switch frameworks (no React / R3F): vanilla three.js + Vite on purpose, for the deadline.
- Do not add dependencies for a visual flourish.
- Do not change numbers or analysis in the UI: the data comes from Python and is cross-checked
  (`docs/crosscheck-*.md`). The UI only displays it.
- Do not remove the accuracy warnings (landing accuracy, small craters, north-pole coarse terrain): they
  are deliberate and part of our Validity story.
