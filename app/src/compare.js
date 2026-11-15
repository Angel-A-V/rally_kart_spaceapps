// "A vs B at a glance" (Gustavo's wireframe v2, UI phase 4). Pure: two sides in, a table out.
// a, b: { name: "A", label, row, rows, year } — rows already passed through applySettings();
// year is the site's yearly summary from sites.json (default rules).
import { formatDuration } from "./format.js";
import { summarise } from "./settings.js";

const pct = (v) => `${Math.round(v)}%`;
const upDown = (v) => (v ? "✓ up" : "✗ blocked");
function nextChange(row, body) {
  const hours = row[`${body}_event_hours`];
  const name = row[`${body}_event`];
  return hours === null ? `no ${name} in the data` : `${name} in ${formatDuration(hours)}`;
}

// One table row; `better` = "a", "b" or null, marked in bold with a word for screen readers.
function line(question, va, vb, better = null) {
  const cell = (v, side) => better === side
    ? `<td class="better">${v} <span class="visually-hidden">better</span></td>`
    : `<td>${v}</td>`;
  return `<tr><th scope="row">${question}</th>${cell(va, "a")}${cell(vb, "b")}</tr>`;
}
const pick = (x, y) => (x > y ? "a" : y > x ? "b" : null);

export function atAGlance(a, b) {
  const sa = summarise(a.rows);
  const sb = summarise(b.rows);
  const ya = a.year || {};
  const yb = b.year || {};
  return `
    <table class="numbers glance">
      <thead><tr><th></th><th scope="col">${a.name}: ${a.label}</th><th scope="col">${b.name}: ${b.label}</th></tr></thead>
      <tbody>
        ${line("Sun now", upDown(a.row.sun_visible), upDown(b.row.sun_visible))}
        ${line("Earth now", upDown(a.row.earth_visible), upDown(b.row.earth_visible))}
        ${line("Next Sun change", nextChange(a.row, "sun"), nextChange(b.row, "sun"))}
        ${line("Next Earth change", nextChange(a.row, "earth"), nextChange(b.row, "earth"))}
        ${line("Both up, these 30 days", pct(sa.both), pct(sb.both), pick(sa.both, sb.both))}
        ${line("Both up, over the year", pct(ya.both_visible_pct ?? 0), pct(yb.both_visible_pct ?? 0),
          pick(ya.both_visible_pct ?? 0, yb.both_visible_pct ?? 0))}
        ${line("Longest stretch with both", formatDuration(ya.longest_both_visible_hours ?? 0),
          formatDuration(yb.longest_both_visible_hours ?? 0),
          pick(ya.longest_both_visible_hours ?? 0, yb.longest_both_visible_hours ?? 0))}
      </tbody>
    </table>`;
}

// "Over a year", head to head (Angel's Claude Design "Compare"): A's bar grows left, B's grows right,
// the better side is bright and bold. ya, yb: yearly summaries from sites.json; la, lb: site names.
const YEAR_ROWS = [
  ["Sunlight", "share of the year", "sun", (y) => y.sun_visible_pct, (y) => pct(y.sun_visible_pct), 100, false],
  ["Earth in view", "share of the year", "earth", (y) => y.earth_visible_pct, (y) => pct(y.earth_visible_pct), 100, false],
  ["Both at once", "share of the year", "both", (y) => y.both_visible_pct, (y) => pct(y.both_visible_pct), 100, false],
  ["Longest with both", "unbroken power + radio", "both", (y) => y.longest_both_visible_hours, (y) => formatDuration(y.longest_both_visible_hours), null, false],
  ["Longest dark", "shorter is better", "dark", (y) => y.longest_sun_dark_hours, (y) => formatDuration(y.longest_sun_dark_hours), null, true],
];

export function yearHeadToHead(la, ya, lb, yb) {
  if (!ya || !yb) return "";
  const rows = YEAR_ROWS.map(([label, hint, cls, v, text, top, low]) => {
    const a = v(ya), b = v(yb);
    const max = top ?? Math.max(a, b, 1e-9);
    const better = a === b ? null : (low ? (a < b ? "a" : "b") : (a > b ? "a" : "b"));
    const side = (s, val, t) => `
      <div class="hh-side ${s}${better === s ? " better" : ""}">
        <span>${t}${better === s ? ` <span class="visually-hidden">better</span>` : ""}</span>
        <div class="hh-bar ${cls}"><div style="width:${((100 * val) / max).toFixed(1)}%"></div></div>
      </div>`;
    return `<div class="hh-row">${side("a", a, text(ya))}<div class="hh-mid"><strong>${label}</strong><small>${hint}</small></div>${side("b", b, text(yb))}</div>`;
  }).join("");
  return `
    <div class="hh">
      <div class="hh-row hh-head"><span>A · ${la}</span><span>Over a year</span><span>B · ${lb}</span></div>
      ${rows}
      <p class="sub">Brighter bar and bold value = the better site for that row.</p>
    </div>`;
}
