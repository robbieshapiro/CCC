// The weekly purse: every club's board pays its top ten like a tour event. The purse grows with the field ($1,000 for
// each member who posts a round that week) and all of it is paid to the top ten (everyone, if fewer play), split in
// the proportions of a tour purse: the winner takes about 30%, tenth about 4.5%.
// Ties share the places they cover, as on tour; a playoff winner takes first money and the rest split the places
// below. It's play money: it adds up as career earnings and buys nothing. period_payouts in supabase/schema.sql does
// the same sums for the weeks that have closed.

export const PER_PLAYER = 1000;
export const SHARES = [0.18, 0.109, 0.069, 0.049, 0.041, 0.03625, 0.03375, 0.03125, 0.02925, 0.02725];

export const purseOf = (field: number) => field * PER_PLAYER;

// rows: each member with a round, their rank (ties share it). winner: who won a playoff for first, if one was played.
export function payouts(rows: { id: string; rank: number }[], winner?: string | null): Map<string, { place: number; tied: boolean; payout: number }> {
  const field = rows.length;
  const purse = purseOf(field);
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

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const placeLabel = (place: number, tied: boolean) => `${tied ? 'T' : ''}${place}${place % 100 >= 11 && place % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][place % 10] ?? 'th'}`;
