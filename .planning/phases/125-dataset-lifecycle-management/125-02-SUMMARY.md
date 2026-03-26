---
phase: 125-dataset-lifecycle-management
plan: "02"
subsystem: dataset-lifecycle
tags: [reimport, diff-preview, worker, swift, catalog]
dependency_graph:
  requires: ["125-01"]
  provides: [datasets:reimport, datasets:commit-reimport, DiffPreviewDialog, alto-reimport-result]
  affects: [datasets.handler, protocol, CatalogWriter, NativeBridge, BridgeManager, main]
tech_stack:
  added: [DiffPreviewDialog, diff-preview.css]
  patterns: [two-phase-reimport, module-cache, dedup-without-write]
key_files:
  created:
    - src/ui/DiffPreviewDialog.ts
    - src/styles/diff-preview.css
  modified:
    - src/worker/protocol.ts
    - src/worker/handlers/datasets.handler.ts
    - src/worker/worker.ts
    - src/database/schema.sql
    - src/etl/CatalogWriter.ts
    - src/worker/handlers/etl-import-native.handler.ts
    - src/native/NativeBridge.ts
    - src/main.ts
    - native/Isometry/Isometry/BridgeManager.swift
decisions:
  - "Two-phase reimport: datasets:reimport runs DedupEngine without write and caches DedupResult; datasets:commit-reimport applies the cache"
  - "pendingReimport module-level cache in datasets.handler.ts with concurrency guard for rapid double-click"
  - "handleDatasetsCommitReimport is async (awaits SQLiteWriter methods) and wired to async routeRequest in worker.ts"
  - "connection cleanup uses source_id/target_id column names (not from_card_id/to_card_id) matching actual schema"
  - "Swift BridgeManager uses JSONSerialization for metadata then merges cardsJSON string for native:request-alto-reimport response"
  - "getSourceName exported from etl-import-native.handler.ts so datasets.handler.ts can reuse without duplication"
metrics:
  duration: "10 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 9
---

# Phase 125 Plan 02: Two-Phase Re-Import + Diff Preview Summary

Two-phase re-import flow with diff preview modal: DedupEngine runs without writing (phase 1), serializable diff summary shown to user, commit applies cached DedupResult (phase 2).

## Objective

Implement the two-phase re-import flow so users can refresh a dataset from its stored directory path, see what changed (new/modified/deleted cards), and decide whether to apply the changes before committing to the database.

## What Was Built

### Task 1: Two-Phase Re-Import Worker Handlers + directory_path Storage

**Schema + migration:**
- Added `directory_path TEXT` column to `datasets` table in `schema.sql`
- Added `ALTER TABLE datasets ADD COLUMN directory_path TEXT` migration in `worker.ts` (after dataset_id migration)

**Protocol types:**
- Added `'datasets:reimport'` and `'datasets:commit-reimport'` to `WorkerRequestType` union
- Added `directoryPath?: string` to `'etl:import-native'` payload for future imports to store path
- Added `WorkerPayloads['datasets:reimport']` and `WorkerPayloads['datasets:commit-reimport']`
- Added `WorkerResponses['datasets:reimport']` (serializable diff summary) and `WorkerResponses['datasets:commit-reimport']` (ImportResult)
- Added `directory_path: string | null` to `WorkerResponses['datasets:query']` row type

**CatalogWriter:**
- Added `directoryPath?: string` to `ImportRunRecord` interface
- Updated `upsertDataset()` to accept `directoryPath?` and include it in INSERT/ON CONFLICT SQL
- ON CONFLICT UPDATE uses `COALESCE(excluded.directory_path, directory_path)` to preserve existing path when new import doesn't supply one

**etl-import-native.handler.ts:**
- Exported `getSourceName` (was private) for reuse in datasets.handler.ts
- Passes `directoryPath: payload.directoryPath` to `catalog.recordImportRun()` when present

**datasets.handler.ts:**
- Added imports: `CatalogWriter`, `DedupEngine`, `SQLiteWriter`, `CanonicalCard`, `ImportResult`, `DedupResult`, `getSourceName`
- Added `pendingReimport` module-level cache with concurrency guard
- Implemented `handleDatasetsReimport`: dedup-only (no write), caches DedupResult, returns serializable summary with deleted card names
- Implemented `handleDatasetsCommitReimport`: async, applies cached DedupResult (writeCards, updateCards, writeConnections), soft-deletes removed cards, cleans up connections, stamps dataset_id, records in catalog
- Updated `handleDatasetsQuery` SELECT to include `directory_path`

**worker.ts:**
- Imported `handleDatasetsReimport` and `handleDatasetsCommitReimport`
- Added `case 'datasets:reimport'` and `case 'datasets:commit-reimport'` switch cases

### Task 2: DiffPreviewDialog + Re-Import Button Wiring + CSS

**DiffPreviewDialog (src/ui/DiffPreviewDialog.ts):**
- Promise-based modal using native `<dialog>.showModal()`
- Summary badges row with data-kind="new|modified|deleted" and zero-opacity for 0 counts
- Collapsible sections (skipped entirely when count=0) with aria-expanded toggle, ▶/▼ chevron
- Actions row reuses `.app-dialog__btn` CSS classes from existing app-dialog.css
- Backdrop click and Escape both cancel; focus lands on Cancel button (safety-first per UI-SPEC)

**diff-preview.css (src/styles/diff-preview.css):**
- `.dset-diff-modal` fixed-inset dialog, max-width 560px, z-index 2000
- Badge colors use `--audit-new`, `--audit-modified`, `--audit-deleted` design tokens with rgba fallback
- `.dset-diff-section__body` collapsed by default (max-height: 0), `.is-expanded` at 180px
- `@media (prefers-reduced-motion: reduce)` collapses transition-duration to 0.01ms

**main.ts:**
- Added `DiffPreviewDialog` import
- Added `onReimportDataset` callback to CatalogSuperGrid config: sends `native:request-alto-reimport` with stored `directory_path`, falls back to `native:request-alto-discovery` picker if path is null
- Added `alto-reimport-result` window event listener: sends `datasets:reimport` to Worker, shows toast for zero-changes, shows DiffPreviewDialog for non-zero, calls `datasets:commit-reimport` on commit, refreshes catalog + coordinator

**NativeBridge.ts:**
- Added `native:alto-reimport-result` case: dispatches `alto-reimport-result` CustomEvent with card payload

**BridgeManager.swift:**
- Added `native:request-alto-reimport` case: reads stored path, starts security-scoped resource access, calls `AltoIndexAdapter.fetchCardsForDirectory()`, JSON-encodes cards, sends `native:alto-reimport-result` back via `evaluateJavaScript`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] handleDatasetsCommitReimport made async (SQLiteWriter methods are async)**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified "synchronous-style calls" but SQLiteWriter.writeCards/updateCards/writeConnections are all async functions returning Promise<void>. Using `void` would cause writes to be unordered and the handler to return before writes complete.
- **Fix:** Made `handleDatasetsCommitReimport` an `async function` returning `Promise<WorkerResponses['datasets:commit-reimport']>` and added `await` to all SQLiteWriter calls.
- **Files modified:** src/worker/handlers/datasets.handler.ts
- **Commit:** 0de0b16b

**2. [Rule 1 - Bug] Connection cleanup used wrong column names**
- **Found during:** Task 1 implementation, comparing against existing handleDatasetsDelete
- **Issue:** Plan specified `from_card_id`/`to_card_id` for connection cleanup in handleDatasetsCommitReimport, but the actual connections schema uses `source_id`/`target_id`.
- **Fix:** Changed DELETE FROM connections to use `source_id IN (...) OR target_id IN (...)`.
- **Files modified:** src/worker/handlers/datasets.handler.ts
- **Commit:** 0de0b16b

**3. [Rule 2 - Missing critical] DedupResult imported via combined import statement**
- **Found during:** Task 1 review
- **Issue:** Had duplicate imports: `import { DedupEngine } from '...'` and separate `import type { DedupResult } from '...'`. TypeScript allows but it's redundant.
- **Fix:** Combined into `import { DedupEngine, type DedupResult } from '../../etl/DedupEngine'`.
- **Files modified:** src/worker/handlers/datasets.handler.ts
- **Commit:** 0de0b16b

**4. [Rule 1 - Bug] Swift metaJSON string merge used Substring concatenation**
- **Found during:** Task 2 Swift implementation
- **Issue:** `metaJSON.dropLast()` returns a `Substring`; string interpolation in `let payload = ...` could cause unexpected behavior.
- **Fix:** Changed to `let payloadJSON = String(metaJSON.dropLast()) + ...` with explicit String conversion.
- **Files modified:** native/Isometry/Isometry/BridgeManager.swift
- **Commit:** 9174dc93

## Self-Check: PASSED

All key files present, commits verified:
- 0de0b16b — feat(125-02): two-phase reimport pipeline + directory_path storage
- 9174dc93 — feat(125-02): DiffPreviewDialog + re-import button wiring + Swift handler

Key acceptance criteria verified:
- src/database/schema.sql datasets table contains `directory_path TEXT` ✓
- src/worker/protocol.ts contains `'datasets:reimport'` and `'datasets:commit-reimport'` ✓
- src/worker/handlers/datasets.handler.ts exports `handleDatasetsReimport` and `handleDatasetsCommitReimport` ✓
- src/ui/DiffPreviewDialog.ts exists and contains `dset-diff-modal` ✓
- src/native/NativeBridge.ts contains `native:alto-reimport-result` case ✓
- native/Isometry/Isometry/BridgeManager.swift handles `native:request-alto-reimport` ✓
- npx tsc --noEmit exits 0 (0 errors in src/) ✓
