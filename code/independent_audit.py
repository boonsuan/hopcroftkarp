"""A second, independent implementation of Algorithm H.

audit_h follows the same rules as algorithm_h.run_h but is written
differently on purpose, so that a misreading of the book is unlikely to be
repeated in both: ordinary loops instead of a program counter, and a Python
list per boy instead of the linked edge nodes BLINK/BNEXT. It shares no
code with algorithm_h.py, and verify.py compares the two field by field.

Input, output and counting conventions are those of algorithm_h.py (see
its module docstring), except that no step trace is produced. The counts
w5, w13 and w11 are the logical counts of Section 2.5; inserting into a
Python list costs more than relinking a node, and that cost is not counted.
"""
from __future__ import annotations


def audit_h(adj: list[list[int]], n: int | None = None) -> dict:
    """Run Algorithm H on the ordered graph adj; the result has the keys of run_h."""
    m = len(adj)
    if n is None:
        n = max((b for row in adj for b in row), default=0)
    if any(b < 1 or b > n for row in adj for b in row):
        raise ValueError('boy index outside 1..N')
    if any(len(set(row)) != len(row) for row in adj):
        raise ValueError('repeated edge: only simple graphs are accepted')
    lists = {g: list(row) for g, row in enumerate(adj, 1)}

    gmate, bmate = [0] * (m + 1), [0] * (n + 1)
    queue, slot_of = [0] * max(m, 1), [0] * (m + 1)
    level_of, marked = [0] * (n + 1), [0] * max(n, 1)
    arcs: list[list[int]] = [[] for _ in range(n + 1)]   # BLINK[b], head first
    path_boys = [0] * (min(m, n) + 2)                    # BOY[1..L]

    # Step H1 (answer 7): girls in decreasing order, each taking the first
    # free boy on her list; the others form the queue of free girls.
    free = 0
    h1_examined = 0
    for g in range(m, 0, -1):
        for b in lists[g]:
            h1_examined += 1
            if not bmate[b]:
                gmate[g], bmate[b] = b, g
                break
        else:
            queue[free], slot_of[g] = g, free
            free += 1
    h1_matching, h1_queue = gmate[1:], queue[:free]
    rounds = []

    while True:
        record = dict(round=len(rounds) + 2, L=0, f_before=free, f_after=0,
                      queue_before=queue[:free], queue_after=[],
                      matching_before=gmate[1:], matching_after=[],
                      marked=[], roots=[], blink={}, saps=[], w5=0, w13=0, w11=0)

        # Breadth-first search (H2-H10). Girls queue[start:end] form the
        # current level; their newly found mates are appended at `tail`.
        t = start = level = roots = final_level = 0
        tail = free
        while True:
            end = tail
            while start < end:
                g = queue[start]
                start += 1
                for b in lists[g]:
                    record['w5'] += 1
                    if level_of[b]:
                        if level_of[b] > level:
                            arcs[b].insert(0, g)    # H6 inserts at the head
                        continue
                    if final_level and bmate[b]:
                        continue                    # H8: only free boys at level L
                    level_of[b] = level + 1
                    marked[t] = b
                    t += 1
                    arcs[b] = [g]
                    if bmate[b]:
                        queue[tail] = bmate[b]
                        tail += 1
                    elif not final_level:
                        # H9: the first free boy fixes L, and the girls
                        # already queued for the next level are dropped.
                        final_level, roots = level + 1, 1
                        tail = end
                    else:
                        roots += 1
            if tail == end:
                break
            level += 1

        if not final_level:
            final_bfs = dict(w5=record['w5'], reached_girls=queue[:tail],
                             reached_boys=marked[:t])
            break
        record['L'] = final_level
        record['marked'] = marked[:t]
        record['roots'] = marked[t - roots:t]
        record['blink'] = {b: arcs[b].copy() for b in marked[:t]}

        # Depth-first search (H11-H17), one root at a time. Every arc is
        # removed when it is followed, so a failed branch is never retried;
        # a girl whose mate is already on a SAP is skipped.
        for b in marked[t - roots:t]:
            level = final_level
            path_boys[level] = b
            while True:
                if not arcs[b]:
                    level += 1                      # back up (H15)
                    if level > final_level:
                        break
                    b = path_boys[level]
                    continue
                g = arcs[b].pop(0)
                record['w13'] += 1
                if level_of[gmate[g]] < 0:
                    continue
                if gmate[g]:
                    b = gmate[g]
                    level -= 1
                    path_boys[level] = b
                    continue

                # g is free: a SAP g, path_boys[1], ..., path_boys[L].
                assert level == 1
                record['saps'].append(dict(
                    girls=[g] + [bmate[path_boys[j]] for j in range(1, final_level)],
                    boys=path_boys[1:final_level + 1]))
                # H16: the last free girl moves into g's slot of the queue.
                free -= 1
                last = queue[free]
                queue[slot_of[g]], slot_of[last] = last, slot_of[g]
                # H17: augment, and mark each boy of the path as deleted.
                for j in range(1, final_level + 1):
                    b = path_boys[j]
                    level_of[b] = -1
                    previous_girl = bmate[b]
                    bmate[b], gmate[g] = g, b
                    g = previous_girl
                break

        record['f_after'] = free
        record['queue_after'] = queue[:free]
        record['matching_after'] = gmate[1:]
        for b in marked[:t]:
            level_of[b] = 0
        record['w11'] = t
        rounds.append(record)

    edges = sum(map(len, adj))
    return dict(M=m, N=n, E=edges,
                h1_matching=h1_matching, h1_queue=h1_queue, h1_examined=h1_examined,
                rounds=rounds, final_bfs=final_bfs,
                final_matching=gmate[1:], s=m - free,
                num_rounds=(1 if edges else 0) + len(rounds),
                w5=sum(rd['w5'] for rd in rounds) + final_bfs['w5'],
                w13=sum(rd['w13'] for rd in rounds),
                w11=sum(rd['w11'] for rd in rounds))
