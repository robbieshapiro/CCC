// Mo's Book, at the bar (#/bar/book): bets on the week's Open. Pick a stake, then a name to win it (at Mo's price,
// locked when you bet) or back yourself to beat your line. Your bets underneath, open and settled. The sums are in
// src/book.ts and book_state / book_bet in supabase/schema.sql.
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { CHIPS, DAILY_LOSS } from '../blackjack';
import { betStatus, type BookBet, type BookState } from '../book';
import { periodName } from '../day';
import { ask, tell } from '../dialog';
import { money } from '../purse';
import { toParLabel } from '../standings';
import { staffFace } from '../staff';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { esc, header, render } from '../ui';

const STAKE_KEY = 'ccc-book-stake';
const odds = (n: number) => `${n.toFixed(1)}x`;

export async function book(snap: Snapshot) {
  const s = requireSession();
  let stake = Math.min(500, Math.max(10, Number(store.get(STAKE_KEY)) || 100));
  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="bj-page book-page">
      <a class="bj-back" href="#/bar">‹ The bar</a>
      <section class="pas-head">
        <span class="bj-face">${staffFace('mo', 56)}</span>
        <p id="book-mo">Mo's Book. Pick who wins the Open, or back yourself. Prices are locked when you bet.</p>
      </section>
      <section class="bj-rail">
        <div class="bj-bank"><span>In the bank</span><b id="book-bank">…</b></div>
        <div class="bj-chips" id="book-chips">${CHIPS.map((c) => `<button class="bj-chip c${c}" data-chip="${c}">${c}</button>`).join('')}</div>
      </section>
      <div id="book-body"><p class="muted">Mo's opening the book…</p></div>
      <p class="bj-fine">Who wins pays at the price you took; a tie for first splits it. Back yourself pays 1.9x if your best card this week beats your line, and comes back if you don't post one. Bets settle when the week closes. Club money only, $10 to $500 a bet, at most ${money(DAILY_LOSS)} lost a day.</p>
    </main>`);

  const $ = (id: string) => document.getElementById(id);
  let st: BookState | null = null;
  const chips = () => document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.classList.toggle('on', Number(b.dataset.chip) === stake));
  document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach(
    (b) =>
      (b.onclick = () => {
        stake = Number(b.dataset.chip);
        store.set(STAKE_KEY, String(stake));
        chips();
        draw();
      }),
  );
  chips();

  const place = async (kind: 'winner' | 'back', pick: string | null, label: string, price: number) => {
    const ok = await ask({ title: `${money(stake)} on ${label}?`, body: `<p>Pays ${money(Math.floor(stake * price))} if it comes in.</p>`, ok: 'Place the bet' });
    if (!ok) return;
    try {
      st = await api.bookBet(s, kind, pick, stake);
      const mo = $('book-mo');
      if (mo) mo.textContent = kind === 'back' ? "Backing yourself. I like it. Don't make me rich." : `${label}, is it? I'll write it down.`;
      void refresh();
      draw();
    } catch (e) {
      void tell("Mo won't take that", `<p>${esc((e as Error).message)}</p>`);
    }
  };

  function draw() {
    const body = $('book-body');
    if (!body || !st) return;
    const bank = $('book-bank');
    if (bank) bank.textContent = money(st.bank);
    const field = st.field.length
      ? `<ul class="book-field">${st.field
          .map(
            (f) => `<li class="${f.mine ? 'me' : ''}"><div><b>${esc(f.name)}</b><small>${f.posted === null ? 'no card yet' : `best ${toParLabel(f.posted)}`}</small></div>
            <em>${odds(f.odds)}</em>${st!.open ? `<button class="btn small" data-win="${esc(f.playerId)}">Bet ${money(stake)}</button>` : ''}</li>`,
          )
          .join('')}</ul>`
      : '<p class="muted">Nobody to price yet. The book fills in once members have played the Open.</p>';
    const back = st.back;
    const backBox =
      back.line !== null && back.can
        ? `<p>Beat <b>${toParLabel(back.line)}</b> with your best card this week and it pays 1.9x.</p><button class="bj-btn gold" data-back>Back myself · ${money(stake)}</button>`
        : `<p class="muted">${esc(back.why ?? 'Not this week.')}${back.line !== null ? ` Your line: ${toParLabel(back.line)}.` : ''}</p>`;
    body.innerHTML = `
      <section class="book-sec">
        <h2>Who wins the Open <small>${esc(periodName(st.week))}</small></h2>
        ${st.open ? '' : '<p class="book-closed">The book’s closed for the last day. It opens again Sunday.</p>'}
        ${field}
      </section>
      <section class="book-sec">
        <h2>Back yourself</h2>
        ${backBox}
      </section>
      <section class="book-sec">
        <h2>Your bets</h2>
        ${st.bets.length ? `<ul class="book-bets">${st.bets.map(betRow).join('')}</ul>` : '<p class="muted">Nothing on the book yet.</p>'}
      </section>`;
    body.querySelectorAll<HTMLButtonElement>('[data-win]').forEach((b) => {
      const f = st!.field.find((x) => x.playerId === b.dataset.win)!;
      b.onclick = () => void place('winner', f.playerId, f.mine ? 'yourself to win' : `${f.name} to win`, f.odds);
    });
    const bb = body.querySelector<HTMLButtonElement>('[data-back]');
    if (bb) bb.onclick = () => void place('back', null, `yourself to beat ${toParLabel(back.line!)}`, 1.9);
  }

  try {
    st = await api.bookState(s);
  } catch (e) {
    const body = $('book-body');
    if (body) body.innerHTML = `<p class="muted">${esc((e as Error).message)}</p>`;
    return;
  }
  draw();
}

function betRow(b: BookBet) {
  const what = b.kind === 'winner' ? `${esc(b.pick ?? '?')} to win` : `Beat ${toParLabel(b.line ?? 0)}`;
  const s = betStatus(b);
  const result =
    s === 'open'
      ? `<em class="open">Pays ${money(Math.floor(b.stake * b.odds))}</em>`
      : s === 'won'
        ? `<em class="won">Won ${money(b.payout!)}</em>`
        : s === 'void'
          ? `<em>Stake back</em>`
          : `<em class="lost">Lost</em>`;
  return `<li><div><b>${what}</b><small>${esc(periodName(b.week))} · ${money(b.stake)} at ${odds(b.odds)}</small></div>${result}</li>`;
}
