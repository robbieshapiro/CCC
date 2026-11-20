// A member's world (Nov 20): the place their course is set in, as the architect (api/design.ts) imagines it. It's
// data only: the sky, the light, the colours of the ground, what the water is, what drifts in the air, the trees,
// the landmarks and what lies beyond, chosen from everything the club's own courses have been built with. So a
// member can ask for a moonbase, a candy land or a jungle temple and get it, and nothing in it can break the game:
// it changes how the course looks, never how it plays. src/golf3d/looks/member.ts turns it into a look kit.

export const TREES = [
  'pine', 'oak', 'maple', 'palm', 'sabal', 'cypress', 'monterey', 'torrey', 'snowpine', 'tree',
  'cactus', 'gorse', 'rock', 'hoodoo', 'deadtree', 'tomb', 'streetlight', 'column',
] as const;
export const LANDMARKS = [
  'lodge', 'lighthouse', 'ruin', 'barn', 'silo', 'farmhouse', 'falls', 'cider', 'haybale', 'pumpkins', 'corn',
  'sheep', 'cow', 'gator', 'egret', 'sealions', 'bigtop', 'booth', 'ferris', 'lantern', 'mausoleum', 'bigpumpkin',
  'candles', 'crow', 'poppies', 'iceplant', 'azalea', 'fountain', 'craftsman', 'umbrella', 'flagpole',
] as const;
export const BACKDROPS = ['none', 'mountains', 'mesas', 'skyline', 'swamp', 'dunes', 'carnival'] as const;
export const DRIFTS = ['none', 'snow', 'leaves', 'petals', 'embers', 'ash', 'confetti', 'fireflies', 'bubbles'] as const;
export const LIGHTS = ['day', 'golden', 'dusk', 'night', 'overcast'] as const;
export const WATERS = ['water', 'lava', 'slime'] as const;

export type Tree = (typeof TREES)[number];
export type Landmark = { kind: (typeof LANDMARKS)[number]; hole: number; along: number; across: number };
export type World = {
  name: string;
  light: (typeof LIGHTS)[number];
  sky: [string, string, string]; // overhead, middle, horizon
  ground: { fairway: string; green: string; rough: string; sand: string; beyond: string };
  water: { kind: (typeof WATERS)[number]; color: string };
  coast: boolean; // the sea can run down a side of a hole
  drift: (typeof DRIFTS)[number];
  trees: Tree[];
  landmarks: Landmark[];
  backdrop: (typeof BACKDROPS)[number];
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : d);
const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);

// Whatever came back, made safe. Greens and fairways must read as somewhere to play: too dark and they're lifted.
export function tidyWorld(raw: Partial<World> | null | undefined): World | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const sky = Array.isArray(raw.sky) ? raw.sky : [];
  const g = (raw.ground ?? {}) as Partial<World['ground']>;
  const trees = (Array.isArray(raw.trees) ? raw.trees : []).filter((t): t is Tree => TREES.includes(t as Tree)).slice(0, 4);
  return {
    name: String(raw.name ?? 'A world of its own').replace(/[^\p{L}\p{N} '’.,&!?-]/gu, '').slice(0, 30).trim() || 'A world of its own',
    light: pick(raw.light, LIGHTS, 'day'),
    sky: [hex(sky[0], '#3f74b5'), hex(sky[1], '#9cc2e2'), hex(sky[2], '#e8e1d2')],
    ground: {
      fairway: readable(hex(g.fairway, '#62ae52')),
      green: readable(hex(g.green, '#6fc062')),
      rough: hex(g.rough, '#3e6a31'),
      sand: hex(g.sand, '#ead9a6'),
      beyond: hex(g.beyond, '#2c4a26'),
    },
    water: { kind: pick(raw.water?.kind, WATERS, 'water'), color: hex(raw.water?.color, '#3a6f80') },
    coast: !!raw.coast,
    drift: pick(raw.drift, DRIFTS, 'none'),
    trees: trees.length ? trees : ['pine', 'oak'],
    landmarks: (Array.isArray(raw.landmarks) ? raw.landmarks : [])
      .filter((l) => LANDMARKS.includes(l?.kind as Landmark['kind']))
      .slice(0, 12)
      .map((l) => ({ kind: l.kind, hole: Math.round(clamp(l.hole, 1, 3)), along: clamp(l.along, 0, 1.1), across: clamp(l.across, -3.5, 3.5) })),
    backdrop: pick(raw.backdrop, BACKDROPS, 'none'),
  };
}

// a colour light enough to read as turf (anything darker is lifted toward it)
function readable(c: string) {
  const n = parseInt(c.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum >= 70) return c;
  const k = 70 / Math.max(1, lum);
  const f = (v: number) => Math.min(255, Math.round(v * k + 20)).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

// a short stable key for a world, so the same world is built once
export function worldKey(w: World) {
  const s = JSON.stringify(w);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `member:${(h >>> 0).toString(36)}`;
}
