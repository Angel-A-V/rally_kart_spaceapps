// Floating panels that behave like little windows: drag by the title bar, resize from the corner
// (the browser's own grip, CSS `resize`), minimize to a small tab, double-click the title bar to put
// the panel back where it started. Drag and resize are desktop only: under 760 px the panels are
// bottom sheets and stay put.

// Keep a panel on screen: never smaller than the window allows, never dragged past an edge.
export function clampRect({ left, top, width, height }, vw, vh, margin = 8) {
  const w = Math.min(width, vw - 2 * margin);
  const h = Math.min(height, vh - 2 * margin);
  return {
    left: Math.min(Math.max(left, margin), vw - w - margin),
    top: Math.min(Math.max(top, margin), vh - h - margin),
    width: w,
    height: h,
  };
}

const desktop = () => !matchMedia("(max-width: 760px)").matches;

// el: the panel. handle: its title bar. minButton: the "–" button. tray: where tabs go.
// title(): the text for the tab. onChange(): called after any move, minimize or restore.
export function makeWindow(el, { handle, minButton, tray, title, onChange = () => {} }) {
  let tab = null;

  const place = (r) => {
    const c = clampRect(r, innerWidth, innerHeight);
    Object.assign(el.style, {
      left: `${c.left}px`, top: `${c.top}px`, width: `${c.width}px`, height: `${c.height}px`, right: "auto", bottom: "auto",
    });
  };
  // Switch from the stylesheet's docked position to explicit pixels, so moving and resizing start from here.
  const freeze = () => {
    if (!desktop() || el.classList.contains("floating")) return;
    place(el.getBoundingClientRect());
    el.classList.add("floating");
  };
  const reset = () => {
    el.classList.remove("floating");
    for (const k of ["left", "top", "width", "height", "right", "bottom"]) el.style[k] = "";
    onChange();
  };

  // The resize grip sits on the panel itself (its bottom-right corner).
  el.addEventListener("pointerdown", (e) => { if (e.target === el) freeze(); }, true);

  handle.addEventListener("pointerdown", (e) => {
    if (!desktop() || e.button !== 0 || e.target.closest("button, input, select, a")) return;
    freeze();
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    try { handle.setPointerCapture(e.pointerId); } catch { /* keep dragging without capture */ }
    el.classList.add("dragging");
    const move = (ev) => place({ left: ev.clientX - dx, top: ev.clientY - dy, width: r.width, height: r.height });
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      el.classList.remove("dragging");
      onChange();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
    e.preventDefault();
  });
  handle.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) reset(); });

  const restore = () => {
    el.classList.remove("minimized");
    if (tab) tab.remove();
    tab = null;
    onChange();
  };
  const minimize = () => {
    if (tab) return;
    el.classList.add("minimized");
    tab = document.createElement("button");
    tab.type = "button";
    tab.className = "win-tab";
    tab.textContent = title();
    tab.title = "Open again";
    tab.addEventListener("click", restore);
    tray.appendChild(tab);
    tab.focus();
    onChange();
  };
  minButton.addEventListener("click", minimize);

  return { minimize, restore, reset, isMinimized: () => Boolean(tab) };
}
