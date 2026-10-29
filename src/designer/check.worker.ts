// The test golfer, in a worker so the page stays smooth: builds a member's hole, checks the cup can be reached,
// and plays it with the putting bot. A hole it can't hole in five is sent back to the architect.
import { navField, play } from '../golf3d/putbot';
import { bake } from '../golf3d/terrain';
import { buildHole, type HoleSpec } from './spec';

export type TryResult = { ok: boolean; strokes: number; par: number; reason: string; warnings: string[] };

const SWEEP = { angleStep: 6, powerStep: 0.1, clocks: [0, 1, 2, 3, 4] };

self.onmessage = (e: MessageEvent<HoleSpec>) => {
  const { hole, warnings } = buildHole(e.data, 'draft');
  bake(hole, 0.25);
  const nav = navField(hole);
  const out = (r: Omit<TryResult, 'warnings'>) => (self as unknown as Worker).postMessage({ ...r, warnings });
  if (nav(hole.tee) >= 999) return out({ ok: false, strokes: 0, par: 0, reason: 'Nothing can get from the tee to the cup: something blocks the whole lane.' });
  // the bot plays to par + 3 on a par 3: six is a pick-up
  const strokes = play(hole, nav, false, 'draft', SWEEP);
  if (strokes >= 6) return out({ ok: false, strokes, par: 0, reason: "Our test golfer couldn't hole it in five: the way to the cup is too narrow, blocked or too long." });
  out({ ok: true, strokes, par: Math.max(2, Math.min(4, strokes + 1)), reason: '' });
};
