// Reginald, written by Claude: a line for your Play page each day, a note on your card after each round, and a word
// for the club's new champion (one line per club per title, the same for everyone, for the two days after it's won).
// POST /api/reginald { token, kind: 'daily' | 'round' | 'champion', course: { name, holes: [{ name, par }] } }
// -> { text } or { text: null } (the app keeps its own scripted line whenever there's nothing here).
//
// The member's session token is checked by reading their snapshot from Supabase; everything Reginald says about
// them comes from that, not from the request (the course's hole names are the only thing the app sends, and
// they're clamped). Each line is written once and kept: one daily line per member per day, one note per round,
// with caps per member and for the whole club so the bill can't run away. Needs ANTHROPIC_API_KEY,
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the Vercel environment.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-opus-5-5';
const ROUND_NOTES_A_DAY = 12; // per member
const CLUB_LINES_A_DAY = 400; // across everyone, as a backstop

// Reginald's brief (the same as STAFF.reginald in src/staff.ts)
const SYSTEM = `You are Reginald, the Club Secretary of the Claude Country Club, a small private online golf club for friends. A new 3D course each week, Sunday to Saturday (it was each month until October 2026); members play it as often as they like and their best round counts, and the lowest round when the week closes on Saturday night wins the title. There is also the Open (one board across every club), a daily Closest to the Pin, and bar games (mini golf, long drive).

Who you are: you run everything. English, dry, unhurried, a little formal. Understatement over excitement. Secretly fond of every member and proud of a good score, but you would never say so plainly.

How you write:
- One or two short sentences. Under 35 words.
- Use one specific, true detail from the data you're given. Never invent a fact, a score, a person or an event that isn't in the data.
- Never mean, never crude, never shout. No exclamation marks except for a hole in one. No emojis, no hashtags, no em dashes, no quotation marks around the whole line.
- Speak to the member directly. Use their name at most once.
- Write only the line itself: no preamble, no sign-off, no "Reginald:".`;

type Snapshot = {
  me: string;
  groupName: string;
  month: string;
  today: string;
  players: { id: string; name: string; host?: boolean; wins: number; career?: { rounds: number; best: number | null } }[];
  rounds: { playerId: string; course: string; holes: number[]; total: number; par: number; feats: string[]; createdAt: string }[];
  champions: { month: string; playerIds: string[]; total: number; par: number; how?: string }[];
};
type Honors = {
  champions: { name: string; toPar: number; how?: string }[];
  runnersUp: { name: string; toPar: number }[];
  mostRounds: { names: string[]; count?: number } | null;
  aces: { name: string; count: number }[];
  lowestAverage: { names: string[]; avg?: number } | null;
};
const SPAN_NAMES = (period: string) =>
  period.length === 7 ? new Date(`${period}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : period === '2026-10-30' ? 'the Caldera challenge' : `the week of ${period}`;

// The champion's word: what Reginald knows about the title just won at this club
function championFacts(s: Snapshot, h: Honors, played: number) {
  const last = s.champions[0];
  const names = h.champions.map((c) => c.name);
  const margin = h.runnersUp[0] ? h.runnersUp[0].toPar - h.champions[0].toPar : null;
  return {
    club: s.groupName,
    period_won: SPAN_NAMES(last.month),
    champion: names.join(' & '),
    shared_title: names.length > 1,
    won_in_a_playoff: last.how === 'playoff-won',
    winning_score: `${last.total}, ${toPar(last.total - last.par)}`,
    margin: margin === null ? 'nobody else posted a round' : margin === 0 ? 'level with the runner-up on the board' : `${margin} ${margin === 1 ? 'shot' : 'shots'} clear`,
    runner_up: h.runnersUp.length ? `${h.runnersUp.map((r) => r.name).join(' & ')}, ${toPar(h.runnersUp[0].toPar)}` : null,
    members_who_played: played,
    most_rounds: h.mostRounds ? `${h.mostRounds.names.join(' & ')}, ${h.mostRounds.count} rounds` : null,
    aces: h.aces.map((a) => a.name),
    titles_all_time: last.playerIds.map((id) => s.players.find((p) => p.id === id)).filter(Boolean).map((p) => `${p!.name}: ${p!.wins}`),
  };
}
type Course = { name: string; holes: { name: string; par: number }[] };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[^\p{L}\p{N} '’.,&-]/gu, '').slice(0, n);
// The game period (src/day.ts has the full rule): 'YYYY-MM' months to October 2026, the Caldera challenge
// ('2026-10-30', to 7 November), then Sunday-to-Saturday weeks keyed by their Sunday.
// The day the next one starts, and what members call it.
function periodEnds(period: string) {
  if (period === '2026-10-30') return '2026-11-08';
  if (period.length === 10) return new Date(Date.parse(`${period}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  if (period === '2026-10') return '2026-10-30'; // October closed early, for the Caldera challenge
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}
const span = (period: string) => (period < '2026-10-30' ? 'month' : 'week');

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const toPar = (d: number) => (d === 0 ? 'level par' : d > 0 ? `${d} over par` : `${-d} under par`);

function cleanCourse(c: unknown): Course | null {
  const x = c as Course | undefined;
  if (!x || !Array.isArray(x.holes)) return null;
  return { name: clean(x.name, 40), holes: x.holes.slice(0, 12).map((h) => ({ name: clean(h?.name, 40), par: Math.max(2, Math.min(6, Number(h?.par) || 4)) })) };
}

// What Reginald knows: the member's month, where they stand in the club and the Open, their rival, and their rounds
function facts(snap: Snapshot, open: { name: string; total: number; par: number; mine: boolean }[], course: Course) {
  const me = snap.players.find((p) => p.id === snap.me)!;
  const members = snap.players.filter((p) => !p.host);
  const bests = members
    .map((p) => {
      const rs = snap.rounds.filter((r) => r.playerId === p.id);
      const best = rs.length ? Math.min(...rs.map((r) => r.total - r.par)) : null;
      return { name: p.name, id: p.id, best, rounds: rs.length };
    })
    .filter((b) => b.best !== null)
    .sort((a, b) => a.best! - b.best!);
  const mine = bests.findIndex((b) => b.id === me.id);
  // places are shared on a tie, as on the board
  const place = (i: number) => {
    const level = bests.filter((b) => b.best === bests[i].best && b.id !== bests[i].id).map((b) => b.name);
    const at = bests.filter((b) => b.best! < bests[i].best!).length + 1;
    return `${level.length ? 'tied ' : ''}${ordinal(at)}${level.length ? ` with ${level.join(' & ')}` : ''} of ${bests.length} who have played`;
  };
  const ahead = mine > 0 ? bests.filter((b) => b.best! < bests[mine].best!).pop() : undefined;
  const behind = mine >= 0 ? bests.find((b) => b.best! > bests[mine].best!) : undefined;
  const leaders = bests.filter((b) => b.best === bests[0]?.best).map((b) => b.name);
  const myRounds = snap.rounds.filter((r) => r.playerId === me.id);
  const daysLeft = Math.max(0, Math.round((Date.parse(`${periodEnds(snap.month)}T12:00:00Z`) - Date.parse(`${snap.today}T12:00:00Z`)) / 86400000));
  // the hole that's cost them most this period, against par
  const worst = course.holes
    .map((h, i) => ({ name: h.name, over: myRounds.reduce((a, r) => a + ((r.holes[i] ?? h.par) - h.par), 0) / (myRounds.length || 1) }))
    .sort((a, b) => b.over - a.over)[0];
  const meOpen = open.find((r) => r.mine);
  const openAt = meOpen ? open.filter((r) => r.total - r.par < meOpen.total - meOpen.par).length + 1 : 0;
  const openLevel = meOpen ? open.filter((r) => !r.mine && r.total - r.par === meOpen.total - meOpen.par).length : 0;
  return {
    member: me.name,
    club: snap.groupName,
    today: snap.today,
    course: `${course.name}, ${course.holes.length} holes, par ${course.holes.reduce((a, h) => a + h.par, 0)}`,
    [`days_left_this_${span(snap.month)}`]: daysLeft,
    board_closes: daysLeft <= 1 ? 'tonight at midnight Eastern' : `${new Date(`${periodEnds(snap.month)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })} at midnight Eastern (as that day begins)`,
    ...(snap.month === '2026-10'
      ? { club_news: 'The Committee is closing October early: the board closes at midnight tonight, Thursday 29 October, and the champion is crowned. The Caldera challenge opens at once, on Friday: all six holes of the Caldera, par 25, through Saturday 7 November. Weekly courses start Sunday 8 November.' }
      : {}),
    titles_all_time: me.wins,
    career: me.career,
    [`this_${span(snap.month)}`]: {
      rounds: myRounds.length,
      best: mine >= 0 ? toPar(bests[mine].best!) : 'no round yet',
      place_in_club: mine >= 0 ? `${place(mine)} (${members.length} members)` : null,
      leading: bests[0] ? `${leaders.join(' & ')}, ${toPar(bests[0].best!)}` : 'nobody has played yet',
      next_one_ahead: ahead ? `${ahead.name}, ${toPar(ahead.best!)}` : null,
      next_one_behind: behind ? `${behind.name}, ${toPar(behind.best!)}` : null,
      costliest_hole: worst && myRounds.length && worst.over > 0.4 ? `${worst.name}, about ${worst.over.toFixed(1)} over par on average` : null,
    },
    the_open: meOpen ? `${openLevel ? 'tied ' : ''}${ordinal(openAt)} of ${open.length} across every club; best is ${toPar(open[0].total - open[0].par)}` : `${open.length} have played across every club`,
    last_champion: snap.champions[0] ? `${snap.champions[0].month}: ${snap.champions[0].playerIds.map((id) => snap.players.find((p) => p.id === id)?.name ?? 'a former member').join(' & ')}` : null,
  };
}

function roundFacts(snap: Snapshot, course: Course) {
  const mine = snap.rounds.filter((r) => r.playerId === snap.me);
  const r = mine[mine.length - 1];
  if (!r || Date.now() - new Date(r.createdAt).getTime() > 15 * 60_000) return null;
  const before = mine.slice(0, -1);
  const prevBest = before.length ? Math.min(...before.map((x) => x.total - x.par)) : null;
  return {
    key: r.createdAt,
    round: {
      score: `${r.total}, ${toPar(r.total - r.par)}`,
      holes: course.holes.map((h, i) => `${h.name} (par ${h.par}): ${r.holes[i] ?? '-'}`),
      feats: r.feats,
      [`personal_best_this_${span(snap.month)}`]: prevBest === null ? `first round this ${span(snap.month)}` : r.total - r.par < prevBest ? `new best, was ${toPar(prevBest)}` : `best is still ${toPar(prevBest)}`,
    },
  };
}

export async function POST(request: Request) {
  const { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ text: null, why: 'not configured' });
  const body = (await request.json().catch(() => null)) as { token?: string; kind?: string; course?: unknown } | null;
  const kind = body?.kind === 'round' ? 'round' : body?.kind === 'daily' ? 'daily' : body?.kind === 'champion' ? 'champion' : null;
  const course = cleanCourse(body?.course);
  if (!body?.token || !kind || (!course && kind !== 'champion')) return json({ text: null, why: 'bad request' }, 400);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: snap, error } = await db.rpc('get_snapshot', { p_token: body.token });
  if (error || !snap) return json({ text: null, why: 'not a member' }, 401);
  const s = snap as Snapshot;
  const me = s.players.find((p) => p.id === s.me);
  if (!me) return json({ text: null }, 401);

  if (kind === 'champion') return champion(db, s, body.token);
  const round = kind === 'round' ? roundFacts(s, course!) : null;
  if (kind === 'round' && !round) return json({ text: null, why: 'no recent round' });
  // a day's line is about the board as it stands, so it's kept for the day and for when the board closes: a schedule
  // change gets a fresh one
  const key = kind === 'daily' ? `${s.today}>${periodEnds(s.month)}` : round!.key;

  // already written: hand it back
  const { data: kept } = await db.from('reginald_notes').select('body').eq('player_id', me.id).eq('kind', kind).eq('key', key).maybeSingle();
  if (kept) return json({ text: kept.body });

  // the caps
  const since = new Date(Date.now() - 86400000).toISOString();
  const [{ count: mineToday }, { count: allToday }] = await Promise.all([
    db.from('reginald_notes').select('id', { count: 'exact', head: true }).eq('player_id', me.id).eq('kind', 'round').gte('created_at', since),
    db.from('reginald_notes').select('id', { count: 'exact', head: true }).gte('created_at', since),
  ]);
  if ((kind === 'round' && (mineToday ?? 0) >= ROUND_NOTES_A_DAY) || (allToday ?? 0) >= CLUB_LINES_A_DAY) return json({ text: null, why: 'cap' });

  const { data: open } = await db.rpc('open_board', { p_token: body.token });
  const context = { ...facts(s, (open ?? []) as { name: string; total: number; par: number; mine: boolean }[], course!), ...(round ? { just_played: round.round } : {}) };
  const task =
    kind === 'daily'
      ? `Write today's greeting for ${me.name}, shown at the top of the club's Play page above the button to play this ${span(s.month)}'s course. Make them want to play today.`
      : `${me.name} has just finished a round of this ${span(s.month)}'s course (just_played). Write your note on their scorecard about this round: the moment that mattered most, and what it means for their ${span(s.month)}.`;

  const text = await write(task, context);
  if (text === undefined) return json({ text: null, why: 'unavailable' });
  if (!text) return json({ text: null });
  await db.from('reginald_notes').upsert({ player_id: me.id, kind, key, body: text }, { onConflict: 'player_id,kind,key', ignoreDuplicates: true });
  return json({ text });
}

// One line from Claude in Reginald's voice: the text, '' when there's nothing (or a refusal), undefined on an error
async function write(task: string, context: unknown): Promise<string | undefined> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const res = await claude.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `${task}\n\n<club_data>\n${JSON.stringify(context, null, 1)}\n</club_data>` }],
    });
    if (res.stop_reason === 'refusal') return '';
    return res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .replace(/\s*[—–]\s*/g, ', ')
      .trim()
      .replace(/^["“]|["”]$/g, '')
      .trim()
      .slice(0, 280);
  } catch (err) {
    console.error('reginald', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return undefined;
  }
}

// The champion's word: one line per club per title, kept under the (first) champion's name and shared with the whole
// club; only for the two days after the title is won, and never for a title still being played off
// the service-role client, untyped like the rest of this file
type Db = ReturnType<typeof createClient<any>>;
async function champion(db: Db, s: Snapshot, token: string) {
  const last = s.champions[0];
  if (!last || last.how === 'playoff') return json({ text: null, why: 'no champion' });
  const won = periodEnds(last.month);
  const days = Math.round((Date.parse(`${s.today}T12:00:00Z`) - Date.parse(`${won}T12:00:00Z`)) / 86400000);
  if (days < 0 || days > 1) return json({ text: null, why: 'not now' });
  const key = `${last.month}`;
  const { data: kept } = await db.from('reginald_notes').select('body').eq('player_id', last.playerIds[0]).eq('kind', 'champion').eq('key', key).maybeSingle();
  if (kept) return json({ text: (kept as { body: string }).body });
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count: allToday } = await db.from('reginald_notes').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((allToday ?? 0) >= CLUB_LINES_A_DAY) return json({ text: null, why: 'cap' });
  const { data: honors } = await db.rpc('period_honors', { p_token: token, p_period: last.month });
  if (!honors) return json({ text: null, why: 'no honours' });
  const h = honors as Honors & { runnersUp: Honors['runnersUp'] };
  const { data: played } = await db.from('rounds').select('player_id').eq('month', last.month).in('player_id', s.players.filter((p) => !p.host).map((p) => p.id));
  const task = `${h.champions.map((c) => c.name).join(' & ')} won the club title for ${SPAN_NAMES(last.month)}. Write your word of congratulation, shown at the top of the club's home page for every member for the next two days. Speak to the club about the champion, and use one or two true details from the data (the score, the margin, a rival, the rounds it took).`;
  const text = await write(task, championFacts(s, h, new Set((played ?? []).map((r) => (r as { player_id: string }).player_id)).size));
  if (!text) return json({ text: null, why: 'unavailable' });
  await db.from('reginald_notes').upsert({ player_id: last.playerIds[0], kind: 'champion', key, body: text }, { onConflict: 'player_id,kind,key', ignoreDuplicates: true });
  return json({ text });
}
