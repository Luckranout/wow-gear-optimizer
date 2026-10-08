# WoW Gear Optimizer

A Retail World of Warcraft gear and character optimizer.

## Current stage

Foundation UI only. The next stages will connect:

1. Current Retail data ingestion
2. Database models
3. Character data
4. Gear/enhancement data
5. Optimization engine
6. Current-season update pipeline

## Scope

The project is intended for current Retail WoW only, with expansion/season/patch metadata so future updates can replace or supersede obsolete records cleanly.


## Live character lookup

The customer workflow now uses a server-side Blizzard API adapter. A user enters a character name and realm; the browser calls `/api/character`, and the server retrieves the current profile, equipped gear, and statistics from Blizzard without exposing Blizzard credentials.

For a Vercel deployment, configure these environment variables:

- `BLIZZARD_CLIENT_ID`
- `BLIZZARD_CLIENT_SECRET`

The browser must never receive either credential. The legacy GitHub Actions importer remains available for development/verification, but it is not part of the customer workflow.

SimulationCraft is not required for character lookup or the normal optimization flow.
