import './style.css';
import { inject, pageview } from '@vercel/analytics';
import { getSession, listSessions, switchClub } from './api';
import { holdSheet } from './dialog';
import { setSound, soundOn } from './fx/sound';
import { admin } from './screens/admin';
import { home, newPeriod } from './screens/home';
import { invite } from './screens/invite';
import { join, landing } from './screens/join';
import { closeWelcome, welcome } from './intro/welcome';
import { card, leaveCard } from './screens/card';
import { leaveShop } from './screens/shop';
import { barRound, closeRound, dailyRound, practice, practiceArea, round } from './screens/round';
import { playoff } from './screens/playoff';
import { clubhouse, isClubhouseTab } from './screens/clubhouse';
import { designDesk } from './screens/design';
import { facility } from './screens/practice';
import { classics, courseById, courseFor, nextCourse } from './golf3d/courses';
import { leaveMember, member } from './screens/member';
import { checkIn } from './screens/activity';
import { onSnapshot, refresh, startPolling } from './state';
import { store } from './storage';
import { esc, muteButton, navigate, render } from './ui';

// The height you can actually see: on a phone the browser's own bars can cover the bottom of 100vh, so the play
// screen (.g3) sizes itself to this instead. The canvases follow on the resize they hear.
function fitViewport() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
}
fitViewport();
window.addEventListener('resize', fitViewport);
window.addEventListener('orientationchange', () => window.setTimeout(fitViewport, 300));
window.visualViewport?.addEventListener('resize', () => {
  const before = document.documentElement.style.getPropertyValue('--app-h');
  fitViewport();
  if (document.documentElement.style.getPropertyValue('--app-h') !== before) window.dispatchEvent(new Event('resize'));
});

let route = '';
let routing = false; // the router draws the page itself; the refresh hook mustn't draw it a second time

async function router() {
  closeRound();
  leaveCard();
  leaveShop();
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
    // the admin's own comings and goings stay out of the activity log and Vercel's numbers
    if (s.admin) store.set('ccc-admin', '1');
    else {
      store.remove('ccc-admin');
      checkIn('visit');
      if (page === 'locker' || page === 'lockers') checkIn('locker');
    }
    // new members get the tour first; it lives at #/ for them, so mark the route or the minute-by-minute
    // refresh would redraw the home page over the top of it
    if (page === 'welcome' || (me && !me.avatar.onboarded && page !== 'card')) {
      route = 'welcome';
      // #/welcome/preview: the Committee watching the tour from Admin; nothing is saved
      return welcome(s, page === 'welcome' && arg === 'preview');
    }
    // the first open of a new period lands on the home page, where the new course and last period's champion are
    if (page && page !== 'round' && newPeriod(s)) {
      location.replace('#/');
      return;
    }
    // #/round is today's card (or any round, before daily cards); #/round/practice a practice round of the week's course
    if (page === 'round') return arg === 'practice' ? round(s, { course: courseFor(s.month), practice: true }) : round(s);
    if (page === 'daily') return dailyRound(s);
    if (page === 'playoff') return playoff(s);
    if (page === 'bar') return arg === 'drive' || arg === 'members' ? barRound(s, arg) : clubhouse(s, 'bar');
    if (page === 'design') return designDesk(s, Number(arg) || undefined);
    if (page === 'clubhouse') return clubhouse(s, isClubhouseTab(arg) ? arg : 'members', extra);
    // the admin's look at every hole of a course still to come
    // the Committee rehearses Sunday's card on next week's course: the member's card flow, nothing posted
    if (page === 'rehearse') {
      const c = nextCourse(s.month) ?? courseFor(s.month);
      if (s.admin) return round(s, { course: c, dry: true });
      location.hash = '#/';
      return;
    }
    if (page === 'preview') {
      const c = courseById(arg ?? '');
      // any course, this week's included: the Committee rehearses before members play
      if (s.admin && c) return round(s, { course: c });
      location.hash = '#/';
      return;
    }
    // a classic course, any member, any time: free play for the course record
    if (page === 'classic') {
      const c = classics(s.month).find((x) => x.id === arg);
      if (c) return round(s, { course: c, classic: true });
      location.hash = '#/';
      return;
    }
    // the practice facility, open to every member
    if (page === 'facility') {
      if (arg === 'range' || arg === 'shortgame') return practiceArea(s, arg);
      return facility();
    }
    // any member's practice on the first holes of the next course, before it counts
    if (page === 'practice') {
      const c = nextCourse(s.month);
      if (c && c.id === arg) return practice(s, c);
      location.hash = '#/';
      return;
    }
    // the Locker (the old Member Card and Locker Room links still land there)
    if (page === 'locker' || page === 'card' || page === 'lockers' || (page === 'member' && arg === s.me)) return card(s);
    if (page === 'member' && arg) return member(s, arg);
    if (page === 'admin') {
      if (s.admin) return admin(s);
      location.hash = '#/';
      return;
    }
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

// Any way into a round (Practice round, Practise first, Continue today's card): hold a "heading out" sheet until the
// course is up. A fresh card's Play button opens the note first, which does the same once a choice is made.
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#/round"], a[href^="#/practice/"], a[href^="#/rehearse"], a[href^="#/preview/"]');
  if (!a || a.hasAttribute('data-card-note') || e.defaultPrevented) return;
  holdSheet(/practi|preview/.test(a.getAttribute('href')!) ? 'Opening the practice round' : 'Heading to the first tee', 'Setting out the course. It can take a few seconds.');
});

// "Go to Kellogg": today's card is at another of the member's clubs, so take them there
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-go-club]');
  if (!a || !listSessions().some((x) => x.groupId === a.dataset.goClub)) return;
  e.preventDefault();
  switchClub(a.dataset.goClub!);
  navigate('#/');
});

// The admin's club switcher, in the header: a whole other club, so start again from its home page.
document.addEventListener('change', (e) => {
  const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-club-switch]');
  if (!sel) return;
  switchClub(sel.value);
  // in the Committee Room, stay there: its club tools follow the club you switch to
  navigate(route === 'admin' ? '#/admin' : '#/');
});

// Sound toggle lives in the header on every screen.
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-mute]');
  if (!btn) return;
  setSound(!soundOn());
  document.querySelectorAll('[data-mute]').forEach((b) => (b.outerHTML = muteButton()));
});

// Vercel Analytics: a page view for each screen. Invite and join links carry codes, so only the screen's name goes.
const screen = () => {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  return `/${page || ''}${page === 'facility' && arg ? `/${arg}` : ''}`;
};
inject({ disableAutoTrack: true, beforeSend: (e) => (store.get('ccc-admin') ? null : { ...e, url: location.origin + screen() }) });
const view = () => pageview({ route: screen(), path: screen() });
view();
window.addEventListener('hashchange', view);
window.addEventListener('hashchange', router);
startPolling();
router();
