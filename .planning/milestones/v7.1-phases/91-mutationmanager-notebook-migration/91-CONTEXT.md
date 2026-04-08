# Phase 91: MutationManager + Notebook Migration - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

NotebookExplorer switches from ui_state-backed persistence to MutationManager-backed card editing. Title and content editing use shadow-buffer architecture (snapshot on load, mutable buffer during edit, single MutationManager mutation on commit). Legacy notebook:{cardId} data in ui_state is migrated to cards.content on boot. CloudKit sync fires via existing dirty flag pipeline.

</domain>

<decisions>
## Implementation Decisions

### Edit commit granularity
- Shadow-buffer commits on blur, card switch, or Cmd+S — NOT on debounce timer or per-keystroke
- One undo step per field: title blur commits title mutation, content blur commits content mutation independently
- No idle auto-commit timer — blur/switch/save only. Standard text editor crash behavior (unsaved changes lost)
- No dirty indicator in the UI — commit is automatic on blur, users don't need to think about saving

### Title editing UX
- Separate `<input>` element for title above the textarea for content — clear field separation
- Borderless input with larger/bolder font than content textarea. Focus ring only on focus. Feels like typing a document title
- Placeholder text: "Untitled" (matches Notion/Apple Notes convention)
- Title blur triggers independent MutationManager mutation via updateCardMutation(id, before, { name: newValue })

### Migration strategy
- Run on boot, silently, guarded by sentinel key `notebook:migration:v1` in ui_state
- SELECT all `notebook:{cardId}` keys from ui_state, UPDATE corresponding cards.content for each
- Conflict resolution: if cards.content is already non-null/non-empty, skip that card (cards.content wins)
- DELETE migrated `notebook:{cardId}` keys from ui_state after successful migration
- No UI feedback — fast batch operation, transparent to user

### Undo ownership in textarea
- While focused in textarea/input: browser-native undo handles keystroke-level undo (Cmd+Z)
- After blur commits to MutationManager: Cmd+Z from outside the editor undoes the whole edit session
- Two-layer undo: browser-native within editing, MutationManager after commit. Each appropriate for its context
- ShortcutRegistry continues to skip TEXTAREA/INPUT elements — no change to existing guard
- Notebook resets to idle state (empty panel with "Select a card" placeholder) when active card is deleted by undo — same as zero-selection state via `_setVisible(false)`
- Notebook subscribes to MutationManager. On notification, checks if `_activeCardId` still exists via bridge query. If gone, resets to idle
- Shadow-buffer snapshot queries full card row (SELECT * WHERE id = ?) on card load. Full Card object stored for updateCardMutation `before` parameter. Future-proofs for Phase 93 property editors

### Claude's Discretion
- Exact CSS styling for the title input (font-size, font-weight, padding)
- Worker protocol additions needed for card-by-id query (if not already available)
- Migration batch size and error handling strategy
- MutationManager subscription callback debounce/optimization

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mutation system
- `src/mutations/MutationManager.ts` — MutationManager.execute(), undo(), redo(), subscribe() API
- `src/mutations/inverses.ts` — updateCardMutation(id, before, after), createCardMutation(), deleteCardMutation() generators
- `src/mutations/types.ts` — Mutation, MutationCommand interfaces
- `src/mutations/shortcuts.ts` — ShortcutRegistry TEXTAREA/INPUT guard pattern (deprecated but documents the skip logic)

### Notebook panel
- `src/ui/NotebookExplorer.ts` — Current implementation: ui_state persistence, selection binding, debounced save, tab switching, formatting toolbar
- `src/styles/notebook-explorer.css` — Existing notebook CSS classes

### Worker bridge
- `src/worker/protocol.ts` — WorkerPayloads/WorkerResponses for ui:get, ui:set, ui:getAll
- `src/worker/handlers/ui-state.handler.ts` — handleUiGet, handleUiSet, handleUiGetAll SQL

### Database schema
- `CLAUDE-v5.md` — D-001..D-011 locked architecture decisions, 26-column card schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MutationManager`: Already has execute/undo/redo/subscribe/dirty flag — wire NotebookExplorer as a consumer
- `updateCardMutation(id, before, after)`: Generates partial-field UPDATE with forward/inverse SQL — use directly for title and content commits
- `SelectionProvider.subscribe()`: NotebookExplorer already subscribes for card binding — reuse for card switch commit trigger
- `ChartRenderer` + `marked` + `DOMPurify`: Preview pipeline stays unchanged — only the persistence layer changes
- `_undoSafeInsert()`: Browser-native undo via execCommand trick — continues to own keystroke-level undo within the textarea

### Established Patterns
- `MutationManager.subscribe()`: rAF-batched notifications — Notebook can add a subscriber to detect card deletion
- `bridge.send('ui:set/get')`: Current persistence pattern — will be replaced by MutationManager.execute() for card fields, but ui_state still used for non-card state (view preferences, etc.)
- `_onSelectionChange()` flush pattern: blur → save → clear → load new card. Shadow-buffer follows same flow but routes through MutationManager instead of ui_state

### Integration Points
- `main.ts`: MutationManager is already instantiated and wired. NotebookExplorer constructor needs MutationManager injected via config
- `StateCoordinator`: MutationManager.execute() triggers dirty flag → CloudKit sync pipeline (EDIT-06 already covered)
- Worker: May need a `card:getById` message type for loading the full Card row as shadow-buffer snapshot

</code_context>

<specifics>
## Specific Ideas

- Shadow-buffer pattern: `_snapshot: Card | null` captured on card load, `_bufferName: string` and `_bufferContent: string` mutated during editing, commit generates `updateCardMutation(_snapshot.id, _snapshot, { name: _bufferName })` on title blur and `updateCardMutation(_snapshot.id, _snapshot, { content: _bufferContent })` on content blur
- Title input should feel like a document title — large, borderless, immediate typing. Similar to Notion's title field
- Migration is a one-shot batch: enumerate ui_state keys matching `notebook:%`, for each with non-empty content where cards.content IS NULL, UPDATE cards SET content = ?, then DELETE from ui_state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 91-mutationmanager-notebook-migration*
*Context gathered: 2026-03-18*
