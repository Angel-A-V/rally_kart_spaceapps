// Small icons for the mission briefing card. Pure: name in, SVG text out. (From Darren's UI pass, cf166e9.)
// Every icon is 16x16, drawn in currentColor so it follows the text colour.

const ICONS = {
  sun: `<circle class="vi-fill" cx="8" cy="8" r="3.4"/><path class="vi-line" d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/>`,
  earth: `<circle class="vi-disc" cx="8" cy="8" r="6.5"/><path class="vi-fill" d="M5 4.2c1.6-.6 2.6.4 2.2 1.6s-2 1-2.4 2.4-1.4 1-1.8-.2S3.6 4.8 5 4.2zM9.6 8.6c1.4-.4 3 .4 2.6 1.8s-1.8 2.4-3 2-1-3.4.4-3.8z"/>`,
  hills: `<path class="vi-fill" d="M1 14 L5.5 6 L8 9.5 L10.5 5 L15 14 Z"/><circle class="vi-line" cx="12.5" cy="3" r="1.4"/>`,
};

export function icon(name, cls = "") {
  return `<svg class="vi ${cls}" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}
