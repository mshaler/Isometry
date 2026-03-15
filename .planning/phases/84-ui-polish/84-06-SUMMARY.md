---
phase: 84-ui-polish
plan: 6
subsystem: ui
tags: [collapsible-section, workbench-shell, state-model, dom, typescript]

# Dependency graph
requires:
  - phase: 84-ui-polish plan 2
    provides: collapsible-section__body--has-explorer CSS class convention
provides:
  - SectionState type ('loading' | 'ready' | 'empty') on CollapsibleSection
  - setState()/getSectionState() idempotent state management on CollapsibleSection
  - setSectionState(storageKey, state) on WorkbenchShell for post-mount ready transitions
  - data-section-state attribute on section root for CSS/test targeting
  - Zero 'coming soon' stub strings in WorkbenchShell explorer sections
affects: [WorkbenchShell, CollapsibleSection, PropertiesExplorer, ProjectionExplorer, LATCHExplorer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SectionState type union: 'loading' | 'ready' | 'empty' drives data-section-state attr"
    - "Idempotent setState: early-return if state unchanged; classList.add for has-explorer is additive"
    - "_applyState() private sync method keeps DOM state centralized"
    - "EXPLORER_SECTION_KEYS set in WorkbenchShell marks which sections need state management"

key-files:
  created: []
  modified:
    - src/ui/CollapsibleSection.ts
    - src/ui/WorkbenchShell.ts
    - tests/ui/WorkbenchShell.test.ts

key-decisions:
  - "setState is idempotent via early-return guard (state === current → skip _applyState)"
  - "Legacy stubContent preserved in CollapsibleSection for non-explorer sections; emptyContent added for 'empty' state"
  - "setSectionState on WorkbenchShell also sets has-explorer class for double-safety (Plan 02 CSS sync)"
  - "data-section-state attribute on root element (not body) for CSS selector specificity"

patterns-established:
  - "Explorer mount pattern: append element to getSectionBody(), then call setSectionState(key, 'ready')"
  - "Section state lifecycle: constructor sets 'loading' → explorer mounts → setSectionState 'ready'"

requirements-completed: [WA6]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 84 Plan 6: Replace WorkbenchShell stub strings with explicit section state Summary

**SectionState type ('loading'|'ready'|'empty') replaces hardcoded 'coming soon' stub strings in Properties/Projection/LATCH sections with an explicit state model driven by data-section-state attributes**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-15T23:06:22Z
- **Completed:** 2026-03-15T23:09:18Z
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments
- Added `SectionState` type and `setState()`/`getSectionState()` to `CollapsibleSection` — idempotent, syncs `data-section-state` attribute and `collapsible-section__body--has-explorer` class on ready
- Removed all three `stubContent: '... coming soon'` entries from `SECTION_CONFIGS` in WorkbenchShell; explorer sections now start in explicit `'loading'` state
- Added `setSectionState(storageKey, state)` to WorkbenchShell for callers to transition sections to `'ready'` after explorer mount
- 3 behavioral tests added and passing; all 59 tests across CollapsibleSection + WorkbenchShell suites green

## Task Commits

1. **Tasks 1-3: Add setState, remove stub strings, wire ready transition** - `71c88985` (feat)
2. **Task 4: Three behavioral tests** - `29f0161c` (test)

## Files Created/Modified
- `src/ui/CollapsibleSection.ts` — Added `SectionState` type, `_sectionState` field, `_stateEl` overlay, `setState()`/`getSectionState()`, `_applyState()` private method; destroy clears `_stateEl`
- `src/ui/WorkbenchShell.ts` — Removed stubContent from Properties/Projection/LATCH configs; added `EXPLORER_SECTION_KEYS` set; constructor calls `setState('loading')`; new `setSectionState()` public method
- `tests/ui/WorkbenchShell.test.ts` — Updated stub-text test to verify no-stub + loading state; added 3 behavioral tests

## Decisions Made
- `setState` is idempotent via early-return (`this._sectionState === state`), preventing unnecessary DOM thrashing on repeated provider notifications
- Legacy `stubContent` field preserved in `CollapsibleSectionConfig` for non-explorer sections (Notebook/Calc); `emptyContent` added for future 'empty' state use
- `setSectionState` on WorkbenchShell also explicitly adds `has-explorer` class for defense-in-depth alignment with Plan 02's CSS convention

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Explorer sections now show blank loading state (not stub text) before mount
- `setSectionState(key, 'ready')` call pattern ready for PropertiesExplorer, ProjectionExplorer, LATCHExplorer mount sites
- `data-section-state` attribute available for CSS targeting if loading spinner styling is desired

---
*Phase: 84-ui-polish*
*Completed: 2026-03-15*
