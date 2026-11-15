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

// The pictures the globe can wear. Both are NASA Moon Trek tile sets with the same layout.
//   photo  LRO wide-angle camera mosaic (what the Moon looks like)
//   lola   LRO LOLA laser-altimeter elevation, coloured by height with hill shading
export const LAYERS = {
  photo: { base: TILE_BASE, ext: "jpg", maxZoom: 7 },
  lola: {
    base: "https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_256ppd_v06/1.0.0/default/default028mm",
    ext: "png", maxZoom: 6,
  },
};

export function tileUrl(zoom, row, col, layer = "photo") {
  const l = LAYERS[layer];
  return `${l.base}/${zoom}/${row}/${col}.${l.ext}`;
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

// Which sharper Moon Trek tiles to load for the area in view (the "detail patch" on the globe).
// lat0, lon0: the point under the camera; viewDeg: how many degrees of the Moon the view spans
// from its centre to its edge. Returns null when the base picture is already sharp enough, or
// { zoom, row0, rows, col0, cols, tileW, latN, latS, lonW, lonE } where tiles (row0.., col0..) at
// `zoom` cover latS..latN and lonW..lonE (lonE may pass 180: columns wrap), drawn tileW pixels wide.
export function detailWindow(lat0, lon0, viewDeg, { baseZoom = 3, maxZoom = 7, maxRows = 8, maxPx = 4096, tile = 256, maxTiles = 400 } = {}) {
  const half = Math.min(60, Math.max(0.5, viewDeg));
  for (let zoom = maxZoom; zoom > baseZoom; zoom--) {
    const step = 180 / 2 ** zoom;                 // degrees per tile (both directions)
    const total = 2 * 2 ** zoom;                  // columns around the Moon
    const row0 = Math.max(0, Math.floor((90 - (lat0 + half)) / step));
    const row1 = Math.min(2 ** zoom - 1, Math.floor((90 - (lat0 - half)) / step));
    const rows = row1 - row0 + 1;
    if (rows > maxRows) continue;
    const latN = 90 - row0 * step;
    const latS = 90 - (row1 + 1) * step;
    // Near a pole the view reaches every longitude; elsewhere widen by 1 / cos(latitude).
    const worst = Math.max(Math.abs(lat0 + half), Math.abs(lat0 - half));
    const lonHalf = worst >= 88 ? 180 : Math.min(180, half / Math.cos((worst * Math.PI) / 180));
    let col0 = 0;
    let cols = total;
    if (lonHalf < 180) {
      col0 = Math.floor((lon0 - lonHalf + 180) / step);
      cols = Math.min(total, Math.floor((lon0 + lonHalf + 180) / step) - col0 + 1);
      if (cols === total) col0 = 0;
    }
    const tileW = Math.min(tile, Math.floor(maxPx / cols));
    if (tileW < 32 || rows * cols > maxTiles) continue; // too squashed, or too many downloads
    const lonW = -180 + col0 * step;
    return { zoom, row0, rows, col0, cols, tileW, latN, latS, lonW, lonE: lonW + cols * step };
  }
  return null;
}

// Where the Sun is, as a direction in the globe's own coordinates, from what one site sees:
// the Sun's compass direction (azimuth, clockwise from north) and height (elevation) at (lat, lon).
// The Sun is so far away that this direction is the same for the whole Moon, so it tells which
// half is in daylight. Returns a unit vector [x, y, z] (same axes as latLonToXyz).
export function sunDirection(latDeg, lonDeg, azDeg, elDeg) {
  const lat = latDeg * RAD;
  const lon = lonDeg * RAD;
  const up = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
  const north = [-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)];
  const east = [-Math.sin(lon), 0, -Math.cos(lon)];
  const az = azDeg * RAD;
  const el = elDeg * RAD;
  const e = Math.cos(el) * Math.sin(az);
  const n = Math.cos(el) * Math.cos(az);
  const u = Math.sin(el);
  return [0, 1, 2].map((i) => e * east[i] + n * north[i] + u * up[i]);
}
