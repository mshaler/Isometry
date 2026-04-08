# Phase 92: Card Creation Flow - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create new cards by typing in the Notebook panel. A state machine (idle → buffering → editing) prevents ghost cards from IME composition, auto-correct, or accidental touches. New cards are immediately visible in all active views via the existing MutationManager → StateCoordinator pipeline. CloudKit sync fires via existing dirty flag pipeline.

</domain>

<decisions>
## Implementation Decisions

### Creation trigger UX
- Both "New Card" button + Cmd+N keyboard shortcut
- "New Card" button appears ONLY in the idle state panel (no card selected) — prominent, discoverable
- When a card IS selected (editing mode), NO button — Cmd+N is the only way to create
- Command Palette gets a "New Card" action (Cmd+K → "new card") that opens Notebook and enters creation mode
- When Cmd+N is pressed while editing a card: auto-commit current dirty buffer via MutationManager first (same as blur behavior from Phase 91), then enter creation mode
- Auto-commit + create produces TWO separate undo steps (not a combined transaction)

### Ghost card prevention (state machine)
- State machine: idle → buffering → editing
- Buffering state: title input is visible and focused, but NO database INSERT yet — input held in memory only
- Card is INSERTed on first non-whitespace name commit (blur or Cmd+S)
- Abandoning: blur with empty/whitespace-only name returns to idle — no card created, no DB write
- Escape key during buffering: cancels creation, clears name input, returns to idle state
- IME handling: compositionend event gate — only evaluate commit/abandon decision AFTER compositionend fires. During composition, do not check input value
- Cmd+N while already in buffering state: commit current name (if non-whitespace), then enter fresh buffering state for rapid creation. If name is empty/whitespace, abandon current and start fresh

### Post-creation flow
- After INSERT completes: SelectionProvider.select(newCardId) fires immediately
- Notebook transitions from buffering → editing state with new card loaded as shadow-buffer snapshot
- Focus moves to content textarea so user can start writing immediately (title is committed, now write content)
- Default values: card_type='note', name=typed value, everything else null. createCardMutation handles created_at/modified_at automatically
- No ActionToast — the Notebook transition to editing mode IS the visual feedback
- All active views see the new card via existing pipeline: createCardMutation → MutationManager.execute() → dirty flag → StateCoordinator re-query → views re-render

### Undo of created cards
- Cmd+Z after card creation: MutationManager undo fires deleteCardMutation inverse
- NotebookExplorer's existing mutation subscriber (EDIT-07) detects card is gone → resets to idle state
- No "previous selection" tracking needed — undo simply returns to idle

### CloudKit sync
- Existing dirty flag pipeline handles sync — no special-case logic for new cards
- createCardMutation → MutationManager.execute() → dirty flag → CloudKit changeset dispatch (CREA-04 satisfied by existing wiring)

### Claude's Discretion
- Exact CSS for the "New Card" button in idle state (size, color, icon)
- ShortcutRegistry wiring for Cmd+N (may need new entry or extend existing)
- CommandPalette action registration pattern for "New Card"
- State machine implementation approach (enum vs class vs simple boolean flags)
- compositionend event listener attachment strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mutation system
- `src/mutations/MutationManager.ts` — MutationManager.execute(), undo(), redo(), subscribe() API
- `src/mutations/inverses.ts` — createCardMutation(input), updateCardMutation(id, before, after), deleteCardMutation() generators
- `src/mutations/types.ts` — Mutation, MutationCommand interfaces

### Notebook panel
- `src/ui/NotebookExplorer.ts` — Current implementation: shadow-buffer architecture, idle state, title input, content textarea, MutationManager subscriber for card deletion detection (EDIT-07)
- `src/styles/notebook-explorer.css` — Existing notebook CSS classes

### Selection + state coordination
- `src/providers/SelectionProvider.ts` — select(id), toggle(id), subscribe() for ephemeral selection
- `src/providers/StateCoordinator.ts` — Subscribes to providers, batches re-query notifications to views

### Worker bridge
- `src/worker/WorkerBridge.ts` — createCard(input) method (sends card:create)
- `src/worker/protocol.ts` — WorkerPayloads/WorkerResponses for card:create
- `src/database/queries/cards.ts` — createCard() SQL INSERT implementation

### Command Palette
- `src/palette/` — CommandPalette action registration pattern

### Shortcuts
- `src/shortcuts/` — ShortcutRegistry for keyboard shortcut registration (TEXTAREA/INPUT guard)

### Architecture decisions
- `CLAUDE-v5.md` — D-001..D-011 locked architecture decisions

### Phase 91 context (predecessor)
- `.planning/phases/91-mutationmanager-notebook-migration/91-CONTEXT.md` — Shadow-buffer decisions, commit patterns, undo ownership

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createCardMutation(input: CardInput)`: Already generates UUID + INSERT SQL with forward/inverse — use directly for card creation
- `SelectionProvider.select(id)`: Sets single selection and notifies subscribers — use for auto-selecting new card
- `MutationManager.execute()`: Triggers dirty flag pipeline → StateCoordinator → CloudKit sync — no new wiring needed
- `NotebookExplorer._snapshot / _bufferName / _bufferContent`: Shadow-buffer pattern from Phase 91 — creation flow extends this with a buffering pre-state
- `NotebookExplorer._setVisible(false)`: Existing idle state display — reuse for abandon/undo transitions
- NotebookExplorer mutation subscriber (EDIT-07): Already checks if `_activeCardId` still exists on mutation notification — handles undo of created card automatically

### Established Patterns
- `MutationManager → StateCoordinator` subscription pipeline: All mutations automatically trigger view re-queries. No manual view.render() calls needed
- Blur-commits pattern (Phase 91): Title and content commit on blur/switch/Cmd+S. Creation commit follows the same blur trigger
- `ShortcutRegistry`: Single keydown listener with input field guard (skips TEXTAREA/INPUT). Cmd+N needs registration here
- `CommandPalette` action registration: Existing pattern for adding palette commands

### Integration Points
- `main.ts`: NotebookExplorer already receives MutationManager, SelectionProvider, WorkerBridge via config — no new dependency injection needed
- `src/shortcuts/`: Register Cmd+N shortcut
- `src/palette/`: Register "New Card" action
- `NotebookExplorer.mount()`: Add "New Card" button to idle state DOM

</code_context>

<specifics>
## Specific Ideas

- State machine should be explicit: `_creationState: 'idle' | 'buffering' | 'editing'` — not derived from multiple boolean flags
- In buffering state, the title input replaces the idle panel content. Same `<input>` element as editing mode but Notebook knows no card exists yet
- Rapid creation via Cmd+N during buffering: commit-if-valid → fresh buffer. Allows power users to quickly create multiple named cards in succession
- compositionend gate: set a `_isComposing` flag on compositionstart, clear on compositionend. Blur handler checks `_isComposing` — if true, defer commit evaluation until compositionend fires

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 92-card-creation-flow*
*Context gathered: 2026-03-18*
