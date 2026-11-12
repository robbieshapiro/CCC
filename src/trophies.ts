// The Trophy Room: every plaque a member can earn, and how far along they are. The progress comes from the server
// (trophy_progress in supabase/schema.sql), worked out from rounds, shots and games already recorded.
import type { TrophyProgress } from './api/types';
import { tourCourses } from './golf3d/courses';

export type Plaque = {
  id: string;
  group: 'Titles' | 'Scoring' | 'Skill' | 'Course feats' | 'Club life';
  name: string;
  how: string;
  have: (p: TrophyProgress) => number; // where they are now
  need: number; // what earns it
  course?: string; // course feats: the course it belongs to
};

// a ladder: one plaque per rung, bronze, silver and gold
const tiers = (id: string, group: Plaque['group'], names: string[], how: (n: number) => string, needs: number[], have: Plaque['have']): Plaque[] =>
  needs.map((need, i) => ({ id: `${id}${need}`, group, name: names[i], how: how(need), need, have }));

export function plaques(): Plaque[] {
  const out: Plaque[] = [
    // titles
    ...tiers('titles', 'Titles', ['Club Champion', 'Three-Time Champion', 'Dynasty'], (n) => (n === 1 ? 'Win a week at your club' : `Win ${n} weeks at your club`), [1, 3, 5], (p) => p.titles),
    { id: 'openwin', group: 'Titles', name: 'Open Champion', how: 'Win a week’s Open, across every club', need: 1, have: (p) => p.openwins },
    ...tiers('opentop', 'Titles', ['Top Ten', 'Contender', 'Tour Regular'], (n) => (n === 1 ? 'Finish a week’s Open in the top 10' : `Finish ${n} weeks’ Opens in the top 10`), [1, 5, 10], (p) => p.opentop10),
    // scoring
    ...tiers('birdies', 'Scoring', ['Birdie Watch', 'Birdie Machine', 'Birdie Century'], (n) => `Make ${n} birdies`, [10, 25, 100], (p) => p.birdies),
    ...tiers('eagles', 'Scoring', ['Eagle', 'Eagle Eye', 'Eagle Nest'], (n) => (n === 1 ? 'Make an eagle' : `Make ${n} eagles`), [1, 5, 15], (p) => p.eagles),
    { id: 'albatross', group: 'Scoring', name: 'Albatross', how: 'Three under on a single hole', need: 1, have: (p) => p.albatross },
    { id: 'ace', group: 'Scoring', name: 'Hole in One', how: 'Ace any hole', need: 1, have: (p) => p.aces },
    { id: 'aceclub', group: 'Scoring', name: 'The Ace Club', how: 'Make three holes in one', need: 3, have: (p) => p.aces },
    ...tiers('underpar', 'Scoring', ['Under Par', 'Red Numbers', 'Always Red'], (n) => (n === 1 ? 'Finish a round under par' : `Finish ${n} rounds under par`), [1, 5, 20], (p) => p.underpar),
    { id: 'bogeyfree', group: 'Scoring', name: 'Bogey-Free', how: 'A whole round without a bogey', need: 1, have: (p) => p.bogeyfree },
    ...tiers('cards', 'Scoring', ['Regular', 'Fixture', 'Centurion'], (n) => `Post ${n} rounds`, [10, 50, 100], (p) => p.cards),
    // skill
    { id: 'putt30', group: 'Skill', name: 'From Downtown', how: 'Hole a putt from 30 ft', need: 1, have: (p) => p.putts30 },
    { id: 'putt30x10', group: 'Skill', name: 'Hot Putter', how: 'Hole ten putts from 30 ft', need: 10, have: (p) => p.putts30 },
    { id: 'putt60', group: 'Skill', name: 'Monster Putt', how: 'Hole a putt from 60 ft', need: 1, have: (p) => p.putts60 },
    ...tiers('chipins', 'Skill', ['Chip-In', 'Soft Hands', 'Short-Game Wizard'], (n) => (n === 1 ? 'Hole out from off the green' : `Hole out from off the green ${n} times`), [1, 5, 15], (p) => p.chipins),
    { id: 'pinseeker', group: 'Skill', name: 'Pin Seeker', how: 'Hit Closest to the Pin inside 3 ft, or hole it', need: 1, have: (p) => p.pinseeker },
    ...tiers('drive', 'Skill', ['Big Hitter', 'Long Ball', 'Out of Sight'], (n) => `Hit ${n} yd at the long drive`, [325, 350, 400], (p) => p.longdrive),
    // club life
    ...tiers('streak', 'Club life', ['Every Day for a Week', 'A Month at the Club'], (n) => `Come to the club ${n} days running`, [7, 30], (p) => p.streak),
    ...tiers('ctp', 'Club life', ['Closest to the Pin', 'Dead Eye'], (n) => (n === 1 ? 'Win the day’s Closest to the Pin' : `Win Closest to the Pin ${n} times`), [1, 5], (p) => p.ctpwins),
    { id: 'designer', group: 'Club life', name: 'Course Architect', how: 'Ten members play your Members’ Course hole', need: 10, have: (p) => p.designplayers },
  ];
  // course feats: each hole's secret route, and a birdie on every hole of a course, for every course on the calendar
  // (not drafts: a course's plaques appear once it's out)
  for (const c of tourCourses().filter((x) => !x.draft)) {
    for (const h of c.holes)
      if (h.secret?.zone) out.push({ id: `secret-${h.secret.zone}`, group: 'Course feats', course: c.name, name: h.secret.name, how: `Find the secret on ${h.name}`, need: 1, have: (p) => (p.secrets.includes(h.secret.zone) ? 1 : 0) });
    out.push({ id: `master-${c.id}`, group: 'Course feats', course: c.name, name: `Mastered ${c.name.replace(/^The /, '').replace(/ Course$/, '')}`, how: `A birdie or better on all ${c.holes.length} holes`, need: c.holes.length, have: (p) => (p.birdieHoles[c.id] ?? []).length });
  }
  return out;
}

export const earned = (pl: Plaque, p: TrophyProgress) => pl.have(p) >= pl.need;

// What a plaque pays when it's earned, from Nov 12 (plaque_catalog and plaques_met in supabase/schema.sql: keep in
// step). A ladder pays $250, $750, $2,000 by rung; the big one-offs $2,000; a hole's secret $250; a course mastered $750.
const PAY: Record<string, number> = {
  titles1: 250, titles3: 750, titles5: 2000, openwin: 2000, opentop1: 250, opentop5: 750, opentop10: 2000,
  birdies10: 250, birdies25: 750, birdies100: 2000, eagles1: 250, eagles5: 750, eagles15: 2000,
  albatross: 2000, ace: 750, aceclub: 2000, underpar1: 250, underpar5: 750, underpar20: 2000, bogeyfree: 750,
  cards10: 250, cards50: 750, cards100: 2000, putt30: 250, putt30x10: 750, putt60: 750,
  chipins1: 250, chipins5: 750, chipins15: 2000, pinseeker: 250, drive325: 250, drive350: 750, drive400: 2000,
  streak7: 250, streak30: 750, ctp1: 250, ctp5: 750, designer: 750,
};
export const payOf = (id: string) => PAY[id] ?? (id.startsWith('secret-') ? 250 : id.startsWith('master-') ? 750 : 0);
// how close a locked plaque is, 0 to 1
export const near = (pl: Plaque, p: TrophyProgress) => Math.min(1, pl.have(p) / pl.need);
