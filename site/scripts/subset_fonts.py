#!/usr/bin/env python3
"""Trim the Libertinus fonts in src/fonts to the characters the site uses.

The full fonts cover hundreds of scripts and symbols; the site needs Latin
text, Greek letters, the Cyrillic letter Ч (Tchoukaillon numbers), sub- and
superscript digits, arrows, and a few mathematical symbols. Kerning and
ligatures are kept. Subsetting is idempotent, so this can be rerun safely:

    python scripts/subset_fonts.py

Requires fontTools and brotli (pip install fonttools brotli).
"""
from __future__ import annotations

from pathlib import Path

from fontTools import subset

FONTS = Path(__file__).resolve().parent.parent / 'src' / 'fonts'

UNICODES = [
    *range(0x20, 0x7F),      # Basic Latin
    *range(0xA0, 0x180),     # Latin-1 Supplement, Latin Extended-A
    0x2C6, 0x2DA, 0x2DC,     # modifier accents
    *range(0x391, 0x3CA),    # Greek letters
    0x3D1, 0x3D5, 0x3F5,     # variant theta, phi, epsilon
    0x427, 0x447,            # Ч ч
    *range(0x2000, 0x2070),  # spaces, dashes, quotes, ellipsis
    *range(0x2070, 0x20A0),  # superscript and subscript digits and letters
    *range(0x2190, 0x2200),  # arrows
    *range(0x2200, 0x2300),  # mathematical operators
    0x2308, 0x2309, 0x230A, 0x230B,  # ceiling and floor
    0x22A4, 0x22A5,          # ⊤ ⊥
    0x25A0, 0x25CF, 0x2501, 0x254D,  # ■ ● ━ ╍ (chart legend)
    0x27E8, 0x27E9,          # angle brackets
    0x1D62, 0x2C7C,          # subscript i, j
]


def main() -> None:
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['kern', 'liga', 'clig', 'calt', 'onum', 'lnum', 'tnum', 'pnum', 'smcp', 'c2sc', 'ss01']
    options.name_IDs = ['*']
    options.notdef_outline = True
    for path in sorted(FONTS.glob('*.woff2')):
        before = path.stat().st_size
        font = subset.load_font(str(path), options)
        sub = subset.Subsetter(options)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        subset.save_font(font, str(path), options)
        print(f'{path.name}: {before // 1024} kB -> {path.stat().st_size // 1024} kB')


if __name__ == '__main__':
    main()
