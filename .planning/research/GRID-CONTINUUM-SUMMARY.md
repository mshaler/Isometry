# Research Summary: Grid Continuum & Polymorphic Views

**Project:** Isometry v6.9 — Polymorphic Views & Foundation
**Domain:** Multi-view data projection system (Gallery/List/Kanban/Grid/SuperGrid/Network/Timeline/Three-Canvas)
**Researched:** 2026-02-16
**Overall Confidence:** HIGH

---

## Executive Summary

The Grid Continuum is Isometry's core differentiator: a continuous spectrum of view modes where the same underlying data (nodes + edges in sql.js) renders through different PAFV axis allocations. Gallery (0 axes) → List (1 axis) → Kanban (1 facet) → Grid (2 axes) → SuperGrid (n axes), plus specialized views for temporal (Timeline) and topological (Network) data.

**Key Research Findings:**

1. **PAFV Axis Allocation is Architectural Hub** — A single GridContinuumController determines how LATCH dimensions map to visual planes (x, y, color, size, shape). Each view mode has specific axis requirements (Grid needs 2, Kanban needs 1 facet, Network needs topology). This decoupling is critical for scaling to new views.

2. **Table Stakes Features Are Well-Defined** — Gallery masonry, List expand/collapse, Kanban drag-drop, Grid sticky headers, Network force simulation, Timeline zoom — all are standard patterns in 2026 web applications. No novel features required; implementation challenge is integration, not invention.

3. **Live SQL Query is Non-Negotiable** — All views must query live sql.js database, never local caches. Desynchronized views (Gallery shows 150 cards, Timeline shows 75) destroy user trust. Single `useSQLiteQuery` hook prevents this by design; maintain strictly.

4. **Virtual Scrolling Must Be Tier 1** — Gallery and List without virtual scrolling hit performance cliff at 1000+ items (10 FPS, unusable). TanStack Virtual is already used in SuperGrid; apply to all table-like views from day one.

5. **D3 Needs Clear Isolation in React** — Network and Timeline use D3 for force simulation and time scales. D3 is imperative, React is declarative; they fight over DOM if boundaries aren't clear. Pattern: D3 owns SVG container via ref, React owns chrome UI, Context syncs state (selection, filters).

6. **Cross-View Selection Sync is Differentiator** — Ability to select card in SuperGrid and see it highlighted in Timeline/Network/Kanban validates multi-view design. Built via SelectionContext + D3 data binding; critical for making multi-view system feel cohesive, not like separate apps.

7. **Four Critical Pitfalls Can Cause Rewrites** — Data desync, view state loss, drag-drop without persistence, PAFV axis confusion. These are architectural; catching them late requires significant refactoring. Prevention: design-first (queries centralized, state unified), test-at-scale early.

---

## Key Findings by Domain

### Features

**Table Stakes (MVP):**
- Gallery: CSS Masonry + virtual scrolling, hover preview, click to select
- List: Expand/collapse tree, keyboard nav (ARIA), FTS5 search filter
- Kanban: dnd-kit drag-drop, column headers by facet, persistence on drop
- Grid: CSS Grid sticky headers, 2-axis grouping, multi-card cells
- SuperGrid: Already built (v6.6), nested n-axis headers with spanning
- Network: D3 force-directed, node/edge rendering, zoom/pan, click to select
- Timeline: D3 time scale with adaptive labels, zoom levels, overlapping event layout
- Three-Canvas: Resizable panes (Capture/Shell/Preview), focus mode, pane minimize

**Differentiators:**
- View Continuum: Instant switching between 5+ modes, same data
- LATCH-driven Network filtering: Show subgraph by LATCH dimensions, not just properties
- SuperStack with automatic facet discovery: Nested headers generated from SQL, not manual configuration
- Cross-view selection sync: Select in Grid, highlight in Network, Timeline, Kanban
- Cartographic density model: Pan (extent) and Zoom (value) orthogonal controls

**Anti-Features (Don't Build):**
- Embedded D3 charts in Capture editor (breaks serialization)
- Freeform drag canvas layout (conflicts with LATCH semantics)
- Real-time collaborative drag-drop (CRDT complexity, local-first conflict)
- Full terminal emulator (xterm.js basics sufficient)

### Architecture

**Pattern:** PAFV Controller → Query Builder → sql.js → View Renderer → DOM

**Key Components:**
1. **GridContinuumController** — Central dispatcher, allocates LATCH axes to visual planes per mode
2. **ViewQueryBuilder** — Generates SQL (SELECT/WHERE/GROUP BY/ORDER BY) per view mode + filters
3. **useSQLiteQuery** — React hook wrapping `db.exec()`, triggers re-render on data change
4. **View Renderers** (7 pluggable) — Each implements `ViewRenderer` interface, owns rendering logic
5. **SelectionContext** — Unified selection state, wires all views
6. **ViewStateStore** — localStorage for scroll/zoom/pane sizes per mode

**Data Flow:**
- User clicks mode button → GridContinuumController.allocateAxes(mode)
- Returns AxisAllocation (which axes/facets for this mode)
- ViewQueryBuilder generates SQL with allocation
- useSQLiteQuery executes on sql.js
- Results → appropriate renderer
- Renderer saves view state (scroll/zoom), renders, loads saved state

**Critical Isolation:**
- D3 owns one SVG subtree via React ref, renders in useEffect, not component body
- React owns UI chrome (buttons, panels, chrome)
- Selection state via Context drives both — changes propagate bidirectionally
- No duplicate state: single source of truth for selection/filters/scroll

### Pitfalls

**4 Critical (Rewrite Risk):**
1. **Data Desynchronization** — Views query different subsets; user edits in one, another is stale. Prevention: all views query live sql.js, no caches.
2. **View State Lost on Switch** — Scroll position resets when switching modes. Prevention: ViewStateStore saves/restores state per mode.
3. **Drag-Drop Without Persistence** — Card moves visually but not saved; refresh reverts. Prevention: await `db.run()` in onDragEnd, show error if fails.
4. **PAFV Axis Confusion** — Controller doesn't reset axis allocation on mode change; renders wrong grouping. Prevention: Renderer asserts axis requirements on mount.

**4 Major (Architectural Debt):**
5. **View-Specific SQL** — Each view hardcodes queries; changing filters requires N edits. Prevention: ViewQueryBuilder centralizes all SQL generation.
6. **Selection State Split** — Selection in Grid doesn't update Timeline; each view has local state. Prevention: SelectionContext is single source of truth.
7. **Performance Cliff** — Gallery works at 100 items, unusable at 1000. Prevention: TanStack Virtual from day one.
8. **D3+React Chaos** — D3 and React both modifying same DOM; selection doesn't work. Prevention: Clear boundary (D3 owns SVG, React owns chrome).

**4 Minor (UX Polish):**
9. Scroll position lost on filter change
10. No touch support for drag-drop
11. No loading state during slow queries
12. Animation timing (too fast/slow)

### Complexity Tiers

**Tier 1 (< 2 days per feature):**
- Gallery CSS Masonry, List expand/collapse, hover tooltips, click selection, Timeline tick adaptation, focus mode keyboard shortcuts

**Tier 2 (2-5 days per feature):**
- Kanban drag-drop, List keyboard navigation, Network force-directed, Timeline zoom + labels, event stacking, search/filter, cross-view selection, sticky headers

**Tier 3 (> 5 days per feature):**
- Gallery virtual scrolling, Network subgraph filtering, Timeline drag-reschedule, large-scale rendering (Canvas fallback), Cartographic density model, SuperStack header discovery

---

## Implications for Roadmap

### Recommended Phase Structure

**v6.9 Milestone: Four Tracks, Two Sequential Phases**

```
PHASE 1 (2-3 weeks): Gallery + List + Kanban + Mode Switcher
├─ Track A (View Continuum): Gallery, List, Kanban, CSS primitives wiring
├─ Track B (Tech Debt): knip cleanup, directory health, TipTap tests
└─ Parallelizable: A and B run together

PHASE 2 (2-3 weeks): Network + Timeline + Three-Canvas Integration
├─ Track C (Specialized Views): Network force simulation, Timeline, zoom/pan
├─ Track D (Three-Canvas): Resizable layout, cross-pane selection sync
└─ Sequence: C before D (views needed before integration)
```

### Phase Ordering Rationale

**Why Gallery/List/Kanban first (Track A):**
- Foundation for Three-Canvas Preview pane
- Reuses existing CSS primitives (v6.8 delivered)
- Tests core PAFV allocation + query builder
- Simpler than D3 views; de-risks architecture

**Why Technical Debt in parallel (Track B):**
- Independent of view implementation
- Unlocks linting metrics (knip cleanup)
- No dependencies between A and B
- Parallelization saves 1 week

**Why Network/Timeline after (Track C):**
- Depends on Gallery/List working (PAFV controller proven)
- D3 renderers need selection context (which List tests)
- Can reuse query builder patterns from Track A

**Why Three-Canvas last (Track D):**
- Depends on working views (C complete)
- Depends on SelectionContext (proven in Track A)
- Integration layer, not new functionality
- Can be fast once components exist

### Success Criteria

**Phase 1 Success:**
- [ ] Gallery mode renders 10K items at 60 FPS scroll
- [ ] List expand/collapse works with keyboard nav
- [ ] Kanban drag-drop persists to SQL, no data loss
- [ ] Mode switcher preserves scroll/zoom/selection on switch
- [ ] All LATCH filters apply to all views
- [ ] Cross-view selection sync works (select in Gallery, highlight in List)
- [ ] TypeScript strict mode: 0 errors
- [ ] Test coverage: >80% for each renderer

**Phase 2 Success (if time permits):**
- [ ] Network force simulation converges in <2 seconds, 60 FPS zoom/pan
- [ ] Timeline shows 1000 events, smooth zoom/pan, adaptive labels
- [ ] Three-Canvas layout resizable, panes persist sizes
- [ ] Selection syncs across all 7 views
- [ ] App performant at 50K nodes (largest realistic dataset)

### Research Flags for Phase-Specific Work

**Phase 1 — Deep Research Needed:**
- Virtual scrolling behavior with different row heights (might need characterization tests)
- Sticky header behavior in CSS Grid + scrolling large grids (test Chromium + Safari)
- dnd-kit touch support on iPad (test early, not in final polish)

**Phase 1 — Standard Patterns, No Deep Research:**
- Gallery masonry (CSS standard)
- List tree rendering (ARIA standard)
- Mode switching (React context standard)
- SQL query building (straightforward per-mode logic)

**Phase 2 — Deep Research Needed:**
- D3 force simulation tuning for large networks (may need parameter exploration)
- Timeline overlapping event layout algorithm (collision detection is non-trivial)
- Canvas rendering fallback for 2000+ nodes (needs benchmarking)

**Phase 2 — Standard Patterns, No Deep Research:**
- Zoom/pan interaction (D3 standard)
- Time scale tick generation (D3 standard)
- Resizable panes (react-resizable-panels mature)
- Selection context sync (proven in Phase 1)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| **Table Stakes Features** | HIGH | Verified with MDN, D3 docs, TanStack Virtual, dnd-kit. All patterns production-tested in Figma, Airtable, Obsidian. |
| **PAFV Axis Controller** | HIGH | Isometry-specific but straightforward logic. Research + v3 validation confirm approach. |
| **SQL Query Patterns** | HIGH | Standard GROUP BY/ORDER BY patterns. FTS5 already working in codebase. |
| **Virtual Scrolling** | HIGH | TanStack Virtual is mature, already used in SuperGrid. No surprises expected. |
| **Drag-Drop with dnd-kit** | HIGH | dnd-kit is current standard, touch support proven, no platform surprises. |
| **D3 Force Network** | MEDIUM-HIGH | Force simulation is well-documented, but tuning parameters requires experimentation. |
| **Timeline with Zoom** | MEDIUM-HIGH | D3 time scales are reliable, but sparse event layout algorithm needs exploration. |
| **Three-Canvas Layout** | HIGH | react-resizable-panels is mature, Context-based selection sync is React-standard. |
| **Cross-View Selection Sync** | MEDIUM-HIGH | Architecture sound, but complexity of syncing 7 views simultaneously not proven. Likely need iteration. |
| **Performance at Scale** | MEDIUM | Theory is solid (virtual scrolling + Canvas fallback), but actual optimization depends on implementation details. |

---

## Gaps to Address in Roadmap

1. **Virtual Scrolling with Variable Row Heights** — Gallery cards may have different heights (due to text length). TanStack Virtual supports this, but needs characterization test. Flag for Phase 1 implementation.

2. **Sticky Headers in Large Grids** — CSS `position: sticky` works differently than D3 clip-path approach. Need to verify performance at 100×100 cells on Safari/Chrome. Test early.

3. **Touch Drag-Drop on iPad** — dnd-kit handles touch, but real-world iPad testing needed. Flag for Phase 1 polish.

4. **Canvas Rendering Threshold** — At what node count should Network switch from SVG to Canvas? Research says 500-2000; need benchmarking. Flag for Phase 2.

5. **Timeline Overlapping Event Algorithm** — How to position overlapping events vertically (event tracks)? D3 doesn't have built-in; may need custom layout algorithm. Flag for Phase 2 deep research.

6. **Three-Canvas with Multiple Monitors** — Should Preview pane be able to span to secondary monitor? Tauri API exists, but complex. Defer to v2.

7. **Undo/Redo for Drag-Drop** — Should users be able to undo Kanban drag-drop? Requires transaction history or debounced save with rollback. Defer to post-launch if users demand.

8. **Real-Time Sync Between Browser Tabs** — If user opens same project in 2 tabs, edit in tab A, does tab B update? Requires IndexedDB change listeners. Defer to v2.

---

## Recommendations for Project Kickoff

1. **Start with GridContinuumController + ViewQueryBuilder** (before any UI work)
   - Define axis allocation per mode in code
   - Unit test SQL generation for each mode
   - This unblocks all view work in parallel

2. **Implement useSQLiteQuery hook before rendering**
   - Test that live query results feed all renderers
   - Verify data sync: edit in one view, all views update
   - This proves single-source-of-truth architecture

3. **Gallery + List first** (not Kanban first)
   - De-risks PAFV controller + query builder
   - Virtual scrolling proves scaling approach
   - Simpler than drag-drop

4. **Kanban third** (after Gallery/List proven)
   - Uses proven PAFV + query builder
   - Adds dnd-kit complexity, but isolated to one view
   - Persistence testing catches drag-drop pitfalls early

5. **SelectionContext early** (before Track A complete)
   - Test cross-Gallery/List selection
   - Proves architecture for Track C (Network/Timeline)

6. **Performance testing at scale concurrent with implementation**
   - Create 10K-item test fixture immediately
   - Measure FPS on Gallery scroll, List expand, Kanban drag
   - Don't defer performance to post-launch

---

## Timeline Estimate

| Phase | Component | Effort | Risk |
|-------|-----------|--------|------|
| **Phase 1, Week 1** | GridContinuumController + ViewQueryBuilder | 3 days | Low |
| **Phase 1, Week 1-2** | Gallery + List renderers | 5 days | Medium (virtual scroll tuning) |
| **Phase 1, Week 2** | Kanban renderer + dnd-kit | 4 days | Medium (drag-drop persistence) |
| **Phase 1, Week 2-3** | Mode switcher + view state store | 3 days | Low |
| **Phase 1, Week 3** | SelectionContext wiring + polish | 3 days | Low |
| **Phase 2, Week 1** | Network renderer + D3 force | 5 days | Medium (D3 isolation, tuning) |
| **Phase 2, Week 2** | Timeline renderer + zoom | 5 days | Medium (event layout algorithm) |
| **Phase 2, Week 3** | Three-Canvas layout + pane resize | 3 days | Low |
| **Phase 2, Week 3-4** | Integration + cross-view sync + polish | 4 days | Low |

**Total: ~4 weeks across 2 phases (with parallel Track A+B)**

---

## High-Risk Areas Requiring Extra Attention

1. **Data Desynchronization** — Can happen silently. Mitigation: Automated testing with 3+ views rendering same filtered data, verify counts match.

2. **D3+React Integration** — Easy to make jittery. Mitigation: Force selection into Context ONLY, don't store in D3 state. Test selection toggle doesn't reset node positions.

3. **Drag-Drop Persistence** — Can lose user data. Mitigation: Test suite for drag-drop: verify `db.run()` called, SQL updated, re-query returns new state.

4. **Performance at Scale** — Hard to debug after ship. Mitigation: Regular performance audits (10K/100K item tests) during both phases. Don't defer to post-launch.

---

## Next Steps (for Roadmap Phase)

1. Create `.planning/phases/` directory structure for v6.9
2. Formalize GridContinuumController + ViewQueryBuilder as Phase 1 Task 1
3. Create test fixtures: 100, 1K, 10K, 100K node datasets
4. Set up performance benchmarking CI (track FPS over time)
5. Assign Track A (Views) and Track B (Debt) to parallel developers
6. Define hand-off from Track A to Track C (shared interfaces)

---

## Sources Used in Research

### Features & UX Patterns
- [MDN: CSS Masonry](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout)
- [ARIA Tree View Patterns](https://www.w3.org/wiki/TreeView)
- [dnd-kit Documentation](https://docs.dnd-kit.com/)
- [D3 Force Module](https://d3js.org/d3-force)
- [FullCalendar Timeline View](https://fullcalendar.io/docs/timeline-view)
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)

### Architecture & Integration
- [Observable: D3 and React](https://observablehq.com/@d3/data-driven-components)
- [Visx: D3 + React Components](https://visx-demo.vercel.app/)
- [TanStack Virtual Documentation](https://tanstack.com/virtual/latest)

### Performance & Scaling
- [Web Performance: Virtualization](https://web.dev/virtualization/)
- [Large Graph Rendering (2026)](https://medium.com/nmc-techblog)

---

## Confidence Summary

**Overall Confidence: HIGH**

All major architectural decisions are informed by:
1. Official documentation (MDN, D3, React, TanStack)
2. Production-tested patterns (Figma, Airtable, Obsidian, VS Code)
3. Existing Isometry codebase validation (SuperGrid v6.6, HeaderDiscoveryService v6.3)
4. Research verified against multiple sources (not single-source reliance)

**Highest Confidence:** Table stakes features (Gallery, List, Kanban basics), SQL query patterns, PAFV controller logic
**Medium-High Confidence:** D3 force simulation, Timeline zoom, large-scale performance (theory sound, implementation needs iteration)
**Medium Confidence:** Timeline overlapping event layout (requires algorithm exploration), Canvas rendering fallback (needs benchmarking)

No "black swan" surprises expected. Highest risk is execution (drag-drop persistence, D3 isolation) not discovery.

---

*Research Complete: Grid Continuum & Polymorphic Views (v6.9)*
*Researched: 2026-02-16*
*Researcher: Claude Code (AI)*
*Downstream Consumer: Roadmap Phase (PHASE definition creation)*
