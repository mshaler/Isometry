---
phase: 131-supergrid-defaults
verified: 2026-03-27T18:30:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 131: SuperGrid Defaults Verification Report

**Phase Goal:** SuperGrid auto-configures meaningful column/row axes per dataset type on first import
**Verified:** 2026-03-27T18:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | ViewDefaultsRegistry maps all 9 SourceType values plus alto_index catch-all to SuperGrid colAxes/rowAxes defaults | VERIFIED | `src/providers/ViewDefaultsRegistry.ts` — 10-entry frozen Map confirmed, test asserts all 10 keys present |
| 2  | Every default axis assignment validated through SchemaProvider.isValidColumn() before being set on PAFVProvider | VERIFIED | `resolveDefaults()` calls `schema.isValidColumn(candidate, 'cards')` for each candidate before returning; 15 tests confirm invariant |
| 3  | When an expected default column is missing, the next fallback in the priority list is used | VERIFIED | `resolveAxis()` iterates candidates in order and returns first valid; test "falls back to next candidate" confirms |
| 4  | If no fallback column is valid, the axis is left empty | VERIFIED | `resolveAxis()` returns `[]` when no candidate passes `isValidColumn`; test "returns empty axes when no colAxes candidates are valid" confirms |
| 5  | On first import, SuperGrid renders with source-type-appropriate axes without manual configuration | VERIFIED | Both `bridge.importFile` and `bridge.importNative` wrappers call `pafv.applySourceDefaults(source, schemaProvider)` inside the first-import flag gate |
| 6  | After manually changing axes, a "Reset to defaults" button appears in ProjectionExplorer footer | VERIFIED | `_updateResetButtonVisibility()` compares current axes vs `resolveDefaults()` result via JSON.stringify; button shown when they differ and defaults are non-empty |
| 7  | Clicking "Reset to defaults" shows AppDialog confirmation, then restores source-type defaults | VERIFIED | `_handleResetDefaults()` calls `AppDialog.show({ variant: 'confirm', title: 'Reset to Defaults', confirmLabel: 'Reset Axes', cancelLabel: 'Keep Current' })` then calls setColAxes/setRowAxes |
| 8  | Importing the same dataset a second time does NOT re-apply defaults | VERIFIED | `view:defaults:applied:{datasetId}` flag checked via `bridge.send('ui:get')` before applying; set via `bridge.send('ui:set', { value: '1' })` after first application. Both import wrappers gated. |
| 9  | The first-import flag `view:defaults:applied:{datasetId}` is set in ui_state after defaults are applied | VERIFIED | Both `bridge.importFile` and `bridge.importNative` wrappers set the flag after `applySourceDefaults` call |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/providers/ViewDefaultsRegistry.ts` | Static frozen Map + resolveDefaults + DefaultMapping interface | VERIFIED | 101 LOC; exports `VIEW_DEFAULTS_REGISTRY` (ReadonlyMap, 10 entries, Object.freeze'd), `resolveDefaults`, `DefaultMapping`; calls `schema.isValidColumn()` for every candidate |
| `tests/providers/ViewDefaultsRegistry.test.ts` | Registry lookup, fallback, prefix match, null schema tests (min 60 lines) | VERIFIED | 162 LOC; 15 tests covering all 7 behavior cases plus SGDF-06 flag key convention |
| `src/providers/PAFVProvider.ts` | `applySourceDefaults(sourceType, schema)` public method | VERIFIED | Method exists at line 308; imports `resolveDefaults` from `./ViewDefaultsRegistry`; calls `setColAxes`/`setRowAxes` when resolved axes are non-empty |
| `src/main.ts` | applySourceDefaults wired in both import wrappers + flag gate + activeSourceType tracking | VERIFIED | Both `importFile` (lines ~1438-1449) and `importNative` (lines ~1472-1483) wrappers contain flag gate pattern; `activeSourceType` closure variable set and passed to ProjectionExplorer |
| `src/providers/StateManager.ts` | `getActiveDatasetId()` public getter | VERIFIED | Public method at line 138 returns `this._activeDatasetId` |
| `src/ui/ProjectionExplorer.ts` | Reset button + `_updateResetButtonVisibility` + `_handleResetDefaults` + `getSourceType` config field | VERIFIED | All four present; `resolveDefaults` imported from `../providers/ViewDefaultsRegistry`; `AppDialog` imported; `getSourceType` is optional on config interface |
| `src/styles/projection-explorer.css` | Footer and reset button CSS rules | VERIFIED | `.projection-explorer__footer` and `.projection-explorer__reset-btn` rules added with hover/focus-visible states |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/providers/ViewDefaultsRegistry.ts` | `src/providers/SchemaProvider.ts` | `resolveDefaults()` calls `schema.isValidColumn(candidate, 'cards')` | WIRED | Pattern `isValidColumn` present in `resolveAxis()` at line 95 |
| `src/main.ts` | `src/providers/ViewDefaultsRegistry.ts` | `pafv.applySourceDefaults()` after import + flag gate | WIRED | Pattern `applySourceDefaults` + `view:defaults:applied` present in both import wrappers |
| `src/main.ts` | `WorkerBridge ui:get/ui:set` | Flag check before applySourceDefaults | WIRED | `bridge.send('ui:get', { key: flagKey })` + `bridge.send('ui:set', { key: flagKey, value: '1' })` in both wrappers |
| `src/ui/ProjectionExplorer.ts` | `src/providers/ViewDefaultsRegistry.ts` | `resolveDefaults` in `_updateResetButtonVisibility` + `_handleResetDefaults` | WIRED | `import { resolveDefaults } from '../providers/ViewDefaultsRegistry'` at line 20; called in both methods |
| `src/ui/ProjectionExplorer.ts` | `AppDialog.show` | Confirmation before reset | WIRED | `AppDialog.show({ variant: 'confirm', ... })` in `_handleResetDefaults()` |
| `src/main.ts` | `src/ui/ProjectionExplorer.ts` | `getSourceType: () => activeSourceType` wired in constructor config | WIRED | `getSourceType: () => activeSourceType` at line 1251; `schema: schemaProvider` at line 1245 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ProjectionExplorer` reset button | `resolveDefaults()` result | `VIEW_DEFAULTS_REGISTRY` static Map + `SchemaProvider.isValidColumn()` | Yes — static Map is compile-time; isValidColumn uses PRAGMA-derived schema | FLOWING |
| `PAFVProvider.applySourceDefaults` | `resolved.colAxes`, `resolved.rowAxes` | `resolveDefaults(sourceType, schema)` | Yes — validated against real schema before setting | FLOWING |
| First-import flag gate | `_fileFlagRow?.value` | `bridge.send('ui:get', { key: flagKey })` — reads from worker ui_state | Yes — bridge communicates with persistent sql.js database | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ViewDefaultsRegistry test suite | `npx vitest run tests/providers/ViewDefaultsRegistry.test.ts` | 15 tests pass, 142ms | PASS |
| TypeScript compilation | `npx tsc --noEmit` | No output (exit 0) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SGDF-01 | 131-01 | ViewDefaultsRegistry maps all 20 source types to SuperGrid axis defaults | SATISFIED | 10-entry frozen Map covering all 9 SourceType values + `alto_index` catch-all; `VIEW_DEFAULTS_REGISTRY.size === 10` confirmed by test |
| SGDF-02 | 131-01 | Every default axis validated through `SchemaProvider.isValidColumn()` before apply | SATISFIED | `resolveAxis()` calls `schema.isValidColumn(candidate, 'cards')` for each candidate; invariant tested across all registry keys |
| SGDF-03 | 131-01 | Graceful fallback when expected columns missing — renders best available instead of empty | SATISFIED | `resolveAxis()` iterates candidates in priority order; returns first valid or `[]`; tests confirm fallback and empty-result cases |
| SGDF-04 | 131-02 | Per-dataset override layer in ui_state allows user customization above source-type defaults | SATISFIED | First-import flag `view:defaults:applied:{datasetId}` prevents re-apply on subsequent imports; user axis changes persist |
| SGDF-05 | 131-02 | "Reset to defaults" action restores source-type defaults, clearing per-dataset overrides | SATISFIED | `_handleResetDefaults()` with AppDialog confirmation present; `_updateResetButtonVisibility()` shows button only when axes differ |
| SGDF-06 | 131-02 | Defaults applied on first import only — flag-gated by `view:defaults:applied:{datasetId}` | SATISFIED | Flag check in both `bridge.importFile` and `bridge.importNative` wrappers; set after `applySourceDefaults` call |

**All 6 SGDF requirements SATISFIED.**

Note: REQUIREMENTS.md describes SGDF-01 as mapping "20 source types" but the implementation maps 10 keys (9 SourceType union values + `alto_index` catch-all prefix). The `alto_index` key matches all `alto_index_*` variants via `startsWith()`, effectively covering the dynamic alto_index sub-types without enumerating each one. This is by design (D-07 decision documented in CONTEXT.md) and is functionally equivalent.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Checked for: TODO/FIXME/placeholder comments, `return null`/`return []` stub patterns, hardcoded empty data, console.log-only implementations. No blockers or warnings found.

---

### Human Verification Required

#### 1. First-import visual behavior

**Test:** Import a CSV or Apple Notes dataset for the first time into a fresh dataset slot. Switch to SuperGrid view.
**Expected:** Column axes show `card_type` (CSV) or `folder` (Apple Notes) and row axes show `name`/`title` respectively — without any manual configuration.
**Why human:** Requires running the native app with a real dataset import flow. Cannot verify the live PAFV rendering without a browser/app session.

#### 2. Reset button appears after manual axis change

**Test:** After the above first import, manually change the column or row axis chips in ProjectionExplorer. Observe the footer.
**Expected:** "Reset to defaults" button becomes visible in the ProjectionExplorer footer.
**Why human:** Requires live DOM interaction; button visibility is toggled via `display: none` → `display: ''` which cannot be verified statically.

#### 3. Second import does not overwrite axes

**Test:** Import the same dataset file a second time. Observe SuperGrid axes.
**Expected:** Axes remain unchanged (whatever the user last set). The `view:defaults:applied:{datasetId}` flag in ui_state prevents re-application.
**Why human:** Requires running the full import flow twice and observing UI state between runs.

---

### Gaps Summary

No gaps. All 9 observable truths are verified, all 7 artifacts exist and are substantive and wired, all 6 key links are confirmed, and all 6 SGDF requirements are satisfied. The implementation matches the plan's must_haves precisely.

The four commits (`3c76262a`, `46b19d8d`, `e9042858`, `02e172e0`) are present in the git log and correspond to the four tasks across both plans.

---

_Verified: 2026-03-27T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
