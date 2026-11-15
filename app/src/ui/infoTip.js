// The small "i" button that opens a plain-English explanation. Pure function: text in, HTML out.
// Uses the browser's built-in popover: click to open, click outside or press Esc to close,
// no page code needed. The explanation sits in the middle of the screen, above everything.

let counter = 0;

// title: short heading. body: one or two short paragraphs of HTML (trusted text from our own code).
export function infoTip(title, body, label = title) {
  const id = `tip-${++counter}`;
  return (
    `<button type="button" class="info-btn" popovertarget="${id}" aria-label="What is ${label}?">i</button>` +
    `<div id="${id}" class="tip glass" popover>` +
    `<button type="button" class="tip-close" popovertarget="${id}" popovertargetaction="hide" aria-label="Close">×</button>` +
    `<h4>${title}</h4>${body}</div>`
  );
}
