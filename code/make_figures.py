#!/usr/bin/env python3
"""Write the data-driven figures of the report to ../report/figures/gen_*.

Every matching, dag, BLINK list and SAP drawn here is read off an actual run
of the reference simulator algorithm_h.py, so the pictures cannot drift from
what Algorithm H does. The plot data come from the exact formulas for R(s),
T(s), Q_n and Ch_n in examples.py.

    python make_figures.py

The TikZ files contain only pictures; the styles (girl, boy, couple, sap,
hook, ...) are defined in ../report/macros.tex.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import examples
from algorithm_h import run_h
from augmenting import augmenting_paths, basic_paths

OUT = Path(__file__).resolve().parent.parent / 'report' / 'figures'

Cell = tuple[int, int]
Point = tuple[float, float]

# Colours of the bands that mark basic paths (hooks), defined in macros.tex.
ROW_COLOURS = ['rowA', 'rowB', 'rowC', 'rowD', 'rowE', 'rowF', 'rowG', 'rowH']

# Layout of a staircase cell: column and row spacing, and the offsets of the
# girl (up and left) and of the boy (down and right) from the cell centre.
SCALE = dict(dx=1.9, dy=1.62, ox=.36, oy=.27)


def write(name: str, text: str) -> None:
    with open(OUT / name, 'w', encoding='utf8', newline='\n') as file:
        file.write(text)


def fmt(p: Point) -> str:
    return f'({p[0]:.3f},{p[1]:.3f})'


def wrap(body: str, options: str = '') -> str:
    return '\\begin{tikzpicture}[' + options + ']\n' + body + '\n\\end{tikzpicture}\n'


# ----------------------------------------------------------------------------
# Staircase graphs

def staircase_run(n: int) -> tuple[list[list[int]], list[Cell], list[Cell], dict]:
    """Gamma_n, the cells of its girls and boys, and its run."""
    adj = examples.staircase(n)
    girl_cells, boy_cells = examples.staircase_cells(n)
    return adj, girl_cells, boy_cells, run_h(adj)


def hooks_of(matching: list[int], girl_cells: list[Cell],
             boy_cells: list[Cell]) -> dict[int, list[Cell]]:
    """The basic paths with respect to the inside edges, as rows of cells,
    keyed by their free girl."""
    boy_at = {cell: b for b, cell in enumerate(boy_cells, 1)}
    inside = [boy_at[cell] for cell in girl_cells]
    paths = basic_paths(matching, inside, len(boy_cells))
    return {g: [girl_cells[x - 1] for x in girls] for g, girls in paths.items()}


def girl_xy(cell: Cell, s: dict = SCALE) -> Point:
    a, c = cell
    return ((c - 1) * s['dx'] - s['ox'], -(a - 1) * s['dy'] + s['oy'])


def boy_xy(cell: Cell, s: dict = SCALE) -> Point:
    a, c = cell
    return ((c - 1) * s['dx'] + s['ox'], -(a - 1) * s['dy'] - s['oy'])


def centre_xy(cell: Cell, s: dict = SCALE) -> Point:
    a, c = cell
    return ((c - 1) * s['dx'], -(a - 1) * s['dy'])


def draw_staircase(adj: list[list[int]], girl_cells: list[Cell], boy_cells: list[Cell],
                   matching: list[int], *, sap: dict | None = None,
                   rows: dict[int, list[Cell]] | None = None, order: list[int] | None = None,
                   labels: bool = True, small: bool = False, cell_labels: bool = False,
                   scale: float = 1.0) -> str:
    """TikZ commands (without the tikzpicture) for one state of a staircase graph.

    rows are coloured bands, drawn in the given order of their free girls;
    sap is shaded; inside edges that are not couples are drawn darker.
    """
    s = {k: v * scale for k, v in SCALE.items()}
    girl_style = 'small girl' if small else 'girl'
    boy_style = 'small boy' if small else 'boy'
    bmate = {b: g for g, b in enumerate(matching, 1) if b}
    out = [r'\begin{scope}[on background layer]']
    if rows:
        for k, g in enumerate(order or sorted(rows)):
            cells = rows[g]
            points = ' -- '.join(fmt(centre_xy(c, s)) for c in cells)
            if len(cells) == 1:
                points = fmt(centre_xy(cells[0], s)) + ' -- ' + fmt(centre_xy(cells[0], s))
            out.append(rf'\draw[hook,{ROW_COLOURS[k % len(ROW_COLOURS)]}] {points};')
    if sap:
        points = []
        for g, b in zip(sap['girls'], sap['boys']):
            points += [girl_xy(girl_cells[g - 1], s), boy_xy(boy_cells[b - 1], s)]
        out.append(r'\draw[sap] ' + ' -- '.join(fmt(p) for p in points) + ';')
    out.append(r'\end{scope}')
    for g, row in enumerate(adj, 1):
        for b in row:
            p, q = girl_xy(girl_cells[g - 1], s), boy_xy(boy_cells[b - 1], s)
            if matching[g - 1] == b:
                style = 'couple'
            elif girl_cells[g - 1] == boy_cells[b - 1]:
                style = 'pedge'
            else:
                style = 'edge'
            out.append(rf'\draw[{style}] {fmt(p)} -- {fmt(q)};')
    for g, cell in enumerate(girl_cells, 1):
        style = girl_style + (',free' if matching[g - 1] == 0 else '')
        out.append(rf'\node[{style}] at {fmt(girl_xy(cell, s))} {{{g if labels else ""}}};')
    for b, cell in enumerate(boy_cells, 1):
        style = boy_style + (',free' if b not in bmate else '')
        out.append(rf'\node[{style}] at {fmt(boy_xy(cell, s))} {{{b if labels else ""}}};')
    if cell_labels:
        for cell in boy_cells:
            x, y = centre_xy(cell, s)
            out.append(rf'\node[lab,font=\scriptsize,text=black!50,anchor=west] at '
                       rf'({x - .06 * scale:.3f},{y + .36 * scale:.3f}) '
                       rf'{{$({cell[0]},{cell[1]})$}};')
    return '\n'.join(out)


def fig_gamma5() -> None:
    """Gamma_5 after H1, with cell labels and the omitted corner edge (Section 2.4)."""
    adj, girl_cells, boy_cells, run = staircase_run(5)
    scale = 1.3
    s = {k: v * scale for k, v in SCALE.items()}
    body = draw_staircase(adj, girl_cells, boy_cells, run['h1_matching'],
                          cell_labels=True, scale=scale)
    p, q = boy_xy((3, 2), s), girl_xy((4, 2), s)
    body += '\n' + (r'\draw[edgecol,line width=.5pt,dash pattern=on 1.2pt off 1.6pt] '
                    rf'{fmt(p)} -- {fmt(q)};')
    mid = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    body += '\n' + (rf'\node[lab,anchor=west,font=\scriptsize] at '
                    rf'({mid[0] + .14:.3f},{mid[1] - .05:.3f}) {{omitted}};')
    write('gen_gamma5.tex', wrap(body))


def fig_gamma5_rounds() -> None:
    """One panel per state of Gamma_5: hooks, and the SAP of the next round (Section 5.2)."""
    adj, girl_cells, boy_cells, run = staircase_run(5)
    states = [(rd['matching_before'], rd['saps'][0], rd['L'], rd['f_before'])
              for rd in run['rounds']]
    states.append((run['final_matching'], None, None, 0))
    panels = []
    for matching, sap, L, f in states:
        rows = hooks_of(matching, girl_cells, boy_cells)
        order = sorted(rows, key=lambda g: girl_cells[g - 1])
        body = draw_staircase(adj, girl_cells, boy_cells, matching, sap=sap, rows=rows,
                              order=order, labels=False, small=True, scale=.62)
        caption = rf'$L={L}$, $f={f}$' if L else 'perfect matching'
        body += '\n' + rf'\node[font=\footnotesize,anchor=north] at (1.2,-3.55) {{{caption}}};'
        lengths = ','.join(str(len(rows[g])) for g in order)
        if lengths:
            body += '\n' + (r'\node[font=\scriptsize,text=black!60,anchor=north] at (1.2,-3.98) '
                            rf'{{cells $({lengths})$}};')
        panels.append(wrap(body, 'baseline=(current bounding box.north)'))
    write('gen_gamma5_rounds.tex', '\\hspace{7mm}'.join(panels))


def fig_gamma5_dag() -> None:
    """The first dag of Gamma_5, drawn as in the pre-fascicle's figure (7) (Section 2.4).

    Columns are the levels G_0, B_1, G_1, B_2; arcs point from a boy to the
    girls of his BLINK list, numbered when there are two.
    """
    _, _, _, run = staircase_run(5)
    rd = run['rounds'][0]
    matching = rd['matching_before']
    bmate = {b: g for g, b in enumerate(matching, 1) if b}
    free_girls = rd['queue_before']
    blink = rd['blink']
    # A boy's level is one more than that of the girls on his BLINK list.
    girl_level = {g: 0 for g in free_girls}
    boys_at = {1: [], 2: []}
    girls_at = {0: list(free_girls), 1: []}
    for b in rd['marked']:
        level = girl_level[blink[b][0]] + 1
        boys_at[level].append(b)
        if level < rd['L'] and b in bmate:
            girl_level[bmate[b]] = level
            girls_at[level].append(bmate[b])
    X = {'bot': 0, 'G0': 1.55, 'B1': 3.1, 'G1': 4.65, 'B2': 6.2, 'top': 7.75}
    dy = .82
    pos = {}
    for i, g in enumerate(girls_at[0]):
        pos['g', g] = (X['G0'], -i * dy)
    for i, b in enumerate(boys_at[1]):
        pos['b', b] = (X['B1'], -i * dy)
    for i, g in enumerate(girls_at[1]):
        pos['g', g] = (X['G1'], -i * dy)
    for i, b in enumerate(boys_at[2]):
        pos['b', b] = (X['B2'], -i * dy)
    ymid = -(len(free_girls) - 1) * dy / 2
    sap = rd['saps'][0]
    sap_vertices = []
    for g, b in zip(sap['girls'], sap['boys']):
        sap_vertices += [('g', g), ('b', b)]
    out = [r'\begin{scope}[on background layer]']
    points = [(X['bot'], ymid)] + [pos[v] for v in sap_vertices] + [(X['top'], ymid)]
    out.append(r'\draw[sap] ' + ' -- '.join(fmt(p) for p in points) + ';')
    out.append(r'\end{scope}')
    for (kind, v), p in pos.items():
        style = 'girl' if kind == 'g' else 'boy'
        out.append(rf'\node[{style}] ({kind}{v}) at {fmt(p)} {{${kind}_{{{v}}}$}};')
    out.append(r'\node[circle,draw,inner sep=1pt,minimum size=5mm] (bot) at '
               rf'{fmt((X["bot"], ymid))} {{$\bot$}};')
    out.append(r'\node[circle,draw,inner sep=1pt,minimum size=5mm] (top) at '
               rf'{fmt((X["top"], ymid))} {{$\top$}};')
    # A matched boy of the last level is in the dag but his mate is not:
    # draw her faded.
    for b in boys_at[2]:
        if b in bmate:
            g = bmate[b]
            p = pos['b', b]
            out.append(rf'\node[girl,dashed,opacity=.45] (gx{g}) at '
                       rf'({p[0] + 1.0:.3f},{p[1] + .55:.3f}) {{$g_{{{g}}}$}};')
            out.append(rf'\draw[arc,dashed,opacity=.45] (gx{g}) -- (b{b});')
    for g in girls_at[0]:
        out.append(rf'\draw[arc] (g{g}) -- (bot);')
    for g in girls_at[1]:
        out.append(rf'\draw[arc] (g{g}) -- (b{matching[g - 1]});')
    for b, girls in blink.items():
        for k, g in enumerate(girls, 1):
            label = ('' if len(girls) == 1 else
                     rf'node[pos=.24,fill=white,inner sep=.5pt,font=\scriptsize] {{{k}}}')
            out.append(rf'\draw[arc] (b{b}) -- {label} (g{g});')
    for b in rd['roots']:
        out.append(rf'\draw[arc] (top) -- (b{b});')
    for key, label in [('G0', 'G_0'), ('B1', 'B_1'), ('G1', 'G_1'), ('B2', 'B_2')]:
        out.append(rf'\node at ({X[key]:.3f},{-(len(free_girls) - 1) * dy - .75:.3f}) '
                   rf'{{${label}$}};')
    write('gen_gamma5_dag.tex', wrap('\n'.join(out)))


def fig_hooks(n: int, f: int, name: str, row_labels: bool) -> None:
    """State f of Gamma_n: the hooks and the staircase SAP (Section 5.3, title page)."""
    adj, girl_cells, boy_cells, run = staircase_run(n)
    rd = next(rd for rd in run['rounds'] if rd['f_before'] == f)
    rows = hooks_of(rd['matching_before'], girl_cells, boy_cells)
    order = sorted(rows, key=lambda g: girl_cells[g - 1])
    scale = .72
    body = draw_staircase(adj, girl_cells, boy_cells, rd['matching_before'],
                          sap=rd['saps'][0], rows=rows, order=order,
                          labels=False, small=True, scale=scale)
    if row_labels:
        s = {k: v * scale for k, v in SCALE.items()}
        for x, g in enumerate(order, 1):
            cx, cy = centre_xy(girl_cells[g - 1], s)
            body += '\n' + (rf'\node[font=\scriptsize,anchor=east] at '
                            rf'({cx - .55:.3f},{cy:.3f}) {{hook {x}}};')
    write(f'{name}.tex', wrap(body))


def fig_straight(n: int = 10, f: int = 7) -> None:
    """The dag of state f of Gamma_n with every hook straightened (Section 5.5).

    Row x is hook x, and column y holds the girl and the boy at position y.
    The arcs are exactly the BLINK lists recorded by the simulator.
    """
    _, girl_cells, boy_cells, run = staircase_run(n)
    rd = next(rd for rd in run['rounds'] if rd['f_before'] == f)
    matching = rd['matching_before']
    L = rd['L']
    rows = hooks_of(matching, girl_cells, boy_cells)
    order = sorted(rows, key=lambda g: girl_cells[g - 1])
    longest = max(len(r) for r in rows.values())
    girl_at = {cell: g for g, cell in enumerate(girl_cells, 1)}
    boy_at = {cell: b for b, cell in enumerate(boy_cells, 1)}
    DX, DY, O = 1.32, .78, .3
    gp, bp = {}, {}
    for x, g0 in enumerate(order, 1):
        for y, cell in enumerate(rows[g0], 1):
            gp[girl_at[cell]] = ((y - 1) * DX - O, -(x - 1) * DY)
            bp[boy_at[cell]] = ((y - 1) * DX + O, -(x - 1) * DY)
    blink = rd['blink']
    out = [r'\begin{scope}[on background layer]']
    points = []
    for g, b in zip(rd['saps'][0]['girls'], rd['saps'][0]['boys']):
        points += [gp[g], bp[b]]
    out.append(r'\draw[sap] ' + ' -- '.join(fmt(p) for p in points) + ';')
    # Shade the positions beyond level L, which the dag does not reach.
    out.append(r'\fill[black!4] ' + f'({(L - .5) * DX:.3f},{.45:.3f}) rectangle '
               + f'({(longest - .45) * DX:.3f},{-(f - 1) * DY - .45:.3f});')
    out.append(r'\end{scope}')
    bmate = {b: g for g, b in enumerate(matching, 1) if b}
    for b, g in bmate.items():
        if b in bp and g in gp:
            out.append(rf'\draw[couple] {fmt(bp[b])} -- {fmt(gp[g])};')
    for b, girls in blink.items():
        for g in girls:
            out.append(rf'\draw[arc,shorten >=2.6mm,shorten <=2.4mm] {fmt(bp[b])} -- {fmt(gp[g])};')
    for x, g0 in enumerate(order, 1):
        for y, cell in enumerate(rows[g0], 1):
            if y > L:
                out.append(rf'\draw[pedge,opacity=.35] {fmt(gp[girl_at[cell]])} -- '
                           rf'{fmt(bp[boy_at[cell]])};')
    for g, p in gp.items():
        out.append(rf'\node[small girl{",free" if matching[g - 1] == 0 else ""}] at {fmt(p)} {{}};')
    for b, p in bp.items():
        style = 'small boy' + (',free' if b not in bmate else '')
        if b not in blink:
            style += ',opacity=.4'
        out.append(rf'\node[{style}] at {fmt(p)} {{}};')
    for x in range(1, f + 1):
        out.append(rf'\node[font=\scriptsize,anchor=east] at ({-O - .3:.3f},{-(x - 1) * DY:.3f}) '
                   rf'{{hook {x}}};')
    for y in range(1, longest + 1):
        out.append(rf'\node[font=\scriptsize,text=black!60] at ({(y - 1) * DX:.3f},{.55:.3f}) '
                   rf'{{{y}}};')
    out.append(rf'\node[font=\scriptsize,text=black!60,anchor=east] at ({-O - .3:.3f},{.55:.3f}) '
               r'{position};')
    write('gen_straight.tex', wrap('\n'.join(out)))


def fig_shape(n: int = 11) -> None:
    """The cell diagram of Gamma_n, with the corner cell shaded (Section 5.1)."""
    r = n - 1
    lengths = examples.staircase_row_lengths(n)
    w = .5
    out = []
    for a, length in enumerate(lengths, 1):
        for c in range(1, length + 1):
            x, y = (c - 1) * w, -(a - 1) * w
            fill = 'sapcol!45' if (a, c) == (r, 2) else 'boyfill'
            out.append(rf'\draw[fill={fill},draw=boydraw!70] ({x:.2f},{y:.2f}) '
                       rf'rectangle +({w:.2f},{w:.2f});')
        out.append(rf'\node[font=\scriptsize,anchor=east] at (-.05,{-(a - 1) * w + w / 2:.2f}) '
                   rf'{{{length}}};')
    out.append(rf'\node[font=\scriptsize,anchor=west] at ({2 * w + .1:.2f},'
               rf'{-(r - 1) * w + w / 2:.2f}) {{$\leftarrow$ corner}};')
    out.append(rf'\node[font=\scriptsize,anchor=north] at ({1.5 * w:.2f},{-r * w + w - .1:.2f}) '
               rf'{{$n={n}$, $s={sum(lengths)}$}};')
    write('gen_shape.tex', wrap('\n'.join(out)))


# ----------------------------------------------------------------------------
# Other graphs

def fig_halving(f: int = 4) -> None:
    """The halving graph after H1 (Section 7.2, Appendix B)."""
    adj = examples.halving(f)
    girl_number, boy_number = examples.halving_numbers(f)
    matching = run_h(adj)['h1_matching']
    girl_name = {v: k for k, v in girl_number.items()}
    boy_name = {v: k for k, v in boy_number.items()}
    pos = {}
    dx = 1.55
    for i in range(1, f + 1):
        x = (i - 1) * dx
        pos['u', i] = (x, 1.5)
        pos['b', i] = (x, .5)
        pos['c', i] = (x, -.5)
        pos['d', i] = (x, -1.5)
    out = []
    for g, row in enumerate(adj, 1):
        for b in row:
            pg, pb = pos[girl_name[g]], pos[boy_name[b]]
            if matching[g - 1] == b:
                out.append(rf'\draw[couple] {fmt(pg)} -- {fmt(pb)};')
            elif girl_name[g][1] == boy_name[b][1]:
                out.append(rf'\draw[pedge] {fmt(pg)} -- {fmt(pb)};')
            else:
                out.append(rf'\draw[edge,draw=black!55,line width=.75pt] {fmt(pg)} '
                           rf'to[bend left=12] {fmt(pb)};')
    for (kind, i), p in pos.items():
        is_girl = kind in 'uc'
        number = girl_number[kind, i] if is_girl else boy_number[kind, i]
        free = matching[number - 1] == 0 if is_girl else number not in matching
        style = ('girl' if is_girl else 'boy') + (',free' if free else '')
        out.append(rf'\node[{style}] at {fmt(p)} {{${kind}_{{{i}}}$}};')
    write('gen_halving.tex', wrap('\n'.join(out)))


def draw_general(adj: list[list[int]], girl_pos: dict[int, Point], boy_pos: dict[int, Point],
                 matching: list[int], saps: list[dict] = (), faint: list[dict] = ()) -> str:
    """TikZ commands for an ordered graph at given positions, with shaded paths."""
    def path_points(path: dict) -> str:
        points = []
        for g, b in zip(path['girls'], path['boys']):
            points += [girl_pos[g], boy_pos[b]]
        return ' -- '.join(fmt(p) for p in points)

    out = [r'\begin{scope}[on background layer]']
    for path in saps:
        out.append(r'\draw[sap] ' + path_points(path) + ';')
    for path in faint:
        out.append(r'\draw[sap,draw=boydraw,opacity=.2] ' + path_points(path) + ';')
    out.append(r'\end{scope}')
    bmate = {b: g for g, b in enumerate(matching, 1) if b}
    for g, row in enumerate(adj, 1):
        for b in row:
            style = 'couple' if matching[g - 1] == b else 'edge,draw=black!55,line width=.7pt'
            out.append(rf'\draw[{style}] {fmt(girl_pos[g])} -- {fmt(boy_pos[b])};')
    for g, p in girl_pos.items():
        out.append(rf'\node[girl{",free" if matching[g - 1] == 0 else ""}] at {fmt(p)} {{{g}}};')
    for b, p in boy_pos.items():
        out.append(rf'\node[boy{",free" if b not in bmate else ""}] at {fmt(p)} {{{b}}};')
    return '\n'.join(out)


def fig_tree8() -> None:
    """The 8-pair tree before rounds 2 and 3 (Section 8.2)."""
    adj = examples.tree8()
    run = run_h(adj)
    girl_pos = {4: (0, 0), 5: (2, 0), 7: (4, 0), 1: (6, 0), 8: (8, 0),
                2: (5, -1.1), 3: (4, -2.2), 6: (6, -2.2)}
    boy_pos = {1: (1, 0), 2: (3, 0), 5: (5, 0), 7: (7, 0), 8: (9, 0),
               6: (4, -1.1), 3: (5, -2.2), 4: (7, -2.2)}
    girl_pos = {k: (x * 1.02, y * .82) for k, (x, y) in girl_pos.items()}
    boy_pos = {k: (x * 1.02, y * .82) for k, (x, y) in boy_pos.items()}
    first, second = run['rounds'][0], run['rounds'][1]
    # The second state also has an augmenting path of level 4, drawn faintly.
    girls, boys = next(p for p in augmenting_paths(adj, second['matching_before'])
                       if len(p[1]) == 4)
    level4 = dict(girls=girls, boys=boys)
    top = draw_general(adj, girl_pos, boy_pos, first['matching_before'], saps=first['saps'])
    bottom = draw_general(adj, girl_pos, boy_pos, second['matching_before'],
                          saps=second['saps'], faint=[level4])
    tex = (wrap(top + '\n' + r'\node[font=\footnotesize] at (4.6,-2.45) '
                r'{after \Hs1: $f=4$, $L=2$};')
           + '\n\\bigskip\n\n'
           + wrap(bottom + '\n' + r'\node[font=\footnotesize] at (4.6,-2.45) '
                  r'{after round 2: $f=2$, $L=3$};'))
    write('gen_tree8.tex', tex)


def fig_caterpillar(K: int = 4) -> None:
    """The caterpillar tree after H1, with the SAP of its first dag round (Section 9)."""
    adj = examples.caterpillar(K)
    run = run_h(adj)
    girl_pos, boy_pos = {}, {}
    x = 0.0
    for k in range(2, K + 1):
        c = k * (k - 1) // 2
        for i in range(k):
            girl_pos[c + i] = (x, 0)
            x += .8
            if i < k - 1:
                boy_pos[c + i] = (x, 0)
                x += .8
            else:
                boy_pos[c + i] = (x - .8, -.95)     # the leaf y_(k-1), below x_(k-1)
        x += .45
    body = draw_general(adj, girl_pos, boy_pos, run['h1_matching'], saps=run['rounds'][0]['saps'])
    write('gen_caterpillar.tex', wrap(body, 'scale=1'))


# ----------------------------------------------------------------------------
# Plot data (Section 6)

def plot_data() -> None:
    """R(s) and T(s) for s <= 400 (raw and divided by sqrt(s)), the sizes s <= 64
    where R(s) > T(s) (as shaded bars), and Ch_n against Q_n for n <= 30."""
    rows = ['s R T Rn Tn\n']
    for s in range(1, 401):
        R, T = examples.max_rounds(s), examples.tchoukaillon_rounds(s)
        rows.append(f'{s} {R} {T} {R / math.sqrt(s):.5f} {T / math.sqrt(s):.5f}\n')
    write('gen_rounds.dat', ''.join(rows))
    bars = []
    for s in range(1, 65):
        if examples.max_rounds(s) > examples.tchoukaillon_rounds(s):
            bars.append(rf'\fill[sapcol!18] (axis cs:{s - .5},0) rectangle (axis cs:{s + .5},16);'
                        + '\n')
    write('gen_beats.tex', ''.join(bars))
    rows = ['n Ch Q\n']
    for n in range(1, 31):
        rows.append(f'{n} {examples.tchoukaillon_number(n)} {examples.quarter_square(n)}\n')
    write('gen_chq.dat', ''.join(rows))


def main() -> None:
    argparse.ArgumentParser(description=__doc__,
                            formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    OUT.mkdir(exist_ok=True)
    fig_gamma5()
    fig_gamma5_rounds()
    fig_gamma5_dag()
    fig_hooks(n=11, f=5, name='gen_hooks', row_labels=True)
    fig_hooks(n=9, f=4, name='gen_hooks_title', row_labels=False)
    fig_shape()
    fig_straight()
    fig_tree8()
    fig_caterpillar()
    fig_halving()
    plot_data()
    print('figures written to', OUT)


if __name__ == '__main__':
    main()
