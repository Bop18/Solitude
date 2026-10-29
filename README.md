# ☾ Solitude

A members-only site for our WoW group: track characters and levels, mark when you're free, and organise dungeon/raid runs with sign-ups.

**Built with:** Next.js (website) · Supabase (accounts + database) · Vercel (free hosting)

## What's in version 1

| Page | What it does |
|---|---|
| **Login** | Members create an account with email + password |
| **Dashboard** | Next 5 runs and a "levelling race" leaderboard of everyone's main |
| **Roster** | Every member's characters with class colours and level bars. Add your own characters, hit **Ding! +1** when you level |
| **Availability** | Tick when you can play each week; the group heatmap shows the best overlap |
| **Events** | Plan a dungeon or raid, sign up with a character and role (tank/healer/DPS), see the group fill up. Link it to a dungeon to see what loot the group needs |
| **Dungeons** | Every dungeon and raid with level ranges ("Your level" badge shows what fits you). Open one to see its loot by boss, filter by class, and hit **Want** |
| **Character pages** | Click any character: their gear in every slot and their wishlist. Equipping a wishlisted item ticks it off automatically |
| **Loot needs** | Everything anyone still wants, grouped by dungeon, so you can pick which run helps the most people |

Everyone logged in can see everything; you can only edit your own characters, availability and sign-ups (enforced by the database, not just the page).

---

## Setup (about 15 minutes)

### 1. Create the database (Supabase)

1. Go to [supabase.com](https://supabase.com), sign up and click **New project**. Pick a London/EU region. Save the database password somewhere.
2. When it's ready, open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**. You should see "Success".
   Then do the same with `supabase/schema-2-loot.sql` (dungeons, items, gear, wishlists). Run each file **once** only.
3. **Authentication → Sign In / Providers → Email**: for a friends-only site the easiest option is to turn **off** "Confirm email", so people can log in straight after signing up. (Leave it on if you prefer, it works either way.)
4. **Project Settings → API** (or the **Connect** button): copy the **Project URL** and the **anon / publishable key**.

### 2. Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd guild-hub
cp .env.local.example .env.local     # then paste your URL and key into .env.local
npm install
npm run dev
```

Open http://localhost:3000, create your account, add a character.

### 3. Put it online (Vercel)

1. Push the `guild-hub` folder to a new GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, **Add New → Project**, pick the repo.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the same values as your `.env.local`. Click **Deploy**.
4. Back in Supabase, **Authentication → URL Configuration**: set **Site URL** to your Vercel address (e.g. `https://guild-hub.vercel.app`) so confirmation emails link to the right place.

Send your friends the link and they can make accounts.

---

## Customising

- **Site name and icon**: `lib/site.js`. One place, used everywhere.
- **Dungeon list**: edit on the Dungeons page (or in Supabase → Table Editor → dungeons). The starter list is the original Classic one.
- **Classes, races, level cap, time slots, gear slots**: all in `lib/wow.js`. If WoW: Forever changes classes or the level cap, edit them there.
- **Colours and look**: `app/globals.css` (the variables at the top).

## Roadmap

- [x] Loot wishlists: each member lists items they want from each dungeon/raid
- [x] Dungeon loot guide: notable drops per dungeon and which classes want them
- [ ] Change display name after sign-up
- [ ] Log in with Battle.net / Discord
- [ ] Auto-sync levels and gear from the Blizzard API (once it supports WoW: Forever)
- [ ] Raid performance from Warcraft Logs
- [ ] Invite code so only friends can sign up

## Project layout

```
app/
  page.js                 Dashboard
  login/page.js           Login / sign-up
  roster/page.js          Characters and levels
  availability/page.js    Weekly availability + group heatmap
  events/page.js          Event list + create form
  events/[id]/page.js     One event: group by role, sign up, loot needed
  dungeons/page.js        Dungeon & raid list
  dungeons/[id]/page.js   One dungeon: loot by boss, class filter, Want button, add items
  characters/[id]/page.js One character: gear slots + wishlist
  loot/page.js            Who needs what, grouped by dungeon
components/               Shared pieces (nav/login guard, level bar, event card, item name)
lib/site.js               Site name
lib/supabase.js           Database connection
lib/wow.js                Classes, roles, gear slots, item quality etc.
supabase/schema.sql       Database tables and security rules (run first)
supabase/schema-2-loot.sql  Loot update (run second)
```
