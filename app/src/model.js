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

// The page to open on the board. cmd: "SUN" (the board's default) or "EARTH".
export function modelUrl(address, { site, az, el, cmd = "SUN" }) {
  const q = new URLSearchParams({ site, az: az.toFixed(1), el: el.toFixed(1) });
  if (cmd !== "SUN") q.set("cmd", cmd);
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
