// Where the swing meter is at any moment, worked out from the time since its phase began.
//
// Until Nov 11 the meter moved once a frame and a tap read wherever the last frame had left it. The pure strip on a
// full driver is about 14 ms wide and a 60 Hz frame is 16.7 ms, so the needle could step clean over it, a 120 Hz
// phone got an easier game, and a phone running under 20 fps ran the meter in slow motion. Now a tap reads the meter at
// the moment it happened (the event's own timestamp), and each frame just draws the same function. The rates and
// windows are all still in swing.ts, unchanged.
import type { ClubId } from './clubs';
import { fromMeter, OVERSWING, powerSpeed, stretched, stretchRate } from './swing';

// the power bar fills faster toward the top, so it's stepped in thin slices of time (a millisecond) rather than once a
// frame: the same reading whatever the phone's refresh rate
const STEP = 0.001;
const LONGEST = 30; // seconds: far past the top of any bar

// The power bar `t` seconds after the swing started. `speed` is the drink's needle factor; `boosted`: a lager or a
// fireball, whose fire (the overswing) the bar slows right down in so you can stop it there. `top`: it reached the
// end of the overswing untapped.
export function powerAt(club: ClubId, speed: number, boosted: boolean, t: number): { p: number; d: number; top: boolean } {
  let p = 0;
  let d = 0;
  let left = Math.min(LONGEST, Math.max(0, t));
  while (left > 0) {
    const dt = Math.min(STEP, left);
    left -= dt;
    const fire = boosted && p > 1 ? 0.45 : 1;
    // the chipper and the wedge climb their stretched scale at a steady pace (see meterPos); the rest fill by power
    if (stretched(club)) {
      d = Math.min(OVERSWING, d + stretchRate(club) * speed * fire * dt);
      p = d >= OVERSWING ? OVERSWING : fromMeter(club, d);
    } else p = Math.min(OVERSWING, p + powerSpeed(club, p) * speed * fire * dt);
    if (p >= OVERSWING) return { p: OVERSWING, d, top: true };
  }
  return { p, d, top: false };
}

// The needle on its way back for the accuracy tap, `t` seconds after power was set: from `x0` toward the impact point
// at `speed` bar-lengths a second, stopping at `end` (gone right past: a full hook).
export function needleAt(x0: number, speed: number, end: number, t: number): { x: number; past: boolean } {
  const x = x0 - speed * Math.max(0, t);
  return x <= end ? { x: end, past: true } : { x, past: false };
}
