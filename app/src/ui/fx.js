// Small moments of delight in the sky: a shooting star when a site opens, and, while the page sits
// idle, shooting stars and the odd faint point of light drifting across the stars (how a passing
// asteroid or spacecraft really looks). The longer nobody touches the page, the more often they come
// and the brighter they get, so an unattended demo screen stays alive; the moment someone moves the
// mouse, it all calms back down. Pure decoration: never blocks clicks, never carries data, always
// BEHIND the Moon (the layer is masked by the Moon's disc), and switched off entirely for people who
// ask their system for reduced motion.

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let layer = null;
let moonCircle = null; // () => { x, y, r } in screen pixels, from the globe
let masking = false;

export function setMoonCircle(fn) {
  moonCircle = fn;
}

function getLayer() {
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "fx-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

// While anything is in the sky, cut a hole the shape of the Moon out of the layer every frame, so
// streaks pass behind the Moon even while the camera moves.
function keepBehindMoon() {
  if (masking) return;
  masking = true;
  const tick = () => {
    if (!layer || !layer.childElementCount) { masking = false; return; }
    if (moonCircle) {
      const { x, y, r } = moonCircle();
      layer.style.setProperty("--mx", `${x.toFixed(1)}px`);
      layer.style.setProperty("--my", `${y.toFixed(1)}px`);
      layer.style.setProperty("--mr", `${(r + 2).toFixed(1)}px`);
    }
    requestAnimationFrame(tick);
  };
  tick();
}

function add(el, animationName) {
  getLayer().appendChild(el);
  el.addEventListener("animationend", (e) => { if (e.animationName === animationName) el.remove(); });
  keepBehindMoon();
}

// ----- how idle is the page? -----
// Nothing happens for IDLE_MS after the last click, drag, scroll, key or touch. After that, `idleLevel`
// climbs from 0 to 1 over RAMP_MS: frequency and brightness both follow it.
export const IDLE_MS = 8000;
export const RAMP_MS = 60000;
let lastInput = Date.now();

export function idleLevel(now = Date.now(), last = lastInput) {
  const t = (now - last - IDLE_MS) / RAMP_MS;
  return t <= 0 ? 0 : Math.min(1, t);
}
const isIdle = () => Date.now() - lastInput > IDLE_MS;
const lerp = (a, b, k) => a + (b - a) * k;

// One streak across the upper part of the screen, falling down-left or down-right.
// `boost` (0 to 1) makes it longer, thicker, brighter and slower to fade.
export function shootingStar(boost = 0) {
  if (reduced() || document.hidden) return;
  const star = document.createElement("span");
  star.className = "shooting-star";
  // Start somewhere in open sky: try a few random spots and keep the first one clear of the Moon.
  const m = moonCircle?.();
  let fromRight, x, y;
  for (let i = 0; i < 12; i++) {
    fromRight = Math.random() < 0.5;
    x = ((fromRight ? 50 : 5) + Math.random() * 45) * innerWidth / 100;
    y = (4 + Math.random() * 60) * innerHeight / 100;
    if (!m || Math.hypot(x - m.x, y - m.y) > m.r + 40) break;
  }
  star.style.setProperty("--x", `${x.toFixed(0)}px`);
  star.style.setProperty("--y", `${y.toFixed(0)}px`);
  star.style.setProperty("--angle", `${fromRight ? 155 + Math.random() * 12 : 13 + Math.random() * 12}deg`);
  star.style.setProperty("--len", `${lerp(70, 160, boost) + Math.random() * lerp(70, 120, boost)}px`);
  star.style.setProperty("--thick", `${lerp(1.5, 2.6, boost).toFixed(2)}px`);
  star.style.setProperty("--head", `${lerp(4.5, 7, boost).toFixed(2)}px`);
  star.style.setProperty("--glow", `${lerp(6, 14, boost).toFixed(1)}px`);
  star.style.setProperty("--peak", lerp(0.85, 1, boost).toFixed(2));
  star.style.setProperty("--travel", `${Math.round(lerp(420, 640, boost))}px`);
  star.style.setProperty("--dur", `${lerp(0.9, 1.3, boost).toFixed(2)}s`);
  add(star, "shoot");
}

// A faint point of light gliding slowly across the stars (about 45 s), with a soft glint.
// With `boost` it is a little bigger and brighter.
export function drifter(boost = 0) {
  if (reduced() || document.hidden) return;
  const dot = document.createElement("span");
  dot.className = "drifter";
  dot.style.setProperty("--y0", `${10 + Math.random() * 60}vh`);
  dot.style.setProperty("--dy", `${(Math.random() - 0.5) * 30}vh`);
  dot.style.setProperty("--dir", Math.random() < 0.5 ? "1" : "-1");
  dot.style.setProperty("--size", `${lerp(2, 3.2, boost).toFixed(1)}px`);
  dot.style.setProperty("--op", lerp(0.75, 1, boost).toFixed(2));
  add(dot, "drift");
}

// The ambient sky only plays while the visitor is idle. Waits shrink as idleLevel grows:
//   shooting star: every 3 to 8 s at first, every 1.5 to 4 s after RAMP_MS (with the odd pair or trio)
//   drifting light: every 25 to 45 s at first, every 12 to 25 s after RAMP_MS
// While someone is working, the sky stays still (apart from the twinkle).
export function startAmbientSky() {
  if (startAmbientSky.started) return;
  startAmbientSky.started = true;
  for (const type of ["pointerdown", "wheel", "keydown", "touchstart"]) {
    addEventListener(type, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  }
  // A resting mouse can twitch a pixel or two; only a real move (over 6 px) counts as being busy.
  let px = null, py = null;
  addEventListener("pointermove", (e) => {
    if (px === null || Math.hypot(e.clientX - px, e.clientY - py) > 6) { lastInput = Date.now(); px = e.clientX; py = e.clientY; }
  }, { passive: true, capture: true });
  // Re-check often, so the sky reacts within a couple of seconds when someone walks away, rather than
  // waiting out a long timer chosen while they were still busy.
  const every = (fire, [min0, max0], [min1, max1]) => {
    let due = 0;
    const plan = () => {
      const k = idleLevel();
      due = Date.now() + lerp(min0, min1, k) + Math.random() * (lerp(max0, max1, k) - lerp(min0, min1, k));
    };
    plan();
    setInterval(() => {
      if (!isIdle()) { plan(); return; } // busy: keep pushing the next one back
      if (Date.now() >= due) { fire(idleLevel()); plan(); }
    }, 1000);
  };
  every((k) => {
    shootingStar(k);
    // Deep into idle, sometimes a second or third streak follows close behind.
    if (k > 0.5 && Math.random() < k * 0.35) setTimeout(() => shootingStar(k), 250 + Math.random() * 600);
    if (k > 0.85 && Math.random() < 0.2) setTimeout(() => shootingStar(k), 900 + Math.random() * 700);
  }, [3000, 8000], [1500, 4000]);
  every((k) => drifter(k), [25000, 45000], [12000, 25000]);
}
