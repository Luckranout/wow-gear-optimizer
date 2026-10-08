# WoW Gear Optimizer

A Retail World of Warcraft gear and character optimizer.

## Current stage

The optimizer UI, current-season data layer, live character adapter, optimization engine, and character coaching workflow are implemented. Production hosting must run the server-side Blizzard adapter; GitHub Pages is static-only and cannot execute `/api/character`.

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

## Production hosting

Deploy the repository to a serverless Node-compatible host such as Vercel for the customer-facing deployment. The included `vercel.json` maps `api/character.js` to a serverless function. Configure `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` in the deployment environment. Do not put either credential in browser code or GitHub Pages.

GitHub Pages can remain useful for static previews, but it is not the production host for live Blizzard character lookup.
