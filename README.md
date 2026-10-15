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

## PvE optimization model

The optimizer supports specialization-scoped profiles under `optimizationProfiles[className][specialization]`. A profile may supply `statWeights`, `specializationMasteryWeight`, `softTargets`, `softTargetMultipliers`, `hardCaps`, and `diminishingReturns`. Profile weights, soft targets, and hard caps are only applied when the profile has `verified: true` and a non-empty `source`. No per-spec numbers are inferred from class names or tooltip prose.

Example schema (illustrative test values only; **not a live game profile**):

```json
{
  "optimizationProfiles": {
    "Mage": {
      "Fire": {
        "source": "reviewed simulation/profile source and patch",
        "verified": true,
        "statWeights": {
          "Intellect": 1,
          "CriticalStrike": 0.8,
          "Haste": 0.9,
          "Mastery": 0.7,
          "Versatility": 0.6
        },
        "specializationMasteryWeight": 0.7,
        "softTargets": { "Haste": 1200 },
        "softTargetMultipliers": { "Haste": 0.5 },
        "hardCaps": { "CriticalStrike": 2400 },
        "diminishingReturns": {
          "Haste": {
            "verified": true,
            "source": "reviewed patch-specific rating conversion source",
            "ratingPerPercent": 40,
            "thresholds": [
              { "upToPercent": 30, "multiplier": 1 },
              { "upToPercent": 39, "multiplier": 0.9 },
              { "upToPercent": 47, "multiplier": 0.8 },
              { "upToPercent": 54, "multiplier": 0.7 },
              { "upToPercent": 66, "multiplier": 0.6 },
              { "upToPercent": 126, "multiplier": 0.5 }
            ],
            "hardCapPercent": 126
          }
        }
      }
    }
  }
}
```

All numeric values above are examples for schema/tests, not verified Season 2 stat weights, caps, or rating conversions. Replace them only with patch- and specialization-appropriate evidence. The engine includes the [12.1 secondary-stat diminishing-return bands documented by Wowhead](https://www.wowhead.com/guide/diminishing-returns-on-secondary-stats-in-world-of-warcraft-11052) (0–30% at full value, then 0.9/0.8/0.7/0.6/0.5 multipliers through 126%); it still requires a sourced, verified `ratingPerPercent` conversion before applying those bands to item rating. This avoids guessing rating conversion, including for specialization-dependent Mastery.

SimulationCraft scale factors are accepted when their specialization matches the selected character. A scale-factor import for another specialization is ignored in favor of a matching verified profile or the disclosed fallback weights.

### Buffs and consumables

Consumable records under `consumables.food`, `consumables.flaskOrPhial`, `consumables.potions`, and `consumables.other`, plus top-level `buffs`, are eligible for numerical comparison only when they include a numeric `stats` object, a non-empty `source`, and `effectVerified: true` (or `mechanicsVerified: true` for consumables). Active options are not recommended again. Their scores are displayed separately and are **not added to gear score**, avoiding double-counting until a complete character stat projection exists. Unverified proc, uptime, and temporary effects remain unscored.

### Tier sets and release safety

`data/tier-set-item-ids.json` maps the five armor pieces for all 13 Midnight Season 2 classes. Membership/slot validation and 2-piece/4-piece threshold tests do not imply that real specialization-specific tier bonus DPS or healing has been modeled. Do not populate production bonus scores from synthetic test fixtures.

The tier-set and PvE profile work remains experimental until the full CI suite passes and real effect/weight metadata is reviewed. The feature branch and PR are intentionally kept unmerged and undeployed.


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
