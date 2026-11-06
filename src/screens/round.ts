// A full round: every hole of this period's course in one go, then the card goes up on the board. From Nov 8 that's
// today's card: one a day counts, locked at the first swing, and picked up where it left off if it's cut short.
// A preview round (the admin, every hole of a course still to come) and a practice round (any member: the first few
// holes of the next course, or the whole of the week's course once cards start) are played the same way but never posted.
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { crest } from '../brand';
import { sfx } from '../fx/sound';
import { Course3D, scoreName, type Ghost } from '../golf3d/engine';
import { cardsOn, openPurseOn, todayInGameTz } from '../day';
import { BONUS, shotBonus } from '../bonus';
import type { CardToday, RoundShot, Spot } from '../api/types';
import { courseFor, type Course } from '../golf3d/courses';
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
import { clubPurse, money, openPurse, placeLabel, purseOf } from '../purse';
import { dailySummary } from './daily';

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
    return p ? [{ name: p.name, avatar: p.avatar, spots: r.spots!, holes: r.holes }] : [];
  });
}

// Today's card is already in: practise as much as you like
function cardIn(snap: Snapshot) {
  render(`<main class="narrow card-in">
    <p class="eyebrow">${esc(courseFor(snap.month).name)}</p>
    <h1>Today's card is in</h1>
    ${hostChip('One card a day, and yours is on the board. The course is open for practice until midnight. Nobody counts those.', 'dry')}
    <div class="summary-actions"><a class="btn" href="#/round/practice">Practice round</a><a class="btn ghost" href="#/">Back to the club</a></div>
  </main>`);
}

export async function round(snap: Snapshot, opts: { course?: Course; holes?: number; practice?: boolean } = {}) {
  closeRound();
  const preview = !!opts.course;
  const full = opts.course ?? courseFor(snap.month);
  // a practice round of the week's own course (once cards start), rather than the next course's preview holes
  const livePractice = !!opts.practice && full.id === courseFor(snap.month).id;
  // today's card: null when it isn't a card (a preview, practice, before Nov 8, or a database without cards yet)
  let today: CardToday | null = null;
  let cardId: number | null = null;
  if (!preview && cardsOn(snap.month)) {
    today = await api.cardToday(requireSession()).catch(() => null);
    if (today?.done) return cardIn(snap);
    if (today) {
      try {
        cardId = await api.startRound(requireSession(), full.id, true);
      } catch (err) {
        if (/already in/i.test((err as Error).message)) return cardIn(snap);
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
      navigate('#/');
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
  if (card) game.quitAsk = 'Leave for now? Your card is saved. Come back before midnight to finish it.';
  // today's players are on this period's course, not the preview
  if (!preview) game.setGhosts(todaysField(snap));
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
  if (!preview) game.onShotLog = (s) => shotLog.length < 150 && shotLog.push({ ...s, h: holeAt });
  // a card saves itself after every stroke, so a swing can't be taken back by leaving
  const save = (shots: number) => {
    if (cardId !== null)
      void api.cardProgress(requireSession(), cardId, { scores: [...scores], shots, spots: scores.map((_, j) => spots[j] ?? null), feats: [...feats] }).catch(() => {});
  };
  if (card) game.onStroke = save;
  let carry = resume?.shots ?? 0;
  // the admin's preview can jump to any hole, or start the one they're on over
  let jump: ((i: number) => void) | null = null;
  if (preview && !opts.practice) game.setHoleMenu(course.holes.map((h) => `${h.name} · Par ${h.par}`), (i) => jump?.(i));
  for (let i = scores.length; i < course.holes.length; ) {
    const h = course.holes[i];
    holeAt = i;
    const par = course.holes.reduce((a, x, j) => a + (scores[j] === undefined ? 0 : x.par), 0);
    const jumped = new Promise<number>((res) => (jump = res));
    // picking a card up mid-hole: back to the tee, with the strokes already played on it
    const played = game.play(h, i + 1, { strokes: scores.reduce((a, b) => a + b, 0), par }, { cart: i === 1 ? 'drinks' : i === 4 && course.holes.length >= 5 ? 'shots' : undefined, of: course.holes.length, strokes: carry });
    carry = 0;
    const r = await Promise.race([played, jumped]);
    if (quit || !game) return;
    if (typeof r === 'number') {
      i = r;
      continue;
    }
    scores[i] = r.strokes;
    spots[i] = r.spot;
    r.feats.forEach((f) => feats.add(f));
    i++;
    if (card) save(0);
    else if (i < course.holes.length) progress(i + 1);
  }
  if (opts.practice) leavePractice();
  const total = scores.reduce((a, b) => a + b, 0);
  const toPar = total - course.holes.reduce((a, h, i) => a + (scores[i] === undefined ? 0 : h.par), 0);
  const best = !preview && (!before || toPar < before.total - before.par);
  let posted = true;
  if (!preview)
    try {
      await api.submitRound(requireSession(), { course: course.id, holes: scores, pars: course.holes.map((h) => h.par), feats: [...feats], spots, card, shots: shotLog });
      progress(course.holes.length, true);
    } catch {
      posted = false;
    }
  sfx(best ? 'cheer' : 'ooh');
  // the club bonus this round earned: the day's first finished round pays, with its birdies or better (src/bonus.ts)
  const bonusLine = (() => {
    if (preview || !posted) return '';
    const firstToday = !snap.rounds.some((x) => x.playerId === snap.me && todayInGameTz(new Date(x.createdAt)) === todayInGameTz());
    if (!firstToday) return '';
    const kinds = new Map<string, { n: number; v: number }>();
    scores.forEach((s, i) => {
      const v = shotBonus(s, course.holes[i].par);
      if (!v) return;
      const k = s === 1 ? 'ace' : v === BONUS.eagle ? 'eagle' : 'birdie';
      const x = kinds.get(k) ?? { n: 0, v: 0 };
      kinds.set(k, { n: x.n + 1, v: x.v + v });
    });
    const parts = [...(firstToday ? [`round ${money(BONUS.round)}`] : []), ...[...kinds].map(([k, x]) => `${x.n > 1 ? `${x.n} ${k}s` : `${k}`} ${money(x.v)}`)];
    const sum = (firstToday ? BONUS.round : 0) + [...kinds.values()].reduce((a, x) => a + x.v, 0);
    return sum ? `<p class="purse-line bonus-line"><b>+${money(sum)}</b><span>Club bonus · ${parts.join(' · ')}</span></p>` : '';
  })();
  // a counted round ends on Reginald's one question; the answer goes in with the rest of the feedback
  const asking = !opts.practice && !preview && posted;
  const sheet = document.createElement('div');
  sheet.className = 'summary';
  sheet.innerHTML = `
    <div class="summary-card">
      ${crest(70, 'sum')}
      <p class="eyebrow">${esc(course.name)}</p>
      ${opts.practice ? '<h1>Practice done</h1>' : `<h1>${total} <small>${toParLabel(toPar)}</small></h1>`}
      ${best ? '<p class="stamp">Personal best</p>' : ''}
      ${opts.practice ? '' : `<table class="scorecard"><thead><tr>${course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('')}<th class="num">Tot</th></tr></thead>
        <tbody><tr class="par">${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num">${course.par}</td></tr>
        <tr>${course.holes.map((_, i) => scores[i]).map((s, i) => s === undefined ? '<td class="num">–</td>' : `<td class="num" title="${scoreName(s, course.holes[i].par)}"><span class="sc ${scoreClass(s, course.holes[i].par)}">${s}</span></td>`).join('')}<td class="num tot">${total}</td></tr></tbody></table>`}
      ${
        opts.practice
          ? hostChip(livePractice ? "Practice. Nobody is keeping score, least of all me. Tomorrow's card is where it counts." : 'Practice. Nobody is keeping score, least of all me. Come November it counts.', 'dry')
          : preview
            ? hostChip('A private look before the members get at it. I shall say nothing.', 'dry')
            : hostChip(REGINALD.round(toParLabel(toPar), best), best ? 'pleased' : 'dry', 'reg-note')
      }
      ${!preview && posted ? '<p class="purse-line" id="purse-line" hidden></p>' : ''}
      ${bonusLine}
      <p class="fine">${opts.practice ? 'Practice round, not counted.' : preview ? 'Preview round, not counted.' : posted ? (card ? "Posted to the board. That's today's card." : 'Posted to the board.') : "Couldn't post this round. Check your connection."}</p>
      <div class="summary-actions"><button class="btn" data-again>${card ? 'Practice round' : 'Play again'}</button><button class="btn ghost" data-back>Back to the club</button></div>
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
            ? `<b>💰 ${money(mine.payout)}</b><span>${placeLabel(mine.place, mine.tied)} of ${open.length} on the Open if the week ended now · Open purse ${money(purseOf(purse.field))}</span>`
            : `<b>${placeLabel(mine.place, mine.tied)} of ${open.length} on the Open</b><span>Top 10 get paid. Open purse ${money(purseOf(purse.field))}</span>`;
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
  // after today's card, play again is practice on the same course
  sheet.querySelector<HTMLButtonElement>('[data-again]')!.onclick = async () => (card ? navigate('#/round/practice') : round(await refresh(), opts));
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
    navigate('#/');
  };
}

// A practice round on the next course: straight in. The how-to card covers what plays differently.
export function practice(snap: Snapshot, next: Course) {
  const n = Math.min(next.previewHoles ?? next.holes.length, next.holes.length);
  void round(snap, { course: next, holes: n, practice: true });
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

// The bar's weekly contests: the six holes of haunted mini golf, or three swings off the range tee. The week's best
// counts; play as often as you like.
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
      }
      const score = minigolfScore(sum());
      await api.submitBar(requireSession(), kind, score).catch(() => {});
      if (game === g) window.setTimeout(() => void barSummary(kind, score, again, back), 600);
    })();
  } else {
    let best: number | null = null;
    let n = 0;
    g.practiceArea(range, {
      title: 'Long drive',
      eyebrow: 'The Nineteenth Hole',
      stations: [{ name: `${DRIVES} swings, longest in play`, at: range.tee }],
      tag: () => `Swing ${n + 1} of ${DRIVES}`,
      report: (r) => (r.lost ? 'Out of play' : `${driveYards(r.from, r.end)} yd`),
      onResult: (r) => {
        n++;
        if (!r.lost) best = Math.max(best ?? 0, driveYards(r.from, r.end));
        if (n < DRIVES) return true;
        const done = () => window.setTimeout(() => void barSummary('drive', best, again, back), 1200);
        if (best === null) done();
        else void api.submitBar(requireSession(), 'drive', best).catch(() => {}).finally(done);
        return false;
      },
    });
  }
}
