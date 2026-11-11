// Proves every High Roller stage can be cleared: a robot rolls each one along its path, steady and then with a shaky
// hand, and a ball left alone must stay put on the start. Run with `npm run check-roller`.
import { advance, botRun, floorOf, newBall } from '../src/roller/sim';
import { ALL_STAGES } from '../src/roller/stages';

let bad = 0;
for (const [i, stage] of ALL_STAGES.entries()) {
  const notes: string[] = [];
  // hands off: the ball stays on the start
  const b = newBall(stage);
  const acc = { t: 0 };
  for (let f = 0; f < 240; f++) advance(b, stage, 0, 0, 1 / 60, acc, floorOf(stage));
  if (b.state !== 'rolling' || Math.hypot(b.p[0] - stage.start[0], b.p[2] - stage.start[2]) > 0.3) notes.push('the ball does not rest on the start');
  // a clean run, well inside the clock
  const run = botRun(stage);
  if (run.state !== 'goal') notes.push(`the robot ${run.state === 'fell' ? 'fell off' : 'ran out of time'} at ${run.t.toFixed(1)}s`);
  else if (run.t > stage.time * 0.7) notes.push(`the robot needed ${run.t.toFixed(1)}s of ${stage.time}s: too tight`);
  // a shaky hand still gets round
  const shaky = botRun(stage, { wobble: 0.25 });
  if (shaky.state !== 'goal') notes.push(`a shaky hand ${shaky.state === 'fell' ? 'fell off' : 'ran out of time'} at ${shaky.t.toFixed(1)}s`);
  const ok = !notes.length;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${i + 1}. ${stage.name.padEnd(16)} ${run.state === 'goal' ? `${run.t.toFixed(1)}s of ${stage.time}s, ${run.chips}/${stage.chips.length} chips` : ''}${notes.length ? ` · ${notes.join('; ')}` : ''}`);
}
if (bad) {
  console.error(`\n${bad} stage${bad === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log('\nEvery stage can be cleared.');
