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
export const moguls = (x0: number, x1: number, y0: number, y1: number, h = 1.3) => {
  const out: { kind: 'hill'; x: number; y: number; r: number; h: number }[] = [];
  let row = 0;
  for (let y = y0; y <= y1; y += 16, row++) for (let x = x0 + (row % 2 ? 8 : 0); x <= x1; x += 16) out.push({ kind: 'hill', x, y, r: 7, h });
  return out;
};
