// Pop-a-Shot: the rules shared by the game and local mode. 30 seconds; a basket is 2 points, 3 in the last 8 seconds.
// Mo posts a score first (36 to 64): beat it and the stake comes back with 90% on top, tie and it comes back. The live
// club settles on the server (pas_start and pas_finish in supabase/schema.sql); keep the numbers in step.
export const PAS_SECONDS = 30;
export const PAS_FIRE = 8; // the last seconds, worth 3
export const PAS_MAX = 120;
export type PasStart = { id: number; mo: number; stake: number; bank: number; lostToday: number };
export type PasEnd = PasStart & { score: number; outcome: 'win' | 'push' | 'lose'; payout: number; best: number };
export const pasPay = (stake: number, score: number, mo: number) => (score > mo ? stake + Math.floor((stake * 9) / 10) : score === mo ? stake : 0);
export const moTarget = () => 36 + 2 * Math.floor(Math.random() * 15);
