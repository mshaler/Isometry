# Phase 82: UI Control Seams A - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

View tab clicks, histogram scrubber drags, and command bar shortcuts propagate through providers to produce correct downstream state. This phase tests the seams between existing UI controls and their provider backends — no new features, only verification that wiring is correct end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Test Architecture
- Two test layers: unit tests for each seam (fast, isolated) PLUS integration tests for critical round-trips (LATCH→GRAPH, filter→SQL)
- Dedicated seam test files in tests/seams/ directory (e.g., seam-view-tab.test.ts, seam-histogram.test.ts, seam-command-bar.test.ts)
- Integration tests use real sql.js with test DB and fixture data — not mocked bridge responses
- Seam tests verify both provider state AND ARIA attributes (aria-selected, role, etc.)

### View Tab → PAFVProvider Seam (VTAB-01, VTAB-02)
- Tab click must set PAFVProvider.viewType AND update aria-selected=true on the clicked button
- LATCH→GRAPH round-trip: full state snapshot equality (xAxis, yAxis, groupBy, filterAxes, colAxes, rowAxes all restored via structuredClone)
- Representative family pairs: list→network→list (LATCH→GRAPH→LATCH) and grid→tree→grid
- SuperGrid→GRAPH→SuperGrid also tested — verifies schema-aware defaults from _getSupergridDefaults() survive suspension and restore

### Histogram Scrubber → FilterProvider Seam (HIST-01, HIST-02)
- Full SQL round-trip: brush drag → setRangeFilter(field, min, max) → FilterProvider.compile() → execute query against real sql.js → verify result set
- Both numeric and date field types tested
- Full clear round-trip: apply range filter, verify filtered results, then clearBrush + clearRangeFilter, verify full result set returns
- Edge cases: click-without-drag (null selection → clearRangeFilter), single-bin selection, full-range selection

### CommandBar + Shortcuts Destroy Cleanup (CMDB-01, CMDB-02)
- Behavioral verification: after destroy(), dispatch keydown events (Cmd+K, Cmd+F, Escape) and assert NO side effects
- All three components verified: CommandBar (2 document listeners), CommandPalette (input keydown + backdrop click), ShortcutRegistry (document keydown)
- DOM removal verified: component root element gone from document, no orphan child elements remain

### Claude's Discretion
- Exact test fixture data (card counts, field values)
- Helper utilities for common test setup patterns
- Test ordering and grouping within files

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- ViewTabBar (src/ui/ViewTabBar.ts): Full ARIA tablist with roving tabindex, onSwitch callback
- HistogramScrubber (src/ui/HistogramScrubber.ts): D3 brushX with mount/update/destroy lifecycle, calls setRangeFilter/clearRangeFilter
- CommandBar (src/ui/CommandBar.ts): Settings dropdown with 2 document-level listeners, explicit destroy cleanup
- CommandPalette (src/palette/CommandPalette.ts): WAI-ARIA combobox, mount/open/close/destroy lifecycle
- ShortcutRegistry (src/shortcuts/ShortcutRegistry.ts): Single document keydown listener
- PAFVProvider (src/providers/PAFVProvider.ts): setViewType with family-based state suspension via structuredClone and _suspendedStates Map
- FilterProvider (src/providers/FilterProvider.ts): setRangeFilter/clearRangeFilter with compile() → WHERE clause

### Established Patterns
- mount/update/destroy lifecycle on all UI components
- D3 data join with mandatory key function (D-003)
- WorkerBridge.send() for async queries to sql.js Worker
- Existing test patterns in tests/ui/ (unit) and tests/integration/ (integration with real DB)
- tests/integration/seam-selection-notebook.test.ts and seam-calc-footer.test.ts as seam test precedents

### Integration Points
- ViewTabBar.onSwitch → ViewManager.switchTo → PAFVProvider.setViewType
- HistogramScrubber._onBrushEnd → FilterProvider.setRangeFilter → FilterProvider.compile → Worker SQL
- ShortcutRegistry keydown → CommandPalette.open/CommandBar callbacks
- All providers use _scheduleNotify() for async subscriber notification

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 82-ui-control-seams-a*
*Context gathered: 2026-03-17*
