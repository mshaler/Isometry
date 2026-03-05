---
phase: 25-supersearch
plan: 02
subsystem: ui
tags: [supergrid, search, typescript, d3, vitest, keyboard, debounce]

# Dependency graph
requires:
  - phase: 25-supersearch (Plan 01)
    provides: FTS5 searchTerm injection in buildSuperGridQuery + matchedCardIds annotation in handleSuperGridQuery
provides:
  - Search input always visible in SuperGrid density toolbar (sg-search-input)
  - Cmd+F / Ctrl+F intercept browser find, focus search input (SRCH-01)
  - 300ms debounced _fetchAndRender on non-empty input (SRCH-02)
  - Immediate _fetchAndRender on empty clear (SRCH-05)
  - Escape key in search input clears value + stops propagation to document handler
  - _fetchAndRender passes searchTerm to Worker query config via spread (exactOptionalPropertyTypes safe)
  - Match count badge shows 'N cells' / 'No matches' when search active
  - destroy() lifecycle removes Cmd+F listener and clears pending debounce
affects: [25-03, 26-supertime]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Debounce via setTimeout + clearTimeout stored in class field (_searchDebounceId)"
    - "Immediate-clear path: !term.trim() triggers _fetchAndRender synchronously (no debounce)"
    - "Escape key stopPropagation prevents document-level handler cascade"
    - "exactOptionalPropertyTypes-safe spread: ...(this._searchTerm ? { searchTerm: this._searchTerm } : {})"
    - "Cmd+F handler stored as _boundCmdFHandler for removeEventListener cleanup in destroy()"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Escape in search input calls e.stopPropagation() to prevent document Escape handler (selection clear) from also firing"
  - "searchTerm uses spread pattern { ...cond ? { searchTerm } : {} } to satisfy exactOptionalPropertyTypes — avoids 'string | undefined' incompatibility"
  - "Clear (empty input) is immediate — no 300ms debounce — per SRCH-05 requirement"
  - "Match count badge counts cells with non-empty matchedCardIds array — compatible with Plan 01 matchedCardIds bracket notation on CellDatum"
  - "Cmd+F handler registered on document (not root element) so it fires even when supergrid does not have focus"

patterns-established:
  - "Toolbar search input pattern: always visible, no toggle state, inline in density toolbar"
  - "TDD cycle: RED commit (failing tests) → GREEN commit (implementation) in separate atomic commits"

requirements-completed: [SRCH-01, SRCH-02, SRCH-05]

# Metrics
duration: 12min
completed: 2026-03-05
---

# Phase 25 Plan 02: SuperSearch Summary

**Cmd+F-activated search input with 300ms debounce, immediate clear, and _fetchAndRender searchTerm integration in SuperGrid density toolbar**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-05T08:51:00Z
- **Completed:** 2026-03-05T09:03:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Search input (`.sg-search-input`) always visible in density toolbar after mount() — no toggle state, inline placement
- Cmd+F and Ctrl+F fire `preventDefault()` and `.focus()` search input — intercepts browser find dialog (SRCH-01)
- 300ms debounce on non-empty typing with debounce reset on rapid keystrokes — exactly one _fetchAndRender per typing burst (SRCH-02)
- Immediate _fetchAndRender on empty clear (no debounce) — instant highlight removal (SRCH-05)
- Escape in search input clears value + calls `e.stopPropagation()` (document selection-clear handler not triggered)
- `_fetchAndRender` passes `searchTerm` to `bridge.superGridQuery()` via spread pattern (exactOptionalPropertyTypes safe)
- Match count badge (`sg-search-count`) updated on every `_renderCells()` call
- `destroy()` removes Cmd+F listener via `_boundCmdFHandler` and clears `_searchDebounceId` timeout
- 14 new TDD tests added; all 1776 project tests pass

## Task Commits

TDD cycle — RED then GREEN:

1. **RED: Failing TDD tests for SRCH-01/SRCH-02/SRCH-05** - `d8c220be` (test)
2. **GREEN: Implementation — search input, Cmd+F, debounce, destroy cleanup** - `3eac4114` (feat)

## Files Created/Modified
- `src/views/SuperGrid.ts` — Added 5 class fields, search input DOM construction in mount(), Cmd+F handler, _fetchAndRender searchTerm spread, match count badge in _renderCells(), destroy() cleanup
- `tests/views/SuperGrid.test.ts` — 14 new TDD tests for SRCH-01/SRCH-02/SRCH-05 covering all behavior assertions

## Decisions Made
- **Escape stopPropagation:** Escape in search input must call `e.stopPropagation()` to prevent the document-level handler from clearing selection. Without this, Escape while searching would both clear search AND clear selection — unexpected double action.
- **exactOptionalPropertyTypes spread:** TypeScript strict config requires `string` (not `string | undefined`) for `searchTerm?`. Solution: `...(this._searchTerm ? { searchTerm: this._searchTerm } : {})` — only includes the property when truthy.
- **Immediate clear (SRCH-05):** When `!term.trim()`, skip the 300ms debounce and call `_fetchAndRender()` synchronously so match highlights disappear instantly on clear.
- **matchedCardIds bracket notation:** Match count badge filters cells using `c['matchedCardIds']` bracket notation — compatible with `CellDatum [key: string]: unknown` index signature from Plan 01 design.
- **document-level Cmd+F:** Registered on `document` (not rootEl or gridEl) so it intercepts even when the supergrid container doesn't have focus — mirrors browser find bar behavior.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- TypeScript `exactOptionalPropertyTypes: true` in tsconfig rejected `searchTerm: this._searchTerm || undefined` because `undefined` is not assignable to `string`. Fixed with spread pattern per established Phase 23/24 patterns. Not a plan deviation — a TS constraint handled inline.

## Next Phase Readiness
- SRCH-01, SRCH-02, SRCH-05 complete
- Plan 03 (SRCH-03: cell highlight rendering for matched cards via matchedCardIds) ready to execute
- Backend (Plan 01) + frontend wire (Plan 02) complete; Plan 03 closes the visual feedback loop

---
*Phase: 25-supersearch*
*Completed: 2026-03-05*

## Self-Check: PASSED
- FOUND: .planning/phases/25-supersearch/25-02-SUMMARY.md
- FOUND: src/views/SuperGrid.ts
- FOUND: commit d8c220be (test: RED phase)
- FOUND: commit 3eac4114 (feat: GREEN phase)
