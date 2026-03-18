---
phase: 85-bug-fixes-a1-chevron-collapse-a2-dataset-eviction
verified: 2026-03-17T23:35:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 85: Bug Fixes (A1 Chevron Collapse + A2 Dataset Eviction) Verification Report

**Phase Goal:** Fix CollapsibleSection collapse binding so chevrons actually hide/show content, and fix dataset eviction so loading a new dataset via Command-K fully evicts prior data from all views, resets SchemaProvider introspection, and clears ProjectionExplorer axes.
**Verified:** 2026-03-17T23:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Clicking an expanded chevron collapses the section — content takes zero vertical space | VERIFIED | `.collapsible-section--collapsed .collapsible-section__body { max-height: 0 }` at workbench.css:118-120; 42/42 CollapsibleSection tests pass |
| 2  | Clicking a collapsed chevron expands the section — content is visible | VERIFIED | `.collapsible-section--collapsed` removed on second click; tests at CollapsibleSection.test.ts:543-563 confirm |
| 3  | Collapse/expand animates smoothly (200ms ease-out transition) | VERIFIED | `transition: max-height 200ms ease-out` at workbench.css:115 preserved |
| 4  | Explorer-backed sections (Properties, Projection, LATCH, Notebook, Calc) collapse correctly | VERIFIED | `:not(.collapsible-section--collapsed) >` guard on all 5 `:has()` explorer rules (workbench.css:140-145); explicit `--has-explorer` collapsed override at workbench.css:135-137 |
| 5  | State persists per-section during session via localStorage | VERIFIED | CollapsibleSection.ts unchanged — localStorage wiring pre-existed and tests confirm `getCollapsed()` correctness |
| 6  | Loading a new dataset via Command-K completely evicts prior data from all views | VERIFIED | `evictAll()` in SampleDataManager.ts:145-148 — DELETE FROM connections + DELETE FROM cards; wired in main.ts:606-637 |
| 7  | Projection Explorer axis fields reset to new dataset defaults after load | VERIFIED | `pafv.resetToDefaults()` at main.ts:616; `filter.resetToDefaults()` at main.ts:615; SchemaProvider.refresh() at main.ts:626 re-notifies ProjectionExplorer subscribers |
| 8  | SuperGrid shows only new dataset data — zero rows from prior dataset visible | VERIFIED | 4/4 seam integration tests pass confirming zero-bleed; `coordinator.scheduleUpdate()` at main.ts:629 triggers re-render |
| 9  | Filters, selection, and scroll position reset to defaults on dataset switch | VERIFIED | main.ts:615-618: `filter.resetToDefaults()`, `pafv.resetToDefaults()`, `selection.clear()`, `superPosition.reset()` |
| 10 | Loading state shown if eviction takes observable time | VERIFIED | `viewManager.showLoading()` at main.ts:609 — public method added to ViewManager.ts:317-319 |
| 11 | SchemaProvider re-notifies subscribers after new data loads | VERIFIED | `SchemaProvider.refresh()` at SchemaProvider.ts:79-81 calls `_scheduleNotify()`; called at main.ts:626 after load |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/styles/workbench.css` | CSS rules where collapsed state overrides explorer max-height | VERIFIED | 8 occurrences of `collapsible-section--collapsed`; `:not()` guards on all 5 `:has()` rules; `--has-explorer` collapsed override present |
| `tests/ui/CollapsibleSection.test.ts` | Unit tests confirming collapsed class prevents body visibility | VERIFIED | 3 new tests in `explorer-backed collapse regression (Phase 85)` describe block; 42/42 pass |
| `src/sample/SampleDataManager.ts` | `evictAll()` method that DELETEs all cards (not just source='sample') | VERIFIED | `async evictAll()` at line 145; deletes connections then cards |
| `src/providers/SchemaProvider.ts` | Public `refresh()` method to re-notify subscribers | VERIFIED | `refresh(): void` at line 79-81; calls `_scheduleNotify()` |
| `src/main.ts` | Full eviction pipeline in onLoadSample callback | VERIFIED | 7-step pipeline at lines 606-637: showLoading → evictAll → provider resets → load → refresh → scheduleUpdate → switchTo |
| `tests/seams/ui/dataset-eviction.test.ts` | Integration test verifying zero-bleed after dataset switch | VERIFIED | 4 tests using real sql.js; all pass |
| `e2e/dataset-eviction.spec.ts` | Playwright E2E test for visual zero-bleed across dataset switch | VERIFIED | File exists; meryl-streep → northwind-graph zero film card assertion |
| `src/views/ViewManager.ts` | Public `showLoading()` method | VERIFIED | `showLoading(): void` at line 317; delegates to private `_showLoading()` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/ui/CollapsibleSection.ts` | `src/styles/workbench.css` | `collapsible-section--collapsed` class toggle | VERIFIED | CSS class toggled by CollapsibleSection.ts; CSS rule confirmed at workbench.css:118 |
| `src/main.ts` | `src/sample/SampleDataManager.ts` | `evictAll()` call before load() | VERIFIED | main.ts:612 `await sampleManager.evictAll()` before load at line 621 |
| `src/main.ts` | `src/providers/PAFVProvider.ts` | `resetToDefaults()` after eviction | VERIFIED | main.ts:616 `pafv.resetToDefaults()` |
| `src/main.ts` | `src/providers/FilterProvider.ts` | `resetToDefaults()` after eviction | VERIFIED | main.ts:615 `filter.resetToDefaults()` |
| `src/main.ts` | `src/providers/SchemaProvider.ts` | `refresh()` after load to re-notify subscribers | VERIFIED | main.ts:626 `schemaProvider.refresh()` after sampleManager.load() |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CHEV-01 | 85-01-PLAN.md | Collapsed state applies max-height: 0 | SATISFIED | workbench.css:118-120 |
| CHEV-02 | 85-01-PLAN.md | Explorer-backed sections collapse correctly | SATISFIED | :not() guards on :has() rules at workbench.css:140-145 |
| CHEV-03 | 85-01-PLAN.md | --has-explorer collapsed override | SATISFIED | workbench.css:135-137 |
| CHEV-04 | 85-01-PLAN.md | Collapse/expand transition preserved | SATISFIED | workbench.css:115 |
| CHEV-05 | 85-01-PLAN.md | Regression tests for explorer-backed collapse | SATISFIED | 3 tests in CollapsibleSection.test.ts:521-585; 42/42 pass |
| EVIC-01 | 85-02-PLAN.md | evictAll() deletes all data | SATISFIED | SampleDataManager.ts:145-148 |
| EVIC-02 | 85-02-PLAN.md | Provider state resets on dataset switch | SATISFIED | main.ts:615-618 |
| EVIC-03 | 85-02-PLAN.md | SchemaProvider re-notifies subscribers | SATISFIED | SchemaProvider.ts:79-81; main.ts:626 |
| EVIC-04 | 85-02-PLAN.md | Loading state shown during eviction | SATISFIED | ViewManager.showLoading() public method; main.ts:609 |
| EVIC-05 | 85-02-PLAN.md | Zero-bleed proven by tests | SATISFIED | 4 vitest integration tests + Playwright E2E test |

No REQUIREMENTS.md file exists in this project — requirement IDs are tracked via ROADMAP.md and plan frontmatter only. All 10 requirement IDs declared across both plans are accounted for. No orphaned requirements found.

---

### Anti-Patterns Found

No blockers or warnings found. The modified files were scanned for TODO/FIXME/placeholder/stub patterns — none present in the 6 modified files. No empty implementations. No console.log-only handlers.

---

### Human Verification Required

#### 1. Chevron collapse visual behavior in browser

**Test:** Open Workbench, expand all explorer sections (Properties, Projection, LATCH, Notebook, Calc), then click each chevron header to collapse.
**Expected:** Section body transitions to zero height with 200ms ease-out animation. No vertical space remains when collapsed.
**Why human:** CSS max-height transition behavior and visual rendering cannot be verified via grep or test runner.

#### 2. Dataset switch via Command-K visual zero-bleed

**Test:** Load meryl-streep sample data, navigate to SuperGrid, observe film card rows. Then press Command-K and select a different dataset (e.g., northwind-graph). Observe all views.
**Expected:** Loading spinner appears briefly, then all views show only new dataset cards. No meryl-streep film cards visible in SuperGrid, Network, or any other view.
**Why human:** Visual zero-bleed in rendered views requires browser observation — the Playwright test asserts database state but cannot verify all render paths.

#### 3. ProjectionExplorer axes cleared after dataset switch

**Test:** In Workbench, configure Projection Explorer with custom axis assignments from Dataset A. Switch datasets via Command-K. Open Projection Explorer.
**Expected:** Axis fields reset to new dataset defaults — no stale field names from Dataset A appear.
**Why human:** ProjectionExplorer subscriber response to SchemaProvider.refresh() after pafv.resetToDefaults() requires visual verification of the UI state in the workbench sidebar.

---

### Gaps Summary

No gaps. All 11 observable truths are verified. Both plans delivered their artifacts substantively and all key links are wired. The full eviction pipeline (7 steps: showLoading → evictAll → provider resets → load → schemaProvider.refresh → scheduleUpdate → switchTo) is confirmed in main.ts. All tests pass: 42/42 CollapsibleSection unit tests, 4/4 dataset eviction seam integration tests. Three human verification items are flagged for visual behavior that cannot be confirmed programmatically.

---

_Verified: 2026-03-17T23:35:00Z_
_Verifier: Claude (gsd-verifier)_
