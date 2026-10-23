// A personal invitation: a sealed envelope, a letter from the committee, and the club's code under a gold foil
// you scratch off. Each friend gets their own link: #/invite/<name>.
import { useSupabase } from '../api';
import { crest } from '../brand';
import { sfx } from '../fx/sound';
import { reginaldSvg } from '../host';
import { esc, render } from '../ui';

// the club's invite code; set VITE_INVITE_CODE to change it without touching the letter
export const INVITE_CODE = (import.meta.env.VITE_INVITE_CODE as string | undefined)?.trim().toLowerCase() || (useSupabase ? 'gentlemen' : 'demo');

// "jake", "Jake-Miller" and "Jake%20Miller" all read as a tidy name
export function inviteName(raw: string) {
  return raw
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const inviteLink = (name: string) => `${location.origin}${location.pathname}#/invite/${encodeURIComponent(name.trim().replace(/\s+/g, '-'))}`;

export function invite(raw: string) {
  const name = inviteName(raw);
  const dear = name || 'Guest';
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
        <header class="letter-head">${crest(64, 'lh')}<p class="eyebrow">Claude Country Club · Est. 2026</p></header>
        <p class="letter-dear">Dear ${esc(dear)},</p>
        <p>The Members' Committee has the pleasure of inviting you to join the Claude Country Club.</p>
        <p>We are a private mini golf club for a few friends. A new course every month, as many rounds as you like, and only your best one counts. The beverage cart is staffed. The steward is watching.</p>
        <p>Your membership code is below. Kindly scratch to reveal it, and do keep it to yourself.</p>
        <div class="scratch" id="scratch">
          <p class="scratch-code" aria-live="polite"><small>Your code</small><b id="code">${esc(INVITE_CODE)}</b></p>
          <canvas id="foil" aria-hidden="true"></canvas>
        </div>
        <button class="link reveal-link" id="reveal">Can't scratch? Reveal it</button>
        <div class="letter-sign">
          <span class="host-face">${reginaldSvg('pleased', 52)}</span>
          <p>Yours, with the usual reservations,<b>Reginald</b><small>Club Steward, on behalf of the Committee</small></p>
        </div>
        <a class="btn accept" id="accept" href="#/join/${encodeURIComponent(INVITE_CODE)}${name ? `/${encodeURIComponent(name)}` : ''}" hidden>Accept membership</a>
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
    const accept = document.getElementById('accept')!;
    accept.hidden = false;
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

// From the clubhouse: type a friend's name, get their personal invitation link.
export function inviteMaker() {
  return `
    <section class="panel invite-maker">
      <div><h2>Put up a friend</h2><p class="muted">Type their name for a personal invitation. They scratch it open to find the code.</p></div>
      <form id="invite-form" class="invite-form">
        <input id="invite-name" maxlength="20" placeholder="Their first name" autocomplete="off" aria-label="Friend's name" />
        <button class="btn" type="submit">Make invitation</button>
      </form>
      <div id="invite-out" class="invite-out" hidden>
        <input id="invite-link" readonly aria-label="Invitation link" />
        <button class="btn ghost" id="invite-copy" type="button">Copy</button>
        <a class="link" id="invite-preview" target="_blank" rel="noopener">Preview</a>
      </div>
    </section>`;
}

// phones get the native share sheet; desktops copy the link
const canShare = () => typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;

export function bindInviteMaker() {
  const form = document.getElementById('invite-form') as HTMLFormElement | null;
  if (!form) return;
  const out = document.getElementById('invite-out')!;
  const link = document.getElementById('invite-link') as HTMLInputElement;
  const copy = document.getElementById('invite-copy') as HTMLButtonElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = inviteName((document.getElementById('invite-name') as HTMLInputElement).value);
    if (!name) return;
    link.value = inviteLink(name);
    (document.getElementById('invite-preview') as HTMLAnchorElement).href = link.value;
    out.hidden = false;
    copy.textContent = canShare() ? 'Share' : 'Copy';
  });
  copy.onclick = async () => {
    try {
      if (canShare()) await navigator.share({ title: 'Claude Country Club', text: 'You have been put up for membership.', url: link.value });
      else {
        await navigator.clipboard.writeText(link.value);
        copy.textContent = 'Copied';
      }
    } catch {
      link.select();
    }
  };
}
