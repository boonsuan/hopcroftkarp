/** Small DOM helpers for widget controls. */
import { tick } from './sound';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) el.append(c);
  return el;
}

/** A button. `label` (HTML, may include an icon) is its content; `opts.label` names an icon-only button. */
export function button(label: string, onClick: () => void,
                       opts: { title?: string; primary?: boolean; silent?: boolean; label?: string } = {}): HTMLButtonElement {
  const b = h('button', { class: `chip-btn${opts.primary ? ' primary' : ''}`, type: 'button', title: opts.title, 'aria-label': opts.label });
  b.innerHTML = label;
  b.addEventListener('click', () => {
    if (!opts.silent) tick();
    onClick();
  });
  return b;
}

export function slider(label: string, min: number, max: number, value: number,
                       onInput: (v: number) => void, step = 1): { wrap: HTMLLabelElement; input: HTMLInputElement; out: HTMLSpanElement } {
  const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
  const out = h('span', { class: 'readout' }, [String(value)]);
  const wrap = h('label', {}, [label, input, out]);
  input.addEventListener('input', () => {
    out.textContent = input.value;
    onInput(Number(input.value));
  });
  return { wrap, input, out };
}

export function select(label: string, options: Array<[string, string]>, onChange: (v: string) => void): { wrap: HTMLLabelElement; input: HTMLSelectElement } {
  const input = h('select');
  for (const [value, text] of options) input.append(h('option', { value }, [text]));
  input.addEventListener('change', () => {
    tick();
    onChange(input.value);
  });
  const wrap = h('label', {}, label ? [label, input] : [input]);
  return { wrap, input };
}

export function checkbox(label: string, onChange: (v: boolean) => void, checked = false): HTMLLabelElement {
  const input = h('input', { type: 'checkbox' });
  input.checked = checked;
  input.addEventListener('change', () => {
    tick();
    onChange(input.checked);
  });
  return h('label', {}, [input, label]);
}

/** HTML for a vertex name such as g_7 or b_12. */
export const gname = (k: number | string) => `<i>g</i><sub>${k}</sub>`;
export const bname = (k: number | string) => `<i>b</i><sub>${k}</sub>`;

/** Respect the reader's reduced-motion preference for autoplay speed and animation. */
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
