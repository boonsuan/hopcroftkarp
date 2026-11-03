# How slow can Algorithm H be?

**Rounds, staircases, and Tchoukaillon graphs**: notes on exercises 15 and 16
of Donald E. Knuth's *The Art of Computer Programming*, Pre-Fascicle 14A,
Section 7.5.1 (Bipartite Matching), with an interactive companion website.

Created by [ho boon suan](https://boonsuan.github.io) using Claude Opus 5.5.

- **Website:** <https://hopcroftkarp.site>
- **Report (PDF):** [`report/main.pdf`](report/main.pdf)

## What this is about

Knuth's Algorithm 7.5.1H implements the Hopcroft–Karp algorithm for maximum
bipartite matching. It works in *rounds*. Exercise 15 proposes a family of slow
inputs, *Tchoukaillon graphs*; exercise 16 asks whether they exist, and its
answer asks whether any graph can force more rounds. The notes show:

- **The exact maximum.** A graph whose maximum matching has *s* edges can make
  Algorithm H perform at most ⌊√(4s+1)⌋ − 1 rounds, and *staircase graphs*
  attain this for every *s*. They are planar graphs of maximum degree three,
  with input orders under which every step of the algorithm is proved.
- **Beating Tchoukaillon.** This beats a Tchoukaillon graph from *s* = 9 on
  (apart from a few small sizes), by about (2 − √π)√s rounds.
- **The literal definition.** Read literally, exercise 15's definition can be
  met only for *s* ∈ {1, 2, 3, 4, 5, 8, 9}.
- **The weaker readings.** Partial results on the weaker readings, which remain
  open.

References are to the zeroth printing of Pre-Fascicle 14A, revision −88, dated
18 September 2026. A pre-fascicle is a working draft, so page and exercise
numbers may change.

## Repository layout

| Path | Contents |
| --- | --- |
| [`report/`](report/) | LaTeX source of the notes (`main.tex`, `sections/`, `figures/`) and the compiled PDF. See [`report/README.md`](report/README.md). |
| [`code/`](code/) | Python companion code: a step-by-step simulator of Algorithm H, an independent second implementation, the example graphs, the script that draws the report's data-driven figures, and checks for the report's claims. See [`code/README.md`](code/README.md). |
| [`site/`](site/) | The website: TypeScript + SVG, built with Vite. It has its own port of the simulator, tested step by step against traces from the Python code. See [`site/README.md`](site/README.md). |
| `.github/workflows/pages.yml` | Builds, tests, and deploys the website to GitHub Pages. |

## Quick start

```bash
# The report (TeX Live; run twice for references)
cd report && pdflatex main.tex && pdflatex main.tex

# The checks behind the report's computational claims (Python 3.10+)
cd code && python verify.py

# The website
cd site && npm install && npm run dev
```

## Licenses

- Code (`code/`, `site/`): [MIT](LICENSE).
- Report text and figures, and the website's text: [CC BY 4.0](LICENSE-CC-BY.md).
- Libertinus fonts: SIL Open Font License ([`site/src/fonts/OFL.txt`](site/src/fonts/OFL.txt)).

Quotations from Pre-Fascicle 14A belong to its copyright holder and are used
for commentary.
