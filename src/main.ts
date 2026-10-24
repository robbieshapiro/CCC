import './style.css';
import { favicon } from './brand';
import { getSession } from './api';
import { setSound, soundOn } from './fx/sound';
import { home } from './screens/home';
import { invite } from './screens/invite';
import { join, landing } from './screens/join';
import { closeWelcome, welcome } from './intro/welcome';
import { card, leaveCard } from './screens/card';
import { closeRound, practice, round } from './screens/round';
import { courseById, nextCourse, upcoming } from './golf3d/courses';
import { leaveLockers, lockers } from './screens/lockers';
import { leaveMember, member } from './screens/member';
import { onSnapshot, refresh, startPolling } from './state';
import { esc, muteButton, render } from './ui';

let route = '';
let routing = false; // the router draws the page itself; the refresh hook mustn't draw it a second time

document.querySelector<HTMLLinkElement>('link[rel=icon]')?.setAttribute('href', favicon());

async function router() {
  closeRound();
  leaveCard();
  leaveLockers();
  leaveMember();
  closeWelcome();
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, arg, extra] = hash.split('/');
  route = page || 'home';

  if (page === 'invite') return invite(arg ?? '');
  if (page === 'join' && arg) return join(decodeURIComponent(arg), decodeURIComponent(extra ?? ''));
  if (!getSession()) return landing();

  try {
    routing = true;
    const s = await refresh().finally(() => (routing = false));
    const me = s.players.find((p) => p.id === s.me);
    // new members get the tour first; it lives at #/ for them, so mark the route or the minute-by-minute
    // refresh would redraw the home page over the top of it
    if (page === 'welcome' || (me && !me.avatar.onboarded && page !== 'card')) {
      route = 'welcome';
      return welcome(s);
    }
    if (page === 'round') return round(s);
    // the admin's look at every hole of a course still to come
    if (page === 'preview') {
      const c = courseById(arg ?? '');
      if (s.admin && c && upcoming(s.month).includes(c)) return round(s, { course: c });
      location.hash = '#/';
      return;
    }
    // any member's practice on the first holes of the next course, before it counts
    if (page === 'practice') {
      const c = nextCourse(s.month);
      if (c && c.id === arg) return practice(s, c);
      location.hash = '#/';
      return;
    }
    if (page === 'card' || (page === 'member' && arg === s.me)) return card(s);
    if (page === 'member' && arg) return member(s, arg);
    if (page === 'lockers') return lockers(s);
    return home(s);
  } catch (err) {
    render(`<main class="narrow"><h1>Something went wrong</h1><p class="error">${esc((err as Error).message)}</p>
      <p class="muted">If your session expired, open your group's invite link again.</p></main>`);
  }
}

// Live-update the home page as polls come in; never interrupt a shot.
onSnapshot((s) => {
  if (route === 'home' && !routing) home(s);
});

// Sound toggle lives in the header on every screen.
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-mute]');
  if (!btn) return;
  setSound(!soundOn());
  document.querySelectorAll('[data-mute]').forEach((b) => (b.outerHTML = muteButton()));
});

window.addEventListener('hashchange', router);
startPolling();
router();
