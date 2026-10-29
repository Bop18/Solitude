# Publishing Solitude on CurseForge

1. Go to https://authors.curseforge.com and sign in (or make an account).
2. **Create Project** → Game: **World of Warcraft** → Class: **Addons**.
3. Name: something unique, e.g. **Solitude Guild Tracker** (the in-game name stays "Solitude").
   Summary: "Tracks boss kills, raid lockouts, level and gear for your group's Solitude website."
   Category: Raid (and/or Guild). Licence: MIT.
4. Avatar: upload `icon.png` from this folder.
5. Description: paste the contents of `description.md`.
6. **Upload File** → choose `Solitude-2.0.1.zip` from this folder.
   - Release type: Release
   - Game versions: tick the Classic versions your group plays (and WoW: Forever when it's listed)
   - Changelog: paste the 2.0.0 section from `CHANGELOG.md`
7. Submit. CurseForge reviews new projects, usually within a day. After that, anyone can find it by searching in the CurseForge app.

## Releasing an update

1. Bump `## Version:` in `addon/Solitude/Solitude.toc`.
2. Zip the `Solitude` folder (the zip must contain the `Solitude` folder itself, not just the files inside it).
3. On your project page: **Upload File** with the new zip. Everyone's CurseForge app updates automatically.

## When WoW: Forever launches

If the game shows Solitude as "out of date", add its interface number to the `## Interface:` line in `Solitude.toc`
(type `/dump select(4, GetBuildInfo())` in game to see the number) and upload a new version.
