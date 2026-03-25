---
phase: 117-networkview-enhancement
plan: 02
subsystem: ui
tags: [d3, networkview, algorithm-explorer, legend, pick-mode, css, shortest-path, aria]

requires:
  - phase: 117-01
    provides: NetworkView.applyAlgorithmEncoding, AlgorithmExplorer.onResult/onReset, setPickedNodes (ring only), graph:metrics-read, _algorithmActive/_activeAlgorithm/_metricsMap state

provides:
  - Floating legend panel (HTML overlay, bottom-right of SVG) auto-appears/hides on algorithm compute/reset
  - Community color swatches (up to 10) in legend via d3.schemeCategory10
  - Size scale gradient bar in legend for centrality/pagerank/clustering algorithms
  - Path stroke preview and MST stroke preview sections in legend
  - AlgorithmExplorer Reset button (data-testid=algorithm-reset) wired to onReset callback
  - "No path found" error text in danger color when shortest path target unreachable
  - Two-click node picker for shortest path: click source -> click target -> press Run instruction flow
  - .nv-pick-instruction (role=status, aria-live=polite) inside AlgorithmExplorer for pick-mode guidance
  - .nv-pick-dropdowns with source/target <select> fallbacks, alphabetically sorted
  - NetworkView.setPickMode/setPickClickCallback public API
  - NetworkView node click handler routes to pick callback when pick mode active
  - S/T badges use nv-source-badge/nv-target-badge class names with aria-label attributes
  - onPickModeChange wired in main.ts from AlgorithmExplorer to NetworkView
  - src/styles/network-view.css with all legend, pick, reset, dropdown CSS classes

affects: [117-polish, 118-polish-e2e, any future NetworkView feature work]

tech-stack:
  added: []
  patterns:
    - Forward-declared `algorithmExplorer` variable in main.ts enables network factory closure to capture it (same pattern as calcExplorer/viewManager)
    - Pick mode transition: _renderParams sets _pickMode='pick-source' silently (no onPickModeChange) to avoid spurious NetworkView state updates; only user interactions (nodeClicked, select change, Reset) fire the callback
    - Legend panel is HTML div overlay (not SVG) appended to container with container.style.position='relative'; absolute positioning bottom:24px right:24px
    - Badge class names: nv-source-badge / nv-target-badge (replaces picked-badge); aria-label on <g> element for accessibility

key-files:
  created:
    - src/styles/network-view.css
    - tests/views/network-view-legend.test.ts
  modified:
    - src/views/NetworkView.ts
    - src/ui/AlgorithmExplorer.ts
    - src/main.ts
    - tests/views/network-view-encoding.test.ts
    - tests/ui/algorithm-explorer.test.ts

key-decisions:
  - "Pick mode transition on _renderParams is silent (no onPickModeChange callback) — only user-initiated events fire the callback to avoid spurious NetworkView setPickMode calls during re-renders"
  - "S/T badge CSS class renamed from picked-badge to nv-source-badge/nv-target-badge to match UI-SPEC and provide distinct class names for accessibility querying"
  - "Legend _updateLegend() called at end of applyAlgorithmEncoding() and resetEncoding() to keep legend in sync without additional event wiring"

patterns-established:
  - "Network-view.css: dedicated CSS file for NetworkView-specific overlay styles, imported in both NetworkView.ts and AlgorithmExplorer.ts"
  - "Forward-declare mutable let variable in main.ts for cross-closure sharing of explorer instances (algorithmExplorer joins calcExplorer/viewManager pattern)"

requirements-completed: [NETV-04, NETV-05]

duration: 25min
completed: 2026-03-24
---

# Phase 117 Plan 02: NetworkView Enhancement — Legend + Picker Summary

**Floating algorithm legend panel with community swatches, scale bar, and stroke previews; two-click shortest path node picker with dropdown fallback, S/T badges, and instruction text flow**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-24T04:30:16Z
- **Completed:** 2026-03-24T05:00:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `src/styles/network-view.css` with 9 CSS classes (legend panel, pick instruction, dropdowns, reset button, scale bar, stroke preview)
- Added floating legend HTML overlay to NetworkView with algorithm-appropriate content: community swatches (d3.schemeCategory10), size scale gradient, path/MST stroke previews
- Implemented full two-click pick-mode flow in AlgorithmExplorer: nodeClicked() advances idle -> pick-source -> pick-target -> ready with instruction text updates
- Wired pick mode bidirectionally in main.ts: AlgorithmExplorer.onPickModeChange -> NetworkView.setPickMode + setPickedNodes; NetworkView.setPickClickCallback -> AlgorithmExplorer.nodeClicked
- Renamed S/T badge class from `picked-badge` to `nv-source-badge`/`nv-target-badge` with `aria-label` attributes for accessibility
- Added Reset button with `data-testid=algorithm-reset` and unreachable path error message
- Created 19 legend + picker tests; updated 3 pre-existing tests to match new badge class names

## Task Commits

1. **Task 1: Legend panel + network-view.css + Reset button** - `dc12f400` (feat)
2. **Task 2: Shortest path two-click picker + dropdown sync + tests** - `c0bed66b` (feat)

## Files Created/Modified

- `src/styles/network-view.css` - Legend, pick instruction, dropdowns, reset button CSS (new)
- `src/views/NetworkView.ts` - _legendEl field, _updateLegend(), setPickMode(), setPickClickCallback(), node click pick mode routing, nv-*-badge classes
- `src/ui/AlgorithmExplorer.ts` - _pickMode state, nodeClicked(), onPickModeChange(), setCardNames(), Reset button, _renderParams shortest_path case, unreachable path error
- `src/main.ts` - Forward-declared algorithmExplorer, network factory with setPickClickCallback, onPickModeChange wiring
- `tests/views/network-view-legend.test.ts` - 19 tests for legend visibility, swatches, scale bar, stroke previews, S/T badges, pick mode (new)
- `tests/views/network-view-encoding.test.ts` - Updated 3 occurrences of `.picked-badge` -> `.nv-source-badge, .nv-target-badge`
- `tests/ui/algorithm-explorer.test.ts` - Updated "shows no parameter controls" test for shortest_path to expect pick controls

## Decisions Made

- Pick mode transition in `_renderParams` is silent — no `onPickModeChange` callback fired when entering `pick-source` after `_renderParams`. Only user-initiated events (nodeClicked, select change, Reset) trigger the callback. Prevents spurious NetworkView state updates during re-renders.
- S/T badge class renamed from `picked-badge` (Plan 01 name) to `nv-source-badge`/`nv-target-badge` for spec compliance and to enable distinct CSS/aria queries.
- Forward-declare `algorithmExplorer` as `let` in main.ts (joining `calcExplorer`/`viewManager`) to enable the network factory closure to call `algorithmExplorer.nodeClicked`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed badge class from `picked-badge` to spec-required `nv-source-badge`/`nv-target-badge`**
- **Found during:** Task 2 (acceptance criteria check)
- **Issue:** Plan 01 used `picked-badge` class for both source and target badges. Plan 02 acceptance criteria require `nv-source-badge` and `nv-target-badge` as distinct class names per UI-SPEC.
- **Fix:** Updated `setPickedNodes` to pass `badgeClass` parameter (nv-source-badge/nv-target-badge), added `aria-label` attributes. Updated 3 pre-existing test assertions.
- **Files modified:** src/views/NetworkView.ts, tests/views/network-view-encoding.test.ts
- **Verification:** All 42 tests in encoding + legend test files pass
- **Committed in:** c0bed66b (Task 2 commit)

**2. [Rule 1 - Bug] Updated pre-existing algorithm-explorer test for shortest_path parameter controls**
- **Found during:** Task 2 verification
- **Issue:** Pre-existing test "selecting shortest_path shows no parameter controls" expected 0 children in params container. Plan 02 correctly adds pick instruction + dropdowns, making test wrong.
- **Fix:** Updated test to assert `.nv-pick-instruction` and `.nv-pick-dropdowns` presence instead of expecting 0 children.
- **Files modified:** tests/ui/algorithm-explorer.test.ts
- **Verification:** All 12 algorithm-explorer tests pass
- **Committed in:** c0bed66b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** Both auto-fixes necessary for spec compliance and test correctness. No scope creep.

## Issues Encountered

- Initial pick mode `_renderParams` fired `onPickModeChange('pick-source')` during initialization, which overwrote the Reset button's `onPickModeChange('idle')` call. Fixed by making the idle->pick-source transition silent (no callback) — only explicit user interactions fire the callback.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Legend panel and two-click picker complete for NETV-04 and NETV-05
- Phase 117 complete: NETV-01..NETV-05 all satisfied
- Phase 118 (Polish + E2E) can proceed: GFND-04, PAFV-04, CTRL-03, CTRL-04 remain

---
*Phase: 117-networkview-enhancement*
*Completed: 2026-03-24*
