// How accurate is this? Our numbers checked against independent NASA sources (GitHub issue #1).
// Pure functions: the check files in, HTML text out.
//   crosscheck.json (scripts/crosscheck_pgda.py): NASA Goddard's polar Sun/Earth visibility maps, 85-90 deg.
//   checks.json (scripts/crosscheck_nonpolar.py): Apollo Lunar Surface Journal Sun/Earth angles, LROC stereo
//     terrain at the Apollo sites, and physics rules every site must obey.
// Where a check does not apply, the page says so instead of hiding it.

const VERDICT = {
  agrees: { text: "agrees", cls: "yes" },
  agrees_within_60m: { text: "agrees only within 60 m", cls: "warn" },
  differs: { text: "differs", cls: "no" },
};
const BODY = { sun: "Sun", earth: "Earth" };
const pct = (v) => `${Math.round(v)}%`;
const range = (n) => `${pct(n.min)}–${pct(n.max)}`;
const deg = (v, d = 2) => `${Number(v).toFixed(d)}°`;
const mark = (ok) => (ok ? `<span class="yes">✓</span>` : `<span class="no">✗</span>`);
const NEAR_WARN_DEG = 5; // small craters and boulders this steep near the point are worth a warning

// NASA's polar maps (south and north pole sites).
function polarBlock(entry) {
  const rows = ["sun", "earth"].map((b) => {
    const v = VERDICT[entry.verdict[b]];
    return `<tr><th>${BODY[b]}</th><td>${pct(entry.ours[b])}</td><td>${pct(entry.nasa[b].at)}
      <span class="sub">(${range(entry.nasa[b])} within 60 m)</span></td><td class="${v.cls}">${v.text}</td></tr>`;
  }).join("");
  const warnings = [];
  for (const b of ["sun", "earth"]) {
    const n = entry.nasa[b];
    if (entry.verdict[b] === "agrees_within_60m" || n.max - n.min >= 20) warnings.push(`${BODY[b]} ${range(n)}`);
  }
  const warn = warnings.length
    ? `<p class="accuracy-warn"><strong>Landing accuracy matters here.</strong> Within 60 m of this point NASA's map
       gives ${warnings.join(" and ")} of the time, so a lander needs to touch down within about 60 m to get the
       numbers shown.</p>`
    : "";
  const off = ["sun", "earth"].filter((b) => entry.verdict[b] === "differs");
  const differs = off.length
    ? `<p class="accuracy-warn">Our ${off.map((b) => BODY[b]).join(" and ")} figure differs from NASA's by
       ${off.map((b) => `${Math.abs(entry.diff[b]).toFixed(0)} points`).join(" and ")}: treat it as uncertain by that much.</p>`
    : "";
  const coarse = entry.pole === "north"
    ? `<p class="sub">North pole: our terrain here is the whole-Moon map (about 237 m per pixel), coarser than
       NASA's 60 m, so expect larger gaps than at the south pole.</p>`
    : "";
  return `
    <p class="check-title"><strong>NASA polar illumination maps</strong> (Mazarico et al. 2011)</p>
    <table class="numbers accuracy">
      <thead><tr><th></th><th>Ours (1 year)</th><th>NASA (18.6-year average)</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="sub">Both count the Sun or Earth as visible when any part of its disc shows, so ours here can differ a
    little from the yearly figure above (which uses the Sun's centre).</p>
    ${warn}${differs}${coarse}`;
}

// Apollo Lunar Surface Journal: Sun and Earth angles at the landing, EVAs and liftoff.
function apolloBlock(mission) {
  const w = mission.max_abs_diff_deg;
  const worst = Math.max(w.sun_alt, w.sun_az, w.earth_alt, w.earth_az);
  return `
    <p class="check-title">${mark(mission.agrees)} <strong>Apollo records</strong> (NASA Apollo Lunar Surface Journal)</p>
    <p class="sub">The Sun's and Earth's positions at all ${mission.events.length} recorded moments of ${mission.mission}
    (landing, moonwalks, liftoff) match the journal within ${deg(worst)}. At landing: Sun ${deg(mission.events[0].ours.sun_alt, 1)}
    high here, ${deg(mission.events[0].nasa.sun_alt, 1)} in the journal.</p>`;
}

// LROC stereo terrain at the Apollo sites.
function terrainBlock(t) {
  if (!t.covered) return `<p class="sub">LROC terrain model: ${t.note}.</p>`;
  const d = t.terrain_angle_diff_deg;
  const near = t.near_field_max_deg >= NEAR_WARN_DEG
    ? `<p class="accuracy-warn"><strong>Small craters and boulders nearby.</strong> Within 250 m of this point the
       2 m LROC model has terrain up to ${deg(t.near_field_max_deg, 1)} above ground level in some directions, too
       small for our whole-Moon map. A lander standing a few metres tall sees over most of it; a rover at ground
       level would lose some Sun early and late in the day.</p>`
    : "";
  return `
    <p class="check-title">${mark(d.rms <= 1)} <strong>Terrain</strong> (NASA LROC stereo model, ${t.pixel_m} m per pixel)</p>
    <p class="sub">A different instrument (camera stereo, not the LOLA laser). Over ${t.directions_compared} directions,
    out to ${t.reach_km.min}–${t.reach_km.max} km, the steepest terrain angle beyond 250 m matches ours within
    ${deg(d.rms)} on average (largest gap ${deg(d.max_abs)}).</p>
    ${near}`;
}

// Physics rules (every curated site).
function physicsBlock(p) {
  const fmt = (v, unit) => `${Number(v).toFixed(unit.trim() === "d" ? 2 : 1)}${unit}`;
  const items = p.checks.map((c) =>
    `<li>${mark(c.ok)} ${c.name}: ${fmt(c.ours, c.unit)} <span class="sub">(expected ${fmt(c.expected, c.unit)}: ${c.rule})</span></li>`).join("");
  return `
    <p class="check-title">${mark(p.all_ok)} <strong>Physics checks</strong></p>
    <ul class="check-list">${items}</ul>`;
}

// The block under a site's numbers next to the globe.
// entry: crosscheck.sites[id] or undefined; checks: the whole checks.json (or null).
export function accuracyNote(entry, site, checks = null) {
  const parts = [];
  if (entry) parts.push(polarBlock(entry));
  const mission = checks?.apollo?.missions.find((m) => m.site === site.id);
  if (mission) parts.push(apolloBlock(mission));
  const terrain = checks?.terrain?.sites[site.id];
  if (terrain) parts.push(terrainBlock(terrain));
  const physics = checks?.physics?.sites[site.id];
  if (physics) parts.push(physicsBlock(physics));
  if (!parts.length) {
    const why = site.id.startsWith("custom_")
      ? "points you add are computed the same way as the curated sites, but are not checked one by one."
      : "no independent check has been run for this site yet.";
    return `<h4>Checked against NASA</h4><p class="sub">Not checked: ${why}</p>`;
  }
  if (!entry && !mission && !terrain) {
    const outside = Math.abs(site.lat_deg) >= 83.5 ? " (this site is just outside them)" : "";
    parts.push(`<p class="sub">The other checks do not reach this site: NASA's published Sun and Earth maps cover
      only 85–90° at the poles${outside}, and the stereo terrain check covers the Apollo sites.</p>`);
  }
  return `<h4>Checked against NASA</h4>${parts.join("")}`;
}

function polarSection(check, name) {
  const order = Object.entries(check.sites).sort(([, a], [, b]) => b.pole.localeCompare(a.pole));
  const cell = (e, b) => {
    const v = VERDICT[e.verdict[b]];
    return `<td>${pct(e.ours[b])}</td><td>${pct(e.nasa[b].at)} <span class="sub">(${range(e.nasa[b])})</span></td>
      <td class="${v.cls}">${v.text}</td>`;
  };
  const rows = order.map(([id, e]) =>
    `<tr><th>${name[id] || id}</th><td>${e.pole}</td>${cell(e, "sun")}${cell(e, "earth")}</tr>`).join("");
  const s = check.summary;
  const sign = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
  return `
      <h3>1. Polar sites: NASA Goddard's illumination maps</h3>
      <p>Our yearly Sun and Earth visibility against NASA's published polar maps
      (<a href="${check.source}" target="_blank" rel="noopener">Mazarico et al. 2011</a>: LOLA terrain at 60 m per
      pixel, averaged over 18.6 years), an independent calculation. Across ${s.sites} polar sites ours are on average
      ${sign(s.sun_mean_diff)} points for the Sun (typical size ${s.sun_mean_abs_diff.toFixed(1)}) and
      ${sign(s.earth_mean_diff)} for Earth (typical size ${s.earth_mean_abs_diff.toFixed(1)}).</p>
      <div class="table-wrap plain">
        <table class="numbers accuracy">
          <thead>
            <tr><th rowspan="2">Site</th><th rowspan="2">Pole</th><th colspan="3">Sun</th><th colspan="3">Earth</th></tr>
            <tr><th>Ours</th><th>NASA (range within 60 m)</th><th></th><th>Ours</th><th>NASA (range within 60 m)</th><th></th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="sub"><strong>Agrees:</strong> within ${check.agree_points} percentage points at the site.
      <strong>Agrees only within 60 m:</strong> NASA's value matches ours only somewhere within one 60 m pixel; on a
      narrow ridge or rough crater floor the answer depends on landing that precisely. Gaps come from one year (ours)
      against 18.6 years (NASA's) and from terrain resolution (20–40 m at the south pole, about 237 m at the north
      pole, against NASA's 60 m).</p>`;
}

function apolloSection(a) {
  const rows = a.missions.map((m) => {
    const w = m.max_abs_diff_deg;
    return `<tr><th>${m.mission}</th><td>${m.events.length}</td><td>${deg(w.sun_alt)} / ${deg(w.sun_az)}</td>
      <td>${deg(w.earth_alt)} / ${deg(w.earth_az)}</td><td class="${m.agrees ? "yes" : "no"}">${m.agrees ? "agrees" : "differs"}</td></tr>`;
  }).join("");
  return `
      <h3>2. Apollo sites: Sun and Earth positions from NASA's Apollo records</h3>
      <p>The <a href="${a.source}" target="_blank" rel="noopener">Apollo Lunar Surface Journal</a> lists the Sun's and
      Earth's altitude and direction at every Apollo landing, moonwalk start and end, and liftoff (${a.summary.events}
      moments, computed independently by two contributors). We asked JPL Horizons the same question for our site
      coordinates. Average difference ${deg(a.summary.mean_abs_diff_deg)}, largest ${deg(a.summary.max_abs_diff_deg)};
      the journal's own two calculations differ from each other by up to ${deg(a.tolerance_deg, 1)}. (They also
      spot-checked with Horizons, so this mainly confirms our coordinates, requests and angle conventions.)</p>
      <div class="table-wrap plain">
        <table class="numbers accuracy">
          <thead><tr><th>Mission</th><th>Moments</th><th>Largest gap: Sun altitude / direction</th>
            <th>Earth altitude / direction</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
}

function terrainSection(t, name) {
  const rows = Object.entries(t.sites).map(([id, s]) => {
    if (!s.covered) return `<tr><th>${name[id] || id}</th><td colspan="5">${s.note}</td></tr>`;
    const d = s.terrain_angle_diff_deg;
    return `<tr><th>${name[id] || id}</th><td>${s.pixel_m} m</td><td>${s.directions_compared}</td>
      <td>${s.reach_km.min}–${s.reach_km.max} km</td><td>${deg(d.rms)} (${deg(d.max_abs)})</td>
      <td class="${s.near_field_max_deg >= NEAR_WARN_DEG ? "warn" : ""}">${deg(s.near_field_max_deg, 1)}</td></tr>`;
  }).join("");
  return `
      <h3>3. Apollo sites: our terrain against NASA's LROC stereo terrain</h3>
      <p>NASA's <a href="${t.source}" target="_blank" rel="noopener">LROC terrain models</a> of the Apollo sites come
      from stereo camera images (2 m per pixel; 5 m for Apollo 17), a different instrument than the LOLA laser our
      skylines use. For each direction we compare the steepest terrain angle beyond 250 m, out to the edge of the LROC
      model, with ours over the same distance. Closer than 250 m (about one pixel of our whole-Moon map) there are
      boulders and small craters our map cannot show; the last column gives how steep they get.</p>
      <div class="table-wrap plain">
        <table class="numbers accuracy">
          <thead><tr><th>Site</th><th>LROC pixel</th><th>Directions</th><th>Reach</th>
            <th>Gap beyond 250 m: typical (largest)</th><th>Terrain within 250 m, steepest</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
}

function physicsSection(p, name) {
  const failed = Object.entries(p.sites).flatMap(([id, s]) =>
    s.checks.filter((c) => !c.ok).map((c) => `<li>${name[id] || id}: ${c.name} ${c.ours}${c.unit}, expected ${c.expected}${c.unit}</li>`));
  return `
      <h3>4. Every site: physics rules</h3>
      <p>Rules worked out by hand, not by our code. Earth hangs almost still in the lunar sky, so its average
      altitude is 90° minus the site's distance from the point facing Earth. Sunrises come one synodic month (29.53 days)
      apart. Away from the poles the Sun is up half of each lunar day, minus what the skyline blocks at sunrise and sunset.
      Near-side sites always see Earth and far-side sites never do. <strong>${p.summary.passed} of
      ${p.summary.checks} checks pass</strong> across ${p.summary.sites} sites${failed.length ? ":" : "."}</p>
      ${failed.length ? `<ul>${failed.join("")}</ul>` : ""}
      <p class="sub">The yearly percentages cover 365 days, which is 12.4 lunar days. The extra part-day can move a
      site's yearly Sun share by up to about 1.5 points either way.</p>`;
}

// The full section: every check in one place.
// Sunlight over a year, ours vs NASA, one line per polar site (Angel's Claude Design "How accurate"):
// the band is NASA's range within 60 m, the white tick NASA's value at the point, the dot ours.
const RESULT = { agrees: ["Agrees", "ok"], agrees_within_60m: ["Within 60 m", "near"] };
function rangePlot(check, name) {
  const entries = Object.entries(check.sites || {}).filter(([, e]) => e.nasa?.sun && e.ours);
  if (!entries.length) return "";
  const n = { ok: 0, near: 0, bad: 0 };
  const rows = entries.map(([id, e]) => {
    const [word, cls] = RESULT[e.verdict?.sun] ?? ["Differs", "bad"];
    n[cls]++;
    const s = e.nasa.sun;
    const clamp = (v) => Math.max(0, Math.min(100, v));
    return `
      <div class="rp-row">
        <div class="rp-name"><span>${name[id] ?? id}</span><small>${e.pole === "north" ? "North" : "South"} pole</small></div>
        <div class="rp-track" role="img" aria-label="Sunlight: ours ${e.ours.sun}%, NASA ${s.at}% (range ${s.min} to ${s.max}% within 60 m)">
          <div class="rp-band" style="left:${clamp(s.min)}%;width:${clamp(s.max) - clamp(s.min)}%"></div>
          <div class="rp-nasa" style="left:${clamp(s.at)}%"></div>
          <div class="rp-ours" style="left:${clamp(e.ours.sun)}%"></div>
        </div>
        <span class="rp-num">${Math.round(e.ours.sun)} / ${Math.round(s.at)}%</span>
        <span class="rp-num">${e.nasa.earth ? `${Math.round(e.ours.earth)} / ${Math.round(e.nasa.earth.at)}%` : "–"}</span>
        <span class="rp-res ${cls}">${word}</span>
      </div>`;
  }).join("");
  return `
    <div class="rp">
      <div class="rp-tiles">
        <div><strong>${n.ok}</strong><span>polar sites agree</span></div>
        <div><strong>${n.near}</strong><span>agree within 60 m</span></div>
        <div><strong>${n.bad}</strong><span>differ</span></div>
      </div>
      <h3>Sunlight over a year: ours vs NASA</h3>
      <p class="rp-key"><span class="k-ours"></span>Ours <span class="k-nasa"></span>NASA at the point <span class="k-band"></span>NASA range within 60 m</p>
      <div class="rp-row rp-head"><span>Site</span><span>Sunlight, 0 to 100%</span><span>Sun ours / NASA</span><span>Earth ours / NASA</span><span>Result</span></div>
      ${rows}
    </div>`;
}

export function accuracyPanel(check, sites, checks = null) {
  if (!check && !checks) return "";
  const name = Object.fromEntries(sites.map((s) => [s.id, s.label]));
  return `
    <details class="sources accuracy-panel" open>
      <summary>How accurate is this? Checked against independent NASA sources</summary>
      ${check ? rangePlot(check, name) : ""}
      ${check ? polarSection(check, name) : ""}
      ${checks?.apollo ? apolloSection(checks.apollo) : ""}
      ${checks?.terrain ? terrainSection(checks.terrain, name) : ""}
      ${checks?.physics ? physicsSection(checks.physics, name) : ""}
    </details>`;
}
