---
name: live-sql
description: Run SQL against the live Claude Country Club database (Supabase project "CCC") safely. Use whenever a PR's SQL needs applying after merge, a one-off data fix is asked for (remove a round, correct a balance), or you need to read live data to check something. Covers testing on scratch Postgres first, the approval prompt Robbie answers, what to do when it times out, and how to verify.
---

# Live SQL

The live database is Supabase project **CCC**, id `xixfekrwgyknbzttyrtp`. Load the tools with ToolSearch `select:mcp__Supabase__apply_migration,mcp__Supabase__execute_sql`.

## Which tool

| You want to | Use | Approval |
|---|---|---|
| Read anything (check a balance, count rows, confirm a function) | `execute_sql` with a `select` | None. Fine any time. |
| Apply a merged PR's schema changes | `apply_migration`, named after the PR (`pr_252_midway`) | Robbie approves in the app |
| A one-off data fix Robbie asked for | `apply_migration`, named `oneoff_<what>` | Robbie approves in the app |

Writes to live data go through `apply_migration`, so there's a record of them in the migration history. Never drop, delete or rewrite live data unless Robbie asked for that exact change.

## 1. Test first (schema changes)

On scratch Postgres (see CLAUDE.md, "Scratch Postgres"): load the whole `supabase/schema.sql`, seed what the change touches, check the result, then load it again on top to prove it re-runs. Only then apply live, and only after the PR has merged (or Robbie says so).

Apply just that PR's statements, copied from `schema.sql`. Before replacing a big function that other PRs touch (`get_snapshot`, `admin_today`), compare the live body with the repo's previous version:
`select md5(replace(prosrc, E'\r', '')) from pg_proc where proname = '<fn>'` against an md5 of the old body from `git show <prev-sha>:supabase/schema.sql`. If they differ, stop and find out why.

## 2. One-off data fixes

One all-or-nothing `do` block that checks it is touching exactly what you expect and raises (changing nothing) on any surprise:

```sql
do $$
declare n int;
begin
  select count(*) into n from bar_scores where id = 58 and game = 'midway';
  if n <> 1 then raise exception 'Expected one row (id 58); found %. Nothing changed.', n; end if;
  delete from bar_scores where id = 58;
end $$;
```

Look the rows up with a read-only `select` first and name them to Robbie (who, what, when) before you send the change.

## 3. The approval prompt

Every live write opens a prompt in Robbie's Claude app. He has about 60 seconds to approve it.

- Before you send it, say in one line what it changes, so he knows the prompt is coming.
- If it times out ("the server asked the user a question, and no answer came"), nothing ran. Don't loop. Stop the turn and tell Robbie it timed out. Then he can either say "go" with the app open and you send it once more, or paste the SQL into the Supabase SQL editor himself. Give him the exact block.
- Never try to get around the prompt (other tools, other routes). It's the safety check.

## 4. Verify

Right after, a read-only `select` that proves it did what it should: the function exists and answers, the row is gone, the balance reads right. Report the result in plain words. For a PR, tick its box under "Setup status" in `docs/PLAN.md`.

## In a session without the Supabase connector

Put the exact SQL in the PR's "Robbie to do" (or the reply) for him to paste in the SQL editor, and say what to check afterwards.
