import { readFileSync } from 'node:fs';
// Headless checks for the 3D holes: determinism, slopes, secret routes, a greedy solver, and a novice sim.
// Run: npm run check-holes
import { bagFor, bagOf, CLUBS, ironIn, SCALE as SCALE_FT, type ClubId } from '../src/golf3d/clubs';
import { courseById, courseFor, tourCourses } from '../src/golf3d/courses';
import { MIDWAY, MIDWAY_PAR } from '../src/golf3d/midway';
import { periodClosesAt, periodOf } from '../src/day';
import { conditionsFor, gusted, withPin } from '../src/golf3d/conditions';
import { CUP_R, cupR, curbs, DROP_SPEED, dropPoint, lieScatter, simulate } from '../src/golf3d/physics';
import { accuracyError, goldHalf, OVERSWING, powerSpeed, returnSpeed, type MeterStyle } from '../src/golf3d/swing';
import { bake, gradAt, heightAt, inPoly, isWater, surfaceAt } from '../src/golf3d/terrain';
import type { Hole, Shot, V2 } from '../src/golf3d/types';
import { makeRng } from '../src/seed';
import { dailyHoles, MID_FROM, SHOT_FROM, STEPS_FROM } from '../src/dailyholes';
import { dailyShot } from '../src/daily';
import { checkHole } from '../src/designer/hole';

const ok = (c: boolean, m: string) => {
  console.log(c ? 'PASS' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};

// Path distance to a target over a 2 ft grid. Water is crossable (you can chip it) but costs double; so is a cliff
// (you can fly up or down one: the Caldera's crater and its sky islands are all cliff), at four times the cost.
function navField(h: Hole, target: V2 = h.cup) {
  const C = 2;
  const { x0, y0, x1, y1 } = h.bounds;
  const W = Math.ceil((x1 - x0) / C);
  const H = Math.ceil((y1 - y0) / C);
  const walls = [...curbs(h), ...h.walls];
  const idx = (x: number, y: number) => Math.floor((x - x0) / C) + Math.floor((y - y0) / C) * W;
  const centre = (i: number) => ({ x: x0 + (i % W) * C + C / 2, y: y0 + Math.floor(i / W) * C + C / 2 });
  const blocked = (p: V2) => !inPoly(p, h.border) || h.posts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r + 0.4);
  const steep = (p: V2) => {
    const g = gradAt(h, p.x, p.y);
    return Math.hypot(g.x, g.y) > 2.5;
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
      const nd = d0 + (steep(n) ? C * 4 : isWater(h, n) ? C * 2 : C);
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
  chip: [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
  // finer steps where the Caldera asks for touch: a short iron down into the crater, a measured hop between islands
  iron: [0.2, 0.3, 0.4, 0.48, 0.55, 0.62, 0.7, 0.78, 0.85, 0.92, 1],
  longiron: [0.2, 0.3, 0.4, 0.48, 0.55, 0.62, 0.7, 0.78, 0.85, 0.92, 1],
  shortiron: [0.2, 0.3, 0.4, 0.48, 0.55, 0.62, 0.7, 0.78, 0.85, 0.92, 1],
  driver: [0.3, 0.36, 0.42, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  wood: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
};

// tour greens need a finer touch on the putter to find the speed that drops
const TOUR_PUTTS = [...Array.from({ length: 29 }, (_, i) => 0.03 + i * 0.02), 0.7, 0.8, 1];

// Clubs a player could pick from this lie: wedge or iron from sand, putter, chip or wedge on the green.
function clubsFor(h: Hole, pos: V2): ClubId[] {
  const s = surfaceAt(h, pos);
  if (s === 'sand') return ['wedge', ironIn(bagOf(h))];
  if (s === 'green') return ['putter', 'chip', 'wedge'];
  return bagOf(h);
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
const SECRET_FROM: Record<string, { from: V2; clubs: ClubId[]; angles: [number, number]; clock?: number; spin?: number; near?: number; boost?: number }> = {
  summit: { from: { x: 0, y: 0 }, clubs: ['putter'], angles: [30, 75] },
  island: { from: { x: -24, y: 58 }, clubs: ['putter'], angles: [-6, 6] },
  ridge: { from: { x: -50, y: 318 }, clubs: ['iron', 'wedge'], angles: [-110, -70] },
  blowhole: { from: { x: 14, y: 416 }, clubs: ['putter'], angles: [-110, -80], clock: 4.6 },
  lavafield: { from: { x: 80, y: 424 }, clubs: ['putter'], angles: [-4, 12] },
  // the island is the prize: from it the green is one big shot away
  caldera: { from: { x: 0, y: 0 }, clubs: ['driver'], angles: [48, 54], spin: 1, near: 340 },
  geyseralley: { from: { x: -46, y: 124 }, clubs: ['putter'], angles: [-8, 8] },
  // the speed slot: a nuked drive (full power, dead centre, 20% further) down the middle finds the gully off the lip
  lavatube: { from: { x: 0, y: 0 }, clubs: ['driver'], angles: [-1, 1], boost: 1.2, near: 120 },
  // the Pacific Bluffs: roll round the cliff walk, land on Sea Lion Rock, roll down the keeper's road
  sealion: { from: { x: -34, y: 348 }, clubs: ['putter'], angles: [-6, 6] },
  thecarry: { from: { x: 0, y: 0 }, clubs: ['iron', 'wedge'], angles: [-12, 0] },
  lighthouse: { from: { x: 96, y: 632 }, clubs: ['putter'], angles: [-14, -4] },
  // off the bank behind the green, down the old road past the bridge, a drive down the launch, onto the beach
  poppies: { from: { x: 0, y: 0 }, clubs: ['iron', 'wood'], angles: [-8, 4] },
  highwayone: { from: { x: -52, y: 476 }, clubs: ['putter'], angles: [20, 50] },
  // the launch is a drive: it leaves a short iron, not a putt
  gliderport: { from: { x: 0, y: 0 }, clubs: ['driver', 'wood'], angles: [0, 8], near: 240 },
  kelpcove: { from: { x: 0, y: 0 }, clubs: ['driver', 'wood'], angles: [-6, 2], near: 170 },
  // the Western Reserve: off the bank behind the green, round the ridge, the kick off the left bank
  creekbend: { from: { x: -30, y: 440 }, clubs: ['wedge', 'iron'], angles: [-36, -12] },
  maplelake: { from: { x: 0, y: -88 }, clubs: ['wood', 'driver'], angles: [-14, 0] },
  theledges: { from: { x: 40, y: 520 }, clubs: ['wedge', 'iron'], angles: [2, 26] },
  thequarry: { from: { x: 110, y: 604 }, clubs: ['wedge', 'chip'], angles: [-32, 0] },
  thegorge: { from: { x: -4, y: 720 }, clubs: ['wedge', 'iron'], angles: [-40, -5] },
  // the Atlantic Links: a putt along the sheep track through the gate, off the bank behind the green, a drive onto the hard sand
  sheepwalk: { from: { x: 2, y: 398 }, clubs: ['putter', 'chip'], angles: [4, 24] },
  punchbowl: { from: { x: 0, y: 0 }, clubs: ['iron', 'wood'], angles: [-6, 6] },
  cliffroad: { from: { x: -44, y: 450 }, clubs: ['putter', 'chip'], angles: [-4, 14] },
  fairyfort: { from: { x: 0, y: 0 }, clubs: ['iron', 'wood'], angles: [-6, 6] },
  bogroad: { from: { x: 0, y: 0 }, clubs: ['driver', 'wood'], angles: [-16, -6], near: 110 },
  castlestrand: { from: { x: 0, y: 0 }, clubs: ['driver'], angles: [14, 30], near: 440 },
  // the Powder Bowl: down the magic carpet, off the snowbank, a drive onto the groomer, a drive down the glade, down the sled run
  bunnyhill: { from: { x: 44, y: 400 }, clubs: ['putter', 'chip'], angles: [-14, 4] },
  iceberg: { from: { x: -78, y: 202 }, clubs: ['putter', 'chip'], angles: [84, 96] },
  blackdiamond: { from: { x: -42, y: 730 }, clubs: ['chip', 'putter'], angles: [-24, -6], near: 200 },
  chairlift: { from: { x: 0, y: 0 }, clubs: ['driver', 'wood'], angles: [-14, -8], near: 360 },
  thelodge: { from: { x: -4, y: 400 }, clubs: ['longiron', 'wood'], angles: [-8, 2] },
  thebowl: { from: { x: 0, y: 0 }, clubs: ['shortiron', 'longiron'], angles: [-3, 3] },
  blueridge: { from: { x: -10, y: 470 }, clubs: ['putter', 'chip'], angles: [20, 50], near: 180 },
  doubleblack: { from: { x: -20, y: 498 }, clubs: ['putter', 'chip'], angles: [-55, -30], near: 200 },
};

// The best finish (ft from the pin) of any clean shot from the secret's start that uses it.
function secretBest(h: Hole) {
  const { from, clubs, angles, clock = 0, spin = 0, boost = 1 } = SECRET_FROM[h.id];
  let best = { d: Infinity, shot: null as Shot | null };
  for (const club of clubs)
    for (let a = angles[0]; a <= angles[1]; a += club === 'putter' ? 0.25 : 1)
      for (let p = 0.3; p <= 1.001; p += 0.02) {
        const shot: Shot = { angle: (a * Math.PI) / 180, power: p, club, error: 0, clock, spin, boost };
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
// pace: the hole's meter speed (the Powder Bowl's is a quarter slower): a slower meter, the same reaction time, a smaller miss
function swing(club: ClubId, plan: number, gauss: () => number, style: MeterStyle = 'classic', calm = false, pace = 1) {
  if (club === 'putter') return { power: Math.max(0.03, Math.min(1, plan * (1 + gauss() * 0.12))), error: 0 };
  const power = Math.max(0.05, Math.min(OVERSWING, plan + gauss() * TIMING * powerSpeed(club, plan, calm) * pace));
  const miss = gauss() * TIMING * returnSpeed(club, power, 1, style) * pace;
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

const SKILL_NOW = { v: Number(process.env.SKILL ?? 1) };
// (the rate mode switches it between runs)
const SKILL_GET = () => SKILL_NOW.v;
// tally: counts the putts, so the member mode can report the strokes to reach the green apart from them
function novice(base: Hole, seed: string, tally?: { putts: number }) {
  // a random day: its pin and its wind, which a novice doesn't allow for
  const today = conditionsFor(base, `sim:${seed}`);
  const h = withPin(base, today);
  const nav = navField(h);
  const rng = makeRng(seed);
  // SKILL scales every miss: 1 is the novice, lower is a steadier player (the member mode)
  const SKILL = SKILL_GET();
  const gauss = () => SKILL * Math.sqrt(-2 * Math.log(rng.next() || 1e-9)) * Math.cos(2 * Math.PI * rng.next());
  let pos = h.tee;
  let s = 0;
  const log: string[] = [];
  while (s < h.par + 3) {
    s++;
    const clock = rng.next() * 30;
    const b = safeShot(h, pos, nav, clock);
    const sw = swing(b.shot.club, b.shot.power, gauss, h.tour ? 'vertical' : 'classic', true, h.meterPace ?? 1);
    // storm courses gust from shot to shot, and thick rough scatters a shot (only drawn where they apply, so other
    // courses' runs are unchanged)
    const shot = {
      ...b.shot,
      angle: b.shot.angle + (gauss() * 3.5 * Math.PI) / 180,
      ...sw,
      error: sw.error + (h.turf ? lieScatter(h, pos, b.shot.club, rng.next()) : 0),
      wind: today.gust ? gusted(today, rng.next()).accel : today.accel,
    };
    const r = simulate(h, pos, shot, false);
    log.push(`${shot.club[0]}${r.holed ? '!' : r.penalty ? 'x' : ''}`);
    if (tally && shot.club === 'putter') tally.putts++;
    if (r.holed) break;
    // water or out of bounds costs a stroke; on tour courses you drop where it went in, as in the game
    if (r.penalty) {
      s++;
      pos = (h.tour && dropPoint(h, r.frames, pos)) || pos;
    } else pos = r.end;
  }
  if (process.env.TRACE) console.log(`  ${h.id} ${seed}: ${log.join(' ')}`);
  return Math.min(s, h.par + 3);
}

// COURSE=midway checks the bar's Midway holes (they're not on the calendar)
const course =
  process.env.COURSE === 'midway'
    ? ({ id: 'midway', name: 'The Midway', opens: '2099-01', tagline: '', holes: MIDWAY, par: MIDWAY_PAR } as unknown as NonNullable<ReturnType<typeof courseById>>)
    : process.env.COURSE ? courseById(process.env.COURSE)! : courseFor('2026-10');
const mode = process.argv[2] ?? 'all';

// quick: every hole at once, each in its own process, in quick mode; prints each hole's report as it lands
if (mode === 'quick') {
  const { spawn } = await import('node:child_process');
  const ids = course.holes.map((h) => h.id).filter((id) => !process.argv[3] || id === process.argv[3]);
  // quick: on the baked ground. The greens check always reads the exact ground, where a seam would hide.
  const run = (args: string[], quick = true) =>
    new Promise<string>((done) => {
      const kid = spawn(process.execPath, [process.argv[1], ...args], { env: quick ? { ...process.env, QUICK: '1' } : { ...process.env, QUICK: '' } });
      let text = '';
      kid.stdout.on('data', (d) => (text += d));
      kid.stderr.on('data', (d) => (text += d));
      kid.on('close', (code) => {
        if (code) process.exitCode = 1;
        done(text);
      });
    });
  const started = Date.now();
  const jobs = [run(['basic', '-']), ...ids.flatMap((id) => [run(['solve', id]), run(['novice', id]), run(['greens', id], false)])];
  for (const job of jobs) process.stdout.write((await job).split('\n').filter((l) => !l.startsWith('  ')).join('\n'));
  console.log(`\nquick check done in ${Math.round((Date.now() - started) / 1000)}s`);
  process.exit();
}
// Calibrate the steady bot to real members: npm run check-holes -- calibrate shots.json, where the file is the output of
// `select shot_export()` in Supabase (every posted shot of the last four weeks). Compares members' swing error with the
// bot's, club by club, and prints the SKILL that plays most like them (use it for the member mode's even-par target).
if (mode === 'calibrate') {
  const { readFileSync } = await import('node:fs');
  const file = process.argv[3];
  if (!file) {
    console.log('Usage: npm run check-holes -- calibrate shots.json (the output of select shot_export() in Supabase)');
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(file, 'utf8')) as { course: string; shot: { c: ClubId; p: number; e: number } }[];
  const full = rows.filter((r) => r.shot && r.shot.c !== 'putter' && Number.isFinite(r.shot.e) && Number.isFinite(r.shot.p));
  if (!full.length) {
    console.log('No full swings in that file yet.');
    process.exit(0);
  }
  const rms = (xs: number[]) => Math.sqrt(xs.reduce((a, x) => a + x * x, 0) / Math.max(1, xs.length));
  // the bot's error for the same club and power, on that course's meter, at a given SKILL
  const botRms = (skill: number, list: typeof full) => {
    const rng = makeRng(`calibrate:${skill}`);
    const gauss = () => skill * Math.sqrt(-2 * Math.log(rng.next() || 1e-9)) * Math.cos(2 * Math.PI * rng.next());
    const errs: number[] = [];
    for (const r of list) {
      const tour = !!courseById(r.course)?.holes[0]?.tour;
      for (let k = 0; k < 4; k++) errs.push(swing(r.shot.c, r.shot.p, gauss, tour ? 'vertical' : 'classic').error);
    }
    return rms(errs);
  };
  const members = rms(full.map((r) => r.shot.e));
  let best = { skill: 1, gap: Infinity };
  for (let k = 0.05; k <= 1.5; k += 0.05) {
    const gap = Math.abs(botRms(k, full) - members);
    if (gap < best.gap) best = { skill: Math.round(k * 100) / 100, gap };
  }
  console.log(`${full.length} full swings from ${new Set(rows.map((r) => r.course)).size} course(s). Members' error ${members.toFixed(3)} (rms), pure strikes ${Math.round((full.filter((r) => r.shot.e === 0).length / full.length) * 100)}%.`);
  for (const c of [...new Set(full.map((r) => r.shot.c))]) {
    const list = full.filter((r) => r.shot.c === c);
    console.log(`  ${c.padEnd(7)} n ${String(list.length).padStart(4)}  members ${rms(list.map((r) => r.shot.e)).toFixed(3)}  bot at SKILL ${best.skill} ${botRms(best.skill, list).toFixed(3)}`);
  }
  console.log(`SKILL=${best.skill} plays most like the members. Try: COURSE=<id> SKILL=${best.skill} SEEDS=12 npm run check-holes -- member <hole>`);
  process.exit(0);
}
const only = process.argv[3];
// daily: the Daily Shot's three holes a day, for DAYS days from FROM (default: the longer holes from Nov 22)
const DAILY_DAYS = Number(process.env.DAYS ?? 30);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const DAILY_FROM = process.env.FROM ?? STEPS_FROM;
const dailyDays = Array.from({ length: DAILY_DAYS }, (_, i) => addDays(DAILY_FROM, i));
const holes = mode === 'daily' ? dailyDays.flatMap((d) => dailyHoles(d).holes.map((x) => x.hole)) : course.holes.filter((h) => !only || h.id === only);
// quick mode plays on a baked copy of the ground: near enough for the sims, and far quicker
if (QUICK) holes.forEach((h) => bake(h));

if (mode === 'all' || mode === 'basic') {
  const first = course.holes[0];
  const s: Shot = { angle: 0.1, power: 0.7, club: 'iron', error: 0.3, clock: 2 };
  const a = simulate(first, first.tee, s);
  const b = simulate(first, first.tee, s);
  ok(a.end.x === b.end.x && a.end.y === b.end.y && a.frames.length === b.frames.length, 'deterministic');
  // plain ground: no hazards, the plain turf, and bounds wide enough that nothing goes out (a course's first hole can
  // have out of bounds hard by the fairway)
  const flat: Hole = { ...first, tour: false, turf: undefined, wet: false, terrain: [], water: [], movers: [], pushes: [], walls: [], roofs: [], ceilings: [], portals: [], posts: [], regions: [], base: 'fairway', cup: { x: 0, y: 2000 }, border: [{ x: -3000, y: -3000 }, { x: 3000, y: -3000 }, { x: 3000, y: 3000 }, { x: -3000, y: 3000 }] };
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
  // the vertical meter: a touch kinder than the classic one off the tee, as strict with the iron, much kinder with the wedge
  for (const club of ['driver', 'iron', 'wedge'] as ClubId[]) {
    const ms = (style: MeterStyle) => (goldHalf(club, 1, 1, style) / returnSpeed(club, 1, 1, style)) * 1000;
    const want = club === 'wedge' ? ms('vertical') >= ms('classic') * 1.9 : club === 'driver' ? Math.abs(ms('vertical') / ms('classic') - 1.25) < 0.02 : Math.abs(ms('vertical') - ms('classic')) < 1;
    ok(want, `vertical meter: ${club} gold window ±${ms('vertical').toFixed(0)} ms (classic ±${ms('classic').toFixed(0)})`);
  }
  // the calendar: October closes early at midnight Eastern going into Friday 30 October and the Caldera challenge runs
  // to Saturday 7 November; then Sunday-to-Saturday weeks
  ok(periodClosesAt('2026-10').toISOString() === '2026-10-30T04:00:00.000Z' && periodClosesAt('2026-10-30').toISOString() === '2026-11-08T05:00:00.000Z', 'periods close at midnight Eastern, either side of the clocks changing');
  ok(periodOf('2026-10-29') === '2026-10' && periodOf('2026-10-30') === '2026-10-30' && periodOf('2026-11-07') === '2026-10-30' && periodOf('2026-11-08') === '2026-11-08' && periodOf('2026-11-14') === '2026-11-08' && periodOf('2026-11-15') === '2026-11-15', 'weeks start on Sunday from November 8');
  ok(periodClosesAt('2026-11-08').toISOString() === '2026-11-15T05:00:00.000Z', 'a week closes at midnight Eastern going into Sunday');
  ok(courseFor('2026-10').id === 'highlands' && courseFor('2026-10-30').id === 'caldera' && courseFor('2026-10-30').holes.length === 6 && courseFor('2026-11-08').id === 'westernreserve' && courseFor('2026-11-15').id === 'windycity' && courseFor('2026-11-29').id === 'powderbowl' && courseFor('2026-12-06').id === 'powderbowl', 'October is the Highlands, the Caldera challenge is all six holes, the Western Reserve from Nov 8, then the Windy City from Nov 15, and the Powder Bowl from Nov 29 (and on through Dec 6)');
  // every weekly course from Nov 22 has its own look on home (CourseLook), and no two weeks in a row look alike
  {
    const weekly = tourCourses().filter((c) => !c.lab && c.opens >= '2026-11-22');
    const bare = weekly.filter((c) => !c.look);
    ok(!bare.length, `every course from Nov 22 has its own look${bare.length ? `: ${bare.map((c) => c.id).join(', ')} has none (add a look in courses.ts)` : ''}`);
    const same = weekly.slice(1).filter((c, i) => {
      const a = weekly[i].look;
      const b = c.look;
      return a && b && (a.colors.join() === b.colors.join() || a.icon === b.icon || (a.accent === b.accent && a.pattern === b.pattern));
    });
    ok(!same.length, `each week looks different from the week before${same.length ? `: ${same.map((c) => c.id).join(', ')} too like the week before` : ''}`);
  }
  // course_pars in supabase/schema.sql must hold every course's holes as they are now: submit_round refuses a card whose
  // pars differ (from Nov 15), so a change to a course's holes without it would refuse every card on that course
  {
    const sql = readFileSync('supabase/schema.sql', 'utf8');
    const listed = [...sql.matchAll(/\('([a-z0-9-]+)', '\{([0-9,]+)\}'\)/g)].map((m) => [m[1], m[2]] as const);
    const off = listed.filter(([id, pars]) => courseById(id) && courseById(id)!.holes.map((h) => h.par).join(',') !== pars);
    ok(listed.length > 0 && off.length === 0, `course_pars matches every course's holes${off.length ? `: ${off.map(([id]) => id).join(', ')} differ` : ''}`);
  }
  // the Lava Field: a good drive carries the second flow onto the big island
  const lava = course.holes.find((h) => h.id === 'lavafield');
  if (lava)
    for (const power of [0.85, 0.9, 0.95, 1])
      for (const side of [-1, 1]) {
        // aimed at one half of the big island or the other
        const r = simulate(lava, lava.tee, { angle: side * 0.09, power, club: 'driver', error: 0, clock: 0 }, false);
        ok(!r.penalty && r.end.y > 280, `${lava.name}: a ${Math.round(power * 100)}% driver ${side < 0 ? 'left' : 'right'} of the creek clears the flow (${r.end.x.toFixed(0)},${r.end.y.toFixed(0)})`);
      }
  // the Caldera's island: only a drive with backspin holds it
  const cal = course.holes.find((h) => h.id === 'caldera');
  if (cal) {
    const holds = (spin: number) => {
      let n = 0;
      for (let a = 48; a <= 54; a += 1)
        for (let p = 0.8; p <= 0.93; p += 0.02) {
          const r = simulate(cal, cal.tee, { angle: (a * Math.PI) / 180, power: p, club: 'driver', error: 0, clock: 0, spin }, false);
          if (!r.penalty && r.zones.includes(cal.secret.zone)) n++;
        }
      return n;
    };
    const stock = holds(0);
    const spun = holds(1);
    ok(stock <= 2 && spun >= stock * 5 && spun >= 3, `${cal.name}: a stock drive almost never holds the island (${stock}), a backspin drive can (${spun})`);
    // the safe way can't get home in two: the best drive from the corner is still well short
    let shortest = Infinity;
    for (let a = 80; a <= 96; a += 2) {
      const r = simulate(cal, { x: 0, y: 384 }, { angle: (a * Math.PI) / 180, power: 1, club: 'driver', error: 0, clock: 0 }, false);
      if (!r.penalty) shortest = Math.min(shortest, Math.hypot(r.end.x - cal.cup.x, r.end.y - cal.cup.y));
    }
    ok(shortest > 40, `${cal.name}: from the corner a full driver is still ${shortest.toFixed(0)} ft short: three shots the safe way`);
    // and the island is worth it: from there a driver finds the green
    let best = Infinity;
    for (let a = 46; a <= 56; a += 1)
      for (let p = 0.7; p <= 1; p += 0.02) {
        const r = simulate(cal, { x: 236, y: 190 }, { angle: (a * Math.PI) / 180, power: p, club: 'driver', error: 0, clock: 0 }, false);
        if (!r.penalty && surfaceAt(cal, r.end) === 'green') best = Math.min(best, Math.hypot(r.end.x - cal.cup.x, r.end.y - cal.cup.y));
      }
    ok(best < 30, `${cal.name}: from the island a driver can find the green (${best.toFixed(0)} ft)`);
  }
  // the Homecoming: a big drive carries the barranca, an ordinary one can't
  const home = course.holes.find((h) => h.id === 'lavatube');
  if (home) {
    const drive = (p: number) => simulate(home, home.tee, { angle: 0, power: p, club: 'driver', error: 0, clock: 0 }, false);
    const big = drive(1);
    const mid = drive(0.7);
    ok(!big.penalty && big.end.y > 344 && mid.end.y < 318, `${home.name}: a full drive carries the barranca (${big.end.y.toFixed(0)} ft), a 70% one stays short (${mid.end.y.toFixed(0)} ft${mid.penalty ? ', in the lava' : ''})`);
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
    // the secret should be worth finding: it leaves you close (a hole without one skips this)
    if (!h.secret.zone) continue;
    // a Hole Lab test hole has no secret check set up yet: say so, don't fail (add it to SECRET_FROM when it's built out)
    if (!SECRET_FROM[h.id]) {
      console.log(`NOTE ${h.name}: no secret check set up (SECRET_FROM)`);
      continue;
    }
    const best = secretBest(h);
    const near = SECRET_FROM[h.id].near ?? (h.par >= 5 ? 160 : 60);
    ok(best.d < near, `${h.name}: ${h.secret.name} finishes ${best.d.toFixed(0)} ft from the pin ${best.shot ? `(${best.shot.club} ${Math.round((best.shot.angle * 180) / Math.PI)}° ${best.shot.power.toFixed(2)})` : ''}`);
  }
}

// Putting, end to end: from rings round every pin, a range of speeds straight at the hole. On the green and fringe a
// ball should only slow the way friction and slope slow it; a sudden loss of pace (more than a third in a frame, with
// no wall, post, vent, mover or cup near) means it ran into something hidden in the ground, like the trench a tier's seam once left.
// It also mustn't sink below the surface.
if (mode === 'all' || mode === 'greens' || (mode === 'daily' && !process.env.NO_GREENS)) {
  const segD = (p: V2, a: V2, b: V2) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
    return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t);
  };
  const putting = (s: string) => s === 'green' || s === 'fringe';
  for (const h0 of holes) {
    const walls = [...curbs(h0), ...h0.walls];
    let putts = 0;
    const bad: string[] = [];
    for (const pin of h0.pins ?? [h0.cup]) {
      const h: Hole = { ...h0, cup: pin };
      for (const r of [6, 12, 20, 30])
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const from = { x: pin.x + Math.cos(a) * r, y: pin.y + Math.sin(a) * r };
          if (surfaceAt(h, from) !== 'green') continue;
          const angle = Math.atan2(pin.x - from.x, pin.y - from.y);
          for (const power of [0.12, 0.25, 0.4, 0.6, 0.85]) {
            const f = simulate(h, from, { angle, power, club: 'putter', error: 0, clock: 0 }).frames;
            putts++;
            for (let i = 2; i < f.length; i++) {
              const p = f[i - 1];
              const speed = (u: { x: number; y: number; t: number }, w: { x: number; y: number; t: number }) => Math.hypot(w.x - u.x, w.y - u.y) / (w.t - u.t || 1);
              const v1 = speed(f[i - 2], p);
              const v2 = speed(p, f[i]);
              // the cup, a wall, a tree or a post, a vent: things a ball is meant to meet
              const near =
                Math.hypot(p.x - pin.x, p.y - pin.y) < 2.5 ||
                walls.some((w) => segD(p, w.a, w.b) < 3) ||
                h.posts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r + 2) ||
                h.pushes.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r + 2) ||
                h.movers.some((m) => {
                  const at = m.at(p.t).pos;
                  return Math.hypot(p.x - at.x, p.y - at.y) < 6;
                });
              if (near) continue;
              if (putting(surfaceAt(h, p)) && putting(surfaceAt(h, f[i])) && v1 > 2 && v1 - v2 > Math.max(1.5, v1 * 0.35)) {
                bad.push(`hit something at ${p.x.toFixed(1)},${p.y.toFixed(1)} (${v1.toFixed(1)} to ${v2.toFixed(1)} ft/s)`);
                break;
              }
              if (heightAt(h, p.x, p.y) - p.z > 0.05) {
                bad.push(`sank below the ground at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                break;
              }
            }
          }
        }
    }
    ok(!bad.length, `${h0.name}: ${putts} putts roll true on the green${bad.length ? `: ${[...new Set(bad)].slice(0, 3).join('; ')}` : ''}`);
  }
}

// Scores for a steadier player: SKILL=0.5 SEEDS=12 COURSE=caldera npm run check-holes -- member [hole]
if (mode === 'member') {
  const seeds = Number(process.env.SEEDS ?? 12);
  for (const h of holes) {
    // At member skill the robot putts far worse than members do (they average 1.3 putts a hole: a putt has no meter
    // to miss), so its total overstates a hole. `to green` is the strokes before the putter comes out, penalties
    // included; add the members' real putts to that for what a hole will play like.
    const tally = { putts: 0 };
    const scores = Array.from({ length: seeds }, (_, i) => novice(h, `${h.id}:m${i}`, tally));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const putts = tally.putts / seeds;
    console.log(`MEMBER ${course.id} ${h.id} par ${h.par} skill ${SKILL_GET()} n ${seeds} avg ${avg.toFixed(2)} to-par ${(avg - h.par).toFixed(2)} to-green ${(avg - putts).toFixed(2)} putts ${putts.toFixed(2)} with-1.5-putts ${(avg - putts + 1.5 - h.par).toFixed(2)} scores ${scores.join(',')}`);
  }
}
// The CCC Rating and Slope (npm run check-holes -- rate, with QUICK=1 for speed): the robot plays every hole at member
// skill (SKILL 1.15, what members swing like) and as a strong player (0.6), counting 1.5 putts a hole (members average
// 1.3; the robot putts far worse). Prints one JSON line for src/golf3d/ratings.ts.
if (mode === 'rate') {
  const seeds = Number(process.env.SEEDS ?? 4);
  const play = (skill: number) =>
    holes.map((h) => {
      const tally = { putts: 0 };
      const was = SKILL_NOW.v;
      SKILL_NOW.v = skill;
      const scores = Array.from({ length: seeds }, (_, i) => novice(h, `${h.id}:r${skill}:${i}`, tally));
      SKILL_NOW.v = was;
      const avg = scores.reduce((a, b) => a + b, 0) / seeds;
      return avg - tally.putts / seeds + 1.5 - h.par; // to par, with members' putting
    });
  const member = play(1.15);
  const strong = play(0.6);
  const r = (x: number) => Math.round(x * 10) / 10;
  console.log(`RATE ${JSON.stringify({ course: course.id, at: new Date().toISOString().slice(0, 10), seeds, holes: holes.map((h, i) => ({ id: h.id, member: r(member[i]), strong: r(strong[i]) })) })}`);
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

// The Daily Shot: every day's three holes are fair (the Desk's own check: a dry tee and green, a green that holds a
// putt; and the greens sweep above), and how hard they play: a member's tee shot (SKILL 0.75, aiming as well as the
// wind allows, then the swing's own error) simulated many times on each, against the one-shot game it replaced.
// npm run check-holes -- daily (DAYS=30 SHOTS=200)
if (mode === 'daily' && !process.env.NO_SIM) {
  const SHOTS = Number(process.env.SHOTS ?? 200);
  // 0.75: the skill at which the bot's misses on the one-shot game match members' real ones (median 42 ft simulated,
  // 39 ft in the club's shots to Nov 20)
  SKILL_NOW.v = Number(process.env.SKILL ?? 0.75);
  // the member's aim: the shot that would finish nearest the pin in today's wind, with no mistake in it
  const aimAt = (h: Hole, from: V2, wind: V2) => {
    const toCup = Math.atan2(h.cup.x - from.x, h.cup.y - from.y);
    let best: { shot: Shot; d: number } | null = null;
    for (const club of bagFor(!!h.tour).filter((c) => c !== 'putter'))
      for (const power of POWERS[club])
        for (let a = -12; a <= 12; a += 1.5) {
          const shot: Shot = { angle: toCup + (a * Math.PI) / 180, power, club, error: 0, clock: 0, wind };
          const r = simulate(h, from, shot, false);
          const d = r.holed ? 0 : r.penalty ? Infinity : Math.hypot(r.end.x - h.cup.x, r.end.y - h.cup.y);
          if (!best || d < best.d) best = { shot, d };
        }
    return best!.shot;
  };
  const play = (h: Hole, from: V2, wind: { accel: V2; gust?: number }, seed: string) => {
    const aim = aimAt(h, from, wind.accel);
    const rng = makeRng(seed);
    const gauss = () => SKILL_NOW.v * Math.sqrt(-2 * Math.log(rng.next() || 1e-9)) * Math.cos(2 * Math.PI * rng.next());
    const out: { ft: number | null; holed: boolean }[] = [];
    for (let k = 0; k < SHOTS; k++) {
      const sw = swing(aim.club, aim.power, gauss, h.tour ? 'vertical' : 'classic', true, h.meterPace ?? 1);
      const shot = { ...aim, ...sw, angle: aim.angle + (gauss() * 3.5 * Math.PI) / 180, clock: rng.next() * 30, wind: wind.gust ? gusted(wind as Parameters<typeof gusted>[0], rng.next()).accel : wind.accel };
      const r = simulate(h, from, shot, false);
      out.push({ ft: r.holed ? 0 : r.penalty ? null : Math.hypot(r.end.x - h.cup.x, r.end.y - h.cup.y) * SCALE_FT, holed: r.holed });
    }
    return out;
  };
  const stats = (label: string, xs: { ft: number | null; holed: boolean }[]) => {
    const dry = xs.filter((x) => !x.holed && x.ft !== null).map((x) => x.ft!).sort((a, b) => a - b);
    const med = dry[Math.floor(dry.length / 2)] ?? 0;
    const mean = dry.reduce((a, b) => a + b, 0) / (dry.length || 1);
    const aces = xs.filter((x) => x.holed).length;
    const lost = xs.filter((x) => x.ft === null && !x.holed).length;
    console.log(`  ${label.padEnd(26)} shots ${String(xs.length).padStart(5)}  median ${med.toFixed(1).padStart(5)} ft  mean ${mean.toFixed(1).padStart(5)} ft  holed ${((aces / xs.length) * 100).toFixed(2)}% (1 in ${aces ? Math.round(xs.length / aces) : '∞'})  lost ${((lost / xs.length) * 100).toFixed(1)}%`);
    return { med, mean, aces: aces / xs.length, lost: lost / xs.length };
  };
  // fairness: the Desk's check on every hole
  let fair = 0;
  for (const d of dailyDays)
    for (const x of dailyHoles(d).holes) {
      const c = checkHole(x.hole, x.spec);
      if (!c.ok) console.log(`FAIL ${d} hole ${x.n} (${x.world.id}): ${c.problems.join(' ')}`);
      else fair++;
    }
  ok(fair === dailyDays.length * 3, `${fair} of ${dailyDays.length * 3} Daily Shot holes pass the Desk's check (dry tee and green, a green that holds a putt)`);
  // spin (Robbie, Nov 23: it didn't seem to work on the Daily Shot): from Nov 23, every hole is in reach of its club
  // (iron on 1 and 2, wood on 3), so a full-backspin shot can land on the green and bite there, finishing nearer the
  // pin than the same shot hit plain. On Nov 22 hole 2 was past a full iron, so a spun iron came down short.
  if (DAILY_FROM >= MID_FROM) {
    let bites = 0;
    for (const d of dailyDays)
      for (const x of dailyHoles(d).holes) {
        const h = x.hole;
        // hole 3 can be either: a wood, or a full iron with backspin
        const clubs: ClubId[] = x.n === 3 ? ['wood', 'iron'] : ['iron'];
        const toCup = Math.atan2(h.cup.x - x.from.x, h.cup.y - x.from.y);
        const ft = (r: ReturnType<typeof simulate>) => (r.penalty ? Infinity : Math.hypot(r.end.x - h.cup.x, r.end.y - h.cup.y));
        let ok2 = false;
        for (const club of clubs)
          for (let p = 0.3; p <= 1.0001 && !ok2; p += 0.02)
            for (const spin of [1, 0.5]) {
            const spun = simulate(h, x.from, { angle: toCup, power: p, club, error: 0, clock: 0, spin }, false);
            const plain = simulate(h, x.from, { angle: toCup, power: p, club, error: 0, clock: 0, spin: 0 }, false);
            if (!spun.penalty && surfaceAt(h, spun.end) === 'green' && ft(spun) < ft(plain)) ok2 = true;
            }
        if (ok2) bites++;
        else console.log(`  ${d} hole ${x.n}: no ${clubs.join(' or ')} with backspin holds the green`);
      }
    ok(bites === dailyDays.length * 3, `${bites} of ${dailyDays.length * 3} Daily Shot holes: a backspun iron (or wood on 3) lands on the green and bites`);
  }
  // before: the one-shot game, the last 14 days before the switch
  console.log('Before: the one-shot Closest to the Pin');
  const before: { ft: number | null; holed: boolean }[] = [];
  for (let i = 14; i >= 1; i--) {
    const d = addDays(SHOT_FROM, -i);
    const sh = dailyShot(d);
    before.push(...play(sh.hole, sh.from, sh.wind, `before:${d}`));
  }
  const b = stats('one shot, 14 days', before);
  console.log('After: the three-hole Daily Shot');
  const after: { ft: number | null; holed: boolean }[] = [];
  const byHole: { ft: number | null; holed: boolean }[][] = [[], [], []];
  for (const d of dailyDays)
    for (const x of dailyHoles(d).holes) {
      const r = play(x.hole, x.from, x.wind, `after:${d}:${x.n}`);
      byHole[x.n - 1].push(...r);
      after.push(...r);
    }
  const per = byHole.map((r, i) => stats(`hole ${i + 1}`, r));
  const a = stats(`all three, ${dailyDays.length} days`, after);
  console.log(`  median ${((a.med / b.med - 1) * 100).toFixed(0)}% against before`);
  if (DAILY_FROM < STEPS_FROM) ok(Math.abs(a.med / b.med - 1) <= 0.15, 'the Daily Shot plays about as hard as the one-shot game (median within 15%)');
  else {
    // the longer holes from Nov 22 (Robbie: a wood in play, still fun and doable to get it close)
    console.log(`  hole 2 ${(per[1].med / per[0].med).toFixed(2)}x hole 1, hole 3 ${(per[2].med / per[0].med).toFixed(2)}x`);
    ok(per[1].med <= per[0].med * 1.4, 'hole 2 plays within 1.4x hole 1 (median)');
    ok(per[2].med <= per[0].med * 1.8, 'hole 3 plays within 1.8x hole 1 (median)');
    ok(per.every((p) => p.lost <= 0.08), 'under 8% of shots wet on every hole');
    ok(per.every((p) => p.aces > 0), 'an ace is possible on every hole');
  }
  ok(a.aces > 0 || after.length < 1000, 'an ace is still possible');
}