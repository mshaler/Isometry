# Phase 93: Property Editors - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can edit all 26 card fields via typed property inputs in the Notebook panel. Each property edit produces a single undoable mutation via `updateCardMutation` with correct before/after snapshots. Tags use a chip editor with autocomplete. Card type is editable via dropdown. A null-safe coercion utility converts input values to correct SQL types.

</domain>

<decisions>
## Implementation Decisions

### Property panel layout
- Properties appear BELOW the content textarea/preview area — scroll down from content to see properties
- 5 collapsible sections grouped by type:
  - **Identity**: name, card_type, tags, status, folder
  - **Dates**: due_at, completed_at, event_start, event_end, created_at, modified_at
  - **Location**: latitude, longitude, location_name
  - **Content**: content, summary, priority, sort_order, is_collective
  - **Source**: url, mime_type, source, source_id, source_url
- Sections collapse/expand with click. Most relevant section open by default based on card_type
- Read-only fields (id, created_at, modified_at, deleted_at) shown as disabled/greyed in their relevant section — visible for reference but not editable

### Tag chip editor
- Type + Enter with autocomplete dropdown from existing tags in dataset
- Autocomplete source: Worker query (`SELECT DISTINCT tags`) on input focus, cached for session
- Each add or remove of a tag is its own immediate undo step via `updateCardMutation` — no batch-on-blur
- Chips appear inline left of the input (GitHub label picker style)
- × close button on each chip to remove. Backspace in empty input removes last tag (keyboard shortcut)

### Input types per field category
- **Text fields** (name, content, summary, folder, status, url, mime_type, source, source_id, source_url, location_name): text inputs, blur-commit
- **Date fields** (due_at, completed_at, event_start, event_end): native `<input type="datetime-local">`. ISO format output. Clearing sets to NULL
- **Number fields** (priority, sort_order, latitude, longitude): `<input type="number">` with appropriate step/min/max (priority: step=1, lat/lng: step=0.000001). Non-numeric input rejected by browser
- **Boolean field** (is_collective): CSS toggle switch (styled checkbox). Immediate commit on toggle — no blur needed
- **Card type** (card_type): `<select>` dropdown with 5 options (note/task/event/resource/person). Simple select, no side effects — changing card_type only updates that column, no cascading field changes

### Null coercion rules
- Empty string → NULL for ALL nullable text fields (content, summary, folder, status, url, mime_type, source, source_id, source_url, location_name)
- Name is required — empty/whitespace-only rejected (must be non-empty)
- Clearing a date field sets the column to NULL (all date fields are nullable)
- Number fields: non-numeric values rejected by HTML input type, invalid values revert to snapshot on blur

### Validation feedback
- Inline red border + small error text below the field (e.g., "Must be a number", "Name is required")
- Field value not committed until valid — blur with invalid value reverts to last committed value from snapshot
- No toast for validation errors — inline hints only

### Claude's Discretion
- Exact CSS styling for property section headers, toggle switch, chip editor
- Section default open/closed state logic per card_type
- Autocomplete dropdown positioning and styling
- Whether name and content fields appear in both the existing editor area AND the Identity/Content sections, or only in the editor area with a reference note in the section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mutation system
- `src/mutations/MutationManager.ts` — MutationManager.execute(), undo(), redo(), subscribe() API
- `src/mutations/inverses.ts` — updateCardMutation(id, before, after), createCardMutation(), CARD_COLUMNS array, serializeTags(), boolToInt() helpers
- `src/mutations/types.ts` — Mutation, MutationCommand interfaces

### Notebook panel (integration target)
- `src/ui/NotebookExplorer.ts` — Shadow-buffer architecture (_snapshot, _bufferName, _bufferContent), blur-commit pattern, creation state machine, MutationManager subscriber, idle state
- `src/styles/notebook-explorer.css` — Existing notebook CSS classes

### Database schema
- `src/database/queries/types.ts` — Card interface (26 fields with exact types), CardInput interface, CardType union
- `src/database/queries/cards.ts` — createCard() SQL for reference on column order
- `CLAUDE-v5.md` — D-001..D-011 locked architecture decisions

### Worker bridge
- `src/worker/WorkerBridge.ts` — Existing bridge methods (will need tags:distinct query)
- `src/worker/protocol.ts` — WorkerPayloads/WorkerResponses type definitions

### Phase 91 context (predecessor — shadow-buffer decisions)
- `.planning/phases/91-mutationmanager-notebook-migration/91-CONTEXT.md` — Edit commit granularity, title editing UX, undo ownership, shadow-buffer pattern

### Phase 92 context (predecessor — creation flow)
- `.planning/phases/92-card-creation-flow/92-CONTEXT.md` — Creation state machine, post-creation flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `updateCardMutation(id, before, after)`: Already handles partial field updates with forward/inverse SQL. Tags serialized via `serializeTags()`, booleans via `boolToInt()`. Directly usable for every property edit
- `_snapshot: Card | null`: Shadow-buffer snapshot already captures full Card row on card load — provides the `before` parameter for every `updateCardMutation` call
- `MutationManager.execute()`: Triggers dirty flag → StateCoordinator → CloudKit sync pipeline — no new wiring needed
- `NotebookExplorer`: Already has blur-commit pattern for title/content — property editors follow the same commit trigger

### Established Patterns
- Blur-commit: Title and content blur → `updateCardMutation(_snapshot.id, _snapshot, { field: value })`. Property editors follow identical pattern
- MutationManager subscriber: Already detects card deletion and resets to idle — property panel inherits this behavior
- `bridge.send()` for Worker queries: Use for `tags:distinct` autocomplete query

### Integration Points
- `NotebookExplorer.mount()`: Property sections render below the existing content textarea/preview area
- `NotebookExplorer._loadCard()`: After loading shadow-buffer snapshot, populate all property inputs from `_snapshot` fields
- `NotebookExplorer._onSelectionChange()`: Card switch flushes all dirty property fields before loading new card (same blur-commit pattern)
- Worker: Needs new `tags:distinct` message type for autocomplete query

</code_context>

<specifics>
## Specific Ideas

- Property sections should feel like Notion's property panel — compact, clean labels, inline editors
- Tag chips should look like the existing LATCH category chips (`.latch-chip` class from Phase 67) for visual consistency
- Name and content are already edited in the main editor area above — they should NOT be duplicated in Identity/Content sections. Instead, those sections should show the other fields only
- The coercion utility (PROP-09) should be a standalone pure function: `coerceFieldValue(field: string, rawValue: string, schema: Card): unknown` — testable independently of UI

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 93-property-editors*
*Context gathered: 2026-03-18*
