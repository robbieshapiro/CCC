// Replays (Nov 18): the day's best shots, saved as the ball flew them and played back from home ("Shots of the day").
// A shot is kept compact: its frames thinned to about 20 a second and rounded, its sounds, the club and power for the
// golfer's swing, the aim, and where it was hit from. Kept: every eagle or better on a card (one per person per hole a
// day, their best) and the Ace Pot ace (save_replay in supabase/schema.sql). Home shows the day's card shots.
import type { ClubId } from './golf3d/clubs';
import type { Frame, Result, Sound } from './golf3d/physics';
import type { V2 } from './golf3d/types';

export type ReplayKind = 'daily' | 'ace' | 'drive' | 'targets' | 'card';
// which hole: the day's shot for a bar game, or a hole on a course (a card)
export type ReplayHole = { kind: 'daily' | 'ace' | 'drive' | 'targets'; day: string } | { kind: 'card'; course: string; i: number };
export type ReplayData = {
  hole: ReplayHole;
  from: [number, number];
  aim: number;
  club: ClubId;
  power: number;
  holed: boolean;
  frames: number[]; // x, y, z, t for each frame, flat
  sounds: [number, Sound['s']][];
  label: string; // what it was: "4.2 ft", "Hole in one on The River"
};
export type ReplayRow = { id: number; kind: ReplayKind; name: string; label: string; score: number; mine: boolean; at: string };
// day: the day it was played (a card's pin and wind are that day's)
export type Replay = { id: number; kind: ReplayKind; name: string; avatar: import('./api/types').Avatar; day?: string; data: ReplayData };

const r1 = (n: number) => Math.round(n * 10) / 10;

// a shot as played, made small enough to keep
export function packShot(p: { club: ClubId; power: number; aim: number; from: V2; r: Result }, hole: ReplayHole, label: string): ReplayData {
  const f = p.r.frames;
  const keep: Frame[] = [];
  let last = -1;
  for (let i = 0; i < f.length; i++) {
    if (i === 0 || i === f.length - 1 || f[i].t - last >= 0.05) {
      keep.push(f[i]);
      last = f[i].t;
    }
  }
  return {
    hole,
    from: [r1(p.from.x), r1(p.from.y)],
    aim: Math.round(p.aim * 1000) / 1000,
    club: p.club,
    power: Math.round(p.power * 100) / 100,
    holed: p.r.holed,
    frames: keep.flatMap((x) => [r1(x.x), r1(x.y), Math.round(x.z * 100) / 100, Math.round(x.t * 100) / 100]),
    sounds: p.r.sounds.map((s) => [Math.round(s.t * 100) / 100, s.s]),
    label,
  };
}

// and back into a shot the engine can play
export function unpackShot(d: ReplayData): Result {
  const frames: Frame[] = [];
  for (let i = 0; i + 3 < d.frames.length; i += 4) frames.push({ x: d.frames[i], y: d.frames[i + 1], z: d.frames[i + 2], t: d.frames[i + 3] });
  const end = frames[frames.length - 1] ?? { x: d.from[0], y: d.from[1], z: 0, t: 0 };
  return { end: { x: end.x, y: end.y }, holed: d.holed, penalty: false, zones: [], frames, sounds: d.sounds.map(([t, s]) => ({ t, s })), duration: end.t };
}

export const KIND_NAME: Record<ReplayKind, string> = { daily: 'Closest to the Pin', ace: 'The Ace Pot', drive: 'Long drive', targets: 'The Target Range', card: "Today's cards" };
// the order they're shown on home: the rarest first
export const KIND_ORDER: ReplayKind[] = ['ace', 'card', 'daily', 'targets', 'drive'];
