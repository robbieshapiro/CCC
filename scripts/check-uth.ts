// npm run check-uth: Ultimate Texas Hold'em's sums (src/uth.ts). Known hands rank as they should, the rule card settles
// as it should, and 200,000 random seven-card hands come out in the known proportions (pair 43.8%, two pair 23.5% ...).
// With --sql, prints random hands and their ranks as SQL to compare with poker_rank on a scratch database.
import { category, handName, pokerRank, uthSettle } from '../src/uth';

let fails = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) {
    fails++;
    console.log('FAIL', what);
  }
};
// cards by name: rank (A 2-9 T J Q K) and suit (s h d c), in blackjack's numbering
const R = 'A23456789TJQK';
const S = 'shdc';
const c = (x: string) => S.indexOf(x[1]) * 13 + R.indexOf(x[0]);
const h = (s: string) => s.split(' ').map(c);
const name = (s: string) => handName(pokerRank(h(s)));

ok(name('As Ks Qs Js Ts 2d 3c') === 'Royal flush', 'royal');
ok(name('9h 8h 7h 6h 5h Ad Ac') === 'Straight flush', 'straight flush');
ok(name('Ah 2h 3h 4h 5h Kd Kc') === 'Straight flush', 'steel wheel');
ok(name('Qs Qh Qd Qc 2s 3h 4d') === 'Four of a kind', 'quads');
ok(name('Ks Kh Kd 2c 2s 9h 8d') === 'Full house', 'full house');
ok(name('Ks Kh Kd 2c 2s 2h 8d') === 'Full house', 'two trips make a full house');
ok(name('As 9s 7s 4s 2s Kd Kc') === 'Flush', 'flush beats a pair');
ok(name('Ad 2c 3h 4s 5d Kd Qc') === 'Straight', 'the wheel');
ok(name('Td Jc Qh Ks Ad 2d 2c') === 'Straight', 'broadway');
ok(name('7d 7c 7h Ks 2d 4c 9h') === 'Three of a kind', 'trips');
ok(name('7d 7c 9h 9s 2d 4c Kh') === 'Two pair', 'two pair');
ok(name('7d 7c 9h Js 2d 4c Kh') === 'Pair', 'pair');
ok(name('7d 3c 9h Js 2d 4c Kh') === 'High card', 'high card');
// the comparisons that matter
const beats = (a: string, b: string) => pokerRank(h(a)) > pokerRank(h(b));
ok(beats('Ah 2h 3h 4h 5h Kd Kc', 'Kd Kc Ks Kh Qd 2c 3c'), 'steel wheel beats quads');
ok(beats('6d 2c 3h 4s 5d Kd Qc', 'Ad 2c 3h 4s 5d Kd Qc'), 'six-high straight beats the wheel');
ok(beats('As Ad 9h 9s 2d 4c Kh', 'As Ad 9h 9s 2d 4c Qh'), 'two pair, the kicker counts');
ok(beats('7d 7c 7h 2s 2d 4c 4h', '6d 6c 6h As Ad Kc Kh'), 'full house goes by the trips');
ok(pokerRank(h('As Ks Qd Jc 9h 3d 2c')) === pokerRank(h('Ad Kd Qs Jh 9c 4d 2s')), 'only the best five count');
ok(!beats('As Ks 4d 4c 4h 9c 9d', 'Ad Kd 4s 4c 4h 9s 9h'), 'same full house ties');
ok(beats('7d 7c 7h 4s 4d Kc Kh', '7s 7c 7h 4s 4d 4c 2h'), 'sevens full of kings beats sevens full of fours');
ok(category(pokerRank(h('As Ks Qs Js Ts 2d 3c'))) === 9 && category(pokerRank(h('Ks Qs Js Ts 9s 2d 3c'))) === 8, 'royal vs straight flush category');

// settling, by the rule card
{
  const s = uthSettle(10, 0, 40, h('As Ad'), h('2c 7d'), h('Kh 9s 4c 3d 8h'), false);
  ok(s.outcome === 'win' && !s.qualified && s.back.ante === 10 && s.back.play === 80 && s.back.blind === 10, 'win, Mo not qualified: Ante pushes, Blind pushes on a pair, Play 1:1');
}
{
  const s = uthSettle(10, 10, 40, h('Ah Kh'), h('2c 2d'), h('Qh Jh Th 3d 8c'), false);
  ok(s.outcome === 'win' && s.qualified && s.back.ante === 20 && s.back.blind === 10 + 5000 && s.back.trips === 10 + 500 && s.payout === 20 + 5010 + 80 + 510, 'royal: Blind 500:1, Trips 50:1');
}
{
  const s = uthSettle(10, 10, 10, h('2c 7d'), h('As Ad'), h('Ah 7s 7c 3d 8h'), false);
  ok(s.outcome === 'lose' && s.back.ante === 0 && s.back.blind === 0 && s.back.play === 0 && s.back.trips === 40, 'lose with trips: Trips still pays 3:1');
}
{
  const s = uthSettle(10, 0, 0, h('2c 3d'), h('As Ad'), h('Kh 7s 9c Qd 8h'), true);
  ok(s.outcome === 'fold' && s.payout === 0, 'fold loses Ante and Blind');
}
{
  const s = uthSettle(10, 0, 20, h('As 2d'), h('Ad 3c'), h('Kh Ks 9c 9d 8h'), false);
  ok(s.outcome === 'tie' && s.payout === 10 + 10 + 20, 'a tie pushes everything');
}

// seven random cards, 200,000 times: each kind of hand turns up as often as it should (the known 7-card odds)
function deal(rnd: () => number) {
  const d = [...Array(52).keys()];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
let seed = 12345;
// mulberry32: a small, sound generator
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const KNOWN = [17.41, 43.82, 23.5, 4.83, 4.62, 3.03, 2.6, 0.168, 0.0279];
const seen = new Array(10).fill(0);
const N = 200_000;
for (let i = 0; i < N; i++) seen[Math.min(8, category(pokerRank(deal(rnd).slice(0, 7))))]++;
KNOWN.forEach((pct, k) => {
  const got = (seen[k] / N) * 100;
  ok(Math.abs(got - pct) < Math.max(0.35, pct * 0.12), `${handName(k * 13 ** 5)}: ${got.toFixed(2)}% (should be about ${pct}%)`);
});
console.log('Hands by kind (%):', seen.slice(0, 9).map((n) => ((n / N) * 100).toFixed(2)).join(' '));

if (process.argv.includes('--sql')) {
  const rows: string[] = [];
  for (let i = 0; i < 3000; i++) {
    const d = deal(rnd).slice(0, 7);
    rows.push(`('{${d.join(',')}}'::int[], ${pokerRank(d)})`);
  }
  console.log(`SQL:select count(*) filter (where poker_rank(c) <> v) as wrong, count(*) from (values ${rows.join(',')}) t(c, v);`);
}

if (fails) {
  console.log(`${fails} failed`);
  process.exit(1);
}
console.log('Ultimate Texas Hold\'em checks out.');
