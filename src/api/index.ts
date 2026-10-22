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

export function setSession(s: Session | null) {
  if (s) store.set(SESSION_KEY, JSON.stringify(s));
  else store.remove(SESSION_KEY);
}
