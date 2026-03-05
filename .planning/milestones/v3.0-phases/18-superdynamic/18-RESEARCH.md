# Phase 18: SuperDynamic - Research

**Researched:** 2026-03-04
**Domain:** HTML5 Drag-and-Drop, d3.drag, D3 transitions, PAFVProvider axis mutation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Grip handle interaction**: Grip handle icon on each axis header — only the grip area initiates drag. Leaves header text/click free for Phase 23 SuperSort (sort cycle on header click).
- **Bidirectional transpose**: Both row and column axis headers are draggable — full bidirectional transpose (DYNM-01 + DYNM-02).
- **Minimum 1 axis per dimension**: User cannot empty a dimension completely. Drop is blocked or prevented when source is the last axis in its dimension.
- **No duplicate fields across dimensions**: A field can only appear in one dimension at a time. Dragging 'status' from rows to columns removes it from rows. Block duplicate fields on drop.

### Claude's Discretion

- **Drag preview style**: Ghost of header vs custom pill/chip (setDragImage)
- **Drop target feedback**: Highlight zone vs insertion line
- **Drag affordance visibility**: Always visible grip vs hover-reveal
- **Dimension visual cues**: Color-coded row vs column headers, or position-only
- **Ghost slot placeholder**: Dashed outline at drag origin, or no placeholder
- **DnD API choice**: HTML5 DnD for all operations, or HTML5 cross-dimension + d3.drag in-stack reorder (roadmap pre-plan suggests the split approach in plans 18-02 vs 18-03)
- **Animation style**: Crossfade (existing pattern) vs slide-and-settle for 300ms reflow
- **Re-query vs cache**: Re-query Worker after transpose (correct, adds latency) vs client-side reflow from _lastCells (instant, complex)
- **Animation cancelability**: Cancel-and-restart on mid-animation drag vs queue until 300ms completes
- **Loading during reflow**: Animation-only feedback vs skeleton cells during Worker query
- **Max axis stack depth**: Cap at 3 per dimension (SuperStackHeader handles 3 levels) or no limit (cardinality guard at 50 handles overflow)
- **Undo support**: Cmd+Z via MutationManager (consistent with KanbanView) or no undo (axis config is metadata, not data mutation)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DYNM-01 | User can drag a row axis header to the column axis area to transpose the grid | HTML5 DnD cross-zone drop with custom MIME type `text/x-supergrid-axis`; drop handler calls provider.setColAxes() + provider.setRowAxes() |
| DYNM-02 | User can drag a column axis header to the row axis area to transpose the grid | Same HTML5 DnD pattern as DYNM-01 in reverse; uses symmetric drop zones on row header strip |
| DYNM-03 | User can reorder axes within the same dimension (row-to-row, col-to-col) via drag | Either HTML5 DnD with same MIME type + same-zone drop, or d3.drag for in-stack reorder (split per plan 18-03); modifies axis order within same array |
| DYNM-04 | Axis transpose triggers grid reflow with 300ms D3 transition animation | D3 `.transition().duration(300)` on grid container opacity (crossfade pattern) or on individual cell elements; fires after _fetchAndRender() completes |
| DYNM-05 | Axis assignments persist via PAFVProvider + StateManager across view switches | setColAxes/setRowAxes on provider → PAFVProvider.toJSON() serializes → StateManager Tier 2 persists; already wired from Phase 15/17 |

</phase_requirements>

---

## Summary

Phase 18 adds drag-and-drop axis transposition to SuperGrid. Users grip an axis header and drag it between the row dimension strip and column dimension strip (cross-zone) or reorder within the same dimension strip (same-zone). On drop, the handler calls `provider.setColAxes()` / `provider.setRowAxes()` — both already exist with validation and subscriber notification. The StateCoordinator subscription in SuperGrid then fires `_fetchAndRender()` automatically, completing the DYNM-05 persistence requirement for free.

The core technical challenge is the **module-level `dragPayload` singleton**: the HTML5 `dataTransfer.getData()` API is blocked during `dragover` events (security restriction). The payload must therefore be stored in a module-level variable at `dragstart` time and read at `drop` time. The KanbanView uses the MIME type trick (checking `dataTransfer.types.includes(...)` in `dragover` to gate `preventDefault()`), but the actual data read only happens on `drop`. The same pattern applies here.

A second challenge is the **DnD API split**: the CONTEXT.md roadmap pre-plans distinguish HTML5 DnD for cross-dimension transpose (plan 18-02) from d3.drag for same-dimension reorder (plan 18-03). This split exists because d3.drag intercepts `dragstart` and breaks `dataTransfer` — confirmed by the KanbanView source comment. For same-zone reorder, d3.drag provides clean pointer tracking without `dataTransfer` complications. For cross-zone transpose, HTML5 DnD is required because it works across unrelated DOM zones.

The 300ms D3 transition (DYNM-04) is already established by the crossfadeTransition pattern in `transitions.ts`. For SuperGrid's CSS Grid layout, the cleanest approach is a grid container opacity crossfade triggered after `_fetchAndRender()` resolves — matching the existing 300ms pattern.

**Primary recommendation:** Use HTML5 DnD with `text/x-supergrid-axis` MIME type + module-level `dragPayload` singleton for cross-dimension transpose. Use d3.drag for same-dimension reorder. On drop, call `provider.setColAxes()` / `provider.setRowAxes()` — StateCoordinator fires `_fetchAndRender()` automatically.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | ^7.9.0 (project) | d3.drag for same-dimension reorder; d3.transition for 300ms animation | Already in use; project standard |
| HTML5 DnD API | Browser native | Cross-dimension transpose drag events | Only API that works across unrelated DOM zones without d3.drag intercepting dataTransfer |
| PAFVProvider | Phase 15 | setColAxes/setRowAxes mutation + subscriber notification | Already exists with full validation |
| StateCoordinator | Existing | Bridges PAFVProvider changes to SuperGrid._fetchAndRender() | Already wired in Phase 17 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom DragEvent polyfill | Tests only | Provides DragEvent class in jsdom test environment | Already established in KanbanView.test.ts — reuse exactly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML5 DnD for cross-zone | d3.drag for everything | d3.drag intercepts dragstart and breaks dataTransfer — confirmed incompatible with cross-zone drag |
| d3.drag for in-stack reorder | HTML5 DnD for in-stack | d3.drag gives cleaner pointer tracking for same-container reorder without dataTransfer complications |
| Module-level dragPayload singleton | dataTransfer.getData() in dragover | dataTransfer.getData() is blocked during dragover (browser security) — singleton is the only correct pattern |

**Installation:** No new packages required. HTML5 DnD is browser-native; d3.drag is already in d3@7.9.0.

---

## Architecture Patterns

### Recommended Project Structure

No new files strictly required. Changes are confined to:

```
src/
├── views/
│   ├── SuperGrid.ts              # Add dragPayload singleton + drag handlers (18-01, 18-02)
│   │                             # Add d3.drag in-stack reorder (18-03)
│   │                             # Extend _createColHeaderCell() and row header rendering
│   ├── supergrid/
│   │   └── SuperStackHeader.ts  # May need grip handle data on HeaderCell (optional)
│   └── types.ts                 # Extend SuperGridProviderLike with setColAxes/setRowAxes
tests/
└── views/
    └── SuperGrid.test.ts         # Add DYNM-01..05 test cases
```

### Pattern 1: Module-Level dragPayload Singleton

**What:** A module-scope variable that stores the drag payload at `dragstart` time. Read at `drop` time. Bypasses the browser security restriction that blocks `dataTransfer.getData()` during `dragover`.

**When to use:** Whenever HTML5 DnD needs discriminated `dragover` gating AND payload reading on drop.

**Example:**
```typescript
// Source: KanbanView pattern + STATE.md locked constraint
// At module level (outside class):
interface AxisDragPayload {
  field: string;
  sourceDimension: 'col' | 'row';
  sourceIndex: number;
}
let _dragPayload: AxisDragPayload | null = null;

// In dragstart handler:
function onAxisDragStart(e: DragEvent, payload: AxisDragPayload): void {
  _dragPayload = payload;
  e.dataTransfer?.setData('text/x-supergrid-axis', '1'); // value irrelevant; presence gates dragover
  e.dataTransfer!.effectAllowed = 'move';
}

// In dragover handler (on drop zone):
function onDropZoneDragOver(e: DragEvent): void {
  if (e.dataTransfer?.types.includes('text/x-supergrid-axis')) {
    e.preventDefault(); // allow drop
    // show visual feedback
  }
}

// In drop handler:
function onDropZoneDrop(e: DragEvent, targetDimension: 'col' | 'row', targetIndex: number): void {
  e.preventDefault();
  if (!_dragPayload) return;
  const payload = _dragPayload;
  _dragPayload = null;
  // ... commit axis change to provider
}
```

**Confidence:** HIGH — `_dragPayload` singleton is a STATE.md locked constraint: "HTML5 DnD dragPayload MUST be a module-level singleton (dataTransfer.getData() blocked during dragover)"

### Pattern 2: HTML5 DnD Cross-Dimension Transpose

**What:** Grip handles on axis headers trigger dragstart. Drop zones on the opposite dimension strip (column drop zone on the row header strip, row drop zone on the column header strip) accept the drag. On drop: compute new colAxes/rowAxes arrays, call provider, let StateCoordinator trigger re-render.

**When to use:** DYNM-01 (row→col) and DYNM-02 (col→row).

**Example:**
```typescript
// Grip handle element (rendered inside each col/row header cell):
const grip = document.createElement('span');
grip.className = 'axis-grip';
grip.textContent = '⠿'; // or SVG icon
grip.setAttribute('draggable', 'true');
grip.addEventListener('dragstart', (e: DragEvent) => {
  _dragPayload = { field: axisField, sourceDimension: 'col', sourceIndex: idx };
  e.dataTransfer?.setData('text/x-supergrid-axis', '1');
  e.dataTransfer!.effectAllowed = 'move';
  e.stopPropagation(); // prevent header click event from firing
});

// Drop zone in the opposite dimension strip:
dropZoneEl.addEventListener('dragover', (e: DragEvent) => {
  if (e.dataTransfer?.types.includes('text/x-supergrid-axis')) {
    e.preventDefault();
    dropZoneEl.classList.add('drag-over');
  }
});
dropZoneEl.addEventListener('dragleave', () => {
  dropZoneEl.classList.remove('drag-over');
});
dropZoneEl.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();
  dropZoneEl.classList.remove('drag-over');
  if (!_dragPayload) return;
  const { field, sourceDimension } = _dragPayload;
  _dragPayload = null;

  // Constraint: block if source dimension would become empty
  const sourceAxes = sourceDimension === 'col' ? provider.getStackedGroupBySQL().colAxes
                                                 : provider.getStackedGroupBySQL().rowAxes;
  if (sourceAxes.length <= 1) return; // minimum 1 axis per dimension

  // Constraint: block if field already in target dimension
  const targetAxes = sourceDimension === 'col' ? provider.getStackedGroupBySQL().rowAxes
                                                : provider.getStackedGroupBySQL().colAxes;
  if (targetAxes.some(a => a.field === field)) return; // no cross-dimension duplicates

  // Commit transpose: remove from source, append to target
  const newSource = sourceAxes.filter(a => a.field !== field);
  const newTarget = [...targetAxes, { field, direction: 'asc' as const }];
  if (sourceDimension === 'col') {
    provider.setColAxes(newSource);
    provider.setRowAxes(newTarget);
  } else {
    provider.setRowAxes(newSource);
    provider.setColAxes(newTarget);
  }
  // StateCoordinator subscription fires _fetchAndRender() automatically
});
```

### Pattern 3: d3.drag In-Stack Reorder (DYNM-03)

**What:** d3.drag applied to grip handles within the same dimension strip for pixel-position reorder. On drag end, compute new axis order from visual position, call provider.setColAxes/setRowAxes.

**When to use:** DYNM-03 — reorder axes within the same dimension.

**Key difference from HTML5 DnD:** d3.drag works by synthetic pointer events. It does NOT set `dataTransfer`. It does intercept `dragstart` which would break HTML5 DnD — so d3.drag must only be applied to same-dimension elements, not to elements that also need HTML5 DnD for cross-dimension.

**Example (conceptual):**
```typescript
// Source: NetworkView.ts d3.drag pattern adapted for axis handles
const drag = d3.drag<HTMLSpanElement, AxisMapping>()
  .on('start', function() {
    d3.select(this).classed('dragging', true);
  })
  .on('drag', function(event) {
    // Move visual handle to follow pointer
    d3.select(this).style('transform', `translateX(${event.dx}px)`);
  })
  .on('end', function(event, d) {
    d3.select(this).classed('dragging', false).style('transform', null);
    // Determine new order from final pointer position
    // Commit to provider via setColAxes or setRowAxes
  });
```

**Note:** The CONTEXT.md roadmap pre-plan split (18-02 HTML5 DnD vs 18-03 d3.drag) separates these concerns cleanly. This is the recommended split.

**Alternative for DYNM-03:** Use HTML5 DnD for same-dimension reorder too (simplifies to one drag API). Tradeoff: HTML5 DnD for reorder is coarser (drop target slots vs continuous pointer tracking). Acceptable if d3.drag for same-zone feels over-engineered.

### Pattern 4: 300ms Transition After Reflow (DYNM-04)

**What:** After `_fetchAndRender()` resolves with new cells from the Worker, apply a crossfade on the grid container.

**When to use:** Every axis transpose or reorder (any call to setColAxes/setRowAxes that triggers _fetchAndRender).

**Example:**
```typescript
// In SuperGrid._fetchAndRender(), after _renderCells() call:
// The grid container fades from 0→1 opacity after new cells are painted
const grid = this._gridEl;
if (!grid) return;

// Pre-render: set opacity 0 before painting new cells
grid.style.opacity = '0';

// ... _renderCells() (synchronous DOM mutation)

// Post-render: transition to opacity 1 (300ms, matching crossfadeTransition)
d3.select(grid)
  .transition()
  .duration(300)
  .style('opacity', '1');
```

**Alternative:** Use `crossfadeTransition()` from `transitions.ts` (already has 300ms crossfade). Requires wrapping the grid container — the existing crossfadeTransition operates on `.view-root` children. Simpler to do a direct grid opacity transition inline.

**Confidence:** HIGH — transitions.ts crossfadeTransition uses 300ms opacity; same pattern applies inline.

### Anti-Patterns to Avoid

- **d3.drag on grip handles that also need HTML5 DnD**: d3.drag intercepts `dragstart` and breaks `dataTransfer`. Only one can be applied to the same element. Split by using HTML5 DnD for cross-dimension (gripEl `draggable=true` + `addEventListener('dragstart', ...)`) and d3.drag on a separate same-zone handle if needed, OR use HTML5 DnD for both operations.
- **Reading `dataTransfer.getData()` in `dragover`**: Blocked by browser security. Always store payload in `_dragPayload` singleton at `dragstart`, read it at `drop`.
- **Storing axis state on SuperGrid instance instead of PAFVProvider**: Axes must live in PAFVProvider to survive view destroy/remount (STATE.md locked constraint: "All axis state MUST live in PAFVProvider").
- **Re-registering drag listeners on every `_renderCells()` call**: Use `dataset['dragSetup'] = 'true'` guard (established by KanbanView) to prevent duplicate event listener accumulation.
- **Calling `_fetchAndRender()` directly from the drop handler**: Drop handler calls `provider.setColAxes/setRowAxes`. This schedules a PAFVProvider notification via `queueMicrotask`. The coordinator subscription picks it up and calls `_fetchAndRender()`. Do NOT call `_fetchAndRender()` directly — the coordinator batches deduplicate concurrent changes (FOUN-11).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Axis mutation + subscriber notification | Custom event bus on SuperGrid | `provider.setColAxes()` / `provider.setRowAxes()` | Already exists with allowlist validation, queueMicrotask batching, and PAFVProvider.toJSON() serialization |
| Re-render after drop | Call `_fetchAndRender()` from drop handler | Call provider setters; let StateCoordinator subscription trigger | Avoids double-render; preserves FOUN-11 batch deduplication |
| Persistence across view switches | Custom serialization | PAFVProvider.toJSON() + StateManager Tier 2 | Already wired in Phase 15/17 — zero new code for DYNM-05 |
| Transition animation | Hand-rolled setTimeout / CSS class swap | D3 `.transition().duration(300)` | Consistent with existing transitions.ts pattern |
| Cross-zone drag payload | `dataTransfer.getData()` in dragover | Module-level `_dragPayload` singleton | dataTransfer.getData() is security-blocked during dragover |
| Min-1-per-dimension enforcement | Complex UI disabling logic | Guard check at drop handler before calling provider | Provider only enforces allowlist; dimension minimum must be checked at the interaction layer |

**Key insight:** The PAFVProvider + StateCoordinator subscription pipeline already handles the complete transpose lifecycle (mutate → notify → re-fetch → re-render). The phase only needs to add the DnD interaction layer that calls `setColAxes/setRowAxes`.

---

## Common Pitfalls

### Pitfall 1: dataTransfer.getData() blocked during dragover

**What goes wrong:** Calling `e.dataTransfer?.getData('text/x-supergrid-axis')` in a `dragover` handler returns an empty string, causing the `e.preventDefault()` gate to silently fail. Drop zones don't accept the drag.

**Why it happens:** Browsers intentionally restrict `getData()` to `dragstart` and `drop` event handlers for security (prevents content sniffing from cross-origin drags).

**How to avoid:** Store payload in `_dragPayload` singleton at `dragstart`. In `dragover`, use `e.dataTransfer?.types.includes('text/x-supergrid-axis')` (type presence check is allowed) to gate `e.preventDefault()`. Read `_dragPayload` only in `drop`.

**Warning signs:** `dragover` fires but `e.preventDefault()` has no effect; drop zone never shows visual feedback.

### Pitfall 2: d3.drag intercepts dragstart and breaks dataTransfer

**What goes wrong:** Applying `d3.drag()` to an element and also expecting HTML5 DnD `dragstart`/`drop` to work on the same element. d3.drag prevents the native drag from initializing.

**Why it happens:** d3.drag calls `event.preventDefault()` on `mousedown` (and pointer events) to take control of the pointer stream, which prevents the browser's native drag-and-drop from activating.

**How to avoid:** Use HTML5 DnD (`draggable=true` + `addEventListener('dragstart', ...)`) for cross-dimension transpose. Use d3.drag exclusively for same-dimension in-stack reorder, on separate interaction surfaces if both are needed simultaneously.

**Warning signs:** `dragstart` event fires but `dataTransfer` is null or has no MIME types; drop events never fire on drop zones.

### Pitfall 3: Duplicate event listeners accumulating on re-render

**What goes wrong:** Each call to `_renderCells()` re-runs header creation, adding new `dragstart`/`dragover`/`drop` listeners on top of existing ones. Multiple listeners fire per event, causing double-transposes.

**Why it happens:** `_renderCells()` clears and recreates DOM via `while (grid.firstChild) grid.removeChild(grid.firstChild)`. New elements are always fresh, but `_renderCells()` may be called repeatedly on the same backing element.

**How to avoid:** SuperGrid currently clears the entire grid DOM on each `_renderCells()` call (`while (grid.firstChild) grid.removeChild(grid.firstChild)`). New header elements are always fresh — no deduplication guard needed for the header elements themselves. Drop zone elements on dimension strip containers (if persistent) need the `dataset['dragSetup'] = 'true'` guard from KanbanView.

**Warning signs:** One drop triggers two provider calls, causing a double-reflow.

### Pitfall 4: Axis state stored on SuperGrid instance

**What goes wrong:** Caching `colAxes` or `rowAxes` in `_lastColAxes`/`_lastRowAxes` after transpose and using that cache as the source of truth instead of always reading from provider. After a view switch, SuperGrid is destroyed and remounted; the cached state is lost.

**Why it happens:** Phase 17 introduced `_lastColAxes`/`_lastRowAxes` as a *render cache* for collapse click re-renders (no re-query). These are correctly always overwritten by `_fetchAndRender()` from the provider. The pitfall is accidentally making them the drag drop commit target instead of the provider.

**How to avoid:** Drop handler reads current axes from provider (`provider.getStackedGroupBySQL()`), computes new arrays, calls provider setters. Never use `_lastColAxes`/`_lastRowAxes` as the authoritative source for drag drop commits.

**Warning signs:** Axis reorder works once but state is wrong after view switch.

### Pitfall 5: Minimum-1-dimension constraint not enforced

**What goes wrong:** User drags the last axis out of rows (or columns), leaving one dimension empty. SuperGrid falls back to `DEFAULT_COL_AXES`/`DEFAULT_ROW_AXES` (Phase 17 view defaults), which silently overrides the user's intentional empty state.

**Why it happens:** PAFVProvider.setColAxes([]) is valid. SuperGrid._fetchAndRender() falls back to DEFAULT_COL_AXES/DEFAULT_ROW_AXES when provider returns empty. The user can't actually "empty" a dimension in practice — but the interaction is confusing.

**How to avoid:** Drop handler checks source dimension length before committing: `if (sourceAxes.length <= 1) return; // blocked — minimum 1 axis`. This is a UX constraint, not a provider constraint.

**Warning signs:** Drag handle on the only remaining axis appears to work, but the grid doesn't change (falls back silently).

---

## Code Examples

Verified patterns from existing codebase:

### KanbanView HTML5 DnD Pattern (canonical reference)
```typescript
// Source: /Users/mshaler/Developer/Projects/Isometry/src/views/KanbanView.ts

// dragstart — store payload in dataTransfer
cardEl.addEventListener('dragstart', (e: DragEvent) => {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData('text/x-kanban-card-id', d.id);
  e.dataTransfer.effectAllowed = 'move';
  cardEl.classList.add('dragging');
});

// dragover — gate with type check (NOT getData — it's blocked)
columnBody.addEventListener('dragover', (e: DragEvent) => {
  if (e.dataTransfer?.types.includes('text/x-kanban-card-id')) {
    e.preventDefault();
    columnBody.classList.add('drag-over');
  }
});

// drop — read from dataTransfer (allowed at drop time)
columnBody.addEventListener('drop', async (e: DragEvent) => {
  e.preventDefault();
  columnBody.classList.remove('drag-over');
  const cardId = e.dataTransfer?.getData('text/x-kanban-card-id');
  if (!cardId) return;
  // ... commit
});
```

**Adaptation for SuperDynamic:** Replace `text/x-kanban-card-id` with `text/x-supergrid-axis`. Replace `getData(...)` in drop handler with `_dragPayload` singleton read (since the payload needs `sourceDimension` + `field` + `sourceIndex`, not just a string ID).

### PAFVProvider setColAxes/setRowAxes (existing API)
```typescript
// Source: /Users/mshaler/Developer/Projects/Isometry/src/providers/PAFVProvider.ts

// Both methods validate axes, store, and schedule subscriber notification
provider.setColAxes([{ field: 'card_type', direction: 'asc' }]);
provider.setRowAxes([{ field: 'folder', direction: 'asc' }, { field: 'status', direction: 'asc' }]);

// Validation throws for: >3 axes, duplicate fields, non-allowlisted fields
// Subscriber fires via queueMicrotask — StateCoordinator picks up, calls _fetchAndRender()
```

### SuperGridProviderLike extension needed for Phase 18
```typescript
// Source: /Users/mshaler/Developer/Projects/Isometry/src/views/types.ts (current)
export interface SuperGridProviderLike {
  getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] };
}

// Phase 18 addition needed:
export interface SuperGridProviderLike {
  getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] };
  setColAxes(axes: AxisMapping[]): void;  // add
  setRowAxes(axes: AxisMapping[]): void;  // add
}
// PAFVProvider already implements both methods.
// Mock in tests needs to implement them too.
```

### d3.drag pattern (from NetworkView)
```typescript
// Source: /Users/mshaler/Developer/Projects/Isometry/src/views/NetworkView.ts
const drag = d3.drag<SVGCircleElement, NodeDatum>()
  .on('start', (event) => {
    event.sourceEvent?.stopPropagation?.();
  })
  .on('drag', (event, d) => {
    d.fx = event.x;
    d.fy = event.y;
  })
  .on('end', (_, d) => {
    // commit final position
  });
```

### D3 opacity transition (crossfade pattern from transitions.ts)
```typescript
// Source: /Users/mshaler/Developer/Projects/Isometry/src/views/transitions.ts
// crossfadeTransition uses 300ms opacity transitions — inline equivalent:
d3.select(gridEl)
  .transition()
  .duration(300)
  .style('opacity', '1');
```

### jsdom DragEvent polyfill (reuse from KanbanView.test.ts)
```typescript
// Source: /Users/mshaler/Developer/Projects/Isometry/tests/views/KanbanView.test.ts
if (typeof DragEvent === 'undefined') {
  class DragEventPolyfill extends MouseEvent {
    dataTransfer: DataTransfer | null;
    constructor(type: string, init?: DragEventInit) {
      super(type, init);
      this.dataTransfer = init?.dataTransfer ?? null;
    }
  }
  (globalThis as any).DragEvent = DragEventPolyfill;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| d3.drag for all interactions | HTML5 DnD for cross-zone + d3.drag for SVG force simulation only | Phase 5 KanbanView | d3.drag is reserved for SVG/simulation; HTML5 DnD for HTML card moves |
| Hardcoded axis fields | PAFVProvider.setColAxes/setRowAxes with allowlist validation | Phase 15 | Drop handler can call provider safely — validation is built-in |
| Direct re-render calls | StateCoordinator subscription pipeline | Phase 17 | Drop handler only mutates provider; re-render is automatic |

**Deprecated/outdated:**
- None relevant to this phase. All patterns in use are current project standards.

---

## Open Questions

1. **DnD API for DYNM-03 (same-dimension reorder)**
   - What we know: KanbanView established HTML5 DnD for cross-zone. d3.drag works for SVG pointer tracking. The roadmap pre-plan splits 18-02 (HTML5 DnD) vs 18-03 (d3.drag) along these lines.
   - What's unclear: Whether the UX benefit of d3.drag continuous pointer tracking (vs HTML5 DnD coarser slot-based drop) justifies the added implementation complexity for same-zone reorder.
   - Recommendation: Use HTML5 DnD for both cross-zone (DYNM-01/02) and same-zone reorder (DYNM-03). Single API, simpler implementation, consistent behavior. The slot-based insertion affordance (insertion line between axes) is sufficient UX for axis reorder. Only adopt d3.drag if usability testing reveals it's too coarse.

2. **Animation scope for DYNM-04**
   - What we know: `_fetchAndRender()` is async (Worker round-trip). The 300ms animation must cover the Worker latency + render paint.
   - What's unclear: Should the opacity drop to 0 immediately on drag drop commit, or only after the Worker response arrives?
   - Recommendation: Set grid opacity to 0 at drop commit time (immediately on user action, before Worker query). Set back to 1 after `_renderCells()` completes. This gives instant visual feedback that a change occurred, regardless of Worker latency.

3. **Grip handle placement in SuperStackHeader**
   - What we know: `buildHeaderCells()` returns `HeaderCell[]` arrays; `SuperGrid._createColHeaderCell()` renders from these. Row header rendering is inline in `_renderCells()`.
   - What's unclear: Whether grip handles should be added inside `_createColHeaderCell()` (and its row equivalent) inline in SuperGrid.ts, or whether `HeaderCell` should carry a draggable flag.
   - Recommendation: Add grip handles inline in `SuperGrid._createColHeaderCell()` and the row header render block. Do not modify `HeaderCell` type or `SuperStackHeader.ts` — keep the header computation pure and render concerns in SuperGrid.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — skipping this section.

---

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/src/views/KanbanView.ts` — HTML5 DnD implementation pattern with MIME type gate, dragstart/dragover/drop handlers, dataset-based listener deduplication guard
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/PAFVProvider.ts` — setColAxes/setRowAxes API, validation, subscriber notification, toJSON/setState for DYNM-05
- `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` — _fetchAndRender pipeline, _lastColAxes/_lastRowAxes cache, _createColHeaderCell, StateCoordinator subscription
- `/Users/mshaler/Developer/Projects/Isometry/src/views/transitions.ts` — crossfadeTransition 300ms opacity pattern
- `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperStackHeader.ts` — HeaderCell type, buildHeaderCells API
- `/Users/mshaler/Developer/Projects/Isometry/src/views/types.ts` — SuperGridProviderLike (needs setColAxes/setRowAxes addition), SuperGridBridgeLike, SuperGridFilterLike
- `/Users/mshaler/Developer/Projects/Isometry/src/views/NetworkView.ts` — d3.drag pattern reference
- `/Users/mshaler/Developer/Projects/Isometry/tests/views/KanbanView.test.ts` — jsdom DragEvent polyfill, mockDataTransfer setup, DnD event testing pattern
- `.planning/STATE.md` — Locked constraint: "HTML5 DnD dragPayload MUST be a module-level singleton"

### Secondary (MEDIUM confidence)
- `.planning/phases/18-superdynamic/18-CONTEXT.md` — User decisions, scope, and code insights

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries are already in the project; no new dependencies
- Architecture: HIGH — KanbanView HTML5 DnD pattern is directly reusable; PAFVProvider API fully covers the mutation needs; STATE.md has locked the dragPayload singleton constraint
- Pitfalls: HIGH — Pitfalls 1–3 are directly confirmed by KanbanView source code comments and STATE.md; Pitfalls 4–5 are derived from Phase 17 design decisions

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable stack — no fast-moving dependencies)
