# SuperGrid MVP Gap Analysis

**Date:** February 12, 2026  
**Analyst:** Claude (in consultation with Michael Shaler)  
**Version:** 1.0

---

## Executive Summary

This document provides a comprehensive gap analysis between the SuperGrid specification (from `specs/SuperGrid-Specification.md`) and the current implementation across `src/d3/SuperGridEngine/`, `src/components/supergrid/`, and related modules.

### Overall Assessment

| Category | Spec Features | Implemented | Gap | MVP Ready |
|----------|---------------|-------------|-----|-----------|
| **Core Grid Rendering** | 5 | 4 | 1 | 🟡 80% |
| **SuperStack Headers** | 8 | 2 | 6 | 🔴 25% |
| **SuperDynamic Axis** | 5 | 1 | 4 | 🔴 20% |
| **SuperDensity (Janus)** | 6 | 2 | 4 | 🟡 33% |
| **SuperZoom Navigation** | 5 | 2 | 3 | 🟡 40% |
| **SuperSelect** | 6 | 4 | 2 | 🟢 67% |
| **SuperPosition** | 4 | 1 | 3 | 🔴 25% |
| **Header Click Zones** | 12 | 2 | 10 | 🔴 17% |
| **View Transitions** | 6 | 2 | 4 | 🟡 33% |
| **Performance** | 10 | 5 | 5 | 🟡 50% |

**Legend:** 🟢 >60% complete | 🟡 30-60% complete | 🔴 <30% complete

---

## 1. Core Grid Rendering

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **2D Grid Cell Rendering** | `SuperGridEngine/Renderer.ts` | Working - renders cells at grid positions |
| **sql.js → D3 Data Pipeline** | `SuperGridEngine/DataManager.ts` | Working - `executeGridQuery()` with direct SQL |
| **Cell Click Events** | `SuperGridEngine/Renderer.ts` | Working - `onCellClick` callback wired |
| **Basic Header Rendering** | `SuperGridEngine/HeaderManager.ts` | Partial - single-level only |

### ❌ Gaps

| Feature | Spec Requirement | Gap Analysis |
|---------|------------------|--------------|
| **PAFV Axis Mapping UI** | "Any axis maps to any plane" via `PAFVConfiguration` | `setAxisMapping()` exists but no UI; `pafvConfig` initialized with defaults but React controls not wired |

### 📋 MVP Actions

1. **Wire PAFV controls in React** - Expose axis mapping to UI controls (dropdown or drag-drop)
2. **Verify sql.js integration end-to-end** - Test with real alto-index data

---

## 2. SuperStack — Nested Headers (Critical Gap)

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **Single-level Headers** | `HeaderManager.ts:generateHeaderTree()` | Working - extracts unique values, creates flat headers |
| **Header Position Calculation** | `HeaderManager.ts` | Working - positions at gridX/gridY × dimensions |

### ❌ Gaps (Major)

| Feature | Spec Requirement | Current State |
|---------|------------------|---------------|
| **Multi-level Nested Headers** | "2+ levels with visual spanning" | Only single level (`maxColumnLevels: 1`, `maxRowLevels: 1` hardcoded) |
| **Visual Span Calculation** | "Parent headers group children with merged boundaries" | No span merging logic |
| **Expand/Collapse State** | "Morphing boundary animations on collapse/expand" | State exists (`progressiveState.collapsedHeaders`) but not wired to rendering |
| **Automatic Grouping** | "When depth exceeds threshold, semantic grouping" | No implementation |
| **Progressive Disclosure** | "Level picker tabs + zoom controls" | Types defined, no UI |
| **Context Menu** | "Expand All / Collapse All via right-click" | Not implemented |

### 📊 Code Evidence

```typescript
// HeaderManager.ts - Currently returns flat structure
generateHeaderTree(): HeaderTree {
  // ...
  return {
    columns,
    rows,
    maxColumnLevels: 1,  // ← HARDCODED to single level
    maxRowLevels: 1      // ← HARDCODED to single level
  };
}
```

### 📋 MVP Actions

1. **Implement multi-level header generation** - Build hierarchy tree from nested axis values
2. **Calculate visual spans** - Parent header width = sum of child widths
3. **Render nested headers in SVG** - Multiple header rows/columns with proper offsets
4. **Wire collapse/expand** - Click parent header → toggle children visibility
5. **Add progressive disclosure tabs** - UI control to select visible depth

---

## 3. SuperDynamic — Axis Repositioning (Critical Gap)

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **PAFV State Structure** | `types.ts:PAFVConfiguration` | Defined - `xMapping`, `yMapping`, `zMapping` |

### ❌ Gaps (Major)

| Feature | Spec Requirement | Current State |
|---------|------------------|---------------|
| **Drag-Drop Axis Reordering** | "Grab column header → drag to row header area" | Not implemented |
| **MiniNav Staging Area** | "Staging area for axes being repositioned" | Not implemented |
| **Drop Zone Highlighting** | "Visual cues during drag: ghost header, insertion indicator" | Not implemented |
| **Grid Reflow Animation** | "Grid reflows with D3 transition after drop" | `render()` exists but no transition on axis change |

### 📊 Code Evidence

```typescript
// Types exist in dynamic-interaction.ts but SuperGridEngine doesn't use them
export interface DragState {
  isActive: boolean;
  sourceAxis: string;
  // ... defined but not connected to SuperGridEngine
}
```

### 📋 MVP Actions

1. **Implement header drag initiation** - Mouse down on header starts drag
2. **Create drop zones** - Visual targets for row/column/staging areas
3. **Wire axis remapping** - Drop triggers `setAxisMapping()` with new config
4. **Add reflow transition** - D3 transition on render after axis change

---

## 4. SuperDensity (Janus Controls) (Partial Implementation)

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **Janus State Structure** | `types/density-control.ts` | Defined - `JanusDensityState` |
| **Hierarchy Analysis** | `HeaderManager.ts:analyzeHierarchyFromGridData()` | Stub - creates `LevelGroup[]` based on node count |

### ❌ Gaps

| Feature | Spec Requirement | Current State |
|---------|------------------|---------------|
| **Value Density Slider** | "Per-facet zoom: collapse Jan,Feb,Mar → Q1" | Type only, no SQL GROUP BY generation |
| **Extent Density Slider** | "Hide/show empty rows and columns" | Type only, no filtering |
| **View Density** | "Spreadsheet ↔ Matrix toggle" | Not implemented |
| **Region Density** | "Mix sparse + dense columns" | Not implemented |

### 📊 Code Evidence

```typescript
// HeaderManager.ts - Stub implementation
analyzeHierarchyFromGridData(gridData: unknown): LevelGroup[] {
  // Only creates groups based on totalNodes threshold
  // Does NOT actually analyze hierarchy depth
  if (totalNodes > 50) levelGroups.push({...});
}
```

### 📋 MVP Actions (MVP requires levels 1 & 2 only)

1. **Implement Value Density** - Generate `GROUP BY` clause from density level
2. **Implement Extent Density** - Filter out empty cells from render
3. **Create density slider UI** - Two sliders: Value zoom + Extent pan
4. **Wire to data pipeline** - Slider change → re-query → re-render

---

## 5. SuperZoom — Cartographic Navigation (Partial Implementation)

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **Basic Zoom Behavior** | `Renderer.ts:setupZoomBehavior()` | Working - D3 zoom with scale extent [0.1, 5] |
| **Viewport Transform** | `Renderer.ts:updateViewport()` | Working - translates main group |

### ❌ Gaps

| Feature | Spec Requirement | Current State |
|---------|------------------|---------------|
| **Upper-Left Pinned Anchor** | "Contrary to D3's default center-zoom" | Uses D3 default (center zoom) |
| **Boundary Constraints** | "Cannot drag past table boundaries" | No constraints |
| **Smooth Animation** | "Quiet app aesthetic" | Transitions exist but not tuned |

### 📊 Code Evidence

```typescript
// Renderer.ts - Standard D3 zoom, not pinned to upper-left
const zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.1, 5])
  .on('zoom', (event) => {
    const { transform } = event;  // ← Uses default transform, not pinned
    this.svg!.select('.supergrid-main').attr('transform', transform.toString());
  });
```

### 📋 MVP Actions

1. **Modify zoom behavior** - Pin to upper-left corner instead of cursor
2. **Add boundary constraints** - Clamp pan to grid bounds
3. **Tune animation duration** - Match "quiet app" aesthetic (250-300ms)

---

## 6. SuperSelect — Z-Axis Aware Selection (Mostly Implemented)

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **Single Cell Selection** | `types.ts:SelectionState`, `Renderer.ts` | Working |
| **Selection State Management** | `SuperGridEngine/index.ts:selectionState` | Working |
| **Selection Indicators** | `Renderer.ts:updateSelection()` | Working - draws selection rects |
| **Multi-Select API** | `selectCells()` method | Working |

### ❌ Gaps

| Feature | Spec Requirement | Current State |
|---------|------------------|---------------|
| **Cell Checkbox** | "Every Card has a small selection checkbox" | Not rendered |
| **Lasso Select** | "Drag lasso across data area" | Not implemented |

### 📋 MVP Actions

1. **Add checkbox to cells** - Visual selection indicator
2. **Defer lasso select** - Nice-to-have for post-MVP

---

## 7. SuperPosition — Coordinate Tracking (Critical Gap)

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **Grid Position** | `CellDescriptor.gridX/gridY` | Working - cells have grid coords |

### ❌ Gaps

| Feature | Spec Requirement | Current State |
|---------|------------------|---------------|
| **PAFV Logical Coordinates** | "Each card has logical PAFV coordinates (axis values, not pixels)" | `CellDescriptor` has `xValue/yValue` but not full PAFV coords |
| **View Transition Translation** | "View transitions recompute position from card's LATCH properties" | Not implemented |
| **Custom Sort Persistence** | "Custom sort orders within categories are tracked" | Not implemented |

### 📋 MVP Actions

1. **Extend CellDescriptor** - Add full PAFV coordinate tuple
2. **Implement position recomputation** - On axis change, recalculate from data

---

## 8. Header Click Zones (Critical Gap)

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **Click Event Propagation** | `SuperGrid.tsx` | Basic click handler exists |
| **Header Click Callback** | `SuperGrid.tsx:onHeaderClick` | Exists but only for filtering |

### ❌ Gaps (Major)

| Feature | Spec Requirement | Current State |
|---------|------------------|---------------|
| **Geometric Hit-Test** | "Innermost interactive element wins" | Not implemented |
| **Parent Label Zone** | "~32px parent label zone for structural ops" | Not implemented |
| **Child Body Zone** | "Child header body for data selection" | Not implemented |
| **Cursor Changes** | "Zone-specific cursor changes on hover" | Not implemented |
| **Double-Click Behavior** | "Expand/collapse branch, inline rename, open detail" | Not implemented |
| **Right-Click Context Menu** | "Expand All, Collapse All, Sort, Filter, Hide" | Not implemented |
| **Resize Edge Detection** | "4px strips along cell borders" | Not implemented |
| **Hover Highlighting** | "Visual preview of click scope" | Not implemented |

### 📋 MVP Actions

1. **Implement hit-test zones** - Detect which zone cursor is in
2. **Add cursor state machine** - Change cursor per zone
3. **Wire click behaviors** - Parent label → expand/collapse, child → select group
4. **Add right-click menu** - Basic context menu with core operations

---

## 9. View Transitions (Partial Implementation)

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **Three-Tier State Model Types** | `types/supergrid.ts:SuperGridViewState` | Defined |
| **ViewContinuum** | `d3/ViewContinuum.ts` | Exists for view switching |

### ❌ Gaps

| Feature | Spec Requirement | Current State |
|---------|------------------|---------------|
| **Tier 1 State Persistence** | "Filters, selection, search, density always persist" | Partial - selection persists, others unclear |
| **Tier 2 State Suspend/Restore** | "Axis assignments suspend when crossing families" | Not implemented |
| **SQLite view_state Table** | "Store Tier 2 state per-dataset, per-app" | Schema defined but not used |
| **Cross-View Data Mutations** | "Database is source of truth" | Architecture exists but not verified |

### 📋 MVP Actions

1. **Implement Tier 1 persistence** - Ensure filters persist across transitions
2. **Defer Tier 2 complexity** - Post-MVP, focus on within-view behavior first

---

## 10. Performance

### ✅ Implemented

| Feature | Location | Status |
|---------|----------|--------|
| **Render Timing** | `Renderer.ts` | `performance.now()` around render |
| **Performance Metrics Type** | `types/supergrid.ts:RenderingMetrics` | Defined |
| **WAL Mode Config** | Schema docs | Documented for SQLite |
| **FTS5 Setup** | Schema | FTS5 triggers exist |
| **Performance Tests** | `test/examples/supergrid-*.test.ts` | Basic tests exist |

### ❌ Gaps

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| Initial render (1k cards) | <200ms | Untested with production data | Unknown |
| Grid render (10k cards) | <500ms | Untested | Unknown |
| Frame rate | 60fps | No monitoring | Unknown |
| Memory (10k cards) | <100MB | No measurement | Unknown |
| Cursor zone change | <16ms | Not implemented | Full gap |

### 📋 MVP Actions

1. **Add performance monitoring** - Track render times in production
2. **Test with real data volumes** - Load 10k+ alto-index nodes
3. **Implement viewport culling** - Only render visible cells for large datasets

---

## Prioritized MVP Roadmap

Based on the gap analysis, here's the recommended implementation sequence:

### Phase A: Core Grid MVP (Est. 3-4 days)

1. **SuperStack 2-Level Headers** (Critical)
   - Multi-level header generation
   - Visual spanning
   - Basic expand/collapse

2. **SuperDensity Level 1 & 2** (Critical)
   - Value density → GROUP BY
   - Extent density → hide empties

3. **SuperZoom Fix** (Medium)
   - Pin to upper-left corner
   - Boundary constraints

### Phase B: Interaction MVP (Est. 2-3 days)

4. **Header Click Zones** (Critical)
   - Hit-test implementation
   - Cursor changes
   - Basic context menu

5. **SuperDynamic Basic** (Medium)
   - Drag header to transpose
   - Drop zone highlighting

### Phase C: Polish MVP (Est. 2 days)

6. **PAFV UI Controls**
   - Axis dropdown/picker
   - Wire to SuperGridEngine

7. **Performance Verification**
   - Test with 10k nodes
   - Optimize if needed

### Post-MVP (Defer)

- SuperCalc + SuperAudit
- SuperTime (time hierarchy)
- Lasso select
- Full Tier 2 state persistence
- View Transition animations

---

## Success Criteria (from Spec)

A SuperGrid MVP is shippable when:

- [x] 2D grid renders with correct PAFV axis mapping from sql.js data
- [ ] **At least 2-level SuperStack headers render with correct visual spanning** ❌ Critical
- [ ] **Density slider collapses/expands one axis level (Value Density level 1)** ❌ Critical
- [ ] **Extent slider hides/shows empty intersections (Extent Density level 2)** ❌ Critical
- [ ] Axis drag-and-drop transposes rows ↔ columns ❌
- [x] Cell selection works with single-click and Cmd+click multi-select
- [ ] **Header click zones follow the geometric rule** ❌ Critical
- [ ] Cursor changes correctly across all zone boundaries ❌
- [ ] Column resize with drag handle persists (partial - handle exists but not persisted)
- [ ] **Zoom pins upper-left corner** ❌ Critical
- [ ] FTS5 search highlights matching cells in-grid ❌
- [ ] View transitions preserve Tier 1 state (partial)
- [ ] View transitions within LATCH family preserve/restore Tier 2 state ❌
- [x] All operations maintain 60fps with 1,000 cards (assumed, untested)
- [ ] All operations complete within performance targets at 10,000 cards (untested)

**Current MVP Readiness: ~30%**

---

## Appendix: File Map

| File | Purpose | MVP Relevance |
|------|---------|---------------|
| `src/d3/SuperGridEngine/index.ts` | Main engine class | High - all features route here |
| `src/d3/SuperGridEngine/DataManager.ts` | SQL queries, cell generation | High - data pipeline |
| `src/d3/SuperGridEngine/HeaderManager.ts` | Header tree, progressive disclosure | Critical - needs multi-level |
| `src/d3/SuperGridEngine/Renderer.ts` | D3 SVG rendering | High - needs nested headers |
| `src/d3/SuperGridEngine/types.ts` | Core type definitions | Complete |
| `src/components/supergrid/SuperGrid.tsx` | React wrapper | Medium - needs control wiring |
| `src/types/supergrid.ts` | Additional types, defaults | Complete |
| `specs/SuperGrid-Specification.md` | Feature spec | Reference document |
