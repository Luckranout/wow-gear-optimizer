# Midnight Season 2 Tier Variant Coverage Audit

Audit date: 2026-10-17
Branch: `fix/tier-catalogue-manifest-bridge`
Scope: source-verified numeric item variants needed before tier pieces can become optimizer candidates.

## Summary

- Base tier membership: **13/13 classes mapped**, with five base item IDs per class (65 total).
- Complete variant mapping: **1/13 classes** — Shaman.
- Verified Shaman PvE candidates: **20/20** (four PvE difficulty variants across five slots).
- Non-Shaman evidence-only observations: **239 records across 12 classes**. These are useful evidence, not complete variant maps.
- Remaining baseline: **12 classes × 5 slots = 60 incomplete slot maps**, with up to **240 baseline PvE slot/difficulty records** to verify (four PvE difficulty variants per slot). Additional upgrade-track variants must be recorded when the source exposes distinct upgraded item levels/stats.
- PvP appearances are not optimizer candidates unless their numeric item level and stats are independently verified.
- Do not enable numeric tier-bonus scoring without a separate trustworthy, simulation-backed scoring source.

## Class-by-class missing-items checklist

For every class marked incomplete below, all five slots still need a complete, source-verified variant map (Raid Finder, Normal, Heroic, Mythic, plus any distinct upgrade-track/item-level variants). The slot notes identify especially obvious gaps in current evidence; they do **not** mean the other slots are complete.

| Class | Current evidence | Highest-priority gaps | Required before eligibility |
|---|---:|---|---|
| Death Knight | 22 observations | Head levels 285/298/305/308/311/321/324/334; Shoulders 282/295/308/318/321/334; Legs 285/298/311/324/334. Chest has isolated versions; Hands now has a source-cross-checked Mythic 6/6 level-334 observation (Strength 141, Stamina 2,932, Critical Strike 52, Mastery 99). | Added source-checked Mythic 6/6 shoulders at level 334 (Haste 50, Versatility 101); legs include Veteran 3/6, Champion 3/6, Hero 3/6, Myth 3/6 and 6/6. Complete all missing difficulty/upgrade variants across all slots. |
| Demon Hunter | 32 observations | All five slots now have source-backed level-334 observations. | Added Legwraps (271536) at level 334 Mythic 6/6 with Agility/Intellect 189, Stamina 3910, Haste 63, and Mastery 138; stats cross-checked against a level-334 equipped profile and item-specific Wowhead tooltip. All observations remain evidence-only; full difficulty/upgrade variant map is still incomplete. |
| Druid | 27 observations | Head 285, 298, 311, 324, 334; Legs 219, 285, 298, 311, 324, 334; Hands 282, 295, 308, 321, 334; Chest 285, 292, 298, 311, 324, 334; Shoulders 282, 295, 308, 321, 334. | Added Leggings (271527) at item level 334 with Agility/Intellect 189, Stamina 3,910, Haste 63, and Mastery 138, from an equipped-profile observation; kept evidence-only. Druid now has level-334 observations for all five slots. Validate exact version provenance and complete remaining difficulty/upgrade variants before eligibility. |
| Evoker | 25 observations | Head, Shoulders, Chest, Legs, and Hands now have level-334 observations. Hands 334: Agility/Intellect 141, Stamina 2,932, Haste 97, Mastery 53. | Validate exact source/stats and complete all other upgrade variants; evidence-only. |
| Hunter | 14 observations | All five slots have level-334 observations: Chest (271495), Head (271492), Shoulders (271490), Legs (271491), and Hands (271493). The 334 hands tooltip records Agility/Intellect 141, Stamina 2,932, Haste 99, and Versatility 52. All observations remain evidence-only. | Validate exact source/version and stats for each 334 observation, then verify remaining difficulty/upgrade variants across all slots; keep unverified observations ineligible. |
| Mage | 25 observations | Head, Chest, and Legs have levels 285, 298, 311, 324, and 334; Shoulders have levels 282, 295, 308, 321, and 334; Hands levels 282, 295, 308, 321, and 334. | Head, Chest, and Legs have source-checked 285/298/311/324 variants; Shoulders have source-checked 282/295/308/321 variants, alongside the existing 334 observation. Continue validating raid-difficulty and upgrade-track coverage for all five slots. |
| Monk | 14 observations | Head now has source-checked levels 285, 298, 311, 324, and 334; Shoulders have 282, 295, 308, 321, and 334; Chest and Hands 334; Legs 311 and 334. | Added Pantaloons of the Monkey King (271518) at item level 334 with Agility/Intellect 189, Stamina 3,910, Critical Strike 130, and Versatility 71, based on an equipped-profile observation; kept evidence-only. Complete the remaining difficulty and upgrade-track mapping across all slots. |
| Paladin | 13 observations | Hands now have source-checked item levels 282, 295, 308, 321, and 334; Shoulders have 282, 295, 308, 321, and 334; Chest, Head, and Legs are at level 334. | Added Gauntlets of the Consecrated Flame (271466) at Mythic 6/6, item level 334: Strength/Intellect 141, Stamina 2,932, Critical Strike 49, Mastery 101. All remain evidence-only; complete remaining difficulty and upgrade variants. |
| Priest | 18 observations | Head levels 285, 298, 311, 324, 334; Shoulders 282, 295, 308, 321, 334; Hands 282, 295, 305, 308, 321, 334; Chest and Legs 334 only. | Added Cosmic Penitent's Celestial Grips (271556) at Mythic 6/6, item level 334: Intellect 141, Stamina 2,932, Critical Strike 53, Mastery 98. All remain evidence-only; complete remaining difficulty and upgrade-track variants across all five slots. |
| Rogue | 16 observations | Head, Shoulders, Chest, Hands, and Legs now each have a source-checked Mythic 6/6 version at item level 334; lower-rank observations are also recorded for Chest, Hands, Head, and Legs. | Chest (271513) and Hands (271511) now include exact Wowhead Mythic 6/6 level-334 stats. Continue checking source/version consistency for all five slots and complete the remaining difficulty and upgrade-track variants; all observations remain evidence-only. |
| Shaman | 30 records | Four PvE variants per slot are numeric and candidate-eligible. Ten PvP appearance records lack verified numeric stats. | PvE baseline complete. Keep PvP records appearance-only until their numeric item levels/stats are verified. |
| Warlock | 16 observations | Head levels 219, 285, 298, 305, 308, 311, 315, 318, 321, 324, and 334; Hands 331 and 334; Chest/Legs/Shoulders level 334. Head 334: Intellect 189, Stamina 3,910, Versatility 65, Mastery 136. Hands 334: Intellect 141, Stamina 2,932, Critical Strike 45, Haste 106. | Verify remaining head upgrades and all missing variants across the five slots; all observations remain evidence-only. |
| Warrior | 17 observations | Head, Shoulders, Chest, Hands, and Legs each have a Mythic 6/6 item-level 334 observation. Legs (271455) are recorded with Strength 189, Stamina 3,910, Versatility 135, and Mastery 66; lower-rank observations also exist. | Continue filling remaining difficulty and upgrade-track variants; all observations remain evidence-only and ineligible as optimizer candidates. |

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

The immediate priority is **standard Mythic 6/6 tier gear at item level 334 for all 13 classes and all five tier slots**. Do not count a special item-level 344 reward as the standard Mythic 6/6 variant. Record special 344 variants separately with their own exact source and stats. Do not infer 334 stats from another rank.

### Standard Mythic 6/6 (334) gap checklist

This is a working inventory of current observations, not a certification that the recorded entries have complete stats/provenance. A slot counts as covered here only when its exact 334 item version is source-verified; candidate eligibility remains off until the full class map is verified.

| Class | Recorded at 334 | Slots still needing a verified 334 version |
|---|---|---|
| Death Knight | Head, Shoulders, Chest, Hands, Legs | None missing from current 334 observations; continue full difficulty/upgrade mapping |
| Demon Hunter | Head, Shoulders, Hands, Chest, Legs | None for level-334 observations; complete variant mapping still missing |
| Druid | Head, Shoulders, Chest, Hands, Legs | None missing from current 334 observations; validate exact version provenance for Legs |
| Evoker | Head, Shoulders, Chest, Legs, Hands | None missing from current 334 observations; validate exact source/stats and complete all other variants |
| Hunter | Head, Shoulders, Chest, Legs | Hands |
| Mage | Head, Shoulders, Chest, Hands, Legs | None recorded as missing; validate exact source/stats for all five |
| Monk | Head, Shoulders, Chest, Hands, Legs | None missing from current 334 observations; validate exact version provenance for Legs |
| Paladin | Head, Shoulders, Chest, Hands, Legs | None missing from current 334 observations; all five still need complete variant maps |
| Priest | Head, Shoulders, Chest, Hands, Legs | None missing from current 334 observations; all five still need complete variant maps |
| Rogue | Head, Shoulders, Chest, Hands, Legs | None missing from current 334 observations; validate exact source/stats for all five slots |
| Shaman | Five PvE slots exist in the separate numeric pieces schema; verify which records are exactly standard Mythic 6/6 at 334 | Validate exact 334 version and stats per slot |
| Warlock | Head, Shoulders, Chest, Legs, Hands | None missing from current 334 observations; validate exact source/stats and complete all other variants |
| Warrior | Head, Shoulders, Chest, Hands, Legs | None missing from current 334 observations; validate exact source/stats for all five slots |

### Work sequence

1. Verify missing standard Mythic 6/6 pieces from exact item-specific sources, recording item ID, slot, item level, numeric stats, source URL, and any variant/bonus identifiers. Prioritize remaining gaps for Druid, Evoker, Monk, Paladin, and Priest; then validate exact source/stats for classes with all five observations.
2. Re-check the five Mage observations and Shaman's separate schema against exact source versions; “recorded” is not the same as fully validated.
3. Keep item-level 344 special rewards separate from standard Mythic 6/6 334 variants.
4. Add regression tests for each confirmed item/version and explicit tests that a missing or unverified slot cannot be marked complete or candidate-eligible.
5. After the 334 pass, fill Raid Finder/Normal/Heroic/Mythic base versions and intermediate upgrade ranks, then audit all 16 equipment slots and non-tier gear.
6. Keep partial evidence ineligible and numeric tier-bonus scoring disabled until separately verified.
7. Run catalogue and optimizer CI on the draft branch. Do not merge or deploy without explicit authorization.
