// Keeping everyone's app current (Nov 15). Each build carries its version (scripts/stamp-version.mjs), and the live
// one is at /version.json. On opening the app, on moving to a new page, and once a minute it checks (every 30 seconds
// was too much, Nov 15); if a newer version is live it reloads,
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
// Before a card opens: a newer version waiting means reload now, while nothing has been played (true: reloading)
export async function freshBeforeCard(): Promise<boolean> {
  await checkVersion();
  if (!stale) return false;
  reload(live);
  return true;
}

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

// moving to a new page: reload if a newer version is already known to be waiting (leaving a round or a game, say),
// otherwise check for one, unless the new page is a round or a game
window.addEventListener('hashchange', () => {
  if (busy()) return;
  if (stale) reload(live);
  else checkVersion();
});
