# Research Summary: Polymorphic Views & Foundation (v6.9)

**Synthesized:** 2026-02-16
**Research Scope:** Stack additions, feature landscape, architecture patterns, critical pitfalls
**Overall Confidence:** HIGH

---

## Executive Summary

Isometry v6.9 adds a polymorphic view continuum (Gallery → List → Kanban → Grid → SuperGrid) plus specialized views (Network, Timeline) within a unified three-canvas notebook layout. The architecture is proven: PAFV axis controller drives seven view renderers that all query the same sql.js database, eliminating data sync problems. Implementation is straightforward because:

1. **Core infrastructure exists:** SuperGrid (v6.6), PAFV controller, sql.js, D3 renderers already in codebase
2. **Stack is minimal:** Only 1 new package needed (react-resizable-panels for pane layout); all views use existing React + D3 + CSS Grid ecosystem
3. **Pattern is consistent:** All views follow "query once, render multiple ways" via useSQLiteQuery hook + renderer dispatch
4. **Risks are known:** Force simulation lifecycle leaks, selection state loss, PAFV axis misalignment — all documented with prevention strategies

**The differentiator is execution, not novelty.** A user can seamlessly switch from Grid (2-axis tabular) to Kanban (1-facet columns) to Timeline (temporal) on the same data without losing context. This is unique among competitors (Notion/Obsidian/Airtable offer one view type; Isometry offers all).

---

## Key Findings

### From STACK.md: Minimal Ecosystem Additions

**New Packages Required:**
- **react-resizable-panels** (^4.0.7) — industry standard for multi-pane layouts, battle-tested in shadcn/ui, Linear, VS Code
- **No new render libraries** — use CSS Grid (native) + D3 (existing) + TanStack Virtual (existing)

**Performance Optimization Strategy (Deferred Phase 2+):**
- Web Worker wrapper for D3 force simulations (threshold: graphs >5000 nodes)
- Canvas-based rendering (pixijs, babylon.js) only for 10K+ nodes
- Barnes-Hut approximation via d3-force-reuse for large networks

**Integration Points:**
- Three-Canvas layout: ResizablePanelGroup wraps Capture/Shell/Preview panes
- Gallery/List/Kanban: React components with CSS Grid, fed by useSQLiteQuery hook
- Network/Timeline: Existing D3 renderers, wired to sql.js via ViewDispatcher pattern
- All views: Single useSQLiteQuery hook + SelectionContext ensures data consistency

### From FEATURES.md: Well-Defined MVP Scope

**Table Stakes (MVP — v1 Launch):**
- Three-pane layout with resizable dividers ✓ Required
- Block-based editor in Capture (TipTap with slash commands) — Essential
- Properties panel mapping to LATCH metadata — Essential
- Autosave to IndexedDB with conflict detection — Essential
- Bidirectional links `[[page]]` creating LPG edges — Essential
- xterm.js terminal in Shell pane — Essential
- Notebook cards in PAFV grid — Essential (the differentiator)
- Cross-pane selection sync (click card in Grid → highlight in Capture) — Essential

**Differentiators (Competitive Advantage):**
- View continuum (Gallery → SuperGrid, all on same data) — **Unique vs Notion/Obsidian**
- Network viz with LATCH filtering (not just property-based) — **Unique**
- Notebook cards ARE database rows (not separate entity) — **Unique**
- Cross-view selection sync (select in Network → highlight in Timeline) — **Unique**

**Anti-Features (Explicitly Avoid):**
- Real-time collab editing (Notion/Google Docs model) → Use local-first + CloudKit sync
- Freeform canvas layout (Muse model) → Use PAFV grid (spatial = dimensional meaning)
- Embedded D3 in editor → Keep D3 in Preview pane (decoupled)
- Full terminal emulator → xterm.js + shell integration is enough

**Feature Complexity Tiers:**
- **Tier 1 (<2 days):** Gallery masonry, List expand/collapse, Hover tooltips, Mode switcher
- **Tier 2 (2-5 days):** Kanban drag-drop, Keyboard nav, Network force, Timeline zoom, Cross-view sync
- **Tier 3 (>5 days):** Virtual scrolling at scale, Network subgraph filtering, Timeline drag-to-reschedule, Canvas fallback

### From ARCHITECTURE.md: Proven Integration Pattern

**Core Pattern: Provider Composition + Renderer Dispatch**

```
AppStateContext (activeView: 'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid' | 'network' | 'timeline')
  ↓ (view mode)
GridContinuumController.allocateAxes(mode) → AxisAllocation
  ↓ (axis config)
ViewQueryBuilder.buildQuery(allocation, filters) → SQL
  ↓ (SQL)
useSQLiteQuery(db, sql) → data[]
  ↓ (data)
ViewDispatcher → mounts correct renderer
  ↓
React/D3 renders
```

**Why This Works:**
1. Single data source (sql.js) eliminates sync problems
2. All views receive pre-grouped/filtered data via useSQLiteQuery
3. PAFV axis allocation is view-agnostic (works for any view mode)
4. SelectionContext syncs selections across all views (select in SuperGrid → highlight in Network)
5. ViewDispatcher (mount/unmount) cleans up state on transitions

**React vs D3 Split:**
- **React components:** Gallery (CSS Masonry), List (tree), Kanban (columns) — component-based rendering
- **D3 SVG:** Network (force simulation), Timeline (time scale) — require physics/math
- **Hybrid:** SuperGrid (React + CSS Grid for layout, D3 for header spanning)

**New Components to Build:**
| Component | Location | Responsibility |
|-----------|----------|-----------------|
| GalleryView | src/components/views/GalleryView.tsx | Masonry layout + virtual scroll |
| ListView | src/components/views/ListView.tsx | Tree with expand/collapse |
| KanbanView | src/components/views/KanbanView.tsx | Columns + dnd-kit drag-drop |
| NetworkView | src/components/views/NetworkView.tsx | D3 force + selection sync |
| TimelineView | src/components/views/TimelineView.tsx | D3 time scale + events |
| ViewDispatcher | src/components/views/ViewDispatcher.tsx | Routes to correct view |

**Critical Existing Components (Already in Code):**
- SuperGrid.tsx (v6.6) — n-axis nested headers with CSS Grid ✓
- FilterContext — LATCH filter → SQL compilation ✓
- SelectionContext — cross-view selection sync ✓
- PAFVContext — axis allocation tracking ✓
- useSQLiteQuery hook — query execution + caching ✓

### From PITFALLS.md: Five Critical Risks to Prevent

**Pitfall 1: Force Simulation Lifecycle Leaks (D3 Network/Timeline)** — **CRITICAL**
- **What goes wrong:** D3 force simulations run indefinitely, stacking up as views switch. Memory grows, CPU stays 30-50% utilization.
- **Prevention:** Create ForceSimulationManager wrapper with explicit `sim.stop()` on cleanup. Use custom `useForceSimulation` hook with cleanup function.
- **Detection:** DevTools Memory: detached DOM nodes count stays high after view switch.
- **When to address:** Before wiring Network/Timeline views.

**Pitfall 2: Selection/Scroll State Lost During View Transitions** — **CRITICAL**
- **What goes wrong:** User selects card, switches views, switches back — selection gone, scroll reset to top.
- **Prevention:** Implement ViewStateManager to persist scroll position + selected nodes per view. Use sessionStorage with serialization.
- **Detection:** Manual test: select card, switch view, switch back, verify selection preserved.
- **When to address:** Part of mode switching requirements (phase integration).

**Pitfall 3: PAFV Axis Mapping Not Aligned Across View Modes** — **CRITICAL**
- **What goes wrong:** GridContinuumController says "group by Status," but SQL uses wrong column, CSS uses wrong count.
- **Prevention:** Make GridContinuumController.getProjectionFor(mode) the single source of truth. All renderers read from it, not raw PAFV context.
- **Detection:** Compare controller projection output with actual rendered layout.
- **When to address:** Validate CSS precedence and SQL alignment early.

**Pitfall 4: Three-Canvas Resize Events Desynchronize State** — **MODERATE**
- **What goes wrong:** Drag resize handle → ResizeObserver fires → SuperGrid reflows → Capture re-wraps → panes show incorrect content.
- **Prevention:** Create shared PaneLayoutContext to coordinate dimensions. Single ResizeObserver at container level, debounce resize events.
- **Detection:** Drag separator repeatedly, watch for smooth updates.
- **When to address:** Critical for usability; test early.

**Pitfall 5: CSS Primitives Specificity Wars During View Switching** — **MODERATE**
- **What goes wrong:** Both old and new view CSS apply during transition. If specificity ties break by source order, Kanban gets SuperGrid widths.
- **Prevention:** Use CSS custom properties to toggle view layout. Ensure only one `.{view}-container` class active at a time.
- **Detection:** DevTools Inspect during transition, check Computed tab for conflicting rules.
- **When to address:** Validate CSS precedence early.

**Additional Moderate Pitfalls:**
- Pitfall 6: SQL query mismatch (GROUP BY columns don't match rendered columns) — Validate result against projection
- Pitfall 7: Unused exports cleanup removes active exports indirectly — Audit before knip fix
- Pitfall 8: Directory refactoring breaks import paths — Use path aliases, validate imports in CI
- Pitfall 9: D3 data joins don't update when data changes — Always use update selection in .join()
- Pitfall 10: ResizeObserver feedback loop in TipTap — Debounce and batch

---

## Implications for Roadmap

### Recommended Phase Structure

**Phase Structure (4 Parallel Tracks):**

#### Track A: View Continuum Integration (MVP — 2-3 weeks)
**Rationale:** Foundation for everything else; enables data validation early

1. **Week 1: Gallery + List Views**
   - Build GalleryView (CSS Masonry + TanStack Virtual)
   - Build ListView (React tree + expand/collapse + keyboard nav)
   - Wire GridContinuumController to both modes
   - Test: Switch Gallery → List → Gallery, verify scroll/selection preserved
   - **Features:** Tier 1 (masonry, expand) + Tier 2 (virtual scroll, keyboard nav)
   - **Pitfalls to avoid:** 2, 5 (state loss, CSS specificity)

2. **Week 2: Kanban View + Mode Switcher**
   - Build KanbanView (CSS columns + dnd-kit drag-drop)
   - Add SQL UPDATE persistence on drop
   - Build ViewDispatcher component (routes to correct view)
   - Build GridContinuumSwitcher UI (buttons)
   - Test: Drag card between Kanban columns, verify SQL updated
   - **Features:** Tier 2 (drag-drop, persistence)
   - **Pitfalls to avoid:** 3, 6 (PAFV alignment, SQL mismatch)

**Deliverables:** Gallery, List, Kanban modes selectable in UI; data persists; selection synced
**Research Flags:** None (well-documented patterns)
**Standard Patterns:** React components, CSS Grid, dnd-kit are industry-standard

---

#### Track B: Unused Exports & Technical Debt (Parallel — 1-2 weeks)
**Rationale:** Clean codebase reduces coupling, prevents hidden breakages during refinement

1. **Week 1: Knip Cleanup with Safeguards**
   - Audit each unused export before deletion (check internal usage)
   - Add characterization tests for utility modules
   - Create barrel exports for public API clarity
   - Test: Full suite must pass before and after each knip fix
   - **Pitfalls to avoid:** 7 (false positives), 8 (import breaks)

2. **Week 2: Directory Health Refactoring (if needed)**
   - Check `src/services/` file count (currently 22 files?); reorganize if >20
   - Use TypeScript path aliases to decouple structure from imports
   - Validate imports: `tsc --noEmit` + custom import test
   - **Pitfalls to avoid:** 8 (import path breaks)

**Deliverables:** ESLint error count = 0, no unused exports, clear module boundaries
**Research Flags:** None (standard cleanup)
**Standard Patterns:** Barrel exports, path aliases

---

#### Track C: Network/Timeline Polish (Conditional — 2-3 weeks)
**Rationale:** Adds breadth after MVP foundation is solid. Can defer if Track A eats time.

1. **Week 2-3 (parallel with Track A Week 2): Network Graph Wiring**
   - Refactor ForceGraphRenderer to use useSQLiteQuery
   - Add force simulation lifecycle management (prevent Pitfall 1)
   - Create NetworkView component with force simulation setup
   - Add LATCH filter integration (show subgraph by facets)
   - Test: 500+ node network, verify 60 FPS zoom/pan, memory stable on 10 mode switches
   - **Features:** Tier 2 (force setup) + Tier 3 (scale + culling deferred)
   - **Pitfalls to avoid:** 1 (lifecycle leaks), 6 (SQL mismatch)

2. **Week 3 (parallel): Timeline View Polish**
   - Refactor TimelineRenderer to use useSQLiteQuery
   - Add zoom levels with adaptive tick labels (D3 time intervals)
   - Add overlapping event layout (swimlanes)
   - Test: 1000+ events, verify smooth zoom/pan
   - **Features:** Tier 2 (zoom, overlapping) + Tier 3 (scale deferred)
   - **Pitfalls to avoid:** 1 (lifecycle leaks)

**Deliverables:** Network and Timeline views selectable; LATCH filters work; performance baseline met
**Research Flags:** "Phase 2" — Network performance at 2000+ nodes needs canvas fallback (canvas rendering, spatial indexing)
**Standard Patterns:** D3 force, D3 time scale, virtual rendering

---

#### Track D: Three-Canvas Notebook Integration (Final — 1-2 weeks)
**Rationale:** Brings all pieces together; orchestrates cross-pane selection sync

1. **Week 3-4: Layout & Cross-Pane Sync**
   - Implement ThreeCanvasLayout with react-resizable-panels
   - Wire SelectionContext across Capture/Shell/Preview panes
   - Add cross-pane highlight overlay (select in Preview Grid → highlight in Capture)
   - Test: Click card in SuperGrid, verify Capture block highlighted; reverse
   - **Features:** Three-pane layout, focus mode toggle, persist sizes
   - **Pitfalls to avoid:** 4 (resize desync), 10 (ResizeObserver loop)

2. **Week 4: State Preservation & Polish**
   - Implement ViewStateManager (save/restore scroll, zoom, selection per view)
   - Add keyboard shortcuts (Cmd+1/2/3 for pane focus)
   - Test: Switch modes 5x, verify selection preserved
   - **Pitfalls to avoid:** 2 (state loss)

**Deliverables:** Three-canvas layout fully functional; cross-pane selection sync; state persists
**Research Flags:** "Phase 2+" — Multi-monitor support (window API + Tauri integration)
**Standard Patterns:** React Context, localStorage/sessionStorage, keyboard handlers

---

### Phase Sequencing Rationale

**Why This Order:**

1. **Track A first:** View Continuum is the MVP differentiator. Without it, product is "just another grid." Also unblocks testing other tracks.

2. **Track B parallel:** Knip cleanup doesn't block other tracks; can proceed independently. Early cleanup prevents hidden breakages during refinement.

3. **Track C conditional:** Network/Timeline add breadth. If Track A + D take full time, defer Network/Timeline to Phase 2. They're valuable but not MVP.

4. **Track D last:** Depends on all other views being wire-able in Three-Canvas. Can't test cross-pane sync without views working.

**Parallel Execution:**
- Tracks A, B can run simultaneously (independent concerns)
- Track C runs parallel to Track A Week 2 (both are view implementations)
- Track D runs parallel to Track C Week 3 (can integrate partially)

**Risk Mitigation:**
- **Pitfall 1 (force leaks):** Addressed in Track C, not blocker for A
- **Pitfall 2 (state loss):** Addressed in Track D; test early with ViewStateManager
- **Pitfall 3 (PAFV misalignment):** Test in Track A Week 1; fix before Kanban
- **Pitfall 4 (resize desync):** Test in Track D; use PaneLayoutContext early

---

## Build Order Dependencies

```
┌─ Track A: View Continuum MVP (weeks 1-2)
│  ├─ Week 1: Gallery + List (foundation)
│  │  └─ GATE: SelectionContext working + useSQLiteQuery returning data
│  └─ Week 2: Kanban + ViewDispatcher (completes continuum)
│     └─ GATE: Mode switching UI functional
│
├─ Track B: Technical Debt (weeks 1-2, parallel)
│  └─ Knip cleanup + Directory refactoring
│     └─ No blocking dependencies
│
├─ Track C: Network/Timeline (weeks 2-3, conditional)
│  ├─ Network: ForceSimulationManager + NetworkView
│  │  └─ GATE: Track A complete (View Continuum working)
│  └─ Timeline: TimelineRenderer + useSQLiteQuery wiring
│     └─ GATE: Track A complete
│
└─ Track D: Three-Canvas (weeks 3-4, final)
   ├─ ResizablePanels layout
   │  └─ GATE: Track A complete
   ├─ SelectionContext cross-pane sync
   │  └─ GATE: Track A + C partially complete (at least 2 views)
   └─ ViewStateManager + state preservation
      └─ GATE: All views integrated
```

---

## Research Flags

### Which Phases Need Deeper Research

**Phase Track C (Network/Timeline) — Performance at Scale**
- Needs live profiling: Force simulation convergence with 1000+ nodes
- Needs Canvas rendering decision: At what node count does SVG performance degrade?
- Needs viewport-bound simulation: Only simulate visible nodes + margin
- **Action:** Before Track C implementation, profile existing ForceGraphRenderer with 1000+ nodes, capture baseline

**Phase Track D (Three-Canvas) — ResizeObserver Behavior**
- Needs live testing: Does TipTap dynamic height trigger ResizeObserver loop?
- Needs debounce validation: Is 500ms debounce sufficient for smooth resize?
- **Action:** Before Track D implementation, test TipTap height changes in isolation, profile ResizeObserver callback count

**Phase 2 (Canvas Rendering Fallback)**
- Decision needed: Canvas rendering for 10K+ nodes or accept <30 FPS at that scale?
- Decision needed: pixijs vs babylon.js for 2D canvas rendering
- **Action:** Benchmark current SVG approach at 5000/10000 nodes, decide go/no-go on canvas

### Which Phases Have Well-Documented Patterns

**Track A (View Continuum)** — HIGH Confidence
- Gallery masonry: CSS Grid `auto-fit` is standard (MDN, all browsers)
- List tree: React tree with ARIA role is standard (shadcn/ui pattern, W3C spec)
- Kanban drag-drop: dnd-kit is current standard (Linear, Vercel use it)
- All feed useSQLiteQuery: Pattern already proven in SuperGrid

**Track B (Technical Debt)** — HIGH Confidence
- Knip cleanup: Well-documented tool, false positives rare
- Directory refactoring: TypeScript path aliases are standard

**Track C (Network/Timeline)** — MEDIUM-HIGH Confidence
- D3 force simulation: Battle-tested pattern (Observable, many D3 projects)
- D3 time scale: Standard for temporal viz (FullCalendar, Airtable)
- Performance optimization (Canvas): Standard but requires profiling for this codebase

**Track D (Three-Canvas)** — HIGH Confidence
- react-resizable-panels: Industry standard (shadcn/ui official, used in Linear)
- SelectionContext sync: Standard React Context pattern
- State preservation: localStorage/sessionStorage pattern is proven

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **Stack (new packages)** | HIGH | react-resizable-panels verified with current versions (v4.0.7, Feb 2026). 0 new render libs needed. |
| **Features (MVP scope)** | HIGH | Verified against official docs (TanStack Virtual, dnd-kit, D3.js), Figma/Airtable/Obsidian implementations. Table stakes align with 2026 standards. |
| **Architecture (PAFV pattern)** | HIGH | GridContinuumController + useSQLiteQuery hook pattern already proven in SuperGrid (v6.6). ViewDispatcher follows standard React composition. |
| **Pitfalls (prevention)** | MEDIUM-HIGH | Force lifecycle leaks, selection state loss, PAFV misalignment all documented in codebase (6 force sim instances, 2 type systems exist). Prevention strategies are standard (lifecycle management, context sync, single source of truth). |
| **Performance (targets)** | MEDIUM | Gallery/List/Kanban targets (60 FPS at 500+ items) are achievable with TanStack Virtual + CSS Grid (proven tech). Network/Timeline performance (60 FPS at 1000+ events) assumes D3 optimization; needs profiling to confirm. |
| **Three-Canvas (pane coordination)** | MEDIUM | ResizablePanels library is proven, SelectionContext pattern is standard. ResizeObserver behavior with TipTap dynamic height not yet tested live; needs validation. |

### Gaps to Address During Implementation

1. **ResizeObserver behavior with TipTap:** Profile actual resize event frequency during typing. May need debounce tuning.
2. **Force simulation convergence:** Time-to-stability with 1000+ nodes. May need custom forces or Barnes-Hut optimization.
3. **Virtual scrolling memory:** TanStack Virtual + D3 data binding — verify memory stays <100MB at 5000 items.
4. **CSS specificity conflicts:** Verify CSS loading order doesn't cause specificity ties during view transitions.
5. **SQL query performance:** GROUP BY on 10K+ nodes — verify query execution <100ms.

---

## Roadmap Implications

### Suggested Phase Schedule

**Phase 6.9: Polymorphic Views (Current) — 4 weeks**
- Track A (weeks 1-2): View Continuum MVP (Gallery, List, Kanban)
- Track B (weeks 1-2, parallel): Technical debt cleanup
- Track C (weeks 2-3, conditional): Network/Timeline polish
- Track D (weeks 3-4): Three-Canvas integration

**Phase 7.0: Performance & Scale (Next) — 2-3 weeks**
- Canvas rendering fallback for 10K+ node networks
- Virtual rendering for 5000+ event timelines
- Web Worker optimization for force simulations
- Performance baseline tests and profiling

**Phase 7.1+: Advanced Features (Future)**
- Real-time collaboration (Yjs + Replicache, if needed)
- Cloud sync (CloudKit, if needed)
- Multi-user conflict resolution UI
- D3 visualization blocks in Capture editor
- GSD GUI wrapper (parse Claude Code output)

---

## Sources

**Stack Research:**
- STACK.md — Ecosystem additions, performance targets, alternatives considered

**Feature Research:**
- FEATURES.md — Table stakes, differentiators, anti-features, MVP scope
- GRID-CONTINUUM-FEATURES.md — Feature landscape by view mode, complexity tiers

**Architecture Research:**
- ARCHITECTURE.md — PAFV pattern, view renderers, data flow, component boundaries
- GRID-CONTINUUM-ARCHITECTURE.md — System overview, query patterns, scaling considerations

**Pitfalls Research:**
- PITFALLS.md — Critical/moderate/minor pitfalls with prevention strategies, phase warnings
- GRID-CONTINUUM-PITFALLS.md — Domain-specific pitfalls for polymorphic views

---

## Next Steps

1. **Validate ViewStateManager design** — Sketch out scroll/selection/zoom persistence before Track D
2. **Profile ForceGraphRenderer** — Measure force convergence time with 1000+ nodes before Track C commitment
3. **Test ResizeObserver with TipTap** — Verify no feedback loops before Track D implementation
4. **Finalize API contracts** between GridContinuumController and each view renderer
5. **Begin Track A implementation** — Gallery view is simplest, unblocks everything else

---

*Research synthesized 2026-02-16
Architecture Pattern: PAFV Controller → Query Builder → sql.js → View Renderer
Status: Ready for roadmap planning and phase requirements definition*
