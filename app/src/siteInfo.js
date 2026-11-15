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
