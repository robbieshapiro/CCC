// The Pro Shop, run by Reginald: a fitting room with your golfer on a plinth and Reginald behind the counter
// (fitting.ts), then the racks by category. Tap a piece to try it on: the camera goes to it and Reginald has a word.
// Buy it and it's worn straight away. Pieces you own can be put on and taken off for free.
import { api } from '../api';
import type { Avatar, Player, Snapshot } from '../api/types';
import { BONUS, LONG_PUTT_FT, MONSTER_PUTT_FT } from '../bonus';
import { specOf } from '../avatar';
import type { GolferSpec } from '../golf3d/golfer';
import { reginaldSvg } from '../host';
import { money, OPEN_FLOOR, OPEN_PER_PLAYER } from '../purse';
import { badgeSvg, balanceOf, canShop, earningsOf, focusOf, ITEMS, KIND_ICON, KIND_NAME, KINDS, nextRank, rankOf, RANKS, type Item, type Kind } from '../shop';
import { refresh, requireSession } from '../state';
import { toast } from '../nudges';
import { esc } from '../ui';
import { FittingRoom, type Focus } from './fitting';

let room: FittingRoom | null = null;
export const leaveShop = () => {
  room?.destroy();
  room = null;
};

// Reginald's word on each piece: the same line for the same piece, a few for each kind
const SAY: Record<Kind, string[]> = {
  top: ['A fine cut. The tailor would approve, and he approves of very little.', 'It sits well across the shoulders. Turn round, let me see.', 'Bold. The membership will talk. Let them.'],
  outer: ['For the days the weather has opinions.', 'Warm, smart, and it keeps the swing free. I tried.', 'One for the early tee times.'],
  bottoms: ['A good trouser makes the golfer. A bad one makes the newsletter.', 'The break over the shoe is correct. I checked.', 'Comfortable through the turn. Very important.'],
  shoes: ['Spikes clean, laces tidy. That is all I ask.', 'Good shoes are half a swing.', 'They will see those from the clubhouse.'],
  gloves: ['A glove for the lead hand. Grip it, don’t strangle it.', 'Soft leather. You will feel the club better.', 'The pros wear one. So should you.'],
  hat: ['It frames the face nicely. And keeps the sun off it.', 'Tilt it a touch. There. Distinguished.', 'A hat says something. This one says it loudly.'],
  eyewear: ['For reading greens, and for not being recognised.', 'Very sharp. The glare won’t trouble you.', 'You look like you know something. Do you?'],
  bling: ['It catches the light on the backswing. As it should.', 'Tasteful, in a way. A particular way.', 'The membership will notice. That is rather the point.'],
  putter: ['Feel the balance. The greens will thank you.', 'A putter is a personal matter. This one suits you.', 'Hold it like a small bird. Now stroke it.'],
  driver: ['Mind the ceiling. And the lights. And me.', 'All the length in the world, if you can find the middle.', 'A big head. Fitting, some would say. Not I.'],
  bag: ['A bag says where you’ve been. This one says the bar.', 'Plenty of pockets. You will lose things in all of them.', 'It stands up by itself. Better than some members.'],
  caddie: ['Your own man on the bag. He reads greens and keeps quiet. I trained him.', 'He knows every yardage and every excuse.', 'Shall I send him out? He is very good.'],
};
const line = (i: Item) => {
  const list = SAY[i.kind];
  return list[[...i.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length];
};

export function shopPane(snap: Snapshot) {
  const me = snap.players.find((p) => p.id === snap.me);
  if (!me || me.host) return `<p class="muted">The Pro Shop is for playing members. Your shopping happens at your home club.</p>`;
  const earned = earningsOf(me);
  const titles = me.wins ?? 0;
  const rank = rankOf(earned, titles);
  const next = nextRank(earned);
  const toNext = next ? Math.min(100, Math.round(((earned - rank.from) / (next.from - rank.from)) * 100)) : 100;
  const kinds = KINDS.filter((k) => ITEMS.some((i) => i.kind === k));
  return `
    <div class="fit">
      <div class="fit-stage" id="shop-stage">
        <div class="fit-views" role="group" aria-label="View">
          ${(['full', 'head', 'hands', 'bag'] as Focus[]).map((v) => `<button data-view="${v}" class="${v === 'full' ? 'on' : ''}">${{ full: 'Full look', head: 'Face', hands: 'Hands', bag: 'Bag check' }[v as 'full' | 'head' | 'hands' | 'bag']}</button>`).join('')}
        </div>
        <p class="fit-hint">Drag to turn round</p>
      </div>
      <div class="fit-say" id="fit-say"><span class="host-face">${reginaldSvg('pleased', 46)}</span><p><b>Reginald</b> <span data-line>Good day, ${esc(me.name)}. Have a look round. Anything you like, try it on. No obligation, though I shall be disappointed.</span></p></div>
      <div class="fit-wallet">
        <div><p class="fit-balance"><b>${money(balanceOf(me))}</b> to spend</p>
          <p class="fit-rank">${badgeSvg(rank.id, 18)} ${rank.name} · ${money(earned)} career${next ? ` · ${next.name} at ${money(next.from)}` : ''}</p></div>
        ${next ? `<div class="fit-progress" title="${toNext}% of the way to ${next.name}"><i style="width:${toNext}%"></i></div>` : ''}
        ${earnedFrom(me)}
      </div>
      <div class="fit-tabs" role="tablist">
        <button role="tab" data-kind="" class="on">All</button>
        ${kinds.map((k) => `<button role="tab" data-kind="${k}">${KIND_ICON[k]} ${KIND_NAME[k]}</button>`).join('')}
      </div>
      <div class="fit-racks" id="fit-racks">${racks(earned, titles)}</div>
      <div class="fit-pick" id="fit-pick" hidden></div>
      <details class="shop-how"><summary>How to earn</summary>
        <p><b>The weekly purse:</b> at least ${money(OPEN_FLOOR)} a week, and ${money(OPEN_PER_PLAYER)} a player once more than ${OPEN_FLOOR / OPEN_PER_PLAYER} play. The top 10 on the Open split it like a tour event.</p>
        <p><b>Every day you play your card:</b> ${money(BONUS.round)}, plus ${money(BONUS.birdie)} a birdie, ${money(BONUS.eagle)} an eagle, ${money(BONUS.albatross)} an albatross and ${money(BONUS.ace)} a hole in one. ${money(BONUS.streak3)} for three days running at the club, ${money(BONUS.streak7)} for every full week.</p>
        <p><b>The moments:</b> hole a putt from ${LONG_PUTT_FT} ft for ${money(BONUS.longPutt)}, from ${MONSTER_PUTT_FT} ft for ${money(BONUS.monsterPutt)}. Chip in from off the green for ${money(BONUS.chipin)}. Find a hole's secret route for the first time for ${money(BONUS.secret)}.</p>
        <p><b>Around the club:</b> ${money(BONUS.ctp)} for winning the day's Closest to the Pin. ${money(BONUS.designPlay)} each time another member finishes a hole you designed on the Members' Course (once each a week, up to ${money(BONUS.designWeek)} a week).</p>
        <p class="muted">Only your daily card counts; practice is free and earns nothing. Spending never touches your career earnings. The Club Legend rack also needs a weekly title.</p>
      </details>
    </div>`;
}

// the racks: the shop floor in two collections (Clubhouse Classics and the Tour Collection), then a shelf per rank
// above it; each in category order, a locked rack showing what's coming
function racks(earned: number, titles: number, kind = '') {
  const shelves: { rack: (typeof RANKS)[number]; title: string; pick: (i: Item) => boolean }[] = [
    { rack: RANKS[0], title: 'Clubhouse Classics', pick: (i) => i.rack === 'member' && !i.collection },
    { rack: RANKS[0], title: 'The Tour Collection', pick: (i) => i.rack === 'member' && i.collection === 'tour' },
    { rack: RANKS[1], title: `${RANKS[1].name} rack`, pick: (i) => i.rack === 'pro' },
    { rack: RANKS[2], title: `${RANKS[2].name} rack`, pick: (i) => i.rack === 'legend' },
  ];
  return shelves
    .map(({ rack: r, title, pick }) => {
      const items = KINDS.flatMap((k) => ITEMS.filter((i) => pick(i) && i.kind === k && (!kind || i.kind === kind)));
      if (!items.length) return '';
      const open = canShop(r.id, earned, titles);
      const why = r.id === 'legend' && earned >= r.from && !titles ? 'opens with a weekly title' : `opens at ${money(r.from)} career${r.id === 'legend' ? ' and a weekly title' : ''}`;
      return `<section class="fit-rack rack-${r.id}${open ? '' : ' locked'}">
      <h3>${badgeSvg(r.id, 18)} ${title}${open ? '' : ` <small>🔒 ${why}</small>`}</h3>
      <div class="fit-row">${items.map(card).join('')}</div>
    </section>`;
    })
    .join('');
}

function card(i: Item) {
  return `<button class="fit-item" data-item="${i.id}"><i class="fi-icon" aria-hidden="true">${KIND_ICON[i.kind]}</i><b>${esc(i.name)}</b><em data-state>${money(i.price)}</em></button>`;
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
      ['Long putts', b?.putts ?? 0],
      ['Chip-ins', b?.chipins ?? 0],
      ['Secrets found', b?.secrets ?? 0],
      ['Your holes played', b?.designs ?? 0],
    ] as [string, number][]
  ).filter(([, n]) => n > 0);
  if (!parts.length) return '';
  return `<p class="shop-from">${parts.map(([k, n]) => `<span>${k} <b>${money(n)}</b></span>`).join('')}</p>`;
}

export function bindShop(snap: Snapshot) {
  const me = snap.players.find((p) => p.id === snap.me);
  const host = document.getElementById('shop-stage');
  if (!me || me.host || !host) return;
  let spec: GolferSpec = { ...specOf(me.avatar), caddieBib: me.name };
  const owned = new Set(me.owned ?? []);
  const earned = earningsOf(me);
  const titles = me.wins ?? 0;
  let trying: Item | null = null;
  leaveShop();
  try {
    room = new FittingRoom(host, spec);
  } catch {
    host.classList.add('no-3d');
  }
  const say = (text: string) => {
    const el = document.querySelector('#fit-say [data-line]');
    if (el) el.textContent = text;
  };
  const view = (v: Focus) => {
    room?.focus(v);
    document.querySelectorAll<HTMLButtonElement>('.fit-views [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v || (v === 'chest' && b.dataset.view === 'full')));
  };
  const show = () => room?.set(trying ? tryOn(spec, trying) : spec, trying?.kind === 'putter' ? 'putter' : trying?.kind === 'shoes' ? null : 'driver');
  const state = (i: Item) => {
    if (owned.has(i.id)) return i.worn(spec) ? 'Wearing' : 'Owned';
    if (!canShop(i.rack, earned, titles)) return `🔒 ${money(i.price)}`;
    return money(i.price);
  };
  // the piece being tried: what it is, and the one button that matters
  const pick = () => {
    const el = document.getElementById('fit-pick');
    if (!el) return;
    el.hidden = !trying;
    if (!trying) return;
    const i = trying;
    const own = owned.has(i.id);
    const locked = !canShop(i.rack, earned, titles);
    const short = Math.max(0, i.price - balanceOf(me));
    const action = own
      ? `<button class="btn" data-act="wear">${i.worn(spec) ? 'Take it off' : 'Wear it'}</button>`
      : locked
        ? `<button class="btn" disabled>🔒 ${esc(RANKS.find((r) => r.id === i.rack)!.name)} rack</button>`
        : short
          ? `<button class="btn" disabled>Short ${money(short)}</button>`
          : `<button class="btn gold" data-act="buy">Buy · ${money(i.price)}</button>`;
    el.innerHTML = `<div><p class="eyebrow fit-eyebrow"><span>${KIND_ICON[i.kind]} ${KIND_NAME[i.kind]}</span><span>${badgeSvg(i.rack, 14)} ${esc(RANKS.find((r) => r.id === i.rack)!.name)}</span></p><h3>${esc(i.name)}</h3><p class="muted">${esc(i.what)}</p></div>
      <div class="fit-acts">${action}<button class="btn ghost" data-act="back">Put it back</button></div>`;
    el.querySelector<HTMLButtonElement>('[data-act="back"]')!.onclick = () => {
      trying = null;
      show();
      view('full');
      draw();
    };
    el.querySelector<HTMLButtonElement>('[data-act="wear"]')?.addEventListener('click', () => {
      if (i.worn(spec)) i.off(spec);
      else i.wear(spec);
      spec = { ...spec };
      say(i.worn(spec) ? 'Splendid. Wear it well.' : 'Back on the rail it goes.');
      show();
      draw();
      void save();
    });
    el.querySelector<HTMLButtonElement>('[data-act="buy"]')?.addEventListener('click', (e) => void buy(i, e.currentTarget as HTMLButtonElement));
  };
  const draw = () => {
    document.querySelectorAll<HTMLButtonElement>('.fit-item').forEach((b) => {
      const i = ITEMS.find((x) => x.id === b.dataset.item)!;
      b.querySelector('[data-state]')!.textContent = state(i);
      b.classList.toggle('owned', owned.has(i.id));
      b.classList.toggle('worn', owned.has(i.id) && i.worn(spec));
      b.classList.toggle('trying', trying?.id === i.id);
    });
    pick();
  };
  const save = async () => {
    const avatar: Avatar = { ...me.avatar, golfer: spec };
    me.avatar = avatar;
    await api.saveAvatar(requireSession(), avatar).catch(() => toast('Couldn’t save your look. Try again.'));
  };
  const buy = async (i: Item, b: HTMLButtonElement) => {
    b.disabled = true;
    try {
      await api.buyItem(requireSession(), i.id);
      owned.add(i.id);
      me.spent = (me.spent ?? 0) + i.price;
      spec = tryOn(spec, i);
      trying = i;
      show();
      room?.nod();
      say(`Wrapped and on. ${i.name}, yours. I shall put it on your account. Which is to say, it’s paid.`);
      draw();
      await save();
      const bal = document.querySelector('.fit-balance b');
      if (bal) bal.textContent = money(balanceOf(me));
      void refresh();
    } catch (err) {
      toast((err as Error).message);
      b.disabled = false;
    }
  };
  const bindCards = () =>
    document.querySelectorAll<HTMLButtonElement>('.fit-item').forEach((b) => {
      b.onclick = () => {
        const i = ITEMS.find((x) => x.id === b.dataset.item)!;
        trying = trying?.id === i.id ? null : i;
        show();
        view(trying ? focusOf(i) : 'full');
        if (trying) say(!canShop(i.rack, earned, titles) && !owned.has(i.id) ? `That one is kept for the ${RANKS.find((r) => r.id === i.rack)!.name} rack. Try it all the same. ${line(i)}` : line(i));
        draw();
        // bring the fitting room back into view, so the try-on can be seen; the piece's panel sticks to the bottom
        if (trying) host.scrollIntoView({ block: 'start', behavior: 'smooth' });
      };
    });
  document.querySelectorAll<HTMLButtonElement>('.fit-views [data-view]').forEach((b) => (b.onclick = () => view(b.dataset.view as Focus)));
  document.querySelectorAll<HTMLButtonElement>('.fit-tabs [data-kind]').forEach(
    (b) =>
      (b.onclick = () => {
        document.querySelectorAll('.fit-tabs [data-kind]').forEach((x) => x.classList.toggle('on', x === b));
        document.getElementById('fit-racks')!.innerHTML = racks(earned, titles, b.dataset.kind);
        bindCards();
        draw();
      }),
  );
  bindCards();
  draw();
}

const tryOn = (s: GolferSpec, i: Item) => {
  const next = { ...s };
  i.wear(next);
  return next;
};
