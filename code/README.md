# Programs for "How slow can Algorithm H be?"

These programs accompany the notes on exercises 15 and 16 of Section 7.5.1 of
*The Art of Computer Programming*, Pre-Fascicle 14A (revision −88, 18 September
2026). They simulate Knuth's Algorithm H step by step, rebuild every example
graph of the notes, check every computed statement, and draw the figures that
show actual runs.

The proofs in the notes do not depend on these programs. The programs make the
examples checkable and catch mistakes.

Everything needs only Python 3.10 or later and its standard library. NumPy is
used in one place, and only by `python verify.py --full`.

## Quick start

Run everything from this directory:

| command | what it does | time |
|---|---|---|
| `python verify.py` | every check, with a pass/fail line for each | about 10 s |
| `python verify.py --full` | the same, over the full ranges quoted in the notes (needs NumPy) | about 35 s |
| `python make_figures.py` | rewrites `../report/figures/gen_*` | under 1 s |
| `python export_traces.py` | rewrites the golden traces in `../site/tests/golden/` | under 1 s |
| `python algorithm_h.py gamma 5` | prints the rounds of a run, as in the tables of the notes | instant |
| `python examples.py knuth16` | prints the girl lists of an example | instant |
| `python search.py 46` | searches for Tchoukaillon realizations, every even s ≤ 46, and rewrites `data/search_results.json` (see [Search](#search)) | about 2 min |
| `python padding.py 48` | pads the realization for s = 48 to one for s = 50 (Proposition 8.8) and replays it | instant |

`python verify.py --list` lists the checks; `--only NAME ...` runs some of
them. Every script takes `--help`.

To run Algorithm H on a graph of your own:

```
python -c "from algorithm_h import run_h, format_run; print(format_run(run_h([[1, 2], [1]])))"
```

## Files

| file | purpose |
|---|---|
| `algorithm_h.py` | The reference simulator: a literal transcription of Algorithm H, with the edge nodes of answer 6, step H1 as in answer 7, and steps H2–H17 under an explicit program counter. Records every queue, `MARKED` order, `BLINK` list, SAP and work count. |
| `independent_audit.py` | A second implementation of the same rules, written with ordinary loops and Python lists. It shares no code with `algorithm_h.py`; `verify.py` requires the two to produce identical records. |
| `augmenting.py` | Computations that do not use Algorithm H: a maximum matching by plain augmenting paths, the list of *all* augmenting paths (exhaustive, for small graphs), the number ν of disjoint SAPs by max flow, basic paths, connected components. |
| `examples.py` | Every named graph of the notes (below), the Tchoukaillon schedule, and the numbers T(s), R(s), Q_n, Ch_n. |
| `verify.py` | The single entry point for checking. |
| `make_figures.py` | Draws the figures `gen_*.tex` and the plot data `gen_*.dat` from actual runs. |
| `export_traces.py` | Writes golden traces for testing a port of the simulator. |
| `search.py` | A search for ordered graphs that realize the Tchoukaillon schedule (below). |
| `padding.py` | Proposition 8.8: a realization for s = 2h with 3 \| h gives one for s + 2. |
| `data/numerical_witnesses.json` | The ordered graphs of Appendix C, for even s = 2, 4, …, 40. |
| `data/search_results.json` | The graphs found by `python search.py 46`, for even s = 2, 4, …, 46, with numbers of their runs. |
| `data/larger_sizes.json` | Realizations for s = 48, 50, …, 56 (Appendix C), each with the command that makes it. |

## Conventions

These match the notes, and are the same in all files.

* **Ordered graph.** A graph is given by its girl lists: `adj[g-1]` lists the
  boys of girl `g` in the order of `GLINK`/`GNEXT` (Section 2.3). Girls and
  boys are numbered from 1. Step H1 scans the girls in decreasing order, and
  the boy-side lists `BLINK` are built by the algorithm itself, so these lists
  are the whole input. `algorithm_h.input_pairs` gives an order of input pairs
  that produces them (exercise 6).
* **Matchings** are lists indexed by girl − 1 that give her mate, or 0 if she
  is free.
* **Rounds** are counted as in Section 2.5: step H1 is round 1. The record
  `rounds[k]` describes round k + 2, the (k + 1)st dag round; only dag rounds
  that find a SAP are rounds. The last dag construction, which finds no
  augmenting path, is `final_bfs`.
* **Work counts** per round: `w5` adjacency entries examined in step H5,
  `w13` arcs consumed in step H13 (including arcs to deleted girls), `w11`
  marks reset in step H11. H1's examinations are `h1_examined`. Totals over a
  run add up all rounds after H1; `w5` also includes the final search, which
  examines no entries in any example of the notes.
* **SAPs** g0 − b1 = g1 − b2 = ⋯ = g(L−1) − bL, written as in (2.1), are
  stored as `{'girls': [g0, …, g(L−1)], 'boys': [b1, …, bL]}`; `girls[i]` and
  `boys[i]` are the couples the SAP creates.

## The examples

| function in `examples.py` | graph | in the notes |
|---|---|---|
| `staircase(n)` | the staircase graph Γ_n; `staircase(5)` is the 9-pair example | Sections 2.4, 5 |
| `staircase(n, corner_edge=True)` | Γ_n with the omitted corner edge | Section 5.1 |
| `staircase_padded(s)` | Γ_n padded to any size s | Section 5.5, "Every size" |
| `knuth16()` | Knuth's 16-pair graph with the input of Appendix A | Section 3.3, App. A |
| `tree8()` | the 8-pair tree | Section 8.2 |
| `halving(f)` | the halving graphs, f a power of 2 | Section 7.2, App. B |
| `literal_realization(s)` | the literal realizations | Corollary L |
| `caterpillar(K)`, `cycles(K)` | the caterpillar trees and the cycles of the remark | Section 9 |
| `SIX_PAIR_NEIGHBOURS`, `six_pair_inputs()` | the six-pair graph and all its inputs | Section 8.5 |
| `triangular_chain(h)` | the triangular chain graph Δ_2h | Section 8.5 |
| `load_catalog()`, `catalog_realization(s)` | the computed realizations for s ≤ 41 | Section 8.1, App. C |

The catalog file stores only the ordered graphs; the program that found them
(Section 8.1) is not included. `search.py`, below, is a new search that finds
other realizations of the same schedule, for every even s ≤ 46.

## What `verify.py` checks

Every run below is made by both simulators, which must agree on every field.
Its final matching must also have the size found by `augmenting.maximum_matching`,
and the final dag construction must certify it maximum by itself (König's
theorem).

| check | statements of the notes |
|---|---|
| `gamma5` | Section 2.4 (lists (2.2), the first dag, `BLINK[1]`, the roots) and the table of Section 5.2 |
| `knuth16` | Appendix A: the input table, the run table, the queues, the census of all augmenting paths; Section 3.3: the basic paths are the rows of Knuth's matrices, ν = f in every round, π₂ and π₃ |
| `tchoukaillon` | Ch_n and Q_n tables (Sections 3.2, 6); (3.2); Lemma 6.1 (Q_n ≤ Ch_n); the levels with Ch_n < Q_{n+1}; the sizes with R(s) = T(s). Ch_n for n ≤ 2000 by default, n ≤ 100000 with `--full` |
| `staircase` | For Γ_n, n = 2…60, 81 and 129 (s up to 4225): Proposition 5.1, Lemmas 5.3–5.6 (hooks, positions, `MARKED`, every `BLINK` list, the roots, the SAP, the queue), Theorem S, Theorem W per round and in total; Proposition 5.7 (2^m − 1 SAPs) for n ≤ 9; ν = m (Section 5.6) for n ≤ 30 |
| `every-size` | Theorem R is attained: the padded graphs have R(s) rounds, each as on Γ_n, for 110 sizes; Section 5.1: with the corner edge Γ_n still has n rounds of one SAP, n ≤ 30 |
| `halving` | Appendix B: the lists, the free girls after each round, step H16, the work counts, property U (all augmenting paths of one level) for f ≤ 32; Corollary L |
| `catalog` | Section 8.1 and Appendix C: every s ≤ 41 follows the Tchoukaillon schedule (Proposition 8.1 for odd s); every number of the table; the H1 matching; Theorem C's inequality |
| `basic-rows` | Section 8.1: ν = f in every round of every catalog entry (max flow) |
| `search` | Section 8.1: `search.py` finds realizations for s = 2, 4, …, 12 within 10 s each; every graph in `data/search_results.json` follows the schedule, is basic-row and satisfies Theorem C's inequality |
| `padding` | Section 8.6 and Appendix C: Proposition 8.8 applied to every stored realization with 3 \| s/2 gives a basic-row realization for s + 2; every graph in `data/larger_sizes.json` replays, and the one for s = 50 is the padding of the one for s = 48 |
| `tree8` | Section 8.2: the table, the three augmenting paths, ν = 1 < f = 2 |
| `six-pair` | Section 8.5: the unique three-couple maximal matching, the abstract schedule, and no input follows it. A random sample of 5000 of the 103680 inputs by default; all of them, with the counts 103680 and 740, with `--exhaustive` or `--full` |
| `chain` | Section 8.5: the abstract SAPs of Δ_6, and 3a > h (Proposition 8.6) on random inputs with h ≤ 6 |
| `caterpillar` | Proposition 9.1 and Remark 9.2, for K = 2…16 and 32 |
| `simulators` | Appendix D: the simulators agree on 502 random ordered graphs |
| `maximum` | Appendix D: on all 689 simple graphs with M, N ≤ 3, each dag's level is the level of the shortest augmenting paths, found by exhaustive search, and the result is maximum |

## Search

`search.py` looks for ordered graphs on which Algorithm H follows the
Tchoukaillon schedule (Section 3.2): s = M = N = 2h, step H1 leaves h girls
free, and the round at each level L = 2, 3, … removes exactly
a_L = ⌈f_L/(L+1)⌉ SAPs. Odd s need no search (Proposition 8.1).

```
python search.py 40                 # every even s <= 40
python search.py 30 46              # every even s from 30 to 46
python search.py 40 --seed 7 --time-limit 300
```

It prints one line per size (edges, rounds, restarts, reruns of Algorithm H,
whether the run is basic-row, seconds, SAPs per round) and writes the graphs to
`data/search_results.json`, in the format of the catalog file plus the numbers
of the run. It never writes `numerical_witnesses.json`.

The method, described in full in the module docstring, splices Knuth's rows
(answer 15(d), Section 3.3). It starts from the normal form of Appendix C,
whose h rows of two cells are disjoint, and designs one round at a time: the
rows are split into a_L groups of at most L + 1 rows, and for each group it
adds the "jump" edges of one SAP that merges them, placed in the lists so that
the breadth-first search is unchanged and the depth-first search takes the
jumps first, plus a reordering edge where the processing order is wrong. Each
group is accepted only after Algorithm H has been rerun from H1 on the whole
graph and every earlier round has found the same SAPs as before. The search
backtracks over levels, restarts with a new numbering of the free girls when
it is stuck, and is deterministic for a given `--seed`.

Every graph it reports is replayed by both simulators, follows the schedule
exactly and ends with a perfect matching; all of them are basic-row
(ν = f in every round, by max flow). On a laptop, `python search.py 40` takes
about 16 s with the default seed (s = 34 is the slowest size, about 10 s).
`python search.py 42 60` finds 42, 44 and 46 (13–53 s each) and 54 and 56,
but not 48, 50, 52, 58 or 60 within the default limit of 120 s per size; at 48, 50
and 52 one level has a single group of exactly L + 1 rows, which forces every
cut. Other seeds do better: `--seed 2` finds 48 in about 30 s and `--seed 5`
finds 52 in about 5 minutes, and 50 follows from 48 by `padding.py`
(`data/larger_sizes.json` records how each larger size was made). Sizes 58, 60
and 62 resisted five seeds each at 15 minutes per seed. Not finding a size says
nothing about whether it can be realized.

## Golden traces

`export_traces.py` writes one JSON file per example to `../site/tests/golden/`:
Γ_5 (the 9-pair example), Γ_n for n = 2, 3, 4, 7, 10, Knuth's graph, the
8-pair tree, the halving graphs with f = 4 and 8, the caterpillar with K = 4,
the catalog entries for s = 6, 10, 20, and 20 random ordered graphs (seed
20261103). Each file holds the input (`girls`, `N`) and the complete record of
`run_h(girls, N, trace=True)`:

* the H1 results `h1_matching`, `h1_queue`, `h1_examined`;
* for each round: `round`, `L`, `f_before`, `f_after`, `queue_before`,
  `queue_after`, `matching_before`, `matching_after`, `marked`, `roots`,
  `blink` (boy → girls, in list order), `saps`, `w5`, `w13`, `w11`;
* `final_bfs`, `final_matching`, `s`, `num_rounds` and the totals;
* `step_trace`: every step visited, as integers 1–17 in order, with H1 once
  at the start, so that a port can be compared step by step.

The docstring of `export_traces.py` defines every field.
