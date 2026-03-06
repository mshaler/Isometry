# Phase 29 — Deferred Items

## Pre-existing failures (out of scope — not caused by Phase 29 changes)

### SuperGridSizer.test.ts — applyWidths (4 tests)

**Discovered during:** Plan 02 full test suite run
**Status:** Pre-existing failures confirmed by git stash verification
**Root cause:** Tests expect `160px` as default row header width (2 * 80px), but `applyWidths` produces `80px` (1 * 80px). The `applyWidths` signature was updated in Plan 01 from `rowHeaderWidth` (pixels) to `rowHeaderDepth` (count), but the test expectations were not updated to match.
**Files affected:** `tests/views/supergrid/SuperGridSizer.test.ts` (lines 568, 574, 579, 585)
**Action needed:** Update SuperGridSizer.test.ts applyWidths tests to use depth=1 (80px) instead of 160px, OR update applyWidths to default to depth=2 in its test setup.
