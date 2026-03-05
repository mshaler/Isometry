---
phase: 23-supersort
plan: 02
subsystem: supergrid-query
tags: [sort, sql-safety, order-by, supergrid, tdd]
dependency_graph:
  requires: []
  provides: [SuperGridQueryConfig.sortOverrides, ORDER-BY-injection]
  affects: [src/worker/protocol.ts, SuperGrid sort pipeline]
tech_stack:
  added: []
  patterns: [allowlist-validation, spread-concat-ORDER-BY]
key_files:
  created: []
  modified:
    - src/views/supergrid/SuperGridQuery.ts
    - tests/views/supergrid/SuperGridQuery.test.ts
decisions:
  - "sortOverrides appended AFTER axis ORDER BY parts (axis fields define group boundaries, overrides sort within groups)"
  - "sort overrides validated against axis allowlist at call time, same as axis fields (D-003 SQL safety)"
  - "sort overrides use raw field names — NOT strftime-wrapped even when granularity is set (raw value sort, not time bucket sort)"
  - "AxisField type imported directly in SuperGridQuery.ts for sortOverrides interface field"
  - "protocol.ts re-export unchanged — optional field flows through existing export type { SuperGridQueryConfig } automatically"
metrics:
  duration: 7 min
  completed_date: "2026-03-05"
  tasks_completed: 1
  files_modified: 2
---

# Phase 23 Plan 02: SuperGridQuery sortOverrides Summary

SuperGridQueryConfig.sortOverrides optional field with ORDER BY injection, validated against the axis allowlist. Sort overrides append AFTER axis ORDER BY parts for within-group card ordering (SORT-04).

## What Was Built

Extended `SuperGridQueryConfig` with an optional `sortOverrides` field that injects additional ORDER BY fields into `buildSuperGridQuery()`. This implements the SQL layer of SORT-04 — users can specify sort fields that control card ordering within each (colKey, rowKey) group without breaking the group boundary ordering established by axis fields.

### Key behaviors implemented:
- `sortOverrides` is optional — undefined/empty array produces identical SQL (backward compatible)
- Each sort override field is validated against `ALLOWED_AXIS_FIELDS` (D-003 SQL safety) before use
- Axis ORDER BY parts appear first (preserving group boundaries); sort override parts are appended after
- Sort overrides use raw field names — no `strftime()` wrapping even when `granularity` is set
- `protocol.ts` re-export flows automatically through existing `export type { SuperGridQueryConfig }`

## TDD Cycle

**RED:** 9 new tests added in `describe('buildSuperGridQuery — sortOverrides (SORT-04)')`. Tests covered: backward compat, after-axis append, compound axis + overrides, invalid field validation, multiple overrides in order, no-axes case, granularity + overrides separation, empty array, and `sort_order` field validity. 6 tests failed (3 passed trivially due to undefined behavior matching existing code).

**GREEN:** Implementation in `buildSuperGridQuery()`:
1. Import `AxisField` type from providers/types
2. Add `sortOverrides?: Array<{ field: AxisField; direction: 'asc' | 'desc' }>` to interface
3. Extract `sortOverrides` with `?? []` default
4. Validate each sort override field via `validateAxisField()`
5. Rename existing `orderByParts` to `axisOrderByParts`
6. Build `overrideParts` from sort overrides using raw field names
7. Spread-concat: `[...axisOrderByParts, ...overrideParts]`

All 22 SuperGridQuery tests pass.

## Verification

```
npx vitest run tests/views/supergrid/SuperGridQuery.test.ts
✓ tests/views/supergrid/SuperGridQuery.test.ts (22 tests) 3ms
Test Files  1 passed (1)
Tests       22 passed (22)
```

All 22 tests pass — 13 pre-existing (granularity) + 9 new (sortOverrides).

## Deviations from Plan

None — plan executed exactly as written.

## Pre-Existing Issues (Out of Scope)

Two pre-existing test failures exist in the full suite that are NOT caused by plan 23-02:
1. `tests/worker/supergrid.handler.test.ts` — 6 failures (pre-existing `db.prepare` mock issue)
2. `tests/providers/PAFVProvider.test.ts` — 14 sortOverrides failures (plan 23-03 tests pre-written, implementation deferred to plan 23-03)

Both documented in `.planning/phases/23-supersort/deferred-items.md`.

## Commits

- `d5c5df84` — feat(23-02): extend SuperGridQueryConfig with sortOverrides — SORT-04

## Self-Check: PASSED

- FOUND: src/views/supergrid/SuperGridQuery.ts
- FOUND: tests/views/supergrid/SuperGridQuery.test.ts
- FOUND: 23-02-SUMMARY.md
- FOUND commit: d5c5df84
