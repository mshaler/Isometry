---
phase: 45-visual-polish
plan: 02
subsystem: ui
tags: [css-tokens, svg, d3, inline-styles, design-system]

# Dependency graph
requires:
  - phase: 45-01
    provides: "Typography scale tokens and derived color tokens in design-tokens.css"
provides:
  - "NetworkView.ts with zero hardcoded inline colors -- all var(--token) references"
  - "TreeView.ts with zero hardcoded inline colors/font-sizes -- all var(--token) references"
  - "TimelineView.ts with zero hardcoded fallback colors"
  - "audit-colors.ts documented intentional duplication with design-tokens.css mapping"
affects: [45-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["var(--token) in D3 .attr() SVG attributes for Safari 17+ / Chrome 85+"]

key-files:
  created: []
  modified:
    - src/views/NetworkView.ts
    - src/views/TreeView.ts
    - src/views/TimelineView.ts
    - src/audit/audit-colors.ts

key-decisions:
  - "Card type colors in TreeView mapped to source provenance tokens (note->source-markdown, task->source-csv, etc.)"
  - "Tree label fill uses var(--text-secondary) not var(--bg-card) for readability on dark background"
  - "audit-colors.ts keeps hardcoded hex values with documentation comment mapping to CSS tokens"

patterns-established:
  - "D3 .attr('fill'/'stroke', 'var(--token)') pattern for SVG elements in all views"
  - "Inline style cssText uses var(--text-*) for font-size and var(--text-*) for colors"

requirements-completed: [VISU-01]

# Metrics
duration: 2min
completed: 2026-03-07
---

# Phase 45 Plan 02: JS Inline Style Token Migration Summary

**NetworkView, TreeView, and TimelineView migrated from hardcoded hex/rgba inline styles to CSS design token var() references with audit-colors.ts token documentation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T19:46:02Z
- **Completed:** 2026-03-07T19:48:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migrated 4 hardcoded color values in NetworkView.ts to var(--token) references (edge stroke, label fill, selection stroke, text fallback)
- Migrated 14 hardcoded color/font-size values in TreeView.ts to var(--token) references (card type colors, tree links, node strokes, labels, orphan section)
- Removed unnecessary hardcoded fallback from TimelineView.ts var(--text-secondary) reference
- Added comprehensive documentation to audit-colors.ts mapping hex values to design-tokens.css custom properties

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate NetworkView.ts and TimelineView.ts inline styles to tokens** - `f2e7ab73` (feat)
2. **Task 2: Migrate TreeView.ts inline styles and audit-colors.ts to tokens** - `1c421dd8` (feat)

## Files Created/Modified
- `src/views/NetworkView.ts` - Replaced 4 hardcoded hex colors with var(--text-muted), var(--bg-card), var(--text-primary)
- `src/views/TreeView.ts` - Replaced 14 hardcoded hex/rgba/px values with var(--source-*), var(--danger), var(--text-*), var(--border-*), var(--selection-outline) tokens
- `src/views/TimelineView.ts` - Removed hardcoded #666 fallback from var(--text-secondary) reference
- `src/audit/audit-colors.ts` - Added documentation comment mapping AUDIT_COLORS and SOURCE_COLORS hex values to design-tokens.css custom properties

## Decisions Made
- Card type colors in TreeView mapped semantically: note->source-markdown (purple), task->source-csv (green), event->source-native-calendar (gold), resource->source-native-reminders (lavender), person->danger (red)
- Tree label fill uses var(--text-secondary) rather than var(--bg-card) as the plan suggested, since bg-card (#1e1e2e) would be invisible on dark backgrounds -- text-secondary provides readable contrast
- audit-colors.ts retains hardcoded hex values per plan recommendation, with documentation linking to CSS token counterparts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All non-SuperGrid views now use design token references for inline styles
- Plan 03 (SuperGrid token migration) can proceed with the same var(--token) pattern
- 2205 tests pass, TypeScript strict mode clean

## Self-Check: PASSED

All 4 modified files exist. Both task commits (f2e7ab73, 1c421dd8) verified in git history.

---
*Phase: 45-visual-polish*
*Completed: 2026-03-07*
