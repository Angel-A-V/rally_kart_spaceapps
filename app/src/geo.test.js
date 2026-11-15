// Tests for geo.js. Run from app/:  node --test src/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { latLonToXyz, xyzToLatLon, tileGrid, tileUrl } from "./geo.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);
const closeXyz = (got, want) => want.forEach((w, i) => close(got[i], w));

test("latLonToXyz: lon 0, lat 0 (centre of the near side) is +x", () => {
  closeXyz(latLonToXyz(0, 0), [1, 0, 0]);
});

test("latLonToXyz: the poles are on the y axis", () => {
  closeXyz(latLonToXyz(90, 0), [0, 1, 0]);
  closeXyz(latLonToXyz(-90, 123), [0, -1, 0]);
});

test("latLonToXyz: 90 degrees east is -z (matches how three.js wraps a map centred on lon 0)", () => {
  closeXyz(latLonToXyz(0, 90), [0, 0, -1]);
  closeXyz(latLonToXyz(0, 270), [0, 0, 1]);
  closeXyz(latLonToXyz(0, -90), [0, 0, 1]);
});

test("latLonToXyz: radius scales the point", () => {
  closeXyz(latLonToXyz(0, 0, 2.5), [2.5, 0, 0]);
  const [x, y, z] = latLonToXyz(-89.781, 203.743, 1.01);
  close(Math.hypot(x, y, z), 1.01);
});

test("xyzToLatLon: undoes latLonToXyz, with longitude given as 0 to 360 east", () => {
  for (const [lat, lon] of [[0, 0], [-84.81, 38.15], [-89.781, 203.743], [45, 359.5], [-30, 180]]) {
    const back = xyzToLatLon(...latLonToXyz(lat, lon, 3));
    close(back.lat, lat, 1e-9);
    close(back.lon, lon, 1e-9);
  }
});

test("xyzToLatLon: a negative longitude comes back as east longitude", () => {
  close(xyzToLatLon(...latLonToXyz(10, -90)).lon, 270);
});

test("tileGrid: Moon Trek's layout doubles each zoom level, two tiles wide at zoom 0", () => {
  assert.deepEqual(tileGrid(0), { cols: 2, rows: 1 });
  assert.deepEqual(tileGrid(3), { cols: 16, rows: 8 });
});

test("tileUrl: zoom / row / column, in that order", () => {
  assert.equal(
    tileUrl(2, 1, 5),
    "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/2/1/5.jpg"
  );
});

test("flightPoint: starts and ends where asked, never dips inside the Moon", async () => {
  const { flightPoint } = await import("./geo.js");
  const from = [0, 0, 3.4];
  const to = latLonToXyz(-89.8, 203.7, 1.55);
  for (const [i, v] of flightPoint(from, to, 0).entries()) assert.ok(Math.abs(v - from[i]) < 1e-9);
  for (const [i, v] of flightPoint(from, to, 1).entries()) assert.ok(Math.abs(v - to[i]) < 1e-9);
  for (let t = 0; t <= 1; t += 0.05) assert.ok(Math.hypot(...flightPoint(from, to, t)) >= 1.5, `inside at t=${t}`);
});

test("flightPoint: an exactly opposite target still gives a defined path around the Moon", async () => {
  const { flightPoint } = await import("./geo.js");
  for (let t = 0; t <= 1; t += 0.1) {
    const p = flightPoint([0, 0, 2], [0, 0, -2], t);
    assert.ok(p.every(Number.isFinite), `NaN at t=${t}`);
    assert.ok(Math.hypot(...p) >= 2 - 1e-9);
  }
});

test("detailWindow: close to an equatorial site, a small window of the sharpest tiles", async () => {
  const { detailWindow } = await import("./geo.js");
  const w = detailWindow(0.67, 23.47, 3);
  assert.equal(w.zoom, 7);
  assert.ok(w.latS <= 0.67 - 3 && w.latN >= 0.67 + 3);
  assert.ok(w.lonW <= 23.47 - 3 && w.lonE >= 23.47 + 3);
  assert.ok(w.rows <= 8 && w.cols * w.tileW <= 4096);
});

test("detailWindow: over a pole it takes every longitude, squeezing tiles to fit", async () => {
  const { detailWindow } = await import("./geo.js");
  const w = detailWindow(-89.9, 0, 18);
  assert.equal(w.lonE - w.lonW, 360);
  assert.equal(w.latS, -90);
  assert.ok(w.zoom >= 4 && w.zoom > 3, "sharper than the base picture");
  assert.ok(w.cols * w.tileW <= 4096 && w.tileW >= 32);
});

test("detailWindow: nothing to load when the whole Moon is in view", async () => {
  const { detailWindow } = await import("./geo.js");
  assert.equal(detailWindow(0, 0, 60, { maxRows: 2 }), null);
});

test("sunDirection: Sun overhead points straight up from the site; on the eastern horizon points east", async () => {
  const { sunDirection } = await import("./geo.js");
  closeXyz(sunDirection(10, 30, 0, 90), latLonToXyz(10, 30));
  closeXyz(sunDirection(0, 0, 90, 0), latLonToXyz(0, 90));   // from 0 N 0 E, due east is 90 E
  closeXyz(sunDirection(0, 0, 0, 0), latLonToXyz(90, 0));    // due north is the north pole
});

test("sunDirection: two very different sites agree on where the Sun is (real NASA Horizons rows)", async () => {
  const { sunDirection } = await import("./geo.js");
  const { readFileSync } = await import("node:fs");
  const load = (id) => JSON.parse(readFileSync(new URL(`../public/data/${id}_analysis.json`, import.meta.url), "utf8"));
  const sites = JSON.parse(readFileSync(new URL("../public/data/sites.json", import.meta.url), "utf8"));
  const dir = (id, i) => {
    const s = sites.find((x) => x.id === id);
    const r = load(id).rows[i];
    return sunDirection(s.lat_deg, s.lon_deg_east, r.sun_az_deg, r.sun_el_deg);
  };
  for (const i of [0, 200, 500, 720]) {
    const a = dir("shackleton_rim", i);
    const b = dir("apollo_11", i);
    const c = dir("peary", i);
    const angle = (p, q) => (Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])) * 180) / Math.PI;
    assert.ok(angle(a, b) < 0.1, `rim vs Apollo 11 at row ${i}: ${angle(a, b)} deg`);
    assert.ok(angle(a, c) < 0.1, `rim vs Peary at row ${i}: ${angle(a, c)} deg`);
  }
});
