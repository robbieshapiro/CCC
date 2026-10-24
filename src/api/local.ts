// Browser-only backend for playing without Supabase. Mirrors supabase/schema.sql.
import { STOCK_BUDDIES } from '../buddies';
import { todayInGameTz } from '../day';
import { courseFor, monthOf } from '../golf3d/courses';
import { makeRng } from '../seed';
import { monthChampion } from '../standings';
import { store } from '../storage';
import { MAX_OVER_PAR, type Api, type Avatar, type Champion, type Feedback, type Invite, type Notice, type Round } from './types';

type DbPlayer = { id: string; groupId: string; name: string; pin: string; token: string; avatar: Avatar; joined: string; admin?: boolean };
type DbRound = Round & { groupId: string };
type DbInvite = Omit<Invite, 'usedBy'> & { groupId: string; usedBy: string | null };
type DbFeedback = Omit<Feedback, 'from'> & { groupId: string; playerId: string };
type Db = { groups: Record<string, { id: string; name: string }>; players: DbPlayer[]; rounds: DbRound[]; invites?: DbInvite[]; feedback?: DbFeedback[]; notices?: (Notice & { groupId: string; authorId: string; live: boolean })[] };

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

export const localApi: Api & { seedDemo(session: { token: string }): void } = {
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
      players: db.players
        .filter((p) => p.groupId === me.groupId)
        .map((p) => ({
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
    const me = playerByToken(db, session.token);
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
    if (!me.admin) throw new Error('Only the committee can put up new members.');
    const clean = name.trim();
    if (!clean || clean.length > 20) throw new Error('Name must be 1-20 characters.');
    const inv: DbInvite = { id: rand(10), groupId: me.groupId, name: clean, code: inviteCode(), createdAt: new Date().toISOString(), usedBy: null, usedAt: null };
    (db.invites ??= []).push(inv);
    save(db);
    return { id: inv.id, name: inv.name, code: inv.code };
  },

  async listInvites(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see invitations.');
    return (db.invites ?? [])
      .filter((i) => i.groupId === me.groupId)
      .reverse()
      .map(({ groupId: _g, ...i }) => ({ ...i, usedBy: i.usedBy ? (db.players.find((p) => p.id === i.usedBy)?.name ?? null) : null }));
  },

  async deleteInvite(session, id) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can remove invitations.');
    db.invites = (db.invites ?? []).filter((i) => !(i.id === id && i.groupId === me.groupId && !i.usedBy));
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
