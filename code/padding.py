#!/usr/bin/env python3
"""Proposition 8.8: from a realization for s = 2h with 3 | h, one for s + 2.

    python padding.py 48           # pad the stored realization for s = 48

When 3 divides h, the schedules for h and h + 1 differ only by one more SAP
in the round at level 2 (Lemma 8.7 with K = 2). The padded graph supplies it
with a separate path of two pairs, u - v = w - z, numbered below all other
girls so that H1 leaves u free and last in QUEUE. One more edge, from a girl
x of the old graph to z, makes z the first root of that round: x is the girl
whom H1 matched to the first boy on the list of the first free girl in
QUEUE, so x is the first girl of level 1, and z goes right after her H1 mate
in her list, so that H1 never reaches it. The search from z finds the new
path first; it ends at the last free girl, so step H16 moves nobody, and
every round then runs as in the old graph. Without the edge x - z the new
path's SAP comes last, after step H16 has moved u, and the padding can fail
(it does for s = 42 and 54).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from algorithm_h import run_h

DATA = Path(__file__).resolve().parent / 'data'


def pad(adj: list[list[int]]) -> list[list[int]]:
    """The ordered graph of Proposition 8.8 for the ordered graph adj.

    The old girls and boys are renumbered g + 2 and b + 2; girl 1 is u with
    list [1], girl 2 is w with list [1, 2], so boy 1 is v and boy 2 is z.
    """
    run = run_h(adj)
    if not run['h1_queue']:
        raise ValueError('H1 leaves no girl free')
    b = adj[run['h1_queue'][0] - 1][0]
    x = run['h1_matching'].index(b) + 1
    padded = [[1], [1, 2]] + [[boy + 2 for boy in row] for row in adj]
    row = padded[x + 1]
    row.insert(row.index(b + 2) + 1, 2)
    return padded


def stored(s: int) -> list[list[int]]:
    """The stored realization for even s: catalog first, then the search results."""
    for name in ('numerical_witnesses.json', 'search_results.json', 'larger_sizes.json'):
        entries = json.loads((DATA / name).read_text(encoding='utf8'))
        if str(s) in entries:
            return entries[str(s)]['adjacency']
    raise KeyError(f'no stored realization for s = {s}')


def main() -> None:
    from search import check_realization

    parser = argparse.ArgumentParser(
        description='Pad a stored realization for s = 2h with 3 | h to one for s + 2 '
                    '(Proposition 8.8) and replay it.')
    parser.add_argument('s', type=int, help='an even size with 3 | s/2 and a stored realization')
    options = parser.parse_args()
    if options.s % 2 or (options.s // 2) % 3:
        parser.error('s must be even with 3 | s/2')
    padded = pad(stored(options.s))
    check = check_realization(padded, options.s + 2)
    print(f"s = {options.s + 2}: {check['E']} edges, "
          f"{'follows the schedule' if check['follows'] else 'does NOT follow the schedule'}, "
          f"{'basic-row' if check['basic_row'] else 'not basic-row'}")
    print(json.dumps(padded))


if __name__ == '__main__':
    main()
