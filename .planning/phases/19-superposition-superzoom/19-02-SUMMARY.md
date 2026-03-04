---
phase: 19-superposition-superzoom
plan: 02
subsystem: ui
tags: [supergrid, scroll, zoom, sticky-headers, css-custom-properties, position-restore]

# Dependency graph
requires:
  - phase: 19-superposition-superzoom
    provides: SuperPositionProvider (Tier 3 ephemeral scroll/zoom cache) and SuperZoom (WheelEvent CSS Custom Property zoom) from Plan 01

provides:
  - SuperGridPositionLike narrow interface in types.ts
  - CSS position:sticky frozen headers (col top:0 z-2, row left:0 z-2, corner top/left z-3)
  - rAF-throttled scroll handler calling positionProvider.savePosition()
  - Scroll position restore after first render via _fetchAndRender().then(restorePosition)
  - Zoom toast overlay: centered dark pill showing zoom percentage, fades after 1s
  - SuperZoom attached in mount(), detached in destroy() lifecycle
  - SuperPositionProvider wired as 5th constructor arg in main.ts (shared instance outside factory)
  - 91 SuperGrid tests (74 existing + 17 new POSN/ZOOM tests)

affects: [20-supersize, future supergrid phases, any view that might adopt position restore pattern]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SuperGridPositionLike narrow interface: minimal contract for position provider (same pattern as SuperGridBridgeLike/ProviderLike/FilterLike)"
    - "Optional constructor arg with no-op default: _noOpPositionProvider allows backward-compat with 4-arg tests"
    - "SuperZoom cast via any: SuperGridPositionLike is structurally compatible with SuperPositionProvider but import avoided"
    - "Position restore after render: _fetchAndRender().then(restorePosition) — must wait for content before scrolling"

key-files:
  created:
    - ".planning/phases/19-superposition-superzoom/19-02-SUMMARY.md"
  modified:
    - "src/views/types.ts — added SuperGridPositionLike interface"
    - "src/views/SuperGrid.ts — sticky headers, scroll handler, zoom toast, position restore, SuperZoom lifecycle"
    - "src/main.ts — SuperPositionProvider import, shared instance creation, 5th arg wiring"
    - "tests/views/SuperGrid.test.ts — 17 new POSN/ZOOM tests"

key-decisions:
  - "SuperGridPositionLike is structurally compatible with SuperPositionProvider — cast via `as any` avoids concrete import in SuperGrid.ts while preserving type safety at usage sites"
  - "5th constructor arg is optional with _noOpPositionProvider default — backward-compat with all existing 4-arg test calls, no mass-update needed"
  - "Scroll event uses { passive: true } — safe since we don't preventDefault on scroll; wheel events use { passive: false } via SuperZoom (unchanged)"
  - "Toast element created lazily on first zoom — not created at mount time, no DOM overhead for users who never zoom"
  - "jsdom normalizes '0' to '0px' for CSS numeric values — tests use toContain(['0', '0px']) for cross-env compatibility"

patterns-established:
  - "Narrow interface + no-op default: add optional provider arg with structurally-compatible no-op, avoiding breaking changes to existing callers"
  - "Position restore pattern: fetch → render → restore (never restore before content is rendered)"
  - "Shared provider outside factory: create once at app init, inject into factory closure for cross-render persistence"

requirements-completed: [POSN-02, POSN-03, ZOOM-02, ZOOM-04]

# Metrics
duration: 20min
completed: 2026-03-04
---

# Phase 19 Plan 02: SuperGrid Integration (Sticky Headers + Zoom + Position Restore) Summary

**CSS position:sticky frozen headers with SuperZoom and SuperPositionProvider wired as 5th constructor dependency in SuperGrid, enabling scroll position restore across view switches and transient zoom toast overlay**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-04T13:03:00Z
- **Completed:** 2026-03-04T13:32:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `SuperGridPositionLike` narrow interface to `types.ts` (mirrors SuperGridBridgeLike/ProviderLike pattern)
- Extended SuperGrid with CSS `position:sticky` frozen headers: col headers (top:0, z-index:2), row headers (left:0, z-index:2), corner cells (top:0, left:0, z-index:3), all with `var(--sg-header-bg, #f0f0f0)` background
- Wired SuperZoom lifecycle in `mount()` / `destroy()`: attach, applyZoom, detach with full cleanup
- Added rAF-throttled scroll handler saving position to provider; added position restore after first render
- Added zoom toast: dark semi-transparent centered pill showing current zoom percentage (e.g., "150%"), fades after 1s
- Updated data cells to use `var(--sg-row-height, 40px)` and `var(--sg-zoom, 1)` for zoom-aware sizing
- Wired `SuperPositionProvider` as shared instance in `main.ts` (created outside view factory, survives view switches)
- 91 tests passing: 74 original + 17 new POSN/ZOOM requirement tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SuperGridPositionLike interface, sticky headers, scroll handler, zoom integration, toast** - `617f8444` (feat)
2. **Task 2: Wire SuperPositionProvider in main.ts** - `67bf751f` (feat)

**Plan metadata commit:** TBD (docs: complete plan)

## Files Created/Modified

- `src/views/types.ts` — Added `SuperGridPositionLike` interface (savePosition, restorePosition, zoomLevel, setAxisCoordinates, reset)
- `src/views/SuperGrid.ts` — 5th constructor arg, sticky headers, rAF scroll handler, SuperZoom lifecycle, zoom toast, position restore, var(--sg-row-height)
- `src/main.ts` — Import SuperPositionProvider, create shared instance, pass as 5th arg to SuperGrid factory
- `tests/views/SuperGrid.test.ts` — 17 new tests: sticky header styles, scroll handler, restorePosition, overlay toast, overflow:auto

## Decisions Made

- **Optional 5th arg with no-op default:** Made `positionProvider` optional with `_noOpPositionProvider` so all existing 4-arg test calls remain backward-compatible without mass-update.
- **Structural cast via `as any`:** SuperZoom requires concrete `SuperPositionProvider` but SuperGrid only knows the narrow `SuperGridPositionLike` interface. Structural compatibility allows safe cast without importing concrete class in SuperGrid.ts.
- **jsdom CSS normalization:** jsdom normalizes CSS value `'0'` to `'0px'` — tests use `expect(['0', '0px']).toContain(el.style.top)` for cross-environment compatibility.
- **Lazy toast creation:** Toast element created only on first zoom event, not at mount time — no unnecessary DOM overhead.

## Deviations from Plan

None — plan executed exactly as written. All 11 steps in Task 1 and both steps in Task 2 implemented as specified.

## Issues Encountered

- **jsdom CSS normalization:** `el.style.top = '0'` in implementation returns `'0px'` when read back via jsdom. Tests adapted with `['0', '0px']` comparison. Not a bug — jsdom faithfully follows CSS spec for numeric values.
- **Flaky test in full suite:** DYNM-04 opacity transition test occasionally fails under parallel test execution load (pre-existing issue, unrelated to Plan 02 changes). Passes consistently in isolation.

## Next Phase Readiness

- SuperGrid now has frozen headers, zoom, and scroll position restore — the full SuperPosition + SuperZoom feature set is complete (Phases 19-01 + 19-02)
- Phase 20 (SuperSize) can proceed: density controls and column width adjustment
- `SuperGridPositionLike` interface pattern established for future provider injections

## Self-Check

- [x] `src/views/types.ts` — contains `SuperGridPositionLike`
- [x] `src/views/SuperGrid.ts` — contains `position:sticky`, `supergrid-zoom-toast`, `restorePosition`, `overflow:auto`
- [x] `src/main.ts` — contains `SuperPositionProvider` and `superPosition`
- [x] Task commits exist: `617f8444` and `67bf751f`
- [x] 1394 tests passing, no regressions

---
*Phase: 19-superposition-superzoom*
*Completed: 2026-03-04*
