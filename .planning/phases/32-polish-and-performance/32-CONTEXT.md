# Phase 32: Polish and Performance - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Final SuperStack polish phase: validate persistence round-trips at full N-level depth, ensure compound key selection works correctly across all stacking depths, establish render performance benchmarks with pass/fail gates, and verify aggregation correctness when multiple levels are simultaneously collapsed. This is the quality gate before v3.1 ships.

</domain>

<decisions>
## Implementation Decisions

### Render Benchmarks
- Performance budget: <16ms for 100 visible cards (matches existing SuperGrid header comment target, ensures 60fps)
- Benchmark runner: Vitest bench mode (`vitest bench`) — separate from regular test suite, opt-in execution
- Gate style: Simple pass/fail — no historical baseline tracking, no `.benchmark-results.json` file
- Four benchmark scenarios required:
  1. **N-level depth** — 3 stacked col axes + 3 stacked row axes, measures compound key + header spanning overhead
  2. **Mixed collapse states** — Some headers in aggregate mode, others expanded, measures summary cell injection overhead
  3. **Post-reorder re-render** — Full pipeline: FLIP snapshot + provider mutation + re-query + re-render + FLIP animation
  4. **Large dataset stress** — 500+ cards, informational only (not a pass/fail gate), captures practical ceiling

### Aggregation at Depth
- Multi-level collapse composition: **deepest-wins** — only the deepest collapsed level produces a summary cell, parent-level summaries are suppressed to avoid double-counting
- Heat map coloring: consistent `d3.interpolateBlues` at ALL depth levels — no dimming for deeper aggregates
- Test coverage: **combinatorial depth tests** for a 3-axis stack — test every possible combination of collapsed levels (level 0 only, level 1 only, level 2 only, 0+1, 0+2, 1+2, all three) with accurate summary cell count verification
- Children behavior: when a parent header is collapsed, child headers at deeper levels are NOT rendered (hidden, not frozen) — summary cell replaces the entire subtree

### Compound Key Selection
- Selection key: full compound cell key from `buildCellKey()` (e.g., `Work\x1fActive\x1fHigh\x1enote\x1furgent`) — includes ALL axis levels, no leaf-only shortcut
- Shift+click range: works **across all row groups** regardless of depth — visual ordering is transparent to range selection, same behavior as a flat grid
- Lasso over aggregate summary cells: selects ALL underlying cards that the summary represents — summary cell is a proxy for collapsed content
- Collapse/expand reconciliation: **auto-reconcile** — when a group is collapsed, selected cards within it remain selected, visual highlight transfers to the aggregate summary cell, count badge stays accurate, expanding re-shows individual highlights

### Persistence Round-Trip
- Scope: **cross-session simulation** via StateManager — write to `ui_state` table, read back on simulated fresh page load, verify SuperGrid state restores identically (not just provider toJSON/setState)
- Backward-compatibility matrix: test deserialization of state from EVERY prior phase shape:
  - Pre-Phase-15 (no colAxes/rowAxes)
  - Pre-Phase-20 (no colWidths)
  - Pre-Phase-23 (no sortOverrides)
  - Pre-Phase-30 (no collapseState)
- Edge cases — all four categories required:
  1. **Empty arrays** — colAxes: [], rowAxes: [], collapseState: [], sortOverrides: [] — verify no corruption or null coercion
  2. **Max depth** — 6 total axes (3 col + 3 row) with all metadata populated — verify no truncation or key collision
  3. **Stale collapse keys** — keys referencing axis values that no longer exist in data — verify graceful ignore, not errors
  4. **Corrupted/malformed JSON** — truncated JSON, wrong types, missing fields — verify graceful rejection or fallback to defaults

### Claude's Discretion
- Benchmark file location and naming convention within tests/
- Exact vitest bench configuration (warmup iterations, sample count)
- How auto-reconcile visually highlights aggregate summary cells when they contain selected cards
- Implementation approach for deepest-wins suppression logic (filter in _renderCells vs pre-compute in collapse state)
- How to simulate cross-session reload in tests (fresh Database instance vs mock StateManager)

</decisions>

<specifics>
## Specific Ideas

- The deepest-wins rule for aggregation composition prevents double-counting: if level 0 "Engineering" and level 1 "Active" are both collapsed, only "Active"'s summary renders — "Engineering"'s summary is suppressed because a deeper child is already summarizing
- Lasso selecting through aggregate summary cells should feel seamless — the user shouldn't have to expand a group just to select its contents
- Cross-session simulation tests should prove that a user can quit the app, relaunch, and see the exact same SuperGrid configuration (axes, widths, sorts, collapse states) they left

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildCellKey()` / `buildDimensionKey()` (keys.ts): Compound key construction using UNIT_SEP + RECORD_SEP — already handles N-level depth
- `SuperGridSelect` + `SuperGridBBoxCache` (SuperGridSelect.ts, SuperGridBBoxCache.ts): Lasso selection with hit-test infrastructure — needs extension for aggregate summary cells
- `PAFVProvider.toJSON()` / `setState()` (PAFVProvider.ts): Tier 2 serialization with backward-compat guards for colAxes, rowAxes, colWidths, sortOverrides, collapseState
- `StateManager` (StateManager.ts): Tier 2 persistence coordinator — registers providers, saves to `ui_state` table
- `_collapsedSet` + `_collapseModeMap` (SuperGrid.ts): Collapse state tracking with `level\x1fparentPath\x1fvalue` key format
- `d3.interpolateBlues` heat map coloring: Already applied to data cells and aggregate summary cells in Phase 30
- `_renderCells()` (SuperGrid.ts): CSS Grid rendering pipeline — aggregate summary cell injection happens here (lines ~1462-1531)
- `_captureFlipSnapshot()` / `_playFlipAnimation()` (SuperGrid.ts): FLIP animation infrastructure from Phase 31

### Established Patterns
- Vitest for all testing — `vitest.config.ts` exists at project root
- HTML5 DnD with module-level singleton payload
- StateCoordinator subscription: provider mutation triggers automatic `_fetchAndRender()`
- Tier 2 providers implement `PersistableProvider` interface: `toJSON()`, `setState()`, `resetToDefaults()`, `subscribe()`
- Collapse key format: `${level}\x1f${parentPath}\x1f${value}` with UNIT_SEP delimiter

### Integration Points
- `_renderCells()` — deepest-wins aggregation logic integrates here during summary cell injection
- `SuperGridSelect.attach()` — aggregate cell proxy selection hooks into the existing lasso hit-test
- `SelectionProvider` — auto-reconcile on collapse needs to bridge between SuperGrid's collapse toggle and SelectionProvider's state
- `StateManager` — cross-session tests write/read through this coordinator to prove full database round-trip
- `PAFVProvider.setState()` — backward-compat matrix tests exercise the restoration guards at lines 567-599

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-polish-and-performance*
*Context gathered: 2026-03-06*
