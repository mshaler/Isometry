---
phase: 25-supersearch
plan: 01
subsystem: supergrid
tags: [fts5, sql.js, supergrid, worker, search]

# Dependency graph
requires:
  - phase: 24-superfilter
    provides: "SuperGridFilterLike interface and axis filter infrastructure"
  - phase: 23-supersort
    provides: "sortOverrides in SuperGridQueryConfig"
  - phase: 16-supergridquery-worker-wiring
    provides: "buildSuperGridQuery, handleSuperGridQuery, WorkerResponses supergrid:query"
provides:
  - "SuperGridQueryConfig.searchTerm field for FTS5 injection"
  - "buildSuperGridQuery FTS5 rowid subquery injection"
  - "handleSuperGridQuery matchedCardIds annotation per cell"
  - "WorkerResponses supergrid:query extended with optional searchTerms field"
affects: [25-supersearch-plan02, supergrid-fetch-render, WorkerBridge-supergrid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FTS5 MATCH guarded with .trim() check — never passes empty string to MATCH"
    - "Search params appended AFTER filter params in positional SQL parameter array"
    - "Secondary db.exec() query for FTS ID extraction; primary db.prepare() for main GROUP BY"
    - "matchedCardIds uses bracket notation on CellDatum (index signature compatibility)"

key-files:
  created: []
  modified:
    - src/views/supergrid/SuperGridQuery.ts
    - src/worker/handlers/supergrid.handler.ts
    - src/worker/protocol.ts
    - tests/views/supergrid/SuperGridQuery.test.ts
    - tests/worker/supergrid.handler.test.ts

key-decisions:
  - "Phase 25 SRCH-04: searchTerm is optional on SuperGridQueryConfig — empty/whitespace = no FTS clause, prevents FTS5 MATCH crash"
  - "Search AND-composes with existing filters (appended AFTER filterWhere) — narrows within current filter, never replaces"
  - "matchedCardIds uses CellDatum[key: string]: unknown bracket notation — no structural CellDatum modification needed"
  - "Secondary FTS query uses db.exec() (columnar) for flat ID extraction; primary query uses db.prepare() (row objects)"
  - "searchTerms: [trimmedSearch] array (not scalar) in response — future-proofs for multi-term highlighting"
  - "supergrid.handler.test.ts mock upgraded: createSimpleMockDb for prepare-only tests, createMockDb(prepareRows, execReturn) for FTS tests"

patterns-established:
  - "FTS injection pattern: const trimmedSearch = config.searchTerm?.trim() ?? ''; guard before MATCH"
  - "FTS WHERE appended last in WHERE chain: baseWhere + filterWhere + searchWhere"
  - "Search param position: [...params, ...searchParams] — filter params first, search param last"

requirements-completed:
  - SRCH-04
  - SRCH-02

# Metrics
duration: 10min
completed: 2026-03-05
---

# Phase 25 Plan 01: SuperSearch Worker Pipeline Summary

**FTS5 searchTerm injection into supergrid:query — buildSuperGridQuery appends rowid MATCH subquery, handleSuperGridQuery annotates cells with matchedCardIds via secondary FTS exec**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-05T08:42:00Z
- **Completed:** 2026-03-05T08:52:00Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Added `searchTerm?: string` to `SuperGridQueryConfig` with JSDoc explaining FTS5 guard requirement
- `buildSuperGridQuery` injects `AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)` when searchTerm is non-empty after trim
- Empty string / whitespace-only searchTerm produces no FTS clause (guard against FTS5 MATCH crash)
- Search params appended AFTER filter params in correct positional SQL order
- `handleSuperGridQuery` runs secondary `db.exec()` FTS query and annotates each cell with `matchedCardIds` (IDs from that cell's card_ids that matched FTS)
- `WorkerResponses['supergrid:query']` extended to `{ cells: CellDatum[]; searchTerms?: string[] }`
- Fixed pre-existing test mock failures: upgraded `supergrid.handler.test.ts` from exec-only mock to prepare+exec mock
- 14 new TDD tests: 5 for FTS injection in SuperGridQuery, 9 for matchedCardIds/searchTerms in handler
- 249 SuperGrid-related tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend protocol types, inject FTS WHERE in buildSuperGridQuery, compute matchedCardIds in handler** - `b04ec0a8` (feat)

**Plan metadata:** (docs commit to follow)

_TDD cycle completed: RED (new tests failing, handler test mocks fixed) → GREEN (all tests passing)_

## Files Created/Modified

- `src/views/supergrid/SuperGridQuery.ts` - Added `searchTerm?: string` to `SuperGridQueryConfig`; injected FTS5 WHERE subquery in `buildSuperGridQuery` with .trim() guard and positional param append
- `src/worker/handlers/supergrid.handler.ts` - Added secondary FTS exec query in `handleSuperGridQuery`, `matchedCardIds` per-cell annotation, `searchTerms` in response when search active
- `src/worker/protocol.ts` - Extended `WorkerResponses['supergrid:query']` to include `searchTerms?: string[]`
- `tests/views/supergrid/SuperGridQuery.test.ts` - Added 5 TDD tests for FTS injection (searchTerm behavior)
- `tests/worker/supergrid.handler.test.ts` - Upgraded mocks to prepare+exec pattern; added 9 TDD tests for matchedCardIds and searchTerms

## Decisions Made

- FTS5 MATCH guard: `.trim()` before MATCH prevents FTS5 empty query crash (critical constraint from RESEARCH.md Pitfall 1)
- `matchedCardIds` uses bracket notation `cell['matchedCardIds']` — fits `CellDatum`'s `[key: string]: unknown` index signature without requiring interface modification
- `searchTerms` is an array `[trimmedSearch]` not a scalar — enables future multi-term FTS highlighting
- Secondary FTS query uses `db.exec()` (columnar results) — simpler for flat ID extraction vs `db.prepare()` row objects
- Plan 02 will wire `searchTerm` into `_fetchAndRender()` by reading it from a new `SuperSearchProvider`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing supergrid.handler.test.ts mock failures**
- **Found during:** Task 1 (RED phase — running baseline tests)
- **Issue:** Existing handler tests used `createMockDb` with `exec: vi.fn()` only, but `handleSuperGridQuery` uses `db.prepare()`. 5 tests were failing with "db.prepare is not a function"
- **Fix:** Replaced `createMockDb` helper to provide both `prepare()` and `exec()` mocks. Added `createSimpleMockDb` helper for tests not needing FTS exec mock. Updated all existing tests to use row-object format (matching what `db.prepare().all()` returns) rather than columnar format
- **Files modified:** `tests/worker/supergrid.handler.test.ts`
- **Verification:** All 43 SuperGridQuery + handler tests pass (up from 28 passing, 5 failing)
- **Committed in:** b04ec0a8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Pre-existing test mock mismatch fixed as part of TDD cycle. No scope creep — handler behavior was correct, only test mocks needed updating.

## Issues Encountered

None beyond the pre-existing mock failures documented above.

## Next Phase Readiness

- Worker pipeline complete: `searchTerm` flows through `buildSuperGridQuery` → SQL → `handleSuperGridQuery` → `matchedCardIds` per cell
- Plan 02 can pass `searchTerm` to `_fetchAndRender()` and receive `matchedCardIds` in cell data for D3 highlight rendering
- `WorkerResponses['supergrid:query'].searchTerms` available for highlight tokenization in Plan 02

---
*Phase: 25-supersearch*
*Completed: 2026-03-05*
