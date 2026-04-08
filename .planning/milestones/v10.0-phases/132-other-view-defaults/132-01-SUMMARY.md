---
phase: 132-other-view-defaults
plan: 01
subsystem: ui
tags: [viewdefaults, registry, auto-switch, toast, timeline, tree, network, pafv]

requires:
  - phase: 131-supergrid-defaults
    provides: ViewDefaultsRegistry with DefaultMapping/resolveDefaults, first-import flag gate pattern (view:defaults:applied:{datasetId}), pafv.applySourceDefaults()

provides:
  - ViewConfig and ViewRecommendation interfaces in ViewDefaultsRegistry.ts
  - VIEW_RECOMMENDATIONS frozen Map (5 entries: native_calendar, native_reminders, apple_notes, native_notes, alto_index)
  - resolveRecommendation() function with alto_index prefix match
  - ImportToast.showMessage() for generic toast messages
  - Auto-switch wiring in both importFile and importNative wrappers in main.ts
  - viewConfig application after switchTo resolves (avoids setViewType clobbering)

affects:
  - 132-02 (SidebarNav recommendation badges)
  - Any future import path changes in main.ts

tech-stack:
  added: []
  patterns:
    - "ViewRecommendation parallel registry: VIEW_RECOMMENDATIONS frozen Map alongside VIEW_DEFAULTS_REGISTRY — separate concerns, same file"
    - "viewConfig application order: apply AFTER switchTo().then() because setViewType inside switchTo resets axes"
    - "500ms setTimeout delay: lets import toast display before auto-switch toast replaces it"
    - "One flag, one gate: auto-switch fires inside the same view:defaults:applied:{datasetId} block as axis defaults"

key-files:
  created:
    - src/providers/ViewDefaultsRegistry.ts (extended — ViewConfig, ViewRecommendation, VIEW_RECOMMENDATIONS, resolveRecommendation)
  modified:
    - src/providers/ViewDefaultsRegistry.ts
    - src/ui/ImportToast.ts
    - src/main.ts
    - tests/providers/ViewDefaultsRegistry.test.ts

key-decisions:
  - "viewConfig application order: must happen in .then() after switchTo() because setViewType inside switchTo resets groupBy/xAxis/yAxis to VIEW_DEFAULTS"
  - "500ms setTimeout delay on auto-switch toast so import-success toast displays first (sequential, not stacked)"
  - "resolveRecommendation returns null (not undefined) for non-recommended source types — explicit null contract"
  - "Tree and Network recommendations have viewConfig: null — their views render hierarchy/connections inherently without axis config"

patterns-established:
  - "Parallel registry pattern: two frozen Maps in one file for related but distinct concerns (defaults vs recommendations)"
  - "Post-switchTo viewConfig: always apply axis config in .then() callback, never before switchTo"

requirements-completed: [OVDF-01, OVDF-02, OVDF-04]

duration: 8min
completed: 2026-03-27
---

# Phase 132 Plan 01: Other View Defaults Summary

**ViewRecommendation registry with 5 source-type-to-view mappings and auto-switch wiring in both import paths, applying view-specific axis config (groupBy) after switchTo resolves via .then() callback**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-27T21:48:00Z
- **Completed:** 2026-03-27T21:56:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added ViewConfig and ViewRecommendation interfaces to ViewDefaultsRegistry — clean separation from SuperGrid's DefaultMapping
- Built VIEW_RECOMMENDATIONS frozen Map with 5 entries covering Timeline (calendar/reminders), Tree (notes), and Network (alto_index) with view-specific groupBy config where applicable
- Added resolveRecommendation() with alto_index prefix match (same D-07 pattern as resolveDefaults)
- Added ImportToast.showMessage() for generic auto-switch notifications
- Wired auto-switch into both importFile and importNative post-import hooks with 500ms delay and viewConfig application in .then() callback
- 36 tests passing (16 pre-existing + 18 new resolveRecommendation + 2 viewConfig application order)

## Task Commits

Each task was committed atomically:

1. **Task 1: ViewRecommendation + VIEW_RECOMMENDATIONS + resolveRecommendation + ImportToast.showMessage** - `cc4413db` (feat)
2. **Task 2: Wire auto-switch + viewConfig application into main.ts post-import hooks** - `7fc8296a` (feat)

## Files Created/Modified

- `src/providers/ViewDefaultsRegistry.ts` - Added ViewConfig, ViewRecommendation interfaces; VIEW_RECOMMENDATIONS Map; resolveRecommendation()
- `src/ui/ImportToast.ts` - Added showMessage() for generic auto-switch toast notifications
- `src/main.ts` - Added resolveRecommendation import; wired auto-switch into importFile and importNative wrappers
- `tests/providers/ViewDefaultsRegistry.test.ts` - Added 20 new tests: resolveRecommendation suite + viewConfig application order integration tests

## Decisions Made

- viewConfig application order: must happen in `.then()` after `switchTo()` resolves because `setViewType()` inside `switchTo()` resets `groupBy`/`xAxis`/`yAxis` to VIEW_DEFAULTS. Applying before would be clobbered.
- 500ms `setTimeout` delay for auto-switch toast so the import-success toast has time to display first (UI-SPEC: sequential not stacked).
- Tree (apple_notes/native_notes) and Network (alto_index) get `viewConfig: null` — these views use folder hierarchy and connection data inherently; no axis pre-configuration needed.
- Timeline recommendations get `viewConfig: { groupBy: { field: 'folder'/'status', direction: 'asc' } }` — swimlane rows by calendar name or completion status.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- OVDF-01, OVDF-02, OVDF-04 complete
- Plan 02 (SidebarNav recommendation badges) can proceed: ViewRecommendation and resolveRecommendation are exported and ready to consume
- VIEW_RECOMMENDATIONS provides tooltipText fields which plan 02 needs for badge title attributes

---
*Phase: 132-other-view-defaults*
*Completed: 2026-03-27*
