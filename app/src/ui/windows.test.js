import { test } from "node:test";
import assert from "node:assert/strict";
import { clampRect } from "./windows.js";

test("a panel inside the window is left where it is", () => {
  assert.deepEqual(clampRect({ left: 100, top: 80, width: 388, height: 600 }, 1440, 900),
    { left: 100, top: 80, width: 388, height: 600 });
});

test("a panel dragged past an edge stops at the margin", () => {
  const r = clampRect({ left: -200, top: 2000, width: 388, height: 600 }, 1440, 900);
  assert.equal(r.left, 8);
  assert.equal(r.top, 900 - 600 - 8);
});

test("a panel bigger than the window shrinks to fit", () => {
  const r = clampRect({ left: 0, top: 0, width: 3000, height: 2000 }, 1440, 900);
  assert.deepEqual(r, { left: 8, top: 8, width: 1424, height: 884 });
});
