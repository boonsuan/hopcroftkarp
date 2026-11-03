# The website

An interactive companion to the report: TypeScript and SVG with no UI
framework, built with [Vite](https://vite.dev). Math is typeset with
[KaTeX](https://katex.org), and text is set in Libertinus, like the report.

```bash
npm install
npm run dev       # local server with hot reload
npm test          # engine tests against the Python traces
npm run build     # production build in dist/ (includes the report PDF)
```

## How it is organized

| Path | Contents |
| --- | --- |
| `index.html` | The page and all of its prose. |
| `vite.config.ts` | Build steps for the page: typesets its math, resolves links into the report, and copies the report PDF (see below). |
| `src/main.ts` | Entry point: theme, sound controls, the chapter menu, and every widget. |
| `src/engine/algorithmH.ts` | A step-by-step port of the Python simulator. It records a snapshot after every step: matching, queue, dag, reverse lists, search path, and work counters. |
| `src/engine/examples.ts` | The example graphs of the report (staircase graphs, Knuth's 16-pair graph, the 8-pair tree, halving and caterpillar graphs, the six-pair graph, and the catalog). |
| `src/engine/numbers.ts` | The Tchoukaillon schedule, Tchoukaillon numbers $`\text{Ч}_n`$, quarter-squares $`Q_n`$, and $R(s)$, $T(s)$. |
| `src/ui/` | Shared pieces: a small keyed SVG renderer (`scene.ts`), synthesized sounds (`sound.ts`), the light/dark theme, the chapter menu, icons, KaTeX settings, and form controls. |
| `src/widgets/` | One file per interactive figure. |
| `src/styles/main.css` | Design tokens for light and dark mode (the report's palette) and all styles. |
| `src/data/` | The catalog of computed realizations, and the PDF page of every report section. |
| `public/` | Files served as they are: the favicon, the touch icon, and the link-preview image `og.png`. |
| `scripts/` | Python helpers, run by hand when their inputs change (below). |
| `tests/` | Vitest suite. `tests/golden/` holds traces exported by `../code/export_traces.py`; the engine must reproduce every round, list, and step. |

## Done at build time, not in the browser

- **Math.** `$...$` and `$$...$$` in `index.html` are typeset by KaTeX when the
  site is built, so readers never see raw TeX. Widgets typeset their own
  changing text with the same settings (`src/ui/katexOptions.ts`).
- **Links into the report.** Prose links are written
  `href="report:Section title"` and become `hopcroftkarp.pdf#page=N`, with
  the page looked up in `src/data/report-pages.json`. A misspelled section
  title stops the build.
- **The PDF.** `../report/main.pdf` is copied into the build as
  `hopcroftkarp.pdf`, so the repository keeps a single copy.

## Scripts

Each needs Python 3; the requirements are listed at the top of each file.

| Script | When to run it |
| --- | --- |
| `scripts/report_pages.py` | After rebuilding the report: reads the PDF's outline into `src/data/report-pages.json`. |
| `scripts/make_social.py` | After changing the report's title page or the favicon: renders `public/og.png` (1200 × 630 pixels, for link previews) and the PNG icons. |
| `scripts/subset_fonts.py` | After adding fonts or characters outside the usual ranges: trims the fonts in `src/fonts/` to the characters the site uses. |

## Correctness

Widgets never draw from formulas when they can run the algorithm instead. The
engine is checked against the Python simulator on the report's examples and on
random ordered graphs, step by step. To refresh the traces after changing the
Python code:

```bash
cd ../code && python export_traces.py
```

## Sound and motion

Sounds are synthesized with the Web Audio API (there are no audio files) and
play only in response to the reader's actions; the volume and mute settings
are remembered. A compressor keeps fast playback from getting loud, and only
the landmarks (SAPs and rounds) sound at high speed. Animations respect the
`prefers-reduced-motion` setting.
