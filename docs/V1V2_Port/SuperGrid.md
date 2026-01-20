# SuperGrid Architecture Specification

*Foundational design document for CardBoard's multidimensional visualization*

---

## Initial Synthesis: The Grid Continuum

Grids are **LATCH-primary views** (separation) and Graphs are **GRAPH-primary views** (connection). The continuum maps to axis allocation:

|View|Axes Used|x-plane|y-plane|z-plane|
|---|---|---|---|---|
|Gallery|0 explicit|position only|position only|—|
|List|1|—|single axis|—|
|Kanban|1|single facet|implicit ordering|—|
|2D Grid|2|Axis A|Axis B|—|
|SuperGrid|n|Axis A₁...Aₙ|Axis B₁...Bₘ|stacked PAFV headers|

The z-axis is what makes SuperGrid "super" — those stacked headers create dimensional depth that no one else has figured out well.

---

## Key Architectural Insights

### 1. The Density-Dimensionality Unification

**SuperDensitySparsity is the application of Janus to LATCH and GRAPH along the Z-axis.**

This ensures unyielding accuracy across arbitrary levels of semantic precision—same data, different scalable representation.

The Density slider is a filter navigation control that enables a unified model for smart adaptive aggregation views:

- **Maximum Sparsity**: Each contact visible in its own row → CardBoard automatically reveals/syncs the Title (Person's Name) facet as child to stacked headers
- **Maximum Density**: Collapse categories semantically

**Example: Project Stages**

| Dense Stages  | TO DO   | TO DO   | TO DO | Doing | Doing   | Doing  | Done | Done      | Done    |
| ------------- | ------- | ------- | ----- | ----- | ------- | ------ | ---- | --------- | ------- |
| Sparse Stages | Capture | Backlog | TO DO | Doing | Blocked | Review | Done | NOT TO DO | Archive |

**Key Insight**: Applying Janus to LATCH reduces dimensions based on semantic z-axis level of precision/generalization without underlying loss of accuracy.

**Conflict Example**: 
- Project manager updates task in Sparse view: Blocked → Review
- App user in Dense view sees no change (both map to "Doing")
- App user moves task to Done
- Sparse view sees conflicting update requiring resolution

The Sparsity view has high precision (zoom), Density view has breadth (pan), but **neither loses fidelity or accuracy**.

---

### 2. Four-Quadrant Coordination

```
┌─────────┬─────────────────────────────┐
│ MiniNav │    Column Headers           │
│         │  [Axis B₁] [Axis B₂]        │
├─────────┼─────────────────────────────┤
│  Row    │                             │
│ Headers │      Data Cells             │
│[Axis A₁]│                             │
│[Axis A₂]│                             │
└─────────┴─────────────────────────────┘
```

**SuperSelect Considerations**:
1. Every Card needs a small selection checkbox for drag-and-drop operations
2. Z-axis selection filter mechanism for determining selection context
3. Cell grid reflows from insertion point when dragging parent header
4. MiniNav serves as staging area for Axis Navigator functionality
5. SuperZoom follows Numbers-style behavior (don't drag past table, don't drop past window edge)

---

### 3. SuperStack Header Spanning

**Signature Feature**: Visual spanning for hierarchical headers

```
Row Headers (3 axes deep):
┌────────┬────────┬────────┐
│  Q1    │ Jan    │ Week 1 │ ← Axis A₁: Quarter
│        │        │ Week 2 │ ← Axis A₂: Month  
│        │ Feb    │ Week 1 │ ← Axis A₃: Week
│        │        │ Week 2 │
│  Q2    │ Mar    │ Week 1 │
...
```

**Implementation Decision**: Purely visual CSS/SVG, NOT merged cells in data model.

This affects:
- **Selection**: Lasso select spanned header = select all children
- **Resize**: Widening parent = proportional children
- **Calculation**: SUM at Q1 level vs Month level (distinct contexts)

---

### 4. Janus Translation Layer

**Problem**: Preserving position across view transitions.

**Scenario**: SuperGrid with Rows: Category→Time, Columns: Status switches to Kanban view.

**Solution**: **Recomputed position** based on new view's axis mappings.

Canonical positions are tracked contextually, allowing custom sort orders to survive view transitions while recomputing position for the target view's axis configuration.

---

### 5. SuperCalc Scope (HyperFormula Integration)

Multidimensional formulas have ambiguous scope:

```
Cell[Q1, Engineering, Total] = SUM(???)
```

Could mean:
- SUM of hierarchy children (Jan + Feb + Mar) within Engineering
- SUM across categories at Q1 level
- Cross-dimensional aggregation

**Requirement**: Formula scope must be PAFV-aware.

Reference: [Quantrix Modeler](https://help.idbs.com/Quantrix/Modeler_Help/LATEST/en/working-with-formulae.html) for multidimensional formula patterns.

---

## Implementation Architecture

### PAFVHeader: Recursive Component

```typescript
<PAFVHeader 
  axis={axis}
  depth={currentDepth}
  maxDepth={totalAxes}
  onResize={...}
  onDrag={...}
>
  <PAFVHeader depth={currentDepth + 1} ... />  {/* children */}
</PAFVHeader>
```

### AxisSelection Interface

```typescript
interface AxisSelection {
  axis: 'L' | 'A' | 'T' | 'C' | 'H';
  facets: string[];  // specific attributes selected
  plane: 'x' | 'y' | 'z' | 'filter';  // where it's assigned
  sortDirection: 'asc' | 'desc';
  aggregation?: 'count' | 'sum' | 'avg' | 'none';
}
```

### View Transition State Machine

```
Gallery ←→ List ←→ Kanban ←→ Grid ←→ SuperGrid
   ↑__________↓        ↑________↓
        ↓                   ↓
      Graph ←──────────────→
```

---

## Build Sequence

1. **FilterNav Controls First** — Universal input mechanism consumed by all views
2. **2D Grid → SuperGrid Lift** — Don't build SuperGrid from scratch
3. **Axis Picker as Standalone** — Clean API for axis selection
4. **Header Spanning** — Recursive PAFV headers with visual spanning

---

## Summary Decisions

| Question | Decision |
|----------|----------|
| Density/aggregation relationship | **Unified** — density slider controls aggregation level |
| Janus state | **Recomputed** — position based on new view's axis mappings |
| Starting point | **2D Grid first** — self-sufficient UI/UX, FilterNav enhances later |
| Header spanning | **Purely visual** — CSS/SVG, not data model merging |

---

*Source: CardBoard v1/v2 architecture discussions*  
*Ported to v3: January 2026*
