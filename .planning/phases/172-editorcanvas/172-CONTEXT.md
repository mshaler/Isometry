# Phase 172: EditorCanvas - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace EditorCanvasStub with a production EditorCanvas that mounts NotebookExplorer inside the SuperWidget canvas slot, with SelectionProvider binding for card display, a status slot showing the selected card title, and destroy safety that delegates to NotebookExplorer's existing teardown. This phase does NOT modify NotebookExplorer internals, add new editor features, or implement split-pane layouts — it wires the existing NotebookExplorer into the SuperWidget canvas lifecycle.

</domain>

<decisions>
## Implementation Decisions

### Destroy Safety (ECNV-03)
- **D-01:** EditorCanvas.destroy() delegates to NotebookExplorer.destroy() which already flushes pending title/content commits and unsubscribes all internal provider handles (mutation, selection, filter, chart renderer). EditorCanvas only adds wrapper-div removal and status-el nulling on top.
- **D-02:** The "4 provider handles" in ECNV-03 maps to NotebookExplorer's internal subscriptions: mutation, selection, filter, and chart renderer's filter subscription. EditorCanvas does not duplicate this teardown.
- **D-03:** NotebookExplorer has NO debounced auto-save timer — it uses shadow-buffer architecture with blur-triggered MutationManager commits. The "cancels debounced auto-save timer" language in ECNV-03 is satisfied by NE's void _commitTitle()/_commitContent() flush in its destroy().
- **D-04:** The 600ms post-destroy bridge.send assertion is tested as a unit test in Phase 172 (EditorCanvas.test.ts), not deferred to Phase 173.

### Status Slot Content (ECNV-02)
- **D-05:** Status slot shows the selected card's title text only. No type badge, no modified-state indicator.
- **D-06:** When no card is selected (idle state), status slot shows "No card selected".
- **D-07:** Status updates reactively via SelectionProvider subscription — when selection changes, EditorCanvas queries the card title and updates the status slot DOM.

### Selection Propagation (ECNV-04)
- **D-08:** EditorCanvas passes the shared SelectionProvider instance through to NotebookExplorer's config. NE already subscribes on mount and reads current selection internally. No extra query-on-mount or eager-read wiring needed in EditorCanvas.
- **D-09:** Cross-canvas selection works automatically: SelectionProvider.select(id) called in ViewCanvas (e.g., SuperGrid cell click) persists in the shared instance. When EditorCanvas mounts, NE subscribes and renders the already-selected card.

### Mounting Config
- **D-10:** EditorCanvas uses a config bag pattern (EditorCanvasConfig) matching ViewCanvas's approach. Contains: canvasId, bridge, selection, filter, alias, schema?, mutations. Wired in main.ts at registration time.
- **D-11:** NotebookExplorer is instantiated inside mount() and destroyed inside destroy(). EditorCanvas owns the NE lifecycle entirely.

### Prior Decisions (carry forward)
- **D-12:** SuperWidget.ts has zero import references to any canvas — registry plug-in seam only (CANV-06).
- **D-13:** Wrapper-div isolation — EditorCanvas creates an inner wrapper div, passes it to NotebookExplorer, never exposes _canvasEl directly.
- **D-14:** destroy-before-mount ordering holds under rapid switching (3+ transitions < 500ms).
- **D-15:** Each canvas type owns its status slot content entirely (from Phase 171 D-01).

### Claude's Discretion
- Exact CSS class naming for the wrapper div and status bar elements
- Whether status slot DOM setup follows ViewCanvas's idempotent pattern or a simpler one-shot approach
- Internal structure of the SelectionProvider subscription callback in EditorCanvas
- Test file organization (single test file vs. split by requirement)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperWidget Architecture
- `src/superwidget/projection.ts` — Projection type, CanvasComponent interface, transition functions
- `src/superwidget/SuperWidget.ts` — SuperWidget DOM skeleton, CanvasFactory type, slot layout
- `src/superwidget/registry.ts` — CanvasRegistryEntry, register/getRegistryEntry/getCanvasFactory
- `src/superwidget/EditorCanvasStub.ts` — Current stub to be replaced
- `src/superwidget/ViewCanvas.ts` — Sibling canvas implementation (Phase 171) — reference for mount/destroy/status/config patterns

### NotebookExplorer
- `src/ui/NotebookExplorer.ts` — NotebookExplorerConfig interface (line 121), constructor, mount pattern, destroy() (line 399), shadow-buffer architecture, _onSelectionChange handler
- `src/ui/charts/ChartRenderer.ts` — Chart rendering subsystem (destroyed by NE.destroy())

### Provider Layer
- `src/providers/SelectionProvider.ts` — Tier 3 ephemeral selection: select(), toggle(), subscribe(), getSelectedIds()
- `src/providers/types.ts` — Provider type definitions
- `src/mutations/MutationManager.ts` — Shadow-buffer commit target for title/content edits

### Test Patterns
- `tests/superwidget/EditorCanvasStub.test.ts` — Existing stub tests (replace with real EditorCanvas tests)
- `tests/superwidget/canvasWiring.test.ts` — Canvas mount/destroy lifecycle tests
- `tests/superwidget/registry.test.ts` — Registry pattern tests
- `tests/ui/NotebookExplorer.test.ts` — NE unit tests (reference for mock patterns)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **NotebookExplorer** (`src/ui/NotebookExplorer.ts`): Full card editor with shadow-buffer, markdown preview, chart blocks, property fields. EditorCanvas wraps this — no need to reimplement any editor logic.
- **ViewCanvas** (`src/superwidget/ViewCanvas.ts`): Direct sibling — same config bag pattern, mount/destroy lifecycle, status slot DOM setup, wrapper-div isolation. Follow this pattern closely.
- **SelectionProvider** (`src/providers/SelectionProvider.ts`): Shared Tier 3 provider with subscribe/getSelectedIds. Already used by NotebookExplorer internally.

### Established Patterns
- Canvas plug-in via registry — SuperWidget never imports concrete canvas classes (CANV-06)
- Config bag with explicit provider dependencies (ViewCanvasConfig pattern)
- Wrapper-div isolation for inner component mounting
- Status slot: idempotent DOM setup + update function (ViewCanvas._updateStatus pattern)
- Provider subscribe/unsubscribe with leak prevention on destroy

### Integration Points
- `registry.ts` — must register real EditorCanvas factory instead of EditorCanvasStub
- `main.ts` — wiring layer where providers are created; EditorCanvas needs bridge, selection, filter, alias, schema, mutations
- `SuperWidget.commitProjection()` — calls onProjectionChange() on mounted canvas (EditorCanvas may not need this since NE drives content from selection, not projection)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following ViewCanvas patterns established in Phase 171.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 172-editorcanvas*
*Context gathered: 2026-04-21*
