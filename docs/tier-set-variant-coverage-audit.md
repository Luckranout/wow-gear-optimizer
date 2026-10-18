# Midnight Season 2 Tier Variant Coverage Audit

Audit date: 2026-10-18
Branch: `fix/tier-catalogue-manifest-bridge`
Scope: source-verified numeric item variants needed before tier pieces can become optimizer candidates.

## Summary

- Base tier membership: **13/13 classes mapped**, with five base item IDs per class (65 total).
- Complete baseline PvE + Mythic 6/6 slot mapping: **12/13 classes** — Death Knight, Demon Hunter, Druid, Evoker, Hunter, Mage, Monk, Paladin, Priest, Rogue, Shaman, and Warlock. Warrior has 28 exact candidates but still lacks baseline Hands 282 and Legs 285/298/311/324. No class has complete rank-by-rank upgrade coverage yet.
- Verified Shaman PvE candidates: **20/20** (four PvE difficulty variants across five slots).
- Verified Death Knight PvE candidates: **25/25** (four baseline PvE difficulty variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Demon Hunter PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Druid verified candidates: **25/25** baseline/max-rank variants; the Legs item-level-334 Mythic 6/6 rank is cross-checked against a public equipped profile, with exact stats retained from item/stat sources.
- Monk verified candidates: **25/25** baseline/max-rank variants; the Legs item-level-334 Mythic 6/6 rank is cross-checked against a public equipped profile, with exact stats retained from item/stat sources.
- Verified Evoker PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Mage PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Priest PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Paladin PvE candidates: **25/25** (source-documented baseline PvE variants plus exact Mythic 6/6 item-level-334 variants across five slots).
- Verified Hunter PvE candidates: **25/25**; the source identifies the baseline Mythic Legs variant at item level 318, with the exact Mythic 6/6 variant at 334.
- Non-Shaman evidence-only observations: **340 records across 12 classes**. These observations remain distinct from candidate records and do not by themselves complete a variant map.
- Remaining baseline: Warrior still needs source-verified baseline Hands 282 and Legs 285/298/311/324; Hands 295/305/308/315/318/321/334 and Legs 282/289/321/334 are already exact candidates. Druid and Monk each need source-verified Mythic 6/6 Legs data to complete the 25-slot baseline/max-rank map. Exact intermediate-rank candidates have also been promoted for Death Knight, Demon Hunter, Druid, Mage, Paladin, Priest, Rogue, Shaman, Warlock, and Warrior where the source proves rank, item level, and stats. Missing ranks remain evidence-only.
- PvP appearances are not optimizer candidates unless their numeric item level and stats are independently verified.
- Do not enable numeric tier-bonus scoring without a separate trustworthy, simulation-backed scoring source.

## Class-by-class missing-items checklist

For every class marked incomplete below, all five slots still need a complete, source-verified variant map (Raid Finder, Normal, Heroic, Mythic, plus any distinct upgrade-track/item-level variants). The slot notes identify especially obvious gaps in current evidence; they do **not** mean the other slots are complete.

| Class | Current evidence | Highest-priority gaps | Required before eligibility |
|---|---:|---|---|
| Death Knight | 31 observations + 29 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants, plus an exact Mythic 6/6 item-level-334 candidate. Head: 285/298/311/324/334; Shoulders: 282/295/308/321/334; Chest: 285/298/311/324/334; Hands: 282/295/308/321/334; Legs: 285/298/311/324/334. | Added source-backed Breastplate (271477) Raid Finder 285 and Myth 3/6 324, plus Deathgrips (271475) Raid Finder 282, Normal 295, and Heroic 308. The 25 baseline/max-rank records cover four PvE difficulties plus Mythic 6/6 in all five slots. Four additional explicit rank records (Head 308/321, Chest 321, Hands 298) are candidates because exact level and stats are source-verified. Other ranks remain evidence-only until verified. |
| Demon Hunter | 32 observations + 31 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus Mythic 6/6 at item level 334. Head/Chest/Legs use 285/298/311/324 baseline levels; Shoulders/Hands use 282/295/308/321. | Promoted 25 source-backed records into candidates for the five baseline versions per slot, preserving the existing observation ledger. Exact item-level-334 Mythic 6/6 variants are included for every slot. Six additional exact intermediate-rank versions (Chest 321; Hands 305/311/324; Legs 295/318) are candidates. Full rank-by-rank upgrade mapping remains incomplete. |
| Druid | 28 observations + 26 candidates | All five slots now have four baseline difficulties plus source-verified Mythic 6/6 at 334. Legs 334 rank is cross-checked against an equipped-profile source; the observation ledger remains separate from optimizer candidates. One exact intermediate Head 321 candidate is also present. Other unverified intermediate ranks remain evidence-only. |
| Evoker | 25 observations + 25 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact item-level-334 Mythic 6/6 candidates. | Promoted 25 baseline/max-rank records plus the exact source-verified Head 315 Hero 4/6 version. Remaining unverified intermediate ranks stay evidence-only. |
| Hunter | 31 observations + 25 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact Mythic 6/6 at item level 334. The source-specific Mythic baseline for Legs is item level 318, not 324. | Added 11 exact baseline observations from the Warcraft Wiki set listing and promoted 25 exact observed versions into candidates. Intermediate upgrade ranks remain evidence-only. |
| Mage | 26 observations + 26 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact item-level-334 Mythic 6/6 candidates. Head also retains an additional item-level-315 observation. | Promoted 25 exact source-backed observations into candidates across the five baseline variants per slot. Numeric stats remain tied to their exact observed versions. Other intermediate upgrade ranks remain evidence-only and full rank-by-rank coverage is incomplete. |
| Monk | 25 observations + 25 candidates | All five slots now have four baseline difficulties plus source-verified Mythic 6/6 at 334. Legs 334 rank is cross-checked against an equipped-profile source; the observation ledger remains separate from optimizer candidates. Added seven exact baseline observations from the Warcraft Wiki tier-set listing. Other intermediate upgrade ranks remain evidence-only. |
| Paladin | 29 observations + 28 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact Mythic 6/6 at item level 334. | Added 11 exact source-backed Head, Chest, and Legs baseline records from the Warcraft Wiki tier-set listing, then promoted 25 baseline/max-rank versions plus exact Head 321, Chest 308, and Legs 318 rank candidates. Remaining unverified ranks stay evidence-only. |
| Priest | 28 observations + 27 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact item-level-334 Mythic 6/6 candidates. | Added source-backed chest observations at item levels 285, 298, and 324 from the Warcraft Wiki tier-set listing, then promoted 25 baseline/max-rank versions plus exact Chest 308 and 321 rank candidates. Other unverified ranks remain evidence-only. |
| Rogue | 30 observations + 27 candidates | All five slots have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact item-level-334 Mythic 6/6 candidates. | Added 10 exact Head, Chest, and Hands baseline records from the Warcraft Wiki set listing, then promoted baseline versions and two additional exact source-verified intermediate-rank versions into candidates. Intermediate upgrade ranks remain evidence-only and the full rank-by-rank map is unfinished. |
| Shaman | 25 observations + 28 candidates + 10 PvP appearance-only records | Four PvE raid-difficulty variants per slot remain numeric and candidate-eligible; ten PvP appearance records lack verified numeric stats. Exact item-level-334 Mythic 6/6 observations exist for all five slots; Head 295/311/315/321, Shoulders 302/308/321, Chest 289/308/311/318/328, Hands 295/308/311/318/321, Legs 295/318/321. | Eight additional source-verified rank records are now candidates alongside the 20 baseline PvE candidates. Ten PvP appearance-only records remain ineligible without numeric stats; other unverified ranks remain evidence-only. |
| Warlock | 36 observations + 31 candidates | All five slots now have source-backed Raid Finder, Normal, Heroic, and Mythic baseline variants plus exact item-level-334 Mythic 6/6 candidates. | Added 12 exact Shoulder, Chest, Hands, and Legs baseline records from the Warcraft Wiki item pages, then promoted baseline versions plus six exact source-verified intermediate-rank versions into candidates. Remaining unverified ranks stay evidence-only. |
| Warrior | 28 observations + 28 candidates | Head, Shoulders, and Chest have baseline difficulty candidates plus Mythic 6/6 at 334. Hands now have exact candidate variants at 295, 308, 318, 321 (dropped-item stat variant), and 334. Legs have exact candidates at 282, 289, 321, and 334. Baseline Hands 282 and Legs 285/298/311/324 remain missing. The separate item-level-344 chest variant remains distinct. | Added source-verified Hands 295/305/308/315/318 and Legs 282/289 records, promoting exact observed versions to candidates without inferring missing stats. Warrior remains partial until Hands 282 and Legs' baseline variants are source-verified. |

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
| Druid | Head, Shoulders, Chest, Hands, Legs | Baseline difficulty and 334 versions are source-verified across all five slots, including Legs Mythic 6/6 rank cross-checked against an equipped profile. |
| Evoker | Head, Shoulders, Chest, Hands, Legs | Complete intermediate upgrade-rank maps for all five slots; baseline difficulty variants and item-level-334 candidates are mapped. |
| Hunter | Head, Shoulders, Chest, Hands, Legs | Baseline and item-level-334 Mythic 6/6 candidates cover all five slots; Legs uses the source-verified Mythic baseline at 318. | Intermediate upgrade-rank mapping remains incomplete. |
| Mage | Head, Shoulders, Chest, Hands, Legs | Complete intermediate upgrade-rank maps for all five slots; baseline difficulty variants and item-level-334 candidates are mapped. |
| Monk | Head, Shoulders, Chest, Hands, Legs | Baseline difficulty and 334 versions are source-verified across all five slots, including Legs Mythic 6/6 rank cross-checked against an equipped profile. |
| Paladin | Head, Shoulders, Chest, Hands, Legs | Baseline and item-level-334 Mythic 6/6 candidates cover all five slots. | Intermediate upgrade-rank mapping remains incomplete. |
| Priest | Head, Shoulders, Chest, Hands, Legs | Complete intermediate upgrade-rank maps for all five slots; baseline difficulty variants and item-level-334 candidates are mapped. |
| Rogue | Head, Shoulders, Chest, Hands, Legs | Baseline and 334 observations exist across all five slots; remaining work is exact rank-by-rank upgrade variants. |
| Shaman | Head, Shoulders, Chest, Hands, Legs | Keep the 20 verified PvE candidate records separate from the 25 evidence-only observations; complete intermediate upgrade-rank mapping. |
| Warlock | Head, Shoulders, Chest, Hands, Legs | Baseline and 334 observations exist across all five slots; remaining work is exact rank-by-rank upgrade variants. |
| Warrior | Head, Shoulders, Chest, Hands, Legs | Standard item-level-334 observations exist across all five slots; missing baseline variants are Hands 282 and Legs 285/298/311/324. Keep the separate 344 chest variant distinct. |

### Work sequence

1. For each class and tier slot, enumerate the required Raid Finder, Normal, Heroic, and Mythic versions plus distinct upgrade ranks exposed by the source.
2. Verify each exact item version against an item-specific source. Record item ID, slot, item level, numeric stats, source URL, and relevant bonus/upgrade identifiers. Never interpolate stats from another rank.
3. Keep Catalyst and dropped-item variants separate when their stats differ, even if they share a base item ID or item level.
4. Add regression tests for each confirmed item/version and explicit tests that missing or unverified variants cannot be marked complete or candidate-eligible.
5. Audit all 16 equipment slots and non-tier gear after the tier-set variant map is complete.
6. Keep partial evidence ineligible and numeric tier-bonus scoring disabled until independently verified.
7. Run catalogue and optimizer CI on this draft branch. Do not merge or deploy without explicit authorization.


## Exact upgrade-rank gaps by slot

Candidate-level coverage only; observed-only records are deliberately excluded. The upgrade-level grid is Veteran/Champion/Hero/Myth track levels: 279, 282, 285, 289, 292, 295, 298, 302, 305, 308, 311, 315, 318, 321, 324, 328, 331, 334. A level listed as missing needs a source that proves both the exact item version and its numeric stats before it can become optimizer-eligible.

| Class | Slot | Candidate item levels | Missing item levels |
|---|---|---|---|
| Death Knight | Head | 285, 298, 308, 311, 321, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 315, 318, 328, 331 |
| Death Knight | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Death Knight | Chest | 285, 298, 311, 321, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 328, 331 |
| Death Knight | Hands | 282, 295, 298, 308, 321, 334 | 279, 285, 289, 292, 302, 305, 311, 315, 318, 324, 328, 331 |
| Death Knight | Legs | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Demon Hunter | Head | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Demon Hunter | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Demon Hunter | Chest | 285, 298, 311, 321, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 328, 331 |
| Demon Hunter | Hands | 282, 295, 305, 308, 311, 321, 324, 334 | 279, 285, 289, 292, 298, 302, 315, 318, 328, 331 |
| Demon Hunter | Legs | 285, 295, 298, 311, 318, 324, 334 | 279, 282, 289, 292, 302, 305, 308, 315, 321, 328, 331 |
| Druid | Head | 285, 298, 311, 321, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 328, 331 |
| Druid | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Druid | Chest | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Druid | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Druid | Legs | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Evoker | Head | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Evoker | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Evoker | Chest | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Evoker | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Evoker | Legs | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Hunter | Head | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Hunter | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Hunter | Chest | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Hunter | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Hunter | Legs | 285, 298, 311, 318, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 321, 324, 328, 331 |
| Mage | Head | 285, 298, 311, 315, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 318, 321, 328, 331 |
| Mage | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Mage | Chest | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Mage | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Mage | Legs | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Monk | Head | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Monk | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Monk | Chest | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Monk | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Monk | Legs | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Paladin | Head | 285, 298, 311, 321, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 328, 331 |
| Paladin | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Paladin | Chest | 285, 298, 308, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 315, 318, 321, 328, 331 |
| Paladin | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Paladin | Legs | 285, 298, 311, 318, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 321, 328, 331 |
| Priest | Head | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Priest | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Priest | Chest | 285, 298, 308, 311, 321, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 315, 318, 328, 331 |
| Priest | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Priest | Legs | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Rogue | Head | 285, 295, 298, 311, 324, 334 | 279, 282, 289, 292, 302, 305, 308, 315, 318, 321, 328, 331 |
| Rogue | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Rogue | Chest | 285, 298, 305, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 308, 315, 318, 321, 328, 331 |
| Rogue | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Rogue | Legs | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Shaman | Head | 285, 298, 311, 315, 321, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 318, 328, 331 |
| Shaman | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Shaman | Chest | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Shaman | Hands | 282, 295, 308, 318, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 324, 328, 331 |
| Shaman | Legs | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Warlock | Head | 285, 298, 308, 311, 318, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 315, 321, 328, 331 |
| Warlock | Shoulders | 282, 295, 308, 311, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 315, 318, 324, 328, 331 |
| Warlock | Chest | 285, 298, 311, 321, 324, 328, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 331 |
| Warlock | Hands | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Warlock | Legs | 285, 298, 305, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 308, 315, 318, 321, 328, 331 |
| Warrior | Head | 285, 298, 311, 324, 334 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Warrior | Shoulders | 282, 295, 308, 321, 334 | 279, 285, 289, 292, 298, 302, 305, 311, 315, 318, 324, 328, 331 |
| Warrior | Chest | 285, 298, 311, 324, 334, 344 | 279, 282, 289, 292, 295, 302, 305, 308, 315, 318, 321, 328, 331 |
| Warrior | Hands | 295, 305, 308, 315, 318, 321, 334 | 279, 282, 285, 289, 292, 298, 302, 311, 324, 328, 331 |
| Warrior | Legs | 282, 289, 321, 334 | 279, 285, 292, 295, 298, 302, 305, 308, 311, 315, 318, 324, 328, 331 |
