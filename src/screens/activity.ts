// Member activity: a light check-in when a member opens the app or the locker room (at most once an hour each),
// and the 'last in' wording the Committee Room uses. Counts, never a trail of screens.
import { api } from '../api';
import type { ActivityKind } from '../api/types';
import { GAME_TZ } from '../day';
import { requireSession } from '../state';
import { store } from '../storage';

const HOUR = 3_600_000;

export function checkIn(kind: ActivityKind) {
  const key = `ccc-touch-${kind}`;
  const last = Number(store.get(key) ?? 0);
  if (Date.now() - last < HOUR) return;
  store.set(key, String(Date.now()));
  void api.touch(requireSession(), kind).catch(() => store.remove(key));
}

export const ago = (iso: string | null) => {
  if (!iso) return 'not yet';
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TZ }).format(d);
  const then = new Date(iso);
  const today = day(new Date());
  if (day(then) === today) return 'today';
  if (day(then) === day(new Date(Date.now() - 86_400_000))) return 'yesterday';
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: GAME_TZ });
};
