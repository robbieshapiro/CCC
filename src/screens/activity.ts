// Member activity: a light check-in when a member opens the app or the locker room (at most once an hour each),
// and, for the admin only, a line per member for the month. Counts, never a trail of screens.
import { api } from '../api';
import type { ActivityKind } from '../api/types';
import { GAME_TZ } from '../day';
import { requireSession } from '../state';
import { store } from '../storage';
import { esc } from '../ui';

const HOUR = 3_600_000;

export function checkIn(kind: ActivityKind) {
  const key = `ccc-touch-${kind}`;
  const last = Number(store.get(key) ?? 0);
  if (Date.now() - last < HOUR) return;
  store.set(key, String(Date.now()));
  void api.touch(requireSession(), kind).catch(() => store.remove(key));
}

const ago = (iso: string | null) => {
  if (!iso) return 'not yet';
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TZ }).format(d);
  const then = new Date(iso);
  const today = day(new Date());
  if (day(then) === today) return 'today';
  if (day(then) === day(new Date(Date.now() - 86_400_000))) return 'yesterday';
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: GAME_TZ });
};

export function activityPanel(admin: boolean) {
  if (!admin) return '';
  return `<section class="panel admin activity-log"><div class="board-head"><h2>Member activity</h2><span class="muted">This month</span></div><div id="act-body"><p class="muted">Loading…</p></div></section>`;
}

export async function bindActivity() {
  if (!document.getElementById('act-body')) return;
  const rows = await api.activityReport(requireSession()).catch(() => null);
  const body = document.getElementById('act-body');
  if (!body) return;
  if (!rows) {
    body.innerHTML = `<p class="muted">Couldn't load member activity. If the activity SQL hasn't been run in Supabase yet, run it and this fills in.</p>`;
    return;
  }
  if (!rows.length) {
    body.innerHTML = '<p class="muted">No members yet.</p>';
    return;
  }
  body.innerHTML = `
    <div class="table-wrap"><table class="practice-table"><thead><tr><th>Member</th><th>Last in</th><th class="num">Days</th><th class="num">Rounds</th><th class="num">Practice</th><th class="num">Lockers</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td><small>${ago(r.lastSeen)}</small></td><td class="num">${r.days}</td><td class="num">${r.rounds}</td><td class="num">${r.practice}</td><td class="num">${r.lockers}</td></tr>`).join('')}</tbody></table></div>
    <p class="fine">Days: days this month they opened the club, played or practised. Practice: range, short game and practice-round sessions.</p>`;
}
