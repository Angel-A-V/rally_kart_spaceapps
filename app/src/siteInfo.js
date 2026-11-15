// The box next to the globe: what the selected site is, and its headline numbers for the year.
// Pure function: one entry of the sites index in, HTML text out.
import { formatDuration } from "./format.js";
import { infoTip } from "./ui/infoTip.js";

// Plain-English explanations behind the "i" buttons (wording from Darren's UI pass, cf166e9).
const TIP = {
  sun: infoTip("Sun visible in the year", `<p>How much of the year the Sun is above the hills around this spot.</p>
    <p>Landers run on solar panels, so more sunlight means more power. Near the poles the Sun skims along the
    horizon all year, so a single ridge can hide it for days.</p>`),
  earth: infoTip("Earth visible in the year", `<p>How much of the year Earth is above the hills.</p>
    <p>When Earth is in view, the lander can radio home directly. When it is hidden, messages need a relay
    satellite in orbit, or they wait.</p>`),
  both: infoTip("Both visible in the year", `<p>How much of the year the lander has <strong>power and a direct
    line home at the same time</strong>. This is the time a mission can work normally, so higher is better.</p>`),
  stretch: infoTip("Longest stretch with both", `<p>The longest unbroken run of time in the year with the Sun and
    Earth both above the skyline: the longest a mission could work without a break in power or radio.</p>`),
  dark: infoTip("Longest Sun-dark stretch", `<p>The longest the Sun stays hidden here in a year. A lander has to
    survive that long on batteries, in temperatures far below freezing. Shorter is safer.</p>`),
};

// A ring that fills to the percentage, with the number in the middle (Darren's UI pass, cf166e9).
function ring(pct) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const fill = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return `
    <svg class="ring" viewBox="0 0 60 60" aria-hidden="true">
      <circle class="ring-track" cx="30" cy="30" r="${r}"/>
      <circle class="ring-fill" cx="30" cy="30" r="${r}" stroke-dasharray="${fill.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 30 30)"/>
    </svg>`;
}

function score(kind, title, pct, days) {
  return `
    <div class="score ${kind}">
      <div class="score-ring">${ring(pct)}<span class="score-pct">${Math.round(pct)}%</span></div>
      <div class="score-label">${title}</div>
      <div class="score-sub">${Math.round(days)} days a year</div>
    </div>`;
}

// ----- Angel's Claude Design "Panel C · Learn / Research" -----
// Learn: each yearly number answers a plain question, with a 50-square strip (1 square = 2% of the year).
// Research: the full table of numbers. The mode is a data attribute on the panel (set in main.js).

const tag = (pct, words) => words.find(([min]) => pct >= min)[1];
const SUN_TAGS = [[70, "Mostly"], [40, "Often"], [1, "Rarely"], [0, "Never"]];
const EARTH_TAGS = [[99.5, "Always"], [70, "Mostly"], [40, "About half"], [1, "Rarely"], [0, "Never"]];
const BOTH_TAGS = [[60, "Good"], [30, "Some"], [1, "Rarely"], [0, "Never"]];

function strip(kind, pct) {
  const n = Math.round(Math.max(0, Math.min(100, pct)) / 2);
  const cells = Array.from({ length: 50 }, (_, i) => `<span${i < n ? ` class="on"` : ""}></span>`).join("");
  return `<div class="waffle ${kind}" role="img" aria-label="${pct.toFixed(1)} percent of the year">${cells}</div>`;
}

function question(kind, q, tagText, big, rest, pct) {
  return `
    <article class="q-card ${kind}">
      <div class="q-head"><h4>${q}</h4><span class="q-tag">${tagText}</span></div>
      <p class="q-answer"><span class="q-big">${big}</span> ${rest}</p>
      ${pct === null ? "" : strip(kind, pct)}
    </article>`;
}

// Name, place and the Learn / Research switch: goes at the top of the panel.
export function siteHead(site) {
  const pole = site.lat_deg < 0 ? "south" : "north";
  const poleKm = (1737.4 * (90 - Math.abs(site.lat_deg)) * Math.PI) / 180;
  return `
    <div class="site-head">
      <div>
        <h3>${site.label}</h3>
        <p class="sub">${site.lat_deg.toFixed(3)}°, ${site.lon_deg_east.toFixed(3)}° E · ${poleKm.toFixed(1)} km from the ${pole} pole</p>
      </div>
      <div class="mode-switch" role="group" aria-label="View mode">
        <button type="button" data-mode-btn="learn">Learn</button>
        <button type="button" data-mode-btn="research">Research</button>
      </div>
    </div>`;
}

// The year, both ways: Learn shows the question cards, Research the table (CSS hides the other).
export function siteYear(site) {
  const y = site.year;
  const pct = (v) => `${Math.round(v)}%`;
  return `
    <section class="mode-learn" aria-label="Over a whole year">
      <h4 class="q-title">Over a whole year</h4>
      ${question("sun", "Will a solar lander have power?", tag(y.sun_visible_pct, SUN_TAGS), pct(y.sun_visible_pct),
        `of the year the Sun is up, about ${Math.round(y.sun_visible_days)} days.`, y.sun_visible_pct)}
      ${question("earth", "Can it radio Earth directly?", tag(y.earth_visible_pct, EARTH_TAGS), pct(y.earth_visible_pct),
        `of the year. The rest of the time Earth is below the hills or the horizon.`, y.earth_visible_pct)}
      ${question("both", "Both at the same time?", tag(y.both_visible_pct, BOTH_TAGS), pct(y.both_visible_pct),
        y.longest_both_visible_hours > 0 ? `of the year, with up to ${formatDuration(y.longest_both_visible_hours)} without a break.` : "of the year.",
        y.both_visible_pct)}
      ${question("dark", "How long is the longest night?", "Plan for it", formatDuration(y.longest_sun_dark_hours),
        "without the Sun. Batteries and heaters must last that long.", null)}
    </section>
    <section class="mode-research">${siteInfo(site)}</section>`;
}

export function siteInfo(site) {
  const y = site.year;
  // Distance along the surface from the nearer pole (arc length, Moon radius 1737.4 km).
  const pole = site.lat_deg < 0 ? "south" : "north";
  const poleKm = (1737.4 * (90 - Math.abs(site.lat_deg)) * Math.PI) / 180;
  const height = `${site.site_height_m >= 0 ? "+" : ""}${Math.round(site.site_height_m).toLocaleString("en-US")} m`;
  return `
    <h3>${site.label}</h3>
    <p>${site.description}</p>
    <div class="scores" role="group" aria-label="How good this site is over a year">
      ${score("sun", "Sunlight", y.sun_visible_pct, y.sun_visible_days)}
      ${score("earth", "Earth in view", y.earth_visible_pct, y.earth_visible_days)}
      ${score("both", "Both at once", y.both_visible_pct, y.both_visible_days)}
    </div>
    <table class="numbers">
      <tbody>
        <tr><th>Position</th><td>${site.lat_deg.toFixed(3)}°, ${site.lon_deg_east.toFixed(3)}° E</td></tr>
        <tr><th>Distance from the ${pole} pole</th><td>${poleKm.toFixed(1)} km</td></tr>
        <tr><th>Ground height (above the Moon's mean radius)</th><td>${height}</td></tr>
        <tr><th>Sun visible in the year ${TIP.sun}</th><td>${y.sun_visible_days.toFixed(1)} d (${y.sun_visible_pct.toFixed(1)}%)</td></tr>
        <tr><th>Earth visible in the year ${TIP.earth}</th><td>${y.earth_visible_days.toFixed(1)} d (${y.earth_visible_pct.toFixed(1)}%)</td></tr>
        <tr><th>Both visible in the year ${TIP.both}</th><td>${y.both_visible_days.toFixed(1)} d (${y.both_visible_pct.toFixed(1)}%)</td></tr>
        <tr><th>Longest stretch with both ${TIP.stretch}</th><td>${formatDuration(y.longest_both_visible_hours)}</td></tr>
        <tr><th>Longest Sun-dark stretch ${TIP.dark}</th><td>${formatDuration(y.longest_sun_dark_hours)}</td></tr>
      </tbody>
    </table>
    <p class="sub">Coordinate: ${site.coordinate_source}.</p>`;
}
