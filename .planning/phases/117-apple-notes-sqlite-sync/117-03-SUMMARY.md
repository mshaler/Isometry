---
phase: 117-apple-notes-sqlite-sync
plan: 03
subsystem: etl
tags: [apple-notes, validation, data-integrity, folder-hierarchy, sql.js, vitest]

# Dependency graph
requires:
  - phase: 117-02
    provides: NodeWriter persists CanonicalNode/Edge to sql.js; AppleNotesSyncService orchestrates sync
provides:
  - Folder hierarchy reconciliation tests (17 tests) confirming Stacey success criterion
  - DataIntegrityValidator service: validateFolderPath, validateTimestamp, validateTags, validateNode, validateSource
  - Data integrity tests (29 tests) covering folder, timestamp, tag, and source validation
affects:
  - 117-04 (UI integration and Tauri IPC wiring — validation service ready to wire)
  - 115-04 (Three-Canvas Notebook integration — can use validator for post-sync checks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DataIntegrityValidator: composable validation interface (validateFolderPath → validateTimestamp → validateTags → validateNode → validateSource)"
    - "Order-independent tag comparison: JSON.stringify(sorted) equality"
    - "Orphan edge detection via NOT EXISTS subquery — warning (not error)"
    - "Duplicate source_id detection via GROUP BY / HAVING COUNT > 1"
    - "1000ms default timestamp tolerance for Core Data round-trip"

key-files:
  created:
    - src/etl/apple-notes-direct/__tests__/folder-hierarchy.test.ts
    - src/etl/apple-notes-direct/__tests__/data-integrity.test.ts
    - src/etl/apple-notes-direct/validation.ts
  modified:
    - src/etl/apple-notes-direct/index.ts

key-decisions:
  - "ORPHAN-WARNING-01: Orphan edges are warnings (not errors) — validation result stays valid:true, UI can surface them separately"
  - "TIMESTAMP-TOLERANCE-01: 1000ms default tolerance for Core Data timestamp round-trip (Core Data uses seconds, not milliseconds)"
  - "TAG-ORDER-01: Order-independent tag comparison via JSON.stringify(sorted) — Apple Notes doesn't guarantee tag order"
  - "EMPTY-FOLDER-01: null folder maps to empty string '' in validateFolderPath — Unfiled notes have null folder in DB"

patterns-established:
  - "Validation pattern: null return = valid, ValidationError return = invalid — caller checks null explicitly"
  - "Stacey E2E pattern: NodeWriter.upsertNodes → execTestQuery → validateFolderPath — three-layer E2E confirmation"

# Metrics
duration: 7min
completed: 2026-02-17
---

# Phase 117 Plan 03: Folder Hierarchy Validation Summary

**DataIntegrityValidator service with 46 tests confirming Stacey note maps to Family/Stacey (not BairesDev/Operations)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-17T21:39:02Z
- **Completed:** 2026-02-17T21:46:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Folder hierarchy reconciliation tests (17 tests) confirm `buildFolderHierarchy({ folder_name: 'Stacey', parent_folder_name: 'Family' })` returns `['Family', 'Stacey']`
- `DataIntegrityValidator` service with 5 methods: `validateFolderPath`, `validateTimestamp`, `validateTags`, `validateNode`, `validateSource`
- 29 data integrity tests including Stacey E2E criterion: NodeWriter persists → validator confirms folder = 'Family/Stacey'
- Exported all types from `src/etl/apple-notes-direct/index.ts` barrel

## Task Commits

Each task was committed atomically:

1. **Task 1: Create folder hierarchy integration tests** - `ab963c4c` (test)
2. **Task 2: Create data integrity validation service** - `257198f4` (feat)
3. **Task 3: Create data integrity tests** - `20ee78c3` (test)

## Files Created/Modified

- `src/etl/apple-notes-direct/__tests__/folder-hierarchy.test.ts` - 17 tests: buildFolderHierarchy, buildFolderPath, canonicalNodeToIsometryNode mapping, Stacey success criterion, edge cases
- `src/etl/apple-notes-direct/__tests__/data-integrity.test.ts` - 29 tests: folder path, timestamp tolerance, tag order-independence, composite validateNode, source sweep, Stacey E2E
- `src/etl/apple-notes-direct/validation.ts` - DataIntegrityValidator interface + createDataIntegrityValidator factory
- `src/etl/apple-notes-direct/index.ts` - Added ValidationResult, ValidationError, ValidationWarning, ValidationStats, createDataIntegrityValidator exports

## Decisions Made

- **ORPHAN-WARNING-01**: Orphan edges are warnings (not errors) — `validateSource` stays `valid: true` when orphan edges exist. UI can surface warnings separately without blocking the sync result.
- **TIMESTAMP-TOLERANCE-01**: Default 1000ms tolerance for timestamp validation. Core Data timestamps are in seconds (not milliseconds), so the round-trip through ISO string preserves subsecond precision but Apple Notes itself only stores second-level precision.
- **TAG-ORDER-01**: Tags compared order-independently via `JSON.stringify(sorted)`. Apple Notes doesn't guarantee hashtag order in content.
- **EMPTY-FOLDER-01**: Null folder maps to empty string `''` via `?? ''` in `validateFolderPath`. Unfiled notes have `null` folder in the nodes table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed max-len lint errors in data-integrity.test.ts**
- **Found during:** Task 3 (data integrity tests) — pre-commit hook check-quick
- **Issue:** Two SQL INSERT strings exceeded 150-char max line length
- **Fix:** Extracted column list to template variable and used parameterized values
- **Files modified:** `src/etl/apple-notes-direct/__tests__/data-integrity.test.ts`
- **Verification:** `npx eslint` showed zero errors after fix, pre-commit hook passed
- **Committed in:** `20ee78c3` (Task 3 commit — amended)

---

**Total deviations:** 1 auto-fixed (Rule 1 - lint error in test file)
**Impact on plan:** Lint fix was mechanical (line length only). No behavior change.

## Issues Encountered

None — all test infrastructure existed from Phase 117-02. `createTestDB` + `createNodeWriter` patterns from NodeWriter.test.ts were reused directly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **117-04 ready**: `DataIntegrityValidator` is exported from barrel. Tauri IPC wiring can call `validateSource('apple-notes')` post-sync to surface data quality issues in UI.
- **Stacey criterion confirmed**: Three independent verification layers — `buildFolderPath`, `canonicalNodeToIsometryNode`, and `DataIntegrityValidator.validateFolderPath` all confirm `Family/Stacey`.
- **Validation API stable**: `createDataIntegrityValidator(db)` factory accepts any sql.js Database instance.

## Self-Check: PASSED

- FOUND: `src/etl/apple-notes-direct/__tests__/folder-hierarchy.test.ts`
- FOUND: `src/etl/apple-notes-direct/__tests__/data-integrity.test.ts`
- FOUND: `src/etl/apple-notes-direct/validation.ts`
- FOUND: `.planning/phases/117-apple-notes-sqlite-sync/117-03-SUMMARY.md`
- FOUND commit: `ab963c4c` (test: folder hierarchy reconciliation tests)
- FOUND commit: `257198f4` (feat: DataIntegrityValidator service)
- FOUND commit: `20ee78c3` (test: data integrity validation tests)

---
*Phase: 117-apple-notes-sqlite-sync*
*Completed: 2026-02-17*
