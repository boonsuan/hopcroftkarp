"""Matching computations that do not use Algorithm H, for checking its runs.

Graphs and matchings are in the format of algorithm_h.py: adj[g-1] lists
the boys of girl g, and matching[g-1] is her mate or 0. Paths are written
as in (2.1), g0 - b1 = g1 - b2 = ... = g(L-1) - bL, and stored as
(girls, boys) = ([g0, ..., g(L-1)], [b1, ..., bL]).
"""
from __future__ import annotations

from collections import Counter, deque
from collections.abc import Iterator

AugmentingPath = tuple[tuple[int, ...], tuple[int, ...]]


def num_boys(adj: list[list[int]], n: int | None) -> int:
    """N, which defaults to the largest boy in adj."""
    return n if n is not None else max((b for row in adj for b in row), default=0)


def boy_mates(matching: list[int], n: int) -> list[int]:
    """The inverse of a matching: entry b is the mate of boy b, or 0."""
    bmate = [0] * (n + 1)
    for g, b in enumerate(matching, 1):
        if b:
            bmate[b] = g
    return bmate


def is_matching(adj: list[list[int]], matching: list[int], n: int | None = None) -> bool:
    """True if every couple is an edge of adj and no boy has two mates."""
    n = num_boys(adj, n)
    if len(matching) != len(adj):
        return False
    taken = set()
    for row, b in zip(adj, matching):
        if b:
            if not 1 <= b <= n or b not in row or b in taken:
                return False
            taken.add(b)
    return True


def maximum_matching(adj: list[list[int]], n: int | None = None) -> list[int]:
    """A maximum matching, found one augmenting path at a time by plain BFS.

    This is the textbook method of Berge's theorem, with none of Algorithm H's
    dags, queues or orderings, so it is an independent check of the size s.
    """
    n = num_boys(adj, n)
    gmate = [0] * (len(adj) + 1)
    bmate = [0] * (n + 1)
    for root in range(1, len(adj) + 1):
        # Search the alternating paths from the free girl root; parent[b] is
        # the girl from whom boy b was first reached.
        parent: dict[int, int] = {}
        todo = deque([root])
        seen_girls = {root}
        end = 0
        while todo and not end:
            g = todo.popleft()
            for b in adj[g - 1]:
                if b in parent or gmate[g] == b:
                    continue
                parent[b] = g
                if bmate[b] == 0:
                    end = b
                    break
                if bmate[b] not in seen_girls:
                    seen_girls.add(bmate[b])
                    todo.append(bmate[b])
        # Augment back from the free boy end to the root.
        b = end
        while b:
            g = parent[b]
            previous_boy = gmate[g]
            gmate[g], bmate[b] = b, g
            b = previous_boy
    return gmate[1:]


def augmenting_paths(adj: list[list[int]], matching: list[int],
                     n: int | None = None) -> Iterator[AugmentingPath]:
    """Every simple augmenting path, each once, from its free girl to its free boy.

    Exhaustive, so only for small graphs; unlike Algorithm H's dag it also
    finds the paths that are not shortest.
    """
    bmate = boy_mates(matching, num_boys(adj, n))

    def extend(girls: list[int], boys: list[int]) -> Iterator[AugmentingPath]:
        g = girls[-1]
        for b in adj[g - 1]:
            if b == matching[g - 1] or b in boys:
                continue
            if bmate[b] == 0:
                yield tuple(girls), tuple(boys + [b])
            elif bmate[b] not in girls:
                yield from extend(girls + [bmate[b]], boys + [b])

    for g, b in enumerate(matching, 1):
        if b == 0:
            yield from extend([g], [])


def path_census(adj: list[list[int]], matching: list[int], n: int | None = None) -> dict[int, int]:
    """The number of augmenting paths of each level L (paths with 2L-1 edges)."""
    levels = Counter(len(boys) for _, boys in augmenting_paths(adj, matching, n))
    return dict(sorted(levels.items()))


def augment(matching: list[int], path: AugmentingPath) -> list[int]:
    """The matching obtained by augmenting along path."""
    result = list(matching)
    for g, b in zip(*path):
        result[g - 1] = b
    return result


def sap_level_and_nu(adj: list[list[int]], matching: list[int]) -> tuple[int, int]:
    """(L, nu): the level of the SAPs, and the largest number of disjoint SAPs.

    nu is a unit-capacity maximum flow in the layered graph of the SAPs, with
    every vertex split into an entry and an exit joined by capacity 1, so
    that flow paths are vertex-disjoint SAPs (Section 3.1). Returns (0, 0) if
    there is no augmenting path.
    """
    bmate = {b: g for g, b in enumerate(matching, 1) if b}
    # Distances from the free girls: even for girls, odd for boys.
    girl_dist = {g: 0 for g in range(1, len(adj) + 1) if matching[g - 1] == 0}
    boy_dist: dict[int, int] = {}
    todo = deque(girl_dist)
    shortest = 0
    while todo:
        g = todo.popleft()
        for b in adj[g - 1]:
            if b == matching[g - 1] or b in boy_dist:
                continue
            boy_dist[b] = girl_dist[g] + 1
            if b not in bmate:
                shortest = shortest or boy_dist[b]
            elif bmate[b] not in girl_dist:
                girl_dist[bmate[b]] = boy_dist[b] + 1
                todo.append(bmate[b])
    if not shortest:
        return 0, 0

    capacity: dict[tuple, int] = {}

    def add_arc(u: tuple, v: tuple) -> None:
        capacity[u, v] = capacity.get((u, v), 0) + 1
        capacity.setdefault((v, u), 0)

    source, sink = ('source',), ('sink',)
    for g, d in girl_dist.items():
        add_arc(('girl in', g), ('girl out', g))
        if d == 0:
            add_arc(source, ('girl in', g))
        for b in adj[g - 1]:
            if b != matching[g - 1] and boy_dist.get(b) == d + 1 and boy_dist[b] <= shortest:
                add_arc(('girl out', g), ('boy in', b))
    for b, d in boy_dist.items():
        if d > shortest:
            continue
        add_arc(('boy in', b), ('boy out', b))
        if b not in bmate:
            if d == shortest:
                add_arc(('boy out', b), sink)
        elif d < shortest and girl_dist.get(bmate[b]) == d + 1:
            add_arc(('boy out', b), ('girl in', bmate[b]))
    neighbours: dict[tuple, list[tuple]] = {}
    for u, v in capacity:
        neighbours.setdefault(u, []).append(v)

    # Ford-Fulkerson with breadth-first augmenting paths.
    flow = 0
    while True:
        parent: dict[tuple, tuple | None] = {source: None}
        todo = deque([source])
        while todo and sink not in parent:
            u = todo.popleft()
            for v in neighbours.get(u, []):
                if v not in parent and capacity[u, v] > 0:
                    parent[v] = u
                    todo.append(v)
        if sink not in parent:
            return (shortest + 1) // 2, flow
        v = sink
        while parent[v] is not None:
            u = parent[v]
            capacity[u, v] -= 1
            capacity[v, u] += 1
            v = u
        flow += 1


def basic_paths(matching: list[int], perfect: list[int], n: int) -> dict[int, list[int]]:
    """The basic paths of matching with respect to the perfect matching perfect.

    For each free girl g0, the path g0 - P(g0) = g1 - P(g1) = ... ends at a
    free boy (Section 2.1). It is returned as the list [g0, g1, ...] of the
    girls it visits, which also names the pairs of P along it (its "row").
    """
    bmate = boy_mates(matching, n)
    paths = {}
    for g0, b in enumerate(matching, 1):
        if b:
            continue
        girls = [g0]
        while bmate[perfect[girls[-1] - 1]]:
            girls.append(bmate[perfect[girls[-1] - 1]])
        paths[g0] = girls
    return paths


def count_components(adj: list[list[int]], n: int | None = None) -> int:
    """The number of connected components, isolated vertices included."""
    n = num_boys(adj, n)
    m = len(adj)
    # Vertex v < m is girl v+1; vertex m + b - 1 is boy b.
    parent = list(range(m + n))

    def root(v: int) -> int:
        while parent[v] != v:
            parent[v] = parent[parent[v]]
            v = parent[v]
        return v

    components = m + n
    for g, row in enumerate(adj):
        for b in row:
            x, y = root(g), root(m + b - 1)
            if x != y:
                parent[x] = y
                components -= 1
    return components
