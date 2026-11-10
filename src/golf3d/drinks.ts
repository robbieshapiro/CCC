// What the cart and Reginald's tray pour, by course. The effects are the same everywhere (see DRINKS in clubs.ts: a
// slower meter, a little more distance, a quick needle with wide gold, steady hands, nothing, a late-cart shot); each
// course names them after where it is, so the Windy City pours Malört and the Highlands a dram.
import { DRINKS, type Drink } from './clubs';
import type { Hole } from './types';

type Pour = { name: string; colour: string; note?: string };
type Menu = Record<Drink, Pour>;

const CLUBHOUSE: Menu = {
  palmer: { name: 'Arnold Palmer', colour: '#c98a3a' },
  lager: { name: 'Clubhouse Lager', colour: '#e8c86a' },
  espresso: { name: 'Espresso', colour: '#3b2418' },
  transfusion: { name: 'Transfusion', colour: '#8e2f4a' },
  water: { name: 'Sparkling Water', colour: '#bfe3ec' },
  fireball: { name: 'Fireball', colour: '#c4361b' },
};

const MENUS: Record<string, Menu> = {
  highlands: {
    palmer: { name: 'Tea and shortbread', colour: '#b9773a', note: 'Calming' },
    lager: { name: 'A pint of heavy', colour: '#7a3f1c' },
    espresso: { name: 'Builder’s tea, strong', colour: '#5a3a22' },
    transfusion: { name: 'Hot toddy', colour: '#c98a3a' },
    water: { name: 'Burn water', colour: '#cfe6ea', note: 'Straight off the hill' },
    fireball: { name: 'A wee dram', colour: '#b5651d', note: 'Peaty' },
  },
  volcanic: {
    palmer: { name: 'Coconut water', colour: '#f2efe4' },
    lager: { name: 'Island lager', colour: '#e8c86a' },
    espresso: { name: 'Kona coffee', colour: '#3b2418' },
    transfusion: { name: 'Mai tai', colour: '#d9772b' },
    water: { name: 'Spring water', colour: '#bfe3ec' },
    fireball: { name: 'Lava shot', colour: '#c4361b', note: 'Cinnamon' },
  },
  autumn: {
    palmer: { name: 'Hot cider', colour: '#b5651d' },
    lager: { name: 'Lake Erie lager', colour: '#e1b84f' },
    espresso: { name: 'Diner coffee', colour: '#3b2418', note: 'Bottomless' },
    transfusion: { name: 'Pumpkin spice latte', colour: '#d08a45' },
    water: { name: 'Well water', colour: '#cfe6ea' },
    fireball: { name: 'Apple pie moonshine', colour: '#e9d29a' },
  },
  coastal: {
    palmer: { name: 'Meyer lemonade', colour: '#f2e27a' },
    lager: { name: 'West Coast IPA', colour: '#d9a441' },
    espresso: { name: 'Cortado', colour: '#6b4429' },
    transfusion: { name: 'Glass of cab', colour: '#5e1a2c' },
    water: { name: 'Sparkling water', colour: '#bfe3ec' },
    fireball: { name: 'Mezcal shot', colour: '#e8e2c8', note: 'Smoky' },
  },
  chicago: {
    palmer: { name: 'Italian beef, dipped', colour: '#8a5a33', note: 'Heavy. Slows you right down' },
    lager: { name: 'Old Style tallboy', colour: '#e1b84f' },
    espresso: { name: 'Cold brew', colour: '#2e1c12' },
    transfusion: { name: 'The glizzy', colour: '#d23b2a', note: 'A Chicago dog. No ketchup' },
    water: { name: 'Lake Michigan tap', colour: '#9fd0e6' },
    fireball: { name: 'Malört shot', colour: '#e6d77a', note: 'Tastes like regret' },
  },
};

// the Highlands holes predate themes, so they're named here
const HIGHLANDS = new Set(['summit', 'island', 'ridge']);
const menuOf = (h: Hole | null | undefined): Menu => {
  const t = (h?.theme ?? '').split('@')[0];
  return MENUS[t] ?? (h && HIGHLANDS.has(h.id) ? MENUS.highlands : CLUBHOUSE);
};

// a drink as this hole's course pours it: its name, what it does, and its colour on the tray
export function pour(kind: Drink, h: Hole | null | undefined) {
  const p = menuOf(h)[kind];
  return { name: p.name, colour: p.colour, blurb: p.note ? `${p.note} · ${DRINKS[kind].blurb}` : DRINKS[kind].blurb };
}
