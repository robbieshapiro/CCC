// One course per month. A month without its own course keeps the most recent one.
import { island } from './holes/island';
import { ridge } from './holes/ridge';
import { summit } from './holes/summit';
import type { Hole } from './types';

export type Course = { id: string; month: string; name: string; tagline: string; holes: Hole[]; par: number };

const COURSES: Course[] = [
  {
    id: 'highlands',
    month: '2026-10',
    name: 'The Highlands Course',
    tagline: 'Three holes in the mountains. A cliff-top par 5, an island par 3, and the ridge.',
    holes: [summit, island, ridge],
    par: summit.par + island.par + ridge.par,
  },
];

export const monthOf = (day: string) => day.slice(0, 7);

export function courseFor(month: string): Course {
  const sorted = [...COURSES].sort((a, b) => a.month.localeCompare(b.month));
  return [...sorted].reverse().find((c) => c.month <= month) ?? sorted[0];
}
