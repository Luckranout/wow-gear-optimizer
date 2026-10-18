# Midnight Season 2 Tier Variant Coverage Audit

Audit date: 2026-10-17
Branch: `fix/tier-catalogue-manifest-bridge`
Scope: source-verified numeric item variants needed before tier pieces can become optimizer candidates.

## Summary

- Base tier membership: **13/13 classes mapped**, with five base item IDs per class (65 total).
- Complete variant mapping: **1/13 classes** — Shaman.
- Verified Shaman PvE candidates: **20/20** (four PvE difficulty variants across five slots).
- Non-Shaman evidence-only observations: **208 records across 12 classes**. These are useful evidence, not complete variant maps.
- Remaining baseline: **12 classes × 5 slots = 60 incomplete slot maps**, with up to **240 baseline PvE slot/difficulty records** to verify (four PvE difficulty variants per slot). Additional upgrade-track variants must be recorded when the source exposes distinct upgraded item levels/stats.
- PvP appearances are not optimizer candidates unless their numeric item level and stats are independently verified.
- Do not enable numeric tier-bonus scoring without a separate trustworthy, simulation-backed scoring source.

## Class-by-class missing-items checklist

For every class marked incomplete below, all five slots still need a complete, source-verified variant map (Raid Finder, Normal, Heroic, Mythic, plus any distinct upgrade-track/item-level variants). The slot notes identify especially obvious gaps in current evidence; they do **not** mean the other slots are complete.

| Class | Current evidence | Highest-priority gaps | Required before eligibility |
|---|---:|---|---|
| Death Knight | 20 observations | Head levels 285/298/305/308/311/321/324/334; Shoulders 282/295/308/318/321; Legs 285/298/311/324/334. Chest and Hands have isolated versions only. | Legs now include source-checked Veteran 3/6, Champion 3/6, and Hero 3/6 versions at 285/298/311 alongside Mythic 3/6 and 6/6; complete all missing difficulty/upgrade variants across all slots. |
| Demon Hunter | 19 observations | Hands levels 219, 282, 295, 305, 308, and 321; Head levels 285, 298, 311, 324, and 334; Legs levels 285, 295, 298, 311, 318, and 324; Chest level 321; Shoulders level 334. | Head difficulty variants at 298/311/324 are now source-checked alongside the 285/334 records. Verify remaining Hands/Head/Legs upgrade variants, then complete all five slot maps. All observations remain evidence-only. |
| Druid | 24 observations | Head levels 285, 298, 311, 324, and 334; Legs 219, 285, 298, 311, and 324; Hands 282, 295, 308, 321, and 334; Chest 285, 292, 298, 311, and 324; Shoulders 282, 295, 308, and 321. | Hands now has source-checked versions at 282 and 308, chest has versions at 285, 298, 311, and 324 alongside 292, and shoulders have versions at 282, 295, 308, and 321. Head and Legs still need remaining upgrade/difficulty variants; complete missing variants for Chest and Shoulders. |
| Evoker | 24 observations | Head, Chest, and Legs now have source-checked levels 285, 298, 311, and 324 alongside 334. Hands and Shoulders have source-checked difficulty versions. Agility/Intellect representation needs spec-aware verification. | Head, Chest, and Legs difficulty observations added from the Echo of Calamity item table. Verify remaining upgrade ranks and validate primary-stat handling for each Evoker specialization. |
| Hunter | 13 observations | Hands levels 295 and 321; Legs levels 219, 285, 298, 308, 311, 318, 321, and 334; Chest, Head, and Shoulders level 334 only. All observations remain evidence-only. | Verify remaining leg upgrade variants and all missing difficulty/upgrade variants across all slots; keep unverified observations ineligible. |
| Mage | 25 observations | Head, Chest, and Legs have levels 285, 298, 311, 324, and 334; Shoulders have levels 282, 295, 308, 321, and 334; Hands levels 282, 295, 308, 321, and 334. | Head, Chest, and Legs have source-checked 285/298/311/324 variants; Shoulders have source-checked 282/295/308/321 variants, alongside the existing 334 observation. Continue validating raid-difficulty and upgrade-track coverage for all five slots. |
| Monk | 13 observations | Head now has source-checked levels 285, 298, 311, 324, and 334; Shoulders have 282, 295, 308, 321, and 334; Chest and Hands 334; Legs 311. | Head now has source-checked Veteran 3/6, Champion 3/6, Hero 3/6, and Myth 3/6 variants alongside 334. Chest, Hands, and Legs still need full difficulty and upgrade-track mapping; keep all observations evidence-only. |
| Paladin | 12 observations | Hands and Shoulders each have source-checked item levels 282, 295, 308, and 321; Chest, Head, and Legs are at level 334 only. | Hands and Shoulders now have Raid Finder, Normal, Heroic, and Mythic versions; verify remaining upgrade ranks and complete the other three slot maps. |
| Priest | 17 observations | Head levels 285, 298, 311, 324, 334; Shoulders now 282, 295, 308, 321, 334; Hands levels 282, 295, 305, 308, 321; Chest and Legs 334 only. | Head and Shoulders have source-checked raid-difficulty variants. Complete remaining difficulty and upgrade-track variants across all five slots; observations remain ineligible candidates. |
| Rogue | 12 observations | Legs levels 219, 285, 298, 311, 315, 321, and 324; Hands levels 282, 295, and 321; Chest 305; Head 295; Shoulders 334. | Four additional item-specific leg versions and a Veteran 2/6 hands version are source-checked; verify remaining difficulties/upgrades and all other slot variants. |
| Shaman | 30 records | Four PvE variants per slot are numeric and candidate-eligible. Ten PvP appearance records lack verified numeric stats. | PvE baseline complete. Keep PvP records appearance-only until their numeric item levels/stats are verified. |
| Warlock | 14 observations | Head levels 219, 285, 298, 305, 308, 311, 315, 318, 321, and 324; Hands 331; Chest/Legs/Shoulders level 334 only. | Five additional item-specific helm versions are source-checked; verify remaining head upgrades and all missing variants across the five slots. |
| Warrior | 15 observations | Chest levels 285, 298, 311, 324, and 344; Shoulders have levels 282, 295, 308, 321, and 334; Hands have distinct same-level stat variants at 321 and a 334 observation; Legs 321; Head 334. | Shoulders now include source-checked 282/295/308 variants, and Chest has source-checked 285/298/311/324 variants. Preserve distinct same-ID/stat variants and continue filling the remaining gaps in Head, Hands, and Legs. |

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
