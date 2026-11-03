/**
 * Explore the staircase graphs Γ_n (report §5): pick n and a round, see the
 * hooks (the current basic paths), the one SAP that Algorithm H finds, and the
 * dag with the hooks straightened. Everything is computed by running the
 * engine, not drawn from formulas.
 */
import type { RoundRecord, Run } from '../engine/algorithmH';
import { runAlgorithmH } from '../engine/algorithmH';
import type { StaircaseGraph } from '../engine/examples';
import { staircase } from '../engine/examples';
import { Scene, drawBoy, drawEdge, drawGirl, trim } from '../ui/scene';
import { button, checkbox, h, slider } from '../ui/controls';
import { tex } from '../ui/math';
import { icon } from '../ui/icons';
import * as sound from '../ui/sound';

const ROW_COLOURS = ['--row-a', '--row-b', '--row-c', '--row-d', '--row-e', '--row-f', '--row-g', '--row-h'];

interface Hook {
  girls: number[]; // girl of each cell, from the free girl on
  boys: number[];  // boy of each cell
}

export function mountStaircase(root: HTMLElement): void {
  let n = 8;
  let corner = false;
  let straight = false;
  let k = 0; // index of the round after H1 (0 = the round at level 2); k = rounds.length = final state
  let sg: StaircaseGraph = staircase(n);
  let run: Run = runAlgorithmH(sg, false);

  const nCtl = slider('n', 3, 13, n, (v) => { n = v; rebuild(); sound.swoosh(); });
  const rCtl = slider('Round', 2, n, 2, (v) => { k = v - 2; draw(); sound.note(Math.min(12, k + 2), 0.3); });
  const prev = button(icon.back, () => setRound(k - 1), { title: 'Previous round', label: 'Previous round', silent: true });
  const next = button(icon.step, () => setRound(k + 1), { title: 'Next round', label: 'Next round', silent: true });
  prev.classList.add('icon');
  next.classList.add('icon');
  const straightCtl = checkbox('Straighten the hooks (show the dag)', (v) => { straight = v; draw(); });
  const cornerCtl = checkbox('Add the corner edge', (v) => { corner = v; rebuild(); });
  root.append(h('div', { class: 'controls' }, [nCtl.wrap, rCtl.wrap, prev, next]));
  root.append(h('div', { class: 'controls' }, [straightCtl, cornerCtl]));
  const scene = new Scene(root, ['defs', 'hooks', 'sap', 'edges', 'nodes', 'labels'], 'A staircase graph and its hooks');
  const arrowId = `sah-${Math.random().toString(36).slice(2, 7)}`;
  const info = h('div', { class: 'caption' });
  root.append(info);

  function setRound(v: number): void {
    k = Math.max(0, Math.min(run.rounds.length, v));
    rCtl.input.value = String(k + 2);
    rCtl.out.textContent = k === run.rounds.length ? 'end' : String(k + 2);
    sound.note(Math.min(12, k + 2), 0.3);
    draw();
  }

  function rebuild(): void {
    sg = staircase(n, corner);
    run = runAlgorithmH(sg, false);
    rCtl.input.max = String(run.rounds.length + 2);
    k = Math.min(k, run.rounds.length);
    rCtl.input.value = String(k + 2);
    rCtl.out.textContent = k === run.rounds.length ? 'end' : String(k + 2);
    scene.clear();
    draw();
  }

  /** Basic paths relative to the cell-diagonal perfect matching, from a matching. */
  function hooksOf(matching: number[]): Hook[] {
    const girlAt = new Map<string, number>();
    sg.girlCell.forEach((c, i) => girlAt.set(`${c.a},${c.c}`, i + 1));
    const boyAt = new Map<string, number>();
    sg.boyCell.forEach((c, i) => boyAt.set(`${c.a},${c.c}`, i + 1));
    const bmate = new Map<number, number>();
    matching.forEach((b, i) => b && bmate.set(b, i + 1));
    const hooks: Hook[] = [];
    matching.forEach((b, i) => {
      if (b) return;
      const hook: Hook = { girls: [], boys: [] };
      let g = i + 1;
      for (;;) {
        const cell = sg.girlCell[g - 1];
        const own = boyAt.get(`${cell.a},${cell.c}`)!;
        hook.girls.push(g);
        hook.boys.push(own);
        const m = bmate.get(own);
        if (!m) break;
        g = m;
      }
      hooks.push(hook);
    });
    hooks.sort((x, y) => sg.girlCell[x.girls[0] - 1].a - sg.girlCell[y.girls[0] - 1].a);
    return hooks;
  }

  /** Count the dag's SAPs from the round's BLINK lists (no formula assumed). */
  function countSaps(r: RoundRecord): number {
    const memo = new Map<number, number>();
    const fromBoy = (b: number): number => {
      if (memo.has(b)) return memo.get(b)!;
      let total = 0;
      for (const g of r.blink.get(b) ?? []) {
        const mate = r.matchingBefore[g - 1];
        total += mate === 0 ? 1 : fromBoy(mate);
      }
      memo.set(b, total);
      return total;
    };
    return r.roots.reduce((acc, b) => acc + fromBoy(b), 0);
  }

  function draw(): void {
    const final = k >= run.rounds.length;
    const r = final ? null : run.rounds[k];
    const matching = r ? r.matchingBefore : run.finalMatching;
    const hooks = hooksOf(matching);
    prev.disabled = k === 0;
    next.disabled = final;
    scene.begin();
    const marker = scene.el('defs', 'm', 'marker', { id: arrowId, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' });
    if (!marker.firstChild) marker.innerHTML = '<path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink-2)"/>';
    if (straight && r) drawStraight(r, hooks);
    else drawCells(r, matching, hooks);
    scene.end();

    if (!r) {
      info.innerHTML = `After ${run.rounds.length + 1} rounds the matching is perfect: every girl is coupled with the boy of her own cell.`;
      return;
    }
    const L = r.L, f = r.fBefore;
    const lengths = hooks.map((x) => x.girls.length);
    const m = lengths.filter((x) => x === L).length;
    const saps = countSaps(r);
    const plural = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;
    info.innerHTML =
      `Round ${k + 2}: level ${tex(`L=${L}`)}, ${tex(`f=${f}`)} free girls. The hooks have ${lengths.join(', ')} cells; ` +
      `${tex(`m=${m}`)} of them have exactly ${tex('L')} cells, so ${plural(m, 'disjoint SAP exists', 'disjoint SAPs exist')}. ` +
      `The dag contains ${plural(saps, 'SAP', 'SAPs')}${!corner && saps === 2 ** m - 1 ? ` (${tex(`2^{${m}}-1`)})` : ''}; ` +
      `Algorithm H finds ${r.saps.length}. Work: ${tex(`W_5=${r.w5}`)}, ${tex(`W_{13}=${r.w13}`)}, ${tex(`W_{11}=${r.w11}`)}.` +
      (straight ? ` Straightened, each hook is a row, cut off after cell ${tex('L+1')}; that shaded column lies beyond every SAP.` : '');
  }

  function drawCells(r: RoundRecord | null, matching: number[], hooks: Hook[]): void {
    const dx = 58, dy = 50, ox = 12, oy = 9;
    const cols = Math.max(...sg.rowLengths);
    const pos = (a: number, c: number, sgn: number): [number, number] => [26 + (c - 1) * dx + sgn * ox, 22 + (a - 1) * dy - sgn * oy];
    const gp = (g: number) => pos(sg.girlCell[g - 1].a, sg.girlCell[g - 1].c, -1);
    const bp = (b: number) => pos(sg.boyCell[b - 1].a, sg.boyCell[b - 1].c, 1);
    const centre = (g: number): [number, number] => pos(sg.girlCell[g - 1].a, sg.girlCell[g - 1].c, 0);
    scene.viewBox(-8, -8, 52 + (cols - 1) * dx + 16, 44 + (sg.rowLengths.length - 1) * dy + 16);
    hooks.forEach((hk, j) => {
      const d = hk.girls.map((g, t) => `${t ? 'L' : 'M'}${centre(g).join(',')}`).join(' ') + (hk.girls.length === 1 ? ' l0.1,0' : '');
      scene.el('hooks', `h${j}`, 'path', { class: 'hook', d, style: `stroke:var(${ROW_COLOURS[j % ROW_COLOURS.length]})` });
    });
    if (r) {
      const p = r.saps[0];
      const pts = p.girls.flatMap((g, t) => [gp(g), bp(p.boys[t])]);
      scene.el('sap', 'sap', 'path', { class: 'sap-path', d: pts.map((q, t) => `${t ? 'L' : 'M'}${q.join(',')}`).join(' ') });
    }
    sg.lists.forEach((row, gi) => {
      const g = gi + 1;
      for (const b of row) {
        const [x1, y1] = gp(g), [x2, y2] = bp(b);
        const own = sg.girlCell[g - 1].a === sg.boyCell[b - 1].a && sg.girlCell[g - 1].c === sg.boyCell[b - 1].c;
        drawEdge(scene, 'edges', `e${g}-${b}`, x1, y1, x2, y2, matching[g - 1] === b ? 'couple' : own ? 'pedge' : 'edge');
      }
    });
    const matchedB = new Set(matching.filter((x) => x));
    sg.girlCell.forEach((_, i) => drawGirl(scene, 'nodes', `g${i + 1}`, ...gp(i + 1), '', matching[i] ? '' : 'free', 8));
    sg.boyCell.forEach((_, i) => drawBoy(scene, 'nodes', `b${i + 1}`, ...bp(i + 1), '', matchedB.has(i + 1) ? '' : 'free', 14));
  }

  function drawStraight(r: RoundRecord, hooks: Hook[]): void {
    const L = r.L;
    const DX = 64, DY = 38, O = 14;
    const maxLen = Math.max(...hooks.map((x) => x.girls.length));
    const shown = Math.min(maxLen, L + 1);
    const gp = new Map<number, [number, number]>(), bp = new Map<number, [number, number]>();
    hooks.forEach((hk, x) => hk.girls.forEach((g, y) => {
      if (y >= shown) return;
      gp.set(g, [40 + y * DX - O, 20 + x * DY]);
      bp.set(hk.boys[y], [40 + y * DX + O, 20 + x * DY]);
    }));
    scene.viewBox(-30, -8, 40 + shown * DX + 30, 24 + hooks.length * DY);
    if (shown > L) {
      scene.el('hooks', 'beyond', 'rect', { x: 40 + L * DX - DX / 2, y: 0, width: DX, height: hooks.length * DY + 4, style: 'fill:var(--paper-2)' });
    }
    hooks.forEach((_, x) => scene.el('labels', `hl${x}`, 'text', { class: 'lbl-small', x: 6, y: 24 + x * DY, 'text-anchor': 'end' }, `hook ${x + 1}`));
    const p = r.saps[0];
    const pts = p.girls.flatMap((g, t) => [gp.get(g), bp.get(p.boys[t])]).filter(Boolean) as [number, number][];
    scene.el('sap', 'sap', 'path', { class: 'sap-path', d: pts.map((q, t) => `${t ? 'L' : 'M'}${q.join(',')}`).join(' ') });
    // Couples along the hooks, and the BLINK arcs (boy -> girl one level down).
    hooks.forEach((hk) => hk.boys.forEach((b, y) => {
      const g2 = hk.girls[y + 1];
      if (g2 && bp.has(b) && gp.has(g2)) drawEdge(scene, 'edges', `c${b}`, ...bp.get(b)!, ...gp.get(g2)!, 'couple');
    }));
    for (const [b, list] of r.blink) {
      const from = bp.get(b);
      if (!from) continue;
      for (const g of list) {
        const to = gp.get(g);
        if (!to) continue;
        const [x1, y1, x2, y2] = trim(from[0], from[1], to[0], to[1], 9, 10);
        scene.el('edges', `a${b}-${g}`, 'path', { class: 'arc', d: `M${x1},${y1} L${x2},${y2}`, 'marker-end': `url(#${arrowId})` });
      }
    }
    for (const [g, q] of gp) drawGirl(scene, 'nodes', `sg${g}`, q[0], q[1], '', r.matchingBefore[g - 1] ? '' : 'free', 8);
    const matchedB = new Set(r.matchingBefore.filter((x) => x));
    for (const [b, q] of bp) drawBoy(scene, 'nodes', `sb${b}`, q[0], q[1], '', matchedB.has(b) ? '' : 'free', 14);
  }

  rebuild();
}
