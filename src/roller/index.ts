// High Roller: a rolling-ball campaign at the bar. Tilt the table, roll your golfer through the gold gate, don't fall
// off. Clear a stage to open the next; clear a world to open the one after. This file is the menu and the flow round a
// stage; game.ts draws it, sim.ts is the physics, stages.ts the stages.
import './roller.css';
import { api } from '../api';
import type { RollerState, Snapshot } from '../api/types';
import { specOf } from '../avatar';
import { requireSession } from '../state';
import { store } from '../storage';
import { esc, golferHref, render } from '../ui';
import { play, type Game, type Result } from './game';
import { ALL_STAGES, COMING, WORLDS } from './stages';

type Best = Record<number, { ms: number; chips: number }>;
const KEY = (id: string) => `ccc-roller-${id}`;
const clock = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

// what this device remembers, so a stage cleared offline (or before the club's database knows the game) still counts here
function localBest(me: string): Best {
  try {
    return JSON.parse(store.get(KEY(me)) ?? '{}');
  } catch {
    return {};
  }
}

let game: Game | null = null;

export async function roller(snap: Snapshot) {
  game?.dispose();
  game = null;
  document.body.classList.remove('court-open');
  const session = requireSession();
  const me = snap.players.find((p) => p.id === snap.me)!;
  const admin = store.get('ccc-admin') === '1';
  const state: RollerState = await api.rollerState(session).catch(() => ({ mine: [], board: [] }));
  const best: Best = localBest(snap.me);
  for (const r of state.mine) best[r.stage] = { ms: Math.min(r.ms, best[r.stage]?.ms ?? Infinity), chips: Math.max(r.chips, best[r.stage]?.chips ?? 0) };
  const open = (n: number) => admin || n === 1 || !!best[n - 1];

  function menu() {
    game?.dispose();
    game = null;
    document.body.classList.remove('court-open');
    const cleared = ALL_STAGES.filter((_, i) => best[i + 1]).length;
    let n = 0;
    render(`
      <main class="rl-menu">
        <header class="rl-top">
          <a class="rl-back" href="#/bar">‹ The bar</a>
          <p class="rl-eyebrow">The Nineteenth Hole presents</p>
          <h1>High Roller</h1>
          <p class="rl-sub">Tilt the table. Roll through the gold gate. Don't fall off.</p>
        </header>
        ${WORLDS.map((w, wi) => {
          const done = w.stages.filter((_, i) => best[n + i + 1]).length;
          const html = `<section class="rl-world">
            <div class="rl-world-head"><div><small>World ${wi + 1}</small><h2>${esc(w.name)}</h2><p>${esc(w.blurb)}</p></div><b>${done}/${w.stages.length}</b></div>
            <ol class="rl-stages">${w.stages
              .map((s, i) => {
                const num = n + i + 1;
                const b = best[num];
                const can = open(num);
                return `<li><button class="rl-tile ${b ? 'done' : ''} ${can ? '' : 'locked'}" data-stage="${num}" ${can ? '' : 'disabled'}>
                  <i>${can ? num : '🔒'}</i><b>${esc(s.name)}</b>
                  <span>${b ? `${clock(b.ms)} · ${b.chips}/${s.chips.length} chips` : can ? 'Not cleared yet' : 'Clear the one before'}</span>
                </button></li>`;
              })
              .join('')}</ol>
          </section>`;
          n += w.stages.length;
          return html;
        }).join('')}
        ${COMING.map((w, i) => `<section class="rl-world soon"><div class="rl-world-head"><div><small>World ${WORLDS.length + i + 1}</small><h2>🔒 ${esc(w.name)}</h2><p>${esc(w.blurb)}. ${cleared >= ALL_STAGES.length ? 'Coming soon.' : `Clear all of ${esc(WORLDS[WORLDS.length - 1].name)} first.`}</p></div></div></section>`).join('')}
        <section class="rl-board">
          <h2>The club's high rollers</h2>
          ${
            state.board.length
              ? `<ol>${state.board
                  .slice(0, 10)
                  .map((r, i) => `<li class="${r.mine ? 'me' : ''}"><i>${i + 1}</i><a href="${golferHref(r.playerId, r.mine)}">${esc(r.name)}</a><span>${r.cleared} ${r.cleared === 1 ? 'stage' : 'stages'}</span><b>${clock(r.ms)}</b></li>`)
                  .join('')}</ol>`
              : '<p class="rl-empty">Nobody yet. Be first.</p>'
          }
          <p class="rl-fine">Most stages cleared leads. Level on stages, the lower total of best times wins.</p>
        </section>
      </main>`);
    document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b) => (b.onclick = () => run(Number(b.dataset.stage))));
  }

  function run(num: number) {
    const stage = ALL_STAGES[num - 1];
    const world = WORLDS.find((w) => w.stages.includes(stage))!;
    let falls = 0;
    document.body.classList.add('court-open');
    render(`<div class="rl-play"><div class="rl-view" id="rl-view"></div><button class="rl-pause" id="rl-pause" aria-label="Pause">❚❚</button><div class="rl-sheet" id="rl-sheet" hidden></div></div>`);
    const view = document.getElementById('rl-view')!;
    const sheet = document.getElementById('rl-sheet')!;
    const show = (html: string, acts: Record<string, () => void>) => {
      sheet.innerHTML = `<div class="rl-card">${html}</div>`;
      sheet.hidden = false;
      for (const [k, fn] of Object.entries(acts)) sheet.querySelector<HTMLButtonElement>(`[data-act="${k}"]`)?.addEventListener('click', fn);
    };
    const again = () => {
      sheet.hidden = true;
      game?.pause(false);
      game?.restart();
    };
    const next = () => (num < ALL_STAGES.length ? run(num + 1) : menu());

    const onEnd = (r: Result) => {
      if (r.state !== 'goal') {
        falls++;
        // straight back to the start: falling off is part of it
        return game?.restart();
      }
      const old = best[num];
      const record = !old || r.ms < old.ms;
      best[num] = { ms: Math.min(r.ms, old?.ms ?? Infinity), chips: Math.max(r.chips, old?.chips ?? 0) };
      store.set(KEY(snap.me), JSON.stringify(best));
      void api
        .rollerSave(session, num, r.ms, r.chips)
        .then(() => api.rollerState(session))
        .then((s) => (state.board = s.board))
        .catch(() => {});
      const last = num === ALL_STAGES.length;
      const worldDone = world.stages[world.stages.length - 1] === stage;
      show(
        `<p class="rl-eyebrow">${worldDone ? `${esc(world.name)} cleared` : 'Stage cleared'}</p>
        <h2>${esc(stage.name)}</h2>
        <p class="rl-time">${clock(r.ms)}${record ? '<em>Best</em>' : ''}</p>
        <p class="rl-detail">${r.chips} of ${stage.chips.length} chips${old && !record ? ` · your best ${clock(old.ms)}` : ''}${falls ? ` · ${falls} ${falls === 1 ? 'fall' : 'falls'} on the way` : ' · first go'}</p>
        <div class="rl-acts"><button class="rl-btn" data-act="next">${last ? 'Back to the stages' : 'Next stage'}</button><button class="rl-btn ghost" data-act="again">Again</button>${last ? '' : '<button class="rl-btn ghost" data-act="menu">Stages</button>'}</div>`,
        { next, again: () => ((falls = 0), again()), menu },
      );
    };
    game?.dispose();
    game = play(view, stage, specOf(me.avatar), `Stage ${num} of ${ALL_STAGES.length}`, onEnd);
    document.getElementById('rl-pause')!.onclick = () => {
      if (!sheet.hidden) return;
      game?.pause(true);
      show(`<p class="rl-eyebrow">Paused</p><h2>${esc(stage.name)}</h2><div class="rl-acts"><button class="rl-btn" data-act="resume">Carry on</button><button class="rl-btn ghost" data-act="again">Start again</button><button class="rl-btn ghost" data-act="menu">Stages</button></div>`, {
        resume: () => ((sheet.hidden = true), game?.pause(false)),
        again,
        menu,
      });
    };
  }

  menu();
}
