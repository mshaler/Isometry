# SuperSilkScreen
## Architecture Handoff — v5.0 Feature Design
### Status: Speculative Design / Pre-Implementation Spike

---

## Naming Rationale

**SuperSilkScreen** follows Isometry's Super* naming convention (SuperGrid, SuperSort, SuperFilter, SuperSearch, SuperTime, SuperCards) and carries a precise metaphor earned by the architecture.

Silk screen printing is the process of pushing ink through a stencil mesh onto a substrate — each color on a separate screen, each screen registered to the same physical coordinate frame. The final image emerges from the *accumulation of layers*: each transparent, each positionally exact, each independently composed but collectively coherent.

This is the architecture exactly:

- **SuperGrid is the substrate** — the registration frame everything else aligns to
- **Each visualization layer is a screen** — transparent, independently rendered, pulled across the same coordinate frame
- **The geometry broadcast contract is the registration system** — the pins that keep every screen in perfect alignment as the frame shifts
- **The final composed view is the print** — rich, layered, intentional, and unlike anything you can produce by stacking independent charts

The name also carries the right user-facing connotation. A silk screen print *looks* like a single coherent image even though it's built from independent layers. That's exactly what SuperSilkScreen delivers to users: a single visualization that feels unified but is actually a live, filterable, reorderable composition of data, charts, graphs, and narrative — all breathing together.

One more resonance: silk screening is a *craft*. It rewards care and intentionality. So does building a good SuperSilkScreen composition. Projection Explorer is the compositing studio.

---

## Overview

SuperGrid is not merely a table renderer. It is a **scene graph compositor** — a z-axis coordinate frame that broadcasts spatial authority to every layer above it. SuperSilkScreen is the feature that makes this compositor fully first-class: named, designed, and surfaced to users through Projection Explorer's z-plane drop zone.

This document specifies the z-stack architecture, the geometry broadcast contract, the Projection Explorer z-plane drop zone, and the per-layer response semantics for geometry mutation events (collapse, resize, reorder).

This work is scoped as a **future milestone (v5.0)**. It is captured now as a design handoff so that the geometry broadcast API and layer compositor architecture are fully specified before implementation begins.

---

## The Core Insight: z=0 is the Spatial Authority

Every SuperSilkScreen layer inherits its coordinate frame from the SuperGrid beneath it. Column widths, row heights, header collapse state, scroll position, zoom level — these are not properties of individual charts. They are **events broadcast upward by z=0**.

```
z=4  ┌─────────────────────────────────────────────┐
     │  Mermaid / Narrative Annotation Layer        │  Human interpretation, anchored to grid coords
     └─────────────────────────────────────────────┘
z=3  ┌─────────────────────────────────────────────┐
     │  Force Graph / Sankey Layer                  │  Connectivity + flow, nodes positioned by column
     └─────────────────────────────────────────────┘
z=2  ┌─────────────────────────────────────────────┐
     │  D3 Chart Layer                              │  Stacked area / bar — shares column/row geometry
     └─────────────────────────────────────────────┘
z=1  ┌─────────────────────────────────────────────┐
     │  Audit Overlay Layer                         │  Value provenance, delta highlighting
     └─────────────────────────────────────────────┘
z=0  ┌─────────────────────────────────────────────┐
     │  SuperGrid (CSS Grid + Card Content)         │  THE CANONICAL COORDINATE FRAME
     └─────────────────────────────────────────────┘
```

> **Why cards stay at z=0:** In the current SuperGrid implementation, card content is rendered
> directly inside CSS Grid cells via D3 data join. Cards are not a separate layer — they are
> integral to `_renderCells()`. Extracting card rendering to a distinct z-index would require
> splitting the data join, rethinking density/selection/count-badge interactions across the z
> boundary, and fundamentally altering SuperGrid's render pipeline. This refactor is a future
> option (v5.1+), not a v5.0 requirement. SuperSilkScreen's overlay layers start at z=1.

**The anti-pattern to avoid:** conventional BI tools stack independent charts that *look* aligned. Isometry makes alignment *structural* — layers share a spatial contract enforced by the geometry broadcast system. A D3 chart at z=2 does not own its x-axis. SuperGrid does. D3 listens.

---

## Layer Definitions

### z=0 — SuperGrid + Card Content (Canonical Frame)
- CSS Grid tabular layout with card content rendered inside cells via D3 data join
- Owns: column widths, row heights, header collapse state, scroll position, zoom
- Card density scales with zoom: at 100% zoom one card per cell; as zoom decreases, cards compress to summary chips
- Responsibility: emit `GeometryEvent` on any spatial mutation
- Receives: nothing (source of truth only)
- Locked: cannot be hidden, removed, or reordered in SuperSilkScreen composer
- Note: selection is managed separately via `SuperGridSelectionLike` — layers needing selection awareness subscribe there, not through the geometry broadcaster

### z=1 — Audit Overlay
- Semi-transparent layer surfacing calculated value provenance
- Red/green delta indicators, formula source highlighting, dependency arrows
- Responds to geometry: overlay elements reposition to match cell bounds
- Blend mode: `multiply` at configurable opacity (default 40%)
- Use case: "show me why this cell has this value"
- Note: builds on the existing `AuditState` infrastructure shipped in v4.1 Phase 37

### z=2 — D3 Chart Layer
- Stacked area, grouped bar, line — any chart whose x-axis maps to SuperGrid columns
- **Shares column geometry exactly**: chart x-axis tick positions = SuperGrid column center-x values
- Responds to geometry: x-axis compresses/expands live as columns resize; series animate
- Does NOT own its scales — scales are derived from SuperGrid column positions
- D3 transition duration: match SuperGrid column resize animation timing

### z=3 — Graph / Sankey Layer
- Force-directed network or Sankey flow diagram
- Node x-positions are pinned to column centers; y-positions are free (force simulation)
- Sankey source/target lanes align to column boundaries
- Responds to geometry: re-runs layout with updated column pin positions
- Use case: product lineage, revenue flow between categories over time

### z=4 — Narrative / Mermaid Layer
- Mermaid diagram or free annotation layer
- Annotations are anchored to grid coordinates (column index, row index)
- Responds to geometry: anchor points translate with column/row movements
- Use case: "revenue growth inflection at Q3 2024 — see node B → C transition"

---

## Geometry Broadcast Contract

The `GeometryBroadcast` API will be wired into SuperGrid as the **first implementation sprint** — emitting on all triggers, but with zero layer consumers initially. When SuperSilkScreen layers arrive in subsequent sprints, SuperGrid doesn't change. It's already broadcasting.

### GeometryEvent (TypeScript interface)

```typescript
// src/views/supergrid/GeometryBroadcast.ts

export type GeometryEventType =
  | 'column-resize'
  | 'column-collapse'
  | 'column-expand'
  | 'row-resize'
  | 'row-collapse'
  | 'row-expand'
  | 'scroll'
  | 'zoom'
  | 'full-reflow';

export interface ColumnGeometry {
  key: string;           // Column header key
  index: number;         // Visual order index
  x: number;            // Left edge px (relative to grid viewport)
  width: number;         // Width px
  centerX: number;       // Center px (chart tick anchor)
  collapsed: boolean;
  visible: boolean;      // true if within scroll viewport (for virtualizer-aware layers)
  depth: number;         // Nesting depth in hierarchy
}

export interface RowGeometry {
  key: string;
  index: number;
  y: number;
  height: number;
  centerY: number;
  collapsed: boolean;
  visible: boolean;      // true if within scroll viewport
  depth: number;
}

export interface GeometrySnapshot {
  columns: ColumnGeometry[];
  rows: RowGeometry[];
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  zoom: number;          // 0.5–2.0, default 1.0
  timestamp: number;
}

export interface GeometryEvent {
  type: GeometryEventType;
  snapshot: GeometrySnapshot;
  committed: boolean;             // true = final position (mouseup); false = in-progress (drag)
  delta?: Partial<GeometrySnapshot>;  // What changed (for diff-aware listeners)
}

export type GeometryListener = (event: GeometryEvent) => void;

export interface GeometryBroadcaster {
  subscribe(listener: GeometryListener): () => void;   // Returns unsubscribe fn
  getSnapshot(): GeometrySnapshot;
  emit(event: GeometryEvent): void;
}
```

### Broadcaster Error Isolation

The `GeometryBroadcastChannel` wraps each listener invocation in a `try/catch`. If a listener throws:

1. The error is logged to `console.error` with the listener's layer identifier.
2. Emission continues to the next listener — one broken layer never blocks others.
3. A listener that throws **3 consecutive times** is automatically unsubscribed with a `console.warn` indicating the layer was ejected. The layer's `LayerChip.visible` is set to `false` in the compositor.

This ensures a buggy layer degrades gracefully without taking down the entire compositor.

### Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| GeometryEvent dispatch + all layer responses | <= 8ms | `performance.now()` around `emit()` loop, for <= 4 active layers |
| Full-reflow with data re-query | <= 16ms (one frame at 60fps) | End-to-end from SuperGrid query completion to last layer render |
| Layer add/remove | <= 100ms | Including DOM setup, broadcaster subscription, initial render |
| Scroll event propagation | <= 4ms | Scroll is the hottest path — must not jank |

Tests should assert these budgets in CI with a synthetic 100-column, 50-row dataset.

### SuperGrid Emission Points

SuperGrid must emit `GeometryEvent` at these moments:

| Trigger | Event Type | `committed` | Notes |
|---------|-----------|-------------|-------|
| Column drag-resize ends | `column-resize` | `true` | Final position — layers may run expensive re-layouts |
| Column drag-resize in progress | `column-resize` | `false` | Throttled to 16ms (60fps) — layers should only update visuals, not re-simulate |
| Column collapse toggle | `column-collapse` / `column-expand` | `true` | Immediate |
| Row collapse toggle | `row-collapse` / `row-expand` | `true` | Immediate |
| Scroll | `scroll` | `false` | Throttled to 16ms |
| Zoom change | `zoom` | `true` | Immediate |
| Filter/sort changes visible rows | `full-reflow` | `true` | Row geometry fully recomputed |
| Initial mount | `full-reflow` | `true` | Layers initialize from first snapshot |

### Implementation Sketch for SuperGrid.ts

> **Note:** This sketch targets the actual SuperGrid class internals (as of v4.1).
> Column widths live in `SuperGridSizer._colWidths`. Cell bounding boxes live in
> `SuperGridBBoxCache`. Row/column keys are derived from `_lastCells` + `_lastColAxes` /
> `_lastRowAxes` via the `keys.ts` module. Zoom is accessed through `_positionProvider.zoomLevel`.
> The grid container element is `_gridEl` (inside `_rootEl`).

```typescript
// In SuperGrid.ts — add to existing class alongside _sizer, _bboxCache, etc.

private _geometryBroadcaster: GeometryBroadcastChannel;

private _computeGeometrySnapshot(): GeometrySnapshot {
  const gridEl = this._gridEl!;

  // Derive visible leaf column keys from last render's cells + axes
  // (same derivation used by SuperGridSizer.setLeafColKeys)
  const leafColKeys = this._deriveLeafColKeys(this._lastCells, this._lastColAxes);

  const columns: ColumnGeometry[] = leafColKeys.map((key, i) => {
    // _sizer._colWidths is the source of truth for base px widths;
    // actual DOM rects come from BBoxCache or direct header element query
    const headerEl = gridEl.querySelector(`[data-col-key="${CSS.escape(key)}"]`);
    const rect = headerEl?.getBoundingClientRect() ?? { x: 0, width: 0 };
    const baseWidth = this._sizer.getWidth(key);
    return {
      key,
      index: i,
      x: rect.x - gridEl.getBoundingClientRect().x,
      width: baseWidth * this._positionProvider.zoomLevel,
      centerX: (rect.x - gridEl.getBoundingClientRect().x) + (baseWidth * this._positionProvider.zoomLevel) / 2,
      collapsed: this._collapsedSet.has(key),
      depth: this._lastColAxes.length,
    };
  });

  // Derive visible row keys from last render's cells + axes
  const leafRowKeys = this._deriveLeafRowKeys(this._lastCells, this._lastRowAxes);

  const rows: RowGeometry[] = leafRowKeys.map((key, i) => {
    const rowEl = gridEl.querySelector(`[data-row-key="${CSS.escape(key)}"]`);
    const rect = rowEl?.getBoundingClientRect() ?? { x: 0, y: 0, width: 0, height: 0 };
    return {
      key,
      index: i,
      y: rect.y - gridEl.getBoundingClientRect().y,
      height: rect.height,
      centerY: (rect.y - gridEl.getBoundingClientRect().y) + rect.height / 2,
      collapsed: this._collapsedSet.has(key),
      depth: this._lastRowAxes.length,
    };
  });

  return {
    columns,
    rows,
    viewportWidth: gridEl.clientWidth,
    viewportHeight: gridEl.clientHeight,
    scrollX: gridEl.scrollLeft,
    scrollY: gridEl.scrollTop,
    zoom: this._positionProvider.zoomLevel,
    timestamp: performance.now(),
  };
}

private _emitGeometry(type: GeometryEventType, committed = true): void {
  const snapshot = this._computeGeometrySnapshot();
  this._geometryBroadcaster.emit({ type, snapshot, committed });
}
```

---

## Per-Layer Geometry Response Semantics

When SuperGrid emits a `GeometryEvent`, each SuperSilkScreen layer responds according to its own contract. **Layers do not negotiate with each other** — they each listen to z=0 independently. Layers are siblings, not parent/child.

### Column Collapse Response Matrix

| Layer | Response to `column-collapse` |
|-------|-----------------------------|
| z=0 SuperGrid | Card content reflows to collapsed width (chip mode if < 40px); emits `GeometryEvent` |
| z=1 Audit Overlay | Overlay element hides; dependency arrows reroute around gap |
| z=2 D3 Chart | **Configuration-dependent** (see collapseMode below) |
| z=3 Graph/Sankey | Column pin removed; force simulation relaxes; Sankey lane removed |
| z=4 Mermaid | Annotations anchored to collapsed column translate to its collapsed x position |

### D3 Chart Layer — Collapse Behavior (collapseMode)

When a column is collapsed, the D3 chart at z=2 responds according to its `collapseMode` setting, configurable per-layer in Projection Explorer:

```typescript
type ChartCollapseMode =
  | 'compress'    // Axis compresses — column becomes zero-width on chart x-axis
  | 'remove'      // Series removed from chart entirely
  | 'aggregate';  // Series values merged into nearest visible neighbor (see rules below)
```

**Aggregate rules:**
- Collapsed column's values merge into the **nearest visible neighbor to the LEFT**. If no left neighbor exists, merge RIGHT.
- Multiple consecutive collapsed columns all merge into the **same edge neighbor** (not cascading).
- Merge operation: **SUM** for numeric series, **COUNT** for categorical series.
- The receiving column's label remains unchanged; a subtle badge (e.g., "+3") indicates how many collapsed columns contributed.
- Note: this is structurally similar to SuperStack's `aggregate` collapse mode at z=0 (count badge + summary cells), but applied to chart series values rather than grid cells.

Default `collapseMode` by chart type:

| Chart Type | Default collapseMode | Rationale |
|-----------|---------------------|-----------|
| Stacked area | `compress` | Continuity of area shape is meaningful |
| Grouped bar | `remove` | Missing bar is visually clean |
| Line | `compress` | Line continuity preserved |
| Scatter | `remove` | Points have no interpolation |

Users override per-layer in Projection Explorer's layer detail panel.

---

## Projection Explorer — Z-Plane Drop Zone

### Current State (v4.1)
Projection Explorer has drop zones for:
- **x-plane**: Column axis facet assignment
- **y-plane**: Row axis facet assignment

### SuperSilkScreen Addition (v5.0)
A **z-plane drop zone** column is added to Projection Explorer. It follows identical drag-and-drop UX grammar as x/y zones — same chip design, same drag affordances, same feel. The z-plane drop zone *is* the SuperSilkScreen composer.

```
┌─────────────────────────────────────────────────────────────────┐
│  Projection Explorer                                             │
├──────────────┬──────────────┬──────────────────────────────────┤
│   x-plane    │   y-plane    │   z-plane  ◈ SuperSilkScreen     │
├──────────────┼──────────────┼──────────────────────────────────┤
│  [Product]   │  [Quarter]   │  z=4 ░░ Mermaid: growth notes    │
│  [Region]    │  [Status]    │  z=3 ░░ Sankey: product lineage  │
│              │              │  z=2 ░░ D3: revenue area chart   │
│              │              │  z=1 ░░ Audit: delta overlay     │
│              │              │  z=0 ░░ SuperGrid (locked)       │
│              │              │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│              │              │  [ + Add Layer ]                  │
└──────────────┴──────────────┴──────────────────────────────────┘
```

### Z-Plane Drop Zone UX Behaviors

**Reorder:** Drag a layer chip up/down to change z-index. Layers animate to new positions. SuperGrid (z=0) is locked and cannot be reordered.

**Visibility toggle:** Click the `░░` icon on any layer chip to toggle visibility (eye open/closed). Layer is hidden but remains subscribed to geometry events — it snaps back to correct position when re-shown.

**Opacity slider:** Long-press or right-click a layer chip to reveal an opacity slider (0-100%). Particularly powerful for Audit overlay — 40% opacity lets you see both values and their provenance simultaneously. That's an epistemic control, not just an aesthetic one.

**Collapse mode picker:** For D3 Chart layers, a `collapseMode` selector appears in the layer detail panel (compress / remove / aggregate).

**Add Layer:** The `[ + Add Layer ]` button opens a layer type picker:
- D3 Chart (area, bar, line, scatter)
- Force Graph
- Sankey
- Audit Overlay
- Mermaid / Annotation

**Remove Layer:** Drag a layer chip out of the drop zone (off the right edge) to remove it. z=0 (SuperGrid) cannot be removed.

### Layer Chip Component

```typescript
interface LayerChip {
  zIndex: number;           // Integer — rebalanced on insertion (see note below)
  layerType: 'supergrid' | 'audit' | 'd3-chart' | 'graph' | 'sankey' | 'mermaid';
  label: string;            // e.g. "Revenue Area Chart"
  visible: boolean;
  opacity: number;          // 0-1
  locked: boolean;          // true for z=0 only
  config: LayerConfig;      // type-specific configuration
}
```

> **z-index strategy:** Layer z-indices are integers. When a layer is inserted between
> existing layers, all layers above the insertion point are incremented by 1. This avoids
> the precision drift of float z-indices after many insertions and keeps serialization clean.
> The `LayerChip[]` array order IS the render order — `zIndex` is derived from array position.

---

## The Living Visualization Principle

A PowerPoint chart is a fossil — a screenshot of data at one moment in time. A SuperSilkScreen composition is **alive**. When the user changes a filter in Projection Explorer, the geometry event cascade propagates upward through every screen simultaneously:

1. SuperGrid re-queries SQLite → new visible rows/columns
2. SuperGrid emits `full-reflow` with updated `GeometrySnapshot`
3. D3 chart re-binds data, animates x-axis to new column positions
4. Sankey layer re-runs layout with updated column pins
5. Mermaid annotations slide to updated anchor coordinates

The chain from **data → pattern → story** lives in a single composited view. Each layer is a different lens on the same underlying truth. SuperSilkScreen makes it possible to hold multiple lenses simultaneously — and to see them all change together when the truth changes.

This is what "visualization is the gateway to insight" means in practice.

---

## Implementation Sequence (v5.0 Sprint Order)

### Sprint 0: Geometry Broadcast Infrastructure
- [ ] Define `GeometryEvent`, `GeometrySnapshot`, `GeometryBroadcaster` interfaces in `src/views/supergrid/GeometryBroadcast.ts`
- [ ] Implement `GeometryBroadcastChannel` class (subscribe/emit/getSnapshot with error isolation — see contract below)
- [ ] Wire emission points into `SuperGrid.ts` (resize, collapse, scroll, zoom, full-reflow)
- [ ] Unit tests: verify emission on each trigger; verify snapshot accuracy
- [ ] **No layer consumers in Sprint 0** — API only, zero callers

### Sprint 1: Audit Overlay Layer (z=1)
- [ ] Implement `AuditOverlayLayer` class subscribing to geometry broadcaster
- [ ] Extend existing `AuditState` (v4.1 Phase 37) with geometry-aware overlay positioning from `GeometrySnapshot`
- [ ] Opacity blend mode rendering (`multiply`, configurable)
- [ ] Projection Explorer: visibility + opacity controls for audit layer

### Sprint 2: D3 Chart Layer (z=2)
- [ ] Implement `D3ChartLayer` class with geometry subscription
- [ ] Column geometry → D3 scale derivation (no independent scale ownership)
- [ ] Animate x-axis on `column-resize` events (match SuperGrid timing); only re-layout on `committed: true`
- [ ] Implement `collapseMode`: compress / remove / aggregate
- [ ] Projection Explorer: add D3 chart layer, collapseMode picker

### Sprint 3: Graph / Sankey Layer (z=3)
- [ ] Implement `GraphLayer` and `SankeyLayer` with geometry subscription
- [ ] Column pin positions for force simulation and Sankey lanes
- [ ] Debounce `full-reflow` by 150ms before triggering simulation re-layout; only re-simulate on `committed: true`
- [ ] Re-layout on `column-collapse` / `full-reflow`

### Sprint 4: Mermaid / Annotation Layer (z=4)
- [ ] Implement `MermaidLayer` with grid-coordinate anchor system
- [ ] Annotation translate on geometry events
- [ ] Anchor persistence: annotations save `{ columnKey, rowKey }` not pixel coordinates

### Sprint 5: Projection Explorer Z-Plane Drop Zone
- [ ] `LayerChip` component with drag-to-reorder (integer z-index with rebalancing)
- [ ] Visibility toggle (eye icon), opacity slider (long-press / right-click)
- [ ] `collapseMode` picker in D3 layer detail panel
- [ ] `[ + Add Layer ]` picker modal with layer type icons
- [ ] Layer remove (drag off right edge); guard z=0 from removal

---

## Guards and Anti-Patterns

**NEVER** let a SuperSilkScreen layer own its own x-axis scale independently of SuperGrid. If a D3 chart computes `d3.scaleBand()` from its own data range rather than from `GeometrySnapshot.columns`, it will drift from the grid on any resize. The column geometry from `GeometrySnapshot` is the *only* valid source for x-axis positions.

**NEVER** have layers communicate with each other directly. All spatial coordination flows through z=0's `GeometryBroadcaster`. Layers are siblings, not parent/child. If you find yourself writing `layer2.notifyLayer3()`, stop — that belongs in the broadcaster.

**NEVER** run force simulation on every `GeometryEvent`. Only re-simulate on `committed: true` events, debounced by 150ms. Events with `committed: false` (scroll, in-progress resize) should update pin positions visually — no simulation re-run.

**NEVER** add z-stack or layer-management logic to `SuperGrid.ts` itself. SuperGrid's only SuperSilkScreen responsibility is emitting `GeometryEvent`. Layer rendering, compositor management, and z-ordering live in `src/views/layers/` and `LayerCompositor.ts`.

**NEVER** store annotation anchor coordinates as pixel values. Mermaid/annotation anchors must be stored as `{ columnKey, rowKey }` and resolved to pixel coordinates at render time from the current `GeometrySnapshot`. Pixel coordinates become stale the moment a column resizes.

---

## File Structure (v5.0)

```
src/views/
├── SuperGrid.ts                        ← emits GeometryEvents
├── supergrid/
│   ├── GeometryBroadcast.ts            ← interfaces + GeometryBroadcastChannel
│   │                                      (co-located with emitter, not consumers)
│   └── ... (existing submodules: keys.ts, SortState.ts, SuperGridSizer.ts, etc.)
└── layers/
    ├── AuditOverlayLayer.ts            ← z=1
    ├── D3ChartLayer.ts                 ← z=2
    ├── GraphLayer.ts                   ← z=3
    ├── SankeyLayer.ts                  ← z=3 (variant)
    ├── MermaidLayer.ts                 ← z=4
    └── LayerCompositor.ts              ← manages z-stack, wires broadcaster to all layers
```

---

## Success Criteria

- Column resize at z=0 causes D3 chart (z=2) x-axis to animate in sync, within one animation frame
- Column collapse with `collapseMode: 'compress'` smoothly shrinks chart series; no axis drift
- Reordering layers in z-plane drop zone updates render order immediately, no flash
- Force graph (z=3) does not re-simulate on `committed: false` events (scroll, in-progress resize)
- Audit overlay (z=1) opacity slider updates in real time with no layout recalculation
- `GeometryBroadcaster` has zero knowledge of any specific layer type — pure event bus with error isolation
- Mermaid annotation (z=4) anchored to "Q3" column stays anchored after column reorder
- Removing a D3 chart layer from the composer fully unsubscribes its geometry listener (no memory leak)
- GeometryEvent dispatch + all layer responses completes within 8ms for <= 4 active layers
- A layer that throws 3 consecutive times is auto-ejected without affecting other layers

---

## Open Questions

1. **Scroll virtualization and z-layers** *(resolved)*: SuperGrid uses data-windowing virtual scrolling (v4.1 Phase 38). `GeometrySnapshot.columns` includes **ALL columns** (visible and off-screen) with a `visible: boolean` flag on each `ColumnGeometry`. Chart layers (z=2) use the full column array for scale domain construction, then render only the visible subset. Layers that only care about visible geometry (e.g., Audit overlay at z=1) filter on `visible === true`. This preserves D3 scale continuity for area/line charts while keeping overlay layers efficient.

2. **Multiple D3 layers** *(resolved)*: Yes — a user can add multiple D3 chart layers (e.g., area chart at z=2, scatter at z=2+1 after rebalancing). Each layer gets its own subscription to the same broadcaster. The `LayerChip[]` array order determines render order; integer z-indices are rebalanced on insertion.

3. **Print / export**: When exporting to PDF or image, all visible layers must be composited at their correct z-positions. This requires a `renderToCanvas()` method on each layer type. Defer to post-v5.0 unless print is a stated v5.0 requirement.

4. **Mobile / performance**: Force simulation and Sankey at z=3 may be too expensive on lower-powered devices. **Runtime guard:** if the first geometry-event → full-layer-render cycle exceeds 32ms, disable z=3+ layers automatically and show a capability notice. Users can re-enable via Settings with a "heavy layers may affect scrolling performance" warning. This is a runtime capability check, not a version gate (project targets iOS 17+).

5. **Layer presets / templates**: Power users will want to save SuperSilkScreen compositions (e.g., "Revenue Dashboard" = SuperGrid + Audit + Area Chart + Sankey). A `LayerPreset` save/load mechanism belongs in v5.1 or later but the `LayerChip[]` array should be serializable from day one.

---

*Feature name: SuperSilkScreen*
*Prepared by: Claude (architect's office) + Michael Shaler*
*For: Claude Code execution, v5.0 planning*
*Prerequisite: v4.1 Sync + Audit complete*
*Implementation: v5.0 milestone — Sprints 0 through 5*
