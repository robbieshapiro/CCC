// A chairlift that carries the ball (the Powder Bowl's Chairlift, Nov 24, Robbie): chairs run up a straight line from
// a loading station to a top station just short of the green. Roll a ball across the station just as a chair sweeps through it and the
// chair takes it up over everything and sets it down on the green. Miss the chair and it rolls on into the snow.
// One source of truth for the physics (what catches) and the scene (what you see): both read the hole clock.
import { heightAt } from './terrain';
import type { Hole, V2 } from './types';

export type Lift = {
  load: V2; // the bottom station, where a chair sweeps low enough to take a ball
  top: V2; // the top station, just short of the green
  drop: V2; // where the chair tips the ball out onto the green
  speed: number; // feet a second along the cable
  gap: number; // seconds between chairs
  pad: number; // how near the station a ball must be to be taken (feet)
  low: number; // how far up the line the chair is still low enough to take it (feet)
};

export const liftLength = (l: Lift) => Math.hypot(l.top.x - l.load.x, l.top.y - l.load.y);
const dirOf = (l: Lift) => {
  const L = liftLength(l);
  return { x: (l.top.x - l.load.x) / L, y: (l.top.y - l.load.y) / L };
};
export const along = (l: Lift, u: number): V2 => {
  const d = dirOf(l);
  return { x: l.load.x + d.x * u, y: l.load.y + d.y * u };
};

// the up-line chairs at this moment: how far each is up the line (feet), bottom first
export function chairsUp(l: Lift, clock: number): number[] {
  const L = liftLength(l);
  const space = l.speed * l.gap;
  const first = (((clock * l.speed) % space) + space) % space;
  const out: number[] = [];
  for (let u = first; u <= L; u += space) out.push(u);
  return out;
}
// the down line, coming back the other way, half a gap out of step
export function chairsDown(l: Lift, clock: number): number[] {
  const L = liftLength(l);
  return chairsUp(l, clock + l.gap / 2).map((u) => L - u);
}

// the seat's height along the line: low at both stations, up over the trees between
export const RIDE = 34;
export function seatZ(h: Hole, l: Lift, u: number): number {
  const L = liftLength(l);
  const p = along(l, u);
  const ground = heightAt(h, p.x, p.y);
  const ease = Math.min(1, u / 30, (L - u) / 24);
  return ground + 1.2 + (RIDE - 1.2) * Math.max(0, ease) ** 0.8;
}

// is a chair sweeping the station right now, close enough to take the ball?
export function catchAt(l: Lift, clock: number, p: V2): boolean {
  if (Math.hypot(p.x - l.load.x, p.y - l.load.y) > l.pad) return false;
  return chairsUp(l, clock).some((u) => u <= l.low);
}
