// Blackjack against Mo, at the bar: club money on the felt, $10 to $500 a hand. The server deals and settles
// (supabase/schema.sql bj_*); this draws the table and sends Deal, Hit, Stand and Double.
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { BJ_MAX, BJ_MIN, CHIPS, DAILY_LOSS, MO_SAYS, cardRank, cardRed, cardSuit, type BjState, type BjView } from '../blackjack';
import { sfx } from '../fx/sound';
import { money } from '../purse';
import { staffFace } from '../staff';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { esc, header, render } from '../ui';
import { payTrophies } from './trophyroom';

const STAKE_KEY = 'ccc-bj-stake';
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const card = (c: number | null, i: number) =>
  c === null
    ? `<div class="bj-card back" style="--i:${i}"></div>`
    : `<div class="bj-card${cardRed(c) ? ' red' : ''}" style="--i:${i}"><b>${cardRank(c)}</b><i>${cardSuit(c)}</i></div>`;
const isHand = (s: BjState): s is BjView => 'id' in s;

export async function blackjack(snap: Snapshot) {
  const s = requireSession();
  let stake = Math.min(BJ_MAX, Math.max(BJ_MIN, Number(store.get(STAKE_KEY)) || 25));
  let busy = false;
  let state: BjState = await api.bjState(s).catch((e: Error) => ({ bank: 0, lostToday: 0, error: e.message }) as BjState);

  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="bj-page">
      <a class="bj-back" href="#/bar">‹ The bar</a>
      <section class="bj-table">
        <div class="bj-mo"><span class="bj-face">${staffFace('mo', 64)}</span><p id="bj-mo">Pull up a stool. Pick a stake and I'll deal.</p></div>
        <div class="bj-hand mo"><div class="bj-cards" id="bj-dealer"></div><small id="bj-dtotal"></small></div>
        <p class="bj-rules">Blackjack pays 3 to 2 · Mo stands on 17 · Double on your first two cards</p>
        <div class="bj-hand you"><div class="bj-cards" id="bj-player"></div><small id="bj-ptotal"></small></div>
        <p class="bj-result" id="bj-result" aria-live="polite"></p>
      </section>
      <section class="bj-rail">
        <div class="bj-bank"><span>In the bank</span><b id="bj-bank">…</b><small id="bj-today"></small></div>
        <div class="bj-chips" id="bj-chips">${CHIPS.map((c) => `<button class="bj-chip c${c}" data-chip="${c}">${c}</button>`).join('')}</div>
        <div class="bj-acts" id="bj-acts"></div>
        <p class="bj-fine">Club money only: nothing here is real, and none of it can be bought or cashed out. At most ${money(DAILY_LOSS)} lost a day.</p>
      </section>
    </main>`);

  const q = (id: string) => document.getElementById(id)!;
  const mo = (t: string) => (q('bj-mo').textContent = t);

  function draw() {
    if (!document.getElementById('bj-acts')) return;
    q('bj-bank').textContent = money(state.bank);
    q('bj-today').textContent = state.lostToday > 0 ? `Down ${money(state.lostToday)} today` : state.lostToday < 0 ? `Up ${money(-state.lostToday)} today` : '';
    document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.classList.toggle('on', Number(b.dataset.chip) === stake));
    const hand = isHand(state) ? state : null;
    const live = !!hand && !hand.done;
    q('bj-chips').classList.toggle('locked', live);
    q('bj-dealer').innerHTML = hand ? [...hand.dealer.map(card), ...(live ? [card(null, hand.dealer.length)] : [])].join('') : '';
    q('bj-player').innerHTML = hand ? hand.player.map(card).join('') : '';
    q('bj-dtotal').textContent = hand ? `Mo ${hand.dealerTotal}${live ? ' showing' : ''}` : '';
    q('bj-ptotal').textContent = hand ? `You ${hand.playerTotal}${hand.doubled ? ' · doubled' : ''} · ${money(hand.stake)} on it` : '';
    const res = q('bj-result');
    if (hand?.done && hand.outcome) {
      const net = (hand.payout ?? 0) - hand.stake;
      res.textContent = net > 0 ? `+${money(net)}` : net < 0 ? `−${money(-net)}` : 'Push';
      res.className = `bj-result ${net > 0 ? 'won' : net < 0 ? 'lost' : 'push'}`;
    } else (res.textContent = ''), (res.className = 'bj-result');
    const canDouble = live && hand!.player.length === 2 && state.bank >= hand!.stake;
    q('bj-acts').innerHTML = live
      ? `<button class="bj-btn" data-act="hit">Hit</button><button class="bj-btn" data-act="stand">Stand</button>${canDouble ? `<button class="bj-btn gold" data-act="double">Double ${money(hand!.stake)}</button>` : ''}`
      : `<button class="bj-btn gold" data-deal ${state.bank < stake ? 'disabled' : ''}>Deal · ${money(stake)}</button>`;
    q('bj-acts').querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act as 'hit' | 'stand' | 'double')));
    const deal = q('bj-acts').querySelector<HTMLButtonElement>('[data-deal]');
    if (deal) deal.onclick = dealHand;
  }

  async function run(f: () => Promise<BjView>) {
    if (busy) return;
    busy = true;
    try {
      const before = isHand(state) && !state.done ? state.player.length + state.dealer.length : 0;
      state = await f();
      sfx('pop');
      if (isHand(state) && state.done && state.outcome) {
        mo(pick(MO_SAYS[state.outcome]));
        sfx((state.payout ?? 0) > state.stake ? 'cheer' : 'thump');
        // the bank on home and in the Pro Shop catches up
        void refresh().catch(() => {});
        void payTrophies();
      } else if (before === 0) mo(pick(['Your move.', 'Hit or stand?', 'Take your time. I get paid either way.']));
      draw();
    } catch (e) {
      mo((e as Error).message);
    } finally {
      busy = false;
    }
  }
  const dealHand = () => {
    store.set(STAKE_KEY, String(stake));
    void run(() => api.bjDeal(s, stake));
  };
  const act = (a: 'hit' | 'stand' | 'double') => isHand(state) && run(() => api.bjAct(s, (state as BjView).id, a));
  document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach(
    (b) =>
      (b.onclick = () => {
        if (isHand(state) && !state.done) return;
        stake = Number(b.dataset.chip);
        draw();
      }),
  );
  if ('error' in state) mo('The table isn’t open yet. Check back soon.');
  else if (isHand(state) && !state.done) mo('You left a hand on the felt. Still yours.');
  draw();
  void esc;
}
