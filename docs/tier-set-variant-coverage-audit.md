# Midnight Season 2 Tier Variant Coverage Audit

Audit date: 2026-10-17
Branch: `fix/tier-catalogue-manifest-bridge`
Scope: source-verified numeric item variants needed before tier pieces can become optimizer candidates.

## Summary

- Base tier membership: **13/13 classes mapped**, with five base item IDs per class (65 total).
- Complete variant mapping: **1/13 classes** — Shaman.
- Verified Shaman PvE candidates: **20/20** (four PvE difficulty variants across five slots).
- Non-Shaman evidence-only observations: **102 records across 12 classes**. These are useful evidence, not complete variant maps.
- Remaining baseline: **12 classes × 5 slots = 60 incomplete slot maps**, with up to **240 baseline PvE slot/difficulty records** to verify (four PvE difficulty variants per slot). Additional upgrade-track variants must be recorded when the source exposes distinct upgraded item levels/stats.
- PvP appearances are not optimizer candidates unless their numeric item level and stats are independently verified.
- Do not enable numeric tier-bonus scoring without a separate trustworthy, simulation-backed scoring source.

## Class-by-class missing-items checklist

For every class marked incomplete below, all five slots still need a complete, source-verified variant map (Raid Finder, Normal, Heroic, Mythic, plus any distinct upgrade-track/item-level variants). The slot notes identify especially obvious gaps in current evidence; they do **not** mean the other slots are complete.

| Class | Current evidence | Highest-priority gaps | Required before eligibility |
|---|---:|---|---|
| Death Knight | 11 observations | Head has observed levels 305/308/311/321/334; Shoulders 295/308/318. Chest, Hands, Legs only have one observed version each. | Complete all five slot maps; verify every difficulty/upgrade variant and preserve source-backed stat variants. |
| Demon Hunter | 12 observations | Hands levels 219, 282, 295, 305, 308, and 321; Legs levels 295, 311, and 318; Chest level 321; Head and Shoulders level 334. | Verify remaining Hands/Legs difficulty and upgrade variants, then complete all five slot maps. All observations remain evidence-only. |
| Druid | 10 observations | Legs levels 219, 285, 298, 311, and 324; Hands 295/334; Chest 292; Shoulders 308; Head 334. | Verify remaining Legs difficulties/upgrades plus all missing variants for the other four slots. |
| Evoker | 5 observations | Hands level 321; remaining four slots level 334 only. Agility/Intellect representation needs spec-aware verification. | Verify all difficulty/upgrade variants and validate primary-stat handling for each Evoker specialization. |
| Hunter | 13 observations | Hands levels 295 and 321; Legs levels 219, 285, 298, 308, 311, 318, 321, and 334; Chest, Head, and Shoulders level 334 only. All observations remain evidence-only. | Verify remaining leg upgrade variants and all missing difficulty/upgrade variants across all slots; keep unverified observations ineligible. |
| Mage | 5 observations | All five slots have a level 334 Mythic 6/6 observation only. | Add source-backed lower-difficulty and relevant upgrade-track variants for every slot; validate full variant IDs. |
| Monk | 5 observations | Legs level 311; other four slots level 334 only. | Verify all difficulty/upgrade variants for all five slots and specialization-specific stats. |
| Paladin | 5 observations | Hands level 321; other four slots level 334 only. | Verify all difficulty/upgrade variants for all five slots and specialization-specific stat variants. |
| Priest | 5 observations | Hands level 305; other four slots level 334 only. | Verify Hands' missing variants and complete all remaining slot/difficulty maps. |
| Rogue | 11 observations | Legs levels 219, 285, 298, 311, 315, 321, and 324; Chest 305; Head 295; Hands 321; Shoulders 334. | Four additional item-specific leg versions are now source-checked; verify remaining difficulties/upgrades and all other slot variants. |
| Shaman | 30 records | Four PvE variants per slot are numeric and candidate-eligible. Ten PvP appearance records lack verified numeric stats. | PvE baseline complete. Keep PvP records appearance-only until their numeric item levels/stats are verified. |
| Warlock | 13 observations | Head levels 219, 285, 298, 305, 311, 315, 318, 321, and 324; Hands 331; Chest/Legs/Shoulders level 334 only. | Four additional item-specific helm versions are source-checked; verify remaining head upgrades and all missing variants across the five slots. |
| Warrior | 8 observations | Hands has distinct dropped-item and Catalyst stat variants; observed at 321 and 334. Shoulders 321/334; Legs 321; Head 334; Chest 344. | Preserve distinct same-ID/stat variants, then verify all missing difficulty/upgrade variants across all five slots. |

## Acceptance criteria

- [ ] All 13 classes retain exactly five source-verified base tier IDs with correct slot mappings.
- [ ] Every PvE slot/difficulty variant has a source URL, correct item ID/slot, item level, and numeric primary/secondary stats.
- [ ] Distinct item variants with the same base ID and item level but different stats (for example Catalyst versus dropped-item variants) remain separate records.
- [ ] Upgrade-track variants are only added when the item level and stats can be verified from the exact source version; no guessed levels or interpolated stats.
- [ ] Candidate eligibility is granted only when the required slot variant mapping and stats are complete; partial observations remain evidence-only.
- [ ] Tests cover per-class slot coverage, item-level/stat accuracy, candidate eligibility, and the regression where a low base-level version must not displace a verified higher-level version.
- [ ] Tier bonus numeric scoring remains disabled until independently validated.
- [ ] CI passes on the draft branch. Do not merge or deploy until explicitly authorized.

## Recommended execution order

1. Complete and test the weakest current slot gaps first: Demon Hunter Hands; Druid Legs; Hunter Legs; Rogue Legs; Warlock Head path; then Death Knight Head/Shoulders and Warrior's same-ID stat variants.
2. For each class, fill the remaining missing difficulty/upgrade variants slot-by-slot from exact Wowhead item versions and add regression tests in the same change.
3. Only after a class's complete mapping passes validation, mark its variants eligible; leave other classes safely evidence-only.
4. Finish full-class cross-checks and run both catalogue and optimizer workflows before considering release.
