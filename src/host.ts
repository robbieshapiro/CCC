// Reginald: the club steward. Dry, unhurried, quietly judging your putting.
import { esc } from './ui';

export type Mood = 'dry' | 'pleased' | 'appalled';

export function reginaldSvg(mood: Mood = 'dry', size = 44): string {
  const brow =
    mood === 'appalled'
      ? `<path d="M30 39 q6 -5 12 -2" /><path d="M52 37 q6 -3 12 2" />`
      : mood === 'pleased'
        ? `<path d="M30 40 q6 -3 12 0" /><path d="M52 40 q6 -3 12 0" />`
        : `<path d="M30 40 q6 -2 12 0" /><path d="M52 35 q6 -4 12 -1" />`;
  const eyes =
    mood === 'pleased'
      ? `<path d="M33 46 q3 -3 6 0" fill="none"/><path d="M55 46 q3 -3 6 0" fill="none"/>`
      : `<circle cx="36" cy="46" r="2.2" stroke="none" fill="#2b2420"/><circle cx="58" cy="46" r="2.2" stroke="none" fill="#2b2420"/>`;
  const mouth = mood === 'appalled' ? `<ellipse cx="47" cy="67" rx="3" ry="2.4" fill="#6b3a30" stroke="none"/>` : mood === 'pleased' ? `<path d="M41 66 q6 4 12 0" fill="none"/>` : `<path d="M42 67 h10" />`;
  return `<svg class="reginald" width="${size}" height="${size}" viewBox="0 0 94 94" role="img" aria-label="Reginald, the club steward">
    <circle cx="47" cy="47" r="47" fill="#e9dfc8"/>
    <!-- tweed jacket, shirt and bow tie -->
    <path d="M10 94 Q14 72 47 70 Q80 72 84 94 Z" fill="#7a6a4f"/>
    <path d="M10 94 Q14 72 47 70 Q80 72 84 94 Z" fill="url(#tweed)" opacity=".5"/>
    <path d="M36 72 L47 90 L58 72 Z" fill="#f6f1e6"/>
    <path d="M38 76 l9 4 l9 -4 l0 8 l-9 -4 l-9 4 Z" fill="#163b2c"/><circle cx="47" cy="80" r="2" fill="#0f2a1f"/>
    <path d="M30 74 L40 90 M64 74 L54 90" stroke="#5e5039" stroke-width="2"/>
    <!-- head -->
    <rect x="41" y="60" width="12" height="12" fill="#e6b994"/>
    <ellipse cx="47" cy="45" rx="20" ry="23" fill="#efc7a3"/>
    <ellipse cx="27" cy="47" rx="3.5" ry="6" fill="#e6b994"/><ellipse cx="67" cy="47" rx="3.5" ry="6" fill="#e6b994"/>
    <!-- silver hair, neatly parted -->
    <path d="M27 40 Q26 20 47 19 Q68 20 67 40 Q66 30 58 27 Q50 31 36 28 Q29 32 27 40 Z" fill="#cfd0cc"/>
    <path d="M44 22 Q49 25 58 26" stroke="#b5b6b1" stroke-width="1.6" fill="none"/>
    <g stroke="#8d8c86" stroke-width="2.4" stroke-linecap="round" fill="none">${brow}</g>
    <g stroke="#2b2420" stroke-width="2" stroke-linecap="round">${eyes}</g>
    <path d="M47 46 q-3 8 0 11 q2 1 3 -1" stroke="#c99a78" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <!-- the moustache -->
    <path d="M34 62 Q40 56 47 60 Q54 56 60 62 Q54 61 47 63 Q40 61 34 62 Z" fill="#d9d9d4" stroke="#b9bab4" stroke-width=".8"/>
    <g stroke="#6b3a30" stroke-width="1.8" stroke-linecap="round">${mouth}</g>
    <!-- monocle on a chain, naturally -->
    <circle cx="58" cy="46" r="6" fill="none" stroke="#b8955a" stroke-width="1.6"/>
    <path d="M63 50 Q70 62 64 74" stroke="#b8955a" stroke-width="1" fill="none"/>
    <defs><pattern id="tweed" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 4 L4 0 M-1 1 L1 -1 M3 5 L5 3" stroke="#4f4331" stroke-width=".7"/></pattern></defs>
  </svg>`;
}

// Reginald as a small chip: his face and one line.
export function hostChip(text: string, mood: Mood = 'dry', id = ''): string {
  return `<div class="host-chip" ${id ? `id="${id}"` : ''}><span class="host-face">${reginaldSvg(mood, 46)}</span><p><b>Reginald</b> ${text}</p></div>`;
}

const pick = <T,>(list: T[], seed: string) => list[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % list.length];

export const REGINALD = {
  welcome: () => 'Good afternoon. Members only, I am afraid. Do sign in.',
  invited: () => "You've been put up for membership. Choose a name and a four-digit PIN. The PIN is how the club knows it's you on any device, so do try to remember it.",
  course: (name: string, par: number) => `This month the committee presents <b>${esc(name)}</b>. Three holes, par ${par}. Your best round counts.`,
  nobody: (day: string) => pick(['Not a single round this month. The greens are, frankly, offended.', 'The board is empty. One of you might consider golf.'], day),
  notYet: (n: number) => `${n} ${n === 1 ? 'member has' : 'members have'} posted a round. You have not. I merely observe.`,
  leading: (toPar: string, day: string) =>
    pick([`You lead the month at <b>${toPar}</b>. Do try not to let it go to your head.`, `<b>${toPar}</b> and top of the board. The staff are cautiously impressed.`], day),
  behind: (who: string, toPar: string, gap: number) => `${esc(who)} leads at <b>${toPar}</b>, ${gap} ${gap === 1 ? 'stroke' : 'strokes'} ahead of you. One soldiers on.`,
  others: (who: string, toPar: string) => `${esc(who)} leads the month at <b>${toPar}</b>. The rest of you are, regrettably, also members.`,
  hole: (name: string, toPar: number, strokes: number) =>
    strokes === 1 ? 'A hole in one. I shall have it engraved.'
    : toPar <= -2 ? `${name}. Extraordinary. I had to sit down.`
    : toPar === -1 ? 'A birdie. How very agreeable.'
    : toPar === 0 ? 'Par. Perfectly respectable.'
    : toPar === 1 ? 'A bogey. We have all been there, some of us more than others.'
    : toPar === 2 ? 'A double. We shan’t speak of it.'
    : `A ${strokes}. We shan’t speak of it.`,
  round: (toPar: string, best: boolean) => (best ? `<b>${toPar}</b>. A personal best. I've informed the committee.` : `<b>${toPar}</b> for the round. Your best still stands, which is something.`),
  card: (wins: number) => (wins ? `${wins} monthly ${wins === 1 ? 'title' : 'titles'}. The wardrobe reflects it.` : 'No titles yet. Win a month and the pro shop opens up.'),
};
