# Phase 96: DnD Migration - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate all remaining HTML5 DnD surfaces to pointer events so drag interactions work in WKWebView without native macOS drag interference. Four surfaces: SuperGrid axis grip reorder, SuperGrid cross-dimension transpose, KanbanView card drag, and DataExplorerPanel file import. The pointer DnD pattern from ProjectionExplorer (Phase 95) is the canonical reference.

</domain>

<decisions>
## Implementation Decisions

### SuperGrid Grip Ghost
- Chip-style ghost element showing field name (e.g. 'card_type') — matches ProjectionExplorer chip pattern
- Ghost chip includes LATCH color border for field family identification during drag
- Drop zones highlight with --drag-over-bg teal accent when ghost hovers (cross-dimension transpose)
- Source header dimming during drag: Claude's discretion (match ProjectionExplorer pattern)

### DataExplorer File Import
- Add a visible "Browse Files..." button next to the existing drop zone — WKWebView sandboxes file DnD from Finder
- Hidden `<input type="file">` triggered by button click — standard pattern, works in WKWebView, shows native file picker
- Keep both drop zone AND button visible everywhere — no conditional rendering based on environment
- Drop zone continues working for desktop browser usage; button is the primary path for native app

### Kanban Card Drag Feedback
- Card title chip ghost follows cursor — lightweight, consistent with chip ghost pattern across SuperGrid/ProjectionExplorer
- Column body gets --drag-over-bg teal accent background when cursor enters valid drop target
- Original card dims to 0.3 opacity while being dragged — consistent with SuperGrid header dimming

### Insertion Line
- Keep existing 2px teal insertion line visual — no changes to _showInsertionLine() appearance
- Same midpoint calculation algorithm (_calcReorderTargetIndex) — swap DragEvent coordinates for PointerEvent coordinates (both provide clientX/clientY)
- Insertion line driven by pointermove hit-testing instead of dragover events

### Claude's Discretion
- Source header dimming behavior (match PE pattern or keep existing 0.3 opacity)
- File input accept attribute filter values for supported import formats
- Ghost element positioning offsets and opacity values
- Cleanup of any remaining HTML5 DnD references after migration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pointer DnD Reference Implementation
- `src/ui/ProjectionExplorer.ts` lines 313-389 — Canonical pointer DnD pattern: pointerdown/pointermove/pointerup + setPointerCapture + ghost element + getBoundingClientRect hit-testing

### SuperGrid Axis DnD (to migrate)
- `src/views/SuperGrid.ts` lines 4207-4236 — Row header grip HTML5 DnD (dragstart/dragend)
- `src/views/SuperGrid.ts` lines 4396-4428 — Column header grip HTML5 DnD (dragstart/dragend)
- `src/views/SuperGrid.ts` lines 4672-4760 — Drop zone wiring (_wireDropZone), dragover midpoint calculation, insertion line, drop handler with same-dimension reorder + cross-dimension transpose logic

### KanbanView Card DnD (to migrate)
- `src/views/KanbanView.ts` lines 303-327 — setupCardDragListeners: HTML5 DnD dragstart/dragend with dataTransfer
- `src/views/KanbanView.ts` lines 333-355 — setupColumnDropListeners: dragover/dragleave/drop with card ID extraction

### DataExplorerPanel File Drop (to augment)
- `src/ui/DataExplorerPanel.ts` lines 280-302 — Drop zone with dragenter/dragover/dragleave/drop for file import

### Native Shell Defense
- `src/native/IsometryWebView.swift` — NSDraggingDestination overrides rejecting native drag ops (PROJ-05, defense-in-depth)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- ProjectionExplorer pointer DnD: complete reference implementation with ghost, hit-testing, well highlighting
- `_showInsertionLine()` / `_removeInsertionLine()`: existing insertion line rendering in SuperGrid
- `_calcReorderTargetIndex()`: existing midpoint calculation for reorder target
- `LATCH_COLORS` map: for ghost chip border coloring
- `getLatchFamily()`: field classification for LATCH color lookup

### Established Patterns
- `setPointerCapture(e.pointerId)` on pointerdown for reliable pointer tracking
- Ghost element: `position: fixed; pointer-events: none; z-index: 9999; opacity: 0.8`
- Hit-testing: `getBoundingClientRect()` comparison in pointermove handler
- `--dragover` / `drag-over` CSS class for drop target highlighting
- Module-level `_dragPayload` variable pattern (already used in SuperGrid for HTML5 DnD)

### Integration Points
- SuperGrid `_wireDropZone()` needs full rewrite from dragover/drop to pointermove/pointerup hit-testing
- KanbanView `setupCardDragListeners()` + `setupColumnDropListeners()` need full rewrite
- DataExplorerPanel needs a new button element + hidden file input alongside existing drop zone
- `_captureFlipSnapshot()` call in reorder drop handler must be preserved

</code_context>

<specifics>
## Specific Ideas

- All ghost elements should be chip-style (small, rounded) not full element clones — consistent visual language across all DnD surfaces
- The migration should preserve all existing drop logic (reorder, transpose, card move) — only the event mechanism changes from HTML5 DnD to pointer events

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 96-dnd-migration*
*Context gathered: 2026-03-19*
