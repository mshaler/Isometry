# Architecture Research

**Domain:** SuperGrid Complete — 13 new Super* interactive features integrated into existing Provider/View/Worker architecture
**Researched:** 2026-03-03
**Confidence:** HIGH (based on direct source inspection of all relevant files)

> **Note:** This document is scoped to v3.0 SuperGrid Complete. It supersedes the v2.0 ARCHITECTURE.md for this milestone. Prior architecture documents remain valid for their respective layers (ETL, Native Shell, etc.) — those components are not modified by this milestone. This document covers only what changes, what is new, and the integration points with the existing v2.0 architecture.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     SUPERGRID FEATURE LAYER (v3.0 new)                   │
├──────────────────────────────────────────────────────────────────────────┤
│  SuperDynamic  SuperSize  SuperZoom  SuperDensity  SuperSelect            │
│  SuperCards    SuperCalc  SuperAudit SuperTime     SuperSort              │
│  SuperFilter   SuperSearch SuperPosition                                  │
│  (inline private methods OR sub-components in supergrid/ subfolder)      │
├────────────────────────────┬─────────────────────────────────────────────┤
│     PROVIDER LAYER         │         VIEW LAYER                          │
│                            │                                             │
│  ┌─────────────────────┐   │  ┌──────────────────────────────────────┐   │
│  │  PAFVProvider       │   │  │  SuperGrid.ts                        │   │
│  │  EXTEND: add        │──▶│  │  REWRITE render() to read stacked    │   │
│  │  colAxes/rowAxes    │   │  │  axes from PAFVProvider; wire        │   │
│  │  stacked arrays     │   │  │  supergrid:query instead of          │   │
│  └─────────────────────┘   │  │  in-memory card filtering            │   │
│                            │  │                                      │   │
│  ┌─────────────────────┐   │  │  SuperStackHeader.ts  (UNCHANGED)    │   │
│  │  SuperPositionProv  │   │  │  SuperGridQuery.ts    (WIRE ONLY)    │   │
│  │  NEW: Tier 3        │   │  └──────────────────────────────────────┘   │
│  │  ephemeral coord    │   │                                             │
│  │  + scroll state     │   │  ViewManager (MINOR: pass pafv to           │
│  └─────────────────────┘   │  SuperGrid constructor)                     │
│                            │                                             │
│  FilterProvider (UNCHANGED)│                                             │
│  SelectionProvider (UNCHANGED)                                           │
│  DensityProvider (UNCHANGED)                                             │
├────────────────────────────┴─────────────────────────────────────────────┤
│                         WORKER LAYER                                      │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────┐   │
│  │  WorkerBridge        │  │  Worker handlers                        │   │
│  │  EXTEND: add         │  │  NEW: supergrid.handler.ts              │   │
│  │  superGridQuery()    │  │  calls buildSuperGridQuery() + db.exec  │   │
│  │  typed method        │  │  returns { cells: grouped result rows } │   │
│  └──────────────────────┘  └─────────────────────────────────────────┘   │
│  protocol.ts EXTEND: add 'supergrid:query' to WorkerRequestType union    │
├──────────────────────────────────────────────────────────────────────────┤
│             DATA LAYER (sql.js WASM) — UNCHANGED                         │
│  cards table, FTS5, connections — no schema changes                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status for v3.0 |
|-----------|----------------|-----------------|
| `PAFVProvider` | Axis state for all views | EXTEND: add `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` alongside existing single-axis fields |
| `SuperPositionProvider` | Ephemeral Tier 3 coordinate tracking (scroll offsets, cell bounding box map) | NEW: mirrors SelectionProvider pattern — never persisted, never in StateCoordinator |
| `SuperGrid.ts` | Grid render with dynamic axes; orchestrates all Sub-feature behaviors | REWRITE render(): remove hardcoded `DEFAULT_COL_FIELD`/`DEFAULT_ROW_FIELD`; read from PAFVProvider stacked axes; wire `supergrid:query` |
| `SuperGridQuery.ts` | SQL GROUP BY builder | WIRE ONLY: SQL already correct, needs a Worker handler to execute it |
| `SuperStackHeader.ts` | Nested header spanning algorithm | UNCHANGED — already handles 1–3 level tuples and collapse |
| `WorkerBridge` | Typed RPC client for main thread | EXTEND: add `superGridQuery()` typed method |
| `protocol.ts` | Worker message type definitions | EXTEND: add `supergrid:query` to `WorkerRequestType`, `WorkerPayloads`, `WorkerResponses` |
| `supergrid.handler.ts` | DB execution for SuperGrid queries | NEW: imports `buildSuperGridQuery`, runs via `db.exec()`, returns grouped rows |
| `ViewManager` | View lifecycle orchestration | MINOR: pass `pafv` to SuperGrid constructor |
| HyperFormula | PAFV-scoped formula engine | NEW external dependency (SuperCalc only) — main thread, not Worker |

---

## Recommended Project Structure

```
src/
├── providers/
│   ├── PAFVProvider.ts             # EXTEND: colAxes/rowAxes arrays, setColAxes/setRowAxes
│   ├── SuperPositionProvider.ts    # NEW: Tier 3 scroll offset + cell bounding box map
│   ├── types.ts                    # MINOR: extend PAFVProviderLike for stacked axes
│   ├── allowlist.ts                # UNCHANGED — existing AxisField union covers all needed fields
│   ├── FilterProvider.ts           # UNCHANGED
│   ├── DensityProvider.ts          # UNCHANGED
│   ├── SelectionProvider.ts        # UNCHANGED
│   ├── StateCoordinator.ts         # UNCHANGED
│   ├── StateManager.ts             # UNCHANGED
│   └── QueryBuilder.ts             # UNCHANGED
├── views/
│   ├── SuperGrid.ts                # REWRITE render(); add Super* private methods for inline features
│   ├── types.ts                    # MINOR: extend PAFVProviderLike with getColAxes/getRowAxes
│   └── supergrid/
│       ├── SuperStackHeader.ts     # UNCHANGED
│       ├── SuperGridQuery.ts       # UNCHANGED (SQL correct; handler executes it)
│       ├── SuperGridSizer.ts       # NEW: ResizeObserver + pointer drag → column/row width map
│       ├── SuperGridZoom.ts        # NEW: wheel/pinch handler → SuperPositionProvider scroll offset
│       ├── SuperGridSelect.ts      # NEW: SVG lasso overlay + cell bounding box intersection
│       ├── SuperGridCalc.ts        # NEW: HyperFormula instance + formula cell lifecycle
│       ├── SuperGridFilter.ts      # NEW: per-column dropdown DOM → FilterProvider.addFilter()
│       ├── SuperGridSearch.ts      # NEW: search panel DOM + FTS5 bridge call + cell highlight
│       └── SuperGridCards.ts       # NEW: aggregation card DOM from supergrid:query COUNT data
└── worker/
    ├── protocol.ts                 # EXTEND: supergrid:query request/response types
    ├── WorkerBridge.ts             # EXTEND: superGridQuery() typed method
    └── handlers/
        ├── supergrid.handler.ts    # NEW: executes SuperGridQuery SQL, returns cells
        ├── index.ts                # EXTEND: register supergrid handler in routing switch
        └── (all other handlers unchanged)
```

### Structure Rationale

- **`supergrid/` subfolder for Sub-components:** Features with significant own state or DOM complexity live here as helper classes (not IView implementations). `SuperGrid.ts` orchestrates them. This mirrors how SuperStackHeader already lives in the subfolder.
- **`SuperPositionProvider.ts` in providers/:** Follows the Tier 3 pattern from `SelectionProvider`. Scroll offsets and cell bounding boxes belong in a provider (observable, injectable) rather than in `SuperGrid.ts` private state, because both `SuperGridZoom` and `SuperGridSelect` need to read from it.
- **`supergrid.handler.ts` in worker/handlers/:** One handler per domain — matches every other handler in the folder. Handler files import their query builders; they do not inline SQL.

---

## Architectural Patterns

### Pattern 1: PAFVProvider Stacked Axes Extension

**What:** Add `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` as parallel state in `PAFVState`, alongside the existing `xAxis`/`yAxis`/`groupBy` fields. The existing single-axis API is preserved completely — no other view is affected.

**When to use:** SuperGrid exclusively. Only triggered when `viewType === 'supergrid'`.

**Trade-offs:** Minimal impact. `isPAFVState` type guard must accept the new arrays. `toJSON`/`setState` round-trip must handle them. VIEW_DEFAULTS for supergrid must supply sensible defaults.

**Example:**
```typescript
// Extended PAFVState (supergrid-specific fields added)
interface PAFVState {
  viewType: ViewType;
  xAxis: AxisMapping | null;        // existing — unchanged
  yAxis: AxisMapping | null;        // existing — unchanged
  groupBy: AxisMapping | null;      // existing — unchanged
  colAxes: AxisMapping[];           // NEW: up to 3, primary→secondary→tertiary
  rowAxes: AxisMapping[];           // NEW: up to 3, primary→secondary→tertiary
}

// New VIEW_DEFAULTS.supergrid (replaces null-only defaults)
supergrid: {
  viewType: 'supergrid',
  xAxis: null, yAxis: null, groupBy: null,
  colAxes: [{ field: 'card_type', direction: 'asc' }],
  rowAxes: [{ field: 'folder', direction: 'asc' }],
}

// New methods on PAFVProvider:
setColAxes(axes: AxisMapping[]): void  // validates all fields via validateAxisField()
setRowAxes(axes: AxisMapping[]): void
getColAxes(): AxisMapping[]
getRowAxes(): AxisMapping[]
```

### Pattern 2: SuperGrid Reads Axes Directly from PAFVProvider

**What:** `SuperGrid` accepts a `PAFVProvider`-compatible reference in its constructor. `render()` reads `colAxes`/`rowAxes` from the provider instead of hardcoded `DEFAULT_COL_FIELD`/`DEFAULT_ROW_FIELD` constants. ViewManager already holds a `pafv` reference — it just needs to pass it when constructing `SuperGrid`.

**When to use:** This is the core foundation wiring. Every subsequent Super* feature depends on dynamic axes being live.

**Trade-offs:** The existing `SuperGrid` constructor takes no arguments. Adding `pafv` is a breaking change to the constructor signature — existing tests must supply a mock. This is the expected cost of foundation wiring.

**Example:**
```typescript
// Extended PAFVProviderLike in views/types.ts
export interface PAFVProviderLike {
  setViewType(viewType: ViewType): void;
  getColAxes(): AxisMapping[];   // NEW
  getRowAxes(): AxisMapping[];   // NEW
}

// SuperGrid constructor change
export class SuperGrid implements IView {
  constructor(private readonly pafv: PAFVProviderLike) {}

  render(cards: CardDatum[]): void {
    const colAxes = this.pafv.getColAxes();  // was: DEFAULT_COL_FIELD
    const rowAxes = this.pafv.getRowAxes();  // was: DEFAULT_ROW_FIELD
    const colAxisValues = buildAxisTuples(cards, colAxes);
    const rowAxisValues = buildAxisTuples(cards, rowAxes);
    // buildHeaderCells call unchanged — already accepts string[][] tuples
  }
}
```

### Pattern 3: SuperGridQuery Wired to Worker via New Handler

**What:** `SuperGridQuery.buildSuperGridQuery()` already produces safe, correct SQL. It only needs a Worker handler (`supergrid:query`) to execute it and return grouped cell data. `SuperGrid` then uses this grouped response directly, replacing in-memory filtering.

**When to use:** Foundation wiring — required before SuperCards, SuperCalc, SuperFilter can work (they all depend on the grouped cell result, not raw card arrays).

**Trade-offs:** Adds a new `WorkerRequestType` + handler. The response shape differs from `db:query`: it returns `{ cells: Array<{ rowKey, colKey, count, card_ids }> }` rather than raw card rows. `ViewManager._fetchAndRender()` uses `db:query`; SuperGrid must fetch its own data directly via `bridge.superGridQuery()`.

**The key architectural decision:** SuperGrid does NOT go through ViewManager's `_fetchAndRender()` path. It fetches its own data directly because its query semantics (GROUP BY across two axes) are incompatible with the generic `buildCardQuery()` path. This is acceptable — NetworkView similarly fetches its own graph simulation data directly. SuperGrid registers a coordinator subscriber for re-trigger but performs its own fetch.

**Example:**
```typescript
// protocol.ts additions
type WorkerRequestType = ... | 'supergrid:query';

interface WorkerPayloads {
  'supergrid:query': {
    colAxes: AxisMapping[];
    rowAxes: AxisMapping[];
    where: string;
    params: unknown[];
  };
}

interface WorkerResponses {
  'supergrid:query': {
    cells: Array<{
      rowKey: string;
      colKey: string;
      count: number;
      card_ids: string;   // comma-separated from GROUP_CONCAT(id)
    }>;
  };
}

// supergrid.handler.ts
export function handleSuperGridQuery(db: Database, payload: WorkerPayloads['supergrid:query']) {
  const { sql, params } = buildSuperGridQuery({
    colAxes: payload.colAxes,
    rowAxes: payload.rowAxes,
    where: payload.where,
    params: payload.params,
  });
  const result = db.exec(sql, params);
  return { cells: result.rows };
}
```

### Pattern 4: Super* Features as Private Methods or Sub-Components

**What:** Each Super* feature is implemented as either:
1. A **private method** of `SuperGrid.ts` — for features that only affect render output with no significant own state
2. A **separate sub-component** in `supergrid/` — for features with significant independent state, event listeners, or DOM lifecycle

**When to use:** Every Super* feature falls into one of these two categories. The dividing line is "does this feature need its own `subscribe()` loop or its own teardown on `destroy()`?"

**Classification table:**
| Feature | Implementation | Reason |
|---------|---------------|--------|
| SuperDynamic | Private method + HTML5 drag events | Drag-drop updates PAFVProvider; re-render via StateCoordinator |
| SuperSize | Sub-component `SuperGridSizer.ts` | PointerEvent listeners + persistent pixel size map across renders |
| SuperZoom | Sub-component `SuperGridZoom.ts` | WheelEvent + pinch gesture + SuperPositionProvider subscription |
| SuperDensity | Private method | Reads DensityProvider.getState().granularity; formats time headers |
| SuperSelect | Sub-component `SuperGridSelect.ts` | SVG lasso overlay with own pointer lifecycle + SuperPositionProvider |
| SuperPosition | Provider `SuperPositionProvider.ts` | Tier 3: consumed by SuperZoom + SuperSelect independently |
| SuperCards | Sub-component `SuperGridCards.ts` | Aggregation card DOM elements with own structure |
| SuperCalc | Sub-component `SuperGridCalc.ts` | HyperFormula instance requires explicit init/teardown |
| SuperAudit | Private method | CSS class toggle on computed cells — one-liner in render |
| SuperTime | Private method | strftime date formatting on time-axis column headers |
| SuperSort | Private method | Direction toggle via `pafv.setColAxes([...])` on header click |
| SuperFilter | Sub-component `SuperGridFilter.ts` | Dropdown DOM per column header with own event listeners |
| SuperSearch | Sub-component `SuperGridSearch.ts` | Floating search panel with own input lifecycle |

---

## Data Flow

### Foundation Data Flow (after all three foundation phases)

```
User drags axis to reorder (SuperDynamic)
    ↓
SuperGrid._handleAxisDrop(newColAxes)
    ↓
pafv.setColAxes(newColAxes)      ← validates against allowlist
    ↓ queueMicrotask
PAFVProvider notifies StateCoordinator subscriber
    ↓ setTimeout(16ms)
StateCoordinator fires: SuperGrid._fetchAndRender()
    ↓
bridge.superGridQuery({
  colAxes: pafv.getColAxes(),
  rowAxes: pafv.getRowAxes(),
  where: filter.compile().where,
  params: filter.compile().params,
})
    ↓
Worker: handleSuperGridQuery → buildSuperGridQuery → db.exec()
    ↓
{ cells: [{ rowKey, colKey, count, card_ids }] }
    ↓
SuperGrid.render(cells)
    ↓
buildAxisTuples(cells) → buildHeaderCells() (SuperStackHeader, unchanged)
    ↓
CSS Grid data join  ← D3 key: `${rowKey}:${colKey}`
```

### SuperFilter Flow (uses existing FilterProvider)

```
User selects value in SuperGridFilter dropdown
    ↓
SuperGridFilter calls filterProvider.addFilter({ field, operator: 'eq', value })
    ↓ queueMicrotask (FilterProvider notifies)
StateCoordinator fires → SuperGrid._fetchAndRender()
    ↓ (normal supergrid:query path resumes with updated WHERE clause)
```

### SuperSearch Flow (parallel path, does not trigger re-query)

```
User types in SuperGridSearch panel
    ↓
bridge.searchCards(query)  ← existing bridge method, unchanged
    ↓
FTS5 results: [{ id, snippet }]
    ↓
SuperGridSearch highlights matching cells by id
(CSS class applied directly — no re-render, no re-query)
```

### SuperSelect Lasso Flow

```
User draws lasso on SuperGridSelect SVG overlay
    ↓
Pointer events → lasso bounds rect
    ↓
SuperGridSelect queries SuperPositionProvider for cell bounding boxes
    ↓
Computes intersection: which cells overlap lasso bounds
    ↓
For each intersecting cell: extract card_ids from last supergrid:query result
    ↓
SelectionProvider.selectAll(allMatchingIds)
    ↓ queueMicrotask (SelectionProvider notifies its own subscribers)
(SelectionProvider is Tier 3 — does NOT trigger StateCoordinator re-render)
SuperGrid visually marks selected cells (CSS class update, no requery)
```

### SuperCalc Flow

```
SuperGrid receives grouped cells from supergrid:query
    ↓
SuperGridCalc.loadSheet(cells)   ← maps cells to HyperFormula virtual sheet
    ↓
User enters formula in header cell (e.g., "=SUM(B1:B5)")
    ↓
SuperGridCalc.evaluate(formula, cellRange)
    ↓
HyperFormula computes (main thread, pure in-memory)
    ↓
SuperGrid.render(): injects computed value into cell DOM
SuperAudit: adds .is-computed CSS class to that cell
```

### SuperZoom Flow (no SQL, no re-render)

```
User scrolls or pinches on .supergrid-view
    ↓
SuperGridZoom captures WheelEvent / pinch gesture
    ↓
SuperPositionProvider.setScrollOffset({ x, y })
    ↓ queueMicrotask (SuperPositionProvider notifies SuperGridZoom subscriber)
SuperGridZoom applies CSS transform: translate(x,y) to .supergrid-container
(CSS position:sticky on header row/column handles pinning automatically)
```

---

## Integration Points: New vs Existing

### Files That Change (Existing Files Modified)

| File | Change Type | Specific Changes |
|------|-------------|-----------------|
| `src/providers/PAFVProvider.ts` | EXTEND | Add `colAxes: AxisMapping[]`, `rowAxes: AxisMapping[]` to `PAFVState`. Add `setColAxes()`, `setRowAxes()`, `getColAxes()`, `getRowAxes()`. Update `VIEW_DEFAULTS.supergrid` with default axes. Update `isPAFVState` type guard to accept empty arrays as valid. Update `toJSON()`/`setState()` to round-trip arrays. |
| `src/providers/types.ts` | MINOR EXTEND | No new types required — `AxisMapping` is already correct. If a `SuperGridAxisState` interface is desired for clarity, add it here. |
| `src/views/types.ts` | MINOR EXTEND | Add `getColAxes(): AxisMapping[]` and `getRowAxes(): AxisMapping[]` to `PAFVProviderLike` interface (so SuperGrid can use stacked axes without importing the concrete class). |
| `src/views/SuperGrid.ts` | REWRITE render() | Remove `DEFAULT_COL_FIELD`/`DEFAULT_ROW_FIELD`. Accept `PAFVProvider`-compatible in constructor. Build multi-level axis value tuples from stacked axes. Wire `bridge.superGridQuery()` call. Add Sub-component wiring. Add inline private methods for SuperDynamic, SuperDensity, SuperAudit, SuperTime, SuperSort. |
| `src/views/ViewManager.ts` | MINOR | Pass `pafv` to `SuperGrid` constructor in the `createView` factory call. SuperGrid now needs `pafv` to read stacked axes. |
| `src/worker/protocol.ts` | EXTEND | Add `'supergrid:query'` to `WorkerRequestType` union. Add `WorkerPayloads['supergrid:query']` shape. Add `WorkerResponses['supergrid:query']` shape. |
| `src/worker/WorkerBridge.ts` | EXTEND | Add `superGridQuery(colAxes, rowAxes, where, params)` typed wrapper method around `this.send('supergrid:query', ...)`. |
| `src/worker/handlers/index.ts` | EXTEND | Import and register `handleSuperGridQuery` from `supergrid.handler.ts` in the routing switch. |

### Files That Are New

| File | Purpose |
|------|---------|
| `src/providers/SuperPositionProvider.ts` | Tier 3 provider: tracks scroll offset (`{ x, y }`) and cell bounding box map (`Map<string, DOMRect>`). Mirrors `SelectionProvider` pattern: never persisted, not in StateCoordinator, `subscribe()`/`notify()` via `queueMicrotask`. |
| `src/views/supergrid/SuperGridSizer.ts` | Manages column and row resize via pointer events. Stores pixel widths in a `Map<string, number>`. Calls an `onResize` callback so SuperGrid re-renders with updated column template. Attaches/detaches its own `pointerdown`/`pointermove`/`pointerup` listeners. |
| `src/views/supergrid/SuperGridZoom.ts` | Manages viewport scroll for SuperGrid. Attaches wheel listener to `.supergrid-view`. Updates `SuperPositionProvider.setScrollOffset()`. Subscribes to provider to apply CSS transform. Calls `destroy()` to clean up listeners. |
| `src/views/supergrid/SuperGridSelect.ts` | SVG lasso overlay positioned over CSS Grid. On pointerdown: starts lasso rect. On pointermove: updates lasso rect. On pointerup: computes intersecting cells from `SuperPositionProvider` bounding box map, extracts card IDs from last query result, calls `SelectionProvider.selectAll(ids)`. |
| `src/views/supergrid/SuperGridFilter.ts` | Per-column auto-filter dropdown. Reads distinct column values from the last `supergrid:query` result (already available — these are the `colKey` values). Renders dropdown DOM anchored to column header. On selection: calls `FilterProvider.addFilter()`. |
| `src/views/supergrid/SuperGridSearch.ts` | Floating search panel. Input triggers `bridge.searchCards(query)` (existing method). Highlights matching card cells by setting a CSS class on `.data-cell[data-key]` elements. Does not trigger a grid re-render. |
| `src/views/supergrid/SuperGridCards.ts` | Generates aggregation card DOM for header and intersection cells. Reads `count` from supergrid:query cell result. Optionally shows sum of numeric fields if available. Separate DOM generation function called from SuperGrid render. |
| `src/views/supergrid/SuperGridCalc.ts` | HyperFormula wrapper. `init()` loads HyperFormula and creates a named sheet mapped from supergrid cell data. `evaluate(formula, cellRef)` runs a formula. `destroy()` tears down the HyperFormula instance. Called from SuperGrid lifecycle. |
| `src/worker/handlers/supergrid.handler.ts` | Imports `buildSuperGridQuery` from `../../views/supergrid/SuperGridQuery`. Validates payload axes through the same `validateAxisField` calls already in `buildSuperGridQuery`. Runs SQL via `db.exec(sql, params)`. Returns `{ cells: result.rows }`. |

### Files That Are Explicitly Unchanged

| Component | Reason Unchanged |
|-----------|-----------------|
| `SuperStackHeader.ts` | Already handles 1–3 level tuple arrays, cardinality guard (MAX_LEAF_COLUMNS=50), collapsed sets. Zero changes needed. |
| `SuperGridQuery.ts` | SQL logic is correct. Only execution was missing (the handler). |
| `FilterProvider.ts` | SuperFilter calls the existing `addFilter()` API — no changes needed. |
| `SelectionProvider.ts` | SuperSelect calls the existing `selectAll([ids])` API — no changes needed. |
| `DensityProvider.ts` | SuperTime reads `getState().granularity` — no changes needed. |
| `StateCoordinator.ts` | `SuperPositionProvider` is Tier 3 and does NOT register with StateCoordinator. |
| `StateManager.ts` | Does not manage `SuperPositionProvider` (Tier 3). |
| `MutationManager.ts` | SuperGrid features do not mutate card data directly. |
| `QueryBuilder.ts` | SuperGrid bypasses QueryBuilder entirely and uses `bridge.superGridQuery()` directly. |
| All ETL files | No ETL changes in v3.0. |
| All Swift native files | No native shell changes in v3.0. |

---

## Suggested Build Order

Features form a clear dependency graph. Build in this order — each layer unblocks the next.

### Layer 0: Foundation (3 phases — strictly ordered)

**Phase 1 — PAFVProvider stacked axes**

Everything else depends on this. No Super* feature can be built until PAFVProvider exposes `colAxes`/`rowAxes`.

Build order:
1. Extend `PAFVState` interface with `colAxes`/`rowAxes`
2. Update `VIEW_DEFAULTS.supergrid` with defaults (`card_type` × `folder`)
3. Add `setColAxes()`, `setRowAxes()`, `getColAxes()`, `getRowAxes()` with allowlist validation
4. Update `isPAFVState` type guard
5. Update `toJSON()`/`setState()` for array round-trip
6. Update `PAFVProviderLike` in `views/types.ts`

TDD focus: `setColAxes` validates against allowlist; default state has correct axes; `toJSON`/`setState` round-trips arrays correctly; non-supergrid views unaffected.

**Phase 2 — SuperGridQuery Worker wiring**

Build order:
1. Add `'supergrid:query'` types to `protocol.ts`
2. Write `supergrid.handler.ts` (imports `buildSuperGridQuery`, runs SQL)
3. Register handler in `handlers/index.ts`
4. Add `superGridQuery()` method to `WorkerBridge`

TDD focus: valid axis config → grouped result rows; invalid field → SQL safety error thrown; empty result → `{ cells: [] }`.

**Phase 3 — SuperGrid dynamic axis reads**

Build order:
1. Rewrite `SuperGrid.ts` constructor to accept `PAFVProvider`-compatible
2. Replace hardcoded field constants with `pafv.getColAxes()`/`pafv.getRowAxes()`
3. Build `buildAxisTuples(cells, axes)` helper that extracts multi-level tuples
4. Replace in-memory card filter with `bridge.superGridQuery()` call
5. Update ViewManager to pass `pafv` to `SuperGrid` constructor

TDD focus: mock PAFVProvider with different axes → headers change; supergrid:query result → correct cells rendered; empty result → empty state.

### Layer 1: Core Interactivity (after Layer 0)

**Phase 4 — SuperDynamic** (axis drag-drop transpose)

Inline private method in `SuperGrid.ts`. HTML5 drag events on column/row headers. On drop: `pafv.setColAxes([...])` with reordered axes → StateCoordinator fires → re-render.

Dependencies: Layer 0 (PAFVProvider stacked axes, dynamic render).

**Phase 5 — SuperPosition + SuperZoom** (build together)

Create `SuperPositionProvider.ts` first (pure data, no DOM). Then `SuperGridZoom.ts` (attaches wheel/pinch events, writes to provider). Wire CSS transform in SuperGrid render loop.

Dependencies: Layer 0.

**Phase 6 — SuperSize** (resize — depends on SuperPosition for coordinate reference)

Create `SuperGridSizer.ts`. Pointer drag on header borders → column width map. SuperGrid reads widths and passes explicit px values to `buildGridTemplateColumns`.

Persistence decision: cell widths are Tier 2 (persist across sessions). Store in PAFVProvider state (add `colWidths: Record<string, number>` to PAFVState supergrid section) OR use a dedicated `ui_state` key via StateManager.

Dependencies: Phase 5 (SuperPosition for coordinate math).

**Phase 7 — SuperSelect** (lasso — depends on SuperPosition for cell bounding boxes)

Create `SuperGridSelect.ts`. SVG overlay on top of CSS Grid. Uses `SuperPositionProvider` cell bounding box map to compute which cells fall within lasso. Calls `SelectionProvider.selectAll()`.

Dependencies: Phase 5 (SuperPosition for bounding boxes).

### Layer 2: Data Features (after Layer 0; Layer 1 optional)

**Phase 8 — SuperDensity** (time hierarchy formatting)

Private method in `SuperGrid.ts`. When a colAxis or rowAxis field is a time field, reads `DensityProvider.getState().granularity` to format header labels (e.g., "2026-01" for month granularity).

Dependencies: Layer 0 only. DensityProvider is already wired to StateCoordinator.

**Phase 9 — SuperSort** (per-group sort direction toggle)

Private method. Click on column header toggles `colAxes[n].direction` via `pafv.setColAxes([...newAxes])`. The direction already flows into `buildSuperGridQuery` ORDER BY.

Dependencies: Layer 0 only.

**Phase 10 — SuperFilter** (auto-filter dropdowns)

Create `SuperGridFilter.ts`. Distinct column values come from the supergrid:query result (already available as `colKey`/`rowKey` arrays). Renders dropdown DOM anchored to column headers. On selection: `filterProvider.addFilter()`.

Dependencies: Phase 2 (supergrid:query result must be live).

**Phase 11 — SuperSearch** (FTS5 in-grid search)

Create `SuperGridSearch.ts`. Floating panel. Calls `bridge.searchCards(query)` (existing method). Highlights matching cells via CSS class. Does not trigger re-render.

Dependencies: Phase 2 (needs to know which card IDs are in which cells; reads from last query result).

### Layer 3: Computed Features (after Layers 0–2)

**Phase 12 — SuperCards** (aggregation card DOM)

Create `SuperGridCards.ts`. Reads `count` (and optionally sums of numeric fields) from supergrid:query cell data. Generates aggregation card DOM within each cell. Called from SuperGrid render.

Dependencies: Phase 2 (supergrid:query grouped result required).

**Phase 13 — SuperCalc + SuperAudit** (build together)

Create `SuperGridCalc.ts`. HyperFormula integration: `init()` creates a named sheet, `evaluate()` runs formulas, `destroy()` tears down. `SuperAudit` is a one-liner in render: add `.is-computed` class to cells whose values came from HyperFormula.

Dependencies: Phase 12 (cells must be rendered before formulas can reference them). HyperFormula must be installed as a dependency.

---

## Anti-Patterns

### Anti-Pattern 1: Storing Axis State Inside SuperGrid.ts

**What people do:** Add `private colAxes: AxisMapping[]` and `private rowAxes: AxisMapping[]` as fields of `SuperGrid.ts` instead of extending PAFVProvider.

**Why it's wrong:** Breaks view-family suspension (LATCH/GRAPH switch loses state). State cannot be persisted by StateManager. StateCoordinator cannot fire on axis changes. Axis state is orphaned on view destroy.

**Do this instead:** All axis state lives in PAFVProvider, following the established pattern for every other view's axis configuration.

### Anti-Pattern 2: Keeping In-Memory Card Filtering After Foundation Wiring

**What people do:** Continue using `cards.filter(c => String(c[field]) === colVal)` in SuperGrid render after the supergrid:query Worker handler exists.

**Why it's wrong:** In-memory filtering cannot produce aggregate values (COUNT, SUM). SuperCards, SuperCalc, SuperFilter all require grouped result rows — they cannot work with flat card arrays. Performance degrades at 10K+ cards.

**Do this instead:** After Phase 2 (Worker wiring), SuperGrid always fetches grouped data via `bridge.superGridQuery()`. The flat cards array is gone from SuperGrid's render path entirely.

### Anti-Pattern 3: Re-querying the Worker on Every Scroll Event

**What people do:** Call `bridge.superGridQuery()` inside the scroll/wheel event handler for SuperZoom.

**Why it's wrong:** Scroll is a viewport navigation concern — data does not change. Worker queries during scroll cause visible lag and break the 16ms render budget.

**Do this instead:** SuperZoom applies `transform: translate(x,y)` to `.supergrid-container` via CSS. `position: sticky` on header row/column handles pinning. No SQL, no Worker message, no re-render.

### Anti-Pattern 4: Registering SuperPositionProvider with StateCoordinator

**What people do:** Register `SuperPositionProvider` with `StateCoordinator.registerProvider()` because it follows the provider pattern.

**Why it's wrong:** SuperPosition is Tier 3 ephemeral (scroll offsets and bounding boxes reset on view destroy). Registration would cause full grid re-renders on every scroll event — catastrophic performance (60fps scrolling = 60 supergrid:query calls per second).

**Do this instead:** `SuperPositionProvider` follows `SelectionProvider`'s exact pattern: its own `subscribe()`/`notify()` for direct consumers (SuperGridZoom, SuperGridSelect), never registered with StateCoordinator, never persisted by StateManager.

### Anti-Pattern 5: Running HyperFormula in the Worker

**What people do:** Send formula strings to the Worker for HyperFormula evaluation, treating it like a database query.

**Why it's wrong:** HyperFormula is a main-thread JavaScript library designed for in-browser use. It has no Worker-compatible build. Moving it to the Worker adds bundle complexity with no benefit — formula evaluation over a small cell set (≤50×50) completes in microseconds on the main thread.

**Do this instead:** HyperFormula runs on the main thread in `SuperGridCalc.ts`. It receives data from the `supergrid:query` response (already on main thread). Only card data access uses the Worker.

---

## Scaling Considerations

SuperGrid's cell count is bounded by `MAX_LEAF_COLUMNS = 50` (per axis dimension), so the grid is at most 50×50 = 2,500 cells regardless of card count. Performance is determined by SQL aggregation speed and DOM cell count, not card count.

| Card Count | Architecture Adjustments |
|------------|--------------------------|
| <1K cards | Current architecture handles comfortably. No changes. |
| 1K–10K cards | `supergrid:query` GROUP BY is fast (sql.js handles in <100ms). Cell DOM count bounded at 2,500. No changes needed. |
| 10K–100K cards | Consider lazy card expansion within cells (load cards on cell click, not on grid render). Each cell shows count badge only; expanding triggers a separate `db:query` for that cell's cards. |
| 100K+ cards | Out of scope for sql.js WASM in the current architecture. Would require DuckDB or server-side aggregation. Deferred per project constraints. |

### Scaling Priorities

1. **First bottleneck:** A single cell with 5K+ cards expanded. Fix: lazy-load cards within a cell on expand — one `db:query` per cell, not on grid render.
2. **Second bottleneck:** SuperCalc with formula chains over many cells. Fix: HyperFormula's built-in dependency graph and lazy evaluation handles this; limit formula input to header cells (not data cells).

---

## Sources

- Direct inspection: `src/views/SuperGrid.ts` (341 LOC) — confirmed hardcoded `DEFAULT_COL_FIELD = 'card_type'` / `DEFAULT_ROW_FIELD = 'folder'`; in-memory card filtering; no PAFVProvider reference
- Direct inspection: `src/views/supergrid/SuperGridQuery.ts` (110 LOC) — confirmed correct SQL; confirmed "NOT imported by SuperGrid.ts in this plan" comment; confirmed dead code status
- Direct inspection: `src/providers/PAFVProvider.ts` — confirmed single `xAxis`/`yAxis`/`groupBy` only; no stacked arrays; `VIEW_DEFAULTS.supergrid` has all-null axes
- Direct inspection: `src/views/supergrid/SuperStackHeader.ts` (264 LOC) — confirmed already handles 1–3 level tuples via `depth = guardedValues[0]?.length`; confirmed `MAX_LEAF_COLUMNS = 50` cardinality guard
- Direct inspection: `src/worker/protocol.ts` — confirmed `'supergrid:query'` absent from `WorkerRequestType` union
- Direct inspection: `src/views/ViewManager.ts` — confirmed `_fetchAndRender()` uses `queryBuilder.buildCardQuery()`; not supergrid-aware
- Direct inspection: `src/providers/SelectionProvider.ts` — confirmed Tier 3 pattern for SuperPositionProvider design
- Direct inspection: `src/providers/StateCoordinator.ts` — confirmed setTimeout(16) batching; confirmed Tier 3 providers must not register here
- Direct inspection: `src/providers/allowlist.ts` + `src/providers/types.ts` — confirmed `AxisField` union covers all card fields needed; no allowlist additions required for existing axes
- Direct inspection: `src/providers/QueryBuilder.ts` — confirmed SuperGrid must bypass QueryBuilder (GROUP BY semantics incompatible with generic buildCardQuery)
- `.planning/PROJECT.md` — confirmed v3.0 milestone scope: 14 features (13 remaining + foundation); confirmed stacked axes requirement; confirmed SuperGridQuery is dead code

---

*Architecture research for: Isometry v3.0 SuperGrid Complete — Super* feature integration*
*Researched: 2026-03-03*
