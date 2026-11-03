/** Light/dark theme: follows the system until the reader picks one, then remembers it. */

const KEY = 'hk-theme';
type Theme = 'light' | 'dark';

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const listeners: Array<() => void> = [];

/** Call `fn` whenever the theme changes (widgets that read CSS colours redraw). */
export function onThemeChange(fn: () => void): void {
  listeners.push(fn);
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  listeners.forEach((fn) => fn());
}

export function initTheme(button: HTMLButtonElement): void {
  // The icon (moon or sun, chosen in CSS) and the label name the other theme.
  const label = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.title = dark ? 'Light mode' : 'Dark mode';
  };
  onThemeChange(label);
  apply(stored() ?? systemTheme());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!stored()) apply(systemTheme());
  });
  button.addEventListener('click', () => {
    const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    apply(next);
  });
}
