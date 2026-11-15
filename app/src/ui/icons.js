// Small hand-drawn icons for the bottom bar and the welcome card. Pure: name in, SVG text out.
// Every icon is 16x16, drawn in currentColor so it follows the button's text colour.

const moonBase = `<circle class="vi-disc" cx="8" cy="8" r="6.5"/>`;

const ICONS = {
  // Near side: the face we always see, with its dark "seas"
  near: `${moonBase}<circle class="vi-fill" cx="6" cy="6.5" r="1.6"/><circle class="vi-fill" cx="9.8" cy="9.6" r="1.2"/><circle class="vi-fill" cx="9.6" cy="5.4" r="0.8"/>`,
  // Far side: the side that never faces Earth, mostly in the dark here
  far: `${moonBase}<path class="vi-fill" d="M8 1.5a6.5 6.5 0 0 1 0 13a3.8 6.5 0 0 0 0-13z"/>`,
  // South pole: the bottom cap lit up
  pole: `${moonBase}<path class="vi-fill" d="M2.3 11a6.5 6.5 0 0 0 11.4 0z"/>`,
  north: `${moonBase}<path class="vi-fill" d="M2.3 5a6.5 6.5 0 0 1 11.4 0z"/>`,
  // Whole Moon: the Moon with an orbit ring and a little spacecraft
  moon: `<circle class="vi-disc" cx="8" cy="8" r="4.6"/><ellipse class="vi-line" cx="8" cy="8" rx="7.3" ry="2.6" transform="rotate(-20 8 8)"/><circle class="vi-fill vi-craft" cx="14.4" cy="5.8" r="1.1"/>`,
  // Day and night: a crescent
  daynight: `<path class="vi-fill" d="M10.5 2.2a6 6 0 1 0 3.3 9.3a5 5 0 0 1-3.3-9.3z"/>`,
  // Terrain shadows: a ridge with its shadow side
  shadows: `<path class="vi-line" d="M1.5 13.5 L6.5 4.5 L9 8.5 L10.8 6.5 L14.5 13.5 Z"/><path class="vi-fill" d="M6.5 4.5 L9 8.5 L8 13.5 L14.5 13.5 L10.8 6.5 L9 8.5 Z" opacity="0.55"/>`,
  // Elevation: contour lines
  lola: `<path class="vi-line" d="M1.5 12c2.5-2 4.5 1 7-1s3.5-1 6-2"/><path class="vi-line" d="M2.5 8.5c2-1.6 3.8.6 5.8-.8s3-.8 5-1.6"/><path class="vi-line" d="M4 5c1.6-1.2 3 .4 4.6-.6s2.4-.6 4-1.2"/>`,
  // Welcome card
  sun: `<circle class="vi-fill" cx="8" cy="8" r="3.4"/><path class="vi-line" d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/>`,
  earth: `<circle class="vi-disc" cx="8" cy="8" r="6.5"/><path class="vi-fill" d="M5 4.2c1.6-.6 2.6.4 2.2 1.6s-2 1-2.4 2.4-1.4 1-1.8-.2S3.6 4.8 5 4.2zM9.6 8.6c1.4-.4 3 .4 2.6 1.8s-1.8 2.4-3 2-1-3.4.4-3.8z"/>`,
  hills: `<path class="vi-fill" d="M1 14 L5.5 6 L8 9.5 L10.5 5 L15 14 Z"/><circle class="vi-line" cx="12.5" cy="3" r="1.4"/>`,
};

export function icon(name, cls = "") {
  return `<svg class="vi ${cls}" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}
