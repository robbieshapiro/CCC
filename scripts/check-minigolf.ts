// Headless checks for Hollow Hills Mini Golf: every hole can be holed, how many strokes a sharp putter needs, and how
// many a casual one does. The bot reads the hole with a walking-distance map round the walls (the coffin is a
// shortcut), tries putts at every angle and pace (and, where things move, at different moments), and takes the one
// that leaves it closest.
// Run: npm run check-minigolf [hole-id]
import { curbs, simulate } from '../src/golf3d/physics';
import { HOLLOW_HILLS } from '../src/golf3d/minigolf';
import { bake, inPoly, isWater } from '../src/golf3d/terrain';
import type { Hole, V2 } from '../src/golf3d/types';
import { makeRng } from '../src/seed';

const ok = (c: boolean, m: string) => {
  console.log(c ? 'PASS' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};

function navField(h: Hole) {
  const C = 1;
  const { x0, y0, x1, y1 } = h.bounds;
  const W = Math.ceil((x1 - x0) / C);
  const H = Math.ceil((y1 - y0) / C);
  const walls = [...curbs(h), ...h.walls];
  const idx = (x: number, y: number) => Math.floor((x - x0) / C) + Math.floor((y - y0) / C) * W;
  const centre = (i: number) => ({ x: x0 + (i % W) * C + C / 2, y: y0 + Math.floor(i / W) * C + C / 2 });
  const blocked = (p: V2) => !inPoly(p, h.border) || isWater(h, p) || h.posts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r + 0.3);
  const cross = (a: V2, b: V2) =>
    walls.some((w) => {
      const d = (p: V2, q: V2, r: V2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      return d(w.a, w.b, a) * d(w.a, w.b, b) < 0 && d(a, b, w.a) * d(a, b, w.b) < 0;
    });
  const dist = new Float64Array(W * H).fill(Infinity);
  const open: number[] = [];
  const seed = (i: number, d: number) => {
    if (d < dist[i]) {
      dist[i] = d;
      open.push(i);
    }
  };
  seed(idx(h.cup.x, h.cup.y), 0);
  // a simple label-correcting sweep: good enough on a few thousand cells
  for (let pass = 0; open.length && pass < 1e7; pass++) {
    const i = open.shift()!;
    const p = centre(i);
    for (const [dx, dy, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
      const n = { x: p.x + dx * C, y: p.y + dy * C };
      if (n.x < x0 || n.y < y0 || n.x >= x1 || n.y >= y1) continue;
      if (blocked(n) || cross(p, n)) continue;
      seed(idx(n.x, n.y), dist[i] + c * C);
    }
  }
  // the coffin: in at the top of the first lane, out by the cup
  for (const pt of h.portals ?? []) {
    const out = dist[idx(pt.to.x, pt.to.y)] + 3;
    for (let i = 0; i < dist.length; i++) {
      const p = centre(i);
      if (Math.hypot(p.x - pt.x, p.y - pt.y) < pt.r && out < dist[i]) dist[i] = out;
    }
  }
  return (p: V2) => {
    const i = idx(p.x, p.y);
    return i >= 0 && i < dist.length && Number.isFinite(dist[i]) ? dist[i] : 999;
  };
}

type Pick = { angle: number; power: number; clock: number; score: number };

// robust: a casual player wants the putt that still ends up close when it's a little off, not a one-in-a-hundred bank
function bestPutt(h: Hole, nav: (p: V2) => number, from: V2, robust = false): Pick {
  const moving = h.movers.length || h.pushes.length;
  const clocks = moving ? [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9] : [0];
  const score = (angle: number, power: number, clock: number) => {
    const r = simulate(h, from, { angle, power, club: 'putter', error: 0, clock }, false);
    return r.holed ? -1 : r.penalty ? 500 : nav(r.end);
  };
  let picks: Pick[] = [];
  for (const clock of clocks)
    for (let a = 0; a < 360; a += 5)
      for (let pw = 0.1; pw <= 1.001; pw += 0.075) {
        const angle = (a * Math.PI) / 180;
        picks.push({ angle, power: pw, clock, score: score(angle, pw, clock) });
      }
  picks.sort((p, q) => p.score - q.score);
  picks = picks.slice(0, 8);
  let best = picks[0];
  const refined: Pick[] = [];
  for (const p of picks)
    for (let da = -2.5; da <= 2.5; da += 0.5)
      for (let dp = -0.06; dp <= 0.061; dp += 0.02) {
        const angle = p.angle + (da * Math.PI) / 180;
        const power = Math.max(0.05, Math.min(1, p.power + dp));
        const s = score(angle, power, p.clock);
        refined.push({ angle, power, clock: p.clock, score: s });
        if (s < best.score) best = { angle, power, clock: p.clock, score: s };
      }
  if (!robust) return best;
  refined.sort((p, q) => p.score - q.score);
  const wobble = (p: Pick) => {
    const tries = [
      [0, 1, 0],
      [1.8, 1, 0],
      [-1.8, 1, 0],
      [0, 1.06, 0],
      [0, 0.94, 0],
      [0, 1, 1.3],
    ].map(([da, k, dt]) => Math.max(0, score(p.angle + (da * Math.PI) / 180, Math.min(1, p.power * k), p.clock + dt)));
    return tries.reduce((a, b) => a + b, 0) / tries.length;
  };
  let pick = refined[0];
  let bestW = Infinity;
  for (const p of refined.filter((_, i) => i % 3 === 0).slice(0, 40)) {
    const w = wobble(p);
    if (w < bestW) [bestW, pick] = [w, p];
  }
  return pick;
}

// One go at the hole. sharp: takes the bot's putt as read. Casual: a few degrees off line, the pace a bit off, and
// no thought for timing.
function play(h: Hole, nav: (p: V2) => number, casual: boolean, seed: string) {
  const rng = makeRng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
  let at = { ...h.tee };
  for (let n = 1; n <= h.par + 3; n++) {
    const p = bestPutt(h, nav, at, casual);
    const shot = casual
      ? { angle: p.angle + (gauss() * 2.2 * Math.PI) / 180, power: Math.min(1, Math.max(0.05, p.power * (1 + gauss() * 0.07))), clock: rng.next() * 6 }
      : p;
    const r = simulate(h, at, { ...shot, club: "putter", error: 0 }, false);
    if (process.env.DEBUG) console.log("  ", n, at, p, shot, r.end, r.holed, r.penalty);
    if (r.holed) return n;
    if (!r.penalty) at = r.end;
    else n++; // a stroke and play it again
    if (n >= h.par + 3) return h.par + 3;
  }
  return h.par + 3;
}

const only = process.argv[2];
const runs = Number(process.env.RUNS ?? 6);
for (const h of HOLLOW_HILLS.filter((x) => !only || x.id === only)) {
  bake(h, 0.25);
  const nav = navField(h);
  const t0 = Date.now();
  ok(nav(h.tee) < 999, `${h.name}: the cup can be reached from the tee (${nav(h.tee).toFixed(0)} ft walk)`);
  const sharp = play(h, nav, false, `${h.id}:sharp`);
  const casual = Array.from({ length: runs }, (_, i) => play(h, nav, true, `${h.id}:casual:${i}`));
  const avg = casual.reduce((a, b) => a + b, 0) / casual.length;
  ok(sharp <= h.par, `${h.name} (par ${h.par}): sharp ${sharp}, casual ${avg.toFixed(1)} [${casual.join(' ')}] in ${Math.round((Date.now() - t0) / 1000)}s`);
}
