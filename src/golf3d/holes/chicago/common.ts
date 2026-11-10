// The Windy City's shared settings: late-fall turf as thick as the Western Reserve's, and kinder greens.
import type { Hole, Piece } from '../../types';
import { greenComplex, type GreenSpec } from '../woods';

// Late-fall turf, as thick as the Western Reserve's: the rough stops a landing ball, a full club gets about 84% out of
// it and can come off the face anywhere; the fairways run firm, the greens a touch slower than tour pace
export const CHI_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.24, roughDrag: 1.6, roughLie: 0.84, roughScatter: 0.2, fairwayRoll: 0.9, greenRoll: 1.06, sandLie: 0.75, sandScatter: 0.3 };

// A Windy City green: mostly flat, a gentle tilt and one or two soft rolls so there's some break to read
export const chiGreen = (g: GreenSpec, base: number, tilt: [number, number], rolls: [number, number, number, number][] = []): Piece[] =>
  greenComplex(g, base, { lift: 1, edge: 9, tilt, rolls });
