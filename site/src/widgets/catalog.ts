/**
 * The computed realizations of Appendix C, and those beyond them (found by
 * search.py, or by padding a smaller one): run Algorithm H on each one and compare the numbers of SAPs
 * with the Tchoukaillon schedule.
 */
import { runAlgorithmH, type OrderedGraph } from '../engine/algorithmH';
import { catalog, padded, searchFound } from '../engine/examples';
import { schedule } from '../engine/numbers';
import { button, h, select } from '../ui/controls';
import * as sound from '../ui/sound';
import { icon } from '../ui/icons';

export function mountCatalog(root: HTMLElement, openInStepper: (s: number, g: OrderedGraph) => void): void {
  const graphs = { ...catalog, ...searchFound };
  const sizes = Object.keys(graphs).map(Number).sort((a, b) => a - b);
  let s = 16;
  const sel = select('Size', sizes.map((v) => [String(v), v in catalog ? `s = ${v}` : padded.has(v) ? `s = ${v} (padding)` : `s = ${v} (search.py)`]),
    (v) => { s = Number(v); render(true); });
  sel.input.value = String(s);
  const open = button(`Watch it in the stepper ${icon.up}`, () => openInStepper(s, graphs[s]));
  const table = h('div', { style: 'overflow-x:auto' });
  const note = h('div', { class: 'caption' });
  root.append(h('div', { class: 'controls' }, [sel.wrap, open]), table, note);

  function render(audible = false): void {
    const g = graphs[s];
    const run = runAlgorithmH(g, false);
    const sch = schedule(s);
    const ok = run.initialQueue.length === Math.floor(s / 2) &&
      sch.length === run.rounds.length && sch.every((r, k) => run.rounds[k].L === r.L && run.rounds[k].saps.length === r.a);
    const cells = (f: (k: number) => string) => sch.map((_, k) => `<td>${f(k)}</td>`).join('');
    table.innerHTML = `<table class="data">
      <tr><th style="text-align:left">level <i>L</i></th>${sch.map((r) => `<th>${r.L}</th>`).join('')}</tr>
      <tr><td style="text-align:left">schedule: free girls / SAPs</td>${cells((k) => `${sch[k].f} / ${sch[k].a}`)}</tr>
      <tr class="${ok ? 'hot' : ''}"><td style="text-align:left">Algorithm H: free girls / SAPs</td>${cells((k) => run.rounds[k] ? `${run.rounds[k].fBefore} / ${run.rounds[k].saps.length}` : '–')}</tr>
    </table>`;
    const E = g.lists.reduce((a, r) => a + r.length, 0);
    const free = run.initialQueue.length;
    const source = s in catalog ? 'From Appendix C'
      : padded.has(s) ? `The padding of s = ${s - 2} (Prop. 8.8)` : 'Found by search.py';
    note.innerHTML = `${source}: ${s} girls and boys, ${E} edges. Step H1 leaves ${free} girl${free === 1 ? '' : 's'} free; ` +
      `${ok ? 'every round matches the schedule' : 'the run differs from the schedule'}, ${run.rounds.length + 1} rounds in all.`;
    if (audible) { if (ok) sound.note(5, 0.3); else sound.blocked(); }
  }
  render();
}
