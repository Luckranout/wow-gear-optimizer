# WoW Gear Optimizer

A Retail World of Warcraft gear and character optimizer.

## Implementation and verification status

The repository contains the browser UI, Retail dataset loader, server-side Blizzard character adapter, optimization engine, and character-coaching workflow. Automated repository checks run in GitHub Actions.

**What is verified:** the repository test workflow covers character lookup behavior, character/talent rendering contracts, API request guards, optimizer logic, and related UI contracts. Check the latest run before relying on a change.

**What is not implied by a passing test:** CI does not prove that production credentials, host configuration, live Blizzard responses, the deployed version, or the live mobile layout are correct. Those require a live test after the intended revision is deployed. The live website has not been independently verified as serving the current working branch.

**Current handoff:** review the open pull request, ensure the intended commit is merged and deployed through the normal hosting process, then perform the live checklist. Do not describe a character, item, talent, upgrade route, or deployment as verified unless the corresponding source or live result has actually been checked.

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
