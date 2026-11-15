import { test } from "node:test";
import assert from "node:assert/strict";
import { infoTip } from "./infoTip.js";

test("each tip links its button to its own popover", () => {
  const a = infoTip("Sunlight", "<p>x</p>");
  const b = infoTip("Earth", "<p>y</p>");
  const idA = a.match(/popovertarget="([^"]+)"/)[1];
  const idB = b.match(/popovertarget="([^"]+)"/)[1];
  assert.notEqual(idA, idB);
  assert.match(a, new RegExp(`id="${idA}"[^>]*popover`));
  assert.match(a, /aria-label="What is Sunlight\?"/);
});
