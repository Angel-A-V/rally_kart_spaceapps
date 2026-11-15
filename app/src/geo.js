// Geometry helpers for the 3D Moon. Pure functions, no three.js in here, so they can be tested.
//
// Convention (matches how three.js wraps a flat world map, centred on longitude 0, onto a sphere):
//   +y is the north pole, +x is latitude 0 / longitude 0 (the middle of the near side),
//   and longitude increases eastward toward -z.

const RAD = Math.PI / 180;

// Latitude / longitude in degrees -> a point [x, y, z] on a sphere of the given radius.
export function latLonToXyz(latDeg, lonDeg, radius = 1) {
  const lat = latDeg * RAD;
  const lon = lonDeg * RAD;
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  ];
}

// The reverse: a point on (or above) the sphere -> latitude and east longitude (0 to 360) in degrees.
// This is what turns a click on the globe into coordinates.
export function xyzToLatLon(x, y, z) {
  const r = Math.hypot(x, y, z);
  const lon = Math.atan2(-z, x) / RAD;
  return { lat: Math.asin(y / r) / RAD, lon: ((lon % 360) + 360) % 360 };
}

// NASA Moon Trek image tiles (LRO wide-angle camera mosaic). Layout confirmed from the service's
// WMTSCapabilities.xml on 2026-11-14: longitude -180 to 180, top-left corner at (-180, 90),
// 256-pixel tiles, 2 x 1 tiles at zoom 0 and doubling each level.
const TILE_BASE = "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm";

export function tileGrid(zoom) {
  return { cols: 2 * 2 ** zoom, rows: 2 ** zoom };
}

export function tileUrl(zoom, row, col) {
  return `${TILE_BASE}/${zoom}/${row}/${col}.jpg`;
}

// A point on the camera's path from one position to another: the direction turns along the great
// circle (so the flight goes around the Moon, never through it) while the distance eases.
export function flightPoint(from, to, t) {
  const r0 = Math.hypot(...from);
  const r1 = Math.hypot(...to);
  const a = from.map((v) => v / r0);
  const b = to.map((v) => v / r1);
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  let dir;
  if (omega < 1e-6) {
    dir = a;
  } else if (Math.PI - omega < 1e-3) {
    // Almost opposite: go over the top (any perpendicular works) so the path stays defined.
    const up = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const mid = [a[1] * up[2] - a[2] * up[1], a[2] * up[0] - a[0] * up[2], a[0] * up[1] - a[1] * up[0]];
    const m = Math.hypot(...mid);
    const half = t < 0.5 ? [a, mid.map((v) => v / m), t * 2] : [mid.map((v) => v / m), b, t * 2 - 1];
    return flightPoint(half[0].map((v) => v * (r0 + (r1 - r0) * t)), half[1].map((v) => v * (r0 + (r1 - r0) * t)), half[2]);
  } else {
    const s0 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s1 = Math.sin(t * omega) / Math.sin(omega);
    dir = a.map((v, i) => v * s0 + b[i] * s1);
  }
  // Pull back a little mid-flight on long hops, like a real flyover, then settle at the new distance.
  const lift = 0.35 * Math.sin(Math.PI * t) * Math.min(1, omega / 1.2);
  const r = r0 + (r1 - r0) * t + lift;
  return dir.map((v) => v * r);
}
