import { defineConfig, type Plugin } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { katexOptions } from './src/ui/katexOptions';

// The report PDF lives in ../report; serve it during development and copy it
// into the build as hopcroftkarp.pdf, so "Read the report" works on the site
// without keeping a second copy of the PDF in the repository.
const pdfPath = fileURLToPath(new URL('../report/main.pdf', import.meta.url));

// Prose links into the report are written href="report:Section title" in
// index.html and rewritten here, at build time, to hopcroftkarp.pdf#page=N.
// The page numbers come from src/data/report-pages.json, which
// scripts/report_pages.py extracts from the PDF's outline whenever the report
// is rebuilt; nothing is looked up in the visitor's browser. An unknown
// section title stops the build, so a stale link cannot ship.
const reportPages: Record<string, number> = JSON.parse(
  readFileSync(fileURLToPath(new URL('./src/data/report-pages.json', import.meta.url)), 'utf8'),
);

function reportLinks(html: string): string {
  return html.replace(/href="report:([^"]+)"/g, (_m, title: string) => {
    const page = reportPages[title];
    if (page === undefined) throw new Error(`index.html links to unknown report section "${title}"`);
    return `href="./hopcroftkarp.pdf#page=${page}" title="Report: ${title.replace(/"/g, '&quot;')} (page ${page})"`;
  });
}

// The prose math ($...$ inline, $$...$$ displayed) is typeset here, once, so
// readers never see raw TeX and the page needs no math script of its own.
function prerenderMath(html: string): string {
  const [head, body] = html.split('<body>');
  const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const render = (src: string, displayMode: boolean) =>
    katex.renderToString(unescape(src), { ...katexOptions, displayMode, throwOnError: true });
  const typeset = body
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, src: string) => render(src, true))
    .replace(/\$([^$]+?)\$/g, (_m, src: string) => render(src, false));
  return `${head}<body>${typeset}`;
}

function reportPdf(): Plugin {
  return {
    name: 'report-pdf',
    transformIndexHtml: (html) => prerenderMath(reportLinks(html)),
    configureServer(server) {
      server.middlewares.use('/hopcroftkarp.pdf', (_req, res) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.end(readFileSync(pdfPath));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'hopcroftkarp.pdf', source: readFileSync(pdfPath) });
    },
  };
}

// A relative base lets the same build work both at the custom domain
// (https://hopcroftkarp.site/) and at https://boonsuan.github.io/hopcroftkarp/.
export default defineConfig({
  base: './',
  plugins: [reportPdf()],
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
