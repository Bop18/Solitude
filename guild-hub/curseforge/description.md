# Solitude

**Keep your group's Solitude website up to date automatically.**

Solitude is the in-game half of a private website for your guild or friend group. While you play, it quietly notes down:

- **Boss kills**: which boss, where, when, and who was in the group
- **Raid lockouts**: which bosses you've killed this week
- **Your level and equipped gear**

Your group's site then shows this week's raid progress, dungeon and raid run counts, first kills, and everyone's gear and upgrades, with nobody filling anything in.

## How it gets to the website

Addons can't use the internet, so Solitude saves everything to its normal save file (written when you log out or `/reload`). The free **Solitude companion** on your PC uploads it. Your group's website has a setup page with the download and a 5-minute guide.

Only one person per group needs the companion for kills to count for everyone there.

## Commands

- `/solitude` copies your gear and level, to paste on the site by hand (no companion needed)
- `/solitude status` shows what's been recorded

## Privacy

Solitude only records your own character and the names of people in your group when a boss dies. It never sends anything anywhere by itself. It's two small, readable Lua files.
