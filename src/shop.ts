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
  focus?: 'full' | 'head' | 'chest' | 'hands' | 'club' | 'bag';
};
const top = (id: string, name: string, price: number, rack: Rack, what: string, t: GolferSpec['top']): Item => ({ id, name, kind: 'top', price, rack, what, wear: (s) => (s.top = t), off: (s) => (s.top = 'polo'), worn: (s) => s.top === t });
const hat = (id: string, name: string, price: number, rack: Rack, what: string, h: GolferSpec['hat']): Item => ({ id, name, kind: 'hat', price, rack, what, wear: (s) => (s.hat = h), off: (s) => (s.hat = 'cap'), worn: (s) => s.hat === h });
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

// One slot per kind of piece: wearing a piece puts its value in the slot, taking it off puts the default back
function slot<K extends keyof GolferSpec>(id: string, name: string, price: number, rack: Rack, kind: Kind, what: string, key: K, v: GolferSpec[K], dflt: GolferSpec[K], focus?: Item['focus']): Item {
  return { id, name, kind, price, rack, what, focus, wear: (s) => void (s[key] = v), off: (s) => void (s[key] = dflt), worn: (s) => s[key] === v };
}
const watch = (id: string, name: string, price: number, rack: Rack, what: string, style: NonNullable<GolferSpec['watchStyle']>): Item => ({
  id, name, kind: 'bling', price, rack, what, focus: 'hands',
  wear: (s) => void ((s.watch = true), (s.watchStyle = style)),
  off: (s) => void (s.watch = false),
  worn: (s) => !!s.watch && (s.watchStyle ?? 'gold') === style,
});
const chain = (id: string, name: string, price: number, rack: Rack, what: string, style: NonNullable<GolferSpec['chainStyle']>): Item => ({
  id, name, kind: 'bling', price, rack, what, focus: 'chest',
  wear: (s) => void ((s.chain = true), (s.chainStyle = style)),
  off: (s) => void (s.chain = false),
  worn: (s) => !!s.chain && (s.chainStyle ?? 'gold') === style,
});
// glasses share one face: putting on a pair takes the aviators off, and the other way round
const specs = (id: string, name: string, price: number, rack: Rack, what: string, style: GolferSpec['eyewear'] | 'aviators'): Item => ({
  id, name, kind: 'eyewear', price, rack, what, focus: 'head',
  wear: (s) => void (style === 'aviators' ? ((s.aviators = true), (s.eyewear = undefined)) : ((s.eyewear = style), (s.aviators = false))),
  off: (s) => void (style === 'aviators' ? (s.aviators = false) : (s.eyewear = undefined)),
  worn: (s) => (style === 'aviators' ? !!s.aviators : s.eyewear === style),
});
const glove = (id: string, name: string, price: number, rack: Rack, what: string, style: NonNullable<GolferSpec['gloveStyle']>): Item => ({
  id, name, kind: 'gloves', price, rack, what, focus: 'hands',
  wear: (s) => void ((s.gloveStyle = style), (s.glove = true)),
  off: (s) => void (s.gloveStyle = undefined),
  worn: (s) => s.gloveStyle === style,
});
const flag2 = (id: string, name: string, price: number, rack: Rack, what: string, key: 'bracelet' | 'earring', focus: Item['focus']): Item => ({
  id, name, kind: 'bling', price, rack, what, focus, wear: (s) => void (s[key] = true), off: (s) => void (s[key] = false), worn: (s) => !!s[key],
});

// The catalogue: about 60 pieces on a wide ladder. The shop floor runs $100 to $1,500, so everyone buys something in
// their first week; the Club Pro rack $1,500 to $8,000; the Club Legend rack $10,000 to $30,000. Prices and racks are
// mirrored in supabase/schema.sql (shop_items), which checks every purchase.
export const ITEMS: Item[] = [
  // tops
  top('stripepolo', 'Striped polo', 300, 'member', 'Fine stripes in your shirt colour and cream, collar out.', 'stripepolo'),
  top('hawaiian', 'Hawaiian shirt', 400, 'member', 'Pacific teal with coral hibiscus and palm fronds. Loud.', 'hawaiian'),
  top('mockneck', 'Mock neck', 450, 'member', 'A clean roll neck in your shirt colour. Very tour.', 'mockneck'),
  top('retro', 'Seventies polo', 650, 'member', 'A wide collar and a band across the chest, in your two colours.', 'retro'),
  top('argyle', 'Argyle sweater', 750, 'member', 'Diamonds in your shirt and accent colours, collar out.', 'argyle'),
  top('rugby', 'Rugby shirt', 900, 'member', 'Broad hoops in your shirt and accent colours, a white collar.', 'rugby'),
  top('tourpolo', 'Tour polo', 1500, 'pro', 'Crisp white, sponsor patches on the chest and sleeves.', 'tourpolo'),
  top('goldlame', 'Gold lamé polo', 12000, 'legend', 'Woven with gold thread. It shimmers when you walk.', 'goldlame'),
  // outerwear
  slot('windbreaker', 'Windbreaker', 500, 'member', 'outer', 'Petrol blue, half zip, an elastic hem. For the links.', 'outer', 'windbreaker', undefined, 'chest'),
  slot('gilet', 'Gilet', 700, 'member', 'outer', 'A black zipped gilet over whatever you’re wearing.', 'outer', 'gilet', undefined, 'chest'),
  slot('rainjacket', 'Rain jacket', 1100, 'member', 'outer', 'Storm yellow, the hood rolled at the collar. The Western Reserve’s favourite.', 'outer', 'rainjacket', undefined, 'chest'),
  slot('puffer', 'Puffer jacket', 3500, 'pro', 'outer', 'Quilted navy down, a stand-up collar. Winter rounds sorted.', 'outer', 'puffer', undefined, 'chest'),
  slot('velvet', 'Velvet smoking jacket', 6000, 'pro', 'outer', 'Burgundy velvet with black satin lapels. For the nineteenth hole.', 'outer', 'velvet', undefined, 'chest'),
  slot('overcoat', 'Camel overcoat', 14000, 'legend', 'outer', 'Long camel wool, down past the knee. Arrives before you do.', 'outer', 'overcoat', undefined, 'full'),
  // trousers
  slot('whites', 'Tour whites', 600, 'member', 'bottoms', 'Crisp white trousers. Brave on a wet day.', 'bottoms', 'whites', 'trousers', 'full'),
  slot('checks', 'Check trousers', 800, 'member', 'bottoms', 'A small black and cream check. Very old course.', 'bottoms', 'checks', 'trousers', 'full'),
  slot('leather', 'Leather trousers', 4000, 'pro', 'bottoms', 'Black leather. They creak on the backswing.', 'bottoms', 'leather', 'trousers', 'full'),
  slot('goldpants', 'Gold trousers', 10000, 'legend', 'bottoms', 'Metallic gold from the belt to the shoe.', 'bottoms', 'goldpants', 'trousers', 'full'),
  // shoes
  slot('sneaker', 'Tour sneakers', 300, 'member', 'shoes', 'Spikeless white sneakers with a green sole.', 'shoeStyle', 'sneaker', undefined, 'full'),
  slot('spectator', 'Spectator brogues', 700, 'member', 'shoes', 'Black and white two-tones. A classic for a reason.', 'shoeStyle', 'spectator', undefined, 'full'),
  slot('crocshoes', 'Croc leather shoes', 3000, 'pro', 'shoes', 'Dark croc leather, polished to a shine.', 'shoeStyle', 'croc', undefined, 'full'),
  slot('goldshoes', 'Gold spikes', 11000, 'legend', 'shoes', 'Solid gold shoes on black soles. Mind the greens.', 'shoeStyle', 'gold', undefined, 'full'),
  // gloves
  glove('blackglove', 'Black glove', 150, 'member', 'Black leather on the lead hand.', 'black'),
  glove('pairgloves', 'A pair of gloves', 350, 'member', 'White on both hands, like the old pros.', 'pair'),
  glove('goldglove', 'Gold glove', 2000, 'pro', 'Gold leather on the lead hand. Grip it and grin.', 'gold'),
  // headwear
  hat('beanie', 'Bobble beanie', 200, 'member', 'Knitted in your hat colour with a cream bobble.', 'beanie'),
  hat('printbucket', 'Loud bucket hat', 250, 'member', 'Hawaiian print, in your hat colour.', 'printbucket'),
  hat('tourcap', 'Tour cap', 500, 'member', 'A gold button on top and a gold crest on the front.', 'tourcap'),
  hat('straw', 'Straw hat', 600, 'member', 'A woven straw hat with a black band. Summer at the club.', 'straw'),
  hat('cowboy', 'Cowboy hat', 1200, 'pro', 'Tall crown, wide brim. Nobody asked.', 'cowboy'),
  hat('goldvisor', 'Gold visor', 2000, 'pro', 'A visor with a solid gold band and brim.', 'goldvisor'),
  hat('fedora', 'Fedora', 2500, 'pro', 'Charcoal felt, a burgundy band, the brim snapped down.', 'fedora'),
  hat('tophat', 'Top hat', 10000, 'legend', 'Black silk, tall, a gold band. Absolutely not regulation.', 'tophat'),
  // eyewear
  specs('sportshades', 'Sport wraparounds', 300, 'member', 'Mirrored orange lenses wrapping round the face.', 'sport'),
  specs('aviators', 'Aviators', 350, 'member', 'Gold-rimmed, mirrored. On at all times.', 'aviators'),
  specs('roundspecs', 'Tortoiseshell specs', 450, 'member', 'Round frames for reading greens and the newsletter.', 'round'),
  specs('shieldshades', 'Shield shades', 2200, 'pro', 'One big amber lens under a gold bar.', 'shield'),
  specs('diamondframes', 'Diamond frames', 18000, 'legend', 'Round gold frames set with diamonds.', 'diamond'),
  // watches and jewellery
  watch('sportwatch', 'Sport watch', 250, 'member', 'Black rubber strap, a green ring round the dial.', 'sport'),
  flag2('bracelet', 'Silver bracelet', 500, 'member', 'A silver bangle on the trail wrist.', 'bracelet', 'hands'),
  watch('watch', 'Gold watch', 900, 'member', 'On the lead wrist, where it catches the light on the backswing.', 'gold'),
  chain('chain', 'Gold chain', 2500, 'pro', 'A heavy gold chain with a little club-head pendant.', 'gold'),
  flag2('earring', 'Diamond stud', 4500, 'pro', 'One diamond, in the left ear.', 'earring', 'head'),
  watch('diamondwatch', 'Diamond watch', 25000, 'legend', 'Platinum, a navy dial, a ring of diamonds round the bezel.', 'diamond'),
  chain('icedchain', 'Diamond chain', 30000, 'legend', 'An iced-out chain with a diamond pendant. The whole course will know.', 'diamond'),
  // putters
  slot('chrome', 'Chrome putter', 600, 'member', 'putter', 'A mirror-polished head.', 'putter', 'chrome', 'classic', 'club'),
  slot('mallet', 'Mallet putter', 800, 'member', 'putter', 'A big half-moon head with a white sight line.', 'putter', 'mallet', 'classic', 'club'),
  slot('hickory', 'Hickory putter', 1200, 'member', 'putter', 'A hickory shaft and a brass blade, the way it used to be.', 'putter', 'hickory', 'classic', 'club'),
  slot('blackout', 'Blackout putter', 2500, 'pro', 'putter', 'Matte black head and shaft. Menacing.', 'putter', 'blackout', 'classic', 'club'),
  slot('diamondputter', 'Diamond putter', 20000, 'legend', 'putter', 'A chrome blade with a row of diamonds along the top.', 'putter', 'diamond', 'classic', 'club'),
  // drivers and headcovers
  slot('persimmon', 'Persimmon driver', 700, 'member', 'driver', 'A glossy wooden head, like your grandfather’s.', 'driver', 'persimmon', undefined, 'club'),
  slot('carbon', 'Carbon driver', 3000, 'pro', 'driver', 'A carbon-weave crown and shaft.', 'driver', 'carbon', undefined, 'club'),
  slot('golddriver', 'Gold driver', 12000, 'legend', 'driver', 'A solid gold head. Heavy, in every sense.', 'driver', 'gold', undefined, 'club'),
  slot('pompoms', 'Bobble headcovers', 250, 'member', 'driver', 'Knitted covers with bobbles on every club in the bag.', 'headcover', 'pompom', undefined, 'bag'),
  slot('tigers', 'Tiger headcovers', 2000, 'pro', 'driver', 'Striped big-cat heads, ears and all, on your woods.', 'headcover', 'tiger', undefined, 'bag'),
  // bags
  slot('pencil', 'Pencil bag', 300, 'member', 'bag', 'A slim canvas carry bag with leather trim.', 'bagStyle', 'pencil', undefined, 'bag'),
  bag('schoolbag', 'School bag', 1000, 'member', 'A bag in your school kit’s colours with its letters (pick a school in the Locker).', 'school'),
  bag('goldstaff', 'Gold staff bag', 3000, 'pro', 'A big tour staff bag in gold, banded in black.', 'goldstaff'),
  slot('leatherbag', 'Vintage leather bag', 4000, 'pro', 'bag', 'Tan leather and brass, worn in just right.', 'bagStyle', 'leather', undefined, 'bag'),
  slot('crocbag', 'Croc staff bag', 16000, 'legend', 'bag', 'Bottle-green croc with gold trim. The bag of the year.', 'bagStyle', 'croc', undefined, 'bag'),
  caddieItem,
];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const KIND_NAME: Record<Kind, string> = { top: 'Tops', outer: 'Outerwear', bottoms: 'Trousers', shoes: 'Shoes', gloves: 'Gloves', hat: 'Headwear', eyewear: 'Eyewear', bling: 'Watches & jewellery', putter: 'Putters', driver: 'Drivers', bag: 'Bags', caddie: 'Service' };
export const KIND_ICON: Record<Kind, string> = { top: '👕', outer: '🧥', bottoms: '👖', shoes: '👟', gloves: '🧤', hat: '🧢', eyewear: '🕶️', bling: '⌚', putter: '⛳', driver: '🏌️', bag: '🎒', caddie: '🤵' };

// where the fitting room's camera goes for a piece: the face for hats and glasses, the hands for watches, gloves,
// putters and drivers, round the back for a bag
export function focusOf(i: Item): 'full' | 'head' | 'chest' | 'hands' | 'club' | 'bag' {
  if (i.focus) return i.focus;
  if (i.kind === 'hat' || i.kind === 'eyewear') return 'head';
  if (i.kind === 'top' || i.kind === 'outer') return 'chest';
  if (i.kind === 'putter' || i.kind === 'driver') return 'club';
  if (i.kind === 'gloves') return 'hands';
  if (i.kind === 'bag') return 'bag';
  return 'full';
}
