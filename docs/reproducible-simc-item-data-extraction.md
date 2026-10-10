# Reproducible SimulationCraft Item Data Extraction

## Purpose

This procedure obtains a build-specific ItemSparse export for auditing real client item records. It is deliberately separate from the production item importer: an audit export is not ready for production scoring until stat IDs, item variants, scaling, upgrades, sockets, and enhancements are verified.

## Source and version requirements

- Source project: [SimulationCraft](https://github.com/simulationcraft/simc), using its `midnight` branch for Midnight data.
- Record the exact client build and extraction date with every export.
- Use the `dbc_extract3` schema from the same SimulationCraft checkout as the extraction tools.
- Never label a file merely "current" without its exact client build.
- Do not check proprietary game data or extracted client files into this repository.

## Extraction

1. Obtain the matching World of Warcraft client DB2 files through a lawful local client-data workflow or the SimulationCraft CASC extraction tooling.
2. Confirm the extracted directory contains the matching build's `DBFilesClient/ItemSparse.db2`.
3. From the SimulationCraft checkout, run:

   ```bash
   python dbc_extract3/dbc_extract.py -t json -b '<EXACT_CLIENT_BUILD>' -p '<BUILD_DIR>/DBFilesClient' ItemSparse.db2 > ItemSparse.json
   ```

   Replace both placeholders with the actual build identifier and directory. Do not copy a sample or stale build identifier from documentation.

4. Audit the export with this repository's probe:

   ```bash
   python scripts/audit_simc_item_sparse.py ItemSparse.json --build '<EXACT_CLIENT_BUILD>' --output item-sparse-audit.json
   ```

5. Preserve the audit report with the build identifier and extraction timestamp in the verification record. Keep the raw export local; do not commit it.

## Interpreting fields safely

- Current SimulationCraft `ItemSparse` records expose stat pairs through `stat_type_1..10` and `stat_alloc_1..10`.
- The audit probe reports numeric stat type IDs without translating them into named stats. A numeric ID is not sufficient evidence for a stat mapping.
- Do not assume a base ItemSparse stat allocation is the final value for every item level, difficulty, upgrade rank, or bonus-list variant.
- A record with nonzero stats proves only that the export contains numeric allocations. It does not prove the catalog is complete or that an item can be scored correctly.
- Resolve item bonus lists, scaling, weapon data, sockets, gems, enchants, set bonuses, crafted modifiers, embellishments, and consumable effects against build-matched source data before enabling those effects in scoring.

## Production acceptance gate

Do not import this audit JSON directly into the live catalog. A production importer must have:

1. A documented, build-specific mapping from stat type IDs to supported optimizer stats.
2. Explicit handling for item variants, bonus lists, item level/scaling, upgrade context, and weapon damage/speed.
3. Coverage metrics for records, variants, stats, and enhancements, with failures on unexpected gaps.
4. Tests proving missing/unknown fields fail closed and that an item with no usable stats cannot receive a full score from item level alone.
5. Regression fixtures derived from a legally available, build-matched export and independently checked values.
6. Separate UI fields for Blizzard-reported current values, supported projected values, and their deltas.

Until those checks pass, keep the output in audit-only status and do not advertise numeric gear projections or Best-in-Slot claims.
