---
phase: 138-time-filtering
type: context
created: 2026-04-08
---

# Phase 138: Time Filtering — Context

## Phase Goal

FilterProvider supports time range filtering on any time column, with axis projection and membership filtering fully independent, and multi-field OR-semantics membership filtering available.

## Requirements

- **TFLT-01**: FilterProvider supports time range filtering via `setRangeFilter(field, min, max)` with ISO string min/max values
- **TFLT-02**: Projection and membership are separate concerns: axis projection field is independent of which time fields are filtered
- **TFLT-03**: Membership filter can span multiple time fields using OR semantics (card passes if ANY time field falls within range)

## Architectural Analysis

### TFLT-01: Already Implemented — Needs Confirmation Tests

`setRangeFilter(field, min, max)` already exists (Phase 66, LTPB-01). It accepts `unknown` for min/max, so ISO strings like `'2026-01-01'` work via SQLite's text comparison (ISO 8601 strings sort lexicographically = chronologically). Existing tests use numeric values only. TFLT-01 requires adding time-specific ISO string tests to confirm the SQL fragment is correct.

### TFLT-02: Already Satisfied Architecturally — Needs Integration Test

FilterProvider.compile() produces a WHERE clause. SuperGridQuery.buildSuperGridQuery() receives `where` as a string and uses it independently of the SELECT/GROUP BY axes. The axis projection (which field is strftime-wrapped) and the filter (which field has >= / <=) are completely separate SQL concerns. A Vitest integration test should prove: SuperGrid grouped by created_at + range filter on due_at produces both `COALESCE(strftime('%Y-%m', created_at), '__NO_DATE__')` in SELECT/GROUP BY and `due_at >= ? AND due_at <= ?` in WHERE.

### TFLT-03: New Functionality Required

Current compile() ANDs all range filters: `field1 >= ? AND field1 <= ? AND field2 >= ? AND field2 <= ?`. TFLT-03 needs OR semantics across multiple time fields: `(created_at BETWEEN ? AND ?) OR (modified_at BETWEEN ? AND ?) OR (due_at BETWEEN ? AND ?)`.

This requires a new "membership filter" concept:
- New `MembershipFilter` interface in types.ts: `{ fields: string[], min: unknown, max: unknown }`
- New `_membershipFilter` state on FilterProvider (singular — one membership filter at a time)
- New API: `setMembershipFilter(fields, min, max)`, `clearMembershipFilter()`, `hasMembershipFilter()`
- compile() emits the OR-grouped clause wrapped in parentheses
- Persistence round-trip (toJSON/setState)

## Decisions

- **D-001 (existing)**: setRangeFilter already handles ISO string comparison — no SQL changes needed for TFLT-01
- **FilterProvider range filter**: existing setRangeFilter(field, min, max) already handles ISO string comparison — TFLT-01 is largely a test/confirmation requirement (from STATE.md)
- **Membership filter is singular**: one membership filter active at a time (not a Map of multiple). The use case is "show cards where ANY of these time fields falls in this date range."
- **BETWEEN syntax**: use `field >= ? AND field <= ?` (not SQL BETWEEN) to match existing range filter pattern and allow min-only / max-only variants

## Scope

This is a small, focused phase:
- Plan 01: TDD tests + implementation for all three requirements
- No UI work (UI hint: no)
- No new files beyond the membership filter type addition
- Estimated 2 tasks, ~30min Claude execution
