# Claude Country Club: where things stand

Last updated Oct 29, 2026. Pick up from here.

## Shipped (all live on Vercel)

| PR | What |
|---|---|
| #66 | One home club: Robbie belongs to Kellogg and runs Clergy and Boomtown as host only. The Member Card and Locker Room merged into one Locker page. |
| #67 | The Clubhouse: Bar, Members, Clubs, How to play, Feedback. A bottom tab bar on phones. |
| #68 | Hollow Hills haunted mini golf replaced the putting contest at the bar. The preview tile is now a plain tile. |
| #69 | iPad layouts for every page. |
| #70 | Reginald written by Claude: a daily line on the Play page and a note on the card after each round. |
| #71 | The Clubhouse Chronicle: Reginald's weekly letter, written every Monday by a Vercel cron at 12:17 UTC. |
| #72, #73 | Design a Hole: members describe a real golf hole and Claude lays it out in one of four looks (Highlands, Caldera, links, desert). A quick check runs, they play it, and approved holes join the Members' Course at the bar. |
| #75 | The repo runs itself for agents: `CLAUDE.md` rules, this plan in `docs/`, a warning when a session starts behind main, and a PR template. |

## Setup status

- [x] All SQL run in Supabase (host only, mini golf, Clubs tab, Reginald / Chronicle / Design Desk tables).
- [x] One-time move of Robbie's rounds into Kellogg, and the rename to "Kellogg".
- [x] `ANTHROPIC_API_KEY` in Vercel and redeployed. Confirmed working: a Chronicle edition and a design were written live.
- [ ] Set a monthly spend limit in the Anthropic Console (about $25).
- [ ] Optional: add `CRON_SECRET` in Vercel so only the cron can trigger the Monday Chronicle.
- [x] GitHub default branch switched to `main`.
- [x] "Automatically delete head branches" turned on in GitHub.
- [ ] Delete the stale branches: `claude/multiplayer-web-game-brainstorm-8a7dxm` (after the default switch), `claude/practical-brown-qpytm6`, `claude/sharp-franklin-hbr1mc`.

## To try tomorrow

1. Design a real hole at Clubhouse → Bar → Design a hole. Play it, ask for a change, then send it to the Committee.
2. Approve it in the Committee Room (Admin → Members' holes), then play the Members' Course at the bar.
3. Check Reginald's daily line on the Play page, and his note after a round.
4. Read this week's Chronicle (Clubhouse → Chronicle).

## Next up (ideas, not started)

- **The Committee.** Robbie appoints elite members and gives titles (Hole Architect, Mini Game Manager). Perks:
  - a premium locker and a badge;
  - a private Committee room with early previews and votes;
  - Design Desk powers, such as fast-tracking holes or editing the Members' Course.
- **Design Desk tuning, once real designs come in:**
  - check the architect's holes play fairly, and adjust the prompt or the quick check;
  - maybe a server-side robot playtest to set par more precisely;
  - maybe let a great member hole be promoted onto a monthly course.
- **More Reginald AI:**
  - "Ask Reginald", a chat box in the Clubhouse that can look up boards, rules and history;
  - AI lines for the other staff (Hank, Mo, the cart crew).
- **Polish:**
  - an unread dot on the Clubhouse tab when a new Chronicle is out;
  - a Members' Course board on the Play page.

## Costs to watch

Everything runs on Claude Opus 5.5, server-side, with caps:
- 1 daily line per member;
- 12 round notes per member per day;
- 8 designs per member per day.

Expect roughly $15–35 a month for a club of about 20 active members. The Anthropic Console spend limit is the hard ceiling.

## Where things live

- **AI functions:** `api/reginald.ts`, `api/chronicle.ts`, `api/design.ts`.
- **Hole designer:**
  - `src/designer/hole.ts`: the spec, builder and quick check;
  - `src/designer/samples.ts`: four sample holes;
  - `src/screens/design.ts`: the Desk UI.
- **New looks:** `src/golf3d/lands.ts` (links and desert). Sky per look is in `src/golf3d/engine.ts`, in `setLook`.
- **Mini golf:**
  - `src/golf3d/minigolf.ts` and `src/golf3d/haunted.ts`;
  - the putting bot is `src/golf3d/putbot.ts`;
  - `npm run check-minigolf`.
- **Database:** everything is in `supabase/schema.sql`, which is safe to re-run. Robbie runs SQL himself.
- **For agents:** `CLAUDE.md` has the working rules. This plan lives at `docs/PLAN.md`, and old plans are kept in `docs/plans/`.
