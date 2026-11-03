#!/usr/bin/env python3
"""Check every computational statement of the report, with a pass/fail summary.

    python verify.py               # every check, in about 15 seconds
    python verify.py --full        # the full ranges quoted in the report (numpy)
    python verify.py --only knuth16 catalog
    python verify.py --list        # the checks and the statements they support

The proofs in the report do not depend on these checks; they make the
examples checkable and catch mistakes. Every run of Algorithm H below is
made by both simulators, which must produce identical records, and its
final matching is certified maximum independently (see checked_run).
"""
from __future__ import annotations

import argparse
import itertools
import random
import sys
import time
from collections.abc import Callable

import examples
from algorithm_h import run_h
from augmenting import (augment, augmenting_paths, basic_paths, count_components, is_matching,
                        maximum_matching, path_census, sap_level_and_nu)
from examples import max_rounds, quarter_square, tchoukaillon_schedule
from independent_audit import audit_h


class CheckFailed(Exception):
    pass


def require(condition: bool, message: str) -> None:
    """Like assert, but not removed by python -O."""
    if not condition:
        raise CheckFailed(message)


# ----------------------------------------------------------------------------
# Running and certifying

def first_difference(a: object, b: object, where: str = '') -> str:
    """A path to the first place where two records differ."""
    if isinstance(a, dict) and isinstance(b, dict):
        for key in list(a) + [k for k in b if k not in a]:
            if a.get(key) != b.get(key):
                return first_difference(a.get(key), b.get(key), f'{where}[{key!r}]')
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for k, (x, y) in enumerate(zip(a, b)):
            if x != y:
                return first_difference(x, y, f'{where}[{k}]')
    return f'{where}: {a!r} != {b!r}'


def checked_run(adj: list[list[int]], n: int | None = None) -> dict:
    """Run both simulators and check what any correct run must satisfy.

    * algorithm_h.run_h and independent_audit.audit_h give identical records;
    * the final matching is a matching of the graph and has the size found by
      augmenting.maximum_matching, which shares nothing with Algorithm H;
    * the final search certifies maximality by itself (Koenig's theorem): the boys it
      reached, with the girls it did not reach, cover every edge, and there
      are s of them;
    * levels increase from round to round (exercise 5), and each round
      removes one free girl per SAP.
    """
    run = run_h(adj, n)
    audit = audit_h(adj, n)
    require(run == audit, 'simulators disagree at ' + first_difference(run, audit))
    n = run['N']
    require(is_matching(adj, run['final_matching'], n), 'final matching is not a matching')
    maximum = sum(1 for b in maximum_matching(adj, n) if b)
    require(run['s'] == maximum, f"matching of size {run['s']}, maximum is {maximum}")
    reached_girls = set(run['final_bfs']['reached_girls'])
    reached_boys = set(run['final_bfs']['reached_boys'])
    require(all(b in reached_boys for g in reached_girls for b in adj[g - 1]),
            'final search: an edge is not covered')
    require(len(reached_boys) + run['M'] - len(reached_girls) == run['s'],
            'final search: cover and matching differ in size')
    levels = [rd['L'] for rd in run['rounds']]
    require(levels == sorted(set(levels)), f'levels do not increase: {levels}')
    require(all(rd['f_before'] - rd['f_after'] == len(rd['saps']) > 0 for rd in run['rounds']),
            'a round does not remove one free girl per SAP')
    return run


def round_table(run: dict) -> list[tuple[int, int, int, int, int, int]]:
    """(L, f, SAPs, w5, w13, w11) for each round, as in the report's tables."""
    return [(rd['L'], rd['f_before'], len(rd['saps']), rd['w5'], rd['w13'], rd['w11'])
            for rd in run['rounds']]


def schedule_of(run: dict) -> list[tuple[int, int, int]]:
    """(L, f, SAPs) for each round, comparable with tchoukaillon_schedule."""
    return [(rd['L'], rd['f_before'], len(rd['saps'])) for rd in run['rounds']]


def couples(sap: dict) -> list[tuple[int, int]]:
    """The new couples (g, b) of a SAP, in path order."""
    return list(zip(sap['girls'], sap['boys']))


def max_degree(adj: list[list[int]]) -> int:
    """The largest degree of a girl or a boy."""
    boy_degree: dict[int, int] = {}
    for row in adj:
        for b in row:
            boy_degree[b] = boy_degree.get(b, 0) + 1
    return max([len(row) for row in adj] + list(boy_degree.values()), default=0)


def check_abstract_sequence(adj: list[list[int]], matching: list[int],
                            paths: list[tuple[tuple[int, ...], tuple[int, ...]]]) -> list[dict]:
    """Check that each path is a SAP when its turn comes, and that after
    augmenting along it no SAP of the same level remains. Returns the census
    of all augmenting paths before each augmentation."""
    censuses = []
    for girls, boys in paths:
        census = path_census(adj, matching)
        censuses.append(census)
        require((girls, boys) in set(augmenting_paths(adj, matching)),
                f'{girls}/{boys} is not augmenting')
        require(len(boys) == min(census), f'{girls}/{boys} is not a shortest augmenting path')
        matching = augment(matching, (girls, boys))
        later = path_census(adj, matching)
        require(not later or min(later) > len(boys), 'a SAP of the same level remains')
    return censuses


# ----------------------------------------------------------------------------
# Section 2.4 and 5.2: the 9-pair example Gamma_5

GAMMA5_LISTS = [[6, 8], [4, 6], [1, 4], [1], [1, 2], [2, 3], [4, 2, 5], [6, 5, 7], [8, 9]]

# The table of Section 5.2: L, f, SAPs, w5, w13, w11, and the SAP as couples.
GAMMA5_TABLE = [
    ((2, 4, 1, 17, 5, 8), [(1, 6), (8, 5)]),
    ((3, 3, 1, 19, 8, 9), [(2, 4), (7, 2), (6, 3)]),
    ((4, 2, 1, 17, 8, 8), [(3, 1), (5, 2), (7, 5), (8, 7)]),
    ((5, 1, 1, 9, 5, 5), [(4, 1), (3, 4), (2, 6), (1, 8), (9, 9)]),
]


def check_gamma5(options: argparse.Namespace) -> str:
    adj = examples.staircase(5)
    require(adj == GAMMA5_LISTS, 'Gamma_5 differs from the lists (2.2)')
    run = checked_run(adj)
    require(run['h1_queue'] == [4, 3, 2, 1], 'H1 queue')
    require([run['h1_matching'][g - 1] for g in (9, 8, 7, 6, 5)] == [8, 6, 4, 2, 1],
            'H1 couples')
    require(run['h1_examined'] == 12, 'H1 examined')
    first = run['rounds'][0]
    require(first['blink'][1] == [3, 4], 'BLINK[1] in the first dag')
    level1 = first['marked'][:4]
    require(level1 == [1, 4, 6, 8], 'B_1 and its order')
    require([first['matching_before'].index(b) + 1 for b in level1] == [5, 7, 8, 9], 'G_1')
    require(first['marked'][4] == 2 and first['roots'] == [5, 7, 9], 'B_2 and the roots')
    require(first['queue_after'] == [4, 3, 2], 'queue after the first dag round')
    require([(row, couples(rd['saps'][0])) for row, rd in zip(round_table(run), run['rounds'])]
            == GAMMA5_TABLE, 'the table of Section 5.2')
    require((run['num_rounds'], run['w5'], run['w13'], run['w11']) == (5, 62, 26, 30), 'totals')
    return '5 rounds; dag, BLINK, roots and table as printed'


# ----------------------------------------------------------------------------
# Section 3.3 and Appendix A: Knuth's sixteen-pair graph

# Appendix A: girl number -> (logical girl, list).
KNUTH16_INPUT = {1: (5, [3, 5]), 2: (11, [9, 11]), 3: (15, [15]), 4: (9, [7, 9]),
                 5: (13, [13]), 6: (7, [3, 7]), 7: (3, [3]), 8: (1, [1]),
                 9: (2, [1, 2]), 10: (4, [3, 2, 4]), 11: (6, [5, 4, 6]), 12: (8, [7, 5, 8]),
                 13: (10, [9, 6, 8, 10]), 14: (12, [11, 10, 12]), 15: (14, [13, 14]),
                 16: (16, [15, 14, 16])}

# Appendix A, the run: L, f, SAPs, w5, w13, w11, and the SAPs as couples
# (logical girl, boy); then the free girls before each round, logically.
KNUTH16_TABLE = [
    ((2, 8, 3, 35, 16, 16), [[(5, 3), (4, 2)], [(11, 9), (10, 8)], [(15, 15), (16, 14)]]),
    ((3, 5, 2, 34, 14, 15), [[(9, 7), (8, 5), (6, 4)], [(13, 13), (14, 14), (16, 16)]]),
    ((4, 3, 1, 28, 10, 12), [[(7, 3), (5, 5), (8, 8), (10, 6)]]),
    ((5, 2, 1, 25, 6, 12), [[(3, 3), (7, 7), (9, 9), (11, 11), (12, 10)]]),
    ((6, 1, 1, 24, 6, 12), [[(1, 1), (2, 2), (4, 4), (6, 6), (10, 10), (12, 12)]]),
]
KNUTH16_QUEUES = [[1, 3, 7, 13, 9, 15, 11, 5], [1, 3, 7, 13, 9], [1, 3, 7], [1, 3], [1]]

# Appendix A: numbers of augmenting paths of each level before each round.
KNUTH16_CENSUS = [{2: 22, 3: 4}, {3: 16, 5: 6}, {4: 7, 6: 12, 8: 8},
                  {5: 3, 7: 4, 9: 4, 11: 2}, {6: 1}]


def check_knuth16(options: argparse.Namespace) -> str:
    adj = examples.knuth16()
    logical = examples.knuth16_logical_girl
    number = {logical(g): g for g in range(1, 17)}
    require({g: (logical(g), adj[g - 1]) for g in range(1, 17)} == KNUTH16_INPUT,
            'the input table of Appendix A')
    require(adj == examples.load_catalog()[16], 'the catalog entry for s = 16')
    require(sum(map(len, adj)) == 35 and all(k in adj[number[k] - 1] for k in range(1, 17)),
            'edges g_k b_k, E = 35')
    run = checked_run(adj)
    require(all(run['h1_matching'][number[2 * j] - 1] == 2 * j - 1 for j in range(1, 9)),
            'H1 couples b_(2j-1) g_2j')
    require(run['h1_examined'] == 20, 'H1 examined')
    for rd, (row, saps), queue, census, matrix in zip(
            run['rounds'], KNUTH16_TABLE, KNUTH16_QUEUES, KNUTH16_CENSUS,
            examples.KNUTH16_MATRICES):
        L = rd['L']
        require(round_table(run)[L - 2] == row, f'round at L={L}: counts')
        found = [[(logical(g), b) for g, b in couples(sap)] for sap in rd['saps']]
        require(found == saps, f'round at L={L}: SAPs')
        require([logical(g) for g in rd['queue_before']] == queue, f'round at L={L}: queue')
        require(path_census(adj, rd['matching_before']) == census, f'round at L={L}: census')
        perfect = [logical(g) for g in range(1, 17)]
        rows = basic_paths(rd['matching_before'], perfect, 16).values()
        require(sorted([logical(g) for g in row] for row in rows) == sorted(matrix),
                f'round at L={L}: basic paths are not the rows of the matrix')
        require(sap_level_and_nu(adj, rd['matching_before']) == (L, rd['f_before']),
                f'round at L={L}: property B (nu = f)')
    require(run['final_matching'] == [logical(g) for g in range(1, 17)],
            'final matching g_k b_k')
    require(schedule_of(run) == tchoukaillon_schedule(16), 'the schedule for s = 16')
    # The paths pi_2 and pi_3 of (3.3), after H1.
    pi2 = ((number[7], number[8]), (7, 8))
    pi3 = ((number[7], number[8], number[6]), (7, 5, 4))
    after_h1 = set(augmenting_paths(adj, run['h1_matching']))
    require(pi2 in after_h1 and pi3 in after_h1, 'pi_2 and pi_3 after H1')
    return 'input, run, queues, matrices, census, nu = f, pi_2 and pi_3 as printed'


# ----------------------------------------------------------------------------
# Sections 3.2 and 6: Tchoukaillon numbers against quarter-squares

CH_TABLE = [1, 2, 4, 6, 10, 12, 18, 22, 30, 34, 42, 48, 58, 60]
Q_TABLE = [1, 2, 4, 6, 9, 12, 16, 20, 25, 30, 36, 42, 49, 56]
TIE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14]
EQUAL_SIZES = (set(range(9)) | set(range(10, 16)) | {18, 19, 22, 23, 24, 34, 35, 48}
               | {60, 61, 62, 63})

# Above this limit Ch_n is computed with numpy; pure Python would be too slow.
PURE_PYTHON_LIMIT = 5000


def tchoukaillon_numbers(limit: int) -> list[int]:
    """[0, Ch_1, ..., Ch_limit] by the nested ceilings of exercise 11(c).

    All targets n are evaluated at once, innermost ceiling first: after the
    pass for k, entry n > k holds ceil((k+1)/k ceil(... ceil(n/(n-1)))).
    That is quadratic in limit, so large limits use numpy (the only use of
    numpy in this repository).
    """
    if limit > PURE_PYTHON_LIMIT:
        import numpy as np
        values = np.zeros(limit + 1, dtype=np.int64)
        for k in range(limit - 1, 0, -1):
            values[k + 1] = 1
            values[k + 1:] = -((-(k + 1) * values[k + 1:]) // k)
        values[1] = 1
        return [int(v) for v in values]
    values = [0] * (limit + 1)
    for k in range(limit - 1, 0, -1):
        values[k + 1] = 1
        values[k + 1:] = [-(-(k + 1) * v // k) for v in values[k + 1:]]
    values[1] = 1
    return values


def check_tchoukaillon(options: argparse.Namespace) -> str:
    limit = options.ch_limit
    try:
        ch = tchoukaillon_numbers(limit)
    except ImportError:
        raise CheckFailed(f'--ch-limit above {PURE_PYTHON_LIMIT} needs numpy') from None
    require(ch[1:15] == CH_TABLE, 'Ch_1..Ch_14 (Section 3.2)')
    require([quarter_square(n) for n in range(1, 15)] == Q_TABLE, 'Q_1..Q_14 (Section 6)')
    require(all(ch[n] == examples.tchoukaillon_number(n) for n in range(1, min(limit, 300) + 1)),
            'the two evaluations of Ch_n disagree')
    require(all(quarter_square(n) <= ch[n] for n in range(1, limit + 1)), 'Q_n <= Ch_n')
    ties = [n for n in range(1, limit) if ch[n] < quarter_square(n + 1)]
    require(ties == TIE_LEVELS, f'levels with Ch_n < Q_(n+1): {ties}')
    # Equation (3.2): T(s) = n exactly when Ch_n <= s < Ch_(n+1).
    for n in range(1, min(limit, 60)):
        require(all(examples.tchoukaillon_rounds(s) == n for s in range(ch[n], ch[n + 1])),
                f'T(s) != {n} for some s in [Ch_n, Ch_(n+1))')
    equal = {s for s in range(2000) if max_rounds(s) == examples.tchoukaillon_rounds(s)}
    require(equal == EQUAL_SIZES, 'the sizes s < 2000 with R(s) = T(s) (Section 6)')
    require(all(max_rounds(s) >= examples.tchoukaillon_rounds(s) for s in range(2000)),
            'R(s) >= T(s)')
    how = 'numpy' if limit > PURE_PYTHON_LIMIT else 'pure Python'
    return f'Ch_n for n <= {limit} ({how}); tie levels {TIE_LEVELS}'


# ----------------------------------------------------------------------------
# Section 5: staircase graphs

def staircase_hooks(n: int, f: int) -> list[list[tuple[int, int]]]:
    """Hooks 1..f of state f, following the definition in Section 5.3 word for word."""
    lengths = examples.staircase_row_lengths(n)
    corner = (n - 1, 2)
    hooks = []
    for x in range(1, f + 1):
        c = f + 1 - x                                   # the corner column
        if lengths[x - 1] < c:
            cells = [(x, j) for j in range(1, lengths[x - 1] + 1)]
        else:
            cells = [(x, j) for j in range(1, c + 1)]
            a = x + 1
            while a <= n - 1 and c <= lengths[a - 1] and (a, c) != corner:
                cells.append((a, c))
                a += 1
            if x == f:
                cells.append(corner)
        hooks.append(cells)
    return hooks


def theorem_w(n: int, f: int) -> tuple[int, int, int]:
    """(w5, w13, w11) of the round with f free girls (Theorem W)."""
    L = n + 1 - f
    m = min(f, L + 1)
    return 3 * f * L - n - min(f, L), m * L - (m - 1) * (m - 2) // 2, f * L


def theorem_w_totals(n: int) -> tuple[int, int, int]:
    """The sums of w5, w13, w11 over all rounds after H1 (Theorem W)."""
    u = n // 2
    if n % 2:
        w13 = (4 * u ** 3 + 21 * u * u + 23 * u - 6) // 6
    else:
        w13 = (4 * u ** 3 + 15 * u * u + 5 * u - 12) // 6
    return ((n - 1) * n * (n + 2) // 2 - quarter_square(n) + 1, w13,
            (n - 1) * n * (n + 4) // 6)


def check_staircase_run(n: int, census: bool, nu: bool) -> None:
    """Gamma_n: Proposition 5.1, Lemmas 5.3-5.6, Theorems S and W; with census,
    Proposition 5.7 (2^m - 1 SAPs); with nu, nu = m (Section 5.6)."""
    adj = examples.staircase(n)
    girl_cells, boy_cells = examples.staircase_cells(n)
    s = len(adj)
    girl_at = {cell: g for g, cell in enumerate(girl_cells, 1)}
    boy_at = {cell: b for b, cell in enumerate(boy_cells, 1)}
    inside = [boy_at[cell] for cell in girl_cells]
    corner = (n - 1, 2)
    require(s == quarter_square(n), f'n={n}: s != Q_n')
    require(sum(map(len, adj)) == 3 * s - n - (n + 1) // 2, f'n={n}: E')
    require(max_degree(adj) <= 3 and count_components(adj) == 1,
            f'n={n}: not connected of maximum degree 3')
    run = checked_run(adj)
    require(run['h1_examined'] == s + n - 2, f'n={n}: H1 examined')
    require(run['num_rounds'] == n, f'n={n}: Theorem S, number of rounds')
    require(run['final_matching'] == inside, f'n={n}: final matching is not the inside edges')
    require(run['final_bfs']['w5'] == 0, f'n={n}: the final search examines an edge')
    for rd in run['rounds']:
        f, L = rd['f_before'], rd['L']
        k = max(1, f - L)
        where = f'n={n}, f={f}'
        require(L == n + 1 - f and len(rd['saps']) == 1, f'{where}: level or SAPs')
        # Lemma 5.3: the basic paths are the hooks, the queue lists
        # them in hook order, and retired cells are coupled to themselves.
        hooks = staircase_hooks(n, f)
        rows = basic_paths(rd['matching_before'], inside, s)
        require([[girl_cells[g - 1] for g in rows[g0]] for g0 in rd['queue_before']] == hooks,
                f'{where}: the basic paths are not the hooks in queue order')
        alive = {cell for hook in hooks for cell in hook}
        require(alive == {cell for cell in girl_cells if cell[1] <= f} | {corner},
                f'{where}: alive cells')
        require(all(rd['matching_before'][g - 1] == inside[g - 1]
                    for g, cell in enumerate(girl_cells, 1) if cell not in alive),
                f'{where}: a retired cell is not coupled to itself')
        for x, hook in enumerate(hooks, 1):
            require(len(hook) == max(examples.staircase_row_lengths(n)[x - 1], L),
                    f'{where}: length of hook {x}')
            for y, (a, c) in enumerate(hook, 1):
                expected = (f, L) if (a, c) == corner else (min(a, f + 1 - c),
                                                            c + max(0, a + c - f - 1))
                require((x, y) == expected, f'{where}: position of cell {(a, c)}')
        # Lemma 5.5: levels in hook order, BLINK lists, roots.
        def girl(x: int, y: int) -> int:
            return girl_at[hooks[x - 1][y - 1]]

        def boy(x: int, y: int) -> int:
            return boy_at[hooks[x - 1][y - 1]]

        require(rd['marked'] == [boy(x, y) for y in range(1, L + 1) for x in range(1, f + 1)],
                f'{where}: MARKED order')
        require(rd['roots'] == [boy(x, L) for x in range(k, f + 1)], f'{where}: roots')
        for x in range(1, f + 1):
            for y in range(1, L + 1):
                expected = [girl(x + 1, y), girl(x, y)] if x + y <= f else [girl(x, y)]
                require(rd['blink'][boy(x, y)] == expected, f'{where}: BLINK of <{x},{y}>')
        # Lemma 5.6: the staircase SAP, ending at the last free girl.
        sap = dict(girls=[girl(max(k, f - y + 1), y) for y in range(1, L + 1)],
                   boys=[boy(max(k, f - y), y) for y in range(1, L + 1)])
        require(rd['saps'] == [sap], f'{where}: the SAP')
        require(rd['queue_after'] == rd['queue_before'][:-1], f'{where}: queue after H16')
        require((rd['w5'], rd['w13'], rd['w11']) == theorem_w(n, f), f'{where}: Theorem W')
        m = min(f, L + 1)
        if census:
            paths = path_census(adj, rd['matching_before'])
            require(min(paths) == L and paths[L] == 2 ** m - 1, f'{where}: 2^m - 1 SAPs')
        if nu:
            require(sap_level_and_nu(adj, rd['matching_before']) == (L, m), f'{where}: nu = m')
    require((run['w5'], run['w13'], run['w11']) == theorem_w_totals(n), f'n={n}: totals')


def check_staircase(options: argparse.Namespace) -> str:
    sizes = list(range(2, 61)) + [81, 129]
    for n in sizes:
        check_staircase_run(n, census=n <= 9, nu=n <= 30)
    return (f'n = 2..60, 81, 129 (s up to {quarter_square(129)}); '
            'SAP census for n <= 9, nu by max flow for n <= 30')


def check_every_size(options: argparse.Namespace) -> str:
    # Padding (Section 5.5): every s gets R(s) rounds, and each round runs
    # exactly as on Gamma_n.
    sizes = set(range(101))
    for n in (21, 33, 51):
        sizes |= {quarter_square(n), quarter_square(n) + 1, quarter_square(n + 1) - 1}
    gamma_runs: dict[int, dict] = {}
    for s in sorted(sizes):
        adj = examples.staircase_padded(s)
        run = checked_run(adj, s)
        require(run['num_rounds'] == max_rounds(s), f's={s}: R(s) rounds')
        if s < 2:
            continue
        n = max_rounds(s)
        padding = s - quarter_square(n)
        if n not in gamma_runs:
            gamma_runs[n] = run_h(examples.staircase(n))
        gamma = gamma_runs[n]
        require(round_table(run) == round_table(gamma), f's={s}: rounds differ from Gamma_{n}')
        require(run['E'] == gamma['E'] + 2 * padding
                and run['h1_examined'] == gamma['h1_examined'] + padding, f's={s}: E or H1')
        require(max_degree(adj) <= 3 and count_components(adj) == 1,
                f's={s}: not connected of maximum degree 3')
    # Section 5.1: with the vertical edge into the corner, still n rounds of one SAP.
    for n in range(2, 31):
        run = checked_run(examples.staircase(n, corner_edge=True))
        require(run['num_rounds'] == n and all(len(rd['saps']) == 1 for rd in run['rounds']),
                f'n={n}: corner edge changes the rounds')
    return f'{len(sizes)} padded sizes up to {max(sizes)}; corner-edge variant for n <= 30'


# ----------------------------------------------------------------------------
# Section 7 and Appendix B: halving graphs and literal realizations

HALVING_LISTS = {1: [[1], [1, 2]],
                 2: [[1, 3], [3], [1, 2], [3, 4]],
                 4: [[5, 7], [1, 3], [3, 7], [7], [1, 2], [3, 4], [5, 6], [7, 8]]}


def check_halving(options: argparse.Namespace) -> str:
    for f, lists in HALVING_LISTS.items():
        require(examples.halving(f) == lists, f'f={f}: the lists of Appendix B')
    for t in range(8):
        f = 1 << t
        adj = examples.halving(f)
        girl_number, _ = examples.halving_numbers(f)
        u_index = {girl_number['u', i]: i for i in range(1, f + 1)}
        run = checked_run(adj)
        where = f'f={f}'
        require((run['s'], run['E'], run['h1_examined']) == (2 * f, 4 * f - 1, 3 * f - 1),
                f'{where}: s, E, H1')
        require(run['num_rounds'] == t + 2, f'{where}: rounds')
        for r, rd in enumerate(run['rounds']):
            free = f >> r
            require((rd['L'], rd['f_before'], len(rd['saps'])) == (r + 2, free, max(1, free // 2)),
                    f'{where}, r={r}: level, f, SAPs')
            require((rd['w5'], rd['w13'], rd['w11'])
                    == (2 * free * (r + 2) - 1, free * (r + 2), free * (r + 2)),
                    f'{where}, r={r}: work counts')
            require(sorted(u_index[g] for g in rd['queue_before'])
                    == list(range(1 << r, f + 1, 1 << r)), f'{where}, r={r}: free girls')
            kept = len(rd['queue_after'])
            require(rd['queue_after'] == rd['queue_before'][:kept]
                    and all(examples.ruler(u_index[g]) == r for g in rd['queue_before'][kept:]),
                    f'{where}, r={r}: H16 removes the end of the queue')
            if f <= 32:
                # Property U, in the stronger form recorded by the old checks:
                # 2f'-1 augmenting paths, all of level r+2.
                census = path_census(adj, rd['matching_before'])
                require(census == {r + 2: 2 * free - 1}, f'{where}, r={r}: census {census}')
        require((run['w5'], run['w13'], run['w11']) == (12 * f - 3 * t - 9, 6 * f - t - 4,
                                                        6 * f - t - 4), f'{where}: totals')
    # Corollary L. Only if: after the first round, Theorem U needs f <= 2 ceil(f/3).
    allowed = {s for s in range(1, 1000)
               if s // 2 - -(-(s // 2) // 3) == 0 or s // 2 <= 2 * -(-(s // 2) // 3)}
    require(allowed == {1, 2, 3, 4, 5, 8, 9}, 'Corollary L: the arithmetic')
    for s in (0, 1, 2, 3, 4, 5, 8, 9):
        adj = examples.literal_realization(s)
        run = checked_run(adj)
        require(len(run['h1_queue']) == s // 2 and schedule_of(run) == tchoukaillon_schedule(s),
                f'literal s={s}: schedule')
        require(all(len(path_census(adj, rd['matching_before'])) == 1 for rd in run['rounds']),
                f'literal s={s}: property U')
    return 'f = 1..128, census for f <= 32; Corollary L for s in {1,2,3,4,5,8,9}'


# ----------------------------------------------------------------------------
# Section 8.1 and Appendix C: the catalog

# Appendix C: s, E, rounds, H1, w5, w13, w11, SAPs removed at levels 2, 3, ...
CATALOG_TABLE = [
    (2, 3, 2, 2, 3, 2, 2, [1]),
    (4, 7, 3, 5, 12, 7, 7, [1, 1]),
    (6, 12, 4, 7, 34, 14, 18, [1, 1, 1]),
    (8, 15, 4, 9, 37, 16, 20, [2, 1, 1]),
    (10, 21, 5, 13, 67, 29, 33, [2, 1, 1, 1]),
    (12, 28, 6, 16, 133, 46, 60, [2, 1, 1, 1, 1]),
    (14, 31, 6, 19, 123, 49, 56, [3, 1, 1, 1, 1]),
    (16, 35, 6, 20, 146, 52, 67, [3, 2, 1, 1, 1]),
    (18, 43, 7, 25, 212, 77, 93, [3, 2, 1, 1, 1, 1]),
    (20, 46, 7, 27, 223, 78, 97, [4, 2, 1, 1, 1, 1]),
    (22, 55, 8, 30, 367, 109, 148, [4, 2, 1, 1, 1, 1, 1]),
    (24, 60, 8, 34, 378, 117, 156, [4, 2, 2, 1, 1, 1, 1]),
    (26, 63, 8, 39, 362, 118, 149, [5, 2, 2, 1, 1, 1, 1]),
    (28, 67, 8, 39, 363, 121, 150, [5, 3, 2, 1, 1, 1, 1]),
    (30, 77, 9, 45, 515, 164, 208, [5, 3, 2, 1, 1, 1, 1, 1]),
    (32, 79, 9, 47, 542, 164, 221, [6, 3, 2, 1, 1, 1, 1, 1]),
    (34, 91, 10, 55, 709, 214, 270, [6, 3, 2, 1, 1, 1, 1, 1, 1]),
    (36, 97, 10, 56, 748, 224, 285, [6, 3, 2, 2, 1, 1, 1, 1, 1]),
    (38, 100, 10, 58, 779, 220, 299, [7, 3, 2, 2, 1, 1, 1, 1, 1]),
    (40, 104, 10, 61, 716, 225, 272, [7, 4, 2, 2, 1, 1, 1, 1, 1]),
]


def check_catalog(options: argparse.Namespace) -> str:
    catalog = examples.load_catalog()
    require(sorted(catalog) == list(range(2, 41, 2)), 'catalog sizes')
    for s in range(42):
        adj = examples.catalog_realization(s)
        run = checked_run(adj, s)
        require(run['M'] == run['s'] == s, f's={s}: not perfect')
        require(schedule_of(run) == tchoukaillon_schedule(s), f's={s}: not the schedule')
        require(len(run['h1_queue']) == s // 2, f's={s}: H1')
    for s, E, rounds, h1, w5, w13, w11, saps in CATALOG_TABLE:
        h = s // 2
        adj = catalog[s]
        run = run_h(adj)
        require((run['E'], run['num_rounds'], run['h1_examined'], run['w5'], run['w13'],
                 run['w11']) == (E, rounds, h1, w5, w13, w11), f's={s}: the table row')
        require([len(rd['saps']) for rd in run['rounds']] == saps, f's={s}: SAPs removed')
        require(run['h1_queue'] == list(range(h, 0, -1))
                and all(run['h1_matching'][h + j - 1] == 2 * j - 1 for j in range(1, h + 1)),
                f's={s}: H1 matching g_(h+j) b_(2j-1)')
        # Theorem C: E >= 3h + 4 a_2 - 8p - a_3.
        a2 = -(-h // 3)
        a3 = -(-(h - a2) // 4)
        require(E >= 3 * h + 4 * a2 - 8 * (3 * a2 - h) - a3, f's={s}: Theorem C')
    return 's = 0..41 replayed; table of Appendix C; Theorem C inequality'


def check_basic_rows(options: argparse.Namespace) -> str:
    rounds = 0
    for s, adj in examples.load_catalog().items():
        for rd in run_h(adj)['rounds']:
            L, nu = sap_level_and_nu(adj, rd['matching_before'])
            require(L == rd['L'], f's={s}: max-flow level {L} != {rd["L"]}')
            require(nu == rd['f_before'], f's={s}, L={L}: nu = {nu} < f = {rd["f_before"]}')
            rounds += 1
    return f'nu = f in all {rounds} rounds of the 20 catalog entries'


def check_search(options: argparse.Namespace) -> str:
    # search.py is not the earlier program of Section 8.1, but it does what
    # that section describes. It must find realizations for small s quickly,
    # and whatever it has stored must replay correctly.
    import json
    import search

    def require_realization(adj: list[list[int]], s: int, what: str) -> None:
        run = checked_run(adj, s)
        require(run['M'] == run['s'] == s, f'{what}: not perfect')
        require(len(run['h1_queue']) == s // 2, f'{what}: H1 leaves the wrong number free')
        require(schedule_of(run) == tchoukaillon_schedule(s), f'{what}: not the schedule')
        require(all(sap_level_and_nu(adj, rd['matching_before']) == (rd['L'], rd['f_before'])
                    for rd in run['rounds']), f'{what}: not basic-row')
        h = s // 2
        a2 = -(-h // 3)
        a3 = -(-(h - a2) // 4)
        require(run['E'] >= 3 * h + 4 * a2 - 8 * (3 * a2 - h) - a3, f'{what}: Theorem C')

    began = time.perf_counter()
    for s in range(2, 13, 2):
        finder = search.SizeSearch(s, random.Random(f'{search.DEFAULT_SEED}-{s}'),
                                   time.perf_counter() + 10)
        adj = finder.find()
        require(adj is not None, f's={s}: search.py found nothing within 10 s')
        require_realization(adj, s, f'search s={s}')
    seconds = time.perf_counter() - began
    stored = 0
    if search.RESULTS_PATH.exists():
        results = json.loads(search.RESULTS_PATH.read_text(encoding='utf8'))
        for s, entry in results.items():
            require_realization(entry['adjacency'], int(s), f'search_results.json s={s}')
            stored += 1
    return (f'search.py found s = 2..12 in {seconds:.1f}s; '
            f'{stored} stored results replayed, all basic-row')


# ----------------------------------------------------------------------------
# Section 8.2: the 8-pair tree

TREE8_TABLE = [(2, 4, 2, 15, 7, 8), (3, 2, 1, 11, 3, 5), (4, 1, 1, 7, 4, 4)]

# Section 8.2: the augmenting paths after the round at level 2.
TREE8_PATHS = {((4, 5, 7), (1, 2, 6)), ((3, 2, 1, 8), (3, 5, 7, 8)),
               ((4, 5, 7, 1, 8), (1, 2, 5, 7, 8))}


def check_tree8(options: argparse.Namespace) -> str:
    adj = examples.tree8()
    require(sum(map(len, adj)) == 15 and count_components(adj) == 1, 'not a tree with 15 edges')
    run = checked_run(adj)
    require(run['h1_queue'] == [4, 3, 2, 1], 'H1 queue')
    require(round_table(run) == TREE8_TABLE, 'the table of Section 8.2')
    require(schedule_of(run) == tchoukaillon_schedule(8), 'the schedule for s = 8')
    second = run['rounds'][1]
    require(sorted(second['queue_before']) == [3, 4], 'free girls after round 2')
    require(set(augmenting_paths(adj, second['matching_before'])) == TREE8_PATHS,
            'the three augmenting paths')
    require(sap_level_and_nu(adj, second['matching_before']) == (3, 1), 'nu = 1 < f = 2')
    return 'run, the three augmenting paths, nu = 1 < f = 2'


# ----------------------------------------------------------------------------
# Section 8.5: ordering obstructions

SIX_PAIR_START = [0, 1, 0, 3, 0, 5]                     # b1 g2, b3 g4, b5 g6
SIX_PAIR_SAPS = [((5, 4), (3, 2)), ((1, 2, 6), (1, 5, 6)), ((3, 5, 2, 4), (3, 5, 2, 4))]
SIX_PAIR_TARGET = [(2, 3, 1), (3, 2, 1), (4, 1, 1)]     # the schedule for s = 6


def maximal_matchings(adj: list[list[int]]) -> list[set[tuple[int, int]]]:
    """All maximal matchings of a small graph, by brute force over edge sets."""
    edges = [(g, b) for g, row in enumerate(adj, 1) for b in row]
    found = []
    for size in range(len(edges) + 1):
        for chosen in itertools.combinations(edges, size):
            girls = {g for g, _ in chosen}
            boys = {b for _, b in chosen}
            if len(girls) == len(boys) == size and all(g in girls or b in boys
                                                       for g, b in edges):
                found.append(set(chosen))
    return found


def check_six_pair(options: argparse.Namespace) -> str:
    adj = examples.SIX_PAIR_NEIGHBOURS
    three = [mm for mm in maximal_matchings(adj) if len(mm) == 3]
    require(three == [{(2, 1), (4, 3), (6, 5)}], 'the maximal matching with three couples')
    check_abstract_sequence(adj, SIX_PAIR_START, SIX_PAIR_SAPS)
    if options.exhaustive:
        inputs = examples.six_pair_inputs()
    else:
        rng = random.Random(20261103)
        inputs = (examples.six_pair(tuple(rng.sample(range(1, 7), 6)),
                                    tuple(tuple(rng.sample(row, len(row))) for row in adj))
                  for _ in range(5000))
    total = minimum_h1 = 0
    for ordered in inputs:
        run = run_h(ordered, 6)
        total += 1
        if len(run['h1_queue']) == 3:
            minimum_h1 += 1
            require(schedule_of(run) != SIX_PAIR_TARGET, f'{ordered} follows the schedule')
    if options.exhaustive:
        require((total, minimum_h1) == (103680, 740), f'{total} inputs, {minimum_h1} minimum')
    scope = 'all' if options.exhaustive else 'a random sample of'
    return (f'abstract schedule consistent; {scope} {total} inputs, {minimum_h1} with a '
            'three-couple H1, none follows it')


# Section 8.5: Delta_6 from x1 v1, x2 v3, x3 v2, with u_i = g_i, v_i = b_i,
# x_j = g_(3+j), z_j = b_(3+j); and the census before each of its three SAPs.
CHAIN_START = [0, 0, 0, 1, 3, 2]
CHAIN_SAPS = [((3, 6), (2, 4)), ((1, 4, 6), (1, 4, 5)), ((2, 3, 5, 6), (2, 3, 5, 6))]
CHAIN_CENSUS = [{2: 11, 3: 25, 4: 25}, {3: 7, 4: 13, 5: 11}, {4: 1}]


def random_chain_input(h: int, rng: random.Random) -> list[list[int]]:
    """Delta_2h with a random input under which H1 leaves h girls free: the
    girls x_j are scanned first, and each lists a different boy v first."""
    pi = rng.sample(range(1, h + 1), h)
    x_numbers = rng.sample(range(h + 1, 2 * h + 1), h)
    u_numbers = rng.sample(range(1, h + 1), h)
    adj: list[list[int]] = [[] for _ in range(2 * h)]
    for i in range(1, h + 1):
        adj[u_numbers[i - 1] - 1] = rng.sample(range(1, i + 1), i)
    for j in range(1, h + 1):
        rest = [b for b in range(1, h + j + 1) if b != pi[j - 1]]
        adj[x_numbers[j - 1] - 1] = [pi[j - 1]] + rng.sample(rest, len(rest))
    return adj


def check_chain(options: argparse.Namespace) -> str:
    run = checked_run(examples.triangular_chain(3))
    require([(rd['L'], len(rd['saps']), rd['w5'], rd['w13']) for rd in run['rounds']]
            == [(2, 2, 21, 6), (3, 1, 16, 3)], 'the run on Delta_6')
    censuses = check_abstract_sequence(examples.triangular_chain(3), CHAIN_START, CHAIN_SAPS)
    require(censuses == CHAIN_CENSUS, 'census of the abstract states')
    rng = random.Random(20261103)
    tried = 0
    for h in range(1, 7):
        for _ in range(300):
            run = run_h(random_chain_input(h, rng))
            require(len(run['h1_queue']) == h, 'H1 does not leave h girls free')
            require(3 * len(run['rounds'][0]['saps']) > h, f'h={h}: 3a <= h')
            tried += 1
    return f'Delta_6 run and abstract SAPs; 3a > h on {tried} random inputs, h <= 6'


# ----------------------------------------------------------------------------
# Section 9: the caterpillar trees and the cycles

def check_caterpillar(options: argparse.Namespace) -> str:
    require(examples.caterpillar(4) == [[1], [1, 2, 3], [3], [3, 4], [4, 5, 6], [6], [6, 7],
                                        [7, 8], [8, 9]], 'the lists for K = 4')
    parameters = list(range(2, 17)) + [32]
    for K in parameters:
        adj = examples.caterpillar(K)
        s = K * (K + 1) // 2 - 1
        run = checked_run(adj)
        require((run['M'], run['s'], run['E']) == (s, s, 2 * s - 1), f'K={K}: s, E')
        require(count_components(adj) == 1 and max_degree(adj) <= 3,
                f'K={K}: not a tree of maximum degree 3')
        require(run['num_rounds'] == K and run['h1_examined'] == s, f'K={K}: rounds, H1')
        for j, rd in zip(range(2, K + 1), run['rounds']):
            require(round_table(run)[j - 2] == (j, K - j + 1, 1, (2 * j - 1) * (K - j + 1)
                                                + (j < K), j, j * (K - j + 1)),
                    f'K={K}, j={j}: round')
        require((run['w5'], run['w13'], run['w11'])
                == (K * (K - 1) * (2 * K + 5) // 6 + K - 2, s, K * (K - 1) * (K + 4) // 6),
                f'K={K}: totals')
        # The remark ending Section 9: disjoint cycles with s = K^2 - 1.
        adj = examples.cycles(K)
        run = checked_run(adj)
        s = K * K - 1
        require((run['s'], run['E'], max_degree(adj)) == (s, 2 * s, 2), f'cycles K={K}: s, E')
        require(run['num_rounds'] == K and run['h1_examined'] == K * K + K - 2,
                f'cycles K={K}: rounds, H1')
        for j, rd in zip(range(2, K + 1), run['rounds']):
            require(round_table(run)[j - 2] == (j, K - j + 1, 1, (4 * j - 2) * (K - j + 1), j,
                                                2 * j * (K - j + 1) - 1),
                    f'cycles K={K}, j={j}: round')
        require((run['w5'], run['w13'], run['w11'])
                == (K * (K - 1) * (2 * K + 5) // 3, K * (K + 1) // 2 - 1,
                    (K - 1) * (K * K + 4 * K - 3) // 3), f'cycles K={K}: totals')
    return 'caterpillars and cycles for K = 2..16 and 32'


# ----------------------------------------------------------------------------
# Appendix D: the simulators themselves

def check_simulators(options: argparse.Namespace) -> str:
    rng = random.Random(20261103)
    graphs: list[tuple[list[list[int]], int]] = [([], 0), ([[], [], []], 5)]
    for _ in range(500):
        m, n = rng.randrange(4, 13), rng.randrange(4, 13)
        density = rng.random()
        adj = []
        for _ in range(m):
            row = [b for b in range(1, n + 1) if rng.random() < density]
            rng.shuffle(row)
            adj.append(row)
        graphs.append((adj, n))
    for adj, n in graphs:
        run = checked_run(adj, n)
        require(run['num_rounds'] <= max_rounds(run['s']), 'more than R(s) rounds')
    return f'{len(graphs)} random ordered graphs: identical records, maximum matchings'


def check_maximum(options: argparse.Namespace) -> str:
    count = 0
    for m in range(4):
        for n in range(4):
            for mask in range(1 << (m * n)):
                adj = [[b + 1 for b in range(n) if mask >> (g * n + b) & 1] for g in range(m)]
                run = checked_run(adj, n)
                for rd in run['rounds']:
                    require(min(path_census(adj, rd['matching_before'], n)) == rd['L'],
                            f'{adj}: L is not the level of the shortest augmenting paths')
                require(not path_census(adj, run['final_matching'], n), f'{adj}: not maximum')
                require(run['num_rounds'] <= max_rounds(run['s']), 'more than R(s) rounds')
                count += 1
    return f'all {count} simple graphs with M, N <= 3: L and maximality by exhaustive search'


# ----------------------------------------------------------------------------

CHECKS: dict[str, tuple[Callable[[argparse.Namespace], str], str]] = {
    'gamma5': (check_gamma5, 'Sec. 2.4, 5.2: the worked 9-pair example'),
    'knuth16': (check_knuth16, 'Sec. 3.3, 7.1, App. A: Knuth\'s graph with its input'),
    'tchoukaillon': (check_tchoukaillon, 'Sec. 3.2, 6: Ch_n against Q_n, R(s) against T(s)'),
    'staircase': (check_staircase, 'Prop. and Lemmas of Sec. 5, Theorems S and W'),
    'every-size': (check_every_size, 'Theorem R attained for every s; Sec. 5.1 corner edge'),
    'halving': (check_halving, 'Sec. 7.2, App. B, Corollary L'),
    'catalog': (check_catalog, 'Sec. 8.1, App. C, Theorem C on the catalog'),
    'basic-rows': (check_basic_rows, 'Sec. 8.1: every catalog entry is basic-row'),
    'search': (check_search, 'Sec. 8.1: search.py works; data/search_results.json replays'),
    'tree8': (check_tree8, 'Sec. 8.2: an operational realization that is not basic-row'),
    'six-pair': (check_six_pair, 'Sec. 8.5: the six-pair ordering obstruction'),
    'chain': (check_chain, 'Sec. 8.5: triangular chain graphs'),
    'caterpillar': (check_caterpillar, 'Sec. 9: caterpillar trees and cycles'),
    'simulators': (check_simulators, 'App. D: the two simulators agree on random inputs'),
    'maximum': (check_maximum, 'App. D: runs checked against exhaustive path search'),
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Check every computational statement of the report.')
    parser.add_argument('--only', nargs='+', choices=list(CHECKS), metavar='CHECK',
                        help='run only these checks (see --list)')
    parser.add_argument('--list', action='store_true', help='list the checks and exit')
    parser.add_argument('--exhaustive', action='store_true',
                        help='six-pair: all 103680 inputs instead of a sample of 5000')
    parser.add_argument('--ch-limit', type=int, default=2000, metavar='N',
                        help='compute Ch_n for n <= N (default 2000; the report uses 100000)')
    parser.add_argument('--full', action='store_true',
                        help='the ranges quoted in the report: --exhaustive --ch-limit 100000'
                             ' (needs numpy)')
    options = parser.parse_args()
    if options.full:
        options.exhaustive = True
        options.ch_limit = max(options.ch_limit, 100000)
    if options.list:
        for name, (_, statement) in CHECKS.items():
            print(f'{name:<13} {statement}')
        return

    failures = 0
    start = time.perf_counter()
    for name in options.only or list(CHECKS):
        function, statement = CHECKS[name]
        began = time.perf_counter()
        try:
            detail = function(options)
            status = 'PASS'
        except Exception as failure:
            # A KeyError or IndexError from a malformed record is a failure too.
            detail = str(failure) if isinstance(failure, CheckFailed) else repr(failure)
            status = 'FAIL'
            failures += 1
        print(f'{status}  {name:<13} {time.perf_counter() - began:6.1f}s  {statement}\n'
              f'{"":21}{detail}', flush=True)
    total = len(options.only or CHECKS)
    print(f'{total - failures} of {total} checks passed in {time.perf_counter() - start:.1f}s')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
