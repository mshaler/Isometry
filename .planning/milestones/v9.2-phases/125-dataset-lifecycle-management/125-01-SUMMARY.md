---
phase: 125-dataset-lifecycle-management
plan: "01"
subsystem: datasets
tags: [datasets, catalog, supergrid, lifecycle, delete, worker, etl]
dependency_graph:
  requires:
    - src/worker/protocol.ts
    - src/worker/handlers/datasets.handler.ts
    - src/views/CatalogSuperGrid.ts
    - src/etl/CatalogWriter.ts
    - src/ui/AppDialog.ts
  provides:
    - datasets:delete Worker handler with per-dataset card scoping
    - dataset_id column on cards table for per-dataset lifecycle
    - CatalogSuperGrid actions column (re-import + delete buttons)
    - Per-dataset scoped card counts in CatalogWriter
  affects:
    - src/main.ts (delete confirmation wiring)
    - src/database/schema.sql (dataset_id column + index)
    - src/worker/worker.ts (migration + switch case)
    - src/worker/handlers/etl-import-native.handler.ts (dataset_id stamping)
tech_stack:
  added:
    - src/styles/catalog-actions.css (action button CSS with hover states and danger variant)
  patterns:
    - dataset_id TEXT column on cards with ALTER TABLE migration in worker.ts for backward compat
    - MutationObserver-based action button injection (idempotent, disconnect-during-mutation pattern)
    - confirmVariant: 'danger' option on AppDialog for destructive action styling
    - Per-dataset scoped COUNT queries using WHERE dataset_id = ? instead of global COUNT(*)
key_files:
  created:
    - src/styles/catalog-actions.css
  modified:
    - src/worker/protocol.ts
    - src/worker/handlers/datasets.handler.ts
    - src/worker/handlers/etl-import-native.handler.ts
    - src/worker/worker.ts
    - src/etl/CatalogWriter.ts
    - src/database/schema.sql
    - src/views/CatalogSuperGrid.ts
    - src/ui/AppDialog.ts
    - src/main.ts
decisions:
  - id: D-DSET-01
    summary: "dataset_id column (not import_run_id) chosen for per-dataset card scoping: alto_index_* cards all have source=alto_index regardless of directory, making source-based partitioning impossible; dataset_id FK is the clean per-dataset boundary"
  - id: D-DSET-02
    summary: "ALTER TABLE migration in worker.ts (not schema.sql) for backward compat on hydrated databases; schema.sql updated for fresh databases; idx_cards_dataset_id created with IF NOT EXISTS"
  - id: D-DSET-03
    summary: "Per-dataset card counts use existing row ID at upsert time; new datasets get count=0 on first call and correct count after dataset_id is stamped and re-imported"
metrics:
  duration: "~56 minutes"
  completed: "2026-03-26T17:56:00Z"
  tasks_completed: 2
  files_modified: 9
  files_created: 1
---

# Phase 125 Plan 01: Dataset Lifecycle Management — Actions Column + Delete Handler Summary

Per-dataset card partitioning via `dataset_id` column on cards, with a `datasets:delete` Worker handler, per-dataset scoped card counts in `CatalogWriter`, and an actions column in `CatalogSuperGrid` providing re-import (↺) and delete (✕) buttons per dataset row.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Worker-side dataset delete handler + per-dataset card count fix | 5345cf2a | protocol.ts, datasets.handler.ts, etl-import-native.handler.ts, worker.ts, CatalogWriter.ts, schema.sql |
| 2 | CatalogSuperGrid actions column + delete confirmation dialog + CSS | 9aa80193 | CatalogSuperGrid.ts, AppDialog.ts, catalog-actions.css, main.ts |

## What Was Built

### Task 1: Worker Infrastructure

**`datasets:delete` protocol extension** (`src/worker/protocol.ts`):
- `WorkerRequestType` union extended with `'datasets:delete'`
- `WorkerPayloads['datasets:delete']` = `{ datasetId: string }`
- `WorkerResponses['datasets:delete']` = `{ deleted_cards: number; deleted_connections: number }`

**`handleDatasetsDelete`** (`src/worker/handlers/datasets.handler.ts`):
- Looks up card IDs via `WHERE dataset_id = ?`
- Deletes cross-boundary connections (`WHERE source_id IN (...) OR target_id IN (...)`)
- Hard-deletes cards by `dataset_id`
- Deletes dataset registry row
- Returns counts of deleted cards and connections

**Schema migration** (`src/worker/worker.ts`):
- `ALTER TABLE cards ADD COLUMN dataset_id TEXT` with try/catch for idempotency
- `CREATE INDEX IF NOT EXISTS idx_cards_dataset_id ON cards(dataset_id)`
- Applies to all databases (fresh and hydrated)

**`schema.sql` update**: Added `dataset_id TEXT` column and `idx_cards_dataset_id` index for new-database correctness.

**`etl-import-native.handler.ts` dataset_id stamping**:
- After `catalog.recordImportRun()`, looks up the dataset row by name + source_type
- Updates `dataset_id` on all inserted cards (by card ID)
- Updates `dataset_id` on all updated cards (by source + source_id lookup)

**`CatalogWriter.upsertDataset` per-dataset scoped counts**:
- For existing datasets: `COUNT(*) FROM cards WHERE dataset_id = ?`
- Connection count: `source_id IN (SELECT id FROM cards WHERE dataset_id = ?) OR target_id IN (...)`
- New datasets: count starts at 0 (populated on next import after stamping)

### Task 2: UI + CSS

**`CatalogSuperGrid.ts` actions column**:
- `CATALOG_FIELDS` extended with `'actions'` as 6th element
- `superGridQuery` emits `{ field: 'actions', value: '' }` cell per dataset
- `_renderActionButtons()` private method: MutationObserver-triggered, injects re-import (↺) and delete (✕) buttons into last `.pv-data-cell` of each row; idempotent guard; disconnect-during-mutation pattern
- Click handler updated to intercept `.dset-action-btn` clicks before row click logic
- `CatalogSuperGridConfig` extended with `onDeleteDataset?` and `onReimportDataset?` callbacks

**`AppDialog.ts` danger variant**:
- `confirmVariant?: 'default' | 'danger'` added to `AppDialogOptions`
- `app-dialog__btn--delete` class applied to confirm button when `confirmVariant === 'danger'`

**`catalog-actions.css`** (new file):
- `.dset-action-btn` base with `opacity: 0` (hover reveals)
- `tr:hover .dset-action-btn { opacity: 1 }` for desktop hover
- `@media (hover: none) { opacity: 1 }` for touch devices
- `--reimport` variant: accent color on hover
- `--delete` variant: danger color on hover
- `.app-dialog__btn--delete` danger styling for confirmation dialog

**`main.ts` delete wiring**:
- `onDeleteDataset` callback: `AppDialog.show` with card count, `confirmVariant: 'danger'`
- On confirm: `bridge.send('datasets:delete', { datasetId })` then `catalogGrid.refresh()` + `refreshDataExplorer()`

## Verification

- `npx tsc --noEmit`: 0 src/ errors (38 pre-existing test file errors unchanged)
- `npx vitest run`: 4014 tests passing, 9 failing (all pre-existing: WorkbenchShell section count + bench timeout failures)

## Deviations from Plan

**[Rule 1 - Bug] Corrected connection column names**
- Found during: Task 1 implementation
- Issue: Plan pseudocode used `from_card_id`/`to_card_id` but connections table uses `source_id`/`target_id` (per schema.sql)
- Fix: Used correct column names `source_id`/`target_id` in `handleDatasetsDelete` queries
- Files: `src/worker/handlers/datasets.handler.ts`

**[Rule 1 - Bug] Fixed BindParams spread syntax**
- Found during: Task 1 TypeScript compile
- Issue: `db.run(sql, ...args)` is invalid; `Database.run` takes `(sql, params?: BindParams)` where BindParams is an array
- Fix: Changed to `db.run(sql, [...cardIds, ...cardIds])` array syntax
- Files: `src/worker/handlers/datasets.handler.ts`

## Self-Check

- [x] `src/styles/catalog-actions.css` created
- [x] `src/worker/handlers/datasets.handler.ts` exports `handleDatasetsDelete`
- [x] `src/worker/protocol.ts` contains `'datasets:delete'`
- [x] `src/views/CatalogSuperGrid.ts` contains `dset-action-btn`
- [x] Commits 5345cf2a and 9aa80193 exist

## Self-Check: PASSED
