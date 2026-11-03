/**
 * Inline SVG icons for widget buttons, drawn on the same 24-unit grid and
 * stroke as the icons in the top bar (font glyphs such as ⏮ and ⏵ come from
 * fallback fonts and never line up).
 */
const svg = (body: string, filled = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icon = {
  restart: svg('<path d="M6 5v14"/><path d="M18 6l-8 6 8 6z"/>'),
  back: svg('<path d="M15 6l-6 6 6 6"/>'),
  step: svg('<path d="M9 6l6 6-6 6"/>'),
  play: svg('<path d="M8 5.5v13l10-6.5z"/>', true),
  pause: svg('<path d="M8 5.5v13M16 5.5v13"/>'),
  next: svg('<path d="M6 6l8 6-8 6z"/><path d="M18 5v14"/>'),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>'),
  shuffle: svg('<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.6M13 9.6c.9-1.4 1.9-2.6 3.5-2.6H20"/><path d="M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
};
