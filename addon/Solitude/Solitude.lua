-- Solitude: copy your level and equipped gear to the Solitude website.
-- Type /solitude in game, press Ctrl+C, then paste on your character page.
-- It only reads your own character. It sends nothing anywhere by itself.

local SLOTS = { 1, 2, 3, 15, 5, 9, 10, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18 }

local function clean(s)
  -- Remove the separators used in the export text, just in case
  return (tostring(s or ""):gsub("[%^;]", ""))
end

local function BuildExport()
  local name = UnitName("player")
  local realm = GetRealmName()
  local _, classToken = UnitClass("player")
  local race = UnitRace("player")
  local header = table.concat({ "SOL1", clean(name), clean(realm), UnitLevel("player"), classToken or "", clean(race) }, "^")

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
SlashCmdList["SOLITUDE"] = function()
  local text, missing = BuildExport()
  if missing > 0 then
    -- Item names weren't loaded yet; the site can still match by item id,
    -- but running it again in a second usually fills them in.
    print("|cff8e9bffSolitude:|r some item names weren't loaded yet. If the site shows 'Item 12345', just type /solitude again.")
  end
  StaticPopup_Show("SOLITUDE_EXPORT", nil, nil, text)
end
