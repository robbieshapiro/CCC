// Club ranks: Caddie, Junior Member, Member, Captain and Club Legend, three tiers each up to Captain, then Prestige.
// XP comes from all over the club (rounds, birdies, secrets found, the Daily Shot, practice, the bar, the Design
// Desk, titles), and the first tier of each rank also asks for things done, not just XP banked. Each rank unlocks
// gear that gives a small, capped edge (steadier, never longer) and some of the club's features.
import type { ClubId } from './golf3d/clubs';
import type { Player, PlayerStats, Snapshot } from './api/types';
import { FEATS } from './feats';

// What a member has done, all time. The server counts these (get_snapshot's stats); until that SQL is in, the app
// works out what it can from the career numbers and feats.
export type Stats = PlayerStats & { wins: number; secrets: number }; // secrets: distinct secret routes found

const NOT_SECRET = new Set(['ace', 'chipin', 'underpar', 'nineteenth', 'champion']);
export const secretsOf = (feats: string[]) => feats.filter((f) => !NOT_SECRET.has(f) && FEATS.some((x) => x.id === f)).length;

export function statsOf(p: Player): Stats {
  const s = p.stats;
  const secrets = secretsOf(p.feats);
  if (s) return { ...s, wins: p.wins, secrets };
  const rounds = p.career?.rounds ?? 0;
  return { rounds, weeks: rounds ? 1 : 0, underPar: p.feats.includes('underpar') ? 1 : 0, birdies: 0, eagles: 0, aces: p.feats.includes('ace') ? 1 : 0, daily: 0, practice: 0, bar: 0, designs: 0, wins: p.wins, secrets };
}

// ---------- XP ----------

export const XP = {
  round: 100,
  week: 150,
  underPar: 150,
  birdie: 40,
  eagle: 120,
  ace: 400,
  secret: 250,
  daily: 30,
  practice: 20,
  bar: 25,
  design: 150,
  win: 1000,
};
// what's counted from the bits that are easy to repeat
const PRACTICE_CAP = 60;
const BAR_CAP = 100;

export function xpOf(s: Stats) {
  return (
    s.rounds * XP.round +
    s.weeks * XP.week +
    s.underPar * XP.underPar +
    s.birdies * XP.birdie +
    s.eagles * XP.eagle +
    s.aces * XP.ace +
    s.secrets * XP.secret +
    s.daily * XP.daily +
    Math.min(s.practice, PRACTICE_CAP) * XP.practice +
    Math.min(s.bar, BAR_CAP) * XP.bar +
    s.designs * XP.design +
    s.wins * XP.win
  );
}

// ---------- the ladder ----------

export type Family = 'caddie' | 'junior' | 'member' | 'captain' | 'legend';
type Req = { label: string; met: (s: Stats) => boolean; have: (s: Stats) => string };
const req = (label: string, key: keyof Stats, n: number): Req => ({ label, met: (s) => s[key] >= n, have: (s) => `${Math.min(s[key], n)}/${n}` });

export const FAMILIES: { id: Family; name: string; tiers: number; color: string; rim: string; reqs: Req[] }[] = [
  { id: 'caddie', name: 'Caddie', tiers: 3, color: '#a9733f', rim: '#6e4524', reqs: [] },
  { id: 'junior', name: 'Junior Member', tiers: 3, color: '#a7b3bb', rim: '#5f6c75', reqs: [req('Finish 3 rounds', 'rounds', 3), req('Make a birdie', 'birdies', 1), req('Play the Daily Shot', 'daily', 1)] },
  { id: 'member', name: 'Member', tiers: 3, color: '#d6a940', rim: '#8a6514', reqs: [req('Finish 10 rounds', 'rounds', 10), req('Play in 2 different weeks', 'weeks', 2), req('Find a secret route', 'secrets', 1)] },
  { id: 'captain', name: 'Captain', tiers: 3, color: '#1f5c43', rim: '#d6a940', reqs: [req('Break par', 'underPar', 1), req('Find 3 secret routes', 'secrets', 3), req('Play the Daily Shot on 10 days', 'daily', 10), req('Play in 4 different weeks', 'weeks', 4)] },
  { id: 'legend', name: 'Club Legend', tiers: 1, color: '#1b1b1b', rim: '#e6c35c', reqs: [req('Win a week', 'wins', 1), req('Make an eagle', 'eagles', 1), req('Find 6 secret routes', 'secrets', 6), req('Play in 8 different weeks', 'weeks', 8)] },
];

// one entry per level: Caddie I is level 0, Club Legend level 12
export const LEVELS: { family: Family; tier: number; xp: number }[] = [];
{
  const xp = [0, 300, 700, 1200, 1800, 2500, 3500, 4600, 5900, 7500, 9300, 11500, 14000];
  for (const f of FAMILIES) for (let t = 1; t <= f.tiers; t++) LEVELS.push({ family: f.id, tier: t, xp: xp[LEVELS.length] });
}
export const PRESTIGE_XP = 6000; // each Prestige star past Club Legend
const ROMAN = ['', 'I', 'II', 'III'];
export const familyOf = (id: Family) => FAMILIES.find((f) => f.id === id)!;
export const levelName = (level: number) => {
  const l = LEVELS[level];
  const f = familyOf(l.family);
  return f.tiers > 1 ? `${f.name} ${ROMAN[l.tier]}` : f.name;
};

export type Rank = {
  level: number;
  name: string;
  family: Family;
  tier: number;
  prestige: number;
  xp: number;
  // the next level: its name, the XP it needs, and what's still to do for it (only on the first tier of a rank)
  next: { level: number; name: string; xp: number; reqs: { label: string; met: boolean; have: string }[] } | null;
  blocked: boolean; // enough XP for the next level, but its rank asks for more
};

export function rankOf(s: Stats): Rank {
  const xp = xpOf(s);
  let level = 0;
  for (let i = 1; i < LEVELS.length; i++) {
    const l = LEVELS[i];
    if (xp < l.xp) break;
    if (l.tier === 1 && !familyOf(l.family).reqs.every((r) => r.met(s))) break;
    level = i;
  }
  const l = LEVELS[level];
  const top = level === LEVELS.length - 1;
  const prestige = top ? Math.floor((xp - l.xp) / PRESTIGE_XP) : 0;
  let next: Rank['next'] = null;
  if (!top) {
    const n = LEVELS[level + 1];
    const reqs = n.tier === 1 ? familyOf(n.family).reqs.map((r) => ({ label: r.label, met: r.met(s), have: r.have(s) })) : [];
    next = { level: level + 1, name: levelName(level + 1), xp: n.xp, reqs };
  } else next = { level, name: `Prestige ${prestige + 1}`, xp: l.xp + (prestige + 1) * PRESTIGE_XP, reqs: [] };
  return { level, name: levelName(level), family: l.family, tier: l.tier, prestige, xp, next, blocked: !!next && xp >= next.xp && !top };
}

export const rankOfPlayer = (p: Player) => rankOf(statsOf(p));

// ---------- gear ----------

export type GearKind = 'putter' | 'ball' | 'irons' | 'driver';
export type Gear = { id: string; kind: GearKind; name: string; level: number; wins?: number; what: string; amount: number };

// putter: how much of the putt's true line it shows on the quick tour greens (0.5 = the first half of the roll)
// ball: what's left of the wind's push on the ball. irons and driver: the gold window on the swing meter
export const GEAR: Gear[] = [
  { id: 'club-putter', kind: 'putter', name: 'Club putter', level: 0, what: 'You read the green yourself.', amount: 0 },
  { id: 'blade', kind: 'putter', name: 'Blade putter', level: 2, what: 'Shows the first 15% of your putt’s true line on quick greens.', amount: 0.15 },
  { id: 'mallet', kind: 'putter', name: 'Mallet putter', level: 4, what: 'Shows the first quarter of the true line.', amount: 0.25 },
  { id: 'milled', kind: 'putter', name: 'Milled putter', level: 7, what: 'Shows the first 35% of the true line.', amount: 0.35 },
  { id: 'gold', kind: 'putter', name: 'Gold putter', level: 11, wins: 8, what: 'The best in the bag: shows the first half of the true line, break and pace.', amount: 0.5 },
  { id: 'club-ball', kind: 'ball', name: 'Club ball', level: 0, what: 'Goes where the wind sends it.', amount: 1 },
  { id: 'tour-ball', kind: 'ball', name: 'Tour ball', level: 3, what: '7% less wind drift.', amount: 0.93 },
  { id: 'tourx-ball', kind: 'ball', name: 'Tour X ball', level: 8, what: '13% less wind drift.', amount: 0.87 },
  { id: 'gold-ball', kind: 'ball', name: 'Gold ball', level: 12, what: '18% less wind drift.', amount: 0.82 },
  { id: 'club-irons', kind: 'irons', name: 'Club irons', level: 0, what: 'The stock gold window.', amount: 1 },
  { id: 'forged', kind: 'irons', name: 'Forged irons', level: 5, what: '6% wider gold window on irons, wedges and chips.', amount: 1.06 },
  { id: 'tour-irons', kind: 'irons', name: 'Tour irons', level: 9, what: '12% wider gold window on irons, wedges and chips.', amount: 1.12 },
  { id: 'club-driver', kind: 'driver', name: 'Club driver', level: 0, what: 'The stock gold window.', amount: 1 },
  { id: 'tour-driver', kind: 'driver', name: 'Tour driver', level: 6, what: '6% wider gold window on the driver and wood. No extra distance.', amount: 1.06 },
  { id: 'gold-driver', kind: 'driver', name: 'Gold driver', level: 12, what: '12% wider gold window on the driver and wood. No extra distance.', amount: 1.12 },
];

const owns = (g: Gear, level: number, wins: number) => level >= g.level || (g.wins !== undefined && wins >= g.wins);
// the best of each kind you've unlocked: it's always in your bag
export function bagOf(level: number, wins: number): Record<GearKind, Gear> {
  const best = (k: GearKind) => GEAR.filter((g) => g.kind === k && owns(g, level, wins)).pop()!;
  return { putter: best('putter'), ball: best('ball'), irons: best('irons'), driver: best('driver') };
}

// what the engine plays with
export type GearFx = { sweet: Partial<Record<ClubId, number>>; wind: number; read: number };
export function fxOf(level: number, wins: number): GearFx {
  const b = bagOf(level, wins);
  return {
    sweet: { iron: b.irons.amount, wedge: b.irons.amount, chip: b.irons.amount, driver: b.driver.amount, wood: b.driver.amount },
    wind: b.ball.amount,
    read: b.putter.amount,
  };
}

// ---------- features ----------

export type Feature = { id: string; name: string; level: number; what: string; soon?: boolean };
export const FEATURES: Feature[] = [
  { id: 'design', name: 'Design a Hole', level: 3, what: 'Describe a hole and the architect builds it for the Members’ Course.' },
  { id: 'tournament', name: 'Mini tournaments', level: 9, what: 'Start your own tournament and invite members.', soon: true },
  { id: 'prestige', name: 'Prestige stars', level: 12, what: 'A star on your badge for every 6,000 XP past Club Legend.' },
];
export const canUse = (id: string, level: number) => level >= (FEATURES.find((f) => f.id === id)?.level ?? 0);

// everything that opens at exactly this level
export const unlocksAt = (level: number) => ({ gear: GEAR.filter((g) => g.level === level), features: FEATURES.filter((f) => f.level === level) });
// the next thing you'll get, and at which level
export function nextUnlock(level: number) {
  for (let l = level + 1; l < LEVELS.length; l++) {
    const u = unlocksAt(l);
    if (u.gear.length || u.features.length) return { level: l, ...u };
  }
  return null;
}

// ---------- a round's XP ----------

export type XpLine = { label: string; xp: number };
// What a counted round earns: the round, the first of the week, under par, birdies and better, new secrets
export function roundXp(r: { holes: number[]; pars: number[]; newSecrets: string[]; firstOfWeek: boolean }): { lines: XpLine[]; add: Partial<Stats> } {
  const lines: XpLine[] = [{ label: 'Round finished', xp: XP.round }];
  const add: Partial<Stats> = { rounds: 1 };
  if (r.firstOfWeek) {
    lines.push({ label: 'First round of the week', xp: XP.week });
    add.weeks = 1;
  }
  let birdies = 0;
  let eagles = 0;
  let aces = 0;
  r.holes.forEach((s, i) => {
    if (s === undefined) return;
    if (s === 1) aces++;
    else if (s <= r.pars[i] - 2) eagles++;
    else if (s === r.pars[i] - 1) birdies++;
  });
  const total = r.holes.reduce((a, b) => a + b, 0);
  const par = r.pars.reduce((a, b) => a + b, 0);
  if (total < par) {
    lines.push({ label: 'Under par', xp: XP.underPar });
    add.underPar = 1;
  }
  if (birdies) lines.push({ label: birdies > 1 ? `${birdies} birdies` : 'Birdie', xp: birdies * XP.birdie });
  if (eagles) lines.push({ label: eagles > 1 ? `${eagles} eagles` : 'Eagle', xp: eagles * XP.eagle });
  if (aces) lines.push({ label: aces > 1 ? `${aces} holes in one` : 'Hole in one', xp: aces * XP.ace });
  for (const id of r.newSecrets) lines.push({ label: `Secret found: ${FEATS.find((f) => f.id === id)?.name ?? id}`, xp: XP.secret });
  Object.assign(add, { birdies, eagles, aces, secrets: r.newSecrets.length });
  return { lines, add };
}

export const holeXp = (strokes: number, par: number) => (strokes === 1 ? { label: 'Hole in one', xp: XP.ace } : strokes <= par - 2 ? { label: 'Eagle', xp: XP.eagle } : strokes === par - 1 ? { label: 'Birdie', xp: XP.birdie } : null);

export function addStats(s: Stats, add: Partial<Stats>): Stats {
  const out = { ...s };
  for (const [k, v] of Object.entries(add)) out[k as keyof Stats] += v ?? 0;
  return out;
}

// has this member posted a round this period already?
export const playedThisWeek = (snap: Snapshot, id: string) => snap.rounds.some((r) => r.playerId === id);

// ---------- the badge ----------

// A shield in the rank's metal, a chevron per tier, a star for Captain and a laurel for Club Legend; Prestige stars
// sit along the top. Drawn as SVG so it's sharp at any size.
export function badgeSvg(r: Pick<Rank, 'family' | 'tier' | 'prestige' | 'name'>, size = 22) {
  const f = familyOf(r.family);
  const chevrons = f.tiers > 1 ? Array.from({ length: r.tier }, (_, i) => `<path d="M9 ${27 - i * 5} L16 ${23 - i * 5} L23 ${27 - i * 5}" fill="none" stroke="${f.rim}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join('') : '';
  const emblem =
    r.family === 'captain' || r.family === 'legend'
      ? `<path d="M16 7.5 l1.9 3.9 4.3 .6 -3.1 3 .7 4.3 -3.8 -2 -3.8 2 .7 -4.3 -3.1 -3 4.3 -.6z" fill="${f.rim}"/>`
      : `<circle cx="16" cy="12.5" r="3.2" fill="${f.rim}" opacity="0.85"/>`;
  const laurel =
    r.family === 'legend'
      ? `<path d="M8 26 q-3 -6 0 -12 M24 26 q3 -6 0 -12" fill="none" stroke="${f.rim}" stroke-width="1.6"/><path d="M11 29 q5 3 10 0" fill="none" stroke="${f.rim}" stroke-width="1.6"/>`
      : '';
  const stars = r.prestige ? `<text x="16" y="5" text-anchor="middle" font-size="5.5" font-weight="800" fill="#e6c35c">${'★'.repeat(Math.min(5, r.prestige))}</text>` : '';
  return `<svg class="rank-badge rb-${r.family}" width="${size}" height="${size}" viewBox="0 0 32 32" role="img" aria-label="${r.name}${r.prestige ? `, Prestige ${r.prestige}` : ''}"><title>${r.name}${r.prestige ? ` · Prestige ${r.prestige}` : ''}</title>
    <path d="M16 2.5 L27.5 6.5 V15.5 C27.5 23 22.5 27.5 16 30 C9.5 27.5 4.5 23 4.5 15.5 V6.5 Z" fill="${f.color}" stroke="${f.rim}" stroke-width="1.6"/>
    <path d="M16 4.6 L25.5 7.9 V15.5 C25.5 21.6 21.6 25.4 16 27.7" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="1"/>
    ${emblem}${chevrons}${laurel}${stars}</svg>`;
}

export const badgeFor = (p: Player, size = 22) => (p.host ? '' : badgeSvg(rankOfPlayer(p), size));
