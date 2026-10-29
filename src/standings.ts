import type { Champion, Round, Snapshot } from './api/types';

// The crown by a member's name for a day: yesterday's Closest to the Pin winner across every club.
export const crownFor = (snap: Snapshot, playerId: string) =>
  snap.crown?.ids.includes(playerId) ? ` <span class="crown" title="Yesterday's Closest to the Pin">👑</span>` : '';

export type Row = { playerId: string; best: Round | null; rounds: number; last: string | null; toPar: number; rank: number };

const toParOf = (r: Round) => r.total - r.par;

// Each player's best round: lowest to par, earliest wins a tie.
export function bestRounds(rounds: Round[]): Map<string, Round> {
  const best = new Map<string, Round>();
  for (const r of rounds) {
    const b = best.get(r.playerId);
    if (!b || toParOf(r) < toParOf(b) || (toParOf(r) === toParOf(b) && r.createdAt < b.createdAt)) best.set(r.playerId, r);
  }
  return best;
}

// The clubhouse board: best round per member, ties share a rank. Members yet to play sit at the bottom.
export function board(snap: Snapshot): Row[] {
  const best = bestRounds(snap.rounds);
  // someone who only runs the club (a host) isn't on its board
  const rows = snap.players.filter((p) => !p.host).map((p) => {
    const mine = snap.rounds.filter((r) => r.playerId === p.id);
    const b = best.get(p.id) ?? null;
    return { playerId: p.id, best: b, rounds: mine.length, last: mine.map((r) => r.createdAt).sort().pop() ?? null, toPar: b ? toParOf(b) : 0, rank: 0 };
  });
  const played = rows.filter((r) => r.best).sort((a, b) => a.toPar - b.toPar || a.best!.createdAt.localeCompare(b.best!.createdAt));
  let rank = 0;
  played.forEach((r, i) => {
    if (i === 0 || played[i - 1].toPar !== r.toPar) rank = i + 1;
    r.rank = rank;
  });
  return [...played, ...rows.filter((r) => !r.best)];
}

// Champions of a finished period (a month, then a week): the lowest best round. Ties share it.
export function periodChampion(month: string, rounds: Round[]): Champion | null {
  const best = [...bestRounds(rounds.filter((r) => r.month === month)).values()];
  if (!best.length) return null;
  const low = Math.min(...best.map(toParOf));
  const top = best.filter((r) => toParOf(r) === low);
  return { month, playerIds: top.map((r) => r.playerId), total: top[0].total, par: top[0].par };
}

export const myBest = (snap: Snapshot) => bestRounds(snap.rounds).get(snap.me) ?? null;
export const toParLabel = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`);
