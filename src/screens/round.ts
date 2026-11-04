// A full round: every hole of this period's course in one go, then the card goes up on the board.
// A preview round (the admin, every hole of a course still to come) and a practice round (any member, the first few holes
// of the next course) are played the same way but never posted.
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { crest } from '../brand';
import { sfx } from '../fx/sound';
import { Course3D, scoreName, type Ghost } from '../golf3d/engine';
import { todayInGameTz } from '../day';
import type { Spot } from '../api/types';
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
import { addStats, badgeSvg, bagOf, fxOf, holeXp, levelName, LEVELS, nextUnlock, playedThisWeek, rankOf, roundXp, secretsOf, statsOf, unlocksAt, type Rank } from '../rank';
import { featById } from '../feats';
import { specOf } from '../avatar';
import { toast } from '../nudges';
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

export async function round(snap: Snapshot, opts: { course?: Course; holes?: number; practice?: boolean } = {}) {
  closeRound();
  const preview = !!opts.course;
  const full = opts.course ?? courseFor(snap.month);
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
    // the Gold putter, once your rank has earned it, is the one you're seen holding
    const gold = !me.host && bagOf(rankOf(statsOf(me)).level, me.wins).putter.id === 'gold';
    const look = gold ? { ...me.avatar, golfer: { ...specOf(me.avatar), putter: 'gold' as const } } : me.avatar;
    game = new Course3D(el, look, () => {
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
    game.onShot = joinPractice('caldera').shot;
  }
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
  // your rank's gear is in the bag, and a chip keeps count of the XP this round has earned so far
  const counted = !preview && !me.host;
  const stats0 = statsOf(me);
  const rank0 = rankOf(stats0);
  game.gear = me.host ? null : fxOf(rank0.level, me.wins);
  const chip = counted ? xpChip(el, rank0) : null;
  const scores: number[] = [];
  const spots: Spot[] = [];
  // a counted round logs its start and each hole it reaches, so the Committee can see who stops and where
  const started = preview ? Promise.resolve(null) : api.startRound(requireSession(), course.id).catch(() => null);
  const progress = (hole: number, finished = false) =>
    void started.then((id) => (id === null ? undefined : api.roundProgress(requireSession(), id, hole, finished).catch(() => {})));
  const feats = new Set<string>();
  // the admin's preview can jump to any hole, or start the one they're on over
  let jump: ((i: number) => void) | null = null;
  if (preview && !opts.practice) game.setHoleMenu(course.holes.map((h) => `${h.name} · Par ${h.par}`), (i) => jump?.(i));
  for (let i = 0; i < course.holes.length; ) {
    const h = course.holes[i];
    const par = course.holes.reduce((a, x, j) => a + (scores[j] === undefined ? 0 : x.par), 0);
    const jumped = new Promise<number>((res) => (jump = res));
    const played = game.play(h, i + 1, { strokes: scores.reduce((a, b) => a + b, 0), par }, { cart: i === 1 ? 'drinks' : i === 4 && course.holes.length >= 5 ? 'shots' : undefined, of: course.holes.length });
    const r = await Promise.race([played, jumped]);
    if (quit || !game) return;
    if (typeof r === 'number') {
      i = r;
      continue;
    }
    scores[i] = r.strokes;
    spots[i] = r.spot;
    const fresh = r.feats.filter((f) => !feats.has(f) && !me.feats.includes(f) && secretsOf([f]));
    r.feats.forEach((f) => feats.add(f));
    if (chip) {
      const hx = holeXp(r.strokes, h.par);
      if (hx) chip.add(hx.xp, hx.label);
      for (const f of fresh) chip.add(250, `Secret: ${featById(f)?.name ?? f}`);
    }
    i++;
    if (i < course.holes.length) progress(i + 1);
  }
  if (opts.practice) leavePractice();
  const total = scores.reduce((a, b) => a + b, 0);
  const toPar = total - course.holes.reduce((a, h, i) => a + (scores[i] === undefined ? 0 : h.par), 0);
  const best = !preview && (!before || toPar < before.total - before.par);
  let posted = true;
  if (!preview)
    try {
      await api.submitRound(requireSession(), { course: course.id, holes: scores, pars: course.holes.map((h) => h.par), feats: [...feats], spots });
      progress(course.holes.length, true);
    } catch {
      posted = false;
    }
  sfx(best ? 'cheer' : 'ooh');
  chip?.remove();
  // what the round earned: XP line by line, the rank bar, a promotion and what it unlocks, new accolades
  const won = roundXp({
    holes: scores,
    pars: course.holes.map((h) => h.par),
    newSecrets: [...feats].filter((f) => !me.feats.includes(f) && secretsOf([f])),
    firstOfWeek: !playedThisWeek(snap, me.id),
  });
  const rewards = rewardsPanel(rank0, rankOf(addStats(stats0, won.add)), won.lines, [...feats, ...(toPar < 0 ? ['underpar'] : [])].filter((f, k, a) => a.indexOf(f) === k && !me.feats.includes(f)), me.wins);
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
      ${counted && posted ? rewards.html : counted ? '' : `<p class="fine rw-none">${preview ? 'Preview' : 'Practice'} rounds don’t earn XP.</p>`}
      ${
        opts.practice
          ? hostChip('Practice. Nobody is keeping score, least of all me. Come November it counts.', 'dry')
          : preview
            ? hostChip('A private look before the members get at it. I shall say nothing.', 'dry')
            : hostChip(REGINALD.round(toParLabel(toPar), best), best ? 'pleased' : 'dry', 'reg-note')
      }
      <p class="fine">${opts.practice ? 'Practice round, not counted.' : preview ? 'Preview round, not counted.' : posted ? 'Posted to the board.' : "Couldn't post this round. Check your connection."}</p>
      <div class="summary-actions cta">${opts.practice || preview ? '' : '<button class="btn" data-challenge>Challenge a friend</button>'}<button class="btn ${opts.practice || preview ? '' : 'ghost'}" data-again>Play again</button><button class="btn ghost" data-back>Back to the clubhouse</button></div>
      <button class="link" data-feedback>Leave feedback</button>
    </div>`;
  el.appendChild(sheet);
  if (counted && posted) rewards.animate(sheet);
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
  sheet.querySelector<HTMLButtonElement>('[data-again]')!.onclick = async () => round(await refresh(), opts);
  sheet.querySelector<HTMLButtonElement>('[data-feedback]')!.onclick = () => openFeedback(`After a ${total} (${toParLabel(toPar)}) on ${course.name}`, el);
  sheet.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => {
    closeRound();
    navigate('#/clubhouse');
  };
  // put a friend up to it: the phone's share sheet, or the message copied to paste anywhere
  const challenge = sheet.querySelector<HTMLButtonElement>('[data-challenge]');
  if (challenge)
    challenge.onclick = async () => {
      const text = `I shot ${total} (${toParLabel(toPar)}) on ${course.name} at ${snap.groupName}. Your move.`;
      const url = `${location.origin}/#/`;
      try {
        if (navigator.share) return void (await navigator.share({ title: 'Claude Country Club', text, url }));
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('Copied. Paste it to whoever needs humbling.');
      } catch {
        toast(text);
      }
    };
}

// The chip in the corner during a counted round: your badge, the XP so far, and a pop for each birdie or secret
function xpChip(host: HTMLElement, rank: Rank) {
  const el = document.createElement('div');
  el.className = 'xp-chip';
  el.innerHTML = `${badgeSvg(rank, 26)}<div><b data-xp>+0 XP</b><small>${esc(rank.name)}</small></div><em data-pop></em>`;
  host.appendChild(el);
  let total = 0;
  return {
    add(xp: number, label: string) {
      total += xp;
      el.querySelector('[data-xp]')!.textContent = `+${total.toLocaleString()} XP`;
      const pop = el.querySelector<HTMLElement>('[data-pop]')!;
      pop.textContent = `${label} +${xp}`;
      pop.classList.remove('go');
      void pop.offsetWidth;
      pop.classList.add('go');
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    },
    remove: () => el.remove(),
  };
}

// how far through a level its XP bar is, 0 to 100
function barPct(r: Rank) {
  if (!r.next) return 100;
  const from = LEVELS[r.level].xp + (r.level === LEVELS.length - 1 ? r.prestige * 6000 : 0);
  return Math.max(0, Math.min(100, ((r.xp - from) / Math.max(1, r.next.xp - from)) * 100));
}

function rewardsPanel(r0: Rank, r1: Rank, lines: { label: string; xp: number }[], accolades: string[], wins: number) {
  const gained = lines.reduce((a, l) => a + l.xp, 0);
  const up = r1.level > r0.level || r1.prestige > r0.prestige;
  // everything that opened between the old rank and the new one
  const opened = up ? Array.from({ length: r1.level - r0.level }, (_, k) => unlocksAt(r0.level + 1 + k)) : [];
  const gear = opened.flatMap((u) => u.gear);
  const features = opened.flatMap((u) => u.features);
  const bag = bagOf(r1.level, wins);
  const next = nextUnlock(r1.level);
  const reqs = r1.next?.reqs ?? [];
  const toGo = r1.next ? r1.next.xp - r1.xp : 0;
  const html = `
    <section class="rw${up ? ' up' : ''}">
      <div class="rw-rank">
        <span class="rw-badge">${badgeSvg(r1, 58)}</span>
        <div><small>${up ? 'Promoted' : 'Your rank'}</small><b>${esc(r1.name)}${r1.prestige ? ` <i>Prestige ${r1.prestige}</i>` : ''}</b><span>${r1.xp.toLocaleString()} XP</span></div>
        <em class="rw-gain">+${gained.toLocaleString()} XP</em>
      </div>
      <div class="rw-bar" aria-hidden="true"><i data-from="${up ? 0 : barPct(r0)}" data-to="${barPct(r1)}"></i></div>
      <p class="rw-next">${
        !r1.next ? '' : r1.blocked ? `You have the XP for <b>${esc(r1.next.name)}</b>. To be promoted:` : `<b>${toGo.toLocaleString()} XP</b> to ${esc(r1.next.name)}${reqs.length ? ', and:' : ''}`
      }</p>
      ${reqs.length ? `<ul class="rw-reqs">${reqs.map((q) => `<li class="${q.met ? 'met' : ''}"><i>${q.met ? '✓' : '○'}</i>${esc(q.label)}<small>${q.have}</small></li>`).join('')}</ul>` : ''}
      <ul class="rw-lines">${lines.map((l) => `<li><span>${esc(l.label)}</span><b>+${l.xp}</b></li>`).join('')}</ul>
      ${
        gear.length || features.length
          ? `<div class="rw-unlocks"><small>Unlocked</small>${gear.map((g) => `<div class="rw-item"><i>${GEAR_ICON[g.kind]}</i><b>${esc(g.name)}</b><span>${esc(g.what)}</span></div>`).join('')}${features.map((f) => `<div class="rw-item"><i>✨</i><b>${esc(f.name)}${f.soon ? ' <em>coming soon</em>' : ''}</b><span>${esc(f.what)}</span></div>`).join('')}</div>`
          : ''
      }
      ${accolades.length ? `<div class="rw-accolades"><small>New accolades</small>${accolades.map((id) => featById(id)).filter((f) => !!f).map((f) => `<span title="${esc(f!.how)}"><i>${f!.icon}</i>${esc(f!.name)}</span>`).join('')}</div>` : ''}
      <p class="rw-bag">In your bag: ${[bag.putter, bag.ball, bag.irons, bag.driver].map((g) => esc(g.name)).join(' · ')}</p>
      ${next ? `<p class="rw-teaser">Next unlock at <b>${esc(levelName(next.level))}</b>: ${[...next.gear.map((g) => g.name), ...next.features.map((f) => f.name)].map(esc).join(', ')}</p>` : ''}
    </section>`;
  return {
    html,
    animate(root: HTMLElement) {
      const bar = root.querySelector<HTMLElement>('.rw-bar i');
      if (!bar) return;
      bar.style.width = `${bar.dataset.from}%`;
      requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = `${bar.dataset.to}%`)));
      if (up) window.setTimeout(() => sfx('cheer'), 900);
    },
  };
}

const GEAR_ICON: Record<string, string> = { putter: '🏌️', ball: '⚪', irons: '🔩', driver: '🪵' };

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
