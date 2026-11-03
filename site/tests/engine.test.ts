/**
 * The TypeScript engine must reproduce the Python simulator exactly: the
 * matching after H1, every round's queues, MARKED order, roots, BLINK lists,
 * SAPs and work counters, the final matching, and the sequence of steps.
 * The traces in tests/golden are written by code/export_traces.py.
 */
import { describe, expect, it } from 'vitest';
import { runAlgorithmH } from '../src/engine/algorithmH';
import { caterpillar, catalog, halving, knuth16, staircase, tree8 } from '../src/engine/examples';
import { maxRounds, quarterSquare, schedule, tchoukaillonNumber, tchoukaillonRounds, winningPosition } from '../src/engine/numbers';

interface GoldenRound {
  round: number;
  L: number;
  f_before: number;
  f_after: number;
  queue_before: number[];
  queue_after: number[];
  matching_before: number[];
  matching_after: number[];
  marked: number[];
  roots: number[];
  blink: Record<string, number[]>;
  saps: Array<{ girls: number[]; boys: number[] }>;
  w5: number;
  w13: number;
  w11: number;
}

interface Golden {
  name: string;
  girls: number[][];
  M: number;
  N: number;
  E: number;
  h1_matching: number[];
  h1_queue: number[];
  h1_examined: number;
  rounds: GoldenRound[];
  final_matching: number[];
  num_rounds: number;
  step_trace: number[];
}

const files = import.meta.glob<Golden>('./golden/*.json', { eager: true, import: 'default' });

describe('engine reproduces the Python traces', () => {
  const entries = Object.entries(files);
  it('has traces to compare against', () => expect(entries.length).toBeGreaterThan(30));

  for (const [path, g] of entries) {
    it(path.replace('./golden/', ''), () => {
      const run = runAlgorithmH({ lists: g.girls, N: g.N }, false);
      expect(run.E).toBe(g.E);
      expect(run.initialMatching).toEqual(g.h1_matching);
      expect(run.initialQueue).toEqual(g.h1_queue);
      expect(run.h1Exams).toBe(g.h1_examined);
      expect(run.rounds.length).toBe(g.rounds.length);
      run.rounds.forEach((r, k) => {
        const e = g.rounds[k];
        expect(r.L).toBe(e.L);
        expect(r.fBefore).toBe(e.f_before);
        expect(r.fAfter).toBe(e.f_after);
        expect(r.queueBefore).toEqual(e.queue_before);
        expect(r.queueAfter).toEqual(e.queue_after);
        expect(r.matchingBefore).toEqual(e.matching_before);
        expect(r.matchingAfter).toEqual(e.matching_after);
        expect(r.marked).toEqual(e.marked);
        expect(r.roots).toEqual(e.roots);
        expect(Object.fromEntries([...r.blink].map(([b, l]) => [String(b), l]))).toEqual(e.blink);
        expect(r.saps).toEqual(e.saps);
        expect([r.w5, r.w13, r.w11]).toEqual([e.w5, e.w13, e.w11]);
      });
      expect(run.finalMatching).toEqual(g.final_matching);
      expect(run.stepTrace).toEqual(g.step_trace);
    });
  }
});

describe('the TypeScript examples match the exported inputs', () => {
  const byName = (name: string) => Object.values(files).find((g) => g.name === name)!;
  it('staircase graphs', () => {
    for (const n of [2, 3, 4, 5, 7, 10]) expect(staircase(n).lists).toEqual(byName(`gamma${n}`).girls);
  });
  it('Knuth 16, tree, halving, caterpillar, catalog', () => {
    expect(knuth16.lists).toEqual(byName('knuth16').girls);
    expect(tree8.lists).toEqual(byName('tree8').girls);
    expect(halving(4).lists).toEqual(byName('halving4').girls);
    expect(halving(8).lists).toEqual(byName('halving8').girls);
    expect(caterpillar(4).lists).toEqual(byName('caterpillar4').girls);
    for (const s of [6, 10, 20]) expect(catalog[s].lists).toEqual(byName(`catalog${s}`).girls);
  });
});

describe('staircase graphs (Theorem S)', () => {
  it('Γ_n has n rounds of one SAP each, at levels 2..n', () => {
    for (let n = 2; n <= 20; n++) {
      const run = runAlgorithmH(staircase(n), false);
      expect(run.rounds.map((r) => r.L)).toEqual(Array.from({ length: n - 1 }, (_, k) => k + 2));
      expect(run.rounds.every((r) => r.saps.length === 1)).toBe(true);
      expect(staircase(n).lists.length).toBe(quarterSquare(n));
    }
  });
});

describe('arithmetic', () => {
  it('Tchoukaillon numbers', () => {
    expect(Array.from({ length: 14 }, (_, k) => tchoukaillonNumber(k + 1))).toEqual([1, 2, 4, 6, 10, 12, 18, 22, 30, 34, 42, 48, 58, 60]);
  });
  it('T(s) <= R(s), with R(9) = 5 > T(9) = 4', () => {
    for (let s = 1; s <= 500; s++) expect(tchoukaillonRounds(s)).toBeLessThanOrEqual(maxRounds(s));
    expect([maxRounds(9), tchoukaillonRounds(9)]).toEqual([5, 4]);
  });
  it('the schedule for s = 16', () => {
    expect(schedule(16).map((r) => [r.f, r.a])).toEqual([[8, 3], [5, 2], [3, 1], [2, 1], [1, 1]]);
  });
  it('winning Tchoukaillon positions (answer 11(a))', () => {
    const show = (s: number) => winningPosition(s).slice(1).reverse().join('');
    expect([1, 2, 3, 4, 10, 24].map(show)).toEqual(['1', '20', '21', '310', '53110', '86424000']);
  });
});
