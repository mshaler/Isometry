# Phase 64: Notebook Persistence - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-card notebook content that persists across reloads and syncs via the existing CloudKit checkpoint flow. Each card gets its own Markdown notebook (keyed as `notebook:{cardId}` in ui_state). Content survives reload and is included in database checkpoints automatically. Creating the notebook UI and formatting toolbar already exist (Phase 57 + Phase 63).

</domain>

<decisions>
## Implementation Decisions

### Card-notebook binding
- First selected card drives the notebook — when multiple cards are selected (Cmd+click), show the first card's notebook
- Hide the notebook section entirely when zero cards are selected (don't show a placeholder message)
- Auto-save immediately (flush to ui_state) when the user switches from card A to card B — bypass debounce on card switch to prevent data loss
- If user was on Preview tab, switching cards stays on Preview with the new card's rendered content

### Save behavior
- Debounced auto-save on every keystroke input event, at 500ms interval (matches existing StateManager debounce)
- No visual dirty-state indicator — 500ms debounce is fast enough that save state is invisible, consistent with other providers
- No manual save button — auto-save is the only mechanism

### Empty & loading states
- Empty textarea with grayed-out placeholder text ("Write Markdown...") for cards with no saved notebook content — no template, no boilerplate
- Instant content swap on card switch — no spinner, no skeleton (ui:get is sub-millisecond SQLite lookup)
- Remember notebook section collapsed/expanded state across card switches — WorkbenchShell already persists this via storageKey

### Content lifecycle
- Leave orphaned `notebook:{cardId}` rows in ui_state when cards are deleted — no cascade delete, preserves content if deletion is undone
- No cleanup/GC mechanism for orphaned rows — text is tiny, negligible storage impact, YAGNI
- No per-card size limit on notebook content — SQLite handles large text fine
- CloudKit sync is automatic — ui_state rows are part of the SQLite database checkpoint, server-wins conflict resolution applies, zero additional sync work needed

### Claude's Discretion
- Whether NotebookExplorer subscribes to SelectionProvider directly or WorkbenchShell passes activeCardId down — pick based on existing wiring patterns
- Whether to use StateManager register/markDirty pattern or direct bridge.send('ui:set') calls — notebook is per-card (many keys per provider) which differs from the one-key-per-provider StateManager model

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key constraint is that the existing NotebookExplorer class field (`_content`) becomes backed by ui_state instead of being session-only.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **NotebookExplorer** (`src/ui/NotebookExplorer.ts`): Session-only today with `_content` class field, Write/Preview tabs, formatting toolbar. Needs card-awareness and persistence wiring added.
- **ui_state handler** (`src/worker/handlers/ui-state.handler.ts`): Full CRUD — `ui:get`, `ui:set`, `ui:delete`, `ui:getAll`. Key-value with timestamps. Ready to use as-is.
- **StateManager** (`src/providers/StateManager.ts`): Debounced persistence for Tier 2 providers. 500ms debounce, PersistableProvider interface. May or may not fit the per-card-key model.
- **SelectionProvider** (`src/providers/SelectionProvider.ts`): Tier 3 ephemeral. Tracks Set of selected IDs with `subscribe()`, `getSelectedIds()`. Source of active card identity.

### Established Patterns
- **WorkerBridge send/receive**: All ui_state access goes through `bridge.send('ui:get'|'ui:set')`. Async but near-instant for SQLite lookups.
- **Provider subscribe pattern**: Providers expose `subscribe(cb)` returning unsubscribe function. Used by StateManager and views.
- **WorkbenchShell section mounting**: Collapsible sections with storageKey persistence. Notebook section configured with `defaultCollapsed: true`.
- **Checkpoint flow**: `sendCheckpoint()` in NativeBridge exports entire database as base64. Any ui_state rows (including notebook) are included automatically.

### Integration Points
- **NotebookExplorer.mount()**: Needs to accept WorkerBridge (or a save callback) and card ID. Currently takes only `container: HTMLElement`.
- **WorkbenchShell**: Manages NotebookExplorer lifecycle. Would need to wire selection changes → notebook card switch.
- **SelectionProvider subscription**: NotebookExplorer or WorkbenchShell subscribes to selection changes to trigger card switch logic.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 64-notebook-persistence*
*Context gathered: 2026-03-09*
