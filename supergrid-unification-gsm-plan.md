# SuperGrid Architectural Unification: GSM Execution Plan

*February 2026 — Isometry v4*

**Problem**: Two parallel SuperGrid implementations (D3 `SuperGrid.ts` and React `SuperGrid.tsx`) diverged instead of implementing the declared architecture: "D3 shows the truth, React lets you change it."

**Goal**: Unify to a single rendering pipeline where D3 owns the Data Floor (z=0) and React overlays the Density Layer (z=1+), with clean data flow between them.

**Source of diagnosis**: Cross-LLM code review (Gemini CLI) confirmed by architectural analysis against CardBoard Architecture Truth doc.

---

## Architecture Target

```
┌─────────────────────────────────────────────────────────────┐
│  z=2  OVERLAY LAYER (React)                                 │
│       Cards, Audit View, Modals, Inspector                  │
├─────────────────────────────────────────────────────────────┤
│  z=1  DENSITY LAYER (React)                                 │
│       MiniNav, Header spanning, Selection state             │
│       Reads FROM D3 → Sends updates TO D3                   │
├─────────────────────────────────────────────────────────────┤
│  z=0  SPARSITY LAYER (D3)                                   │
│       Column Headers, Row Headers, Data Cells               │
│       Cell-by-cell rendering, pasteboard source             │
├─────────────────────────────────────────────────────────────┤
│       SQLite (sql.js) — source of truth                     │
└─────────────────────────────────────────────────────────────┘

Data flow:
  SQLite → D3 renders cells → React reads D3 state → React overlays controls
  User interaction → React handles → React updates D3 → D3 re-renders
```

**The contract**: D3 exposes a stable API surface. React consumes it. They never independently query SQLite for the same data.

---

## Pre-Flight: Audit & Inventory

Before writing any code, establish the exact scope of divergence.

### PF-1: Map the dual implementations
**Type**: Diagnostic (read-only)
**Executor**: Claude Code

```
Task: Produce a comparison matrix of SuperGrid.ts vs SuperGrid.tsx

For each file, document:
1. What data does it query/receive?
2. What DOM elements does it create?
3. What user interactions does it handle?
4. What state does it manage?
5. What other components/modules does it import?

Output: supergrid-audit.md with side-by-side comparison table
```

**Verification gate**: The audit exists and both implementations are fully inventoried. No code changes.

### PF-2: Identify the overlap zone
**Type**: Diagnostic (read-only)
**Executor**: Claude Code

```
Task: From the PF-1 audit, classify every capability as:

- D3-ONLY: Only exists in SuperGrid.ts (keep as-is)
- REACT-ONLY: Only exists in SuperGrid.tsx (evaluate: move to D3 or keep in React?)
- DUPLICATED: Exists in both (the problem — must resolve)
- MISSING: In the spec but neither implementation (backlog)

For DUPLICATED items, note which implementation is more complete/correct.
For REACT-ONLY items, classify as:
  - RENDERING (should move to D3 per architecture)
  - CONTROL (correct placement in React)
  - AMBIGUOUS (needs architectural decision)

Output: Append classification to supergrid-audit.md
```

**Verification gate**: Every feature has exactly one classification. Zero ambiguous items remain (escalate to architect chat if needed).

---

## Phase 1: Define the D3 API Surface

The critical architectural work. D3's SuperGrid becomes a proper module with a typed public API that React can depend on.

### P1-1: Design the SuperGridEngine interface
**Type**: Architecture (spec only, no implementation)
**Executor**: Architect chat (Claude AI) → produces spec for Claude Code

```typescript
// TARGET: src/d3/SuperGridEngine.ts

/**
 * SuperGridEngine is the single D3 rendering authority for grid views.
 * React components consume this API — they never render grid cells directly.
 *
 * Responsibilities:
 * - Receive data from SQLite (via DataService)
 * - Render all z=0 content (headers + data cells)
 * - Expose read-only state for React consumption
 * - Accept configuration updates from React
 * - Emit events for React to observe
 */

interface SuperGridEngine {
  // === Lifecycle ===
  mount(container: HTMLElement): void;
  unmount(): void;
  
  // === Data ===
  setData(nodes: Node[], edges: Edge[]): void;
  
  // === PAFV Configuration (React calls these) ===
  setAxisMapping(mapping: AxisMapping): void;  // "any axis to any plane"
  setOriginPattern(pattern: 'anchor' | 'bipolar'): void;
  
  // === Read-only state (React reads these) ===
  getVisibleCells(): CellDescriptor[];
  getHeaderStructure(): HeaderTree;
  getGridDimensions(): { rows: number; cols: number; };
  getSelection(): SelectionState;
  
  // === Events (React observes these) ===
  on(event: 'cellClick', handler: (cell: CellDescriptor) => void): void;
  on(event: 'selectionChange', handler: (sel: SelectionState) => void): void;
  on(event: 'axisChange', handler: (mapping: AxisMapping) => void): void;
  on(event: 'renderComplete', handler: () => void): void;
  
  // === Viewport ===
  scrollTo(row: number, col: number): void;
  zoomTo(level: number): void;
  getViewport(): ViewportState;
}

interface AxisMapping {
  xAxis: LATCHAxis;    // Which LATCH axis maps to columns
  yAxis: LATCHAxis;    // Which LATCH axis maps to rows
  xFacet?: string;     // Specific facet (e.g., 'due_date' within Time)
  yFacet?: string;
}

type LATCHAxis = 'Location' | 'Alphabet' | 'Time' | 'Category' | 'Hierarchy';
```

**Verification gate**: Interface reviewed and approved in architect chat. Types compile. No implementation yet.

### P1-2: Implement SuperGridEngine skeleton
**Type**: Feature GSD
**Executor**: Claude Code

```
Task: Implement SuperGridEngine with the approved interface.

Phase 1 scope — skeleton only:
- mount/unmount lifecycle
- setData receives nodes and renders flat grid cells via D3
- Event emission works (cellClick, renderComplete)
- getVisibleCells returns accurate descriptors

DO NOT implement yet:
- Axis remapping (SuperDynamic)
- Zoom/pan (SuperZoom)
- Header spanning logic
- Selection beyond single cell

Tests: 
- Engine mounts and renders N cells for N data items
- cellClick fires with correct CellDescriptor
- unmount cleans up DOM
- setData with new data triggers enter/update/exit correctly
```

**Verification gate**: `npm run check` passes. Tests green. D3 renders a basic grid. No React involvement yet.

### P1-3: Migrate existing D3 SuperGrid.ts logic into engine
**Type**: Refactor GSD
**Executor**: Claude Code

```
Task: Move all rendering logic from current SuperGrid.ts into SuperGridEngine.

Using the PF-1 audit's D3-ONLY classification:
- Port each D3-only capability into the engine
- Maintain existing behavior exactly
- Add test for each ported capability
- Delete dead code from old SuperGrid.ts as logic moves

Batch strategy:
1. Header rendering (SuperGridHeaders → engine)
2. Cell rendering (data floor)
3. D3 scales and axis setup
4. Any existing event handlers

After each batch: npm run check + visual verification
```

**Verification gate**: Old `SuperGrid.ts` is either empty/deleted or reduced to a thin re-export of `SuperGridEngine`. All its tests now test the engine.

---

## Phase 2: React Wrapper — Consuming the Engine

### P2-1: Create SuperGridView React component
**Type**: Feature GSD
**Executor**: Claude Code

```
Task: Create src/components/supergrid/SuperGridView.tsx

This component:
- Mounts SuperGridEngine into a ref'd container div
- Subscribes to engine events via useEffect
- Exposes React-friendly props for configuration
- Does NOT render any grid cells itself

Structure:
  function SuperGridView({ data, axisMapping, originPattern, onCellSelect }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<SuperGridEngine | null>(null);
    
    useEffect(() => {
      // Mount engine
      engineRef.current = new SuperGridEngine();
      engineRef.current.mount(containerRef.current!);
      return () => engineRef.current?.unmount();
    }, []);
    
    useEffect(() => {
      // Push data to engine
      engineRef.current?.setData(data.nodes, data.edges);
    }, [data]);
    
    useEffect(() => {
      // Push config to engine
      engineRef.current?.setAxisMapping(axisMapping);
    }, [axisMapping]);
    
    // Subscribe to events
    useEffect(() => {
      engineRef.current?.on('cellClick', onCellSelect);
    }, [onCellSelect]);
    
    return <div ref={containerRef} className="supergrid-container" />;
  }
```

**Verification gate**: React component renders, D3 engine draws cells inside it. Clicking a cell fires the React callback. The React component creates ZERO grid DOM elements itself.

### P2-2: Migrate React-only CONTROL capabilities
**Type**: Refactor GSD
**Executor**: Claude Code

```
Task: From PF-2 audit, take all REACT-ONLY items classified as CONTROL
and wire them as React overlays on top of SuperGridView.

Priority order:
1. SuperStack header controls (spanning, collapse/expand)
2. Selection state UI (highlight, multi-select indicators)
3. Context menus
4. Any toolbar/filter controls

Each control:
- Reads state from engine (engineRef.current.getHeaderStructure() etc.)
- Renders as React absolutely-positioned overlay
- Sends mutations back through engine API

Pattern:
  <div className="supergrid-wrapper">
    <SuperGridView ref={engineRef} ... />
    <HeaderControls engine={engineRef} />   {/* z=1 overlay */}
    <SelectionOverlay engine={engineRef} /> {/* z=1 overlay */}
  </div>
```

**Verification gate**: All CONTROL features work. Visual diff against current behavior shows parity (or improvement). No rendering duplication between D3 and React.

### P2-3: Retire old SuperGrid.tsx
**Type**: Refactor GSD
**Executor**: Claude Code

```
Task: Delete src/components/supergrid/SuperGrid.tsx (the old parallel implementation)

Steps:
1. Find all imports of old SuperGrid.tsx
2. Replace with SuperGridView imports
3. Verify all parent components work with new component
4. Delete SuperGrid.tsx
5. Run full test suite

This is the "cut the cord" moment. The old parallel implementation is gone.
```

**Verification gate**: `SuperGrid.tsx` deleted. `npm run check` passes. All views that used old component now use `SuperGridView` + `SuperGridEngine`. No rendering duplication exists anywhere.

---

## Phase 3: Feature Implementation (Post-Unification)

Only begin after Phase 2 verification gates all pass. Each feature follows standard Feature GSD.

### P3-1: SuperDynamic (Axis Drag-and-Drop)
**Priority**: Highest — this IS the PAFV demo

```
The user drags an axis label (e.g., "Time") and drops it on a plane slot
(e.g., "X-Axis"). The grid re-renders with the new mapping.

Implementation:
- D3 engine: setAxisMapping() triggers full re-layout
- React overlay: Drag source (axis labels) + drop targets (plane slots)
- Animation: D3 transition on cell positions (enter/update/exit)

This validates: "Any axis can map to any plane — view transitions are remappings"
```

### P3-2: SuperZoom (Cartographic Navigation)
**Priority**: High — validates Planes layer

```
Semantic zoom: zoom out = aggregation, zoom in = detail.
At high zoom: see individual cells with content.
At low zoom: see category summaries with counts.

Implementation:
- D3 engine: d3-zoom with semantic zoom levels
- React overlay: MiniNav shows current viewport position
- Data: Different detail levels query different aggregations from SQLite
```

### P3-3: SuperSelect (Z-Axis Aware Selection)
**Priority**: High — validates depth model

```
Selection behavior changes based on z-level:
- z=0 click: Select data cell (for pasteboard)
- z=1 click: Select header (for reordering/filtering)
- z=2 click: Interact with card overlay

Implementation:
- D3 engine: getSelection() includes z-level metadata
- React: Different handlers per z-level
```

### P3-4–P3-8: Remaining Super* features
Following Gemini's suggested order with one modification:
- **P3-4**: SuperSize (column/row resizing) — high UX impact
- **P3-5**: SuperFilter + SuperSort — core LATCH operations
- **P3-6**: SuperSearch — FTS5 integration with visual highlighting
- **P3-7**: SuperCalc — HyperFormula integration
- **P3-8**: SuperAudit — data provenance overlay

Lower priority (schedule after core is solid):
- **P3-9**: SuperTime — temporal navigation
- **P3-10**: SuperPosition — save/restore view configurations
- **P3-11**: SuperCards — expanded card overlay

---

## Quality Gates (Applied at Every Phase)

```
Level 0: TypeScript compiles (zero errors)         ← P0, blocks everything
Level 1: ESLint passes (zero errors at threshold)   ← P0
Level 2: Unit tests pass                            ← P0
Level 3: Integration tests pass                     ← P1
Level 4: Visual verification (renders correctly)    ← P1
Level 5: No rendering duplication                   ← P1 for this plan specifically
```

**The Phase 2 "nuclear gate"**: After P2-3, run this verification:

```bash
# Search for any React component that creates grid cells
grep -r "createElement.*cell\|<td\|<div.*cell\|className.*cell" src/components/supergrid/ 
# Should return ZERO results for rendering — only class name references in CSS/tests

# Search for any direct SQLite queries in React grid components  
grep -r "sql\|query\|SELECT" src/components/supergrid/
# Should return ZERO results — all data flows through D3 engine
```

---

## Estimated Effort

| Phase | Effort | Dependency |
|-------|--------|------------|
| Pre-Flight (PF-1, PF-2) | 1 session | None |
| Phase 1 (P1-1 through P1-3) | 2-3 sessions | Pre-Flight complete |
| Phase 2 (P2-1 through P2-3) | 2-3 sessions | Phase 1 complete |
| Phase 3 features | 1 session each | Phase 2 complete |

"Session" = one Claude Code GSD cycle (focused work block).

---

## Risk Mitigation

**Risk**: Phase 1 engine interface doesn't account for something the React component needs.
**Mitigation**: PF-1 audit catches this. If gaps emerge during P2, extend the engine API — never bypass it.

**Risk**: Visual regression during migration.
**Mitigation**: Screenshot comparison at each phase gate. Current behavior is the baseline.

**Risk**: Scope creep into features during unification.
**Mitigation**: Phases 1-2 are pure refactoring. Zero new features. The existing behavior must work identically through the new pipeline. Features are Phase 3 only.

**Risk**: Temptation to restart from scratch.
**Mitigation**: You've identified this pattern. The existing D3 code is good (Gemini confirmed "solid D3 foundation"). We're routing it through proper architecture, not rewriting it.

---

## Success Criteria

The unification is complete when:

1. **One rendering path**: `SQLite → SuperGridEngine (D3) → DOM cells`
2. **One control path**: `User input → React → SuperGridEngine API → re-render`
3. **Zero duplication**: No React component creates grid cells
4. **Clean separation**: `grep` tests in nuclear gate pass
5. **Feature parity**: Everything that worked before still works
6. **Foundation ready**: SuperDynamic (axis drag-and-drop) can be built in one GSD session on the unified architecture

---

*This plan is designed to be directly consumable by Claude Code in GSD executor mode.*
*Each task has explicit scope, verification gates, and "what NOT to do" boundaries.*
