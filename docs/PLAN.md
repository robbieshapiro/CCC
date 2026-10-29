# Claude Country Club: where things stand

Last updated Oct 29, 2026 (Caldera challenge from Fri Oct 30, Sunday weeks). Pick up from here.

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
| #81 | A thin early-drop banner on the home page; Reginald's daily line knows October closes early (and refreshes when the schedule changes); the "now open" card waits for the Caldera instead of showing for October. |
| #80 | October closes early and the 3-hole Caldera challenge opens Fri Oct 30; Sunday-to-Saturday weeks from Nov 8; the swing meter's gold is now only the pure strip, with silver for close; a "now open" card greets every member on their first open of a new period. |
| #79 | The Western Reserve, the first weekly course (opens Nov 9): The Covered Bridge (par 4), Sugar Maple (par 3) and The Red Barn (par 5), in a new autumn look with maples, a creek, a covered bridge, a red barn and silo, and corn. |
| #78 | Weekly play: from Nov 9 each week has its own board, champion and countdown. Nov 1 to 8 runs as one short week on the Caldera. |
| #75 | The repo runs itself for agents: `CLAUDE.md` rules, this plan in `docs/`, a warning when a session starts behind main, and a PR template. |

## Setup status

- [ ] **Tonight, before midnight ET (Thu Oct 29):** paste all of `supabase/schema.sql` into the SQL Editor and run it (#80). This closes October, crowns its champions and opens the Caldera challenge at midnight. It replaces the #78 paste.
- [ ] Before Nov 8: play The Western Reserve (Admin → "Preview The Western Reserve (draft)") and tell an agent to take it out of draft, or what to change.
- [x] All SQL run in Supabase (host only, mini golf, Clubs tab, Reginald / Chronicle / Design Desk tables).
- [x] One-time move of Robbie's rounds into Kellogg, and the rename to "Kellogg".
- [x] `ANTHROPIC_API_KEY` in Vercel and redeployed. Confirmed working: a Chronicle edition and a design were written live.
- [ ] Set a monthly spend limit in the Anthropic Console (about $25).
- [ ] Not needed once the Chronicle goes admin only (see below): `CRON_SECRET` only guards the Monday cron, which is being removed.
- [x] GitHub default branch switched to `main`.
- [x] "Automatically delete head branches" turned on in GitHub.
- [x] Stale branches deleted. Only `main` is left.

## To try tomorrow

1. Design a real hole at Clubhouse → Bar → Design a hole. Play it, ask for a change, then send it to the Committee.
2. Approve it in the Committee Room (Admin → Members' holes), then play the Members' Course at the bar.
3. Check Reginald's daily line on the Play page, and his note after a round.
4. Read this week's Chronicle (Clubhouse → Chronicle).

## Decided, not built yet

### Weekly play (live from Fri Oct 30)

The problem with the new members: once your best round is in, there's no reason to come back, and one course for a whole month goes stale. The fix is a new course every week.

- **A week runs Sunday to Saturday** and closes at midnight ET going into Sunday. The best round of the week wins, and the winner goes on the plaque.
- **No monthly title.** Weekly wins are the titles. October closed early, at midnight going into Fri Oct 30 (Marc leads Kellogg and the Open at -6).
- **Courses are 3 holes,** like the Highlands. A round takes about 5 minutes.
- **Stroke play only for now.** Skins (each hole goes to the outright lowest score on it that week) may come later. No handicaps.
- **Gear unlocks count weekly wins** at higher thresholds (something like 1, 3, 5, 10, 20), since there'll be about four titles a month.
- **The Open goes weekly too:** one board across every club for the week's course.
- **If a week's course isn't ready,** the last one carries over. That fallback already works for months.

**Schedule:**
- **Fri Oct 30 to Sat Nov 7: the Caldera challenge,** holes 1 to 3 (par 14). Its back three wait for a later week. Every member's first open of the app lands on a card naming October's champion with the Caldera's Play button (#80).
- **Week of Sun Nov 8:** The Western Reserve, northeast Ohio in October (#79). It's a draft: only Robbie can play it (Admin → upcoming course). Once he approves, an agent removes `draft: true` in `src/golf3d/courses.ts` and it opens Nov 8. If it's still a draft then, the Caldera carries over.
- **From Nov 15:** agent-built courses every week.
- **A tie at the top** will need a sudden-death playoff. To be planned.

**The course pipeline:**
- A scheduled agent runs every Sunday and builds the course for two weeks out, as code like the Highlands and Caldera. `npm run check-holes` must pass. It opens a PR with the course as a draft.
- Robbie plays the admin preview (about 10 minutes) and merges if it's fun.
- Later on, the best members' Design Desk holes could be mixed into a weekly course.

**Build steps (one PR each, in order):**
1. ~~Weeks instead of months.~~ Built in #78. The period still lives in the `month` column (since #80: `2026-10-30` for the Caldera challenge, then each week's Sunday), so no data moves. Boards, the Open, the plaque, the countdown, gear thresholds (now 1, 3, 5, 8, 12, 20 titles), and Reginald's and the Chronicle's prompts all follow it. The Chronicle now gets last week's final standings.
2. ~~The Nov 9 course.~~ The Western Reserve, #79. New kit for later courses: the `autumn` theme (`src/golf3d/autumn.ts`), `maple` trees, `barn` walls, and roofs with a `top` so a high ball sails over a building.
3. The scheduled course agent.

### Step 2 (next PR): October honors, the daily crown, the admin-only Chronicle

- **October honors board:** club champions and the Open champion (automatic once October closes), plus runner-up in each club, most rounds, ace of the month, lowest average (5 rounds or more), and the highest posted score, for honesty. Needs one SQL paste.

### Smaller changes

- **A daily crown for Closest to the Pin.** Yesterday's winner across every club gets a 👑 next to their name on the boards, the Members list and the Daily Shot tile, for one day. The tie-break is the board's own (holed first, then nearest, then the next-best try). Shot #1 (Oct 28) went to Eli G of Boomtown at 18.1 ft.
- **The Chronicle becomes admin only.** Remove the Monday cron (`vercel.json` and the GET in `api/chronicle.ts`) and keep the "Write this week's now" button in the Committee Room. Robbie writes it each Sunday, and it crowns last week's winner and introduces the new course. Change the empty-state line ("goes out on Monday morning"), and key editions by the week's Sunday. A week Robbie skips has no edition.

## Next up (ideas, not started)

- **The Committee.** Robbie appoints elite members and gives titles (Hole Architect, Mini Game Manager). Perks:
  - a premium locker and a badge;
  - a private Committee room with early previews and votes;
  - Design Desk powers, such as fast-tracking holes or editing the Members' Course.
- **Design Desk tuning, once real designs come in:**
  - check the architect's holes play fairly, and adjust the prompt or the quick check;
  - maybe a server-side robot playtest to set par more precisely;
  - maybe let a great member hole be promoted onto a monthly course.
- **More Reginald AI.** Today he writes a daily line on the Play page, a note after each round, and the Chronicle; the Design Desk's architect is Claude too. Ideas:
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
