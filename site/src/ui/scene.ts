/**
 * A tiny keyed SVG renderer. A widget redraws a whole frame by calling
 * `scene.begin()`, then `scene.el(...)` for every element it wants (each with
 * a stable key), then `scene.end()`. Elements are created on first use,
 * updated in place afterwards (so CSS transitions animate the changes), and
 * faded out when a frame no longer mentions them.
 */

const SVGNS = 'http://www.w3.org/2000/svg';

export type Attrs = Record<string, string | number | undefined>;

export class Scene {
  readonly svg: SVGSVGElement;
  private layers = new Map<string, SVGGElement>();
  private live = new Map<string, SVGElement>();
  private seen = new Set<string>();

  constructor(container: HTMLElement, layerNames: string[], label: string) {
    this.svg = document.createElementNS(SVGNS, 'svg');
    this.svg.classList.add('scene');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', label);
    for (const name of layerNames) {
      const g = document.createElementNS(SVGNS, 'g');
      g.dataset.layer = name;
      this.svg.appendChild(g);
      this.layers.set(name, g);
    }
    container.appendChild(this.svg);
  }

  /** Set the drawing's coordinate box (in user units). */
  viewBox(x: number, y: number, w: number, h: number): void {
    this.svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    // Never enlarge a drawing beyond 1.6 times its natural size, so small
    // graphs don't turn into giant vertices on a wide screen.
    this.svg.style.maxWidth = `${Math.round(w * this.maxScale)}px`;
    if (this.minScale) this.svg.style.minWidth = `${Math.round(w * this.minScale)}px`;
  }

  /** How far `viewBox` lets the drawing grow beyond one pixel per unit. */
  maxScale = 1.6;

  /** How far it may shrink before the drawing scrolls sideways instead (0: never scroll). */
  private minScale = 0;

  /**
   * On narrow screens, keep the drawing at least `minScale` of its natural
   * size and let it scroll sideways, rather than shrinking its text away.
   */
  scrollable(minScale: number): void {
    this.minScale = minScale;
    const wrap = document.createElement('div');
    wrap.className = 'scene-scroll';
    this.svg.replaceWith(wrap);
    wrap.appendChild(this.svg);
  }

  begin(): void {
    this.seen.clear();
  }

  /** Create or update the element with this key. `text` sets its text content. */
  el(layer: string, key: string, tag: string, attrs: Attrs, text?: string): SVGElement {
    this.seen.add(key);
    let node = this.live.get(key);
    if (!node || node.tagName !== tag) {
      node?.remove();
      node = document.createElementNS(SVGNS, tag) as SVGElement;
      this.live.set(key, node);
      this.layers.get(layer)!.appendChild(node);
      // Fade in with a CSS animation (not requestAnimationFrame, which is
      // paused in background tabs and would leave the element invisible).
      node.style.animation = 'hk-fade-in 280ms ease-out';
    } else if (node.parentNode !== this.layers.get(layer)) {
      this.layers.get(layer)!.appendChild(node);
    }
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined) node.removeAttribute(k);
      else if (k === 'transform') node.style.transform = String(v);
      else node.setAttribute(k, String(v));
    }
    if (text !== undefined && node.textContent !== text) node.textContent = text;
    return node;
  }

  /** Remove elements not mentioned since `begin()`, after a short fade. */
  end(): void {
    for (const [key, node] of this.live) {
      if (this.seen.has(key)) continue;
      this.live.delete(key);
      node.style.opacity = '0';
      window.setTimeout(() => node.remove(), 280);
    }
  }

  /** Remove everything at once (used when switching examples). */
  clear(): void {
    for (const node of this.live.values()) node.remove();
    this.live.clear();
  }
}

/** A girl (circle) and a boy (rounded square), as in the report's figures. */
export function drawGirl(scene: Scene, layer: string, key: string, x: number, y: number,
                         label: string, cls = '', r = 11): void {
  const g = scene.el(layer, key, 'g', {
    class: `girl anim ${cls}`,
    transform: `translate(${x}px, ${y}px)`,
  }) as SVGGElement;
  ensureChild(g, 'circle', { r, cx: 0, cy: 0 });
  ensureChild(g, 'text', { class: 'vlabel', x: 0, y: 0.5 }, label);
}

export function drawBoy(scene: Scene, layer: string, key: string, x: number, y: number,
                        label: string, cls = '', h = 20): void {
  const g = scene.el(layer, key, 'g', {
    class: `boy anim ${cls}`,
    transform: `translate(${x}px, ${y}px)`,
  }) as SVGGElement;
  ensureChild(g, 'rect', { x: -h / 2, y: -h / 2, width: h, height: h, rx: 3 });
  ensureChild(g, 'text', { class: 'vlabel', x: 0, y: 0.5 }, label);
}

function ensureChild(parent: SVGGElement, tag: string, attrs: Attrs, text?: string): void {
  let child = Array.from(parent.children).find((c) => c.tagName === tag) as SVGElement | undefined;
  if (!child) {
    child = document.createElementNS(SVGNS, tag) as SVGElement;
    parent.appendChild(child);
  }
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) child.setAttribute(k, String(v));
  if (text !== undefined && child.textContent !== text) child.textContent = text;
}

/** An ordinary edge, or a couple drawn as Knuth's double line. */
export function drawEdge(scene: Scene, layer: string, key: string,
                         x1: number, y1: number, x2: number, y2: number,
                         kind: 'edge' | 'pedge' | 'couple'): void {
  const d = `M${x1},${y1} L${x2},${y2}`;
  if (kind === 'couple') {
    scene.el(layer, key + ':o', 'path', { class: 'couple-outer anim', d });
    scene.el(layer, key + ':i', 'path', { class: 'couple-inner anim', d });
  } else {
    scene.el(layer, key, 'path', { class: `${kind} anim`, d });
  }
}

/**
 * Set an SVG text element's content with a little mathematics: *x* is set in
 * italics (so "level *L*" reads as in the prose) and _k as a lowered, smaller k.
 */
export function mathLabel(el: SVGElement, src: string): void {
  if (el.getAttribute('data-src') === src) return;
  el.setAttribute('data-src', src);
  el.innerHTML = src
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*([^*]+)\*/g, '<tspan font-style="italic">$1</tspan>')
    .replace(/_(\w+)/g, '<tspan dy="0.3em" font-size="75%">$1</tspan><tspan dy="-0.3em">\u200b</tspan>');
}

/** Shorten the segment (x1,y1)-(x2,y2) by `a` at the start and `b` at the end. */
export function trim(x1: number, y1: number, x2: number, y2: number, a: number, b: number):
  [number, number, number, number] {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return [x1 + (dx * a) / len, y1 + (dy * a) / len, x2 - (dx * b) / len, y2 - (dy * b) / len];
}

/** Read a CSS custom property (for colours used inside canvas-like computations). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
