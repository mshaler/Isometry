---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SuperGrid Complete
status: unknown
last_updated: "2026-03-05T17:04:36.348Z"
progress:
  total_phases: 12
  completed_phases: 12
  total_plans: 32
  completed_plans: 32
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v3.0 SuperGrid Complete — Phase 15 ready to plan

## Current Position

Phase: 26 of 27 (SuperTime — Time Axis Auto-Detection) — COMPLETE
Plan: 3 of 3 (complete)
Status: Phase 26 Plan 03 Complete — TIME-04/TIME-05 satisfied (non-contiguous period selection via Cmd+click)
Last activity: 2026-03-05 — Phase 26 Plan 03 complete. _periodSelection Set<string> field + Cmd+click period selection routing for time col headers. FilterProvider.setAxisFilter() compilation. Show All button, Escape key clear, teal accent, axis-change cleanup. 9 new TDD tests. 1838 total tests passing. TIME-01 through TIME-05 complete. Phase 26 COMPLETE.

Progress: [████░░░░░░] 62% (32/52 plans complete)

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
| Phase 21-superselect P04 | 5 | 2 tasks | 6 files |
| Phase 22-superdensity P01 | 5 | 2 tasks | 6 files |
| Phase 22-superdensity P02 | 9 | 2 tasks | 4 files |
| Phase 22-superdensity P03 | 12 | 2 tasks | 2 files |
| Phase 23-supersort P01 | 6 | 2 tasks | 5 files |
| Phase 23-supersort P02 | 7 | 1 tasks | 2 files |
| Phase 23-supersort PP03 | 8 | 1 tasks | 2 files |
| Phase 24-superfilter P01 | 4 | 2 tasks | 3 files |
| Phase 24-superfilter PP02 | 5 | 1 tasks | 2 files |
| Phase 24-superfilter P03 | 10 | 2 tasks | 2 files |
| Phase 25-supersearch P01 | — | 1 tasks | 3 files |
| Phase 25-supersearch P02 | 12 | 1 tasks | 2 files |
| Phase 25-supersearch P03 | 7 | 1 tasks | 2 files |
| Phase 26-supertime P01 | 2 | 1 tasks | 2 files |
| Phase 26-supertime P02 | 7 | 1 tasks | 2 files |
| Phase 26-supertime P03 | 7 | 1 tasks | 2 files |

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
- [Phase 21-superselect]: isCardSelected over isSelectedCell: visual determination uses card ID lookup via _getCellCardIds, not cell key lookup — correct for flat SelectionProvider model
- [Phase 21-superselect]: lasso-hit stored on gridEl not rootEl — gridEl contains the .data-cell elements; _gridEl now stored as class field in SuperGridSelect
- [Phase 21-superselect]: lasso highlight applies rgba(26, 86, 240, 0.06) half opacity of final selection (0.12) to distinguish preview from committed selection
- [Phase 22-superdensity]: SuperDensityProvider is a standalone new PersistableProvider (not extending PAFVState) — density concerns are orthogonal to axis assignments
- [Phase 22-superdensity]: Hybrid routing in density subscription: granularity changes require Worker re-query; hideEmpty/viewMode are pure client-side transforms
- [Phase 22-superdensity]: DENS-06 is already satisfied by chained .each() after .join() — no code change needed, added documentation comment
- [Phase 22-superdensity]: SuperDensityProvider IS registered with StateCoordinator (unlike SuperPositionProvider) — density changes are slow discrete user actions
- [Phase 22-superdensity]: compileAxisExpr() validates raw field BEFORE strftime wrapping — prevents false SQL safety violations on valid time fields
- [Phase 22-superdensity]: Alias pattern in SELECT: strftime('%Y-%m', created_at) AS created_at — downstream CellDatum consumers use raw field names unchanged
- [Phase 22-superdensity]: Density toolbar always visible; granularity picker hidden (display:none) when no time axis — Plan 03 hide-empty + view-mode controls use same toolbar
- [Phase 22-superdensity Plan 03]: _noOpDensityProvider defaults to viewMode='matrix' — preserves count-badge backward compatibility for all tests that don't inject a density provider
- [Phase 22-superdensity Plan 03]: Hide-empty filter applied before buildHeaderCells() — filtered axis values drive CSS Grid layout; cells outside filtered set excluded from cellPlacements
- [Phase 22-superdensity Plan 03]: d3.scaleSequential maxCount computed once per _renderCells() call — avoids N recalculations in D3 .each() loop
- [Phase 22-superdensity Plan 03]: Spreadsheet card pills show raw card_ids (not names) — card name lookup via bridge deferred; pill visual treatment satisfies density switch requirement
- [Phase 23-supersort]: SortEntry defined in SortState.ts; PAFVProvider imports it to avoid circular imports
- [Phase 23-supersort]: setSortOverrides is atomic — validates ALL fields before modifying state
- [Phase 23-supersort]: setColAxes/setRowAxes reset sortOverrides=[] — stale sorts meaningless after axis change
- [Phase 23-supersort]: sortOverrides appended AFTER axis ORDER BY parts to preserve group boundaries (SORT-04)
- [Phase 23-supersort]: sort overrides validated against axis allowlist at call time — same D-003 SQL safety as axis fields
- [Phase 23-supersort]: sort overrides use raw field names — NOT strftime-wrapped even when granularity is set
- [Phase 23-supersort]: Sort icon click stopPropagation prevents header collapse; provider mutation fires _fetchAndRender via coordinator
- [Phase 23-supersort]: SortState initialized from provider.getSortOverrides() in constructor for session restore — no additional mount() wiring
- [Phase 23-supersort]: Clear sorts button visibility toggled at end of _renderCells() via hasActiveSorts()
- [Phase 24-superfilter]: setAxisFilter(field, []) deletes from map rather than storing empty array — prevents invalid IN () SQL and satisfies FILT-05
- [Phase 24-superfilter]: Axis filter compile order: regular _filters loop first, then _axisFilters map iteration — deterministic, regular filters before axis filters
- [Phase 24-superfilter]: clearAxis validates field via validateFilterField — same SQL safety gate as setAxisFilter; invalid field throws before touching map
- [Phase 24-superfilter]: Dropdown appended to _rootEl (not _gridEl) — must survive _renderCells DOM clearing which empties _gridEl on every render
- [Phase 24-superfilter]: _getAxisValues() aggregates from _lastCells at open time — satisfies FILT-02 (no Worker round-trip on dropdown open)
- [Phase 24-superfilter]: rAF-deferred click-outside listener prevents opening click from immediately dismissing filter dropdown
- [Phase 24-superfilter Plan 03]: Select All calls clearAxis (not setAxisFilter with all values) — cleaner semantics, avoids stale value list
- [Phase 24-superfilter Plan 03]: Cmd+click uses mousedown + preventDefault — intercepts before browser checkbox toggle on mouseup
- [Phase 24-superfilter Plan 03]: _clearFiltersBtnEl visibility checks both _lastColAxes and _lastRowAxes for complete axis coverage
- [Phase 24-superfilter Plan 03]: Search input event listener wired after label loop so querySelectorAll('label') finds all labels
- [Phase 25-supersearch Plan 01]: searchTerm guarded with .trim() before FTS5 MATCH — empty/whitespace = no FTS clause; FTS5 MATCH crash on empty string is a critical pitfall
- [Phase 25-supersearch Plan 01]: Search params appended AFTER filter params in positional SQL array — search WHERE clause appended after filterWhere
- [Phase 25-supersearch Plan 01]: matchedCardIds uses bracket notation cell['matchedCardIds'] — compatible with CellDatum [key: string]: unknown index signature without structural modification
- [Phase 25-supersearch Plan 01]: searchTerms is string[] array (not scalar) in WorkerResponses — future-proofs for multi-term FTS highlighting in Plan 02
- [Phase 25-supersearch Plan 01]: Secondary FTS query uses db.exec() columnar for flat ID extraction; primary GROUP BY uses db.prepare() row objects
- [Phase 25-supersearch Plan 02]: Escape in search input calls e.stopPropagation() — prevents document-level Escape handler (selection clear) from also firing on search-clear action
- [Phase 25-supersearch Plan 02]: exactOptionalPropertyTypes spread pattern: ...(this._searchTerm ? { searchTerm: this._searchTerm } : {}) — satisfies TS strict config, avoids 'string | undefined' incompatibility
- [Phase 25-supersearch Plan 02]: Immediate clear (no debounce) on empty input (!term.trim()) — SRCH-05 requires instant highlight removal on clear
- [Phase 25-supersearch Plan 02]: Cmd+F handler registered on document (not rootEl) — intercepts even when supergrid has no focus, mirrors browser find bar behavior
- [Phase 25-supersearch Plan 02]: Match count badge uses matchedCardIds bracket notation on CellDatum — consistent with Plan 01 design; array check covers both empty array and undefined
- [Phase 25-supersearch Plan 03]: Highlight rendering placed in D3 .each() AFTER view-mode branching — highlights overlay rendered content (matrix count-badge or spreadsheet pills already exist)
- [Phase 25-supersearch Plan 03]: Opacity always set with empty string on clear (never stale — Pitfall 4 avoidance)
- [Phase 25-supersearch Plan 03]: sg-search-match CSS injected via style#sg-search-styles in mount() — one-time, document-level ID guard prevents duplicates across SuperGrid instances
- [Phase 25-supersearch Plan 03]: mark tags created via document.createElement('mark') + appendChild only — innerHTML injection locked out (SRCH-03)
- [Phase 25-supersearch Plan 03]: DYNM-04 opacity assertion broadened to accept D3 transition intermediate values — pre-existing flaky test fixed (was checking ['0','1',''] but D3 v7 can yield 0.00021... in jsdom)
- [Phase 26-supertime]: US/EU parser disambiguation guard: pre-validate first slash-segment <= 12 before US parse to prevent d3.timeParse month-overflow false positives (day > 12 is unambiguously EU format)
- [Phase 26-supertime]: smartHierarchy thresholds: <=20 day, <=140 week, <=610 month, <=1825 quarter, >1825 year — targeting ~10-20 columns via d3.timeDay.count; 0 days (same date) returns 'day'
- [Phase 26-supertime]: [Phase 26-supertime Plan 02]: _isAutoGranularity=true default — adaptive smart detection always re-evaluates on mount per CONTEXT.md; loop guard (smartLevel !== currentLevel) prevents density subscriber infinite re-query cycle
- [Phase 26-supertime]: [Phase 26-supertime Plan 02]: Segmented pills replace <select> granularity picker — A pill sets _isAutoGranularity=true + re-runs _fetchAndRender; D/W/M/Q/Y pills set _isAutoGranularity=false + call setGranularity() directly
- [Phase 26-supertime]: Immediate _renderCells() after period toggle provides instant visual feedback without relying on FilterProvider subscriber chain (needed for mocked tests and UX)
- [Phase 26-supertime]: _periodSelection Set<string> uses cell.value (strftime-formatted CellDatum field) as period keys — ensures FilterProvider IN (?) compilation matches query results exactly
- [Phase 26-supertime]: Cmd+click routing: isTimeField AND hasGranularity required for period selection — prevents SLCT-05 regression on non-time axes or null granularity

### Pending Todos

None.

### Blockers/Concerns

- SuperTime non-contiguous selection UI affordance: RESOLVED — Phase 26 Plan 03 implemented per CONTEXT.md spec (Cmd+click, Show All, Escape, teal accent).
- SuperSize persistence location: RESOLVED — colWidths stored in PAFVState.colWidths (PAFVProvider), consistent with colAxes/rowAxes precedent.
- SuperDensity Level 4 Region density has no UI design — stubbed in v3.0, flag for v3.1+ design work.

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 26-supertime Plan 03 — TIME-04/TIME-05: non-contiguous period selection via Cmd+click on time period headers. _periodSelection Set<string>, FilterProvider.setAxisFilter() integration, Show All button, Escape key clear, teal accent, axis-change cleanup. 9 new TDD tests. 1838 total tests passing. Phase 26 SuperTime COMPLETE — TIME-01 through TIME-05 all satisfied.
Resume: Phase 27 — v3.0 final phase.
