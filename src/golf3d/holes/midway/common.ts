// The Midway's shared bits: a tent's canvas wall as a ring of walls a ball bounces off, and the bulb poles along the lanes
import type { Post, V2, Wall } from '../../types';

// a ring of wall round a big top (or anything round), n sides
export function ring(x: number, y: number, r: number, h: number, n = 14): Wall[] {
  const pts: V2[] = Array.from({ length: n }, (_, i) => ({ x: x + Math.cos((i / n) * Math.PI * 2) * r, y: y + Math.sin((i / n) * Math.PI * 2) * r }));
  return pts.map((a, i) => ({ a, b: pts[(i + 1) % n], h, look: 'hidden' as const }));
}

// a booth's counter and back wall as a box a ball bounces off
export function boxWalls(x: number, y: number, w: number, d: number, h: number): Wall[] {
  const c: V2[] = [
    { x: x - w / 2, y: y - d / 2 },
    { x: x + w / 2, y: y - d / 2 },
    { x: x + w / 2, y: y + d / 2 },
    { x: x - w / 2, y: y + d / 2 },
  ];
  return c.map((a, i) => ({ a, b: c[(i + 1) % 4], h, look: 'hidden' as const }));
}

export const bulbs = (pts: [number, number][]): Post[] => pts.map(([x, y]) => ({ x, y, r: 0.4, h: 17, look: 'post' as const }));
