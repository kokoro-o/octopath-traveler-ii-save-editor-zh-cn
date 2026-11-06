> 以下为迁移前保留的功能设计与历史验证记录；部分本机专用集成/浏览器测试配置不随仓库发布。当前通用验证入口见 README 的 `npm run test:unit` 与 `npm run check`。

# Octopath Traveler II — stage A offline extraction

Stage A only. No application code, existing translations, inventory definitions,
save originals, dependencies, or game resources are modified. Nothing under
`src/` imports these tools. The 719 unlisted database rows remain non-editable.

## Inputs and output boundary

Requires the already-installed Node.js and project TypeScript dependency. Browser
checks use the existing system Chrome; do not install browsers or UE tools.

The supported input is the local Switch 1.1.1 PAK with SHA-256:

```
a0ffc52e458a36d74b7985cef02dd5c37c65e19ed69587125a429fb38b0dcee7
```

Game version is read from the supplied control.nacp. UE4.27 is prior binary
inspection evidence; the engine patch number remains unconfirmed. A different
PAK hash or version is rejected, not silently treated as compatible.

The PAK reader supports the observed standard v11 directory/path-hash indexes,
plain entries and Zlib blocks. It validates all three index hashes, directory
counts and entry bounds. Every extracted resource has its disk SHA-1 checked and
uncompressed SHA-256 recorded. It does not decompress every game asset.

Use a **new** output directory within `.local/ot2-stage-a/`. Existing run
directories are rejected. Raw exports are audit artifacts, not a stage B runtime
database. They are ignored by Git and must not be imported by the application.

## Reproduction

Run from the project directory. Substitute local absolute PAK and control paths:

```sh
node scripts/octopath-ii-items.mjs --pak "$OT2_PAK" --control "$OT2_CONTROL" \
  --out-dir .local/ot2-stage-a/NEW_SESSION/run-a
node scripts/octopath-ii-items.mjs --pak "$OT2_PAK" --control "$OT2_CONTROL" \
  --out-dir .local/ot2-stage-a/NEW_SESSION/run-b
node --test scripts/tests/octopath-ii-items.unit.test.mjs
OT2_PAK_PATH="$OT2_PAK" OT2_RUN_ROOT="$PWD/.local/ot2-stage-a/NEW_SESSION" \
  node --test scripts/tests/octopath-ii-items.integration.test.mjs
node scripts/tests/octopath-ii-stage-a-check.mjs --workspace "$PWD" \
  --out-dir "$PWD/.local/ot2-stage-a/NEW_SESSION/qa" \
  --chrome '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

Create `.local/ot2-stage-a/` first if absent. Integration tests require real
resource outputs and refuse to silently skip them. `OT2_RUN_A` and `OT2_RUN_B`
override the two run directory names. No command calls npm install or npx.

## Audit artifacts

* `tables/*.json`: all 14 necessary original tables, full property names and
  ordered layouts, byte offsets, types, size/index metadata and payload hashes.
* `selected-audit.json`: exactly the original 956 IDs, editorCategory and
  gameCategory kept separately, original field values and direct text references.
* `equipment-fields.json`: all 526 game-category equipment records, including
  ID 11159, and their 13 revision fields, values, types, zero/negative counts and
  original order. Also checks root property tags and the three equipment arrays.
* `unlisted-audit.json`: 719 IDs marked `editable: false`; no application options
  are expanded.
* `manifest.json`: input, baseline, extractor source and asset hashes; PAK info.
* `validation.json`: counts, 24 fixed assertions, 9 ambiguity assertions,
  description states, reference graph and explicit verification limitations.
* `enums.json`: original display map, native enumerator names/values and layout.
* `normalized-hashes.json`: deterministic hashes; arrays retain original order.
* `report.md`: extraction summary; the final session report includes test results.

## Evidence and limitations

The 24 expectations were manually recorded from the earlier read-only
investigation and retained reference records, not generated from this extractor.
Non-equipment sample stats and irrelevant contexts are marked not-applicable.
Equipment sample nonzero values plus explicitly verified remaining zero fields
assert the entire 13-field vector. Raw effect slots, including None slots, are
preserved in exports; fixed sample assertions compare active slots.

During implementation, manual transcription initially assumed the text key
suffix matched the row for IDs 302 and 10596. Four reference strings were wrong.
The failed assertion was retained; correction was supported by the earlier
in-memory source records and a direct tag/byte walk, not by generating new
expected output. The session retains the original baseline and correction
evidence. These IDs deliberately test non-mechanical text references.

The raw-byte audit checks serialization consistency, not a second UE tool. It
verifies 6,838 CharacterParam fields, preserving zero and negative signed ints,
and array sizes/order for Ailment, AttributeResist and DiseaseResist. Type/range
anomalies mean serialization/type/bounds anomalies; no undocumented semantic
maximum is invented. Original GUID-suffixed Blueprint field names remain intact.
Reference traversal distinguishes effects, skills and random preparation rows.

There are four different kinds of evidence:

1. Fixed historical sample assertions and prior asset SHA-256 values.
2. Automated structure, raw-byte, reference and repeat-run consistency checks.
3. PAK/index/resource hash verification.
4. Independent UE tool cross-validation — **not completed**.

Before stage B publishes a static database, independently check ItemDB/text
references, all equipment stat fields, AilmentData/DiseaseData, AbilityData,
SpecialItemDB and PreparationData using an approved separate tool. Any required
installation needs separate permission. No real-game runtime validation was done.
Raw 130/75/10, probability fields, random branch weights and runtime formulas are
not converted into verified percentages, multipliers or final outcomes.

## Isolation and regression interpretation

The QA runner copies application files into its new local output tree, links
existing dependencies, redirects Vite/SSR/browser caches and server logs, reserves
an unused localhost port, and forbids server reuse. Chrome uses a temporary
profile under the session. Original Steam/Switch save hashes are recorded before
and after. The browser receives only copied saves; downloads stay in test output.
It never uses existing `.local/test-saves/` as an output directory.

Type checking and Playwright run against the temporary copy. No current build or
live editor service is replaced. Desktop and mobile-layout emulation are tested;
this does not claim physical-device or real-game validation.

Two existing behaviors are deliberately documented, not fixed:

* No free inventory slot: `updateBackpackItem` throws TypeError. A passing
  reproduction test means the bug was reproduced, not repaired (stage D).
* Steam fixture without SubMemberID: existing onReady adds eight -1 entries.
  Strict original-vs-no-edit equality therefore remains an explicitly expected
  failure. A separate UI regression models only that exact initializer change
  when checking quantity edits; it does not permit arbitrary unrelated changes.

Stage A final reporting must list expected failures, earlier failed attempts and
tests not run. Do not summarize these as unconditional "all tests passed".

## File responsibilities

The CLI delegates to pak.mjs (read-only archive), uasset.mjs (bounded tagged
serialization), and extract-and-validate.mjs (white list, schemas, reference graph,
field audit, reports). Unit tests use synthetic bytes; integration tests use the
approved PAK and both persisted runs. The fixed JSON baseline is reviewable.
The QA runner/config isolate the existing tests and new save regression spec.

After stage A reporting, stop and await review. Do not implement B, C, D or E.
