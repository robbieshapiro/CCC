// The Midway: Eli's game at the bar. Three short carnival holes out the back of the Nineteenth Hole, one counting round
// a day, the best of the week on the board (see bar.ts). Power-ups and curses come next.
import { bigtop } from './holes/midway/bigtop';
import { duckpond } from './holes/midway/duckpond';
import { thelane } from './holes/midway/thelane';
import type { Hole } from './types';

export const MIDWAY: Hole[] = [bigtop, thelane, duckpond];
export const MIDWAY_PAR = MIDWAY.reduce((a, h) => a + h.par, 0);
