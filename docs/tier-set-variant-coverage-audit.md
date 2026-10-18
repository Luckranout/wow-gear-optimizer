# Midnight Season 2 Tier Variant Coverage Audit

Audit date: 2026-10-18
Branch: `fix/tier-catalogue-manifest-bridge`
Scope: source-verified numeric item variants needed before tier pieces can become optimizer candidates.

## Summary

- Base tier membership: **13/13 classes mapped**, with five base item IDs per class (65 total).
- Complete baseline PvE candidate mapping: **7/13 classes** — Death Knight, Demon Hunter, Evoker, Mage, Paladin, Priest, and Shaman. Druid and Monk each still lack a source-verified Mythic 6/6 Legs record; four other classes still lack complete baseline candidate maps.
- Verified Shaman PvE candidates: **20/20** (four PvE difficulty variants across five slots).
- Verified Death Knight PvE candidates: **25/25** (four baseline PvE difficulty variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Demon Hunter PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Druid verified candidates: **24/25**; Legs at item level 334 remains evidence-only because the source does not verify the upgrade rank.
- Monk verified candidates: **24/25**; Legs at item level 334 remains evidence-only because the source does not verify the upgrade rank.
- Verified Evoker PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Mage PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Priest PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Paladin PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Non-Shaman evidence-only observations: **309 records across 12 classes**. These are useful evidence, not complete variant maps.
- Remaining baseline: four classes—Hunter, Rogue, Warlock, and Warrior—still need complete baseline candidate maps across all 20 slots (up to 80 baseline PvE difficulty records). Druid and Monk each need source-verified Mythic 6/6 Legs data before their 25-slot maps are complete. The seven complete baseline maps are Death Knight, Demon Hunter, Evoker, Mage, Paladin, Priest, and Shaman. Intermediate upgrade-rank mapping remains incomplete across all classes and must use exact source data.
- PvP appearances are not optimizer candidates unless their numeric item level and stats are independently verified.
- Do not enable numeric tier-bonus scoring without a separate trustworthy, simulation-backed scoring source.

## Class-by-class missing-items checklist

For every class marked incomplete below, all five slots still need a complete, source-verified variant map (Raid Finder, Normal, Heroic, Mythic, plus any distinct upgrade-track/item-level variants). The slot notes identify especially obvious gaps in current evidence; they do **not** mean the other slots are complete.

| Class | Current evidence | Highest-priority gaps | Required before eligibility |
|---|---:|---|---|
| Death Knight | 31 observations + 25 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants, plus an exact Mythic 6/6 item-level-334 candidate. Head: 285/298/311/324/334; Shoulders: 282/295/308/321/334; Chest: 285/298/311/324/334; Hands: 282/295/308/321/334; Legs: 285/298/311/324/334. | Added source-backed Breastplate (271477) Raid Finder 285 and Myth 3/6 324, plus Deathgrips (271475) Raid Finder 282, Normal 295, and Heroic 308. The 25 eligible records are the four baseline PvE difficulty versions plus Mythic 6/6 at item level 334 for each of the five slots. Numeric stats come from exact item-version records in the Warcraft Wiki/ Wowhead data. Other intermediate upgrade-rank observations remain evidence-only until their exact level and stats are verified. |
| Demon Hunter | 32 observations + 25 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus Mythic 6/6 at item level 334. Head/Chest/Legs use 285/298/311/324 baseline levels; Shoulders/Hands use 282/295/308/321. | Promoted 25 source-backed records into candidates for the five baseline versions per slot, preserving the existing observation ledger. Exact item-level-334 Mythic 6/6 variants are included for every slot. Other intermediate upgrade-rank observations remain evidence-only; full rank-by-rank upgrade mapping is still incomplete. |
| Druid | 28 observations + 24 candidates | Head, Shoulders, Chest, and Hands have all four baseline difficulties plus source-verified Mythic 6/6 at 334. Legs have all four baseline difficulties, but the item-level-334 observation does not independently verify Mythic 6/6. | Promoted 24 exact source-backed observations into candidates. Kept Legs at item level 334 evidence-only because the source does not establish its upgrade rank. Other intermediate upgrade ranks remain evidence-only. |
| Evoker | 25 observations + 25 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact item-level-334 Mythic 6/6 candidates. | Promoted 25 exact source-backed observations into candidates across the five baseline variants per slot. Numeric stats remain tied to their exact observed versions. Other intermediate upgrade ranks remain evidence-only and full rank-by-rank coverage is incomplete. |
| Hunter | 20 observations | All five slots have level-334 observations: Chest (271495; item levels 311, 324, and 334), Head (271492), Shoulders (271490), Legs (271491), and Hands (271493). Chest Mythic 3/6 at item level 324 is now recorded with Agility 172, Stamina 3,487, Haste 61, and Mastery 132 from the Warcraft Wiki tier listing. Hands include item levels 295, 308, 321, and 334; the 308 Hero 2/6 tooltip records Agility 111, Stamina 2,172, Haste 89, and Versatility 46. The 334 hands tooltip records Agility/Intellect 141, Stamina 2,932, Haste 99, and Versatility 52. All observations remain evidence-only. | Continue verifying remaining difficulty/upgrade variants across all five slots; keep unverified observations ineligible. |
| Mage | 26 observations + 25 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact item-level-334 Mythic 6/6 candidates. Head also retains an additional item-level-315 observation. | Promoted 25 exact source-backed observations into candidates across the five baseline variants per slot. Numeric stats remain tied to their exact observed versions. Other intermediate upgrade ranks remain evidence-only and full rank-by-rank coverage is incomplete. |
| Monk | 25 observations + 24 candidates | Head, Shoulders, Chest, and Hands have all four baseline difficulties plus source-verified Mythic 6/6 at 334. Legs now have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants; the item-level-334 observation still does not independently verify Mythic 6/6. | Added seven exact baseline observations from the Warcraft Wiki tier-set listing and promoted 24 exact source-backed observations into candidates. Kept Legs at item level 334 evidence-only until its upgrade rank is source-verified. Other intermediate upgrade ranks remain evidence-only. |
| Paladin | 29 observations + 25 candidates | Hands have item levels 282, 295, 308, 321, and 334; Shoulders have 282, 295, 308, 321, and 334; Chest has 308, 311, 321, and 334; Head has 321 and 334; Legs have 318 and 334. | Added Greaves of the Consecrated Flame (271464) at item level 318 (Strength 162, Stamina 3,254, Critical Strike 63, Haste 125), verified against the exact Wowhead item-level page. Existing chest observations include levels 308 and 311 with exact Wowhead URLs. All observations remain evidence-only; complete remaining difficulty and upgrade variants. |
| Priest | 28 observations + 25 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact item-level-334 Mythic 6/6 candidates. | Added source-backed chest observations at item levels 285, 298, and 324 from the Warcraft Wiki tier-set listing, then promoted 25 exact observed versions into candidates. Other intermediate upgrade ranks remain evidence-only and full rank-by-rank coverage is incomplete. |
| Rogue | 20 observations | Head, Shoulders, Chest, Hands, and Legs each have a level-334 observation. Shoulders (271508) now also have source-backed levels 282, 295, 308, and 321; lower-rank observations are recorded for Chest, Hands, Head, and Legs. | Added Veteran 2/6, Champion 2/6, Hero 2/6, and Myth 2/6 shoulder versions from the Warcraft Wiki tier item page, preserving exact stats and evidence-only status. Continue checking source/version consistency and filling remaining difficulty and upgrade-track variants. |
| Shaman | 30 baseline records + 25 evidence-only observations | Four PvE raid-difficulty variants per slot remain numeric and candidate-eligible; ten PvP appearance records lack verified numeric stats. Exact item-level-334 Mythic 6/6 observations exist for all five slots; Head 295/311/315/321, Shoulders 302/308/321, Chest 289/308/311/318/328, Hands 295/308/311/318/321, Legs 295/318/321. | The twenty-five observations are separate evidence-only records, not added to candidate-eligible baseline pieces. Keep PvP records appearance-only and continue filling the other intermediate upgrade ranks. |
| Warlock | 24 observations | Head levels 219, 285, 298, 305, 308, 311, 315, 318, 321, 324, and 334; Hands 331 and 334; Chest levels 311, 321, 324, 328, and 334; Shoulders 308, 311, 321, and 334; Legs 305 and 334. Legs 305 (Champion 5/6): Intellect 144, Stamina 2,794, Haste 125, Mastery 53, sourced from the exact item-level Wowhead tooltip. All remain evidence-only. | Verify remaining head upgrades and missing variants across all five slots; continue source-checking lower difficulty and upgrade ranks. |
| Warrior | 21 observations | Head (271456) now has source-backed item levels 285, 298, 311, 324, and 334, covering Veteran 3/6, Champion 3/6, Hero 3/6, Myth 3/6, and Mythic 6/6 observations. Shoulders, Chest, Hands, and Legs also have level-334 observations. Legs (271455) have Strength 189, Stamina 3,910, Versatility 135, and Mastery 66; lower-rank observations exist for Shoulders, Chest, Hands, and Legs. | Added Tempered Horns (271456) levels 285, 298, and 311 from the Warcraft Wiki tier item page with exact stats; all four lower/base observations remain evidence-only. Continue filling missing difficulty and upgrade-track variants; no observation becomes an optimizer candidate from this change. |

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
| Druid | Legs | The item-level-334 Legs observation lacks source-verified upgrade-rank evidence; verify Mythic 6/6 before promoting it. |
| Evoker | Head, Shoulders, Chest, Hands, Legs | Complete intermediate upgrade-rank maps for all five slots; baseline difficulty variants and item-level-334 candidates are mapped. |
| Hunter | Head, Shoulders, Chest, Hands, Legs | Head now has source-backed 308 and 311 observations in addition to 334; Shoulders now has a source-backed 321 observation in addition to 334. Chest still has only a 334 observation. Continue filling missing difficulty and upgrade ranks; all remain evidence-only. |
| Mage | Head, Shoulders, Chest, Hands, Legs | Complete intermediate upgrade-rank maps for all five slots; baseline difficulty variants and item-level-334 candidates are mapped. |
| Monk | Legs | The item-level-334 Legs observation lacks source-verified upgrade-rank evidence; verify Mythic 6/6 before promoting it. |
| Paladin | Head, Shoulders, Chest, Hands, Legs | Head has 321 and 334; Legs has 318 and 334; Chest has 308, 311, 321, and 334 observations. Fill missing difficulty and upgrade ranks. |
| Priest | Head, Shoulders, Chest, Hands, Legs | Complete intermediate upgrade-rank maps for all five slots; baseline difficulty variants and item-level-334 candidates are mapped. |
| Rogue | Head, Shoulders, Chest, Hands, Legs | Shoulders now have levels 282, 295, 308, 321, and 334; other slots still need complete difficulty and upgrade-rank maps. |
| Shaman | Head, Shoulders, Chest, Hands, Legs | Keep the 20 verified PvE candidate records separate from the 25 evidence-only observations; complete intermediate upgrade-rank mapping. |
| Warlock | Head, Shoulders, Chest, Hands, Legs | Legs have only a 334 observation; Shoulders have 308, 311, 321, and 334; Chest has 311, 321, 324, 328, and 334; Hands has 331 and 334. Fill missing difficulty and upgrade ranks. |
| Warrior | Head, Shoulders, Chest, Hands, Legs | Head now has levels 285, 298, 311, 324, and 334; Hands and Legs have sparse lower-rank evidence. Keep the special 344 chest reward separate from standard Mythic 6/6 at 334. |

### Work sequence

1. For each class and tier slot, enumerate the required Raid Finder, Normal, Heroic, and Mythic versions plus distinct upgrade ranks exposed by the source.
2. Verify each exact item version against an item-specific source. Record item ID, slot, item level, numeric stats, source URL, and relevant bonus/upgrade identifiers. Never interpolate stats from another rank.
3. Keep Catalyst and dropped-item variants separate when their stats differ, even if they share a base item ID or item level.
4. Add regression tests for each confirmed item/version and explicit tests that missing or unverified variants cannot be marked complete or candidate-eligible.
5. Audit all 16 equipment slots and non-tier gear after the tier-set variant map is complete.
6. Keep partial evidence ineligible and numeric tier-bonus scoring disabled until independently verified.
7. Run catalogue and optimizer CI on this draft branch. Do not merge or deploy without explicit authorization.
