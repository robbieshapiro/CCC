// Browser-only backend for playing without Supabase. Mirrors supabase/schema.sql.
import { STOCK_BUDDIES } from '../buddies';
import { todayInGameTz } from '../day';
import { courseFor, monthOf } from '../golf3d/courses';
import { makeRng } from '../seed';
import { monthChampion } from '../standings';
import { store } from '../storage';
import { weekOf } from '../bar';
import { SAMPLES } from '../designer/samples';
import { MAX_OVER_PAR, type AdminOverview, type AdminWindow, type Api, type BarBoard, type ClubRow, type Design, type MembersHole, type DailyDay, type DailyRow, type DailyState, type DailyTry, type Avatar, type Champion, type Feedback, type Invite, type Notice, type MemberActivity, type OpenChampion, type OpenRow, type PracticeKind, type PracticeReport, type Round } from './types';

type DbPlayer = { id: string; groupId: string; name: string; pin: string; token: string; avatar: Avatar; joined: string; admin?: boolean; host?: boolean };
type DbRound = Round & { groupId: string };
type DbInvite = Omit<Invite, 'usedBy'> & { groupId: string; usedBy: string | null; createdBy?: string };
type DbFeedback = Omit<Feedback, 'from'> & { groupId: string; playerId: string };
type DbPractice = { id: number; groupId: string; playerId: string; kind: PracticeKind; startedAt: string; endedAt: string | null; shots: number };
type Db = { groups: Record<string, { id: string; name: string }>; players: DbPlayer[]; rounds: DbRound[]; invites?: DbInvite[]; feedback?: DbFeedback[]; notices?: (Notice & { groupId: string; authorId: string; live: boolean })[]; practice?: DbPractice[]; days?: { playerId: string; day: string; visits: number; lockers: number }[]; seen?: Record<string, string>; daily?: { playerId: string; day: string; t: DailyTry }[]; bar?: { playerId: string; game: string; week: string; score: number }[]; designs?: (Design & { playerId: string; reviewedAt?: string })[] };

const KEY = 'ccc-local-db';

function load(): Db {
  try {
    const raw = store.get(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to empty db */
  }
  return { groups: {}, players: [], rounds: [] };
}

function save(db: Db) {
  store.set(KEY, JSON.stringify(db));
}

const uid = () => crypto.randomUUID();
const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
// k7q-4m2: letters and digits alternating, so a code never spells anything
const inviteCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(7)), (b, i) => (i === 3 ? '-' : i % 2 ? '23456789'[b % 8] : 'abcdefghjkmnpqrstuvwxyz'[b % 23])).join('');
const strip = ({ groupId: _g, ...r }: DbRound): Round => r;
const career = (rs: Round[]) => {
  const d = rs.map((r) => r.total - r.par);
  return { rounds: d.length, best: d.length ? Math.min(...d) : null, avg: d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : null };
};

function playerByToken(db: Db, token: string): DbPlayer {
  const p = db.players.find((x) => x.token === token);
  if (!p) throw new Error('Session expired. Rejoin with your invite link.');
  return p;
}

// Where someone's play counts: their membership in the club they belong to, not one they only run (host).
function homeOf(db: Db, me: DbPlayer): DbPlayer {
  return db.players.find((p) => !p.host && p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin) ?? me;
}

export const localApi: Api & { seedDemo(session: { token: string }): void; localDesign(session: { token: string }, prompt: string, id?: number, change?: string): { id: number; spec: Design['spec'] } } = {
  mode: 'local',

  async join(invite, name, pin) {
    const db = load();
    const code = invite.trim().toLowerCase();
    // a personal invitation, or the club's own code (which only signs members in once the club has started)
    const inv = (db.invites ?? []).find((i) => i.code === code);
    const groupCode = inv ? Object.keys(db.groups).find((k) => db.groups[k].id === inv.groupId)! : code;
    const group = (db.groups[groupCode] ??= { id: uid(), name: code === 'demo' ? 'Claude Country Club' : code });
    const clean = name.trim();
    if (!clean || clean.length > 20) throw new Error('Name must be 1-20 characters.');
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits.');
    let p = db.players.find((x) => x.groupId === group.id && x.name.toLowerCase() === clean.toLowerCase());
    if (p && p.pin !== pin) throw new Error('That name is taken and the PIN does not match.');
    if (!p) {
      const first = !db.players.some((x) => x.groupId === group.id);
      if (!first && !inv) throw new Error('New members need a personal invitation from the committee.');
      if (inv?.usedBy) throw new Error('That invitation has already been accepted.');
      p = { id: uid(), groupId: group.id, name: clean, pin, token: uid(), avatar: { color: '#163b2c', equip: {} }, joined: new Date().toISOString(), admin: first };
      db.players.push(p);
      if (inv) {
        inv.usedBy = p.id;
        inv.usedAt = new Date().toISOString();
      }
    }
    save(db);
    return { token: p.token, playerId: p.id, groupId: group.id, groupName: group.name };
  },

  async signIn(name, pin) {
    const db = load();
    const found = db.players.filter((p) => p.name.toLowerCase() === name.trim().toLowerCase() && p.pin === pin);
    if (!found.length) throw new Error('No member by that name and PIN. Check both and try again.');
    if (found.length > 1) throw new Error('More than one member by that name. Ask the committee for help.');
    const p = found[0];
    const group = Object.values(db.groups).find((g) => g.id === p.groupId)!;
    return { token: p.token, playerId: p.id, groupId: p.groupId, groupName: group.name };
  },

  async myClubs(name, pin) {
    const db = load();
    return db.players
      .filter((p) => p.name.toLowerCase() === name.trim().toLowerCase() && p.pin === pin)
      .map((p) => ({ token: p.token, playerId: p.id, groupId: p.groupId, groupName: Object.values(db.groups).find((g) => g.id === p.groupId)!.name }));
  },

  async createClub(session, name) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can start a new club.');
    const clean = name.trim();
    if (!clean || clean.length > 40) throw new Error('Club name must be 1-40 characters.');
    const code = rand(10);
    const group = (db.groups[code] = { id: uid(), name: clean });
    const p: DbPlayer = { id: uid(), groupId: group.id, name: me.name, pin: me.pin, token: uid(), avatar: me.avatar, joined: new Date().toISOString(), admin: true, host: true };
    db.players.push(p);
    save(db);
    return { token: p.token, playerId: p.id, groupId: group.id, groupName: group.name };
  },

  async snapshot(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    const today = todayInGameTz();
    const month = monthOf(today);
    const mine = db.rounds.filter((r) => r.groupId === me.groupId);
    const champions = [...new Set(mine.filter((r) => r.month < month).map((r) => r.month))]
      .sort()
      .reverse()
      .map((m) => monthChampion(m, mine))
      .filter((c): c is Champion => !!c);
    const wins = (id: string) => champions.filter((c) => c.playerIds.includes(id)).length;
    return {
      today,
      month,
      groupName: session.groupName,
      me: me.id,
      admin: !!me.admin,
      homeGroupId: homeOf(db, me).groupId,
      homeName: Object.values(db.groups).find((g) => g.id === homeOf(db, me).groupId)?.name,
      // the club's members, and you; someone who only runs the club isn't on its board
      players: db.players
        .filter((p) => p.groupId === me.groupId && (!p.host || p.id === me.id))
        .map((p) => ({
          host: !!p.host,
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          joined: p.joined,
          wins: wins(p.id),
          feats: [...new Set([...mine.filter((r) => r.playerId === p.id).flatMap((r) => r.feats), ...(wins(p.id) ? ['champion'] : [])])],
          career: career(mine.filter((r) => r.playerId === p.id)),
        })),
      rounds: mine.filter((r) => r.month === month).map(strip),
      champions,
    };
  },

  async submitRound(session, r) {
    const db = load();
    const me = homeOf(db, playerByToken(db, session.token)); // play counts at home
    const month = monthOf(todayInGameTz());
    const course = courseFor(month);
    if (r.course !== course.id || r.holes.length !== course.holes.length) throw new Error("That round doesn't match this month's course.");
    const holes = r.holes.map((s, i) => Math.max(1, Math.min(course.holes[i].par + MAX_OVER_PAR, Math.round(s))));
    const total = holes.reduce((a, b) => a + b, 0);
    const feats = [...new Set(r.feats)];
    if (total < course.par) feats.push('underpar');
    const spots = r.spots?.length === holes.length ? r.spots.map((p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null)) : null;
    db.rounds.push({ playerId: me.id, groupId: me.groupId, month, course: course.id, holes, total, par: course.par, feats, spots, createdAt: new Date().toISOString() });
    save(db);
  },

  async saveAvatar(session, avatar) {
    const db = load();
    playerByToken(db, session.token).avatar = avatar;
    save(db);
  },

  async createInvite(session, name) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin && (db.invites ?? []).filter((i) => i.createdBy === me.id && !i.usedBy).length >= 3)
      throw new Error("Three invitations at a time, I'm afraid. One must be accepted, or taken back, first.");
    const clean = name.trim();
    if (!clean || clean.length > 20) throw new Error('Name must be 1-20 characters.');
    const inv: DbInvite = { id: rand(10), groupId: me.groupId, name: clean, code: inviteCode(), createdAt: new Date().toISOString(), usedBy: null, usedAt: null, createdBy: me.id };
    (db.invites ??= []).push(inv);
    save(db);
    return { id: inv.id, name: inv.name, code: inv.code };
  },

  async listInvites(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    return (db.invites ?? [])
      .filter((i) => i.groupId === me.groupId && (me.admin || i.createdBy === me.id))
      .reverse()
      .map(({ groupId: _g, createdBy: _c, ...i }) => ({ ...i, usedBy: i.usedBy ? (db.players.find((p) => p.id === i.usedBy)?.name ?? null) : null }));
  },

  async deleteInvite(session, id) {
    const db = load();
    const me = playerByToken(db, session.token);
    db.invites = (db.invites ?? []).filter((i) => !(i.id === id && i.groupId === me.groupId && !i.usedBy && (me.admin || i.createdBy === me.id)));
    save(db);
  },

  async peekInvite(id) {
    const db = load();
    const inv = (db.invites ?? []).find((i) => i.id === id);
    if (!inv) return null;
    const group = Object.values(db.groups).find((g) => g.id === inv.groupId);
    return { name: inv.name, code: inv.code, groupName: group?.name ?? '', used: !!inv.usedBy };
  },

  async submitFeedback(session, body, context) {
    const db = load();
    const me = playerByToken(db, session.token);
    const clean = body.trim();
    if (!clean || clean.length > 2000) throw new Error('Keep it under 2000 characters, and not empty.');
    const list = (db.feedback ??= []);
    list.push({ id: list.length + 1, groupId: me.groupId, playerId: me.id, body: clean, context: context.trim().slice(0, 120) || null, done: false, createdAt: new Date().toISOString() });
    save(db);
  },

  async listFeedback(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can read feedback.');
    return (db.feedback ?? [])
      .filter((f) => f.groupId === me.groupId)
      .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt))
      .map(({ groupId: _g, playerId, ...f }) => ({ ...f, from: db.players.find((p) => p.id === playerId)?.name ?? null }));
  },

  async setFeedbackDone(session, id, done) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can manage feedback.');
    const f = (db.feedback ?? []).find((x) => x.id === id && x.groupId === me.groupId);
    if (f) f.done = done;
    save(db);
  },

  async postNotice(session, body, asReginald) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can post notices.');
    const clean = body.trim();
    if (!clean || clean.length > 1000) throw new Error('Keep it under 1000 characters, and not empty.');
    const list = (db.notices ??= []);
    list.push({ id: list.length + 1, groupId: me.groupId, authorId: me.id, author: me.name, body: clean, asReginald, live: true, createdAt: new Date().toISOString() });
    save(db);
  },

  async listNotices(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    return (db.notices ?? [])
      .filter((n) => n.groupId === me.groupId && n.live)
      .reverse()
      .slice(0, 5)
      .map(({ id, body, asReginald, authorId, createdAt }) => ({ id, body, asReginald, createdAt, author: db.players.find((p) => p.id === authorId)?.name ?? null }));
  },

  async takeDownNotice(session, id) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can take notices down.');
    const n = (db.notices ?? []).find((x) => x.id === id && x.groupId === me.groupId);
    if (n) n.live = false;
    save(db);
  },

  async startPractice(session, kind) {
    const db = load();
    const me = homeOf(db, playerByToken(db, session.token)); // play counts at home
    const list = (db.practice ??= []);
    const id = list.length + 1;
    list.push({ id, groupId: me.groupId, playerId: me.id, kind, startedAt: new Date().toISOString(), endedAt: null, shots: 0 });
    save(db);
    return id;
  },

  async endPractice(session, id, shots) {
    const db = load();
    const me = homeOf(db, playerByToken(db, session.token)); // play counts at home
    const p = (db.practice ?? []).find((x) => x.id === id && x.playerId === me.id && !x.endedAt);
    if (p) Object.assign(p, { endedAt: new Date().toISOString(), shots: Math.max(0, Math.min(shots, 5000)) });
    save(db);
  },

  async practiceReport(session): Promise<PracticeReport> {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see the practice log.');
    const month = new Date().toISOString().slice(0, 7);
    const name = (id: string) => db.players.find((p) => p.id === id)?.name ?? '';
    const s = (db.practice ?? []).filter((x) => x.groupId === me.groupId && !db.players.find((p) => p.id === x.playerId)?.admin && x.startedAt.startsWith(month));
    const mins = (x: DbPractice) => (x.endedAt ? Math.min(10800, (Date.parse(x.endedAt) - Date.parse(x.startedAt)) / 1000) : 0);
    const kinds = (['caldera', 'range', 'shortgame'] as const).flatMap((kind) => {
      const k = s.filter((x) => x.kind === kind);
      return k.length ? [{ kind, sessions: k.length, members: new Set(k.map((x) => x.playerId)).size, minutes: Math.round(k.reduce((a, x) => a + mins(x), 0) / 60) }] : [];
    });
    const members = [...new Set(s.map((x) => x.playerId))]
      .map((id) => {
        const m = s.filter((x) => x.playerId === id);
        const n = (k: PracticeKind) => m.filter((x) => x.kind === k).length;
        return { name: name(id), caldera: n('caldera'), range: n('range'), shortgame: n('shortgame'), lastAt: m.map((x) => x.startedAt).sort().pop()! };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    const recent = [...s]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 20)
      .map((x) => ({ name: name(x.playerId), kind: x.kind, startedAt: x.startedAt, endedAt: x.endedAt, shots: x.shots }));
    return { kinds, members, recent };
  },

  // The Open, as in schema.sql: one entry a person (same name and PIN), under the club they joined first.
  async openBoard(session): Promise<OpenRow[]> {
    const db = load();
    const me = playerByToken(db, session.token);
    const month = monthOf(todayInGameTz());
    const key = (p: DbPlayer) => `${p.name.toLowerCase()}|${p.pin}`;
    const club = (groupId: string) => Object.values(db.groups).find((g) => g.id === groupId)?.name ?? '';
    const people = new Map<string, DbPlayer[]>();
    for (const p of [...db.players].sort((a, b) => a.joined.localeCompare(b.joined))) people.set(key(p), [...(people.get(key(p)) ?? []), p]);
    const rows: OpenRow[] = [];
    for (const [k, ps] of people) {
      const rounds = db.rounds.filter((r) => r.month === month && ps.some((p) => p.id === r.playerId));
      if (!rounds.length) continue;
      const best = [...rounds].sort((a, b) => a.total - a.par - (b.total - b.par) || a.createdAt.localeCompare(b.createdAt))[0];
      const home = ps[0];
      rows.push({
        playerId: home.id, name: home.name, club: club(home.groupId), mine: k === key(me), localId: ps.find((p) => p.groupId === me.groupId)?.id ?? null,
        avatar: home.avatar, holes: best.holes, total: best.total, par: best.par, rounds: rounds.length, last: rounds.map((r) => r.createdAt).sort().pop()!, createdAt: best.createdAt,
      });
    }
    return rows.sort((a, b) => a.total - a.par - (b.total - b.par) || a.createdAt.localeCompare(b.createdAt));
  },

  async clubList(session): Promise<ClubRow[]> {
    const db = load();
    const home = homeOf(db, playerByToken(db, session.token));
    const month = monthOf(todayInGameTz());
    const rows = Object.values(db.groups).map((g) => {
      const members = db.players.filter((p) => p.groupId === g.id && !p.host);
      const bests = members
        .map((p) => ({ p, r: db.rounds.filter((r) => r.playerId === p.id && r.month === month).map((r) => r.total - r.par).sort((a, b) => a - b)[0] }))
        .filter((x) => x.r !== undefined);
      const best = bests.length ? Math.min(...bests.map((x) => x.r!)) : null;
      return { id: g.id, name: g.name, mine: g.id === home.groupId, members: members.length, played: bests.length, best, leaders: best === null ? null : bests.filter((x) => x.r === best).map((x) => x.p.name).sort() };
    });
    return rows.filter((r) => r.members).sort((a, b) => (a.best ?? 999) - (b.best ?? 999) || a.name.localeCompare(b.name));
  },

  async chronicles() {
    return []; // Reginald writes them on the server; local mode has none
  },

  // the Design Desk, kept on the device (localDesign below stands in for the architect)
  async myDesigns(session): Promise<Design[]> {
    const db = load();
    const me = playerByToken(db, session.token);
    return (db.designs ?? []).filter((d) => d.playerId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async submitDesign(session, id, par) {
    const db = load();
    const me = playerByToken(db, session.token);
    const d = (db.designs ?? []).find((x) => x.id === id && x.playerId === me.id && x.status === 'draft');
    if (!d) throw new Error("That hole can't be submitted.");
    d.status = 'submitted';
    d.par = par;
    save(db);
  },
  async designQueue(session): Promise<Design[]> {
    const db = load();
    if (!playerByToken(db, session.token).admin) throw new Error('Only the committee can see this.');
    return (db.designs ?? []).filter((d) => d.status === 'submitted' || d.status === 'approved').map((d) => ({ ...d, by: db.players.find((p) => p.id === d.playerId)?.name ?? '?' }));
  },
  async reviewDesign(session, id, ok) {
    const db = load();
    if (!playerByToken(db, session.token).admin) throw new Error('Only the committee can do this.');
    const d = (db.designs ?? []).find((x) => x.id === id);
    if (d) {
      d.status = ok ? 'approved' : 'rejected';
      d.reviewedAt = new Date().toISOString();
    }
    save(db);
  },
  async membersCourse(): Promise<MembersHole[]> {
    const db = load();
    return (db.designs ?? [])
      .filter((d) => d.status === 'approved')
      .slice(-9)
      .map((d) => ({ id: d.id, spec: d.spec, par: d.par ?? 3, by: db.players.find((p) => p.id === d.playerId)?.name ?? '?' }));
  },
  // local mode's architect: a stock hole, so the Desk can be tried without the server
  localDesign(session, prompt, id, change) {
    const db = load();
    const me = playerByToken(db, session.token);
    const spec = sampleSpec(prompt, change);
    db.designs ??= [];
    if (id) {
      const d = db.designs.find((x) => x.id === id && x.playerId === me.id);
      if (d) {
        d.spec = spec;
        d.par = null;
        save(db);
        return { id, spec };
      }
    }
    const nid = (db.designs.reduce((a, d) => Math.max(a, d.id), 0) || 0) + 1;
    db.designs.push({ id: nid, playerId: me.id, prompt, spec, par: null, status: 'draft', createdAt: new Date().toISOString() });
    save(db);
    return { id: nid, spec };
  },

  async openChampions(): Promise<OpenChampion[]> {
    return []; // local mode keeps one month at a time
  },

  async touch(session, kind) {
    const db = load();
    const me = playerByToken(db, session.token);
    const day = todayInGameTz();
    (db.seen ??= {})[me.id] = new Date().toISOString();
    const days = (db.days ??= []);
    let d = days.find((x) => x.playerId === me.id && x.day === day);
    if (!d) days.push((d = { playerId: me.id, day, visits: 0, lockers: 0 }));
    if (kind === 'visit') d.visits++;
    else d.lockers++;
    save(db);
  },

  async activityReport(session): Promise<MemberActivity[]> {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see member activity.');
    const month = monthOf(todayInGameTz());
    return db.players
      .filter((p) => p.groupId === me.groupId && !p.admin)
      .map((p) => {
        const rounds = db.rounds.filter((r) => r.playerId === p.id);
        const practice = (db.practice ?? []).filter((x) => x.playerId === p.id);
        const days = (db.days ?? []).filter((x) => x.playerId === p.id && x.day.startsWith(month));
        const lastSeen = [db.seen?.[p.id], ...rounds.map((r) => r.createdAt), ...practice.map((x) => x.startedAt)].filter(Boolean).sort().pop() ?? null;
        const active = new Set([...days.map((x) => x.day), ...rounds.filter((r) => r.month === month).map((r) => todayInGameTz(new Date(r.createdAt))), ...practice.filter((x) => x.startedAt.startsWith(month)).map((x) => todayInGameTz(new Date(x.startedAt)))]);
        return {
          name: p.name,
          lastSeen,
          days: active.size,
          rounds: rounds.filter((r) => r.month === month).length,
          practice: practice.filter((x) => x.startedAt.startsWith(month)).length,
          lockers: days.reduce((a, x) => a + x.lockers, 0),
        };
      })
      .sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '') || a.name.localeCompare(b.name));
  },

  async adminOverview(session, window: AdminWindow): Promise<AdminOverview> {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see the admin tab.');
    // every club run by the same name and PIN, as on the server
    const clubs = new Set(db.players.filter((p) => p.admin && p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.groupId));
    const club = (id: string) => Object.values(db.groups).find((g) => g.id === id)?.name ?? '?';
    const since =
      window === 'week' ? new Date(Date.now() - 7 * 86_400_000).toISOString() : window === 'month' ? `${monthOf(todayInGameTz())}-01` : '';
    const sinceDay = since.slice(0, 10);
    const members = db.players.filter((p) => clubs.has(p.groupId) && !p.admin);
    const stats = members.map((p) => {
      const rounds = db.rounds.filter((r) => r.playerId === p.id && r.createdAt >= since);
      const practice = (db.practice ?? []).filter((x) => x.playerId === p.id && x.startedAt >= since);
      const days = (db.days ?? []).filter((x) => x.playerId === p.id && x.day >= sinceDay);
      const all = [db.seen?.[p.id], ...db.rounds.filter((r) => r.playerId === p.id).map((r) => r.createdAt), ...(db.practice ?? []).filter((x) => x.playerId === p.id).map((x) => x.startedAt)];
      const active = new Set([...days.map((x) => x.day), ...rounds.map((r) => todayInGameTz(new Date(r.createdAt))), ...practice.map((x) => todayInGameTz(new Date(x.startedAt)))]);
      return {
        groupId: p.groupId,
        club: club(p.groupId),
        name: p.name,
        joined: p.joined,
        lastSeen: all.filter((x): x is string => !!x).sort().pop() ?? null,
        days: active.size,
        rounds: rounds.length,
        best: rounds.length ? Math.min(...rounds.map((r) => r.total - r.par)) : null,
        practice: practice.length,
        lockers: days.reduce((a, x) => a + x.lockers, 0),
      };
    });
    const who = (id: string) => db.players.find((p) => p.id === id);
    const feed: AdminOverview['feed'] = [
      ...db.rounds.filter((r) => clubs.has(r.groupId) && !who(r.playerId)?.admin).map((r) => ({ at: r.createdAt, kind: 'round' as const, club: club(r.groupId), name: who(r.playerId)?.name ?? '?', course: r.course, total: r.total, par: r.par, what: null, shots: null })),
      ...(db.practice ?? []).filter((x) => clubs.has(x.groupId) && !who(x.playerId)?.admin).map((x) => ({ at: x.startedAt, kind: 'practice' as const, club: club(x.groupId), name: who(x.playerId)?.name ?? '?', course: null, total: null, par: null, what: x.kind, shots: x.shots })),
      ...members.map((p) => ({ at: p.joined, kind: 'join' as const, club: club(p.groupId), name: p.name, course: null, total: null, par: null, what: null, shots: null })),
      ...(db.feedback ?? []).filter((f) => clubs.has(f.groupId)).map((f) => ({ at: f.createdAt, kind: 'feedback' as const, club: club(f.groupId), name: who(f.playerId)?.name ?? 'A member', course: null, total: null, par: null, what: f.body.slice(0, 80), shots: null })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 25);
    return {
      clubs: [...clubs]
        .map((id) => {
          const s = stats.filter((x) => x.groupId === id);
          return { id, name: club(id), members: s.length, active: s.filter((x) => x.days > 0).length, rounds: s.reduce((a, x) => a + x.rounds, 0), practice: s.reduce((a, x) => a + x.practice, 0), newMembers: s.filter((x) => x.joined >= since).length };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      members: stats.map(({ groupId: _g, ...x }) => x).sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '') || a.name.localeCompare(b.name)),
      feed,
      feedback: (db.feedback ?? [])
        .filter((f) => clubs.has(f.groupId) && !f.done)
        .map((f) => ({ id: f.id, club: club(f.groupId), from: who(f.playerId)?.name ?? null, body: f.body, context: f.context, createdAt: f.createdAt }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      invites: (db.invites ?? [])
        .filter((i) => clubs.has(i.groupId) && !i.usedBy)
        .map((i) => ({ id: i.id, club: club(i.groupId), name: i.name, code: i.code, createdAt: i.createdAt }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  },

  async dailyState(session, day): Promise<DailyState> {
    const db = load();
    const me = playerByToken(db, session.token);
    const key = (p: DbPlayer) => `${p.name.toLowerCase()}|${p.pin}`;
    const club = (groupId: string) => Object.values(db.groups).find((g) => g.id === groupId)?.name ?? '';
    const people = new Map<string, DbPlayer[]>();
    for (const p of [...db.players].sort((a, b) => a.joined.localeCompare(b.joined))) people.set(key(p), [...(people.get(key(p)) ?? []), p]);
    const of = (ps: DbPlayer[], d: string) => (db.daily ?? []).filter((x) => x.day === d && ps.some((p) => p.id === x.playerId)).map((x) => x.t);
    const best = (ts: DailyTry[]) => ts.filter((t) => t.holed || (!t.lost && t.ft !== null)).sort((a, b) => Number(b.holed) - Number(a.holed) || (a.ft ?? 0) - (b.ft ?? 0))[0];
    const board: DailyRow[] = [];
    for (const [k, ps] of people) {
      const ts = of(ps, day);
      if (!ts.length) continue;
      const b = best(ts);
      const holedTry = ts.filter((t) => t.holed).map((t) => t.try).sort()[0] ?? null;
      const fts = ts.map((t) => (t.holed ? 0 : t.lost ? null : t.ft)).sort((x, y) => (x ?? Infinity) - (y ?? Infinity));
      board.push({ name: ps[0].name, club: club(ps[0].groupId), ft: b?.ft ?? null, holed: !!b?.holed, holedTry, tries: ts.length, mine: k === key(me), fts } as DailyRow & { fts: (number | null)[] });
    }
    // as on the server: holed first, holed sooner first, then nearest, then the next-best try
    const by = (r: DailyRow) => r as DailyRow & { fts: (number | null)[] };
    board.sort((a, b) => Number(b.holed) - Number(a.holed) || (a.holedTry ?? 9) - (b.holedTry ?? 9) || [0, 1, 2].reduce((c, i) => c || (by(a).fts[i] ?? 1e9) - (by(b).fts[i] ?? 1e9), 0));
    const mine = people.get(key(me)) ?? [me];
    let streak = 0;
    const d = new Date(`${day}T12:00:00Z`);
    if (!of(mine, day).length) d.setUTCDate(d.getUTCDate() - 1); // today not played yet: the streak runs to yesterday
    while (of(mine, d.toISOString().slice(0, 10)).length) {
      streak++;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return { mine: of(mine, day).sort((a, b) => a.try - b.try), board, players: board.length, streak };
  },

  async submitDaily(session, day, t) {
    const db = load();
    const me = homeOf(db, playerByToken(db, session.token)); // play counts at home
    if (day !== todayInGameTz()) throw new Error("That's not today's shot.");
    const mine = db.players.filter((p) => p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.id);
    const done = (db.daily ?? []).filter((x) => x.day === day && mine.includes(x.playerId));
    if (done.length >= 3 || done.some((x) => x.t.try === t.try)) throw new Error("You've had your three tries today.");
    (db.daily ??= []).push({ playerId: me.id, day, t });
    save(db);
  },

  async submitBar(session, game, score) {
    const db = load();
    const me = homeOf(db, playerByToken(db, session.token)); // play counts at home
    (db.bar ??= []).push({ playerId: me.id, game, week: weekOf(todayInGameTz()), score });
    save(db);
  },

  async barBoard(session, game): Promise<BarBoard> {
    const db = load();
    const me = playerByToken(db, session.token);
    const week = weekOf(todayInGameTz());
    const key = (p: DbPlayer) => `${p.name.toLowerCase()}|${p.pin}`;
    const best = new Map<string, { name: string; score: number }>();
    for (const r of (db.bar ?? []).filter((x) => x.game === game && x.week === week)) {
      const p = db.players.find((x) => x.id === r.playerId);
      if (!p) continue;
      const b = best.get(key(p));
      if (!b || r.score > b.score) best.set(key(p), { name: p.name, score: r.score });
    }
    const board = [...best.entries()].map(([k, v]) => ({ ...v, mine: k === key(me) })).sort((a, b) => b.score - a.score);
    return { week, board, mine: board.find((r) => r.mine)?.score ?? null, players: board.length };
  },

  async dailyAdmin(session): Promise<DailyDay[]> {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see this.');
    const out: DailyDay[] = [];
    const d = new Date(`${todayInGameTz()}T12:00:00Z`);
    for (let i = 0; i < 7; i++) {
      const day = d.toISOString().slice(0, 10);
      const rows = (db.daily ?? []).filter((x) => x.day === day);
      out.push({ day, players: new Set(rows.map((x) => x.playerId)).size, tries: rows.length });
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return out;
  },

  async adminFeedbackDone(session, id, done) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can manage feedback.');
    const clubs = new Set(db.players.filter((p) => p.admin && p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.groupId));
    const f = (db.feedback ?? []).find((x) => x.id === id && clubs.has(x.groupId));
    if (f) f.done = done;
    save(db);
  },

  // Adds Sean, Danny and PJ with a few rounds this month and a past champion.
  seedDemo(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    const month = monthOf(todayInGameTz());
    const course = courseFor(month);
    const rng = makeRng(`demo:${me.id}`);
    const prev = (() => {
      const d = new Date(`${month}-15T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d.toISOString().slice(0, 7);
    })();
    STOCK_BUDDIES.forEach((b, i) => {
      if (db.players.some((p) => p.groupId === me.groupId && p.name === b.name)) return;
      const p: DbPlayer = { id: uid(), groupId: me.groupId, name: b.name, pin: '0000', token: uid(), avatar: b.avatar, joined: new Date(Date.UTC(2026, 8, 1 + i)).toISOString() };
      db.players.push(p);
      const skill = [0.6, 0.8, 0.4][i];
      for (const [m, n] of [
        [prev, 2],
        [month, 1 + i],
      ] as const)
        for (let k = 0; k < n; k++) {
          const holes = course.holes.map((h) => {
            const roll = rng.next() * skill;
            return Math.max(2, h.par + (roll > 0.6 ? -1 : roll > 0.35 ? 0 : roll > 0.15 ? 1 : 2));
          });
          const total = holes.reduce((a, c) => a + c, 0);
          const day = m === month ? Math.max(1, Math.min(28, new Date().getUTCDate() - k - i)) : 10 + k * 7 + i;
          // each buddy's first round this month was played today, so they stand on the course
          const today = m === month && k === 0;
          const spots = today
            ? course.holes.map((h) => {
                const at = h.par === 3 ? h.cup : h.flyover[1];
                return { x: Math.round(at.x + (rng.next() - 0.5) * 30), y: Math.round(at.y + (rng.next() - 0.5) * 30) };
              })
            : null;
          const createdAt = today ? new Date(Date.now() - (i + 1) * 3_600_000).toISOString() : `${m}-${String(day).padStart(2, '0')}T17:${10 + i * 7}:00.000Z`;
          db.rounds.push({ playerId: p.id, groupId: me.groupId, month: m, course: course.id, holes, total, par: course.par, feats: total < course.par ? ['underpar'] : [], spots, createdAt });
        }
    });
    save(db);
  },
};

// the stand-in architect's hole: one of the samples, in the look the description mentions
function sampleSpec(prompt: string, change?: string): Design['spec'] {
  const text = `${prompt} ${change ?? ''}`.toLowerCase();
  const look = /desert|cact|canyon|mesa/.test(text) ? 'desert' : /links|sea|dune|scotland|wind/.test(text) ? 'links' : /lava|volcan|caldera|island/.test(text) ? 'caldera' : 'highlands';
  return { ...SAMPLES[look] };
}
