# WoW Tooltip Exporter

This addon captures the **structured tooltip lines produced by the installed WoW client** using `C_TooltipInfo.GetItemByID`. It records line text, right-column text, line types, colors, hyperlinks, and override item level when Blizzard exposes them. It does not scrape or reproduce Blizzard's UI layout, and it cannot retrieve server-side item data that the client does not return.

## Install

1. Copy the `wow-tooltip-exporter` folder into the Retail game's `_retail_/Interface/AddOns/` folder.
2. Keep the folder named `WowTooltipExporter` so it matches `WowTooltipExporter.toc`; keep the `.toc` and `.lua` together.
3. Enable **WoW Tooltip Exporter** on the character-select AddOns screen.
4. Log in and enter `/wgte help`.

## Generate the optimizer's item ID batches

From the repository root, run `node scripts/export-wow-tooltip-item-ids.js`. This reads the existing current Retail dataset, all 14 equipment section catalogs, and the tier-set ID manifest, then writes `wow-tooltip-item-ids.txt` with unique sorted item IDs split into batches of up to 200. The catalog can contain duplicate appearances of the same base ID; duplicates are removed. Review the generated file and paste each line into the game as `/wgte <IDs from that line>`.

## Export item tooltip lines

Run `/wgte 19019 212405 212406` or use commas, e.g. `/wgte 19019,212405,212406`. Batches are limited to 200 IDs so the client can load item data without being overwhelmed. The addon waits briefly for the client tooltip data, records failures explicitly, and preserves previous records for items not in the current batch.

Then **log out normally** so WoW writes the SavedVariables file:

`WTF/Account/<account>/SavedVariables/WoWTooltipExporter.lua`

The saved table is `WoWTooltipExporterDB.items`, keyed by item ID. Convert it into the format the web app can read with `node scripts/convert-wow-tooltip-export.js /path/to/WoWTooltipExporter.lua data/blizzard-tooltip-lines.json`. Then add the generated `data/blizzard-tooltip-lines.json` to the tooltip branch and reload the app; it will prefer captured Blizzard lines for items that have them and use the fallback only for uncaptured items. Copy only this exporter file into a private working copy for analysis; do not commit character/account data or other personal SavedVariables.

Commands:
- `/wgte <itemID> [itemID...]` — capture a batch.
- `/wgte status` — count records saved in the current database.
- `/wgte clear` — clear the captured item records.
- `/wgte help` — show usage.

## What to export first

Start with representative items covering equipment types and tooltip features: a weapon, armor, ring, trinket with an effect, tier-set piece, item with sockets, crafted item, and an item with an upgrade track. Then export the verified current-season item IDs in batches.

## Blizzard references

- [TooltipInfo API documentation](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/TooltipInfoDocumentation.lua) documents `C_TooltipInfo.GetItemByID` and the structured return data.
- [Blizzard UI source mirror](https://github.com/Gethe/wow-ui-source/tree/live/Interface/AddOns/Blizzard_SharedXML) contains shared tooltip templates; use the matching tooltip templates from the current client build when comparing visual layout.

## Data strategy

- Use Blizzard's web API for public item metadata and media.
- Use this addon for the client-generated tooltip line content and line colors.
- Use Blizzard's shipped UI source as the reference for layout and styling.
- Keep variant-specific item links/modifiers separate where relevant; a base item ID does not represent every possible equipped variant.

The addon is an internal data collection utility. It does not change the optimizer or deploy anything by itself.
