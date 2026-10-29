// The Nineteenth Hole's games, on the wall behind Mo's bar. Two weekly contests (Monday to Sunday, Eastern), best
// score of the week counts, play as often as you like:
//   Putting: five putts on the practice green from spots that change each week. Most holed wins; level, fewest feet
//   left over all the misses.
//   Long drive: three swings off the range tee. Longest ball that stays in play.
import { SCALE } from './golf3d/clubs';
import { isWater, surfaceAt } from './golf3d/terrain';
import { shortgame } from './golf3d/practice/shortgame';
import type { V2 } from './golf3d/types';
import { makeRng } from './seed';

export type BarGame = 'putting' | 'drive';
export const PUTTS = 5;
export const DRIVES = 3;

// Monday of this week, Eastern, as YYYY-MM-DD
export function weekOf(today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// five spots on the practice green, 8 to 34 ft from the hole, from short to long
export function puttingSpots(week: string): { name: string; at: V2 }[] {
  const rng = makeRng(`putting:${week}`);
  const cup = shortgame.cup;
  const out: { at: V2; ft: number }[] = [];
  for (let tries = 0; out.length < PUTTS && tries < 500; tries++) {
    const ft = 8 + (out.length / (PUTTS - 1)) * 26 + rng.next() * 3;
    const a = rng.next() * Math.PI * 2;
    const at = { x: cup.x + Math.sin(a) * (ft / SCALE), y: cup.y + Math.cos(a) * (ft / SCALE) };
    if (surfaceAt(shortgame, at) !== 'green' || isWater(shortgame, at)) continue;
    out.push({ at, ft });
  }
  return out.map((p, i) => ({ name: `Putt ${i + 1} of ${PUTTS} · ${Math.round(p.ft)} ft`, at: p.at }));
}

// putting: holed counts most, then fewest feet left over the misses, as one number (higher is better)
export const puttingScore = (made: number, left: number) => made * 1000 - Math.min(999, Math.round(left));
export const puttingLabel = (score: number) => {
  const made = Math.floor((score + 999) / 1000);
  const left = made * 1000 - score;
  return `${made} of ${PUTTS}${made < PUTTS ? ` · ${left} ft left` : ''}`;
};

export const driveYards = (from: V2, end: V2) => Math.round((Math.hypot(end.x - from.x, end.y - from.y) * SCALE) / 3);
export const scoreLabel = (game: BarGame, score: number) => (game === 'drive' ? `${Math.round(score)} yd` : puttingLabel(score));
