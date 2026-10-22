// One course per month. A month without its own course keeps the most recent one.
import { azalea } from './holes/azalea';
import { clubhouse } from './holes/clubhouse';
import { island } from './holes/island';
import type { Hole } from './types';

export type Course = { id: string; month: string; name: string; tagline: string; holes: Hole[]; par: number };

const COURSES: Course[] = [
  {
    id: 'founders',
    month: '2026-10',
    name: "The Founders' Course",
    tagline: 'Three holes. Pines, a lake, and the clubhouse lawn.',
    holes: [azalea, island, clubhouse],
    par: azalea.par + island.par + clubhouse.par,
  },
];

export const monthOf = (day: string) => day.slice(0, 7);

export function courseFor(month: string): Course {
  const sorted = [...COURSES].sort((a, b) => a.month.localeCompare(b.month));
  return [...sorted].reverse().find((c) => c.month <= month) ?? sorted[0];
}
