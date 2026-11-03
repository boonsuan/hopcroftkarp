#!/usr/bin/env python3
"""Reference simulator for Algorithm 7.5.1H (Pre-Fascicle 14A, revision -88, 18 Sep 2026).

This is a literal transcription. The edge nodes GTIP, BTIP, GNEXT, BNEXT are
built as in answer 6, step H1 is the code of answer 7, and steps H2-H17 run
under an explicit program counter, so that every jump in the book is a jump
here. Python 3.10+, standard library only.

Conventions, shared with independent_audit.py and with the report:

* An ordered graph (report, Section 2.3) is given by its girl lists:
  adj[g-1] lists the boys of girl g in GLINK/GNEXT order. Girls and boys
  are numbered from 1; N defaults to the largest boy that occurs. There is
  no boy-side input: the lists BLINK are built by the algorithm itself.
* A matching is a list indexed by girl-1 giving her mate, 0 if she is free
  (the array GMATE[1..M]).
* Rounds are numbered as in Section 2.5: step H1 is round 1, and
  result['rounds'][k] describes round k+2, the (k+1)st dag round that found
  a SAP. The last dag construction, which finds no augmenting path and
  stops the algorithm, is result['final_bfs']; it is not a round.
* Work counts, per round (Section 2.5):
    w5  = adjacency entries examined in step H5 (the breadth-first search);
    w13 = arcs consumed in step H13 (the depth-first search), including
          arcs that lead to a deleted girl;
    w11 = marks reset in step H11, one per boy in the dag.
  Step H1's examinations are counted separately as h1_examined.
* A SAP g0 - b1 = g1 - b2 = ... = g(L-1) - bL, written as in (2.1), is
  recorded as {'girls': [g0, ..., g(L-1)], 'boys': [b1, ..., bL]}, so that
  girls[i] and boys[i] are the couples it creates.

Run `python algorithm_h.py --help` to print the run on any example graph.
"""
from __future__ import annotations

import argparse
import json


def input_pairs(adj: list[list[int]]) -> list[tuple[int, int]]:
    """An order of the input pairs (g, b) that produces the lists adj (exercise 6).

    Each new edge is inserted at the front of its girl's list, so each list
    must be presented in reverse.
    """
    return [(g, b) for g, row in enumerate(adj, 1) for b in reversed(row)]


def run_h(adj: list[list[int]], n: int | None = None, trace: bool = False) -> dict:
    """Run Algorithm H on the ordered graph adj and record everything it does.

    Returns a dict with the keys
      M, N, E          sizes of the graph;
      h1_matching      the matching after step H1;
      h1_queue         QUEUE[0..f-1] after H1: the free girls, in order;
      h1_examined      adjacency entries examined by H1;
      rounds           one record per successful dag round (see below);
      final_bfs        the last, unsuccessful dag construction: its w5 and
                       the girls and boys it reached;
      final_matching, s   the maximum matching found, and its size;
      num_rounds       number of rounds as in the report (H1 counts if E > 0);
      w5, w13, w11     totals over all rounds after H1 (w5 also includes
                       the entries examined by final_bfs);
      step_trace       if trace is true: every step label visited, as an
                       integer 1..17, with H1 listed once at the start.

    Each element of rounds has the keys
      round, L         its number (H1 being round 1) and the level of its dag;
      f_before, f_after, queue_before, queue_after, matching_before,
      matching_after   the state before H2 and after the last H11;
      marked           the order of MARKED when the dag is complete (H10);
      roots            the free boys of level L, the roots used by H11;
      blink            BLINK[b] for each boy b of the dag, as a list of girls,
                       snapshotted at H10 before the search consumes it;
      saps             the SAPs found, in order;
      w5, w13, w11     the work counts of the round.
    """
    m = len(adj)
    if n is None:
        n = max((b for row in adj for b in row), default=0)
    if any(b < 1 or b > n for row in adj for b in row):
        raise ValueError('boy index outside 1..N')
    if any(len(row) != len(set(row)) for row in adj):
        raise ValueError('repeated edge: only simple graphs are accepted')

    # Answer 6: edge node e gets GTIP[e] = g and BTIP[e] = b and goes to the
    # front of girl g's list. Node 0 is the null link.
    glink = [0] * (m + 1)
    gtip, btip, gnext, bnext = [0], [0], [0], [0]
    for g, b in input_pairs(adj):
        e = len(gtip)
        gtip.append(g)
        btip.append(b)
        gnext.append(glink[g])
        bnext.append(0)
        glink[g] = e
    blink = [0] * (n + 1)
    gmate = [0] * (m + 1)
    bmate = [0] * (n + 1)
    queue = [0] * max(1, m)
    iqueue = [0] * (m + 1)
    # MARK[0] is never changed, so a free girl (GMATE = 0) never looks
    # deleted in H13.
    mark = [0] * (n + 1)
    marked = [0] * max(1, n)
    boy = [0] * (min(m, n) + 2)
    steps: list[int] = [1]

    # H1, as in answer 7: girls are scanned in decreasing order, and each is
    # matched to the first free boy on her list or else appended to QUEUE.
    f = 0
    h1_examined = 0
    for g in range(m, 0, -1):
        e = glink[g]
        while e:
            h1_examined += 1
            if bmate[btip[e]] == 0:
                break
            e = gnext[e]
        if e:
            b = btip[e]
            gmate[g], bmate[b] = b, g
        else:
            queue[f], iqueue[g] = g, f
            f += 1
    h1_matching = gmate[1:]
    h1_queue = queue[:f]

    rounds: list[dict] = []
    record: dict = {}
    pc = 2
    while True:
        if trace:
            steps.append(pc)
        if pc == 2:
            # H2. Start a new dag; open the record of a possible round.
            record = dict(round=len(rounds) + 2, L=0, f_before=f, f_after=0,
                          queue_before=queue[:f], queue_after=[],
                          matching_before=gmate[1:], matching_after=[],
                          marked=[], roots=[], blink={}, saps=[], w5=0, w13=0, w11=0)
            t = i = l = r = 0
            q, L = f, 0
            pc = 3
        elif pc == 3:
            # H3. Girls QUEUE[i..q'-1] form level l of the dag.
            qp = q
            pc = 4
        elif pc == 4:
            # H4. Take the next girl of this level, if any.
            if i == qp:
                pc = 10
            else:
                g = queue[i]
                i += 1
                e = glink[g]
                pc = 5
        elif pc == 5:
            # H5. Examine the next entry of her list.
            if e == 0:
                pc = 4
            else:
                record['w5'] += 1
                b = btip[e]
                pc = 6
        elif pc == 6:
            # H6. A boy already in the dag gets a new arc only if he is at
            # level l+1. The arc goes at the HEAD of BLINK[b], so BLINK[b]
            # lists his girls in the reverse of their order in QUEUE.
            if mark[b] == 0:
                pc = 8
            else:
                if mark[b] > l:
                    bnext[e], blink[b] = blink[b], e
                pc = 7
        elif pc == 7:
            # H7. Advance along the girl's list.
            e = gnext[e]
            pc = 5
        elif pc == 8:
            # H8. A new boy joins level l+1, unless L is already known and he
            # is matched: the final level admits only free boys.
            if L > 0 and bmate[b] != 0:
                pc = 7
            else:
                mark[b] = l + 1
                marked[t] = b
                t += 1
                blink[b], bnext[e] = e, 0
                pc = 9
        elif pc == 9:
            # H9. Queue his mate for the next level; or, if he is free, fix
            # L at the first free boy, discard the girls already queued for
            # level l+1, and count him as a root.
            if bmate[b] != 0:
                queue[q] = bmate[b]
                q += 1
            elif L == 0:
                L, r, q = l + 1, 1, qp
            else:
                r += 1
            pc = 7
        elif pc == 10:
            # H10. Go to the next level; or stop if no free boy was reached;
            # or begin dismantling the completed dag.
            if q != qp:
                l += 1
                pc = 3
            elif L == 0:
                final_bfs = dict(w5=record['w5'], reached_girls=queue[:q],
                                 reached_boys=marked[:t])
                break
            else:
                record['L'] = L
                record['marked'] = marked[:t]
                record['roots'] = marked[t - r:t]
                for bb in marked[:t]:
                    girls, ee = [], blink[bb]
                    while ee:
                        girls.append(gtip[ee])
                        ee = bnext[ee]
                    record['blink'][bb] = girls
                pc = 11
        elif pc == 11:
            # H11. Take the next root, in MARKED order. When none is left,
            # reset every mark and start a new round.
            if r == 0:
                for k in range(t):
                    mark[marked[k]] = 0
                record['w11'] = t
                record['f_after'] = f
                record['queue_after'] = queue[:f]
                record['matching_after'] = gmate[1:]
                rounds.append(record)
                pc = 2
            else:
                b = marked[t - r]
                r -= 1
                l = L
                pc = 12
        elif pc == 12:
            # H12. Boy b is the current vertex at level l.
            boy[l] = b
            pc = 13
        elif pc == 13:
            # H13. Consume the first arc of BLINK[b]. Its girl is deleted if
            # her mate is on a SAP already found (MARK = -1); then the arc
            # is simply skipped, never restored.
            e = blink[b]
            if e == 0:
                pc = 15
            else:
                record['w13'] += 1
                blink[b], g = bnext[e], gtip[e]
                if mark[gmate[g]] < 0:
                    pc = 13
                else:
                    b = gmate[g]
                    pc = 14
        elif pc == 14:
            # H14. A free girl completes a SAP; otherwise go down a level.
            if b == 0:
                pc = 16
            else:
                l -= 1
                pc = 12
        elif pc == 15:
            # H15. BLINK[b] is exhausted: back up one level, or give up on
            # this root if it was the root itself.
            l += 1
            if l > L:
                pc = 11
            else:
                b = boy[l]
                pc = 13
        elif pc == 16:
            # H16. Record the SAP before any mate changes. Remove its girl g
            # from the free list by moving the last free girl QUEUE[f-1]
            # into her slot, so the queue order survives only if g is last.
            assert l == 1 and gmate[g] == 0
            record['saps'].append(dict(girls=[g] + [bmate[boy[j]] for j in range(1, L)],
                                       boys=boy[1:L + 1]))
            f -= 1
            k = iqueue[g]
            i = queue[f]
            queue[k], iqueue[i] = i, k
            b = boy[1]
            pc = 17
        elif pc == 17:
            # H17. Augment along the path, deleting each of its boys.
            mark[b] = -1
            gp = bmate[b]
            bmate[b], gmate[g] = g, b
            if gp != 0:
                g = gp
                l += 1
                b = boy[l]
                pc = 17
            else:
                pc = 11
        else:
            raise AssertionError(f'no step H{pc}')

    edges = sum(map(len, adj))
    result = dict(M=m, N=n, E=edges,
                  h1_matching=h1_matching, h1_queue=h1_queue, h1_examined=h1_examined,
                  rounds=rounds, final_bfs=final_bfs,
                  final_matching=gmate[1:], s=m - f,
                  num_rounds=(1 if edges else 0) + len(rounds),
                  w5=sum(rd['w5'] for rd in rounds) + final_bfs['w5'],
                  w13=sum(rd['w13'] for rd in rounds),
                  w11=sum(rd['w11'] for rd in rounds))
    if trace:
        result['step_trace'] = steps
    return result


def format_run(result: dict) -> str:
    """The run as a table in the style of the report (e.g. Section 5.2)."""
    lines = [f"M={result['M']} N={result['N']} E={result['E']} s={result['s']}: "
             f"{result['num_rounds']} rounds counting H1",
             f"H1: queue {result['h1_queue']}, {result['h1_examined']} entries examined",
             f"{'round':>5} {'L':>3} {'f':>3} {'SAPs':>4} {'w5':>5} {'w13':>5} {'w11':>5}"
             '  SAPs as new couples (g,b)']
    for rd in result['rounds']:
        saps = '; '.join(','.join(f'({g},{b})' for g, b in zip(p['girls'], p['boys']))
                         for p in rd['saps'])
        lines.append(f"{rd['round']:>5} {rd['L']:>3} {rd['f_before']:>3} {len(rd['saps']):>4} "
                     f"{rd['w5']:>5} {rd['w13']:>5} {rd['w11']:>5}  {saps}")
    lines.append(f"totals after H1: w5={result['w5']} w13={result['w13']} w11={result['w11']}"
                 f" (the final search examined {result['final_bfs']['w5']} entries)")
    return '\n'.join(lines)


def main() -> None:
    import examples

    parser = argparse.ArgumentParser(
        description='Run Algorithm H on an example graph of the report and print the rounds.')
    parser.add_argument('example', choices=list(examples.NAMED), help=examples.describe_named())
    parser.add_argument('parameter', type=int, nargs='?',
                        help='its parameter (n, s, f, K or h), where it takes one')
    parser.add_argument('--json', action='store_true',
                        help='print the complete record as JSON instead of a table')
    parser.add_argument('--trace', action='store_true', help='include step_trace (with --json)')
    args = parser.parse_args()
    adj = examples.build(args.example, args.parameter)
    result = run_h(adj, trace=args.trace)
    if args.json:
        print(json.dumps(dict(girls=adj, **result)))
    else:
        print(format_run(result))


if __name__ == '__main__':
    main()
