---
phase: 159-dataexplorer-catalog-completion
plan: "02"
subsystem: DataExplorer / CatalogSuperGrid
tags: [catalog, reimport, file-picker, web-source]
dependency_graph:
  requires: [159-01]
  provides: [EXPX-05, EXPX-06]
  affects: [src/main.ts]
tech_stack:
  added: []
  patterns: [else-branch delegation to importFileHandler]
key_files:
  created: []
  modified:
    - src/main.ts
decisions:
  - "Web source reimport delegates to importFileHandler() — no custom reimport-into-same-dataset pathway needed"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-18"
  tasks: 2
  files_modified: 1
requirements: [EXPX-05, EXPX-06]
---

# Phase 159 Plan 02: Web Source Reimport + Delete Verification Summary

**One-liner:** Web source reimport now calls `importFileHandler()` via a new else branch in `onReimportDataset`, completing reimport support for all dataset types; delete confirmation wiring verified correct with no changes needed.

## Tasks Completed

| Task | Description | Commit | Files |
| ---- | ----------- | ------ | ----- |
| 1    | Add else branch for web source reimport in onReimportDataset | `5af4ce54` | src/main.ts |
| 2    | Verify delete and reimport E2E readiness (no code changes) | — | — |

## What Was Built

### Task 1: Web Source Reimport

Added `else` branch in `onReimportDataset` callback in `src/main.ts` after the two existing native paths:

```typescript
} else {
  // Web source re-import: open file picker so user can select updated file
  // importFileHandler handles file selection, parsing, and coordinator update
  importFileHandler?.();
}
```

**Before:** Clicking reimport on a web-sourced dataset (json/csv/excel/markdown/html) was a silent no-op — the `onReimportDataset` callback only handled native `alto_index_*` sources.

**After:** Web source reimport opens the standard file picker (`importFileHandler`). The existing import flow handles file selection, parsing, and coordinator updates. Native reimport paths (directory path stored and discovery fallback) are unchanged.

### Task 2: Verification (No Code Changes)

Verified the following wiring in `CatalogSuperGrid.ts` and `main.ts`:

**Action button rendering (`_renderActionButtons`):**
- Reimport button: `data-action="reimport"`, `data-dataset-id={rowKey}`, aria-label
- Delete button: `data-action="delete"`, `data-dataset-id={rowKey}`, aria-label
- Both rendered in wrapper div inside the actions cell

**Click handler routing (mount's delegated listener):**
- `action === 'delete'` → `config.onDeleteDataset(datasetId, name, cardCount)`
- `action === 'reimport'` → `config.onReimportDataset(datasetId, name, sourceType)`
- Dataset name and sourceType looked up from `lastDatasets` by datasetId

**onDeleteDataset in main.ts:**
- AppDialog.show with `variant: 'confirm'`, `confirmVariant: 'danger'`
- On confirm: `bridge.send('datasets:delete', { datasetId })` → `catalogGrid?.refresh()` → `refreshDataExplorer()`
- All wiring correct — no changes needed

**Test results:** 9/9 CatalogSuperGrid tests pass. `npx tsc --noEmit` — 0 errors.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — web source reimport fully wired to `importFileHandler`.

## Self-Check: PASSED

Files exist:
- src/main.ts — FOUND

Commits exist:
- 5af4ce54 — feat(159-02): add web source reimport via file picker in onReimportDataset
