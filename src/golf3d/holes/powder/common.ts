// The Powder Bowl: what its holes share. A Colorado ski resort in December: the fairways and greens are cut out of
// the snow and kept green, and everything else is deep powder. A ball that lands in it stops nearly dead, and a full
// club only gets about 70% out of it. Firs, heavy with snow, line every run.
import type { Hole, Post, V2 } from '../../types';
import { treeLine } from '../woods';

// deep powder: a landing ball keeps a sixth of its pace and a full club gets about 70% out; firm, quick
// cut fairways; the bunkers are wet sand under a dusting of snow
export const POWDER_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.17, roughDrag: 2.1, roughLie: 0.7, roughScatter: 0.24, fairwayRoll: 0.9, sandLie: 0.72, sandScatter: 0.3 };

// a line of snow-loaded firs (see treeLine in ../woods)
export const firs = (pts: V2[], every: number, seed: string, out: 1 | -1, rows = 2): Post[] =>
  treeLine(pts, every, `powder:${seed}`, 5, rows, out, 13).map((p) => ({ ...p, look: 'snowpine' as const }));

// moguls: rows of small bumps down a steep run, staggered
export const moguls = (x0: number, x1: number, y0: number, y1: number, h = 1.3, step = 16) => {
  const out: { kind: 'hill'; x: number; y: number; r: number; h: number }[] = [];
  let row = 0;
  for (let y = y0; y <= y1; y += step, row++) for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1; x += step) out.push({ kind: 'hill', x, y, r: step * 0.44, h });
  return out;
};

// The ground down the line of play, as heights at points along y (Nov 22, round two): stacked ramps across the whole
// hole, so a hole reads as a profile: a tee high up, a drop, an upslope to a crest, a fall away beyond it.
export const profile = (x0: number, x1: number, pts: [number, number][]) =>
  pts.slice(1).map(([y, h], i) => ({ kind: 'ramp' as const, x0, y0: pts[i][0], x1, y1: y, axis: 'y' as const, h0: pts[i][1], h1: h, op: 'set' as const }));

// A cliff: the mountain falls away beyond a line, `drop` feet down within `edge` feet. Put the hole's border along the
// lip, so a ball that rolls over it is gone (out of bounds, played again).
export const cliff = (pts: V2[], drop = -60, edge = 8) => ({ kind: 'embankment' as const, pts, h: pts.map(() => drop), width: 26, edge });
