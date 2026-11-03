/**
 * Every round of every run is a point (L, f) on or below the hyperbola fL = s
 * (report Lemma 4.1). The Tchoukaillon schedule against a staircase run.
 */
import { Scene, mathLabel } from '../ui/scene';
import { h, slider } from '../ui/controls';
import { tex } from '../ui/math';
import { maxRounds, quarterSquare, schedule, tchoukaillonRounds } from '../engine/numbers';
import { note } from '../ui/sound';

const W = 760, H = 380;
const PAD = { l: 80, r: 20, t: 30, b: 44 };

export function mountHyperbola(root: HTMLElement): void {
  let s = 16;
  const ctl = slider('Size s', 4, 60, s, (v) => { s = v; note(Math.min(12, maxRounds(s) - 2), 0.25); draw(); });
  root.append(h('div', { class: 'controls' }, [ctl.wrap]));
  const scene = new Scene(root, ['fill', 'grid', 'curve', 'runs', 'labels'], 'Rounds as points under the hyperbola fL = s');
  scene.viewBox(0, 0, W, H);
  const info = h('div', { class: 'caption' });
  root.append(info);

  function draw(): void {
    const n = maxRounds(s);
    const stair = Array.from({ length: n - 1 }, (_, k) => ({ L: k + 2, f: n - 1 - k }));
    const tch = schedule(s).map((r) => ({ L: r.L, f: r.f }));
    const Lmax = Math.max(n, 8) + 0.6;
    const fmax = Math.max(Math.floor(s / 2), n) + 1.2;
    const x = (L: number) => PAD.l + ((L - 1.4) / (Lmax - 1.4)) * (W - PAD.l - PAD.r);
    const y = (f: number) => H - PAD.b - (f / fmax) * (H - PAD.t - PAD.b);
    scene.begin();
    // Region fL <= s and the curve.
    // Start the curve where it enters the plot, so it is never clipped flat.
    const L0 = Math.max(1.4, s / fmax);
    let d = `M${x(L0)},${y(0)}`;
    let c = '';
    for (let k = 0; k <= 120; k++) {
      const L = L0 + ((Lmax - L0) * k) / 120;
      d += ` L${x(L)},${y(s / L)}`;
      c += `${k ? ' L' : 'M'}${x(L)},${y(s / L)}`;
    }
    d += ` L${x(Lmax)},${y(0)} Z`;
    scene.el('fill', 'region', 'path', { d, style: 'fill:var(--boy-fill);opacity:.7' });
    scene.el('curve', 'curve', 'path', { d: c, style: 'fill:none;stroke:var(--ink-2);stroke-width:1.6' });
    mathLabel(scene.el('labels', 'curvelbl', 'text', { class: 'lbl', x: x(Lmax) - 6, y: y(s / Lmax) - 10, 'text-anchor': 'end' }), `*fL* = ${s}`);
    // Axes and ticks.
    scene.el('grid', 'xa', 'line', { class: 'axis', x1: PAD.l, x2: W - PAD.r, y1: y(0), y2: y(0) });
    scene.el('grid', 'ya', 'line', { class: 'axis', x1: PAD.l, x2: PAD.l, y1: y(0), y2: PAD.t });
    for (let L = 2; L <= Math.floor(Lmax); L++) {
      scene.el('grid', `tx${L}`, 'text', { class: 'tick', x: x(L), y: y(0) + 18, 'text-anchor': 'middle' }, String(L));
    }
    const fstep = fmax > 20 ? 5 : fmax > 10 ? 2 : 1;
    for (let f = fstep; f < fmax; f += fstep) {
      scene.el('grid', `ty${f}`, 'text', { class: 'tick', x: PAD.l - 8, y: y(f) + 4, 'text-anchor': 'end' }, String(f));
      scene.el('grid', `gy${f}`, 'line', { class: 'grid', x1: PAD.l, x2: W - PAD.r, y1: y(f), y2: y(f) });
    }
    mathLabel(scene.el('grid', 'xl', 'text', { class: 'lbl-small', x: (W + PAD.l) / 2, y: H - 6, 'text-anchor': 'middle' }), 'level *L*');
    mathLabel(scene.el('grid', 'yl', 'text', { class: 'lbl-small', x: PAD.l - 8, y: PAD.t - 8, 'text-anchor': 'end' }), 'free girls *f*');
    // The two runs.
    const poly = (pts: Array<{ L: number; f: number }>) => pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.L)},${y(p.f)}`).join(' ');
    scene.el('runs', 'tline', 'path', { d: poly(tch), style: 'fill:none;stroke:var(--ch);stroke-width:2;stroke-dasharray:6 4' });
    scene.el('runs', 'sline', 'path', { d: poly(stair), style: 'fill:none;stroke:var(--q);stroke-width:2.2' });
    for (let k = 0; k < 40; k++) {
      const p = tch[k];
      if (p) scene.el('runs', `tp${k}`, 'circle', { cx: x(p.L), cy: y(p.f), r: 4.2, style: 'fill:var(--ch)', class: 'anim' });
      const q = stair[k];
      if (q) scene.el('runs', `sp${k}`, 'rect', { x: x(q.L) - 4, y: y(q.f) - 4, width: 8, height: 8, style: 'fill:var(--q)', class: 'anim' });
    }
    scene.end();
    info.innerHTML =
      `<span style="color:var(--ch)">● Tchoukaillon schedule</span>: ${tex(`f_L`)} = ${tch.map((p) => p.f).join(', ')}, so ${tex(`T(${s})=${tchoukaillonRounds(s)}`)} rounds. ` +
      `<span style="color:var(--q)">■ staircase graph</span> ${tex(`\\Gamma_{${n}}`)}` +
      (s > quarterSquare(n) ? ` plus ${s - quarterSquare(n)} separate couple${s - quarterSquare(n) === 1 ? '' : 's'} (to make ${tex(`s=${s}`)})` : '') +
      `: ${tex('f')} = ${stair.map((p) => p.f).join(', ')}, so ${tex(`R(${s})=${n}`)} rounds.`;
  }
  draw();
}
