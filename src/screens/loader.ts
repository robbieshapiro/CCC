// The loading card (Nov 18): one look for every tap that takes a moment. The crest, where you're headed, a gold bar
// that moves on real steps (the club's data in, the page drawn, the course built, its first frame), and a word from
// Reginald. Fast screens never see it: it shows only after a quarter of a second (a course at once).
//
// The router starts it (main.ts), render() marks the page drawn (ui.ts), and on a 3D screen the engine's events
// finish it: g3:built once a hole is built, g3:frame once it has drawn (golf3d/engine.ts).
import { crest } from '../brand';
import { tipsFrom } from '../tips';
import { esc } from '../ui';

export type LoadStep = 'data' | 'drawn' | 'built' | 'frame';
// where the bar stands at each step, and how far it may creep before the next one lands
const AT: Record<LoadStep | 'start', number> = { start: 0.08, data: 0.4, drawn: 0.6, built: 0.85, frame: 1 };
const NEXT: Record<LoadStep | 'start', number> = { start: 0.36, data: 0.56, drawn: 0.82, built: 0.97, frame: 1 };

type Load = { el: HTMLElement | null; where: string; at: number; cap: number; show: number; tip: number; safety: number; raf: number };
let cur: Load | null = null;

// course: a 3D screen, which shows the card at once (building the hole holds up the page, so a timer can't be relied on)
export function startLoad(where: string, course = false) {
  // one already on its way (a choice on the card note, then the route it leads to): carry on with it, no flicker
  if (cur) {
    const load = cur;
    const h = load.el?.querySelector('h2');
    if (h) h.textContent = `Heading to ${where}`;
    load.where = where;
    window.clearTimeout(load.safety);
    load.safety = window.setTimeout(() => cur === load && endLoad(), 30_000);
    return;
  }
  const load: Load = { el: null, where, at: AT.start, cap: NEXT.start, show: 0, tip: 0, safety: 0, raf: 0 };
  cur = load;
  if (course) draw(load);
  else load.show = window.setTimeout(() => cur === load && draw(load), 250);
  load.safety = window.setTimeout(() => cur === load && endLoad(), 30_000);
}

function draw(load: Load) {
  const next = tipsFrom();
  const el = document.createElement('div');
  el.className = 'ld';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="ld-card">${crest(72, 'ld')}
    <p class="eyebrow">Claude Country Club</p>
    <h2>Heading to ${esc(load.where)}</h2>
    <div class="ld-bar"><i></i></div>
    <p class="ld-tip"><span>${esc(next())}</span><small>Reginald</small></p></div>`;
  document.body.appendChild(el);
  load.el = el;
  requestAnimationFrame(() => el.classList.add('in'));
  load.tip = window.setInterval(() => {
    const t = el.querySelector<HTMLElement>('.ld-tip span');
    if (!t) return;
    t.classList.add('out');
    window.setTimeout(() => {
      t.textContent = next();
      t.classList.remove('out');
    }, 300);
  }, 5000);
  // between steps the bar creeps toward the next one, slower the closer it gets, so it never sits still
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = () => {
    if (cur !== load) return;
    if (!still) load.at += (load.cap - load.at) * 0.012;
    paint(load);
    load.raf = requestAnimationFrame(tick);
  };
  tick();
}

const paint = (load: Load) => load.el?.querySelector<HTMLElement>('.ld-bar i')?.style.setProperty('width', `${Math.round(load.at * 1000) / 10}%`);

export function loadStep(step: LoadStep) {
  const load = cur;
  if (!load) return;
  // a flat screen is done once it's drawn; a 3D one (the course's canvas box, #g3) waits for its course
  if (step === 'frame' || (step === 'drawn' && !document.getElementById('g3'))) return endLoad();
  if (AT[step] <= load.at) return;
  load.at = AT[step];
  load.cap = NEXT[step];
  paint(load);
}

// now: drop it at once (another load is starting); otherwise fill the bar and fade out
export function endLoad(now = false) {
  const load = cur;
  if (!load) return;
  cur = null;
  window.clearTimeout(load.show);
  window.clearTimeout(load.safety);
  window.clearInterval(load.tip);
  cancelAnimationFrame(load.raf);
  const el = load.el;
  if (!el) return;
  if (now) return el.remove();
  load.at = 1;
  paint(load);
  window.setTimeout(() => el.classList.remove('in'), 180);
  window.setTimeout(() => el.remove(), 480);
}

// the course's own milestones (dispatched by the engine, so it needn't know about screens)
window.addEventListener('g3:built', () => loadStep('built'));
window.addEventListener('g3:frame', () => loadStep('frame'));
