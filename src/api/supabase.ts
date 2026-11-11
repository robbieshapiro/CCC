import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdminKpis, AdminToday, CourseRecord, Season, TrophyProgress, GolferCard, FieldRow, AdminOverview, AdminShoutout, Shoutout, Api, HoleReport, CardToday, BarBoard, Chronicle, ClubRow, Design, MembersHole, DailyCrown, DailyDay, DailyState, Honors, Feedback, Invite, InvitePeek, MemberActivity, Notice, OpenChampion, OpenRow, PlayoffState, PracticeReport, Session, TrendDay, Snapshot, PowerupState, LandedCurse, MyNomination, AdminNominations, Nominated } from './types';

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
  join: async (invite, name, pin) => {
    // a wrong PIN comes back as a value, not an error, so the database keeps count of it
    const r = await rpc<Session & { error?: string }>('join_group', { p_invite: invite, p_name: name, p_pin: pin });
    if (r.error) throw new Error(r.error);
    return r;
  },
  myClubs: (name, pin) => rpc<Session[]>('my_clubs', { p_name: name, p_pin: pin }),
  createClub: (s, name) => rpc<Session>('create_club', { p_token: s.token, p_name: name }),
  snapshot: (s) => rpc<Snapshot>('get_snapshot', { p_token: s.token }),
  submitRound: async (s, r) => {
    const args = { p_token: s.token, p_course: r.course, p_holes: r.holes, p_pars: r.pars, p_feats: r.feats, p_spots: r.spots ?? null, ...(r.card ? { p_card: true } : {}) };
    try {
      await rpc('submit_round', r.shots?.length ? { ...args, p_shots: r.shots } : args);
    } catch (err) {
      // a database without shot data (or daily cards) yet: the score still counts
      if (!r.shots?.length || !/submit_round|function|schema cache/i.test((err as Error).message)) throw err;
      await rpc('submit_round', args);
    }
  },
  adminHoles: (s) => rpc<HoleReport[]>('admin_holes', { p_token: s.token }),
  recordDesignPlay: (s, id) => rpc<boolean>('record_design_play', { p_token: s.token, p_design: id }).catch(() => false),
  buyItem: async (s, item) => {
    try {
      await rpc('buy_item', { p_token: s.token, p_item: item });
    } catch (err) {
      // the shop's SQL isn't in yet
      if (/buy_item|schema cache/i.test((err as Error).message)) throw new Error('The Pro Shop isn’t open yet. Check back soon.');
      throw err;
    }
  },
  saveAvatar: async (s, avatar) => {
    await rpc('save_avatar', { p_token: s.token, p_avatar: avatar });
  },
  createInvite: (s, name) => rpc('create_invite', { p_token: s.token, p_name: name }),
  listInvites: (s) => rpc<Invite[]>('list_invites', { p_token: s.token }),
  deleteInvite: (s, id) => rpc('delete_invite', { p_token: s.token, p_id: id }),
  peekInvite: (id) => rpc<InvitePeek | null>('peek_invite', { p_id: id }),
  nominate: async (s, name, phone) => {
    await rpc('nominate_friend', { p_token: s.token, p_name: name, p_phone: phone });
  },
  myNominations: (s) => rpc<MyNomination[]>('my_nominations', { p_token: s.token }).catch(() => []),
  adminNominations: (s) => rpc<AdminNominations>('admin_nominations', { p_token: s.token }),
  decideNomination: (s, id, approve) => rpc<Nominated | null>('decide_nomination', { p_token: s.token, p_id: id, p_approve: approve }),
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
  sendShoutout: async (s, to, kind, body) => {
    await rpc('send_shoutout', { p_token: s.token, p_to: to, p_kind: kind, p_body: body });
  },
  myShoutouts: (s) => rpc<Shoutout[]>('my_shoutouts', { p_token: s.token }),
  seenShoutouts: async (s, ids) => {
    await rpc('seen_shoutouts', { p_token: s.token, p_ids: ids });
  },
  adminShoutouts: (s) => rpc<AdminShoutout[]>('admin_shoutouts', { p_token: s.token }),
  removeShoutout: async (s, id) => {
    await rpc('remove_shoutout', { p_token: s.token, p_id: id });
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
  adminOverview: (s, window) => rpc<AdminOverview>('admin_overview', { p_token: s.token, p_window: window }),
  dailyState: (s, day) => rpc<DailyState>('daily_state', { p_token: s.token, p_day: day }),
  submitDaily: async (s, day, t) => {
    await rpc('submit_daily', { p_token: s.token, p_day: day, p_try: t.try, p_ft: t.ft, p_holed: t.holed, p_lost: t.lost });
  },
  dailyAdmin: (s) => rpc<DailyDay[]>('daily_admin', { p_token: s.token }),
  submitBar: async (s, game, score) => {
    await rpc('submit_bar', { p_token: s.token, p_game: game, p_score: score });
  },
  barBoard: (s, game) => rpc<BarBoard>('bar_board', { p_token: s.token, p_game: game }),
  buyPowerup: async (s, kind) => {
    await rpc('buy_powerup', { p_token: s.token, p_kind: kind });
  },
  powerupState: (s) => rpc<PowerupState>('powerup_state', { p_token: s.token }).catch(() => ({ locker: [] })),
  usePowerup: (s, id) => rpc<string>('use_powerup', { p_token: s.token, p_id: id }),
  sendCurse: (s, kind, target) => rpc<string>('send_curse', { p_token: s.token, p_kind: kind, p_target: target }),
  pickPocket: (s, target) => rpc<string>('pick_pocket', { p_token: s.token, p_target: target }),
  landCurses: (s) => rpc<LandedCurse[]>('land_curses', { p_token: s.token }).catch(() => []),
  passCurse: (s, curse, target) => rpc<string>('pass_curse', { p_token: s.token, p_curse: curse, p_target: target }),
  adminFeedbackDone: async (s, id, done) => {
    await rpc('admin_feedback_done', { p_token: s.token, p_id: id, p_done: done });
  },
  openBoard: (s) => rpc<OpenRow[]>('open_board', { p_token: s.token }),
  clubList: (s) => rpc<ClubRow[]>('club_list', { p_token: s.token }),
  chronicles: (s) => rpc<Chronicle[]>('chronicles', { p_token: s.token }),
  myDesigns: (s) => rpc<Design[]>('my_designs', { p_token: s.token }),
  submitDesign: (s, id, par) => rpc<void>('submit_design', { p_token: s.token, p_id: id, p_par: par }),
  designQueue: (s) => rpc<Design[]>('design_queue', { p_token: s.token }),
  reviewDesign: (s, id, ok) => rpc<void>('review_design', { p_token: s.token, p_id: id, p_ok: ok }),
  membersCourse: (s) => rpc<MembersHole[]>('members_course', { p_token: s.token }),
  openChampions: (s) => rpc<OpenChampion[]>('open_champions', { p_token: s.token }),
  dailyCrown: (s) => rpc<DailyCrown | null>('daily_crown', { p_token: s.token }),
  courseSchedule: (s) => rpc<Record<string, string>>('course_schedule', { p_token: s.token }),
  setCourseSchedule: (s, period, course) => rpc<void>('set_course_schedule', { p_token: s.token, p_period: period, p_course: course }),
  periodHonors: (s, period) => rpc<Honors>('period_honors', { p_token: s.token, p_period: period }),
  startRound: (s, course, card) => rpc<number | null>('start_round', card ? { p_token: s.token, p_course: course, p_card: true } : { p_token: s.token, p_course: course }),
  // a database without daily cards yet reads as no cards
  cardToday: (s) => rpc<CardToday | null>('card_today', { p_token: s.token }).catch(() => null),
  cardProgress: (s, id, c) => rpc<void>('card_progress', { p_token: s.token, p_id: id, p_scores: c.scores, p_shots: c.shots, p_spots: c.spots, p_feats: c.feats }),
  roundProgress: (s, id, hole, finished) => rpc<void>('round_progress', { p_token: s.token, p_id: id, p_hole: hole, p_finished: finished }),
  adminTrend: (s) => rpc<TrendDay[]>('admin_trend', { p_token: s.token }),
  adminToday: (s) => rpc<AdminToday>('admin_today', { p_token: s.token }),
  courseField: (s, course) => rpc<FieldRow[]>('course_field', { p_token: s.token, p_course: course }),
  coursePractice: (s) => rpc<{ playerId: string; name: string; club: string; mine: boolean }[]>('course_practice', { p_token: s.token }),
  courseRecords: (s) => rpc<CourseRecord[]>('course_records', { p_token: s.token }),
  seasonStandings: (s) => rpc<Season>('season_standings', { p_token: s.token }),
  trophyProgress: (s, id) => rpc<TrophyProgress | null>('trophy_progress', { p_token: s.token, p_player: id ?? null }),
  golferCard: (s, id) => rpc<GolferCard | null>('golfer_card', { p_token: s.token, p_player: id }),
  submitFreeRound: (s, course, holes, pars) => rpc<void>('submit_free_round', { p_token: s.token, p_course: course, p_holes: holes, p_pars: pars }),
  adminKpis: (s) => rpc<AdminKpis>('admin_kpis', { p_token: s.token }),
  playoffState: (s) => rpc<PlayoffState | null>('playoff_state', { p_token: s.token }),
  playoffStart: (s) => rpc<void>('playoff_start', { p_token: s.token }),
  playoffFinish: (s, strokes) => rpc<void>('playoff_finish', { p_token: s.token, p_strokes: strokes }),
  playoffShot: (s, t) => rpc<void>('playoff_shot', { p_token: s.token, p_ft: t.ft ?? 0, p_holed: t.holed, p_lost: t.lost }),
};
