---
phase: 77-import-launch-memory-optimization
plan: "01"
subsystem: etl
tags: [profiling, etl, performance, batch-size, fts]
dependency_graph:
  requires: []
  provides: [injectable-batch-size, fts-perftrace-spans, batch-comparison-benchmark, fts-timing-benchmark]
  affects: [src/etl/SQLiteWriter.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, injectable-constructor-param, perftrace-spans, single-shared-db]
key_files:
  created:
    - tests/profiling/etl-batch-size.test.ts
    - tests/profiling/etl-fts-timing.test.ts
  modified:
    - src/etl/SQLiteWriter.ts
    - tests/etl/SQLiteWriter.test.ts
decisions:
  - "batchSize=1000 wins at ~49K cards/s vs ~26K cards/s at batchSize=100 (1.9x speedup)"
  - "FTS rebuild is 10.5% of 20K import — significant but not dominant"
  - "FTS disable/restore are sub-millisecond; rebuild takes ~80ms at 20K cards"
metrics:
  duration_minutes: 3
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
  completed_date: "2026-03-13"
---

# Phase 77 Plan 01: ETL Batch Size + FTS Timing Benchmarks Summary

SQLiteWriter with injectable batchSize (default=100), FTS PerfTrace spans (etl:fts:disable/rebuild/restore), and two new profiling tests producing numeric batch-size comparison and FTS stage isolation data at 20K cards.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Parameterize SQLiteWriter batchSize + FTS PerfTrace spans | 2fdcb2e7 | src/etl/SQLiteWriter.ts, tests/etl/SQLiteWriter.test.ts |
| 2 | ETL batch comparison + FTS timing + parser throughput tests | bb30e7a6 | tests/profiling/etl-batch-size.test.ts, tests/profiling/etl-fts-timing.test.ts |

## What Was Built

### SQLiteWriter changes (src/etl/SQLiteWriter.ts)

Constructor changed from `constructor(private db: Database)` to `constructor(private db: Database, private batchSize = 100)`. All three write methods (writeCards, updateCards, writeConnections) now use `this.batchSize` instead of the module-level `BATCH_SIZE` constant. The `BATCH_SIZE = 100` constant is preserved as documentation but is no longer read at runtime.

FTS lifecycle calls in `writeCards()` are now wrapped with PerfTrace spans:
- `startTrace('etl:fts:disable')` / `endTrace('etl:fts:disable')` around `disableFTSTriggers()`
- `startTrace('etl:fts:rebuild')` / `endTrace('etl:fts:rebuild')` around `rebuildFTS()`
- `startTrace('etl:fts:restore')` / `endTrace('etl:fts:restore')` around `restoreFTSTriggers()`

### New test: tests/profiling/etl-batch-size.test.ts

Three `it()` tests (one per batchSize) using a single shared Database instance. Each run clears the cards table with `DELETE FROM cards WHERE 1=1`, instantiates `new SQLiteWriter(db, batchSize)`, inserts 20K CanonicalCard objects, and logs throughput. AfterAll logs a summary table and identifies the winner.

### New test: tests/profiling/etl-fts-timing.test.ts

Single `it()` test with a shared Database instance. Imports 20K cards with bulk mode, reads PerfTrace entries for all three FTS stages, logs each stage duration and FTS total as percentage of import time.

## Benchmark Results (measured on this machine)

### Batch Size Comparison (20K cards, single run)

| batchSize | Time | Throughput |
|-----------|------|-----------|
| 100 | ~774ms | ~26K cards/s |
| 500 | ~440ms | ~45K cards/s |
| 1000 | ~408ms | ~49K cards/s |

batchSize=1000 wins at approximately 1.9x the throughput of batchSize=100. The speedup comes from reduced transaction overhead (fewer BEGIN/COMMIT cycles: 20 transactions at 1000 vs 200 at 100).

### FTS Stage Timing (20K cards, bulk import)

| Stage | Duration |
|-------|----------|
| etl:fts:disable | ~0.5ms |
| etl:fts:rebuild | ~80ms |
| etl:fts:restore | ~0.4ms |
| FTS total | ~81ms |
| FTS overhead | ~10.5% of import |

FTS rebuild dominates FTS cost. At 10.5% overhead, FTS is significant but not the primary bottleneck — the batch transaction loop itself accounts for 89.5%. The current single-rebuild-after-all-inserts pattern (P24 mitigation) is already optimal.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

All files exist and commits are present:

- `src/etl/SQLiteWriter.ts`: modified (injectable batchSize + FTS spans)
- `tests/etl/SQLiteWriter.test.ts`: modified (6 new TDD tests)
- `tests/profiling/etl-batch-size.test.ts`: created
- `tests/profiling/etl-fts-timing.test.ts`: created
- Commits: 2fdcb2e7, bb30e7a6
- 238 tests pass (0 failures)

## Self-Check: PASSED
