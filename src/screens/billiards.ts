// 8-ball against Mo, at the bar: a stake, then a full game. Drag anywhere on the table to aim (the cue ball goes the
// other way from your drag, like pulling back a cue) and pull further for more power; let go to shoot. With the cue
// ball in hand, tap where you want it first. Mo takes his own shots. The result goes to the server (bil_start/finish).
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { CHIPS, DAILY_LOSS } from '../blackjack';
import { moShot } from '../billiards/mo';
import { freeSpot, H, HEAD_X, moving, POCKETS, R, step, strike, W, type ShotLog } from '../billiards/physics';
import { afterShot, groupOf, newGame, targets, type Game } from '../billiards/rules';
import { sfx } from '../fx/sound';
import { money } from '../purse';
import { staffFace } from '../staff';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { header, render } from '../ui';
import { payTrophies } from './trophyroom';

const STAKE_KEY = 'ccc-bil-stake';
const COLOURS = ['#fffdf7', '#e8b923', '#1f4fa8', '#c8202c', '#5a2a86', '#e8792a', '#1f7a3a', '#7a1f2a', '#141414'];
const colour = (n: number) => COLOURS[n > 8 ? n - 8 : n];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const MO_WIN = ['Rack em up again? Your money says yes.', 'The 8 always finds its way home for me.'];
const MO_LOSE = ['Fine. You can play. Who knew.', "Well shot. Don't tell anyone I said that."];

export async function billiards(snap: Snapshot) {
  const s = requireSession();
  let stake = Math.min(500, Math.max(10, Number(store.get(STAKE_KEY)) || 25));
  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="pas-page bil-page">
      <a class="bj-back" href="#/bar">‹ The bar</a>
      <section class="pas-head"><span class="bj-face">${staffFace('mo', 56)}</span><p id="bil-mo">Eight-ball. Pick a stake and I'll rack them. Coin toss for the break.</p></section>
      <section class="bil-table" id="bil-table"><canvas id="bil-canvas"></canvas></section>
      <div class="bil-status"><span id="bil-you">You</span><b id="bil-note">Rack em up.</b><span id="bil-mo-grp">Mo</span></div>
      <section class="bj-rail">
        <div class="bj-bank"><span>In the bank</span><b id="bil-bank">…</b><small id="bil-today"></small></div>
        <div class="bj-chips" id="bil-chips">${CHIPS.map((c) => `<button class="bj-chip c${c}" data-chip="${c}">${c}</button>`).join('')}</div>
        <div class="bj-acts"><button class="bj-btn gold" id="bil-go">Rack · ${money(stake)}</button></div>
        <p class="bj-fine">Drag on the table to aim: the ball goes the opposite way, like pulling back a cue, and further is harder. With ball in hand, tap where you want it. Win and your stake comes back with 90% on top. Club money only, at most ${money(DAILY_LOSS)} lost a day.</p>
      </section>
    </main>`);

  const $ = (id: string) => document.getElementById(id)!;
  const canvas = $('bil-canvas') as HTMLCanvasElement;
  const g2 = canvas.getContext('2d')!;
  const mo = (t: string) => ($('bil-mo').textContent = t);
  const setBank = (bank: number, lost: number) => {
    $('bil-bank').textContent = money(bank);
    $('bil-today').textContent = lost > 0 ? `Down ${money(lost)} today` : lost < 0 ? `Up ${money(-lost)} today` : '';
  };
  const chips = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.classList.toggle('on', Number(b.dataset.chip) === stake));
    $('bil-go').textContent = `Rack · ${money(stake)}`;
  };
  document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => (b.onclick = () => ((stake = Number(b.dataset.chip)), chips())));
  chips();
  void api.bjState(s).then((st) => setBank(st.bank, st.lostToday)).catch(() => {});

  // ---------- the table: inches to pixels ----------
  const RAIL = 3.2; // the wooden rail round the cloth, in inches
  let scale = 1, cw = 0, ch = 0;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    cw = r.width;
    scale = cw / (W + 2 * RAIL);
    ch = (H + 2 * RAIL) * scale;
    canvas.style.height = `${ch}px`;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  const px = (x: number) => (x + RAIL) * scale;
  const py = (y: number) => (y + RAIL) * scale;
  const toTable = (cx: number, cy: number) => ({ x: cx / scale - RAIL, y: cy / scale - RAIL });

  let game: Game | null = null;
  let id = 0;
  let rolling: ShotLog | null = null;
  let aim: { x0: number; y0: number; x1: number; y1: number } | null = null;
  let busy = false;

  const statusLine = () => {
    if (!game) return;
    const grp = (w: 'you' | 'mo') => (game!.groups[w] ? `${game!.groups[w]} · ${targets(game!, w).filter((n) => n !== 8).length} left` : 'open');
    $('bil-you').textContent = `You: ${grp('you')}`;
    $('bil-mo-grp').textContent = `Mo: ${grp('mo')}`;
    $('bil-note').textContent = game.winner ? '' : game.turn === 'you' ? (game.inHand ? 'Ball in hand: tap to place it, or drag to shoot from here.' : 'Your shot.') : 'Mo is lining one up…';
  };

  // the aim: from the cue ball, opposite the drag, as far as the first ball it would meet
  function guide(): { ax: number; ay: number; power: number; hit: { x: number; y: number } | null } | null {
    if (!aim || !game) return null;
    const dx = aim.x0 - aim.x1, dy = aim.y0 - aim.y1;
    const len = Math.hypot(dx, dy);
    if (len < 6) return null;
    const ax = dx / len, ay = dy / len;
    const power = Math.min(1, len / (cw * 0.45));
    const cue = game.balls.find((b) => b.n === 0)!;
    let best = Infinity;
    for (const b of game.balls) {
      if (b.down || b.n === 0) continue;
      const ox = b.x - cue.x, oy = b.y - cue.y;
      const t = ox * ax + oy * ay;
      if (t <= 0) continue;
      const d2 = ox * ox + oy * oy - t * t;
      if (d2 > 4 * R * R) continue;
      best = Math.min(best, t - Math.sqrt(4 * R * R - d2));
    }
    return { ax, ay, power, hit: best < Infinity ? { x: cue.x + ax * best, y: cue.y + ay * best } : null };
  }

  function draw() {
    g2.clearRect(0, 0, cw, ch);
    // rail and cloth
    g2.fillStyle = '#5a3620';
    g2.fillRect(0, 0, cw, ch);
    g2.fillStyle = '#156b45';
    g2.fillRect(px(0), py(0), W * scale, H * scale);
    g2.strokeStyle = 'rgba(255,255,255,0.18)';
    g2.beginPath();
    g2.moveTo(px(HEAD_X), py(0));
    g2.lineTo(px(HEAD_X), py(H));
    g2.stroke();
    for (const p of POCKETS) {
      g2.fillStyle = '#0b0b0b';
      g2.beginPath();
      g2.arc(px(p.x), py(p.y), p.r * scale, 0, Math.PI * 2);
      g2.fill();
    }
    // diamonds on the rail
    g2.fillStyle = '#e8dcc6';
    for (let i = 1; i < 8; i++) if (i !== 4) g2.fillRect(px((W * i) / 8) - 1.5, py(-RAIL / 2) - 1.5, 3, 3), g2.fillRect(px((W * i) / 8) - 1.5, py(H + RAIL / 2) - 1.5, 3, 3);
    if (!game) return;
    const gd = game.turn === 'you' && !rolling ? guide() : null;
    if (gd) {
      const cue = game.balls.find((b) => b.n === 0)!;
      const end = gd.hit ?? { x: cue.x + gd.ax * W, y: cue.y + gd.ay * W };
      g2.strokeStyle = 'rgba(255,255,255,0.7)';
      g2.setLineDash([4, 4]);
      g2.beginPath();
      g2.moveTo(px(cue.x), py(cue.y));
      g2.lineTo(px(end.x), py(end.y));
      g2.stroke();
      g2.setLineDash([]);
      if (gd.hit) {
        g2.beginPath();
        g2.arc(px(gd.hit.x), py(gd.hit.y), R * scale, 0, Math.PI * 2);
        g2.stroke();
      }
      // the cue stick, pulled back
      const back = 2 + gd.power * 14;
      g2.strokeStyle = '#c9a24a';
      g2.lineWidth = Math.max(2, scale * 0.5);
      g2.beginPath();
      g2.moveTo(px(cue.x - gd.ax * (R + back)), py(cue.y - gd.ay * (R + back)));
      g2.lineTo(px(cue.x - gd.ax * (R + back + 40)), py(cue.y - gd.ay * (R + back + 40)));
      g2.stroke();
      g2.lineWidth = 1;
      // power
      g2.fillStyle = 'rgba(0,0,0,0.5)';
      g2.fillRect(8, ch - 14, cw * 0.3, 6);
      g2.fillStyle = gd.power > 0.8 ? '#ff7a5c' : '#f6c56a';
      g2.fillRect(8, ch - 14, cw * 0.3 * gd.power, 6);
    }
    for (const b of game.balls) {
      if (b.down) continue;
      const x = px(b.x), y = py(b.y), r = R * scale;
      g2.fillStyle = colour(b.n);
      g2.beginPath();
      g2.arc(x, y, r, 0, Math.PI * 2);
      g2.fill();
      if (b.n > 8) {
        // a stripe: white ball, coloured band
        g2.save();
        g2.beginPath();
        g2.arc(x, y, r, 0, Math.PI * 2);
        g2.clip();
        g2.fillStyle = '#fffdf7';
        g2.fillRect(x - r, y - r, r * 2, r * 0.55);
        g2.fillRect(x - r, y + r * 0.45, r * 2, r * 0.55);
        g2.restore();
      }
      if (b.n > 0) {
        g2.fillStyle = '#fffdf7';
        g2.beginPath();
        g2.arc(x, y, r * 0.45, 0, Math.PI * 2);
        g2.fill();
        g2.fillStyle = '#141414';
        g2.font = `700 ${Math.max(6, r * 0.7)}px sans-serif`;
        g2.textAlign = 'center';
        g2.textBaseline = 'middle';
        g2.fillText(String(b.n), x, y + 0.5);
      }
      g2.strokeStyle = 'rgba(0,0,0,0.35)';
      g2.beginPath();
      g2.arc(x, y, r, 0, Math.PI * 2);
      g2.stroke();
    }
  }

  // ---------- the play ----------
  let last = performance.now();
  let raf = 0;
  function loop(t: number) {
    if (!canvas.isConnected) return cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    if (canvas.getBoundingClientRect().width !== cw) size();
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (game && rolling) {
      const subs = Math.ceil(dt * 960);
      for (let i = 0; i < subs; i++) step(game.balls, dt / subs, rolling);
      if (!moving(game.balls)) void settle();
    }
    draw();
  }
  raf = requestAnimationFrame(loop);

  function shoot(angle: number, power: number) {
    if (!game) return;
    rolling = { first: null, potted: [], rail: false, scratch: false };
    strike(game.balls, angle, power);
    sfx('pop');
  }

  async function settle() {
    if (!game || !rolling) return;
    const log = rolling;
    rolling = null;
    if (log.potted.length) sfx('thump');
    game = afterShot(game, log);
    statusLine();
    $('bil-note').textContent = game.note;
    if (game.winner) return finish(game.winner === 'you');
    if (game.turn === 'mo') window.setTimeout(moTurn, 1100);
  }

  function moTurn() {
    if (!game || game.winner || game.turn !== 'mo') return;
    const shot = moShot(game);
    const cue = game.balls.find((b) => b.n === 0)!;
    if (shot.place) Object.assign(cue, { x: shot.place.x, y: shot.place.y, down: false, vx: 0, vy: 0 });
    window.setTimeout(() => shoot(shot.angle, shot.power), 600);
  }

  async function finish(won: boolean) {
    mo(won ? pick(MO_LOSE) : pick(MO_WIN));
    sfx(won ? 'cheer' : 'thump');
    try {
      const r = await api.bilFinish(s, id, won);
      $('bil-note').textContent = `${game?.note ?? ''} ${r.won ? `+${money(r.payout - r.stake)}` : `−${money(r.stake)}`}`;
      setBank(r.bank, r.lostToday);
      void refresh().catch(() => {});
      void payTrophies();
    } catch (e) {
      mo((e as Error).message);
    }
    $('bil-go').removeAttribute('disabled');
    $('bil-chips').classList.remove('locked');
  }

  // your shot: tap to place the cue ball (in hand), drag to aim and shoot
  const point = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!game || game.winner || game.turn !== 'you' || rolling || busy) return;
    const p = point(e);
    aim = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!aim) return;
    const p = point(e);
    aim.x1 = p.x;
    aim.y1 = p.y;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!aim || !game) return;
    const gd = guide();
    const tap = Math.hypot(aim.x1 - aim.x0, aim.y1 - aim.y0) < 6;
    const at = toTable(aim.x0, aim.y0);
    aim = null;
    if (tap) {
      // place the cue ball, if it's in hand (behind the line for the break)
      if (game.inHand && freeSpot(game.balls, at.x, at.y) && (!game.behindHead || at.x <= HEAD_X)) {
        Object.assign(game.balls.find((b) => b.n === 0)!, { x: at.x, y: at.y, down: false });
        sfx('pop');
      }
      return;
    }
    if (gd) shoot(Math.atan2(gd.ay, gd.ax), gd.power);
    void e;
  });

  $('bil-go').onclick = async () => {
    if (game && !game.winner) return;
    store.set(STAKE_KEY, String(stake));
    busy = true;
    try {
      const r = await api.bilStart(s, stake);
      id = r.id;
      setBank(r.bank, r.lostToday);
      game = newGame(r.breaks);
      $('bil-go').setAttribute('disabled', '');
      $('bil-chips').classList.add('locked');
      mo(r.breaks === 'you' ? 'Your break. Put the cue ball anywhere behind the line, or just hit it.' : 'My break. Stand back.');
      statusLine();
      $('bil-table').scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (r.breaks === 'mo') window.setTimeout(moTurn, 1200);
    } catch (e) {
      mo((e as Error).message);
    } finally {
      busy = false;
    }
  };
  void groupOf;
}
