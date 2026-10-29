// Headless checks for Hollow Hills Mini Golf: every hole can be holed, how many strokes a sharp putter needs, and how
// many a casual one does. The bot reads the hole with a walking-distance map round the walls (the coffin is a
// shortcut), tries putts at every angle and pace (and, where things move, at different moments), and takes the one
// that leaves it closest.
// Run: npm run check-minigolf [hole-id]
import { HOLLOW_HILLS } from '../src/golf3d/minigolf';
import { bake } from '../src/golf3d/terrain';
import { navField, play } from '../src/golf3d/putbot';

const ok = (c: boolean, m: string) => {
  console.log(c ? 'PASS' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};

const only = process.argv[2];
const runs = Number(process.env.RUNS ?? 6);
for (const h of HOLLOW_HILLS.filter((x) => !only || x.id === only)) {
  bake(h, 0.25);
  const nav = navField(h);
  const t0 = Date.now();
  ok(nav(h.tee) < 999, `${h.name}: the cup can be reached from the tee (${nav(h.tee).toFixed(0)} ft walk)`);
  const sharp = play(h, nav, false, `${h.id}:sharp`);
  const casual = Array.from({ length: runs }, (_, i) => play(h, nav, true, `${h.id}:casual:${i}`));
  const avg = casual.reduce((a, b) => a + b, 0) / casual.length;
  ok(sharp <= h.par, `${h.name} (par ${h.par}): sharp ${sharp}, casual ${avg.toFixed(1)} [${casual.join(' ')}] in ${Math.round((Date.now() - t0) / 1000)}s`);
}
