/**
 * Step 4 of the proof of Theorem U. After augmenting along a selected SAP S,
 * its couples e_k (from g_{k-1} to b_k) can only be used "in position". If two
 * disjoint augmenting paths A_i and A_j crossed S at e_i and e_j, splicing
 * them along S would give an augmenting path with 4(j-i) more edges.
 */
import { Scene, drawBoy, drawEdge, drawGirl, mathLabel } from '../ui/scene';
import { checkbox, h, slider } from '../ui/controls';
import { tex } from '../ui/math';
import * as sound from '../ui/sound';

export function mountSplice(root: HTMLElement): void {
  let L = 5, i = 2, j = 4, show = true;
  const lCtl = slider('L', 3, 7, L, (v) => { L = v; j = Math.min(j, L); i = Math.min(i, j - 1); sync(); draw(); sound.tick(); });
  // i < j always. A thumb dragged past that bound is put back, and the browser
  // then reports the same overshoot on every move of the pointer, so redraw and
  // sound only when the value really changes.
  const iCtl = slider('i', 1, L - 1, i, (v) => {
    const next = Math.min(v, j - 1);
    const changed = next !== i;
    i = next; sync();
    if (changed) { draw(); sound.note(i + 2, 0.35); }
  });
  const jCtl = slider('j', 2, L, j, (v) => {
    const next = Math.max(v, i + 1);
    const changed = next !== j;
    j = next; sync();
    if (changed) { draw(); sound.note(j + 2, 0.35); }
  });
  const showCtl = checkbox('Show the splice', (v) => { show = v; draw(); if (v) sound.success(); }, true);
  root.append(h('div', { class: 'controls' }, [lCtl.wrap, iCtl.wrap, jCtl.wrap, showCtl]));
  const scene = new Scene(root, ['sap', 'edges', 'paths', 'nodes', 'labels'], 'Splicing two augmenting paths along a selected path');
  scene.scrollable(0.72);
  const info = h('div', { class: 'caption' });
  root.append(info);

  function sync(): void {
    iCtl.input.max = String(L - 1); jCtl.input.max = String(L);
    iCtl.input.value = String(i); jCtl.input.value = String(j);
    iCtl.out.textContent = String(i); jCtl.out.textContent = String(j);
  }

  function draw(): void {
    const DX = 66, Y = 110;
    const gx = (k: number) => 40 + 2 * k * DX;       // g_k
    const bx = (k: number) => 40 + (2 * k - 1) * DX; // b_k
    const W = 40 + (2 * L - 1) * DX + 60;
    scene.viewBox(0, 0, W, 230);
    scene.begin();
    // A_i: from a free girl above, into b_i, along e_i to g_{i-1}, down to a free boy.
    const ai = { top: [bx(i) - 40, 26] as [number, number], bot: [gx(i - 1) - 10, 204] as [number, number] };
    const aj = { top: [bx(j) - 40, 26] as [number, number], bot: [gx(j - 1) - 10, 204] as [number, number] };
    if (show) {
      const pts: Array<[number, number]> = [aj.top, [bx(j), Y], [gx(j - 1), Y]];
      for (let k = j - 1; k >= i; k--) pts.push([bx(k), Y], [gx(k - 1), Y]);
      pts.push(ai.bot);
      scene.el('sap', 'splice', 'path', { class: 'sap-path', d: 'M' + pts.map((p) => p.join(',')).join(' L') });
    } else {
      scene.el('sap', 'splice', 'path', { class: 'sap-path', d: '' });
    }
    for (let k = 1; k <= L; k++) {
      drawEdge(scene, 'edges', `e${k}`, gx(k - 1), Y, bx(k), Y, 'couple');
      if (k < L) drawEdge(scene, 'edges', `o${k}`, bx(k), Y, gx(k), Y, 'edge');
      mathLabel(scene.el('labels', `el${k}`, 'text', { class: 'lbl', x: (gx(k - 1) + bx(k)) / 2, y: Y + 24, 'text-anchor': 'middle' }), `*e*_${k}`);
    }
    const curve = (key: string, a: [number, number], b: [number, number], colour: string) =>
      scene.el('paths', key, 'path', {
        d: `M${a[0]},${a[1]} C${a[0] + 10},${(a[1] + b[1]) / 2} ${b[0] - 10},${(a[1] + b[1]) / 2} ${b[0]},${b[1]}`,
        style: `fill:none;stroke:${colour};stroke-width:1.6;stroke-dasharray:5 4`,
      });
    curve('ai1', ai.top, [bx(i), Y], 'var(--boy)');
    curve('ai2', [gx(i - 1), Y], ai.bot, 'var(--boy)');
    curve('aj1', aj.top, [bx(j), Y], 'var(--girl)');
    curve('aj2', [gx(j - 1), Y], aj.bot, 'var(--girl)');
    drawGirl(scene, 'nodes', 'ait', ...ai.top, '', 'free', 9);
    drawBoy(scene, 'nodes', 'aib', ...ai.bot, '', 'free', 16);
    drawGirl(scene, 'nodes', 'ajt', ...aj.top, '', 'free', 9);
    drawBoy(scene, 'nodes', 'ajb', ...aj.bot, '', 'free', 16);
    const pathName = (key: string, at: [number, number], idx: string, colour: string) => {
      const t = scene.el('labels', key, 'text', { class: 'lbl', x: at[0] - 18, y: at[1] + 4, 'text-anchor': 'end', style: `fill:${colour}` });
      t.innerHTML = `<tspan font-style="italic">A</tspan><tspan font-style="italic" font-size="72%" dy="4">${idx}</tspan>`;
    };
    pathName('ail', ai.top, 'i', 'var(--boy)');
    pathName('ajl', aj.top, 'j', 'var(--girl)');
    for (let k = 0; k < L; k++) drawGirl(scene, 'nodes', `g${k}`, gx(k), Y, `g${k}`.replace(/\d+/, (d) => toSub(d)), '', 13);
    for (let k = 1; k <= L; k++) drawBoy(scene, 'nodes', `b${k}`, bx(k), Y, `b${toSub(String(k))}`, '', 24);
    mathLabel(scene.el('labels', 'S', 'text', { class: 'lbl', x: bx(L) + 30, y: Y + 5 }), '*S*');
    scene.end();
    info.innerHTML = !show
      ? `${tex('A_i')} crosses ${tex('S')} along ${tex(`e_{${i}}`)} and ${tex('A_j')} along ${tex(`e_{${j}}`)}, each in position. ` +
        'Tick “Show the splice” to see the augmenting path they would combine into.'
      : `The splice follows ${tex('A_j')} to ${tex(`g_{${j - 1}}`)} (${tex(`2j=${2 * j}`)} edges), walks back along ${tex('S')} to ${tex(`b_{${i}}`)} ` +
      `(${tex(`2(j-i)-1=${2 * (j - i) - 1}`)} edges), and finishes along ${tex('A_i')} (${tex(`2L+2-2i=${2 * L + 2 - 2 * i}`)} edges): ` +
      `${tex(`2L+1+4(j-i)=${2 * L + 1 + 4 * (j - i)}`)} edges in all, more than the ${tex(`2L+1=${2 * L + 1}`)} of a SAP at level ${tex(`L+1`)}.`;
  }

  draw();
}

function toSub(d: string): string {
  return d.split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)]).join('');
}
