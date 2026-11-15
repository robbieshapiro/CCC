// The Atlantic Links: what its three holes share. Firm, running fairways, wiry fescue rough that grabs a landing ball
// and takes a little off the next swing, and small deep pots of heavy sand.
import type { Hole, Post } from '../../types';
import { bunker } from '../woods';

export const LINKS_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.4, roughDrag: 1.25, roughLie: 0.86, roughScatter: 0.18, fairwayRoll: 0.85, sandLie: 0.75, sandScatter: 0.3 };

// a pot bunker: small, round and deep
export const pot = (x: number, y: number, r: number, seed: number) => bunker(x, y, r, r * 0.88, seed, 3.4, seed * 0.7);

// gorse in flower: low and soft, a ball goes through it knocked about
export const gorse = (at: [number, number][]): Post[] => at.map(([x, y], i) => ({ x, y, r: 2.2 + (i % 3) * 0.4, h: 3, soft: true, look: 'gorse' as const }));

// dunes: humps of rough either side of a hole
export const dunes = (at: [number, number, number, number][]) => at.map(([x, y, r, h]) => ({ kind: 'hill' as const, x, y, r, h }));
