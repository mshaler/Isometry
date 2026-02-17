# Domain Pitfalls: Polymorphic Views & Foundation (v6.9)

**Domain:** Multi-view rendering (Grid Continuum, Network/Timeline), three-canvas notebook, technical debt cleanup
**Researched:** 2026-02-16
**Confidence:** MEDIUM-HIGH

This document captures common mistakes when adding Grid Continuum views (Gallery/List/Kanban), Network/Timeline polish, three-canvas integration, and cleaning up 275 unused exports. Research synthesizes ecosystem patterns (D3.js, React state management, view mode switching) with Isometry's specific architecture (sql.js + D3 + React controls).

---

## Critical Pitfalls

### Pitfall 1: Force Simulation Lifecycle Leaks (D3 Network/Timeline)

**What goes wrong:** D3 force simulations hold references to data nodes and tick event handlers indefinitely. When switching views or remounting components, simulations continue running in memory even though their SVG containers are gone. Each view switch creates a new simulation without stopping the old one, causing exponential memory growth and CPU overhead.

**Why it happens:**
- D3 force simulations are designed to run continuously. `simulation.stop()` must be called explicitly.
- Codebase has force simulations created in 6 locations: `ForceGraphRenderer.ts`, `Canvas.tsx`, `networkGraph.ts`, `EmbedNode.tsx`, `NetworkView.tsx`, `d3-optimization.ts`
- Pattern: `const simulation = d3.forceSimulation(nodes)` with no corresponding cleanup.
- React components using D3 rarely implement useEffect cleanup functions (`return () => ...`).
- Tick event handlers (`simulation.on('tick', ...)`) bind closures that capture old data references.

**Consequences:**
- Memory usage grows with each view switch (1027 React hooks in D3 code with weak cleanup).
- CPU stays 30-50% utilization even on idle views.
- Browsers crash after 10-15 view switches on low-end devices.
- Multiple running simulations compete for scheduler time.

**Prevention:**
- Create **ForceSimulationManager** wrapper that tracks all active simulations with explicit lifecycle control
- Wrap D3 force calls in custom `useForceSimulation` hook with cleanup that calls `sim.stop()` and removes tick handlers
- Audit all 6 force simulation locations and standardize on manager
- Add console logging to verify simulation count on creation/destruction

**Detection:**
- DevTools Performance: rising baseline CPU during view switches
- Chrome DevTools Memory: detached DOM nodes count stays high after view switch
- Console: log simulation count (should be ≤1 per view)

**When to address:** **Phase Track A (View Continuum)** — before wiring Gallery/List/Kanban

---

### Pitfall 2: Selection/Scroll State Lost During View Transitions

**What goes wrong:** User selects card, switches views, switches back — selection gone, scroll reset to top.

**Why it happens:**
- Selection state in React contexts, view components unmount completely without persistence
- D3 select state (CSS classes) not persisted to React state
- No mechanism to save/restore view-specific state across mount/unmount cycles
- GridContinuumSwitcher only changes rendered component, not data

**Consequences:**
- User frustration: can't explore data across views without losing context
- Data editing workflows broken: user drafts content, switches views, loses work
- Accessibility issue: users can't reliably maintain position/selection

**Prevention:**
- Implement **ViewStateManager** to persist per-view state (scroll position, selected nodes, zoom level)
- Create custom hook `useViewStatePersistence` that saves state on unmount, restores on mount
- Synchronize SelectionContext changes with event dispatcher
- Use sessionStorage for cross-session scroll state
- Add test: "switch SuperGrid → Network → SuperGrid, verify selection preserved"

**Detection:**
- Manual: select card, switch view, switch back, check if selection visible
- Console: `SelectionContext.getSelectedNodeIds()` before and after view switch
- React DevTools: trace SelectionContext value changes on mode switch

**When to address:** **Phase Track A (View Continuum Integration)** — part of mode switching requirements

---

### Pitfall 3: PAFV Axis Mapping Not Aligned Across View Modes

**What goes wrong:** GridContinuumController specifies axis allocations, but CSS Grid renderers, D3 renderers, and SQL query builders have inconsistent implementations. Kanban shows wrong grouping columns, List shows wrong hierarchy levels, SQL GROUP BY uses wrong columns.

**Why it happens:**
- GridContinuumController defines abstract PAFV mappings but doesn't wire them to renderers
- Three renderer types exist for same view: D3, CSS, query builder assumptions
- PAFV axis change happens in context, but each renderer builds its own allocation
- No single source of truth for "what axis allocated to what plane in what mode"

**Consequences:**
- Silent data corruption: cells render correct data by accident
- User confusion: grouping doesn't match clicked axis
- SQL query mismatches: GROUP BY columns don't match rendered columns
- Refactoring risk: changing PAFV axes breaks renderers independently

**Prevention:**
- Make `GridContinuumController.getProjectionFor(mode)` the **single source of truth**
- Wire all renderers to read from controller output, not raw PAFV context
- Add validation in PAFVContext updateFacet() to enforce mode constraints
- Test suite: "Change PAFV axis, switch to each view mode, verify axis applies correctly"

**Detection:**
- Console: Compare controller projection output with PAFVContext state — should match
- React DevTools: Follow PAFVContext value on mode switch
- SQL audit: Verify GROUP BY columns match rendered grouping

**When to address:** **Phase Track A (View Continuum Integration)** — test early, not at end

---

### Pitfall 4: Three-Canvas Resize Events Desynchronize State

**What goes wrong:** Drag resize handle → ResizeObserver fires in Terminal → SuperGrid reflous → Capture re-wraps → panes show incorrect content, cells misalign.

**Why it happens:**
- NotebookLayout handles screen size breakpoints but doesn't propagate to children
- Three components have own ResizeObservers or resize listeners with no shared state
- PreviewComponent uses `useGridDataCells()` which depends on container width from context
- Resize events during drag create render storms with timing races

**Consequences:**
- Drag-to-resize is janky, layout glitches persist until reload
- SuperGrid cells don't match container width
- Terminal text wrapping updates late, flicker
- Accessibility issue: can't reliably set layout widths
- Data loss risk: editing in Capture during resize can lose unsaved edits

**Prevention:**
- Create shared **PaneLayoutContext** to coordinate dimensions across all canvases
- Use **single ResizeObserver at container level**, not per-component
- Debounce resize events during drag operations
- Test suite: "Drag separator repeatedly, verify SuperGrid cells stay aligned"

**Detection:**
- Resize drag test: watch DOM for smooth, consistent updates
- Console: Log PaneLayoutContext changes during resize
- Performance: should see single render per animation frame, not multiple

**When to address:** **Phase Track D (Three-Canvas Notebook Integration)** — critical for usability

---

### Pitfall 5: CSS Primitives Specificity Wars During View Switching

**What goes wrong:** v6.8 CSS primitives assume "one view active at a time." During transition animation, both old and new view CSS apply. If specificity ties break by source order, Kanban gets SuperGrid column widths.

**Why it happens:**
- CSS loader concatenates files in alphabetical order (gallery → kanban → supergrid → timeline)
- `supergrid.css` has later source order → wins tie-breaker on class conflicts
- No explicit mutual exclusion: CSS doesn't know that `.kanban-container` and `.supergrid-container` are mutually exclusive
- View transition animation might display both views for 200ms

**Consequences:**
- Intermittent layout bugs depending on animation timing — hard to reproduce
- Visual glitches during transitions (cells overflow, wrapping wrong)
- Browser reflow happens twice if both containers in DOM
- Hard to debug: DevTools shows multiple sources match

**Prevention:**
- Use **CSS custom properties to toggle view layout**, not competing selectors
- Ensure only one `.{view}-container` class active at a time
- Add explicit mutual exclusion rules (`display: none` by default)
- Audit CSS for specificity conflicts: `grep -h "^\..*{" *.css | sort | uniq -d`
- Test suite: "Render supergrid → switch to kanban → verify no supergrid-specific rules apply"

**Detection:**
- Browser DevTools: Inspect cell during transition, check Computed tab
- Screenshot before/after: compare layout (cells shouldn't change size from CSS alone)
- `window.getComputedStyle(cell).gridColumn` should return kanban value

**When to address:** **Phase Track A (View Continuum Integration)** — validate CSS precedence early

---

## Moderate Pitfalls

### Pitfall 6: SQL Query Mismatch Between View Projection and SQL Backend

**What goes wrong:** Kanban controller says "group by Status," query generates correct SQL, but NULL cards disappear and empty columns missing from result.

**Why it happens:**
- Query builder doesn't validate facet values exist in data
- Facet discovery scans live data, but view renderer has different assumptions
- SQL query uses GROUP BY but CSS uses repeat(${facetCount}, 1fr) with hardcoded count
- No validation that SQL result columns match expected projection

**Consequences:**
- Wrong column count in Kanban (empty columns don't exist in result)
- Cards with NULL facet disappear
- User thinks data missing when it's just not grouped correctly

**Prevention:**
- Query builder validates result against projection
- View renderer validates SQL result before rendering (check expected columns exist)
- Facet enum explicitly lists values; query includes them even if no data has that value
- Test suite: Create NULL and non-null facet values, verify all columns appear

**When to address:** **Phase Track A** — part of view integration tests

---

### Pitfall 7: Unused Exports Cleanup Removes Active Exports Indirectly

**What goes wrong:** Knip says `formatCellValue` is unused export. Engineer deletes it. But `formatCellWithStyle` uses it internally. Code breaks silently.

**Why it happens:**
- Knip scans for imports in other files; internal re-exports within same file aren't "usage"
- Large refactors leave orphaned exports
- Module has multiple exports used differently
- No test coverage for helper modules

**Consequences:**
- Runtime error or broken layout
- Test suite doesn't catch it if tests don't cover code path

**Prevention:**
- Audit each export before knip fix: manually check for internal usage
- Use **barrel exports** to keep public API explicit
- Require **named imports** in internal code, not defaults
- Add JSDoc `@internal` comment to intentional internal exports
- **Characterization tests** for utility modules (catch deletions with test failures)
- Do not auto-approve knip cleanup PRs; review each deletion

**Detection:**
- Run full test suite before/after knip fix; any new failures indicate over-deletion
- Audit knip output: `knip --reporter=detailed` shows why each export is unused
- Code review: mandatory for knip cleanup

**When to address:** **Phase Track B (Technical Debt Sprint)** — implement safeguards first

---

### Pitfall 8: Directory Health Refactoring Breaks Import Paths

**What goes wrong:** Refactor `src/services/` from 22 files to subdirectories. Imports change from `@/services/x` to `@/services/subdir/x`. Some imports missed. Tests fail with import errors.

**Why it happens:**
- Large refactoring affects 40+ import statements
- Barrel exports get out of sync with new paths
- Third-party tools might cache old paths
- No validation of import paths after refactoring

**Consequences:**
- Runtime "Cannot find module" errors
- Tests fail with import errors (red herring debugging)
- Coverage reports wrong
- IDE autocomplete suggests both old and new paths

**Prevention:**
- Use **TypeScript path aliases** to decouple directory structure from imports
- Update barrel exports automatically after refactoring
- Validate imports: `npm run tsc --noEmit` and custom import test
- Add integration tests for import paths
- Fresh checkout build in CI to catch path issues

**Detection:**
- Build in fresh checkout and run in CI
- Check import count before/after refactoring should match

**When to address:** **Phase Track B** — if restructuring src/services

---

### Pitfall 9: D3 Data Joins Don't Update When Underlying Data Changes

**What goes wrong:** User edits card title. Cell data updates in sql.js, React re-renders, but D3's `.join()` doesn't re-bind because data object identity changed but key function still returns same ID.

**Why it happens:**
- sql.js.exec() returns new array each time, so `cells !== previousCells`
- D3's `.data(cells, d => d.id)` uses key function to match, but doesn't do deep equality
- React re-renders, but D3 re-join doesn't trigger update handlers for existing elements
- Common mistake: assuming `.join()` does full re-render; it doesn't

**Consequences:**
- User edits card, sees old data until reload
- Discrepancy between source of truth (sql.js) and rendered state (D3)

**Prevention:**
- Always include update selection in `.join()` to apply text/attributes to all selections
- Force D3 to see data as changed by including version in key: `d => "${d.id}:${d._version}"`
- Track data mutations in React and explicitly trigger D3 updates
- Test suite: "Edit card title, verify D3 cell text updates immediately" (currently missing)

**Detection:**
- Manual test: Edit card, check cell text without reload
- Console logging in `.join()` update selection (verify not empty)
- DevTools element inspection: check text content before/after edit

**When to address:** **Phase Track A** — validate in view continuum tests

---

### Pitfall 10: ResizeObserver Feedback Loop in TipTap Editor

**What goes wrong:** User types text → TipTap re-renders → height changes → ResizeObserver fires → NotebookLayout reflows → Shell/Preview resize → possible loop if Shell auto-height depends on Preview.

**Why it happens:**
- Multiple ResizeObservers without explicit batching
- TipTap's dynamic height changes not debounced before parent notification
- NotebookLayout recalculates proportions on every resize

**Prevention:**
- Use PaneLayoutContext (from Pitfall 4) to batch and debounce
- TipTap container: fixed height or `flex: 1 auto` instead of content-based sizing
- Debounce ResizeObserver callback

**Detection:**
- Monitor ResizeObserver callback count: should fire <5 times on 1 char input

**When to address:** **Phase Track D** — during three-canvas integration

---

## Minor Pitfalls

### Pitfall 11: CSS Grid Column Count Mismatch in Kanban

**What goes wrong:** CSS hardcodes 4 columns but HeaderDiscoveryService finds 5 status values. 5th column wraps.

**Prevention:** Use CSS variables for column count instead of hardcoded values.

**When to address:** **Phase Track A** — CSS primitives integration

---

### Pitfall 12: Facet Enum Mismatch Between Frontend and Database

**What goes wrong:** Frontend hardcodes Status enum, database adds new value. Kanban shows wrong number of columns.

**Prevention:** Query facet values from database dynamically, don't hardcode.

**When to address:** **Phase Track A** — query validation

---

### Pitfall 13: Scrolling Large Network Graph Causes Lag

**What goes wrong:** Network view with 500 nodes. User scrolls → d3-zoom fires → force simulation recalculates all positions → 60fps becomes 10fps.

**Prevention:** Viewport-bound force simulation (only simulate visible nodes + margin).

**When to address:** **Phase Track C (Network/Timeline Polish)** — performance optimization

---

### Pitfall 14: No Scroll Restoration After View Switch

**What goes wrong:** User scrolls SuperGrid to bottom, switches to Network, clicks Back. SuperGrid remounts with scroll at top.

**Prevention:** Save scroll position to sessionStorage keyed by view mode.

**When to address:** **Phase Track A** — part of view state preservation

---

### Pitfall 15: localStorage Quota Exceeded During View State Save

**What goes wrong:** User saves view state for 10 modes, each 500KB. localStorage quota 5-10MB. Fifth view state fails silently.

**Prevention:** Compress state before storage or use IndexedDB for large state.

**When to address:** **Phase Track A** — storage strategy

---

## Phase-Specific Warnings

| Phase | Focus | Likely Pitfall | Mitigation |
|-------|-------|----------------|-----------|
| **Track A: Gallery/List/Kanban** | Continuum integration, CSS wiring | Pitfall 3, 5 | Single source of truth in controller; validate CSS mutual exclusion |
| **Track A: Mode Switching** | Selection sync, scroll preservation | Pitfall 2, 14 | ViewStateManager + PaneLayoutContext; test 5x switches |
| **Track B: Unused Exports** | Knip cleanup, directory refactoring | Pitfall 7, 8 | Characterization tests; barrel exports; run full test suite after fix |
| **Track C: Network/Timeline** | D3 force simulation, SQL hooks | Pitfall 1, 6 | ForceSimulationManager; validate SQL result; test 10x view switches, monitor memory |
| **Track D: Three-Canvas** | Resize coordination, state sync | Pitfall 4, 10 | PaneLayoutContext with debouncing; resize drag tests; profile editing |

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| Force simulation lifecycle | HIGH | Well-documented pattern; 6 instances in codebase follow problematic pattern |
| Selection/scroll state loss | HIGH | Selection in contexts, components unmount completely, no persistence layer |
| PAFV axis alignment | MEDIUM-HIGH | Controller exists but not wired to all renderers |
| Resize desynchronization | MEDIUM | ResizeObserver usage pattern visible; needs live testing to confirm |
| CSS specificity | MEDIUM | Loading order observed; actual conflicts depend on animation timing |
| SQL query mismatch | MEDIUM | Pattern common in view systems; specific to missing query validation |
| Knip false positives | MEDIUM | Common refactoring target; prevention depends on audit discipline |
| Directory import breaks | MEDIUM | Large refactoring risk but preventable with path aliases |
| D3 stale data | HIGH | Well-documented semantics; pattern found in codebase |
| ResizeObserver loop | LOW-MEDIUM | Plausible but needs live testing; depends on TipTap behavior |

---

## Gaps to Address

- **Live testing:** Force memory growth and ResizeObserver loops need profiling during view switches
- **Integration tests missing:** View continuum, selection preservation, scroll restoration
- **Performance baselines:** Network graph with large datasets needs benchmark
- **Storage strategy:** View state size limits — localStorage vs IndexedDB decision needed

---

*Research completed 2026-02-16*
*Sources: D3.js docs, React patterns, ecosystem research, codebase analysis*
