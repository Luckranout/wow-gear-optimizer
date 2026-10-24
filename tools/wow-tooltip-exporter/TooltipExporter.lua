-- Collects Blizzard's own structured item tooltip data for comparison/import.
-- Usage: /wgte 12345 67890, or /wgte 12345,67890
-- Results are saved to WoWTooltipExporterDB in WTF/Account/<account>/SavedVariables/WoWTooltipExporter.lua.

local ADDON_NAME = ...
WoWTooltipExporterDB = WoWTooltipExporterDB or {}
WoWTooltipExporterDB.items = WoWTooltipExporterDB.items or {}

local queue = {}
local active = false
local total = 0
local completed = 0
local failures = 0
local frame = CreateFrame("Frame")

local function message(text)
  DEFAULT_CHAT_FRAME:AddMessage("|cff33ff99WoW Tooltip Exporter:|r " .. tostring(text))
end

local function colorCopy(color)
  if type(color) ~= "table" then return nil end
  return { r = color.r, g = color.g, b = color.b, a = color.a }
end

local function captureItem(itemID)
  local data = C_TooltipInfo and C_TooltipInfo.GetItemByID and C_TooltipInfo.GetItemByID(itemID)
  if not data or type(data.lines) ~= "table" or #data.lines == 0 then
    return false
  end

  local lines = {}
  for index, line in ipairs(data.lines) do
    lines[index] = {
      type = line.type,
      leftText = line.leftText,
      rightText = line.rightText,
      leftColor = colorCopy(line.leftColor),
      rightColor = colorCopy(line.rightColor),
      wrapText = line.wrapText
    }
  end

  WoWTooltipExporterDB.items[tostring(itemID)] = {
    itemID = itemID,
    capturedAt = date("!%Y-%m-%dT%H:%M:%SZ"),
    hyperlink = data.hyperlink,
    hasDynamicData = data.hasDynamicData,
    overrideItemLevel = data.overrideItemLevel,
    lines = lines
  }
  return true
end

local function nextItem()
  if #queue == 0 then
    active = false
    message("Finished. Captured " .. completed .. "/" .. total .. " item(s); failures: " .. failures .. ". Log out to write SavedVariables to disk.")
    return
  end

  local itemID = table.remove(queue, 1)
  local attempts = 0
  local function tryCapture()
    attempts = attempts + 1
    if captureItem(itemID) then
      completed = completed + 1
      nextItem()
      return
    end
    if attempts < 20 then
      C_Timer.After(0.25, tryCapture)
    else
      failures = failures + 1
      WoWTooltipExporterDB.items[tostring(itemID)] = {
        itemID = itemID,
        capturedAt = date("!%Y-%m-%dT%H:%M:%SZ"),
        error = "Tooltip data unavailable after waiting for client item data."
      }
      nextItem()
    end
  end

  if C_Item and C_Item.RequestLoadItemDataByID then
    C_Item.RequestLoadItemDataByID(itemID)
  end
  C_Timer.After(0.25, tryCapture)
end

local function parseIDs(input)
  local ids, seen = {}, {}
  for token in string.gmatch(input or "", "[^,%s]+") do
    local id = tonumber(token)
    if id and id > 0 and id == math.floor(id) and id <= 2147483647 and not seen[id] then
      seen[id] = true
      table.insert(ids, id)
    end
  end
  return ids
end

SLASH_WOWTOOLTIPEXPORTER1 = "/wgte"
SlashCmdList.WOWTOOLTIPEXPORTER = function(input)
  local command = string.lower((input or ""):match("^%s*(%S+)") or "")
  if command == "status" then
    local count = 0
    for _ in pairs(WoWTooltipExporterDB.items) do count = count + 1 end
    message(count .. " unique item record(s) stored.")
    return
  elseif command == "clear" then
    WoWTooltipExporterDB.items = {}
    message("Stored item records cleared.")
    return
  elseif command == "help" then
    message("Usage: /wgte 12345 67890,123456. Commands: /wgte status, /wgte clear. Log out to flush SavedVariables.")
    return
  end

  if active then
    message("An export batch is already running. Wait for it to finish.")
    return
  end

  local ids = parseIDs(input)
  if #ids == 0 then
    message("Supply item IDs, e.g. /wgte 19019 212405, or use /wgte help.")
    return
  end
  if #ids > 200 then
    message("Please run batches of 200 IDs or fewer.")
    return
  end

  queue = ids
  total = #ids
  completed = 0
  failures = 0
  active = true
  message("Starting batch of " .. total .. " item(s). Existing records will be replaced.")
  nextItem()
end

frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
  WoWTooltipExporterDB = WoWTooltipExporterDB or {}
  WoWTooltipExporterDB.items = WoWTooltipExporterDB.items or {}
  message("Ready. Type /wgte help to export Blizzard tooltip data.")
end)
