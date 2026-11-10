// The Midway's power-ups (Eli's game): bought at the Prize Counter with the same money as the Pro Shop, held in your
// locker (three at most), used on a Midway tee, one a hole. Prices and the locker limit are kept in SQL too
// (powerup_price, buy_powerup in supabase/schema.sql).
export type PowerKind = 'magnet' | 'express';
export type Power = { kind: PowerKind; name: string; icon: string; price: number; does: string; line: string };

export const POWERS: Power[] = [
  { kind: 'magnet', name: 'The Magnet', icon: '🧲', price: 400, does: 'A ball that stops on the green within 6 ft of the cup drops in. One hole.', line: 'Six feet and it’s yours.' },
  { kind: 'express', name: 'The Express Lane', icon: '🎯', price: 500, does: 'On the Lane, a tee shot into the painted circle goes straight to the front of the green.', line: 'Hit the circle, skip the walk.' },
];
export const LOCKER_MAX = 3;
export const powerOf = (k: string) => POWERS.find((p) => p.kind === k);
// the Magnet's reach, in model feet (the course is a 2.2 scale model: 6 ft)
export const MAGNET_FT = 6;
