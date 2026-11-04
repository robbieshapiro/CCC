// The Pro Shop: flashy gear and swag bought with purse money (src/purse.ts). It's all looks, never performance, and it
// shows wherever your golfer does: on the course for other members, in the stands, on your member card. Career
// earnings never go down; what you spend comes out of your balance. Club Pro and Club Legend have racks of their own.
// The prices and racks are mirrored in supabase/schema.sql (shop_items), which checks every purchase.
import type { Player } from './api/types';
import type { GolferSpec } from './golf3d/golfer';

// ---------- rank, by career earnings ----------

export type Rack = 'member' | 'pro' | 'legend';
export const RANKS: { id: Rack; name: string; from: number }[] = [
  { id: 'member', name: 'Club Member', from: 0 },
  { id: 'pro', name: 'Club Pro', from: 15000 },
  { id: 'legend', name: 'Club Legend', from: 75000 },
];
export const rankOf = (earnings: number) => [...RANKS].reverse().find((r) => earnings >= r.from)!;
export const nextRank = (earnings: number) => RANKS.find((r) => r.from > earnings) ?? null;
const ORDER: Record<Rack, number> = { member: 0, pro: 1, legend: 2 };
export const canShop = (rack: Rack, earnings: number) => ORDER[rankOf(earnings).id] >= ORDER[rack];

export const earningsOf = (p: Player) => p.earnings ?? 0;
export const balanceOf = (p: Player) => Math.max(0, (p.earnings ?? 0) - (p.spent ?? 0));

// The badge: a shield in the rank's colours. Club Member is club green and cream, Club Pro gold with a star, Club Legend
// black and gold under a laurel.
export function badgeSvg(rack: Rack, size = 18) {
  const r = RANKS.find((x) => x.id === rack)!;
  const [fill, rim] = rack === 'legend' ? ['#141414', '#e6c35c'] : rack === 'pro' ? ['#d6a940', '#7a5a14'] : ['#1f5c43', '#e6cf9f'];
  const mark =
    rack === 'member'
      ? `<path d="M11 16 L16 20 L21 16" fill="none" stroke="${rim}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M16 8.5 l1.9 3.9 4.3 .6 -3.1 3 .7 4.3 -3.8 -2 -3.8 2 .7 -4.3 -3.1 -3 4.3 -.6z" fill="${rim}"/>`;
  const laurel = rack === 'legend' ? `<path d="M8.5 25 q-3.5 -6 0 -13 M23.5 25 q3.5 -6 0 -13" fill="none" stroke="${rim}" stroke-width="1.6"/>` : '';
  return `<svg class="rank-badge rb-${rack}" width="${size}" height="${size}" viewBox="0 0 32 32" role="img" aria-label="${r.name}"><title>${r.name}</title><path d="M16 2.5 L27.5 6.5 V15.5 C27.5 23 22.5 27.5 16 30 C9.5 27.5 4.5 23 4.5 15.5 V6.5 Z" fill="${fill}" stroke="${rim}" stroke-width="1.6"/>${mark}${laurel}</svg>`;
}
export const badgeFor = (p: Player, size = 18) => (p.host ? '' : badgeSvg(rankOf(earningsOf(p)).id, size));

// ---------- the catalogue ----------

export type Kind = 'top' | 'hat' | 'bling' | 'bag' | 'putter' | 'caddie';
export type Item = {
  id: string;
  name: string;
  kind: Kind;
  price: number;
  rack: Rack;
  what: string;
  wear: (s: GolferSpec) => void;
  off: (s: GolferSpec) => void;
  worn: (s: GolferSpec) => boolean;
};
const top = (id: string, name: string, price: number, rack: Rack, what: string, t: GolferSpec['top']): Item => ({ id, name, kind: 'top', price, rack, what, wear: (s) => (s.top = t), off: (s) => (s.top = 'polo'), worn: (s) => s.top === t });
const hat = (id: string, name: string, price: number, rack: Rack, what: string, h: GolferSpec['hat']): Item => ({ id, name, kind: 'hat', price, rack, what, wear: (s) => (s.hat = h), off: (s) => (s.hat = 'cap'), worn: (s) => s.hat === h });
const flag = (id: string, name: string, price: number, rack: Rack, what: string, k: 'aviators' | 'chain' | 'watch'): Item => ({ id, name, kind: 'bling', price, rack, what, wear: (s) => (s[k] = true), off: (s) => (s[k] = false), worn: (s) => !!s[k] });
const putter = (id: string, name: string, price: number, rack: Rack, what: string, f: GolferSpec['putter']): Item => ({ id, name, kind: 'putter', price, rack, what, wear: (s) => (s.putter = f), off: (s) => (s.putter = 'classic'), worn: (s) => s.putter === f });
const bag = (id: string, name: string, price: number, rack: Rack, what: string, b: GolferSpec['bagStyle']): Item => ({ id, name, kind: 'bag', price, rack, what, wear: (s) => (s.bagStyle = b), off: (s) => (s.bagStyle = undefined), worn: (s) => s.bagStyle === b });

// the Club Legend's one piece: their own caddie
const caddieItem: Item = {
  id: 'caddie',
  name: 'Personal caddie',
  kind: 'caddie',
  price: 60000,
  rack: 'legend',
  what: 'Your own caddie, in a white bib with your name across it, standing by with your bag. On the course, beside your ghost and on your member card.',
  wear: (s) => (s.caddie = true),
  off: (s) => (s.caddie = false),
  worn: (s) => !!s.caddie,
};

export const ITEMS: Item[] = [
  top('hawaiian', 'Hawaiian shirt', 2500, 'member', 'Pacific teal with coral hibiscus and palm fronds. Loud.', 'hawaiian'),
  top('argyle', 'Argyle sweater', 3000, 'member', 'Diamonds in your shirt and accent colours, collar out.', 'argyle'),
  top('tourpolo', 'Tour polo', 6000, 'pro', 'Crisp white, sponsor patches on the chest and sleeves.', 'tourpolo'),
  hat('printbucket', 'Loud bucket hat', 1500, 'member', 'Hawaiian print, in your hat colour.', 'printbucket'),
  hat('tourcap', 'Tour cap', 2500, 'member', 'A gold button on top and a gold crest on the front.', 'tourcap'),
  hat('cowboy', 'Cowboy hat', 5000, 'pro', 'Tall crown, wide brim. Nobody asked.', 'cowboy'),
  hat('goldvisor', 'Gold visor', 8000, 'pro', 'A visor with a solid gold band and brim.', 'goldvisor'),
  flag('aviators', 'Aviators', 2000, 'member', 'Gold-rimmed, mirrored. On at all times.', 'aviators'),
  flag('watch', 'Gold watch', 4000, 'member', 'On the lead wrist, where it catches the light on the backswing.', 'watch'),
  flag('chain', 'Gold chain', 10000, 'pro', 'A heavy gold chain with a little club-head pendant.', 'chain'),
  putter('chrome', 'Chrome putter', 3500, 'member', 'A mirror-polished head.', 'chrome'),
  bag('schoolbag', 'School bag', 4000, 'member', 'A bag in your school kit’s colours with its letters (pick a school in the Locker).', 'school'),
  bag('goldstaff', 'Gold staff bag', 12000, 'pro', 'A big tour staff bag in gold, banded in black.', 'goldstaff'),
  caddieItem,
];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const KIND_NAME: Record<Kind, string> = { top: 'Tops', hat: 'Headwear', bling: 'Bling', bag: 'Bags', putter: 'Putters', caddie: 'Service' };
