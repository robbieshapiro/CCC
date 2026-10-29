// The Design Desk: a member describes a mini golf hole, Claude lays it out from the club's tested parts, and it's
// kept as their draft. They can ask for changes, and the app asks for a fix when its test golfer can't hole it.
// POST /api/design { token, prompt }                     a new hole
// POST /api/design { token, id, change }                 the same hole, changed
// -> { id, spec } or { error }
// The spec is checked and clamped again in the app (src/designer/spec.ts tidy) before anything is built.
// Caps: 8 designs a day per member, 80 a day across the club. Needs ANTHROPIC_API_KEY, SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-opus-5-5';
const PER_MEMBER = 8;
const PER_CLUB = 80;

const SYSTEM = `You are the hole architect for the Claude Country Club, a small private online golf club for friends. Members describe a mini golf hole they'd like to play; you lay it out from the club's parts so it can be built and played in 3D. You work for Reginald, the club's dry, unhurried English secretary, who writes a one-line review of every hole.

How a hole is played: putter only, on felt, with low walls all round. The ball rolls; walls and obstacles bounce it; slopes bend it; a putt can roll about 130 ft on flat felt. Strokes are counted until it drops; members want to score 1 to 4.

THE LAYOUT
Positions are never in feet. A spot is { along, across }:
- along: 0 at the tee, 1 at the far end of the hole's centre line.
- across: -1 at the left edge of the lane, 0 the middle, 1 the right edge (left and right as seen walking from the tee).
Shapes (the centre line):
- straight: one straight lane.
- dogleg-left / dogleg-right: straight for 60% of the length, then a right-angle turn left or right for the rest. The corner is at along 0.6.
- zigzag: up (to along 0.36), across to the right (to 0.64), up again (to 1). Corners at 0.36 and 0.64.
- round: a lane for most of the way that opens into a round green at the end (the end third is round and wide).
length: 45 to 110 ft along the centre line. width: 12 to 26 ft. Longer and wider is not better: 55 to 85 ft and 14 to 20 ft wide is typical.

THE PARTS
- cup: where the hole is. along 0.55 to 1. Put it past the trouble, not in front of it.
- slopes (up to 6): mound (a hump that turns the ball away), dip (a hollow that gathers it: a dip on the cup makes a funnel), tilt-left / tilt-right (that stretch of lane falls away to that side). size small or big.
- obstacles (up to 14): stone (a headstone, or a rock by day), post (a thin pole), tree (a tree trunk). Each blocks about 2 ft; balls bounce off.
- fences (up to 4): a railing straight across the lane at one along, from one across to another. Leave gaps by not covering the whole width (e.g. from -0.6 to 0.6 leaves gaps at both edges).
- hazards (up to 3): a pool (slime by night, a pond by day, lava on the volcano) between two alongs and two acrosses. A ball that goes in costs a stroke and is played again. bridge true adds a 5 ft plank down the middle so the hazard can be crossed. Keep hazards off the tee and the cup, and on one leg (not over a corner).
- gimmicks (up to 3), each with a speed (slow, medium, fast):
  - pendulum: a scythe on a gallows swinging across the lane at that along; it knocks back anything it catches. Best on a bridge or a narrow stretch. Only on a leg that runs up the hole.
  - ghost: drifts from side to side across the lane at that along, blocking whatever's behind it.
  - cauldron: a big pot at that spot that boils over, pushing the ball away to one side, then the other.
  - tunnel: a hole in the ground at along/across that the ball drops into and pops out of at to_along/to_across, at rest. A shortcut: put the entrance somewhere tricky to hit.
  - pumpkin: a giant jack-o'-lantern built round the cup, its mouth facing the way the ball comes in, snapping open and shut; a crack in the back lets a ball in the long way. Only with a round shape or a lane at least 22 wide, and only once.
  Fields a gimmick doesn't use (to_along, to_across for everything but a tunnel) are ignored: set them to 0.
- look: night (moonlit, spooky: headstones, iron railings, slime), day (a garden course in sunshine), volcano (black rock and lava).

GOOD HOLES
- One clear idea per hole, from the member's description. Build what they asked for as faithfully as the parts allow; if they ask for something the parts can't do, get the spirit of it and say so in the hint.
- A safe way and a risky, quicker way. A hole in one should be possible but not likely; a careful player makes 2 or 3.
- Never block every route: there must always be a way from the tee to the cup round any fence, obstacle or hazard. Leave at least 3 ft between things the ball has to pass between.
- Not too busy: a few well-placed things beat a lot of clutter.
- name: a short, characterful name (2 to 4 words).
- review: Reginald's one-line review of the hole, dry and understated, under 25 words. No exclamation marks, no emojis, no em dashes.
- hint: one sentence, plain words, on how to play it.

When you're given an existing design and a change, return the whole design with the change made and everything else kept as it was.`;

const spot = { type: 'object', properties: { along: { type: 'number' }, across: { type: 'number' } }, required: ['along', 'across'], additionalProperties: false };
const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    look: { type: 'string', enum: ['night', 'day', 'volcano'] },
    shape: { type: 'string', enum: ['straight', 'dogleg-left', 'dogleg-right', 'zigzag', 'round'] },
    length: { type: 'number' },
    width: { type: 'number' },
    cup: spot,
    slopes: {
      type: 'array',
      items: { type: 'object', properties: { kind: { type: 'string', enum: ['mound', 'dip', 'tilt-left', 'tilt-right'] }, along: { type: 'number' }, across: { type: 'number' }, size: { type: 'string', enum: ['small', 'big'] } }, required: ['kind', 'along', 'across', 'size'], additionalProperties: false },
    },
    obstacles: {
      type: 'array',
      items: { type: 'object', properties: { kind: { type: 'string', enum: ['stone', 'post', 'tree'] }, along: { type: 'number' }, across: { type: 'number' } }, required: ['kind', 'along', 'across'], additionalProperties: false },
    },
    fences: {
      type: 'array',
      items: { type: 'object', properties: { along: { type: 'number' }, from: { type: 'number' }, to: { type: 'number' } }, required: ['along', 'from', 'to'], additionalProperties: false },
    },
    hazards: {
      type: 'array',
      items: { type: 'object', properties: { from: { type: 'number' }, to: { type: 'number' }, left: { type: 'number' }, right: { type: 'number' }, bridge: { type: 'boolean' } }, required: ['from', 'to', 'left', 'right', 'bridge'], additionalProperties: false },
    },
    gimmicks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { kind: { type: 'string', enum: ['pendulum', 'ghost', 'cauldron', 'tunnel', 'pumpkin'] }, along: { type: 'number' }, across: { type: 'number' }, speed: { type: 'string', enum: ['slow', 'medium', 'fast'] }, to_along: { type: 'number' }, to_across: { type: 'number' } },
        required: ['kind', 'along', 'across', 'speed', 'to_along', 'to_across'],
        additionalProperties: false,
      },
    },
    review: { type: 'string' },
    hint: { type: 'string' },
  },
  required: ['name', 'look', 'shape', 'length', 'width', 'cup', 'slopes', 'obstacles', 'fences', 'hazards', 'gimmicks', 'review', 'hint'],
  additionalProperties: false,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function POST(request: Request) {
  const { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'The Design Desk opens once the club has its Claude key.' }, 503);
  const body = (await request.json().catch(() => null)) as { token?: string; prompt?: string; id?: number; change?: string } | null;
  const prompt = String(body?.prompt ?? '').trim().slice(0, 600);
  const change = String(body?.change ?? '').trim().slice(0, 400);
  if (!body?.token || (!prompt && !(body.id && change))) return json({ error: 'Describe your hole first.' }, 400);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: me } = await db.from('players').select('id, name').eq('token', body.token).maybeSingle();
  if (!me) return json({ error: 'Members only.' }, 401);

  const since = new Date(Date.now() - 86400000).toISOString();
  const [{ count: mine }, { count: all }] = await Promise.all([
    db.from('design_calls').select('id', { count: 'exact', head: true }).eq('player_id', me.id).gte('created_at', since),
    db.from('design_calls').select('id', { count: 'exact', head: true }).gte('created_at', since),
  ]);
  if ((mine ?? 0) >= PER_MEMBER) return json({ error: "That's enough architecture for one day. The Desk reopens tomorrow." }, 429);
  if ((all ?? 0) >= PER_CLUB) return json({ error: 'The Desk is closed for the day. Too many architects.' }, 429);

  // the design to change, if this is a change
  let previous: { id: number; prompt: string; spec: unknown } | null = null;
  if (body.id) {
    const { data } = await db.from('designs').select('id, prompt, spec, player_id, status').eq('id', body.id).maybeSingle();
    if (!data || data.player_id !== me.id) return json({ error: 'Not your hole.' }, 403);
    if (data.status !== 'draft') return json({ error: "It's with the Committee now. Start a new one." }, 409);
    previous = data;
  }
  const content = previous
    ? `${me.name} described this hole: "${previous.prompt}"\n\nThe current design:\n${JSON.stringify(previous.spec)}\n\nChange it: ${change}`
    : `${me.name} describes the hole they'd like:\n"${prompt}"`;

  await db.from('design_calls').insert({ player_id: me.id });
  const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  try {
    const res = await claude.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    if (res.stop_reason === 'refusal') return json({ error: "The architect won't build that one. Try another idea." }, 422);
    if (res.stop_reason !== 'end_turn') return json({ error: 'The architect ran out of paper. Try a simpler idea.' }, 502);
    const spec = JSON.parse(res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')) as Record<string, unknown>;
    for (const k of ['review', 'hint', 'name']) if (typeof spec[k] === 'string') spec[k] = (spec[k] as string).replace(/\s*[—–]\s*/g, ', ');
    if (previous) {
      await db.from('designs').update({ spec, par: null }).eq('id', previous.id);
      return json({ id: previous.id, spec });
    }
    const { data: row, error } = await db.from('designs').insert({ player_id: me.id, prompt, spec }).select('id').single();
    if (error || !row) return json({ error: "Couldn't file the drawing. Try again." }, 500);
    return json({ id: row.id, spec });
  } catch (err) {
    console.error('design', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return json({ error: 'The architect is out. Try again in a minute.' }, 502);
  }
}
