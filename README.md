# ☾ Solitude

A members-only site for our WoW group: track characters, levels and gear, see what loot is an upgrade for whom, organise runs, and get it all posted to Discord.

**Built with:** Next.js (website) · Supabase (accounts + database) · Vercel (free hosting)

## What it does

| Page | What it does |
|---|---|
| **Dashboard** | Next runs, the levelling race, and an **activity feed** ("Roob hit level 40!", "Bop got [Cruel Barb]") |
| **Roster** | Everyone's characters with class colours and level bars. **Ding! +1** when you level |
| **Availability** | Tick when you can play; the heatmap shows the best overlap |
| **Events** | Plan a run, sign up with a character and role. Linked to a dungeon, it lists the loot the group needs, with an **Award** button |
| **Dungeons** | Every Classic dungeon and raid with **all its loot loaded automatically**: stats, boss, drop chance, **which classes it's best for**, and **who in your group it's an upgrade for** |
| **Character pages** | Gear in every slot (search the real item list), **"Upgrades to look for"** across all dungeons near your level, your Needs, and loot received |
| **Loot** | Who needs what (with **Need too** and **Looted** buttons) and the full **loot history**, with a count per player to keep things fair |
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

### 5. Discord notifications (optional)

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
components/                Shared pieces (Need button, Looted button, item search, feed…)
lib/itemScore.js           Who can use an item, who it's best for, is it an upgrade
lib/wow.js                 Classes, roles, slots, item quality
lib/site.js                Site name
public/data/classic-items.json  The Classic item list
supabase/schema*.sql       Database (run 1, 2, 3 in order)
```
