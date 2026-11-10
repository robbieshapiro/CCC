// Today's conditions on each hole: the wind and where the pin is cut. Seeded by the date, so every member
// plays the same course on the same day and the board stays fair.
import { CALDERA_START, periodOf, todayInGameTz } from '../day';
import { makeRng } from '../seed';
import type { Hole, V2 } from './types';

export type Conditions = {
  pin: V2;
  mph: number;
  toward: number; // the way it blows, radians in hole space (0 = straight up the hole, toward the green)
  accel: V2; // ft/s² it pushes a ball in flight
  gust?: number; // storm days: the wind swings by up to this share either way from shot to shot
  rain?: boolean; // storm days: it's raining (the same for every hole that day)
};

// a 10 mph wind moves a mid-iron about 13 ft over its flight
export const WIND_PER_MPH = 0.42;

export function conditionsFor(h: Hole, day: string): Conditions {
  const rng = makeRng(`${day}:${h.id}`);
  const pins = h.pins?.length ? h.pins : [h.cup];
  const pin = pins[Math.floor(rng.next() * pins.length)];
  // mostly light, sometimes properly breezy; in storm country never calm, and often blowing hard
  const storm = h.weather === 'storm';
  // Chicago in November: never less than a stiff breeze off the lake, often a proper gale, gusting shot to shot
  if (h.weather === 'gale') {
    const mph = Math.round(15 + rng.next() ** 0.8 * 15);
    const toward = rng.next() * Math.PI * 2;
    return { pin, mph, toward, accel: { x: Math.sin(toward) * mph * WIND_PER_MPH, y: Math.cos(toward) * mph * WIND_PER_MPH }, gust: 0.3 };
  }
  // exposed holes on the island: a steady 11 to 14 mph that gusts between 10 and 15 from shot to shot
  if (h.gusts && !storm) {
    const mph = 11 + Math.floor(rng.next() * 4);
    const toward = rng.next() * Math.PI * 2;
    return { pin, mph, toward, accel: { x: Math.sin(toward) * mph * WIND_PER_MPH, y: Math.cos(toward) * mph * WIND_PER_MPH }, gust: 0.08 };
  }
  const mph = storm ? Math.round(8 + rng.next() ** 0.9 * 18) : Math.round(rng.next() ** 1.4 * 16);
  const toward = rng.next() * Math.PI * 2;
  const accel = { x: Math.sin(toward) * mph * WIND_PER_MPH, y: Math.cos(toward) * mph * WIND_PER_MPH };
  if (!storm) return { pin, mph, toward, accel };
  // rain is the day's, not the hole's: it rains on the whole course or none of it
  return { pin, mph, toward, accel, gust: 0.35, rain: makeRng(`${day}:rain`).next() < 0.45 };
}

// The wind for one shot: on a gusting day it swings either side of the day's number. r in [0, 1).
export function gusted(c: Conditions, r: number): Conditions {
  if (!c.gust) return c;
  const k = 1 + (r * 2 - 1) * c.gust;
  return { ...c, mph: Math.round(c.mph * k), accel: { x: c.accel.x * k, y: c.accel.y * k } };
}

// The hole as played today: the pin moved to today's spot, and wet if it's raining.
export const withPin = (h: Hole, c: Conditions): Hole => ({ ...h, cup: c.pin, ...(c.rain ? { wet: true } : {}) });

// The Caldera challenge's last days: a storm rolls over the volcano. Looks and sounds only (the sky, rain, lightning,
// thunder). It cleared on Nov 6, two days early: sunny daylight for the finish.
const TEMPEST_ENDS = '2026-11-06';
export const tempestOn = (h: Hole, day = todayInGameTz()) => h.theme === 'volcanic' && periodOf(day) === CALDERA_START && day < TEMPEST_ENDS;
