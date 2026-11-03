#!/usr/bin/env python3
"""Every named ordered graph of the report, and the Tchoukaillon schedule.

Each graph is returned as girl lists in the format of algorithm_h.py:
adj[g-1] lists the boys of girl g in GLINK/GNEXT order. Unless stated
otherwise M = N = s and every boy occurs, so N need not be given.

Running this file prints the girl lists of one example (see --help).
"""
from __future__ import annotations

import argparse
import itertools
import json
import math
from collections.abc import Callable, Iterator
from pathlib import Path

Cell = tuple[int, int]

CATALOG_PATH = Path(__file__).resolve().parent / 'data' / 'numerical_witnesses.json'


# ----------------------------------------------------------------------------
# The Tchoukaillon schedule and the two thresholds (Sections 3.2, 4, 6)

def tchoukaillon_schedule(s: int) -> list[tuple[int, int, int]]:
    """The schedule (3.1) as triples (L, f_L, a_L): level, free girls, SAPs removed."""
    if s < 0:
        raise ValueError('s must be nonnegative')
    out = []
    f, L = s // 2, 2
    while f:
        a = -(-f // (L + 1))
        out.append((L, f, a))
        f, L = f - a, L + 1
    return out


def tchoukaillon_rounds(s: int) -> int:
    """T(s), the number of rounds of the schedule, counting H1 as round 1."""
    return 0 if s == 0 else 1 + len(tchoukaillon_schedule(s))


def tchoukaillon_number(n: int) -> int:
    """Ch_n by the nested ceilings of exercise 11(c): ceil(2 ceil(3/2 ... ceil(n/(n-1))))."""
    value = 1
    for k in range(n - 1, 0, -1):
        value = -(-(k + 1) * value // k)
    return value


def quarter_square(n: int) -> int:
    """Q_n = floor((n+1)^2/4), the least s that allows n rounds (Theorem R)."""
    return (n + 1) ** 2 // 4


def max_rounds(s: int) -> int:
    """R(s) = floor(sqrt(4s+1)) - 1, the most rounds at size s (Theorem R)."""
    return math.isqrt(4 * s + 1) - 1


# ----------------------------------------------------------------------------
# Staircase graphs (Section 5)

def staircase_row_lengths(n: int) -> list[int]:
    """The number of cells l_a = max(2, floor((n+2-a)/2)) of rows a = 1..n-1."""
    return [max(2, (n + 2 - a) // 2) for a in range(1, n)]


def staircase_cells(n: int) -> tuple[list[Cell], list[Cell]]:
    """The cells (a, c) of the girls and of the boys of Gamma_n, indexed by number - 1.

    Boys are numbered in row-major order. The first girl of row a gets the
    number n-a; the other girls get n, n+1, ..., s in row-major order.
    """
    if n < 2:
        raise ValueError('staircase graphs need n >= 2')
    boy_cells = [(a, c) for a, length in enumerate(staircase_row_lengths(n), 1)
                 for c in range(1, length + 1)]
    girl_cells = [(n - x, 1) for x in range(1, n)]
    girl_cells += [cell for cell in boy_cells if cell[1] > 1]
    return girl_cells, boy_cells


def staircase(n: int, corner_edge: bool = False) -> list[list[int]]:
    """The ordered graph Gamma_n of Section 5.1, with s = Q_n.

    Each girl lists her left boy, then her upper boy, then her own boy. The
    vertical edge into the corner cell (n-1, 2) is omitted unless corner_edge
    is true (the variant mentioned in Section 5.1).
    """
    girl_cells, boy_cells = staircase_cells(n)
    boy_at = {cell: b for b, cell in enumerate(boy_cells, 1)}
    corner = (n - 1, 2)
    adj = []
    for a, c in girl_cells:
        row = []
        if c > 1:
            row.append(boy_at[a, c - 1])
        # Rows never get longer going down, so the cell above always exists.
        if a > 1 and (corner_edge or (a, c) != corner):
            row.append(boy_at[a - 1, c])
        row.append(boy_at[a, c])
        adj.append(row)
    return adj


def staircase_padded(s: int) -> list[list[int]]:
    """A graph of size s with R(s) rounds: Gamma_n padded as in Section 5.5 ("Every size").

    Each new girl lists her own new boy, then the previous boy; for the first
    new girl that is the corner boy, the last boy of Gamma_n.
    """
    if s < 0:
        raise ValueError('s must be nonnegative')
    if s < 2:
        return [[1]] if s else []
    adj = staircase(max_rounds(s))
    for g in range(len(adj) + 1, s + 1):
        adj.append([g, g - 1])
    return adj


# ----------------------------------------------------------------------------
# Knuth's sixteen-pair graph (Section 3.3, Appendix A)

# Knuth's logical girls, in the order in which they receive the numbers
# 16, 15, ..., 1. Boys keep their logical numbers.
KNUTH16_NUMBERING = [16, 14, 12, 10, 8, 6, 4, 2, 1, 3, 7, 13, 9, 15, 11, 5]

# The 19 edges (boy, logical girl) of (A.1) other than g_k b_k.
KNUTH16_EXTRA_EDGES = ([(b, b + 1) for b in range(1, 16, 2)]
                       + [(2, 4), (3, 5), (8, 10), (9, 11), (14, 16),
                          (4, 6), (5, 8), (7, 9), (6, 10), (3, 7), (10, 12)])


def knuth16_logical_girl(number: int) -> int:
    """Knuth's logical index of the girl whom Algorithm H sees as `number`."""
    return KNUTH16_NUMBERING[16 - number]


def knuth16() -> list[list[int]]:
    """The input of Appendix A: lists in increasing order of boys, except
    that an even logical girl g_k puts b_(k-1) first."""
    logical = {k: [k] for k in range(1, 17)}
    for b, k in KNUTH16_EXTRA_EDGES:
        logical[k].append(b)
    for k, row in logical.items():
        row.sort()
        if k % 2 == 0:
            row.remove(k - 1)
            row.insert(0, k - 1)
    return [logical[knuth16_logical_girl(g)] for g in range(1, 17)]


# The matrices of answer 15(d), drawn in Section 3.3: the basic paths before
# each round, as the logical indices of the pairs g_k b_k that they visit.
KNUTH16_MATRICES = [
    [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16]],
    [[1, 2, 4], [3, 5, 6], [7, 8, 10], [9, 11, 12], [13, 14, 16]],
    [[1, 2, 4, 6], [3, 5, 8, 10], [7, 9, 11, 12]],
    [[1, 2, 4, 6, 10], [3, 7, 9, 11, 12]],
    [[1, 2, 4, 6, 10, 12]],
]


# ----------------------------------------------------------------------------
# The 8-pair tree and the sparse families (Sections 8.2 and 9)

def tree8() -> list[list[int]]:
    """The 8-pair tree (8.1): operational but not basic-row."""
    return [[5, 7], [3, 5], [3], [1], [1, 2], [3, 4], [5, 2, 6], [7, 8]]


def caterpillar(K: int) -> list[list[int]]:
    """The caterpillar tree of Section 9 with components k = 2..K and s = K(K+1)/2 - 1.

    Component k has girls x_i = g_(c+i) and boys y_i = b_(c+i), c = k(k-1)/2,
    with lists x_0: [y_0] and x_i: [y_(i-1), y_i]; the last girl of each
    component but the last also lists the first boy of the next component.
    """
    if K < 2:
        raise ValueError('K must be at least 2')
    adj = []
    for k in range(2, K + 1):
        c = k * (k - 1) // 2
        adj.append([c])
        adj.extend([c + i - 1, c + i] for i in range(1, k))
        if k < K:
            adj[-1].append((k + 1) * k // 2)
    return adj


def cycles(K: int) -> list[list[int]]:
    """Disjoint cycles C_(4k-2), k = 2..K, s = K^2 - 1 (the remark ending Section 9).

    Component k has girls x_i and boys y_i, 0 <= i < 2k-1, numbered
    consecutively; x_i is adjacent to y_i and y_(i-1 mod 2k-1). The lists
    are [y_(i-1), y_i] for 1 <= i < k and [y_i, y_(i-1)] otherwise, which
    makes x_0 the free girl of her component after H1.
    """
    if K < 2:
        raise ValueError('K must be at least 2')
    adj = []
    for k in range(2, K + 1):
        size, offset = 2 * k - 1, len(adj)
        for i in range(size):
            local = [i - 1, i] if 1 <= i < k else [i, (i - 1) % size]
            adj.append([offset + j + 1 for j in local])
    return adj


# ----------------------------------------------------------------------------
# The halving graphs (Section 7.2, Appendix B)

def ruler(i: int) -> int:
    """rho(i), the exponent of the largest power of 2 dividing i."""
    return (i & -i).bit_length() - 1


def halving_numbers(f: int) -> tuple[dict[tuple[str, int], int], dict[tuple[str, int], int]]:
    """The numbers of the girls u_i, c_i and of the boys b_i, d_i of Appendix B.

    The girls u_i get f, f-1, ..., 1 in order of decreasing rho(i), ties
    broken by increasing i.
    """
    if f < 1 or f & (f - 1):
        raise ValueError('f must be a power of 2')
    u_order = sorted(range(1, f + 1), key=lambda i: (-ruler(i), i))
    girl_number = {('u', i): f - k for k, i in enumerate(u_order)}
    girl_number.update({('c', i): f + i for i in range(1, f + 1)})
    boy_number = {('b', i): 2 * i - 1 for i in range(1, f + 1)}
    boy_number.update({('d', i): 2 * i for i in range(1, f + 1)})
    return girl_number, boy_number


def halving(f: int) -> list[list[int]]:
    """The halving graph with f = 2^t initial free girls and s = 2f.

    u_i lists [b_i, b_(i + 2^rho(i))], or [b_f] when i = f; c_i lists [b_i, d_i].
    """
    girl_number, boy_number = halving_numbers(f)
    adj: list[list[int]] = [[] for _ in range(2 * f)]
    for i in range(1, f + 1):
        u_list = [('b', i)] + ([('b', i + (1 << ruler(i)))] if i < f else [])
        adj[girl_number['u', i] - 1] = [boy_number[v] for v in u_list]
        adj[girl_number['c', i] - 1] = [boy_number['b', i], boy_number['d', i]]
    return adj


def literal_realization(s: int) -> list[list[int]]:
    """The literal realizations of Corollary L, for s in {0, 1, 2, 3, 4, 5, 8, 9}.

    Halving graphs with f = s // 2, plus an isolated pair numbered last when
    s is odd.
    """
    if s not in (0, 1, 2, 3, 4, 5, 8, 9):
        raise ValueError('by Corollary L no literal realization exists for this s')
    adj = halving(s // 2) if s >= 2 else []
    if s % 2:
        adj.append([s])
    return adj


# ----------------------------------------------------------------------------
# The ordering obstructions of Section 8.5

# The six-pair graph: neighbours of g_1..g_6, with logical names.
SIX_PAIR_NEIGHBOURS = [[1], [1, 2, 5], [3], [2, 3, 4], [3, 5], [5, 6]]


def six_pair(scan: tuple[int, ...], lists: tuple[tuple[int, ...], ...]) -> list[list[int]]:
    """The six-pair graph with input order (scan, lists).

    scan gives the logical girls in the order in which H1 scans them, that
    is, receiving the numbers 6, 5, ..., 1; lists[k-1] is the list of g_k.
    """
    return [list(lists[k - 1]) for k in reversed(scan)]


def six_pair_inputs() -> Iterator[list[list[int]]]:
    """All 6! (3!)^2 (2!)^2 = 103680 ordered versions of the six-pair graph."""
    for lists in itertools.product(*(itertools.permutations(row)
                                     for row in SIX_PAIR_NEIGHBOURS)):
        for scan in itertools.permutations(range(1, 7)):
            yield six_pair(scan, lists)


def triangular_chain(h: int) -> list[list[int]]:
    """The triangular chain graph Delta_(2h): g_j b_i is an edge when i <= j.

    In this input girl j <= h lists boys 1..j, and girl h+j lists boy j first,
    then the others in increasing order, so that H1 leaves girls 1..h free.
    """
    if h < 1:
        raise ValueError('h must be positive')
    adj = [list(range(1, j + 1)) for j in range(1, h + 1)]
    for j in range(1, h + 1):
        adj.append([j] + [i for i in range(1, h + j + 1) if i != j])
    return adj


# ----------------------------------------------------------------------------
# The catalog of Appendix C

def load_catalog() -> dict[int, list[list[int]]]:
    """The stored inputs for even s = 2, 4, ..., 40, keyed by s."""
    data = json.loads(CATALOG_PATH.read_text(encoding='utf8'))
    return {int(s): entry['adjacency'] for s, entry in data.items()}


def catalog_realization(s: int) -> list[list[int]]:
    """A realization of the schedule for 0 <= s <= 41: the catalog entry for
    2*floor(s/2), plus an isolated pair numbered last if s is odd (Prop. 8.1)."""
    if s < 0:
        raise ValueError('s must be nonnegative')
    if s < 2:
        return [[1]] if s else []
    catalog = load_catalog()
    if s - s % 2 not in catalog:
        raise ValueError(f'the catalog has no entry for s = {s - s % 2}')
    adj = [list(row) for row in catalog[s - s % 2]]
    if s % 2:
        adj.append([s])
    return adj


# ----------------------------------------------------------------------------
# Names for the command lines of this file and of algorithm_h.py

# name -> (constructor, name of its parameter or None, description)
NAMED: dict[str, tuple[Callable[..., list[list[int]]], str | None, str]] = {
    'gamma': (staircase, 'n', 'the staircase graph Gamma_n (Sec. 5)'),
    'padded': (staircase_padded, 's', 'Gamma_n padded to size s (Sec. 5.5)'),
    'knuth16': (knuth16, None, "Knuth's 16-pair graph with the input of App. A"),
    'tree8': (tree8, None, 'the 8-pair tree of Sec. 8.2'),
    'halving': (halving, 'f', 'the halving graph of App. B, f a power of 2'),
    'literal': (literal_realization, 's', 'the literal realization of Cor. L'),
    'caterpillar': (caterpillar, 'K', 'the caterpillar tree of Sec. 9'),
    'cycles': (cycles, 'K', 'the disjoint cycles of the remark in Sec. 9'),
    'chain': (triangular_chain, 'h', 'the triangular chain graph Delta_2h of Sec. 8.5'),
    'catalog': (catalog_realization, 's', 'the realization of App. C'),
}


def describe_named() -> str:
    """A description of every example, for --help."""
    lines = []
    for name, (_, parameter, text) in NAMED.items():
        lines.append(f'{name} {parameter}: {text}' if parameter else f'{name}: {text}')
    return '; '.join(lines)


def build(name: str, parameter: int | None) -> list[list[int]]:
    """The example `name` of NAMED, given its parameter if it takes one."""
    function, parameter_name, _ = NAMED[name]
    if (parameter_name is None) != (parameter is None):
        need = f'the parameter {parameter_name}' if parameter_name else 'no parameter'
        raise SystemExit(f'{name} takes {need}')
    return function() if parameter is None else function(parameter)


def main() -> None:
    parser = argparse.ArgumentParser(description='Print the girl lists of an example graph.')
    parser.add_argument('example', choices=list(NAMED), help=describe_named())
    parser.add_argument('parameter', type=int, nargs='?', help='n, s, f, K or h')
    args = parser.parse_args()
    for g, row in enumerate(build(args.example, args.parameter), 1):
        print(f'girl {g}: {row}')


if __name__ == '__main__':
    main()
