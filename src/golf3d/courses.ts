// One course per game period (see src/day.ts): a month to begin with, a week from November 9. Each course opens on
// a period key ('2026-11-16' for the week starting that Monday) and stays until the next one opens, so a week without
// its own course keeps the most recent one. A draft course isn't on the calendar yet: only the admin can play it,
// from the preview.
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

// previewHoles: before it opens, members can practise this many of its holes; the admin can play them all.
export type Course = { id: string; opens: string; name: string; tagline: string; holes: Hole[]; par: number; draft?: boolean; previewHoles?: number };

const par = (holes: Hole[]) => holes.reduce((a, h) => a + h.par, 0);

const COURSES: Course[] = [
  {
    id: 'highlands',
    opens: '2026-10',
    name: 'The Highlands Course',
    tagline: 'Three holes in the mountains.',
    holes: [summit, island, ridge],
    par: par([summit, island, ridge]),
  },
  {
    id: 'caldera',
    // it takes over from the Highlands at midnight Eastern as October closes, for November 1 to 8
    opens: '2026-11',
    previewHoles: 3,
    name: 'The Caldera Course',
    tagline: 'Six holes on a volcanic island. Lava, geysers and quick greens.',
    holes: [blowhole, lavafield, caldera, lavalift, geyseralley, lavatube],
    par: par([blowhole, lavafield, caldera, lavalift, geyseralley, lavatube]),
  },
];

export function courseFor(period: string): Course {
  const sorted = COURSES.filter((c) => !c.draft).sort((a, b) => a.opens.localeCompare(b.opens));
  return [...sorted].reverse().find((c) => c.opens <= period) ?? sorted[0];
}

export const courseById = (id: string) => COURSES.find((c) => c.id === id);
// The next course on the calendar after this period's, if there is one: members can practise its first holes.
export function nextCourse(period: string): Course | undefined {
  return COURSES.filter((c) => !c.draft && c.opens > period).sort((a, b) => a.opens.localeCompare(b.opens))[0];
}

// Courses not yet being played: anything still a draft, or on the calendar for a later period. The admin can play them.
export const upcoming = (period: string) => COURSES.filter((c) => c.draft || c.opens > period);
