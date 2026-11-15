// Tests for settings.js. Run from app/:  node --test src/*.test.js
// The cross-check loads a real site file made by Python and confirms the browser re-computes exactly
// the same visible/blocked states and (to rounding) the same next sunset/earthset times.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUN_RADIUS_DEG, applySettings, compareVerdict, summarise, thresholds } from "./settings.js";

const row = (sunMargin, earthMargin, t = "2026-Nov-10 00:00") => ({
  time_utc: t, sun_margin_deg: sunMargin, earth_margin_deg: earthMargin,
});

test("thresholds: defaults and the three Sun rules", () => {
  assert.deepEqual(thresholds(), { sun: 0, earth: 0 });
  assert.equal(thresholds({ sunRule: "any_part", earthMarginDeg: 0 }).sun, -SUN_RADIUS_DEG);
  assert.equal(thresholds({ sunRule: "whole_disc", earthMarginDeg: 2 }).earth, 2);
  assert.throws(() => thresholds({ sunRule: "half", earthMarginDeg: 0 }));
  assert.throws(() => thresholds({ sunRule: "centre", earthMarginDeg: -1 }));
});

test("applySettings: a half-set Sun and a low Earth", () => {
  const rows = [row(-0.1, 1.5)];
  const centre = applySettings(rows, { sunRule: "centre", earthMarginDeg: 0 })[0];
  const anyPart = applySettings(rows, { sunRule: "any_part", earthMarginDeg: 2 })[0];
  assert.equal(centre.sun_visible, false);
  assert.equal(centre.earth_visible, true);
  assert.equal(anyPart.sun_visible, true);
  assert.equal(anyPart.earth_visible, false); // 1.5 deg is under the 2 deg safety margin
  assert.equal(anyPart.both_visible, false);
});

test("applySettings: the earthset moves to where the margin crosses the threshold", () => {
  const rows = [row(5, 3), row(5, 1, "01:00")];
  assert.equal(applySettings(rows)[0].earth_event_hours, null); // never sets with no margin
  const withMargin = applySettings(rows, { sunRule: "centre", earthMarginDeg: 2 });
  assert.equal(withMargin[0].earth_event, "earthset");
  assert.ok(Math.abs(withMargin[0].earth_event_hours - 0.5) < 1e-9);
});

test("applySettings does not change the rows it was given", () => {
  const rows = [row(-0.1, 1)];
  applySettings(rows, { sunRule: "any_part", earthMarginDeg: 0 });
  assert.equal(rows[0].sun_visible, undefined);
});

test("cross-check with Python: defaults reproduce the precomputed site file", () => {
  const file = new URL("../public/data/shackleton_rim_analysis.json", import.meta.url);
  const site = JSON.parse(readFileSync(file, "utf8"));
  const again = applySettings(site.rows);
  site.rows.forEach((r, i) => {
    for (const body of ["sun", "earth"]) {
      assert.equal(again[i][`${body}_visible`], r[`${body}_visible`], `${body} visible, row ${i}`);
      assert.equal(again[i][`${body}_event`], r[`${body}_event`], `${body} event, row ${i}`);
      const a = again[i][`${body}_event_hours`];
      const b = r[`${body}_event_hours`];
      // Python rounds the stored margins to 4 decimals, so allow a tiny difference.
      assert.ok(a === b || Math.abs(a - b) < 0.02, `${body} event hours, row ${i}: ${a} vs ${b}`);
    }
  });
});

test("summarise and compareVerdict pick the site with more time with both up", () => {
  const up = (n, total) => Array.from({ length: total }, (_, i) => ({
    time_utc: `t${i}`, sun_visible: i < n, earth_visible: i < n, both_visible: i < n,
  }));
  const a = { name: "A", label: "Site 1", rows: up(6, 10) };
  const b = { name: "B", label: "Site 2", rows: up(3, 10) };
  a.row = a.rows[0];
  b.row = b.rows[9];
  assert.deepEqual(summarise(a.rows), { sun: 60, earth: 60, both: 60 });
  const text = compareVerdict(a, b);
  assert.match(text, /A \(Site 1\) is better/);
  assert.match(text, /60% of the time vs 30%/);
  const same = compareVerdict(a, { ...b, label: "Site 1" });
  assert.match(same, /Same site at two moments/);
});
