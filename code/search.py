#!/usr/bin/env python3
"""Search for ordered graphs on which Algorithm H follows the Tchoukaillon schedule.

    python search.py 40            # every even s = 2, 4, ..., 40
    python search.py 30 46         # every even s with 30 <= s <= 46
    python search.py 40 --seed 7 --time-limit 300

For each even s = 2h the program looks for an ordered graph with
s = M = N whose run of Algorithm H (algorithm_h.run_h) realizes the
Tchoukaillon schedule (3.1): step H1 leaves h girls free, and the round at
each level L = 2, 3, ... removes exactly a_L = ceil(f_L/(L+1)) SAPs, until
no girl is free. Every graph it reports is replayed from H1, by run_h and
by independent_audit.audit_h, which must agree; the replay must follow the
schedule exactly and end with a perfect matching, and the basic-row
property (nu = f in every round, Section 3.4) is computed by the max flow
of augmenting.sap_level_and_nu. The graphs are written to
data/search_results.json, in the format of data/numerical_witnesses.json
plus some numbers of the run; the stored catalog itself is never touched.
Odd sizes are not searched: by Proposition 8.1 a realization for 2h gives
one for 2h + 1, by adding an isolated pair numbered last.

This is not the program that found the catalog of Appendix C, which is
not included here. The search here was written afresh, finds different
graphs, and is described below.

Rows and splicing (Sections 3.3 and 8.3)
----------------------------------------
Fix a perfect matching P. Relative to P, each free girl of the current
matching starts a basic path, and we write these paths as the rows of
Knuth's matrices (answer 15(d), Fig. 3.1): cell c of a row is the c-th
pair of P on the path. In a basic-row run every row has exactly L cells
before the round at level L, and the girl of cell c lies at level c - 1
of the dag, its boy at level c (proof of Lemma 3.1(a)). A SAP of that
round is then described by the rows sigma_1, ..., sigma_(L+1) it passes
through: its j-th edge joins the girl of cell j of row sigma_j to the boy
of cell j of row sigma_(j+1), and its j-th couple is the old couple of
row sigma_(j+1) between cells j and j+1. If the SAP visits the rows
R_1, ..., R_k in consecutive blocks, leaving R_i after column c_i
(1 <= c_1 < ... < c_(k-1) <= L), it needs the k - 1 "jump" edges

    girl(R_i, c_i) - boy(R_(i+1), c_i),        i = 1, ..., k-1,

and augmenting along it turns the k rows into the k - 1 rows

    R_i[1..c_(i-1)] + R_(i-1)[c_(i-1)..L],     i = 2, ..., k,

of L + 1 cells, while the other L + 1 - k pairs become couples of P and
leave the matrix. So if the f_L rows are split into a_L groups of at most
L + 1 rows, with one SAP per group, the next round again sees f_(L+1)
rows of L + 1 cells, all of them SAPs. This is how Knuth's 16-pair graph
works, and every graph found here is basic-row for the same reason. Such
a graph has the 3h edges of the start (below), f_(L+1) jump edges for each
level L, and the reordering edges described below.

The starting graph
------------------
The search starts from the normal form of Proposition 8.2 and Appendix C:
girl h + j lists [b_(2j-1), b_(2j)], so that H1 matches her with b_(2j-1)
and leaves girls h, h-1, ..., 1 free, in that QUEUE order; free girl pi(j)
lists only b_(2j-1); and P pairs pi(j) with b_(2j-1) and g_(h+j) with
b_(2j), for a random permutation pi. Its h rows of two cells are disjoint,
so Algorithm H would remove all of them in one round.

Designing a round
-----------------
The rounds are designed one level at a time. For the round at level L the
program runs Algorithm H on the current graph and reads off the rows, the
order in which the breadth-first search processes the girls, and the
order of the roots. It then forms the groups one at a time:

* A group ends with the row whose root (its free boy) comes first in
  MARKED order among the rows not yet grouped. Step H11 starts a
  depth-first search from every root in turn, and a root of an untouched
  row would simply find that row.
* The group is extended backwards, row by row, by a random depth-first
  search over the possible rows R_i and cut columns c_i. Each jump edge
  girl(R_i, c) - boy(R_(i+1), c) goes at the END of the girl's list, and
  girl(R_i, c) must be processed after girl(R_(i+1), c). The boy is then
  discovered before the new entry is examined, so the breadth-first
  search visits everything in the same order as before, and head
  insertion in step H6 puts the new girl first in BLINK[b] (preferably
  also ahead of every other girl of her level with an arc to b): the
  depth-first search of step H13 takes the jump before anything else.
* If girl(R_i, c) comes first instead, a "reordering" edge
  girl(R_i, d) - boy(R_(i+1), d) at an earlier column d is added too,
  inserted just before her own boy in her list. She then discovers
  R_(i+1)'s boy of column d before her own, so from column d + 1 on row
  R_(i+1) is processed just before row R_i, and the jump at column c
  works as above. The search keeps track of these moves and checks that
  they spoil no other link of the group.
* No edge may join a girl free after H1 to a boy free after H1: H1 would
  match them (Prop. 8.2(a)). Every other new edge comes after the girl's
  H1 mate in her list, so H1 is unchanged.

These rules make the intended SAP likely, not certain. An edge added for
this round also exists in every earlier round, where it usually becomes
an arc of the dag (most often of the first one) and can give a search
that ought to fail a way to an unused free girl; and edges of earlier
rounds can divert this round's searches. So every proposal is checked by
rerunning the whole execution from H1, as in the search described in
Section 8.1: a group is kept only if H1 and all earlier rounds find
exactly the SAPs they found before, and the current round finds the SAPs
planned so far, in order. The next group is designed from that rerun.
Because most failures come from a single bad edge, each candidate edge is
first tried alone (one rerun, remembered), and edges that disturb the run
are never proposed. A round with a single group is searched nearly
exhaustively, since its few rows leave little choice and nothing else
can absorb a failure.

The search over levels is depth first: up to `--tries` designs of a round
are tried before backing up a level, and when the whole tree fails the
search restarts with a new permutation pi, until `--time-limit` seconds
have passed for that size. All random choices come from random.Random
seeded by the string f"{seed}-{s}", so a size found within its time limit
is found again, identically, on any machine.

What it does and does not show
------------------------------
With the default settings the search finds every even s <= 46 on a laptop,
in about 16 s for s <= 40 and under a minute for each of 42, 44, 46 (these
are the stored results, written by `python search.py 46`); it
also finds 54 and 56, but not 48, 50, 52, 58 or 60 within 120 s each. The
hardest sizes are those where a level has a single group of exactly L + 1
rows (s = 34 at L = 5; s = 48, 50, 52 at L = 6): then all cuts are forced
(c_i = i), and the edges needed are often among those that disturb an
earlier round. A size not found is only that; it says nothing about
whether a realization exists.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from collections import deque
from collections.abc import Callable
from pathlib import Path

from algorithm_h import run_h
from augmenting import basic_paths, sap_level_and_nu
from examples import tchoukaillon_schedule
from independent_audit import audit_h

RESULTS_PATH = Path(__file__).resolve().parent / 'data' / 'search_results.json'
DEFAULT_SEED = 20261103

# The random depth-first search that builds one group examines at most
# BUDGET partial groups (and candidate edges), and at most BRANCHING
# alternatives at each step; a round with a single group gets 20 times the
# budget and no limit on branching.
BUDGET = 300
BRANCHING = 4

Row = list[int]              # the girls of a basic path, one per cell
Edge = tuple[int, int]       # (girl, boy)
# An edge to add: (girl, boy, before). It goes at the end of the girl's
# list if before is None, and just before the boy `before` otherwise.
Insertion = tuple[int, int, int | None]
# A move (y, x, d): from column d + 1 on, row y is processed just before row x.
Move = tuple[Row, Row, int]


class OutOfTime(Exception):
    """Raised inside the backtracking search when the time limit is reached."""


# ----------------------------------------------------------------------------
# The starting graph and the rows

def normal_form(h: int, rng: random.Random) -> tuple[list[list[int]], list[int]]:
    """The starting graph for s = 2h, and the perfect matching P.

    Returns (adj, perfect), where perfect[g-1] is the mate of girl g in P.
    Girl h + j lists b_(2j-1) first, so that H1 gives her that boy; the free
    girl pi(j) lists only b_(2j-1), her partner in P.
    """
    pi = list(range(1, h + 1))
    rng.shuffle(pi)
    adj: list[list[int]] = [[] for _ in range(2 * h)]
    perfect = [0] * (2 * h)
    for j in range(1, h + 1):
        adj[pi[j - 1] - 1] = [2 * j - 1]
        adj[h + j - 1] = [2 * j - 1, 2 * j]
        perfect[pi[j - 1] - 1] = 2 * j - 1
        perfect[h + j - 1] = 2 * j
    return adj, perfect


def rows_of(matching: list[int], perfect: list[int]) -> list[Row]:
    """The basic paths of matching relative to P, as lists of girls."""
    return list(basic_paths(matching, perfect, len(perfect)).values())


def follows_schedule(run: dict, schedule: list[tuple[int, int, int]], upto: int,
                     perfect: list[int], h1_matching: list[int]) -> bool:
    """True if the run's H1 and its rounds 0..upto (record indices) follow the
    schedule, and each of those rounds leaves rows of L + 1 cells relative to P.

    Rows of L + 1 cells are disjoint augmenting paths, and after the round at
    level L none is shorter (Algorithm H has removed every shorter one), so
    they are SAPs of the next round and nu = f there: property B.
    """
    if run['h1_matching'] != h1_matching or len(run['rounds']) <= upto:
        return False
    for k in range(upto + 1):
        rd = run['rounds'][k]
        L, f, a = schedule[k]
        if (rd['L'], rd['f_before'], len(rd['saps'])) != (L, f, a):
            return False
        if any(len(row) != L + 1 for row in rows_of(rd['matching_after'], perfect)):
            return False
    return True


# ----------------------------------------------------------------------------
# What a round's breadth-first search looks like

def bfs_levels(adj: list[list[int]], matching: list[int]) -> tuple[dict[int, int], dict[int, int]]:
    """The levels of the girls and boys in the breadth-first search of steps H2-H10.

    Free girls have level 0, a boy first reached from a girl of level l has
    level l + 1, and so has his mate. Unlike the dag, this search does not
    stop at the level of the first free boy.
    """
    bmate = {b: g for g, b in enumerate(matching, 1) if b}
    girl_level = {g: 0 for g in range(1, len(adj) + 1) if matching[g - 1] == 0}
    boy_level: dict[int, int] = {}
    todo = deque(girl_level)
    while todo:
        g = todo.popleft()
        for b in adj[g - 1]:
            if b in boy_level or b == matching[g - 1]:
                continue
            boy_level[b] = girl_level[g] + 1
            if b in bmate and bmate[b] not in girl_level:
                girl_level[bmate[b]] = girl_level[g] + 1
                todo.append(bmate[b])
    return girl_level, boy_level


def makes_arc(edge: Edge, levels: tuple[dict[int, int], dict[int, int]], L: int,
              free_boys: set[int]) -> bool:
    """Would the edge g - b become an arc of a dag with these levels and level L?

    It does if g is at some level l < L and b is not reachable at a level
    <= l: then step H6 or H8 enters the arc g -> b (and if b's level was
    larger, the edge even shortens his distance). A matched boy at level L
    is never a root, so an arc to him is harmless and is not counted.
    """
    g, b = edge
    girl_level, boy_level = levels
    if g not in girl_level or girl_level[g] >= L:
        return False
    if boy_level.get(b, L + 1) <= girl_level[g]:
        return False
    return girl_level[g] + 1 < L or b in free_boys


def processing_order(rd: dict) -> dict[int, int]:
    """The position of each girl in QUEUE during the round's breadth-first search.

    Step H9 appends the mate of each newly marked boy, so QUEUE is the old
    queue followed by the mates of the matched boys in MARKED order. (The
    girls queued for level L are discarded later; they are never compared.)
    """
    bmate = {b: g for g, b in enumerate(rd['matching_before'], 1) if b}
    order = list(rd['queue_before']) + [bmate[b] for b in rd['marked'] if b in bmate]
    return {g: k for k, g in enumerate(order)}


def group_sizes(f: int, a: int, L: int, rng: random.Random) -> list[int]:
    """A random list of a group sizes, each between 1 and L + 1, summing to f."""
    sizes = [L + 1] * a
    for _ in range(a * (L + 1) - f):
        i = rng.choice([k for k, size in enumerate(sizes) if size > 1])
        sizes[i] -= 1
    return sizes


def with_edges(adj: list[list[int]], edges: list[Insertion]) -> list[list[int]]:
    """A copy of adj with the given edges inserted."""
    new = [list(row) for row in adj]
    for g, b, before in edges:
        row = new[g - 1]
        row.insert(len(row) if before is None else row.index(before), b)
    return new


# ----------------------------------------------------------------------------
# The search for one size

class SizeSearch:
    """The search for one even size s = 2h; see the module docstring.

    It holds what is fixed for the whole search (the schedule, the H1
    matching of the normal form, the random generator, the deadline and the
    limits) and the perfect matching P of the current restart. `tries`
    bounds the designs of one round before the search backs up a level;
    `group_tries` bounds the proposals for one group before a design is
    abandoned.
    """

    def __init__(self, s: int, rng: random.Random, deadline: float,
                 tries: int = 6, group_tries: int = 20) -> None:
        if s < 2 or s % 2:
            raise ValueError('only even s >= 2 are searched (odd s: Prop. 8.1)')
        self.s, self.h = s, s // 2
        self.schedule = tchoukaillon_schedule(s)
        self.h1_matching = [0] * self.h + [2 * j - 1 for j in range(1, self.h + 1)]
        self.h1_free_girls = set(range(1, self.h + 1))
        self.h1_free_boys = set(range(2, s + 1, 2))
        self.rng, self.deadline = rng, deadline
        self.tries, self.group_tries = tries, group_tries
        self.perfect: list[int] = []
        self.restarts = 0
        self.runs = 0                  # calls of run_h

    def run(self, adj: list[list[int]]) -> dict:
        """run_h on adj, counted, with the time limit enforced."""
        if time.perf_counter() > self.deadline:
            raise OutOfTime
        self.runs += 1
        return run_h(adj)

    def find(self) -> list[list[int]] | None:
        """Restart with a fresh permutation pi until a realization is found,
        or return None when the time is up."""
        try:
            while True:
                self.restarts += 1
                adj, self.perfect = normal_form(self.h, self.rng)
                found = self.extend(adj, 0)
                if found is not None:
                    return found
        except OutOfTime:
            return None

    def extend(self, adj: list[list[int]], k: int) -> list[list[int]] | None:
        """Design round k (record index, level k + 2) and all later rounds.

        adj follows the schedule up to round k - 1. This is the depth-first
        search over the levels: up to `tries` designs of round k are made,
        and each one that works is extended recursively.
        """
        if k == len(self.schedule):
            return adj
        run = self.run(adj)
        L, f, a = self.schedule[k]
        if a == f:
            # f = 1: the single row is the single SAP, and no edge is needed.
            ok = follows_schedule(run, self.schedule, k, self.perfect, self.h1_matching)
            return self.extend(adj, k + 1) if ok else None
        # What design_round learns about single edges and rejected groups
        # concerns adj itself, so the designs of round k share it.
        harmless: dict[Insertion, bool] = {}
        rejected: set[tuple[Insertion, ...]] = set()
        for _ in range(self.tries):
            candidate = self.design_round(adj, run, k, harmless, rejected)
            if candidate is None:
                if a == 1:
                    break                 # its search was exhaustive
                continue
            if follows_schedule(self.run(candidate), self.schedule, k, self.perfect,
                                self.h1_matching):
                found = self.extend(candidate, k + 1)
                if found is not None:
                    return found
        return None

    def unchanged_until(self, rerun: dict, run: dict, k: int, saps: list[dict]) -> bool:
        """True if rerun does what run did in H1 and rounds 0..k-1, and its
        round k begins by finding the SAPs `saps`, in this order."""
        return (rerun['h1_matching'] == self.h1_matching
                and len(rerun['rounds']) > k
                and all(rerun['rounds'][j]['saps'] == run['rounds'][j]['saps']
                        for j in range(k))
                and rerun['rounds'][k]['saps'][:len(saps)] == saps)

    def design_round(self, adj: list[list[int]], run: dict, k: int,
                     harmless: dict[Insertion, bool],
                     rejected: set[tuple[Insertion, ...]]) -> list[list[int]] | None:
        """adj plus edges that make round k remove exactly a_L SAPs, or None.

        run is the run of Algorithm H on adj; before its round k the rows
        (relative to P) all have L cells. The groups are designed one at a
        time, in the order of their roots, and each is checked at once by a
        complete rerun: H1 and the earlier rounds must do exactly what they
        did before, and round k must find the SAPs planned so far, in order.
        The next group is designed from that rerun, so that it sees the
        search orders as changed by the edges already added. `harmless` and
        `rejected` remember single edges tested and groups that failed on
        adj itself.
        """
        L, f, a = self.schedule[k]
        rows = rows_of(run['rounds'][k]['matching_before'], self.perfect)
        # The dags of the earlier rounds, which a new edge should leave
        # alone if possible: an extra arc there may divert an earlier search.
        earlier = []
        for old in run['rounds'][:k]:
            free_boys = set(range(1, run['N'] + 1)) - set(old['matching_before'])
            earlier.append((bfs_levels(adj, old['matching_before']), old['L'], free_boys))
        work, current, planned = adj, run, []
        used: set[int] = set()            # free girls of the rows already grouped

        def safe(edge: Insertion) -> bool:
            """Does this one edge, added to work, leave H1, the earlier rounds
            and the SAPs already planned in this round alone? Most proposals
            that fail do so because one of their edges diverts the search of
            an earlier round, and one remembered rerun per edge finds those
            edges cheaply."""
            if edge not in harmless:
                harmless[edge] = self.unchanged_until(self.run(with_edges(work, [edge])),
                                                      run, k, planned)
            return harmless[edge]

        for size in group_sizes(f, a, L, self.rng):
            for _ in range(self.group_tries):
                proposal = self.propose_group(work, current['rounds'][k], rows, size, used,
                                              earlier, safe, rejected, exhaustive=(a == 1))
                if proposal is None:
                    if a == 1:
                        return None       # the search was exhaustive
                    continue
                group, sap, edges = proposal
                if not edges:
                    break                 # a group of one row: the row itself
                trial = with_edges(work, edges)
                rerun = self.run(trial)
                if self.unchanged_until(rerun, run, k, planned + [sap]):
                    work, current = trial, rerun
                    harmless, rejected = {}, set()    # both are relative to work
                    break
                rejected.add(tuple(edges))
            else:
                return None
            planned.append(sap)
            used.update(row[0] for row in group)
        return work

    def propose_group(self, adj: list[list[int]], rd: dict, rows: list[Row], size: int,
                      used: set[int], earlier: list, safe: Callable[[Insertion], bool],
                      rejected: set[tuple[Insertion, ...]], exhaustive: bool
                      ) -> tuple[list[Row], dict, list[Insertion]] | None:
        """A group of `size` rows not yet used, its planned SAP, and its new edges.

        rd is the record of the round on the graph adj. The group ends with
        the first row not yet used in root order, and is extended backwards
        by a random depth-first search that tries the safest links first
        (see link_options) and skips edges that `safe` rejects and groups in
        `rejected`. Returns None if no group is found within the budget.
        """
        perfect, rng, L = self.perfect, self.rng, rd['L']
        position = processing_order(rd)
        girl_level, _ = bfs_levels(adj, rd['matching_before'])
        girls_of_boy: dict[int, list[int]] = {}
        for g, adjacent in enumerate(adj, 1):
            for b in adjacent:
                girls_of_boy.setdefault(b, []).append(g)

        def girl(row: Row, c: int) -> int:
            return row[c - 1]

        def boy(row: Row, c: int) -> int:
            return perfect[row[c - 1] - 1]

        # The rows in the order in which their girls of column c are processed.
        base_order = {c: sorted(rows, key=lambda row: position[girl(row, c)])
                      for c in range(1, L + 1)}

        def order(c: int, moves: list[Move]) -> dict[int, int]:
            """The rank of each row (keyed by its free girl) at column c, after
            the moves made by the reordering edges planned so far."""
            ranked = list(base_order[c])
            for y, x, d in moves:
                if c > d:
                    ranked.remove(y)
                    ranked.insert(ranked.index(x), y)
            return {row[0]: r for r, row in enumerate(ranked)}

        def allowed(g: int, b: int, planned: list[Insertion]) -> bool:
            """May the edge g - b be added at all?"""
            if g in self.h1_free_girls and b in self.h1_free_boys:
                return False      # H1 would match them (Prop. 8.2(a))
            return b not in adj[g - 1] and all((g, b) != (x, y) for x, y, _ in planned)

        def first_to_reach(g: int, b: int, c: int) -> bool:
            """Is g processed before every girl of level c - 1 adjacent to b?"""
            return all(position[g] < position[x] for x in girls_of_boy.get(b, [])
                       if girl_level.get(x) == c - 1)

        def last_to_reach(g: int, b: int, c: int) -> bool:
            """Is g processed after every girl of level c - 1 adjacent to b, so
            that head insertion will put her first in BLINK[b]?"""
            return all(position[g] > position[x] for x in girls_of_boy.get(b, [])
                       if girl_level.get(x) == c - 1)

        def risky(g: int, b: int) -> bool:
            return any(makes_arc((g, b), *old) for old in earlier)

        root_order = {b: r for r, b in enumerate(rd['roots'])}
        pending = sorted((row for row in rows if row[0] not in used),
                         key=lambda row: root_order[boy(row, L)])
        end = pending[0]

        def consistent(group: list[Row], cuts: list[int], moves: list[Move]) -> bool:
            """Does every link of the group still have its source processed
            after its target, and is the group's end still the first root?"""
            for i, c in enumerate(cuts):
                rank = order(c, moves)
                if rank[group[i][0]] < rank[group[i + 1][0]]:
                    return False
            rank = order(L, moves)
            return all(rank[end[0]] < rank[row[0]] for row in pending if row is not end)

        def link_options(group: list[Row], cuts: list[int], moves: list[Move],
                         edges: list[Insertion], need: int) -> list[tuple]:
            """The ways to put one more row R_i in front of group = [R_(i+1), ...]:
            (rank, tiebreak, c, row, reorder), lowest rank first. The rank is 0
            for a jump that will head its BLINK list and adds no arc to an
            earlier dag; +1 if it adds such an arc, +2 if it may not head the
            list, +4 (+1) if it needs a reordering edge (that adds an arc)."""
            target, upper = group[0], (cuts[0] if cuts else L + 1)
            options = []
            for c in range(need, upper):          # c >= need leaves room for the rest
                rank_c = order(c, moves)
                b = boy(target, c)
                for row in pending:
                    if row in group:
                        continue
                    g = girl(row, c)
                    if not allowed(g, b, edges):
                        continue
                    rank = 2 * (not last_to_reach(g, b, c)) + risky(g, b)
                    if rank_c[row[0]] > rank_c[target[0]]:
                        options.append((rank, rng.random(), c, row, None))
                        continue
                    # The source comes first at column c: let the target overtake
                    # it from some earlier column d on, by an edge from the
                    # source's girl to the target's boy placed before her own boy.
                    for d in range(1, c):
                        rank_d = order(d, moves)
                        g2, b2 = girl(row, d), boy(target, d)
                        if (rank_d[row[0]] < rank_d[target[0]] and allowed(g2, b2, edges)
                                and first_to_reach(g2, b2, d)):
                            options.append((rank + 4 + risky(g2, b2), rng.random(), c, row,
                                            (g2, b2, perfect[g2 - 1], d)))
            options.sort(key=lambda option: option[:2])
            return options

        # A round with a single group has few rows and nothing else to absorb
        # a failure, so it is searched (nearly) exhaustively.
        budget = [BUDGET * (20 if exhaustive else 1)]
        branching = None if exhaustive else BRANCHING

        def chain(group: list[Row], cuts: list[int], moves: list[Move],
                  edges: list[Insertion], need: int) -> tuple | None:
            """Prepend `need` more rows to group = [R_i, ..., R_k], whose cut
            columns are cuts = [c_i, ..., c_(k-1)]."""
            if need == 0:
                return None if tuple(edges) in rejected else (group, cuts, edges)
            budget[0] -= 1
            if budget[0] < 0:
                return None
            tried = 0
            for _, _, c, row, reorder in link_options(group, cuts, moves, edges, need):
                new_moves, new_edges = moves, edges + [(girl(row, c), boy(group[0], c), None)]
                if reorder is not None:
                    g2, b2, before, d = reorder
                    new_moves = moves + [(group[0], row, d)]
                    new_edges = new_edges + [(g2, b2, before)]
                if not consistent([row] + group, [c] + cuts, new_moves):
                    continue
                budget[0] -= len(new_edges) - len(edges)
                if budget[0] < 0:
                    return None
                if not all(safe(edge) for edge in new_edges[len(edges):]):
                    continue
                found = chain([row] + group, [c] + cuts, new_moves, new_edges, need - 1)
                if found is not None:
                    return found
                tried += 1
                if tried == branching:
                    break
            return None

        found = chain([end], [], [], [], size - 1)
        if found is None:
            return None
        group, cuts, edges = found
        sigma: list[Row] = []                     # sigma[j-1]: the row of column j's girl
        for i, row in enumerate(group):
            sigma += [row] * ((cuts[i] if i < len(cuts) else L + 1) - len(sigma))
        sap = dict(girls=[girl(sigma[j - 1], j) for j in range(1, L + 1)],
                   boys=[boy(sigma[j], j) for j in range(1, L + 1)])
        return group, sap, edges


# ----------------------------------------------------------------------------
# Checking a result from scratch, and the command line

def check_realization(adj: list[list[int]], s: int) -> dict:
    """Replay adj from H1 and report what the search claims about it.

    Both simulators must give identical records (else AssertionError). The
    result has the keys follows (the schedule exactly, H1 leaving s/2 girls
    free, and a perfect final matching with M = N = s), basic_row (nu = f
    in every round, by max flow), and the numbers E, rounds, saps,
    h1_examined, w5, w13, w11 of the run.
    """
    run = run_h(adj, s)
    if run != audit_h(adj, s):
        raise AssertionError(f's={s}: the two simulators disagree')
    schedule = [(rd['L'], rd['f_before'], len(rd['saps'])) for rd in run['rounds']]
    perfect = run['M'] == run['N'] == run['s'] == s and all(run['final_matching'])
    follows = (perfect and len(run['h1_queue']) == s // 2
               and schedule == tchoukaillon_schedule(s))
    basic_row = all(sap_level_and_nu(adj, rd['matching_before']) == (rd['L'], rd['f_before'])
                    for rd in run['rounds'])
    return dict(follows=follows, basic_row=basic_row, E=run['E'], rounds=run['num_rounds'],
                saps=[len(rd['saps']) for rd in run['rounds']], h1_examined=run['h1_examined'],
                w5=run['w5'], w13=run['w13'], w11=run['w11'])


def write_results(results: dict[str, dict], path: Path) -> None:
    """Write the results as JSON, with one girl's list per line."""
    entries = []
    for s, entry in results.items():
        lists = ',\n'.join(f'      {json.dumps(row)}' for row in entry['adjacency'])
        fields = [f'    "adjacency": [\n{lists}\n    ]']
        fields += [f'    {json.dumps(key)}: {json.dumps(value)}'
                   for key, value in entry.items() if key != 'adjacency']
        entries.append(f'  {json.dumps(s)}: {{\n' + ',\n'.join(fields) + '\n  }')
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf8', newline='\n') as file:
        file.write('{\n' + ',\n'.join(entries) + '\n}\n')


def sizes_from(arguments: list[int]) -> list[int]:
    """The even sizes named on the command line: MAX, or MIN MAX."""
    low, high = (2, arguments[0]) if len(arguments) == 1 else arguments
    return [s for s in range(max(low, 2), high + 1) if s % 2 == 0]


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Search for ordered graphs on which Algorithm H follows the Tchoukaillon '
                    'schedule, for even s. (Odd s need no search: add an isolated pair, '
                    'Prop. 8.1.) Results go to data/search_results.json.')
    parser.add_argument('sizes', type=int, nargs='+', metavar='S',
                        help='MAX to search every even s <= MAX, or MIN MAX')
    parser.add_argument('--seed', type=int, default=DEFAULT_SEED,
                        help=f'seed of the random choices (default {DEFAULT_SEED}); size s '
                             'uses random.Random(f"{seed}-{s}")')
    parser.add_argument('--time-limit', type=float, default=120.0, metavar='SECONDS',
                        help='give up on a size after this many seconds (default 120)')
    parser.add_argument('--tries', type=int, default=6,
                        help='designs of a round before backing up a level (default 6)')
    parser.add_argument('--group-tries', type=int, default=20,
                        help='proposals for one group before a design is abandoned (default 20)')
    parser.add_argument('--output', type=Path, default=RESULTS_PATH,
                        help='the JSON file to write (default data/search_results.json)')
    options = parser.parse_args()
    if len(options.sizes) > 2:
        parser.error('give MAX or MIN MAX')
    if options.output.name == 'numerical_witnesses.json':
        parser.error('refusing to overwrite the stored catalog')

    print('Odd s = 2h + 1 are not searched: add an isolated pair numbered last (Prop. 8.1).')
    print(f"{'s':>3} {'E':>4} {'rounds':>6} {'restarts':>8} {'reruns':>7} {'basic-row':>9} "
          f"{'seconds':>8}  SAPs removed at L = 2, 3, ...")
    results: dict[str, dict] = {}
    missing = []
    start = time.perf_counter()
    for s in sizes_from(options.sizes):
        began = time.perf_counter()
        search = SizeSearch(s, random.Random(f'{options.seed}-{s}'),
                            began + options.time_limit, options.tries, options.group_tries)
        adj = search.find()
        seconds = time.perf_counter() - began
        if adj is None:
            missing.append(s)
            print(f'{s:>3} {"-":>4} {"-":>6} {search.restarts:>8} {search.runs:>7} {"-":>9} '
                  f'{seconds:8.2f}  not found within the time limit', flush=True)
            continue
        check = check_realization(adj, s)
        if not check['follows']:
            raise AssertionError(f's={s}: the replay does not follow the schedule')
        results[str(s)] = dict(adjacency=adj, **{key: check[key] for key in (
            'E', 'rounds', 'saps', 'basic_row', 'h1_examined', 'w5', 'w13', 'w11')},
            seed=options.seed, restarts=search.restarts, reruns=search.runs)
        print(f"{s:>3} {check['E']:>4} {check['rounds']:>6} {search.restarts:>8} "
              f"{search.runs:>7} {'yes' if check['basic_row'] else 'no':>9} {seconds:8.2f}  "
              f"{','.join(map(str, check['saps']))}", flush=True)

    write_results(results, options.output)
    print(f'{len(results)} sizes found, {len(missing)} not found'
          + (f' ({", ".join(map(str, missing))})' if missing else '')
          + f'; {time.perf_counter() - start:.1f}s in all; written to {options.output}')
    sys.exit(1 if missing else 0)


if __name__ == '__main__':
    main()
