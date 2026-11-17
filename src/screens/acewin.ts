// An ace at the Ace Pot (Nov 17): the whole screen goes to it. "ACE!", the pot counting up to what you won, confetti,
// the crowd, and a way to tell your friends. Resolves when they tap on, so the round waits for it.
import { sfx } from '../fx/sound';
import { money } from '../purse';
import { canShare, share } from './daily';

export function aceWin(pot: number, hole: string): { closed: Promise<void>; setPot: (n: number) => void } {
  let target = pot;
  let shown = 0;
  const el = document.createElement('div');
  el.className = 'ace-win';
  el.innerHTML = `
    <canvas class="ace-confetti"></canvas>
    <div class="ace-card" role="dialog" aria-label="Ace">
      <p class="ace-eyebrow">The Ace Pot · ${hole}</p>
      <h1 class="ace-big">ACE!</h1>
      <p class="ace-sub">The pot is yours</p>
      <p class="ace-money" data-money>$0</p>
      <p class="ace-fine">Added to your club bonus. The whole club will hear about this one.</p>
      <div class="ace-acts"><button class="btn gold big" data-share>${canShare() ? 'Tell your friends' : 'Copy the brag'}</button><button class="btn ghost" data-on>Keep going</button></div>
    </div>`;
  document.body.appendChild(el);
  sfx('cheer');
  window.setTimeout(() => sfx('clap'), 500);
  window.setTimeout(() => sfx('cheer'), 1400);

  // the money counts up, easing in to the pot
  const out = el.querySelector<HTMLElement>('[data-money]')!;
  const t0 = performance.now();
  const count = () => {
    if (!el.isConnected) return;
    const k = Math.min(1, (performance.now() - t0) / 2200);
    shown = Math.round(target * (1 - (1 - k) ** 3));
    out.textContent = money(shown);
    if (k < 1) requestAnimationFrame(count);
    else out.classList.add('done');
  };
  requestAnimationFrame(count);

  // confetti: gold, green and white, falling and turning, for about six seconds
  const cv = el.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = cv.getContext('2d');
  const W = (cv.width = innerWidth * devicePixelRatio);
  const H = (cv.height = innerHeight * devicePixelRatio);
  const colors = ['#ffd23f', '#f2b705', '#ffffff', '#3fae4a', '#e94b3c', '#2f6fd6'];
  const bits = Array.from({ length: 160 }, () => ({
    x: Math.random() * W,
    y: -Math.random() * H * 0.8,
    vx: (Math.random() - 0.5) * 2 * devicePixelRatio,
    vy: (2 + Math.random() * 3) * devicePixelRatio,
    s: (5 + Math.random() * 6) * devicePixelRatio,
    a: Math.random() * Math.PI,
    va: (Math.random() - 0.5) * 0.2,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const born = performance.now();
  const fall = () => {
    if (!el.isConnected || !ctx) return;
    const age = performance.now() - born;
    ctx.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.x += b.vx;
      b.y += b.vy;
      b.a += b.va;
      if (b.y > H && age < 4500) {
        b.y = -20;
        b.x = Math.random() * W;
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      ctx.restore();
    }
    if (age < 9000) requestAnimationFrame(fall);
  };
  requestAnimationFrame(fall);

  let done: () => void = () => {};
  const closed = new Promise<void>((res) => (done = res));
  // the server's word on what was won (it can differ from what the screen thought the pot was)
  const setPot = (n: number) => {
    target = n;
    if (out.classList.contains('done')) out.textContent = money(n);
  };
  el.querySelector<HTMLButtonElement>('[data-share]')!.onclick = (e) =>
    void share(`I just made a hole in one at the Claude Country Club and took the Ace Pot: ${money(target)} ⛳\n${location.origin}`, e.currentTarget as HTMLButtonElement);
  el.querySelector<HTMLButtonElement>('[data-on]')!.onclick = () => {
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 300);
    done();
  };
  window.addEventListener('hashchange', () => (el.remove(), done()), { once: true });
  return { closed, setPot };
}
