// The Ace Pot (Nov 17): one par 3 a day, the same for every club, picked by the date from the week's course (any course's
// par 3s if the week has none). Three swings a day, and the club puts up the money: the pot starts at $1,000 and the
// club adds $50 for every miss. A hole-in-one takes the lot (a club bonus) and the pot starts again. One pot across
// every club. ace_swing and ace_state in supabase/schema.sql.
// Aces come about once in 60 swings (Closest to the Pin and par 3s in rounds, Nov 2026), so the pot is worth about
// $4,000 when it goes.
import { conditionsFor, type Conditions } from './golf3d/conditions';
import { SCALE } from './golf3d/clubs';
import { courseFor, tourCourses } from './golf3d/courses';
import { periodOf } from './day';
import type { Hole, V2 } from './golf3d/types';
import { makeRng } from './seed';

export const ACE_ADD = 50; // what the club adds to the pot for every miss
export const ACE_SWINGS = 3;
export const ACE_SEED = 1000;

export type AceShot = { day: string; hole: Hole; from: V2; wind: Conditions; yards: number; label: string };
export type AceState = {
  pot: number;
  swingsToday: number;
  bank: number;
  // the last hole-in-one, across every club
  lastAce: { name: string; pot: number; at: string; avatar?: import('./api/types').Avatar } | null;
  // today's closest swings, across every club
  today: { playerId: string; avatar?: import('./api/types').Avatar; name: string; ft: number | null; holed: boolean; mine: boolean }[];
};
export type AceSwing = { holed: boolean; payout: number; pot: number; swingsToday: number; bank: number };

export function aceShot(day: string): AceShot {
  const rng = makeRng(`ace:${day}`);
  let threes = courseFor(periodOf(day)).holes.filter((h) => h.par === 3);
  if (!threes.length) threes = tourCourses().flatMap((c) => c.holes.filter((h) => h.par === 3));
  const base = threes[Math.floor(rng.next() * threes.length)];
  const pins = base.pins?.length ? base.pins : [base.cup];
  const pin = pins[Math.floor(rng.next() * pins.length)];
  const hole: Hole = { ...base, cup: pin };
  const wind = { ...conditionsFor(base, day), pin };
  const yards = Math.round((Math.hypot(hole.tee.x - pin.x, hole.tee.y - pin.y) * SCALE) / 3);
  return { day, hole, from: hole.tee, wind, yards, label: `${hole.name} · ${yards} yd` };
}
