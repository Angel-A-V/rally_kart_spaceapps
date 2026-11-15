// THE DATA LAYER: the only file that fetches anything (architecture rule 1).
// The JSON files are made by app/python/scripts/export_site_json.py. Python does the
// calculation; the page only displays it. Vite serves everything in app/public/ from the root.
const BASE = "/data";

async function getJson(name) {
  const url = `${BASE}/${name}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status}). Did you run export_site_json.py?`);
  }
  return await response.json(); // turns the JSON text into a JavaScript object
}

// Short list of every site with its yearly statistics.
export function loadSites() {
  return getJson("sites.json");
}

// One site: 30 days of hourly rows, the skyline, and its yearly statistics.
export function loadSiteAnalysis(id) {
  return getJson(`${id}_analysis.json`);
}

// Our numbers checked against NASA's published polar maps (scripts/crosscheck_pgda.py).
// Optional: if the file is missing the page still works, just without the accuracy section.
export function loadCrosscheck() {
  return getJson("crosscheck.json").catch(() => null);
}

// Apollo records, LROC stereo terrain and physics checks (scripts/crosscheck_nonpolar.py). Optional too.
export function loadChecks() {
  return getJson("checks.json").catch(() => null);
}

// Official lunar feature names for the globe (scripts/fetch_lunar_names.py). Optional.
export function loadLunarNames() {
  return getJson("lunar_names.json").catch(() => null);
}

// Any point on the Moon, analysed live by the Python backend (app/python/server/app.py).
// Returns { site, analysis }: `site` has the shape of one sites.json entry and `analysis`
// the shape of a <site>_analysis.json file, so the rest of the page treats it like any site.
export async function loadCustomPoint(lat, lon) {
  const url = `/api/custom?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Could not reach the backend.");
  }
  const body = await response.json().catch(() => null); // null if the reply is not JSON
  if (!body) {
    // Usually Vite's proxy answering because nothing is listening on port 8000.
    throw new Error("The backend is not running. Start it with: .venv/bin/python app/python/server/app.py");
  }
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}
