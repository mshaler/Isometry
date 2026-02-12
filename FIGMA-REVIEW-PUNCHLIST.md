# Figma Make Design Review → Claude Code Punch List

*Isometry SuperGrid Design Export — Review Date: February 11, 2026*
*Reviewer: Claude AI × Michael*

---

## Overview

Figma Make generated a React/TypeScript/Tailwind implementation of Isometry's five-component navigation and control system from [FIGMA-MAKE-PROMPT.md]. This document catalogs what shipped correctly, what's missing, what needs rework, and provides a prioritized execution plan for Claude Code integration.

**Source files reviewed:** `SuperGrid_Design.zip` containing App.tsx, LatchNavigator.tsx, PafvNavigator.tsx, SuperGrid.tsx, DensitySlider.tsx, LatchSliders.tsx, mockData.ts, plus theme/style files.

---

## Scoring Summary

| Component | Spec Fidelity | Functional | Ready for Claude Code |
|-----------|:---:|:---:|:---:|
| LATCH Navigator | 85% | ✅ Working | ✅ Minor fixes |
| PAFV Navigator | 75% | ✅ Working | ⚠️ Needs additions |
| SuperGrid | 60% | ✅ Placeholder | 🔄 D3 rewrite planned |
| LATCH Sliders | 40% | ⚠️ Partial | 🔧 Significant rework |
| Sparsity↔Density | 90% | ⚠️ Orphaned | ✅ Just needs wiring |
| Data Model | 95% | ✅ Working | ✅ Ready |
| App Shell / State | 90% | ✅ Working | ✅ Ready |

---

## Component 1: LATCH×GRAPH Properties Filter Navigator

### What Shipped Correctly ✅

- 6-column grid layout (L, A, T, C, H, GRAPH) with correct colors and icons
- Property chips with checkboxes, full column width, correct ~28px height
- LATCH badge colors as left border accent on selected chips (3px, column color)
- Selected state: column color at 15% opacity background — exactly per spec
- Unselected chips dimmed but visible (opacity-60) — correct
- Column collapse/expand with ChevronDown/ChevronRight toggle
- Property count badge showing "checked/total" (e.g., "3/12") — correct
- Inline alias rename: hover reveals edit icon, click opens inline text field, Enter/Escape to confirm/cancel
- Type indicator icons on right side (Calendar, Type, Hash, List, 📍)
- Cascade behavior wired in App.tsx: unchecking cascades removal from all PAFV wells
- Vertical scroll within max-h-48 container for overflow

### What's Missing or Wrong ⚠️

| Issue | Spec Requirement | Current State | Priority |
|-------|-----------------|---------------|----------|
| **Column full names** | Headers show full word on wider screens (e.g., "Location") | Only shows single letter + icon ("L 📍") | P2 |
| **Chip position is static** | "Chips don't move, they toggle on/off" — vertical order by classifier ranking | Order comes from array position which is correct, but no sorting mechanism documented | P3 |
| **Brief animations** | "Brief exit animation" on uncheck, "brief enter animation" on check | No animations — instant toggle | P3 |

### Claude Code Action Items

```
□ P2: Add full column label below the letter+icon in header (e.g., "L 📍" + "Location")
         Show full label when column width > 120px, letter-only when collapsed
□ P3: Add CSS transition on chip opacity/height for check/uncheck (200ms ease)
□ P3: Document classifier ranking algorithm for property sort order
```

---

## Component 2: PAFV Projection Navigator

### What Shipped Correctly ✅

- 5-column layout: Available (28%), X-Plane (18%), Y-Plane (18%), Z-Plane (18%), Sparsity↔Density (18%)
- Drag-and-drop via react-dnd with DraggableChip and DropWell components
- LATCH color-coded left border on axis chips (matches source column color)
- Grip handle (⠿) on draggable chips
- Drop well highlighting on valid drag-over (blue border + tinted background)
- Z-plane controls nested inside the Z well as children: Display Property dropdown, Audit View toggle, Card Density selector (4 levels), Aggregation Mode (6 options)
- Cascade from Navigator 1: only checked properties appear in Available well
- Uncheck cascade: removing from Nav 1 removes from all PAFV wells (App.tsx lines 58-68)
- Multiple chips can stack in X and Y wells (creating nested header potential)
- Stack order within well determines nesting hierarchy (top = outermost)

### What's Missing or Wrong ⚠️

| Issue | Spec Requirement | Current State | Priority |
|-------|-----------------|---------------|----------|
| **Transpose button** | "⇄ between X and Y wells for quick axis swap" in Nav 2 | Only exists on SuperGrid corner cell — not in Nav 2 | P1 |
| **Color Encoding dropdown** | "Color: None ▾" — maps property to color gradient on cards | Missing entirely | P2 |
| **Size Encoding dropdown** | "Size: None ▾" — maps numeric property to card size | Missing entirely | P2 |
| **Sparsity↔Density quality** | Rich 4-notch slider with tooltips and semantic labels | Basic `<input type="range">` — the much better DensitySlider.tsx component exists but isn't wired in | P1 |
| **Well height rigidity** | Wells should accommodate many properties | Fixed h-64 (256px) may be too tight with 15+ properties | P2 |
| **Reorder within well** | Drag to reorder chips within same well (changes nesting hierarchy) | `handleReorderProperty` is stubbed but not implemented | P2 |
| **Drop animations** | "Brief exit animation" on remove, glow on valid target | No enter/exit animations on chip movement | P3 |
| **Invalid drop indicator** | "Drop target invalid: well border shows red" | Only valid highlighting (blue) implemented | P3 |

### Claude Code Action Items

```
□ P1: Wire DensitySlider.tsx content into the 5th well
         - Extract the 4-notch design (DENSITY_LEVELS array, hover tooltips,
           animated active-position circle) from the standalone component
         - Render inside the existing Sparsity↔Density well container
         - Remove the standalone fixed-position DensitySlider overlay

□ P1: Add Transpose button (⇄) between X-Plane and Y-Plane wells
         - Small icon button: <ArrowLeftRight /> centered between the two wells
         - On click: call handleTranspose() which already exists in App.tsx
         - Visual: 24×24px button, bg-[#2D2D2D], hover:bg-[#4A90D9], rounded

□ P2: Add Color Encoding dropdown to Z-plane controls
         - Chip styled like other Z controls: "Color: None ▾"
         - Options: None + all checked properties from Nav 1
         - When set: cards in SuperGrid render with property→color gradient
         - Priority scale example: 1=blue → 5=red
         - Category example: each unique value gets a distinct hue

□ P2: Add Size Encoding dropdown to Z-plane controls  
         - Chip styled like other Z controls: "Size: None ▾"
         - Options: None + all checked numeric properties
         - When set: card width/height within cell scales proportionally

□ P2: Implement within-well reorder via drag
         - Track drop index within DropWell
         - Update array order on same-well drop
         - Visual: insertion indicator line at drop position

□ P2: Make well height flexible: min-h-48 max-h-72 with flex-grow

□ P3: Add red border on invalid drop targets
□ P3: Add CSS transitions on chip enter/exit (150ms opacity + translateY)
```

---

## Component 3: SuperGrid

### What Shipped Correctly ✅

- HTML table-based placeholder demonstrating the data flow pipeline
- Corner cell showing axis configuration ("ROWS: [Y-prop] COLS: [X-prop]")
- Transpose button in corner cell (functional, calls handleTranspose)
- Sticky row headers (left) and column headers (top) with z-index layering
- Dynamic header generation from property values (extracts unique values, sorts)
- Data bucketing: notes correctly grouped at row×column intersections
- 4-level card density rendering (compact/standard/expanded/full) — all four working
- Empty cell indicator: centered dot (·)
- Multi-card cells: "+N more" overflow indicator with count
- Heat map tinting: cell background opacity proportional to card count
- Audit view toggle changes cell background treatment

### What's Missing (Expected — SuperGrid is a D3 rewrite) 🔄

| Feature | Spec | Status | Notes |
|---------|------|--------|-------|
| **SuperStack headers** | Multi-level spanning headers (Year→Quarter→Month) | Only uses first property per axis — no stacking | D3 implementation |
| **Stacked axis support** | Multiple chips in X/Y create nested headers | `xAxisProperties[0]` / `yAxisProperties[0]` only | D3 implementation |
| **Grid continuum** | 0 axes=Gallery, 1=List/Kanban, 2=Grid, 2+=SuperGrid | Only handles 2-axis case | D3 implementation |
| **SuperZoom** | Pinch zoom anchored to upper-left, frozen headers | No zoom | D3 implementation |
| **SuperSelect** | Click, ⌘-click, Shift-click, lasso select | No selection | D3 implementation |
| **SuperDynamic** | Drag headers to reorder, syncs back to PAFV | No header dragging | D3 implementation |
| **SuperSort** | Click header to cycle asc/desc/clear | No sorting | D3 implementation |
| **SuperFilter** | Dropdown filter icon in each header | No per-header filtering | D3 implementation |
| **Card drag between cells** | Drag to reassign property values | No card DnD | D3 implementation |
| **Collapse/expand headers** | Click parent to collapse children | No hierarchy | D3 implementation |
| **Header resize** | Drag right edge to resize, Shift+drag proportional | No resize handles | D3 implementation |
| **Context menu** | Right-click: Expand All, Collapse All, Sort, Hide | No context menu | D3 implementation |

### Claude Code Action Items

```
□ DEFERRED: The React table placeholder is correct for design review purposes.
  SuperGrid will be rebuilt as a D3.js rendering engine per the architecture:
  "D3 shows the truth, React lets you change it."

□ The React placeholder should be preserved as a reference implementation
  showing the data flow pipeline (property value extraction, bucketing,
  card density rendering) that D3 will replicate with proper:
  - enter/update/exit data binding
  - SVG/Canvas rendering for performance
  - Animated transitions between view states
  - SuperStack header computation from stacked axis chips
  - Grid continuum (0-axis gallery through N-axis SuperGrid)

□ Key data flow to preserve in D3 rewrite:
  App state → PAFVContext → { xAxisProperties, yAxisProperties, zAxisProperties }
  → D3 data join on (note × xValue × yValue) intersections
  → Card rendering at density level within each cell group
```

---

## Component 4: LATCH Sliders

### What Shipped Correctly ✅

- Collapsible bottom panel with expand/collapse toggle
- 5 slider rows with correct LATCH icons and colors
- Each row has: icon, label, control area, clear button (✕)
- Time slider: histogram visualization (static) + dual range handles + time preset shortcuts
- Category slider: toggle chips with AND/OR button, multi-select
- Hierarchy slider: gradient bar (blue→red) + range handles + semantic labels

### What's Missing or Significantly Simplified ⚠️

#### 4.1 Location Slider

| Spec | Current | Gap |
|------|---------|-----|
| Mini-map with cluster indicators | Text input field | Major — entire visual paradigm different |
| Cluster Selector (Metro/State/Country/Custom) | Not present | Missing |
| Bounding box draw on mini-map | Not present | Missing |
| Smart Geospatial Query DSL | Text input placeholder says "within 50mi of Denver" but no parsing | Placeholder only |
| Cluster visualization (dots scaled by count) | Not present | Missing |

#### 4.2 Alphabet Slider

| Spec | Current | Gap |
|------|---------|-----|
| Property selector dropdown | Not present | Missing — no way to choose which text property |
| Excel-style value checklist with counts | Not present | **Major** — this is the primary interaction |
| Regex mode toggle | Not present | Missing |
| Select All / Deselect All | Not present | Missing |
| Search within value list | Text search exists but filters nothing | Non-functional |
| Sort toggle (A→Z / Z→A / Count) | Dropdown exists | Visual only, non-functional |

#### 4.3 Time Slider

| Spec | Current | Gap |
|------|---------|-----|
| Adaptive zoomable histogram (real data) | Static hardcoded bars | Major — no real data binding |
| Draggable range handles on histogram | Two overlapping `<input type="range">` | **Broken** — overlapping range inputs fight for mouse events |
| Non-contiguous selection (⌘-click) | Not present | Missing |
| "+" button to add range bands | Not present | Missing |
| Zoom controls (pinch/scroll) | Not present | Missing |
| Zoom level indicator | Not present | Missing |
| Snap to time bucket boundaries | Not present | Missing |
| Double-click bar to snap range | Not present | Missing |
| Time preset shortcuts | Present and styled | ✅ Visual correct, needs wiring |

#### 4.4 Category Slider

| Spec | Current | Gap |
|------|---------|-----|
| Multi-facet sub-sections (one per category property) | Single flat chip list | Missing — should group by Folder, Tags, Status, etc. |
| Proportional chip sizing (by card count) | All chips same size | Missing |
| Hierarchical tree for nested categories | Not present | Missing |
| Parent auto-selects children | Not present | Missing |
| Visual distribution bar below each sub-section | Not present | Missing |
| Cross-category AND/OR toggle | Button exists but non-functional | Partially present |

#### 4.5 Hierarchy Slider

| Spec | Current | Gap |
|------|---------|-----|
| Histogram bars above slider showing distribution | Not present | Missing |
| Tick marks with card counts per value | Numbers shown but no counts | Partial |
| Hierarchy property selector dropdown | Not present | Missing — locked to Priority |
| Threshold mode toggle (range vs. threshold) | Not present | Missing |
| Weighted composite (0.7×Priority + 0.3×Importance) | Not present | Missing (advanced feature) |

### Claude Code Action Items

```
□ P1: Replace dual overlapping range inputs with proper dual-thumb slider
         - Use a single custom range component (or noUiSlider / rc-slider)
         - Both Time and Hierarchy sliders need this fix
         - Current implementation is broken: two <input type="range"> on same track

□ P2: Alphabet Slider — add Excel-style value checklist
         - Property selector dropdown (which text property to filter)
         - Scrollable checklist of unique values with counts
         - Select All / Deselect All toggle
         - Live search within the value list
         - This is the primary Alphabet interaction — text input alone is insufficient

□ P2: Time Slider — bind histogram to real data
         - Compute time distribution from MOCK_NOTES (or live data)
         - Bar height = note count per time bucket
         - Time bucket granularity adapts to visible range (Year→Quarter→Month→Week)

□ P2: Category Slider — implement multi-facet sub-sections
         - Group chips by category property (Folder section, Tags section, Status section)
         - Each section has its own chip group
         - Proportional chip sizing: chip width ∝ card count for that value

□ P2: Hierarchy Slider — add property selector dropdown
         - Choose between Priority, Importance, Sort Order
         - Update gradient range and tick marks per property

□ P3: Location Slider — design decision needed
         - Full mini-map requires map tile integration (Mapbox/Leaflet)
         - Consider: defer mini-map, keep text DSL input, add cluster selector dropdown
         - This may be a v2 feature given mapping complexity

□ P3: Time Slider — add non-contiguous selection (⌘-click for multiple ranges)
□ P3: Category Slider — add visual distribution bar
□ P3: Hierarchy Slider — add threshold mode toggle
□ P4: Category Slider — hierarchical tree for nested categories
□ P4: Hierarchy Slider — weighted composite (advanced feature)
□ P4: Time Slider — pinch zoom with granularity change
```

---

## Component 5: Sparsity↔Density Slider

### What Shipped ✅ (as standalone DensitySlider.tsx)

- 4-notch vertical slider with correct semantic labels:
  - Level 1: Value Sparsity — "Full Cartesian product. Every intersection shown."
  - Level 2: Extent Density — "Populated-only. Hide empty rows/columns."
  - Level 3: View Density — "Matrix view. Aggregation rows visible."
  - Level 4: Region Density — "Mixed sparse + dense regions. Power user mode."
- Hover tooltips with level name + description
- Animated active-position circle indicator (blue ring, 300ms transition)
- Dense/Sparse labels with icons (▦/◻)
- Gradient track from light to dark
- Current level info panel below slider
- Clean, well-designed component — best piece in the export

### What's Wrong ⚠️

| Issue | Status | Fix |
|-------|--------|-----|
| **Orphaned component** — not imported or rendered anywhere | DensitySlider.tsx exists but App.tsx doesn't use it | P1: Wire into Nav 2's 5th well |
| **Duplicate implementation** — Nav 2 has its own basic `<input type="range">` slider | Two competing implementations | P1: Remove basic slider, use DensitySlider content |
| **Fixed positioning** | DensitySlider uses `fixed right-4 top-1/2` (spec's original right-edge position) | P1: Refactor to render inline within 5th well container |
| **Axis-specific density panel** | "Small expansion arrow opens per-axis mini sliders" | Not implemented | P3 (advanced) |
| **Real-time preview** | "Live update of SuperGrid" as user drags | SuperGrid doesn't respond to density level yet | Depends on D3 rewrite |

### Claude Code Action Items

```
□ P1: Refactor DensitySlider content to render inside Nav 2's 5th well
         - Remove `fixed right-4 top-1/2` positioning
         - Extract the 4-notch design into a reusable vertical slider
         - Replace the basic <input type="range"> in PafvNavigator's Sparsity↔Density column
         - Adjust height to match sibling well heights (h-64 or flex)

□ P3: Add axis-specific density expansion panel
         - Small arrow/chevron at bottom of density slider
         - Expands to show 5 mini horizontal sliders (one per LATCH axis)
         - Main slider sets global; per-axis overrides for fine control
```

---

## Data Model & App Shell

### What Shipped Correctly ✅

- `Property` interface: id, rawName, displayName (alias), axis (LatchAxis), type, checked — complete
- `Note` interface: id, title, folder, tags, created, modified, priority, status, location, noteType, summary — sufficient for demo
- `LatchAxis` type: 'L' | 'A' | 'T' | 'C' | 'H' | 'GRAPH' — correct
- `LATCH_COLUMNS` constant: all 6 columns with key, label, color, icon — matches spec exactly
- 22 properties across 6 axes with realistic Apple Notes raw column names
- 25 mock notes spanning Q1 2024 through Q1 2025 — good coverage
- App.tsx state management: centralized, handlers propagate down correctly
- Cascade behavior: handlePropertyToggle correctly removes from all wells on uncheck
- react-dnd integration for drag-and-drop between wells

### Minor Issues

| Issue | Fix | Priority |
|-------|-----|----------|
| `useEffect` dependency array in App.tsx is `[]` but uses `properties` — may cause stale closure | Add `properties` to deps or use ref | P3 |
| `handleReorderProperty` is a no-op stub | Implement array reorder logic | P2 |
| No TypeScript strict null checks on property lookups | Add proper optional chaining | P3 |

---

## Missing Cross-Cutting Concerns

| Feature | Spec Requirement | Status | Priority |
|---------|-----------------|--------|----------|
| **Keyboard shortcuts** | Command palette (⌘) at bottom | Text input exists, no actual command handler | P3 |
| **Responsive layout** | Below 1200px: LATCH columns 3+3; Below 900px: PAFV wells 2×2 | Fixed percentage widths, no responsive breakpoints | P3 |
| **Animation system** | D3-style smooth transitions on all state changes | No animations except DensitySlider | P3 |
| **Empty state for 0-axis** | Gallery view when no axes assigned | Shows "No axes assigned" message but no gallery | P3 (depends on D3 grid continuum) |
| **Tooltip system** | Consistent hover tooltips on all interactive elements | Only DensitySlider has tooltips | P3 |

---

## Prioritized Execution Plan for Claude Code

### Phase 1: Quick Wins (Wire existing pieces correctly)

**Estimated effort: 1-2 hours**

1. **Wire DensitySlider into Nav 2** — Extract 4-notch design, render in 5th well, remove standalone overlay and basic range input
2. **Add Transpose button to Nav 2** — Between X and Y wells, using existing handleTranspose()
3. **Fix dual-thumb sliders** — Replace overlapping `<input type="range">` pairs in Time and Hierarchy sliders with proper dual-thumb component

### Phase 2: Complete the Control Surface

**Estimated effort: 4-8 hours**

4. **Add Color Encoding + Size Encoding dropdowns** to Z-plane controls
5. **Implement within-well reorder** (drag to reorder chips changes nesting hierarchy)
6. **Alphabet Slider: Excel-style value checklist** with property selector, unique values, counts
7. **Time Slider: Real data histogram** — bind to actual note distribution
8. **Category Slider: Multi-facet sub-sections** — group chips by category property
9. **Hierarchy Slider: Property selector dropdown** — choose Priority/Importance/Sort Order
10. **LATCH Navigator: Full column names** on wider screens

### Phase 3: SuperGrid D3 Engine

**Estimated effort: 20-40 hours (separate GSD plan)**

11. **D3.js SuperGrid rendering engine** — replaces React table placeholder
12. **SuperStack header computation** — from stacked axis chips in PAFV wells
13. **Grid continuum** — 0=Gallery, 1=List/Kanban, 2=Grid, 2+=SuperGrid
14. **Animated transitions** — between view states and density levels
15. **SuperZoom, SuperSelect, SuperSort, SuperFilter, SuperDynamic**

### Phase 4: Polish & Advanced Features

**Estimated effort: 8-16 hours**

16. **Non-contiguous time selection** (⌘-click for multiple ranges)
17. **Category hierarchical tree** with parent auto-select
18. **Axis-specific density panel** (per-LATCH mini sliders)
19. **Responsive breakpoints** (1200px and 900px)
20. **Location mini-map** (requires map tile integration — may defer)
21. **Hierarchy weighted composite** (advanced)
22. **Command palette** (keyboard shortcut handler)

---

## Files Reference

```
SuperGrid_Design/
├── src/
│   ├── app/
│   │   ├── App.tsx                    # Main shell — state management hub
│   │   ├── components/
│   │   │   ├── LatchNavigator.tsx     # Component 1 — 85% complete
│   │   │   ├── PafvNavigator.tsx      # Component 2 — 75% complete  
│   │   │   ├── SuperGrid.tsx          # Component 3 — React placeholder (D3 rewrite)
│   │   │   ├── LatchSliders.tsx       # Component 4 — 40% complete (most work needed)
│   │   │   ├── DensitySlider.tsx      # Component 5 — 90% complete (needs wiring)
│   │   │   └── figma/
│   │   │       └── ImageWithFallback.tsx
│   │   └── data/
│   │       └── mockData.ts            # Data model — 95% complete
│   └── styles/
│       ├── theme.css                  # NeXTSTEP dark theme vars
│       ├── tailwind.css
│       ├── index.css
│       └── fonts.css
├── guidelines/Guidelines.md           # Empty (Figma Make boilerplate)
├── package.json
├── vite.config.ts
└── postcss.config.mjs
```

---

## Key Architecture Decisions Confirmed by This Review

1. **"D3 shows the truth, React lets you change it"** — Figma Make correctly built the React control surface. SuperGrid is rightfully a D3 rewrite, not a React component to iterate on.

2. **Two-navigator pipeline is sound.** The cascade from Nav 1 → Nav 2 → SuperGrid works correctly in code. Selection before projection is enforced.

3. **Property alias system works.** rawName/displayName duality with inline editing is clean and ready for schema-on-read integration.

4. **DensitySlider is the design reference.** Its 4-notch semantic design should be the quality bar for all slider/control interactions in the system.

5. **LATCH Sliders are the gap.** This is where Figma Make simplified most aggressively and where Claude Code needs to invest the most design implementation effort before the D3 SuperGrid work begins.

---

*Document: FIGMA-REVIEW-PUNCHLIST.md*
*Version: 1.0*
*Source: SuperGrid_Design.zip review against FIGMA-MAKE-PROMPT.md spec*
*Next step: Claude Code executes Phase 1 quick wins, then Phase 2 control surface completion*
