// Today's conditions on each hole: the wind and where the pin is cut. Seeded by the date, so every member
// plays the same course on the same day and the board stays fair.
import { makeRng } from '../seed';
import type { Hole, V2 } from './types';

export type Conditions = {
  pin: V2;
  mph: number;
  toward: number; // the way it blows, radians in hole space (0 = straight up the hole, toward the green)
  accel: V2; // ft/s² it pushes a ball in flight
};

// a 10 mph wind moves a mid-iron about 13 ft over its flight
export const WIND_PER_MPH = 0.42;

export function conditionsFor(h: Hole, day: string): Conditions {
  const rng = makeRng(`${day}:${h.id}`);
  const pins = h.pins?.length ? h.pins : [h.cup];
  const pin = pins[Math.floor(rng.next() * pins.length)];
  // mostly light, sometimes properly breezy
  const mph = Math.round(rng.next() ** 1.4 * 16);
  const toward = rng.next() * Math.PI * 2;
  const accel = { x: Math.sin(toward) * mph * WIND_PER_MPH, y: Math.cos(toward) * mph * WIND_PER_MPH };
  return { pin, mph, toward, accel };
}

// The hole as played today: the pin moved to today's spot.
export const withPin = (h: Hole, c: Conditions): Hole => ({ ...h, cup: c.pin });
