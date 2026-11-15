import "./style.css";
import { loadChecks, loadCrosscheck, loadCustomPoint, loadLunarNames, loadSites, loadSiteAnalysis } from "./data.js";
import { parseNames } from "./features.js";
import { atAGlance } from "./compare.js";
import { advance, playerHtml, ticksHtml } from "./timeline.js";
import { accuracyNote, accuracyPanel } from "./accuracy.js";
import { skyDiagram } from "./skyDiagram.js";
import { numbersPanel } from "./numbersPanel.js";
import { planPanel } from "./planPanel.js";
import { siteInfo } from "./siteInfo.js";
import { statsPanel } from "./statsPanel.js";
import { tableView } from "./tableView.js";
import { DEFAULT_SETTINGS, SUN_RULES, applySettings, compareVerdict, settingsSentence } from "./settings.js";

const MISSION_DAYS = [7, 14, 30]; // must match MISSION_DAYS in app/python/scripts/export_site_json.py

// What "visible" means right now (issues #2 and #5), changed by the controls above the two scenarios.
// Each site's 30-day rows are re-worked for these settings once and kept until the settings change.
const view = { settings: { ...DEFAULT_SETTINGS }, cache: new Map(), slots: null, analyses: null };

function rowsFor(analyses, siteId) {
  const key = `${siteId}|${view.settings.sunRule}|${view.settings.earthMarginDeg}`;
  if (!view.cache.has(key)) view.cache.set(key, applySettings(analyses[siteId].rows, view.settings));
  return view.cache.get(key);
}

// ---------- small HTML builders ----------

function siteOptions(sites, selectedId) {
  return sites
    .map((s) => `<option value="${s.id}"${s.id === selectedId ? " selected" : ""}>${s.label}</option>`)
    .join("");
}

// The planning section: its two pickers are built once; only #plan-holder is redrawn.
function planSection(sites, plan) {
  const lengths = MISSION_DAYS
    .map((d) => `<option value="${d}"${d === plan.days ? " selected" : ""}>${d} days</option>`)
    .join("");
  return `
    <section class="card plan">
      <h2>Plan a mission: when is the best time to land?</h2>
      <div class="plan-controls">
        <label for="plan-site">Site</label>
        <select id="plan-site">${siteOptions(sites, plan.site)}</select>
        <label for="plan-days">Mission length</label> 
        <select id="plan-days">${lengths}</select>
      </div>
      <div id="plan-holder"></div>
    </section>`;
}

// The controls for one card: a site picker and a time slider. Built once, never redrawn,
// so a slider keeps focus while you drag it.
function slotControls(letter, sites, siteId, last, index) {
  const id = letter.toLowerCase();
  return `
    <div class="card-controls">
      <h3>Scenario ${letter}</h3>
      <label for="site-${id}">Site</label>
      <select id="site-${id}">${siteOptions(sites, siteId)}</select>
      <label for="time-${id}">Time <output id="out-${id}"></output></label>
      <input type="range" id="time-${id}" min="0" max="${last}" value="${index}">
      <div class="slider-extras"><div data-ticks="${id}" id="ticks-${id}"></div>${playerHtml(id)}</div>
      <p class="site-description" id="desc-${id}"></p>
    </div>`;
}

function legend() {
  return `
    <ul class="legend" aria-label="Legend">
      <li><span class="dot sun filled"></span> Sun</li>
      <li><span class="dot earth filled"></span> Earth</li>
      <li><span class="dot ring"></span> Filled dot = above the skyline (visible), hollow dot = blocked</li>
      <li><span class="swatch terrain"></span> Terrain below the skyline</li>
      <li><span class="swatch flat"></span> Flat horizon (0°)</li>
    </ul>`;
}

// ---------- the full-screen layout (app/CLAUDE.md "Layout map") ----------

const MENU = [
  ["sites", "Sites", "Every site, grouped"],
  ["compare", "Compare", "Two sites or two moments"],
  ["add", "Add a point", "Type coordinates"],
  ["plan", "Plan a mission", "Best time to land"],
  ["year", "The year", "Every site over a year"],
  ["table", "Hourly table", "Every hour, one site"],
  ["accuracy", "How accurate?", "Checked against NASA"],
  ["sources", "Data sources", "Where every number comes from"],
];

function hudTop(sites) {
  return `
    <header class="hud hud-top">
      <button type="button" id="menu-btn" class="icon-btn" aria-label="Menu" aria-expanded="false" aria-controls="drawer">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="brand">
        <h1>Lunar Landing Site Navigator</h1>
        <p>Choosing where to land at the Moon's south pole · NASA data</p>
      </div>
      <form class="search" id="search-form" role="search">
        <label for="site-search" class="visually-hidden">Find a site</label>
        <input id="site-search" list="site-list" placeholder="Find a site…" autocomplete="off">
        <datalist id="site-list">${sites.map((s) => `<option value="${s.label}">`).join("")}</datalist>
      </form>
    </header>`;
}

function quickViews() {
  const views = [["near", "Near side"], ["far", "Far side"], ["pole", "South pole"], ["north", "North pole"], ["moon", "Whole Moon"]];
  return `
    <nav class="hud quick-views" aria-label="Camera views">
      ${views.map(([v, label]) => `<button type="button" data-view="${v}">${label}</button>`).join("")}
    </nav>
    <div class="hud readout" id="readout" aria-hidden="true">Move over the Moon</div>
    <ul class="hud legend-mini" aria-label="Map legend">
      <li><span class="dot named"></span> Site</li>
      <li><span class="dot model"></span> Model site</li>
      <li><span class="dot custom"></span> Your points</li>
      <li><span class="dot pending"></span> Working</li>
    </ul>`;
}

function drawer() {
  return `
    <nav id="drawer" class="drawer glass" aria-label="Menu" hidden>
      ${MENU.map(([page, title, sub]) => `<button type="button" data-page="${page}"><strong>${title}</strong><span>${sub}</span></button>`).join("")}
    </nav>`;
}

// Group the sites for the "Sites" page: what kind of place each one is.
function siteGroup(s) {
  if (s.is_model_site) return "Model site";
  if (s.id.startsWith("custom_")) return "Your points";
  if (/landing site$/.test(s.label)) return "Past landings, for comparison";
  return s.lat_deg < 0 ? "South pole candidates" : "North pole, for comparison";
}
const GROUP_ORDER = ["Model site", "South pole candidates", "Your points", "North pole, for comparison", "Past landings, for comparison"];

function sitesList(sites) {
  const pct = (v) => `${Math.round(v)}%`;
  return GROUP_ORDER.map((g) => {
    const items = sites.filter((s) => siteGroup(s) === g);
    if (!items.length) return "";
    return `<h3>${g}</h3><ul class="site-list">${items.map((s) => `
      <li><button type="button" data-site="${s.id}">
        <span class="name">${s.label}</span>
        <span class="mini"><span class="sun">☀ ${pct(s.year.sun_visible_pct)}</span>
        <span class="earth">⊕ ${pct(s.year.earth_visible_pct)}</span>
        <span class="both">both ${pct(s.year.both_visible_pct)}</span></span>
      </button></li>`).join("")}</ul>`;
  }).join("");
}

function sheet(pages) {
  return `
    <section id="sheet" class="sheet glass" aria-labelledby="sheet-title" hidden>
      <header class="sheet-head">
        <h2 id="sheet-title" tabindex="-1"></h2>
        <button type="button" id="sheet-close" class="icon-btn" aria-label="Close">×</button>
      </header>
      <div class="sheet-body">
        ${pages.map(([page, html]) => `<div class="sheet-page" data-page="${page}" hidden>${html}</div>`).join("")}
      </div>
    </section>`;
}

function panel() {
  return `
    <aside id="panel" class="panel glass" aria-label="Site analysis">
      <button type="button" id="panel-close" class="icon-btn panel-close" aria-label="Close the analysis">×</button>
      <div id="globe-info" class="globe-info" aria-live="polite"></div>
    </aside>
    <div id="ctx" class="ctx-menu glass" role="menu" hidden></div>`;
}

// The empty state of the analysis panel.
function panelHint() {
  return `
    <h3>Where should we land at the south pole?</h3>
    <p>The Moon's south pole has ridges that stay in sunlight most of the year, right beside craters that never
    see the Sun and may hold water ice. A lander needs the <span class="sun">Sun</span> for power and a clear line
    to <span class="earth">Earth</span> for radio, and the hills decide both.</p>
    <p>Click a site to see how often each is above its skyline, or <strong>right-click</strong> (press and hold on
    a phone) anywhere on the Moon to analyse that point with NASA data.</p>
    <p><button type="button" class="primary" data-site="shackleton_rim">Start at Shackleton rim</button></p>`;
}

// A clicked spot that has not been analysed yet.
function pointCard(lat, lon) {
  const where = `${lat.toFixed(3)}°, ${(((lon % 360) + 360) % 360).toFixed(3)}° E`;
  return `
    <h3>${where}</h3>
    <p>Not analysed yet. This asks NASA JPL Horizons where the Sun and Earth are from here for a year, and builds
    the skyline from NASA LOLA terrain (a few seconds).</p>
    <p><button type="button" class="primary" data-analyse="${lat},${lon}">Analyse this point</button></p>`;
}

// The sky at one moment for the selected site, with its own time slider (inside the analysis panel).
function focusSky(analysis, rows, index) {
  const row = rows[index];
  const mark = (v) => (v ? "✓ up" : "✗ blocked");
  return `
    <h4>The sky here <output id="focus-out">${row.time_utc} UTC</output></h4>
    <input type="range" id="focus-time" min="0" max="${rows.length - 1}" value="${index}" aria-label="Time">
    <div data-ticks="focus">${ticksHtml(rows)}</div>
    ${playerHtml("focus")}
    <div id="focus-view">${skyDiagram(analysis.skyline_deg, row)}
      <p class="focus-now"><span class="sun">Sun ${mark(row.sun_visible)}</span> · <span class="earth">Earth ${mark(row.earth_visible)}</span></p>
    </div>`;
}

function panelActions(id) {
  return `
    <div class="panel-actions">
      <button type="button" data-open="compare" data-for="${id}">Compare with…</button>
      <button type="button" data-open="plan" data-for="${id}">Plan a mission here</button>
      <button type="button" data-open="table" data-for="${id}">Hourly table</button>
      ${id.startsWith("custom_") ? `<button type="button" class="remove-point" data-remove="${id}">Remove this point</button>` : ""}
    </div>`;
}

// The "analyse your own point" card. The form is built once; results go to #custom-status.
function customSection() {
  return `
    <section class="card custom">
      <h2>Or type coordinates</h2>
      <p class="sub">Any latitude and longitude on the Moon. The backend asks NASA JPL Horizons live
      (a few seconds the first time), builds the skyline from NASA LOLA terrain, and adds the point to the
      3D Moon and every site picker on this page.</p>
      <form id="custom-form" class="custom-form">
        <label for="custom-lat">Latitude</label>
        <input id="custom-lat" type="number" step="any" min="-90" max="90" required placeholder="-89.5">
        <label for="custom-lon">Longitude (° E)</label>
        <input id="custom-lon" type="number" step="any" required placeholder="200">
        <button type="submit" id="custom-go">Analyse</button>
      </form>
      <p class="sub">Examples: Apollo 11 area 0.674, 23.473 · near the south pole -89.5, 200.
      South is negative; west longitudes like -156.3 also work.</p>
      <p id="custom-status" role="status" aria-live="polite"></p>
    </section>`;
}

// Sources line for a typed-in point: live Horizons queries, and whether a real skyline exists.
function customSourceLine(a) {
  const q = (span) => `<a href="${a.sources.horizons_queries[span].sun}">Sun</a>,
    <a href="${a.sources.horizons_queries[span].earth}">Earth</a>`;
  const sky = a.horizon === "flat"
    ? "<strong>flat horizon (0°)</strong>: no downloaded terrain map covers this point, so real terrain is not counted"
    : `LOLA terrain, computed on request (${a.terrain.near_map} near, ${a.terrain.far_map} out to ${a.terrain.far_range_km.toFixed(0)} km)`;
  return `<li data-site="${a.site}"><strong>${a.label}</strong>: ${a.coordinate_source}. Skyline: ${sky}.
    Live Horizons queries: 30 days (${q("30d")}), one year (${q("year")}).</li>`;
}

const MAP_NAMES = {
  "85S_20M": "LDEM_85S_20M (20 m per pixel)",
  "80S_40M": "LDEM_80S_40M (40 m per pixel)",
  LDEM_128: "the whole-Moon map LDEM_128 (about 237 m per pixel)",
};

// One line of the sources panel per site: where its coordinate and its terrain came from.
function siteSourceLine(a) {
  if (a.horizon) return customSourceLine(a); // typed-in points have no cached files
  const t = a.terrain;
  const edge = t.far_range_limited_by_map_edge
    ? " This is as far as the terrain map reaches from this site, so even more distant mountains are not counted."
    : "";
  const maps = t.near_map === t.far_map
    ? `Skyline from ${MAP_NAMES[t.near_map]} out to ${t.far_range_km.toFixed(0)} km.`
    : `Skyline from ${MAP_NAMES[t.near_map]} out to ${t.near_range_km} km, then
      ${MAP_NAMES[t.far_map]} out to ${t.far_range_km.toFixed(0)} km.`;
  const q = a.sources.horizons_queries;
  const queries = q
    ? ` Exact Horizons queries: 30 days (${queryLinks(q["30d"])}), one year (${queryLinks(q.year)}).`
    : "";
  return `<li><strong>${a.label}</strong>: ${a.coordinate_source}. ${maps}${edge}${queries}
    Files: <code>${a.sources.horizons_30d}</code>, <code>${a.sources.horizons_year}</code>, <code>${a.sources.skyline}</code></li>`;
}

// Links to the exact NASA JPL Horizons requests behind a site's numbers (#6). Opening one re-runs it.
function queryLinks(q) {
  return `<a href="${q.sun}" target="_blank" rel="noopener">Sun</a>, <a href="${q.earth}" target="_blank" rel="noopener">Earth</a>`;
}

// The controls for what "visible" means (#2, #5). They apply to the scenarios, the verdict and the table.
function settingsControls() {
  const rules = Object.entries(SUN_RULES)
    .map(([key, r]) => `<option value="${key}"${key === DEFAULT_SETTINGS.sunRule ? " selected" : ""}>${r.label}</option>`)
    .join("");
  return `
    <div class="settings-controls">
      <label for="sun-rule">The Sun counts as up when</label>
      <select id="sun-rule">${rules}</select>
      <label for="earth-margin">Earth safety margin <output id="earth-margin-out">0.0°</output></label>
      <input type="range" id="earth-margin" min="0" max="5" step="0.5" value="0"
        aria-describedby="settings-note">
      <p class="sub" id="settings-note">How far above the skyline Earth must be for a reliable radio link. These rules
      apply to the two scenarios, the comparison and the table below; the yearly sections above use the default
      (Sun centre above the skyline, no Earth margin).</p>
    </div>`;
}

function sourcesPanel(analyses) {
  const files = Object.values(analyses).map(siteSourceLine).join("");
  return `
    <details class="sources" open>
      <summary>Data sources and how this works</summary>
      <ul>
        <li><strong>Sun and Earth directions:</strong> NASA JPL Horizons, asked as an observer standing on the Moon at each site.
        Horizons includes the Moon's wobble (libration).</li>
        <li><strong>Skyline:</strong> built from NASA LRO LOLA terrain heights. For each of 360 compass directions we look
        outward and record the steepest terrain angle. Near the south pole, near terrain (to 35 km) comes from the finest
        map that covers the site and far terrain from the 40 m map, out to 250 km or the edge of that map. Everywhere
        else (for example the Apollo sites) the whole-Moon map LDEM_128 is used out to 250 km. Distant mountains matter:
        at the model site they raise the skyline by up to about 1.5° in some directions.</li>
        <li><strong>Moon picture:</strong> NASA LRO wide-angle camera global mosaic, loaded live from NASA Moon Trek's
        tile service. The stars behind it are decoration, not a real star map.</li>
        <li><strong>Feature names on the Moon:</strong> the official IAU names from the
        <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noopener">USGS Gazetteer of Planetary Nomenclature</a>
        (the same names NASA Moon Trek shows), with each feature's size deciding the zoom at which its name appears.</li>
        <li><strong>Visible</strong> means the body's angle above a flat horizon is greater than the skyline in its direction.
        <strong>Margin</strong> is that difference.</li>
        <li><strong>Windows</strong> are unbroken stretches of visible samples in the one-year data (6-hour steps), so their
        start, end and length are exact to about 6 hours. A window that touches the start or end of the data is shown as
        "at least" its length.</li>
        <li><strong>Best time to land:</strong> every possible start in the year is scored by the share of the mission with
        both the Sun and Earth visible (power and a direct line to Earth). Ties go to more Sun, then more Earth, then the
        earlier date. Listed windows never overlap each other.</li>
        <li><strong>Next change</strong> (in the scenarios) is found between hourly samples by a straight-line estimate.</li>
        <li><strong>Rules in use:</strong> <span id="settings-sentence">${settingsSentence(DEFAULT_SETTINGS)}</span>
        Change both above the two scenarios. The yearly sections always use the default: the Sun's centre above the
        skyline (the Sun treated as a point) and no Earth margin. The Sun's apparent radius is taken as 0.267°.</li>
        <li><strong>Simplifications:</strong> "Visible" is yes or no; it does not yet account for how much power a low
        Sun gives. All times are UTC.</li>
        <li><strong>Sites:</strong> the named features and their coordinates come from NASA Moon Trek (official IAU names).
        Each coordinate is the centre of the feature (for a crater, the middle of its floor), not a chosen landing spot.
        The Apollo landing sites come from NASA Moon Trek's landing-site bookmarks (the centre of each landing area).
        The model site is a point found from LOLA terrain data.</li>
        <li><strong>Each site</strong> (coordinate source, terrain maps, and the 30-day, one-year and skyline files):
          <ul id="source-files">${files}</ul>
        </li>
      </ul>
    </details>`;
}

function tableSection(sites, siteId) {
  return `
    <section class="table-section">
      <label for="table-site">Table view for site</label>
      <select id="table-site">${siteOptions(sites, siteId)}</select>
      <div id="table-holder"></div>
    </section>`;
}

// ---------- the page ----------

function shell(sites, analyses, slots, plan, check, checks) {
  const last = analyses[sites[0].id].rows.length - 1;
  const compare = `
    <section class="moment">
      <p>Pick a site and a time in each scenario to compare two sites, or two moments at the same site
      (30 days of hourly data).</p>
      ${legend()}
      ${settingsControls()}
      <label class="same-time"><input type="checkbox" id="same-time"> Same time for A and B
        <span class="sub">(one time control drives both cards)</span></label>
      <div class="cards">
        <section class="card">
          ${slotControls("A", sites, slots.a.site, last, slots.a.index)}
          <div id="view-a"></div>
        </section>
        <section class="card">
          ${slotControls("B", sites, slots.b.site, last, slots.b.index)}
          <div id="view-b"></div>
        </section>
      </div>
      <h3>A vs B at a glance</h3>
      <div id="glance" class="table-wrap plain"></div>
      <h3>Which is better?</h3>
      <p class="verdict" id="compare-verdict" aria-live="polite"></p>
    </section>`;
  const pages = [
    ["sites", `<div id="sites-list">${sitesList(sites)}</div>`],
    ["compare", compare],
    ["add", customSection()],
    ["plan", planSection(sites, plan)],
    ["year", statsPanel(sites)],
    ["table", tableSection(sites, slots.a.site)],
    ["accuracy", accuracyPanel(check, sites, checks)],
    ["sources", sourcesPanel(analyses)],
  ];
  return `
    <div id="globe" class="stage"></div>
    ${hudTop(sites)}
    ${quickViews()}
    ${drawer()}
    ${sheet(pages)}
    ${panel()}`;
}

function drawSlot(id, slot, analyses) {
  const analysis = analyses[slot.site];
  const rows = rowsFor(analyses, slot.site);
  const row = rows[slot.index]; // visible/next change follow the current rules
  const key = `${slot.site}|${view.settings.sunRule}|${view.settings.earthMarginDeg}`;
  if (slot.ticksKey !== key) { // the ticks depend on the site and the rules, not on the time
    document.querySelector(`#ticks-${id}`).innerHTML = ticksHtml(rows);
    slot.ticksKey = key;
  }
  document.querySelector(`#out-${id}`).textContent = `${row.time_utc} UTC`;
  document.querySelector(`#desc-${id}`).textContent = analysis.description;
  document.querySelector(`#view-${id}`).innerHTML = skyDiagram(analysis.skyline_deg, row) + numbersPanel(row);
  drawVerdict();
}

// The plain-language comparison of scenario A and B (#5). Redrawn whenever either one changes.
function drawVerdict() {
  const { slots, analyses } = view;
  const el = document.querySelector("#compare-verdict");
  if (!slots || !el || !analyses[slots.a.site] || !analyses[slots.b.site]) return;
  const side = (name, slot) => {
    const rows = rowsFor(analyses, slot.site);
    return { name, label: analyses[slot.site].label, rows, row: rows[slot.index] };
  };
  el.innerHTML = compareVerdict(side("A", slots.a), side("B", slots.b));
  const year = (id) => view.sites?.find((s) => s.id === id)?.year;
  document.querySelector("#glance").innerHTML = atAGlance(
    { ...side("A", slots.a), year: year(slots.a.site) }, { ...side("B", slots.b), year: year(slots.b.site) });
}

async function main() {
  const app = document.querySelector("#app");
  try {
    const [sites, check, checks] = await Promise.all([loadSites(), loadCrosscheck(), loadChecks()]);
    // A handful of small files: load them all up front so every picker answers instantly.
    // (When there are many sites, load each one when it is first picked instead.)
    const analyses = Object.fromEntries(
      await Promise.all(sites.map(async (s) => [s.id, await loadSiteAnalysis(s.id)]))
    );

    const last = analyses[sites[0].id].rows.length - 1;
    const slots = {
      a: { site: sites[0].id, index: 0 },
      b: { site: (sites[1] || sites[0]).id, index: Math.floor(last / 2) },
    };
    const plan = { site: sites[0].id, days: 14 };
    app.innerHTML = shell(sites, analyses, slots, plan, check, checks);
    view.slots = slots;
    view.analyses = analyses;
    view.sites = sites;

    // Planning section
    const planHolder = document.querySelector("#plan-holder");
    const drawPlan = () => (planHolder.innerHTML = planPanel(sites, analyses, plan.site, plan.days));

    // The globe. It is loaded separately and inside try/catch: if 3D graphics (WebGL) are not
    // available, the rest of the page must still work.
    let globe = null;
    try {
      const { createGlobe } = await import("./globe.js");
      const readout = document.querySelector("#readout");
      globe = createGlobe(document.querySelector("#globe"), sites, {
        onSelect: (id) => selectSite(id, { fly: true }),
        onPick: (lat, lon) => pickPoint(lat, lon),
        onContext: (lat, lon, x, y) => openContextMenu(lat, lon, x, y),
        onHover: (lat, lon) => {
          readout.textContent = lat === null
            ? "Move over the Moon"
            : `${lat >= 0 ? "+" : ""}${lat.toFixed(3)}°  ${(((lon % 360) + 360) % 360).toFixed(3)}° E`;
        },
      });
      for (const b of document.querySelectorAll("[data-view]")) {
        b.addEventListener("click", () => globe.setView(b.dataset.view));
      }
      loadLunarNames().then((names) => globe.setFeatures(parseNames(names))); // after the Moon is up
    } catch (error) {
      document.querySelector("#globe").innerHTML =
        `<p class="error stage-error">The 3D Moon could not start (${String(error.message).replace(/</g, "&lt;")}).
        Open the menu (☰) to use every site and page without it.</p>`;
    }

    // ----- panels: the ☰ drawer, the sheet with the menu pages, the analysis panel, the context menu -----
    const panelEl = document.querySelector("#panel");
    const drawerEl = document.querySelector("#drawer");
    const sheetEl = document.querySelector("#sheet");
    const ctxEl = document.querySelector("#ctx");
    const menuBtn = document.querySelector("#menu-btn");
    const focusState = { index: 0 };

    const setDrawer = (open) => {
      drawerEl.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      if (open) drawerEl.querySelector("button").focus();
    };
    const openPage = (page) => {
      for (const p of sheetEl.querySelectorAll(".sheet-page")) p.hidden = p.dataset.page !== page;
      for (const b of drawerEl.querySelectorAll("[data-page]")) b.classList.toggle("active", b.dataset.page === page);
      const title = MENU.find(([p]) => p === page)[1];
      document.querySelector("#sheet-title").textContent = title;
      sheetEl.hidden = false;
      sheetEl.querySelector(".sheet-body").scrollTop = 0;
      document.querySelector("#sheet-title").focus();
    };
    const closeSheet = () => {
      sheetEl.hidden = true;
      for (const b of drawerEl.querySelectorAll("[data-page]")) b.classList.remove("active");
    };
    const closeContextMenu = () => (ctxEl.hidden = true);

    menuBtn.addEventListener("click", () => setDrawer(drawerEl.hidden));
    drawerEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-page]");
      if (!b) return;
      openPage(b.dataset.page);
      if (matchMedia("(max-width: 760px)").matches) setDrawer(false);
    });
    document.querySelector("#sheet-close").addEventListener("click", closeSheet);
    document.querySelector("#panel-close").addEventListener("click", () => {
      panelEl.classList.add("closed");
      syncInset();
      if (globe) {
        globe.select(null);
        globe.setPin(null);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!ctxEl.hidden) return closeContextMenu();
      if (!sheetEl.hidden) return closeSheet();
      if (!drawerEl.hidden) {
        setDrawer(false);
        menuBtn.focus();
      }
    });
    document.addEventListener("pointerdown", (e) => {
      if (!ctxEl.hidden && !ctxEl.contains(e.target)) closeContextMenu();
    });

    // Keep the Moon centred in the space the analysis panel leaves free (desktop only).
    const syncInset = () => {
      if (!globe) return;
      const open = !panelEl.classList.contains("closed");
      const phone = matchMedia("(max-width: 760px)").matches;
      if (!open) globe.setInset(0, 0);
      else if (phone) globe.setInset(0, Math.min(panelEl.offsetHeight, innerHeight * 0.52) + 20);
      else globe.setInset(panelEl.offsetWidth + 32, 0);
    };
    addEventListener("resize", syncInset);
    const showPanel = (html) => {
      panelEl.classList.remove("closed");
      document.querySelector("#globe-info").innerHTML = html;
      syncInset();
    };

    // One place that changes the selected site, so the globe, the analysis panel and the plan agree.
    function selectSite(id, { fly = false } = {}) {
      const site = sites.find((s) => s.id === id);
      if (!site) return;
      plan.site = id;
      document.querySelector("#plan-site").value = id;
      focusState.index = Math.min(focusState.index, analyses[id].rows.length - 1);
      if (players.focus) players.focus.playing = false; // its buttons are about to be replaced
      showPanel(siteInfo(site) + focusSky(analyses[id], rowsFor(analyses, id), focusState.index) +
        panelActions(id) + accuracyNote(check?.sites[id], site, checks));
      if (globe) {
        globe.select(id);
        globe.setPin(site.lat_deg, site.lon_deg_east);
        if (fly) globe.flyTo(site.lat_deg, site.lon_deg_east);
      }
      drawPlan();
    }

    // A bare spot clicked: fly there, mark it, and offer to analyse it.
    function pickPoint(lat, lon) {
      closeContextMenu();
      if (globe) {
        globe.select(null);
        globe.setPin(lat, lon);
        globe.flyTo(lat, lon);
      }
      showPanel(pointCard(lat, lon));
    }

    function openContextMenu(lat, lon, x, y) {
      const where = `${lat.toFixed(3)}°, ${(((lon % 360) + 360) % 360).toFixed(3)}° E`;
      ctxEl.innerHTML = `
        <p class="ctx-where">${where}</p>
        <button type="button" role="menuitem" data-ctx="analyse">Analyse this point</button>
        <button type="button" role="menuitem" data-ctx="fly">Fly here</button>
        <button type="button" role="menuitem" data-ctx="copy">Copy coordinates</button>`;
      ctxEl.dataset.lat = lat;
      ctxEl.dataset.lon = lon;
      ctxEl.hidden = false;
      const box = ctxEl.getBoundingClientRect();
      ctxEl.style.left = `${Math.min(x, innerWidth - box.width - 8)}px`;
      ctxEl.style.top = `${Math.min(y, innerHeight - box.height - 8)}px`;
      ctxEl.querySelector("button").focus();
    }
    ctxEl.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-ctx]");
      if (!b) return;
      const lat = Number(ctxEl.dataset.lat);
      const lon = Number(ctxEl.dataset.lon);
      closeContextMenu();
      if (b.dataset.ctx === "analyse") analysePoint(lat, lon, "globe");
      if (b.dataset.ctx === "fly") pickPoint(lat, lon);
      if (b.dataset.ctx === "copy") {
        const text = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        try {
          await navigator.clipboard.writeText(text);
          showPanel(`<h3>Copied</h3><p><code>${text}</code></p>`);
        } catch {
          showPanel(`<h3>Coordinates</h3><p><code>${text}</code></p>`);
        }
      }
    });

    // Everything inside the analysis panel and the sites list is wired by delegation (it is redrawn often).
    document.addEventListener("click", (e) => {
      const site = e.target.closest("[data-site]");
      if (site && !site.matches("li[data-site]")) {
        selectSite(site.dataset.site, { fly: true });
        if (matchMedia("(max-width: 760px)").matches) closeSheet();
        return;
      }
      const analyse = e.target.closest("[data-analyse]");
      if (analyse) {
        const [lat, lon] = analyse.dataset.analyse.split(",").map(Number);
        return analysePoint(lat, lon, "globe");
      }
      const open = e.target.closest("[data-open]");
      if (open) {
        const id = open.dataset.for;
        if (open.dataset.open === "compare") {
          slots.a.site = id;
          document.querySelector("#site-a").value = id;
          drawSlot("a", slots.a, analyses);
        }
        if (open.dataset.open === "table") {
          document.querySelector("#table-site").value = id;
          drawTable(id);
        }
        openPage(open.dataset.open);
      }
    });
    function drawFocus() {
      const rows = rowsFor(analyses, plan.site);
      const row = rows[focusState.index];
      const mark = (v) => (v ? "✓ up" : "✗ blocked");
      const out = document.querySelector("#focus-out");
      if (!out) return;
      out.textContent = `${row.time_utc} UTC`;
      document.querySelector("#focus-view").innerHTML = skyDiagram(analyses[plan.site].skyline_deg, row) +
        `<p class="focus-now"><span class="sun">Sun ${mark(row.sun_visible)}</span> · <span class="earth">Earth ${mark(row.earth_visible)}</span></p>`;
    }
    panelEl.addEventListener("input", (e) => {
      if (e.target.id !== "focus-time") return;
      focusState.index = Number(e.target.value);
      drawFocus();
    });

    // ----- time playback (play/pause, step, speed, loop) and the event ticks, for every slider -----
    const players = {}; // id ("focus", "a", "b") -> { playing, speed, loop, carry }
    const sameTime = () => document.querySelector("#same-time").checked;
    const getIndex = (id) => (id === "focus" ? focusState.index : slots[id].index);
    const lastIndex = (id) => rowsFor(analyses, id === "focus" ? plan.site : slots[id].site).length - 1;
    function setIndex(id, i) {
      if (id === "focus") {
        focusState.index = i;
        const el = document.querySelector("#focus-time");
        if (el) el.value = i;
        return drawFocus();
      }
      for (const key of id === "a" && sameTime() ? ["a", "b"] : [id]) {
        slots[key].index = i;
        document.querySelector(`#time-${key}`).value = i;
        drawSlot(key, slots[key], analyses);
      }
    }
    const playerState = (id) => (players[id] ||= { playing: false, speed: 6, loop: true, carry: 0 });
    const showPlaying = (id) => {
      const b = document.querySelector(`[data-player="${id}"] [data-act="play"]`);
      if (!b) return;
      const on = playerState(id).playing;
      b.textContent = on ? "⏸" : "▶";
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", on ? "Pause" : "Play");
    };
    let rafId = null;
    let lastFrame = null;
    function playFrame(now) {
      const active = Object.entries(players).filter(([, p]) => p.playing);
      if (!active.length) {
        rafId = null;
        lastFrame = null;
        return;
      }
      const dt = lastFrame === null ? 0 : Math.min(250, now - lastFrame); // no big jump after a hidden tab
      lastFrame = now;
      for (const [id, p] of active) {
        if (!document.querySelector(`[data-player="${id}"]`)) { // its panel was redrawn
          p.playing = false;
          continue;
        }
        const r = advance({ index: getIndex(id), carry: p.carry }, dt, p.speed, lastIndex(id), p.loop);
        p.carry = r.carry;
        if (r.index !== getIndex(id)) setIndex(id, r.index);
        if (r.ended) {
          p.playing = false;
          showPlaying(id);
        }
      }
      rafId = requestAnimationFrame(playFrame);
    }
    document.addEventListener("click", (e) => {
      const tick = e.target.closest("[data-jump]");
      if (tick) return setIndex(tick.closest("[data-ticks]").dataset.ticks, Number(tick.dataset.jump));
      const btn = e.target.closest("[data-player] button[data-act]");
      if (!btn) return;
      const id = btn.closest("[data-player]").dataset.player;
      const p = playerState(id);
      const i = getIndex(id);
      if (btn.dataset.act === "back") setIndex(id, Math.max(0, i - 1));
      if (btn.dataset.act === "fwd") setIndex(id, Math.min(lastIndex(id), i + 1));
      if (btn.dataset.act === "play") {
        p.playing = !p.playing;
        p.carry = 0;
        if (p.playing && i >= lastIndex(id) && !p.loop) setIndex(id, 0);
        showPlaying(id);
        if (p.playing && rafId === null) rafId = requestAnimationFrame(playFrame);
      }
    });
    document.addEventListener("change", (e) => {
      const el = e.target.closest("[data-player] [data-act]");
      if (!el) return;
      const p = playerState(el.closest("[data-player]").dataset.player);
      if (el.dataset.act === "speed") p.speed = Number(el.value);
      if (el.dataset.act === "loop") p.loop = el.checked;
    });
    document.querySelector("#same-time").addEventListener("change", (e) => {
      const on = e.target.checked;
      document.querySelector("#time-b").disabled = on;
      document.querySelector('[data-player="b"]').hidden = on;
      if (on) {
        playerState("b").playing = false;
        showPlaying("b");
        setIndex("a", slots.a.index);
      }
    });

    // Search box: jump to a site by name.
    document.querySelector("#search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.querySelector("#site-search").value.trim().toLowerCase();
      const hit = sites.find((s) => s.label.toLowerCase() === q) || sites.find((s) => s.label.toLowerCase().includes(q));
      if (hit) selectSite(hit.id, { fly: true });
    });
    document.querySelector("#site-search").addEventListener("change", (e) => {
      const hit = sites.find((s) => s.label === e.target.value);
      if (hit) selectSite(hit.id, { fly: true });
    });

    document.querySelector("#plan-site").addEventListener("change", (e) => selectSite(e.target.value, { fly: true }));
    document.querySelector("#plan-days").addEventListener("change", (e) => {
      plan.days = Number(e.target.value);
      drawPlan();
    });
    drawPlan();
    showPanel(panelHint()); // empty state: nothing chosen yet
    if (globe) globe.setView("moon", false); // frame the whole Moon in the space beside the panel

    // The two scenarios
    for (const id of ["a", "b"]) {
      document.querySelector(`#site-${id}`).addEventListener("change", (e) => {
        slots[id].site = e.target.value;
        drawSlot(id, slots[id], analyses);
      });
      document.querySelector(`#time-${id}`).addEventListener("input", (e) => setIndex(id, Number(e.target.value)));
      drawSlot(id, slots[id], analyses);
    }

    // Table view
    const holder = document.querySelector("#table-holder");
    const drawTable = (siteId) => (holder.innerHTML = tableView(rowsFor(analyses, siteId)));
    document.querySelector("#table-site").addEventListener("change", (e) => drawTable(e.target.value));
    drawTable(slots.a.site);

    // The rules for "visible" (#2, #5): re-work both scenarios, the verdict and the table.
    const onSettings = () => {
      view.settings = {
        sunRule: document.querySelector("#sun-rule").value,
        earthMarginDeg: Number(document.querySelector("#earth-margin").value),
      };
      view.cache.clear();
      document.querySelector("#earth-margin-out").textContent = `${view.settings.earthMarginDeg.toFixed(1)}°`;
      document.querySelector("#settings-sentence").textContent = settingsSentence(view.settings);
      drawSlot("a", slots.a, analyses);
      drawSlot("b", slots.b, analyses);
      drawTable(document.querySelector("#table-site").value);
    };
    document.querySelector("#sun-rule").addEventListener("change", onSettings);
    document.querySelector("#earth-margin").addEventListener("input", onSettings);

    // Any point on the Moon (clicked on the globe or typed in): ask the backend, then add the point
    // to the globe and the page like any other site.
    const customStatus = document.querySelector("#custom-status");
    const customGo = document.querySelector("#custom-go");
    const globeInfo = document.querySelector("#globe-info");
    let busy = false;

    async function analysePoint(lat, lon, from) {
      if (busy) {
        showPanel(`<p class="sub">Still working on the previous point, one moment…</p>`);
        return;
      }
      busy = true;
      customGo.disabled = true;
      const where = `${Number(lat).toFixed(3)}°, ${(((Number(lon) % 360) + 360) % 360).toFixed(3)}° E`;
      if (from === "globe") {
        // Show the clicked coordinates in the form too, so they can be read and edited.
        document.querySelector("#custom-lat").value = Number(lat).toFixed(3);
        document.querySelector("#custom-lon").value = Number(lon).toFixed(3);
      }
      if (globe) {
        globe.markPending(Number(lat), Number(lon));
        globe.setPin(Number(lat), Number(lon));
        globe.flyTo(Number(lat), Number(lon));
      }
      const working = `Analysing ${where}: asking NASA JPL Horizons and building the skyline from NASA LOLA terrain…`;
      showPanel(`<h3>${where}</h3><p class="working"><span class="spinner" aria-hidden="true"></span>${working}</p>`);
      customStatus.className = "";
      customStatus.textContent = working;
      try {
        const { site, analysis } = await loadCustomPoint(lat, lon);
        if (!analyses[site.id]) {
          sites.push(site);
          analyses[site.id] = analysis;
          for (const sel of ["#plan-site", "#site-a", "#site-b", "#table-site"]) {
            document.querySelector(sel).insertAdjacentHTML("beforeend", siteOptions([site], null));
          }
          document.querySelector("#source-files").insertAdjacentHTML("beforeend", siteSourceLine(analysis));
          refreshSiteLists();
          if (globe) globe.addSite(site);
        }
        // Show it everywhere: the globe and its info box, the planning section, scenario A and the table.
        selectSite(site.id);
        slots.a.site = site.id;
        document.querySelector("#site-a").value = site.id;
        drawSlot("a", slots.a, analyses);
        document.querySelector("#table-site").value = site.id;
        drawTable(site.id);
        const terrainNote = analysis.horizon === "flat"
          ? " Flat horizon: no terrain map is downloaded on the server."
          : " Skyline from real NASA LOLA terrain.";
        customStatus.textContent = `Added "${site.label}" to the 3D Moon and the site pickers.${terrainNote}`;
      } catch (error) {
        customStatus.className = "error";
        customStatus.textContent = error.message;
        showPanel(`<h3>${where}</h3><p class="error">${error.message.replace(/</g, "&lt;")}</p>
          <p class="sub">The 3D Moon and every curated site still work; only new points need the backend.</p>`);
      } finally {
        if (globe) globe.markPending(null);
        customGo.disabled = false;
        busy = false;
      }
    }

    // Remove a point you added: off the globe, out of every picker and the sources list.
    // Anything that was showing it switches back to the first site.
    function removePoint(id) {
      const i = sites.findIndex((s) => s.id === id);
      if (i < 0 || !id.startsWith("custom_")) return;
      sites.splice(i, 1);
      delete analyses[id];
      for (const sel of ["#plan-site", "#site-a", "#site-b", "#table-site"]) {
        document.querySelector(`${sel} option[value="${id}"]`)?.remove();
      }
      document.querySelector(`#source-files li[data-site="${id}"]`)?.remove();
      refreshSiteLists();
      if (globe) globe.removeSite(id);
      const fallback = sites[0].id;
      for (const key of ["a", "b"]) {
        if (slots[key].site === id) {
          slots[key].site = fallback;
          document.querySelector(`#site-${key}`).value = fallback;
          drawSlot(key, slots[key], analyses);
        }
      }
      const tableSelect = document.querySelector("#table-site");
      if (!analyses[tableSelect.value]) {
        tableSelect.value = fallback;
        drawTable(fallback);
      }
      selectSite(plan.site === id ? fallback : plan.site);
      customStatus.className = "";
      customStatus.textContent = "Point removed.";
    }

    // The Sites page and the search suggestions, after a point is added or removed.
    function refreshSiteLists() {
      document.querySelector("#sites-list").innerHTML = sitesList(sites);
      document.querySelector("#site-list").innerHTML = sites.map((s) => `<option value="${s.label}">`).join("");
    }

    globeInfo.addEventListener("click", (e) => {
      const button = e.target.closest("[data-remove]");
      if (button) removePoint(button.dataset.remove);
    });

    document.querySelector("#custom-form").addEventListener("submit", (e) => {
      e.preventDefault(); // stay on the page instead of submitting the form
      analysePoint(document.querySelector("#custom-lat").value, document.querySelector("#custom-lon").value, "form");
    });
  } catch (error) {
    app.innerHTML = `<p class="error">Could not load the data: ${String(error.message).replace(/</g, "&lt;")}</p>`;
  }
}

main();
