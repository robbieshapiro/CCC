// The Pro Shop: flashy gear and swag bought with purse money (src/purse.ts) and club bonuses (src/bonus.ts). It's all
// looks, never performance, and it shows wherever your golfer does: on the course for other members, in the stands, on
// your member card. Career earnings never go down; what you spend comes out of your balance. Club Pro and Club Legend
// have racks of their own. Priced so a regular buys something in their first week and reaches Club Pro in a couple of
// months.
// The prices and racks are mirrored in supabase/schema.sql (shop_items), which checks every purchase.
import type { Player } from './api/types';
import type { GolferSpec } from './golf3d/golfer';

// ---------- rank, by career earnings ----------

export type Rack = 'member' | 'pro' | 'legend';
export const RANKS: { id: Rack; name: string; from: number }[] = [
  { id: 'member', name: 'Club Member', from: 0 },
  { id: 'pro', name: 'Club Pro', from: 5000 },
  { id: 'legend', name: 'Club Legend', from: 25000 },
];
export const rankOf = (earnings: number) => [...RANKS].reverse().find((r) => earnings >= r.from)!;
export const nextRank = (earnings: number) => RANKS.find((r) => r.from > earnings) ?? null;
const ORDER: Record<Rack, number> = { member: 0, pro: 1, legend: 2 };
export const canShop = (rack: Rack, earnings: number) => ORDER[rankOf(earnings).id] >= ORDER[rack];

// career earnings: the purses (p.earnings, the board's money column) and the club bonuses
export const earningsOf = (p: Player) => (p.earnings ?? 0) + (p.bonus?.total ?? 0);
export const balanceOf = (p: Player) => Math.max(0, earningsOf(p) - (p.spent ?? 0));

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

export type Kind = 'top' | 'outer' | 'bottoms' | 'shoes' | 'gloves' | 'hat' | 'eyewear' | 'bling' | 'putter' | 'driver' | 'bag' | 'caddie';
// the order the racks and the fitting room's tabs go in
export const KINDS: Kind[] = ['top', 'outer', 'bottoms', 'shoes', 'gloves', 'hat', 'eyewear', 'bling', 'putter', 'driver', 'bag', 'caddie'];
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
  focus?: 'full' | 'head' | 'chest' | 'hands' | 'bag';
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
  price: 15000,
  rack: 'legend',
  what: 'Your own caddie, in a white bib with your name across it, standing by with your bag. On the course, beside your ghost and on your member card.',
  wear: (s) => (s.caddie = true),
  off: (s) => (s.caddie = false),
  worn: (s) => !!s.caddie,
};

export const ITEMS: Item[] = [
  top('hawaiian', 'Hawaiian shirt', 400, 'member', 'Pacific teal with coral hibiscus and palm fronds. Loud.', 'hawaiian'),
  top('argyle', 'Argyle sweater', 750, 'member', 'Diamonds in your shirt and accent colours, collar out.', 'argyle'),
  top('tourpolo', 'Tour polo', 1500, 'pro', 'Crisp white, sponsor patches on the chest and sleeves.', 'tourpolo'),
  hat('printbucket', 'Loud bucket hat', 250, 'member', 'Hawaiian print, in your hat colour.', 'printbucket'),
  hat('tourcap', 'Tour cap', 500, 'member', 'A gold button on top and a gold crest on the front.', 'tourcap'),
  hat('cowboy', 'Cowboy hat', 1200, 'pro', 'Tall crown, wide brim. Nobody asked.', 'cowboy'),
  hat('goldvisor', 'Gold visor', 2000, 'pro', 'A visor with a solid gold band and brim.', 'goldvisor'),
  { ...flag('aviators', 'Aviators', 350, 'member', 'Gold-rimmed, mirrored. On at all times.', 'aviators'), kind: 'eyewear', focus: 'head' },
  { ...flag('watch', 'Gold watch', 900, 'member', 'On the lead wrist, where it catches the light on the backswing.', 'watch'), focus: 'hands' },
  { ...flag('chain', 'Gold chain', 2500, 'pro', 'A heavy gold chain with a little club-head pendant.', 'chain'), focus: 'chest' },
  putter('chrome', 'Chrome putter', 600, 'member', 'A mirror-polished head.', 'chrome'),
  bag('schoolbag', 'School bag', 1000, 'member', 'A bag in your school kit’s colours with its letters (pick a school in the Locker).', 'school'),
  bag('goldstaff', 'Gold staff bag', 3000, 'pro', 'A big tour staff bag in gold, banded in black.', 'goldstaff'),
  caddieItem,
];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const KIND_NAME: Record<Kind, string> = { top: 'Tops', outer: 'Outerwear', bottoms: 'Trousers', shoes: 'Shoes', gloves: 'Gloves', hat: 'Headwear', eyewear: 'Eyewear', bling: 'Watches & jewellery', putter: 'Putters', driver: 'Drivers', bag: 'Bags', caddie: 'Service' };
export const KIND_ICON: Record<Kind, string> = { top: '👕', outer: '🧥', bottoms: '👖', shoes: '👟', gloves: '🧤', hat: '🧢', eyewear: '🕶️', bling: '⌚', putter: '⛳', driver: '🏌️', bag: '🎒', caddie: '🤵' };

// where the fitting room's camera goes for a piece: the face for hats and glasses, the hands for watches, gloves,
// putters and drivers, round the back for a bag
export function focusOf(i: Item): 'full' | 'head' | 'chest' | 'hands' | 'bag' {
  if (i.focus) return i.focus;
  if (i.kind === 'hat' || i.kind === 'eyewear') return 'head';
  if (i.kind === 'top' || i.kind === 'outer') return 'chest';
  if (i.kind === 'gloves' || i.kind === 'putter' || i.kind === 'driver') return 'hands';
  if (i.kind === 'bag') return 'bag';
  return 'full';
}
