#!/usr/bin/env python3
"""Render the link-preview image and the PNG icons into public/.

  public/og.png               1200x630 Open Graph card (Telegram, Slack, X, ...)
  public/apple-touch-icon.png 180x180, from public/favicon.svg
  public/favicon-32.png       32x32, for browsers without SVG favicons

The card shows the staircase figure from the report's title page, rasterized
from ../report/main.pdf. Requires PyMuPDF and Playwright (with the installed
Chrome): pip install pymupdf playwright. Rerun after changing the title page
or the favicon:

    python scripts/make_social.py
"""
from __future__ import annotations

from pathlib import Path

import pymupdf
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SITE = HERE.parent
PUBLIC = SITE / 'public'


def title_figure_png(path: Path) -> None:
    """Rasterize the staircase drawing on the report's title page (page 1)."""
    with pymupdf.open(SITE.parent / 'report' / 'main.pdf') as doc:
        page = doc[0]
        box = None
        for d in page.get_drawings():
            r = d['rect']
            if r.width < page.rect.width * 0.8:  # skip page-sized elements
                box = r if box is None else box | r
        page.get_pixmap(dpi=300, clip=box + (-6, -6, 6, 6), alpha=True).save(path)


def main() -> None:
    art = HERE / '_title_figure.png'
    title_figure_png(art)
    html = (HERE / 'social.html').read_text(encoding='utf8').replace('ART', art.name)
    page_file = HERE / '_social_render.html'
    page_file.write_text(html, encoding='utf8')
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width': 1200, 'height': 630})
        page.goto(page_file.as_uri())
        page.wait_for_timeout(400)  # fonts
        page.locator('#card').screenshot(path=str(PUBLIC / 'og.png'))
        for size, name in [(180, 'apple-touch-icon.png'), (32, 'favicon-32.png')]:
            icon = browser.new_page(viewport={'width': size, 'height': size})
            icon.goto((PUBLIC / 'favicon.svg').as_uri())
            icon.screenshot(path=str(PUBLIC / name), omit_background=True)
        browser.close()
    page_file.unlink()
    art.unlink()
    print('wrote og.png, apple-touch-icon.png, favicon-32.png to', PUBLIC)


if __name__ == '__main__':
    main()
