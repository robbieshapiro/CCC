// One course per game period (see src/day.ts): a month to begin with, a week from November 9. Each course opens on
// a period key ('2026-11-16' for the week starting that Monday) and stays until the next one opens, so a week without
// its own course keeps the most recent one. A draft course isn't on the calendar yet: only the admin can play it,
// from the preview.
import { blowhole } from './holes/blowhole';
import { caldera } from './holes/caldera';
import { creekbend } from './holes/creekbend';
import { geyseralley } from './holes/geyseralley';
import { island } from './holes/island';
import { lavafield } from './holes/lavafield';
import { lavalift } from './holes/lavalift';
import { lavatube } from './holes/lavatube';
import { lighthouse } from './holes/lighthouse';
import { maplelake } from './holes/maplelake';
import { ridge } from './holes/ridge';
import { sealion } from './holes/sealion';
import { summit } from './holes/summit';
import { thegorge } from './holes/thegorge';
import { thecarry } from './holes/thecarry';
import type { Hole, V2 } from './types';

// previewHoles: before it opens, members can practise this many of its holes; the admin can play them all.
// playoff: the hole a tie for the week's title is played off on, and where the closest-to-the-pin decider is hit from
export type Course = {
  id: string;
  opens: string;
  name: string;
  tagline: string;
  holes: Hole[];
  par: number;
  draft?: boolean;
  previewHoles?: number;
  playoff?: { hole: Hole; from: V2; label: string };
};

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
    // the Caldera challenge: all six holes, from midnight Eastern as October closes early (Friday 30 October) to the
    // first Sunday week
    opens: '2026-10-30',
    name: 'The Caldera Course',
    tagline: 'Six holes on a volcanic island. Lava, geysers and quick greens.',
    holes: [blowhole, lavafield, caldera, lavalift, geyseralley, lavatube],
    par: par([blowhole, lavafield, caldera, lavalift, geyseralley, lavatube]),
    playoff: { hole: lavatube, from: { x: -8, y: 530 }, label: 'Down the hill' },
  },
  {
    id: 'pacificbluffs',
    // the first weekly course: the California coast at golden hour. A draft until Robbie has played it: then drop
    // `draft` and it opens on the Sunday below. (The Western Reserve, the autumn course it replaced, is still in
    // src/golf3d/holes for a later week.)
    opens: '2026-11-08',
    draft: true,
    name: 'The Pacific Bluffs',
    tagline: 'Three holes on the California cliffs. Cypress, surf and a lighthouse.',
    holes: [sealion, lighthouse, thecarry],
    par: par([sealion, lighthouse, thecarry]),
    playoff: { hole: thecarry, from: { x: -80, y: 120 }, label: 'Off the cliff top' },
  },
  {
    id: 'westernreserve',
    // northeast Ohio in the fall, the week of Nov 15. A draft until Robbie has played it: then drop `draft`.
    opens: '2026-11-15',
    draft: true,
    name: 'The Western Reserve',
    tagline: 'Three holes through the Ohio woods in October. Creeks, a lake, a river gorge and deep bunkers.',
    holes: [creekbend, maplelake, thegorge],
    par: par([creekbend, maplelake, thegorge]),
    playoff: { hole: thegorge, from: { x: -4, y: 690 }, label: 'Up from the river' },
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
