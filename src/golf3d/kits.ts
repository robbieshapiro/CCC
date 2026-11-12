// Look kits: everything a new kind of country needs to be drawn, in one place, so a new look is one file (see
// src/golf3d/looks/) and not a thread through scene.ts and engine.ts. The Hole Lab's test holes use them. A kit gives
// the ground colours, the light and sky, and draws its own posts, decor and the world beyond the grounds.
import type * as THREE from 'three';
import type { Decor, Hole, Post, Surface } from './types';
import { florida } from './looks/florida';
import { city } from './looks/city';
import { canyon } from './looks/canyon';
import { alpine } from './looks/alpine';
import { linksland } from './looks/linksland';
import { chicago, chicagoNight } from './looks/chicago';
import { carnival } from './looks/carnival';

export type Anim = ((clock: number, dt: number) => void)[];
export type Kit = {
  surface: Partial<Record<Surface, string>>;
  floor: string; // the ground beyond the course
  lake?: string; // the colour of its lakes and rivers, if not the usual
  sea?: string; // the colour of its sea (or great lake), if not the usual
  // something drifting down round the camera, blown by the day's wind: autumn leaves, snow
  drift?: { colors: string[]; size: number; fall: number; count: number };
  // light: hemisphere sky and ground colours and strength, the sun's colour and strength, fog colour and distances,
  // and how much the environment shows in shiny things
  light: { sky: string; ground: string; hemi: number; sunColor: string; sun: number; fog: string; near: number; far: number; env: number };
  skyColors: [string, string, string]; // overhead, mid, horizon
  sun?: { color: string; at: [number, number, number]; size: number; glow?: string };
  clouds?: boolean;
  rail?: boolean; // the edge of the hole is a low rail rather than the stone curb
  post?(h: Hole, p: Post, anim: Anim): THREE.Object3D | null; // null: draw it the usual way
  decor?(h: Hole, d: Decor, anim: Anim): THREE.Object3D | null;
  frame?(h: Hole, root: THREE.Group, anim: Anim, floor: number): void; // what lies beyond the grounds
};

// a look with a night version ('<theme>@night') shows it from 5pm to 7am on the player's own clock (see engine.ts)
export const KITS: Record<string, Kit> = { florida, city, canyon, alpine, linksland, chicago, 'chicago@night': chicagoNight, carnival };
// (the Committee's preview can hold it at day or night: forceNight(true | false), or null to follow the clock again)
let forcedNight: boolean | null = null;
export const forceNight = (v: boolean | null) => (forcedNight = v);
export const isNight = (d = new Date()) => forcedNight ?? (d.getHours() < 7 || d.getHours() >= 17);
export const hasNight = (h: Hole) => !!h.theme && !!KITS[`${h.theme}@night`];
export const kitOf = (h: Hole): Kit | undefined => (h.theme ? KITS[h.theme] : undefined);
