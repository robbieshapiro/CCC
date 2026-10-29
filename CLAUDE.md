# Claude Country Club: notes for agents

A private online golf club for friends: a 3D course each month, a daily Closest to the Pin, bar games, and Reginald (the club secretary, written by Claude). Vite + TypeScript + three.js on Vercel, Supabase for data. Robbie owns it. He is technical but not a developer, so explain anything he has to do in plain steps.

## Start here

1. Read `docs/PLAN.md`. It says what's shipped, what Robbie still has to set up, and what's next.
2. Work from the latest `main`. If your branch is behind `origin/main`, merge main in before you start. The session-start hook warns you when it is.
3. Keep to what was asked. Ideas go in the plan's "Next up", not into the PR.

## Before you push

- `npm run build` always (it typechecks).
- `npm run check-api` if you touched `api/`.
- `npm run check-holes` if you touched holes, terrain, physics or clubs.
- `npm run check-minigolf` if you touched mini golf or the putting bot.

## Conventions

- One feature per PR, merged as a squash. Titles are a plain sentence about what members get: "Hollow Hills: haunted mini golf replaces the putting contest".
- Data access goes through the `Api` interface in `src/api/types.ts`. Add a method to both `src/api/supabase.ts` and `src/api/local.ts` so local mode keeps working with no keys.
- All SQL lives in `supabase/schema.sql` and must be safe to re-run (`create table if not exists`, `create or replace function`, `add column if not exists`). Never run SQL against the live database. Robbie pastes it in himself.
- AI calls are server-side only, in `api/*.ts`, each with a per-member daily cap. Keep a cap on anything new and note the expected cost in the plan.
- New monthly courses: hole files in `src/golf3d/holes/`, then an entry in `COURSES` in `src/golf3d/courses.ts` keyed by month.
- Words members see: short, warm, plain. No em dashes.

## Keep the plan current (part of every PR)

In the same PR as the change:
- add the shipped item to the "Shipped" table in `docs/PLAN.md` (use the PR number once you know it);
- add anything Robbie must do (SQL to paste, env vars, a setting to flip) as an unchecked box under "Setup status";
- move an idea out of "Next up" if you built it;
- update "Last updated".

When a milestone wraps up and the plan gets rewritten, first copy the old one to `docs/plans/YYYY-MM-DD.md` with a one-line title.

## In the PR description

End with a "Robbie to do" list: the exact SQL to paste or settings to change, or "Nothing".
