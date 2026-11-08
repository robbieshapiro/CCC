// The weekly purse: every club's board pays its top ten like a tour event. The purse grows with the field ($1,000 for
// each member who posts a round that week) and all of it is paid to the top ten (everyone, if fewer play), split in
// the proportions of a tour purse: the winner takes about 30%, tenth about 4.5%.
// Ties share the places they cover, as on tour; a playoff winner takes first money and the rest split the places
// below. It's play money: it adds up as career earnings and buys nothing. period_payouts in supabase/schema.sql does
// the same sums for the weeks that have closed.

export const PER_PLAYER = 1000;
export const SHARES = [0.18, 0.109, 0.069, 0.049, 0.041, 0.03625, 0.03375, 0.03125, 0.02925, 0.02725];

export const purseOf = (field: number) => field * PER_PLAYER;
// the Open purse, from Nov 8: $250 a player (open_per_player in supabase/schema.sql), so it stays a chase as the club grows,
// and never less than $10,000 once anyone plays (open_purse_floor), so a quiet week still pays like an event
export const OPEN_PER_PLAYER = 250;
export const OPEN_FLOOR = 10_000;
export const openPurseOf = (field: number) => (field ? Math.max(field * OPEN_PER_PLAYER, OPEN_FLOOR) : 0);

// rows: each member with a round, their rank (ties share it). winner: who won a playoff for first, if one was played.
// entries: how many put into the purse, when more played than are paid (members playing in from another club).
// floor: the least the purse is worth when anyone plays (the Open's)
export function payouts(rows: { id: string; rank: number }[], winner?: string | null, entries = rows.length, perPlayer = PER_PLAYER, floor = 0): Map<string, { place: number; tied: boolean; payout: number }> {
  const field = rows.length;
  const purse = entries ? Math.max(entries * perPlayer, floor) : 0;
  const out = new Map<string, { place: number; tied: boolean; payout: number }>();
  const byRank = new Map<number, string[]>();
  for (const r of rows) byRank.set(r.rank, [...(byRank.get(r.rank) ?? []), r.id]);
  // the places that get paid share all of the purse, in tour proportions
  const paid = SHARES.slice(0, Math.min(SHARES.length, field)).reduce((a, b) => a + b, 0);
  const share = (from: number, n: number) => {
    let s = 0;
    for (let p = from; p < from + n && p <= SHARES.length; p++) s += SHARES[p - 1];
    return Math.round((purse * s) / paid / n);
  };
  for (const [rank, ids] of byRank) {
    if (rank === 1 && ids.length > 1 && winner && ids.includes(winner)) {
      out.set(winner, { place: 1, tied: false, payout: share(1, 1) });
      const rest = ids.filter((id) => id !== winner);
      for (const id of rest) out.set(id, { place: 2, tied: rest.length > 1, payout: share(2, rest.length) });
      continue;
    }
    for (const id of ids) out.set(id, { place: rank, tied: ids.length > 1, payout: share(rank, ids.length) });
  }
  return out;
}

// From Nov 8, one purse across every club: the Open. Each person once (their best round, wherever they played it),
// $250 in each (at least $10,000 in all), the top ten paid. pay is keyed by the Open's id for them; local by their seat in your club, if any.
export function openPurse(rows: { playerId: string; localId: string | null; total: number; par: number }[]) {
  const pay = payouts(rows.map((r) => ({ id: r.playerId, rank: rows.filter((x) => x.total - x.par < r.total - r.par).length + 1 })), null, rows.length, OPEN_PER_PLAYER, OPEN_FLOOR);
  const local = new Map<string, { place: number; tied: boolean; payout: number }>();
  for (const r of rows) if (r.localId && pay.get(r.playerId)) local.set(r.localId, pay.get(r.playerId)!);
  return { field: rows.length, pay, local };
}

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const placeLabel = (place: number, tied: boolean) => `${tied ? 'T' : ''}${place}${place % 100 >= 11 && place % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][place % 10] ?? 'th'}`;

// A club's board as the purse sees it: everyone who plays puts $1,000 in, but members playing from another club take
// nothing out (their home club pays them), so the club's own members split it all. Away players keep their place and
// can win the title; the board shows them as paid at home, with no figure here.
export function clubPurse(rows: { playerId: string; best: unknown; toPar: number }[], isAway: (id: string) => boolean) {
  const played = rows.filter((r) => r.best);
  const money = played.filter((r) => !isAway(r.playerId));
  const rank = (list: typeof played) => list.map((r) => ({ id: r.playerId, rank: list.filter((x) => x.toPar < r.toPar).length + 1 }));
  return { field: played.length, pay: payouts(rank(money), null, played.length) };
}
