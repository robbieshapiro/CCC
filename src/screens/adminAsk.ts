// Ask Reginald, in the Committee Room: a chat with Reginald about the club (api/ask.ts reads the numbers fresh for each
// question). The conversation stays on this device for the session; a few starter questions until the first is asked.
import { useSupabase } from '../api';
import { requireSession } from '../state';
import { reginaldSvg } from '../host';
import { esc } from '../ui';

type Turn = { role: 'user' | 'assistant'; content: string };
const KEY = 'ccc-ask-reginald';
const STARTERS = ["Who's in today, and who's on the course?", "Who hasn't played this week?", 'How is this week\'s course playing?', 'What should I do today to get more people playing?'];

export const askSection = () => `<section class="adm-card adm-ask" id="adm-ask">
    <h2><span class="host-face">${reginaldSvg('pleased', 30)}</span> Ask Reginald</h2>
    <p class="fine ask-sub">Anything about the club. He reads today's numbers fresh for every question.</p>
    <div class="ask-log" id="ask-log" aria-live="polite"></div>
    <div class="ask-starters" id="ask-starters"></div>
    <form class="ask-form" id="ask-form">
      <textarea id="ask-q" rows="1" maxlength="2000" placeholder="Ask Reginald…" aria-label="Your question"></textarea>
      <button class="btn" type="submit" id="ask-send">Ask</button>
    </form>
    <p class="fine ask-foot"><button class="link" id="ask-clear" type="button">Start a new conversation</button></p>
  </section>`;

const load = (): Turn[] => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]') as Turn[];
  } catch {
    return [];
  }
};
const save = (t: Turn[]) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(t.slice(-30)));
  } catch {
    /* fine: the chat just won't survive a reload */
  }
};

// his answers: paragraphs and "- " lists, nothing else
function prose(text: string) {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split('\n').filter((l) => l.trim());
      if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^\s*[-•*]\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    })
    .join('');
}

export function bindAsk() {
  const log = document.getElementById('ask-log');
  const form = document.getElementById('ask-form') as HTMLFormElement | null;
  const box = document.getElementById('ask-q') as HTMLTextAreaElement | null;
  const send = document.getElementById('ask-send') as HTMLButtonElement | null;
  const starters = document.getElementById('ask-starters');
  if (!log || !form || !box || !send || !starters) return;
  let turns = load();
  let busy = false;

  const draw = (thinking = false) => {
    log.innerHTML =
      turns
        .map((t) => (t.role === 'user' ? `<div class="ask-msg me">${esc(t.content)}</div>` : `<div class="ask-msg reg">${prose(t.content)}</div>`))
        .join('') + (thinking ? '<div class="ask-msg reg thinking"><span></span><span></span><span></span></div>' : '');
    log.hidden = !turns.length && !thinking;
    starters.innerHTML = turns.length ? '' : STARTERS.map((q) => `<button type="button" class="ask-chip">${esc(q)}</button>`).join('');
    starters.querySelectorAll<HTMLButtonElement>('.ask-chip').forEach((b) => (b.onclick = () => void ask(b.textContent ?? '')));
    log.scrollTop = log.scrollHeight;
  };

  async function ask(q: string) {
    q = q.trim();
    if (!q || busy) return;
    if (!useSupabase) {
      turns.push({ role: 'user', content: q }, { role: 'assistant', content: "I read the live club's numbers, so there's nothing for me to go on in local mode." });
      return draw();
    }
    busy = true;
    send!.disabled = true;
    turns.push({ role: 'user', content: q });
    box!.value = '';
    draw(true);
    let answer: string | null = null;
    let why = '';
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: requireSession().token, messages: turns }) });
      const r = (await res.json()) as { answer: string | null; why?: string };
      answer = r.answer;
      why = r.why ?? '';
    } catch {
      why = 'offline';
    }
    if (answer) {
      turns.push({ role: 'assistant', content: answer });
      save(turns);
    } else {
      // nothing came back: take the question off so it can be asked again
      turns.pop();
      box!.value = q;
    }
    draw();
    if (!answer) {
      const note = why === 'cap' ? "That's all the questions for today. Ask again tomorrow." : why === 'not configured' ? 'Shows up once the AI key is set in Vercel.' : "Reginald couldn't answer just now. Try again in a moment.";
      log!.insertAdjacentHTML('beforeend', `<p class="ask-note">${esc(note)}</p>`);
      log!.hidden = false;
    }
    busy = false;
    send!.disabled = false;
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    void ask(box.value);
  };
  // Enter sends, Shift+Enter is a new line; the box grows with the question
  box.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask(box.value);
    }
  };
  box.oninput = () => {
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
  };
  document.getElementById('ask-clear')!.onclick = () => {
    turns = [];
    save(turns);
    draw();
    box.focus();
  };
  draw();
}
