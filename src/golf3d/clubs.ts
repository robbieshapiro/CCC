// The bag. Bigger clubs go farther but have a smaller sweet spot on the swing meter.
export type ClubId = 'driver' | 'iron' | 'wedge' | 'putter';

export type Club = {
  id: ClubId;
  name: string;
  carry: [number, number]; // ft carried at 0% and 100% power (putter: roll speed in ft/s)
  loft: number; // degrees
  keep: number; // share of speed kept when it lands
  sweet: number; // half-width of the meter's gold zone, as a share of the bar
  curve: number; // ft/s² of sideways pull for a full mishit
  push: number; // radians the start line moves for a full mishit
};

export const CLUBS: Record<ClubId, Club> = {
  driver: { id: 'driver', name: 'Driver', carry: [100, 280], loft: 15, keep: 0.22, sweet: 0.06, curve: 26, push: 0.06 },
  iron: { id: 'iron', name: 'Iron', carry: [50, 180], loft: 30, keep: 0.18, sweet: 0.1, curve: 20, push: 0.04 },
  wedge: { id: 'wedge', name: 'Wedge', carry: [8, 90], loft: 52, keep: 0.08, sweet: 0.16, curve: 8, push: 0.02 },
  putter: { id: 'putter', name: 'Putter', carry: [1.5, 34], loft: 0, keep: 1, sweet: 1, curve: 0, push: 0 },
};

export const BAG: ClubId[] = ['driver', 'iron', 'wedge', 'putter'];

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
