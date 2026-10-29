// The Clubhouse Chronicle: Reginald's weekly letter to each club, written by Claude from the week just gone.
// GET  /api/chronicle            the Monday cron (vercel.json): an edition for every club that played this week
// POST /api/chronicle { token }  the admin, from the Committee Room: this week's edition for their club, now
// Each club gets at most one edition a week (kept in chronicles); asking again hands back the one already written.
// Needs ANTHROPIC_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; CRON_SECRET, if set, guards the GET.
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const MODEL = 'claude-opus-5-5';
const COURSES: Record<string, string> = { highlands: 'The Highlands Course', caldera: 'The Caldera Course' };

const SYSTEM = `You are Reginald, the Club Secretary of the Claude Country Club, a small private online golf club for friends. Each month there is a new 3D course; members play it as often as they like and their best round counts, and the lowest round when the month closes goes on the club's plaque. There is also a daily Closest to the Pin, and weekly bar games (Hollow Hills haunted mini golf, the long drive).

Each Monday you write the Clubhouse Chronicle, a short weekly letter to the members of one club about the week just gone.

Your voice: English, dry, unhurried, a little formal. Understatement over excitement. Secretly fond of every member and proud of a good score, but you would never say so plainly. Gentle ribbing is fine; never mean, never crude.

The letter:
- A headline (under 8 words) and a one-line dek under it.
- Three to five short items, each with a title (under 6 words) and a body of one to three sentences. Lead with the best story of the week: a new leader, a personal best, a hole in one, a close race, a newcomer, a collapse on one hole. Then the standings with days left in the month, then the bar and the daily shot if anything happened there.
- A one-line sign-off.
- Under 230 words in all.
- Use only facts in the data. Never invent a score, a person, a quote or an event. Name members by first name as given.
- No exclamation marks except for a hole in one. No emojis, no hashtags, no em dashes.`;

const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    dek: { type: 'string' },
    items: {
      type: 'array',
      items: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'], additionalProperties: false },
    },
    signoff: { type: 'string' },
  },
  required: ['headline', 'dek', 'items', 'signoff'],
  additionalProperties: false,
};
type Edition = { headline: string; dek: string; items: { title: string; body: string }[]; signoff: string };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const undash = (s: string) => s.replace(/\s*[—–]\s*/g, ', ').trim();

// Monday of this week, Eastern, as YYYY-MM-DD
function thisMonday() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  et.setDate(et.getDate() - ((et.getDay() + 6) % 7));
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, '0')}-${String(et.getDate()).padStart(2, '0')}`;
}

function daysLeft() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const end = new Date(et.getFullYear(), et.getMonth() + 1, 1);
  return Math.max(0, Math.round((end.getTime() - et.getTime()) / 86400000));
}

async function write(db: SupabaseClient, claude: Anthropic, group: string, week: string): Promise<Edition | null> {
  const { data: kept } = await db.from('chronicles').select('body').eq('group_id', group).eq('week', week).maybeSingle();
  if (kept) return kept.body as Edition;
  const { data: facts, error } = await db.rpc('chronicle_facts', { p_group: group });
  if (error || !facts) return null;
  const f = facts as { rounds_this_week: { course: string }[] } & Record<string, unknown>;
  f.rounds_this_week = f.rounds_this_week.map((r) => ({ ...r, course: COURSES[r.course] ?? r.course }));
  const res = await claude.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: `Write this week's Chronicle (week of ${week}, ${daysLeft()} days left in the month).\n\n<club_data>\n${JSON.stringify(f, null, 1)}\n</club_data>` }],
  });
  if (res.stop_reason !== 'end_turn') return null;
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let ed: Edition;
  try {
    ed = JSON.parse(text) as Edition;
  } catch {
    return null;
  }
  ed = { headline: undash(ed.headline), dek: undash(ed.dek), items: ed.items.slice(0, 6).map((i) => ({ title: undash(i.title), body: undash(i.body) })), signoff: undash(ed.signoff) };
  await db.from('chronicles').upsert({ group_id: group, week, body: ed }, { onConflict: 'group_id,week', ignoreDuplicates: true });
  return ed;
}

function clients() {
  const { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return { db: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }), claude: new Anthropic({ apiKey: ANTHROPIC_API_KEY }) };
}

// the Monday cron: every club that played this week
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'no' }, 401);
  const c = clients();
  if (!c) return json({ written: 0, why: 'not configured' });
  const { data: groups } = await c.db.rpc('chronicle_clubs');
  const week = thisMonday();
  let written = 0;
  for (const g of (groups ?? []) as string[]) {
    try {
      if (await write(c.db, c.claude, g, week)) written++;
    } catch (err) {
      console.error('chronicle', g, err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    }
  }
  return json({ written });
}

// the admin, now: this week's edition for the club they're in
export async function POST(request: Request) {
  const c = clients();
  if (!c) return json({ edition: null, why: 'not configured' });
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) return json({ edition: null }, 400);
  const { data: me } = await c.db.from('players').select('group_id, role').eq('token', body.token).maybeSingle();
  if (!me || me.role !== 'admin') return json({ edition: null, why: 'committee only' }, 403);
  try {
    return json({ edition: await write(c.db, c.claude, me.group_id as string, thisMonday()) });
  } catch (err) {
    console.error('chronicle', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return json({ edition: null, why: 'unavailable' });
  }
}
