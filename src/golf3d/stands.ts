// The stadium on the Ascent: banks of seating on the volcano's flank, and who sits in them. A hole's decor places a
// bank ({ kind: 'stands', x, y, rot }); rot 0 faces down the hole, toward the tee. The scene draws the tiers, the engine
// seats members (with their score on a card) and fills the rest with patrons.
import type { GolferSpec } from './golfer';
import { CLOTH, DEFAULT_SPEC, HAIR_COLOURS, SKIN_TONES } from './golfer';
import { makeRng } from '../seed';
import type { Decor } from './types';

export const ROWS = 4;
export const COLS = 7;
export const ROW_DEPTH = 3.4;
export const ROW_RISE = 1.9;
export const SEAT_GAP = 3.6;

// the direction a bank faces, in course coordinates
export const facing = (d: Decor) => ({ x: -Math.sin(d.rot ?? 0), y: -Math.cos(d.rot ?? 0) });

// Every seat in a bank, front row first, middle seats first: where it is, and how far above its row's ground it sits.
export function seats(d: Decor) {
  const f = facing(d);
  const side = { x: -f.y, y: f.x };
  const out: { x: number; y: number; lift: number }[] = [];
  const order = [...Array(COLS).keys()].sort((a, b) => Math.abs(a - (COLS - 1) / 2) - Math.abs(b - (COLS - 1) / 2));
  for (let r = 0; r < ROWS; r++)
    for (const c of order) {
      const across = (c - (COLS - 1) / 2) * SEAT_GAP;
      const back = (r + 0.5) * ROW_DEPTH;
      out.push({ x: d.x + side.x * across - f.x * back, y: d.y + side.y * across - f.y * back, lift: ROW_RISE });
    }
  return out;
}

// A patron: someone in the crowd, dressed for a day at the golf.
export function patron(seed: string): GolferSpec {
  const rng = makeRng(`patron:${seed}`);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng.next() * xs.length)];
  return {
    ...DEFAULT_SPEC,
    skin: pick(SKIN_TONES),
    build: pick(['slim', 'regular', 'broad'] as const),
    height: 0.92 + rng.next() * 0.16,
    hair: pick(['short', 'side', 'curly', 'long', 'bun', 'bald'] as const),
    hairColor: pick(HAIR_COLOURS),
    face: pick(['none', 'none', 'stubble', 'moustache', 'beard'] as const),
    topColor: pick(CLOTH),
    bottomsColor: pick(CLOTH),
    hat: pick(['none', 'cap', 'visor', 'bucket', 'flatcap'] as const),
    hatColor: pick(CLOTH),
  };
}
