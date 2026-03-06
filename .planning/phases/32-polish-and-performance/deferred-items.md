# Deferred Items — Phase 32 Polish and Performance

## Pre-existing Test Failures

**4 failing tests in `tests/views/SuperGridSizer.test.ts`**

- Discovered during: Phase 32 Plan 02 full test suite verification
- These failures are pre-existing and unrelated to Phase 32 changes
- Tests involve SuperGridSizer resize behavior (not aggregation, selection, or benchmarks)
- Full suite: 2037/2041 pass, 4 fail — all 4 in SuperGridSizer.test.ts
- No action taken per deviation scope boundary rules (only fix issues directly caused by current task's changes)
