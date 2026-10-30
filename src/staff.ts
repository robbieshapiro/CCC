// The club's staff: who they are, how they talk, and their lines. Reginald runs the place and speaks for the club;
// the others each have one job. The voice notes are the brief for anyone writing a line, by hand now or by Claude
// later, so everyone stays in character.
import { esc } from './ui';

export type StaffId = 'reginald' | 'hank' | 'mo' | 'crew';

export const STAFF: Record<StaffId, { name: string; role: string; voice: string; never: string }> = {
  reginald: {
    name: 'Reginald',
    role: 'Club Secretary. Runs everything: the course of the week, the boards, the notices, the welcome.',
    voice: 'English, dry, unhurried, a little formal. Understatement over excitement. Secretly fond of every member and proud of a good score, but would never say so plainly. One or two short sentences.',
    never: 'Never mean, never crude, never shouts, no exclamation marks except for a hole in one.',
  },
  hank: {
    name: 'Hank',
    role: 'The Starter. Runs the first tee: calls you up, sends you off, keeps the pace.',
    voice: 'Former Marine. Clipped, gruff, all business, calls you by name. Tough love: a short order, then a nudge of encouragement. Very few words.',
    never: 'Never chatty, never sarcastic about a member, no jargon.',
  },
  mo: {
    name: 'Mo',
    role: 'Bartender at the Nineteenth Hole. Runs the bar games and the boards on the wall.',
    voice: 'Deadpan, has heard every excuse, quietly warm. A dry one-liner, sometimes a small story. Treats everyone like a regular.',
    never: 'Never pushes drinks, never mocks a bad score, keeps it short.',
  },
  crew: {
    name: 'The cart crew',
    role: 'Daisy, Jules, Sam, Priya and Lucia: the beverage cart.',
    voice: 'Friendly and quick. No chat: the drinks, a smile, on to the next group.',
    never: 'No small talk.',
  },
};

// the same line all day for the same seed, a different one tomorrow
const pick = <T,>(list: T[], seed: string) => list[[...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length];

export const HANK = {
  firstTee: (name: string, day: string) =>
    pick(
      [
        `${name}, you're on the tee. Fairways and greens.`,
        `On the tee, ${name}. Smooth tempo. Go.`,
        `${name}. Breathe. Pick a target. Send it.`,
        `You're up, ${name}. Nobody's watching. Everybody's watching.`,
        `${name}, tee's yours. Keep it out of the lava.`,
      ],
      `${day}:${name}`,
    ),
};

export const MO = {
  welcome: (name: string, day: string) =>
    pick(
      [
        `Evening, ${name}. Usual spot's open.`,
        `${name}. Pull up a stool. The board's on the wall.`,
        `Had a guy in here last week blame the wind on a putt. Indoors. What'll it be, ${name}?`,
        `${name}. Games are on the wall, drinks are on me. The drinks are not on me.`,
        `Long drive net's out back, ${name}. Mind the window.`,
      ],
      `${day}:${name}`,
    ),
};

// A member of staff's face, drawn simply in the club's style.
export function staffFace(id: Exclude<StaffId, 'crew' | 'reginald'>, size = 46) {
  const look =
    id === 'hank'
      ? { skin: '#d8a27e', hair: '#5a5650', top: '#1f2d4a', cap: '#163b2c', extra: '' }
      : { skin: '#a8704a', hair: '#1e1611', top: '#f6f1e6', cap: '', extra: '<path d="M38 76 l9 5 l9 -5" stroke="#1e1611" stroke-width="3" fill="none"/>' };
  return `<svg class="staff-face ${id}" width="${size}" height="${size}" viewBox="0 0 94 94" role="img" aria-label="${STAFF[id].name}">
    <circle cx="47" cy="47" r="47" fill="#e9dfc8"/>
    <path d="M10 94 Q14 72 47 70 Q80 72 84 94 Z" fill="${look.top}"/>${look.extra}
    <rect x="41" y="60" width="12" height="12" fill="${look.skin}"/>
    <ellipse cx="47" cy="45" rx="19" ry="22" fill="${look.skin}"/>
    ${
      id === 'hank'
        ? `<path d="M26 38 Q28 20 47 20 Q66 20 68 38 Z" fill="${look.cap}"/><path d="M47 36 L76 38 Q70 42 47 40 Z" fill="${look.cap}"/>`
        : `<path d="M28 40 Q28 22 47 22 Q66 22 66 40 Q62 30 47 30 Q32 30 28 40 Z" fill="${look.hair}"/>`
    }
    <g fill="#2b2420"><circle cx="39" cy="47" r="2"/><circle cx="55" cy="47" r="2"/></g>
    <path d="M${id === 'hank' ? '40 61 h14' : '41 60 q6 4 12 0'}" stroke="#6b3a30" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${id === 'mo' ? '<path d="M36 56 Q47 64 58 56" stroke="#1e1611" stroke-width="3" fill="none"/>' : ''}
  </svg>`;
}

// A member of staff as a small chip: face and one line (Reginald has his own, in host.ts)
export function staffChip(id: Exclude<StaffId, 'crew' | 'reginald'>, text: string) {
  return `<div class="host-chip staff-chip"><span class="host-face">${staffFace(id)}</span><p><b>${STAFF[id].name}</b> ${esc(text)}</p></div>`;
}
