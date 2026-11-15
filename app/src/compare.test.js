// Tests for compare.js. Run from app/:  node --test src/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { atAGlance } from "./compare.js";

const side = (name, label, up, total, year) => {
  const rows = Array.from({ length: total }, (_, i) => ({
    time_utc: `t${i}`, sun_visible: i < up, earth_visible: i < up, both_visible: i < up,
    sun_event: "sunset", sun_event_hours: 5, earth_event: "earthset", earth_event_hours: null, earth_window_hours: 10,
  }));
  return { name, label, rows, row: rows[0], year };
};

test("atAGlance: a row per question, the better side marked, never colour alone", () => {
  const a = side("A", "Rim", 6, 10, { both_visible_pct: 41, longest_both_visible_hours: 340 });
  const b = side("B", "Crater", 3, 10, { both_visible_pct: 0, longest_both_visible_hours: 0 });
  const html = atAGlance(a, b);
  for (const q of ["Sun now", "Earth now", "Next Sun change", "Both up, these 30 days", "Both up, over the year", "Longest stretch with both"]) {
    assert.match(html, new RegExp(q));
  }
  assert.match(html, /60%/);
  assert.match(html, /30%/);
  assert.match(html, /class="better"[^>]*>41%/);  // the better value is marked (bold + word for screen readers)
  assert.match(html, /better<\/span>/);
});

test("atAGlance: equal values mark neither side", () => {
  const a = side("A", "X", 5, 10, { both_visible_pct: 20, longest_both_visible_hours: 50 });
  const html = atAGlance(a, { ...a, name: "B" });
  assert.doesNotMatch(html, /class="better"/);
});
