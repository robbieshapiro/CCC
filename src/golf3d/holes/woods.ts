// The Western Reserve's woods and turf.
// Woods along a line: maples (and the odd pine) every `every` ft, staggered a few feet either side so it reads as a
// wood rather than a row, from young 16 ft trees to old 46 ft giants, their crowns as wide as they are tall makes
// them. `rows` adds more rows behind the first, each `depth` ft further out on the `out` side (+1 is to the left of the
// line's direction of travel, -1 to the right). They're soft (Post.soft): a ball usually flies on through the leaves,
// slowed and knocked off line, sometimes gets caught and drops, and only the trunk is solid.
import { makeRng } from '../../seed';
import type { Hole, Piece, Post, V2 } from '../types';

// autumn rough that grabs a landing ball and costs about a sixth of the next swing's distance (eased Nov 6: you can
// still reach a green from it), firm fairways that run, and heavy
// wet bunker sand that a wedge only gets 70% out of (an iron about half) and that can send it anywhere
// (greens run about 10% quicker than the other tour courses, fairways about a quarter quicker: they were nearly
// twice as quick, faster than the greens, until Nov 6)
export const RESERVE_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.24, roughDrag: 1.6, roughLie: 0.84, roughScatter: 0.2, fairwayRoll: 0.75, greenRoll: 0.9, sandLie: 0.7, sandScatter: 0.35 };

// A green complex in the parkland style: a broad plateau `lift` ft above `base`, its sides running down over `edge` ft
// (wide for a green that sits into the ground, tight for a cupcake), tilted `tilt` ft across its width ([x, y]: the
// rise from left to right and from front to back), and optionally a tier: a step of `rise` ft across the line
// `axis` = `at`, so the far side is a level up.
export type GreenSpec = { x: number; y: number; rx: number; ry: number };
// rolls: humps (h > 0) and hollows (h < 0) on the putting surface, at offsets from the green's centre, for the kind of
// movement tour greens have. back: a bank behind the green, this high, that holds a long approach and feeds it back.
export function greenComplex(
  g: GreenSpec,
  base: number,
  o: { lift: number; edge: number; tilt: [number, number]; tier?: { axis: 'x' | 'y'; at: number; rise: number }; rolls?: [number, number, number, number][]; back?: number },
): Piece[] {
  const r = Math.max(g.rx, g.ry) + 6;
  const box = { x0: g.x - r - o.edge, y0: g.y - r - o.edge, x1: g.x + r + o.edge, y1: g.y + r + o.edge };
  const out: Piece[] = [
    { kind: 'disc', x: g.x, y: g.y, r, h: base + o.lift, edge: o.edge, op: 'set' },
    { kind: 'ramp', ...box, axis: 'x', h0: -o.tilt[0] / 2, h1: o.tilt[0] / 2, op: 'add' },
    { kind: 'ramp', ...box, axis: 'y', h0: -o.tilt[1] / 2, h1: o.tilt[1] / 2, op: 'add' },
  ];
  for (const [dx, dy, rr, hh] of o.rolls ?? []) out.push({ kind: 'hill', x: g.x + dx, y: g.y + dy, r: rr, h: hh });
  if (o.back) out.push({ kind: 'hill', x: g.x, y: g.y + g.ry + 16, r: g.rx + 6, h: o.back });
  const t = o.tier;
  if (t) {
    if (t.axis === 'y') {
      out.push({ kind: 'ramp', x0: box.x0, x1: box.x1, y0: t.at - 3, y1: t.at + 3, axis: 'y', h0: 0, h1: t.rise, op: 'add' });
      out.push({ kind: 'ramp', x0: box.x0, x1: box.x1, y0: t.at + 3, y1: box.y1, axis: 'y', h0: t.rise, h1: t.rise, op: 'add' });
    } else {
      out.push({ kind: 'ramp', x0: t.at - 3, x1: t.at + 3, y0: box.y0, y1: box.y1, axis: 'x', h0: 0, h1: t.rise, op: 'add' });
      out.push({ kind: 'ramp', x0: t.at + 3, x1: box.x1, y0: box.y0, y1: box.y1, axis: 'x', h0: t.rise, h1: t.rise, op: 'add' });
    }
  }
  return out;
}

// A bunker: the sand and its hollow. Big, deep and steep-faced; a long one (rx well over ry) is dug as a row of bowls
// along its length, so the whole of it is a hole in the ground. `turn` swings it round (radians), for a bunker that
// runs across or along a fairway at an angle.
export function bunker(x: number, y: number, rx: number, ry: number, seed: number, depth = 4, turn = 0): { region: { poly: V2[]; surface: 'sand' }; pieces: Piece[] } {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const at = (u: number, v: number) => ({ x: x + u * c - v * s, y: y + u * s + v * c });
  const poly: V2[] = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    const k = 1 + 0.12 * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 2.3) * 0.4);
    return at(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
  });
  const long = rx >= ry;
  const r = Math.min(rx, ry);
  const n = Math.max(1, Math.ceil(Math.max(rx, ry) / r));
  const pieces: Piece[] = Array.from({ length: n }, (_, i) => {
    const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * (Math.max(rx, ry) - r);
    const p = long ? at(off, 0) : at(0, off);
    return { kind: 'disc' as const, x: p.x, y: p.y, r: r + 1, h: -depth, edge: 2.5, op: 'add' as const };
  });
  return { region: { poly, surface: 'sand' }, pieces };
}
// A greenside bunker hugging the green: placed in the direction of (x, y) from the green's middle, its near edge `gap`
// ft past the fringe (the fringe runs 4 ft round the green). Shallower than a deep fairway trap's old 4 ft, deeper than
// a fairway bunker's.
export function greenside(g: GreenSpec, x: number, y: number, rx: number, ry: number, seed: number, depth = 3.4, turn = 0, gap = 3) {
  const dx = x - g.x;
  const dy = y - g.y;
  const a = Math.atan2(dy, dx);
  // the green's radius that way, then the bunker's own half-width along the same line (in its turned frame)
  const edge = 1 / Math.sqrt((Math.cos(a) / g.rx) ** 2 + (Math.sin(a) / g.ry) ** 2);
  const la = a - turn;
  const half = 1 / Math.sqrt((Math.cos(la) / rx) ** 2 + (Math.sin(la) / ry) ** 2);
  const d = edge + 4 + gap + half;
  return bunker(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d, rx, ry, seed, depth, turn);
}

// a fairway bunker: shallow enough to see out of and play a long club from
export const FAIRWAY_DEPTH = 2.2;

// Move a hole's tee up the line of its tee shot (the old tee stays as a back tee): a level tee box at the new spot,
// the tee markers with it, and the length on the card to match.
export function teeUp(h: Hole, at: V2, ground: number, yards: number): Hole {
  return {
    ...h,
    tee: at,
    yards,
    regions: [...h.regions, { poly: [{ x: at.x - 12, y: at.y - 12 }, { x: at.x + 12, y: at.y - 12 }, { x: at.x + 12, y: at.y + 12 }, { x: at.x - 12, y: at.y + 12 }], surface: 'fairway' }],
    terrain: [...h.terrain, { kind: 'disc', x: at.x, y: at.y, r: 14, h: ground, edge: 8, op: 'set' }],
    decor: h.decor.map((d) => (d.kind === 'teebox' ? { ...d, x: at.x, y: at.y } : d)),
  };
}

// a maple's crown is about this wide (radius) for its height: what the ball has to get through
const crown = (h: number) => Math.max(4, Math.round(h * 0.26 * 10) / 10);

// a single tree standing in play
export const tree = (x: number, y: number, r = 5, h = 30): Post => ({ x, y, r, h, soft: true, look: 'maple' });

export function treeLine(pts: V2[], every: number, seed: string, stagger = 6, rows = 1, out: 1 | -1 = 1, depth = 14): Post[] {
  const rng = makeRng(`woods:${seed}`);
  const res: Post[] = [];
  for (let row = 0; row < rows; row++)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      // rows behind the first sit half a gap along, so the wood has no lanes through it
      for (let d = (i ? every / 2 : 0) + (row % 2 ? every / 2 : 0); d < len; d += every) {
        const t = d / len;
        const off = (res.length % 2 ? 1 : -1) * stagger * (0.5 + rng.next() * 0.5) + out * row * depth;
        const h = Math.round(16 + rng.next() ** 0.8 * 30);
        res.push({
          x: Math.round(a.x + (b.x - a.x) * t + nx * off),
          y: Math.round(a.y + (b.y - a.y) * t + ny * off),
          r: crown(h),
          h,
          soft: true,
          look: rng.next() < 0.1 ? 'pine' : 'maple',
        });
      }
    }
  return res;
}
