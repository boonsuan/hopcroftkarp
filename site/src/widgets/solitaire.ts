/**
 * Tchoukaillon solitaire (exercise 11). Pit k can be played only when it holds
 * exactly k stones; they are sown one each into pits k-1, ..., 1 and the store.
 * Starting from the unique winning position with s stones, the number of moves
 * made from pit L is a_L in the Tchoukaillon schedule (answer 15(c)).
 */
import { button, h, select } from '../ui/controls';
import { tex } from '../ui/math';
import { schedule, winningPosition } from '../engine/numbers';
import * as sound from '../ui/sound';

export function mountSolitaire(root: HTMLElement): void {
  let s = 16;
  let pits: number[] = [];
  let store = 0;
  let moves: number[] = [];
  let history: Array<{ pits: number[]; store: number; moves: number[] }> = [];

  const sizes: Array<[string, string]> = Array.from({ length: 29 }, (_, k) => [String(k + 2), `${k + 2} stones`]);
  const sel = select('', sizes, (v) => { s = Number(v); reset(); sound.swoosh(); });
  sel.input.value = String(s);
  const undo = button('Undo', () => { const st = history.pop(); if (st) { ({ pits, store, moves } = st); render(); } });
  const auto = button('Play the winning move', () => {
    const k = pits.findIndex((p, j) => j > 0 && p === j);
    if (k > 0) play(k);
  });
  const restart = button('Restart', () => { reset(); sound.swoosh(false); });
  root.append(h('div', { class: 'controls' }, [sel.wrap, auto, undo, restart]));
  const board = h('div', { class: 'board', role: 'group', 'aria-label': 'Tchoukaillon board' });
  const status = h('div', { class: 'readout', style: 'text-align:center;min-height:1.6em' });
  const table = h('div', { style: 'overflow-x:auto;display:flex;justify-content:center' });
  root.append(board, status, table);

  function reset(): void {
    pits = winningPosition(s);
    store = 0;
    moves = new Array(pits.length).fill(0);
    history = [];
    render();
  }

  function play(k: number): void {
    if (pits[k] !== k) {
      sound.blocked();
      status.innerHTML = `Pit ${k} holds ${pits[k]} stone${pits[k] === 1 ? '' : 's'}; it can be played only when it holds exactly ${k}.`;
      return;
    }
    history.push({ pits: pits.slice(), store, moves: moves.slice() });
    pits[k] = 0;
    for (let j = k - 1; j >= 1; j--) pits[j]++;
    store++;
    moves[k]++;
    const stuck = !pits.some((p, j) => j > 0 && p === j) && pits.some((p, j) => j > 0 && p > 0);
    if (store === s) sound.chime();
    else if (stuck) sound.blocked();
    else sound.note(Math.min(12, k + 1), 0.45);
    render();
  }

  function render(): void {
    board.innerHTML = '';
    const store_ = h('div', { class: 'pit store' });
    store_.append(stones(store), h('span', { class: 'count' }, [`store: ${store}`]));
    board.append(store_);
    for (let k = 1; k < pits.length; k++) {
      const pit = h('button', { class: `pit ${pits[k] === k ? 'playable' : ''}`, type: 'button', 'aria-label': `Pit ${k}, ${pits[k]} stone${pits[k] === 1 ? '' : 's'}` });
      pit.append(h('span', { class: 'num' }, [`pit ${k}`]), stones(pits[k]), h('span', { class: 'count' }, [String(pits[k])]));
      pit.addEventListener('click', () => play(k));
      board.append(pit);
    }
    if (store === s) status.innerHTML = `All ${s} stones are in the store: you have won.`;
    else if (!pits.some((p, j) => j > 0 && p === j)) status.innerHTML = 'No pit can be played: this position is lost. (From the winning position there is only one way to win.)';
    else status.innerHTML = 'Click a highlighted pit (it holds exactly as many stones as its number).';

    const sch = schedule(s);
    const head = `<tr><th>level ${tex('L')}</th>${sch.map((r) => `<th>${r.L}</th>`).join('')}</tr>`;
    const fRow = `<tr><td>free girls ${tex('f_L')}</td>${sch.map((r) => `<td>${r.f}</td>`).join('')}</tr>`;
    const aRow = `<tr><td>SAPs removed ${tex('a_L')}</td>${sch.map((r) => `<td>${r.a}</td>`).join('')}</tr>`;
    const mRow = `<tr class="${store === s ? 'hot' : ''}"><td>moves made from pit ${tex('L')}</td>${sch.map((r) => `<td>${moves[r.L] ?? 0}</td>`).join('')}</tr>`;
    table.innerHTML = `<table class="data">${head}${fRow}${aRow}${mRow}</table>`;
    undo.disabled = history.length === 0;
  }

  function stones(count: number): HTMLElement {
    const box = h('div', { class: 'stones' });
    for (let j = 0; j < Math.min(count, 30); j++) box.append(h('span', { class: 'stone' }));
    return box;
  }

  reset();
}
