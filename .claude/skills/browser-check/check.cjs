// A browser check of the club in local mode (no keys, no live data): seeds a club, opens a screen, optionally walks a
// round, and takes screenshots. Run the dev server first (npx vite --port 5179 --strictPort), then:
//
//   node .claude/skills/browser-check/check.cjs <out-dir> [route] [options as JSON]
//
//   route:   a hash route, e.g. '#/', '#/admin', '#/preview/westernreserve', '#/rehearse' (default '#/')
//   options: { "w": 390, "h": 844, "dpr": 1, "hole": 3, "skip": true, "noCart": true, "finish": 0, "wait": 4000,
//              "players": ["Marc", "Hunter"], "eval": "<js run in the page>", "shot": "name" }
//     hole:   jump to this hole (1-based) through the Committee's Holes menu (previews only)
//     skip:   skip the flyover;  noCart: wave the drinks cart on if it comes
//     finish: play out this many holes at par (sets the strokes and calls the engine's finish), waiting for each
//     eval:   any script to run once the screen is up (the engine is window.__g3 in dev)
//
// Prints anything useful the eval returns, and page errors.
const { chromium } = require('playwright');

const [OUT = '.', ROUTE = '#/', RAW = '{}'] = process.argv.slice(2);
const o = { w: 390, h: 844, dpr: 1, wait: 4000, players: ['Marc', 'Hunter'], shot: 'check', ...JSON.parse(RAW) };
const URL = 'http://localhost:5179/';
const G = 'g1';
const player = (id, name, admin) => ({ id, groupId: G, name, pin: `pin${id}`, token: `t${id}`, avatar: { color: '#163b2c', equip: {}, onboarded: true }, joined: '2026-10-01T00:00:00Z', admin });
const db = { groups: { kel: { id: G, name: 'Kellogg' } }, players: [player('p1', 'Robbie', true), ...o.players.map((n, i) => player(`p${i + 2}`, n))], rounds: [] };

(async () => {
  // a software 3D renderer: slow (a few frames a second), so waits and screenshot timeouts are long
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.dpr });
  // seed once per tab: the local club, a signed-in admin, and the first-time tips already seen
  await ctx.addInitScript(([d]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('ccc-local-db', JSON.stringify(d));
    localStorage.setItem('dt-session', JSON.stringify({ token: 'tp1', playerId: 'p1', groupId: 'g1', groupName: 'Kellogg' }));
    localStorage.setItem('ccc-howto-round', '1');
    localStorage.setItem('ccc-shout-tip', '1');
    sessionStorage.setItem('seeded', '1');
  }, [db]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  // home first: a new period redirects the first visit there, which would swallow the route
  await p.goto(URL + '#/');
  await p.waitForTimeout(2500);
  if (ROUTE !== '#/') {
    await p.goto(URL + ROUTE);
    await p.waitForTimeout(o.wait);
  }
  const g3 = await p.evaluate(() => !!window.__g3);
  if (g3 && o.hole && o.hole > 1) {
    await p.click('[data-holes]');
    await p.waitForTimeout(500);
    await p.click(`.g3-holes [data-i="${o.hole - 1}"]`, { timeout: 120000 });
    await p.waitForTimeout(3000);
  }
  if (g3 && o.skip) {
    const skip = await p.$('[data-skip]');
    if (skip) await skip.click().catch(() => {});
    await p.waitForTimeout(3000);
  }
  if (g3 && o.noCart) {
    const no = await p.$('[data-drink="none"]');
    if (no) await no.click().catch(() => {});
    await p.waitForTimeout(2000);
  }
  for (let i = 0; g3 && i < (o.finish || 0); i++) {
    const n = await p.evaluate(() => window.__g3.number);
    await p.waitForFunction((k) => window.__g3?.number === k && window.__g3.mode !== 'done', n, { timeout: 180000 });
    await p.evaluate(() => {
      const g = window.__g3;
      g.closeUntil = 0;
      g.replay = null;
      g.strokes = g.hole.par;
      g.finish([]);
    });
    console.log('finished hole', n);
    if (i < o.finish - 1) await p.waitForFunction((k) => window.__g3?.number === k + 1, n, { timeout: 180000 }).catch(() => {});
  }
  if (o.eval) console.log('eval:', JSON.stringify(await p.evaluate(o.eval)));
  await p.screenshot({ path: `${OUT}/${o.shot}.png`, timeout: 180000 });
  console.log('saved', `${OUT}/${o.shot}.png`);
  await b.close();
})();
