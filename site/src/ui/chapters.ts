/**
 * Chapter navigation, built from the page's h2 headings.
 *
 * On wide screens a rail of short horizontal lines sits at the left edge, one
 * line per chapter; the current chapter's line is longer and darker, and the
 * chapter titles appear when the rail is hovered or focused. On narrower
 * screens the menu button in the top bar opens the same list as a drawer.
 */
import { tick } from './sound';

interface Chapter {
  id: string;
  num: string;
  title: string;
}

function chapters(): Chapter[] {
  const list: Chapter[] = [{ id: 'top', num: '', title: 'Introduction' }];
  document.querySelectorAll<HTMLElement>('main section[id]').forEach((sec) => {
    const h2 = sec.querySelector('h2');
    if (!h2) return;
    const num = h2.querySelector('.num')?.textContent ?? '';
    const title = (h2.textContent ?? '').slice(num.length).trim();
    list.push({ id: sec.id, num, title });
  });
  return list;
}

function links(list: Chapter[], cls: string): HTMLAnchorElement[] {
  return list.map((c) => {
    const a = document.createElement('a');
    a.href = `#${c.id}`;
    a.className = cls;
    a.innerHTML = `<span class="line" aria-hidden="true"></span><span class="label"><span class="n">${c.num}</span>${c.title}</span>`;
    return a;
  });
}

export function initChapterMenu(): void {
  const list = chapters();
  const rail = document.getElementById('rail')!;
  const drawer = document.getElementById('drawer')!;
  const scrim = document.getElementById('drawer-scrim')!;
  const toggle = document.getElementById('menu-toggle') as HTMLButtonElement;

  const railLinks = links(list, 'rail-item');
  rail.append(...railLinks);
  const drawerLinks = links(list, 'drawer-item');
  const head = document.createElement('div');
  head.className = 'drawer-head';
  head.textContent = 'Chapters';
  const foot = document.createElement('div');
  foot.className = 'drawer-foot';
  foot.innerHTML = '<a href="./hopcroftkarp.pdf">Read the report (PDF)</a><a href="https://github.com/boonsuan/hopcroftkarp">See the code</a>';
  drawer.append(head, ...drawerLinks, foot);

  // ---- drawer
  const open = (on: boolean) => {
    drawer.hidden = !on;
    scrim.hidden = !on;
    document.body.classList.toggle('drawer-open', on);
    toggle.setAttribute('aria-expanded', String(on));
    if (on) (drawer.querySelector('.drawer-item.current') as HTMLElement | null ?? drawerLinks[0]).focus();
  };
  toggle.addEventListener('click', () => {
    tick();
    open(drawer.hidden);
  });
  scrim.addEventListener('click', () => open(false));
  drawer.addEventListener('click', (ev) => {
    if ((ev.target as Element).closest('a')) open(false);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !drawer.hidden) {
      open(false);
      toggle.focus();
    }
  });

  // ---- scrollspy: the current chapter is the last one whose top has passed
  // a line a third of the way down the window.
  const targets = list.map((c) => document.getElementById(c.id)!);
  let current = -1;
  const update = () => {
    const y = window.innerHeight / 3;
    let k = 0;
    targets.forEach((el, i) => {
      if (el.getBoundingClientRect().top <= y) k = i;
    });
    if (k === current) return;
    current = k;
    [railLinks, drawerLinks].forEach((ls) =>
      ls.forEach((a, i) => {
        a.classList.toggle('current', i === k);
        if (i === k) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      }),
    );
  };
  let queued = false;
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}
