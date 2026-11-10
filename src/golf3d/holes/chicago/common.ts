// The Windy City's shared settings: November turf and greens that are kinder than the Western Reserve's.
import type { Hole, Piece } from '../../types';
import { greenComplex, type GreenSpec } from '../woods';

// Dormant November turf with snow in the rough: the rough holds a landing ball and costs some distance, the fairways
// run firm, the greens run a touch slower than tour pace, and the bunker sand is half frozen
export const CHI_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.3, roughDrag: 1.4, roughLie: 0.86, roughScatter: 0.15, fairwayRoll: 0.9, greenRoll: 1.06, sandLie: 0.8, sandScatter: 0.25 };

// A Windy City green: mostly flat, a gentle tilt and one or two soft rolls so there's some break to read
export const chiGreen = (g: GreenSpec, base: number, tilt: [number, number], rolls: [number, number, number, number][] = []): Piece[] =>
  greenComplex(g, base, { lift: 1, edge: 9, tilt, rolls });
