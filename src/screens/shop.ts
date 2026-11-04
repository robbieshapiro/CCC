// The Pro Shop, in the Clubhouse: your golfer on a turntable, your balance, and the racks. Tap a piece to try it on;
// buy it and it's worn straight away. Pieces you own can be put on and taken off for free.
import { api } from '../api';
import type { Avatar, Player, Snapshot } from '../api/types';
import { BONUS } from '../bonus';
import { specOf } from '../avatar';
import type { GolferSpec } from '../golf3d/golfer';
import { money } from '../purse';
import { badgeSvg, balanceOf, canShop, earningsOf, ITEMS, KIND_NAME, nextRank, rankOf, RANKS, type Item, type Kind } from '../shop';
import { refresh, requireSession } from '../state';
import { toast } from '../nudges';
import { esc } from '../ui';
import { GolferStage } from './locker';

let stage: GolferStage | null = null;
export const leaveShop = () => {
  stage?.destroy();
  stage = null;
};

export function shopPane(snap: Snapshot) {
  const me = snap.players.find((p) => p.id === snap.me);
  if (!me || me.host) return `<p class="muted">The Pro Shop is for playing members. Your shopping happens at your home club.</p>`;
  const earned = earningsOf(me);
  const rank = rankOf(earned);
  const next = nextRank(earned);
  const racks = RANKS.map(
    (r) => `<section class="shop-rack rack-${r.id}${canShop(r.id, earned) ? '' : ' locked'}">
      <h2>${badgeSvg(r.id, 22)} ${r.id === 'member' ? 'The shop floor' : `${r.name} rack`}${canShop(r.id, earned) ? '' : ` <small>🔒 opens at ${money(r.from)} career earnings</small>`}</h2>
      <div class="shop-items">${(['top', 'hat', 'bling', 'bag', 'putter', 'caddie'] as Kind[])
        .flatMap((k) => ITEMS.filter((i) => i.rack === r.id && i.kind === k))
        .map((i) => itemCard(i))
        .join('')}</div>
    </section>`,
  ).join('');
  return `
    <div class="shop">
      <div class="shop-head">
        <div class="shop-stage" id="shop-stage"></div>
        <div class="shop-wallet">
          <p class="eyebrow">The Pro Shop</p>
          <p class="shop-balance"><b>${money(balanceOf(me))}</b><span>to spend</span></p>
          <p class="shop-rank">${badgeSvg(rank.id, 22)} <b>${rank.name}</b> · ${money(earned)} career earnings${next ? ` · ${next.name} at ${money(next.from)}` : ''}</p>
          ${earnedFrom(me)}
          <details class="shop-how"><summary>How to earn</summary>
            <p><b>The weekly purse</b> is the big money: the top 10 on your club’s board get paid.</p>
            <p><b>On the side:</b> ${money(BONUS.round)} for your first round of the day, plus ${money(BONUS.birdie)} a birdie, ${money(BONUS.eagle)} an eagle and ${money(BONUS.ace)} an ace on it. ${money(BONUS.streak3)} on your third day running at the club and ${money(BONUS.streak7)} every seventh. ${money(BONUS.ctp)} for winning Closest to the Pin.</p>
            <p class="muted">Spending never touches your career earnings. Everything here is for looks: it shows on the course, in the stands and on your member card.</p>
          </details>
          <p class="shop-trying" id="shop-trying" hidden></p>
        </div>
      </div>
      ${racks}
    </div>`;
}

// where the money came from, biggest first
function earnedFrom(me: Player) {
  const b = me.bonus;
  const parts = (
    [
      ['Purses', me.earnings ?? 0],
      ['Rounds', b?.rounds ?? 0],
      ['Streaks', b?.streaks ?? 0],
      ['Closest to the Pin', b?.ctp ?? 0],
      ['Birdies and better', b?.shots ?? 0],
    ] as [string, number][]
  ).filter(([, n]) => n > 0);
  if (!parts.length) return '';
  return `<p class="shop-from">${parts.map(([k, n]) => `<span>${k} <b>${money(n)}</b></span>`).join('')}</p>`;
}

function itemCard(i: Item) {
  return `<button class="shop-item" data-item="${i.id}"><i class="si-kind">${KIND_NAME[i.kind]}</i><b>${esc(i.name)}</b><span>${esc(i.what)}</span><em data-state>${money(i.price)}</em></button>`;
}

export function bindShop(snap: Snapshot) {
  const me = snap.players.find((p) => p.id === snap.me);
  const host = document.getElementById('shop-stage');
  if (!me || me.host || !host) return;
  let spec: GolferSpec = specOf(me.avatar);
  const owned = new Set(me.owned ?? []);
  const earned = earningsOf(me);
  let trying: Item | null = null;
  leaveShop();
  try {
    stage = new GolferStage(host, spec);
  } catch {
    host.hidden = true;
  }
  spec.caddieBib = me.name;
  const show = () => stage?.set(trying ? tryOn(spec, trying) : spec);
  const label = (i: Item) => {
    if (owned.has(i.id)) return i.worn(spec) ? 'Wearing · take off' : 'Owned · wear';
    if (!canShop(i.rack, earned)) return `🔒 ${money(i.price)}`;
    if (trying?.id === i.id) return balanceOf(me) >= i.price ? `Buy · ${money(i.price)}` : `Short ${money(i.price - balanceOf(me))}`;
    return money(i.price);
  };
  const draw = () => {
    document.querySelectorAll<HTMLButtonElement>('.shop-item').forEach((b) => {
      const i = ITEMS.find((x) => x.id === b.dataset.item)!;
      b.querySelector('[data-state]')!.textContent = label(i);
      b.classList.toggle('owned', owned.has(i.id));
      b.classList.toggle('worn', owned.has(i.id) && i.worn(spec));
      b.classList.toggle('trying', trying?.id === i.id);
    });
    const note = document.getElementById('shop-trying');
    if (note) {
      note.hidden = !trying;
      if (trying) note.innerHTML = `Trying on the <b>${esc(trying.name)}</b>. Tap it again to ${owned.has(trying.id) ? 'wear it' : canShop(trying.rack, earned) ? 'buy it' : 'put it back'}.`;
    }
  };
  const save = async () => {
    const avatar: Avatar = { ...me.avatar, golfer: spec };
    me.avatar = avatar;
    await api.saveAvatar(requireSession(), avatar).catch(() => toast('Couldn’t save your look. Try again.'));
  };
  document.querySelectorAll<HTMLButtonElement>('.shop-item').forEach((b) => {
    b.onclick = async () => {
      const i = ITEMS.find((x) => x.id === b.dataset.item)!;
      // owned: put it on or take it off
      if (owned.has(i.id)) {
        spec = { ...spec, caddieBib: me.name };
        if (i.worn(spec)) i.off(spec);
        else i.wear(spec);
        trying = null;
        show();
        draw();
        return void save();
      }
      // first tap tries it on; a second tap buys it
      if (trying?.id !== i.id) {
        trying = i;
        show();
        return draw();
      }
      if (!canShop(i.rack, earned) || balanceOf(me) < i.price) {
        trying = null;
        show();
        return draw();
      }
      b.disabled = true;
      try {
        await api.buyItem(requireSession(), i.id);
        owned.add(i.id);
        me.spent = (me.spent ?? 0) + i.price;
        spec = tryOn(spec, i);
        trying = null;
        show();
        draw();
        await save();
        const bal = document.querySelector('.shop-balance b');
        if (bal) bal.textContent = money(balanceOf(me));
        toast(`${i.name}: yours. It’s on.`);
        void refresh();
      } catch (err) {
        toast((err as Error).message);
      } finally {
        b.disabled = false;
      }
    };
  });
  draw();
}

const tryOn = (s: GolferSpec, i: Item) => {
  const next = { ...s };
  i.wear(next);
  return next;
};
