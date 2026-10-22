import type { ClubId } from './clubs';

// Course data. Units are feet; x is left/right, y runs away from the tee, height is up.
export type V2 = { x: number; y: number };
export type Surface = 'green' | 'fairway' | 'fringe' | 'rough' | 'path' | 'stone' | 'wood' | 'sand';

// Terrain pieces combine in order: 'add' adds height, 'set' blends toward a target height.
export type Piece =
  | { kind: 'tilt'; gx: number; gy: number; op?: 'add' }
  | { kind: 'hill'; x: number; y: number; r: number; h: number; op?: 'add' | 'set' }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number; h: number; edge: number; op: 'add' | 'set' }
  | { kind: 'disc'; x: number; y: number; r: number; h: number; edge: number; op: 'add' | 'set' }
  | { kind: 'ramp'; x0: number; y0: number; x1: number; y1: number; axis: 'x' | 'y'; h0: number; h1: number; op: 'add' | 'set'; steps?: number }
  | { kind: 'channel'; pts: V2[]; width: number; depth: number };

export type Wall = { a: V2; b: V2; h: number; look?: 'hedge' | 'stone' | 'wood' | 'rail' | 'cart' };
export type Post = { x: number; y: number; r: number; h: number; e?: number; look?: 'pine' | 'post' | 'wicket' | 'croquet' | 'column' | 'tree' | 'oak' | 'cypress' };
export type Region = { poly: V2[]; surface: Surface };
export type Zone = { id: string; poly: V2[] };

// Things that move on the hole clock. `at(t)` returns their collision shapes at time t.
export type Mover = { id: string; look: 'swan' | 'cart'; at: (t: number) => { walls: Wall[]; posts: Post[]; pos: V2; heading: number } };
export type Push = { id: string; look: 'sprinkler' | 'fountain'; x: number; y: number; r: number; at: (t: number) => V2 };

export type Decor = { kind: string; x: number; y: number; rot?: number; scale?: number; color?: string };

export type Hole = {
  id: string;
  name: string;
  par: number;
  tee: V2;
  cup: V2;
  aim: number; // initial aim angle (radians, 0 = straight up the hole)
  bounds: { x0: number; y0: number; x1: number; y1: number };
  border: V2[]; // closed outline, edged with a low curb
  base: Surface;
  regions: Region[]; // later entries win
  water: V2[][];
  dry: V2[][]; // land that overrides water (islands, bridges)
  terrain: Piece[];
  walls: Wall[];
  posts: Post[];
  movers: Mover[];
  pushes: Push[];
  roofs?: { poly: V2[]; h: number }[]; // a ball that comes down on one is lost (penalty)
  zones: Zone[]; // used to detect secret routes and feats
  secret: { name: string; zone: string; hint: string };
  flyover: V2[]; // camera path for the intro
  decor: Decor[];
};

// error: -1..1 from the swing meter (0 is pure). boost scales carry (drinks).
export type Shot = { angle: number; power: number; club: ClubId; error: number; clock: number; boost?: number };
