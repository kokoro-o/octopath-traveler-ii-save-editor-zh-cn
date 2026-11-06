# OT2 save editor dictionaries — stage one

This stage adds offline parsing and static dictionaries only. It does not edit
GVAS saves, `BackupLearnAbility`, editor UI, or game resources.

## Export

Run from the repository root, using the local PAK and matching `control.nacp`:

```sh
node scripts/octopath-ii-save-dictionaries.mjs \
  --pak "$OT2_PAK_PATH" \
  --control "$OT2_CONTROL_PATH" \
  --out-dir src/lib/templates/octopath-traveler-ii/saveEditor/data
```

The exporter verifies the Switch 1.1.1 PAK against the existing stage-A baseline,
checks source hashes again before writing, and emits only these three files:

| File | Content |
| --- | --- |
| `learnedAbilities.json` | 191 entries, keyed by `AbilitySetData.AbilitySetID`, with name, ID, raw cost, cost type and complete official description |
| `monsters.json` | 500 entries, keyed by `InvadeData.ID`: 488 `normal`, 6 `legend`, 6 `partner` |
| `saveDictionaries.report.json` | Source asset hashes, ID/name provenance, inclusion rules, exclusions, missing references and verification limits |

Identical reruns do not rewrite files. Differing existing exports cause a failure
before any output is written; use a new output directory when comparing changes.

## Inclusion and ID rules

- Skill names resolve through `AbilitySetData.NoBoost` → `AbilityData.DisplayName`
  → `GameTextZH_CN`. Neither table row IDs nor `AbilityData.ID` are save skill IDs.
- `description` resolves `AbilityData.Detail` without truncating or flattening
  newlines. `spCost` retains `CostValue`; `costType` distinguishes fixed SP,
  leaves and percentage SP, so money skills are never labelled as SP costs.
- Normal monsters must be referenced by an `EnemyDB` row with `TameEnable=true`;
  the reference is `InvadeMonsterID`. NPC-flagged summons are excluded.
- Legend and partner categories use the original `LegendFlag` and `PartnerFlag`.
  These flags classify database rows, not a recommendation for placing partners
  into ordinary monster slots.
- `enemyId` is the chosen `InvadeData.ID` dictionary key. `invadeId` retains the
  distinct `InvadeID` as metadata. Runtime save-to-monster mapping is not verified.
- `countMin`, `countMax`, `unlimited` and `displayLevel` are database metadata,
  not extra save fields or proof that a save `Count=-1` grants unlimited summons.
- `rank` is `InvadeData.DisplayLevel` (0–10). Every non-None `AbilityList` reference
  resolves to its AbilitySetData.NoBoost ability; all skill names are retained.
  `skillDesc` combines the official `InvadeData.DetailText` with weapon, element,
  target and ability-type summaries. These are attack types, not enemy weaknesses
  or complete damage/effect formulas. Self-target attack wrappers are described
  as special summon actions rather than falsely claiming they damage the user.
- `meatItem` resolves `ProcessedItem` → `ItemDB.ItemNameID` → official Chinese
  text only when `EnableProcess` is true; otherwise it is an empty string.
- Empty slots are not catalogue entries. Future UI must preserve unknown numeric
  IDs and use `-1` for empty learned skills or `{ EnemyID: -1, Count: 0, Used: false }`
  for explicitly cleared monster slots.

All 565 InvadeData rows are accounted for: 500 included; 54 NPC/skill summons,
10 other unlinked rows, and one DUMMY are recorded only in the report. Additionally,
three EnemyDB references have no InvadeData row: `ENE_NML_DRK_010`, `_020`, `_030`.
The user explicitly approved excluding those exact three references. Other missing
capturable references remain fatal. The 59 distinct unresolved NPC learned-skill
references are audited, and never converted into invented skill IDs.

## Validation

```sh
node --test scripts/tests/octopath-ii-items.unit.test.mjs \
  scripts/tests/octopath-ii-native-structs.unit.test.mjs \
  scripts/tests/octopath-ii-save-dictionaries.unit.test.mjs

OT2_DICTIONARY_OUTPUT=src/lib/templates/octopath-traveler-ii/saveEditor/data \
  node --test scripts/tests/octopath-ii-save-dictionaries.integration.test.mjs
```

The integration command also requires `OT2_PAK_PATH` in the environment. It reparses
the real source, checks ID/name anchors, exclusions and asset/export hashes. It
does not start the game or replace independent UE-tool verification. Native
Vector, Vector2D, Rotator and LinearColor structs are decoded as ordered float
components; malformed sizes and non-finite floats fail instead of being skipped.
