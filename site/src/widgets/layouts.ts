/**
 * Where to draw the vertices of each example graph. Layouts mirror the
 * report's figures (make_figures.py) so the site and the PDF look alike.
 */
import type { OrderedGraph } from '../engine/algorithmH';
import type { StaircaseGraph } from '../engine/examples';
import { knuth16 } from '../engine/examples';

export interface Layout {
  width: number;
  height: number;
  girl: (g: number) => [number, number];
  boy: (b: number) => [number, number];
  /** Edges drawn darker: the perfect matching the figures compare against. */
  isPerfect: (g: number, b: number) => boolean;
  /** Display names (HTML), e.g. Knuth's logical names for the 16-pair graph. */
  gLabel: (g: number) => string;
  bLabel: (b: number) => string;
  /** Short plain-text labels drawn inside the vertices. */
  gText: (g: number) => string;
  bText: (b: number) => string;
}

const sub = (letter: string, k: number | string) => `<i>${letter}</i><sub>${k}</sub>`;

/** Cells of a staircase graph: girl at the upper left of her cell, boy at the lower right. */
export function staircaseLayout(sg: StaircaseGraph, scale = 1): Layout {
  const dx = 66 * scale, dy = 56 * scale, ox = 13 * scale, oy = 10 * scale;
  const cols = Math.max(...sg.rowLengths);
  const pos = (a: number, c: number, sgn: number): [number, number] =>
    [30 + (c - 1) * dx + sgn * ox, 24 + (a - 1) * dy - sgn * oy];
  return {
    width: 60 + (cols - 1) * dx,
    height: 48 + (sg.rowLengths.length - 1) * dy,
    girl: (g) => pos(sg.girlCell[g - 1].a, sg.girlCell[g - 1].c, -1),
    boy: (b) => pos(sg.boyCell[b - 1].a, sg.boyCell[b - 1].c, 1),
    isPerfect: (g, b) => sg.girlCell[g - 1].a === sg.boyCell[b - 1].a && sg.girlCell[g - 1].c === sg.boyCell[b - 1].c,
    gLabel: (g) => sub('g', g),
    bLabel: (b) => sub('b', b),
    gText: (g) => String(g),
    bText: (b) => String(b),
  };
}

/** Knuth's 16 pairs, two per row as in the first matrix of answer 15(d), with logical names. */
export function knuth16Layout(): Layout {
  const log = knuth16.logicalGirl;
  const dx = 150, dy = 46;
  const pair = (k: number, sgn: number): [number, number] => {
    const row = Math.floor((k - 1) / 2), col = (k - 1) % 2;
    return [40 + col * dx + sgn * 20, 22 + row * dy - sgn * 9];
  };
  return {
    width: 40 + dx + 60,
    height: 30 + 7 * dy + 20,
    girl: (g) => pair(log[g - 1], -1),
    boy: (b) => pair(b, 1),
    isPerfect: (g, b) => log[g - 1] === b,
    gLabel: (g) => sub('g', log[g - 1]),
    bLabel: (b) => sub('b', b),
    gText: (g) => String(log[g - 1]),
    bText: (b) => String(b),
  };
}

/** The 8-pair tree of report §8.2 (same coordinates as Fig. 15). */
export function tree8Layout(): Layout {
  const G: Record<number, [number, number]> = { 4: [0, 0], 5: [2, 0], 7: [4, 0], 1: [6, 0], 8: [8, 0], 2: [5, 1.1], 3: [4, 2.2], 6: [6, 2.2] };
  const B: Record<number, [number, number]> = { 1: [1, 0], 2: [3, 0], 5: [5, 0], 7: [7, 0], 8: [9, 0], 6: [4, 1.1], 3: [5, 2.2], 4: [7, 2.2] };
  const tr = ([x, y]: [number, number]): [number, number] => [26 + x * 44, 22 + y * 40];
  return {
    width: 26 * 2 + 9 * 44,
    height: 44 + 2.2 * 40,
    girl: (g) => tr(G[g]),
    boy: (b) => tr(B[b]),
    isPerfect: () => false,
    gLabel: (g) => sub('g', g),
    bLabel: (b) => sub('b', b),
    gText: (g) => String(g),
    bText: (b) => String(b),
  };
}

/** Halving graphs: one column per index i, with u_i, b_i, c_i, d_i from top to bottom. */
export function halvingLayout(graph: OrderedGraph & { names: { girls: string[]; boys: string[] } }): Layout {
  const f = graph.lists.length / 2;
  const parse = (name: string): [string, number] => [name[0], Number(name.slice(2))];
  const rowOf: Record<string, number> = { u: 0, b: 1, c: 2, d: 3 };
  const at = (name: string): [number, number] => {
    const [kind, i] = parse(name);
    return [30 + (i - 1) * 62, 20 + rowOf[kind] * 44];
  };
  return {
    width: 60 + (f - 1) * 62,
    height: 40 + 3 * 44,
    girl: (g) => at(graph.names.girls[g - 1]),
    boy: (b) => at(graph.names.boys[b - 1]),
    isPerfect: (g, b) => {
      const [kg, ig] = parse(graph.names.girls[g - 1]);
      const [kb, ib] = parse(graph.names.boys[b - 1]);
      return ig === ib && ((kg === 'u' && kb === 'b') || (kg === 'c' && kb === 'd'));
    },
    gLabel: (g) => { const [k, i] = parse(graph.names.girls[g - 1]); return sub(k, i); },
    bLabel: (b) => { const [k, i] = parse(graph.names.boys[b - 1]); return sub(k, i); },
    gText: (g) => graph.names.girls[g - 1].replace('_', ''),
    bText: (b) => graph.names.boys[b - 1].replace('_', ''),
  };
}

/**
 * A graph with a perfect matching, drawn like Knuth's matrices: one row per
 * basic path. Each row starts at a girl left free by step H1 and alternates
 * couples of the final matching (one cell each, girl upper left, boy lower
 * right) with couples of the H1 matching (the step to the next cell). Long
 * lists of rows are folded into side-by-side blocks. Returns null when the
 * final matching is not perfect.
 */
export function basicRowLayout(graph: OrderedGraph, h1: number[], final: number[]): Layout | null {
  const M = graph.lists.length;
  if (final.length !== M || final.some((b) => b === 0)) return null;
  const h1Girl = new Map<number, number>();
  h1.forEach((b, i) => b && h1Girl.set(b, i + 1));
  const rows: number[][] = []; // girls, in path order
  const seen = new Set<number>();
  const follow = (g0: number) => {
    const row: number[] = [];
    for (let g = g0; g && !seen.has(g); g = h1Girl.get(final[g - 1]) ?? 0) {
      seen.add(g);
      row.push(g);
    }
    rows.push(row);
  };
  for (let g = 1; g <= M; g++) if (h1[g - 1] === 0) follow(g);
  for (let g = 1; g <= M; g++) if (!seen.has(g)) follow(g); // pairs off the basic paths
  const blocks = Math.ceil(rows.length / 7);
  const perBlock = Math.ceil(rows.length / blocks);
  const dx = 62, dy = 50, ox = 12, oy = 9;
  const cell = new Map<number, [number, number]>(); // girl -> (x, y) of her cell centre
  let x0 = 30, width = 0;
  for (let k = 0; k < blocks; k++) {
    const block = rows.slice(k * perBlock, (k + 1) * perBlock);
    const len = Math.max(...block.map((r) => r.length));
    block.forEach((row, a) => row.forEach((g, c) => cell.set(g, [x0 + c * dx, 24 + a * dy])));
    width = x0 + (len - 1) * dx + 30;
    x0 = width + 40;
  }
  const boyGirl = new Map<number, number>();
  final.forEach((b, i) => boyGirl.set(b, i + 1));
  return {
    width,
    height: 48 + (perBlock - 1) * dy,
    girl: (g) => { const [x, y] = cell.get(g)!; return [x - ox, y - oy]; },
    boy: (b) => { const [x, y] = cell.get(boyGirl.get(b) ?? 1)!; return [x + ox, y + oy]; },
    isPerfect: (g, b) => final[g - 1] === b,
    gLabel: (g) => sub('g', g),
    bLabel: (b) => sub('b', b),
    gText: (g) => String(g),
    bText: (b) => String(b),
  };
}

/** Any graph: girls on the top row, boys on the bottom row, in numerical order. */
export function genericLayout(graph: OrderedGraph): Layout {
  const M = graph.lists.length;
  let N = graph.N ?? 0;
  for (const row of graph.lists) for (const b of row) N = Math.max(N, b);
  const gap = Math.max(26, Math.min(48, 760 / Math.max(M, N, 1)));
  return {
    width: 40 + gap * (Math.max(M, N) - 1),
    height: 150,
    girl: (g) => [20 + (g - 1) * gap, 22],
    boy: (b) => [20 + (b - 1) * gap, 128],
    isPerfect: () => false,
    gLabel: (g) => sub('g', g),
    bLabel: (b) => sub('b', b),
    gText: (g) => String(g),
    bText: (b) => String(b),
  };
}
