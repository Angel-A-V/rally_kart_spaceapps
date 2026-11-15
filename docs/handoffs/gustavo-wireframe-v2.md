# Wireframe v2: critique updates (Gustavo to Angel)

Updated 2026-11-14. Low-fi wireframe of the web app, redrawn from the current build in `app/src/` and changed to
address the critique we got. This is a design proposal only: no code in `app/` has changed.

**Wireframe:** https://claude.ai/artifact/DoDMTKogiEiMQyzAks24Pw (two boards: the full page, and close-ups of
each change). The Figma file (Lunar Landing Site Navigator – Low-Fi Wireframe) has not been updated yet.

## What the wireframe keeps from the current app

The section order and content match `main.js`: globe and site info, Plan a mission (mission length, verdict, year
timeline, top windows), full-year table, the "look at one moment" analysis, the hourly table view, and data sources.

## The four changes (marked NEW in the wireframe)

1. **Info buttons on jargon.** A small (i) after terms a newcomer may not know opens a one-sentence meaning.
   Terms: azimuth, elevation, skyline, margin, window, UTC, Sun-dark stretch, both visible (plus libration, LOLA
   and Horizons in the sources). A Glossary button in the top bar lists them all.
2. **Analyze one point by default.** The analysis section shows one card (one site, one time). A **Compare**
   checkbox in the card's top-right corner (like a shopping app's compare box) adds a second card.
3. **Scenario A and B.** With Compare ticked, Scenario A and B sit side by side, with an "A vs B at a glance"
   table under them (Sun now, Earth now, next change, both visible over the year, which is better). A "Same time
   for A and B" checkbox lets one time control drive both cards; unticked, each card has its own slider.
4. **Simulation on the time slider.** The slider stays, with Play/Pause, step one hour back or forward, speed
   (1 h, 6 h or 1 day per second), Loop, and tick marks for sunrise, sunset, earthrise and earthset (click to
   jump).

## Notes for building it (if we go ahead)

- Change 2 is mostly in `main.js`: start with one slot, render slot B only when Compare is ticked.
- Change 4: the 30-day data is hourly. For smooth playback, blend azimuth and elevation linearly between two
  rows each animation frame (handle the 359° to 0° wrap) and check against the skyline at the blended azimuth.
  `skyDiagram()` already takes one row, so a blended row object should drop straight in.
- Change 1: one glossary object (term to sentence) shared by every (i) button keeps the wording consistent.
  Make the tap area at least 44 px even though the dot is drawn smaller.
- Any of these would go through a branch and pull request, per CLAUDE.md.

## Questions for Angel

- Which of the four do we build before the 1:00 PM Sunday submission target, and which stay as "future work" in
  the demo?
- Should the simulation bar be shared by A and B by default (current wireframe), or should each card start with
  its own?
