// The bag. Bigger clubs go farther but have a smaller sweet spot on the swing meter.
// The driver's needle also speeds up with power: a full rip is a lottery ticket.
export type ClubId = 'driver' | 'iron' | 'wedge' | 'chip' | 'putter';

export type Club = {
  id: ClubId;
  name: string;
  carry: [number, number]; // ft carried at 0% and 100% power (putter: roll speed in ft/s)
  loft: number; // degrees
  keep: number; // share of speed kept when it lands
  sweet: number; // half-width of the meter's gold zone, as a share of the bar
  curve: number; // ft/s² of sideways pull for a full mishit
  push: number; // radians the start line moves for a full mishit
  check: number; // ft/s a full backspin strike takes off the ball when it lands (enough and it spins back)
  release: number; // extra share of speed a full topspin strike keeps when it lands
  bend: number; // ft/s² of sideways pull for a full draw or fade
};

export const CLUBS: Record<ClubId, Club> = {
  driver: { id: 'driver', name: 'Driver', carry: [110, 340], loft: 15, keep: 0.22, sweet: 0.05, curve: 26, push: 0.06, check: 5, release: 0.05, bend: 28 },
  iron: { id: 'iron', name: 'Iron', carry: [50, 180], loft: 30, keep: 0.18, sweet: 0.08, curve: 20, push: 0.04, check: 12, release: 0.08, bend: 18 },
  wedge: { id: 'wedge', name: 'Wedge', carry: [8, 90], loft: 52, keep: 0.08, sweet: 0.13, curve: 8, push: 0.02, check: 15, release: 0.14, bend: 9 },
  // the chipper: a low runner that lands soft and rolls out, with a quick needle and a forgiving gold zone
  chip: { id: 'chip', name: 'Chip', carry: [3, 32], loft: 30, keep: 0.24, sweet: 0.15, curve: 6, push: 0.02, check: 4, release: 0.18, bend: 6 },
  putter: { id: 'putter', name: 'Putter', carry: [1.5, 34], loft: 0, keep: 1, sweet: 1, curve: 0, push: 0.04, check: 0, release: 0, bend: 0 },
};

export const BAG: ClubId[] = ['driver', 'iron', 'wedge', 'chip', 'putter'];

export const carryOf = (club: ClubId, power: number, boost = 1) => {
  const c = CLUBS[club].carry;
  return (c[0] + (c[1] - c[0]) * power) * boost;
};

// Drinks from the beverage cart: they tweak the next two full swings.
export type Drink = 'palmer' | 'lager' | 'water';
export const DRINKS: Record<Drink, { name: string; blurb: string; sweet: number; boost: number; needle: number }> = {
  palmer: { name: 'Arnold Palmer', blurb: 'Steadier hands. A wider sweet spot for two shots.', sweet: 1.6, boost: 1, needle: 1 },
  lager: { name: 'Clubhouse Lager', blurb: '+10% distance for two shots. The needle gets twitchy.', sweet: 1, boost: 1.1, needle: 1.35 },
  water: { name: 'Sparkling Water', blurb: 'No effect whatsoever. Reginald approves.', sweet: 1, boost: 1, needle: 1 },
};
