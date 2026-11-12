import { moving, step, strike, type ShotLog } from '../src/billiards/physics';
import { afterShot, newGame } from '../src/billiards/rules';
import { moShot } from '../src/billiards/mo';
// 8-ball's check (npm run check-pool): Mo against Mo, 200 games. Every game must end, in a sensible number of shots,
// and most the proper way (the 8 sunk last). Run it after touching src/billiards/.
let shots = 0, games = 0, stuck = 0;
const ends: Record<string, number> = {};
for (let k = 0; k < 200; k++) {
  let g = newGame(k % 2 ? 'you' : 'mo');
  let n = 0;
  while (!g.winner && n < 400) {
    const o = g.turn === 'mo' ? 'you' : 'mo';
    const s = moShot({ ...g, turn: 'mo', groups: { you: g.groups[o], mo: g.groups[g.turn] } } as typeof g);
    const cue = g.balls.find((b) => b.n === 0)!;
    if (s.place) (cue.x = s.place.x), (cue.y = s.place.y);
    const log: ShotLog = { first: null, potted: [], rail: false, scratch: false };
    strike(g.balls, s.angle, s.power);
    for (let i = 0; i < 4000 && moving(g.balls); i++) for (let q = 0; q < 4; q++) step(g.balls, 1 / 480, log);
    g = afterShot(g, log);
    n++;
  }
  if (!g.winner) stuck++;
  else ((games++), (shots += n), (ends[g.note.replace(/^(You|Mo) /, '')] = (ends[g.note.replace(/^(You|Mo) /, '')] ?? 0) + 1));
}
console.log({ games, stuck, avgShots: (shots / games).toFixed(1) });
console.log(ends);
if (stuck > 3 || (ends['sank the 8. Game.'] ?? 0) < games * 0.6) {
  console.error('8-ball check failed: games stuck, or too few ended properly.');
  process.exit(1);
}
console.log('8-ball plays out.');
