// Small moments of delight in the sky: a shooting star when something opens, and, rarely, on its
// own while the page sits idle; even more rarely, a faint point of light drifting across the stars
// (how a passing asteroid or spacecraft really looks). Pure decoration: never blocks clicks, never
// carries data, always BEHIND the Moon (the layer is masked by the Moon's disc), and switched off
// entirely for people who ask their system for reduced motion.

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

// One streak across the upper part of the screen, falling down-left or down-right.
export function shootingStar() {
  if (reduced() || document.hidden) return;
  const star = document.createElement("span");
  star.className = "shooting-star";
  const fromRight = Math.random() < 0.5;
  star.style.setProperty("--x", `${(fromRight ? 55 : 10) + Math.random() * 35}vw`);
  star.style.setProperty("--y", `${4 + Math.random() * 22}vh`);
  star.style.setProperty("--angle", `${fromRight ? 155 + Math.random() * 12 : 13 + Math.random() * 12}deg`);
  star.style.setProperty("--len", `${70 + Math.random() * 70}px`);
  add(star, "shoot");
}

// A faint point of light gliding slowly across the stars (about 45 s), with a soft glint.
export function drifter() {
  if (reduced() || document.hidden) return;
  const dot = document.createElement("span");
  dot.className = "drifter";
  dot.style.setProperty("--y0", `${10 + Math.random() * 60}vh`);
  dot.style.setProperty("--dy", `${(Math.random() - 0.5) * 30}vh`);
  dot.style.setProperty("--dir", Math.random() < 0.5 ? "1" : "-1");
  add(dot, "drift");
}

// The ambient sky only plays while the visitor is idle: nothing clicked, dragged, scrolled or typed
// for IDLE_MS. While someone is working, the sky stays still (apart from the twinkle).
const IDLE_MS = 12000;
let lastInput = Date.now();
const isIdle = () => Date.now() - lastInput > IDLE_MS;

// Idle sky: a shooting star every 12 to 30 s; a drifting light every 2 to 4 minutes.
export function startAmbientSky() {
  for (const type of ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"]) {
    addEventListener(type, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  }
  const every = (fn, min, max) => {
    const next = () => setTimeout(() => { if (isIdle()) fn(); next(); }, min + Math.random() * (max - min));
    next();
  };
  every(shootingStar, 12000, 30000);
  every(drifter, 120000, 240000);
}
