// The Nineteenth Hole's games, on the wall behind Mo's bar. Two weekly contests (Monday to Sunday, Eastern), best
// score of the week counts, play as often as you like:
//   Mini golf: the six holes of Hollow Hills, putter only. Fewest strokes wins.
//   Long drive: three swings off the range tee. Longest ball that stays in play.
import { SCALE } from './golf3d/clubs';
import { HOLLOW_HILLS_PAR } from './golf3d/minigolf';
import type { V2 } from './golf3d/types';

export type BarGame = 'minigolf' | 'drive';
export const DRIVES = 3;

// Monday of this week, Eastern, as YYYY-MM-DD
export function weekOf(today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// mini golf: fewest strokes, kept as minus the strokes so higher is better on every board on the wall
export const minigolfScore = (strokes: number) => -strokes;
const minigolfLabel = (score: number) => {
  const strokes = -score;
  const d = strokes - HOLLOW_HILLS_PAR;
  return `${strokes} strokes (${d === 0 ? 'E' : d > 0 ? `+${d}` : `−${-d}`})`;
};

export const driveYards = (from: V2, end: V2) => Math.round((Math.hypot(end.x - from.x, end.y - from.y) * SCALE) / 3);
export const scoreLabel = (game: BarGame, score: number) => (game === 'drive' ? `${Math.round(score)} yd` : minigolfLabel(score));
