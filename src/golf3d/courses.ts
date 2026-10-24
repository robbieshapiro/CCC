// One course per month. A month without its own course keeps the most recent one.
// A draft course isn't on the calendar yet: only the admin can play it, from the preview.
import { blowhole } from './holes/blowhole';
import { caldera } from './holes/caldera';
import { geyseralley } from './holes/geyseralley';
import { island } from './holes/island';
import { lavafield } from './holes/lavafield';
import { lavalift } from './holes/lavalift';
import { lavatube } from './holes/lavatube';
import { ridge } from './holes/ridge';
import { summit } from './holes/summit';
import type { Hole } from './types';

export type Course = { id: string; month: string; name: string; tagline: string; holes: Hole[]; par: number; draft?: boolean };

const par = (holes: Hole[]) => holes.reduce((a, h) => a + h.par, 0);

const COURSES: Course[] = [
  {
    id: 'highlands',
    month: '2026-10',
    name: 'The Highlands Course',
    tagline: 'Three holes in the mountains. A cliff-top par 5, an island par 3, and the ridge.',
    holes: [summit, island, ridge],
    par: par([summit, island, ridge]),
  },
  {
    id: 'caldera',
    month: '',
    draft: true,
    name: 'The Caldera Course',
    tagline: 'A volcanic island. Sea cliffs, lava fields, a gorge, an alley of steam and a tee inside a lava tube. Tour greens: they are quick.',
    holes: [blowhole, lavafield, caldera, lavalift, geyseralley, lavatube],
    par: par([blowhole, lavafield, caldera, lavalift, geyseralley, lavatube]),
  },
];

export const monthOf = (day: string) => day.slice(0, 7);

export function courseFor(month: string): Course {
  const sorted = COURSES.filter((c) => !c.draft).sort((a, b) => a.month.localeCompare(b.month));
  return [...sorted].reverse().find((c) => c.month <= month) ?? sorted[0];
}

export const courseById = (id: string) => COURSES.find((c) => c.id === id);
export const drafts = () => COURSES.filter((c) => c.draft);
