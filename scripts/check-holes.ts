// Headless checks for the 3D holes: determinism, slopes, secret routes, a greedy solver, and a novice sim.
// Run: npm run check-holes
import { BAG, CLUBS, type ClubId } from '../src/golf3d/clubs';
import { courseById, courseFor } from '../src/golf3d/courses';
import { conditionsFor, withPin } from '../src/golf3d/conditions';
import { CUP_R, cupR, curbs, DROP_SPEED, simulate } from '../src/golf3d/physics';
import { accuracyError, goldHalf, OVERSWING, powerSpeed, returnSpeed, type MeterStyle } from '../src/golf3d/swing';
import { bake, gradAt, inPoly, isWater, surfaceAt } from '../src/golf3d/terrain';
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

// tour greens need a finer touch on the putter to find the speed that drops
const TOUR_PUTTS = [...Array.from({ length: 29 }, (_, i) => 0.03 + i * 0.02), 0.7, 0.8, 1];

// Clubs a player could pick from this lie: wedge or iron from sand, putter or wedge on the green.
function clubsFor(h: Hole, pos: V2): ClubId[] {
  const s = surfaceAt(h, pos);
  if (s === 'sand') return ['wedge', 'iron'];
  if (s === 'green') return ['putter', 'wedge'];
  return BAG;
}

type Cand = { d: number; shot: Shot };

// QUICK=1 (npm run check-holes quick): a coarse sweep of directions, then a closer look round the best few,
// instead of every direction at every power. Close to the full search's picks, at a fraction of the cost.
const QUICK = !!process.env.QUICK;

function candidates(h: Hole, pos: V2, nav: (p: V2) => number, clock: number, step: number, exclude?: string, only?: ClubId) {
  const out: Cand[] = [];
  const toCup = Math.atan2(h.cup.x - pos.x, h.cup.y - pos.y);
  const near = Math.hypot(h.cup.x - pos.x, h.cup.y - pos.y) < 40;
  for (const club of only ? [only] : clubsFor(h, pos)) {
    const putt = club === 'putter' && near;
    // try every power (and spin) in one direction; true if one of them holes out
    const tryAt = (a: number) => {
      for (const power of club === 'putter' && h.tour ? (QUICK ? TOUR_PUTTS.filter((_, i) => i % 2 === 0) : TOUR_PUTTS) : POWERS[club])
        for (const spin of h.greenFirm && (club === 'iron' || club === 'wedge') ? [0, 1] : [0]) {
          const angle = putt ? toCup + ((a / 4) * Math.PI) / 180 : (a * Math.PI) / 180;
          const shot: Shot = { angle, power, club, error: 0, clock, spin };
          const r = simulate(h, pos, shot, false);
          if (exclude && r.zones.includes(exclude)) continue;
          out.push({ d: r.holed ? -1 : r.penalty ? Infinity : nav(r.end), shot });
          if (r.holed) return true;
        }
      return false;
    };
    if (!QUICK || putt) {
      // quick mode reads putts within 30° of the hole, a degree and a half apart
      const reach = putt && QUICK ? 120 : 180;
      for (let a = -reach; a < reach; a += putt ? step / 4 : step) if (tryAt(a)) return out;
      continue;
    }
    const from = out.length;
    for (let a = -180; a < 180; a += 15) if (tryAt(a)) return out;
    const best = out
      .slice(from)
      .sort((x, y) => x.d - y.d)
      .map((c) => Math.round((c.shot.angle * 180) / Math.PI))
      .filter((a, i, all) => all.findIndex((b) => Math.abs(b - a) < 12) === i)
      .slice(0, 3);
    for (const b of best) for (let a = b - 12; a <= b + 12; a += step) if (a !== b && tryAt(a)) return out;
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

// Where each secret starts, and the clubs that can use it from there (and the hole clock, for the ones that keep time).
// near: how close it has to leave you to count as worth finding (default 60 ft, 160 on a par 5)
const SECRET_FROM: Record<string, { from: V2; clubs: ClubId[]; angles: [number, number]; clock?: number; spin?: number; near?: number }> = {
  summit: { from: { x: 0, y: 0 }, clubs: ['putter'], angles: [30, 75] },
  island: { from: { x: -24, y: 58 }, clubs: ['putter'], angles: [-6, 6] },
  ridge: { from: { x: -50, y: 318 }, clubs: ['iron', 'wedge'], angles: [-110, -70] },
  blowhole: { from: { x: 14, y: 316 }, clubs: ['putter'], angles: [-110, -80], clock: 4.6 },
  lavafield: { from: { x: 80, y: 424 }, clubs: ['putter'], angles: [-4, 12] },
  // the island leaves a long iron in: on in two, which is the prize
  caldera: { from: { x: 0, y: 0 }, clubs: ['driver'], angles: [28, 35], spin: 1, near: 220 },
};

// The best finish (ft from the pin) of any clean shot from the secret's start that uses it.
function secretBest(h: Hole) {
  const { from, clubs, angles, clock = 0, spin = 0 } = SECRET_FROM[h.id];
  let best = { d: Infinity, shot: null as Shot | null };
  for (const club of clubs)
    for (let a = angles[0]; a <= angles[1]; a += club === 'putter' ? 0.25 : 1)
      for (let p = 0.3; p <= 1.001; p += 0.02) {
        const shot: Shot = { angle: (a * Math.PI) / 180, power: p, club, error: 0, clock, spin };
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
// Tour courses use the vertical meter: a slower needle and wider gold.
function swing(club: ClubId, plan: number, gauss: () => number, style: MeterStyle = 'classic') {
  if (club === 'putter') return { power: Math.max(0.03, Math.min(1, plan * (1 + gauss() * 0.12))), error: 0 };
  const power = Math.max(0.05, Math.min(OVERSWING, plan + gauss() * TIMING * powerSpeed(club, plan)));
  const miss = gauss() * TIMING * returnSpeed(club, power, 1, style);
  return { power, error: accuracyError(miss, goldHalf(club, power, 1, style)) };
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
      ...swing(b.shot.club, b.shot.power, gauss, h.tour ? 'vertical' : 'classic'),
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

const course = process.env.COURSE ? courseById(process.env.COURSE)! : courseFor('2026-10');
const mode = process.argv[2] ?? 'all';

// quick: every hole at once, each in its own process, in quick mode; prints each hole's report as it lands
if (mode === 'quick') {
  const { spawn } = await import('node:child_process');
  const ids = course.holes.map((h) => h.id).filter((id) => !process.argv[3] || id === process.argv[3]);
  const run = (args: string[]) =>
    new Promise<string>((done) => {
      const kid = spawn(process.execPath, [process.argv[1], ...args], { env: { ...process.env, QUICK: '1' } });
      let text = '';
      kid.stdout.on('data', (d) => (text += d));
      kid.stderr.on('data', (d) => (text += d));
      kid.on('close', (code) => {
        if (code) process.exitCode = 1;
        done(text);
      });
    });
  const started = Date.now();
  const jobs = [run(['basic', '-']), ...ids.flatMap((id) => [run(['solve', id]), run(['novice', id])])];
  for (const job of jobs) process.stdout.write((await job).split('\n').filter((l) => !l.startsWith('  ')).join('\n'));
  console.log(`\nquick check done in ${Math.round((Date.now() - started) / 1000)}s`);
  process.exit();
}
const only = process.argv[3];
const holes = course.holes.filter((h) => !only || h.id === only);
// quick mode plays on a baked copy of the ground: near enough for the sims, and far quicker
if (QUICK) holes.forEach((h) => bake(h));

if (mode === 'all' || mode === 'basic') {
  const first = course.holes[0];
  const s: Shot = { angle: 0.1, power: 0.7, club: 'iron', error: 0.3, clock: 2 };
  const a = simulate(first, first.tee, s);
  const b = simulate(first, first.tee, s);
  ok(a.end.x === b.end.x && a.end.y === b.end.y && a.frames.length === b.frames.length, 'deterministic');
  const flat: Hole = { ...first, tour: false, terrain: [], water: [], movers: [], pushes: [], walls: [], posts: [], regions: [], base: 'fairway', cup: { x: 0, y: 2000 } };
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
  // tour greens: a putt has to be dying to drop
  const tour: Hole = { ...flat, base: 'green', tour: true, cup: { x: 0, y: 20 } };
  const putt = (speed: number, x = 0) => simulate(tour, { x, y: 0 }, { angle: 0, power: (speed - 1.5) / 32.5, club: 'putter', error: 0, clock: 0 }, false);
  const dying = putt(Math.sqrt(2 * 3 * 21));
  ok(dying.holed, `tour green: a putt dying at the hole drops (ends ${dying.end.x.toFixed(1)},${dying.end.y.toFixed(1)})`);
  const firm = putt(Math.sqrt(2 * 3 * 20) * 1.5);
  ok(!firm.holed, `tour green: a putt 1.5x too firm hops the hole (ends ${firm.end.y.toFixed(1)})`);
  const edge = putt(Math.sqrt(2 * 3 * 28), cupR(tour) * 0.8);
  ok(!edge.holed && Math.abs(edge.end.x - cupR(tour) * 0.8) > 0.5, `tour green: a firm putt on the edge lips out (ends ${edge.end.x.toFixed(1)},${edge.end.y.toFixed(1)})`);
  const flatFirm = simulate({ ...tour, tour: false }, { x: 0, y: 0 }, { angle: 0, power: (Math.sqrt(2 * 4.2 * 20) * 1.5 - 1.5) / 32.5, club: 'putter', error: 0, clock: 0 }, false);
  ok(flatFirm.holed, `classic greens are unchanged: the firm putt still drops (cap ${DROP_SPEED} ft/s only on tour)`);
  // the vertical meter gives you a good deal longer to find the gold
  for (const club of ['driver', 'iron', 'wedge'] as ClubId[]) {
    const ms = (style: MeterStyle) => (goldHalf(club, 1, 1, style) / returnSpeed(club, 1, 1, style)) * 1000;
    ok(ms('vertical') >= ms('classic') * 1.9, `vertical meter: ${club} gold window ±${ms('vertical').toFixed(0)} ms (classic ±${ms('classic').toFixed(0)})`);
  }
  // the Lava Field: a good drive carries the second flow onto the big island
  const lava = course.holes.find((h) => h.id === 'lavafield');
  if (lava)
    for (const power of [0.85, 0.9, 0.95, 1]) {
      const r = simulate(lava, lava.tee, { angle: 0, power, club: 'driver', error: 0, clock: 0 }, false);
      ok(!r.penalty && r.end.y > 280, `${lava.name}: a ${Math.round(power * 100)}% driver clears the flow (${r.end.x.toFixed(0)},${r.end.y.toFixed(0)})`);
    }
  // the Caldera's island: only a drive with backspin holds it
  const cal = course.holes.find((h) => h.id === 'caldera');
  if (cal) {
    const holds = (spin: number) => {
      let n = 0;
      for (let a = 28; a <= 35; a += 1)
        for (let p = 0.8; p <= 0.93; p += 0.02) {
          const r = simulate(cal, cal.tee, { angle: (a * Math.PI) / 180, power: p, club: 'driver', error: 0, clock: 0, spin }, false);
          if (!r.penalty && r.zones.includes(cal.secret.zone)) n++;
        }
      return n;
    };
    const stock = holds(0);
    const spun = holds(1);
    ok(stock === 0 && spun >= 3, `${cal.name}: a stock drive never holds the island (${stock}), a backspin drive can (${spun})`);
  }
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
    const near = SECRET_FROM[h.id].near ?? (h.par >= 5 ? 160 : 60);
    ok(best.d < near, `${h.name}: ${h.secret.name} finishes ${best.d.toFixed(0)} ft from the pin ${best.shot ? `(${best.shot.club} ${Math.round((best.shot.angle * 180) / Math.PI)}° ${best.shot.power.toFixed(2)})` : ''}`);
  }
}

if (mode === 'all' || mode === 'novice') {
  let over = 0;
  for (const h of holes) {
    const scores = (QUICK ? [1, 2, 3] : [1, 2, 3, 4, 5, 6]).map((i) => novice(h, `${h.id}:${i}`));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    over += avg - h.par;
    console.log(`${h.name}: novice ${scores.join(',')} avg ${(avg - h.par).toFixed(1)} vs par`);
  }
  console.log(`novice average ${(over / holes.length).toFixed(2)} over par per hole (target about +2)`);
}
