// A full round: every hole of this period's course in one go, then the card goes up on the board. From Nov 8 that's
// today's card: one a day counts, locked at the first swing, and picked up where it left off if it's cut short.
// A preview round (the admin, every hole of a course still to come) and a practice round (any member: the first few
// holes of the next course, or the whole of the week's course once cards start) are played the same way but never posted.
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { crest } from '../brand';
import { sfx } from '../fx/sound';
import { Course3D, planVisits, scoreName, type Ghost } from '../golf3d/engine';
import { cardsOn, openPurseOn, todayInGameTz } from '../day';
import { inPoly, isWater, surfaceAt } from '../golf3d/terrain';
import { BONUS, MONSTER_PUTT_FT, puttBonus, SECRET_FEATS, shotBonus } from '../bonus';
import type { CardToday, RoundShot, Spot } from '../api/types';
import { courseFor, type Course } from '../golf3d/courses';
import { conditionsFor } from '../golf3d/conditions';
import { shoutSheet } from './shoutouts';
import { store } from '../storage';
import { hostChip, REGINALD } from '../host';
import { myBest, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { esc, navigate, render } from '../ui';
import { openFeedback } from './feedback';
import { joinPractice, leavePractice } from './practice';
import { range, TARGETS } from '../golf3d/practice/range';
import { shortgame, STATIONS } from '../golf3d/practice/shortgame';
import { scoreClass } from './home';
import { DAILY_TRIES, dailyShot } from '../daily';
import { HANK } from '../staff';
import { askReginald } from '../reginald';
import { DRIVES, driveYards, minigolfScore, type BarGame } from '../bar';
import { HOLLOW_HILLS } from '../golf3d/minigolf';
import { buildHole } from '../designer/hole';
import { isHole } from '../designer/desk';
import type { Hole } from '../golf3d/types';
import { barSummary } from './bar';
import { board } from '../standings';
import { clubPurse, money, openPurse, openPurseOf, placeLabel, purseOf } from '../purse';
import { canShare, dailySummary, share } from './daily';
import { cardStatus, elsewhereLine } from './cardnote';

let game: Course3D | null = null;

// for screens elsewhere that run their own play on the course (the playoff): closeRound tidies it away too
export const useGame = (g: Course3D) => void (game = g);

export function closeRound() {
  leavePractice();
  game?.destroy();
  game = null;
  document.body.classList.remove('court-open');
}

// Everyone else who has played today: their best round of the day, on today's pins and wind.
function todaysField(snap: Snapshot): Ghost[] {
  const best = new Map<string, Snapshot['rounds'][number]>();
  for (const r of snap.rounds) {
    if (r.playerId === snap.me || !r.spots || todayInGameTz(new Date(r.createdAt)) !== snap.today) continue;
    const b = best.get(r.playerId);
    if (!b || r.total < b.total) best.set(r.playerId, r);
  }
  return [...best.values()].flatMap((r) => {
    const p = snap.players.find((x) => x.id === r.playerId);
    return p ? [{ id: p.id, pid: p.id, name: p.name, avatar: p.avatar, spots: r.spots!, holes: r.holes }] : [];
  });
}

// A made-up field for the Committee's rehearsal: up to four other members, each somewhere sensible on every hole with
// a believable score, so the course looks as it will with people out on it
function sampleField(snap: Snapshot, course: Course): Ghost[] {
  const others = snap.players.filter((p) => p.id !== snap.me).slice(0, 4);
  return others.map((p) => ({
    pid: p.id,
    name: p.name,
    avatar: p.avatar,
    holes: course.holes.map((h) => Math.max(2, h.par + [-1, 0, 0, 0, 1, 1, 2][Math.floor(Math.random() * 7)])),
    spots: course.holes.map((h) => {
      for (let t = 0; t < 12; t++) {
        const f = 0.45 + Math.random() * 0.4;
        const p = { x: h.tee.x + (h.cup.x - h.tee.x) * f + (Math.random() - 0.5) * 30, y: h.tee.y + (h.cup.y - h.tee.y) * f + (Math.random() - 0.5) * 30 };
        const s = surfaceAt(h, p);
        if ((s === 'fairway' || s === 'rough' || s === 'fringe') && !isWater(h, p) && inPoly(p, h.border)) return p;
      }
      return null;
    }),
  }));
}

// The round as a text for the group chat: the course and day, the score, and a square for each hole
// (⭐ ace, 🟪 eagle or better, 🟩 birdie, ⬜ par, 🟨 bogey, 🟥 double or worse)
function scoreShare(course: Course, scores: number[], total: number, toPar: number, card: boolean, rehearsal: boolean) {
  const sq = (s: number | undefined, par: number) => (s === undefined ? '▫️' : s === 1 ? '⭐' : s <= par - 2 ? '🟪' : s === par - 1 ? '🟩' : s === par ? '⬜' : s === par + 1 ? '🟨' : '🟥');
  const day = new Date(`${todayInGameTz()}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const what = rehearsal ? 'Preview' : card ? "Today's card" : 'Round';
  return `⛳ Claude Country Club\n${course.name.replace(/ Course$/, '')} · ${day}\n${what}: ${total} (${toParLabel(toPar)})\n${course.holes.map((h, i) => sq(scores[i], h.par)).join('')}\n${location.origin}`;
}

// After a practice round, a nudge for the group chat: what you went round in, and a dig at everyone who hasn't
function practiceShare(course: Course, scores: number[], total: number, toPar: number, live: boolean) {
  const sq = (s: number | undefined, par: number) => (s === undefined ? '▫️' : s === 1 ? '⭐' : s <= par - 2 ? '🟪' : s === par - 1 ? '🟩' : s === par ? '⬜' : s === par + 1 ? '🟨' : '🟥');
  const name = course.name.replace(/ Course$/, '');
  const dig = live ? "Practice is open. Tomorrow's card won't play itself." : 'It opens Sunday. Some of us have practised. Have you?';
  return `⛳ Practised ${name}: ${total} (${toParLabel(toPar)})\n${course.holes.map((h, i) => sq(scores[i], h.par)).join('')}\n${dig}\n${location.origin}`;
}

// Today's card is already in: practise as much as you like. In the Committee's rehearsal, the same screen, with a way
// to deal a fresh card and go again.
function cardIn(snap: Snapshot, dry?: Course, at?: CardToday) {
  const away = at?.club ? elsewhereLine(at) : null;
  render(`<main class="narrow card-in">
    <p class="eyebrow">${esc((dry ?? courseFor(snap.month)).name)}${dry ? ' · rehearsal' : ''}</p>
    <h1>${away ? away.head : "Today's card is in"}</h1>
    ${hostChip(away ? 'One card a day, whichever club you play it in. Practice here is open, and nobody counts it.' : 'One card a day, and yours is on the board. The course is open for practice until midnight. Nobody counts those.', 'dry')}
    ${away && !at!.done ? `<div class="summary-actions"><a class="btn" href="#/" data-go-club="${esc(at!.clubId ?? '')}">${away.go}</a></div>` : ''}
    <div class="summary-actions"><a class="btn" href="${dry ? `#/preview/${dry.id}` : '#/round/practice'}">Practice round</a><a class="btn ghost" href="${dry ? '#/admin' : '#/'}">${dry ? 'Back to the Committee Room' : 'Back to the club'}</a></div>
    ${dry ? '<p class="fine">This is what a member sees after their card on Sunday. Nothing was posted. <button class="link" data-dry-reset>Deal a fresh card and rehearse again</button></p>' : ''}
  </main>`);
  const reset = document.querySelector<HTMLButtonElement>('[data-dry-reset]');
  if (reset)
    reset.onclick = () => {
      store.set(DRY_CARD, '');
      void round(snap, { course: dry, dry: true });
    };
}

// The Committee's rehearsal of Sunday's card: the member's card flow exactly (it locks at the first swing, saves after
// every stroke, picks up where it left off, and ends on the card-in screen), with the card kept on this device instead
// of the club's database, so nothing is posted or paid.
const DRY_CARD = 'ccc-dry-card';
export function dryToday(course: string): CardToday {
  try {
    const c = JSON.parse(store.get(DRY_CARD) || 'null') as (CardToday & { day: string }) | null;
    if (c && c.course === course && c.day === todayInGameTz()) return c;
  } catch {
    /* start a fresh one */
  }
  return { done: false, id: -1, course, scores: [], shots: 0, spots: [], feats: [] };
}
// the rehearsal's card thrown away: a fresh one next time
export const dryForget = () => store.set(DRY_CARD, '');
const drySave = (c: CardToday) => store.set(DRY_CARD, JSON.stringify({ ...c, day: todayInGameTz() }));

// classic: free play on a course of weeks gone by, for the course record (posted to free_rounds, never counted)
export async function round(snap: Snapshot, opts: { course?: Course; holes?: number; practice?: boolean; dry?: boolean; classic?: boolean } = {}) {
  closeRound();
  const preview = !!opts.course;
  // the Committee rehearsing a member's card (see dryToday)
  const dry = !!opts.dry && !!opts.course && !opts.practice;
  const full = opts.course ?? courseFor(snap.month);
  // a practice round of the week's own course (once cards start), rather than the next course's preview holes
  const livePractice = !!opts.practice && full.id === courseFor(snap.month).id;
  // today's card: null when it isn't a card (a preview, practice, before Nov 8, or a database without cards yet)
  let today: CardToday | null = null;
  let cardId: number | null = null;
  if (dry) {
    today = dryToday(full.id);
    if (today.done) return cardIn(snap, full);
    cardId = -1;
  } else if (!preview && cardsOn(snap.month)) {
    today = await api.cardToday(requireSession()).catch(() => null);
    if (today?.club) return cardIn(snap, undefined, today);
    if (today?.done) return cardIn(snap);
    if (today) {
      try {
        cardId = await api.startRound(requireSession(), full.id, true);
      } catch (err) {
        if (/already in|going at/i.test((err as Error).message)) return cardIn(snap);
      }
    }
  }
  const card = !!today;
  // a card cut short picks up where it left off (on this course, today)
  const resume = card && today!.course === full.id && (today!.scores.length > 0 || today!.shots > 0) ? today! : null;
  // a practice round plays just the first few holes
  const holes = full.holes.slice(0, opts.holes ?? full.holes.length);
  const course: Course = { ...full, holes, par: holes.reduce((a, h) => a + h.par, 0) };
  const me = snap.players.find((p) => p.id === snap.me)!;
  const before = myBest(snap);
  render(`<div class="g3" id="g3"></div>`);
  document.body.classList.add('court-open');
  const el = document.getElementById('g3')!;
  let quit = false;
  try {
    game = new Course3D(el, me.avatar, () => {
      quit = true;
      closeRound();
      // leaving the rehearsal goes back to the Committee Room, where its Play tile now shows the card in progress
      navigate(dry ? '#/admin' : '#/');
    });
  } catch {
    closeRound();
    render(`<main class="narrow"><h1>This device can't draw the course</h1><p class="muted">The club needs WebGL. Try a recent Safari or Chrome.</p><a class="btn" href="#/">Back to the club</a></main>`);
    return;
  }
  // a practice round is a practice session: joined here, ended when they leave or finish
  if (opts.practice) {
    game.leaveText = 'Leave';
    game.howTo = 'practice';
    game.onShot = joinPractice(livePractice ? 'course' : 'caldera').shot;
  }
  // today's players are on this period's course, not the preview: the club's at once, then everyone's from every club
  // (each person once) when it arrives, from the next hole the course is set out
  if (!preview) {
    game.setGhosts(todaysField(snap));
    const g = game;
    void api
      .courseField(requireSession(), course.id)
      .then((rows) =>
        g.setGhosts(
          rows.filter((r) => !r.mine).map((r) => ({ id: r.localId ?? undefined, pid: r.localId ?? undefined, name: r.name, avatar: r.avatar, spots: r.spots, holes: r.holes, club: r.club, away: !r.localId, going: r.going })),
        ),
      )
      .catch(() => {});
  }
  // the rehearsal puts a few of the club's members out on the course, as Sunday's field would look
  else if (!opts.practice && !opts.classic) game.setGhosts(sampleField(snap, course));
  // tap another member out on the course: their card, and a kudos or a chirp to send them
  game.onGhostTap = (g) => shoutSheet(el, g, course, snap.players.find((p) => p.id === g.pid), g.club ?? snap.groupName);
  if (!store.get('ccc-shout-tip') && (preview ? !opts.practice : todaysField(snap).length)) {
    store.set('ccc-shout-tip', '1');
    const tip = document.createElement('p');
    tip.className = 'shout-tip';
    tip.textContent = 'Tap a member out on the course to see their card and send them kudos, or a chirp.';
    el.appendChild(tip);
    window.setTimeout(() => tip.remove(), 7000);
  }
  // a hole with a stadium fills its stands with everyone in the Open who has played it this period
  const standsAt = course.holes.findIndex((h) => h.decor.some((d) => d.kind === 'stands'));
  if (standsAt >= 0 && !preview) {
    const g = game;
    void api
      .openBoard(requireSession())
      .then((rows) =>
        g.setGallery(
          rows
            .filter((r) => r.holes[standsAt] !== undefined && r.holes[standsAt] !== null)
            .map((r) => ({ name: r.name, avatar: r.avatar, label: `${scoreName(r.holes[standsAt], course.holes[standsAt].par)} · ${r.club}` })),
        ),
      )
      .catch(() => {});
  }
  game.starter = HANK.firstTee(me.name, snap.today, course.holes[0]?.theme);
  const scores: number[] = resume ? [...resume.scores] : [];
  // who comes by with drinks, and on which holes: different every round
  // (none on a practice of next week's course: that's for Sunday)
  const visits = opts.practice && !livePractice ? [] : planVisits(course.holes.length);
  const spots: Spot[] = resume ? resume.scores.map((_, i) => (resume.spots?.[i] ?? null) as Spot) : [];
  // a counted round logs its start and each hole it reaches, so the Committee can see who stops and where (a card does
  // it as it saves itself)
  const started = preview || card ? Promise.resolve(null) : api.startRound(requireSession(), course.id).catch(() => null);
  const progress = (hole: number, finished = false) =>
    void started.then((id) => (id === null ? undefined : api.roundProgress(requireSession(), id, hole, finished).catch(() => {})));
  const feats = new Set<string>(resume?.feats ?? []);
  // every counted stroke, by hole, posted with the card (a card picked up mid-round only has the holes played since)
  const shotLog: RoundShot[] = [];
  let holeAt = 0;
  // the Committee's preview is a rehearsal of next week: the reward moments fire as they will on a card, but nothing's paid
  const rehearsal = preview && !opts.practice && !opts.classic;
  const pops = card || rehearsal;
  const unpaid = dry ? 'rehearsal, not paid' : rehearsal ? 'preview, not paid' : '';
  const holeShots = new Map<number, number>();
  if (!opts.practice)
    game.onShotLog = (s) => {
      // the moments worth a cheer, on a daily card only (practice and replays earn nothing)
      const first = !holeShots.get(holeAt);
      holeShots.set(holeAt, (holeShots.get(holeAt) ?? 0) + 1);
      if (pops && s.i) {
        const ft = Math.round(Math.hypot(s.t[0] - s.f[0], s.t[1] - s.f[1]));
        if (s.c === 'putter' && puttBonus(ft)) coinPop(el, puttBonus(ft), ft >= MONSTER_PUTT_FT ? 'Monster putt' : 'Long putt', unpaid || `${ft} ft`);
        else if (s.c !== 'putter' && s.l !== 'green' && !first) coinPop(el, BONUS.chipin, 'Chip-in', unpaid || 'from off the green');
      }
      if (!preview && shotLog.length < 150) shotLog.push({ ...s, h: holeAt });
    };
  // secrets this member has found before (on any card), so only a first find pays
  const foundBefore = new Set(me.feats ?? []);
  // a card saves itself after every stroke, so a swing can't be taken back by leaving
  let here = resume?.shots ?? 0; // strokes on the hole being played, for Leave's summary
  const save = (shots: number) => {
    here = shots;
    if (dry) return drySave({ done: false, id: -1, course: full.id, scores: [...scores], shots, spots: scores.map((_, j) => spots[j] ?? null), feats: [...feats] });
    if (cardId !== null)
      void api.cardProgress(requireSession(), cardId, { scores: [...scores], shots, spots: scores.map((_, j) => spots[j] ?? null), feats: [...feats] }).catch(() => {});
  };
  if (card) game.onStroke = save;
  let carry = resume?.shots ?? 0;
  // Leave on a card: where it stands, and that it's forfeited at midnight if it isn't finished (before the first
  // swing nothing is locked yet, so nothing to lose)
  if (card)
    game.quitAsk = () =>
      !scores.length && !here
        ? { title: 'Leave for now?', body: "<p>You haven't swung yet, so today's card hasn't started. It'll be here when you come back.</p>", ok: 'Leave', cancel: 'Keep playing' }
        : {
            title: 'Leave for now?',
            body: `<p class="dlg-card">${esc(cardStatus(course, scores, here))}</p><p>Your card is saved. Come back and finish it <b>before midnight ET</b>, or it's forfeited and today doesn't count.</p>`,
            ok: 'Leave for now',
            cancel: 'Keep playing',
          };
  // the admin's preview can jump to any hole, or start the one they're on over
  let jump: ((i: number) => void) | null = null;
  if (preview && !opts.practice && !dry && !opts.classic) game.setHoleMenu(course.holes.map((h) => `${h.name} · Par ${h.par}`), (i) => jump?.(i));
  for (let i = scores.length; i < course.holes.length; ) {
    const h = course.holes[i];
    holeAt = i;
    const par = course.holes.reduce((a, x, j) => a + (scores[j] === undefined ? 0 : x.par), 0);
    const jumped = new Promise<number>((res) => (jump = res));
    // picking a card up mid-hole: back to the tee, with the strokes already played on it
    const played = game.play(h, i + 1, { strokes: scores.reduce((a, b) => a + b, 0), par }, { cart: visits[i], of: course.holes.length, strokes: carry });
    carry = 0;
    const r = await Promise.race([played, jumped]);
    if (quit || !game) return;
    if (typeof r === 'number') {
      i = r;
      continue;
    }
    scores[i] = r.strokes;
    spots[i] = r.spot;
    // a birdie or better on a card pays (the card is the day's first round): the coins come as it drops
    const sb = pops && !opts.practice ? shotBonus(r.strokes, h.par) : 0;
    if (sb) coinPop(el, sb, r.strokes === 1 ? 'Hole in one' : sb === BONUS.eagle ? 'Eagle' : 'Birdie', unpaid || h.name);
    // a hole's secret, found for the first time on a card
    if (pops && h.secret && r.feats.includes(h.secret.zone) && (rehearsal || (SECRET_FEATS.includes(h.secret.zone) && !foundBefore.has(h.secret.zone)))) {
      foundBefore.add(h.secret.zone);
      coinPop(el, BONUS.secret, 'Secret found', unpaid || h.secret.name);
    }
    r.feats.forEach((f) => feats.add(f));
    i++;
    if (card) save(0);
    else if (i < course.holes.length) progress(i + 1);
  }
  if (opts.practice) leavePractice();
  // the rehearsal's card is in: next time it opens on the card-in screen
  if (dry) drySave({ done: true, id: -1, course: full.id, scores: [...scores], shots: 0, spots: scores.map((_, j) => spots[j] ?? null), feats: [...feats] });
  const total = scores.reduce((a, b) => a + b, 0);
  const toPar = total - course.holes.reduce((a, h, i) => a + (scores[i] === undefined ? 0 : h.par), 0);
  const best = !preview && (!before || toPar < before.total - before.par);
  let posted = true;
  let notPosted = "Couldn't post this round. Check your connection.";
  if (!preview)
    try {
      await api.submitRound(requireSession(), { course: course.id, holes: scores, pars: course.holes.map((h) => h.par), feats: [...feats], spots, card, shots: shotLog });
      progress(course.holes.length, true);
    } catch (err) {
      posted = false;
      // a round begun before midnight can't count on the new day: say so, rather than blame the connection
      if (/before midnight/i.test((err as Error).message)) notPosted = (err as Error).message;
    }
  // a classic course: the round goes in for the course record, and the record says where it stands
  let classicLine = '';
  if (opts.classic) {
    const records = await api
      .submitFreeRound(requireSession(), course.id, scores, course.holes.map((h) => h.par))
      .then(() => api.courseRecords(requireSession()))
      .catch(() => null);
    const rec = records?.find((r) => r.course === course.id);
    if (rec)
      classicLine =
        toPar <= rec.toPar && rec.holders?.some((h) => h.name === snap.players.find((p) => p.id === snap.me)?.name)
          ? `<p class="purse-line"><b>${toPar < rec.toPar ? 'Course record' : 'Ties the course record'}</b><span>${toParLabel(toPar)} on ${esc(course.name)}. ${rec.rounds} rounds ever played on it.</span></p>`
          : `<p class="purse-line"><b>Course record ${toParLabel(rec.toPar)}</b><span>${(rec.holders ?? []).map((h) => esc(h.name)).join(' & ')}${rec.mine !== null ? ` · your best ${toParLabel(rec.mine)}` : ''}</span></p>`;
  }
  sfx(best ? 'cheer' : 'ooh');
  // the club bonus this round earned: the day's first finished round pays, with its birdies or better (src/bonus.ts).
  // The Committee's rehearsal shows it as a card would earn it, not paid.
  const bonus = (() => {
    if (rehearsal) return { first: true };
    if (preview || !posted) return null;
    return { first: !snap.rounds.some((x) => x.playerId === snap.me && todayInGameTz(new Date(x.createdAt)) === todayInGameTz()) };
  })();
  const bonusSum = (() => {
    if (!bonus?.first) return { sum: 0, line: '' };
    const kinds = new Map<string, { n: number; v: number }>();
    scores.forEach((s, i) => {
      const v = shotBonus(s, course.holes[i].par);
      if (!v) return;
      const k = s === 1 ? 'ace' : v === BONUS.eagle ? 'eagle' : 'birdie';
      const x = kinds.get(k) ?? { n: 0, v: 0 };
      kinds.set(k, { n: x.n + 1, v: x.v + v });
    });
    const parts = [`round ${money(BONUS.round)}`, ...[...kinds].map(([k, x]) => `${x.n > 1 ? `${x.n} ${k}s` : `${k}`} ${money(x.v)}`)];
    const sum = BONUS.round + [...kinds.values()].reduce((a, x) => a + x.v, 0);
    return { sum, line: `<p class="purse-line bonus-line"><b>+${money(sum)}</b><span>Club bonus${rehearsal ? ' (preview, not paid)' : ''} · ${parts.join(' · ')}</span></p>` };
  })();
  const bonusLine = bonusSum.line;
  // a counted round ends on Reginald's one question; the answer goes in with the rest of the feedback
  const asking = !opts.practice && !preview && posted;
  // a practice round of the week's course: is today's card in yet? (Reginald's line says which card is next)
  const cardInToday = snap.rounds.some((r) => r.playerId === snap.me && todayInGameTz(new Date(r.createdAt)) === snap.today);
  const sheet = document.createElement('div');
  sheet.className = 'summary';
  sheet.innerHTML = `
    <div class="summary-card">
      ${crest(70, 'sum')}
      <p class="eyebrow">${esc(course.name)}</p>
      ${opts.practice ? `<h1>Practice done</h1><p class="practice-score">${toParLabel(toPar)} · ${total} strokes</p>` : `<h1>${total} <small>${toParLabel(toPar)}</small></h1>`}
      ${best ? '<p class="stamp">Personal best</p>' : ''}
      ${opts.practice ? '' : `<table class="scorecard"><thead><tr>${course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('')}<th class="num">Tot</th></tr></thead>
        <tbody><tr class="par">${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num">${course.par}</td></tr>
        <tr>${course.holes.map((_, i) => scores[i]).map((s, i) => s === undefined ? '<td class="num">–</td>' : `<td class="num" title="${scoreName(s, course.holes[i].par)}"><span class="sc ${scoreClass(s, course.holes[i].par)}">${s}</span></td>`).join('')}<td class="num tot">${total}</td></tr></tbody></table>`}
      ${
        opts.practice
          ? hostChip(!livePractice ? "Nobody's counting. It counts once it opens." : !cardsOn(snap.month) ? "Nobody's counting." : cardInToday ? "Nobody's counting. Tomorrow's card is the one." : "Nobody's counting. Today's card is still waiting.", 'dry')
          : preview
            ? hostChip('A private look before the members get at it. I shall say nothing.', 'dry')
            : hostChip(REGINALD.round(toParLabel(toPar), best), best ? 'pleased' : 'dry', 'reg-note')
      }
      ${!preview && posted ? '<p class="purse-line" id="purse-line" hidden></p>' : ''}
      ${bonusLine}${classicLine}
      ${opts.practice ? '' : `<p class="fine">${opts.classic ? 'Free play on a classic course. It counts for the course record, never the Open or a title.' : dry ? "That's today's card. A rehearsal: nothing was posted or paid." : rehearsal ? "A rehearsal of the card as it plays live. Nothing posted, nothing paid." : preview ? 'Preview round, not counted.' : posted ? (card ? "Posted to the board. That's today's card." : 'Posted to the board.') : esc(notPosted)}</p>`}
      ${opts.practice ? `<button class="link share-practice" data-share-score>${canShare() ? 'Send to the group' : 'Copy for the group chat'}</button>` : `<button class="btn ghost share-score" data-share-score>${canShare() ? '📤 Share your score' : '📋 Copy your score'}</button>`}
      <div class="summary-actions"><button class="btn" data-again>${card ? 'Practice round' : opts.practice ? 'Practise again' : 'Play again'}</button><button class="btn ghost" data-back>${dry ? 'Back to the Committee Room' : 'Back to the club'}</button></div>
      ${
        asking
          ? `<form class="reg-ask" id="reg-ask">
        <label for="reg-ask-body"><b>Reginald</b> How did that one play? What would you change?</label>
        <textarea id="reg-ask-body" maxlength="2000" rows="3" required placeholder="Say what you like."></textarea>
        <p class="error" id="reg-ask-err" role="alert"></p>
        <button class="btn" type="submit">Send</button>
      </form>`
          : '<button class="link" data-feedback>Leave feedback</button>'
      }
    </div>`;
  el.appendChild(sheet);
  // the round's bonus lands with a burst of coins
  if (bonusSum.sum) window.setTimeout(() => coinPop(el, bonusSum.sum, 'Club bonus', rehearsal ? 'preview, not paid' : "today's card"), 700);
  // where this leaves you on the board, and what the purse would pay you if the week ended now
  if (!preview && posted)
    void refresh()
      .then(async (s) => {
        // from Nov 8 the Open pays: your place on it, across every club
        if (openPurseOn(s.month)) {
          const open = await api.openBoard(requireSession());
          const purse = openPurse(open);
          const meRow = open.find((r) => r.mine);
          const line = sheet.querySelector<HTMLElement>('#purse-line');
          const mine = meRow && purse.pay.get(meRow.playerId);
          if (!line || !mine) return;
          line.innerHTML = mine.payout
            ? `<b>💰 ${money(mine.payout)}</b><span>${placeLabel(mine.place, mine.tied)} of ${open.length} on the Open if the week ended now · Open purse ${money(openPurseOf(purse.field))}</span>`
            : `<b>${placeLabel(mine.place, mine.tied)} of ${open.length} on the Open</b><span>Top 10 get paid. Open purse ${money(openPurseOf(purse.field))}</span>`;
          line.hidden = false;
          return;
        }
        const rows = board(s).filter((r) => r.best);
        const away = !!s.players.find((x) => x.id === s.me)?.away;
        const purse = clubPurse(rows, (id) => !!s.players.find((x) => x.id === id)?.away);
        const mine = purse.pay.get(s.me);
        const line = sheet.querySelector<HTMLElement>('#purse-line');
        if (!line) return;
        // playing from another club: your place here, but no money (your home club pays you)
        if (away) {
          const me = rows.find((r) => r.playerId === s.me);
          if (!me) return;
          const at = rows.filter((r) => r.toPar < me.toPar).length + 1;
          line.innerHTML = `<b>${placeLabel(at, rows.filter((r) => r.toPar === me.toPar).length > 1)} of ${rows.length}</b><span>Paid at ${esc(s.homeName ?? 'your home club')}, your home club. Purse here ${money(purseOf(purse.field))}, for its own members</span>`;
          line.hidden = false;
          return;
        }
        if (!mine) return;
        line.innerHTML = mine.payout
          ? `<b>💰 ${money(mine.payout)}</b><span>${placeLabel(mine.place, mine.tied)} of ${rows.length} if the week ended now · purse ${money(purseOf(purse.field))}</span>`
          : `<b>${placeLabel(mine.place, mine.tied)} of ${rows.length}</b><span>Top 10 get paid. Purse ${money(purseOf(purse.field))}</span>`;
        line.hidden = false;
      })
      .catch(() => {});
  // Reginald reads the card (Claude) and his note replaces the stock line when it comes
  if (!preview && posted) {
    const note = sheet.querySelector<HTMLElement>('#reg-note p');
    note?.classList.add('reg-thinking');
    void askReginald('round', full, snap.today).then((text) => {
      note?.classList.remove('reg-thinking');
      if (text && note) {
        note.innerHTML = `<b>Reginald</b> ${esc(text)}`;
        note.classList.add('reg-fresh');
      }
    });
  }
  // a result to text the group, Wordle style: one square a hole
  const shareBtn = sheet.querySelector<HTMLButtonElement>('[data-share-score]');
  if (shareBtn) shareBtn.onclick = () => void share(opts.practice ? practiceShare(course, scores, total, toPar, livePractice) : scoreShare(course, scores, total, toPar, card, rehearsal), shareBtn);
  // after today's card, play again is practice on the same course
  sheet.querySelector<HTMLButtonElement>('[data-again]')!.onclick = async () => (dry ? navigate('#/rehearse') : card ? navigate('#/round/practice') : round(await refresh(), opts));
  const context = `After a ${total} (${toParLabel(toPar)}) on ${course.name}`;
  const fb = sheet.querySelector<HTMLButtonElement>('[data-feedback]');
  if (fb) fb.onclick = () => openFeedback(context, el);
  const ask = sheet.querySelector<HTMLFormElement>('#reg-ask');
  if (ask)
    ask.onsubmit = async (e) => {
      e.preventDefault();
      const btn = ask.querySelector('button')!;
      btn.disabled = true;
      try {
        await api.submitFeedback(requireSession(), sheet.querySelector<HTMLTextAreaElement>('#reg-ask-body')!.value, `Reginald asked. ${context}`);
        ask.innerHTML = '<p class="reg-ask-done">Noted, with thanks. I shall see the Committee reads it.</p>';
      } catch (err) {
        sheet.querySelector('#reg-ask-err')!.textContent = (err as Error).message;
        btn.disabled = false;
      }
    };
  sheet.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => {
    closeRound();
    navigate(dry ? '#/admin' : '#/');
  };
}

// A practice round on the next course. A course with notes on what's new shows them first, then in.
export function practice(snap: Snapshot, next: Course) {
  const n = Math.min(next.previewHoles ?? next.holes.length, next.holes.length);
  const go = () => void round(snap, { course: next, holes: n, practice: true });
  if (!next.whatsNew?.length) return go();
  closeRound();
  const theme = next.holes[0]?.theme ?? '';
  render(`<main class="narrow whats-new ${esc(theme)}">
    <section class="wn-card">
      <p class="eyebrow">Practice · nothing counts</p>
      <h1>${esc(next.name)}</h1>
      <p class="muted">${n} ${n === 1 ? 'hole' : 'holes'} · par ${next.holes.slice(0, n).reduce((a, h) => a + h.par, 0)}</p>
      <h2>What's new</h2>
      <ul class="wn-list">${next.whatsNew.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="summary-actions"><button class="btn big" data-start>Start practice</button><a class="btn ghost" href="#/">Back to the club</a></div>
    </section>
  </main>`);
  document.querySelector<HTMLButtonElement>('[data-start]')!.onclick = go;
}

// The range or the short game area at the practice facility: a session from the moment you step on to when you leave.
export function practiceArea(snap: Snapshot, kind: 'range' | 'shortgame') {
  closeRound();
  const me = snap.players.find((p) => p.id === snap.me)!;
  render(`<div class="g3" id="g3"></div>`);
  document.body.classList.add('court-open');
  const el = document.getElementById('g3')!;
  try {
    game = new Course3D(el, me.avatar, () => {
      closeRound();
      navigate('#/facility');
    });
  } catch {
    closeRound();
    render(`<main class="narrow"><h1>This device can't draw the course</h1><p class="muted">The club needs WebGL. Try a recent Safari or Chrome.</p><a class="btn" href="#/">Back to the club</a></main>`);
    return;
  }
  game.leaveText = 'Leave';
  game.howTo = 'practice';
  game.onShot = joinPractice(kind).shot;
  if (kind === 'range') game.practiceArea(range, { title: 'Driving range', stations: [{ name: 'From the mat', at: range.tee }], targets: TARGETS });
  else game.practiceArea(shortgame, { title: 'Short game', stations: STATIONS });
}

// The Daily Shot: today's shot, with whatever tries you have left. Each try posts as it lands; after the last, how it
// went and the board.
export async function dailyRound(snap: Snapshot) {
  closeRound();
  const day = snap.today;
  const state = await api.dailyState(requireSession(), day).catch(() => null);
  if (!state) {
    navigate('#/');
    return;
  }
  const done = [...state.mine];
  const back = () => {
    closeRound();
    navigate('#/');
  };
  if (done.length >= DAILY_TRIES) return void dailySummary(day, back);
  const me = snap.players.find((p) => p.id === snap.me)!;
  const shot = dailyShot(day);
  render(`<div class="g3" id="g3"></div>`);
  document.body.classList.add('court-open');
  const el = document.getElementById('g3')!;
  try {
    game = new Course3D(el, me.avatar, back);
  } catch {
    closeRound();
    render(`<main class="narrow"><h1>This device can't draw the course</h1><p class="muted">The club needs WebGL. Try a recent Safari or Chrome.</p><a class="btn" href="#/">Back to the club</a></main>`);
    return;
  }
  game.leaveText = 'Leave';
  game.howTo = 'daily';
  game.practiceArea(shot.hole, {
    title: `Closest to the Pin #${shot.number}`,
    stations: [{ name: shot.label, at: shot.from }],
    wind: shot.wind,
    eyebrow: 'Three tries · closest wins',
    tag: () => `Try ${done.length + 1} of ${DAILY_TRIES}`,
    onResult: (r) => {
      const t = { try: done.length + 1, ...r };
      done.push(t);
      void api.submitDaily(requireSession(), day, t).catch(() => {});
      if (done.length < DAILY_TRIES) return true;
      window.setTimeout(() => void dailySummary(day, back), 1900);
      return false;
    },
  });
}

// The Members' Course: the approved holes from the Design Desk, each flying its designer's name on the flag
// A coin burst over the course: the money, what it was for, a sound. It floats up and goes.
export function coinPop(host: HTMLElement, amount: number, title: string, sub = '') {
  const el = document.createElement('div');
  el.className = 'coin-pop';
  el.innerHTML = `<span class="coins" aria-hidden="true">${'<i>🪙</i>'.repeat(5)}</span><b>+${money(amount)}</b><span>${esc(title)}${sub ? ` · ${esc(sub)}` : ''}</span>`;
  host.appendChild(el);
  sfx('board');
  window.setTimeout(() => sfx('cheer'), 180);
  window.setTimeout(() => el.remove(), 3200);
}

async function membersHoles(): Promise<Hole[]> {
  const list = (await api.membersCourse(requireSession()).catch(() => [])).filter(isHole);
  return list.map((m) => buildHole(m.spec, `members-${m.id}`, m.by.slice(0, 9)).hole);
}

// Try a hole from the Design Desk (or the Committee's queue): one hole, nothing counts, then back
export function testHole(snap: Snapshot, hole: Hole, back: () => void) {
  closeRound();
  const me = snap.players.find((p) => p.id === snap.me)!;
  const leave = () => {
    closeRound();
    back();
  };
  render(`<div class="g3" id="g3"></div>`);
  document.body.classList.add('court-open');
  const el = document.getElementById('g3')!;
  let g: Course3D;
  try {
    g = new Course3D(el, me.avatar, leave);
  } catch {
    closeRound();
    render(`<main class="narrow"><h1>This device can't draw the course</h1><p class="muted">The club needs WebGL. Try a recent Safari or Chrome.</p></main>`);
    return;
  }
  game = g;
  g.leaveText = 'Back';
  g.howTo = hole.putterOnly ? 'minigolf' : 'round';
  // trying a hole from the Design Desk: the same meter it'll be played on
  if (!hole.putterOnly) g.meterStyle = 'vertical';
  const go = async () => {
    const r = await g.play(hole, 1, { strokes: 0, par: 0 }, { of: 1 });
    if (game !== g) return;
    const sheet = document.createElement('div');
    sheet.className = 'practice-notes daily-summary';
    sheet.innerHTML = `<div class="notes-card"><div class="notes-body"><p class="eyebrow">Test round · nothing counts</p><h2>${r.strokes} on ${esc(hole.name)}</h2><p>Par ${hole.par}.</p></div>
      <div class="notes-foot daily-foot"><button class="btn" data-again>Again</button><button class="btn ghost" data-back>Back</button></div></div>`;
    el.appendChild(sheet);
    sheet.querySelector<HTMLButtonElement>('[data-again]')!.onclick = () => {
      sheet.remove();
      void go();
    };
    sheet.querySelector<HTMLButtonElement>('[data-back]')!.onclick = leave;
  };
  void go();
}

// The week's long drive tee: the longest hole on the week's course (The Gorge on the Western Reserve)
export const driveHole = (course: Course) => [...course.holes].sort((a, b) => Math.hypot(b.cup.x - b.tee.x, b.cup.y - b.tee.y) - Math.hypot(a.cup.x - a.tee.x, a.cup.y - a.tee.y))[0];

// The bar's weekly contests: the six holes of haunted mini golf, or three swings off the tee of the week's longest hole
// (the last two with a fireball). The week's best counts; play as often as you like.
export function barRound(snap: Snapshot, kind: BarGame) {
  closeRound();
  const me = snap.players.find((p) => p.id === snap.me)!;
  const back = () => {
    closeRound();
    navigate('#/bar');
  };
  render(`<div class="g3" id="g3"></div>`);
  document.body.classList.add('court-open');
  const el = document.getElementById('g3')!;
  let g: Course3D;
  try {
    g = new Course3D(el, me.avatar, back);
  } catch {
    closeRound();
    render(`<main class="narrow"><h1>This device can't draw the course</h1><p class="muted">The club needs WebGL. Try a recent Safari or Chrome.</p><a class="btn" href="#/bar">Back to the bar</a></main>`);
    return;
  }
  game = g;
  g.leaveText = 'Leave';
  g.howTo = 'practice';
  const again = () => barRound(snap, kind);
  if (kind === 'minigolf' || kind === 'members') {
    // six holes of Hollow Hills, or the members' own holes (up to nine): putter only, fewest strokes counts
    g.howTo = kind === 'minigolf' ? 'minigolf' : 'round';
    // the members' holes swing on the weekly course's meter
    if (kind === 'members') g.meterStyle = 'vertical';
    g.starter = kind === 'minigolf' ? `Six holes, ${me.name}. Mind the scythe.` : `Your fellow members built these, ${me.name}. Blame them.`;
    void (async () => {
      const holes = kind === 'minigolf' ? HOLLOW_HILLS : await membersHoles();
      if (game !== g) return;
      if (!holes.length) return back();
      const scores: number[] = [];
      const sum = () => scores.reduce((a, b) => a + b, 0);
      for (let i = 0; i < holes.length; i++) {
        const par = holes.slice(0, i).reduce((a, h) => a + h.par, 0);
        const r = await g.play(holes[i], i + 1, { strokes: sum(), par }, { of: holes.length });
        if (game !== g) return; // they left
        scores.push(r.strokes);
        if (r.strokes === 1) sfx('cackle');
        // a member's own hole, finished by someone else: its designer is paid (once each a week)
        const design = kind === 'members' ? Number(/^members-(\d+)$/.exec(holes[i].id)?.[1]) : NaN;
        if (design) void api.recordDesignPlay(requireSession(), design).then((paid) => paid && coinPop(el, BONUS.designPlay, `To the designer of ${holes[i].name}`, 'for playing their hole'));
      }
      const score = minigolfScore(sum());
      await api.submitBar(requireSession(), kind, score).catch(() => {});
      if (game === g) window.setTimeout(() => void barSummary(kind, score, again, back), 600);
    })();
  } else {
    // off the tee of the week's longest hole, in today's wind: the first swing as you are, the last two with a fireball
    // (the overswing is live: only a perfect strike with the wind behind carries 375)
    const hole = driveHole(courseFor(snap.month));
    let best: number | null = null;
    let n = 0;
    g.starter = `${hole.name}, ${me.name}. Three swings. Reginald's pouring the fireballs for the last two.`;
    g.pour(null);
    g.practiceArea(hole, {
      title: 'Long drive',
      eyebrow: `The Nineteenth Hole · ${hole.name}`,
      wind: conditionsFor(hole, todayInGameTz()),
      stations: [{ name: `${DRIVES} swings, longest in play`, at: hole.tee }],
      tag: () => `Swing ${n + 1} of ${DRIVES}${n >= DRIVES - 2 ? ' · Fireball' : ''}`,
      report: (r) => (r.lost ? 'Out of play' : `${driveYards(r.from, r.end)} yd`),
      onResult: (r) => {
        n++;
        if (!r.lost) best = Math.max(best ?? 0, driveYards(r.from, r.end));
        // the last two swings come with a fireball
        g.pour(n >= DRIVES - 2 && n < DRIVES ? 'fireball' : null);
        if (n < DRIVES) return true;
        const done = () => window.setTimeout(() => void barSummary('drive', best, again, back), 1200);
        if (best === null) done();
        else void api.submitBar(requireSession(), 'drive', best).catch(() => {}).finally(done);
        return false;
      },
    });
  }
}
