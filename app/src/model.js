// The link to the tabletop model (GitHub issue #15). The board (Arduino UNO Q) serves its own small page;
// this site only opens that page in a new tab with the Sun's (or Earth's) direction in the address:
//   http://<board>:7000/?site=<name>&az=<deg>&el=<deg>[&cmd=EARTH]
// The button exists only when the site was opened with ?model=<board address>, so public visitors never
// see it. Only addresses on the local network are accepted, so a crafted link cannot point it elsewhere.

const DEFAULT_PORT = 7000;
const KEY = "moon-model-address";

// "10.35.17.220", "192.168.1.50:7000", "moon-disc.local" -> "host:port", or null if not a local address.
export function parseModelAddress(text) {
  if (typeof text !== "string") return null;
  const m = text.trim().toLowerCase().replace(/^http:\/\//, "").replace(/\/$/, "")
    .match(/^([a-z0-9.-]+)(?::(\d{1,5}))?$/);
  if (!m) return null;
  const [, host, portText] = m;
  const port = portText ? Number(portText) : DEFAULT_PORT;
  if (port < 1 || port > 65535) return null;
  const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  let ok = false;
  if (ip) {
    const [a, b, c, d] = ip.slice(1).map(Number);
    const valid = [a, b, c, d].every((n) => n <= 255);
    ok = valid && (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127);
  } else {
    ok = host === "localhost" || /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.local$/.test(host);
  }
  return ok ? `${host}:${port}` : null;
}

// The page to open on the board, with the Sun and Earth together so both motors move at once.
// row: one analysed hourly row (time_utc, sun_/earth_ az_deg, el_deg, visible). Contract for the board:
// docs/handoffs/model-link-for-board.md. az/el repeat the Sun for boards still on the first version.
export function modelUrl(address, site, row) {
  const f = (v) => v.toFixed(1);
  const q = new URLSearchParams({
    site,
    time: row.time_utc,
    sun_az: f(row.sun_az_deg), sun_el: f(row.sun_el_deg), sun_up: row.sun_visible ? "1" : "0",
    earth_az: f(row.earth_az_deg), earth_el: f(row.earth_el_deg), earth_up: row.earth_visible ? "1" : "0",
    az: f(row.sun_az_deg), el: f(row.sun_el_deg),
  });
  return `http://${address}/?${q}`;
}

// Read ?model= from the page address (and remember it on this device); ?model=off forgets it.
export function loadModelAddress(search = location.search, store = safeStorage()) {
  const asked = new URLSearchParams(search).get("model");
  if (asked !== null) {
    const parsed = parseModelAddress(asked);
    if (parsed) store?.setItem(KEY, parsed);
    else store?.removeItem(KEY);   // "off" or anything not allowed
    return parsed;
  }
  return parseModelAddress(store?.getItem(KEY) ?? "");
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // private windows can refuse storage: the ?model= link still works for this visit
  }
}
