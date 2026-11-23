// Replays (Nov 18): the day's best shots, saved as the ball flew them and played back from home ("Shots of the day").
// A shot is kept compact: its frames thinned to about 20 a second and rounded, its sounds, the club and power for the
// golfer's swing, the aim, and where it was hit from. Kept: every eagle or better on a card (one per person per hole a
// day, their best) and the Ace Pot ace (save_replay in supabase/schema.sql). Home shows the day's card shots.
//
// THE RULE (Robbie, Nov 23, after Hunter's ace replayed on the wrong hole and missed): a replay is drawn on exactly the
// hole, and to exactly the cup, the shot was played on. Its frames are the real flight, so on any other hole or pin the
// ball misses. So:
//   - Every new place that saves a replay gives it its own ReplayHole kind that names that one hole (the Daily Shot's
//     aces are { kind: 'shot', day, n }, never the Ace Pot game's { kind: 'ace', day }). Never reuse another game's kind.
//   - replayHoleOf() in src/screens/round.ts is the one place a ReplayHole turns into a hole, for saving and watching
//     both. Add the new kind there, never a second lookup.
//   - keepShot() refuses to save a replay whose ReplayHole isn't the hole the engine is playing (by id), or a holed one
//     whose ball doesn't finish in the engine's cup. It saves that cup with the shot, and watchReplay() plays to it, so
//     a moved pin (the day's pin, a Committee dial) can't make it miss either.
//   - After any change here, watch a replay in the browser (browser-check) and see the ball go in.
import type { ClubId } from './golf3d/clubs';
import type { Frame, Result, Sound } from './golf3d/physics';
import type { V2 } from './golf3d/types';

export type ReplayKind = 'daily' | 'ace' | 'drive' | 'targets' | 'card';
// which hole: the day's shot for a bar game, or a hole on a course (a card)
// shot (Nov 23): one of the Daily Shot's three holes that day (n: 1 to 3), so its ace replays on the hole it went in
export type ReplayHole = { kind: 'daily' | 'ace' | 'drive' | 'targets'; day: string } | { kind: 'shot'; day: string; n: number } | { kind: 'card'; course: string; i: number };
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
  cup?: [number, number]; // the cup it was played to (from Nov 23): playback puts the pin here
};
// hole: a card's hole (0-based), so the label can say which
export type ReplayRow = { id: number; kind: ReplayKind; avatar?: import('./api/types').Avatar; name: string; label: string; hole?: number | null; score: number; mine: boolean; at: string };
// "Eagle on Wrigleyville" with its hole: "Eagle on hole 5, Wrigleyville"
export const withHoleNo = (label: string, i: number | null | undefined, name?: string) =>
  i == null ? label : name ? label.replace(` on ${name}`, ` on hole ${i + 1}, ${name}`) : label.replace(/ on (.+)$/, ` on hole ${i + 1}, $1`);
// day: the day it was played (a card's pin and wind are that day's)
export type Replay = { id: number; kind: ReplayKind; name: string; avatar: import('./api/types').Avatar; day?: string; data: ReplayData };

const r1 = (n: number) => Math.round(n * 10) / 10;

// a shot as played, made small enough to keep
export function packShot(p: { club: ClubId; power: number; aim: number; from: V2; r: Result }, hole: ReplayHole, label: string, cup?: V2): ReplayData {
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
    ...(cup ? { cup: [r1(cup.x), r1(cup.y)] as [number, number] } : {}),
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
