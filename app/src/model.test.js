// Tests for model.js. Run from app/:  node --test src/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { modelUrl, parseModelAddress } from "./model.js";

test("parseModelAddress: private addresses and .local names only, port optional (default 7000)", () => {
  assert.equal(parseModelAddress("10.35.17.220"), "10.35.17.220:7000");
  assert.equal(parseModelAddress("192.168.1.50:8080"), "192.168.1.50:8080");
  assert.equal(parseModelAddress("172.20.10.4"), "172.20.10.4:7000");      // phone hotspot range
  assert.equal(parseModelAddress(" Moon-Disc.local "), "moon-disc.local:7000");
  assert.equal(parseModelAddress("http://10.0.0.7:7000/"), "10.0.0.7:7000"); // pasted with http:// is fine
  assert.equal(parseModelAddress("localhost:7000"), "localhost:7000");       // for testing on one machine
});

test("parseModelAddress: anything that is not a board on the local network is refused", () => {
  for (const bad of ["8.8.8.8", "evil.example.com", "172.32.0.1", "192.169.1.1", "10.0.0.1:99999", "10.0.0",
    "10.0.0.1/path?x=1", "javascript:alert(1)", "10.0.0.1@evil.com", "a b.local", "", null, undefined, "999.1.1.1"]) {
    assert.equal(parseModelAddress(bad), null, String(bad));
  }
});

test("modelUrl: Sun and Earth together, so both motors move at once", () => {
  const row = { time_utc: "2026-Nov-18 08:00", sun_az_deg: 230.1234, sun_el_deg: 1.36, sun_visible: true,
    earth_az_deg: 149.83, earth_el_deg: -0.66, earth_visible: false };
  const url = new URL(modelUrl("10.35.17.220:7000", "Shackleton rim (model site)", row));
  assert.equal(url.origin, "http://10.35.17.220:7000");
  const q = Object.fromEntries(url.searchParams);
  assert.deepEqual(q, {
    site: "Shackleton rim (model site)", time: "2026-Nov-18 08:00",
    sun_az: "230.1", sun_el: "1.4", sun_up: "1", earth_az: "149.8", earth_el: "-0.7", earth_up: "0",
    az: "230.1", el: "1.4",
  });
});
