// Reginald, written by Claude (api/reginald.ts): today's line for the Play page and a note on the card after a
// round. Best-effort: the scripted lines show first, and stay whenever there's nothing back (local mode, no API
// key yet, a slow answer, a cap). A day's line is kept on the device so the page doesn't ask twice.
import { useSupabase } from './api';
import type { Course } from './golf3d/courses';
import { requireSession } from './state';
import { store } from './storage';

export async function askReginald(kind: 'daily' | 'round', course: Course, today: string): Promise<string | null> {
  if (!useSupabase) return null;
  const s = requireSession();
  const key = `ccc-reg-${s.groupId}-${today}`;
  if (kind === 'daily') {
    const kept = store.get(key);
    if (kept) return kept;
  }
  try {
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 20000);
    const res = await fetch('/api/reginald', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: s.token, kind, course: { name: course.name, holes: course.holes.map((h) => ({ name: h.name, par: h.par })) } }),
      signal: ctl.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const { text } = (await res.json()) as { text: string | null };
    if (text && kind === 'daily') store.set(key, text);
    return text || null;
  } catch {
    return null;
  }
}
