/**
 * Fig. 1 of the report, interactive: R(s), the largest possible number of
 * rounds, against T(s), the rounds of a hypothetical Tchoukaillon graph.
 */
import { Scene, mathLabel } from '../ui/scene';
import { h } from '../ui/controls';
import { tex } from '../ui/math';
import { maxRounds, quarterSquare, tchoukaillonNumber, tchoukaillonRounds } from '../engine/numbers';
import { note } from '../ui/sound';

const S_MAX = 64;
const PAD = { l: 46, r: 16, t: 30, b: 40 };

export function mountRoundsChart(root: HTMLElement): void {
  const readout = h('div', { class: 'readout', style: 'min-height:3.4em;margin-bottom:6px', 'aria-live': 'polite' });
  root.append(readout);
  const scene = new Scene(root, ['bands', 'grid', 'lines', 'marks'], 'Step plot of R(s) and T(s) for s up to 64');
  // The drawing is as wide as the widget (between 320 and 900 units), so
  // its text keeps its size on a phone instead of shrinking with the plot.
  let W = 900, H = 330;
  const fit = () => {
    W = Math.round(Math.max(320, Math.min(900, root.clientWidth - 40)));
    H = W < 600 ? 260 : 330;
    scene.viewBox(0, 0, W, H);
  };
  fit();
  root.append(h('div', { class: 'caption', html:
    `<span style="color:var(--q)">━━</span> ${tex('R(s)')}, the true maximum &nbsp; ` +
    `<span style="color:var(--ch)">╍╍</span> ${tex('T(s)')}, a Tchoukaillon graph. ` +
    `Shaded columns: sizes where ${tex('R(s)>T(s)')}.` }));

  const R = (s: number) => maxRounds(s);
  const T = (s: number) => tchoukaillonRounds(s);
  const yMax = R(S_MAX) + 1;
  const x = (s: number) => PAD.l + ((s - 0.5) / S_MAX) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);

  let selected = 9;

  const draw = () => {
    scene.begin();
    for (let s = 1; s <= S_MAX; s++) {
      if (R(s) > T(s)) {
        scene.el('bands', `band${s}`, 'rect', {
          x: x(s - 0.5), y: PAD.t, width: x(s + 0.5) - x(s - 0.5), height: H - PAD.t - PAD.b,
          style: 'fill:var(--band)',
        });
      }
    }
    for (let v = 2; v <= yMax; v += 2) {
      scene.el('grid', `gy${v}`, 'line', { class: 'grid', x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v) });
      scene.el('grid', `ty${v}`, 'text', { class: 'tick', x: PAD.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, String(v));
    }
    for (const s of [1, 9, 16, 25, 36, 49, 64]) {
      scene.el('grid', `tx${s}`, 'text', { class: 'tick', x: x(s), y: H - PAD.b + 18, 'text-anchor': 'middle' }, String(s));
    }
    mathLabel(scene.el('grid', 'xlab', 'text', { class: 'lbl-small', x: (W + PAD.l) / 2, y: H - 4, 'text-anchor': 'middle' }), 'size *s* of a maximum matching');
    scene.el('grid', 'ylab', 'text', { class: 'lbl-small', x: PAD.l - 8, y: PAD.t - 14 }, 'rounds');
    const step = (f: (s: number) => number) => {
      let d = `M${x(0.5)},${y(f(1))}`;
      for (let s = 1; s <= S_MAX; s++) {
        d += ` H${x(s + 0.5)}`;
        if (s < S_MAX) d += ` V${y(f(s + 1))}`;
      }
      return d;
    };
    scene.el('lines', 'R', 'path', { d: step(R), style: 'fill:none;stroke:var(--q);stroke-width:2.6' });
    scene.el('lines', 'T', 'path', { d: step(T), style: 'fill:none;stroke:var(--ch);stroke-width:2;stroke-dasharray:6 4' });
    scene.el('marks', 'sel', 'rect', {
      x: x(selected - 0.5), y: PAD.t, width: x(selected + 0.5) - x(selected - 0.5), height: H - PAD.t - PAD.b,
      style: 'fill:none;stroke:var(--ink);stroke-width:1.2', class: 'anim',
    });
    scene.el('marks', 'dotR', 'circle', { cx: x(selected), cy: y(R(selected)), r: 4.5, style: 'fill:var(--q)' });
    scene.el('marks', 'dotT', 'circle', { cx: x(selected), cy: y(T(selected)), r: 4, style: 'fill:var(--ch)' });
    scene.end();

    const s = selected;
    const n = R(s), m = T(s);
    readout.innerHTML =
      `<b>${tex(`s=${s}`)}</b>: some graph takes ${tex(`R(${s})=${n}`)} rounds, since ${tex(`Q_{${n}}=${quarterSquare(n)}\\le ${s}<Q_{${n + 1}}=${quarterSquare(n + 1)}`)}. ` +
      `A Tchoukaillon graph would take ${tex(`T(${s})=${m}`)}, since ${tex(`\\Ch_{${m}}=${tchoukaillonNumber(m)}\\le ${s}<\\Ch_{${m + 1}}=${tchoukaillonNumber(m + 1)}`)}.` +
      (n > m ? ` <b>The true maximum is larger.</b>` : '');
  };

  // Hovering moves the selection silently; a tap or a key press also plays its note.
  const pick = (ev: PointerEvent) => {
    const rect = scene.svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const s = Math.min(S_MAX, Math.max(1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * S_MAX + 0.5)));
    if (s !== selected || ev.type === 'pointerdown') {
      selected = s;
      if (ev.type === 'pointerdown') note(Math.min(12, R(s) - 1), 0.25);
      draw();
    }
  };
  scene.svg.addEventListener('pointermove', pick);
  scene.svg.addEventListener('pointerdown', pick);
  scene.svg.setAttribute('tabindex', '0');
  scene.svg.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      selected = Math.min(S_MAX, Math.max(1, selected + (ev.key === 'ArrowRight' ? 1 : -1)));
      note(Math.min(12, R(selected) - 1), 0.25);
      draw();
      ev.preventDefault();
    }
  });
  new ResizeObserver(() => {
    const before = W;
    fit();
    if (W !== before) draw();
  }).observe(root);
  draw();
}
