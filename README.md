# Claude Country Club

A private 3D mini golf club for a few friends. Each month the committee opens a new course. Play as many rounds as you like, and your best round counts on the board. When the month closes, the lowest best round wins it and goes up on the Past Champions plaque.

New members get a short tour: up the drive, a word with Reginald on the club rules, the locker room to meet the members and build your golfer, then your tee time. You can retake it from the Member Card.

This month's course is **The Founders' Course** (par 13), a pitch-and-putt with mini-golf greens:

| Hole | Par | What it is | The gamble | Secret route |
|---|---|---|---|---|
| The Azalea | 4 | A downhill dogleg over a creek, with pines and azalea beds | Driver over the pines at the green | The banked cart path through the pines |
| The Island | 4 | An island green in a lake, with a fountain and swans | Driver straight at the island | Putt hard up the stone bridge and fly the gap |
| The Clubhouse | 5 | A croquet lawn, a hedge maze, and a raised green | Iron over the maze | Up the terrace stairs and along the veranda |

## How to play

- **Clubs:** Driver (about 280 ft), Iron (180), Wedge (90) and Putter. The game picks a sensible club for your lie and distance.
  - Sand allows only the wedge.
  - On the green you can putt or wedge.
- **Aim:** drag sideways, or use ◀ ▶ for fine aim.
- **Power:** pull down. The farther you pull, the harder you hit, then let go.
- **Swing meter:** after you let go, a needle sweeps across a bar. Tap when it's in the gold.
  - Early is a hook, and late is a slice.
  - The bigger the club, the smaller the gold zone.
  - Putts skip the meter.
- **Putting:** any putt that crosses the cup drops, at any speed.
- **The beverage cart:** Daisy stops by on holes 2 and 3. Each drink lasts two swings.
  - **Arnold Palmer:** a wider sweet spot.
  - **Clubhouse Lager:** +10% distance, but a twitchier needle.
  - **Sparkling Water:** does nothing, and Reginald approves.
- **Penalties:** water, out of bounds or a ball on the veranda roof costs +1, and you replay from the same spot. You pick up at par + 3.
- **Overview:** shows the whole hole, and the mini-map tracks your ball. Trees and hedges between you and the ball turn see-through.
- **Full rounds only:** a round is all three holes in one go.

**Your golfer:** build them in the welcome tour or on the Member Card.
- Body, hair, facial hair, tops, bottoms, hat, shoes, glove and bag are all open from day one.
- Prestige pieces unlock with monthly titles: tartan plus-fours, a club blazer, a cashmere quarter-zip, a gold putter, a crested bag, and a gold-trim members' blazer.

## Run it locally

```bash
npm install
npm run dev
```

With no Supabase keys set, the app runs in **local mode**: data lives in your browser, and "Add Sean, Danny and PJ" fills the board.

`npm run check-holes` runs the headless hole checks:
- determinism and slope physics
- each secret route
- a solver that plays every hole the normal way and via its secret
- a simulated novice player

## Go live with your friends

1. **Supabase** (free): create a project. Open *SQL Editor → New query*, paste all of `supabase/schema.sql`, and click Run. It's safe to re-run later. Then, in a new query, create the club:
   ```sql
   insert into groups (name, invite_code) values ('Claude Country Club', 'gentlemen');
   ```
2. **Keys:** in *Project Settings → API*, copy the Project URL and the `anon` public key. Don't use the `service_role` key.
3. **Vercel** (free): import this repo (`vercel.json` pins the Vite build). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, then deploy. If you change the variables later, redeploy.
4. Send `https://<your-vercel-url>/#/join/gentlemen` to your friends. Each person picks a name and a 4-digit PIN, then takes the welcome tour.

## Adding next month's course

Add hole files under `src/golf3d/holes/`, then add a course to `COURSES` in `src/golf3d/courses.ts` keyed by month (`'2026-11'`). If a month has no course, the most recent one carries over.

## How it works

- **`src/golf3d/terrain.ts`:** builds each hole as a heightfield from simple pieces (tilts, hills, boxes, ramps, stairs, channels). The same function drives both the 3D mesh and the physics.
- **`src/golf3d/physics.ts`:** deterministic, fixed-step ball physics. It handles:
  - slope pull and surface friction
  - crest launches and chips
  - walls with heights
  - movers and sprinklers
  - cup capture
  - hazards
  - secret-route zones
- **`src/golf3d/scene.ts` and `props.ts`:** the three.js world, built from primitives with no asset files.
- **`src/golf3d/clubs.ts`:** the bag (carry, loft, sweet spot, curve) and the cart's drinks.
- **`src/golf3d/golfer.ts`:** 3D golfers built from primitives with a simple swing rig. It also renders the small portraits used across the app.
- **`src/golf3d/engine.ts`:** handles the camera, flyover, club bar, swing meter, aim guide, shot playback, see-through occluders and HUD.
- **`src/golf3d/cartgirl.ts`:** Daisy and the beverage cart.
- **`src/intro/welcome.ts`:** the new-member tour.
- **`supabase/schema.sql`:** the `rounds` table plus `join_group`, `get_snapshot`, `submit_round` and `save_avatar`. Monthly champions are worked out on read, so there's no scheduled job.
