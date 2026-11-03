/**
 * Step through Algorithm H. Four linked views: the graph with the current
 * matching, the dag of the current round (drawn as in the pre-fascicle's
 * figure (7), arcs pointing left from ⊤ to ⊥), the data structures, and the
 * list of steps H1-H17. The sandbox is the same widget with an editable input.
 */
import type { OrderedGraph, Run, Snapshot, StepEvent } from '../engine/algorithmH';
import { runAlgorithmH, roundCount } from '../engine/algorithmH';
import { Scene, drawBoy, drawEdge, drawGirl, trim } from '../ui/scene';
import { button, h, select, slider } from '../ui/controls';
import { icon } from '../ui/icons';
import type { Layout } from './layouts';
import { genericLayout } from './layouts';
import * as sound from '../ui/sound';

export interface StepperExample {
  id: string;
  name: string;
  graph: OrderedGraph;
  layout: Layout;
  blurb?: string;
}

interface StepperOptions {
  editable?: boolean;
  initialText?: string;
}

/** Our one-line paraphrases of the steps (the precise code is on pp. 4-5 of the pre-fascicle). */
const STEPS: Array<[number, string]> = [
  [1, 'Greedy start: a maximal matching; free girls into QUEUE.'],
  [2, 'Start building a dag.'],
  [3, 'Begin the next level.'],
  [4, 'Take the next girl of this level.'],
  [5, 'Take the next boy on her list.'],
  [6, 'Is he new? If he is already at the next level, insert her at the head of his BLINK list.'],
  [7, 'Go on to the next boy on her list.'],
  [8, 'Enter him into the next level (unless the last level is fixed and he is matched).'],
  [9, 'If he is matched, queue his mate; if he is free, the final level L is fixed.'],
  [10, 'Next level, or the dag is complete (stop if no free boy was reached).'],
  [11, 'Take the next root (a free boy of the last level); none left: reset marks.'],
  [12, 'Record the boy at this level of the search path.'],
  [13, 'Consume the first arc of his BLINK list; skip girls already used.'],
  [14, 'Free girl reached? Then a SAP is complete; otherwise go down a level.'],
  [15, 'List exhausted: back up a level (or give up on this root).'],
  [16, 'Remove the SAP’s girl from the free list (the last free girl takes her place).'],
  [17, 'Augment: flip the edges of the SAP.'],
];

export function mountStepper(root: HTMLElement, examples: StepperExample[], opts: StepperOptions = {}): {
  load: (id: string) => void;
  loadGraph: (graph: OrderedGraph, name: string, layout?: Layout, blurb?: string) => void;
  root: HTMLElement;
} {
  const uid = Math.random().toString(36).slice(2, 8);
  let example = examples[0];
  let run: Run = runAlgorithmH(example.graph);
  let idx = -1; // -1 = before step H1
  let timer: number | null = null;

  // ---------- DOM
  const picker = h('div', { class: 'controls' });
  const editor = h('div');
  const top = h('div', { class: 'controls transport' });
  const status = h('div', { class: 'readout status' });
  const narration = h('div', { class: 'narration', 'aria-live': 'polite' });
  const views = h('div', { class: 'grid-2 stepper-views' });
  const leftCol = h('div', { class: 'stack' });
  const rightCol = h('div', { class: 'stack' });
  const graphBox = h('div', { class: 'v-graph' });
  const dagBox = h('div', { class: 'v-dag' });
  const dataBox = h('div', { class: 'v-data' });
  const stepsBox = h('div', { class: 'v-steps' });
  leftCol.append(graphBox, dataBox);
  rightCol.append(dagBox, stepsBox);
  views.append(leftCol, rightCol);
  const blurb = h('div', { class: 'note' });
  const summary = h('div', { style: 'overflow-x:auto;margin-top:10px' });
  root.append(picker, editor, top, status, narration, views, blurb, summary);

  graphBox.append(h('div', { class: 'panel-title' }, ['Graph and matching']));
  dagBox.append(h('div', { class: 'panel-title' }, ['Dag of the current round']));
  const legend = h('div', { class: 'legend', html:
    '<span><svg viewBox="0 0 28 10"><path d="M2 5h22" class="lg-arc"/><path d="M20 1.5 26 5l-6 3.5z" class="lg-head"/></svg>arc (from ⊤ down to ⊥)</span>' +
    '<span><b class="lg-num">2</b>place in the boy’s BLINK list</span>' +
    '<span><svg viewBox="0 0 28 10"><path d="M2 5h24" class="lg-used"/></svg>arc already consumed</span>' +
    '<span><svg viewBox="0 0 28 10"><path d="M2 5h24" class="lg-search"/></svg>search path</span>' +
    '<span><svg viewBox="0 0 28 10"><path d="M3 5h22" class="lg-sap"/></svg>SAP found</span>' +
    '<span><svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" class="lg-free"/></svg>free</span>' +
    '<span><svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" class="lg-dead"/></svg>used by a SAP</span>' });
  const gScene = new Scene(graphBox, ['hooks', 'sap', 'edges', 'nodes'], 'The graph with the current matching');
  const dScene = new Scene(dagBox, ['sap', 'arcs', 'nodes', 'labels'], 'The dag of shortest augmenting paths');
  dScene.scrollable(0.85);
  dagBox.append(legend);
  // The arrowhead lives outside the keyed layers, so redrawing never removes it.
  dScene.svg.insertAdjacentHTML('afterbegin',
    `<defs><marker id="ah-${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    '<path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink-2)"/></marker></defs>');

  dataBox.append(h('div', { class: 'panel-title' }, ['Data structures']));
  const arrays = h('div', { class: 'arrays' });
  dataBox.append(arrays);
  stepsBox.append(h('div', { class: 'panel-title' }, ['Steps of Algorithm H']));
  const stepList = h('ol', { class: 'steps' });
  for (const [k, text] of STEPS) {
    stepList.append(h('li', { 'data-step': String(k) }, [h('span', { class: 'lbl' }, [`H${k}`]), h('span', {}, [text])]));
  }
  stepsBox.append(stepList);

  // ---------- Controls
  let exampleSelect: HTMLSelectElement | null = null;
  if (examples.length > 1) {
    const sel = select('Example', examples.map((e) => [e.id, e.name]), (v) => load(v));
    exampleSelect = sel.input;
    picker.append(sel.wrap);
  }
  // Every transport button is silent itself: the step it lands on makes the sound.
  const restartBtn = button(icon.restart, () => go(-1), { title: 'Back to the start, before H1', silent: true, label: 'Restart' });
  const backBtn = button(icon.back, () => go(idx - 1), { title: 'Previous step (←)', silent: true, label: 'Back' });
  const stepBtn = button(`Step ${icon.step}`, () => go(idx + 1), { title: 'Next step (→)', primary: true, silent: true });
  const playBtn = button('', () => togglePlay(), { title: 'Play or pause (space)', silent: true });
  const sapBtn = button(`SAP ${icon.next}`, () => jump((s) => s.event.kind === 'sap-complete'), { title: 'Run to the next completed SAP', silent: true });
  const roundBtn = button(`Round ${icon.next}`, () => jump((s) => s.event.kind === 'reset-marks' || s.done), { title: 'Run to the end of this round', silent: true });
  restartBtn.classList.add('icon');
  backBtn.classList.add('icon');
  const speed = slider('Speed', 1, 10, 5, () => { if (timer) { stop(); togglePlay(); } });
  speed.out.remove();
  top.append(restartBtn, backBtn, stepBtn, playBtn, sapBtn, roundBtn);
  picker.append(h('span', { class: 'spacer' }), speed.wrap);

  root.tabIndex = 0;
  root.setAttribute('aria-label', 'Algorithm H stepper. Arrow keys step, space plays or pauses.');
  root.addEventListener('keydown', (ev) => {
    // Leave keys alone when a control has focus: sliders need the arrows and
    // buttons need the space bar.
    if (ev.target !== root && (ev.target as Element).closest('input, select, button, textarea, a')) return;
    if (ev.key === 'ArrowRight') { go(idx + 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowLeft') { go(idx - 1); ev.preventDefault(); }
    else if (ev.key === ' ') { togglePlay(); ev.preventDefault(); }
  });

  // ---------- Editable input (sandbox)
  let textarea: HTMLTextAreaElement | null = null;
  const errorBox = h('div', { class: 'error' });
  if (opts.editable) {
    textarea = h('textarea', { class: 'lists', spellcheck: 'false', 'aria-label': 'Girl lists, one line per girl' });
    textarea.value = opts.initialText ?? '';
    const runBtn = button('Run Algorithm H', () => {
      const parsed = parseLists(textarea!.value);
      if (typeof parsed === 'string') { errorBox.textContent = parsed; sound.blocked(); return; }
      errorBox.textContent = '';
      loadGraph(parsed, 'your graph');
      sound.swoosh();
    }, { primary: true });
    editor.append(textarea, h('div', { class: 'controls' }, [runBtn, errorBox]));
  }

  function load(id: string): void {
    example = examples.find((e) => e.id === id) ?? examples[0];
    if (exampleSelect) exampleSelect.value = example.id;
    run = runAlgorithmH(example.graph);
    reset();
  }

  /** Load a graph from elsewhere (the sandbox editor, the catalog); it gets its own entry in the menu. */
  function loadGraph(graph: OrderedGraph, name: string, layout?: Layout, blurbText?: string): void {
    run = runAlgorithmH(graph);
    example = { id: 'custom', name, graph, layout: layout ?? genericLayout(graph), blurb: blurbText };
    if (exampleSelect) {
      let opt = exampleSelect.querySelector<HTMLOptionElement>('option[value="custom"]');
      if (!opt) {
        opt = h('option', { value: 'custom' });
        exampleSelect.append(opt);
      }
      opt.textContent = name;
      exampleSelect.value = 'custom';
    }
    reset();
  }

  /** The finished dag of each round, so the drawing can keep one scale per round. */
  let finishedDag = new Map<number, NonNullable<Snapshot['dag']>>();

  function reset(): void {
    finishedDag = new Map();
    for (const snap of run.snapshots) if (snap.dag && !finishedDag.has(snap.round)) finishedDag.set(snap.round, snap.dag);
    stop();
    gScene.clear();
    dScene.clear();
    blurb.innerHTML = example.blurb ?? '';
    blurb.hidden = !example.blurb;
    idx = -1;
    renderSummary();
    render();
  }

  function go(next: number): void {
    const clamped = Math.max(-1, Math.min(run.snapshots.length - 1, next));
    if (clamped === idx) { if (clamped === run.snapshots.length - 1) stop(); return; }
    const forward = clamped === idx + 1;
    idx = clamped;
    render();
    if (forward) playSound(run.snapshots[idx], timer !== null && delay() < 200);
    else sound.tick();
    if (timer && idx >= run.snapshots.length - 1) stop();
  }

  function jump(pred: (s: Snapshot) => boolean): void {
    stop();
    for (let k = idx + 1; k < run.snapshots.length; k++) {
      if (pred(run.snapshots[k])) {
        idx = k;
        render();
        playSound(run.snapshots[k]);
        return;
      }
    }
    go(run.snapshots.length - 1);
  }

  /** Milliseconds per step while playing: 1.4 s at speed 1 down to 0.11 s at speed 10. */
  const delay = () => 1400 / Math.pow(1.33, Number(speed.input.value) - 1);

  function togglePlay(): void {
    if (timer) { stop(); return; }
    if (idx >= run.snapshots.length - 1) idx = -1;
    playBtn.innerHTML = `${icon.pause}<span class="txt">Pause</span>`;
    narration.setAttribute('aria-live', 'off'); // don't flood screen readers while playing
    timer = window.setInterval(() => go(idx + 1), delay());
    go(idx + 1);
  }

  function stop(): void {
    if (timer) window.clearInterval(timer);
    timer = null;
    playBtn.innerHTML = `${icon.play}<span class="txt">Play</span>`;
    narration.setAttribute('aria-live', 'polite');
  }

  /** At fast playback only the landmarks sound: SAPs, augmentations, rounds. */
  function playSound(s: Snapshot, fast = false): void {
    const e = s.event;
    if (fast && !['sap-complete', 'reset-marks', 'terminate', 'round-start', 'first-free-boy'].includes(e.kind)) return;
    switch (e.kind) {
      case 'h1-match': sound.note(4, 0.35); break;
      case 'h1-free': sound.tick(); break;
      case 'discover': sound.discover(s.l); break;
      case 'head-insert': sound.note(9, 0.3); break;
      case 'first-free-boy': sound.note(11, 0.5); break;
      case 'consume': sound.note(Math.max(0, 2 + s.l), 0.5); break;
      case 'deleted': case 'root-fails': sound.blocked(); break;
      case 'sap-complete': sound.success(); break;
      case 'augment': sound.note(7, 0.22); break;
      case 'reset-marks': case 'terminate': sound.chime(); break;
      case 'round-start': sound.swoosh(); break;
      default: sound.tick();
    }
  }

  // ---------- Rendering
  function current(): Snapshot | null {
    return idx >= 0 ? run.snapshots[idx] : null;
  }

  function render(): void {
    const s = current();
    const L = example.layout;
    backBtn.disabled = idx < 0;
    restartBtn.disabled = idx < 0;
    stepBtn.disabled = idx >= run.snapshots.length - 1;
    sapBtn.disabled = roundBtn.disabled = stepBtn.disabled;

    // Status line and narration.
    if (!s) {
      status.innerHTML = `Before step H1. ${run.M} girls, ${run.N} boys, ${run.E} edges.`;
      narration.innerHTML = 'Press <b>Step</b> (or →) to run step H1, which scans the girls in decreasing order and gives each the first free boy on her list.';
    } else {
      const roundTxt = s.round === 1 ? 'Round 1 (step H1)' : s.round > roundCount(run) ? 'Final check' : `Round ${s.round}`;
      const levelTxt = s.L ? ` · dag level <i>L</i> = ${s.L}` : '';
      status.innerHTML = `${roundTxt}${levelTxt} · step <b>H${s.step}</b> · ${s.free.length} free girl${s.free.length === 1 ? '' : 's'}` +
        (s.round > 1 && s.round <= roundCount(run) ? ` · <i>W</i><sub>5</sub> = ${s.w5}, <i>W</i><sub>13</sub> = ${s.w13}, <i>W</i><sub>11</sub> = ${s.w11}` : '') +
        ` · snapshot ${idx + 1}/${run.snapshots.length}`;
      narration.innerHTML = narrate(s.event, s, s.step);
    }
    stepList.querySelectorAll('li').forEach((li) => li.classList.toggle('active', !!s && Number(li.getAttribute('data-step')) === s.step));

    drawGraph(s, L);
    drawDag(s, L);
    drawArrays(s, L);
  }

  function narrate(e: StepEvent, s: Snapshot, step: number): string {
    const G = example.layout.gLabel, B = example.layout.bLabel;
    const n = roundCount(run);
    // Some events recur at several steps; say what each step does.
    if (step === 4 && e.kind === 'level-start') return `Every girl of level <i>G</i><sub>${e.level}</sub> has been scanned.`;
    if (step === 5 && e.kind === 'scan-girl') return `${G(e.g)}’s list is exhausted; go back for the next girl of this level.`;
    if (step === 6 && e.kind === 'examine') return `${B(e.b)} is unmarked, so he is new to the dag.`;
    if (step === 7 && e.kind === 'scan-girl') return `Move on to the next boy on ${G(e.g)}’s list.`;
    switch (e.kind) {
      case 'h1-match': return `H1: girl ${G(e.g)} takes ${B(e.b)}, the first free boy on her list.`;
      case 'h1-free': return `H1: every boy on ${G(e.g)}’s list is taken, so she stays free and joins QUEUE.`;
      case 'round-start': return `A new round begins. The free girls form level <i>G</i><sub>0</sub> of the dag.`;
      case 'level-start': return `Scan the girls of level <i>G</i><sub>${e.level}</sub>, in QUEUE order.`;
      case 'scan-girl': return `Girl ${G(e.g)} scans her list.`;
      case 'examine': return `${G(e.g)} looks at ${B(e.b)}.`;
      case 'ignore': return `${B(e.b)} is already in an earlier level, so this edge is not an arc of the dag.`;
      case 'head-insert': return `${B(e.b)} was already found at this level, so ${G(e.g)} is inserted at the <b>front</b> of BLINK[${B(e.b)}].`;
      case 'skip-matched': return `The final level is already fixed and ${B(e.b)} is matched, so he is not entered.`;
      case 'discover': return `${B(e.b)} is new: he enters level <i>B</i><sub>${s.l + 1}</sub>, with ${G(e.g)} as the only entry of his BLINK list.`;
      case 'queue-mate': return `${B(e.b)} is matched, so his mate ${G(e.g)} joins the next girl level.`;
      case 'first-free-boy': return `${B(e.b)} is free! The final level is <i>L</i> = ${e.L}; the queue for the next level is discarded.`;
      case 'free-boy': return `${B(e.b)} is free too: another root for the search.`;
      case 'next-level': return `Level complete; go on to level ${e.level}.`;
      case 'dag-complete': return `The dag is complete, with level <i>L</i> = ${e.L}. Its free boys are the roots of the depth-first search.`;
      case 'terminate': return (s.free.length === 0
        ? 'No girls are free, so the matching is perfect.'
        : 'No free boy can be reached: no augmenting path exists, so the matching is maximum.') +
        ` Algorithm H stops; we count ${n} round${n === 1 ? '' : 's'}.`;
      case 'reset-marks': return `No roots left. The round found ${s.saps.length} SAP${s.saps.length === 1 ? '' : 's'}; reset ${e.count} marks and start again.`;
      case 'root': return `Start a search from the root ${B(e.b)}.`;
      case 'enter': return `The search path is now at ${B(e.b)} (level ${e.level}).`;
      case 'consume': return `Take the first arc of BLINK[${B(e.b)}], to ${G(e.g)}, and remove it from the list.`;
      case 'deleted': return `The arc from ${B(e.b)} leads to ${G(e.g)}, already used by a SAP of this round: skip it.`;
      case 'list-empty': return `BLINK[${B(e.b)}] is empty.`;
      case 'descend': return `${G(e.g)} is matched to ${B(e.b)}; continue from him at level ${e.level}.`;
      case 'sap-complete': return `${G(e.g)} is free: a shortest augmenting path is complete!`;
      case 'backtrack': return `Back up to level ${e.level}. (Arcs already consumed are gone for good.)`;
      case 'root-fails': return `This root has no path left: it fails.`;
      case 'remove-free': return e.moved === e.g
        ? `${G(e.g)} was in the last slot of the free list, so the other free girls keep their places.`
        : `${G(e.g)} leaves the free list; the last free girl, ${G(e.moved)}, moves into her slot.`;
      case 'augment': return `Augment: ${G(e.g)} and ${B(e.b)} become a couple.`;
      case 'augment-done': return 'Augmentation complete.';
    }
  }

  function sapPolyline(girls: number[], boys: number[], pos: (kind: 'g' | 'b', v: number) => [number, number] | null): string {
    const pts: string[] = [];
    for (let k = 0; k < girls.length; k++) {
      const pg = pos('g', girls[k]);
      const pb = pos('b', boys[k]);
      if (pg) pts.push(`${pg[0]},${pg[1]}`);
      if (pb) pts.push(`${pb[0]},${pb[1]}`);
    }
    return pts.length ? 'M' + pts.join(' L') : '';
  }

  function drawGraph(s: Snapshot | null, L: Layout): void {
    gScene.viewBox(-6, -6, L.width + 12, L.height + 12);
    gScene.begin();
    const gmate = s ? s.gmate : new Array(run.M).fill(0);
    const bmate = s ? s.bmate : new Array(run.N).fill(0);
    const pos = (kind: 'g' | 'b', v: number) => (kind === 'g' ? L.girl(v) : L.boy(v));
    if (s) {
      s.saps.forEach((p, k) => {
        gScene.el('sap', `gsap${s.round}-${k}`, 'path', { class: 'sap-path', d: sapPolyline(p.girls, p.boys, pos) });
      });
      // The path the depth-first search is currently exploring, from its root.
      if (s.dag && s.step >= 12 && s.step <= 15) {
        const pts: [number, number][] = [];
        for (let lv = s.dag.L; lv >= Math.max(1, s.l); lv--) {
          const b = s.boyPath[lv];
          if (!b) break;
          if (lv < s.dag.L) pts.push(L.girl(s.bmate[b - 1]));
          pts.push(L.boy(b));
        }
        if (s.event.kind === 'sap-complete') pts.push(L.girl(s.event.g));
        if (pts.length > 1) {
          gScene.el('sap', 'gcur', 'path', { class: 'search-path', d: 'M' + pts.map((p) => p.join(',')).join(' L') });
        }
      }
    }
    example.graph.lists.forEach((row, gi) => {
      const g = gi + 1;
      for (const b of row) {
        const [x1, y1] = L.girl(g), [x2, y2] = L.boy(b);
        const kind = gmate[g - 1] === b ? 'couple' : L.isPerfect(g, b) ? 'pedge' : 'edge';
        drawEdge(gScene, 'edges', `e${g}-${b}`, x1, y1, x2, y2, kind);
      }
    });
    const hotG = s && 'g' in s.event ? (s.event as { g: number }).g : 0;
    const hotB = s && 'b' in s.event ? (s.event as { b: number }).b : 0;
    for (let g = 1; g <= run.M; g++) {
      const [x, y] = L.girl(g);
      const cls = [gmate[g - 1] === 0 ? 'free' : '', g === hotG ? 'hot' : ''].join(' ');
      drawGirl(gScene, 'nodes', `g${g}`, x, y, L.gText(g), cls);
    }
    for (let b = 1; b <= run.N; b++) {
      const [x, y] = L.boy(b);
      const cls = [bmate[b - 1] === 0 ? 'free' : '', b === hotB ? 'hot' : ''].join(' ');
      drawBoy(gScene, 'nodes', `b${b}`, x, y, L.bText(b), cls);
    }
    gScene.end();
  }

  function drawDag(s: Snapshot | null, L: Layout): void {
    dScene.begin();
    if (!s || s.round === 1 || (s.bfsGirls.length === 0 && !s.dag)) {
      dScene.viewBox(0, 0, 420, 120);
      dScene.el('labels', 'empty', 'text', { class: 'lbl', x: 210, y: 60, 'text-anchor': 'middle' },
        s && s.round > 1 ? 'Building…' : 'The first dag is built after step H1.');
      dScene.end();
      return;
    }
    const girlLevels = s.dag ? s.dag.girlLevels : s.bfsGirls;
    const boyLevels = s.dag ? s.dag.boyLevels : s.bfsBoys;
    // The drawing keeps one scale for the whole round: that of the finished
    // dag (or of the search so far, if it is ever larger).
    const fin = finishedDag.get(s.round);
    const gl = (fin ? [fin.girlLevels, girlLevels] : [girlLevels]);
    const bl = (fin ? [fin.boyLevels, boyLevels] : [boyLevels]);
    // Columns from left to right: ⊥ (column 0), G_0, B_1, G_1, ..., then ⊤.
    // G_k is in column 2k+1 and B_k in column 2k.
    const lastCol = Math.max(...gl.map((x) => 2 * (x.length - 1) + 1), ...bl.map((x) => 2 * (x.length - 1)));
    const cols = lastCol + 2;
    const colGap = Math.min(78, 520 / (cols - 1));
    const rowGap = 34;
    const rows = Math.max(1, ...[...gl, ...bl].flatMap((lvls) => lvls.map((x) => x.length)));
    const height = rows * rowGap + 40;
    const width = (cols - 1) * colGap + 40;
    dScene.viewBox(-20, -10, width, height);
    const yOf = (k: number, n: number) => 14 + (k + (rows - n) / 2) * rowGap;
    const gpos = new Map<number, [number, number]>();
    const bpos = new Map<number, [number, number]>();
    girlLevels.forEach((lv, k) => lv.forEach((g, j) => gpos.set(g, [colGap * (1 + 2 * k), yOf(j, lv.length)])));
    boyLevels.forEach((lv, k) => lv.forEach((b, j) => k > 0 && bpos.set(b, [colGap * 2 * k, yOf(j, lv.length)])));
    const midY = yOf((rows - 1) / 2, rows);
    const bot: [number, number] = [0, midY];
    const top: [number, number] = [colGap * (cols - 1), midY];
    const arrow = `url(#ah-${uid})`;
    const arcLine = (key: string, a: [number, number], b: [number, number], cls: string, ra: number, rb: number) => {
      const [x1, y1, x2, y2] = trim(a[0], a[1], b[0], b[1], ra, rb);
      dScene.el('arcs', key, 'path', { class: `arc anim ${cls}`, d: `M${x1},${y1} L${x2},${y2}`, 'marker-end': arrow });
    };
    // Arcs from the free girls to ⊥.
    for (const g of girlLevels[0] ?? []) arcLine(`bot${g}`, gpos.get(g)!, bot, '', 12, 12);
    // Arcs from boys to girls one level down (the BLINK lists), and from girls to their mates.
    const initial = s.dag ? s.dag.blink : s.blink;
    boyLevels.forEach((lv, k) => {
      if (k === 0) return;
      for (const b of lv) {
        const list = initial.get(b) ?? [];
        const now = s.blink.get(b) ?? [];
        list.forEach((g, j) => {
          const p = gpos.get(g);
          if (!p) return;
          const used = s.dag ? !now.includes(g) : false;
          const hot = s.event.kind === 'consume' && s.event.b === b && s.event.g === g;
          arcLine(`a${b}-${g}`, bpos.get(b)!, p, used ? 'used' : hot ? 'hot' : '', 12, 13);
          if (list.length > 1) {
            // The arc's place in BLINK[b], halfway along it.
            const [bx, by] = bpos.get(b)!;
            dScene.el('labels', `o${b}-${g}`, 'text', {
              class: 'lbl-small halo', x: (bx + p[0]) / 2, y: (by + p[1]) / 2 + 4, 'text-anchor': 'middle',
            }, String(j + 1));
          }
        });
      }
    });
    girlLevels.forEach((lv, k) => {
      if (k === 0) return;
      for (const g of lv) {
        const mate = s.gmate[g - 1];
        const original = s.dag ? findMateInDag(s, g, k) : mate;
        if (original && bpos.has(original)) arcLine(`m${g}`, gpos.get(g)!, bpos.get(original)!, '', 12, 12);
      }
    });
    // Free boys of the last level to ⊤.
    const roots = s.dag ? s.dag.roots : [];
    for (const b of roots) arcLine(`top${b}`, top, bpos.get(b)!, '', 12, 12);
    // SAPs of this round, and the current search path.
    const posOf = (kind: 'g' | 'b', v: number) => (kind === 'g' ? gpos.get(v) ?? null : bpos.get(v) ?? null);
    s.saps.forEach((p, k) => dScene.el('sap', `dsap${s.round}-${k}`, 'path', { class: 'sap-path', d: sapPolyline(p.girls, p.boys, posOf) }));
    if (s.dag && s.step >= 12 && s.step <= 15) {
      const path: [number, number][] = [];
      for (let lv = s.dag.L; lv >= Math.max(1, s.l); lv--) {
        const b = s.boyPath[lv];
        if (!b || !bpos.has(b)) break;
        if (lv < s.dag.L) {
          const g = s.bmate[b - 1];
          const gp = gpos.get(g);
          if (gp) path.push(gp);
        }
        path.push(bpos.get(b)!);
      }
      if (path.length > 1) {
        dScene.el('sap', 'cur', 'path', { class: 'search-path', d: 'M' + path.map((p) => p.join(',')).join(' L') });
      }
    }
    // Nodes.
    const delG = s.deletedGirls, usedB = s.usedBoys;
    for (const [g, [x, y]] of gpos) {
      const cls = [delG.has(g) ? 'deleted' : '', s.gmate[g - 1] === 0 ? 'free' : ''].join(' ');
      drawGirl(dScene, 'nodes', `dg${g}`, x, y, L.gText(g), cls);
    }
    for (const [b, [x, y]] of bpos) {
      const cls = [usedB.has(b) ? 'deleted' : '', s.bmate[b - 1] === 0 ? 'free' : ''].join(' ');
      drawBoy(dScene, 'nodes', `db${b}`, x, y, L.bText(b), cls);
    }
    drawSpecial('bot', bot, '⊥');
    drawSpecial('top', top, '⊤');
    girlLevels.forEach((_, k) =>
      dScene.el('labels', `lg${k}`, 'text', { class: 'lbl', x: colGap * (1 + 2 * k), y: height - 14, 'text-anchor': 'middle' }, `G${sub(k)}`));
    boyLevels.forEach((_, k) => k > 0 &&
      dScene.el('labels', `lb${k}`, 'text', { class: 'lbl', x: colGap * 2 * k, y: height - 14, 'text-anchor': 'middle' }, `B${sub(k)}`));
    dScene.end();
  }

  /** In a finished dag, a girl's mate arc points to the boy who brought her in. */
  function findMateInDag(s: Snapshot, g: number, k: number): number {
    const lv = s.dag!.boyLevels[k] ?? [];
    const lvG = s.dag!.girlLevels[k] ?? [];
    const j = lvG.indexOf(g);
    // Girls of G_k are the mates of the matched boys of B_k, in order of discovery.
    const matched = lv.filter((b) => !s.dag!.roots.includes(b));
    return matched[j] ?? 0;
  }

  function drawSpecial(key: string, [x, y]: [number, number], label: string): void {
    const g = dScene.el('nodes', key, 'g', { class: 'anim', transform: `translate(${x}px, ${y}px)` });
    if (!g.firstChild) {
      g.innerHTML = `<circle r="11" style="fill:var(--panel);stroke:var(--ink-2);stroke-width:1.3"></circle><text class="vlabel">${label}</text>`;
    }
  }

  function drawArrays(s: Snapshot | null, L: Layout): void {
    arrays.innerHTML = '';
    const row = (name: string, content: HTMLElement | string) => {
      arrays.append(h('span', { class: 'name' }, [name]));
      const cell = typeof content === 'string' ? h('span', { html: content }) : content;
      arrays.append(cell);
    };
    const chips = (items: number[], cls: string, label: (v: number) => string, extra?: (v: number, i: number) => string) => {
      const box = h('div', { class: 'chips' });
      items.forEach((v, i) => box.append(h('span', { class: `chip ${cls} ${extra ? extra(v, i) : ''}`, html: label(v) })));
      if (items.length === 0) box.append(h('span', { class: 'note' }, ['(empty)']));
      return box;
    };
    if (!s) {
      row('free girls', chips([], 'girl', String));
      return;
    }
    const hotG = 'g' in s.event ? (s.event as { g: number }).g : 0;
    const hotB = 'b' in s.event ? (s.event as { b: number }).b : 0;
    row('free girls', chips(s.free, 'girl', L.gText, (g) => (g === hotG ? 'hot' : '')));
    if (s.round > 1 && !s.done) {
      const levels = s.dag ? s.dag.boyLevels.flat() : s.bfsBoys.flat();
      const roots = new Set(s.dag ? s.dag.roots : []);
      row('MARKED', chips(levels, 'boy', L.bText, (b) => (b === hotB ? 'hot' : roots.has(b) ? 'root' : '')));
      const blinkBox = h('div', { style: 'display:grid;gap:3px' });
      const initial = s.dag ? s.dag.blink : s.blink;
      for (const b of levels) {
        const now = s.blink.get(b) ?? [];
        const all = initial.get(b) ?? [];
        const r = h('div', { class: 'blink-row' });
        r.append(h('span', { class: `chip boy ${b === hotB ? 'hot' : ''}`, html: L.bText(b) }), h('span', { class: 'arrow' }, ['→']));
        r.append(chips(all, 'girl', L.gText, (g) => (!now.includes(g) && s.dag ? 'gone' : g === hotG && b === hotB ? 'hot' : '')));
        blinkBox.append(r);
      }
      row('BLINK', blinkBox);
      if (s.dag) {
        const path = [];
        for (let lv = 1; lv <= s.dag.L; lv++) path.push(s.boyPath[lv] ?? 0);
        row('BOY[1..L]', chips(path.filter((x) => x > 0), 'boy', L.bText));
      }
    }
    row('SAPs', s.saps.length
      ? s.saps.map((p) => p.girls.map((g, k) => `${L.gLabel(g)}–${L.bLabel(p.boys[k])}`).join('═')).join('<br>')
      : '<span class="note">none yet this round</span>');
  }

  function renderSummary(): void {
    const rows = run.rounds.map((r, k) =>
      `<tr><td>${k + 2}</td><td>${r.L}</td><td>${r.fBefore}</td><td>${r.saps.length}</td><td>${r.w5}</td><td>${r.w13}</td><td>${r.w11}</td></tr>`).join('');
    summary.innerHTML =
      `<table class="data"><thead><tr><th>round</th><th><i>L</i></th><th><i>f</i></th><th>SAPs</th>` +
      `<th><i>W</i><sub>5</sub></th><th><i>W</i><sub>13</sub></th><th><i>W</i><sub>11</sub></th></tr></thead>` +
      `<tbody><tr><td>1</td><td>(H1)</td><td>${run.initialQueue.length}</td><td>${run.initialMatching.filter((x) => x).length} couples</td>` +
      `<td colspan="3" style="text-align:left">${run.h1Exams} entries examined</td></tr>${rows}</tbody></table>` +
      `<div class="note">${roundCount(run)} rounds in all; final matching has ${run.finalMatching.filter((x) => x).length} couples.</div>`;
  }

  reset();
  return { load, loadGraph, root };
}

function sub(k: number): string {
  return String(k).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]).join('');
}

/** Parse "one line per girl" input: numbers on each line are her boys, in order. */
export function parseLists(text: string): OrderedGraph | string {
  const lines = text.split('\n').map((x) => x.replace(/#.*$/, '').trim()).filter((x) => x.length);
  if (lines.length === 0) return 'Enter at least one girl.';
  if (lines.length > 30) return 'Please keep it to at most 30 girls, so the pictures stay readable.';
  const lists: number[][] = [];
  for (const [k, line] of lines.entries()) {
    const body = line.replace(/^\s*\d+\s*:/, '');
    const tokens = body.trim() === '-' ? [] : body.split(/[\s,]+/).filter((t) => t.length);
    const bad = tokens.find((t) => !/^\d+$/.test(t));
    if (bad !== undefined) return `Line ${k + 1}: “${bad}” is not a boy number.`;
    const nums = tokens.map(Number);
    if (nums.some((b) => b < 1 || b > 30)) return `Line ${k + 1}: boys must be numbered 1 to 30.`;
    if (new Set(nums).size !== nums.length) return `Line ${k + 1}: a boy appears twice in the same list.`;
    lists.push(nums);
  }
  return { lists };
}
