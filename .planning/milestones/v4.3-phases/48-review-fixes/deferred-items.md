# Phase 48 — Deferred Items

## Pre-existing TypeScript errors in etl-validation tests

- `tests/etl-validation/source-dedup.test.ts` line 13: imports `ParsedFile` which no longer exists in `src/etl/types.ts`
- `tests/etl-validation/source-errors.test.ts` line 14: same `ParsedFile` import error
- These errors pre-date Phase 48 and are NOT caused by 48-01 changes.
- Fix: update test imports to use the current ETL type names, or remove if test coverage is now redundant.
