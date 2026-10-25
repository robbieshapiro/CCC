import { store } from '../storage';
import { localApi } from './local';
import { supabaseApi } from './supabase';
import type { Session } from './types';

export const useSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const api = useSupabase ? supabaseApi : localApi;
export { localApi };

const SESSION_KEY = 'dt-session';

export function getSession(): Session | null {
  try {
    const raw = store.get(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Every club this device is signed in to. Most members have one; the admin may run several.
const CLUBS_KEY = 'dt-clubs';

export function listSessions(): Session[] {
  let list: Session[] = [];
  try {
    list = JSON.parse(store.get(CLUBS_KEY) ?? '[]');
  } catch {
    /* start again */
  }
  const active = getSession();
  if (active && !list.some((s) => s.groupId === active.groupId)) list.push(active);
  return list;
}

// Make s the active club and remember it. null signs this device out of every club.
export function setSession(s: Session | null) {
  if (!s) {
    store.remove(SESSION_KEY);
    store.remove(CLUBS_KEY);
    return;
  }
  const list = listSessions().filter((x) => x.groupId !== s.groupId);
  store.set(CLUBS_KEY, JSON.stringify([...list, s]));
  store.set(SESSION_KEY, JSON.stringify(s));
}

export function switchClub(groupId: string) {
  const s = listSessions().find((x) => x.groupId === groupId);
  if (s) store.set(SESSION_KEY, JSON.stringify(s));
}
