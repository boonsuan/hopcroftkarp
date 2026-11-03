/**
 * The example graphs of the report, as ordered graphs (girl lists in GLINK order).
 * Each one matches `code/examples.py`; the tests check the runs against the
 * Python traces.
 */
import type { OrderedGraph } from './algorithmH';
import catalogJson from '../data/catalog.json';
import searchJson from '../data/search.json';

/** A cell (row a, column c) of a staircase graph. */
export interface Cell {
  a: number;
  c: number;
}

export interface StaircaseGraph extends OrderedGraph {
  n: number;
  /** Row lengths l_1, ..., l_{n-1}. */
  rowLengths: number[];
  /** girlCell[g-1] and boyCell[b-1]: the cell of each vertex. */
  girlCell: Cell[];
  boyCell: Cell[];
  /** Whether the vertical edge into the corner (n-1, 2) is included (it is omitted in Γ_n). */
  cornerEdge: boolean;
}

/**
 * The staircase graph Γ_n of report §5.1, with its input order: boys numbered
 * row by row; the first girl of row a numbered n-a; the other girls n, n+1, ...
 * row by row; each girl's list is [left boy, upper boy, own boy].
 * With `cornerEdge = true` the omitted edge b_{n-2,2} — g_{n-1,2} is put back.
 */
export function staircase(n: number, cornerEdge = false): StaircaseGraph {
  if (n < 2) throw new Error('staircase graphs need n >= 2');
  const rows = n - 1;
  const rowLengths: number[] = [];
  for (let a = 1; a <= rows; a++) rowLengths.push(Math.max(2, Math.floor((n + 2 - a) / 2)));
  const boyCell: Cell[] = [];
  const boyAt = new Map<string, number>();
  rowLengths.forEach((len, k) => {
    for (let c = 1; c <= len; c++) {
      boyCell.push({ a: k + 1, c });
      boyAt.set(`${k + 1},${c}`, boyCell.length);
    }
  });
  const s = boyCell.length;
  const girlCell: Cell[] = new Array(s);
  const girlAt = new Map<string, number>();
  let next = n;
  for (let a = 1; a <= rows; a++) {
    girlCell[n - a - 1] = { a, c: 1 };
    girlAt.set(`${a},1`, n - a);
  }
  rowLengths.forEach((len, k) => {
    for (let c = 2; c <= len; c++) {
      girlCell[next - 1] = { a: k + 1, c };
      girlAt.set(`${k + 1},${c}`, next);
      next++;
    }
  });
  const lists: number[][] = new Array(s);
  for (let g = 1; g <= s; g++) {
    const { a, c } = girlCell[g - 1];
    const row: number[] = [];
    if (c > 1) row.push(boyAt.get(`${a},${c - 1}`)!);
    const up = boyAt.get(`${a - 1},${c}`);
    const isCorner = a === rows && c === 2;
    if (up !== undefined && (!isCorner || cornerEdge)) row.push(up);
    row.push(boyAt.get(`${a},${c}`)!);
    lists[g - 1] = row;
  }
  return { lists, N: s, n, rowLengths, girlCell, boyCell, cornerEdge };
}

/** Knuth's 16-pair graph (answer 15(d)) with the input order of Appendix A. */
export const knuth16: OrderedGraph & { logicalGirl: number[] } = {
  lists: [
    [3, 5], [9, 11], [15], [7, 9], [13], [3, 7], [3], [1],
    [1, 2], [3, 2, 4], [5, 4, 6], [7, 5, 8], [9, 6, 8, 10], [11, 10, 12], [13, 14], [15, 14, 16],
  ],
  N: 16,
  /** logicalGirl[g-1] = Knuth's name k of the girl numbered g (so she is g_k). */
  logicalGirl: [5, 11, 15, 9, 13, 7, 3, 1, 2, 4, 6, 8, 10, 12, 14, 16],
};

/** The 8-pair tree of report §8.2: an operational realization that is not basic-row. */
export const tree8: OrderedGraph = {
  lists: [[5, 7], [3, 5], [3], [1], [1, 2], [3, 4], [5, 2, 6], [7, 8]],
  N: 8,
};

/** The halving graph of Appendix B for f = 2^t free girls (s = 2f). */
export function halving(f: number): OrderedGraph & { names: { girls: string[]; boys: string[] } } {
  if (f < 1 || (f & (f - 1)) !== 0) throw new Error('f must be a power of 2');
  const rho = (i: number) => Math.log2(i & -i);
  const bnum = (i: number) => 2 * i - 1; // b_i
  const dnum = (i: number) => 2 * i;     // d_i
  const order = Array.from({ length: f }, (_, k) => k + 1).sort((x, y) => rho(y) - rho(x) || x - y);
  const unum = new Map<number, number>();
  order.forEach((i, k) => unum.set(i, f - k));
  const lists: number[][] = new Array(2 * f);
  const girls: string[] = new Array(2 * f);
  const boys: string[] = new Array(2 * f);
  for (let i = 1; i <= f; i++) {
    lists[f + i - 1] = [bnum(i), dnum(i)];
    girls[f + i - 1] = `c_${i}`;
    const u = unum.get(i)!;
    lists[u - 1] = i < f ? [bnum(i), bnum(i + (i & -i))] : [bnum(i)];
    girls[u - 1] = `u_${i}`;
    boys[bnum(i) - 1] = `b_${i}`;
    boys[dnum(i) - 1] = `d_${i}`;
  }
  return { lists, N: 2 * f, names: { girls, boys } };
}

/** The caterpillar tree of report §9 with components 2..K. */
export function caterpillar(K: number): OrderedGraph {
  const s = (K * (K + 1)) / 2 - 1;
  const lists: number[][] = new Array(s);
  for (let k = 2; k <= K; k++) {
    const c = (k * (k - 1)) / 2;
    lists[c - 1] = [c];
    for (let i = 1; i < k; i++) lists[c + i - 1] = [c + i - 1, c + i];
    if (k < K) lists[c + k - 2].push(((k + 1) * k) / 2);
  }
  return { lists, N: s };
}

/** Neighbour sets of the six-pair graph of report §8.5 (girl g's set of boys). */
export const sixPairNeighbours: number[][] = [[1], [1, 2, 5], [3], [2, 3, 4], [3, 5], [5, 6]];

function bySize(json: Record<string, { adjacency: number[][] }>): Record<number, OrderedGraph> {
  return Object.fromEntries(Object.entries(json).map(([s, v]) => [Number(s), { lists: v.adjacency, N: Number(s) }]));
}

/** The computed realizations of Appendix C, by size s (even s ≤ 40). */
export const catalog = bySize(catalogJson);

/** The realizations beyond the catalog (s = 42, 44, …, 56): found by `code/search.py`, except the padded ones. */
export const searchFound = bySize(searchJson);

/** Sizes whose realization is the padding of the one for s − 2 (report Prop. 8.8). */
export const padded = new Set(
  Object.entries(searchJson as Record<string, { padded?: boolean }>).filter(([, v]) => v.padded).map(([s]) => Number(s)),
);
