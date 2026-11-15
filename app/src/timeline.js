// The time slider's extras (Gustavo's wireframe v2, UI phase 4): tick marks for every sunrise, sunset,
// earthrise and earthset, and the playback arithmetic. Pure functions; main.js wires the buttons.

const NAMES = { sun: ["sunrise", "sunset"], earth: ["earthrise", "earthset"] };
const label = (kind) => kind[0].toUpperCase() + kind.slice(1);

// Every hour where the Sun or Earth changes between up and blocked: [{ index, body, kind, time }].
export function eventTicks(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    for (const body of ["sun", "earth"]) {
      const was = rows[i - 1][`${body}_visible`];
      const now = rows[i][`${body}_visible`];
      if (was !== now) out.push({ index: i, body, kind: NAMES[body][now ? 0 : 1], time: rows[i].time_utc });
    }
  }
  return out;
}

// Small buttons under a slider, one per event, placed by position (click to jump there).
export function ticksHtml(rows) {
  const last = Math.max(1, rows.length - 1);
  const ticks = eventTicks(rows).map((t) =>
    `<button type="button" class="tick ${t.body} ${t.kind}" style="left:${(100 * t.index) / last}%" data-jump="${t.index}"
      aria-label="${label(t.kind)} at ${t.time} UTC" title="${label(t.kind)} · ${t.time} UTC"></button>`).join("");
  return `<div class="ticks" aria-label="Sunrise, sunset, earthrise and earthset">${ticks}</div>`;
}

// Playback: move `hoursPerSecond` through hourly rows for `ms` milliseconds. Keeps the leftover part
// of an hour in `carry` so slow speeds still advance. With loop, wraps to the start; without, stops.
export function advance({ index, carry }, ms, hoursPerSecond, last, loop) {
  const total = carry + (ms / 1000) * hoursPerSecond;
  const steps = Math.floor(total + 1e-9);
  const rest = Math.round((total - steps) * 1e6) / 1e6;
  let next = index + steps;
  if (next <= last) return { index: next, carry: rest, ended: false };
  if (loop) return { index: next % (last + 1), carry: rest, ended: false };
  return { index: last, carry: 0, ended: true };
}

// Play / pause / step / speed / loop, for one slider. `id` ties the buttons to that slider.
export function playerHtml(id) {
  return `
    <div class="player" data-player="${id}">
      <button type="button" data-act="back" aria-label="Back one hour">⏮</button>
      <button type="button" data-act="play" aria-label="Play" aria-pressed="false">▶</button>
      <button type="button" data-act="fwd" aria-label="Forward one hour">⏭</button>
      <label class="visually-hidden" for="speed-${id}">Speed</label>
      <select id="speed-${id}" data-act="speed">
        <option value="1">1 h / s</option><option value="6" selected>6 h / s</option><option value="24">1 day / s</option>
      </select>
      <label class="loop"><input type="checkbox" data-act="loop" checked> Loop</label>
    </div>`;
}
