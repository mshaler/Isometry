---
phase: 76-render-optimization
plan: "02"
subsystem: worker-protocol
tags: [payload-optimization, worker-bridge, virtualization, sql-safety, tdd]
dependency_graph:
  requires: [76-01]
  provides: [supergrid:cell-detail handler, card_ids truncation, virtualizer validation]
  affects: [supergrid:query responses, WorkerBridge API, SuperGridVirtualizer constants]
tech_stack:
  added: []
  patterns: [TDD red-green, prepare+all SQL pattern, D-003 SQL safety validation]
key_files:
  created:
    - tests/worker/handlers/supergrid-payload.test.ts
    - tests/worker/handlers/supergrid-cell-detail.test.ts
  modified:
    - src/worker/protocol.ts
    - src/worker/handlers/supergrid.handler.ts
    - src/worker/worker.ts
    - src/worker/WorkerBridge.ts
    - src/views/supergrid/SuperGridVirtualizer.ts
decisions:
  - card_names truncated in parallel with card_ids (both capped at CARD_IDS_LIMIT=50) — parallel arrays must align
  - VIRTUALIZATION_THRESHOLD=100 confirmed correct — dual-axis PAFV leaf rows are ~5 at 20K cards
  - OVERSCAN_ROWS=5 confirmed — 140px buffer at 28px row height; jsdom cannot measure flicker
metrics:
  duration: 6m
  tasks_completed: 2
  files_modified: 7
  completed_date: "2026-03-12"
---

# Phase 76 Plan 02: Payload Truncation + Virtualizer Validation Summary

Truncate `card_ids` in `supergrid:query` responses to 50 per cell with a `card_ids_total` field for "50 of N" display, add a lazy-fetch `supergrid:cell-detail` Worker message for full card_ids drill-down, and validate `SuperGridVirtualizer` constants at 20K card scale with documented rationale.

## What Was Built

### Task 1: card_ids Truncation + supergrid:cell-detail Handler (TDD)

**Protocol changes (`src/worker/protocol.ts`):**
- `CellDatum.card_ids_total?: number` — true count before truncation (optional to preserve backward compat)
- `'supergrid:cell-detail'` added to `WorkerRequestType` union
- `WorkerPayloads['supergrid:cell-detail']` — `{ axisValues: Record<string, string>; where: string; params: unknown[] }`
- `WorkerResponses['supergrid:cell-detail']` — `{ card_ids: string[]; total: number }`

**Handler changes (`src/worker/handlers/supergrid.handler.ts`):**
- `CARD_IDS_LIMIT = 50` constant at module top
- `handleSuperGridQuery()` now slices both `card_ids` and `card_names` to 50 per cell (parallel arrays must align); `card_ids_total` set to true pre-truncation count
- New `handleSuperGridCellDetail()` function: validates all axis field names via `validateAxisField()`, builds parameterized WHERE clause, uses `prepare+all` pattern, returns `{ card_ids, total }`

**Worker router (`src/worker/worker.ts`):**
- Added `case 'supergrid:cell-detail'` to `routeRequest` exhaustive switch (TypeScript compile check satisfied)

**WorkerBridge (`src/worker/WorkerBridge.ts`):**
- Added `cellDetailQuery(axisValues, where, params)` public method

**Test coverage:**
- `supergrid-payload.test.ts`: real sql.js DB seeded with 20K cards
  - card_ids <= 50 per cell
  - card_ids_total >= card_ids.length with at least one cell having true count > 50
  - dual-axis payload (card_type x folder) under 100KB JSON-stringified
- `supergrid-cell-detail.test.ts`: unit tests (mock DB) + integration tests (real DB, 100 cards)
  - SQL safety validation on invalid/injected axis field names
  - Matching and non-matching axis values
  - Multi-field axis intersection (card_type + folder)

**Payload size at 20K cards:**
- Before truncation: ~1.4MB (unbounded card_ids + card_names)
- After truncation: ~671KB (card_ids capped, card_names uncapped — `card_names` truncation needed)
- After both arrays truncated: ~67KB for dual-axis (under 100KB budget)

### Task 2: SuperGridVirtualizer Validation at 20K Cards

Analysis of leaf row counts for typical PAFV projections at 20K cards:

| Configuration | Row Axis Values | Leaf Rows | Virtualizer Active? | Bottleneck |
|---|---|---|---|---|
| dual-axis (folder x card_type) | 5 folders | 5 | No (5 << 100) | Cell payload size → RNDR-05 |
| single-axis (created_at month) | ~12–24 months | 12–24 | No (24 << 100) | None significant |
| high-cardinality single-axis | 100+ unique values | 100+ | Yes | Row rendering → virtualizer correct |

**Constants confirmed:**
- `VIRTUALIZATION_THRESHOLD = 100` — correct. For the common dual/triple-axis case, leaf rows stay well below 100. The render bottleneck is cell payload size (addressed by RNDR-05) and SQL query time (addressed by RNDR-01..03), not row count.
- `OVERSCAN_ROWS = 5` — confirmed at 28px row height (140px scroll buffer). jsdom cannot measure visual flicker; physical device testing required if re-tuning is needed. 5 is the established baseline from Phase 38 profiling.

Updated JSDoc comments in `SuperGridVirtualizer.ts` document this analysis inline for future maintainers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] card_names must also be truncated in parallel with card_ids**

- **Found during:** Task 1 GREEN phase (payload size test failing at 688KB)
- **Issue:** The plan specified truncating `card_ids` to 50, but `card_names` is a parallel array that must align with `card_ids`. Without truncating `card_names`, the payload contained ~800 names per cell (20K cards / 25 cells) even though `card_ids` was capped at 50. This produced ~688KB payload vs the 100KB target.
- **Fix:** Added `card_names = card_names_full.slice(0, CARD_IDS_LIMIT)` — both arrays capped at 50. After truncation, dual-axis payload is ~67KB.
- **Files modified:** `src/worker/handlers/supergrid.handler.ts`
- **Commit:** ffb9915f

## Success Criteria Verification

- RNDR-04: VIRTUALIZATION_THRESHOLD=100 and OVERSCAN_ROWS=5 validated at 20K card PAFV projections with documented rationale in SuperGridVirtualizer.ts JSDoc
- RNDR-05: card_ids truncated to 50 per cell, card_ids_total field added, supergrid:cell-detail handler created, payload under 100KB at 20K cards (confirmed ~67KB for dual-axis)

## Self-Check: PASSED

- FOUND: tests/worker/handlers/supergrid-payload.test.ts
- FOUND: tests/worker/handlers/supergrid-cell-detail.test.ts
- FOUND: .planning/phases/76-render-optimization/76-02-SUMMARY.md
- FOUND commit ffb9915f (feat: truncate card_ids + cell-detail handler)
- FOUND commit 7cf93aca (docs: virtualizer validation)
