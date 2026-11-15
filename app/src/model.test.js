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

test("modelUrl: the address the board's page expects", () => {
  assert.equal(
    modelUrl("10.35.17.220:7000", { site: "Shackleton rim (model site)", az: 123.4321, el: -1.26 }),
    "http://10.35.17.220:7000/?site=Shackleton+rim+%28model+site%29&az=123.4&el=-1.3");
  assert.match(modelUrl("moon.local:7000", { site: "X", az: 5, el: 1, cmd: "EARTH" }), /&cmd=EARTH$/);
});
