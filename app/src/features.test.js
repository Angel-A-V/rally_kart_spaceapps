// Tests for features.js. Run from app/:  node --test src/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOON_KM, isOnNearHalf, minDiameterKm, parseNames } from "./features.js";

test("minDiameterKm: whole Moon shows only big features, close up shows small ones", () => {
  assert.ok(minDiameterKm(3.4) > 150 && minDiameterKm(3.4) < 250);   // maria and the biggest craters
  assert.ok(minDiameterKm(1.55) > 30 && minDiameterKm(1.55) < 60);   // after flying to a site
  assert.ok(minDiameterKm(1.06) < 8);                                 // fully zoomed in
  assert.ok(minDiameterKm(1.0) > 0);                                  // never zero, even on the surface
});

test("parseNames: rows become features with positions on the unit sphere, biggest first", () => {
  const f = parseNames({ features: [["Big", 0, 0, 500, "ME"], ["Tiny", 10, 20, 0, "AA"]] });
  assert.equal(f.length, 2);
  assert.equal(f[0].name, "Big");
  assert.ok(Math.abs(Math.hypot(...f[0].pos) - 1) < 1e-9);
  assert.equal(f[1].d, 1); // a 0 km feature counts as 1 km, so it appears only when zoomed right in
  assert.equal(f[0].big, true);
  assert.equal(parseNames(null).length, 0);
});

test("isOnNearHalf: a point is visible only on the side of the Moon facing the camera", () => {
  assert.equal(isOnNearHalf([0, 0, 1], [0, 0, 3]), true);
  assert.equal(isOnNearHalf([0, 0, -1], [0, 0, 3]), false);
  assert.equal(isOnNearHalf([1, 0, 0], [0, 0, 3]), false); // on the limb: hidden (label would sit off the edge)
});

test("the real names file loads and includes the model site's crater", () => {
  const data = JSON.parse(readFileSync(new URL("../public/data/lunar_names.json", import.meta.url), "utf8"));
  const f = parseNames(data);
  assert.ok(f.length > 4000);
  assert.ok(f.some((x) => x.name === "Shackleton"));
  for (let i = 1; i < f.length; i++) assert.ok(f[i - 1].d >= f[i].d, "sorted biggest first");
  assert.equal(MOON_KM, 1737.4);
});
