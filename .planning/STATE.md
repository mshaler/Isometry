---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SuperGrid Complete
status: unknown
last_updated: "2026-03-05T02:34:09.070Z"
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 16
  completed_plans: 16
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v3.0 SuperGrid Complete — Phase 15 ready to plan

## Current Position

Phase: 21 of 27 (SuperSelect — Lasso Selection) — Complete
Plan: 3 of 3 (complete)
Status: Phase 21 Complete
Last activity: 2026-03-05 — Phase 21 Plan 03 complete. SuperGrid selection wiring: click/Cmd+click/Shift+click 2D range, header select-all, Escape, floating badge, BBoxCache.scheduleSnapshot, SuperGridSelect lasso lifecycle. 21 new tests. SLCT-01/02/03/05/07 satisfied. Phase 21 complete.

Progress: [████░░░░░░] 36% (15/42 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v3.0)
- Average duration: — min
- Total execution time: — hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v3.0 phases TBD | 39 est. | — | — |

*Updated after each plan completion*

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 15-pafvprovider-stacked-axes | P01 | 3 min | 1 | 2 |
| 15-pafvprovider-stacked-axes | P02 | 2 min | 2 | 2 |
| 16-supergridquery-worker-wiring | P01 | 3 min | 1 | 4 |
| 16-supergridquery-worker-wiring | P02 | 3 min | 1 | 2 |
| 17-supergrid-dynamic-axis-reads | P01 | 4 min | 1 | 4 |
| 17-supergrid-dynamic-axis-reads | P02 | 6 min | 1 | 1 |
| 18-superdynamic | P01 | 44 min | 1 | 3 |
| 18-superdynamic | P02 | 4 min | 2 | 2 |
| 19-superposition-superzoom | P01 | 4 min | 2 | 6 |
| 19-superposition-superzoom | P02 | 20 min | 2 | 4 |
| 19-superposition-superzoom | P03 | 2 min | 1 | 2 |
| Phase 20-supersize P01 | 9 | 1 tasks | 7 files |
| Phase 20-supersize P02 | 7 | 2 tasks | 4 files |
| Phase 21-superselect P01 | 3 | 1 tasks | 3 files |
| Phase 21-superselect P02 | 4 | 1 tasks | 2 files |
| Phase 21-superselect P03 | 8 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.
All v2.0 native decisions documented in PROJECT.md Key Decisions table.

v3.0 key constraints (from research):
- SuperZoom MUST use CSS Custom Property scaling (not d3.zoom transform — overflow:auto conflict is architectural)
- SuperPositionProvider MUST NOT register with StateCoordinator (would trigger 60 supergrid:query calls/second during scroll)
- HTML5 DnD dragPayload MUST be a module-level singleton (dataTransfer.getData() blocked during dragover)
- FTS highlights MUST be passed as data to D3 render cycle (no innerHTML injection outside data join)
- Lasso MUST use bounding box cache (not live getBoundingClientRect() per mousemove — O(N×M) layout thrash)
- gridColumn/gridRow MUST be set in both enter AND update callbacks (density collapse misalignment pitfall)
- All axis state MUST live in PAFVProvider (not SuperGrid instance state — orphans on view destroy)
- [Phase 15-pafvprovider-stacked-axes]: Same-family setViewType applies colAxes/rowAxes from VIEW_DEFAULTS: list→supergrid (both LATCH) initializes supergrid stacked axis defaults without cross-family suspension path
- [Phase 15-pafvprovider-stacked-axes]: setState() backward-compat: older PAFVState without colAxes/rowAxes fields defaults to [] to prevent restore failures
- [Phase 15-pafvprovider-stacked-axes]: Cross-dimension duplicate fields allowed in colAxes/rowAxes: same field can drive both column and row grouping in SuperGrid
- [Phase 15-pafvprovider-stacked-axes]: getStackedGroupBySQL() validates ALL axis fields at call time (not just at setter time) to defend against JSON-restored corrupt state
- [Phase 15-pafvprovider-stacked-axes]: getStackedGroupBySQL() returns defensive copies and is view-type agnostic — Phase 16 caller decides what to do with empty arrays
- [Phase 16-supergridquery-worker-wiring]: classifyError maps "sql safety violation" to INVALID_REQUEST error code (not UNKNOWN) so axis validation errors produce structured error codes
- [Phase 16-supergridquery-worker-wiring]: handleSuperGridQuery uses columnarToRows (db.exec pattern) for GROUP BY results; handleDistinctValues extracts flat string[] from first column
- [Phase 16-supergridquery-worker-wiring]: Empty axes (no colAxes and no rowAxes) return single cell with total count — Phase 17 render pipeline expects this for "no grouping" state
- [Phase 16-supergridquery-worker-wiring]: superGridQuery() rAF coalescing silently abandons earlier callers' promises (no reject, no resolve) — simplest contract for StateCoordinator batch scenarios
- [Phase 16-supergridquery-worker-wiring]: distinctValues() has no rAF coalescing — simple pass-through wrapper since it is not called in high-frequency batches
- [Phase 17-supergrid-dynamic-axis-reads]: SuperGrid.render(cards) is an intentional no-op — data flows through bridge.superGridQuery() triggered by StateCoordinator subscription, not through IView.render()
- [Phase 17-supergrid-dynamic-axis-reads]: VIEW_DEFAULTS fallback (card_type/folder) lives in SuperGrid._fetchAndRender(), not in PAFVProvider — SuperGrid owns the fallback decision; provider is view-type agnostic
- [Phase 17-supergrid-dynamic-axis-reads]: Collapse click handler uses cached _lastCells without re-querying bridge — avoids unnecessary Worker round-trips on pure UI toggle interactions
- [Phase 17-supergrid-dynamic-axis-reads]: Narrow interfaces SuperGridBridgeLike/SuperGridProviderLike/SuperGridFilterLike in types.ts — each is the minimal contract SuperGrid needs; tests use mocks, production uses real providers
- [Phase 17-supergrid-dynamic-axis-reads]: Tests went GREEN immediately because Plan 01 implementation was complete — TDD cycle collapsed to test-as-specification
- [Phase 17-supergrid-dynamic-axis-reads]: FOUN-11 integration test uses plain batching coordinator mock (subscribe + setTimeout(16)) — tests SuperGrid reaction in isolation without real StateCoordinator dependency
- [Phase 18-superdynamic]: AxisDragPayload.field stores axis field name (e.g. 'card_type'), NOT displayed value (e.g. 'note') — grips encode the provider array key, not the rendered cell value
- [Phase 18-superdynamic]: Drop zones created once in mount() as absolute-positioned overlay strips on _rootEl — avoids re-wiring listeners on every _renderCells() call (no deduplication guard needed)
- [Phase 18-superdynamic]: SuperGridProviderLike extended with setColAxes/setRowAxes — PAFVProvider already implements both; test mocks updated to satisfy new interface
- [Phase 18-superdynamic]: Drop handler calls provider setters only; StateCoordinator subscription fires _fetchAndRender() automatically — consistent with Phase 17 anti-pattern constraint
- [Phase 18-superdynamic P02]: Same-dimension reorder reads targetIndex from dropZoneEl.dataset['reorderTargetIndex'] — decouples target calculation from drop handler; tests set it directly, production can set it from pointer-position logic
- [Phase 18-superdynamic P02]: _wireDropZone handles both same-dimension and cross-dimension in a single event listener — one DnD API, consistent behavior
- [Phase 18-superdynamic P02]: D3 transition auto-cancels previous in-flight transitions on the same element — no explicit cancel logic needed for rapid axis changes
- [Phase 18-superdynamic P02]: Error path in _fetchAndRender restores opacity=1 synchronously — error messages always visible after failed bridge queries
- [Phase 19-superposition-superzoom]: SuperPositionProvider has no subscribe/notify — NOT registered with StateCoordinator (would trigger 60fps worker calls during scroll)
- [Phase 19-superposition-superzoom]: reset() preserves zoomLevel — zoom is a preference that outlives individual grid sessions (filter changes, axis reorders)
- [Phase 19-superposition-superzoom]: buildGridTemplateColumns uses var(--sg-col-width, 120px) not minmax(60px, 1fr) — fixed-width columns required for CSS Custom Property zoom scaling
- [Phase 19-superposition-superzoom P02]: SuperGridPositionLike 5th constructor arg is optional with _noOpPositionProvider default — backward-compat with all existing 4-arg test calls
- [Phase 19-superposition-superzoom P02]: SuperZoom cast via `as any` in SuperGrid.ts — structurally compatible interfaces avoid concrete import of SuperPositionProvider in SuperGrid
- [Phase 19-superposition-superzoom P02]: Position restore must happen after _fetchAndRender() resolves — scroll container has zero extent before content renders
- [Phase 19-superposition-superzoom P02]: Zoom toast created lazily on first zoom event — no DOM overhead for users who never zoom; destroyed in destroy()
- [Phase 19-superposition-superzoom P03]: _isInitialMount = false set BEFORE restorePosition() in mount() .then() — flag must transition first so subsequent coordinator callbacks reset scroll instead of calling restorePosition
- [Phase 19-superposition-superzoom P03]: Scroll reset (scrollTop/scrollLeft=0) runs synchronously after _renderCells() and before D3 opacity transition — position set before crossfade reveals new content
- [Phase 20-supersize]: buildGridTemplateColumns uses direct px values (not CSS Custom Properties per column) — simpler, no key sanitization needed for colKey values with special chars
- [Phase 20-supersize]: setColWidths does NOT call _scheduleNotify — width changes are CSS-only, no Worker re-query needed; colWidths persist at next Tier 2 checkpoint
- [Phase 20-supersize]: colWidths reset to {} on setColAxes/setRowAxes — stale widths meaningless when axis changes produce different columns
- [Phase 20-supersize]: CSS.escape has no fallback in jsdom — used typeof guard with manual regex escape as fallback
- [Phase 20-supersize]: _sizer initialized in constructor (not mount) so persisted colWidths load before first render
- [Phase 20-supersize]: onZoomChange callback wires _sizer.applyWidths() after SuperZoom.applyZoom() — zoom still sets --sg-row-height/--sg-zoom, sizer rebuilds grid-template-columns
- [Phase 21-superselect]: BBoxCache.scheduleSnapshot() uses rAF to defer DOM measurement; rectsIntersect uses b.x+b.width (not b.right) for jsdom safety; SuperGridSelectionLike follows narrow-interface pattern
- [Phase 21-superselect P02]: classifyClickZone priority order: header > supergrid-card > data-cell > grid (first match wins via .closest())
- [Phase 21-superselect P02]: getCellCardIds injected as callback to attach() — decouples SuperGridSelect from CellDatum; Plan 21-03 provides lambda from SuperGrid._lastCells
- [Phase 21-superselect P02]: jsdom does not define setPointerCapture/releasePointerCapture — assign as vi.fn() directly on element (vi.spyOn requires existing property)
- [Phase 21-superselect P02]: hitTest called with client coordinates (not SVG-relative) in both pointermove and pointerup — BBoxCache stores client coords from getBoundingClientRect
- [Phase 21-superselect]: self=this pattern: capture class ref before D3 .each(function(d)) for onclick handlers inside SuperGrid._renderCells()
- [Phase 21-superselect]: SuperGridSelectionLike adapter created in main.ts over SelectionProvider — keeps SuperGrid decoupled from concrete provider class
- [Phase 21-superselect]: SuperGridSelect.attach() called in _fetchAndRender().then() — ensures grid has content before lasso overlay activates

### Pending Todos

None.

### Blockers/Concerns

- SuperTime non-contiguous selection UI affordance is an open design question (data model clear, interaction design not specified in SuperGrid.md). Needs explicit design before Phase 26 planning.
- SuperSize persistence location: RESOLVED — colWidths stored in PAFVState.colWidths (PAFVProvider), consistent with colAxes/rowAxes precedent.
- SuperDensity Level 4 Region density has no UI design — stubbed in v3.0, flag for v3.1+ design work.

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 21-superselect Plan 03 — SuperGrid selection wiring complete. Phase 21 SuperSelect complete.
Resume: Phase 22 planning — next phase in v3.0 SuperGrid Complete milestone.
