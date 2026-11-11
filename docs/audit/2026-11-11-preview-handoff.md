# Preview build handoff: fairness fixes, quick wins and the first round

Written Nov 11, 2026 after a full audit of the app. This file is the work order for the next session (built on Opus). Work through it top to bottom.

## Ground rules (Robbie's, don't bend them)

- **Branch:** all work goes on `claude/peaceful-johnson-0y2mo3`. This is a private preview branch.
- **No pull request. No merge to `main`.** Robbie reviews on the Vercel preview link for this branch, as admin, and decides what ships.
- **No SQL, no `supabase/schema.sql` changes, no `api/` changes, nothing applied to the live database.** The preview link talks to the live database, so this round is interface and 3D only. SQL items are listed at the bottom for a later normal PR.
- **Scope is steps 1 and 2 below, nothing else.** Ideas go in "Later", not in the code.
- One commit per numbered item, with a plain message, so Robbie can drop any one of them.
- Words members see: short, warm, plain. No em dashes.
- Line numbers were right at commit `61b22e3`. Re-find the code before editing; earlier items shift later ones.

## Why this round

Live data on Nov 11: 35 people joined in 14 days and 22 never started a round (16 of them finished the welcome tour). About 8 people play a day out of 48. 96% of traffic is iPhone. Nearly all of it is Home and the round. So this round fixes fairness on the card and makes the first tee shot easier to reach and to learn.

## Checks before every push

- `npm run build` (typechecks).
- `npm run check-holes` on all four tour courses, in the background, one after another (items 1.2, 1.3, 2.2 and 2.4 touch the engine, meter or physics path). The results must not change: nothing here should alter ball physics. If a course's numbers move, the change is wrong.
- `npm run check-minigolf` if anything in the putting path changed (2.3).
- The `browser-check` skill for every item, at 390x844. Read the screenshot. Note the headless browser is a slow software renderer: don't judge smoothness there.
- After the push, confirm the Vercel preview deployment for the commit is READY and give Robbie the link.

---

## Step 1: fairness fixes and quick wins

### 1.1 The penalty stroke saves at impact, not when the ball stops

- **Problem:** the stroke is counted and saved when the club hits the ball (`src/golf3d/engine.ts` about 1489, `this.strokes++` then `onStroke`), but a penalty stroke is only added when the ball comes to rest (about 1667). Closing the app mid-flight on a ball heading for water re-tees with one stroke fewer (`src/screens/round.ts` about 282 to 311 resumes from the saved count).
- **Fix:** `simulate()` has already returned the whole result inside `hit()`, penalty included. Call `onStroke` at impact with `strokes + (r.penalty ? 1 : 0)`. Keep the HUD counter ticking at rest as now, so the reveal is unchanged. The save is what matters.
- **Closest to the Pin has the same hole:** the try posts only in `endShot` (engine about 1618, `round.ts` about 616 to 635). Post it at impact from the simulated result. The server needs no change: it is the same `submit_daily` call, sent earlier.
- **Check:** in the browser, start a rehearsal card (`#/rehearse`), hit a ball out of bounds, reload during flight, and confirm the hole resumes with the penalty counted.

### 1.2 The swing meter reads the clock, not the frame

- **Problem:** the needle moves once per frame (`engine.ts` about 2271, `m.x -= m.speed * dt`) and the tap reads the last frame's position (about 1434). The pure strip is about 14 ms wide and a 60 Hz frame is 16.7 ms, so the needle can step over it. A 120 Hz phone gets an easier game. Also `dt` is clamped to 50 ms (about 2239), so a slow phone runs the meter in slow motion.
- **Fix:** record a start time (`performance.now()`) when each phase begins (power fill, then needle). Work out the power and needle position from elapsed real time, both for drawing and at the tap. At `pointerdown`/`pointerup` use the event's `timeStamp` (same clock as `performance.now()`) so the position is exact to the millisecond, not to the frame. The drawn needle each frame is then just a view of that same function.
- **Keep:** every rate and window in `src/golf3d/swing.ts` exactly as it is. Difficulty on a 60 Hz phone should feel the same on average; it just stops depending on luck with frame timing. Drinks or power-ups that change meter speed must still apply.
- **Worth doing here:** pull the meter maths into its own small pure module (position from elapsed time, error from position) so it can be reasoned about. Don't refactor further.
- **Check:** `check-holes` unchanged. In the browser, evaluate the position function at fixed times and confirm it matches the old per-frame result at 60 fps to within one frame's travel.

### 1.3 A swing can be called off

- **Problem:** any tap that moves under 10 px starts the swing (`engine.ts` about 1282 and 1311). There is no way out. An untouched power bar auto-fires at overswing (about 2269) and the needle then auto-fires a full hook (about 2273). A thumb slip is a counted stroke on a locked card.
- **Fix:** if the power bar reaches the top untapped, cancel back to aim (no stroke, no penalty). Add a small "Cancel" control on the meter during the power phase only. Once power is set, the swing is committed, as now.
- **Check:** start a swing, don't tap: you're back at aim with the stroke count unchanged. `check-holes` unchanged (the bot always taps).

### 1.4 The quality drop stops punishing Low Power Mode

- **Problem:** `engine.ts` about 2244 to 2251 drops pixel ratio by 0.5 whenever the average frame is under 48 fps, down to 1.0, and nothing raises it again. iPhones in Low Power Mode cap the browser at 30 fps, so they go blurry in seconds for no gain.
- **Fix:** treat a steady 30 fps as fine. Trigger only below about 26 fps. Before dropping resolution, first turn `shadowMap.type` from `PCFSoftShadowMap` to `PCFShadowMap`, then drop resolution in half steps as now, with a floor of 1.5 on phones whose device ratio is 2 or more. No auto-recover needed.
- **Check:** by code reading and a forced low `frameAvg` in the browser eval.

### 1.5 The ground grain stops reading back the whole canvas

- **Problem:** `src/golf3d/scene.ts` about 138 to 146 calls `getImageData` on a canvas up to 4096 px (about 26 MB), loops every pixel and writes it back. In the headless browser this one call is about 90% of hole build time; on a phone it's a big allocation and a readback per hole.
- **Fix:** build one small noise tile (256 px, seeded the same way so it's stable per hole) and stamp it over the canvas with `createPattern` and a low alpha / suitable blend so the look matches. Compare before and after screenshots of the same tee; the turf should look the same at play distance.
- **Bonus:** this should make every future `browser-check` of a hole much faster. Note the new timing in `CLAUDE.md`'s working notes if it changes meaningfully.

### 1.6 A new page starts at the top

- **Problem:** nothing resets scroll, so tapping a name halfway down Home opens the golfer card halfway down.
- **Fix:** in `router()` in `src/main.ts`, when the hash's page changes, `scrollTo(0, 0)` after the draw. Keep a small map of `scrollY` by hash and restore it on a back navigation (`popstate`), after the awaited draw. Home's own minute refresh must not move the scroll.

### 1.7 Add to Home Screen opens like an app

- **Problem:** `index.html` has an apple-touch-icon but no manifest, so a home-screen icon opens in Safari with browser bars, on a game that fights for vertical space.
- **Fix:** `public/manifest.webmanifest` (`name` "Claude Country Club", `short_name` "CCC", `display: standalone`, `start_url: "/"`, `background_color` and `theme_color` `#163b2c`, the existing icons), a `<link rel="manifest">`, and the Apple tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`). No service worker.
- **Watch:** in standalone mode there's no browser Back button. Check every screen has a way out (the practice facility at `src/screens/practice.ts` about 36 has no header; give it one). Check safe-area insets at the top of the play screen.

### 1.8 Tap targets and the gold label text

- **Tap targets under 44 px** (`src/style.css`): the board's "All clubs / My club" tabs (about line 680), the shoutout "×" (about 1410), the notice dismiss (about 548), the mute button (about 61), `.link` buttons with zero padding (about 71: "See hole by hole", "Sign out", "Clear all"), the shop view pills (about 1317), the club switcher select (about 672; also make its font 16 px so iOS doesn't zoom on focus). Give each `min-height: 44px` through padding, not bigger text. Don't change how they look beyond that.
- **Contrast:** `.eyebrow` gold `#b8955a` at 12 px is about 2.4:1 on cream. Use a darker gold for text on light backgrounds (about `#8a6a3e`, already used ad hoc) and keep the bright gold on dark backgrounds.
- **Check:** screenshots of Home, the Open board, the shop and the Locker at 375 px wide; nothing should wrap or overflow that didn't before.

### 1.9 Small router fixes

- Bounces use `location.hash = '#/'` (`src/main.ts` about 93, 100, 111, 123, 132), so Back returns to the bad URL and bounces again. Use `location.replace('#/')`.
- An unknown hash draws Home but leaves `route` set to the unknown word (about 51 and 135), so Home's live updates never run. Set `route = 'home'` on the fallthrough.
- The error page (about 137) says "open your group's invite link again". Invites are single-use and members sign in with name and PIN. Change it to a "Try again" button (re-runs the router) and a "Sign in again" link to the landing page.
- The "heading out" sheet only covers some ways into 3D (about 150). Widen the selector to `#/daily`, `#/bar/`, `#/classic/` and `#/facility/` with fitting words.

---

## Step 2: the first round

### 2.1 A guided first tee shot

- **Now:** onboarding to the swing is one four-line card shown once per device (`engine.ts` about 976 to 1014), a spin hint on stroke 2 (about 1248) and practice swings offered before the first stroke of hole 1 (about 1222).
- **Build:** for a member who has never posted a round (the snapshot knows; fall back to a `store` flag), the first tee of their first round or practice round walks them through three beats with a short line from Hank each time: drag to aim, tap to set power, tap again at the mark. Use the existing practice swing path so the walkthrough swings **don't count**, and run the meter at about 60% speed for those swings only. Then: "That one's for real." A "Skip" link throughout. Never show it again once they've made a real stroke.
- **Must not:** change the counted swing's meter speed for anyone, or run on a card for a member who has played before.
- **Also:** from the welcome tour's last step and from Home for someone with no rounds, make "Practise first" the obvious first button, with today's card second. A first-timer facing "locks at its first swing, no restarts" is the likeliest place the 22 stopped.

### 2.2 Flight and roll can be hurried

- **Now:** a tap during a shot is ignored (`engine.ts` about 1264 to 1273); a shot can run 24 s (`physics.ts` about 21; engine about 1593). After holing out there's a fixed 2.8 s wait (about 1719 to 1726).
- **Build:** once the ball has first landed, a tap (or hold) plays the rest at 3x. A tap during the post-hole wait cuts it short. A small "Tap to speed up" hint the first couple of times. The ace replay and reaction keep their existing tap-to-skip.
- **Must not:** change the result. Playback is presentation only; the simulated path is already fixed.

### 2.3 A pace mark on the putting bar

- **Now:** on tour greens the putt line has zero length (`engine.ts` about 2086 to 2088), the read gives degrees only (about 2036 to 2065), and distance grows with the square of the drag with only an unlabelled bar as feedback (about 1285 to 1287, 2136 to 2139).
- **Build:** a small tick on the power bar at "this much rolls to the hole on a flat green", worked out from the distance to the cup and the green's friction (`TOUR_GREEN`). It ignores slope on purpose: reading the break stays the skill. Label it once ("flat pace"). Also show the roll distance in feet beside the bar while dragging.
- **Robbie decides:** this makes putting easier for everyone. Build it behind a single constant so it can be limited to practice rounds, or to a member's first few rounds, if he'd rather.

### 2.4 The golfer holds the finish and watches the ball

- **Now:** the swing ends with `this.state = { pose: 'address' }` (`src/golf3d/golfer.ts` about 1479 to 1481), so the golfer snaps back to address while the ball is in the air.
- **Build:** hold the follow-through pose until the ball stops (or the next aim starts), with the head turned to follow the ball's direction. Ease back to address over about 0.4 s. On a putt, hold the putter through and look up along the line.
- **Also, small:** the Locker opens with the golfer in side profile facing away (`src/screens/locker.ts`). Start the turntable facing three-quarters toward the camera.

### 2.5 Sound within reach, and a clearer tee

- The sound toggle lives in the page header, which the play screen hides, and sound is off by default (`src/fx/sound.ts` about 8). Add the toggle to the in-round "?" card. Leave the default off.
- At the tee, Hank's speech bubble sits over the golfer and ball, and other members' name tags sit over the fairway. Move the bubble clear of the golfer (above the club bar, to one side) and fade it after about 4 seconds or on first touch. Don't change the tags' behaviour, only make sure they don't cover the aim line's first 100 yards.

---

## When it's built

Give Robbie:
1. The Vercel preview link for the branch, and a reminder that it uses the live database (so his own card there is a real card).
2. A short list of what to try on his phone, in order: Add to Home Screen, a practice round's first tee as a new member would see it (Admin > Tools > "Preview a new member's welcome"), a mis-tap and cancel, a putt with the pace mark, a ball in the water then closing the app mid-flight.
3. Anything that couldn't be checked in the headless browser (smoothness, the meter's feel at 120 Hz, Low Power Mode).

Do not update the "Shipped" table in `docs/PLAN.md`: nothing has shipped. Add one line under "Handoff" pointing at this file and the branch.

---

## Later (not this round)

Held for Robbie's say-so. Each would be its own normal PR.

**Speed (step 3):** split the 1.2 MB bundle with dynamic imports (round, welcome, admin, design, fitting, locker); draw each screen from the cached snapshot and refresh behind it; stop Home rebuilding itself every minute (patch sections, share the duplicate `openBoard`/`openChampions` calls, pause polling when hidden or in a round); shadows rendered once per hole (`shadowMap.autoUpdate = false`) with a blob shadow under the golfer and ball; merge each golfer to about 10 draw calls and make the stands' patrons one static mesh; compute the terrain height grid once and reuse it; stop disposing shared materials between holes; keep avatar headshots between sessions; pause the engine behind full-screen sheets.

**Home and naming (step 4):** Home down to play, who's out, the board, other games; games exit to where they were launched from; a Midway tile on Home; one word per thing (Practice, card, Locker, Admin vs Committee Room); Clubhouse tabs switch in place with a visible "more" edge; How to play linked from Home for new members; a confirm on Back or edge-swipe mid-round; retry buttons where a save fails.

**Server (step 5, needs SQL, tested on scratch first):**
- `submit_round`: rebuild each shot from typed, clamped fields so one malformed row can't break `person_bonus`, `get_snapshot` or `season_standings`; make those readers tolerant too.
- A server table of courses and pars; ignore client pars; require the posted scores to extend the saved card progress; a minimum time per hole; paid long putts and chip-ins capped at one a hole; an ace paid only when par and feat agree; only that course's secrets accepted.
- Advisory locks on the money and card functions (`buy_item`, `buy_powerup`, `send_curse`, `pick_pocket`, `start_round`, `submit_round`, `submit_daily`).
- Idempotent `submit_round` (the card's id), with a client retry.
- Indexes: `rounds(player_id)`, `rounds(month)`, `rounds(course, created_at)`, `players(lower(name), pin_hash)`, `daily_shots(day)`, `round_starts(player_id, started_at)`, `powerups(target_id, status)`.
- Validate `save_avatar` (keys, hex colours, size, owned items) and escape colours in `avatarSvg`.
- Delete the unused `api/ask.ts` and `api/insights.ts`.
- Before 100 members: a week-close ledger for payouts, points and champions, so history stops being recalculated on every read; a real person id in place of name plus PIN; SQL tests for the money rules; the Season's year-end.

**Avatars (step 6):** hips leading the downswing, weight shift, wrist lag, a spring ease on reactions, a waggle at address, blinks; two or three head shapes and a mouth that changes; the bigger step is one skinned mesh per golfer with keyframed clips.
