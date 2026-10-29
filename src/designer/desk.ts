// The Design Desk's helpers: ask the architect (api/design.ts, or a stock hole in local mode), and build and check
// what comes back.
import { localApi, useSupabase } from '../api';
import type { Design } from '../api/types';
import { requireSession } from '../state';
import { buildHole, checkHole, type Check, type HoleSpec } from './hole';

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

// build it and run the quick check
export function tryHole(spec: HoleSpec, id = 'draft'): Check & { warnings: string[] } {
  const { hole, warnings } = buildHole(spec, id);
  return { ...checkHole(hole, spec), warnings };
}

// the Design Desk only builds full holes now; the early mini golf drafts are left out
export const isHole = (d: Pick<Design, 'spec'>) => (d.spec as { kind?: string } | null)?.kind === 'hole';
