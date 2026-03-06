# Phase 31: Drag Reorder - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Within-dimension level reorder via visual drag, N-level cross-dimension transpose behavior, animated transitions after drop, and Tier 2 persistence validation. The DYNM-03 back-end splice logic already works (5 passing tests) but lacks visual insertion feedback and production target-index calculation. Cross-dimension transpose (DYNM-01/DYNM-02) works but always appends to end. This phase adds the visual UX layer and validates persistence round-trips.

</domain>

<decisions>
## Implementation Decisions

### Drop Target Feedback
- Insertion line indicator (vertical for col reorder, horizontal for row reorder) at the target position between headers
- Insertion line uses the existing SuperGrid accent color
- Insertion line spans header area only (not full grid height)
- Browser default drag ghost (no custom setDragImage)
- Midpoint threshold calculation: during dragover, compare pointer X/Y to header cell midpoints to determine target index
- Source header dims to opacity 0.3 during drag (stays in place, does not hide)
- Escape to cancel drag (ensure HTML5 DnD default cancel behavior works; add explicit cleanup if needed)
- Keep existing `.drag-over` drop zone background highlight AND add the new insertion line (layered feedback)

### N-Level Transpose Behavior
- Cross-dimension transpose always appends to end of target dimension (current behavior preserved)
- Min 1 axis per dimension enforced (current DYNM-01/DYNM-02 guard preserved)
- Collapse state preserved across axis moves (same-dimension reorder and cross-dimension transpose)
- Collapse keys remapped on reorder: when an axis moves from level N to level M, all collapse keys referencing that axis have their level indices updated to reflect new positions

### Reorder Animation
- CSS transitions on header cells, 200ms duration, for position changes after reorder/transpose
- FLIP technique for data cells: snapshot old cell positions before drop, re-query + re-render at new positions, animate each cell from old to new position using CSS transform
- Both headers and data cells animate (not headers-only)

### Persistence Round-Trip
- Unit tests: toJSON()/fromJSON() round-trip for axis order AND collapse state after reorder
- Integration test: reorder -> serialize -> new provider instance -> verify state matches
- Backward-compatibility tests: pre-Phase-31 serialized state (no reorder metadata) deserializes correctly
- Dedicated collapse key remap test: reorder axes -> verify keys remapped -> serialize -> deserialize -> verify remapped keys survive
- Rapid-sequence edge case tests: reorder A->B, then B->C, serialize -> verify correct final state and idempotent collapse key remapping

### Claude's Discretion
- Exact CSS transition easing function (ease-out, ease-in-out, etc.)
- FLIP animation implementation details (requestAnimationFrame scheduling, transform vs top/left)
- How to handle FLIP when cells are added/removed during re-query (new groups appearing, empty groups disappearing)
- Insertion line thickness and exact positioning (e.g., 2px absolute-positioned pseudo-element vs dedicated DOM element)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_wireDropZone()` in SuperGrid.ts (line ~3312): Already handles same-dimension reorder via `dataset['reorderTargetIndex']` and cross-dimension transpose. Production target-index calculation replaces the test-only dataset approach.
- `_dragPayload` module singleton (line ~97): Stores `{ field, sourceDimension, sourceIndex }` at dragstart. Consumed at drop. Pattern is locked.
- `PAFVProvider.setColAxes()` / `setRowAxes()` (line ~190/207): Validated setters with defensive copies and field allowlist checks. Already trigger StateCoordinator notifications.
- `PAFVProvider.toJSON()` / `fromJSON()` (line ~436+): Tier 2 serialization with backward-compat guards for colAxes, rowAxes, colWidths, sortOverrides, collapseState.
- `SuperStackHeader.buildHeaderRows()` (SuperStackHeader.ts): Multi-level header rendering with collapse-aware slot computation. Collapse keys use `level\x1fparentPath\x1fvalue` format.
- `.drag-over` CSS class: Already toggled on drop zones during dragover/dragleave. Background highlight styling exists.

### Established Patterns
- HTML5 DnD with module-level singleton payload (dataTransfer.getData() blocked during dragover — D-decision locked)
- StateCoordinator subscription: provider mutation -> automatic `_fetchAndRender()` (no manual re-render calls)
- CSS Grid layout: headers use `grid-column: span N` via run-length encoding in SuperStackHeader
- Tier 2 persistence: PAFVProvider implements PersistableProvider; checkpoint writes happen via DatabaseManager autosave
- Collapse keys: `level\x1fparentPath\x1fvalue` with `\x1f` (Unit Separator) delimiter and `\x00` for internal path joins

### Integration Points
- `_wireDropZone()` is the primary integration point — visual feedback hooks into dragover/dragleave/drop events already wired there
- `_renderColHeaders()` / `_renderRowHeaders()` — header cell rendering where midpoint calculation and insertion line DOM injection would happen
- `PAFVProvider.collapseState` — collapse key remap logic integrates with existing setColAxes/setRowAxes or as a new method
- `_fetchAndRender()` — FLIP technique wraps this method: snapshot before, call original, animate after

</code_context>

<specifics>
## Specific Ideas

- FLIP animation pattern: First (snapshot old positions) -> Last (render new positions) -> Invert (calculate delta, apply inverse transform) -> Play (animate transform to zero). Standard technique that works even when DOM elements are recreated.
- Collapse key remapping should happen atomically with the axis reorder — not as a separate step. When setColAxes/setRowAxes is called after a reorder, collapse keys should update in the same provider mutation.
- The insertion line during drag should feel like Trello column reorder or Figma layer panel — precise, lightweight.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-drag-reorder*
*Context gathered: 2026-03-06*
