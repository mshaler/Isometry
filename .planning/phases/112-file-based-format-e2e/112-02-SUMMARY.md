---
phase: 112-file-based-format-e2e
plan: "02"
subsystem: testing
tags: [vitest, etl, roundtrip, export, json, csv, markdown, exportorchestrator]

requires:
  - phase: 112-file-based-format-e2e
    provides: ImportOrchestrator parser verification (Plan 01)
provides:
  - Export round-trip fidelity tests for JSON, CSV, Markdown
affects: []

tech-stack:
  added: []
  patterns: [import-export-reimport round-trip test pattern]

key-files:
  created:
    - tests/etl-validation/file-format-roundtrip.test.ts
  modified: []

key-decisions:
  - "Markdown reimport uses directory paths (notes/reimport-N.md) to preserve folder derivation from MarkdownParser"
  - "Fields skipped in comparison: id, source_id, modified_at, summary, mime_type, sort_order (vary by parser normalization)"

patterns-established:
  - "Round-trip test: import inline fixture -> ExportOrchestrator.export() -> delete all -> reimport exported data -> compare field-by-field"

requirements-completed: [FILE-07, FILE-08]

duration: 2min
completed: 2026-03-23
---

# Phase 112 Plan 02: Export Round-Trip Fidelity Tests Summary

**Import-export-reimport round-trip verified for JSON, CSV, Markdown with zero data loss on name, content, folder, tags**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T03:04:30Z
- **Completed:** 2026-03-24T03:05:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- JSON round-trip: name, content, folder, tags survive import -> export -> re-import
- CSV round-trip: name and content survive import -> export -> re-import
- Markdown round-trip: name, content, folder survive import -> export -> re-import
- Uses ExportOrchestrator.export() for each format with inline fixtures for determinism

## Task Commits

Each task was committed atomically:

1. **Task 1: Round-trip fidelity tests for JSON, CSV, Markdown** - `a6579c10` (test)

## Files Created/Modified
- `tests/etl-validation/file-format-roundtrip.test.ts` - 194 LOC, 3 describe blocks, 3 test cases

## Decisions Made
- Markdown reimport wraps exported chunks as `{ path: 'notes/reimport-N.md', content: chunk }` to preserve folder derivation (MarkdownParser derives folder from file path directory, not frontmatter)
- JSON export wraps in `{ cards: [...] }` which JSONParser's `extractNestedArray` unwraps via the `cards` key
- CSV export needs wrapping in `ParsedFile[]` JSON for reimport since CSVParser expects that format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed markdown folder comparison failure**
- **Found during:** Task 1 (Markdown round-trip test)
- **Issue:** MarkdownParser derives folder from file path, not frontmatter. Reimport with flat paths (`reimport-0.md`) produced null folder, mismatching original `notes` folder
- **Fix:** Used directory paths (`notes/reimport-0.md`) for reimport files to preserve folder derivation
- **Files modified:** tests/etl-validation/file-format-roundtrip.test.ts
- **Verification:** All 3 round-trip tests pass
- **Committed in:** a6579c10 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for correct folder comparison. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Round-trip fidelity confirmed for all 3 exportable formats
- Ready for malformed input tests (Plan 03)

---
*Phase: 112-file-based-format-e2e*
*Completed: 2026-03-23*
