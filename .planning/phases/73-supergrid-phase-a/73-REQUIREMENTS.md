# Phase 73 Requirements: SuperGrid Phase A

## Requirement Mapping

| REQ-ID | Requirement | Source | Plan |
|--------|-------------|--------|------|
| STACK-01 | Build header hierarchy tree from PAFV coordinates | Spec 2.1 | 73-01 |
| STACK-02 | Calculate visual spans for nested headers | Spec 2.1 | 73-01 |
| STACK-03 | Render headers as nested SVG groups with D3 | Spec 2.1 | 73-01 |
| STACK-04 | Click parent header selects all children | Spec 2.1 | 73-01 |
| DENS-01 | Value density generates SQL GROUP BY | Spec 2.5 | 73-02 |
| DENS-02 | Extent density filters empty cells | Spec 2.5 | 73-02 |
| DENS-03 | DensityControls React component | Spec 2.5 | 73-02 |
| ZOOM-01 | Pin zoom to upper-left corner | Spec 2.4 | 73-03 |
| ZOOM-02 | Constrain pan to grid boundaries | Spec 2.4 | 73-03 |
| ZONE-01 | Hit test for click zones | Spec 6 | 73-04 |
| ZONE-02 | Zone-based cursor state machine | Spec 6 | 73-04 |
| ZONE-03 | Wire click handlers to zone-specific actions | Spec 6 | 73-04 |

## Detailed Requirements

### STACK-01: Build Header Hierarchy Tree

**Source:** SuperGrid-Specification.md Section 2.1, Implementation Plan Task 1.2

**Input:** Array of cells with PAFV coordinates (`{ yValues: ['Q1', 'Jan', 'Week 1'] }`)

**Output:** Nested `HeaderNode[]` with:
- `value`: Display text
- `level`: Hierarchy depth (0, 1, 2, ...)
- `span`: Number of leaf cells spanned
- `children`: Nested children
- `startIndex`, `endIndex`: Leaf cell range
- `isCollapsed`: Progressive disclosure state

**Verification:** Unit test with 3-level input returns correct tree structure.

### STACK-02: Calculate Visual Spans

**Source:** Implementation Plan Task 1.3

**Input:** `HeaderNode[]`, cell size, header depth, orientation

**Output:** `HeaderDescriptor[]` with pixel positions and sizes

**Verification:** Spans sum to total cell count.

### STACK-03: Render Nested Headers

**Source:** Implementation Plan Task 1.4

**Behavior:**
- Use D3 `.join()` with key function
- Column headers: stack vertically by level, spread horizontally
- Row headers: stack horizontally by level, spread vertically
- Background rect for click target
- Label text centered in header cell

**Verification:** Visual inspection — Q1 header spans Jan/Feb/Mar columns.

### STACK-04: Click Parent Selects Children

**Source:** Spec Section 6 (Header Click Zones)

**Behavior:** Clicking parent header label zone selects all descendant data cells.

**Verification:** Click Q1, all Q1 children selected.

### DENS-01: Value Density GROUP BY

**Source:** Implementation Plan Task 2.2

**Behavior:**
- Density level 0: Leaf values (no aggregation)
- Density level 1+: GROUP BY with COUNT(*) and AVG for numerics

**Verification:** Level 1 query has correct GROUP BY clause.

### DENS-02: Extent Density Filtering

**Source:** Implementation Plan Task 2.3

**Modes:**
- `dense`: Only cells with `nodeCount > 0`
- `sparse`: Populated + immediate neighbors
- `ultra-sparse`: Full Cartesian product

**Verification:** Dense mode returns only populated cells.

### DENS-03: DensityControls Component

**Source:** Implementation Plan Task 2.4

**UI:**
- Value slider: 0 to maxValueLevel
- Extent toggle: dense | sparse | ultra-sparse

**Verification:** Both controls rendered, callbacks fire on change.

### ZOOM-01: Pin Zoom to Upper-Left

**Source:** Implementation Plan Task 3.2

**Behavior:** Scroll wheel zoom anchors to (0,0), not cursor position.

**Verification:** Upper-left cell stays pinned during zoom in/out.

### ZOOM-02: Constrain Pan to Boundaries

**Source:** Implementation Plan Task 3.2

**Behavior:** Cannot pan past left/top edge of grid.

**Verification:** Drag right/down, cannot overscroll.

### ZONE-01: Hit Test for Click Zones

**Source:** Implementation Plan Task 4.3

**Zones:**
- `parent-label`: ~32px parent header area
- `child-body`: Child header cell body
- `resize-edge`: 4px right edge
- `data-cell`: Data cell body

**Verification:** Hit test returns correct zone for each position.

### ZONE-02: Cursor State Machine

**Source:** Implementation Plan Task 4.4

**Cursors:**
- `parent-label`: pointer
- `child-body`: cell
- `resize-edge`: col-resize
- `data-cell`: default

**Verification:** Cursor changes on zone boundary crossing.

### ZONE-03: Zone Click Handlers

**Source:** Implementation Plan Task 4.5

**Handlers:**
- `parent-label`: Toggle collapse
- `child-body`: Select children
- `resize-edge`: (drag, not click)
- `data-cell`: Select cell

**Verification:** Each zone triggers correct behavior.

## Acceptance Criteria

All 12 requirements must pass verification before Phase 73 is marked complete.
