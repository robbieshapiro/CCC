// Pop-a-Shot against Mo, at the bar: pick a stake, Mo posts his score, then 30 seconds at the hoop. Swipe up to shoot:
// sideways steers it, the length of the swipe is the power. The last 8 seconds are worth 3 a basket, and from halfway
// the hoop slides. The score goes to the server, which settles the bet (pas_start, pas_finish).
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { CHIPS, DAILY_LOSS } from '../blackjack';
import { sfx } from '../fx/sound';
import { PAS_FIRE, PAS_SECONDS, type PasEnd, type PasStart } from '../popashot';
import { money } from '../purse';
import { staffFace } from '../staff';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { header, render } from '../ui';
import { payTrophies } from './trophyroom';

const STAKE_KEY = 'ccc-pas-stake';
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const MO_POSTS = ['Beat that, if you can.', "I've been practising.", 'Your turn. No pressure.', 'Not my best. Still better than yours.'];
const MO_ENDS = { win: ["Fine. You've got a jump shot.", 'Take the money. I need a lie down.'], push: ['Dead level. Again?', "A tie. That's no fun for anyone."], lose: ['Mine. The rim was kind to me.', "Close. Close doesn't pay."] };

type Ball = { t0: number; x0: number; tx: number; make: 'in' | 'rim-in' | 'rim-out' | 'short' | 'long'; scored: boolean; side: number };

export async function popashot(snap: Snapshot) {
  const s = requireSession();
  let stake = Math.min(500, Math.max(10, Number(store.get(STAKE_KEY)) || 25));
  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="pas-page">
      <a class="bj-back" href="#/bar">‹ The bar</a>
      <section class="pas-head">
        <span class="bj-face">${staffFace('mo', 56)}</span>
        <p id="pas-mo">Thirty seconds at the hoop. Pick a stake and I'll put a score up for you to beat.</p>
      </section>
      <section class="pas-court" id="pas-court">
        <canvas id="pas-canvas"></canvas>
        <div class="pas-hud"><span>You <b id="pas-score">0</b></span><span class="pas-clock" id="pas-clock">${PAS_SECONDS}</span><span>Mo <b id="pas-target">–</b></span></div>
        <p class="pas-call" id="pas-call"></p>
      </section>
      <section class="bj-rail">
        <div class="bj-bank"><span>In the bank</span><b id="pas-bank">…</b><small id="pas-today"></small></div>
        <div class="bj-chips" id="pas-chips">${CHIPS.map((c) => `<button class="bj-chip c${c}" data-chip="${c}">${c}</button>`).join('')}</div>
        <div class="bj-acts"><button class="bj-btn gold" id="pas-go">Play · ${money(stake)}</button></div>
        <p class="bj-fine">Swipe up to shoot: sideways steers it, a longer swipe throws it further. Beat Mo's score and your stake comes back with 90% on top. Club money only, at most ${money(DAILY_LOSS)} lost a day.</p>
      </section>
    </main>`);

  const $ = (id: string) => document.getElementById(id)!;
  const canvas = $('pas-canvas') as HTMLCanvasElement;
  const g = canvas.getContext('2d')!;
  const mo = (t: string) => ($('pas-mo').textContent = t);
  const setBank = (bank: number, lost: number) => {
    $('pas-bank').textContent = money(bank);
    $('pas-today').textContent = lost > 0 ? `Down ${money(lost)} today` : lost < 0 ? `Up ${money(-lost)} today` : '';
  };
  const chips = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.classList.toggle('on', Number(b.dataset.chip) === stake));
    $('pas-go').textContent = `Play · ${money(stake)}`;
  };
  document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => (b.onclick = () => ((stake = Number(b.dataset.chip)), chips())));
  chips();
  void api.bjState(s).then((st) => setBank(st.bank, st.lostToday)).catch(() => {});

  // ---------- the court ----------
  let W = 0, H = 0;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    W = r.width;
    H = r.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  const RIM = () => W * 0.11; // the rim's half-width
  const hoopY = () => H * 0.28;
  const ballY = () => H * 0.86;
  let game: { start: number; end: number; score: number; balls: Ball[]; info: PasStart; over: boolean } | null = null;
  const now = () => performance.now() / 1000;
  const elapsed = () => (game ? Math.max(0, now() - game.start) : 0);
  // from halfway the hoop slides, a little quicker as the clock runs down
  const hoopX = (t = elapsed()) => W / 2 + (t > PAS_SECONDS / 2 ? Math.sin((t - PAS_SECONDS / 2) * (0.9 + (t - PAS_SECONDS / 2) * 0.05)) * W * 0.22 : 0);
  const FLIGHT = 0.6;

  // a swipe becomes a shot: where it's aimed and how hard
  let down: { x: number; y: number; t: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!game || game.over || elapsed() < 0) return;
    const r = canvas.getBoundingClientRect();
    down = { x: e.clientX - r.left, y: e.clientY - r.top, t: now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || !game || game.over) return;
    const r = canvas.getBoundingClientRect();
    const dx = e.clientX - r.left - down.x, dy = e.clientY - r.top - down.y;
    down = null;
    if (dy > -24) return;
    // one ball in the air at a time, nearly: the next is ready when this one's well on its way
    const last = game.balls[game.balls.length - 1];
    if (last && now() - last.t0 < FLIGHT * 0.45) return;
    const t = elapsed();
    if (t < 0 || t >= PAS_SECONDS) return;
    const power = -dy / H; // about 0.32 of the court's height is perfect
    const tx = W / 2 + dx * 1.15;
    const off = Math.abs(tx - hoopX(t + FLIGHT));
    const pErr = power - 0.32;
    let make: Ball['make'];
    if (pErr < -0.09) make = 'short';
    else if (pErr > 0.12) make = 'long';
    else if (off <= RIM() * 0.7 && Math.abs(pErr) <= 0.06) make = 'in';
    else if (off <= RIM() * 1.15 && Math.abs(pErr) <= 0.09) make = Math.random() < 0.45 ? 'rim-in' : 'rim-out';
    else make = off > RIM() * 1.15 ? 'rim-out' : pErr < 0 ? 'short' : 'long';
    game.balls.push({ t0: now(), x0: W / 2, tx, make, scored: false, side: Math.sign(tx - hoopX(t + FLIGHT)) || 1 });
    sfx('whoosh');
  });

  function drawCourt() {
    const t = elapsed();
    g.clearRect(0, 0, W, H);
    // the cabinet: the backboard, the net, the ramp
    const hx = hoopX(t), hy = hoopY();
    g.fillStyle = '#1b2430';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 8; i++) g.fillRect(0, H * 0.5 + i * H * 0.07, W, 1);
    g.fillStyle = '#f4f1e8';
    g.fillRect(hx - W * 0.2, hy - H * 0.16, W * 0.4, H * 0.14);
    g.strokeStyle = '#b3202a';
    g.lineWidth = 3;
    g.strokeRect(hx - W * 0.07, hy - H * 0.11, W * 0.14, H * 0.08);
    // the net
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1.2;
    for (let i = 0; i <= 6; i++) {
      const x = hx - RIM() + (i / 6) * RIM() * 2;
      g.beginPath();
      g.moveTo(x, hy);
      g.lineTo(hx + (x - hx) * 0.6, hy + H * 0.08);
      g.stroke();
    }
    // the rim
    g.strokeStyle = '#ff7a1a';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(hx, hy, RIM(), RIM() * 0.22, 0, 0, Math.PI * 2);
    g.stroke();
    // balls in the air, and the next one waiting on the ramp
    const ball = (x: number, y: number, r: number) => {
      g.fillStyle = '#e8792a';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(40,20,10,0.7)';
      g.lineWidth = Math.max(1, r * 0.08);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.moveTo(x - r, y);
      g.lineTo(x + r, y);
      g.moveTo(x, y - r);
      g.lineTo(x, y + r);
      g.stroke();
    };
    if (game && !game.over) ball(W / 2, ballY(), W * 0.075);
    for (const b of game?.balls ?? []) {
      const k = (now() - b.t0) / FLIGHT;
      if (k > 1.6) continue;
      const fin = b.make === 'short' ? 0.82 : 1;
      const kk = Math.min(k, fin);
      const x = b.x0 + (b.tx - b.x0) * kk;
      const yTop = b.make === 'long' ? hy - H * 0.2 : hy - H * 0.02;
      let y = ballY() + (yTop - ballY()) * kk - Math.sin(Math.PI * kk) * H * 0.3;
      let xx = x;
      const r = W * 0.075 * (1 - 0.55 * kk);
      if (k > fin) {
        // after the hoop: through the net, off the rim, or back down
        const a = k - fin;
        if (b.make === 'in' || b.make === 'rim-in') y = hy + a * H * 0.5;
        else (xx = x + b.side * a * W * 0.5), (y = y + a * a * H * 1.2);
      }
      ball(xx, y, r);
      if (!b.scored && k >= 1) {
        b.scored = true;
        if (b.make === 'in' || b.make === 'rim-in') {
          const pts = elapsed() >= PAS_SECONDS - PAS_FIRE ? 3 : 2;
          game!.score += pts;
          $('pas-score').textContent = String(game!.score);
          sfx('pop');
        } else sfx('thump');
      }
    }
  }

  let raf = 0;
  function loop() {
    if (!canvas.isConnected) return cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    if (canvas.getBoundingClientRect().width !== W) size();
    drawCourt();
    if (!game || game.over) return;
    const t = elapsed();
    const left = Math.max(0, PAS_SECONDS - t);
    $('pas-clock').textContent = t < 0 ? String(Math.ceil(-t)) : left.toFixed(0);
    $('pas-clock').classList.toggle('fire', t >= PAS_SECONDS - PAS_FIRE && t < PAS_SECONDS);
    $('pas-call').textContent = t < 0 ? 'Ready…' : t < 0.8 ? 'Go!' : t >= PAS_SECONDS - PAS_FIRE && t < PAS_SECONDS - PAS_FIRE + 1.2 ? '3 points!' : '';
    // the clock's out and the last ball has landed
    if (t >= PAS_SECONDS + FLIGHT + 0.2) void finish();
  }
  loop();

  async function finish() {
    if (!game || game.over) return;
    game.over = true;
    $('pas-call').textContent = `${game.score}`;
    try {
      const r: PasEnd = await api.pasFinish(s, game.info.id, game.score);
      mo(pick(MO_ENDS[r.outcome]));
      $('pas-call').textContent = r.outcome === 'win' ? `+${money(r.payout - r.stake)}` : r.outcome === 'push' ? 'Push' : `−${money(r.stake)}`;
      sfx(r.outcome === 'win' ? 'cheer' : 'thump');
      setBank(r.bank, r.lostToday);
      void refresh().catch(() => {});
      void payTrophies();
    } catch (e) {
      mo((e as Error).message);
    }
    $('pas-go').removeAttribute('disabled');
    $('pas-chips').classList.remove('locked');
  }

  $('pas-go').onclick = async () => {
    if (game && !game.over) return;
    store.set(STAKE_KEY, String(stake));
    try {
      const info = await api.pasStart(s, stake);
      setBank(info.bank, info.lostToday);
      $('pas-target').textContent = String(info.mo);
      $('pas-score').textContent = '0';
      mo(`${info.mo}. ${pick(MO_POSTS)}`);
      $('pas-go').setAttribute('disabled', '');
      $('pas-chips').classList.add('locked');
      // a three-second count-in, then the clock
      game = { start: now() + 3, end: now() + 3 + PAS_SECONDS, score: 0, balls: [], info, over: false };
      $('pas-court').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      mo((e as Error).message);
    }
  };
}
