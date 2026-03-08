# Phase 55: Properties + Projection Explorers - Research

**Researched:** 2026-03-08
**Domain:** UI component architecture, drag-and-drop, provider wiring, SQL aggregation, inline editing
**Confidence:** HIGH

## Summary

Phase 55 replaces the stub content in the Properties and Projection CollapsibleSection bodies with two interactive explorer modules: PropertiesExplorer (LATCH-grouped property catalog with toggles and inline rename) and ProjectionExplorer (4 projection wells with drag-drop chip reordering plus Z-plane controls). Both modules wire into existing providers (PAFVProvider, SuperDensityProvider, AuditState) through the established subscriber pattern, and all state changes flow through StateCoordinator.scheduleUpdate() to trigger SuperGrid re-renders.

The codebase is extremely well-prepared for this phase. PAFVProvider already has setColAxes(), setRowAxes(), reorderColAxes(), reorderRowAxes() with full allowlist validation. SuperDensityProvider already manages viewMode and axisGranularity. AuditState already has toggle()/subscribe(). The KanbanView provides a proven HTML5 DnD pattern using custom MIME types and dataTransfer. CollapsibleSection provides mount/destroy lifecycle and can be extended with a getBodyEl() accessor for explorer mounting.

The primary new engineering work is: (1) a LATCH family classification map for the 9 AxisField values, (2) a display alias provider for inline rename persistence, (3) the chip drag-drop UI with within-well reordering, (4) a new aggregation mode on PAFVProvider or SuperDensityProvider, and (5) wiring Z-plane controls (display field, audit, density, aggregation) into existing providers.

**Primary recommendation:** Build PropertiesExplorer and ProjectionExplorer as standalone classes following the mount/update/destroy lifecycle pattern. Use D3 selection.join for repeated structures (chips, property rows) per INTG-03. Add a lightweight AliasProvider (PersistableProvider) for display name persistence. Extend PAFVProvider with aggregation mode. Wire everything through constructor injection from main.ts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 5 LATCH columns (L, A, T, C, H) arranged horizontally side-by-side inside Properties section body
- Each column header shows enabled/total count badge (e.g., "T (2/3)")
- Each LATCH column individually collapsible (independent of parent Properties CollapsibleSection)
- Toggled-OFF properties remain visible with dimmed opacity + strikethrough (not hidden)
- Per-property toggle checkboxes enable/disable axis availability
- Single click on property name enters edit mode (span-to-input swap)
- Rename is display alias only -- does NOT alter underlying database column name
- Display aliases persisted via ui_state table (Tier 2 persistence)
- Renames propagate to all downstream UI: projection well chips and SuperGrid headers
- Clear/reset button in edit mode to revert alias to original column name
- Confirmation via Enter or blur; cancellation via Escape
- 4 projection wells horizontal row: [Available] [X] [Y] [Z] -- Available well wider
- Property chips show user's display alias (renamed label)
- Each chip has colored left border indicating LATCH family (design token color system)
- Available well auto-populates with toggled-ON properties NOT already assigned to X/Y/Z
- HTML5 drag-drop pattern (NOT d3.drag) -- consistent with KanbanView
- Valid target wells get dashed border + background highlight during dragover; invalid stay unhighlighted
- Duplicate rejection: cannot drop property into well that already contains it
- Minimum enforcement: X and Y wells must retain at least 1 property -- removing last snaps back + ActionToast
- Reordering within well calls reorderColAxes()/reorderRowAxes() for live re-render
- Z-plane controls below Z well: display field select, audit toggle, density select, aggregation mode
- Aggregation modes: COUNT (default), SUM, AVG, MIN, MAX -- produces different SQL GROUP BY
- Audit toggle wires to existing AuditState.enable()/disable()
- Density select surfaces viewMode + axisGranularity through SuperDensityProvider
- Display field select populated from 9 allowlisted AxisFields

### Claude's Discretion
- Exact chip sizing, padding, typography
- LATCH family color assignments (within design token system)
- Transition/animation timing for collapse, drag feedback
- Internal architecture of alias provider (new vs extending PAFVProvider)
- How display field selection wires into SuperGrid rendering pipeline

</user_constraints>

## Codebase Analysis

### Integration Points Already Available

1. **PAFVProvider** (src/providers/PAFVProvider.ts) -- READY
   - `setColAxes(axes)` / `setRowAxes(axes)` -- X/Y well drops wire directly
   - `reorderColAxes(from, to)` / `reorderRowAxes(from, to)` -- within-well reorder
   - `getState()` returns current colAxes/rowAxes for initializing well contents
   - `_validateStackedAxes()` prevents duplicates and validates allowlist
   - subscribe() pattern with queueMicrotask batching
   - PersistableProvider for Tier 2 persistence

2. **SuperDensityProvider** (src/providers/SuperDensityProvider.ts) -- READY
   - `setGranularity()` -- Z density granularity dropdown
   - `setViewMode()` -- Z density spreadsheet/matrix toggle
   - `setHideEmpty()` -- Z density control
   - Already registered with StateCoordinator (`coordinator.registerProvider('superDensity', ...)`)

3. **AuditState** (src/audit/AuditState.ts) -- READY
   - `toggle()` / `subscribe()` -- Z audit toggle wires directly
   - Module-level singleton (`auditState`) already imported in main.ts

4. **ALLOWED_AXIS_FIELDS** (src/providers/allowlist.ts) -- READY
   - 9 fields: created_at, modified_at, due_at, folder, status, card_type, priority, sort_order, name
   - Frozen ReadonlySet for runtime validation

5. **CollapsibleSection** (src/ui/CollapsibleSection.ts) -- NEEDS MINOR EXTENSION
   - mount/destroy lifecycle, ARIA, localStorage persistence
   - **Missing:** `getBodyEl()` accessor -- currently `_bodyEl` is private
   - Fix: Add public `getBodyEl(): HTMLElement | null` method (1 line)

6. **WorkbenchShell** (src/ui/WorkbenchShell.ts) -- NEEDS MINOR EXTENSION
   - Creates 4 sections with stub content: Notebook, Properties, Projection, LATCH
   - **Missing:** No accessor to get individual sections by key
   - Fix: Add `getSection(key: string): CollapsibleSection | undefined` or expose section body elements for explorer mounting

7. **KanbanView DnD pattern** (src/views/KanbanView.ts:295-365) -- REFERENCE ONLY
   - HTML5 dragstart/dataTransfer/drop with custom MIME type `text/x-kanban-card-id`
   - Guard against duplicate listeners via `dataset['dragSetup']`
   - Visual feedback via classList.add('dragging') / classList.add('drag-over')
   - Same pattern reused with different MIME type for projection wells

8. **ActionToast** (src/ui/ActionToast.ts) -- READY
   - `show(message)` with 2s auto-dismiss
   - Already mounted on `document.body` in main.ts
   - Reuse for constraint violation messages

9. **StateCoordinator** (src/providers/StateCoordinator.ts) -- READY
   - `scheduleUpdate()` batches provider changes into single view notification
   - New alias provider would register here for persistence

### LATCH Family Classification

The schema.sql comments provide the canonical LATCH grouping. Mapping the 9 AxisField values:

| Family | Letter | AxisField values | Count |
|--------|--------|------------------|-------|
| Location | L | (none in AxisField -- latitude/longitude/location_name are FilterFields only) | 0 |
| Alphabet | A | name | 1 |
| Time | T | created_at, modified_at, due_at | 3 |
| Category | C | folder, status, card_type | 3 |
| Hierarchy | H | priority, sort_order | 2 |

**Total: 9 AxisField values across 4 families** (L has 0 -- Location fields are in FilterField but not AxisField because they're REAL values unsuitable for GROUP BY).

Since Location has no AxisField members, PropertiesExplorer should show 4 columns (A, T, C, H), not 5. However, the user decision says "5 LATCH columns (L, A, T, C, H) arranged horizontally." The L column would be empty -- this is acceptable as a placeholder for future AxisField expansion (when location_name becomes an AxisField, for example). Keep L column with "(0/0)" badge and a note like "No location axes available."

### New Components to Build

#### 1. LATCH Family Map (Pure Data)

```typescript
// src/providers/latch.ts
type LatchFamily = 'L' | 'A' | 'T' | 'C' | 'H';
const LATCH_FAMILIES: Record<AxisField, LatchFamily> = {
  name: 'A',
  created_at: 'T', modified_at: 'T', due_at: 'T',
  folder: 'C', status: 'C', card_type: 'C',
  priority: 'H', sort_order: 'H',
};
const LATCH_ORDER: LatchFamily[] = ['L', 'A', 'T', 'C', 'H'];
```

#### 2. AliasProvider (New PersistableProvider)

Display name aliases stored per AxisField. Separate from PAFVProvider because:
- PAFVProvider manages axis mapping state (which fields are active on which axes)
- Aliases are orthogonal -- they affect display text everywhere, independent of axis assignment
- Clean separation of concerns; alias changes don't trigger Worker re-queries (no scheduleNotify needed for renames)

```typescript
// src/providers/AliasProvider.ts
class AliasProvider implements PersistableProvider {
  private _aliases: Map<AxisField, string> = new Map();
  getAlias(field: AxisField): string; // returns alias or original field name
  setAlias(field: AxisField, alias: string): void;
  clearAlias(field: AxisField): void;
  toJSON(): string;
  setState(state: unknown): void;
  resetToDefaults(): void;
}
```

Register with StateCoordinator under key 'alias'. Alias changes should notify subscribers so PropertiesExplorer and ProjectionExplorer can update chip labels, and potentially SuperGrid headers.

#### 3. PropertiesExplorer (New UI Component)

```
mount/update/destroy lifecycle
Constructor: (providers: { pafv, alias, coordinator })
Mount target: Properties CollapsibleSection body element
```

DOM structure:
```
.properties-explorer
  .properties-explorer__columns (horizontal flex)
    .properties-explorer__column[data-family="L"]
      .properties-explorer__column-header (clickable, collapsible)
        span.label "Location"
        span.badge "(0/0)"
      .properties-explorer__column-body
        (empty for L)
    .properties-explorer__column[data-family="A"]
      .properties-explorer__column-header
        span.label "Alphabet"
        span.badge "(1/1)"
      .properties-explorer__column-body
        .properties-explorer__property[data-field="name"]
          input[type="checkbox"] (toggle)
          span.property-name "name" (click to edit)
    ... (T, C, H columns)
```

Uses D3 selection.join for property rows within each column body (INTG-03 requirement).

#### 4. ProjectionExplorer (New UI Component)

```
mount/update/destroy lifecycle
Constructor: (providers: { pafv, alias, superDensity, auditState, coordinator, actionToast })
Mount target: Projection CollapsibleSection body element
```

DOM structure:
```
.projection-explorer
  .projection-explorer__wells (horizontal flex)
    .projection-explorer__well[data-well="available"]
      .projection-explorer__well-label "Available"
      .projection-explorer__well-body[role="listbox"]
        .projection-explorer__chip[draggable][role="option"]
          span.chip-border (colored by LATCH family)
          span.chip-label "Status" (display alias)
    .projection-explorer__well[data-well="x"]
      ...
    .projection-explorer__well[data-well="y"]
      ...
    .projection-explorer__well[data-well="z"]
      ...
  .projection-explorer__z-controls
    .z-controls__row
      select.z-controls__display-field
      button.z-controls__audit-toggle
      select.z-controls__density
      select.z-controls__aggregation
```

Uses D3 selection.join for chips within each well body (INTG-03 requirement).

#### 5. Aggregation Mode on PAFVProvider (Extension)

PROJ-06 requires aggregation modes that produce different SQL GROUP BY results. This affects the SuperGrid query pipeline. Options:

**Option A: Add aggregation to PAFVProvider** -- PAFVProvider already manages axis state that feeds into SuperGridQuery. Adding `setAggregation(mode)` here keeps all axis-query-related state in one provider. The getStackedGroupBySQL() method could be extended to return the aggregation mode.

**Option B: Add aggregation to SuperDensityProvider** -- SuperDensityProvider already manages density-related state that affects query behavior (granularity). Aggregation mode (COUNT/SUM/AVG/MIN/MAX) is density-adjacent.

**Recommendation: Extend PAFVProvider** because aggregation mode directly changes the SQL SELECT clause (COUNT(*) vs SUM(field) vs AVG(field)), which is query-shaping work that belongs alongside axis configuration. SuperDensityProvider's granularity affects GROUP BY expressions; aggregation affects SELECT expressions. PAFVProvider's compile() path is the right place.

New PAFVProvider additions:
```typescript
type AggregationMode = 'count' | 'sum' | 'avg' | 'min' | 'max';

// New state field:
aggregation?: AggregationMode; // defaults to 'count'

// New methods:
setAggregation(mode: AggregationMode): void;
getAggregation(): AggregationMode;
```

SuperGridQuery.buildSuperGridQuery() would need to accept aggregation mode and compile the appropriate SELECT expression. Currently it hardcodes `COUNT(*) AS count, GROUP_CONCAT(id) AS card_ids`. With aggregation:
- COUNT: `COUNT(*) AS count, GROUP_CONCAT(id) AS card_ids` (unchanged)
- SUM/AVG/MIN/MAX: `{AGG}({displayField}) AS count, GROUP_CONCAT(id) AS card_ids, COUNT(*) AS raw_count`

The `displayField` for non-COUNT aggregations comes from the Z-plane display field select. This means the display field must also be stored somewhere -- likely on PAFVProvider alongside aggregation.

#### 6. Display Field (New Concept)

The Z-plane display field select determines what value renders inside SuperGrid cells. Currently SuperGrid cells show card name (spreadsheet mode) or count (matrix mode). The display field select would change which field's value is shown.

This is a UI presentation concern that affects rendering but not the underlying query structure. Store it on SuperDensityProvider (alongside viewMode) as `displayField: AxisField`. Default: 'name'.

New SuperDensityProvider addition:
```typescript
// New state field:
displayField?: AxisField; // defaults to 'name'

// New method:
setDisplayField(field: AxisField): void;
```

### DnD Architecture

#### MIME Type Separation

KanbanView uses `text/x-kanban-card-id`. ProjectionExplorer needs its own MIME type to avoid collision:
- **Chip drag:** `text/x-projection-field` -- payload is the AxisField name
- **Reorder drag:** Same MIME type but with index metadata

Per STATE.md: "DnD collision between ProjectionExplorer and SuperGrid mitigated by distinct MIME types + separate payload singletons." This was already identified in v5.0 research.

#### Drag Flow

1. **dragstart:** Set `dataTransfer.setData('text/x-projection-field', axisField)`, set `effectAllowed = 'move'`, store source well in a module-level variable (not dataTransfer -- async read limitations)
2. **dragover (valid well):** Check `types.includes('text/x-projection-field')`, check not duplicate, check not removing last from X/Y -> if all valid, `preventDefault()` + add visual feedback class
3. **drop:** Read field from dataTransfer, compute new well assignments, call PAFVProvider mutations
4. **dragend:** Clean up drag feedback classes

#### Within-Well Reorder

HTML5 DnD supports reorder by detecting drop position relative to existing chips. Use `e.clientY` / `e.clientX` relative to chip positions to determine insertion index. When reorder is within X well, call `pafv.reorderColAxes(fromIndex, toIndex)`. Within Y well, call `pafv.reorderRowAxes(fromIndex, toIndex)`.

### Inline Rename Pattern

The span-to-input swap follows a well-established pattern:

1. **Default state:** `<span class="property-name">{displayAlias}</span>`
2. **Click:** Replace span with `<input type="text" value="{currentAlias}">`, auto-focus, select all
3. **Enter/blur:** Read input value, call `aliasProvider.setAlias(field, value)`, swap back to span
4. **Escape:** Swap back to span without saving
5. **Clear button:** Only visible during edit mode, calls `aliasProvider.clearAlias(field)`

### CSS Architecture

All new CSS selectors scoped under `.properties-explorer` and `.projection-explorer` prefixes (SHEL-06 compliance). Use existing design tokens for spacing, typography, colors, and transitions.

LATCH family colors -- new design tokens to add:
```css
--latch-location: #f59e0b;   /* amber */
--latch-alphabet: #3b82f6;   /* blue */
--latch-time: #10b981;       /* emerald */
--latch-category: #8b5cf6;   /* violet */
--latch-hierarchy: #ef4444;  /* red */
```

Both dark and light theme variants needed (add to design-tokens.css under both `:root` and `[data-theme="light"]`).

### Testing Strategy

All components are pure TypeScript with DOM manipulation -- testable with jsdom via Vitest.

1. **AliasProvider tests:** setAlias/getAlias/clearAlias, toJSON/setState round-trip, resetToDefaults
2. **LATCH family map tests:** Verify all 9 AxisField values classified correctly
3. **PropertiesExplorer tests:** mount/destroy lifecycle, toggle enables/disables, inline rename flow (click -> input -> Enter/Escape/blur), LATCH column grouping, count badge updates
4. **ProjectionExplorer tests:** mount/destroy, chip rendering from PAFVProvider state, drop handler calls setColAxes/setRowAxes, duplicate rejection, minimum enforcement (X/Y must have >= 1), within-well reorder, Z-controls wiring
5. **Aggregation mode tests:** PAFVProvider.setAggregation() + SuperGridQuery compilation with different modes
6. **Integration tests:** End-to-end flow -- toggle property OFF -> removed from available well -> SuperGrid doesn't use it

### Wiring in main.ts

New objects to create and wire:
```typescript
// After existing provider creation
const alias = new AliasProvider();
coordinator.registerProvider('alias', alias);

// After WorkbenchShell creation -- mount explorers into section bodies
// Need WorkbenchShell to expose section body elements
const propertiesBody = shell.getSectionBody('properties');
const projectionBody = shell.getSectionBody('projection');

const propertiesExplorer = new PropertiesExplorer({
  pafv, alias, coordinator, container: propertiesBody
});
propertiesExplorer.mount();

const projectionExplorer = new ProjectionExplorer({
  pafv, alias, superDensity, auditState, coordinator, actionToast,
  container: projectionBody
});
projectionExplorer.mount();
```

### CollapsibleSection Body Access

Current issue: CollapsibleSection creates stub content inside the body element. When explorers mount, they need to:
1. Clear the stub content
2. Mount explorer DOM into the body

Two approaches:
- **A: Add `getBodyEl()` to CollapsibleSection** + clear stub on explorer mount
- **B: Add `replaceContent(el: HTMLElement)` to CollapsibleSection** that clears body and appends

Recommend approach B: `setContent(el: HTMLElement)` method that clears all existing children from `_bodyEl` and appends the provided element. This keeps the Section in control of its DOM and provides a clean API for explorer mounting.

Also need `setCount(n: number)` -- already exists on CollapsibleSection. PropertiesExplorer can call `section.setCount(enabledPropertyCount)` to update the Properties header badge.

## Plan Decomposition

### Plan 1: Foundation (AliasProvider + LATCH Map + CollapsibleSection extension)

- LATCH family classification map with tests
- AliasProvider (PersistableProvider) with full test coverage
- CollapsibleSection.setContent() method for explorer mounting
- WorkbenchShell.getSectionBody() accessor
- New LATCH color design tokens in design-tokens.css
- **Requirements:** PROP-02 (catalog derived from provider metadata)

### Plan 2: PropertiesExplorer

- PropertiesExplorer class with mount/update/destroy lifecycle
- 5 LATCH columns with individual collapse (nested CollapsibleSection or custom)
- Property rows with toggle checkboxes + inline rename
- D3 selection.join for property rows (INTG-03)
- Count badges per column
- Wire into WorkbenchShell Properties section body
- **Requirements:** PROP-01, PROP-03, PROP-04, PROP-05

### Plan 3: ProjectionExplorer (Wells + Drag-Drop)

- ProjectionExplorer class with mount/update/destroy lifecycle
- 4 wells (available, x, y, z) with chip rendering
- HTML5 DnD between wells with validation (duplicates, min 1 for X/Y)
- Within-well reorder via drag
- D3 selection.join for chips (INTG-03)
- Chips show display alias with LATCH family color border
- Available well auto-populates from toggled-ON properties minus X/Y/Z assignments
- ActionToast for constraint violations
- **Requirements:** PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-07

### Plan 4: Z-Plane Controls + Aggregation + Integration

- Z-plane controls row: display field select, audit toggle, density select, aggregation mode
- Aggregation mode on PAFVProvider (setAggregation/getAggregation)
- Display field on SuperDensityProvider (setDisplayField)
- SuperGridQuery accepts aggregation mode for SQL compilation
- Wire all Z-controls to existing providers
- Wire PropertiesExplorer + ProjectionExplorer in main.ts
- **Requirements:** PROJ-05, PROJ-06, INTG-03

## Pitfalls

### Critical: DnD Event Propagation to SuperGrid

SuperGrid has its own drag interactions (column resize, header drag-reorder from Phase 31). If a drag from ProjectionExplorer propagates down to the SuperGrid scroll container, it could trigger unintended resize or reorder. Mitigation: use distinct MIME types (`text/x-projection-field` vs SuperGrid's internal drag state which uses module-level variables, not dataTransfer). Also call `e.stopPropagation()` on projection well drop handlers to prevent bubbling.

### Critical: CollapsibleSection max-height with Dynamic Content

CollapsibleSection uses `max-height: 500px` for the collapse animation. If PropertiesExplorer or ProjectionExplorer content exceeds 500px, the content will be clipped even when expanded. The panel rail has `max-height: 40vh` and `overflow-y: auto`, but the individual section body max-height is the inner limit. Solutions:
- Set `max-height: none` on sections that have real explorer content (override via CSS specificity)
- Or increase max-height to a generous upper bound (e.g., 2000px)
- The collapse animation uses max-height transition, so a very large max-height still works but makes animation slightly less smooth. Acceptable tradeoff.

### Moderate: Circular Dependency -- Properties Toggle Affects Available Well

When a property is toggled OFF in PropertiesExplorer, it should:
1. Be removed from the Available well
2. But if it's currently in X/Y/Z well, should it be removed from there too?

Decision: toggling OFF removes from Available well only. Properties already assigned to X/Y/Z remain (they were explicitly placed there). This avoids the cascade problem where toggling OFF a property that's the only one in X well would violate the "X must have >= 1" constraint. The UI should show a dimmed/strikethrough chip in X/Y/Z for toggled-OFF properties that are still assigned.

### Moderate: Aggregation Mode for Non-Numeric Fields

SUM/AVG/MIN/MAX on text fields (name, folder, status) will produce meaningless SQL results. Options:
- Silently coerce to COUNT when the display field is text
- Disable non-COUNT modes when display field is text
- Let SQL handle it (SQLite will return text for MIN/MAX, NULL for SUM/AVG on text)

Recommendation: Keep it simple -- SQLite handles this gracefully. MIN/MAX on text returns alphabetical min/max which is actually useful. SUM/AVG on text returns 0 or NULL which is harmless. The UI dropdown can be unconditionally available; the SQL result will be what it will be.

### Minor: D3 Import in UI Components

INTG-03 requires D3 selection.join for repeated structures. The UI components (PropertiesExplorer, ProjectionExplorer) are in src/ui/ while D3 is typically used in src/views/. Importing d3-selection in UI components is fine -- it's a lightweight module that handles DOM efficiently. Use `import { select } from 'd3-selection'` (tree-shakeable).

### Minor: Inline Edit Focus Management

When user clicks a property name to edit, the input must receive focus immediately. If the click event propagates to the parent CollapsibleSection header, it could trigger collapse. Mitigation: property names are inside the section body, not the header, so this is a non-issue for the parent section. But the inner LATCH column headers (if using nested CollapsibleSection) need `e.stopPropagation()` on property name clicks to prevent column collapse.

## Sources

All findings are from direct codebase analysis -- no external web research needed for this phase. The relevant patterns, APIs, and integration points are all established in the existing code:

- PAFVProvider: src/providers/PAFVProvider.ts (setColAxes, setRowAxes, reorderColAxes, reorderRowAxes)
- allowlist.ts: src/providers/allowlist.ts (ALLOWED_AXIS_FIELDS -- 9 fields)
- SuperDensityProvider: src/providers/SuperDensityProvider.ts (setGranularity, setViewMode)
- AuditState: src/audit/AuditState.ts (toggle, subscribe)
- CollapsibleSection: src/ui/CollapsibleSection.ts (mount/destroy, setCount)
- WorkbenchShell: src/ui/WorkbenchShell.ts (section creation, stub content)
- KanbanView DnD: src/views/KanbanView.ts:295-365 (HTML5 drag-drop reference)
- ActionToast: src/ui/ActionToast.ts (show with auto-dismiss)
- StateCoordinator: src/providers/StateCoordinator.ts (registerProvider, scheduleUpdate)
- schema.sql: src/database/schema.sql:19-39 (LATCH column annotations)
- design-tokens.css: src/styles/design-tokens.css (full token system)
- SuperGridQuery: src/views/supergrid/SuperGridQuery.ts (query compilation pipeline)
- main.ts: src/main.ts (full provider wiring reference)

**Confidence: HIGH** -- All integration points verified in source code. No external library research needed. Every pattern used in this phase has a working precedent in the codebase.
