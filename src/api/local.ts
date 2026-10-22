// Browser-only backend for playing without Supabase. Mirrors supabase/schema.sql.
import { STOCK_BUDDIES } from '../buddies';
import { todayInGameTz } from '../day';
import { courseFor, monthOf } from '../golf3d/courses';
import { makeRng } from '../seed';
import { monthChampion } from '../standings';
import { store } from '../storage';
import { MAX_OVER_PAR, type Api, type Avatar, type Champion, type Round } from './types';

type DbPlayer = { id: string; groupId: string; name: string; pin: string; token: string; avatar: Avatar; joined: string };
type DbRound = Round & { groupId: string };
type Db = { groups: Record<string, { id: string; name: string }>; players: DbPlayer[]; rounds: DbRound[] };

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
const strip = ({ groupId: _g, ...r }: DbRound): Round => r;

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
    const group = (db.groups[code] ??= { id: uid(), name: code === 'demo' ? 'Claude Country Club' : code });
    const clean = name.trim();
    if (!clean || clean.length > 20) throw new Error('Name must be 1-20 characters.');
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits.');
    let p = db.players.find((x) => x.groupId === group.id && x.name.toLowerCase() === clean.toLowerCase());
    if (p && p.pin !== pin) throw new Error('That name is taken and the PIN does not match.');
    if (!p) {
      p = { id: uid(), groupId: group.id, name: clean, pin, token: uid(), avatar: { color: '#163b2c', equip: {} }, joined: new Date().toISOString() };
      db.players.push(p);
    }
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
      players: db.players
        .filter((p) => p.groupId === me.groupId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          joined: p.joined,
          wins: wins(p.id),
          feats: [...new Set([...mine.filter((r) => r.playerId === p.id).flatMap((r) => r.feats), ...(wins(p.id) ? ['champion'] : [])])],
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
    db.rounds.push({ playerId: me.id, groupId: me.groupId, month, course: course.id, holes, total, par: course.par, feats, createdAt: new Date().toISOString() });
    save(db);
  },

  async saveAvatar(session, avatar) {
    const db = load();
    playerByToken(db, session.token).avatar = avatar;
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
          db.rounds.push({ playerId: p.id, groupId: me.groupId, month: m, course: course.id, holes, total, par: course.par, feats: total < course.par ? ['underpar'] : [], createdAt: `${m}-${String(day).padStart(2, '0')}T17:${10 + i * 7}:00.000Z` });
        }
    });
    save(db);
  },
};
