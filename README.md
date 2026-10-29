# ☾ Solitude

A members-only site for our WoW group: track characters, levels and gear, see what loot is an upgrade for whom, organise runs, and get it all posted to Discord.

**Built with:** Next.js (website) · Supabase (accounts + database) · Vercel (free hosting)

## What it does

| Page | What it does |
|---|---|
| **Dashboard** | Next runs, the levelling race, and an **activity feed** ("Roob hit level 40!", "Bop got [Cruel Barb]") |
| **Roster** | Everyone's characters with class colours and level bars. **Ding! +1** when you level |
| **Availability** | Paint the hours you can play (click and drag). The group grid shows overlap and when you have a tank + healer + 5; best times come with a one-click **Plan a run** |
| **Events** | Plan a run, sign up with a character and role. Linked to a dungeon, it lists the loot the group needs, with an **Award** button |
| **Dungeons** | Every Classic dungeon and raid with **all its loot loaded automatically**: stats, boss, drop chance, **which classes it's best for**, and **who in your group it's an upgrade for** |
| **Boss tactics & tank routes** | On each dungeon: a short strategy per boss with tank / healer / DPS tips, and tank routes drawn on a map (upload a screenshot, click to drop numbered pulls, drag them into place). Linked events show tonight's route and tactics |
| **Character pages** | Gear in every slot (search the real item list), **"Upgrades to look for"** across all dungeons near your level, your Needs, and loot received |
| **Loot** | Who needs what (with **Need too** and **Looted** buttons) and the full **loot history**, with a count per player to keep things fair |
| **Progress** | This week's raid progress boss by boss, dungeon and raid run counts, most active players, recent runs and first kills. **Filled in automatically** by the addon + companion |
| **Discord** | New runs, reminders before a run starts, loot received and level milestones posted to your Discord channel |

Everyone logged in can see everything; you can only change your own characters, gear, availability, sign-ups and Needs. That's enforced by the database, not just the page.

### How "best for" and "upgrade" work

The Classic item list (8,700 items) is in `public/data/classic-items.json`, from the open-source [wow-classic-items](https://github.com/nexus-devs/wow-classic-items) project. `lib/itemScore.js` then:

1. Checks who **can use** an item (armour type and level, weapon skills, class-only items).
2. Scores it for each class with rough stat weights (e.g. Rogues love Agility, Priests love Intellect and Spirit).
3. **Best for** = the classes it scores highest for.
4. **Upgrade** = better than what that character has in the slot (from their character page). Fill your gear in by picking from the search list so the site knows its stats.

It's a rule of thumb for "is this for me?", not a full simulator. WoW: Forever is "reimagined", so loot may differ from the original Classic. Use **Add a missing item** on any dungeon page for new items.

---

## Setup

### 1. Database (Supabase)

1. At [supabase.com](https://supabase.com), create a project (London/EU region).
2. **SQL Editor → New query**: paste and **Run** each file **once**, in order:
   1. `supabase/schema.sql`
   2. `supabase/schema-2-loot.sql`
   3. `supabase/schema-3-auto-loot.sql`
   4. `supabase/schema-4-icons.sql`
   5. `supabase/schema-5-gear-sync.sql`
   6. `supabase/schema-6-progress.sql`
   7. `supabase/schema-7-availability.sql`
   8. `supabase/schema-8-tactics-routes.sql`

   (Open each file, **Ctrl+A**, copy, and paste its *contents* into the editor. `fill-icons.sql` is a one-off fix for icons if items were loaded before icons existed.)
3. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email" (avoids the email rate limit; fine for a friends-only site).
4. **Project Settings → API Keys**: copy the **Project URL** and the **publishable / anon** key.

### 2. Run it locally

You need [Node.js](https://nodejs.org) 20+.

```bash
cd guild-hub
cp .env.local.example .env.local     # paste your URL and key in
npm install
npm run dev
```

Open http://localhost:3000.

### 3. Load the loot list (once)

Log in, open **Dungeons**, and press **Load Classic loot**. It takes about 30 seconds. Anyone can do it, and it only needs doing once.

### 4. Put it online (Vercel)

1. Push the folder to GitHub, then on [vercel.com](https://vercel.com) **Add New → Project** and pick the repo.
2. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Deploy**.
3. In Supabase, **Authentication → URL Configuration**: set **Site URL** to your Vercel address.

### 5. Automatic tracking: addon + companion (recommended)

The **Solitude addon** records boss kills (and who was there), raid lockouts, level and gear while you play. WoW saves that when you log out or `/reload`, and the **Solitude companion** on your PC uploads it. Progress, gear and levels then update with nobody filling anything in.

- Setup guide with downloads: the site's **/companion** page (linked from Progress).
- Only one person per group needs the companion for kills to count for everyone there.
- Characters it sees are added to that person's roster automatically.
- On nights nobody runs it, tick bosses on the event page instead.
- Weekly reset is set to EU (Wednesday 07:00 UTC). For US servers, change `WEEKLY_RESET` in `lib/site.js`.

Files: `addon/Solitude` (the addon), `public/companion/` (companion + Windows helpers, served by the site), `curseforge/` (everything needed to publish the addon on CurseForge; see `curseforge/HOW-TO-PUBLISH.md`).

### 6. Sync gear and level by hand (optional, two other ways)

Each character page has a **Sync from the game** box. Syncing fills in every gear slot (with icons, item level and stats) and the character's level. Anything on that character's Need list that they're now wearing is ticked off and posted to the feed.

**A. In-game addon (works for any game version)**

1. Copy the `addon/Solitude` folder into your WoW AddOns folder, for example:
   `C:\Program Files (x86)\World of Warcraft\_classic_era_\Interface\AddOns\Solitude`
   (the folder name depends on the game version; WoW: Forever's will be its own `_something_` folder).
2. Start the game. On the character select screen, click **AddOns**, make sure **Solitude** is ticked, and if it says "Out of date" tick **Load out of date AddOns**.
3. In game, type **/solitude** (or **/sol**). A box appears with the text already selected: press **Ctrl+C**.
4. On the site, open your character → **Paste from addon** → **Ctrl+V** → **Import gear**.

**B. Battle.net (one click, fully automatic)**

Blizzard's official API. It works today for Classic Era characters. Whether it will cover WoW: Forever isn't known yet; if it does, you only change one setting.

1. Go to [develop.battle.net](https://develop.battle.net/access/clients), log in, **Create Client**. Any name. Redirect URL: your site address. Tick "I do not have a service URL".
2. Copy the **Client ID** and **Client Secret**.
3. In Vercel → your project → **Settings → Environment Variables**, add:
   - `BLIZZARD_CLIENT_ID` = your client ID
   - `BLIZZARD_CLIENT_SECRET` = your client secret
   - `BLIZZARD_REGION` = `eu` (or `us`)
   - `BLIZZARD_NAMESPACE` = `profile-classic1x` for Classic Era. When WoW: Forever launches, change this to its namespace once Blizzard documents it.
   Then **Redeploy**.
4. Make sure the character's **Realm** is filled in (Edit character), then press **⟳ Battle.net**.

Blizzard only updates a character's profile when you **log out** in game, so log out (or switch characters) before syncing.

### 7. Discord notifications (optional)

1. In Discord: **Server Settings → Integrations → Webhooks → New Webhook**, pick the channel, then **Copy Webhook URL**.
2. In Supabase **SQL Editor**, run this (with your two URLs):

   ```sql
   update app_settings set
     discord_webhook_url = 'https://discord.com/api/webhooks/...',
     site_url = 'https://your-site.vercel.app';
   ```

That's it. The webhook URL is stored where the website can't read it, so it stays private.

To turn individual message types off (or change how early the reminder goes out), run any of:

```sql
update app_settings set notify_events = false;      -- new runs planned
update app_settings set notify_reminders = false;   -- "starts in 1 hour" reminders
update app_settings set notify_loot = false;        -- "X got [item]"
update app_settings set notify_levels = false;      -- "X hit level 40!"
update app_settings set reminder_minutes = 30;      -- remind 30 min before instead of 60
```

Level milestones post every 10 levels and at max level. To change that, edit `activity_on_level` in `schema-3-auto-loot.sql`.

---

## Customising

- **Site name and icon**: `lib/site.js`
- **Classes, races, level cap, time slots, gear slots**: `lib/wow.js`
- **New class or race colours**: `app/globals.css` (`--class-…` variables, once for dark and once for light)
- **Stat weights / who items are "for"**: `lib/itemScore.js`
- **Colours and look**: `app/globals.css`

## Ideas for later

- [ ] Change display name after sign-up
- [ ] Invite code so only friends can sign up
- [ ] Recurring raid nights and attendance
- [ ] Professions directory
- [ ] Log in with Battle.net / Discord
- [ ] Auto-sync levels and gear from the Blizzard API (once it supports WoW: Forever)
- [ ] Raid performance from Warcraft Logs

## Project layout

```
app/
  page.js                  Dashboard (runs, levelling race, activity feed)
  login/page.js            Login / sign-up
  roster/page.js           Characters and levels
  availability/page.js     Weekly availability + heatmap
  events/page.js           Event list + create form
  events/[id]/page.js      One event: group by role, sign-ups, loot to award
  dungeons/page.js         Dungeon & raid list (+ Load Classic loot)
  dungeons/[id]/page.js    One dungeon: for your group, loot by boss, Need / Looted
  characters/[id]/page.js  One character: upgrades, gear, Needs, loot received
  loot/page.js             Who needs what
  loot/history/page.js     Loot history
  progress/page.js         Raid progress, run counts, first kills
  companion/page.js        Setup guide for automatic tracking
  api/sync-character/      Battle.net gear sync (runs on the server)
addon/Solitude/            In-game addon: /solitude exports your gear
components/                Shared pieces (Need button, Looted button, item search, feed…)
lib/gearSync.js            Saving synced gear (addon + Battle.net)
lib/itemScore.js           Who can use an item, who it's best for, is it an upgrade
lib/wow.js                 Classes, roles, slots, item quality
lib/site.js                Site name
public/data/classic-items.json  The Classic item list
supabase/schema*.sql       Database (run 1, 2, 3 in order)
```
