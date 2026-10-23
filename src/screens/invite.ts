// A personal invitation: a sealed envelope, a letter from the committee, and a single-use code under a gold foil
// you scratch off. Only the club's admin can make one; each lives at its own private link: #/invite/<id>.
import { api, getSession } from '../api';
import type { Invite } from '../api/types';
import { crest } from '../brand';
import { sfx } from '../fx/sound';
import { reginaldSvg } from '../host';
import { requireSession } from '../state';
import { esc, render } from '../ui';

export const inviteLink = (id: string) => `${location.origin}${location.pathname}#/invite/${id}`;

export async function invite(id: string) {
  const inv = id ? await api.peekInvite(id).catch(() => null) : null;
  if (!inv || inv.used) {
    render(`
      <main class="invite">
        <article class="letter in">
          <header class="letter-head">${crest(64, 'lh')}<p class="eyebrow">CCC · Est. 2026</p></header>
          <p class="letter-dear">${inv ? `Welcome back, ${esc(inv.name)}.` : 'Ah.'}</p>
          <p>${inv ? 'This invitation has already been accepted. Members sign in with their name and PIN.' : 'This invitation is not one of ours. Do ask the member who sent it for a fresh one.'}</p>
          ${inv || getSession() ? '<a class="btn accept" href="#/">To the clubhouse</a>' : ''}
        </article>
      </main>`);
    return;
  }
  const dear = inv.name;
  render(`
    <main class="invite">
      <button class="envelope" id="envelope" aria-label="Open your invitation">
        <span class="env-back"></span>
        <span class="env-flap"></span>
        <span class="env-front"><span class="env-to"><small>For the attention of</small><b>${esc(dear)}</b></span></span>
        <span class="env-seal">${crest(44, 'seal')}</span>
        <span class="env-hint">Tap to break the seal</span>
      </button>
      <article class="letter" id="letter" hidden>
        <header class="letter-head">${crest(64, 'lh')}<p class="eyebrow">CCC · Est. 2026</p></header>
        <p class="letter-dear">Dear ${esc(dear)},</p>
        <p>The Committee is delighted to put you up for membership of the CCC.</p>
        <p>A new course opens every month. Play it as often as you please; your lowest round of the month counts toward the Monthly Championship, and you'll collect gear along the way.</p>
        <p>Your invitation code lies beneath the foil. You'll need it but once.</p>
        <div class="scratch" id="scratch">
          <p class="scratch-code" aria-live="polite"><small>Your code</small><b id="code">${esc(inv.code.toUpperCase())}</b></p>
          <canvas id="foil" aria-hidden="true"></canvas>
        </div>
        <button class="link reveal-link" id="reveal">Can't scratch? Reveal it</button>
        <button class="btn ghost copy-code" id="copy" hidden>Copy code</button>
        <div class="letter-sign">
          <span class="host-face">${reginaldSvg('pleased', 52)}</span>
          <p>Yours most cordially,<b>Reginald</b><small>Club Steward</small></p>
        </div>
        <a class="btn accept" id="accept" href="#/join/${encodeURIComponent(inv.code)}/${encodeURIComponent(inv.name)}" hidden>Accept membership</a>
        <p class="fine accept-note" id="accept-note" hidden>Next you'll choose a four-digit PIN. That's your password from then on: members sign in with their name and PIN.</p>
      </article>
    </main>`);

  const envelope = document.getElementById('envelope') as HTMLButtonElement;
  const letter = document.getElementById('letter')!;
  envelope.onclick = () => {
    if (envelope.classList.contains('open')) return;
    envelope.classList.add('open');
    sfx('pop');
    window.setTimeout(() => sfx('whoosh'), 250);
    window.setTimeout(() => {
      envelope.hidden = true;
      letter.hidden = false;
      letter.classList.add('in');
      foil();
    }, 900);
  };

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    document.getElementById('scratch')!.classList.add('done');
    document.getElementById('reveal')!.hidden = true;
    document.getElementById('accept')!.hidden = false;
    document.getElementById('accept-note')!.hidden = false;
    const copy = document.getElementById('copy') as HTMLButtonElement;
    copy.hidden = false;
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(document.getElementById('code')!.textContent ?? '');
        copy.textContent = 'Copied';
      } catch {
        window.getSelection()?.selectAllChildren(document.getElementById('code')!);
      }
    };
    sfx('cheer');
  };
  document.getElementById('reveal')!.onclick = reveal;

  // the foil: a gold panel you rub away with a finger or the mouse
  function foil() {
    const c = document.getElementById('foil') as HTMLCanvasElement;
    const box = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(box.width * dpr);
    c.height = Math.round(box.height * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const w = box.width;
    const h = box.height;
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#9c7a3f');
    grad.addColorStop(0.35, '#e8cf8f');
    grad.addColorStop(0.5, '#c9a65f');
    grad.addColorStop(0.7, '#f1dea5');
    grad.addColorStop(1, '#9c7a3f');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // fine engine-turned texture
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    for (let x = -h; x < w; x += 6) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + h, 0);
      g.stroke();
    }
    g.fillStyle = 'rgba(22,59,44,0.85)';
    g.font = `800 ${Math.min(13, w / 22)}px Manrope, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('S C R A T C H   T O   R E V E A L', w / 2, h / 2);

    // the eraser: fully opaque, so each pass takes the foil clean off
    g.globalCompositeOperation = 'destination-out';
    g.strokeStyle = g.fillStyle = '#000';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 34;
    let last: { x: number; y: number } | null = null;
    let strokes = 0;
    const at = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const scratch = (p: { x: number; y: number }) => {
      g.beginPath();
      if (last) {
        g.moveTo(last.x, last.y);
        g.lineTo(p.x, p.y);
        g.stroke();
      } else {
        g.arc(p.x, p.y, 17, 0, Math.PI * 2);
        g.fill();
      }
      last = p;
      if (++strokes % 6 === 0) {
        sfx('tick');
        if (cleared() > 0.5) reveal();
      }
    };
    // how much of the foil is gone, sampled on a coarse grid
    const cleared = () => {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let clear = 0;
      let n = 0;
      for (let y = 4; y < c.height; y += 8)
        for (let x = 4; x < c.width; x += 8) {
          n++;
          if (d[(y * c.width + x) * 4 + 3] < 40) clear++;
        }
      return clear / n;
    };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      last = null;
      scratch(at(e));
    });
    c.addEventListener('pointermove', (e) => {
      if (e.buttons || e.pointerType === 'touch') {
        if (c.hasPointerCapture(e.pointerId)) scratch(at(e));
      }
    });
    c.addEventListener('pointerup', () => (last = null));
  }
}

// From the clubhouse, for the admin only: type a friend's name, get their private invitation link.
export function inviteMaker(admin: boolean) {
  if (!admin) return '';
  return `
    <section class="panel invite-maker">
      <div><h2>Put up a friend</h2><p class="muted">Each invitation is a private link with a code that works once, for that person only.</p></div>
      <form id="invite-form" class="invite-form">
        <input id="invite-name" maxlength="20" placeholder="Their first name" autocomplete="off" aria-label="Friend's name" required />
        <button class="btn" type="submit">Make invitation</button>
      </form>
      <p class="error" id="invite-err" role="alert"></p>
      <ul class="invite-list" id="invite-list"></ul>
    </section>`;
}

// phones get the native share sheet; desktops copy the link
const canShare = () => typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;

export async function bindInviteMaker() {
  const form = document.getElementById('invite-form') as HTMLFormElement | null;
  if (!form) return;
  const list = document.getElementById('invite-list')!;
  const err = document.getElementById('invite-err')!;
  const draw = (invites: Invite[], fresh?: string) => {
    list.innerHTML = invites
      .map(
        (i) => `<li class="${i.id === fresh ? 'fresh' : ''}">
          <span><b>${esc(i.name)}</b><small>${i.usedBy ? `Accepted${i.usedBy !== i.name ? ` as ${esc(i.usedBy)}` : ''}` : 'Waiting to be opened'}</small></span>
          ${i.usedBy ? '<em>Member</em>' : `<button class="btn ghost" data-send="${i.id}">${canShare() ? 'Share' : 'Copy link'}</button>`}
        </li>`,
      )
      .join('');
    list.querySelectorAll<HTMLButtonElement>('[data-send]').forEach((b) => {
      b.onclick = async () => {
        const url = inviteLink(b.dataset.send!);
        try {
          if (canShare()) await navigator.share({ title: 'Claude Country Club', text: 'You have been put up for membership.', url });
          else {
            await navigator.clipboard.writeText(url);
            b.textContent = 'Copied';
          }
        } catch {
          window.prompt('Copy this link', url);
        }
      };
    });
  };
  const s = requireSession();
  draw(await api.listInvites(s).catch(() => []));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('invite-name') as HTMLInputElement;
    err.textContent = '';
    try {
      const made = await api.createInvite(s, input.value);
      input.value = '';
      draw(await api.listInvites(s), made.id);
    } catch (x) {
      err.textContent = (x as Error).message;
    }
  });
}
