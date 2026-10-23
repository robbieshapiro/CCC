// Headless checks for the 3D holes: determinism, slopes, secret routes, a greedy solver, and a novice sim.
// Run: npm run check-holes
import { BAG, CLUBS, type ClubId } from '../src/golf3d/clubs';
import { courseFor } from '../src/golf3d/courses';
import { conditionsFor, withPin } from '../src/golf3d/conditions';
import { CUP_R, curbs, simulate } from '../src/golf3d/physics';
import { accuracyError, goldHalf, OVERSWING, powerSpeed, returnSpeed } from '../src/golf3d/swing';
import { gradAt, inPoly, isWater, surfaceAt } from '../src/golf3d/terrain';
import type { Hole, Shot, V2 } from '../src/golf3d/types';
import { makeRng } from '../src/seed';

const ok = (c: boolean, m: string) => {
  console.log(c ? 'PASS' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};

// Path distance to a target over a 2 ft grid. Water is crossable (you can chip it) but costs double.
function navField(h: Hole, target: V2 = h.cup) {
  const C = 2;
  const { x0, y0, x1, y1 } = h.bounds;
  const W = Math.ceil((x1 - x0) / C);
  const H = Math.ceil((y1 - y0) / C);
  const walls = [...curbs(h), ...h.walls];
  const idx = (x: number, y: number) => Math.floor((x - x0) / C) + Math.floor((y - y0) / C) * W;
  const centre = (i: number) => ({ x: x0 + (i % W) * C + C / 2, y: y0 + Math.floor(i / W) * C + C / 2 });
  const blocked = (p: V2) => {
    const g = gradAt(h, p.x, p.y);
    return !inPoly(p, h.border) || Math.hypot(g.x, g.y) > 2.5 || h.posts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r + 0.4);
  };
  const cross = (a: V2, b: V2) =>
    walls.some((w) => {
      const d = (p: V2, q: V2, r: V2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      return d(w.a, w.b, a) * d(w.a, w.b, b) < 0 && d(a, b, w.a) * d(a, b, w.b) < 0;
    });
  const dist = new Float64Array(W * H).fill(Infinity);
  const start = idx(target.x, target.y);
  dist[start] = 0;
  // Dijkstra with a binary heap
  const heap: [number, number][] = [[0, start]];
  const push = (e: [number, number]) => {
    heap.push(e);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d0, i] = pop();
    if (d0 > dist[i]) continue;
    const p = centre(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx * C, y: p.y + dy * C };
      if (n.x < x0 || n.y < y0 || n.x >= x1 || n.y >= y1) continue;
      const j = idx(n.x, n.y);
      if (blocked(n) || cross(p, n)) continue;
      const nd = d0 + (isWater(h, n) ? C * 2 : C);
      if (nd < dist[j]) {
        dist[j] = nd;
        push([nd, j]);
      }
    }
  }
  return (p: V2) => {
    if (p.x < x0 || p.y < y0 || p.x >= x1 || p.y >= y1) return Infinity;
    return dist[idx(p.x, p.y)];
  };
}

const POWERS: Record<ClubId, number[]> = {
  putter: [0.04, 0.08, 0.13, 0.2, 0.28, 0.38, 0.5, 0.64, 0.8, 1],
  wedge: [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
  iron: [0.2, 0.4, 0.55, 0.7, 0.85, 1],
  driver: [0.4, 0.6, 0.8, 0.9, 1],
};

// Clubs a player could pick from this lie: wedge or iron from sand, putter or wedge on the green.
function clubsFor(h: Hole, pos: V2): ClubId[] {
  const s = surfaceAt(h, pos);
  if (s === 'sand') return ['wedge', 'iron'];
  if (s === 'green') return ['putter', 'wedge'];
  return BAG;
}

type Cand = { d: number; shot: Shot };

function candidates(h: Hole, pos: V2, nav: (p: V2) => number, clock: number, step: number, exclude?: string, only?: ClubId) {
  const out: Cand[] = [];
  const toCup = Math.atan2(h.cup.x - pos.x, h.cup.y - pos.y);
  for (const club of only ? [only] : clubsFor(h, pos))
    for (let a = -180; a < 180; a += club === 'putter' && Math.hypot(h.cup.x - pos.x, h.cup.y - pos.y) < 40 ? step / 4 : step)
      for (const power of POWERS[club])
      for (const spin of h.greenFirm && (club === 'iron' || club === 'wedge') ? [0, 1] : [0]) {
        const angle = club === 'putter' && Math.hypot(h.cup.x - pos.x, h.cup.y - pos.y) < 40 ? toCup + ((a / 4) * Math.PI) / 180 : (a * Math.PI) / 180;
        const shot: Shot = { angle, power, club, error: 0, clock, spin };
        const r = simulate(h, pos, shot, false);
        if (exclude && r.zones.includes(exclude)) continue;
        out.push({ d: r.holed ? -1 : r.penalty ? Infinity : nav(r.end), shot });
        if (r.holed) return out;
      }
  return out;
}

function bestShot(h: Hole, pos: V2, nav: (p: V2) => number, clock: number, exclude?: string, only?: ClubId) {
  const c = candidates(h, pos, nav, clock, 4, exclude, only);
  return c.reduce((b, x) => (x.d < b.d ? x : b), c[0]);
}

function solve(h: Hole, opts: { exclude?: string; via?: V2[] } = {}) {
  const legs = [...(opts.via ?? []).map((v) => ({ nav: navField(h, v), at: v })), { nav: navField(h), at: null as V2 | null }];
  let pos = h.tee;
  let leg = 0;
  let rollNext = false;
  const zones = new Set<string>();
  for (let s = 1; s <= h.par + 3; s++) {
    const { nav, at } = legs[leg];
    const b = bestShot(h, pos, nav, s * 3.1, opts.exclude, rollNext ? 'putter' : undefined);
    rollNext = false;
    if (!b || b.d === Infinity) return { strokes: 99, zones };
    const r = simulate(h, pos, b.shot, false);
    r.zones.forEach((z) => zones.add(z));
    if (process.env.TRACE) console.log(`  ${h.id} ${s}: ${b.shot.club} ${Math.round((b.shot.angle * 180) / Math.PI)}° ${b.shot.power.toFixed(2)} -> ${r.end.x.toFixed(0)},${r.end.y.toFixed(0)} ${surfaceAt(h, r.end)} ${r.zones.join(' ')}`);
    if (r.holed) return { strokes: s, zones };
    pos = r.end;
    if (at && Math.hypot(pos.x - at.x, pos.y - at.y) < 10) {
      leg++;
      rollNext = true; // the secret is rolled
    }
  }
  return { strokes: 99, zones };
}

// Where each secret starts, and the clubs that can use it from there.
const SECRET_FROM: Record<string, { from: V2; clubs: ClubId[]; angles: [number, number] }> = {
  summit: { from: { x: 0, y: 0 }, clubs: ['putter'], angles: [30, 75] },
  island: { from: { x: -24, y: 58 }, clubs: ['putter'], angles: [-6, 6] },
  ridge: { from: { x: -50, y: 318 }, clubs: ['iron', 'wedge'], angles: [-110, -70] },
};

// The best finish (ft from the pin) of any clean shot from the secret's start that uses it.
function secretBest(h: Hole) {
  const { from, clubs, angles } = SECRET_FROM[h.id];
  let best = { d: Infinity, shot: null as Shot | null };
  for (const club of clubs)
    for (let a = angles[0]; a <= angles[1]; a += club === 'putter' ? 0.25 : 1)
      for (let p = 0.3; p <= 1.001; p += 0.02) {
        const shot: Shot = { angle: (a * Math.PI) / 180, power: p, club, error: 0, clock: 0 };
        const r = simulate(h, from, shot, false);
        if (!r.zones.includes(h.secret.zone) || r.penalty) continue;
        const d = r.holed ? 0 : Math.hypot(r.end.x - h.cup.x, r.end.y - h.cup.y);
        if (d < best.d) best = { d, shot };
      }
  return best;
}

// The swing meter as a person plays it: tap timing scatters around the centre of the bar.
// A person's tap is about this many seconds off, either way.
const TIMING = 0.06;

// The three-tap swing as a person plays it: the power stop lands near the plan, the strike near the gold.
function swing(club: ClubId, plan: number, gauss: () => number) {
  if (club === 'putter') return { power: Math.max(0.03, Math.min(1, plan * (1 + gauss() * 0.12))), error: 0 };
  const power = Math.max(0.05, Math.min(OVERSWING, plan + gauss() * TIMING * powerSpeed(club, plan)));
  const miss = gauss() * TIMING * returnSpeed(club, power);
  return { power, error: accuracyError(miss, goldHalf(club, power)) };
}

// A risk-aware pick: the best few greedy shots, re-scored over small mistakes.
function safeShot(h: Hole, pos: V2, nav: (p: V2) => number, clock: number) {
  const cands = candidates(h, pos, nav, clock, 6).sort((a, b) => a.d - b.d);
  const here = nav(pos);
  let best = cands[0];
  let bestScore = Infinity;
  for (const c of cands.slice(0, 12)) {
    let sum = 0;
    const e = c.shot.club === 'putter' ? 0 : 0.5;
    for (const [da, dp, de] of [[-3, 0, 0], [3, 0, 0], [0, -0.08, 0], [0, 0.08, 0], [0, 0, e], [0, 0, -e]]) {
      const r = simulate(h, pos, { ...c.shot, angle: c.shot.angle + (da * Math.PI) / 180, power: Math.min(1, c.shot.power * (1 + dp)), error: de }, false);
      sum += r.holed ? 0 : r.penalty ? here + 60 : nav(r.end);
    }
    if (sum < bestScore) {
      bestScore = sum;
      best = c;
    }
  }
  return best;
}

function novice(base: Hole, seed: string) {
  // a random day: its pin and its wind, which a novice doesn't allow for
  const today = conditionsFor(base, `sim:${seed}`);
  const h = withPin(base, today);
  const nav = navField(h);
  const rng = makeRng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rng.next() || 1e-9)) * Math.cos(2 * Math.PI * rng.next());
  let pos = h.tee;
  let s = 0;
  const log: string[] = [];
  while (s < h.par + 3) {
    s++;
    const clock = rng.next() * 30;
    const b = safeShot(h, pos, nav, clock);
    const shot = {
      ...b.shot,
      angle: b.shot.angle + (gauss() * 3.5 * Math.PI) / 180,
      ...swing(b.shot.club, b.shot.power, gauss),
      wind: today.accel,
    };
    const r = simulate(h, pos, shot, false);
    log.push(`${shot.club[0]}${r.holed ? '!' : r.penalty ? 'x' : ''}`);
    if (r.holed) break;
    if (r.penalty) s++; // water or out of bounds costs a stroke
    else pos = r.end;
  }
  if (process.env.TRACE) console.log(`  ${h.id} ${seed}: ${log.join(' ')}`);
  return Math.min(s, h.par + 3);
}

const course = courseFor('2026-10');
const mode = process.argv[2] ?? 'all';
const only = process.argv[3];
const holes = course.holes.filter((h) => !only || h.id === only);

if (mode === 'all' || mode === 'basic') {
  const first = course.holes[0];
  const s: Shot = { angle: 0.1, power: 0.7, club: 'iron', error: 0.3, clock: 2 };
  const a = simulate(first, first.tee, s);
  const b = simulate(first, first.tee, s);
  ok(a.end.x === b.end.x && a.end.y === b.end.y && a.frames.length === b.frames.length, 'deterministic');
  const flat: Hole = { ...first, terrain: [], water: [], movers: [], pushes: [], walls: [], posts: [], regions: [], base: 'fairway', cup: { x: 0, y: 2000 } };
  for (const club of ['driver', 'iron', 'wedge'] as ClubId[]) {
    const r = simulate(flat, { x: 0, y: 0 }, { angle: 0, power: 1, club, error: 0, clock: 0 });
    const land = r.frames.find((f, i) => i > 2 && f.z <= 0.01)!;
    const hi = CLUBS[club].carry[1];
    ok(Math.abs(land.y - hi) < hi * 0.12 && r.end.y > land.y, `${club} carries ${land.y.toFixed(0)} ft (spec ${hi}) and rolls to ${r.end.y.toFixed(0)}`);
  }
  const slice = simulate(flat, { x: 0, y: 0 }, { angle: 0, power: 1, club: 'driver', error: 1, clock: 0 }, false);
  const hook = simulate(flat, { x: 0, y: 0 }, { angle: 0, power: 1, club: 'driver', error: -1, clock: 0 }, false);
  ok(slice.end.x > 20 && hook.end.x < -20, `a slice goes right (${slice.end.x.toFixed(0)}), a hook left (${hook.end.x.toFixed(0)})`);
  const cupHole: Hole = { ...flat, cup: { x: CUP_R * 0.8, y: 30 } };
  const fast = simulate(cupHole, { x: 0, y: 0 }, { angle: 0, power: 1, club: 'putter', error: 0, clock: 0 }, false);
  ok(fast.holed, 'a full-speed putt that crosses the cup drops');
  const miss = simulate({ ...cupHole, cup: { x: CUP_R + 0.2, y: 30 } }, { x: 0, y: 0 }, { angle: 0, power: 1, club: 'putter', error: 0, clock: 0 }, false);
  ok(!miss.holed, 'a putt that misses the cup by a hair stays out');
  const slope: Hole = { ...flat, base: 'green', terrain: [{ kind: 'tilt', gx: 0, gy: 0.3 }] };
  const down = simulate(slope, { x: 0, y: 100 }, { angle: 0, power: 0.01, club: 'putter', error: 0, clock: 0 }, false);
  ok(down.end.y < 60, `a ball on a slope rolls back downhill (${down.end.y.toFixed(1)})`);
  for (const h of course.holes) {
    ok(!isWater(h, h.tee), `${h.name}: the tee is dry`);
    for (const pin of h.pins ?? [h.cup]) ok(!isWater(h, pin) && surfaceAt(h, pin) === 'green', `${h.name}: pin ${pin.x},${pin.y} is on dry green`);
  }
}

if (mode === 'all' || mode === 'solve') {
  for (const h of holes) {
    const normal = solve(h, { exclude: h.secret.zone });
    ok(normal.strokes <= h.par, `${h.name} par ${h.par}: solver ${normal.strokes} the normal way`);
    // the secret should be worth finding: it leaves you close
    const best = secretBest(h);
    const near = h.par >= 5 ? 160 : 60;
    ok(best.d < near, `${h.name}: ${h.secret.name} finishes ${best.d.toFixed(0)} ft from the pin ${best.shot ? `(${best.shot.club} ${Math.round((best.shot.angle * 180) / Math.PI)}° ${best.shot.power.toFixed(2)})` : ''}`);
  }
}

if (mode === 'all' || mode === 'novice') {
  let over = 0;
  for (const h of holes) {
    const scores = [1, 2, 3, 4, 5, 6].map((i) => novice(h, `${h.id}:${i}`));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    over += avg - h.par;
    console.log(`${h.name}: novice ${scores.join(',')} avg ${(avg - h.par).toFixed(1)} vs par`);
  }
  console.log(`novice average ${(over / holes.length).toFixed(2)} over par per hole (target about +2)`);
}
