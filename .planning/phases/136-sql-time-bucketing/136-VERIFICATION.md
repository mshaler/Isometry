---
phase: 136-sql-time-bucketing
verified: 2026-04-01T10:30:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps: []
human_verification: []
---

# Phase 136: SQL Time Bucketing Verification Report

**Phase Goal:** SuperGrid query builder automatically buckets time-axis columns into strftime() groups at the active granularity, with NULL values surfaced as a "No Date" bucket that sorts last
**Verified:** 2026-04-01T10:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                         | Status     | Evidence                                                                                      |
|----|-----------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | Time axis columns are wrapped in COALESCE(strftime(...), '__NO_DATE__') in SELECT and GROUP BY | ✓ VERIFIED | `compileAxisExpr()` at line 71-84 — COALESCE wrapping confirmed, 4 COALESCE occurrences in file |
| 2  | Non-time axis columns are never wrapped in strftime or COALESCE regardless of granularity     | ✓ VERIFIED | `compileAxisExpr()` returns raw field name when field not in `effectiveTimeFields` set          |
| 3  | When granularity is null/undefined and a time axis is present, effective granularity defaults to 'month' | ✓ VERIFIED | `effectiveGranularity = granularity ?? 'month'` at line 79; TIME-02 tests at line 851-896 all pass |
| 4  | Cards with NULL time values produce a '__NO_DATE__' bucket instead of being excluded          | ✓ VERIFIED | COALESCE wraps NULL output as `'__NO_DATE__'`; `NO_DATE_SENTINEL` exported at line 38         |
| 5  | SchemaProvider-derived timeFields set controls which fields get COALESCE/strftime wrapping    | ✓ VERIFIED | `config.timeFields` builds `timeFieldSet`; `compileAxisExpr(field, granularity, timeFieldSet)` — TIME-06 test at line 815 confirms custom timeFields excludes created_at |
| 6  | The '__NO_DATE__' bucket sorts after all dated buckets when sort direction is ASC              | ✓ VERIFIED | `compileTimeAxisOrderBy()` at line 97-99 injects `CASE WHEN expr = '__NO_DATE__' THEN 1 ELSE 0 END`; TIME-05 tests pass |
| 7  | The '__NO_DATE__' bucket sorts after all dated buckets when sort direction is DESC             | ✓ VERIFIED | Same CASE WHEN always evaluates ASC 0/1, pushing sentinel last regardless of direction; DESC test at line 945 passes |
| 8  | Sort-last behavior applies to both buildSuperGridQuery and buildSuperGridCalcQuery ORDER BY   | ✓ VERIFIED | `effectiveTimeFieldsForOrder` check + `compileTimeAxisOrderBy` call present at lines 271-278 (main) and 465-471 (calc) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact                                           | Expected                                                                | Status     | Details                                                                                         |
|----------------------------------------------------|-------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------|
| `src/views/supergrid/SuperGridQuery.ts`            | COALESCE-wrapped compileAxisExpr, auto-default granularity, NO_DATE_SENTINEL | ✓ VERIFIED | 489 lines; exports `NO_DATE_SENTINEL`, `buildSuperGridQuery`, `buildSuperGridCalcQuery`; contains `__NO_DATE__` (6 occurrences), `COALESCE` (4 occurrences), `CASE WHEN` (5 occurrences) |
| `tests/views/supergrid/SuperGridQuery.test.ts`     | TDD tests for COALESCE wrapping, auto-default, NULL bucketing, time field detection, sort-last | ✓ VERIFIED | 1046 lines; 66 tests; 4 Phase-136-specific describe blocks confirmed present |

### Key Link Verification

| From                                     | To                              | Via                                             | Status     | Details                                                                                              |
|------------------------------------------|---------------------------------|-------------------------------------------------|------------|------------------------------------------------------------------------------------------------------|
| `src/views/supergrid/SuperGridQuery.ts`  | `compileAxisExpr`               | COALESCE wrapping around strftime pattern       | ✓ WIRED    | Line 81: `return \`COALESCE(\${pattern(field)}, '\${NO_DATE_SENTINEL}')\``                           |
| `src/views/supergrid/SuperGridQuery.ts`  | `buildSuperGridQuery ORDER BY`  | CASE WHEN sentinel prepended to time axis ORDER BY | ✓ WIRED | Lines 272-278: `effectiveTimeFieldsForOrder.has(ax.field)` gates `compileTimeAxisOrderBy(expr, dir)` |
| `src/views/supergrid/SuperGridQuery.ts`  | `buildSuperGridCalcQuery ORDER BY` | Same CASE WHEN sentinel sort-last trick       | ✓ WIRED    | Lines 465-471: identical pattern applied to `rowAxes` map                                            |
| `src/views/supergrid/SuperGridQuery.ts`  | `buildSuperGridQuery`           | Auto-default granularity when null + time axis  | ✓ WIRED    | Line 79: `const effectiveGranularity: TimeGranularity = granularity ?? 'month'` inside time-field branch |

### Data-Flow Trace (Level 4)

Not applicable. `SuperGridQuery.ts` is a pure SQL builder (produces SQL strings + params). It does not render dynamic data or fetch from a database — data flow is verified by the SQL string content, not by runtime DB calls. Test assertions on SQL string output constitute full verification.

### Behavioral Spot-Checks

| Behavior                                             | Command                                                                      | Result              | Status   |
|------------------------------------------------------|------------------------------------------------------------------------------|---------------------|----------|
| All 66 SuperGridQuery tests pass (incl. all TIME-*) | `npx vitest run tests/views/supergrid/SuperGridQuery.test.ts`               | 66 passed, 0 failed | ✓ PASS   |
| No regression in DataAdapter tests                  | `npx vitest run tests/views/pivot/DataAdapter.test.ts`                       | 19 passed, 0 failed | ✓ PASS   |
| NO_DATE_SENTINEL exported                            | `grep 'export const NO_DATE_SENTINEL' src/views/supergrid/SuperGridQuery.ts` | Line 38 match found | ✓ PASS   |
| COALESCE present in source                           | `grep -c 'COALESCE' src/views/supergrid/SuperGridQuery.ts`                   | 4                   | ✓ PASS   |
| CASE WHEN present in source                          | `grep -c 'CASE WHEN' src/views/supergrid/SuperGridQuery.ts`                  | 5                   | ✓ PASS   |
| Commits referenced in summaries exist               | `git cat-file -t 225a83d0 && git cat-file -t f7ba29ea`                       | Both are type=commit | ✓ PASS  |

Note: `supergrid-query-join.test.ts` referenced in the PLAN's verification section does not exist. This file was never created — the plan referenced it only as a regression check target. The main `SuperGridQuery.test.ts` covers all assertions and passes cleanly. No gap.

### Requirements Coverage

| Requirement | Source Plan     | Description                                                                                  | Status       | Evidence                                                                             |
|-------------|-----------------|----------------------------------------------------------------------------------------------|--------------|--------------------------------------------------------------------------------------|
| TIME-01     | 136-01-PLAN.md  | Time column on axis wraps in strftime() at active granularity                                | ✓ SATISFIED  | `STRFTIME_PATTERNS` + `compileAxisExpr()` COALESCE wrapping; 9 tests in TIME-01/04/06 block |
| TIME-02     | 136-01-PLAN.md  | granularity=null + time axis defaults to 'month'                                             | ✓ SATISFIED  | `effectiveGranularity = granularity ?? 'month'` (line 79); 4 tests in TIME-02 block all pass |
| TIME-04     | 136-01-PLAN.md  | NULL in time axis column → "No Date" bucket, not excluded                                    | ✓ SATISFIED  | COALESCE maps NULL to `'__NO_DATE__'`; 2 tests in TIME-04 block pass                |
| TIME-05     | 136-02-PLAN.md  | "No Date" bucket sorts last regardless of sort direction                                      | ✓ SATISFIED  | `compileTimeAxisOrderBy` with CASE WHEN; 5 tests in TIME-05 (main) + 2 in TIME-05 (calc) all pass |
| TIME-06     | 136-01-PLAN.md  | SchemaProvider time field classification drives strftime wrapping (non-time axes never wrapped) | ✓ SATISFIED  | `config.timeFields` → `timeFieldSet` → `compileAxisExpr` check; TIME-06 custom timeFields test passes |

**Traceability check against REQUIREMENTS.md:**

The REQUIREMENTS.md traceability table maps TIME-01, TIME-02, TIME-04, TIME-05, TIME-06 to Phase 136 with status "Complete". All five are marked `[x]` in the requirements file. TIME-03 is correctly deferred to Phase 137 and is not claimed by any Phase 136 plan — no orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME, no placeholder returns, no empty implementations, no stub indicators found in `src/views/supergrid/SuperGridQuery.ts`.

### Human Verification Required

None. All truths are fully verifiable via SQL string inspection in unit tests. Phase 136 is a pure SQL query builder change with no UI component. Visual rendering of "No Date" labels is deferred to Phase 137.

### Gaps Summary

No gaps. All 8 must-have truths verified. All 5 requirement IDs satisfied with test evidence. Both commits present in git history (`225a83d0`, `f7ba29ea`). 66 tests pass with 0 failures. No regressions.

---

_Verified: 2026-04-01T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
