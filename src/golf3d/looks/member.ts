// A member's world, drawn (Nov 20): the world the architect imagined (src/designer/world.ts) made into a look kit.
// The sky, light and ground are the member's own colours; the trees, the landmarks and what lies beyond borrow from
// the club's courses (the Alps' firs and lodge, the canyon's hoodoos and mesas, Florida's sabals and gators, the
// links' ruins and sheep, the carnival's big top, the city's skyline), so any world can mix any of them.
import type { Kit } from '../kits';
import type { World } from '../../designer/world';
import { alpine } from './alpine';
import { canyon } from './canyon';
import { carnival } from './carnival';
import { city } from './city';
import { florida } from './florida';
import { linksland } from './linksland';
import { chicago } from './chicago';

// the light for each time of day: the sky's own colours set the sun and the haze
const LIGHT: Record<World['light'], { hemi: number; sun: number; sunAt: [number, number, number]; near: number; far: number; env: number }> = {
  day: { hemi: 1.25, sun: 2.6, sunAt: [-900, 700, 900], near: 600, far: 2300, env: 1 },
  golden: { hemi: 1.3, sun: 2.8, sunAt: [-1200, 260, 800], near: 600, far: 2200, env: 1 },
  dusk: { hemi: 1.25, sun: 1.8, sunAt: [-1200, 120, -900], near: 500, far: 2000, env: 0.8 },
  night: { hemi: 1.25, sun: 1.0, sunAt: [-700, 520, 1200], near: 500, far: 2000, env: 0.4 },
  overcast: { hemi: 1.45, sun: 1.5, sunAt: [-900, 600, 1100], near: 380, far: 1500, env: 0.8 },
};

const DRIFT: Record<Exclude<World['drift'], 'none'>, NonNullable<Kit['drift']>> = {
  snow: { colors: ['#ffffff', '#eef4fb'], size: 0.35, fall: 1.4, count: 220 },
  leaves: { colors: ['#c8641e', '#e0a12a', '#a83a22', '#d9822b'], size: 0.4, fall: 2.2, count: 140 },
  petals: { colors: ['#ffc6d9', '#ffe1ea', '#f7a8c4'], size: 0.3, fall: 1.2, count: 180 },
  embers: { colors: ['#ff7a1c', '#ffb347', '#ff4a12'], size: 0.25, fall: -0.8, count: 160 },
  ash: { colors: ['#9a9590', '#6f6a66', '#c2bdb6'], size: 0.3, fall: 1.0, count: 180 },
  confetti: { colors: ['#ff4f7a', '#ffd23f', '#3fc1ff', '#7cff6b', '#b56bff'], size: 0.35, fall: 1.8, count: 200 },
  fireflies: { colors: ['#f4ff8a', '#ffe66a'], size: 0.3, fall: -0.2, count: 120 },
  bubbles: { colors: ['#d8f6ff', '#bfeaff'], size: 0.4, fall: -1.0, count: 140 },
};

// the trees and landmarks only one course's kit knows how to draw (the rest are drawn by the scene for any hole)
const POSTS: Record<string, Kit> = { snowpine: alpine, hoodoo: canyon, sabal: florida, streetlight: city };
const DECOR: Record<string, Kit> = { lodge: alpine, gator: florida, egret: florida, ruin: linksland, sheep: linksland, cow: linksland, bigtop: carnival, booth: carnival, ferris: chicago };
const BEYOND: Partial<Record<World['backdrop'], Kit>> = { mountains: alpine, mesas: canyon, skyline: city, swamp: florida, dunes: linksland, carnival };

const mix = (a: string, b: string, k: number) => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
};

export function memberKit(w: World): Kit {
  const L = LIGHT[w.light];
  const [top, mid, low] = w.sky;
  const night = w.light === 'night';
  // a very pale horizon (cherry blossom, a snowfield) lit at full strength washes the course out: light it less
  const lum = (c: string) => { const n = parseInt(c.slice(1), 16); return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  const pale = !night && lum(low) > 215;
  return {
    surface: { fairway: w.ground.fairway, green: w.ground.green, fringe: mix(w.ground.fairway, w.ground.green, 0.5), rough: w.ground.rough, sand: w.ground.sand },
    floor: w.ground.beyond,
    lake: w.water.color,
    sea: w.water.kind === 'water' ? w.water.color : undefined,
    drift: w.drift === 'none' ? undefined : DRIFT[w.drift],
    light: {
      // night is moonlight, bright enough to read the course: the sky's horizon colour tints the light and the haze
      sky: night ? mix(mid, '#c4d2ee', 0.7) : pale ? mix(mid, '#ffffff', 0.2) : mix(low, '#ffffff', 0.4),
      ground: night ? '#4a5068' : mix(w.ground.rough, '#000000', 0.2),
      hemi: night ? 1.7 : pale ? 1.05 : L.hemi,
      sunColor: night ? '#c4d2ee' : w.light === 'golden' || w.light === 'dusk' ? mix(low, '#ffd59a', 0.5) : '#fff1d6',
      sun: night ? 1.4 : L.sun,
      fog: night ? mix(low, '#24304a', 0.5) : low,
      near: L.near,
      far: L.far,
      env: L.env,
    },
    skyColors: [top, mid, low],
    sun: w.light === 'overcast' ? undefined : { color: night ? '#eef0f6' : '#fff1d0', at: L.sunAt, size: night ? 34 : 44, glow: night ? '#9fb2d8' : mix(low, '#ffffff', 0.3) },
    clouds: w.light === 'day' || w.light === 'golden' || w.light === 'overcast',
    stars: night,
    post(h, p, anim) {
      const k = POSTS[p.look ?? ''];
      return k?.post?.(h, p, anim) ?? null;
    },
    decor(h, d, anim) {
      const k = DECOR[d.kind];
      return k?.decor?.(h, d, anim) ?? null;
    },
    frame(h, root, anim, floor) {
      // the backdrops were made for full-length holes: on a short one (a Daily Shot par 3) their peaks and towers stood
      // right behind the green. Whatever they put out past the grounds goes further back, so it reads as a skyline on any hole.
      const before = root.children.length;
      BEYOND[w.backdrop]?.frame?.(h, root, anim, floor);
      const cx = (h.bounds.x0 + h.bounds.x1) / 2;
      const cz = -(h.bounds.y0 + h.bounds.y1) / 2;
      const span = Math.max(h.bounds.x1 - h.bounds.x0, h.bounds.y1 - h.bounds.y0);
      const push = span < 700 ? 450 : span < 1100 ? 250 : 0; // ft further out
      if (push)
        for (const o of root.children.slice(before)) {
          const dx = o.position.x - cx;
          const dz = o.position.z - cz;
          const d = Math.hypot(dx, dz);
          if (d < 140) continue;
          o.position.x = cx + (dx / d) * (d + push);
          o.position.z = cz + (dz / d) * (d + push);
        }
    },
  };
}
