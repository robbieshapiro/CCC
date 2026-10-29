// A member's golf hole, as the architect (Claude, api/design.ts) describes it, and the builder that turns it into a
// playable Hole at the same scale as the club's courses: a tee, a fairway, a green with its slopes and tiers,
// bunkers, water, trees and mounds, and the ground rising and falling along the way.
//
// Everything is placed along the hole rather than in feet: `along` runs 0 at the tee to 1 at the middle of the green,
// down the centre line; `across` is measured in fairway half-widths from that line (0 the middle, ±1 the fairway's
// edges, ±2 deep in the rough, ±3.5 the edge of the property), left negative as you look from the tee. So nothing
// can land off the course, and the builder clamps whatever it's given.
import { band, blob, heightAt, inPoly, isWater } from '../golf3d/terrain';
import type { Decor, Hole, Piece, Post, Region, V2, Water } from '../golf3d/types';
import { makeRng } from '../seed';

export type Look = 'highlands' | 'caldera' | 'links' | 'desert';
export type Shape = 'straight' | 'dogleg-left' | 'dogleg-right' | 'double-dogleg';
export type Size = 'small' | 'medium' | 'large';

export type HoleSpec = {
  kind: 'hole';
  name: string;
  look: Look;
  par: number;
  yards: number; // along the centre line, tee to the middle of the green
  shape: Shape;
  bend_at: number; // along, where the (first) bend is
  bend: number; // degrees
  elevation: 'flat' | 'downhill' | 'uphill' | 'tee-high' | 'valley' | 'climb';
  fairway: { width: 'narrow' | 'medium' | 'wide'; from: number; to: number };
  green: { size: Size; slope: 'flat' | 'back-to-front' | 'front-to-back' | 'left-to-right' | 'right-to-left'; tiered: boolean; raised: boolean; across: number };
  bunkers: { along: number; across: number; size: Size; kind: 'fairway' | 'greenside' | 'pot' | 'waste' }[];
  water: { kind: 'pond' | 'creek' | 'sea'; along: number; across: number; size: Size; side: 'left' | 'right' }[];
  trees: { along: number; across: number; count: number; spread: 'tight' | 'loose' }[];
  mounds: { along: number; across: number; size: Size }[];
  review: string;
  hint: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const FT_PER_YD = 3 / 2.2; // the courses are scale models: 1 ft of course plays like 2.2 ft
export const parFor = (yards: number) => (yards <= 250 ? 3 : yards <= 490 ? 4 : 5);

// Whatever came back, made safe: in range, the right kinds, not too many of anything
export function tidy(s: HoleSpec): HoleSpec {
  const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
  const along = (v: number) => clamp(v, 0, 1);
  const across = (v: number) => clamp(v, -3.5, 3.5);
  const size = (v: unknown) => pick(v, ['small', 'medium', 'large'] as const, 'medium');
  const yards = Math.round(clamp(s.yards, 110, 600));
  return {
    kind: 'hole',
    name: String(s.name ?? 'Untitled').replace(/[^\p{L}\p{N} '’.,&!?-]/gu, '').slice(0, 30).trim() || 'Untitled',
    look: pick(s.look, ['highlands', 'caldera', 'links', 'desert'] as const, 'highlands'),
    par: parFor(yards),
    yards,
    shape: pick(s.shape, ['straight', 'dogleg-left', 'dogleg-right', 'double-dogleg'] as const, 'straight'),
    bend_at: clamp(s.bend_at, 0.3, 0.7),
    bend: clamp(s.bend, 10, 75),
    elevation: pick(s.elevation, ['flat', 'downhill', 'uphill', 'tee-high', 'valley', 'climb'] as const, 'flat'),
    fairway: { width: pick(s.fairway?.width, ['narrow', 'medium', 'wide'] as const, 'medium'), from: clamp(s.fairway?.from, 0.05, 0.6), to: clamp(s.fairway?.to, 0.5, 0.97) },
    green: {
      size: size(s.green?.size),
      slope: pick(s.green?.slope, ['flat', 'back-to-front', 'front-to-back', 'left-to-right', 'right-to-left'] as const, 'back-to-front'),
      tiered: !!s.green?.tiered,
      raised: !!s.green?.raised,
      across: clamp(s.green?.across, -1, 1),
    },
    bunkers: (s.bunkers ?? []).slice(0, 12).map((b) => ({ along: along(b.along), across: across(b.across), size: size(b.size), kind: pick(b.kind, ['fairway', 'greenside', 'pot', 'waste'] as const, 'fairway') })),
    water: (s.water ?? []).slice(0, 3).map((w) => ({ kind: pick(w.kind, ['pond', 'creek', 'sea'] as const, 'pond'), along: clamp(w.along, 0.1, 0.95), across: across(w.across), size: size(w.size), side: pick(w.side, ['left', 'right'] as const, 'right') })),
    trees: (s.trees ?? []).slice(0, 10).map((t) => ({ along: along(t.along), across: across(t.across), count: Math.round(clamp(t.count, 1, 12)), spread: pick(t.spread, ['tight', 'loose'] as const, 'loose') })),
    mounds: (s.mounds ?? []).slice(0, 6).map((m) => ({ along: along(m.along), across: across(m.across), size: size(m.size) })),
    review: String(s.review ?? '').slice(0, 220),
    hint: String(s.hint ?? '').slice(0, 180),
  };
}

// the centre line: legs from the tee, turning at the bends
function centreLine(s: HoleSpec, L: number): V2[] {
  const turn = (s.bend * Math.PI) / 180;
  const pts: V2[] = [{ x: 0, y: 0 }];
  let heading = 0; // radians from +y; positive turns right
  const legs: [number, number][] =
    s.shape === 'straight'
      ? [[1, 0]]
      : s.shape === 'double-dogleg'
        ? [[s.bend_at, turn], [(1 - s.bend_at) / 2, -turn], [(1 - s.bend_at) / 2, 0]]
        : [[s.bend_at, s.shape === 'dogleg-right' ? turn : -turn], [1 - s.bend_at, 0]];
  for (const [frac, then] of legs) {
    const last = pts[pts.length - 1];
    pts.push({ x: last.x + Math.sin(heading) * frac * L, y: last.y + Math.cos(heading) * frac * L });
    heading += then;
  }
  return pts;
}

function walker(line: V2[]) {
  const lens = line.slice(1).map((q, i) => Math.hypot(q.x - line[i].x, q.y - line[i].y));
  const total = lens.reduce((a, b) => a + b, 0);
  const at = (f: number) => {
    let s = clamp(f, 0, 1.2) * total;
    for (let i = 0; i < lens.length; i++) {
      if (s <= lens[i] || i === lens.length - 1) {
        const a = line[i];
        const b = line[i + 1];
        const dir = { x: (b.x - a.x) / (lens[i] || 1), y: (b.y - a.y) / (lens[i] || 1) };
        return { p: { x: a.x + dir.x * s, y: a.y + dir.y * s }, dir };
      }
      s -= lens[i];
    }
    return { p: line[0], dir: { x: 0, y: 1 } };
  };
  return { at, total };
}

export type Built = { hole: Hole; warnings: string[] };

export function buildHole(raw: HoleSpec, id: string, flag?: string): Built {
  const s = tidy(raw);
  const warnings: string[] = [];
  const rng = makeRng(`hole:${id}:${s.name}`);
  const L = s.yards * FT_PER_YD;
  const line = centreLine(s, L);
  const { at } = walker(line);
  const wf = { narrow: 22, medium: 30, wide: 40 }[s.fairway.width];
  // the property: wide enough for the rough and the trees, never so wide a bend folds over itself
  const legMin = Math.min(...line.slice(1).map((q, i) => Math.hypot(q.x - line[i].x, q.y - line[i].y)));
  const corridor = Math.max(70, Math.min(wf * 3.6, legMin * 0.55 + 40));
  const place = (along: number, across: number): V2 => {
    const { p, dir } = at(along);
    return { x: p.x + dir.y * across * wf, y: p.y - dir.x * across * wf };
  };

  // the ground: a profile along the centre line (an embankment follows it), the green on top
  const profile = (f: number) => {
    const e = s.elevation;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
    if (e === 'downhill') return lerp(16, 0, f / 0.7);
    if (e === 'uphill') return lerp(0, 12, (f - 0.25) / 0.75);
    if (e === 'tee-high') return f < 0.08 ? 26 : lerp(26, 0, (f - 0.08) / 0.35) + lerp(0, 2, (f - 0.6) / 0.4);
    if (e === 'valley') return f < 0.5 ? lerp(10, -4, f / 0.5) : lerp(-4, 8, (f - 0.5) / 0.5);
    if (e === 'climb') return lerp(0, 16, (f - 0.15) / 0.85);
    return 0;
  };
  const end = at(1.12).p; // a little past the green
  const spine: V2[] = [];
  const heights: number[] = [];
  for (let f = -0.04; f <= 1.12 + 1e-6; f += 0.02) {
    spine.push(f < 0 ? { x: 0, y: f * L } : at(f).p);
    heights.push(profile(Math.max(0, Math.min(1, f))));
  }
  const terrain: Piece[] = [{ kind: 'embankment', pts: spine, h: heights, width: corridor, edge: 120 }];
  const regions: Region[] = [];
  const water: Water[] = [];
  const posts: Post[] = [];

  // the property line, a little behind the tee and past the green
  const ext = [{ x: 0, y: -40 }, ...line.slice(1, -1), end];
  const border = band(ext, corridor);

  // the green
  const fin = at(1);
  const R = { small: 20, medium: 26, large: 33 }[s.green.size];
  const gc = { x: fin.p.x + fin.dir.y * s.green.across * wf * 0.8, y: fin.p.y - fin.dir.x * s.green.across * wf * 0.8 };
  const gh = profile(1) + (s.green.raised ? 3.5 : 0);
  terrain.push({ kind: 'disc', x: gc.x, y: gc.y, r: R + 10, h: gh, edge: s.green.raised ? 7 : 22, op: 'set' });
  const fwd = fin.dir;
  const right = { x: fwd.y, y: -fwd.x };
  const tilt = s.green.slope === 'back-to-front' ? fwd : s.green.slope === 'front-to-back' ? { x: -fwd.x, y: -fwd.y } : s.green.slope === 'left-to-right' ? { x: -right.x, y: -right.y } : s.green.slope === 'right-to-left' ? right : null;
  if (tilt) terrain.push({ kind: 'hill', x: gc.x + tilt.x * R * 1.05, y: gc.y + tilt.y * R * 1.05, r: R * 1.7, h: 1.1 });
  if (s.green.tiered) terrain.push({ kind: 'disc', x: gc.x + fwd.x * R * 0.5, y: gc.y + fwd.y * R * 0.5, r: R * 0.62, h: 1.3, edge: 2.5, op: 'add' });

  // the tee box, the fairway, the green and its collar
  regions.push({ poly: band([{ x: 0, y: -10 }, { x: 0, y: 12 }], 12), surface: 'fairway' });
  const legPts = (from: number, to: number) => {
    const pts: V2[] = [];
    for (let f = from; f <= to + 1e-6; f += 0.02) pts.push(at(f).p);
    return pts;
  };
  const par3 = s.par === 3;
  // a par 3 has an apron in front of the green; the others a fairway from where the drive lands
  const fFrom = par3 ? Math.max(0.72, s.fairway.from) : Math.min(s.fairway.from, 0.45);
  const fTo = Math.max(fFrom + 0.1, Math.min(s.fairway.to, 1 - (R / L) * 0.6));
  regions.push({ poly: band(legPts(fFrom, fTo), wf + 5), surface: 'fringe' });
  regions.push({ poly: band(legPts(fFrom, fTo), wf), surface: 'fairway' });
  const gseed = Math.round(gc.x + gc.y);
  regions.push({ poly: blob(gc.x, gc.y, R + 5, R + 5, gseed, 0.08), surface: 'fringe' });
  const greenPoly = blob(gc.x, gc.y, R, R * 0.92, gseed, 0.08);
  regions.push({ poly: greenPoly, surface: 'green' });

  const tee = { x: 0, y: 0 };
  const near = (p: V2, q: V2, d: number) => Math.hypot(p.x - q.x, p.y - q.y) < d;

  for (const m of s.mounds) {
    const p = place(m.along, m.across);
    if (near(p, gc, R + 12) || near(p, tee, 30)) continue;
    const big = { small: [12, 2.5], medium: [18, 4], large: [26, 6] }[m.size];
    terrain.push({ kind: 'hill', x: p.x, y: p.y, r: big[0], h: big[1] });
  }

  const sea = s.look === 'links' || s.look === 'caldera';
  for (const w of s.water) {
    if (w.kind === 'sea' && !sea) {
      warnings.push('The sea only comes with links or the Caldera: it became a pond.');
      w.kind = 'pond';
    }
    const lava = s.look === 'caldera' && w.kind !== 'sea';
    if (w.kind === 'pond') {
      const p = place(w.along, w.across);
      const r = { small: 18, medium: 28, large: 40 }[w.size];
      if (near(p, tee, r + 20) || near(p, gc, r + R - 4)) {
        warnings.push('A pond on the tee or the green was moved off it.');
        continue;
      }
      terrain.push({ kind: 'disc', x: p.x, y: p.y, r: r + 6, h: -3.2, edge: 10, op: 'add' });
      water.push({ poly: blob(p.x, p.y, r, r * 0.8, Math.round(p.x), 0.15), level: profile(w.along) - 1.2, look: lava ? 'lava' : 'lake' });
    } else if (w.kind === 'creek') {
      const a = place(w.along, -4);
      const b = place(w.along, 4);
      if (near(at(w.along).p, tee, 50) || near(at(w.along).p, gc, R + 14)) {
        warnings.push('A creek across the tee or the green was left out.');
        continue;
      }
      terrain.push({ kind: 'channel', pts: [a, b], width: 9, depth: 3.4 });
      water.push({ poly: band([a, b], 5.5), level: profile(w.along) - 2, look: lava ? 'lava' : 'lake' });
    } else {
      // the sea down one side: the ground falls away to a shore beyond the rough
      const sgn = w.side === 'left' ? -1 : 1;
      const shore: V2[] = [];
      const deep: V2[] = [];
      for (let f = -0.1; f <= 1.15; f += 0.05) {
        const { p, dir } = at(Math.max(0, f));
        const off = (k: number) => ({ x: p.x + dir.y * sgn * k, y: p.y - dir.x * sgn * k });
        shore.push(off(wf * 2.3));
        deep.push(off(corridor + 400));
      }
      // a broad groove whose near edge is the shore: shallow there, deep out to sea
      const half = (corridor + 400 - wf * 2.3) / 2;
      terrain.push({ kind: 'channel', pts: shore.map((q, i) => ({ x: (q.x + deep[i].x) / 2, y: (q.y + deep[i].y) / 2 })), width: half + 10, depth: 12 });
      const low = Math.min(...heights) - 4;
      water.push({ poly: [...shore, ...deep.reverse()], level: low, look: 'sea' });
    }
  }
  const wet = (p: V2) => water.some((w) => inPoly(p, w.poly));

  for (const b of s.bunkers) {
    const p = place(b.along, b.across);
    if (near(p, tee, 25) || inPoly(p, greenPoly) || wet(p)) continue;
    const [r, depth, edge] = { pot: [5, -1.9, 1.5], waste: [26, -0.5, 6], fairway: [0, -1.1, 3], greenside: [0, -1.2, 3] }[b.kind];
    const rad = r || { small: 7, medium: 10, large: 14 }[b.size];
    regions.push({ poly: b.kind === 'waste' ? blob(p.x, p.y, rad * 1.4, rad * 0.8, Math.round(p.y), 0.25) : blob(p.x, p.y, rad, rad * 0.8, Math.round(p.x + p.y), 0.18), surface: 'sand' });
    terrain.push({ kind: 'disc', x: p.x, y: p.y, r: rad, h: depth, edge, op: 'add' });
  }

  // trees (or palms, gorse and cacti), in groups and down the edges of the property
  const kinds: Record<Look, Post['look'][]> = { highlands: ['pine', 'pine', 'oak'], caldera: ['palm', 'palm', 'rock'], links: ['gorse', 'gorse', 'rock'], desert: ['cactus', 'cactus', 'rock'] };
  const sized = (look: Post['look'], p: V2): Post =>
    look === 'oak' ? { ...p, r: 2, h: 34, look } : look === 'pine' ? { ...p, r: 1.2, h: 22, look } : look === 'palm' ? { ...p, r: 1.2, h: 22, look } : look === 'gorse' ? { ...p, r: 2.2, h: 3, e: 0.3, look } : look === 'cactus' ? { ...p, r: 0.8, h: 9, look } : { ...p, r: 3, h: 3, e: 0.5, look: 'rock' };
  const plant = (p: V2, look: Post['look']) => {
    if (!inPoly(p, border) || near(p, tee, 24) || near(p, gc, R + 10) || wet(p)) return;
    posts.push(sized(look, p));
  };
  for (const t of s.trees) {
    const c = place(t.along, t.across);
    const spread = t.spread === 'tight' ? 14 : 30;
    for (let i = 0; i < t.count; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = i === 0 ? 0 : Math.sqrt(rng.next()) * spread;
      plant({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d }, kinds[s.look][Math.floor(rng.next() * 3)]);
    }
  }
  const edgeEvery = s.look === 'desert' ? 70 : s.look === 'links' ? 90 : 45;
  for (let f = 0.04; f <= 1.08; f += edgeEvery / L)
    for (const side of [-1, 1]) {
      if (rng.next() < 0.3) continue;
      const k = (corridor - 10 - rng.next() * 18) / wf;
      plant(place(f, side * k), kinds[s.look][Math.floor(rng.next() * 3)]);
    }

  // where the drive should finish, for the aim and the flyover
  const landing = at(par3 ? 1 : Math.min(0.62, (260 * FT_PER_YD) / L));
  const pins = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    const d = i === 0 ? 0 : R * 0.45;
    return { x: gc.x + Math.cos(a) * d, y: gc.y + Math.sin(a) * d };
  });
  const decor: Decor[] = [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'bench', x: 24, y: -14, rot: 0 },
  ];
  const xs = border.map((p) => p.x);
  const ys = border.map((p) => p.y);
  const hole: Hole = {
    id,
    name: s.name,
    par: s.par,
    theme: s.look === 'caldera' ? 'volcanic' : s.look === 'highlands' ? 'highland' : s.look,
    noCart: true,
    flag,
    tee,
    cup: pins[0],
    pins,
    aim: Math.atan2(landing.p.x, landing.p.y),
    bounds: { x0: Math.min(...xs) - 60, y0: Math.min(...ys) - 60, x1: Math.max(...xs) + 60, y1: Math.max(...ys) + 60 },
    border,
    base: 'rough',
    regions,
    water,
    terrain,
    walls: [],
    posts,
    movers: [],
    pushes: [],
    zones: [],
    secret: { name: '', zone: '', hint: '' },
    flyover: [tee, landing.p, gc],
    decor,
  };
  return { hole, warnings };
}

// The quick check before a hole is played: the par fits the length, the tee and the green are dry and on the
// property, and a par 4 or 5 has somewhere for the drive to land. (The real test is playing it.)
export type Check = { ok: boolean; par: number; problems: string[] };

export function checkHole(hole: Hole, spec: HoleSpec): Check {
  const s = tidy(spec);
  const problems: string[] = [];
  const dry = (p: V2) => inPoly(p, hole.border) && !isWater(hole, p);
  if (!dry(hole.tee)) problems.push('The tee is under water or off the property.');
  if (!(hole.pins ?? [hole.cup]).every(dry)) problems.push('The green is under water.');
  if (s.par > 3) {
    // a drive of 210 to 290 yd down the middle, or a little either side, has to find dry ground
    const { at } = walker(centreLine(s, s.yards * FT_PER_YD));
    let found = false;
    for (let yd = 210; yd <= 290 && !found; yd += 10)
      for (const off of [0, -12, 12, -24, 24]) {
        const { p, dir } = at((yd * FT_PER_YD) / (s.yards * FT_PER_YD));
        const q = { x: p.x + dir.y * off, y: p.y - dir.x * off };
        if (dry(q) && heightAt(hole, q.x, q.y) > -50) found = true;
      }
    if (!found) problems.push('There’s nowhere dry for a drive to land.');
  }
  // a par 3 can't ask for a carry longer than a good iron over water
  if (s.par === 3 && s.water.some((w) => w.kind !== 'sea') && s.yards > 230) problems.push('That carry over water is too long for a par 3.');
  return { ok: !problems.length, par: s.par, problems };
}

