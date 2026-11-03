#!/usr/bin/env python3
"""Write golden traces of Algorithm H for testing a port of the simulator.

    python export_traces.py

writes one JSON file per example to ../site/tests/golden/. Each file is the
record of algorithm_h.run_h(girls, N, trace=True), plus the input:

  name, description   which example this is;
  girls               the input: girls[g-1] lists the boys of girl g in
                      GLINK/GNEXT order; girls and boys are numbered from 1;
  M, N, E             numbers of girls, boys and edges;
  h1_matching         after step H1: h1_matching[g-1] is the mate of girl g,
                      or 0 if she is free (the same format for every matching);
  h1_queue            QUEUE[0..f-1] after H1, the free girls in order;
  h1_examined         adjacency entries examined by H1;
  rounds              one object per dag round that found a SAP:
      round           its number, H1 being round 1 (so 2, 3, ...);
      L               the level of its dag;
      f_before, f_after, queue_before, queue_after,
      matching_before, matching_after
                      the state before step H2 and after the last step H11;
      marked          the order of MARKED when the dag is complete (H10);
      roots           the free boys of level L, in the order H11 takes them;
      blink           BLINK[b] for every boy b of the dag, as a list of girls
                      in list order, recorded at H10 before the search
                      consumes it. Keys are boy numbers as strings; their
                      order carries no meaning (marked gives the order);
      saps            the SAPs found, in order, each as {girls, boys} with
                      girls = [g0, ..., g(L-1)] and boys = [b1, ..., bL] for
                      the path g0 - b1 = g1 - ... = g(L-1) - bL; girls[i] and
                      boys[i] are the couples it creates;
      w5, w13, w11    adjacency entries examined in H5, arcs consumed in H13
                      (including arcs to deleted girls), marks reset in H11;
  final_bfs           the last dag construction, which reaches no free boy:
                      its w5 and the girls and boys it reached;
  final_matching, s   the maximum matching and its size;
  num_rounds          rounds counted as in the report (H1 counts if E > 0);
  w5, w13, w11        totals over all rounds after H1 (w5 includes final_bfs);
  step_trace          every step visited, as integers 1..17 in order, with
                      H1 listed once at the start; repeated steps (H13 after a
                      deleted girl, H17 along a path) appear each time.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import examples
from algorithm_h import run_h

GOLDEN = Path(__file__).resolve().parent.parent / 'site' / 'tests' / 'golden'


def golden_inputs() -> list[tuple[str, str, list[list[int]], int]]:
    """(name, description, girl lists, N) for every exported example."""
    inputs = [('gamma5', 'the 9-pair example of Sections 2.4 and 5.2 (Gamma_5)',
               examples.staircase(5), 9)]
    for n in (2, 3, 4, 7, 10):
        adj = examples.staircase(n)
        inputs.append((f'gamma{n}', f'the staircase graph Gamma_{n} (Section 5)', adj, len(adj)))
    inputs += [
        ('knuth16', "Knuth's 16-pair graph with the input of Appendix A", examples.knuth16(), 16),
        ('tree8', 'the 8-pair tree of Section 8.2', examples.tree8(), 8),
        ('halving4', 'the halving graph with f = 4 (Appendix B)', examples.halving(4), 8),
        ('halving8', 'the halving graph with f = 8 (Appendix B)', examples.halving(8), 16),
        ('caterpillar4', 'the caterpillar tree with K = 4 (Section 9)',
         examples.caterpillar(4), 9),
    ]
    for s in (6, 10, 20):
        inputs.append((f'catalog{s}', f'the realization for s = {s} of Appendix C',
                       examples.catalog_realization(s), s))
    # Small random ordered graphs, not necessarily balanced, connected or
    # with every boy used; N is part of the input.
    rng = random.Random(20261103)
    for k in range(1, 21):
        m, n = rng.randint(1, 8), rng.randint(1, 8)
        density = rng.uniform(.2, .7)
        adj = [rng.sample(range(1, n + 1), n) for _ in range(m)]
        adj = [[b for b in row if rng.random() < density] for row in adj]
        inputs.append((f'random{k:02}', f'random ordered graph {k} (seed 20261103)', adj, n))
    return inputs


def to_json(value: object, indent: str = '') -> str:
    """JSON with one key per line, but lists of numbers on a single line."""
    inner = indent + '  '
    if isinstance(value, dict):
        if not value:
            return '{}'
        items = [f'{inner}{json.dumps(str(k))}: {to_json(v, inner)}' for k, v in value.items()]
        return '{\n' + ',\n'.join(items) + '\n' + indent + '}'
    if isinstance(value, list) and any(isinstance(v, (dict, list)) for v in value):
        return '[\n' + ',\n'.join(inner + to_json(v, inner) for v in value) + '\n' + indent + ']'
    return json.dumps(value)


def main() -> None:
    argparse.ArgumentParser(description=__doc__,
                            formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    GOLDEN.mkdir(parents=True, exist_ok=True)
    inputs = golden_inputs()
    for name, description, adj, n in inputs:
        record = dict(name=name, description=description, girls=adj,
                      **run_h(adj, n, trace=True))
        with open(GOLDEN / f'{name}.json', 'w', encoding='utf8', newline='\n') as file:
            file.write(to_json(record) + '\n')
    print(f'{len(inputs)} golden traces written to {GOLDEN}')


if __name__ == '__main__':
    main()
