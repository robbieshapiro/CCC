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

// bounce: share of the pace into it a ball keeps (0.72 usually; the hole's wallBounce if set)
export type Wall = { a: V2; b: V2; h: number; bounce?: number; look?: 'hedge' | 'stone' | 'wood' | 'rail' | 'cart' | 'iron' | 'crypt' | 'blade' | 'teeth' | 'barn' | 'hidden' };
// soft: a tree crown. A ball flies through it, slowed and knocked about, and now and then it's caught and drops; only
// the trunk (the lowest few feet) is solid.
export type Post = { x: number; y: number; r: number; h: number; e?: number; soft?: boolean; look?: 'pine' | 'post' | 'wicket' | 'croquet' | 'column' | 'tree' | 'oak' | 'cypress' | 'rock' | 'palm' | 'tomb' | 'deadtree' | 'cauldron' | 'ghost' | 'cactus' | 'gorse' | 'maple' | 'monterey' | 'torrey' | 'lighthouse' | 'sabal' | 'cypressknee' | 'snowpine' | 'hoodoo' | 'tower' | 'streetlight' };
// foot: where a ball that lands on it comes down, on a hole whose roofs give the ball back (else the nearest wall's foot)
export type Roof = { poly: V2[]; h: number; top?: number; foot?: V2 };
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

// size: width, depth and height, for things built to measure (a building)
export type Decor = { kind: string; x: number; y: number; rot?: number; scale?: number; color?: string; label?: string; size?: [number, number, number] };

export type Hole = {
  id: string;
  name: string;
  par: number;
  tee: V2;
  cup: V2;
  pins?: V2[]; // where the pin can be cut; one is picked each day
  // the Committee's dials (src/golf3d/tweaks.ts): the pin spots left in the rotation, the most the wind may blow, and
  // the time of day the hole is held at
  pinsOn?: number[];
  windCap?: number;
  time?: 'day' | 'night';
  cupEase?: number; // tour holes: how much firmer than usual any ball can be going and still drop (1.2: a fifth)
  chipRoll?: number; // share of its usual pace a chip keeps when it lands (under 1: it runs out less)
  chipDrop?: number; // tour holes: share of the usual speed a shot from off the green can drop at, so a chip must die at the hole
  greenFirm?: number; // extra speed a ball keeps landing on this green: hold it with backspin
  express?: { x: number; y: number; r: number; to: V2 };
  cupScale?: number; // the cup's size against the usual (the Midway's Lid curse: 0.5) // the Midway: the Express Lane's circle, and where it sends a tee shot
  wallBounce?: number; // how lively this hole's walls are (0.72 usually): a city's stone and glass give a ball back more
  // Tougher turf (the Western Reserve). roughKeep: share of its pace a ball keeps landing in the rough (the usual is
  // 0.58). roughDrag: how much harder the rough grabs a rolling ball. roughLie: share of the distance a full club gets
  // out of it. roughScatter: how far a shot from it can come off the face, either way (as swing error). fairwayRoll:
  // fairway friction against the usual tour fairway's (under 1 runs further). sandLie: share of the distance a wedge
  // gets out of a bunker (an iron gets less still); sandScatter: how far off the face a bunker shot can come.
  // greenRoll: green friction against the usual tour green's (under 1 is quicker).
  turf?: { roughKeep: number; roughDrag: number; roughLie: number; roughScatter: number; fairwayRoll: number; greenRoll?: number; sandLie: number; sandScatter: number };
  windByHeight?: boolean; // wind scales with how high a shot climbs (none below 3 ft of apex, all of it from 23 ft), on its first flight only
  gusts?: boolean; // an exposed hole: a 10 to 15 mph wind every day, gusting from shot to shot (see conditions.ts)
  weather?: 'storm' | 'gale'; // autumn storms: a stronger, gusting wind, and rain on some days. gale: Chicago in November, 15 to 30 mph off the lake, gusting (see conditions.ts)
  wet?: boolean; // raining today: greens and fairways run a little slower
  maxTime?: number; // seconds a shot may run before the physics calls it (default 24): long roads need longer
  tour?: boolean; // tour greens: quicker, a smaller cup, and a putt has to be dying to drop
  noCart?: boolean; // nowhere for the beverage cart to drive up (a tee on a crater rim, or an island in the sky)
  theme?: 'highland' | 'volcanic' | 'haunted' | 'links' | 'desert' | 'autumn' | 'coastal' | 'florida' | 'city' | 'canyon' | 'alpine' | 'linksland' | 'chicago' | 'carnival';
  blurb?: string; // a line for the hole's intro card during the flyover
  teeTip?: string; // what Hank says on this tee: the club the hole wants
  yards?: number; // the length shown on the intro card, if not the straight line from tee to cup
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
  // a ball that comes down on one is lost (penalty). top: the ridge, ft above the ground; a ball higher than that
  // sails over (a barn), where without it the roof reaches up for ever (a veranda under the clubhouse wall)
  roofs?: Roof[];
  // a ball that lands on a roof rattles down to the foot of the building, no penalty (the Windy City); without it a
  // roof keeps the ball
  roofsGive?: boolean;
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
// loft: degrees, in place of the club's own (an opened face out of a bunker: see escapeLoft in physics.ts).
export type Shot = { angle: number; power: number; club: ClubId; error: number; clock: number; boost?: number; spin?: number; shape?: number; wind?: V2; loft?: number; cleanLie?: boolean };
