import "./style.css";
import { loadChecks, loadCrosscheck, loadCustomPoint, loadSites, loadSiteAnalysis } from "./data.js";
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

// The section with the 3D Moon. The globe itself is added by createGlobe() after the page is built.
function globeSection() {
  return `
    <section class="card globe-card">
      <h2>Pick any point on the Moon</h2>
      <div class="globe-layout">
        <div>
          <div id="globe" class="globe-wrap"></div>
          <div class="globe-controls">
            <button type="button" id="view-pole">South pole view</button>
            <button type="button" id="view-north">North pole view</button>
            <button type="button" id="view-moon">Whole Moon</button>
            <span class="sub">Drag to turn, scroll to zoom. <strong>Click anywhere on the surface</strong> to analyse
            that spot with real terrain, or click a marker to open that site.</span>
          </div>
          <ul class="legend">
            <li><span class="dot named"></span> Named feature (NASA Moon Trek)</li>
            <li><span class="dot model"></span> Model site</li>
            <li><span class="dot custom"></span> Your points</li>
            <li><span class="dot pending"></span> Working on it</li>
            <li><span class="dot picked"></span> Selected</li>
          </ul>
        </div>
        <div id="globe-info" class="globe-info"></div>
      </div>
    </section>`;
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
  return `
    <h1>Lunar Landing Site Navigator</h1>
    <p class="intro">Which site, and when? Compare landing sites anywhere on the Moon by how long the Sun (power) and
    Earth (direct radio contact) stay above the local skyline, and find the best time to land. The curated sites
    cover both poles and past landing sites; click anywhere on the 3D Moon to analyse any other spot.</p>
    ${globeSection()}
    ${customSection()}
    ${planSection(sites, plan)}
    ${statsPanel(sites)}
    ${accuracyPanel(check, sites, checks)}
    <section class="moment">
      <h2>Look at one moment: where are the Sun and Earth in the sky?</h2>
      <p>Pick a site and a time in each scenario to compare two sites, or two moments at the same site
      (30 days of hourly data).</p>
      ${legend()}
      ${settingsControls()}
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
      <h3>Which is better?</h3>
      <p class="verdict" id="compare-verdict" aria-live="polite"></p>
    </section>
    ${tableSection(sites, slots.a.site)}
    ${sourcesPanel(analyses)}`;
}

function drawSlot(id, slot, analyses) {
  const analysis = analyses[slot.site];
  const row = rowsFor(analyses, slot.site)[slot.index]; // visible/next change follow the current rules
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

    // Planning section
    const planHolder = document.querySelector("#plan-holder");
    const drawPlan = () => (planHolder.innerHTML = planPanel(sites, analyses, plan.site, plan.days));

    // The globe. It is loaded separately and inside try/catch: if 3D graphics (WebGL) are not
    // available, the rest of the page must still work.
    let globe = null;
    try {
      const { createGlobe } = await import("./globe.js");
      globe = createGlobe(
        document.querySelector("#globe"), sites,
        (id) => selectSite(id),
        (lat, lon) => analysePoint(lat, lon, "globe"),
      );
      document.querySelector("#view-pole").addEventListener("click", () => globe.setView("pole"));
      document.querySelector("#view-north").addEventListener("click", () => globe.setView("north"));
      document.querySelector("#view-moon").addEventListener("click", () => globe.setView("moon"));
    } catch (error) {
      document.querySelector("#globe").innerHTML =
        `<p class="error">The 3D Moon could not start (${error.message}). Use the site pickers below instead.</p>`;
    }

    // One place that changes the selected site, so the globe, the info box and the plan agree.
    function selectSite(id) {
      plan.site = id;
      document.querySelector("#plan-site").value = id;
      const removable = id.startsWith("custom_") // only points you added yourself can be removed
        ? `<button type="button" class="remove-point" data-remove="${id}">Remove this point</button>`
        : "";
      const site = sites.find((s) => s.id === id);
      document.querySelector("#globe-info").innerHTML = siteInfo(site) + accuracyNote(check?.sites[id], site, checks) + removable;
      if (globe) globe.select(id);
      drawPlan();
    }

    document.querySelector("#plan-site").addEventListener("change", (e) => selectSite(e.target.value));
    document.querySelector("#plan-days").addEventListener("change", (e) => {
      plan.days = Number(e.target.value);
      drawPlan();
    });
    selectSite(plan.site);

    // The two scenarios
    for (const id of ["a", "b"]) {
      document.querySelector(`#site-${id}`).addEventListener("change", (e) => {
        slots[id].site = e.target.value;
        drawSlot(id, slots[id], analyses);
      });
      document.querySelector(`#time-${id}`).addEventListener("input", (e) => {
        slots[id].index = Number(e.target.value);
        drawSlot(id, slots[id], analyses);
      });
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
        globeInfo.innerHTML = `<p class="sub">Still working on the previous point, one moment…</p>`;
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
      if (globe) globe.markPending(Number(lat), Number(lon));
      const working = `Analysing ${where}: asking NASA JPL Horizons and building the skyline from NASA LOLA terrain…`;
      globeInfo.innerHTML = `<h3>${where}</h3><p>${working}</p>`;
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
        globeInfo.innerHTML = `<h3>${where}</h3><p class="error">${error.message.replace(/</g, "&lt;")}</p>`;
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
