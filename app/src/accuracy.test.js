// Tests for accuracy.js. Run from app/:  node --test src/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accuracyNote, accuracyPanel } from "./accuracy.js";

const entry = (over = {}) => ({
  pole: "south",
  ours: { sun: 84, earth: 54 },
  nasa: { sun: { at: 78, min: 6, max: 85 }, earth: { at: 53, min: 29, max: 55 } },
  diff: { sun: 6, earth: 1 },
  verdict: { sun: "agrees_within_60m", earth: "agrees" },
  ...over,
});
const site = (lat, id = "x") => ({ id, lat_deg: lat, label: "X" });

test("a ridge site warns that landing accuracy matters", () => {
  const html = accuracyNote(entry(), site(-89.8));
  assert.match(html, /Landing accuracy matters here/);
  assert.match(html, /Sun 6%–85%/);
  assert.match(html, /agrees only within 60 m/);
});

test("a site that differs says by how much", () => {
  const e = entry({ verdict: { sun: "differs", earth: "agrees" }, diff: { sun: -10, earth: 0 },
    nasa: { sun: { at: 27, min: 24, max: 28 }, earth: { at: 0, min: 0, max: 0 } }, pole: "north" });
  const html = accuracyNote(e, site(85.5));
  assert.match(html, /differs from NASA's by\s+10 points/);
  assert.match(html, /North pole/);
  assert.doesNotMatch(html, /Landing accuracy/);
});

const read = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));

test("points you add say they are not checked one by one", () => {
  assert.match(accuracyNote(undefined, site(-89, "custom_s89")), /points you add/);
  assert.match(accuracyNote(undefined, site(10, "custom_n10"), read("checks.json")), /points you add/);
});

test("every curated site shows at least one check from the real files", () => {
  const check = read("crosscheck.json");
  const checks = read("checks.json");
  for (const s of read("sites.json")) {
    const html = accuracyNote(check.sites[s.id], s, checks);
    assert.doesNotMatch(html, /Not checked/, `${s.id} has no check`);
  }
});

test("Apollo sites show the journal and LROC terrain checks; Apollo 12 warns about nearby craters", () => {
  const checks = read("checks.json");
  const sites = read("sites.json");
  const a12 = accuracyNote(undefined, sites.find((s) => s.id === "apollo_12"), checks);
  assert.match(a12, /Apollo records/);
  assert.match(a12, /LROC stereo model/);
  assert.match(a12, /Small craters and boulders nearby/);
  const a11 = accuracyNote(undefined, sites.find((s) => s.id === "apollo_11"), checks);
  assert.doesNotMatch(a11, /Small craters and boulders nearby/);
  const far = accuracyNote(undefined, sites.find((s) => s.id === "change_4"), checks);
  assert.match(far, /Physics checks/);
  assert.match(far, /far side: never/);
});

test("the panel lists every polar site and all four kinds of check", () => {
  const check = read("crosscheck.json");
  const sites = read("sites.json");
  const html = accuracyPanel(check, sites, read("checks.json"));
  for (const id of Object.keys(check.sites)) {
    assert.ok(html.includes(sites.find((s) => s.id === id).label), `${id} missing`);
  }
  for (const h of ["Polar sites", "Apollo records", "LROC stereo terrain", "physics rules"]) {
    assert.match(html, new RegExp(h));
  }
  assert.equal(accuracyPanel(null, sites, null), "");
});
