// Browser-only nudges: tab title badge + toasts, driven by comparing snapshots.
import type { Snapshot } from './api/types';
import { board, myBest, toParLabel } from './standings';
import { store } from './storage';

const BASE_TITLE = "Claude Country Club";
const SEEN_KEY = 'ccc-last-seen';

let unread: string[] = [];

export function toast(msg: string) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), 4000);
  setTimeout(() => el.remove(), 4500);
}

function renderTitle() {
  document.title = unread.length ? `(${unread.length}) ${unread[unread.length - 1]}` : BASE_TITLE;
}

export function clearBadge() {
  unread = [];
  renderTitle();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) clearBadge();
});
window.addEventListener('focus', clearBadge);

type Seen = { month: string; leader: string | null; best: Record<string, number> };

// Compare against what this browser last saw: a new leader, and anyone who beat your best.
export function processSnapshot(snap: Snapshot) {
  const name = (id: string) => snap.players.find((p) => p.id === id)?.name ?? 'Someone';
  const rows = board(snap).filter((r) => r.best);
  const leader = rows[0]?.playerId ?? null;
  const best = Object.fromEntries(rows.map((r) => [r.playerId, r.toPar]));
  const mine = myBest(snap);
  let prev: Seen | null = null;
  try {
    prev = JSON.parse(store.get(SEEN_KEY) || 'null');
  } catch {
    prev = null;
  }
  const msgs: string[] = [];
  if (prev && prev.month === snap.month) {
    if (leader && leader !== prev.leader && leader !== snap.me) msgs.push(`${name(leader)} took the lead this month (${toParLabel(best[leader])})`);
    if (mine)
      for (const r of rows) {
        const before = prev.best[r.playerId];
        const myToPar = mine.total - mine.par;
        if (r.playerId !== snap.me && r.toPar < myToPar && (before === undefined || before >= myToPar) && r.playerId !== leader) msgs.push(`${name(r.playerId)} beat your best (${toParLabel(r.toPar)})`);
      }
  }
  for (const m of msgs.slice(0, 3)) toast(m);
  if (msgs.length && (document.hidden || !document.hasFocus())) {
    unread.push(...msgs);
    renderTitle();
  }
  store.set(SEEN_KEY, JSON.stringify({ month: snap.month, leader, best } satisfies Seen));
}
