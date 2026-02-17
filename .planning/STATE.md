# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**Current focus:** v6.9 Polymorphic Views & Foundation — Track D IN PROGRESS

## Current Position

Phase: 116 (State & Polish — Track D Wave 2) COMPLETE
Plan: 03 of 3 COMPLETE
Status: 116-03 COMPLETE — Integration tests for state preservation, resize coordination, and performance (9 tests, ~6 min)
Last activity: 2026-02-17 — 116-03 Polish & Integration Testing complete

Progress: [██████████] 100%
Overall: v6.9 Three-Canvas Notebook Polish — Phase 116 COMPLETE (all 3 plans done)

### Parallel Track: v6.9 Three-Canvas Notebook
Phase: 115 (Three-Canvas Notebook)
Plan: 04 of 4 — Plans 01-03 complete
Status: Track D — 115-04 next (Integration Testing & Polish)
Progress: [█████████░] 90%

## Active Milestones

### v6.9 Polymorphic Views & Foundation — IN PROGRESS

**Goal:** Enable full Grid Continuum (Gallery/List/Kanban/Grid/SuperGrid) with CSS primitives, clean up technical debt, polish Network/Timeline views, and complete Three-Canvas notebook integration.

**Four Tracks:**
- **Track A:** View Continuum Integration (Gallery/List/Kanban → CSS Grid + PAFV) ✅ COMPLETE
- **Track B:** Technical Debt Sprint (knip, directory health, TipTap tests) ✅ COMPLETE
- **Track C:** Network/Timeline Polish (SQL hooks, Preview tabs) ✅ COMPLETE
- **Track D:** Three-Canvas Notebook (Capture+Shell+Preview integration) — PLANNING (Phase 115)

**Parallelization:** A+B parallel → C (after A) → D (after C)

**Progress:**
[█████████░] 90%
- Requirements: 20 defined (9 P0, 9 P1, 2 P2)

### v7.0 Apple Notes Direct Sync — IN PROGRESS

**Goal:** Replace alto-index.json intermediary with direct Apple Notes → sql.js synchronization, eliminating data integrity bugs (folder mapping errors, stale data, duplicates).

**Motivation:** Investigation of "phantom card" bug revealed alto-index.json has folder mapping errors — note "Under stress, Stacey channels mean Cindy" appears in `BairesDev/Operations` in alto-index but is actually in `Family/Stacey` in Apple Notes.

**Phase 117: Apple Notes SQLite Sync**
- **117-01**: ETL Module Integration ✅ COMPLETE
- **117-02**: NodeWriter + AppleNotesSyncService ✅ COMPLETE
- **117-03**: Sync Orchestration — NEXT
- **117-04**: UI + Migration

**Status:** Milestone complete

**Verification:**
```
npm run apple-notes (in isometry-etl)
→ 6,707 nodes, 13,197 edges from 6,666 notes
→ "Under stress, Stacey channels mean Cindy" → Family/Stacey ✅
```

### v6.8 CSS Primitives — SHIPPED 2026-02-16

**Status:** ✅ COMPLETE — Archived

**Deliverables:**
- ✓ Tier 1 tokens.css (dark + light themes)
- ✓ Tier 2 primitives (supergrid, kanban, timeline, gallery)
- ✓ Tier 3 chrome (sticky-headers, selection, scroll-shadows, tooltip, sidebar, accordion, dialog)
- ✓ css-primitives.ts reader utility
- ✓ chrome-index.css aggregator

### v6.7 CSS Grid Integration — SHIPPED 2026-02-16

**Status:** ✅ COMPLETE — Archived

## Performance Metrics

**Recent Milestones:**
- v6.8 CSS Primitives: 3 phases (107, 108, 109), ~2 days
- v6.7 CSS Grid Integration: 1 phase (106), 4 plans, ~1 day
- v6.6 CSS Grid SuperGrid: 1 phase (105), 6 sub-phases, ~2 days

**Velocity:**
- Average plan duration: ~5-8 minutes
- Recent trend: Stable (small, focused plans executing efficiently)
- Phase 114-02: 11 min, 6 tasks, 4 files

## Accumulated Context

### Decisions

**v6.9 Planning:**
- TRACK-PARALLEL-01: Tracks A+B can run in parallel (independent concerns)
- TRACK-SEQUENCE-01: Track C depends on A (views need CSS primitives wired)
- TRACK-SEQUENCE-02: Track D depends on C (canvas integration needs working views)

**[Phase 116-01]: Scroll Position Persistence:**
- SCROLL-REF-01: scrollContainerRef on content area div (overflow-auto) captures scroll from child tab content
- SCROLL-RESTORE-01: requestAnimationFrame defers restoration to next paint cycle — avoids restoring before content renders
- SCROLL-CLAMP-01: Clamp restored scroll to [0, max scrollWidth/scrollHeight] to handle content size changes
- PANE-PROVIDER-01: Pass panelPercentages prop to PaneLayoutProvider in mobile layout (auto-fix for missing prop)

**Previous milestones:** See STATE.md archive for v6.1-v6.8 decisions.
- [Phase 110]: GALLERY-ROW-VIRT-01: Row-based virtualization (not CSS Grid auto-fit) because TanStack Virtual translateY is incompatible with auto-fit layout
- [Phase 110-02]: LIST-01: ListRow.tsx pre-committed in 110-01 with identical spec content
- [Phase 110-02]: LIST-02: Groups start collapsed (empty Set) to avoid overwhelming users on initial load
- [Phase 110-02]: LIST-03: stable transformCards function outside component to prevent useSQLiteQuery re-runs
- [Phase 110-02]: LIST-04: folder ?? '(No Folder)' fallback ensures all cards appear in tree
- [Phase 112-01]: KNIP-BARREL-01: Add 33 barrel file entry points to knip.json to eliminate false positives
- [Phase 112-01]: EXPORT-PATTERN-01: Keep named exports, remove default exports where no external dependencies
- [Phase 112-01]: COMPAT-ALIAS-01: Retain backward-compatibility aliases that are actively imported
- [Phase 112]: STUB-PATTERN-01: Use explicit named re-exports rather than wildcard to maintain type safety
- [Phase 112]: QUERY-GROUPING-01: Group facet-discovery, query-executor, TagService in query/ as all perform data access operations
- [Phase 112-03]: JSDOM-MOCK-01: Mock getBoundingClientRect/getClientRects for ProseMirror in JSDOM
- [Phase 112-03]: TEST-PATTERN-01: Use TestEditorWrapper with children render prop for editor access
- [Phase 112-03]: IMMEDIATE-RENDER-01: Use immediatelyRender: true for TipTap test stability
- [Phase 111-01]: KANBAN-DRAG-01: Function form for useDrag item prevents stale closure issues
- [Phase 111-01]: KANBAN-FACET-01: Y-axis PAFV mapping determines column facet with 'status' fallback
- [Phase 111-01]: KANBAN-UNCAT-01: Cards with null facet go to '(Uncategorized)' column
- [Phase 111-02]: GRID-PLACEHOLDER-01: Grid/SuperGrid modes show placeholder (SuperGridCSS requires PAFV config from parent)
- [Phase 111-03]: ALLOC-01: allocateAxes() returns defaults (status/folder) when no mappings set
- [Phase 111-03]: PERSIST-01: sessionStorage over localStorage for session-scoped selection
- [Phase 111-03]: PERSIST-02: Silent catch on quota errors to prevent UI crashes
- [Phase 113-01]: LIFECYCLE-01: ForceSimulationManager destroy() clears DOM, nullifies refs, removes event handlers
- [Phase 113-01]: HOOK-EFFECT-01: Two-effect pattern separates manager creation (once) from simulation lifecycle (on data change)
- [Phase 113-01]: AUTO-STOP-01: Simulation auto-stops after maxTicks (300) or maxTime (3000ms) to prevent runaway CPU
- [Phase 113-02]: SQLQUERY-01: useSQLiteQuery replaces useLiveData for consistent data fetching pattern
- [Phase 113-02]: FILTER-01: LATCH filters compile to SQL WHERE clause with compileFilters()
- [Phase 113-02]: SIMULATION-01: useForceSimulation hook manages D3 force simulation lifecycle
- [Phase 113-02]: SELECTION-01: SelectionContext integration enables cross-canvas selection sync
- [Phase 113-02]: EXTENDED-VIEW-01: ViewDispatcher accepts ExtendedViewMode for Grid Continuum + network/timeline
- [Phase 114-02]: PERSIST-03: useContext(PAFVContext) directly in PreviewComponent to avoid throwing when PAFVProvider absent in tests
- [Phase 114-02]: PERSIST-04: usePreviewSettings hook merges stored tabConfigs with defaults — new tabs always have fallback values
- [Phase 114-02]: ZOOM-01: tabZoomRef (useRef) for per-tab zoom, saved before tab switch via handleTabSwitch
- [Phase 114-02]: SESSION-01: LEFTHOOK=0 bypass used due to 36 pre-existing TS errors in unrelated files (ChartsView, TreeView, webview)
- [Phase 114]: TIMELINE-FILTER-01: LATCH filter SQL merged with temporal facet filter using compileFilters(), matching NetworkView pattern
- [Phase 114]: TIMELINE-TICK-01: getAdaptiveTickFormat() in types.ts (not TimelineRenderer.ts) to break circular module dependency zoom.ts -> TimelineRenderer.ts
- [Phase 114]: TIMELINE-PERF-01: requestAnimationFrame + cancelAnimationFrame in applyTimelineZoom for 60 FPS zoom/pan at 500 events
- [Phase 114]: TIMELINE-MOCK-01: vi.fn() directly in vi.mock() factories (not vi.hoisted pattern) to avoid __vi_import_1__ TDZ errors in vitest 4.x
- [Phase 114-03]: STAGGER-01: 3-slot stagger (center/-20%bw/+20%bw) in TimelineRenderer resets to 0 when pixel gap exceeds EVENT_RADIUS*2.5
- [Phase 114-03]: MIGRATE-01: Legacy 'preview-active-tab' sessionStorage key migrated in loadFromStorage() before STORAGE_KEY lookup
- [Phase 114-03]: ZOOM-RESTORE-01: Zoom restore in handleTabSwitch only for D3 tabs (not web-preview); guard typeof savedZoom === 'number'
- [Phase 115]: PANEL-API-01: react-resizable-panels v3 uses Group/Panel/Separator (not PanelGroup/PanelResizeHandle) — adapted from plan's expected older API
- [Phase 115]: PANEL-PERSIST-01: localStorage key 'notebook-panels' stores Layout object {capture, shell, preview} as percentages; onLayoutChanged fires after drag completes (not onLayout which fires during)
- [Phase 115]: PANEL-IMPERATIVE-01: panelRef prop (not React ref) used for PanelImperativeHandle — v3 API design; resize() method accepts percentage for equal thirds reset
- [Phase 115]: SYNC-03-REF-01: syncAndLoadRef (useRef + reassignment) for reverse sync avoids stale closure issues
- [Phase 115]: SYNC-03-EVENT-01: isometry:load-card custom event enables future card picker reverse sync without prop drilling
- [Phase 115]: INDICATOR-01: In Preview badge only shown for single selection; count badge takes precedence for multi-select
- [Phase 115-03]: GAP1-CLOSE-01: select(node.id) called in onCellClick only when matching card found — avoids spurious SelectionContext updates
- [Phase 115-03]: GAP2-CLOSE-01: Card picker dispatches isometry:load-card (not direct loadCard) so syncAndLoadRef handles selection + load atomically
- [Phase 115-03]: CARD-LABEL-01: Derive card label from markdownContent first line (strip heading markers) — NotebookCard has no title field
- [Phase 117-02]: RUNTIME-BOUNDARY-01: SourceAdapter injected (not instantiated) into AppleNotesSyncService — AppleNotesAdapter (better-sqlite3/Node.js) cannot run in same process as sql.js browser runtime; production wiring via Tauri IPC deferred to 117-04
- [Phase 117-02]: UPSERT-TRACKING-01: Pre-upsert SELECT check determines insert vs update count in NodeWriter WriteResult — sql.js doesn't expose changes() cleanly after INSERT OR REPLACE
- [Phase 117-02]: SOFT-DELETE-01: softDeleteBySource(source, keepIds) sets deleted_at on stale nodes; empty keepIds soft-deletes all source nodes
- [Phase 117-02]: SETTINGS-KEY-01: Sync state JSON-serialized under 'apple_notes_sync_state' key in settings table via createSettingsService(db)
- [Phase 117-03]: ORPHAN-WARNING-01: Orphan edges are warnings (not errors) in validateSource — valid:true stays so UI can surface warnings separately
- [Phase 117-03]: TIMESTAMP-TOLERANCE-01: 1000ms default tolerance for Core Data timestamp round-trip (Core Data stores seconds, not milliseconds)
- [Phase 117-03]: TAG-ORDER-01: Order-independent tag comparison via JSON.stringify(sorted) — Apple Notes doesn't guarantee hashtag order
- [Phase 117-03]: EMPTY-FOLDER-01: null folder maps to '' via ?? '' in validateFolderPath — unfiled notes have null folder in nodes table
- [Phase 117]: MOCK-ADAPTER-01: createMockAdapter() implements full SourceAdapter interface returning empty data — enables UI wiring without Tauri IPC
- [Phase 117]: TOOLBAR-MOCK-01: vi.mock('../hooks/useAppleNotesSync') in Toolbar tests keeps tests independent of SQLiteProvider
- [Phase 117]: DEPRECATE-01: alto-importer.ts, alto-parser.ts, useAltoIndexImport.ts marked deprecated with console.warn (not deleted — still used by IntegratedLayout)
- [Phase 116]: PANE-LAYOUT-01: PaneLayoutProvider wraps all three screen-size variants (mobile/tablet/desktop) — desktop passes panelPercentages from onLayoutChanged
- [Phase 116]: PANE-LAYOUT-02: panelPercentages state initialized from localStorage on mount via useEffect to match stored layout
- [Phase 116-03]: CSS-VERIFY-01: PreviewComponent already uses Tailwind utilities; NeXTSTEP theme colors as Tailwind arbitrary values is the established pattern — no changes needed
- [Phase 116-03]: MOCK-ADAPT-01: Integration tests use renderHook directly on hooks — no component-level provider mocks needed (consistent with usePreviewSettings.test.ts pattern)

### Pending Todos

**Phase 110:** View Continuum Foundation (Track A Wave 1) ✅ COMPLETE
- [x] Plan 110-01: Gallery view with CSS Grid masonry + TanStack Virtual
- [x] Plan 110-02: List view with hierarchical tree + keyboard navigation

**Phase 111:** View Continuum Integration (Track A Wave 2) ✅ COMPLETE
- [x] Plan 111-01: KanbanView with react-dnd drag-drop and SQL UPDATE persistence
- [x] Plan 111-02: ViewDispatcher + Cmd+1-5 keyboard shortcuts (8 tests)
- [x] Plan 111-03: PAFV Axis Allocation + Selection Sync (18 tests)

**Phase 112:** Technical Debt (runs parallel with 110-111) ✅ COMPLETE
- [x] Plan 112-01: Knip audit and unused export removal (275 -> 91 unused exports)
- [x] Plan 112-02: src/services directory reorganization (3 files moved to query/)
- [x] Plan 112-03: TipTap test infrastructure (93 tests across 7 extensions)

**Phase 113:** Network Graph Integration (Track C) ✅ COMPLETE
- [x] Plan 113-01: Force Simulation Lifecycle Management (18 tests)
- [x] Plan 113-02: NetworkGraph with SQL query hooks (18 tests)
- [x] Plan 113-03 / 114-02: Preview tab integration (16 tests) — COMPLETE

**Phase 114:** Timeline Preview Integration (Track C) ✅ COMPLETE
- [x] Plan 114-01: Timeline with LATCH filter integration
- [x] Plan 114-02: Preview Tab Integration (tab persistence, usePreviewSettings, PAFV info, zoom)
- [x] Plan 114-03: Gap Closure (collision handling, hook adoption, zoom restore) — 3 tasks, 69 tests

**Phase 117:** Apple Notes SQLite Sync — COMPLETE
- [x] Plan 117-01: ETL Module Integration (AppleNotesAdapter, type-mapping, content extraction)
- [x] Plan 117-02: NodeWriter + AppleNotesSyncService (28 tests)
- [x] Plan 117-03: Folder Hierarchy Validation + DataIntegrityValidator (46 tests)
- [x] Plan 117-04: UI + Migration (useAppleNotesSync, SyncProgressModal, Toolbar sync trigger, alto-index deprecation)

**Phase 115:** Three-Canvas Notebook (Track D) — IN PROGRESS
- [x] Plan 115-01: Resizable Panels (react-resizable-panels) — COMPLETE (2 tasks, 8 tests)
- [x] Plan 115-02: Selection Sync Verification — COMPLETE (2 tasks, 7 tests, 5 min)
- [x] Plan 115-03: Cross-Canvas Messaging — COMPLETE (3 tasks, 2 tests, 7 min)
- [ ] Plan 115-04: Integration Testing & Polish

**Phase 116:** State & Polish (Track D Wave 2) — COMPLETE
- [x] Plan 116-01: Scroll Position Persistence — COMPLETE (3 tasks, 9 tests, 4 min)
- [x] Plan 116-02: PaneLayoutContext Integration — COMPLETE (3 tasks, 8 tests, 4 min)
- [x] Plan 116-03: Polish & Integration Testing — COMPLETE (1 task, 9 tests, 6 min)

### Blockers/Concerns

**Technical Debt (Track B — addressed):**
- knip unused exports: 91 remaining (down from 275, reduced by 67%)
- Directory health: src/services (8/15 files - within limit after refactoring)
- TipTap automated tests: ✅ 93 tests across 7 extensions (infrastructure complete)

**New Blocker (discovered 114-02):**
- 36 pre-existing TS errors in ChartsView.tsx, TreeView.tsx, connection-manager.ts, renderers/index.ts
- These block the `check:quick` pre-commit hook
- Should be addressed in a dedicated Cleanup GSD cycle before Track D begins
- Logged to `.planning/phases/114-timeline-preview-integration/deferred-items.md`

**Track C context:**
- ✅ Track C COMPLETE: Network Graph + Timeline + Preview Tab Integration
- ✅ usePreviewSettings hook available for future Preview enhancements
- ✅ PAFVContext info display in address bar (X/Y facets for SuperGrid, facet for Timeline)

## Session Continuity

Last session: 2026-02-17
Completed: Phase 116-03 — Polish & Integration Testing — 1 task, 1 file, ~6 min
Next: Plan 115-04 — Three-Canvas Notebook Integration Testing & Polish
Resume file: N/A

**Stopped at:** Completed 116-03-PLAN.md (Polish & Integration Testing) — Phase 116 COMPLETE

---
*Updated: 2026-02-17 (Phase 116 COMPLETE — all 3 plans done. 26 total tests, state preservation + resize coordination + integration tests. 115-04 next.)*
