// The Midway's power-ups (Eli's game): bought at the Prize Counter with the same money as the Pro Shop. Yours (kept in
// your locker, three at most, used on a Midway tee, one a hole), the Pickpocket (used at once on a member), and curses
// (sent to a member; they land on their next counting Midway round, one hole each). Prices, the locker, the caps and the
// Prenup are kept in SQL too (powerup_price, buy_powerup, send_curse, pick_pocket, pass_curse in supabase/schema.sql).
export type PowerKind = 'magnet' | 'express' | 'prenup' | 'passon' | 'pickpocket' | 'goggles' | 'shortpour' | 'lid' | 'ironsonly' | 'bouncer';
export type Power = { kind: PowerKind; group: 'mine' | 'steal' | 'curse'; name: string; icon: string; price: number; does: string; line: string };

export const POWERS: Power[] = [
  { kind: 'magnet', group: 'mine', name: 'The Magnet', icon: '🧲', price: 400, does: 'A ball that stops on the green within 6 ft of the cup drops in. One hole.', line: 'Six feet and it’s yours.' },
  { kind: 'express', group: 'mine', name: 'The Express Lane', icon: '🎯', price: 500, does: 'On the Lane, a tee shot into the painted circle goes straight to the front of the green.', line: 'Hit the circle, skip the walk.' },
  { kind: 'prenup', group: 'mine', name: 'The Prenup', icon: '📜', price: 200, does: 'Sits in your locker and stops the next curse or Pickpocket aimed at you.', line: 'Works by itself. No need to use it.' },
  { kind: 'passon', group: 'mine', name: 'Pass It On', icon: '🔁', price: 250, does: 'When a curse lands on you, send it to someone else instead.', line: 'Offered when a curse lands.' },
  { kind: 'pickpocket', group: 'steal', name: 'The Pickpocket', icon: '🫳', price: 350, does: 'Take a power-up at random from a member’s locker, right now.', line: '' },
  { kind: 'goggles', group: 'curse', name: 'Beer Goggles', icon: '🍺', price: 200, does: 'Their screen blurs and wobbles for a hole.', line: 'Everything’s a bit swimmy.' },
  { kind: 'shortpour', group: 'curse', name: 'The Short Pour', icon: '🥃', price: 300, does: 'Their power is capped at half for a hole.', line: 'Half power, this hole.' },
  { kind: 'lid', group: 'curse', name: 'The Lid', icon: '🫙', price: 300, does: 'The cup is half size for a hole.', line: 'A smaller cup, this hole.' },
  { kind: 'ironsonly', group: 'curse', name: 'Irons Only', icon: '🔒', price: 250, does: 'No driver or wood for a hole.', line: 'Driver and wood locked, this hole.' },
  { kind: 'bouncer', group: 'curse', name: 'The Bouncer', icon: '🚫', price: 350, does: 'They can’t use power-ups on their next round.', line: 'No power-ups this round.' },
];
export const LOCKER_MAX = 3;
export const CURSES_A_WEEK = 3;
export const powerOf = (k: string) => POWERS.find((p) => p.kind === k);
// the Magnet's reach, in real feet (the course is a scale model: see SCALE)
export const MAGNET_FT = 6;

// the week's news at the Midway, in a line: what happened to you, and what came of what you sent
export function newsLine(n: { kind: string; status: string; mine: boolean; who: string | null }) {
  const p = powerOf(n.kind)?.name ?? n.kind;
  const who = n.who ?? 'Someone';
  switch (n.status) {
    case 'stolen':
      return n.mine ? `${who} picked your pocket: ${p}` : `You picked ${who}’s pocket: ${p}`;
    case 'blocked':
      return n.mine ? `${who}’s Prenup stopped your ${p}` : `Your Prenup stopped ${who}’s ${p}`;
    case 'landed':
      return n.mine ? `Your ${p} landed on ${who}` : `${who}’s ${p} landed on you`;
    case 'pending':
      return `Your ${p} is waiting for ${who}`;
    case 'passed':
      return n.mine ? `${who} passed your ${p} on` : `You passed ${who}’s ${p} on`;
    default:
      return '';
  }
}
