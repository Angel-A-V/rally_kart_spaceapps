// "The year: ranked by region" (Angel's Claude Design, Year B). Pure: the sites index and the current
// choices in, HTML text out. Same yearly numbers as statsPanel.js, shown as a ranked list with bars.
import { formatDuration } from "./format.js";

export const REGIONS = [
  ["south", "South pole", (s) => s.lat_deg <= -80],
  ["north", "North pole", (s) => s.lat_deg >= 80],
  ["other", "Everywhere else", (s) => Math.abs(s.lat_deg) < 80],
];

// key, label, colour class, value, text, lower-is-better
export const COLUMNS = [
  ["sun", "Sunlight", "sun", (y) => y.sun_visible_pct, (y) => `${y.sun_visible_pct.toFixed(1)}%`, false],
  ["earth", "Earth in view", "earth", (y) => y.earth_visible_pct, (y) => `${y.earth_visible_pct.toFixed(1)}%`, false],
  ["both", "Both", "both", (y) => y.both_visible_pct, (y) => `${y.both_visible_pct.toFixed(1)}%`, false],
  ["stretch", "Longest with both", "both", (y) => y.longest_both_visible_hours, (y) => formatDuration(y.longest_both_visible_hours), false],
  ["dark", "Longest dark", "dark", (y) => y.longest_sun_dark_hours, (y) => formatDuration(y.longest_sun_dark_hours), true],
];

export function rankSites(sites, region, sortKey) {
  const keep = (REGIONS.find(([k]) => k === region) ?? REGIONS[0])[2];
  const col = COLUMNS.find(([k]) => k === sortKey) ?? COLUMNS[2];
  const value = col[3];
  const list = sites.filter(keep);
  list.sort((a, b) => (col[5] ? value(a.year) - value(b.year) : value(b.year) - value(a.year)));
  return list;
}

export function yearRanked(sites, { region = "south", sortKey = "both" } = {}) {
  const list = rankSites(sites, region, sortKey);
  const max = Object.fromEntries(COLUMNS.map(([k, , , v]) => [k, Math.max(1e-9, ...list.map((s) => v(s.year)))]));
  const days = Math.round(sites[0].year.span_days);
  const regions = REGIONS.map(([k, label]) =>
    `<button type="button" data-yr-region="${k}" aria-pressed="${k === region}">${label}</button>`).join("");
  const heads = COLUMNS.map(([k, label, cls, , , low]) =>
    `<button type="button" class="yr-col ${cls}" data-yr-sort="${k}" aria-pressed="${k === sortKey}"
      aria-label="Rank by ${label}${low ? " (shorter is better)" : ""}"><i></i>${label}${k === sortKey ? (low ? " ↑" : " ↓") : ""}</button>`).join("");
  const rows = list.map((s, i) => `
    <div class="yr-row">
      <span class="yr-rank">${i + 1}</span>
      <button type="button" class="yr-name" data-site="${s.id}">
        <span>${s.label}</span>
        <small>${s.lat_deg.toFixed(2)}°, ${s.lon_deg_east.toFixed(2)}° E${s.is_model_site ? " · model site" : ""}</small>
      </button>
      ${COLUMNS.map(([k, , cls, v, text]) => `
        <div class="yr-cell ${cls}${k === sortKey ? " sorted" : ""}">
          <span>${text(s.year)}</span>
          <div class="yr-bar"><div style="width:${((100 * v(s.year)) / max[k]).toFixed(1)}%"></div></div>
        </div>`).join("")}
    </div>`).join("");
  return `
    <section class="card year yr">
      <h2>How good is each site over a full year?</h2>
      <p>Pick a region, then tap a column to rank by it. Longer bars are better, except <em>Longest dark</em>,
      which a lander's batteries must survive. Tap a site to fly there.</p>
      <div class="yr-top">
        <div class="seg" role="group" aria-label="Region">${regions}</div>
        <span class="sub">${list.length} sites · ${days} days in 6-hour steps</span>
      </div>
      <div class="yr-table" role="table" aria-label="Sites ranked">
        <div class="yr-row yr-head"><span></span><span class="yr-site-h">Site</span>${heads}</div>
        ${rows || `<p class="sub">No sites in this region.</p>`}
      </div>
    </section>`;
}
