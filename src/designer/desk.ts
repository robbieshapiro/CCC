// The Design Desk's helpers: ask the architect (api/design.ts, or a stock hole in local mode) and have the test
// golfer try the result (check.worker.ts).
import { localApi, useSupabase } from '../api';
import { requireSession } from '../state';
import type { HoleSpec } from './spec';
import type { TryResult } from './check.worker';

export type DesignReply = { id: number; spec: HoleSpec } | { error: string };

export async function askArchitect(args: { prompt: string } | { id: number; change: string }): Promise<DesignReply> {
  const s = requireSession();
  if (!useSupabase) {
    await new Promise((r) => setTimeout(r, 900));
    return 'prompt' in args ? localApi.localDesign(s, args.prompt) : localApi.localDesign(s, '', args.id, args.change);
  }
  try {
    const res = await fetch('/api/design', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: s.token, ...args }) });
    const body = (await res.json().catch(() => null)) as DesignReply | null;
    return body ?? { error: 'The architect is out. Try again in a minute.' };
  } catch {
    return { error: 'No connection to the Design Desk.' };
  }
}

export function tryHole(spec: HoleSpec): Promise<TryResult> {
  return new Promise((resolve) => {
    const w = new Worker(new URL('./check.worker.ts', import.meta.url), { type: 'module' });
    const done = (r: TryResult) => {
      w.terminate();
      resolve(r);
    };
    const timer = window.setTimeout(() => done({ ok: true, strokes: 0, par: 3, reason: '', warnings: ['The test golfer took too long; par set at 3.'] }), 90000);
    w.onmessage = (e: MessageEvent<TryResult>) => {
      window.clearTimeout(timer);
      done(e.data);
    };
    w.onerror = () => {
      window.clearTimeout(timer);
      done({ ok: true, strokes: 0, par: 3, reason: '', warnings: ["The test golfer couldn't play it here; par set at 3."] });
    };
    w.postMessage(spec);
  });
}
