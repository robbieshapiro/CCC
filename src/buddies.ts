import type { Avatar } from './api/types';
import { DEFAULT_SPEC, type GolferSpec } from './golf3d/golfer';

export type Buddy = { name: string; avatar: Avatar; line: string };

const spec = (s: Partial<GolferSpec>): GolferSpec => ({ ...DEFAULT_SPEC, ...s });

// Placeholder members for the local demo.
export const STOCK_BUDDIES: Buddy[] = [
  {
    name: 'Sean',
    line: "Plays it safe, wins anyway. Don't let him near your wallet on the 19th.",
    avatar: { color: '#1f2d4a', equip: {}, onboarded: true, golfer: spec({ skin: '#f6d7bf', hair: 'side', hairColor: '#b78a52', top: 'quarterzip', topColor: '#1f2d4a', bottoms: 'trousers', bottomsColor: '#d9c7a3', hat: 'cap', hatColor: '#1f2d4a', bag: '#1f2d4a' }) },
  },
  {
    name: 'Danny',
    line: 'Hits driver off every tee. Every tee. Last month’s champion, somehow.',
    avatar: { color: '#6e8b74', equip: {}, onboarded: true, golfer: spec({ skin: '#a8704a', hair: 'curly', hairColor: '#1e1611', face: 'stubble', build: 'broad', top: 'polo', topColor: '#6e8b74', accent: '#f4f1e8', bottoms: 'shorts', bottomsColor: '#2b2b2b', hat: 'none', bag: '#7a1f2b' }) },
  },
  {
    name: 'PJ',
    line: 'Plus-fours, flat cap, zero irony. Putts like a surgeon.',
    avatar: { color: '#7a1f2b', equip: {}, onboarded: true, golfer: spec({ skin: '#7a4e33', hair: 'short', hairColor: '#1e1611', face: 'moustache', build: 'slim', height: 1.05, top: 'vest', topColor: '#f4f1e8', accent: '#7a1f2b', bottoms: 'plusfours', bottomsColor: '#8a7a5a', hat: 'flatcap', hatColor: '#f4f1e8', shoes: 'saddle', bag: '#b8955a' }) },
  },
];
