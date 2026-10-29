// The Design Desk: a member describes a golf hole, Claude lays it out (tee, fairway, green, bunkers, water, trees,
// elevation, in one of four looks), and it's kept as their draft. They can ask for changes, and the app asks for a fix
// when its quick check finds a problem.
// POST /api/design { token, prompt }                     a new hole
// POST /api/design { token, id, change }                 the same hole, changed
// -> { id, spec } or { error }
// The spec is checked and clamped again in the app (src/designer/hole.ts tidy) before anything is built.
// Caps: 8 designs a day per member, 80 a day across the club. Needs ANTHROPIC_API_KEY, SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-opus-5-5';
const PER_MEMBER = 8;
const PER_CLUB = 80;

const SYSTEM = `You are the golf course architect for the Claude Country Club, a small private online golf club for friends. Members describe a golf hole they'd love to play; you lay it out so it can be built and played in 3D. You work for Reginald, the club's dry, unhurried English secretary, who writes a one-line review of every hole.

How the game plays: real golf in miniature. A driver carries about 220 to 250 yards, an iron 50 to 130, a wedge up to 65, then chip and putt. Wind blows. Members score their par or a bogey on a fair hole, and love the odd birdie.

THE LAYOUT
Positions are never in yards. A spot is { along, across }:
- along: 0 at the tee, 1 at the middle of the green, measured down the centre line of the hole.
- across: in fairway half-widths from the centre line. 0 the middle; -1 and 1 the fairway's left and right edges; -2 or 2 deep in the rough; -3.5 or 3.5 the edge of the property (out of bounds beyond). Left and right as seen from the tee.
- yards: the length along the centre line. Par follows from it: up to 250 is a par 3, up to 490 a par 4, longer a par 5 (up to 600). Set par to match.
- shape: straight; dogleg-left or dogleg-right (one bend at bend_at, turning by bend degrees, 10 to 75); double-dogleg (bends one way at bend_at and back again halfway to the green).
- elevation: flat, downhill (tee above the fairway), uphill (climbs to the green), tee-high (a tee perched far above), valley (down into a dip and up to the green), climb (a steady climb to a high green).
- fairway: width narrow, medium or wide; from and to (along) where the mown fairway starts and stops. On par 4s and 5s the fairway usually starts around 0.3 (the forward rough is a carry); a par 3 has only a short apron in front of the green.
- green: size small, medium or large; slope (flat, back-to-front, front-to-back, left-to-right, right-to-left); tiered (a step across the middle); raised (up on a plateau); across (-1 to 1) to set it off the centre line.
- bunkers (up to 12): along, across, size, kind: fairway, greenside, pot (small and deep, links style), waste (a broad sandy area, desert style).
- water (up to 3): kind pond (along, across, size), creek (crosses the whole hole at along: a carry), or sea (all along one side, beyond the rough; links and the Caldera only; set side left or right). In the Caldera look, ponds and creeks are lava. Fields a kind doesn't use can be anything sensible.
- trees (up to 10 groups): along, across, count (1 to 12), spread tight or loose. They are pines and oaks in the Highlands, palms and rocks in the Caldera, gorse and rocks on the links, cacti and rocks in the desert. The edges of the property are planted for you.
- mounds (up to 6): along, across, size.
- look: highlands (parkland: pines, oaks, lakes, mountains), caldera (a volcanic island: black sand, lava, palms, the sea), links (seaside: dunes, fescue, pot bunkers, wind), desert (sand waste, cacti, red mesas). If the member asks for something else, pick the closest and get its spirit across in the features.

GOOD HOLES
- Build what the member describes as faithfully as these parts allow. If they ask for something the parts can't do, get the spirit of it and say so in the hint.
- Strategy: give the hole a question to answer. A safe side and a bold line that's rewarded; a bunker or hazard that eats the greedy shot; the green angled or guarded so the approach from the right spot is easier. Think of the great architects.
- Fair: there must be somewhere for a drive to land (about 210 to 290 yards out on par 4s and 5s), a way to the green that doesn't need a miracle, and nothing on the tee or the green. A par 3 over water should be 230 yards or less.
- Keep features where they matter: greenside bunkers near along 0.9 to 1.05 and across about ±1.3; fairway bunkers where drives land.
- name: short and characterful (2 to 4 words).
- review: Reginald's one-line review, dry and understated, under 25 words. No exclamation marks, no emojis, no em dashes.
- hint: one sentence, plain words, on how to play it.

When you're given an existing design and a change, return the whole design with the change made and everything else kept as it was.`;

const spot = (extra: Record<string, unknown>, req: string[]) => ({
  type: 'object',
  properties: { along: { type: 'number' }, across: { type: 'number' }, ...extra },
  required: ['along', 'across', ...req],
  additionalProperties: false,
});
const size = { type: 'string', enum: ['small', 'medium', 'large'] };
const SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['hole'] },
    name: { type: 'string' },
    look: { type: 'string', enum: ['highlands', 'caldera', 'links', 'desert'] },
    par: { type: 'integer', enum: [3, 4, 5] },
    yards: { type: 'number' },
    shape: { type: 'string', enum: ['straight', 'dogleg-left', 'dogleg-right', 'double-dogleg'] },
    bend_at: { type: 'number' },
    bend: { type: 'number' },
    elevation: { type: 'string', enum: ['flat', 'downhill', 'uphill', 'tee-high', 'valley', 'climb'] },
    fairway: {
      type: 'object',
      properties: { width: { type: 'string', enum: ['narrow', 'medium', 'wide'] }, from: { type: 'number' }, to: { type: 'number' } },
      required: ['width', 'from', 'to'],
      additionalProperties: false,
    },
    green: {
      type: 'object',
      properties: {
        size,
        slope: { type: 'string', enum: ['flat', 'back-to-front', 'front-to-back', 'left-to-right', 'right-to-left'] },
        tiered: { type: 'boolean' },
        raised: { type: 'boolean' },
        across: { type: 'number' },
      },
      required: ['size', 'slope', 'tiered', 'raised', 'across'],
      additionalProperties: false,
    },
    bunkers: { type: 'array', items: spot({ size, kind: { type: 'string', enum: ['fairway', 'greenside', 'pot', 'waste'] } }, ['size', 'kind']) },
    water: { type: 'array', items: spot({ kind: { type: 'string', enum: ['pond', 'creek', 'sea'] }, size, side: { type: 'string', enum: ['left', 'right'] } }, ['kind', 'size', 'side']) },
    trees: { type: 'array', items: spot({ count: { type: 'integer' }, spread: { type: 'string', enum: ['tight', 'loose'] } }, ['count', 'spread']) },
    mounds: { type: 'array', items: spot({ size }, ['size']) },
    review: { type: 'string' },
    hint: { type: 'string' },
  },
  required: ['kind', 'name', 'look', 'par', 'yards', 'shape', 'bend_at', 'bend', 'elevation', 'fairway', 'green', 'bunkers', 'water', 'trees', 'mounds', 'review', 'hint'],
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
