import { checkVersion } from './version';
import { api, dropSession, getSession, listSessions, setSession } from './api';
import type { DailyCrown, Session, Snapshot } from './api/types';
import { processSnapshot } from './nudges';
import { setSchedule, setTweaks } from './golf3d/courses';
import type { Tweaks } from './golf3d/tweaks';
import { store } from './storage';

let current: Snapshot | null = null;
// when it came in, and for which seat (a club switch must never draw the old club)
let currentAt = 0;
let currentToken = '';
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
  // all at once (Nov 18): the course picks and dials used to wait for the snapshot, a second trip for every tap
  let extras = Promise.all([loadSchedule(session), loadTweaks(session)]);
  try {
    got = await Promise.all([api.snapshot(session), api.dailyCrown(session).catch(() => null)]);
  } catch (err) {
    // a saved club whose seat is gone (merged into another club, say): forget it and carry on in another club
    if (!/session expired/i.test((err as Error).message) || listSessions().length < 2) throw err;
    dropSession(session.token);
    session = requireSession();
    extras = Promise.all([loadSchedule(session), loadTweaks(session)]);
    got = await Promise.all([api.snapshot(session), api.dailyCrown(session).catch(() => null)]);
  }
  const [snap, crown] = got;
  snap.crown = crown;
  await extras;
  // a club renamed since this device signed in: keep the saved name (and the club switcher) up to date
  if (snap.groupName && snap.groupName !== session.groupName) setSession({ ...session, groupName: snap.groupName });
  current = snap;
  currentAt = Date.now();
  currentToken = session.token;
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

// The Committee's dials on the holes, kept on the device like the schedule
async function loadTweaks(session: Session) {
  const fresh = await api.courseTweaks(session).catch(() => null);
  if (fresh) store.set('ccc-tweaks', JSON.stringify(fresh));
  let cached: Tweaks | null = null;
  try {
    cached = JSON.parse(store.get('ccc-tweaks') ?? 'null');
  } catch {
    cached = null;
  }
  setTweaks(fresh ?? cached);
}

// For moving between screens (Nov 18): the club's data from the last half minute, drawn at once while a fresh copy
// comes in behind it (home redraws when it lands); anything older, or another club's, waits for the fresh one.
export async function recent(maxAge = 30_000): Promise<Snapshot> {
  const s = getSession();
  if (current && s && s.token === currentToken && Date.now() - currentAt < maxAge) {
    refresh().catch(() => {});
    return current;
  }
  return refresh();
}

export function onSnapshot(fn: (s: Snapshot) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let timer = 0;
// Everyone's app keeps current: the club's data and the app's own version, once a minute and whenever it's opened
// again (the version is also checked on every move to a new page: src/version.ts)
export function startPolling() {
  clearInterval(timer);
  const tick = () => {
    checkVersion();
    if (getSession()) refresh().catch(() => {});
  };
  timer = window.setInterval(tick, 60_000);
  checkVersion();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) tick();
  });
}
