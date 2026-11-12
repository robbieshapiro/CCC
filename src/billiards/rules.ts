// 8-ball's rules, as played at the bar. Solids are 1 to 7, stripes 9 to 15. The table is open until someone pots a ball
// after the break; that's their group. Pot one of yours and you go again. A foul (scratching, missing everything, or
// hitting the wrong ball first) hands the other player the cue ball, anywhere on the table. Clear your group, then sink
// the 8 to win; sink it early, or scratch on it, and you lose. The 8 on the break wins it for the breaker (bar rules).
import { HEAD_X, rack, type Ball, type ShotLog } from './physics';

export type Who = 'you' | 'mo';
export type Group = 'solids' | 'stripes';
export type Game = { balls: Ball[]; turn: Who; groups: Record<Who, Group | null>; inHand: boolean; behindHead: boolean; broken: boolean; winner: Who | null; note: string };

export const other = (w: Who): Who => (w === 'you' ? 'mo' : 'you');
export const groupOf = (n: number): Group | null => (n >= 1 && n <= 7 ? 'solids' : n >= 9 && n <= 15 ? 'stripes' : null);
const left = (g: Game, grp: Group) => g.balls.filter((b) => !b.down && groupOf(b.n) === grp).length;

export function newGame(first: Who): Game {
  return { balls: rack(), turn: first, groups: { you: null, mo: null }, inHand: true, behindHead: true, broken: false, winner: null, note: first === 'you' ? 'Your break.' : 'Mo breaks.' };
}

// the balls the shooter may hit first
// (`back`: balls potted on the shot being judged count as still on the table: the rules look at it as it was)
export function targets(g: Game, w: Who, back: number[] = []): number[] {
  const grp = g.groups[w];
  const live = g.balls.filter((b) => (!b.down || back.includes(b.n)) && b.n !== 0);
  if (!grp) return live.filter((b) => b.n !== 8).map((b) => b.n);
  const mine = live.filter((b) => groupOf(b.n) === grp).map((b) => b.n);
  return mine.length ? mine : [8];
}

// after the balls stop: who's next, any foul, groups, and the end of the game
export function afterShot(g: Game, log: ShotLog): Game {
  const w = g.turn;
  const breakShot = !g.broken;
  const legal = targets(g, w, log.potted);
  const potted8 = log.potted.includes(8);
  const foul = log.scratch || log.first === null || (!breakShot && !legal.includes(log.first));
  const next: Game = { ...g, broken: true, behindHead: false, inHand: false };
  const name = (x: Who) => (x === 'you' ? 'You' : 'Mo');

  if (potted8) {
    // on the break: the breaker wins, unless they scratched too
    if (breakShot) return { ...next, winner: log.scratch ? other(w) : w, note: log.scratch ? `${name(w)} sank the 8 on the break, and the cue ball. Loses.` : `${name(w)} sank the 8 on the break. That's the game.` };
    const clean = !foul && g.groups[w] !== null && legal.length === 1 && legal[0] === 8;
    return { ...next, winner: clean ? w : other(w), note: clean ? `${name(w)} sank the 8. Game.` : `${name(w)} sank the 8 too soon. Game to ${name(other(w))}.` };
  }
  // the scratched cue ball comes back
  if (log.scratch) {
    const cue = next.balls.find((b) => b.n === 0)!;
    Object.assign(cue, { down: false, x: HEAD_X, y: 19.5, vx: 0, vy: 0 });
  }
  // the table's open: the first ball potted after the break decides it
  let groups = g.groups;
  if (!foul && !breakShot && !groups[w]) {
    const firstPot = log.potted.map(groupOf).find((x) => x);
    if (firstPot) groups = { [w]: firstPot, [other(w)]: firstPot === 'solids' ? 'stripes' : 'solids' } as Record<Who, Group>;
  }
  const mine = groups[w];
  const potMine = log.potted.some((n) => (mine ? groupOf(n) === mine : n !== 8));
  if (foul) {
    const why = log.scratch ? 'scratched' : log.first === null ? 'missed everything' : 'hit the wrong ball first';
    return { ...next, groups, turn: other(w), inHand: true, note: `${name(w)} ${why}. Ball in hand for ${name(other(w)) === 'You' ? 'you' : 'Mo'}.` };
  }
  if (potMine) {
    const set = !g.groups[w] && groups[w] ? ` ${name(w) === 'You' ? "You're" : "Mo's"} ${groups[w]}.` : '';
    return { ...next, groups, turn: w, note: `${name(w)} potted ${log.potted.length === 1 ? 'one' : log.potted.length}.${set} ${name(w) === 'You' ? 'Go again.' : 'Mo goes again.'}` };
  }
  return { ...next, groups, turn: other(w), note: `${name(w) === 'You' ? 'Nothing for you' : 'Nothing for Mo'}. ${name(other(w)) === 'You' ? 'Your shot.' : "Mo's shot."}` };
}
export { left };
