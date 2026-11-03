/**
 * Math in widgets. The prose math in index.html ($...$ and $$...$$) is turned
 * into HTML at build time by vite.config.ts, so only widget text needs KaTeX
 * in the browser.
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { katexOptions } from './katexOptions';

/** Render a TeX string to HTML. */
export function tex(src: string, display = false): string {
  return katex.renderToString(src, { ...katexOptions, displayMode: display });
}
