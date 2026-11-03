/** KaTeX settings shared by the build (prose math) and the widgets (live math). */
import type { KatexOptions } from 'katex';

export const katexOptions: KatexOptions = {
  throwOnError: false,
  strict: 'ignore',
  trust: false,
  macros: {
    // Tchoukaillon numbers, written with the Cyrillic letter Ч as in the pre-fascicle.
    '\\Ch': '\\text{Ч}',
    // Knuth's x --- y (an edge) and x === y (a couple).
    '\\sg': '\\mathrel{\\rule[0.52ex]{1.1em}{0.055em}}',
    '\\db': '\\mathrel{\\rule[0.36ex]{1.1em}{0.055em}\\mkern-19.8mu\\rule[0.7ex]{1.1em}{0.055em}}',
  },
};
