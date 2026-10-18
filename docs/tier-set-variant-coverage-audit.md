# Midnight Season 2 Tier Variant Coverage Audit

Audit date: 2026-10-17
Branch: `fix/tier-catalogue-manifest-bridge`
Scope: source-verified numeric item variants needed before tier pieces can become optimizer candidates.

## Summary

- Base tier membership: **13/13 classes mapped**, with five base item IDs per class (65 total).
- Complete variant mapping: **1/13 classes** — Shaman.
- Verified Shaman PvE candidates: **20/20** (four PvE difficulty variants across five slots).
- Non-Shaman evidence-only observations: **149 records across 12 classes**. These are useful evidence, not complete variant maps.
- Remaining baseline: **12 classes × 5 slots = 60 incomplete slot maps**, with up to **240 baseline PvE slot/difficulty records** to verify (four PvE difficulty variants per slot). Additional upgrade-track variants must be recorded when the source exposes distinct upgraded item levels/stats.
- PvP appearances are not optimizer candidates unless their numeric item level and stats are independently verified.
- Do not enable numeric tier-bonus scoring without a separate trustworthy, simulation-backed scoring source.

## Class-by-class missing-items checklist

For every class marked incomplete below, all five slots still need a complete, source-verified variant map (Raid Finder, Normal, Heroic, Mythic, plus any distinct upgrade-track/item-level variants). The slot notes identify especially obvious gaps in current evidence; they do **not** mean the other slots are complete.

| Class | Current evidence | Highest-priority gaps | Required before eligibility |
|---|---:|---|---|
| Death Knight | 17 observations | Head levels 285/298/305/308/311/321/324/334; Shoulders 282/295/308/318/321; Legs 324 and 334. Chest and Hands have isolated versions only. | Five additional item-specific head/shoulder versions plus a Mythic 3/6 legs observation are source-checked; complete all missing difficulty/upgrade variants across all slots. |
| Demon Hunter | 19 observations | Hands levels 219, 282, 295, 305, 308, and 321; Head levels 285, 298, 311, 324, and 334; Legs levels 285, 295, 298, 311, 318, and 324; Chest level 321; Shoulders level 334. | Head difficulty variants at 298/311/324 are now source-checked alongside the 285/334 records. Verify remaining Hands/Head/Legs upgrade variants, then complete all five slot maps. All observations remain evidence-only. |
| Druid | 15 observations | Head levels 285, 298, 311, 324, and 334; Legs 219, 285, 298, 311, and 324; Hands 295/334; Chest 292; Shoulders 308. | Head and Legs now have source-checked difficulty-level observations, but still need remaining upgrade ranks; complete all missing variants for Hands, Chest, and Shoulders. |
| Evoker | 12 observations | Hands and Shoulders now have source-checked Raid Finder, Normal, Heroic, and Mythic versions plus the 321/334 versions respectively; Chest, Head, and Legs remain at 334 only. Agility/Intellect representation needs spec-aware verification. | Verify remaining upgrade ranks and complete Chest, Head, and Legs difficulty maps; validate primary-stat handling for each Evoker specialization. |
| Hunter | 13 observations | Hands levels 295 and 321; Legs levels 219, 285, 298, 308, 311, 318, 321, and 334; Chest, Head, and Shoulders level 334 only. All observations remain evidence-only. | Verify remaining leg upgrade variants and all missing difficulty/upgrade variants across all slots; keep unverified observations ineligible. |
| Mage | 9 observations | Hands levels 282, 295, 308, 321, and 334; other four slots have a level 334 Mythic 6/6 observation only. | Hands now has source-checked Raid Finder, Normal, Heroic, and Mythic versions plus the 334 version; add lower-difficulty and relevant upgrade-track variants for the other four slots. |
| Monk | 9 observations | Shoulders levels 282, 295, 308, 321, and 334; Legs level 311; other three slots level 334 only. | Shoulders now has source-checked Raid Finder, Normal, Heroic, and Mythic versions plus the 334 version; verify all remaining difficulty/upgrade variants and specialization-specific stats. |
| Paladin | 12 observations | Hands and Shoulders each have source-checked item levels 282, 295, 308, and 321; Chest, Head, and Legs are at level 334 only. | Hands and Shoulders now have Raid Finder, Normal, Heroic, and Mythic versions; verify remaining upgrade ranks and complete the other three slot maps. |
| Priest | 9 observations | Hands levels 282, 295, 305, 308, and 321; other four slots level 334 only. | Hands now has source-checked Raid Finder, Normal, Heroic, and Mythic versions plus a 305 observation; verify remaining upgrade ranks and all other slot/difficulty maps. |
| Rogue | 12 observations | Legs levels 219, 285, 298, 311, 315, 321, and 324; Hands levels 282, 295, and 321; Chest 305; Head 295; Shoulders 334. | Four additional item-specific leg versions and a Veteran 2/6 hands version are source-checked; verify remaining difficulties/upgrades and all other slot variants. |
| Shaman | 30 records | Four PvE variants per slot are numeric and candidate-eligible. Ten PvP appearance records lack verified numeric stats. | PvE baseline complete. Keep PvP records appearance-only until their numeric item levels/stats are verified. |
| Warlock | 14 observations | Head levels 219, 285, 298, 305, 308, 311, 315, 318, 321, and 324; Hands 331; Chest/Legs/Shoulders level 334 only. | Five additional item-specific helm versions are source-checked; verify remaining head upgrades and all missing variants across the five slots. |
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
