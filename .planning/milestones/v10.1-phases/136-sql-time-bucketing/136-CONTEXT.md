# Phase 136: SQL Time Bucketing - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Modify the SuperGrid query builder (`buildSuperGridQuery` and `buildSuperGridCalcQuery`) to automatically bucket time-axis columns into strftime() groups at the active granularity, surface NULL values as a "__NO_DATE__" sentinel bucket that sorts last, and auto-default granularity to 'month' when a time axis is present but granularity is null. Pure query-builder + auto-default logic — no UI changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### SQL Bucketing Pattern
- **D-01:** Time axis expressions use `COALESCE(strftime('%Y-%m', field), '__NO_DATE__') AS field` in SELECT and GROUP BY — sentinel stays in SQL layer, rendering layer (Phase 137) converts to "No Date"
- **D-02:** All 5 granularities (day/week/month/quarter/year) use COALESCE wrapping — the existing `STRFTIME_PATTERNS` map in SuperGridQuery.ts gains COALESCE at the `compileAxisExpr()` level

### NULL Handling
- **D-03:** `__NO_DATE__` sentinel string is the SQL-layer representation of NULL time values — never exposed to users, replaced in rendering
- **D-04:** "No Date" bucket sorts last regardless of sort direction — implemented via CASE WHEN sentinel trick in ORDER BY clause
- **D-05:** COALESCE wrapping applies whenever a time field is on an axis (not gated on granularity being non-null) — NULL cards are always surfaced, never silently excluded

### Auto-Default Granularity
- **D-06:** When `granularity` is null/undefined AND at least one axis field is in the time field set, auto-default to `'month'` — raw ISO timestamps never appear as SuperGrid header labels
- **D-07:** SuperDensityProvider.axisGranularity null + time axis present → effective granularity is 'month' (the auto-default happens in the query builder, not in SuperDensityProvider state)

### Time Field Detection
- **D-08:** `SchemaProvider.getFieldsByFamily('Time')` drives which axes get strftime() wrapping — non-time axes are never wrapped regardless of granularity setting (already wired via DYNM-10)
- **D-09:** Fallback `ALLOWED_TIME_FIELDS_FALLBACK` set (`created_at`, `modified_at`, `due_at`) preserved for boot-time before SchemaProvider is ready

### Claude's Discretion
- Where the auto-default logic lives (compileAxisExpr vs buildSuperGridQuery vs caller)
- Whether COALESCE wraps at the STRFTIME_PATTERNS level or in compileAxisExpr after pattern application
- buildSuperGridCalcQuery alignment approach (shared helper vs duplicated logic)
- Test structure and fixture design for the 5-granularity x NULL/non-NULL matrix

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Query Builder
- `src/views/supergrid/SuperGridQuery.ts` — `compileAxisExpr()`, `buildSuperGridQuery()`, `buildSuperGridCalcQuery()`, `STRFTIME_PATTERNS` map — the primary files being modified
- `src/providers/types.ts` — `TimeGranularity` type, `AxisMapping` interface, `SuperGridQueryConfig`

### Provider System
- `src/providers/SuperDensityProvider.ts` — `setGranularity()`, `axisGranularity` state — source of granularity value passed to query builder
- `src/providers/SchemaProvider.ts` — `getFieldsByFamily('Time')` — drives time field detection
- `src/providers/PAFVProvider.ts` — axis configuration that feeds into query builder

### Existing Tests
- `tests/views/SuperGrid.test.ts` — existing SuperGrid query tests to extend
- `tests/views/pivot/DataAdapter.test.ts` — data adapter tests with granularity coverage
- `tests/providers/SchemaProvider.test.ts` — time field classification tests

### Architecture Decisions
- `CLAUDE-v5.md` — D-003 (SQL safety), D-011 (__agg__ prefix convention)
- `.planning/STATE.md` §"Key v10.1 architectural constraints" — locked SQL patterns for this milestone

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `compileAxisExpr()` in SuperGridQuery.ts — already wraps time fields in strftime(), just needs COALESCE addition
- `STRFTIME_PATTERNS` map — all 5 granularity patterns already defined, need COALESCE wrapping
- `ALLOWED_TIME_FIELDS_FALLBACK` — frozen Set for boot-time fallback
- `validateAxisField()` — D-003 SQL safety validation (called BEFORE compileAxisExpr)

### Established Patterns
- Validation-before-compilation: raw field name validated against allowlist, THEN strftime expression applied
- Sort overrides use raw field names (no strftime wrapping) — this pattern must be preserved
- `__agg__` prefix convention (D-011) for calc query aliases — COALESCE must not interfere

### Integration Points
- `buildSuperGridQuery()` config receives `granularity` from SuperDensityProvider via BridgeDataAdapter
- `buildSuperGridCalcQuery()` receives same granularity — both must apply identical COALESCE logic
- `timeFields` parameter already flows from SchemaProvider through to compileAxisExpr (DYNM-10 wiring)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — all decisions are locked from STATE.md architectural constraints.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 136-sql-time-bucketing*
*Context gathered: 2026-04-01*
