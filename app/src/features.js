// Official lunar feature names on the 3D Moon, shown by size and zoom like NASA Moon Trek (UI phase 3).
// Pure functions; globe.js does the drawing. The names come from the IAU/USGS Gazetteer of Planetary
// Nomenclature (app/python/scripts/fetch_lunar_names.py -> public/data/lunar_names.json).
import { latLonToXyz } from "./geo.js";

export const MOON_KM = 1737.4;
const SIZE_PER_ALTITUDE = 0.045; // a name shows when its feature is at least 4.5 % of the camera's height
const BIG_KM = 300;              // maria-sized features get a wider, spaced-out label

// The smallest feature (km) worth naming from this camera distance (Moon radius = 1).
export function minDiameterKm(cameraDistance) {
  const altitudeKm = Math.max(0.02, cameraDistance - 1) * MOON_KM;
  return altitudeKm * SIZE_PER_ALTITUDE;
}

// lunar_names.json -> [{ name, lat, lon, d, type, big, pos }], biggest first.
export function parseNames(data) {
  if (!data?.features) return [];
  return data.features
    .map(([name, lat, lon, d, type]) => ({
      name, lat, lon, type, d: d > 0 ? d : 1, big: d >= BIG_KM, pos: latLonToXyz(lat, lon, 1),
    }))
    .sort((a, b) => b.d - a.d);
}

// Is a point on the Moon (unit sphere) on the half facing the camera, with a little margin so labels
// do not sit right on the edge? Camera position in the same units.
export function isOnNearHalf(pos, cameraPos) {
  const r = Math.hypot(...cameraPos);
  const dot = (pos[0] * cameraPos[0] + pos[1] * cameraPos[1] + pos[2] * cameraPos[2]) / r;
  return dot > 1 / r + 0.03;
}
