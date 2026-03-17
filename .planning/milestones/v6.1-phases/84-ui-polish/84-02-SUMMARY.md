---
phase: 84-ui-polish
plan: 2
subsystem: ui
tags: [css, has-selector, compat, WKWebView, latch-explorers]

requires:
  - phase: 84-01
    provides: aggregation and displayField wiring into superGridQuery

provides:
  - data-time-field attribute on .latch-time-presets containers for selector-safe DOM lookup
  - .collapsible-section__body--has-explorer class as primary CSS max-height rule
  - Zero :has() selectors in behavioral TypeScript (grep verified)

affects:
  - latch-explorers
  - workbench-shell
  - css-compat

tech-stack:
  added: []
  patterns:
    - "data-attribute-over-has: Use dataset attributes for behavioral DOM queries instead of :has() CSS selectors"
    - "class-primary-css-rule: Add class-based primary CSS rule before progressive-enhancement :has() fallback"

key-files:
  created: []
  modified:
    - src/ui/LatchExplorers.ts
    - src/styles/workbench.css
    - src/main.ts
    - tests/ui/LatchExplorers.test.ts

key-decisions:
  - "data-time-field attribute on presetsContainer at mount time — enables [data-time-field] selector without :has()"
  - "Class .collapsible-section__body--has-explorer set in main.ts after each explorer mount — keeps :has() CSS rules as progressive enhancement only"

patterns-established:
  - "data-attribute-over-has: dataset attributes are the safe DOM query pattern for WKWebView macOS 12 / iOS 15 compat"

requirements-completed:
  - WA2

duration: 8min
completed: 2026-03-15
---

# Phase 84 Plan 2: Fix :has() Behavioral Dependency in LatchExplorers Summary

**Replaced :has() DOM query in LatchExplorers with data-time-field dataset attribute selector; added class-based CSS fallback for collapsible max-height — zero :has() remaining in TypeScript behavioral code**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-15T17:05:00Z
- **Completed:** 2026-03-15T17:13:00Z
- **Tasks:** 5
- **Files modified:** 4

## Accomplishments
- Added `data-time-field` dataset attribute to `.latch-time-presets` containers at mount time
- Replaced `.latch-time-presets:has(button[data-field="..."])` querySelector with `.latch-time-presets[data-time-field="..."]`
- Added `.collapsible-section__body--has-explorer` as primary CSS max-height rule before existing `:has()` rules
- Set `collapsible-section__body--has-explorer` class on all 5 section bodies in `main.ts` after each explorer mounts
- Added 2 behavioral tests verifying data-time-field attribute lookup and UI update without :has()

## Task Commits

All tasks committed together as a single atomic fix:

1. **Tasks 1-5: Replace :has() dependency** - `803b8179` (fix)

## Files Created/Modified
- `src/ui/LatchExplorers.ts` - data-time-field attribute on presetsContainer; [data-time-field] selector in _syncTimePresetStates
- `src/styles/workbench.css` - Added .collapsible-section__body--has-explorer primary CSS rule
- `src/main.ts` - classList.add('collapsible-section__body--has-explorer') after each of 5 explorer mounts
- `tests/ui/LatchExplorers.test.ts` - 2 new behavioral tests for data-time-field selector

## Decisions Made
- Added class-based rule in `main.ts` rather than `WorkbenchShell.ts` because explorers are mounted in `main.ts` — WorkbenchShell has no knowledge of explorer types
- Kept `:has()` CSS rules intact as progressive enhancement, not removed

## Deviations from Plan

None - plan executed exactly as written. The only minor interpretation was placing the `classList.add` calls in `main.ts` (where explorers are mounted) rather than strictly in `WorkbenchShell.ts` (which has no explorer-type awareness). This is functionally equivalent and cleaner.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Zero :has() selectors remain in TypeScript behavioral code (grep verified)
- All 24 LatchExplorers tests pass
- Ready for plan 84-03

---
*Phase: 84-ui-polish*
*Completed: 2026-03-15*
