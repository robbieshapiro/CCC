// A member's mini golf hole, as the designer (Claude, api/design.ts) describes it, and the builder that turns it
// into a playable Hole from the club's tested parts: the same felt, walls, stones, slime, scythe, ghosts,
// cauldron, coffin and pumpkin as Hollow Hills.
//
// Everything is placed along the hole rather than in feet: `along` runs 0 at the tee to 1 at the far end of the
// centre line, `across` runs -1 at the left edge to 1 at the right. So a description can't put anything outside the
// lane, and the builder clamps whatever it's given.
import { laneAndRound } from '../golf3d/minigolf';
import { band } from '../golf3d/terrain';
import type { Decor, Hole, Mover, Piece, Post, Push, Region, V2, Wall, Water } from '../golf3d/types';

export type Look = 'night' | 'day' | 'volcano';
export type Shape = 'straight' | 'dogleg-left' | 'dogleg-right' | 'zigzag' | 'round';
export type Spot = { along: number; across: number };
export type Speed = 'slow' | 'medium' | 'fast';

export type HoleSpec = {
  name: string;
  look: Look;
  shape: Shape;
  length: number; // ft along the centre line, 45..110
  width: number; // ft, 12..26
  cup: Spot;
  slopes: { kind: 'mound' | 'dip' | 'tilt-left' | 'tilt-right'; along: number; across: number; size: 'small' | 'big' }[];
  obstacles: { kind: 'stone' | 'post' | 'tree'; along: number; across: number }[];
  fences: { along: number; from: number; to: number }[]; // a railing across the lane from `from` to `to` (across)
  hazards: { from: number; to: number; left: number; right: number; bridge: boolean }[]; // slime, water or lava
  gimmicks: { kind: 'pendulum' | 'ghost' | 'cauldron' | 'tunnel' | 'pumpkin'; along: number; across: number; speed: Speed; to_along: number; to_across: number }[];
  review: string; // Reginald's line about it
  hint: string; // how to play it, in a sentence
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const SPEED: Record<Speed, number> = { slow: 0.75, medium: 1, fast: 1.3 };

// Whatever came back, made safe: in range, the right kinds, not too many of anything
export function tidy(s: HoleSpec): HoleSpec {
  const along = (v: number) => clamp(v, 0, 1);
  const across = (v: number) => clamp(v, -1, 1);
  const pick = <T extends string>(v: string, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
  return {
    name: String(s.name ?? 'Untitled').replace(/[^\p{L}\p{N} '’.,&!?-]/gu, '').slice(0, 30).trim() || 'Untitled',
    look: pick(s.look, ['night', 'day', 'volcano'] as const, 'day'),
    shape: pick(s.shape, ['straight', 'dogleg-left', 'dogleg-right', 'zigzag', 'round'] as const, 'straight'),
    length: Math.round(clamp(s.length, 45, 110)),
    width: Math.round(clamp(s.width, 12, 26)),
    cup: { along: clamp(s.cup?.along, 0.55, 1), across: clamp(s.cup?.across, -0.7, 0.7) },
    slopes: (s.slopes ?? []).slice(0, 6).map((x) => ({ kind: pick(x.kind, ['mound', 'dip', 'tilt-left', 'tilt-right'] as const, 'mound'), along: along(x.along), across: across(x.across), size: pick(x.size, ['small', 'big'] as const, 'small') })),
    obstacles: (s.obstacles ?? []).slice(0, 14).map((x) => ({ kind: pick(x.kind, ['stone', 'post', 'tree'] as const, 'stone'), along: along(x.along), across: across(x.across) })),
    fences: (s.fences ?? []).slice(0, 4).map((x) => ({ along: clamp(x.along, 0.1, 0.95), from: across(x.from), to: across(x.to) })),
    hazards: (s.hazards ?? []).slice(0, 3).map((x) => ({ from: clamp(x.from, 0.08, 0.95), to: clamp(x.to, 0.1, 0.97), left: across(x.left), right: across(x.right), bridge: !!x.bridge })),
    gimmicks: (s.gimmicks ?? []).slice(0, 3).map((x) => ({
      kind: pick(x.kind, ['pendulum', 'ghost', 'cauldron', 'tunnel', 'pumpkin'] as const, 'ghost'),
      along: clamp(x.along, 0.1, 1),
      across: across(x.across),
      speed: pick(x.speed, ['slow', 'medium', 'fast'] as const, 'medium'),
      to_along: clamp(x.to_along, 0.1, 1),
      to_across: across(x.to_across),
    })),
    review: String(s.review ?? '').slice(0, 220),
    hint: String(s.hint ?? '').slice(0, 160),
  };
}

// The centre line for each shape: axis-aligned legs, total length L, starting at the tee (0, 0) going up the hole
function centreLine(shape: Shape, L: number): V2[] {
  if (shape === 'dogleg-left' || shape === 'dogleg-right') {
    const s = shape === 'dogleg-left' ? -1 : 1;
    return [{ x: 0, y: 0 }, { x: 0, y: L * 0.6 }, { x: s * L * 0.4, y: L * 0.6 }];
  }
  if (shape === 'zigzag') return [{ x: 0, y: 0 }, { x: 0, y: L * 0.36 }, { x: L * 0.28, y: L * 0.36 }, { x: L * 0.28, y: L * 0.72 }];
  return [{ x: 0, y: 0 }, { x: 0, y: L }];
}

// The point at a fraction of the way along a polyline, and the direction there
function at(line: V2[], f: number): { p: V2; dir: V2; seg: number } {
  const lens = line.slice(1).map((q, i) => Math.hypot(q.x - line[i].x, q.y - line[i].y));
  let s = clamp(f, 0, 1) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (s <= lens[i] || i === lens.length - 1) {
      const a = line[i];
      const b = line[i + 1];
      const k = lens[i] ? Math.min(1, s / lens[i]) : 0;
      return { p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, dir: { x: (b.x - a.x) / (lens[i] || 1), y: (b.y - a.y) / (lens[i] || 1) }, seg: i };
    }
    s -= lens[i];
  }
  return { p: line[0], dir: { x: 0, y: 1 }, seg: 0 };
}

export type Built = { hole: Hole; warnings: string[] };

export function buildHole(raw: HoleSpec, id: string): Built {
  const s = tidy(raw);
  const warnings: string[] = [];
  const half = s.width / 2;
  // the round shape: a lane two thirds of the way, opening into a round green at the end
  const round = s.shape === 'round';
  const R = round ? clamp(s.length * 0.28, 12, 22) : 0;
  const line = round ? [{ x: 0, y: 0 }, { x: 0, y: s.length * 0.62 + R }] : centreLine(s.shape, s.length);
  const total = line.slice(1).reduce((a, q, i) => a + Math.hypot(q.x - line[i].x, q.y - line[i].y), 0);
  // a point in the lane: along the centre line, then across it (right of the direction of play is +)
  const place = (along: number, across: number, margin = 1.4): V2 => {
    const { p, dir } = at(line, along);
    const w = round && along * total > s.length * 0.62 ? R - margin : half - margin;
    return { x: p.x + dir.y * across * w, y: p.y - dir.x * across * w };
  };
  // the outline: the lane, a few feet behind the tee and past the far end
  const ext = [{ x: 0, y: -6 }, ...line.slice(1, -1), (() => {
    const { p, dir } = at(line, 1);
    return { x: p.x + dir.x * (round ? 0 : 6), y: p.y + dir.y * (round ? 0 : 6) };
  })()];
  const border = round ? laneAndRound(half, -6, { x: 0, y: s.length * 0.62 + R }, R) : band(ext, half);
  const inside = (p: V2, m: number) => {
    // far enough from the outline
    for (let i = 0; i < border.length; i++) {
      const a = border[i];
      const b = border[(i + 1) % border.length];
      const t = clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1), 0, 1);
      if (Math.hypot(p.x - a.x - (b.x - a.x) * t, p.y - a.y - (b.y - a.y) * t) < m) return false;
    }
    return true;
  };
  const tee = { x: 0, y: 0 };
  const cup = place(s.cup.along, s.cup.across, 2.5);
  const clear = (p: V2, r: number) => Math.hypot(p.x - tee.x, p.y - tee.y) > r + 3 && Math.hypot(p.x - cup.x, p.y - cup.y) > r + 2.2;

  const night = s.look === 'night';
  const volcano = s.look === 'volcano';
  const terrain: Piece[] = [];
  const posts: Post[] = [];
  const walls: Wall[] = [];
  const water: Water[] = [];
  const regions: Region[] = [];
  const movers: Mover[] = [];
  const pushes: Push[] = [];
  const portals: NonNullable<Hole['portals']> = [];
  const decor: Decor[] = [{ kind: 'sign', x: -half - 10, y: 2, rot: 0 }];

  for (const sl of s.slopes) {
    const p = place(sl.along, sl.across);
    const big = sl.size === 'big';
    if (sl.kind === 'mound') terrain.push({ kind: 'hill', x: p.x, y: p.y, r: big ? 7 : 4.5, h: big ? 0.9 : 0.55 });
    else if (sl.kind === 'dip') terrain.push({ kind: 'disc', x: p.x, y: p.y, r: big ? 7 : 4.5, h: big ? -0.6 : -0.4, edge: big ? 6 : 4, op: 'add' });
    else {
      // the ground falls away to one side: a long low rise along the other edge
      const q = place(sl.along, sl.kind === 'tilt-left' ? 1.25 : -1.25, 0);
      terrain.push({ kind: 'hill', x: q.x, y: q.y, r: big ? 14 : 9, h: big ? 1.1 : 0.7 });
    }
  }

  // slime, water or lava, with an optional plank across on the centre line
  // where each leg of the centre line ends, as a fraction of the way along
  const legEnds: number[] = [];
  line.slice(1).reduce((acc, q, i) => {
    const d = acc + Math.hypot(q.x - line[i].x, q.y - line[i].y);
    legEnds.push(d / total);
    return d;
  }, 0);
  for (const hz of s.hazards) {
    const lo = Math.min(hz.from, hz.to);
    let hi = Math.max(hz.from, hz.to, lo + 0.08);
    const a = at(line, lo);
    // a hazard stays on one leg; over a corner it's trimmed to the leg it starts on
    if (hi > legEnds[a.seg]) {
      hi = legEnds[a.seg] - 0.01;
      warnings.push('A hazard over a corner was trimmed to one leg.');
    }
    if (hi - lo < 0.04) continue;
    const corners = [place(lo, Math.min(hz.left, hz.right), 0), place(lo, Math.max(hz.left, hz.right), 0), place(hi, Math.max(hz.left, hz.right), 0), place(hi, Math.min(hz.left, hz.right), 0)];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    if (box.x1 - box.x0 < 2 || box.y1 - box.y0 < 2) continue;
    // keep the tee and the cup dry
    if ([tee, cup].some((p) => p.x > box.x0 - 3 && p.x < box.x1 + 3 && p.y > box.y0 - 3 && p.y < box.y1 + 3)) {
      warnings.push('A hazard over the tee or the cup was left out.');
      continue;
    }
    const poly = [{ x: box.x0, y: box.y0 }, { x: box.x1, y: box.y0 }, { x: box.x1, y: box.y1 }, { x: box.x0, y: box.y1 }];
    water.push({ poly, level: -0.5, look: night ? 'slime' : volcano ? 'lava' : 'lake' });
    terrain.push({ kind: 'box', ...box, h: -1.3, edge: 0.5, op: 'add' });
    if (hz.bridge) {
      const vertical = Math.abs(a.dir.y) > 0.5;
      const c = a.p;
      const plank = vertical ? { x0: c.x - 2.6, x1: c.x + 2.6, y0: box.y0 - 0.5, y1: box.y1 + 0.5 } : { x0: box.x0 - 0.5, x1: box.x1 + 0.5, y0: c.y - 2.6, y1: c.y + 2.6 };
      terrain.push({ kind: 'box', ...plank, h: 0, edge: 0.2, op: 'set' });
      regions.push({ poly: [{ x: plank.x0, y: plank.y0 }, { x: plank.x1, y: plank.y0 }, { x: plank.x1, y: plank.y1 }, { x: plank.x0, y: plank.y1 }], surface: 'wood' });
    }
  }
  const wet = (p: V2) => water.some((w) => p.x > w.poly[0].x - 1 && p.x < w.poly[2].x + 1 && p.y > w.poly[0].y - 1 && p.y < w.poly[2].y + 1);

  for (const o of s.obstacles) {
    const p = place(o.along, o.across, 1.6);
    if (!clear(p, 1.2) || wet(p)) continue;
    if (o.kind === 'stone') posts.push({ ...p, r: 1, h: 2.4, e: 0.5, look: night ? 'tomb' : 'rock' });
    else if (o.kind === 'post') posts.push({ ...p, r: 0.6, h: 2.2, e: 0.6, look: 'post' });
    else posts.push({ ...p, r: 0.8, h: 14, e: 0.4, look: night ? 'deadtree' : volcano ? 'palm' : 'cypress' });
  }

  for (const f of s.fences) {
    const a = place(f.along, Math.min(f.from, f.to), 0);
    const b = place(f.along, Math.max(f.from, f.to), 0);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1.5) continue;
    walls.push({ a, b, h: 1.2, look: night ? 'iron' : volcano ? 'stone' : 'wood' });
  }

  s.gimmicks.forEach((g, n) => {
    const sp = SPEED[g.speed];
    if (g.kind === 'pendulum') {
      // it swings across a leg that runs up the hole (the scythe's gallows stands square to the play)
      let al = g.along;
      if (Math.abs(at(line, al).dir.y) < 0.5) al = Math.min(al, (Math.hypot(line[1].x - line[0].x, line[1].y - line[0].y) / total) * 0.85);
      const pivot = place(al, 0, 0);
      if (!clear(pivot, 2)) return void warnings.push('The pendulum was too close to the tee or the cup.');
      const L = 13;
      const amp = 0.55;
      movers.push({
        id: `scythe${n}`,
        look: 'scythe',
        at: (t) => {
          const a = amp * Math.sin(t * 1.45 * sp + n);
          const bx = pivot.x + L * Math.sin(a);
          const lift = L * (1 - Math.cos(a));
          return { walls: lift < 1.2 ? [{ a: { x: bx - 1.5, y: pivot.y }, b: { x: bx + 1.5, y: pivot.y }, h: 1.4, look: 'blade' }] : [], posts: [], pos: pivot, heading: a };
        },
      });
    } else if (g.kind === 'ghost') {
      const al = g.along;
      movers.push({
        id: `ghost${n}`,
        look: 'ghost',
        at: (t) => {
          const k = Math.sin(t * 0.9 * sp + n * 1.7);
          const pos = place(al, k * 0.85, 1.6);
          return { walls: [], posts: [{ ...pos, r: 1.5, h: 4, e: 0.7, look: 'ghost' }], pos, heading: Math.cos(t * 0.9 * sp + n * 1.7) > 0 ? 0 : Math.PI };
        },
      });
    } else if (g.kind === 'cauldron') {
      const p = place(g.along, g.across, 3);
      if (!clear(p, 3) || wet(p)) return void warnings.push('The cauldron was too close to the tee or the cup.');
      const { dir } = at(line, g.along);
      const side = { x: dir.y, y: -dir.x };
      posts.push({ ...p, r: 2.2, h: 3.5, e: 0.4, look: 'cauldron' });
      const period = 5 / sp;
      for (const [k, sgn] of [[0, -1], [1, 1]] as const)
        pushes.push({
          id: `brew${n}${k}`,
          look: 'brew',
          x: p.x + side.x * sgn * 5.4,
          y: p.y + side.y * sgn * 5.4,
          r: 3.4,
          at: (t) => {
            const q = (((t - k * period * 0.5) % period) + period) % period;
            return q < period * 0.4 ? { x: side.x * sgn * 30, y: side.y * sgn * 30 } : { x: 0, y: 0 };
          },
        });
    } else if (g.kind === 'tunnel') {
      const a = place(g.along, g.across, 2);
      const b = place(g.to_along, g.to_across, 2);
      if (!clear(a, 1.5) || wet(a) || wet(b) || Math.hypot(b.x - a.x, b.y - a.y) < 8) return void warnings.push('The tunnel was left out: its ends were too close, wet, or on the tee or cup.');
      portals.push({ id: `tunnel${n}`, x: a.x, y: a.y, r: 1.3, to: b, delay: 1.6 });
    } else if (g.kind === 'pumpkin') {
      // round the cup, its mouth toward the way the ball comes in; it needs room all round
      if (!inside(cup, 10.5)) return void warnings.push('The pumpkin needs open ground round the cup (a round green or a wide lane): left out.');
      const r = 8;
      const back = at(line, Math.max(0, s.cup.along - 0.15)).p;
      const m = Math.atan2(back.y - cup.y, back.x - cup.x); // the mouth faces back down the hole
      const MOUTH = 0.59;
      const BACK = 0.2;
      const n32 = 32;
      const centre = { x: cup.x, y: cup.y - 0 };
      for (let i = 0; i < n32; i++) {
        const a0 = (i / n32) * Math.PI * 2;
        const a1 = ((i + 1) / n32) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        const off = (q: number) => Math.abs(Math.atan2(Math.sin(mid - q), Math.cos(mid - q)));
        if (off(m) < MOUTH || off(m + Math.PI) < BACK) continue;
        walls.push({ a: { x: centre.x + Math.cos(a0) * r, y: centre.y + Math.sin(a0) * r }, b: { x: centre.x + Math.cos(a1) * r, y: centre.y + Math.sin(a1) * r }, h: 2.6, look: 'teeth' });
      }
      const ma = { x: centre.x + Math.cos(m - MOUTH) * r, y: centre.y + Math.sin(m - MOUTH) * r };
      const mb = { x: centre.x + Math.cos(m + MOUTH) * r, y: centre.y + Math.sin(m + MOUTH) * r };
      const mouth = { x: (ma.x + mb.x) / 2, y: (ma.y + mb.y) / 2 };
      const period = 4.2 / sp;
      const open = (t: number) => {
        const k = ((t % period) + period) % period;
        const f = k / period;
        if (f < 0.57) return 1;
        if (f < 0.64) return 1 - (f - 0.57) / 0.07;
        if (f < 0.93) return 0;
        return (f - 0.93) / 0.07;
      };
      const heading = m + Math.PI / 2;
      movers.push({ id: `jaw${n}`, look: 'jaw', at: (t) => ({ walls: open(t) < 0.5 ? [{ a: ma, b: mb, h: 2, look: 'teeth' }] : [], posts: [], pos: mouth, heading, open: open(t) }) });
      decor.push({ kind: 'bigpumpkin', x: centre.x, y: centre.y, scale: r, rot: heading });
    }
  });

  // lamps at the tee and by the cup, and something growing outside
  const lit = (p: V2, on: boolean): Decor => (night ? { kind: 'lantern', ...p, label: on ? undefined : 'dim' } : { kind: volcano ? 'steamvent' : 'azalea', ...p, color: '#e86a92' });
  decor.push(lit({ x: -half + 1, y: -4 }, true), lit({ x: half - 1, y: -4 }, false));
  const near = place(Math.min(1, s.cup.along + 0.05), -1.1, 0);
  decor.push(lit(near, true));
  for (let i = 0; i < 4; i++) {
    const p = place((i + 0.5) / 4, i % 2 ? 1.6 : -1.6, -10);
    decor.push(night ? { kind: 'deadtree', ...p, scale: 1.2 } : volcano ? { kind: 'rock', ...p, scale: 2.4 } : { kind: 'azalea', ...p, color: i % 2 ? '#e86a92' : '#f2c14e' });
  }

  const xs = border.map((p) => p.x);
  const ys = border.map((p) => p.y);
  const pad = 36;
  const hole: Hole = {
    id,
    name: s.name,
    par: 3,
    theme: night ? 'haunted' : volcano ? 'volcanic' : 'highland',
    putterOnly: true,
    noCart: true,
    flag: 'CCC',
    base: 'green',
    tee,
    cup,
    aim: Math.atan2(at(line, Math.min(1, 6 / total)).p.x - tee.x, at(line, Math.min(1, 6 / total)).p.y - tee.y),
    bounds: { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad },
    border,
    regions,
    water,
    terrain,
    walls,
    posts,
    movers,
    pushes,
    portals,
    zones: [],
    secret: { name: '', zone: '', hint: '' },
    flyover: [tee, at(line, 0.5).p, cup],
    decor,
    maxTime: 30,
  };
  return { hole, warnings };
}
