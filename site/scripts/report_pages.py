#!/usr/bin/env python3
"""Write src/data/report-pages.json: the PDF page of every section of the report.

The website links into the report with URLs like hopcroftkarp.pdf#page=16.
Page numbers change whenever the report does, so they are read from the
PDF's outline (bookmarks) instead of being typed by hand. Rerun this after
rebuilding the report:

    python scripts/report_pages.py

Requires PyMuPDF (pip install pymupdf); the website itself needs nothing extra.
"""
from __future__ import annotations

import json
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent
PDF = HERE.parent.parent / 'report' / 'main.pdf'
OUT = HERE.parent / 'src' / 'data' / 'report-pages.json'


def main() -> None:
    with pymupdf.open(PDF) as doc:
        pages = {title: page for _level, title, page in doc.get_toc()}
    OUT.write_text(json.dumps(pages, indent=2, ensure_ascii=False) + '\n', encoding='utf8', newline='\n')
    print(f'{len(pages)} sections written to {OUT}')


if __name__ == '__main__':
    main()
