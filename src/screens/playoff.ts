// The playoff: when a week closes with a tie for the club title, the tied members each get one go on the Sunday
// after (to midnight Eastern) at the course's playoff hole, then one shot at the pin, which only settles it if
// they're still level on the hole. A no-show forfeits; if nobody plays, they share the title.
import { api } from '../api';
import type { PlayoffState, Snapshot } from '../api/types';
import { resultLabel } from '../daily';
import { periodName } from '../day';
import { Course3D } from '../golf3d/engine';
import { courseFor } from '../golf3d/courses';
import { requireSession } from '../state';
import { esc, navigate, render } from '../ui';
import { closeRound, useGame } from './round';

const names = (s: PlayoffState) => s.players.map((p) => esc(p.name)).join(' v ');

function status(p: PlayoffState['players'][number]) {
  if (p.strokes === null) return p.started ? 'Teed off' : 'Yet to play';
  return `${p.strokes} on the hole${p.shot ? ` · ${resultLabel({ ft: p.ft, holed: p.holed, lost: p.lost })} at the pin` : ''}`;
}

// the gold card at the top of the home page, for everyone at the club while the playoff is on
export const playoffCard = () => `<section class="news playoff" id="playoff" hidden></section>`;

export async function bindPlayoff() {
  const el = document.getElementById('playoff');
  if (!el) return;
  const s = await api.playoffState(requireSession()).catch(() => null);
  if (!s || !document.getElementById('playoff')) return; // no playoff today, no SQL yet, or left the page
  const course = courseFor(s.period);
  const me = s.players.find((p) => p.id === requireSession().playerId);
  const go = s.mine && me && !me.started;
  const shotLeft = s.mine && me && me.strokes !== null && !me.shot;
  el.innerHTML = `<p class="eyebrow">Playoff today · ${esc(periodName(s.period))}</p>
    <h2>${names(s)}</h2>
    <p class="muted">Tied for the title. One go each at ${esc(course.playoff?.hole.name ?? 'the playoff hole')}, then a shot at the pin if still level. Until midnight ET.</p>
    <ul class="playoff-list">${s.players.map((p) => `<li><b>${esc(p.name)}</b><span>${status(p)}</span></li>`).join('')}</ul>
    ${go ? `<div class="news-actions"><a class="btn big" href="#/playoff">Play the playoff</a></div>` : shotLeft ? `<div class="news-actions"><a class="btn big" href="#/playoff">Hit your shot at the pin</a></div>` : ''}`;
  el.hidden = false;
}

export async function playoff(snap: Snapshot) {
  closeRound();
  const session = requireSession();
  const state = await api.playoffState(session).catch(() => null);
  const mine = state?.players.find((p) => p.id === snap.me);
  const spot = state && courseFor(state.period).playoff;
  if (!state || !state.mine || !mine || !spot || (mine.started && (mine.strokes === null || mine.shot))) {
    navigate('#/');
    return;
  }
  const hole = spot.hole;
  const home = () => {
    closeRound();
    navigate('#/');
  };

  // the shot at the pin, once the hole is done
  const shoot = (g: Course3D, strokes: number) => {
    g.leaveText = 'Leave';
    g.howTo = 'daily';
    g.practiceArea(hole, {
      title: 'The playoff: closest to the pin',
      stations: [{ name: spot.label, at: spot.from }],
      eyebrow: 'One shot · counts if still level',
      tag: () => `${strokes} on the hole`,
      onResult: (r) => {
        void api.playoffShot(session, r).catch(() => {});
        window.setTimeout(() => done(strokes, resultLabel(r)), 1900);
        return false;
      },
    });
  };

  const done = (strokes: number, shot: string) => {
    const sheet = document.createElement('div');
    sheet.className = 'practice-notes daily-summary';
    sheet.innerHTML = `<div class="notes-card"><div class="notes-body"><p class="eyebrow">The playoff · ${esc(periodName(state.period))}</p>
      <h2>${strokes} on ${esc(hole.name)}</h2><p>And ${esc(shot)} at the pin. The title is settled at midnight ET, once everyone has had their go.</p></div>
      <div class="notes-foot daily-foot"><button class="btn" data-back>Back to the club</button></div></div>`;
    document.getElementById('g3')?.appendChild(sheet);
    sheet.querySelector<HTMLButtonElement>('[data-back]')!.onclick = home;
  };

  const start = async (teeOff: boolean) => {
    if (teeOff) {
      try {
        await api.playoffStart(session);
      } catch (err) {
        alert((err as Error).message);
        return navigate('#/');
      }
    }
    render(`<div class="g3" id="g3"></div>`);
    document.body.classList.add('court-open');
    let g: Course3D;
    try {
      g = new Course3D(document.getElementById('g3')!, snap.players.find((p) => p.id === snap.me)!.avatar, home);
    } catch {
      closeRound();
      render(`<main class="narrow"><h1>This device can't draw the course</h1><p class="muted">The club needs WebGL. Try a recent Safari or Chrome.</p><a class="btn" href="#/">Back to the club</a></main>`);
      return;
    }
    useGame(g);
    if (!teeOff) return shoot(g, mine.strokes!);
    const r = await g.play(hole, 1, { strokes: 0, par: 0 }, { of: 1 });
    await api.playoffFinish(session, r.strokes).catch(() => {});
    shoot(g, r.strokes);
  };

  // back for the shot at the pin after leaving: straight to it
  if (mine.started) return void start(false);
  const others = state.players.filter((p) => p.id !== snap.me);
  render(`<main class="narrow playoff-intro">
    <p class="eyebrow">Playoff · ${esc(periodName(state.period))}</p>
    <h1>${names(state)}</h1>
    <p>You're tied for the title with ${others.map((p) => esc(p.name)).join(' and ')}. One hole decides it: <b>${esc(hole.name)}</b>, par ${hole.par}. Lowest score wins.</p>
    <p>Still level on the hole? Then it's one shot at the pin, ${esc(spot.label.toLowerCase())}. Nearest wins.</p>
    <p class="muted">One go, no restarts. Leave mid-hole and you forfeit. Play by midnight ET or the title goes to whoever did.</p>
    <div class="news-actions"><button class="btn big" data-tee>Tee off</button><a class="btn ghost" href="#/">Not yet</a></div>
  </main>`);
  document.querySelector<HTMLButtonElement>('[data-tee]')!.onclick = () => void start(true);
}
