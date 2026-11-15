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
