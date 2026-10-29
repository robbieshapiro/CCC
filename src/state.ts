import { api, getSession, setSession } from './api';
import type { Session, Snapshot } from './api/types';
import { processSnapshot } from './nudges';

let current: Snapshot | null = null;
const listeners = new Set<(s: Snapshot) => void>();

export const snapshot = () => current;

export function requireSession(): Session {
  const s = getSession();
  if (!s) throw new Error('No session');
  return s;
}

export async function refresh(): Promise<Snapshot> {
  const session = requireSession();
  // yesterday's Closest to the Pin crown comes with it; the snapshot never waits on it or fails for it
  const [snap, crown] = await Promise.all([api.snapshot(session), api.dailyCrown(session).catch(() => null)]);
  snap.crown = crown;
  // a club renamed since this device signed in: keep the saved name (and the club switcher) up to date
  if (snap.groupName && snap.groupName !== session.groupName) setSession({ ...session, groupName: snap.groupName });
  current = snap;
  processSnapshot(snap);
  for (const fn of listeners) fn(snap);
  return snap;
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
