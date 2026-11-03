/**
 * The matrices of answer 15(d), computed from an actual run of Algorithm H on
 * Knuth's 16-pair graph (with the input order of the report's Appendix A).
 * Each row is a basic path, listed by the pairs g_k—b_k of the perfect
 * matching that it visits; the SAPs of the selected round are drawn through
 * the rows they splice together.
 */
import { runAlgorithmH } from '../engine/algorithmH';
import { knuth16 } from '../engine/examples';
import { Scene, mathLabel } from '../ui/scene';
import { button, h } from '../ui/controls';
import { tex } from '../ui/math';
import * as sound from '../ui/sound';

const CELL_W = 34, CELL_H = 26, GAP = 34;

export function mountKnuthMatrices(root: HTMLElement): void {
  const run = runAlgorithmH(knuth16, false);
  const log = knuth16.logicalGirl;
  const rowsBefore = run.rounds.map((r) => basicRows(r.matchingBefore));
  let sel = 0;

  const btns = run.rounds.map((r, k) => button(`<i>L</i> = ${r.L}`, () => { sel = k; draw(); sound.note(4 + k, 0.4); }, { silent: true }));
  root.append(h('div', { class: 'controls' }, ['Round at level', ...btns]));
  const scene = new Scene(root, ['cells', 'paths', 'text'], 'Basic-row matrices of Knuth’s 16-pair graph');
  const info = h('div', { class: 'caption' });
  const key = h('div', { class: 'caption', html:
    'Each cell is a pair <i>g<sub>k</sub></i>, <i>b<sub>k</sub></i> of the perfect matching, labelled <i>k</i>. ' +
    'The orange line follows a SAP: from a girl (left half of a cell) to the boy she is joined to, ' +
    'in her own cell or in another row, where two rows are spliced; from a boy, along his current couple to the next cell.' });
  root.append(info, key);
  // On a narrow screen only the selected matrix and the next one are drawn,
  // so that the numbers stay legible.
  let narrow = false;
  new ResizeObserver(() => {
    const now = root.clientWidth < 640;
    if (now !== narrow) { narrow = now; draw(); }
  }).observe(root);

  /** Basic paths relative to the matching g_k—b_k (logical names), from free girls. */
  function basicRows(matching: number[]): number[][] {
    const bmate = new Map<number, number>();
    matching.forEach((b, i) => b && bmate.set(b, i + 1));
    const rows: number[][] = [];
    matching.forEach((b, i) => {
      if (b) return;
      const row: number[] = [];
      let g = i + 1;
      for (;;) {
        const k = log[g - 1];
        row.push(k);
        const m = bmate.get(k); // boy b_k's current mate
        if (!m) break;
        g = m;
      }
      rows.push(row);
    });
    return rows.sort((x, y) => x[0] - y[0]);
  }

  function draw(): void {
    btns.forEach((b, k) => b.classList.toggle('primary', k === sel));
    const shown = rowsBefore.map((_, j) => j).filter((j) => !narrow || j === sel || j === sel + 1);
    const widths = rowsBefore.map((m) => Math.max(1, ...m.map((r) => r.length)) * CELL_W);
    const xs: number[] = [];
    let x = 10;
    for (const j of shown) { xs[j] = x; x += widths[j] + GAP; }
    const maxRows = Math.max(...shown.map((j) => rowsBefore[j].length));
    scene.viewBox(0, -24, x - GAP + 20, maxRows * CELL_H + 34);
    scene.begin();
    shown.forEach((j) => {
      const m = rowsBefore[j];
      const active = j === sel;
      mathLabel(scene.el('text', `hd${j}`, 'text', { class: 'lbl', x: xs[j] + widths[j] / 2, y: -8, 'text-anchor': 'middle', style: active ? 'font-weight:600;fill:var(--ink)' : '' }),
        `*L* = ${run.rounds[j].L}, *f* = ${m.length}`);
      m.forEach((row, ri) => row.forEach((k, ci) => {
        const cx = xs[j] + ci * CELL_W, cy = ri * CELL_H;
        scene.el('cells', `c${j}-${k}`, 'rect', {
          x: cx + 1, y: cy + 1, width: CELL_W - 2, height: CELL_H - 2, rx: 3,
          style: `fill:${active ? 'var(--boy-fill)' : 'var(--paper-2)'};stroke:var(--rule)`,
        });
        scene.el('text', `t${j}-${k}`, 'text', { class: 'vlabel', x: cx + CELL_W / 2, y: cy + CELL_H / 2 }, String(k));
      }));
      if (j !== shown[shown.length - 1]) {
        const ax = xs[j] + widths[j] + 6;
        scene.el('text', `ar${j}`, 'text', { class: 'lbl-small', x: ax + (GAP - 12) / 2, y: 18, 'text-anchor': 'middle' }, '→');
      }
    });
    // SAPs of the selected round, drawn through the cells of the pairs they visit.
    const m = rowsBefore[sel];
    const where = new Map<number, [number, number]>();
    m.forEach((row, ri) => row.forEach((k, ci) => where.set(k, [xs[sel] + ci * CELL_W, ri * CELL_H])));
    run.rounds[sel].saps.forEach((p, t) => {
      const pts: string[] = [];
      p.girls.forEach((g, i) => {
        const cg = where.get(log[g - 1]);
        const cb = where.get(p.boys[i]);
        if (cg) pts.push(`${cg[0] + CELL_W * 0.3},${cg[1] + CELL_H / 2}`);
        if (cb) pts.push(`${cb[0] + CELL_W * 0.7},${cb[1] + CELL_H / 2}`);
      });
      const path = scene.el('paths', `p${sel}-${t}`, 'path', {
        class: 'sap-path', d: 'M' + pts.join(' L'), style: 'stroke:var(--sap);stroke-opacity:.5;stroke-width:9',
      }) as SVGPathElement;
      animateStroke(path, t * 350);
    });
    scene.end();
    const r = run.rounds[sel];
    info.innerHTML =
      `Before the round at level ${tex(`L=${r.L}`)} there are ${tex(`f=${r.fBefore}`)} basic paths, all with ${tex('L')} cells, ` +
      `so ${tex('f')} disjoint SAPs exist. Algorithm H removes ${r.saps.length} SAP${r.saps.length === 1 ? '' : 's'} ` +
      `(the schedule asks for ${tex(`\\lceil ${r.fBefore}/${r.L + 1}\\rceil=${Math.ceil(r.fBefore / (r.L + 1))}`)}). ` +
      (sel < run.rounds.length - 1
        ? `A SAP meeting ${tex('k')} rows splices them into ${tex('k-1')} rows, each one cell longer: compare the next matrix.`
        : 'After this round the matching is perfect.');
  }

  function animateStroke(path: SVGPathElement, delay: number): void {
    const len = path.getTotalLength?.() ?? 0;
    if (!len || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    path.style.transition = 'none';
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.getBoundingClientRect();
    path.style.transition = `stroke-dashoffset 700ms ease-out ${delay}ms`;
    path.style.strokeDashoffset = '0';
  }

  draw();
}
