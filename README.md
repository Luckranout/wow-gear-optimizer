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

Deploy the repository to a serverless Node-compatible host such as Vercel for the customer-facing deployment. Vercel's `/api` convention exposes `api/character.js` and `api/realms.js` as serverless functions; `vercel.json` currently contains only the schema declaration and does not define explicit route mappings.

Configure `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` as server-side deployment environment variables. Never put either credential in browser code or GitHub Pages. Confirm the variables exist in the target deployment environment before expecting live Blizzard lookups to work.

GitHub Pages can remain useful for static previews, but it cannot execute the server-side Blizzard adapter and is not the production host for live character lookup.

## Live handoff checklist

Run this checklist only after the intended branch has been reviewed, merged, and deployed through the normal hosting process. A passing CI run is not a substitute for these live checks.

1. **Confirm the deployed revision.** Verify that the deployment includes the intended commit and that the production API base URL is the expected one.
2. **Check realm loading.** Open the site on desktop and a phone-sized viewport. Confirm the realm list loads, the `Burning Legion` placeholder is visible before selection, and the dropdown remains usable on mobile.
3. **Check character lookup.** Confirm `Failing` is the character-name placeholder, select the actual realm, and look up a known character such as Failing on Burning Legion.
4. **Check identity fields.** Confirm name, realm, level, race, class, specialization, faction, guild, and achievement points match the returned character data where available.
5. **Check talents and equipment.** Confirm the talent section reflects the API response and the equipped items show only data actually returned. Missing values must remain missing rather than be guessed.
6. **Check statistics and optimizer handoff.** Confirm stats are populated when Blizzard returns them and that gear recommendations are described as dataset/goal-weighted estimates, not simulation results.
7. **Check error handling.** Try a nonexistent character and confirm a clear not-found message; check that a failed lookup does not leave stale details from the previous character.
8. **Check mobile layout.** Verify no overlapping controls, clipped gear details, or horizontal page scrolling. Confirm the realm dropdown can be opened and selected.
9. **Record failures honestly.** Capture a screenshot and note the selected realm, character, expected behavior, and actual behavior. Do not call the live test passed until each applicable check has been completed.
