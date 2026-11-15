// Horizon strip: compass direction (azimuth) across, angle above the horizon (elevation) up.
// Pure function: numbers in, SVG text out. No fetching and no physics in here.
//
// How to read it:
//   gray terrain  = everything below the skyline (the terrain you would see around the site)
//   dashed line   = a perfectly flat horizon (0 degrees)
//   filled dot    = the body is ABOVE the skyline (visible)
//   hollow dot    = the body is BELOW the skyline (blocked)
//
// The height range adapts to the site: at least -8 to +8 degrees (it covers Earth's full swing
// at the poles), taller for sites whose skyline is high (for example a crater floor).

import { formatSigned } from "./format.js";

const W = 720;
const H = 230;
const M = { left: 46, right: 16, top: 14, bottom: 40 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

// Work out the vertical range and the two conversion functions (degrees -> screen position).
// It depends only on the site's skyline (never on the time), so the scale does not jump while
// you drag the time slider. A body outside the range is drawn at the edge of the strip.
function makeScale(skyline) {
  const top = Math.max(...skyline);
  const bottom = Math.min(...skyline);
  const elMax = Math.max(8, Math.ceil((top + 1) / 4) * 4);
  const elMin = Math.min(-8, Math.floor((bottom - 1) / 4) * 4);
  return {
    elMin,
    elMax,
    gridStep: elMax - elMin > 24 ? 8 : 4,
    x: (az) => M.left + (az / 360) * PLOT_W,
    y: (el) => {
      const clamped = Math.min(elMax, Math.max(elMin, el));
      return M.top + ((elMax - clamped) / (elMax - elMin)) * PLOT_H;
    },
  };
}

function gridAndAxes(sc) {
  let out = "";
  const levels = new Set([0]); // the flat horizon is always drawn
  for (let el = Math.ceil(sc.elMin / sc.gridStep) * sc.gridStep; el <= sc.elMax; el += sc.gridStep) {
    levels.add(el);
  }
  for (const el of levels) {
    const cls = el === 0 ? "grid zero" : "grid";
    out += `<line class="${cls}" x1="${M.left}" x2="${W - M.right}" y1="${sc.y(el)}" y2="${sc.y(el)}"/>`;
    out += `<text class="axis-label" x="${M.left - 8}" y="${sc.y(el) + 4}" text-anchor="end">${el}°</text>`;
  }
  const ticks = [[0, "North"], [90, "East"], [180, "South"], [270, "West"], [360, "North"]];
  for (const [az, name] of ticks) {
    out += `<line class="tick" x1="${sc.x(az)}" x2="${sc.x(az)}" y1="${H - M.bottom}" y2="${H - M.bottom + 5}"/>`;
    const anchor = az === 0 ? "start" : az === 360 ? "end" : "middle";
    out += `<text class="compass" x="${sc.x(az)}" y="${H - M.bottom + 19}" text-anchor="${anchor}">${name}</text>`;
  }
  out += `<text class="axis-title" x="${M.left + PLOT_W / 2}" y="${H - 4}" text-anchor="middle">Compass direction (azimuth)</text>`;
  out += `<text class="axis-title" x="12" y="${M.top + PLOT_H / 2}" text-anchor="middle" transform="rotate(-90 12 ${M.top + PLOT_H / 2})">Angle above horizon</text>`;
  return out;
}

// Dark sky with a sprinkle of stars (fixed positions, so they do not jump while time plays).
// The terrain is drawn on top, so stars only show above the skyline. (Darren's UI pass, cf166e9.)
function sky() {
  let out = `<rect class="sky-bg" x="${M.left}" y="${M.top}" width="${PLOT_W}" height="${PLOT_H}" rx="4"/>`;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = M.left + rand() * PLOT_W;
    const y = M.top + rand() * PLOT_H;
    out += `<circle class="star" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.4 + rand() * 0.9).toFixed(2)}"/>`;
  }
  return out;
}

// Words inside the picture, so nobody needs the legend: sky, hills, flat horizon.
function labels(sc, skyline) {
  const floor = sc.y(sc.elMin);
  const top = Math.max(...skyline);
  // "hills" goes under the lowest part of the skyline, where there is the most room
  let lowAz = 30;
  for (let az = 30; az < 330; az++) if (skyline[az] < skyline[lowAz]) lowAz = az;
  const hillsY = Math.min(floor - 8, sc.y(skyline[lowAz]) + 20);
  let out = "";
  if (sc.y(top) - M.top > 26) out += `<text class="in-label" x="${M.left + 8}" y="${M.top + 16}">Sky</text>`;
  if (floor - sc.y(skyline[lowAz]) > 26) out += `<text class="in-label hills" x="${sc.x(lowAz)}" y="${hillsY}" text-anchor="middle">Hills and crater walls</text>`;
  out += `<text class="flat-label" x="${W - M.right - 4}" y="${sc.y(0) - 4}" text-anchor="end">flat horizon</text>`;
  return out;
}

function terrain(sc, skyline) {
  const points = [];
  for (let az = 0; az <= 360; az++) {
    points.push(`${sc.x(az).toFixed(1)},${sc.y(skyline[az % 360]).toFixed(1)}`); // az 360 repeats az 0
  }
  const bottom = sc.y(sc.elMin);
  const fill = `${sc.x(0)},${bottom} ${points.join(" ")} ${sc.x(360)},${bottom}`;
  return `<polygon class="terrain" points="${fill}"/><polyline class="skyline-line" points="${points.join(" ")}"/>`;
}

function marker(sc, name, cls, az, el, skylineAtAz, visible) {
  const cx = sc.x(az);
  const cy = sc.y(el);
  const labelOnLeft = cx > W - 150;
  const labelX = labelOnLeft ? cx - 12 : cx + 12;
  const labelY = cy - 10 < M.top + 8 ? cy + 20 : cy - 10;
  const state = visible ? "above the skyline (visible)" : "below the skyline (blocked)";
  const tip = `${name}: azimuth ${az.toFixed(1)}°, elevation ${formatSigned(el)}°, skyline there ${formatSigned(skylineAtAz)}°, ${state}`;
  // The Sun gets rays when it is shining on the site; a hidden body is a hollow ring.
  let rays = "";
  if (cls === "sun" && visible) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      rays += `<line class="ray" x1="${(cx + Math.cos(a) * 10).toFixed(1)}" y1="${(cy + Math.sin(a) * 10).toFixed(1)}" x2="${(cx + Math.cos(a) * 14).toFixed(1)}" y2="${(cy + Math.sin(a) * 14).toFixed(1)}"/>`;
    }
  }
  const word = visible ? "visible" : "hidden";
  return (
    `<g><title>${tip}</title>${rays}` +
    `<circle class="mk ${cls} ${visible ? "filled" : "hollow"}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7"/>` +
    `<text class="mk-label" x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${labelOnLeft ? "end" : "start"}">${name} <tspan class="mk-state ${visible ? "yes" : "no"}">${visible ? "✓" : "✗"} ${word}</tspan></text></g>`
  );
}

// skyline: array of 360 angles. row: one analysed row from the data file.
export function skyDiagram(skyline, row) {
  const sc = makeScale(skyline);
  const summary =
    `Sun at azimuth ${row.sun_az_deg.toFixed(0)} degrees, ${row.sun_visible ? "above" : "below"} the skyline. ` +
    `Earth at azimuth ${row.earth_az_deg.toFixed(0)} degrees, ${row.earth_visible ? "above" : "below"} the skyline.`;
  return (
    `<svg class="sky" viewBox="0 0 ${W} ${H}" role="img" aria-label="${summary}">` +
    sky() +
    gridAndAxes(sc) +
    terrain(sc, skyline) +
    labels(sc, skyline) +
    marker(sc, "Earth", "earth", row.earth_az_deg, row.earth_el_deg, row.earth_skyline_deg, row.earth_visible) +
    marker(sc, "Sun", "sun", row.sun_az_deg, row.sun_el_deg, row.sun_skyline_deg, row.sun_visible) +
    `</svg>`
  );
}
