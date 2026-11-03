/**
 * The six-pair graph of report §8.5: the schedule for s = 6 is consistent with
 * the graph, but no input order makes Algorithm H follow it. Readers choose
 * the girls' numbers and list orders themselves, or try all 103,680 inputs.
 */
import { runAlgorithmH } from '../engine/algorithmH';
import { sixPairNeighbours } from '../engine/examples';
import { button, h } from '../ui/controls';
import { icon } from '../ui/icons';
import { Scene, drawBoy, drawEdge, drawGirl } from '../ui/scene';
import * as sound from '../ui/sound';

/** All permutations of an array. */
function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, k) => permutations([...xs.slice(0, k), ...xs.slice(k + 1)]).map((p) => [x, ...p]));
}

const ORDERS = sixPairNeighbours.map((set) => permutations(set));

interface Outcome {
  couples: number;
  saps: number[];
  follows: boolean;
}

/** The input: numbering[k] is the number given to girl g_{k+1}; lists are indexed by number. */
function inputOf(numbering: number[], orderIdx: number[]): number[][] {
  const lists: number[][] = new Array(6);
  for (let k = 0; k < 6; k++) lists[numbering[k] - 1] = ORDERS[k][orderIdx[k]];
  return lists;
}

function evaluate(numbering: number[], orderIdx: number[]): Outcome {
  const lists = inputOf(numbering, orderIdx);
  const run = runAlgorithmH({ lists, N: 6 }, false);
  const couples = run.initialMatching.filter((x) => x).length;
  const saps = run.rounds.map((r) => r.saps.length);
  const follows = couples === 3 && saps.join(',') === '1,1,1' && run.rounds.map((r) => r.L).join(',') === '2,3,4';
  return { couples, saps, follows };
}

export function mountSixPair(root: HTMLElement): void {
  // Start from the most promising input: H1 gets the required matching
  // b1g2, b3g4, b5g6 and leaves the free girls in the order (g1, g3, g5) that the
  // proof shows is forced. The second round still removes two SAPs.
  let numbering = [3, 6, 2, 5, 1, 4];
  let orderIdx = [0, 0, 0, 2, 0, 0];
  const graphBox = h('div', { class: 'sixpair-graph' });
  const scene = new Scene(graphBox, ['edges', 'nodes', 'labels'], 'The six-pair graph with the matching made by step H1');
  const table = h('table', { class: 'data' });
  const result = h('div', { class: 'narration', style: 'margin-top:10px' });
  const tally = h('div', { class: 'caption' });
  const randomBtn = button(`${icon.shuffle} Random input`, () => {
    numbering = permutations([1, 2, 3, 4, 5, 6])[Math.floor(Math.random() * 720)];
    orderIdx = ORDERS.map((o) => Math.floor(Math.random() * o.length));
    render();
  }, { silent: true });
  const allBtn = button(`${icon.search} Try all 103,680 inputs`, () => tryAll(), { primary: true });
  const hint = h('div', { class: 'note', html:
    'The numbers always form a permutation: giving a girl another girl’s number swaps the two. ' +
    'The button with the arrow cycles through the orders of her list.' });
  root.append(h('div', { class: 'controls' }, [randomBtn, allBtn]),
    h('div', { class: 'sixpair' }, [graphBox, h('div', { style: 'overflow-x:auto;min-width:0' }, [table, hint])]), result, tally);

  /** The graph, girls above their partners b_k, with the couples made by step H1. */
  function drawGraph(): void {
    const lists = inputOf(numbering, orderIdx);
    const run = runAlgorithmH({ lists, N: 6 }, false);
    const gx = (k: number) => 30 + (k - 1) * 56;
    scene.viewBox(0, 0, 340, 150);
    scene.begin();
    for (let k = 1; k <= 6; k++) {
      const num = numbering[k - 1];
      for (const b of sixPairNeighbours[k - 1]) {
        drawEdge(scene, 'edges', `e${k}-${b}`, gx(k), 34, gx(b), 116, run.initialMatching[num - 1] === b ? 'couple' : 'edge');
      }
    }
    const matchedB = new Set(run.initialMatching.filter((x) => x));
    for (let k = 1; k <= 6; k++) {
      const num = numbering[k - 1];
      drawGirl(scene, 'nodes', `g${k}`, gx(k), 34, String(num), run.initialMatching[num - 1] ? '' : 'free');
      drawBoy(scene, 'nodes', `b${k}`, gx(k), 116, String(k), matchedB.has(k) ? '' : 'free');
      scene.el('labels', `gl${k}`, 'text', { class: 'lbl-small', x: gx(k), y: 12, 'text-anchor': 'middle' }, `g${'₀₁₂₃₄₅₆'[k]}`);
    }
    scene.el('labels', 'cap', 'text', { class: 'lbl-small', x: 170, y: 146, 'text-anchor': 'middle' }, 'numbers inside the circles: the girls’ input numbers');
    scene.end();
  }

  function render(): void {
    table.innerHTML = '<tr><th style="text-align:left">girl</th><th>neighbours</th><th>her number</th><th style="text-align:left">her list, in order</th></tr>';
    for (let k = 0; k < 6; k++) {
      const tr = h('tr');
      const numSel = h('select', { 'aria-label': `Number of girl ${k + 1}` });
      for (let v = 1; v <= 6; v++) numSel.append(h('option', { value: String(v) }, [String(v)]));
      numSel.value = String(numbering[k]);
      numSel.addEventListener('change', () => {
        // Swap numbers so that the numbering stays a permutation.
        const v = Number(numSel.value);
        const other = numbering.indexOf(v);
        numbering[other] = numbering[k];
        numbering[k] = v;
        render();
      });
      const order = ORDERS[k][orderIdx[k]];
      const cycle = button(`<span>${order.map((b) => `<i>b</i><sub>${b}</sub>`).join('&ensp;')}</span>${ORDERS[k].length > 1 ? icon.reset : ''}`, () => {
        orderIdx[k] = (orderIdx[k] + 1) % ORDERS[k].length;
        render();
      }, { title: 'Change the order of her list', silent: true });
      cycle.disabled = ORDERS[k].length === 1;
      tr.append(
        h('td', { style: 'text-align:left', html: `<i>g</i><sub>${k + 1}</sub>` }),
        h('td', { html: `{${sixPairNeighbours[k].map((b) => `<i>b</i><sub>${b}</sub>`).join(', ')}}` }),
        h('td', {}, [numSel]),
        h('td', { style: 'text-align:left' }, [cycle]),
      );
      table.append(tr);
    }
    drawGraph();
    const out = evaluate(numbering, orderIdx);
    const freeGirls = 6 - out.couples;
    if (out.couples !== 3) {
      result.innerHTML = `Step H1 makes ${out.couples} couples, so ${freeGirls} girl${freeGirls === 1 ? '' : 's'} start${freeGirls === 1 ? 's' : ''} free; ` +
        `the schedule needs exactly 3. ` +
        (out.saps.length ? `The rounds after H1 remove ${out.saps.join(', ')} SAP${out.saps.length === 1 && out.saps[0] === 1 ? '' : 's'}.` : 'No round after H1 finds a SAP.');
      sound.blocked();
    } else if (out.follows) {
      result.innerHTML = 'This input follows the schedule!';
      sound.success();
    } else {
      result.innerHTML = `H1 makes the right matching (3 couples), but the rounds remove ${out.saps.join(', ')} SAPs instead of 1, 1, 1.`;
      sound.note(3, 0.3);
    }
  }

  function tryAll(): void {
    allBtn.disabled = true;
    const perms = permutations([1, 2, 3, 4, 5, 6]);
    const combos: number[][] = [];
    const rec = (k: number, acc: number[]) => {
      if (k === 6) { combos.push(acc.slice()); return; }
      for (let t = 0; t < ORDERS[k].length; t++) { acc.push(t); rec(k + 1, acc); acc.pop(); }
    };
    rec(0, []);
    const counts = new Map<string, number>();
    let three = 0, follows = 0, done = 0;
    const total = perms.length * combos.length;
    let p = 0;
    const chunk = () => {
      const end = Math.min(perms.length, p + 24);
      for (; p < end; p++) {
        for (const c of combos) {
          const o = evaluate(perms[p], c);
          done++;
          if (o.couples !== 3) continue;
          three++;
          if (o.follows) follows++;
          const key = o.saps.join(', ');
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      tally.innerHTML = `Checked ${done.toLocaleString()} of ${total.toLocaleString()} inputs…`;
      if (p < perms.length) { window.setTimeout(chunk, 0); return; }
      const rows = [...counts.entries()].sort().map(([k, v]) => `<tr><td style="text-align:left">${k}</td><td>${v}</td></tr>`).join('');
      tally.innerHTML = `All ${total.toLocaleString()} inputs checked. ${three} of them give H1 three couples; ` +
        `<b>${follows}</b> follow the schedule. SAPs removed per round, among those ${three}:` +
        `<table class="data"><tr><th style="text-align:left">SAPs per round</th><th>inputs</th></tr>${rows}</table>`;
      sound.chime();
      allBtn.disabled = false;
    };
    chunk();
  }

  render();
}
