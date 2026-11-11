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
import { theledges } from './holes/theledges';
import { thequarry } from './holes/thequarry';
import { thecarry } from './holes/thecarry';
import { lakefront } from './holes/chicago/lakefront';
import { millennium } from './holes/chicago/millennium';
import { navypier } from './holes/chicago/navypier';
import { river } from './holes/chicago/river';
import { wrigleyville } from './holes/chicago/wrigleyville';
import { herons } from './holes/lab/herons';
import { hoodoogap } from './holes/lab/hoodoogap';
import { oldkeep } from './holes/lab/oldkeep';
import { summitrun } from './holes/lab/summitrun';
import { theloop } from './holes/lab/theloop';
import type { Hole, V2 } from './types';
import { isWeek, nextStart } from '../day';

// previewHoles: before it opens, members can practise this many of its holes (all of them if unset); the admin can
// play them all. whatsNew: a few short lines shown before that practice starts.
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
  whatsNew?: string[];
  playoff?: { hole: Hole; from: V2; label: string };
  // the Hole Lab: a test hole in a new look, never on the calendar; only the admin plays it, from the Committee Room
  lab?: boolean;
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
    // the California coast at golden hour, now the week of Nov 15 (the Western Reserve took Nov 8). A draft until
    // Robbie has played it: then drop `draft` and it opens on the Sunday below.
    opens: '2026-11-15',
    draft: true,
    name: 'The Pacific Bluffs',
    tagline: 'Three holes on the California cliffs. Cypress, surf and a lighthouse.',
    holes: [sealion, lighthouse, thecarry],
    par: par([sealion, lighthouse, thecarry]),
    playoff: { hole: thecarry, from: { x: -80, y: 120 }, label: 'Off the cliff top' },
  },
  {
    id: 'westernreserve',
    // northeast Ohio in the fall, the first weekly course: the week of Nov 8. Members can practise all five holes until
    // then; it never counts.
    opens: '2026-11-08',
    whatsNew: [
      'Two cards a day count, and the better one is your score for the day. Each locks at its first swing.',
      'Thick rough. Find the fairway.',
      'Quick, tiered greens.',
      'Light wind. It moves high shots more than low ones.',
      'A calmer chip meter.',
      'Drinks now suit the hole.',
      'Tap a member to send kudos or a chirp.',
      'Deer in the rough.',
    ],
    name: 'The Western Reserve',
    tagline: 'Five holes through the Ohio woods in autumn colour. Creeks, ledges, a lake, a flooded quarry and a river gorge.',
    holes: [creekbend, theledges, maplelake, thequarry, thegorge],
    par: par([creekbend, theledges, maplelake, thequarry, thegorge]),
    playoff: { hole: thegorge, from: { x: -4, y: 720 }, label: 'Up from the river' },
  },
  {
    id: 'windycity',
    // Chicago in late November, built from the Hole Lab's city: the week of Nov 22. A draft until Robbie has played
    // it; he puts it on the calendar from Admin > Course > The weeks ahead.
    opens: '2026-11-22',
    draft: true,
    whatsNew: [
      'Chicago in November. Bring a coat.',
      'The wind off the lake: 10 to 20 mph, and it gusts.',
      'Buildings are in play. A roof keeps your ball.',
      'Greens are flatter, with some break.',
    ],
    name: 'The Windy City',
    tagline: 'Five holes through Chicago in November: the lakefront, Millennium Park, the river, Wrigleyville and Navy Pier.',
    holes: [lakefront, millennium, river, wrigleyville, navypier],
    par: par([lakefront, millennium, river, wrigleyville, navypier]),
    playoff: { hole: navypier, from: { x: 0, y: 640 }, label: 'Off the end of the pier' },
  },
  // ---------- the Hole Lab: one test hole in each new look, for the Committee to play (Admin > Course) ----------
  ...(
    [
      ['lab-florida', 'Lab · Heron Bay', 'Gulf coast Florida: lakes, white waste sand, palms, gators and a pink sunset.', herons],
      ['lab-city', 'Lab · The Loop', 'Downtown: through the towers, under the el, over the river to the ballpark.', theloop],
      ['lab-canyon', 'Lab · Hoodoo Gap', 'Red rock canyon: all carry over the slot to a green between two hoodoos.', hoodoogap],
      ['lab-alpine', 'Lab · Summit Run', 'Ski resort in peak season: 90 feet down the run to the lodge, deep snow either side.', summitrun],
      ['lab-links', 'Lab · The Old Keep', 'Irish links: dunes, pot bunkers, a stone wall and a ruined castle by the sea.', oldkeep],
    ] as [string, string, string, Hole][]
  ).map(([id, name, tagline, hole]): Course => ({ id, opens: '2099-01-01', draft: true, lab: true, name, tagline, holes: [hole], par: hole.par })),
];

// The Committee's schedule (course_schedule in supabase/schema.sql): a week's course picked in the Committee Room,
// period -> course id. A picked week plays that course whatever the calendar says; the rest follow `opens`.
let schedule: Record<string, string> = {};
export const setSchedule = (s: Record<string, string> | null | undefined) => {
  schedule = s ?? {};
};
export const scheduleOf = () => schedule;

const playable = () => COURSES.filter((c) => !c.lab);
// the calendar alone: the latest course (not a draft) to open by this period
export function calendarFor(period: string): Course {
  const sorted = playable()
    .filter((c) => !c.draft)
    .sort((a, b) => a.opens.localeCompare(b.opens));
  return [...sorted].reverse().find((c) => c.opens <= period) ?? sorted[0];
}

// A week plays its pick, or else carries on with the latest course to start by then: the last pick or the last
// course to open on the calendar, whichever came later. own: false leaves out this week's own pick (what the week
// would play without one).
export function courseFor(period: string, own = true): Course {
  const cal = calendarFor(period);
  const key = Object.keys(schedule)
    .filter((k) => (own ? k <= period : k < period) && playable().some((c) => c.id === schedule[k]))
    .sort()
    .pop();
  return key && key >= cal.opens ? playable().find((c) => c.id === schedule[key])! : cal;
}

export const courseById = (id: string) => COURSES.find((c) => c.id === id);
// Next week's course, if it's a different one: members can practise its first holes. Without a pick for next week,
// the next course to open on the calendar.
export function nextCourse(period: string): Course | undefined {
  const now = courseFor(period);
  if (isWeek(period)) {
    const next = courseFor(nextStart(period));
    if (next.id !== now.id) return next;
  }
  return playable()
    .filter((c) => !c.draft && c.opens > period && c.id !== now.id)
    .sort((a, b) => a.opens.localeCompare(b.opens))[0];
}

// Classic courses: the ones of weeks gone by, newest first, open to anyone any time for the course record
export const classics = (period: string) => {
  const now = courseFor(period);
  const past = new Set(Object.entries(schedule).filter(([p]) => p < period).map(([, id]) => id));
  return playable()
    .filter((c) => c.id !== now.id && ((!c.draft && c.opens < period) || past.has(c.id)))
    .sort((a, b) => b.opens.localeCompare(a.opens));
};

// Courses not yet being played: anything still a draft, or on the calendar for a later period. The admin can play them.
export const upcoming = (period: string) => playable().filter((c) => c.id !== courseFor(period).id && (c.draft || c.opens > period || Object.values(schedule).includes(c.id)));
// Every course a week can play (not the lab's test holes), oldest first
export const tourCourses = () => playable().sort((a, b) => a.opens.localeCompare(b.opens));
// The Hole Lab's test holes
export const labHoles = () => COURSES.filter((c) => c.lab);
