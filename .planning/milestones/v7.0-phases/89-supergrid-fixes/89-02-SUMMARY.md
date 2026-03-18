---
phase: 89-supergrid-fixes
plan: "02"
subsystem: ui
tags: [properties-explorer, depth-control, localStorage, subscriber]
dependency_graph:
  requires: []
  provides: [PropertiesExplorer.getDepth, depth-dropdown]
  affects: [SuperGrid, ProjectionExplorer]
tech_stack:
  added: []
  patterns: [TDD red-green, localStorage persistence, subscriber pattern]
key_files:
  created:
    - tests/seams/ui/properties-explorer-depth.test.ts
  modified:
    - src/ui/PropertiesExplorer.ts
    - src/main.ts
decisions:
  - Depth dropdown inserted at top of footer (before Reset/Enable buttons) to keep primary action controls at bottom
  - Second subscriber added in main.ts rather than modifying existing subscriber — separates concerns (projection update vs grid re-render)
  - Depth values: 0=All, 1=Shallow, 2=Medium, 3=Deep — stored as integers, default 1
metrics:
  duration: "3m"
  completed: "2026-03-18"
  tasks: 1
  files: 3
---

# Phase 89 Plan 02: PropertiesExplorer Depth Dropdown Summary

**One-liner:** Depth dropdown (Shallow/Medium/Deep/All) in PropertiesExplorer footer with localStorage persistence and coordinator-wired re-render on change.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing depth dropdown tests | 1d4a75f3 | tests/seams/ui/properties-explorer-depth.test.ts |
| 1 (GREEN) | Depth dropdown implementation + wiring | 8c30089d | src/ui/PropertiesExplorer.ts, src/main.ts |

## Decisions Made

1. **Depth dropdown position**: Inserted at top of footer `div` (before Reset/Enable buttons) so depth control is visually grouped with other footer controls while keeping primary actions at the bottom.

2. **Two subscribers in main.ts**: Rather than merging depth wiring into the existing `projectionExplorer.update()` subscriber, a second `coordinator.scheduleUpdate()` subscriber was added. This separates concerns: projection update is always needed on property toggle, but grid re-render is needed on depth change. Both fire on all subscriber events.

3. **Depth value encoding**: `0` = All (unlimited), `1` = Shallow, `2` = Medium, `3` = Deep. localStorage key is `workbench:prop-depth`. Invalid or non-integer values from localStorage are silently ignored (defaults to 1).

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run tests/seams/ui/properties-explorer-depth.test.ts` — 6/6 pass
- `src/ui/PropertiesExplorer.ts` contains `private _depth = 1`, `getDepth(): number`, `workbench:prop-depth`, `prop-depth-select`, `Shallow (1)`, `All`
- `src/main.ts` wires `propertiesExplorer.subscribe(() => coordinator.scheduleUpdate())`
- Full suite: 3480 passing (11 pre-existing failures in CommandBar + dataset-eviction unrelated to this plan)

## Self-Check: PASSED

- tests/seams/ui/properties-explorer-depth.test.ts: EXISTS
- src/ui/PropertiesExplorer.ts modified: EXISTS
- src/main.ts modified: EXISTS
- Commit 1d4a75f3: FOUND
- Commit 8c30089d: FOUND
