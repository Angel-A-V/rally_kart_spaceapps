// Tests for timeline.js. Run from app/:  node --test src/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { advance, eventTicks, ticksHtml } from "./timeline.js";
import { applySettings } from "./settings.js";

const rows = [
  { time_utc: "t0", sun_visible: false, earth_visible: true },
  { time_utc: "t1", sun_visible: true, earth_visible: true },
  { time_utc: "t2", sun_visible: true, earth_visible: false },
  { time_utc: "t3", sun_visible: false, earth_visible: false },
];

test("eventTicks: one tick at each change, named for what happens", () => {
  assert.deepEqual(eventTicks(rows), [
    { index: 1, body: "sun", kind: "sunrise", time: "t1" },
    { index: 2, body: "earth", kind: "earthset", time: "t2" },
    { index: 3, body: "sun", kind: "sunset", time: "t3" },
  ]);
});

test("eventTicks on real data match the rows' own visible/blocked changes", () => {
  const site = JSON.parse(readFileSync(new URL("../public/data/shackleton_rim_analysis.json", import.meta.url), "utf8"));
  const r = applySettings(site.rows);
  const ticks = eventTicks(r);
  for (const t of ticks) assert.notEqual(r[t.index][`${t.body}_visible`], r[t.index - 1][`${t.body}_visible`]);
  const changes = r.slice(1).reduce((n, row, i) => n + (row.sun_visible !== r[i].sun_visible) + (row.earth_visible !== r[i].earth_visible), 0);
  assert.equal(ticks.length, changes);
});

test("ticksHtml: buttons placed by position along the slider, with a readable label", () => {
  const html = ticksHtml(rows);
  assert.match(html, /data-jump="1"/);
  assert.match(html, /left:33\.3\d*%/);
  assert.match(html, /aria-label="Sunrise at t1 UTC"/);
});

test("advance: moves by speed x time, wraps with loop, stops at the end without", () => {
  assert.deepEqual(advance({ index: 0, carry: 0 }, 1000, 6, 720, true), { index: 6, carry: 0, ended: false });
  assert.deepEqual(advance({ index: 0, carry: 0 }, 250, 1, 720, true), { index: 0, carry: 0.25, ended: false });
  assert.deepEqual(advance({ index: 718, carry: 0 }, 1000, 6, 720, true), { index: 3, carry: 0, ended: false }); // rows 0..720: 724 wraps to 3
  assert.deepEqual(advance({ index: 718, carry: 0 }, 1000, 6, 720, false), { index: 720, carry: 0, ended: true });
});
