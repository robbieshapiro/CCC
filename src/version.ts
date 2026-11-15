// Keeping everyone's app current (Nov 15). Each build carries its version (scripts/stamp-version.mjs), and the live
// one is at /version.json. On opening the app and every 30 seconds it checks; if a newer version is live it reloads,
// but never in the middle of a round or a game: it waits until you leave it (a card in progress picks up where it
// left off anyway). Before this, an app left open for a day kept playing last week's version of the course.
const MINE = import.meta.env.VITE_COMMIT ?? 'dev';
// the screens a reload would interrupt
const BUSY = new Set(['play', 'round', 'practice', 'daily', 'preview', 'rehearse', 'classic', 'facility', 'playoff', 'bar', 'blackjack', 'popashot', 'billiards', 'room', 'design', 'midway', 'welcome', 'join', 'invite']);
let stale = false;

const busy = () => BUSY.has(location.hash.replace(/^#\/?/, '').split('/')[0]);

function reload(live: string) {
  // once per version per session, so a slow CDN can't send us round in circles
  try {
    if (sessionStorage.getItem('ccc-reloaded-for') === live) return;
    sessionStorage.setItem('ccc-reloaded-for', live);
  } catch {
    // no session storage: reload anyway
  }
  location.reload();
}

let live = '';
export async function checkVersion() {
  if (MINE === 'dev') return;
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    live = ((await r.json()) as { v?: string }).v ?? '';
  } catch {
    return;
  }
  if (!live || live === MINE) return;
  stale = true;
  if (!busy()) reload(live);
}

// leaving a round or a game with a newer version waiting: reload then
window.addEventListener('hashchange', () => {
  if (stale && !busy()) reload(live);
});
