---
name: course-checks
description: Which course checks a change needs (npm run check-holes and its modes), how to run them without wasting time, and what CI does on its own. Use before pushing anything under src/golf3d/, scripts/check-holes.ts, the Daily Shot (src/dailyholes.ts), a course's holes or pars, physics, clubs or wind; and to decide when NOT to run the slow checks (colours, scenery, copy).
---

# Course checks

`npm run check-holes` is the club's course test: it plays every hole with a robot. It catches holes that can't be finished, wet tees, greens a putt won't hold, secrets that don't work, pars that don't match the server, and courses that play too hard or too easy. It is also slow, so run the smallest check that covers the change, in the background, one at a time.

## Is a course check needed? (guard rails)

Run the slow checks only when the change can alter **how a hole plays**:

| Change | Check |
|---|---|
| A hole file (`src/golf3d/holes/**`): terrain, regions, water, walls, posts, pins, tee, cup, par, bounds, wind flags | `quick` for that course, then `member` if difficulty could move |
| `physics.ts`, `clubs.ts`, `terrain.ts`, the swing meter or power in `engine.ts` | `quick` for **every** course (all four live ones), one after another |
| `conditions.ts` (wind, gusts, weather) | `quick` and `member` for the courses it touches |
| `courses.ts`: holes list, `opens`, `playoff`, pars | `quick` for that course; update `course_pars` in `schema.sql` if pars changed (the check fails until you do) |
| The Daily Shot holes (`src/dailyholes.ts`, its STEPS or worlds) | `npm run check-holes -- daily` (see below) |
| Mini golf, the putting bot | `npm run check-minigolf`, not check-holes |

**No slow check** (the fast `basic` is enough, about a second) for:

- a course's colours, icon or pattern (its `look:` line in `courses.ts`);
- scenery only: `src/golf3d/looks/**` (kits, decor, cottages, sheep, sky, light), props that aren't in play;
- `decor` entries in a hole file. A decor item is scenery; a `post`, `wall` or `region` is not;
- copy: blurbs, tee tips, names, comments;
- anything outside `src/golf3d/` and `scripts/check-holes.ts` (screens, CSS, SQL, the API).

`basic` still checks that each week's look differs from the week before and that pars match `course_pars`: `npm run check-holes -- basic -`.

When unsure whether something is scenery or play: if a ball can touch it, collide with it, roll on it or be scored by it, it's play.

## What CI does by itself

The Checks workflow (`.github/workflows/checks.yml`) decides from the diff:

- It runs `check-holes -- quick` when anything under `src/golf3d/` or `scripts/check-holes.ts` changed. The exceptions are `src/golf3d/looks/**`, and `courses.ts` lines that are only `look:` or comments.
- Otherwise, if `src/golf3d/` changed, it runs only the fast `check-holes -- basic -`.
- CI's `quick` has no `COURSE` set, so it plays the default course. **Don't rely on CI for the course you changed: run `quick` for it yourself** before pushing.
- A slow CI run can take most of an hour, and the PR can't merge until it's green (auto-merge is off). If Robbie is waiting, say so and set a `send_later` check-in to merge it when green, rather than polling.

## Modes and how to run them

Always pick the course with `COURSE=<id>` (e.g. `atlanticlinks`, `windycity`, `pacificbluffs`). A hole id after the mode narrows it to one hole.

| Mode | What it does | Time |
|---|---|---|
| `basic -` | determinism, the calendar, looks, pars | ~1 s |
| `quick` | basic + solver + novice + greens sweep for every hole, in parallel processes | 1 to 7 min a course |
| `quick <hole>` | the same for one hole | 1 to 3 min |
| `greens <hole>` | putts every green from all round every pin | part of quick |
| `member <hole>` | plays a hole at members' skill; prints `MEMBER ... to-par` | ~10 min a hole at the default 12 seeds; use `SEEDS=4` (~3 to 5 min) |
| `rate` | the CCC Rating and Slope line for `src/golf3d/ratings.ts` (`QUICK=1` for speed) | long |
| `daily` | the Daily Shot: Desk checks, greens, and a shot sim. `DAYS`, `SHOTS`, `FROM`, `NO_SIM=1`, `NO_GREENS=1` | 5 to 30 min |

Run them like this:

```bash
COURSE=atlanticlinks nohup npm run check-holes -- quick > /tmp/<scratch>/quick.txt 2>&1 &
# then, after it finishes, members' difficulty, one hole at a time, fewer seeds:
for h in sheepwalk punchbowl; do COURSE=atlanticlinks SEEDS=4 npm run check-holes -- member $h | grep MEMBER; done
```

- **Background, sequential.** Never run two course checks at once; they fight for the CPU and both crawl. Carry on with other work meanwhile.
- **Read only the summary.** `grep -E "FAIL|avg|MEMBER|done in"` on the output file.
- **Member target:** +1.2 to +1.8 a hole over par on the CCC Rating (the Caldera and the Windy City). Update `ratings.ts` with what you measured, and note any hole you didn't re-run.
- **When time is short** (Robbie waiting, a release at midnight): `quick` for the course you changed is the must; `member` can be 4 seeds, or left for the Greenkeeper's Thursday tune if you say so plainly in the PR.

## Before you push (course changes)

1. `npm run build`.
2. `COURSE=<id> npm run check-holes -- quick`. No FAIL lines, and the greens sweep passes ("putts roll true").
3. If difficulty could move: `member` (SEEDS=4) for the holes you touched; update `ratings.ts`.
4. If pars changed: `course_pars` in `schema.sql`, and apply it live after merge (the `live-sql` skill).
5. Look at it: the `browser-check` skill, `#/preview/<course id>`.
