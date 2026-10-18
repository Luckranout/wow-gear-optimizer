# Midnight Season 2 Tier Variant Coverage Audit

Audit date: 2026-10-18
Branch: `fix/tier-catalogue-manifest-bridge`
Scope: source-verified numeric item variants needed before tier pieces can become optimizer candidates.

## Summary

- Base tier membership: **13/13 classes mapped**, with five base item IDs per class (65 total).
- Complete variant mapping: **1/13 classes** — Shaman.
- Verified Shaman PvE candidates: **20/20** (four PvE difficulty variants across five slots).
- Non-Shaman evidence-only observations: **271 records across 12 classes**. These are useful evidence, not complete variant maps.
- Remaining baseline: **12 classes × 5 slots = 60 incomplete slot maps**, with up to **240 baseline PvE slot/difficulty records** to verify (four PvE difficulty variants per slot). Additional upgrade-track variants must be recorded when the source exposes distinct upgraded item levels/stats.
- PvP appearances are not optimizer candidates unless their numeric item level and stats are independently verified.
- Do not enable numeric tier-bonus scoring without a separate trustworthy, simulation-backed scoring source.

## Class-by-class missing-items checklist

For every class marked incomplete below, all five slots still need a complete, source-verified variant map (Raid Finder, Normal, Heroic, Mythic, plus any distinct upgrade-track/item-level variants). The slot notes identify especially obvious gaps in current evidence; they do **not** mean the other slots are complete.

| Class | Current evidence | Highest-priority gaps | Required before eligibility |
|---|---:|---|---|
| Death Knight | 25 observations | Head levels 285/298/305/308/311/321/324/334; Shoulders 282/295/308/318/321/334; Chest 298/311/321/334; Hands 321/334; Legs 285/298/311/324/334. | Added the source-checked Champion 3/6 chest at level 298 (Strength 135, Stamina 2,579, Critical Strike 50, Mastery 122), alongside Hero 3/6 level 311 and Hero 6/6 level 321. All observations remain evidence-only; complete missing difficulty and upgrade variants across all slots. |
| Demon Hunter | 32 observations | All five slots now have source-backed level-334 observations. | Added Legwraps (271536) at level 334 Mythic 6/6 with Agility/Intellect 189, Stamina 3910, Haste 63, and Mastery 138; stats cross-checked against a level-334 equipped profile and item-specific Wowhead tooltip. All observations remain evidence-only; full difficulty/upgrade variant map is still incomplete. |
| Druid | 28 observations | Head 285, 298, 311, 321, 324, 334; Legs 219, 285, 298, 311, 324, 334; Hands 282, 295, 308, 321, 334; Chest 285, 292, 298, 311, 324, 334; Shoulders 282, 295, 308, 321, 334. | Added Leggings (271527) at item level 334 with Agility/Intellect 189, Stamina 3,910, Haste 63, and Mastery 138, from an equipped-profile observation; kept evidence-only. Added source-backed Hero 6/6 head (271528) at item level 321: Agility 167, Stamina 3,369, Haste 134, Versatility 56. Druid now has a source-backed 321 head observation and level-334 observations for all five slots; all remain evidence-only. Complete remaining difficulty/upgrade variants before eligibility. |
| Evoker | 25 observations | Head, Shoulders, Chest, Legs, and Hands now have level-334 observations. Hands 334: Agility/Intellect 141, Stamina 2,932, Haste 97, Mastery 53. | Validate exact source/stats and complete all other upgrade variants; evidence-only. |
| Hunter | 19 observations | All five slots have level-334 observations: Chest (271495; item levels 311 and 334), Head (271492), Shoulders (271490), Legs (271491), and Hands (271493). Hands include item levels 295, 308, 321, and 334; the 308 Hero 2/6 tooltip records Agility 111, Stamina 2,172, Haste 89, and Versatility 46. The 334 hands tooltip records Agility/Intellect 141, Stamina 2,932, Haste 99, and Versatility 52. All observations remain evidence-only. | Continue verifying remaining difficulty/upgrade variants across all five slots; keep unverified observations ineligible. |
| Mage | 26 observations | Head has levels 285, 298, 311, 315, 324, and 334; Chest and Legs have levels 285, 298, 311, 324, and 334; Shoulders have levels 282, 295, 308, 321, and 334; Hands levels 282, 295, 308, 321, and 334. | Head has source-checked 285/298/311/315/324 variants; Chest and Legs have source-checked 285/298/311/324 variants; Shoulders have source-checked 282/295/308/321 variants, alongside the existing 334 observation. Continue validating raid-difficulty and upgrade-track coverage for all five slots. |
| Monk | 17 observations | Head now has source-checked levels 285, 298, 311, 324, and 334; Shoulders have 282, 295, 308, 321, and 334; Chest and Hands 334; Hands also has a source-backed level-321 observation; Legs 311 and 334. | Added Monkey King’s Fighting Fists (271520) at item level 321: Agility/Intellect 125, Stamina 2,527, Haste 100, Versatility 42, from Wowhead; kept evidence-only. The level-334 Legs remain an equipped-profile observation. Complete remaining difficulty and upgrade-track mapping across all slots. |
| Paladin | 18 observations | Hands have item levels 282, 295, 308, 321, and 334; Shoulders have 282, 295, 308, 321, and 334; Chest has 308, 311, 321, and 334; Head has 321 and 334; Legs have 318 and 334. | Added Greaves of the Consecrated Flame (271464) at item level 318 (Strength 162, Stamina 3,254, Critical Strike 63, Haste 125), verified against the exact Wowhead item-level page. Existing chest observations include levels 308 and 311 with exact Wowhead URLs. All observations remain evidence-only; complete remaining difficulty and upgrade variants. |
| Priest | 25 observations | Head levels 285, 298, 311, 324, 334; Shoulders 282, 295, 308, 321, 334; Hands 282, 295, 305, 308, 321, 334; Chest levels 308, 311, 321, 334; Legs 285, 298, 311, 324, 334. | Added source-backed Enveloping Legwraps of the Cosmic Penitent (271554) at item levels 285, 298, 311, and 324 with exact stats from the Warcraft Wiki tier item listing. The 334 observation remains present. All remain evidence-only; complete remaining difficulty and upgrade-track variants across all five slots. |
| Rogue | 16 observations | Head, Shoulders, Chest, Hands, and Legs now each have a source-checked Mythic 6/6 version at item level 334; lower-rank observations are also recorded for Chest, Hands, Head, and Legs. | Chest (271513) and Hands (271511) now include exact Wowhead Mythic 6/6 level-334 stats. Continue checking source/version consistency for all five slots and complete the remaining difficulty and upgrade-track variants; all observations remain evidence-only. |
| Shaman | 30 baseline records + 25 evidence-only observations | Four PvE raid-difficulty variants per slot remain numeric and candidate-eligible; ten PvP appearance records lack verified numeric stats. Exact item-level-334 Mythic 6/6 observations exist for all five slots; Head 295/311/315/321, Shoulders 302/308/321, Chest 289/308/311/318/328, Hands 295/308/311/318/321, Legs 295/318/321. | The twenty-five observations are separate evidence-only records, not added to candidate-eligible baseline pieces. Keep PvP records appearance-only and continue filling the other intermediate upgrade ranks. |
| Warlock | 23 observations | Head levels 219, 285, 298, 305, 308, 311, 315, 318, 321, 324, and 334; Hands 331 and 334; Chest levels 311, 321, 324, 328, and 334; Shoulders 308, 311, 321, and 334; Legs 334. Shoulders 321: Intellect 125, Stamina 2,527, Haste 47, Versatility 96, sourced from Wowhead. All remain evidence-only. | Verify remaining head upgrades and missing variants across the five slots; Chest and shoulders still lack several difficulty and upgrade ranks. |
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

### Standard Mythic 6/6 (334) observation checklist

The current catalogue records at least one item-level-334 observation for all five tier slots across all 13 classes. This is **observation coverage only**, not a claim that every exact source version, stat profile, difficulty variant, or upgrade rank is fully verified. All non-Shaman observations remain evidence-only and must not become optimizer candidates.

| Class | Slots with a recorded 334 observation | Highest-priority variant gaps |
|---|---|---|
| Death Knight | Head, Shoulders, Chest, Hands, Legs | Complete the exact source-verified Raid Finder, Normal, Heroic, Mythic base variants and distinct upgrade ranks for all five slots. |
| Demon Hunter | Head, Shoulders, Chest, Hands, Legs | Complete difficulty and upgrade-rank maps; preserve the level-219 hands observation as a separate version, never as a replacement for 334. |
| Druid | Head, Shoulders, Chest, Hands, Legs | Complete difficulty and upgrade-rank maps; verify the provenance of each equipped-profile observation. |
| Evoker | Head, Shoulders, Chest, Hands, Legs | Complete difficulty and upgrade-rank maps for all five slots. |
| Hunter | Head, Shoulders, Chest, Hands, Legs | Head now has source-backed 308 and 311 observations in addition to 334; Shoulders now has a source-backed 321 observation in addition to 334. Chest still has only a 334 observation. Continue filling missing difficulty and upgrade ranks; all remain evidence-only. |
| Mage | Head, Shoulders, Chest, Hands, Legs | Complete difficulty and upgrade-rank maps; verify the exact version and stat provenance for every recorded observation. |
| Monk | Head, Shoulders, Chest, Hands, Legs | Chest has observations at 311, 324, and 334; Hands and Legs have sparse lower-rank evidence. Fill missing difficulty and upgrade ranks. |
| Paladin | Head, Shoulders, Chest, Hands, Legs | Head has 321 and 334; Legs has 318 and 334; Chest has 308, 311, 321, and 334 observations. Fill missing difficulty and upgrade ranks. |
| Priest | Head, Shoulders, Chest, Hands, Legs | Chest has 308, 311, 321, and 334; Legs now have 285, 298, 311, 324, and 334 observations. Fill remaining difficulty and upgrade ranks. |
| Rogue | Head, Shoulders, Chest, Hands, Legs | Shoulder has only a 334 observation; other slots also need complete difficulty and upgrade-rank maps. |
| Shaman | Head, Shoulders, Chest, Hands, Legs | Keep the 20 verified PvE candidate records separate from the 25 evidence-only observations; complete intermediate upgrade-rank mapping. |
| Warlock | Head, Shoulders, Chest, Hands, Legs | Legs have only a 334 observation; Shoulders have 308, 311, 321, and 334; Chest has 311, 321, 324, 328, and 334; Hands has 331 and 334. Fill missing difficulty and upgrade ranks. |
| Warrior | Head, Shoulders, Chest, Hands, Legs | Head has only a 334 observation; Hands and Legs have sparse lower-rank evidence. Keep the special 344 chest reward separate from standard Mythic 6/6 at 334. |

### Work sequence

1. For each class and tier slot, enumerate the required Raid Finder, Normal, Heroic, and Mythic versions plus distinct upgrade ranks exposed by the source.
2. Verify each exact item version against an item-specific source. Record item ID, slot, item level, numeric stats, source URL, and relevant bonus/upgrade identifiers. Never interpolate stats from another rank.
3. Keep Catalyst and dropped-item variants separate when their stats differ, even if they share a base item ID or item level.
4. Add regression tests for each confirmed item/version and explicit tests that missing or unverified variants cannot be marked complete or candidate-eligible.
5. Audit all 16 equipment slots and non-tier gear after the tier-set variant map is complete.
6. Keep partial evidence ineligible and numeric tier-bonus scoring disabled until independently verified.
7. Run catalogue and optimizer CI on this draft branch. Do not merge or deploy without explicit authorization.
