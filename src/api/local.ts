// Browser-only backend for playing without Supabase. Mirrors supabase/schema.sql.
import { STOCK_BUDDIES } from '../buddies';
import { cardsOn, GAME_TZ, openPurseOn, periodOf, todayInGameTz } from '../day';
import { courseById, courseFor } from '../golf3d/courses';
import { BONUS, bonusOf, puttBonus, SECRET_FEATS } from '../bonus';
import { makeRng } from '../seed';
import { periodChampion } from '../standings';
import { store } from '../storage';
import { weekOf } from '../bar';
import { OPEN_FLOOR, OPEN_PER_PLAYER, payouts } from '../purse';
import { balanceOf, canShop, earningsOf, itemById } from '../shop';
import { SAMPLES } from '../designer/samples';
import { MAX_OVER_PAR, type AdminOverview, type AdminWindow, type AdminKpis, type AdminToday, type FieldRow, type AdminTodayEvent, type AdminTodayPerson, type Api, type CardProgress, type HoleReport, type RoundShot, type BarBoard, type ClubRow, type Design, type MembersHole, type DailyCrown, type DailyDay, type DailyRow, type Honors, type DailyState, type DailyTry, type Avatar, type Champion, type Feedback, type Invite, type Notice, type ShoutKind, type MemberActivity, type Payout, type OpenChampion, type OpenRow, type PracticeKind, type PracticeReport, type Round, type TrendDay } from './types';

type DbPlayer = { id: string; groupId: string; name: string; pin: string; token: string; avatar: Avatar; joined: string; admin?: boolean; host?: boolean };
type DbRound = Round & { groupId: string; shots?: RoundShot[] };
type DbInvite = Omit<Invite, 'usedBy'> & { groupId: string; usedBy: string | null; createdBy?: string };
type DbFeedback = Omit<Feedback, 'from'> & { groupId: string; playerId: string };
type DbPractice = { id: number; groupId: string; playerId: string; kind: PracticeKind; startedAt: string; endedAt: string | null; shots: number };
type Db = { groups: Record<string, { id: string; name: string }>; players: DbPlayer[]; rounds: DbRound[]; invites?: DbInvite[]; feedback?: DbFeedback[]; notices?: (Notice & { groupId: string; authorId: string; live: boolean })[]; practice?: DbPractice[]; days?: { playerId: string; day: string; visits: number; lockers: number }[]; seen?: Record<string, string>; daily?: { playerId: string; day: string; t: DailyTry }[]; bar?: { playerId: string; game: string; week: string; score: number }[]; designs?: (Design & { playerId: string; reviewedAt?: string })[]; purchases?: { playerId: string; item: string; price: number }[]; designPlays?: { design: number; playerId: string; week: string }[]; cards?: (CardProgress & { id: number; playerId: string; day: string; course: string; done: boolean })[]; shoutouts?: { id: number; groupId: string; fromId: string; toId: string; kind: ShoutKind; body: string; seen: boolean; removed: boolean; createdAt: string }[] };

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

// The purses of every closed period at a club, as period_payouts does on the server: everyone who played puts in, but
// only members whose home club it is take money out (someone playing in from another club is paid at home)
// From Nov 8, as open_payouts does: one purse across every club, each person once, paid on their home seat
function openPaid(db: Db, month: string): Payout[] {
  const out: Payout[] = [];
  for (const m of [...new Set(db.rounds.filter((r) => openPurseOn(r.month) && r.month < month).map((r) => r.month))].sort()) {
    const best = new Map<string, { tp: number; name: string }>();
    for (const r of db.rounds.filter((x) => x.month === m)) {
      const p = db.players.find((x) => x.id === r.playerId);
      if (!p) continue;
      const home = homeOf(db, p);
      const tp = r.total - r.par;
      if (tp < (best.get(home.id)?.tp ?? Infinity)) best.set(home.id, { tp, name: home.name });
    }
    const sorted = [...best.entries()].sort((a, b) => a[1].tp - b[1].tp);
    const rows = sorted.map(([id, b]) => ({ id, rank: sorted.findIndex((x) => x[1].tp === b.tp) + 1 }));
    for (const [id, p] of payouts(rows, null, rows.length, OPEN_PER_PLAYER, OPEN_FLOOR)) if (p.payout > 0) out.push({ month: m, playerId: id, name: best.get(id)!.name, ...p });
  }
  return out;
}

function paidIn(db: Db, groupId: string, month: string): Payout[] {
  const rounds = db.rounds.filter((r) => r.groupId === groupId && r.month < month && !openPurseOn(r.month));
  const out: Payout[] = openPaid(db, month).filter((p) => db.players.find((x) => x.id === p.playerId)?.groupId === groupId);
  for (const m of [...new Set(rounds.map((r) => r.month))].sort()) {
    const best = new Map<string, number>();
    const entries = new Set<string>();
    for (const r of rounds.filter((x) => x.month === m)) {
      const p = db.players.find((x) => x.id === r.playerId);
      if (!p || p.host) continue;
      entries.add(p.id);
      if (homeOf(db, p).groupId !== groupId) continue;
      best.set(r.playerId, Math.min(best.get(r.playerId) ?? Infinity, r.total - r.par));
    }
    const sorted = [...best.entries()].sort((a, b) => a[1] - b[1]);
    const rows = sorted.map(([id, tp]) => ({ id, rank: sorted.findIndex((x) => x[1] === tp) + 1 }));
    for (const [id, p] of payouts(rows, null, entries.size)) if (p.payout > 0) out.push({ month: m, playerId: id, ...p });
  }
  return out;
}

// every past day's Closest to the Pin winner, as a person ('name|pin'): holed first, holed sooner, then nearest
function ctpWinners(db: Db): string[] {
  const today = todayInGameTz();
  const days = new Map<string, Map<string, { holed: number; ft: number }>>();
  for (const s of db.daily ?? []) {
    const p = db.players.find((x) => x.id === s.playerId);
    if (!p || s.day >= today) continue;
    const k = `${p.name.toLowerCase()}|${p.pin}`;
    const day = days.get(s.day) ?? new Map();
    const x = day.get(k) ?? { holed: Infinity, ft: Infinity };
    day.set(k, { holed: s.t.holed ? Math.min(x.holed, s.t.try) : x.holed, ft: !s.t.holed && !s.t.lost && s.t.ft !== null ? Math.min(x.ft, s.t.ft) : x.ft });
    days.set(s.day, day);
  }
  return [...days.values()].flatMap((day) => {
    const top = [...day].filter(([, x]) => x.holed < Infinity || x.ft < Infinity).sort((a, b) => a[1].holed - b[1].holed || a[1].ft - b[1].ft)[0];
    return top ? [top[0]] : [];
  });
}

function playerByToken(db: Db, token: string): DbPlayer {
  const p = db.players.find((x) => x.token === token);
  if (!p) throw new Error('Session expired. Rejoin with your invite link.');
  return p;
}

// Where someone's play counts: their membership in the club they belong to, not one they only run (host).
// Where a round (and shop spending) counts: a playing seat plays for its own club; a host-only seat plays at home
const playSeat = (db: Db, me: DbPlayer) => (me.host ? homeOf(db, me) : me);

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
    const month = periodOf(today);
    const mine = db.rounds.filter((r) => r.groupId === me.groupId);
    const champions = [...new Set(mine.filter((r) => r.month < month).map((r) => r.month))]
      .sort()
      .reverse()
      .map((m) => periodChampion(m, mine))
      .filter((c): c is Champion => !!c);
    const wins = (id: string) => champions.filter((c) => c.playerIds.includes(id)).length;
    const paid = paidIn(db, me.groupId, month);
    // the last closed period's purse: from Nov 8 the whole Open's
    const last = [...paid, ...openPaid(db, month)].map((p) => p.month).sort().pop();
    const lastPaid = !last
      ? []
      : openPurseOn(last)
        ? openPaid(db, month).filter((p) => p.month === last).map((p) => ({ ...p, mine: db.players.some((x) => x.id === p.playerId && x.name.toLowerCase() === me.name.toLowerCase() && x.pin === me.pin) })).sort((a, b) => a.place - b.place)
        : paid.filter((p) => p.month === last).sort((a, b) => a.place - b.place);
    // the money list and the Pro Shop follow the person across their clubs
    const seatsOf = (p: DbPlayer) => db.players.filter((x) => x.name.toLowerCase() === p.name.toLowerCase() && x.pin === p.pin);
    const money = (p: DbPlayer) => {
      const seats = seatsOf(p);
      const ids = new Set(seats.map((x) => x.id));
      const got = [...new Set(seats.map((x) => x.groupId))].flatMap((g) => (g === me.groupId ? paid : paidIn(db, g, month))).filter((x) => ids.has(x.playerId));
      const bought = (db.purchases ?? []).filter((x) => ids.has(x.playerId));
      // the club bonuses, as person_bonus does on the server
      const rs = db.rounds.filter((r) => ids.has(r.playerId));
      const roundDays = rs.map((r) => todayInGameTz(new Date(r.createdAt)));
      const bonus = bonusOf({
        roundDays,
        days: [...(db.days ?? []).filter((d) => ids.has(d.playerId)).map((d) => d.day), ...roundDays, ...(db.practice ?? []).filter((x) => ids.has(x.playerId)).map((x) => todayInGameTz(new Date(x.startedAt)))],
        ctpWins: ctpWinners(db).filter((w) => w === `${p.name.toLowerCase()}|${p.pin}`).length,
        // birdies and better pay on the day's first finished round only
        holes: rs.filter((r, i) => !rs.slice(0, i).some((x) => todayInGameTz(new Date(x.createdAt)) === todayInGameTz(new Date(r.createdAt)))).flatMap((r) => {
          const pars = courseById(r.course)?.holes.map((h) => h.par);
          return pars?.length === r.holes.length ? r.holes.map((s, i): [number, number] => [s, pars[i]]) : [];
        }),
        // as person_bonus does: the moments on daily cards (from Nov 8), secrets found, and plays of their holes
        ...(() => {
          const cards = rs.filter((r) => cardsOn(r.month));
          const strokes = cards.flatMap((r) => (r.shots ?? []).map((x, k, all) => ({ ...x, first: !all.slice(0, k).some((y) => y.h === x.h) })));
          const putts = strokes.filter((x) => x.c === 'putter' && x.i).reduce((a, x) => a + puttBonus(Math.hypot(x.t[0] - x.f[0], x.t[1] - x.f[1])), 0);
          const chipins = strokes.filter((x) => x.c !== 'putter' && x.i && x.l !== 'green' && !x.first).length * BONUS.chipin;
          const secrets = new Set(cards.flatMap((r) => r.feats.filter((f) => SECRET_FEATS.includes(f)))).size * BONUS.secret;
          const mine = new Set((db.designs ?? []).filter((d) => ids.has(d.playerId)).map((d) => d.id));
          const weeks = new Map<string, number>();
          for (const x of db.designPlays ?? []) if (mine.has(x.design)) weeks.set(x.week, (weeks.get(x.week) ?? 0) + 1);
          const designs = [...weeks.values()].reduce((a, n) => a + Math.min(BONUS.designWeek, n * BONUS.designPlay), 0);
          return { putts, chipins, secrets, designs };
        })(),
      });
      return { earnings: got.reduce((a, x) => a + x.payout, 0), top10s: got.length, spent: bought.reduce((a, x) => a + x.price, 0), owned: [...new Set(bought.map((x) => x.item))], bonus };
    };
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
          ...money(p),
          away: homeOf(db, p).groupId !== p.groupId,
        })),
      rounds: mine.filter((r) => r.month === month).map(strip),
      champions,
      payouts: lastPaid,
    };
  },

  async submitRound(session, r) {
    const db = load();
    const me = playSeat(db, playerByToken(db, session.token)); // a playing seat plays here; a host seat plays at home
    const month = periodOf(todayInGameTz());
    const course = courseFor(month);
    if (r.course !== course.id || r.holes.length !== course.holes.length) throw new Error("That round doesn't match this month's course.");
    const holes = r.holes.map((s, i) => Math.max(1, Math.min(course.holes[i].par + MAX_OVER_PAR, Math.round(s))));
    const total = holes.reduce((a, b) => a + b, 0);
    const feats = [...new Set(r.feats)];
    if (total < course.par) feats.push('underpar');
    const spots = r.spots?.length === holes.length ? r.spots.map((p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null)) : null;
    const today = todayInGameTz();
    // daily cards: one round a day counts
    const seats = new Set(db.players.filter((p) => p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.id));
    if (cardsOn(month) && db.rounds.some((x) => seats.has(x.playerId) && x.month === month && todayInGameTz(new Date(x.createdAt)) === today))
      throw new Error('Your card for today is already in. Practise as much as you like.');
    if (cardsOn(month) && (db.cards ?? []).some((c) => seats.has(c.playerId) && c.playerId !== me.id && c.day === today && !c.done))
      throw new Error("Today's card is going at another club. Finish it there.");
    db.rounds.push({ playerId: me.id, groupId: me.groupId, month, course: course.id, holes, total, par: course.par, feats, spots, shots: r.shots?.slice(0, 150), createdAt: new Date().toISOString() });
    const card = (db.cards ?? []).find((c) => c.playerId === me.id && c.day === today);
    if (card) card.done = true;
    save(db);
  },

  async buyItem(session, id) {
    const snap = await this.snapshot(session);
    const db = load();
    const me = playerByToken(db, session.token);
    const p = snap.players.find((x) => x.id === me.id);
    const item = itemById(id);
    if (!item || !p) throw new Error('That isn’t in the shop.');
    if (p.owned?.includes(id)) return;
    if (item.rack === 'legend' && !(p.wins ?? 0)) throw new Error('The Club Legend rack opens with a weekly title.');
    if (!canShop(item.rack, earningsOf(p), p.wins ?? 0)) throw new Error('That rack is for higher ranks.');
    if (balanceOf(p) < item.price) throw new Error('Not enough in the bank for that.');
    (db.purchases ??= []).push({ playerId: me.id, item: id, price: item.price });
    save(db);
  },

  async saveAvatar(session, avatar) {
    const db = load();
    // your look is the same in every club you belong to
    const me = playerByToken(db, session.token);
    for (const p of db.players) if (p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin) p.avatar = avatar;
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

  async sendShoutout(session, to, kind, body) {
    const db = load();
    const me = playerByToken(db, session.token);
    const clean = body.replace(/\s+/g, ' ').trim();
    if (kind !== 'kudos' && kind !== 'chirp') throw new Error('Kudos or a chirp, nothing else.');
    if (!clean || clean.length > 80) throw new Error('Keep it to 80 characters.');
    const them = db.players.find((p) => p.id === to);
    if (!them || them.groupId !== me.groupId) throw new Error('They are not in your club.');
    if (them.id === me.id) throw new Error('You cannot chirp yourself. Well, you can, but not here.');
    const list = (db.shoutouts ??= []);
    const today = list.filter((x) => x.fromId === me.id && todayInGameTz(new Date(x.createdAt)) === todayInGameTz());
    if (today.length >= 20) throw new Error('That is twenty for today. Save some for tomorrow.');
    if (today.filter((x) => x.toId === them.id).length >= 3) throw new Error('Three to one member is plenty for one day.');
    list.push({ id: list.length + 1, groupId: me.groupId, fromId: me.id, toId: them.id, kind, body: clean, seen: false, removed: false, createdAt: new Date().toISOString() });
    save(db);
  },

  async myShoutouts(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    const mine = new Set(db.players.filter((p) => p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.id));
    const since = Date.now() - 86400000; // a day, then they clear themselves
    return (db.shoutouts ?? [])
      .filter((x) => mine.has(x.toId) && !x.seen && !x.removed && Date.parse(x.createdAt) > since)
      .reverse()
      .slice(0, 12)
      .map((x) => {
        const f = db.players.find((p) => p.id === x.fromId);
        return { id: x.id, kind: x.kind, body: x.body, from: f?.name ?? 'A member', fromAvatar: f?.avatar, createdAt: x.createdAt };
      });
  },

  async seenShoutouts(session, ids) {
    const db = load();
    const me = playerByToken(db, session.token);
    const mine = new Set(db.players.filter((p) => p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.id));
    for (const x of db.shoutouts ?? []) if (ids.includes(x.id) && mine.has(x.toId)) x.seen = true;
    save(db);
  },

  async adminShoutouts(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see the admin tab.');
    const since = Date.now() - 14 * 86400000;
    const name = (id: string) => db.players.find((p) => p.id === id)?.name ?? '?';
    return (db.shoutouts ?? [])
      .filter((x) => x.groupId === me.groupId && Date.parse(x.createdAt) > since)
      .reverse()
      .slice(0, 60)
      .map((x) => ({ id: x.id, kind: x.kind, body: x.body, from: name(x.fromId), to: name(x.toId), seen: x.seen, removed: x.removed, createdAt: x.createdAt }));
  },

  async removeShoutout(session, id) {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can take these down.');
    const x = (db.shoutouts ?? []).find((y) => y.id === id && y.groupId === me.groupId);
    if (x) x.removed = true;
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
    const kinds = (['caldera', 'range', 'shortgame', 'course'] as const).flatMap((kind) => {
      const k = s.filter((x) => x.kind === kind);
      return k.length ? [{ kind, sessions: k.length, members: new Set(k.map((x) => x.playerId)).size, minutes: Math.round(k.reduce((a, x) => a + mins(x), 0) / 60) }] : [];
    });
    const members = [...new Set(s.map((x) => x.playerId))]
      .map((id) => {
        const m = s.filter((x) => x.playerId === id);
        const n = (k: PracticeKind) => m.filter((x) => x.kind === k).length;
        return { name: name(id), caldera: n('caldera'), range: n('range'), shortgame: n('shortgame'), course: n('course'), lastAt: m.map((x) => x.startedAt).sort().pop()! };
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
    const month = periodOf(todayInGameTz());
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
    const month = periodOf(todayInGameTz());
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

  // as on the server: the top of yesterday's Daily Shot board, if anyone scored
  async dailyCrown(session): Promise<DailyCrown | null> {
    const d = new Date(`${todayInGameTz()}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.toISOString().slice(0, 10);
    const top = (await localApi.dailyState(session, day)).board.find((r) => r.holed || r.ft !== null);
    if (!top) return null;
    const db = load();
    const me = playerByToken(db, session.token);
    const ids = db.players.filter((p) => p.groupId === me.groupId && p.name.toLowerCase() === top.name.toLowerCase()).map((p) => p.id);
    return { day, name: top.name, club: top.club, ft: top.ft, holed: top.holed, ids };
  },

  async periodHonors(session, period): Promise<Honors> {
    const db = load();
    const me = playerByToken(db, session.token);
    const name = (id: string) => db.players.find((p) => p.id === id)?.name ?? '?';
    const per = new Map<string, { best: number; n: number; sum: number; worst: number; aces: number }>();
    for (const r of db.rounds.filter((r) => r.groupId === me.groupId && r.month === period)) {
      const tp = r.total - r.par;
      const x = per.get(name(r.playerId)) ?? { best: Infinity, n: 0, sum: 0, worst: -Infinity, aces: 0 };
      per.set(name(r.playerId), { best: Math.min(x.best, tp), n: x.n + 1, sum: x.sum + tp, worst: Math.max(x.worst, tp), aces: x.aces + Number(r.feats.includes('ace')) });
    }
    const rows = [...per].map(([n, x]) => ({ name: n, ...x, av: Math.round((x.sum / x.n) * 10) / 10 })).sort((a, b) => a.name.localeCompare(b.name));
    const bests = [...new Set(rows.map((r) => r.best))].sort((a, b) => a - b);
    const top = <K extends 'n' | 'worst'>(k: K) => (rows.length ? Math.max(...rows.map((r) => r[k])) : null);
    const steady = rows.filter((r) => r.n >= 5);
    const lowAv = steady.length ? Math.min(...steady.map((r) => r.av)) : null;
    return {
      period,
      champions: rows.filter((r) => r.best === bests[0]).map((r) => ({ name: r.name, toPar: r.best })),
      runnersUp: rows.filter((r) => r.best === bests[1]).map((r) => ({ name: r.name, toPar: r.best })),
      mostRounds: rows.length ? { names: rows.filter((r) => r.n === top('n')).map((r) => r.name), count: top('n')! } : null,
      aces: rows.filter((r) => r.aces).map((r) => ({ name: r.name, count: r.aces })),
      lowestAverage: lowAv === null ? null : { names: steady.filter((r) => r.av === lowAv).map((r) => r.name), avg: lowAv },
      highestScore: rows.length ? { names: rows.filter((r) => r.worst === top('worst')).map((r) => r.name), toPar: top('worst')! } : null,
    };
  },

  // local mode keeps only today's card, not every round start
  async startRound(session, course, card) {
    if (!card || !cardsOn(periodOf(todayInGameTz()))) return null;
    const db = load();
    const me = playSeat(db, playerByToken(db, session.token));
    const today = todayInGameTz();
    const cards = (db.cards ??= []);
    // one card a day per person, whichever club it's played in
    const seats = new Set(db.players.filter((p) => p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.id));
    const c = cards.find((x) => seats.has(x.playerId) && x.day === today);
    if (c?.done || db.rounds.some((x) => seats.has(x.playerId) && todayInGameTz(new Date(x.createdAt)) === today && cardsOn(x.month)))
      throw new Error('Your card for today is already in. Practise as much as you like.');
    if (c && c.playerId !== me.id) throw new Error("Today's card is going at another club. Finish it there.");
    if (c) return c.id;
    const id = cards.length + 1;
    cards.push({ id, playerId: me.id, day: today, course, done: false, scores: [], shots: 0, spots: [], feats: [] });
    save(db);
    return id;
  },
  async roundProgress() {},
  async cardToday(session) {
    const today = todayInGameTz();
    if (!cardsOn(periodOf(today))) return null;
    const db = load();
    const me = playSeat(db, playerByToken(db, session.token));
    const seats = new Set(db.players.filter((p) => p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.id));
    const c = (db.cards ?? []).find((x) => seats.has(x.playerId) && x.day === today);
    const r = db.rounds.find((x) => seats.has(x.playerId) && todayInGameTz(new Date(x.createdAt)) === today);
    const done = !!r;
    // the card's club, when it's at another of this person's clubs
    const atGroup = c ? db.players.find((p) => p.id === c.playerId)?.groupId : r?.groupId;
    const at = atGroup && atGroup !== me.groupId ? { clubId: atGroup, club: Object.values(db.groups).find((g) => g.id === atGroup)?.name ?? null } : {};
    return c ? { ...c, done: done || c.done, ...at } : { done, id: null, course: null, scores: [], shots: 0, spots: [], feats: [], ...at };
  },
  async cardProgress(session, id, p) {
    const db = load();
    const me = playSeat(db, playerByToken(db, session.token));
    const c = (db.cards ?? []).find((x) => x.id === id && x.playerId === me.id && !x.done && x.day === todayInGameTz());
    // a swing can't be taken back
    if (!c || p.scores.length < c.scores.length || (p.scores.length === c.scores.length && p.shots < c.shots)) return;
    Object.assign(c, { scores: p.scores, shots: p.shots, spots: p.spots, feats: p.feats });
    save(db);
  },

  // as on the server: Weekly Players for each day since the first member joined
  async adminTrend(session): Promise<TrendDay[]> {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see the admin tab.');
    const clubs = new Set(db.players.filter((p) => p.admin && p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.groupId));
    const members = db.players.filter((p) => clubs.has(p.groupId) && !p.admin);
    const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: GAME_TZ });
    const joined = members.filter((p) => !p.host).map((p) => day(p.joined));
    const played = db.rounds.filter((r) => members.some((p) => p.id === r.playerId)).map((r) => ({ id: r.playerId, d: day(r.createdAt) }));
    const today = todayInGameTz();
    const out: TrendDay[] = [];
    for (let d = joined.length ? joined.reduce((a, b) => (a < b ? a : b)) : today; d <= today; ) {
      const from = new Date(`${d}T12:00:00Z`);
      from.setUTCDate(from.getUTCDate() - 7);
      const lo = from.toISOString().slice(0, 10);
      out.push({ day: d, players: new Set(played.filter((r) => r.d > lo && r.d <= d).map((r) => r.id)).size, members: joined.filter((j) => j <= d).length });
      const next = new Date(`${d}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      d = next.toISOString().slice(0, 10);
    }
    return out;
  },

  // as course_field does on the server: today's finished rounds on the course with their spots, every club (local mode
  // keeps no cards in progress, so nobody shows as out on the course)
  async courseField(session, course): Promise<FieldRow[]> {
    const db = load();
    const me = playerByToken(db, session.token);
    const today = todayInGameTz();
    const club = (id: string) => Object.values(db.groups).find((g) => g.id === id)?.name ?? '?';
    const best = new Map<string, DbRound>();
    for (const r of db.rounds) {
      const p = db.players.find((x) => x.id === r.playerId);
      if (!p || !r.spots || r.course !== course || todayInGameTz(new Date(r.createdAt)) !== today) continue;
      const k = `${p.name.toLowerCase()}|${p.pin}`;
      const b = best.get(k);
      if (!b || r.total - r.par < b.total - b.par) best.set(k, r);
    }
    return [...best.values()].map((r) => {
      const p = db.players.find((x) => x.id === r.playerId)!;
      const local = db.players.find((x) => x.groupId === me.groupId && x.name.toLowerCase() === p.name.toLowerCase() && x.pin === p.pin);
      const mine = p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin;
      return { playerId: p.id, name: p.name, club: club(p.groupId), avatar: p.avatar, holes: r.holes, spots: r.spots!, going: false, at: r.createdAt, mine, localId: local?.id ?? null };
    });
  },

  // as admin_today does on the server, from what local mode keeps (no visits, so "in" means did something today)
  async adminToday(session): Promise<AdminToday> {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see the admin tab.');
    const clubs = new Set(db.players.filter((p) => p.admin && p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.groupId));
    const club = (id: string) => Object.values(db.groups).find((g) => g.id === id)?.name ?? '?';
    const today = todayInGameTz();
    const isToday = (iso: string) => todayInGameTz(new Date(iso)) === today;
    const mem = db.players.filter((p) => clubs.has(p.groupId) && !p.admin && !p.host);
    const who = (id: string) => mem.find((p) => p.id === id);
    const feed: AdminTodayEvent[] = [];
    for (const r of db.rounds) {
      const p = who(r.playerId);
      if (p && isToday(r.createdAt)) feed.push({ at: r.createdAt, kind: 'round', name: p.name, club: club(p.groupId), what: r.course, total: r.total, par: r.par, n: null, ft: null });
    }
    for (const x of db.practice ?? []) {
      const p = who(x.playerId);
      if (p && isToday(x.startedAt)) feed.push({ at: x.startedAt, kind: 'practice', name: p.name, club: club(p.groupId), what: x.kind, total: null, par: null, n: x.shots, ft: null });
    }
    for (const p of mem) if (isToday(p.joined)) feed.push({ at: p.joined, kind: 'join', name: p.name, club: club(p.groupId), what: null, total: null, par: null, n: null, ft: null });
    feed.sort((a, b) => b.at.localeCompare(a.at));
    const cards = (db.cards ?? []).filter((c) => c.day === today);
    const people: AdminTodayPerson[] = mem
      .map((p): AdminTodayPerson | null => {
        const mine = feed.filter((e) => e.name === p.name && e.club === club(p.groupId));
        const round = mine.find((e) => e.kind === 'round');
        const going = cards.find((c) => c.playerId === p.id && !c.done);
        if (!mine.length && !going) return null;
        return {
          name: p.name,
          club: club(p.groupId),
          last: mine[0]?.at ?? null,
          card: round ? ('in' as const) : going ? ('going' as const) : null,
          toPar: round ? round.total! - round.par! : null,
          total: round?.total ?? null,
          hole: going ? going.scores.length + 1 : null,
          practice: mine.filter((e) => e.kind === 'practice').length,
          daily: false,
          dailyFt: null,
        };
      })
      .filter((x): x is AdminTodayPerson => !!x);
    return { today, in: people.length, cardsIn: people.filter((p) => p.card === 'in').length, onCourse: people.filter((p) => p.card === 'going').length, people, feed };
  },

  // as admin_kpis does on the server, from what local mode keeps
  async adminKpis(session): Promise<AdminKpis> {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see the admin tab.');
    const clubs = new Set(db.players.filter((p) => p.admin && p.name.toLowerCase() === me.name.toLowerCase() && p.pin === me.pin).map((p) => p.groupId));
    const mem = db.players.filter((p) => clubs.has(p.groupId) && !p.admin && !p.host);
    const ids = new Set(mem.map((p) => p.id));
    const rd = db.rounds.filter((r) => ids.has(r.playerId));
    const today = todayInGameTz();
    const per = periodOf(today);
    const months = [...new Set(rd.map((r) => r.month))].sort();
    const prev = months.filter((m) => m < per).pop() ?? null;
    const day = (iso: string) => todayInGameTz(new Date(iso));
    const shift = (d: string, n: number) => {
      const x = new Date(`${d}T12:00:00Z`);
      x.setUTCDate(x.getUTCDate() + n);
      return x.toISOString().slice(0, 10);
    };
    const seen = (d: string) =>
      new Set([...(db.days ?? []).filter((x) => ids.has(x.playerId) && x.day === d).map((x) => x.playerId), ...rd.filter((r) => day(r.createdAt) === d).map((r) => r.playerId), ...(db.practice ?? []).filter((x) => ids.has(x.playerId) && day(x.startedAt) === d).map((x) => x.playerId)]).size;
    const playedOn = (d: string) => new Set(rd.filter((r) => day(r.createdAt) === d).map((r) => r.playerId)).size;
    const who = (m: string | null) => new Set(rd.filter((r) => r.month === m).map((r) => r.playerId));
    const now = who(per);
    const last = who(prev);
    const fresh = mem.filter((p) => Date.now() - Date.parse(p.joined) < 14 * 86400000);
    const course = courseFor(per);
    const mine = rd.filter((r) => r.month === per);
    const holes = course.holes.map((h, i) => {
      const xs = mine.map((r) => r.holes[i]).filter((x) => x !== undefined);
      const c = (f: (x: number) => boolean) => xs.filter(f).length;
      return { hole: i + 1, par: h.par, n: xs.length, avg: xs.length ? Math.round((xs.reduce((a, x) => a + x - h.par, 0) / xs.length) * 100) / 100 : 0, eagle: c((x) => x <= h.par - 2), birdie: c((x) => x === h.par - 1), pars: c((x) => x === h.par), bogey: c((x) => x === h.par + 1), worse: c((x) => x >= h.par + 2) };
    });
    return {
      period: per,
      prevPeriod: prev,
      today,
      members: mem.length,
      visitedToday: seen(today),
      playedToday: playedOn(today),
      visitedWeekAgo: seen(shift(today, -7)),
      playedWeekAgo: playedOn(shift(today, -7)),
      lastPlayers: last.size,
      cameBack: [...last].filter((id) => now.has(id)).length,
      rounds: mine.length,
      players: now.size,
      prevRounds: rd.filter((r) => r.month === prev).length,
      prevPlayers: last.size,
      joined14: fresh.length,
      firstRound14: fresh.filter((p) => rd.some((r) => r.playerId === p.id)).length,
      neverPlayed14: fresh.filter((p) => !rd.some((r) => r.playerId === p.id)).map((p) => p.name),
      purse: 1000 * now.size,
      shop7: (db.purchases ?? []).filter((x) => ids.has(x.playerId)).reduce((a, x) => a + x.price, 0),
      shopAll: (db.purchases ?? []).filter((x) => ids.has(x.playerId)).reduce((a, x) => a + x.price, 0),
      ai: { today: {}, designsToday: 0, month: 0 },
      days: Array.from({ length: 14 }, (_, i) => shift(today, i - 13)).map((d) => ({ day: d, played: playedOn(d), visited: seen(d) })),
      weeks: months.map((m, i) => {
        const before = who(months[i - 1] ?? null);
        const these = who(m);
        return { period: m, players: these.size, rounds: rd.filter((r) => r.month === m).length, back: [...before].filter((id) => these.has(id)).length, before: before.size };
      }),
      holes,
    };
  },

  // as record_design_play does: once per member per hole a week, never your own hole
  async recordDesignPlay(session, id) {
    const db = load();
    const me = homeOf(db, playerByToken(db, session.token));
    const d = (db.designs ?? []).find((x) => x.id === id && x.status === 'approved');
    if (!d || d.playerId === me.id) return false;
    const week = periodOf(todayInGameTz());
    const plays = (db.designPlays ??= []);
    if (plays.some((p) => p.design === id && p.playerId === me.id && p.week === week)) return false;
    plays.push({ design: id, playerId: me.id, week });
    save(db);
    return true;
  },

  // as admin_holes does on the server: this period's shots, hole by hole
  async adminHoles(session): Promise<HoleReport[]> {
    const db = load();
    const me = playerByToken(db, session.token);
    if (!me.admin) throw new Error('Only the committee can see the admin tab.');
    const per = periodOf(todayInGameTz());
    const rounds = db.rounds.filter((r) => r.month === per && r.shots?.length && !db.players.find((p) => p.id === r.playerId)?.admin);
    return courseFor(per).holes.map((_, i) => {
      const per = rounds.map((r) => r.shots!.filter((x) => x.h === i)).filter((x) => x.length);
      const count = (f: (x: RoundShot) => boolean) => per.flat().filter(f).length;
      const tally = (xs: string[]) => xs.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});
      const putts = per.map((x) => x.filter((y) => y.c === 'putter').length);
      return {
        hole: i + 1,
        rounds: per.length,
        putts: per.length ? Math.round((putts.reduce((a, b) => a + b, 0) / per.length) * 100) / 100 : 0,
        threePutts: per.length ? Math.round((putts.filter((n) => n >= 3).length / per.length) * 100) / 100 : 0,
        penalties: per.length ? Math.round((count((x) => x.x === 1) / per.length) * 100) / 100 : 0,
        teeClubs: tally(per.map((x) => x[0].c)),
        lies: tally(per.flat().map((x) => x.l)),
        tee: per.map((x) => x[0].t).slice(0, 200),
        wet: per.flat().filter((x) => x.x === 1).map((x) => x.t).slice(0, 200),
      };
    });
  },

  // local mode keeps one period at a time, so there's never a playoff to play
  async playoffState() {
    return null;
  },
  async playoffStart() {},
  async playoffFinish() {},
  async playoffShot() {},

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
    const month = todayInGameTz().slice(0, 7); // the calendar month, whatever the game period
    return db.players
      .filter((p) => p.groupId === me.groupId && !p.admin)
      .map((p) => {
        const rounds = db.rounds.filter((r) => r.playerId === p.id);
        const practice = (db.practice ?? []).filter((x) => x.playerId === p.id);
        const days = (db.days ?? []).filter((x) => x.playerId === p.id && x.day.startsWith(month));
        const lastSeen = [db.seen?.[p.id], ...rounds.map((r) => r.createdAt), ...practice.map((x) => x.startedAt)].filter(Boolean).sort().pop() ?? null;
        const active = new Set([...days.map((x) => x.day), ...rounds.filter((r) => todayInGameTz(new Date(r.createdAt)).startsWith(month)).map((r) => todayInGameTz(new Date(r.createdAt))), ...practice.filter((x) => x.startedAt.startsWith(month)).map((x) => todayInGameTz(new Date(x.startedAt)))]);
        return {
          name: p.name,
          lastSeen,
          days: active.size,
          rounds: rounds.filter((r) => todayInGameTz(new Date(r.createdAt)).startsWith(month)).length,
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
      window === 'week' ? new Date(Date.now() - 7 * 86_400_000).toISOString() : window === 'month' ? `${todayInGameTz().slice(0, 7)}-01` : '';
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
        unfinished: 0, // local mode doesn't keep round starts
      };
    });
    const who = (id: string) => db.players.find((p) => p.id === id);
    const feed: AdminOverview['feed'] = [
      ...db.rounds.filter((r) => clubs.has(r.groupId) && !who(r.playerId)?.admin).map((r) => ({ at: r.createdAt, kind: 'round' as const, club: club(r.groupId), name: who(r.playerId)?.name ?? '?', course: r.course, total: r.total, par: r.par, what: null, shots: null })),
      ...(db.practice ?? []).filter((x) => clubs.has(x.groupId) && !who(x.playerId)?.admin).map((x) => ({ at: x.startedAt, kind: 'practice' as const, club: club(x.groupId), name: who(x.playerId)?.name ?? '?', course: null, total: null, par: null, what: x.kind, shots: x.shots })),
      ...members.map((p) => ({ at: p.joined, kind: 'join' as const, club: club(p.groupId), name: p.name, course: null, total: null, par: null, what: null, shots: null })),
      ...(db.feedback ?? []).filter((f) => clubs.has(f.groupId)).map((f) => ({ at: f.createdAt, kind: 'feedback' as const, club: club(f.groupId), name: who(f.playerId)?.name ?? 'A member', course: null, total: null, par: null, what: f.body.slice(0, 80), shots: null })),
    ]
      .filter((e) => e.at >= since)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 1000);
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

  // Adds Sean, Danny and PJ with a few rounds this period and a past champion.
  seedDemo(session) {
    const db = load();
    const me = playerByToken(db, session.token);
    const month = periodOf(todayInGameTz());
    const course = courseFor(month);
    const rng = makeRng(`demo:${me.id}`);
    const startOf = (p: string) => Date.parse(`${p.length === 10 ? p : `${p}-01`}T17:00:00Z`);
    const prev = periodOf(new Date(startOf(month) - 86_400_000).toISOString().slice(0, 10));
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
          // each buddy's first round this period was played today, so they stand on the course
          const today = m === month && k === 0;
          const spots = today
            ? course.holes.map((h) => {
                const at = h.par === 3 ? h.cup : h.flyover[1];
                return { x: Math.round(at.x + (rng.next() - 0.5) * 30), y: Math.round(at.y + (rng.next() - 0.5) * 30) };
              })
            : null;
          const createdAt = new Date(m === month ? Date.now() - (k * 3 + i + 1) * 3_600_000 : startOf(m) + (k + i) * 86_400_000).toISOString();
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
