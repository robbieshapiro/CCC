import type { ClubId } from './clubs';

// Course data. Units are feet; x is left/right, y runs away from the tee, height is up.
export type V2 = { x: number; y: number };
export type Surface = 'green' | 'fairway' | 'fringe' | 'rough' | 'path' | 'stone' | 'wood' | 'sand' | 'rock' | 'cinder';

// Terrain pieces combine in order: 'add' adds height, 'set' blends toward a target height.
export type Piece =
  | { kind: 'tilt'; gx: number; gy: number; op?: 'add' }
  | { kind: 'hill'; x: number; y: number; r: number; h: number; op?: 'add' | 'set' }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number; h: number; edge: number; op: 'add' | 'set' }
  | { kind: 'disc'; x: number; y: number; r: number; h: number; edge: number; op: 'add' | 'set' }
  | { kind: 'ramp'; x0: number; y0: number; x1: number; y1: number; axis: 'x' | 'y'; h0: number; h1: number; op: 'add' | 'set'; steps?: number }
  | { kind: 'channel'; pts: V2[]; width: number; depth: number; taper?: number } // taper: ft over which the far end fades out
  // a raised bed along a line (a road or a causeway): heights at each point, flat for `width` either side, then `edge` of bank
  // wobble: ft the width wanders in and out, so a coastline isn't ruler-straight
  | { kind: 'embankment'; pts: V2[]; h: number[]; width: number; edge: number; wobble?: number };

export type Wall = { a: V2; b: V2; h: number; look?: 'hedge' | 'stone' | 'wood' | 'rail' | 'cart' | 'iron' | 'crypt' | 'blade' | 'teeth' };
export type Post = { x: number; y: number; r: number; h: number; e?: number; look?: 'pine' | 'post' | 'wicket' | 'croquet' | 'column' | 'tree' | 'oak' | 'cypress' | 'rock' | 'palm' | 'tomb' | 'deadtree' | 'cauldron' | 'ghost' | 'cactus' | 'gorse' };
export type Region = { poly: V2[]; surface: Surface };
// A lake or creek: its outline and the flat height of its surface. Ground inside that sits under the surface is wet.
// The sea can run a tide and lava can pulse: the level swings by `amp` either way over `period` seconds of the hole clock.
export type Water = { poly: V2[]; level: number; look?: 'lake' | 'sea' | 'lava' | 'slime'; tide?: { amp: number; period: number } };
export type Zone = { id: string; poly: V2[] };

// Things that move on the hole clock. `at(t)` returns their collision shapes at time t.
export type Mover = { id: string; look: 'swan' | 'cart' | 'scythe' | 'ghost' | 'jaw'; at: (t: number) => { walls: Wall[]; posts: Post[]; pos: V2; heading: number; open?: number } };
// `erupt` (geysers and blowholes): while it returns a velocity, a ball rolling over the vent is thrown with it.
export type Push = {
  id: string;
  look: 'sprinkler' | 'fountain' | 'geyser' | 'blowhole' | 'brew';
  x: number;
  y: number;
  r: number;
  at: (t: number) => V2;
  erupt?: (t: number) => { x: number; y: number; z: number } | null;
};

export type Decor = { kind: string; x: number; y: number; rot?: number; scale?: number; color?: string; label?: string };

export type Hole = {
  id: string;
  name: string;
  par: number;
  tee: V2;
  cup: V2;
  pins?: V2[]; // where the pin can be cut; one is picked each day
  greenFirm?: number; // extra speed a ball keeps landing on this green: hold it with backspin
  maxTime?: number; // seconds a shot may run before the physics calls it (default 24): long roads need longer
  tour?: boolean; // tour greens: quicker, a smaller cup, and a putt has to be dying to drop
  noCart?: boolean; // nowhere for the beverage cart to drive up (a tee on a crater rim, or an island in the sky)
  theme?: 'highland' | 'volcanic' | 'haunted' | 'links' | 'desert';
  putterOnly?: boolean; // mini golf: the putter is the only club
  flag?: string; // what the pin's flag says, if not the hole number
  aim: number; // initial aim angle (radians, 0 = straight up the hole)
  bounds: { x0: number; y0: number; x1: number; y1: number };
  border: V2[]; // closed outline, edged with a low curb
  base: Surface;
  regions: Region[]; // later entries win
  water: Water[];
  terrain: Piece[];
  walls: Wall[];
  posts: Post[];
  movers: Mover[];
  pushes: Push[];
  roofs?: { poly: V2[]; h: number }[]; // a ball that comes down on one is lost (penalty)
  ceilings?: { poly: V2[]; h: number }[]; // a cave roof this far above the ground: a ball that rises into it clips it and drops
  // a hole in the rock: a ball that rolls into it drops down a tunnel and comes out at `to` a moment later, at rest
  portals?: { id: string; x: number; y: number; r: number; to: V2; delay?: number }[];
  zones: Zone[]; // used to detect secret routes and feats
  secret: { name: string; zone: string; hint: string };
  // a drop zone, as on an island green: a ball in the hazard is dropped here if that's nearer the hole than where it went in
  drop?: V2;
  flyover: V2[]; // camera path for the intro
  decor: Decor[];
};

// error: -1..1 from the swing meter (0 is pure). boost scales carry (drinks).
// spin: -1 topspin .. 1 backspin. shape: -1 draw (bends left) .. 1 fade (bends right). wind: ft/s² while airborne.
export type Shot = { angle: number; power: number; club: ClubId; error: number; clock: number; boost?: number; spin?: number; shape?: number; wind?: V2 };
