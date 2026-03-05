---
phase: 26-supertime
plan: 01
subsystem: ui
tags: [d3, timeParse, timeDay, supergrid, date-parsing, time-hierarchy, tdd]

# Dependency graph
requires:
  - phase: 25-supersearch
    provides: SuperGrid TDD patterns and D3 data join pipeline
provides:
  - "parseDateString() pure function: sequential ISO → US → EU date parsing via d3.timeParse"
  - "smartHierarchy() pure function: d3.timeDay.count thresholds for ~10-20 column auto-detection"
  - "SuperTimeUtils.ts module: foundation for all Phase 26 SuperTime features"
affects:
  - "26-supertime Plan 02+ (wires these utilities into SuperGrid._fetchAndRender and density toolbar)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Month-overflow guard: pre-validate first slash-segment <= 12 before attempting US parse to prevent d3.timeParse silent month overflow"
    - "Module-level d3.timeParse singletons to avoid re-allocation on every parseDateString call"

key-files:
  created:
    - src/views/supergrid/SuperTimeUtils.ts
    - src/views/supergrid/SuperTimeUtils.test.ts
  modified: []

key-decisions:
  - "US/EU disambiguation via first-segment > 12 guard: when the first slash-delimited segment exceeds 12, it cannot be a valid month (US format) so the US parser is skipped, allowing the EU parser to correctly handle DD/MM/YYYY inputs like '15/03/2025'"
  - "Module-level parser singletons (_ISO_PARSER, _US_PARSER, _EU_PARSER) created once at import time, not per parseDateString call"
  - "smartHierarchy thresholds: <=20 day, <=140 week, <=610 month, <=1825 quarter, >1825 year — targeting ~10-20 columns using d3.timeDay.count"

patterns-established:
  - "Pattern 1: Sequential fallback date parsing with US/EU disambiguation — when first segment > 12, skip US parser; ambiguous inputs (1-12) try US first per CONTEXT.md locked decision"
  - "Pattern 2: Pure function utility module (SuperTimeUtils.ts) for date operations — no side effects, no module-level state beyond parser singletons"

requirements-completed:
  - TIME-01
  - TIME-02

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 26 Plan 01: SuperTimeUtils — Date Parsing and Smart Hierarchy

**Pure utility functions for sequential ISO/US/EU date parsing and d3.timeDay.count-based smart time hierarchy detection — the foundation layer for all Phase 26 SuperTime features.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T16:37:34Z
- **Completed:** 2026-03-05T16:39:54Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- `parseDateString(s: string): Date | null` — sequential ISO 8601 → US → EU format fallback using module-level d3.timeParse singletons, with US/EU disambiguation guard, and ISO datetime suffix stripping
- `smartHierarchy(minDate: Date, maxDate: Date): TimeGranularity` — d3.timeDay.count with five threshold breakpoints targeting ~10-20 grid columns; handles single-date datasets (0 days → 'day')
- 30 TDD tests covering all boundary cases, null/empty/garbage inputs, all format variants, and edge cases (January/December, ISO datetime suffixes)
- 1816 total tests passing (30 new + 1786 existing), no regressions

## Task Commits

Each task was committed atomically (TDD):

1. **RED — Failing tests** - `970261fe` (test): 30 failing tests for parseDateString and smartHierarchy
2. **GREEN — Implementation** - `a33ec843` (feat): SuperTimeUtils.ts with all 30 tests passing

_Note: TDD task has two commits (test → feat). No REFACTOR needed — implementation was clean from the start._

## Files Created/Modified

- `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperTimeUtils.ts` — Pure utility module: parseDateString(), smartHierarchy()
- `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperTimeUtils.test.ts` — 30 Vitest tests covering all must_have truths from plan spec

## Decisions Made

**US/EU disambiguation guard (not in original plan spec):** The research document noted d3.timeParse allows month-overflow (month=15 wraps to next year), but the plan's must_have truths required `parseDateString('15/03/2025')` to return March 15, 2025 (EU format). The naive "first successful parse wins" chain fails because the US parser accepts `15` as month (overflows to March 2026). Fixed by checking if the first slash-delimited segment > 12 before attempting the US parser — unambiguously a day value, not a month. This satisfies both the CONTEXT.md "first wins" principle (for ambiguous inputs <=12) and the plan must_have truth (EU format works for day > 12).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] US/EU parser disambiguation for day > 12 in slash-format strings**

- **Found during:** GREEN phase (implementation → test run revealed EU format test failing)
- **Issue:** d3.timeParse('%m/%d/%Y') silently overflows month 15 to March 2026 — a non-null result that blocks the EU parser from running, producing wrong year (2026 instead of 2025) for input '15/03/2025'
- **Fix:** Pre-validate the first slash-delimited segment: if > 12, skip the US parser (it can't be a valid month) and allow the EU parser to handle DD/MM/YYYY. Ambiguous inputs (first segment 1-12) still try US first per CONTEXT.md.
- **Files modified:** src/views/supergrid/SuperTimeUtils.ts
- **Verification:** Test `parses EU format: 15/03/2025` passes; US format tests (03/15/2025, 12/31/2025) continue to pass
- **Committed in:** a33ec843 (GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary for correctness — EU format requires disambiguation guard. No scope creep.

## Issues Encountered

- d3.timeParse month-overflow behavior: parser did not return null for invalid months (month 15), requiring the first-segment guard. Discovered and resolved during GREEN phase. See Deviations section.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `parseDateString` and `smartHierarchy` are ready for integration into `SuperGrid._fetchAndRender()` (Plan 02)
- Both functions are pure and side-effect-free — safe to call in render loops
- TIME-01 and TIME-02 requirements complete
- Plan 02 will wire smartHierarchy auto-detection into SuperGrid and replace the `<select>` granularity picker with segmented pills (TIME-03)

---
*Phase: 26-supertime*
*Completed: 2026-03-05*
