# Claude Country Club: notes for agents

A private online golf club for friends: a 3D course each month, a daily Closest to the Pin, bar games, and Reginald (the club secretary, written by Claude). Vite + TypeScript + three.js on Vercel, Supabase for data. Robbie owns it. He is technical but not a developer, so explain anything he has to do in plain steps.

## Start here

1. Read `docs/PLAN.md`. It says what's shipped, what Robbie still has to set up, and what's next.
2. Work from the latest `main`. If your branch is behind `origin/main`, merge main in before you start. The session-start hook warns you when it is.
3. Keep to what was asked. Ideas go in the plan's "Next up", not into the PR.

## Before you push

The Checks workflow runs all of this on every PR and has to pass before merging. Run them yourself first anyway.

- `npm run build` always (it typechecks).
- `npm run check-api` if you touched `api/`.
- `npm run check-holes` if you touched holes, terrain, physics or clubs. Its `greens` sweep (in `quick` and `all`) putts every green from all round every pin; never ship a course that fails it.
- `npm run check-minigolf` if you touched mini golf or the putting bot.
- `npm run check-roller` if you touched High Roller (`src/roller/`). It takes seconds: a robot clears every stage along its `path`. A new stage needs a `path`, and a new stage count needs `roller_stages()` in `schema.sql` raised to match.

## Working notes (things agents keep relearning)

- **Look before you report.** For any UI, 3D, course or flow change, use the `browser-check` skill (`.claude/skills/browser-check/`) and read the screenshot.
- **check-holes is slow.** `quick` takes about 1 to 7 minutes a course, and `member` 10 or more. Run them in the background (one course after another, not in parallel), and carry on meanwhile. A change to clubs, the meter or physics touches every course, so check all four.
- **Merging.** Merge only after the `checks` run is green. Poll it with `gh api repos/robbieshapiro/ccc/commits/<sha>/check-runs --jq '.check_runs[]|select(.name=="checks")|.conclusion'`, then merge (squash) with `expectedHeadSha` set to that SHA. Reuse the session branch after each merge: `git fetch origin main && git checkout -B <branch> origin/main`. Merged branches are deleted automatically. This session can't delete other branches on GitHub (the safety check blocks it), so ask Robbie if one needs to go.
- **Scratch Postgres** (for testing SQL) runs as the `postgres` user, not root:
  - start it with `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pg/data -o '-p 5433 -k /var/tmp/pg' -l /var/tmp/pg/log start"`;
  - connect with `PGOPTIONS='-c search_path=public,extensions' psql -h /var/tmp/pg -p 5433`;
  - pipe files in with `cat file | su postgres -c "psql ..."`, because the postgres user can't read the scratchpad.
- **Live SQL: use the `live-sql` skill** (`.claude/skills/live-sql/`) for anything touching the live database: applying a PR's SQL, one-off data fixes, and reading live data. Writes need Robbie's approval in the app within about 60 seconds; if the prompt times out, nothing ran: stop, tell him, and either resend once when he says go or give him the SQL to paste.
- **The Architect can review a PR.** Fire its scheduled task (`fire_trigger`) with extra text saying "review, don't build", naming the PR and the checks to run. It posts one comment on the PR, and takes 30 to 60 minutes.

## Conventions

- One feature per PR, merged as a squash. Titles are a plain sentence about what members get: "Hollow Hills: haunted mini golf replaces the putting contest".
- Data access goes through the `Api` interface in `src/api/types.ts`. Add a method to both `src/api/supabase.ts` and `src/api/local.ts` so local mode keeps working with no keys.
- All SQL lives in `supabase/schema.sql` and must be safe to re-run (`create table if not exists`, `create or replace function`, `add column if not exists`). See "Applying SQL" below for how it reaches the live database.
- AI calls are server-side only, in `api/*.ts`, each with a per-member daily cap. Keep a cap on anything new and note the expected cost in the plan.
- New weekly courses: hole files in `src/golf3d/holes/`, then an entry in `COURSES` in `src/golf3d/courses.ts` with `opens` set to its Sunday (`'2026-11-15'`) and a `playoff` (the hole a tie is played off on, and a fairway spot for the shot at the pin). Weeks run Sunday to Saturday. Robbie can override any future week from Admin > Course > "The weeks ahead" (`course_schedule`, read by `courseFor`); a pick wins over `opens`, and an unpicked week carries on with the latest course.
- Hole Lab: a test hole in a new look is a one-hole `Course` with `lab: true` (never on the calendar; only the admin plays it, from Admin > Course).
- The game period lives in a field still called `month` (rounds, the snapshot, champions): `'YYYY-MM'` for the old months, `'2026-10-30'` for the Caldera challenge (Oct 30 to Nov 7), then the week's Sunday `'YYYY-MM-DD'` from Nov 8 2026. Use the helpers in `src/day.ts` (`periodOf`, `periodClosesAt`, `periodName`, `span`), never slice a date to get a month.
- Words members see: short, warm, plain. No em dashes.

## Applying SQL (since Nov 4, 2026)

The `live-sql` skill has the full steps; the short version:

Claude applies database changes itself through the Supabase connector (project "CCC", id `xixfekrwgyknbzttyrtp`); Robbie approves each live run in the tool's prompt. Robbie no longer pastes SQL.

1. Test first, every time: start a scratch Postgres (`/usr/lib/postgresql/16/bin`; create the `anon` and `authenticated` roles), load the whole `supabase/schema.sql`, seed what the change touches, and check the result. Then load it again on top to prove it re-runs.
2. Apply to live only after the PR merges (or when Robbie says): just that PR's statements, as copied from `schema.sql`, with `apply_migration` named after the PR (e.g. `pr_118_purse`).
3. Verify right after with a read-only `select` (the function is there and says what it should; the rows look right), and tick the box in the plan.
4. One-off data changes (like the Boomtown merge) are a single all-or-nothing `do` block that checks what it's about to touch and stops, changing nothing, on any surprise. They go in the PR description, not `schema.sql`.
5. Read-only queries are fine any time to check something. Never drop, delete or rewrite live data unless Robbie asked for that change.
6. In a session without the Supabase connector, fall back to the old way: put the exact SQL in the PR's "Robbie to do" for him to paste.

## Keep the plan current (part of every PR)

In the same PR as the change:
- add the shipped item to the "Shipped" table in `docs/PLAN.md` (use the PR number once you know it);
- add anything still to do outside the code (SQL to apply, env vars, a setting to flip) as an unchecked box under "Setup status", and tick it once done and checked;
- move an idea out of "Next up" if you built it;
- update "Last updated".

When a milestone wraps up and the plan gets rewritten, first copy the old one to `docs/plans/YYYY-MM-DD.md` with a one-line title.

## In the PR description

End with a "Robbie to do" list: settings to change, or "Nothing". For SQL, say what will be applied (and when) under "Applying SQL".
