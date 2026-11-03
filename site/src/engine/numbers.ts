/**
 * The arithmetic of the report: the Tchoukaillon schedule (exercise 15(c)),
 * Tchoukaillon numbers Ч_n (exercise 11(c)), quarter-squares Q_n, and the
 * two round counts T(s) and R(s).
 */

/** Q_n = floor((n+1)^2 / 4): n rounds are possible exactly when s >= Q_n (Theorem R). */
export const quarterSquare = (n: number): number => Math.floor(((n + 1) * (n + 1)) / 4);

/** R(s) = floor(sqrt(4s+1)) - 1, the largest number of rounds (Theorem R). */
export function maxRounds(s: number): number {
  let r = Math.floor(Math.sqrt(4 * s + 1));
  while (r * r > 4 * s + 1) r--;
  while ((r + 1) * (r + 1) <= 4 * s + 1) r++;
  return r - 1;
}

/** One level of the Tchoukaillon schedule. */
export interface ScheduleRow {
  L: number;
  f: number;
  a: number;
}

/** The Tchoukaillon schedule (3.1): f_2 = floor(s/2), a_L = ceil(f_L/(L+1)). */
export function schedule(s: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let f = Math.floor(s / 2);
  for (let L = 2; f > 0; L++) {
    const a = Math.ceil(f / (L + 1));
    rows.push({ L, f, a });
    f -= a;
  }
  return rows;
}

/** T(s): rounds of a hypothetical Tchoukaillon graph, counting H1 as round 1. */
export function tchoukaillonRounds(s: number): number {
  if (s === 0) return 0;
  return 1 + schedule(s).length;
}

/** Ч_n by the nested ceilings of exercise 11(c): run the schedule backwards from f_n = 1. */
export function tchoukaillonNumber(n: number): number {
  let l = 1;
  for (let k = n - 1; k >= 1; k--) l = Math.ceil(((k + 1) * l) / k);
  return l;
}

/**
 * Tchoukaillon solitaire (exercise 11): the unique winning position with s stones.
 * Returns pits p[1..] (p[0] is the store), built by undoing winning moves.
 */
export function winningPosition(s: number): number[] {
  const p = [0];
  for (let stones = 0; stones < s; stones++) {
    // The winning strategy always plays the smallest k with p_k = k; undoing it
    // from a position means: find the smallest empty pit k, take one stone from
    // each of pits 0..k-1, and put k stones in pit k.
    let k = 1;
    while (k < p.length && p[k] !== 0) k++;
    if (k === p.length) p.push(0);
    for (let j = 1; j < k; j++) p[j]--;
    p[k] = k;
  }
  return p;
}
