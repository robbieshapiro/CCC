// The Windy City's shared settings: late-fall turf as thick as the Western Reserve's, and kinder greens.
import type { Decor, Hole, Piece, V2 } from '../../types';
import { greenComplex, type GreenSpec } from '../woods';

// city stone, glass and steel: a ball that hits a tower, the Bean or a parked car comes back off it lively
export const CHI_WALLS = 0.86;
// Late-fall turf, as thick as the Western Reserve's: the rough checks a landing ball (it still hops and runs a little),
// a full club gets about 84% out of it and can come off the face anywhere; the fairways run firm, the greens a touch
// slower than tour pace
export const CHI_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.36, roughDrag: 1.3, roughLie: 0.84, roughScatter: 0.2, fairwayRoll: 0.9, greenRoll: 1.06, sandLie: 0.75, sandScatter: 0.3 };

// How the cup and the chipper play here (Nov 13, after the first practice rounds: too many lip-outs, chips running on).
// chipDrop: with the pin in, a shot from off the green that comes at the hole straight on drops at well over a putt's
// pace. cupEase: a putt can be a touch firmer and still fall. chipRoll: a chip keeps a tenth less of its pace landing.
export const CHI_CUP: Pick<Hole, 'chipDrop' | 'cupEase' | 'chipRoll'> = { chipDrop: 1.7, cupEase: 1.2, chipRoll: 0.9 };

// A Windy City green: mostly flat, a tilt and one or two soft rolls so there's some break to read (a third more of
// both since Nov 13)
const BREAK = 1.35;
export const chiGreen = (g: GreenSpec, base: number, tilt: [number, number], rolls: [number, number, number, number][] = []): Piece[] =>
  greenComplex(g, base, { lift: 1, edge: 9, tilt: [tilt[0] * BREAK, tilt[1] * BREAK], rolls: rolls.map(([x, y, r, h]) => [x, y, r, h * BREAK]) });

// Its outline: not an oval. Two slow waves round the edge give each green its own lobes and waists (a kidney, a
// peanut, a tongue), up to a sixth in or out; the fringe follows it 4 ft out. seed: the hole's own shape.
const outline = (g: GreenSpec, grow: number, seed: number, n = 48): V2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.1 * Math.sin(a * 2 + seed * 1.9) + 0.07 * Math.sin(a * 3 + seed * 0.8);
    return { x: g.x + Math.cos(a) * (g.rx * k + grow), y: g.y + Math.sin(a) * (g.ry * k + grow) };
  });
export const chiGreenRegions = (g: GreenSpec, seed: number): Hole['regions'] => [
  { poly: outline(g, 4, seed), surface: 'fringe' },
  { poly: outline(g, 0, seed), surface: 'green' },
];

// Patrons (Nov 13: a lot more of them, on every hole). All looks, nothing a ball can hit.
// rot: the way a gallery faces. 0 is back down the hole (south), the rest follow.
export const FACE = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };
// a line of them: n along len ft centred on (x, y), in rows, lift ft up; kind 'deck' is a balcony, 'stand' bleachers
export const gallery = (x: number, y: number, rot: number, len: number, n: number, rows = 2, lift = 0, kind?: 'deck' | 'stand'): Decor =>
  ({ kind: 'gallery', x, y, rot, scale: len, size: [n, rows, lift], ...(kind ? { label: kind } : {}) });
// a horseshoe of them round a green, clear of its bunkers, between two bearings (degrees: 0 is the green's right, 90
// its back, 180 its left), facing the pin
export function greenGallery(g: GreenSpec, from: number, to: number, deep = 3): Decor[] {
  const out: Decor[] = [];
  const step = 24;
  for (let a = from + step / 2; a < to; a += step) {
    const t = (a * Math.PI) / 180;
    const x = g.x + Math.cos(t) * (g.rx + 26);
    const y = g.y + Math.sin(t) * (g.ry + 26);
    const len = ((Math.hypot(g.rx, g.ry) + 26) * step * Math.PI) / 180 * 0.8;
    out.push(gallery(x, y, Math.atan2(-Math.cos(t), Math.sin(t)), len, Math.round(len / 2.4) * deep, deep));
  }
  return out;
}
// a knot of them behind a tee, watching the drive go
export const teeGallery = (tee: V2): Decor => gallery(tee.x, tee.y - 15, FACE.north, 26, 16, 2);
