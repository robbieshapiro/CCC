// Ultimate Texas Hold'em against Mo, at the bar (#/bar/poker). Pick an Ante (the Blind matches it) and Trips if you
// like, and Mo deals. Before the flop: bet 4x or 3x, or check. On the flop: bet 2x, or check. On the river: bet 1x, or
// fold. The server deals and settles (uth_* in supabase/schema.sql); the rules are in src/uth.ts.
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { cardRank, cardRed, cardSuit, DAILY_LOSS } from '../blackjack';
import { sfx } from '../fx/sound';
import { money } from '../purse';
import { staffFace } from '../staff';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { esc, header, render } from '../ui';
import { BLIND_PAYS, HANDS, handName, pokerRank, TRIPS_PAYS, UTH_ANTES, UTH_TRIPS, type UthAction, type UthView } from '../uth';
import { payTrophies } from './trophyroom';

const ANTE_KEY = 'ccc-uth-ante';
const TRIPS_KEY = 'ccc-uth-trips';
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const card = (c: number | null, i: number) =>
  c === null
    ? `<div class="bj-card back" style="--i:${i}"></div>`
    : `<div class="bj-card${cardRed(c) ? ' red' : ''}" style="--i:${i}"><b>${cardRank(c)}</b><i>${cardSuit(c)}</i></div>`;
const pays = (n: number) => (n === 1.5 ? '3 to 2' : `${n} to 1`);
const MO = {
  deal: ['Cards are out. Your move.', "Let's see what you're made of.", 'Two for you, two for me.'],
  win: ['Nice hand. Take it.', "Fine. You've earned that one.", 'I should have folded. Oh wait, I can’t.'],
  lose: ['The house thanks you.', 'Mine. Better luck next hand.', 'Tough beat. Again?'],
  tie: ['Dead level. Everything comes back.', 'A push. Nobody’s happy.'],
  fold: ['Wise, maybe. We’ll never know.', 'Folded. I’ll take the Ante and Blind, thanks.'],
};

export async function uth(snap: Snapshot) {
  const s = requireSession();
  let ante = UTH_ANTES.includes(Number(store.get(ANTE_KEY))) ? Number(store.get(ANTE_KEY)) : 25;
  let trips = UTH_TRIPS.includes(Number(store.get(TRIPS_KEY))) ? Number(store.get(TRIPS_KEY)) : 0;
  let busy = false;
  let bank = 0;
  let lost = 0;
  let hand: UthView | null = null;
  const start = await api.uthState(s).catch((e: Error) => ({ error: e.message }) as const);

  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="bj-page uth-page">
      <a class="bj-back" href="#/bar">‹ The bar</a>
      <section class="bj-table uth-table">
        <div class="bj-mo"><span class="bj-face">${staffFace('mo', 64)}</span><p id="uth-mo">Ultimate Texas Hold'em. You against me. Pick your Ante and I'll deal.</p></div>
        <div class="bj-hand mo"><div class="bj-cards" id="uth-dealer"></div><small id="uth-mo-hand"></small></div>
        <div class="uth-board" id="uth-board"></div>
        <div class="bj-hand you"><div class="bj-cards" id="uth-player"></div><small id="uth-you-hand"></small></div>
        <div class="uth-spots" id="uth-spots"></div>
        <p class="bj-result" id="uth-result" aria-live="polite"></p>
        <p class="uth-note" id="uth-note"></p>
      </section>
      <section class="bj-rail">
        <div class="bj-bank"><span>In the bank</span><b id="uth-bank">…</b><small id="uth-today"></small></div>
        <div class="uth-pick" id="uth-pick">
          <div><small>Ante <em>(the Blind matches it)</em></small><div class="bj-chips">${UTH_ANTES.map((c) => `<button class="bj-chip c${c}" data-ante="${c}">${c}</button>`).join('')}</div></div>
          <div><small>Trips <em>(optional)</em></small><div class="uth-trips">${UTH_TRIPS.map((c) => `<button data-trips="${c}">${c ? money(c) : 'None'}</button>`).join('')}</div></div>
        </div>
        <div class="bj-acts" id="uth-acts"></div>
        <details class="uth-how">
          <summary>How to play, and what it pays</summary>
          <p>Put up an Ante and an equal Blind (and Trips, if you like). You and Mo get two cards each; five go to the board. Make your best five of the seven.</p>
          <p><b>Before the flop:</b> bet 4x or 3x your Ante, or check. <b>On the flop:</b> if you checked, bet 2x or check. <b>On the river:</b> if you're still checking, bet 1x or fold. One bet a hand; once it's down, the rest is dealt.</p>
          <p><b>Mo qualifies with a pair or better.</b> If he doesn't, your Ante comes back and the rest still plays. Beat him and your bet and Ante (if he qualified) pay 1 to 1, and the Blind pays on a straight or better. He beats you, you lose them. A tie pushes everything. Fold and you lose the Ante and Blind.</p>
          <table class="uth-pays"><thead><tr><th>Your hand</th><th>Blind</th><th>Trips</th></tr></thead><tbody>${[9, 8, 7, 6, 5, 4, 3]
            .map((k) => `<tr><td>${HANDS[k]}</td><td>${BLIND_PAYS[k] ? pays(BLIND_PAYS[k]) : 'Push'}</td><td>${pays(TRIPS_PAYS[k])}</td></tr>`)
            .join('')}<tr><td>Anything less</td><td>Push</td><td>Loses</td></tr></tbody></table>
          <p class="fine">The Blind pays only when you beat Mo; Trips pays on your own hand, whatever Mo has, even if you fold.</p>
        </details>
        <p class="bj-fine">Club money only. At most ${money(DAILY_LOSS)} lost a day.</p>
      </section>
    </main>`);

  const q = (id: string) => document.getElementById(id)!;
  const mo = (t: string) => (q('uth-mo').textContent = t);
  const live = () => !!hand && hand.stage !== 'done';

  function draw() {
    if (!document.getElementById('uth-acts')) return;
    q('uth-bank').textContent = money(bank);
    q('uth-today').textContent = lost > 0 ? `Down ${money(lost)} today` : lost < 0 ? `Up ${money(-lost)} today` : '';
    document.querySelectorAll<HTMLButtonElement>('[data-ante]').forEach((b) => b.classList.toggle('on', Number(b.dataset.ante) === ante));
    document.querySelectorAll<HTMLButtonElement>('[data-trips]').forEach((b) => b.classList.toggle('on', Number(b.dataset.trips) === trips));
    q('uth-pick').classList.toggle('locked', live());
    const h = hand;
    q('uth-dealer').innerHTML = h ? (h.dealer.length ? h.dealer.map(card) : [card(null, 0), card(null, 1)]).join('') : '';
    q('uth-player').innerHTML = h ? h.player.map(card).join('') : '';
    q('uth-board').innerHTML = h ? [0, 1, 2, 3, 4].map((i) => (h.board[i] !== undefined ? card(h.board[i], i) : `<div class="uth-slot"></div>`)).join('') : '';
    q('uth-you-hand').textContent = h ? `You · ${h.result ? h.result.you : handName(pokerRank([...h.player, ...h.board]))}` : '';
    q('uth-mo-hand').textContent = h?.result ? `Mo · ${h.result.mo}${h.result.qualified ? '' : ' · doesn’t qualify'}` : h ? 'Mo' : '';
    // the bets on the felt, and what came back on each once it's over
    const back = h?.result?.back;
    const spot = (label: string, amt: number, got?: number) =>
      `<div class="uth-spot${amt ? '' : ' empty'}${got === undefined ? '' : got > amt ? ' won' : got === amt ? ' push' : ' lost'}"><small>${label}</small><b>${amt ? money(amt) : '–'}</b>${got !== undefined && amt ? `<em>${got > amt ? `+${money(got - amt)}` : got === amt ? 'push' : `−${money(amt)}`}</em>` : ''}</div>`;
    q('uth-spots').innerHTML = h ? spot('Trips', h.trips, back?.trips) + spot('Ante', h.ante, back?.ante) + spot('Blind', h.ante, back?.blind) + spot('Play', h.play, back?.play) : '';
    const res = q('uth-result');
    const note = q('uth-note');
    if (h?.result) {
      const put = 2 * h.ante + h.trips + h.play;
      const net = h.result.payout - put;
      res.textContent = h.result.outcome === 'fold' && net < 0 ? `Folded · −${money(-net)}` : net > 0 ? `+${money(net)}` : net < 0 ? `−${money(-net)}` : 'Push';
      res.className = `bj-result ${net > 0 ? 'won' : net < 0 ? 'lost' : 'push'}`;
      note.textContent = h.result.outcome === 'fold' ? '' : !h.result.qualified ? 'Mo didn’t qualify, so your Ante came back.' : '';
    } else {
      res.textContent = '';
      res.className = 'bj-result';
      note.textContent = h?.stage === 'river' ? 'Last call: bet 1x or fold.' : '';
    }
    const btn = (a: UthAction, label: string, gold = false) => `<button class="bj-btn${gold ? ' gold' : ''}" data-act="${a}">${label}</button>`;
    const acts =
      h && live()
        ? h.stage === 'pre'
          ? btn('play4', `Bet 4x · ${money(4 * h.ante)}`, true) + btn('play3', `3x · ${money(3 * h.ante)}`) + btn('check', 'Check')
          : h.stage === 'flop'
            ? btn('play2', `Bet 2x · ${money(2 * h.ante)}`, true) + btn('check', 'Check')
            : btn('play1', `Bet 1x · ${money(h.ante)}`, true) + btn('fold', 'Fold')
        : `<button class="bj-btn gold" data-deal ${bank < 2 * ante + trips ? 'disabled' : ''}>Deal · ${money(2 * ante + trips)}</button>`;
    q('uth-acts').innerHTML = acts;
    q('uth-acts').querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act as UthAction)));
    const deal = q('uth-acts').querySelector<HTMLButtonElement>('[data-deal]');
    if (deal) deal.onclick = dealHand;
  }

  async function run(f: () => Promise<UthView>) {
    if (busy) return;
    busy = true;
    try {
      hand = await f();
      bank = hand.bank;
      lost = hand.lostToday;
      sfx('pop');
      if (hand.result) {
        mo(pick(MO[hand.result.outcome]));
        const put = 2 * hand.ante + hand.trips + hand.play;
        sfx(hand.result.payout > put ? 'cheer' : 'thump');
        void refresh().catch(() => {});
        void payTrophies();
      } else if (hand.stage === 'pre') mo(pick(MO.deal));
      else if (hand.stage === 'flop') mo('The flop. Bet 2x, or check and see the rest.');
      else mo("Turn and river. Bet 1x if you like it, or fold.");
      draw();
    } catch (e) {
      mo((e as Error).message);
    } finally {
      busy = false;
    }
  }
  const dealHand = () => {
    store.set(ANTE_KEY, String(ante));
    store.set(TRIPS_KEY, String(trips));
    void run(() => api.uthDeal(s, ante, trips));
  };
  const act = (a: UthAction) => hand && run(() => api.uthAct(s, hand!.id, a));
  document.querySelectorAll<HTMLButtonElement>('[data-ante]').forEach((b) => (b.onclick = () => !live() && ((ante = Number(b.dataset.ante)), draw())));
  document.querySelectorAll<HTMLButtonElement>('[data-trips]').forEach((b) => (b.onclick = () => !live() && ((trips = Number(b.dataset.trips)), draw())));

  if ('error' in start) mo('The table isn’t open yet. Check back soon.');
  else {
    bank = start.bank;
    lost = start.lostToday;
    hand = start.hand;
    if (hand) mo('You left a hand on the felt. Still yours.');
  }
  draw();
  void esc;
}
