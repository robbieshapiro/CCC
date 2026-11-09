import { api, dropSession, getSession, listSessions, setSession } from './api';
import type { DailyCrown, Session, Snapshot } from './api/types';
import { processSnapshot } from './nudges';
import { setSchedule } from './golf3d/courses';
import { store } from './storage';

let current: Snapshot | null = null;
const listeners = new Set<(s: Snapshot) => void>();

export const snapshot = () => current;

export function requireSession(): Session {
  const s = getSession();
  if (!s) throw new Error('No session');
  return s;
}

export async function refresh(): Promise<Snapshot> {
  let session = requireSession();
  // yesterday's Closest to the Pin crown comes with it; the snapshot never waits on it or fails for it
  let got: [Snapshot, DailyCrown | null];
  try {
    got = await Promise.all([api.snapshot(session), api.dailyCrown(session).catch(() => null)]);
  } catch (err) {
    // a saved club whose seat is gone (merged into another club, say): forget it and carry on in another club
    if (!/session expired/i.test((err as Error).message) || listSessions().length < 2) throw err;
    dropSession(session.token);
    session = requireSession();
    got = await Promise.all([api.snapshot(session), api.dailyCrown(session).catch(() => null)]);
  }
  const [snap, crown] = got;
  snap.crown = crown;
  await loadSchedule(session);
  // a club renamed since this device signed in: keep the saved name (and the club switcher) up to date
  if (snap.groupName && snap.groupName !== session.groupName) setSession({ ...session, groupName: snap.groupName });
  current = snap;
  processSnapshot(snap);
  for (const fn of listeners) fn(snap);
  return snap;
}

// The Committee's course picks, before anything draws a course. Kept on the device too, so a failed fetch can't put a
// member on the wrong course mid-week.
async function loadSchedule(session: Session) {
  const fresh = await api.courseSchedule(session).catch(() => null);
  if (fresh) store.set('ccc-schedule', JSON.stringify(fresh));
  let cached: Record<string, string> | null = null;
  try {
    cached = JSON.parse(store.get('ccc-schedule') ?? 'null');
  } catch {
    cached = null;
  }
  setSchedule(fresh ?? cached);
}

export function onSnapshot(fn: (s: Snapshot) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let timer = 0;
export function startPolling() {
  clearInterval(timer);
  timer = window.setInterval(() => {
    if (getSession()) refresh().catch(() => {});
  }, 60_000);
}
