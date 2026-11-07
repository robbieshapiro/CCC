---
name: browser-check
description: Check a change in the real app in a headless browser, in local mode (no keys, no live data), with screenshots. Use after any UI, 3D, course or flow change, before saying it works. Covers seeding a club, opening any screen or hole, playing holes out, the engine's dev handle, and the traps (slow 3D renderer, the first-visit redirect).
---

# Browser check

Build passing isn't the same as working. Look at the change in a browser before you report it.

## Run it

1. Start the dev server, once, in the background: `nohup npx vite --port 5179 --strictPort > /tmp/vite.log 2>&1 &`. Check that it's up with `curl -s -o /dev/null -w '%{http_code}' localhost:5179`.
2. Run `node .claude/skills/browser-check/check.cjs <out-dir> '<route>' '<options json>'`. Its header lists the options. Some examples:
   - Home on a phone: `node .claude/skills/browser-check/check.cjs $OUT '#/'`
   - The Committee room's Course tab: `... '#/admin' '{"eval":"document.querySelector(\"[data-tab=course]\").click()"}'`
   - Hole 5 of a course, in landscape: `... '#/preview/westernreserve' '{"w":844,"h":390,"hole":5,"skip":true,"noCart":true}'`
   - A member's card played through: `... '#/rehearse' '{"finish":5,"eval":"document.querySelector(\".summary .fine\")?.textContent"}'`
3. Read the PNG, and say what you saw. For a person to see it, take it at `"dpr":2` and send it.

## Know this

- **Local mode.** The script seeds `ccc-local-db` (a club, Robbie as the admin, plus other members) and `dt-session`, so no Supabase is touched. Seed rounds, shoutouts, cards and so on in the same object when a screen needs them (see `src/api/local.ts` for the shapes).
- **Visit `#/` first.** A new period redirects the first visit to Home, so the script always loads Home, then your route.
- **The engine is `window.__g3` in dev.** Its private fields are reachable from `eval`:
  - `number`, `hole`, `strokes`, `mode`, `onCourse` (the members out on the course), `camera`;
  - `finish([])` ends a hole, and `onStroke(n)` saves a card.
  - To tap something in 3D, project it: `obj.position.clone().project(g.camera)`, then `page.mouse.click`.
- **The 3D is slow here.** It's a software renderer running at a few frames a second. Use long timeouts (screenshots up to 180 s, a hole load up to a minute), and don't judge animation timing or smoothness here. Wall-clock timers run ahead of the game clock.
- **3D lab pages.** For poses and props, a tiny `labN.html` plus `labN.ts` at the repo root (put both in `.git/info/exclude`) can render a Golfer or a prop straight to a canvas, much faster than a round. `window.done = true` when it's drawn.
- **Phones.** Check 390×844, and 375×548 for a short screen with browser bars. Landscape is 844×390. Toolbars aren't emulated, so the play screen's visible-area fit (`--app-h`) can only be checked for overlap, not under real Chrome bars.
