import test from "node:test";
import assert from "node:assert/strict";
import { idleLevel, IDLE_MS, RAMP_MS } from "./fx.js";

test("idle level is 0 while busy, ramps up, then holds at 1", () => {
  assert.equal(idleLevel(1000, 1000), 0);
  assert.equal(idleLevel(IDLE_MS, 0), 0);
  assert.equal(idleLevel(IDLE_MS + RAMP_MS / 2, 0), 0.5);
  assert.equal(idleLevel(IDLE_MS + RAMP_MS, 0), 1);
  assert.equal(idleLevel(IDLE_MS + RAMP_MS * 5, 0), 1);
});
