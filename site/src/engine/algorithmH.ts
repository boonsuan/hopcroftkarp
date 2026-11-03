/**
 * A step-by-step simulator of Knuth's Algorithm 7.5.1H (Pre-Fascicle 14A,
 * revision -88 of 18 September 2026).
 *
 * This is a TypeScript port of `code/algorithm_h.py`. It follows the steps
 * H1-H17 literally, with the same data structures (GLINK/GNEXT edge lists,
 * BLINK/BNEXT reverse lists built by the algorithm, QUEUE, IQUEUE, MARK,
 * MARKED, BOY), so that the order in which things happen is exactly the
 * order the report's proofs reason about. The test suite compares it, step
 * by step, with traces exported by the Python simulator.
 *
 * Indices are one-based, as in the pre-fascicle: girls 1..M, boys 1..N,
 * edges 1..E, and 0 means "none" (a free vertex, or the end of a list).
 */

/** An ordered bipartite graph: `lists[g-1]` is girl g's list of boys, in GLINK order. */
export interface OrderedGraph {
  lists: number[][];
  /** Number of boys; defaults to the largest boy index that appears. */
  N?: number;
}

/** What happened in one step, for narration, highlighting and sound. */
export type StepEvent =
  | { kind: 'h1-match'; g: number; b: number }
  | { kind: 'h1-free'; g: number }
  | { kind: 'round-start'; round: number }
  | { kind: 'level-start'; level: number }
  | { kind: 'scan-girl'; g: number }
  | { kind: 'examine'; g: number; b: number }
  | { kind: 'ignore'; g: number; b: number }
  | { kind: 'head-insert'; g: number; b: number }
  | { kind: 'skip-matched'; g: number; b: number }
  | { kind: 'discover'; g: number; b: number }
  | { kind: 'queue-mate'; b: number; g: number }
  | { kind: 'first-free-boy'; b: number; L: number }
  | { kind: 'free-boy'; b: number }
  | { kind: 'next-level'; level: number }
  | { kind: 'dag-complete'; L: number }
  | { kind: 'terminate' }
  | { kind: 'reset-marks'; count: number }
  | { kind: 'root'; b: number }
  | { kind: 'enter'; b: number; level: number }
  | { kind: 'consume'; b: number; g: number }
  | { kind: 'deleted'; b: number; g: number }
  | { kind: 'list-empty'; b: number }
  | { kind: 'descend'; g: number; b: number; level: number }
  | { kind: 'sap-complete'; g: number }
  | { kind: 'backtrack'; level: number }
  | { kind: 'root-fails' }
  | { kind: 'remove-free'; g: number; moved: number }
  | { kind: 'augment'; g: number; b: number }
  | { kind: 'augment-done' };

/** A shortest augmenting path, listed from its free girl: g0 b1 g1 b2 ... b_L. */
export interface Sap {
  girls: number[];
  boys: number[];
}

/** The dag of one round, recorded when step H10 finishes building it. */
export interface Dag {
  L: number;
  /** girlLevels[k] lists G_k in QUEUE order. */
  girlLevels: number[][];
  /** boyLevels[k] lists B_k (k >= 1) in order of discovery; boyLevels[0] is empty. */
  boyLevels: number[][];
  /** blink[b] = the girls in BLINK[b], in list order (only for boys in the dag). */
  blink: Map<number, number[]>;
  /** The roots of the depth-first search: the free boys of B_L, in MARKED order. */
  roots: number[];
}

/** Everything the widgets need to draw the state after one step. */
export interface Snapshot {
  /** Index of this snapshot in the run. */
  index: number;
  /** The step just executed (1..17), and a short description of what it did. */
  step: number;
  event: StepEvent;
  /** Round number in the report's convention: H1 is round 1, the k-th dag is round k+1. */
  round: number;
  gmate: number[];
  bmate: number[];
  /** The free girls, QUEUE[0..f-1]. */
  free: number[];
  /** The whole current QUEUE prefix QUEUE[0..q-1] while a dag is being built. */
  queue: number[];
  l: number;
  L: number;
  /** The current dag (null outside H11-H17 of a round and before H10 finishes). */
  dag: Dag | null;
  /** Girls of the dag already reached during the breadth-first search, by level. */
  bfsGirls: number[][];
  /** Boys of the dag already reached, by level (index = level). */
  bfsBoys: number[][];
  /** Current contents of each BLINK list, girl indices in list order. */
  blink: Map<number, number[]>;
  /** BOY[1..L] for the current search path (0 = unset). */
  boyPath: number[];
  /** Girls used by SAPs of the current round ("deleted" in H13's sense). */
  deletedGirls: Set<number>;
  /** Boys whose MARK is -1 (used by a SAP of the current round). */
  usedBoys: Set<number>;
  /** SAPs found so far in the current round. */
  saps: Sap[];
  /** The current girl g and boy b registers. */
  g: number;
  b: number;
  /** Work counters of the current round (see report §2.5). */
  w5: number;
  w13: number;
  w11: number;
  done: boolean;
}

/** A summary of one successful round (a dag with L > 0). */
export interface RoundRecord {
  L: number;
  fBefore: number;
  fAfter: number;
  queueBefore: number[];
  queueAfter: number[];
  marked: number[];
  roots: number[];
  blink: Map<number, number[]>;
  saps: Sap[];
  w5: number;
  w13: number;
  w11: number;
  matchingBefore: number[];
  matchingAfter: number[];
}

export interface Run {
  M: number;
  N: number;
  E: number;
  initialMatching: number[];
  initialQueue: number[];
  h1Exams: number;
  rounds: RoundRecord[];
  finalMatching: number[];
  /** Step labels in the order visited, with H1 recorded once (as in the Python export). */
  stepTrace: number[];
  snapshots: Snapshot[];
}

/**
 * Run Algorithm H on an ordered graph and record every step.
 * `recordSnapshots = false` skips the (memory-heavy) snapshots, for tests on large inputs.
 */
export function runAlgorithmH(graph: OrderedGraph, recordSnapshots = true): Run {
  const lists = graph.lists;
  const M = lists.length;
  let N = graph.N ?? 0;
  for (const row of lists) for (const b of row) N = Math.max(N, b);

  // ---- The sparse representation of exercise 6. Edges are created girl by
  // girl with each list reversed, and inserted at the head of GLINK[g], so
  // that GLINK/GNEXT end up traversing each list in the given order.
  const gtip = [0], btip = [0], gnext = [0], bnext = [0];
  const glink = new Array<number>(M + 1).fill(0);
  for (let g = 1; g <= M; g++) {
    const row = lists[g - 1];
    for (let k = row.length - 1; k >= 0; k--) {
      const e = gtip.length;
      gtip.push(g);
      btip.push(row[k]);
      gnext.push(glink[g]);
      bnext.push(0);
      glink[g] = e;
    }
  }
  const E = gtip.length - 1;
  const blink = new Array<number>(N + 1).fill(0);
  const gmate = new Array<number>(M + 1).fill(0);
  const bmate = new Array<number>(N + 1).fill(0);
  const queue = new Array<number>(Math.max(1, M)).fill(0);
  const iqueue = new Array<number>(M + 1).fill(0);
  const mark = new Array<number>(N + 1).fill(0); // mark[0] stays 0 throughout
  const marked = new Array<number>(Math.max(1, N)).fill(0);
  const boy = new Array<number>(Math.min(M, N) + 2).fill(0);

  const snapshots: Snapshot[] = [];
  const stepTrace: number[] = [];
  const rounds: RoundRecord[] = [];

  // Registers of Algorithm H.
  let f = 0, i = 0, q = 0, qp = 0, t = 0, r = 0, l = 0, L = 0;
  let g = 0, b = 0, e = 0;
  let w5 = 0, w13 = 0, w11 = 0;
  let round = 1;
  let dag: Dag | null = null;
  let saps: Sap[] = [];
  let roundStart: { f: number; queue: number[]; matching: number[] } | null = null;
  let roundMarked: number[] = [];
  let roundRoots: number[] = [];
  let roundBlink = new Map<number, number[]>();
  let bfsGirls: number[][] = [];
  let bfsBoys: number[][] = [];

  const readList = (head: number): number[] => {
    const out: number[] = [];
    for (let x = head; x !== 0; x = bnext[x]) out.push(gtip[x]);
    return out;
  };

  const snap = (step: number, event: StepEvent, done = false) => {
    if (!recordSnapshots) return;
    const lists = new Map<number, number[]>();
    for (let k = 0; k < t; k++) lists.set(marked[k], readList(blink[marked[k]]));
    const deleted = new Set<number>(), used = new Set<number>();
    for (let bb = 1; bb <= N; bb++) {
      if (mark[bb] < 0) {
        used.add(bb);
        if (bmate[bb]) deleted.add(bmate[bb]);
      }
    }
    snapshots.push({
      index: snapshots.length,
      step,
      event,
      round,
      gmate: gmate.slice(1),
      bmate: bmate.slice(1),
      free: queue.slice(0, f),
      queue: queue.slice(0, q),
      l,
      L,
      dag,
      bfsGirls: bfsGirls.map((x) => x.slice()),
      bfsBoys: bfsBoys.map((x) => x.slice()),
      blink: lists,
      boyPath: boy.slice(0, L + 1),
      deletedGirls: deleted,
      usedBoys: used,
      saps: saps.map((p) => ({ girls: p.girls.slice(), boys: p.boys.slice() })),
      g,
      b,
      w5,
      w13,
      w11,
      done,
    });
  };

  // ---- H1 (answer 7): scan girls M, M-1, ..., 1; take the first free boy.
  let h1Exams = 0;
  stepTrace.push(1);
  for (g = M; g >= 1; g--) {
    e = glink[g];
    while (e) {
      h1Exams++;
      if (bmate[btip[e]] === 0) break;
      e = gnext[e];
    }
    if (e) {
      b = btip[e];
      gmate[g] = b;
      bmate[b] = g;
      snap(1, { kind: 'h1-match', g, b });
    } else {
      gmate[g] = 0;
      queue[f] = g;
      iqueue[g] = f;
      f++;
      snap(1, { kind: 'h1-free', g });
    }
  }
  g = 0;
  b = 0;
  const initialMatching = gmate.slice(1);
  const initialQueue = queue.slice(0, f);

  // ---- H2-H17, with an explicit program counter as in the Python version.
  let pc = 2;
  for (;;) {
    stepTrace.push(pc);
    switch (pc) {
      case 2: // Start building the dag.
        round++;
        roundStart = { f, queue: queue.slice(0, f), matching: gmate.slice(1) };
        t = i = l = r = 0;
        q = f;
        L = 0;
        w5 = w13 = w11 = 0;
        dag = null;
        saps = [];
        bfsGirls = [queue.slice(0, f)];
        bfsBoys = [[]];
        snap(2, { kind: 'round-start', round });
        pc = 3;
        break;
      case 3: // Begin level l+1.
        qp = q;
        snap(3, { kind: 'level-start', level: l });
        pc = 4;
        break;
      case 4: // Process a girl of G_l.
        if (i === qp) {
          pc = 10;
          snap(4, { kind: 'level-start', level: l });
        } else {
          g = queue[i];
          i++;
          e = glink[g];
          snap(4, { kind: 'scan-girl', g });
          pc = 5;
        }
        break;
      case 5: // Let b be a suitor for g.
        if (e === 0) {
          pc = 4;
          snap(5, { kind: 'scan-girl', g });
        } else {
          w5++;
          b = btip[e];
          snap(5, { kind: 'examine', g, b });
          pc = 6;
        }
        break;
      case 6: // Is b new?
        if (mark[b] === 0) {
          pc = 8;
          snap(6, { kind: 'examine', g, b });
        } else {
          if (mark[b] > l) {
            // b is already in B_{l+1}: g joins his reverse list at the HEAD.
            bnext[e] = blink[b];
            blink[b] = e;
            snap(6, { kind: 'head-insert', g, b });
          } else {
            snap(6, { kind: 'ignore', g, b });
          }
          pc = 7;
        }
        break;
      case 7: // Loop on b.
        e = gnext[e];
        pc = 5;
        snap(7, { kind: 'scan-girl', g });
        break;
      case 8: // Enter b into B_{l+1}.
        if (L > 0 && bmate[b] !== 0) {
          pc = 7;
          snap(8, { kind: 'skip-matched', g, b });
        } else {
          mark[b] = l + 1;
          marked[t] = b;
          t++;
          blink[b] = e;
          bnext[e] = 0;
          while (bfsBoys.length <= l + 1) bfsBoys.push([]);
          bfsBoys[l + 1].push(b);
          snap(8, { kind: 'discover', g, b });
          pc = 9;
        }
        break;
      case 9: // Is b free?
        if (bmate[b] !== 0) {
          queue[q] = bmate[b];
          q++;
          while (bfsGirls.length <= l + 1) bfsGirls.push([]);
          bfsGirls[l + 1].push(bmate[b]);
          snap(9, { kind: 'queue-mate', b, g: bmate[b] });
        } else if (L === 0) {
          L = l + 1;
          r = 1;
          q = qp; // the next level is discarded
          if (bfsGirls.length > l + 1) bfsGirls.length = l + 1;
          snap(9, { kind: 'first-free-boy', b, L });
        } else {
          r++;
          snap(9, { kind: 'free-boy', b });
        }
        pc = 7;
        break;
      case 10: // Is the dag complete?
        if (q !== qp) {
          l++;
          pc = 3;
          snap(10, { kind: 'next-level', level: l });
        } else if (L === 0) {
          snap(10, { kind: 'terminate' }, true);
          return finish();
        } else {
          roundMarked = marked.slice(0, t);
          roundRoots = marked.slice(t - r, t);
          roundBlink = new Map();
          for (const bb of roundMarked) roundBlink.set(bb, readList(blink[bb]));
          dag = {
            L,
            girlLevels: bfsGirls.map((x) => x.slice()),
            boyLevels: bfsBoys.map((x) => x.slice()),
            blink: new Map(roundBlink),
            roots: roundRoots.slice(),
          };
          snap(10, { kind: 'dag-complete', L });
          pc = 11;
        }
        break;
      case 11: // Start to find a SAP.
        if (r === 0) {
          for (let k = 0; k < t; k++) mark[marked[k]] = 0;
          w11 += t;
          rounds.push({
            L,
            fBefore: roundStart!.f,
            fAfter: f,
            queueBefore: roundStart!.queue,
            queueAfter: queue.slice(0, f),
            marked: roundMarked,
            roots: roundRoots,
            blink: roundBlink,
            saps: saps.map((p) => ({ girls: p.girls.slice(), boys: p.boys.slice() })),
            w5,
            w13,
            w11,
            matchingBefore: roundStart!.matching,
            matchingAfter: gmate.slice(1),
          });
          snap(11, { kind: 'reset-marks', count: t });
          pc = 2;
        } else {
          b = marked[t - r];
          r--;
          l = L;
          boy.fill(0);
          snap(11, { kind: 'root', b });
          pc = 12;
        }
        break;
      case 12: // Enter level l.
        boy[l] = b;
        snap(12, { kind: 'enter', b, level: l });
        pc = 13;
        break;
      case 13: // Advance.
        e = blink[b];
        if (e === 0) {
          snap(13, { kind: 'list-empty', b });
          pc = 15;
        } else {
          w13++;
          blink[b] = bnext[e]; // the arc is consumed: the dag is destroyed as we go
          g = gtip[e];
          if (mark[gmate[g]] < 0) {
            snap(13, { kind: 'deleted', b, g });
            pc = 13; // repeat this step
          } else {
            const from = b;
            b = gmate[g];
            snap(13, { kind: 'consume', b: from, g });
            pc = 14;
          }
        }
        break;
      case 14: // SAP complete?
        if (b === 0) {
          snap(14, { kind: 'sap-complete', g });
          pc = 16;
        } else {
          l--;
          snap(14, { kind: 'descend', g, b, level: l });
          pc = 12;
        }
        break;
      case 15: // Resume higher level.
        l++;
        if (l > L) {
          snap(15, { kind: 'root-fails' });
          pc = 11;
        } else {
          b = boy[l];
          snap(15, { kind: 'backtrack', level: l });
          pc = 13;
        }
        break;
      case 16: { // Prepare to augment: remove g from the free list.
        const girls = [g];
        for (let j = 1; j < L; j++) girls.push(bmate[boy[j]]);
        saps.push({ girls, boys: boy.slice(1, L + 1) });
        f--;
        const k = iqueue[g];
        const moved = queue[f];
        queue[k] = moved;
        iqueue[moved] = k;
        i = moved; // (Knuth reuses the register i here)
        b = boy[1];
        snap(16, { kind: 'remove-free', g, moved });
        pc = 17;
        break;
      }
      case 17: { // Augment.
        mark[b] = -1;
        const gp = bmate[b];
        bmate[b] = g;
        gmate[g] = b;
        snap(17, { kind: 'augment', g, b });
        if (gp !== 0) {
          g = gp;
          l++;
          b = boy[l];
          pc = 17;
        } else {
          pc = 11;
        }
        break;
      }
      default:
        throw new Error(`bad program counter ${pc}`);
    }
  }

  function finish(): Run {
    return {
      M,
      N,
      E,
      initialMatching,
      initialQueue,
      h1Exams,
      rounds,
      finalMatching: gmate.slice(1),
      stepTrace,
      snapshots,
    };
  }
}

/** Number of rounds in the report's convention (H1 counts as round 1 if it matches anyone). */
export function roundCount(run: Run): number {
  const h1 = run.initialMatching.some((x) => x !== 0) ? 1 : 0;
  return h1 + run.rounds.length;
}
