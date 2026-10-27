import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, Feedback, Invite, InvitePeek, MemberActivity, Notice, OpenChampion, OpenRow, PracticeReport, Session, Snapshot } from './types';

// Forgive common paste slips in the env vars: quotes, spaces, a missing https://,
// a trailing slash or /rest/v1, or just the project ref.
export function cleanUrl(raw: string): string {
  let u = (raw ?? '').trim().replace(/^['"]|['"]$/g, '').trim();
  if (/^[a-z0-9]{20}$/i.test(u)) u = `${u}.supabase.co`;
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/(rest\/v1\/?)?$/, '');
}

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  const url = cleanUrl(import.meta.env.VITE_SUPABASE_URL);
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim().replace(/^['"]|['"]$/g, '');
  try {
    new URL(url);
  } catch {
    throw new Error("The club's database address isn't set up right. In Vercel, VITE_SUPABASE_URL should look like https://abcd1234.supabase.co");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// All reads and writes go through security-definer functions in supabase/schema.sql.
export const supabaseApi: Api = {
  mode: 'supabase',
  join: (invite, name, pin) => rpc('join_group', { p_invite: invite, p_name: name, p_pin: pin }),
  signIn: (name, pin) => rpc('sign_in', { p_name: name, p_pin: pin }),
  myClubs: async (name, pin) => {
    try {
      return await rpc<Session[]>('my_clubs', { p_name: name, p_pin: pin });
    } catch (err) {
      // a database without clubs yet: the one-club sign-in still works
      if (!/my_clubs|function|schema cache/i.test((err as Error).message)) throw err;
      return [await rpc<Session>('sign_in', { p_name: name, p_pin: pin })];
    }
  },
  createClub: (s, name) => rpc<Session>('create_club', { p_token: s.token, p_name: name }),
  snapshot: (s) => rpc<Snapshot>('get_snapshot', { p_token: s.token }),
  submitRound: async (s, r) => {
    const args = { p_token: s.token, p_course: r.course, p_holes: r.holes, p_pars: r.pars, p_feats: r.feats };
    try {
      await rpc('submit_round', { ...args, p_spots: r.spots ?? null });
    } catch (err) {
      // a database without tee-shot spots yet: the score still counts
      if (!/submit_round|function|schema cache/i.test((err as Error).message)) throw err;
      await rpc('submit_round', args);
    }
  },
  saveAvatar: async (s, avatar) => {
    await rpc('save_avatar', { p_token: s.token, p_avatar: avatar });
  },
  createInvite: (s, name) => rpc('create_invite', { p_token: s.token, p_name: name }),
  listInvites: (s) => rpc<Invite[]>('list_invites', { p_token: s.token }),
  deleteInvite: (s, id) => rpc('delete_invite', { p_token: s.token, p_id: id }),
  peekInvite: (id) => rpc<InvitePeek | null>('peek_invite', { p_id: id }),
  submitFeedback: async (s, body, context) => {
    await rpc('submit_feedback', { p_token: s.token, p_body: body, p_context: context });
  },
  listFeedback: (s) => rpc<Feedback[]>('list_feedback', { p_token: s.token }),
  setFeedbackDone: async (s, id, done) => {
    await rpc('set_feedback_done', { p_token: s.token, p_id: id, p_done: done });
  },
  postNotice: async (s, body, asReginald) => {
    await rpc('post_notice', { p_token: s.token, p_body: body, p_as_reginald: asReginald });
  },
  listNotices: (s) => rpc<Notice[]>('list_notices', { p_token: s.token }),
  takeDownNotice: async (s, id) => {
    await rpc('take_down_notice', { p_token: s.token, p_id: id });
  },
  startPractice: (s, kind) => rpc<number>('start_practice', { p_token: s.token, p_kind: kind }),
  endPractice: async (s, id, shots) => {
    await rpc('end_practice', { p_token: s.token, p_id: id, p_shots: shots });
  },
  practiceReport: (s) => rpc<PracticeReport>('practice_report', { p_token: s.token }),
  touch: async (s, kind) => {
    await rpc('touch', { p_token: s.token, p_kind: kind });
  },
  activityReport: (s) => rpc<MemberActivity[]>('activity_report', { p_token: s.token }),
  openBoard: (s) => rpc<OpenRow[]>('open_board', { p_token: s.token }),
  openChampions: (s) => rpc<OpenChampion[]>('open_champions', { p_token: s.token }),
};
