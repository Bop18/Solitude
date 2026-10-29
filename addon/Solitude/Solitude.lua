-- ============================================================
-- Solitude: keeps your group's Solitude website up to date.
--
-- While you play, it notes down (in its own save file):
--   • boss kills: which boss, where, when and who was in the group
--   • your raid lockouts: which bosses you've killed this week
--   • your level and equipped gear
--
-- WoW writes that save file when you log out or type /reload.
-- The Solitude companion app on your PC then uploads it. Addons
-- can't use the internet, so this addon never sends anything itself.
--
--   /solitude          copy your gear & level (to paste on the site by hand)
--   /solitude status   what's been recorded
-- ============================================================

local ADDON = ...
local VERSION = 2
local SLOTS = { 1, 2, 3, 15, 5, 9, 10, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18 }
local KEEP_DAYS = 45
local MAX_KILLS = 600

local function now()
  return (GetServerTime and GetServerTime()) or time()
end

local function say(msg)
  print("|cff8e9bffSolitude:|r " .. msg)
end

local function clean(s)
  return (tostring(s or ""):gsub("[%^;]", ""))
end

local function charKey()
  return (UnitName("player") or "?") .. "-" .. (GetRealmName() or "?")
end

local function charRecord()
  SolitudeDB.chars = SolitudeDB.chars or {}
  local key = charKey()
  SolitudeDB.chars[key] = SolitudeDB.chars[key] or {}
  return SolitudeDB.chars[key]
end

-- ---------- Level & gear ----------
local function snapshotCharacter()
  local c = charRecord()
  local _, classToken = UnitClass("player")
  c.name = UnitName("player")
  c.realm = GetRealmName()
  c.level = UnitLevel("player")
  c.class = classToken
  c.race = UnitRace("player")
  c.updated = now()

  local gear = {}
  for _, slot in ipairs(SLOTS) do
    local id = GetInventoryItemID("player", slot)
    if id then
      local itemName, _, quality, itemLevel = GetItemInfo(id)
      table.insert(gear, { slot = slot, id = id, q = quality, ilvl = itemLevel, name = itemName })
    end
  end
  c.gear = gear
end

-- ---------- Raid lockouts ----------
local function snapshotLockouts()
  if not GetNumSavedInstances then return end
  local c = charRecord()
  local list = {}
  for i = 1, GetNumSavedInstances() do
    local name, _, reset, _, locked, _, _, isRaid, maxPlayers, _, numEncounters, encounterProgress = GetSavedInstanceInfo(i)
    if name and locked and reset and reset > 0 then
      local bosses = {}
      if GetSavedInstanceEncounterInfo and numEncounters then
        for j = 1, numEncounters do
          local bossName, _, isKilled = GetSavedInstanceEncounterInfo(i, j)
          if bossName then table.insert(bosses, { name = bossName, killed = isKilled and true or false }) end
        end
      end
      table.insert(list, {
        instance = name,
        resets = now() + reset,
        raid = isRaid and true or false,
        size = maxPlayers,
        killed = encounterProgress or 0,
        total = numEncounters or 0,
        bosses = bosses,
      })
    end
  end
  c.lockouts = list
  c.lockoutsUpdated = now()
end

-- ---------- Boss kills ----------
local recent = {} -- encounterID → time, so ENCOUNTER_END and BOSS_KILL don't double count

local function groupMembers()
  local members = {}
  if IsInRaid and IsInRaid() then
    for i = 1, GetNumGroupMembers() do
      local name = GetRaidRosterInfo(i)
      if name then table.insert(members, name) end
    end
  else
    local me = UnitName("player")
    if me then table.insert(members, me) end
    for i = 1, 4 do
      local name, realm = UnitName("party" .. i)
      if name then
        table.insert(members, (realm and realm ~= "") and (name .. "-" .. realm) or name)
      end
    end
  end
  return members
end

local function recordKill(encounterID, bossName, groupSize)
  local t = now()
  if encounterID and recent[encounterID] and t - recent[encounterID] < 120 then return end
  if encounterID then recent[encounterID] = t end

  local instanceName, _, difficultyID = GetInstanceInfo()
  SolitudeDB.kills = SolitudeDB.kills or {}
  table.insert(SolitudeDB.kills, {
    t = t,
    enc = encounterID,
    boss = bossName,
    instance = instanceName,
    diff = difficultyID,
    size = groupSize or GetNumGroupMembers(),
    members = groupMembers(),
    by = charKey(),
  })

  -- Update this week's lockout info too
  if RequestRaidInfo then RequestRaidInfo() end
  say(("recorded |cffffd100%s|r. It uploads next time you log out or /reload."):format(bossName or "boss kill"))
end

local function prune()
  local kills = SolitudeDB.kills or {}
  local cutoff = now() - KEEP_DAYS * 86400
  local kept = {}
  for _, k in ipairs(kills) do
    if (k.t or 0) >= cutoff then table.insert(kept, k) end
  end
  while #kept > MAX_KILLS do table.remove(kept, 1) end
  SolitudeDB.kills = kept
end

-- ---------- Events ----------
local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:RegisterEvent("PLAYER_EQUIPMENT_CHANGED")
frame:RegisterEvent("PLAYER_LEVEL_UP")
frame:RegisterEvent("PLAYER_LOGOUT")
frame:RegisterEvent("UPDATE_INSTANCE_INFO")
frame:RegisterEvent("ENCOUNTER_END")
pcall(frame.RegisterEvent, frame, "BOSS_KILL") -- not in every game version

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "ADDON_LOADED" then
    if ... == ADDON then
      SolitudeDB = SolitudeDB or {}
      SolitudeDB.version = VERSION
      SolitudeDB.kills = SolitudeDB.kills or {}
      prune()
    end
  elseif event == "PLAYER_ENTERING_WORLD" then
    snapshotCharacter()
    if RequestRaidInfo then RequestRaidInfo() end
  elseif event == "PLAYER_EQUIPMENT_CHANGED" or event == "PLAYER_LEVEL_UP" then
    snapshotCharacter()
  elseif event == "UPDATE_INSTANCE_INFO" then
    snapshotLockouts()
  elseif event == "ENCOUNTER_END" then
    local encounterID, encounterName, _, groupSize, success = ...
    if success == 1 or success == true then recordKill(encounterID, encounterName, groupSize) end
  elseif event == "BOSS_KILL" then
    local encounterID, encounterName = ...
    recordKill(encounterID, encounterName)
  elseif event == "PLAYER_LOGOUT" then
    snapshotCharacter()
  end
end)

-- ---------- /solitude ----------
local function BuildExport()
  local _, classToken = UnitClass("player")
  local header = table.concat({ "SOL1", clean(UnitName("player")), clean(GetRealmName()), UnitLevel("player"), classToken or "", clean(UnitRace("player")) }, "^")
  local parts = { header }
  local missing = 0
  for _, slot in ipairs(SLOTS) do
    local itemId = GetInventoryItemID("player", slot)
    if itemId then
      local itemName, _, quality, itemLevel = GetItemInfo(itemId)
      if not itemName then missing = missing + 1 end
      table.insert(parts, table.concat({ slot, itemId, quality or "", itemLevel or "", clean(itemName) }, "^"))
    end
  end
  return table.concat(parts, ";"), missing
end

StaticPopupDialogs["SOLITUDE_EXPORT"] = {
  text = "Solitude: press |cffffd100Ctrl+C|r to copy, then paste it on your character page on the site.",
  button1 = OKAY or "Done",
  hasEditBox = true,
  editBoxWidth = 360,
  maxLetters = 0,
  OnShow = function(self, data)
    local eb = self.editBox or self.EditBox or (self.GetEditBox and self:GetEditBox())
    if eb then
      eb:SetMaxLetters(0)
      eb:SetText(data or "")
      eb:HighlightText()
      eb:SetFocus()
    end
  end,
  EditBoxOnEscapePressed = function(self) self:GetParent():Hide() end,
  EditBoxOnEnterPressed = function(self) self:GetParent():Hide() end,
  timeout = 0,
  whileDead = true,
  hideOnEscape = true,
  preferredIndex = 3,
}

SLASH_SOLITUDE1 = "/solitude"
SLASH_SOLITUDE2 = "/sol"
SlashCmdList["SOLITUDE"] = function(msg)
  msg = (msg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  if msg == "status" then
    local kills = SolitudeDB and SolitudeDB.kills or {}
    local c = charRecord()
    say(("%d boss kill%s saved (last %d days). %d raid lockout%s this week."):format(
      #kills, #kills == 1 and "" or "s", KEEP_DAYS, #(c.lockouts or {}), #(c.lockouts or {}) == 1 and "" or "s"))
    if kills[#kills] then
      local k = kills[#kills]
      say(("Latest: %s in %s."):format(k.boss or "?", k.instance or "?"))
    end
    say("With the companion app running, this all uploads when you log out or /reload.")
    return
  end
  local text, missing = BuildExport()
  if missing > 0 then
    say("some item names weren't loaded yet. If the site shows 'Item 12345', just type /solitude again.")
  end
  StaticPopup_Show("SOLITUDE_EXPORT", nil, nil, text)
end
