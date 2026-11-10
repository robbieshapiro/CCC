// How it's built: a Clubhouse tab for members on how the club is made. The stack as layers (the game, Vercel,
// Supabase, the Claude API), the loop a change goes round (Robbie, Claude Code, GitHub, Vercel), who does what (Robbie,
// Claude Code, Reginald and the scheduled agents), how a course gets made, and what the AI does and doesn't touch.
// All static: nothing here reads the database.

type Layer = { name: string; tools: string; does: string };
const STACK: Layer[] = [
  { name: 'The game', tools: 'Vite · TypeScript · three.js', does: 'Every hole is drawn and played right in your browser, ball physics and all.' },
  { name: 'Hosting', tools: 'Vercel', does: 'Serves the site, plus a few small server functions that talk to Claude.' },
  { name: 'The database', tools: 'Supabase · Postgres', does: 'Rounds, cards, purses, the Season, trophies. Club rules like one card a day live here too.' },
  { name: 'The words', tools: 'Claude API', does: 'Reginald: your daily line, the note on your card, the Chronicle.' },
];

const LOOP: [string, string][] = [
  ['Robbie', 'An idea, or your feedback'],
  ['Claude Code', 'Writes the change, tests it, looks at it in a browser'],
  ['GitHub', 'One pull request. Checks run: the build, every hole, every green'],
  ['Vercel', 'Live a minute or two after it merges'],
];

const WHO: [string, string, string][] = [
  ['Robbie', 'The Committee', 'Has the ideas, plays every new course first, picks each week’s course, reads your feedback, and signs off anything that touches money or live data.'],
  ['Claude Code', 'The builder', 'Writes the code. Every change is one pull request, checked before it merges and looked at in a real browser.'],
  ['Reginald', 'Claude, at the club', 'Writes your daily line, a note on each card, the weekly Chronicle, the Committee’s morning read, and the holes on the Design Desk.'],
  ['The Architect', 'Agent · Sundays', 'Builds a course two weeks out, runs every hole check, and leaves it as a draft for Robbie to play.'],
  ['The Steward', 'Agent · every morning', 'Reads the club (who played, who quit, feedback, errors) and tells Robbie anything worth knowing. Read only.'],
];

const COURSE: [string, string][] = [
  ['The idea', 'A place and a feel: Chicago in the fall, a Highlands links, a volcano. From Robbie, or from you.'],
  ['Drawn in code', 'Each hole is data: tee, fairways, green, water, slopes, trees, buildings. A look kit sets the colours, sky and props.'],
  ['The robot golfer', 'A bot plays every hole with the same physics you do, once perfectly and then hundreds of times swinging like a member. Par has to be reachable, and a typical member should come in near even.'],
  ['Every green, putted', 'From rings all round every pin, at five speeds, hunting for hidden bumps. A course that fails doesn’t ship.'],
  ['Robbie plays it', 'Nothing goes live until he has played it and picked its week.'],
];

const DOES = ['Writes Reginald’s words', 'Writes and checks the code', 'Lays out holes on the Design Desk', 'Reads the club’s numbers for the Committee'];
const DOESNT = ['Decide your score', 'Touch the ball: the physics is fixed code, the same for everyone', 'Move money: purses and bonuses are fixed rules', 'Change anything live without Robbie'];

export function builtPane() {
  return `
    <div class="ch-head"><h1>How it’s built</h1><p class="muted">The club is written by Claude and run by Robbie. Here’s what’s under the turf.</p></div>

    <h2 class="ch-sub">The stack</h2>
    <div class="hb-stack">
      <p class="hb-top">You, on a phone or a laptop</p>
      ${STACK.map((l) => `<div class="hb-layer"><p class="hb-name">${l.name}<small>${l.tools}</small></p><p class="hb-does">${l.does}</p></div>`).join('')}
    </div>

    <h2 class="ch-sub">How a change ships</h2>
    <ol class="hb-loop">${LOOP.map(([n, t]) => `<li><b>${n}</b><span>${t}</span></li>`).join('')}</ol>
    <p class="muted hb-note">A fix you send in is often live the same day.</p>

    <h2 class="ch-sub">Who does what</h2>
    <div class="hb-who">${WHO.map(([n, r, t]) => `<div class="hb-card"><p class="hb-role">${r}</p><b>${n}</b><span>${t}</span></div>`).join('')}</div>

    <h2 class="ch-sub">How a course gets made</h2>
    <ol class="hb-steps">${COURSE.map(([n, t]) => `<li><b>${n}</b><span>${t}</span></li>`).join('')}</ol>

    <h2 class="ch-sub">What the AI does, and doesn’t</h2>
    <div class="hb-split">
      <div><p class="hb-role">Does</p><ul>${DOES.map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div><p class="hb-role">Never</p><ul>${DOESNT.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    </div>
    <p class="muted ch-tip">Got an idea for the club or a course? <a class="link" href="#/clubhouse/feedback">Tell the Committee</a>.</p>`;
}
