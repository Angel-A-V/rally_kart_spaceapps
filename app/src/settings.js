// Visibility settings in the browser (GitHub issues #2 and #5): the Sun rule and Earth's safety margin.
// Pure functions, no page code. They mirror app/python/analysis/visibility.py (thresholds) and
// app/python/analysis/events.py (next_event), so the page can re-apply other settings to the 30-day
// rows without asking Python again. With the defaults they reproduce the Python output (tested).

export const SUN_RADIUS_DEG = 0.2666; // the Sun's apparent radius, about 16 arcminutes

// When does the Sun count as "up"? `needed` = the margin above the skyline it needs, in degrees.
export const SUN_RULES = {
  centre: { label: "its centre is above the skyline", needed: 0 },
  any_part: { label: "any part of it shows (first light)", needed: -SUN_RADIUS_DEG },
  whole_disc: { label: "the whole disc is above the skyline (full sunlight)", needed: SUN_RADIUS_DEG },
};

export const DEFAULT_SETTINGS = { sunRule: "centre", earthMarginDeg: 0 };

// Settings -> the margin each body needs above the skyline, in degrees.
export function thresholds(settings = DEFAULT_SETTINGS) {
  const rule = SUN_RULES[settings.sunRule];
  if (!rule) throw new Error(`Unknown Sun rule: ${settings.sunRule}`);
  if (!(settings.earthMarginDeg >= 0)) throw new Error("The Earth margin must be 0 or more");
  return { sun: rule.needed, earth: Number(settings.earthMarginDeg) };
}

const EVENT_NAMES = { sun: ["sunset", "sunrise"], earth: ["earthset", "earthrise"] };

// A copy of the hourly rows with visible yes/no and the next set/rise re-worked for these settings.
// The margins themselves (body angle minus skyline) do not depend on the settings.
export function applySettings(rows, settings = DEFAULT_SETTINGS, stepHours = 1) {
  const need = thresholds(settings);
  const out = rows.map((r) => {
    const sun = r.sun_margin_deg > need.sun;
    const earth = r.earth_margin_deg > need.earth;
    return { ...r, sun_visible: sun, earth_visible: earth, both_visible: sun && earth };
  });
  for (const body of ["sun", "earth"]) {
    const vis = `${body}_visible`;
    const margin = `${body}_margin_deg`;
    const [setName, riseName] = EVENT_NAMES[body];
    // Walk backwards, remembering the first later row whose state differs (one pass, not one per row).
    let flip = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (i < out.length - 1 && out[i + 1][vis] !== out[i][vis]) flip = i + 1;
      const row = out[i];
      row[`${body}_event`] = row[vis] ? setName : riseName;
      row[`${body}_window_hours`] = (out.length - 1 - i) * stepHours;
      if (flip < 0) {
        row[`${body}_event_hours`] = null;
      } else {
        // Straight-line estimate of where the margin crosses the threshold, between two samples.
        const before = out[flip - 1][margin] - need[body];
        const after = out[flip][margin] - need[body];
        row[`${body}_event_hours`] = Math.max(0, (flip - 1 - i + before / (before - after)) * stepHours);
      }
    }
  }
  return out;
}

// Percent of the rows where the Sun, Earth and both are visible.
export function summarise(rows) {
  const pct = (key) => (100 * rows.filter((r) => r[key]).length) / rows.length;
  return { sun: pct("sun_visible"), earth: pct("earth_visible"), both: pct("both_visible") };
}

// One sentence saying what "visible" means right now (for the sources panel and the comparison).
export function settingsSentence(settings) {
  return `The Sun counts as up when ${SUN_RULES[settings.sunRule].label}; Earth needs at least ` +
    `${Number(settings.earthMarginDeg).toFixed(1)}° above the skyline for a reliable radio link.`;
}

const pct = (v) => `${v.toFixed(0)}%`;
const mark = (ok) => (ok ? "✓" : "✗");

// The plain-language verdict for the two scenarios (#5).
// a, b: { name: "A", label, row, rows } with rows already passed through applySettings().
export function compareVerdict(a, b) {
  const now = (s) => `${s.name} (${s.label}, ${s.row.time_utc} UTC): Sun ${mark(s.row.sun_visible)}, Earth ${mark(s.row.earth_visible)}`;
  const moment = `At the chosen moments: ${now(a)}; ${now(b)}.`;
  if (a.label === b.label) {
    return `${moment} Same site at two moments, so only the moment differs.`;
  }
  const sa = summarise(a.rows);
  const sb = summarise(b.rows);
  const over = `Over these 30 days: both up ${pct(sa.both)} vs ${pct(sb.both)}, Sun ${pct(sa.sun)} vs ` +
    `${pct(sb.sun)}, Earth ${pct(sa.earth)} vs ${pct(sb.earth)} (${a.name} vs ${b.name}).`;
  let call;
  if (sa.both === 0 && sb.both === 0) {
    const better = sa.sun === sb.sun ? null : sa.sun > sb.sun ? a : b;
    call = "Neither site has the Sun and Earth up together in these 30 days" +
      (better ? `; for power alone, ${better.name} (${better.label}) is better.` : ".");
  } else if (Math.abs(sa.both - sb.both) < 1) {
    call = "For a lander that needs both power and a direct radio link, the two are about the same.";
  } else {
    const [win, lose, w, l] = sa.both > sb.both ? [a, b, sa, sb] : [b, a, sb, sa];
    call = `For a lander that needs both power and a direct radio link, <strong>${win.name} (${win.label}) is better</strong>: ` +
      `both up ${pct(w.both)} of the time vs ${pct(l.both)} for ${lose.name}.`;
  }
  return `${call} ${over} ${moment}`;
}
