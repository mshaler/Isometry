# Architecture Research

**Domain:** Notebook Card Editor — integration into existing Isometry Workbench
**Researched:** 2026-03-18
**Confidence:** HIGH (all integration points verified from direct source analysis)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           main.ts (app bootstrap)                        │
│   Wires all providers, creates WorkbenchShell, ViewManager, explorers    │
├─────────────────────────────────────────────────────────────────────────┤
│  UI Layer (src/ui/)                                                       │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │WorkbenchShell│  │NotebookExplorer  │  │CardEditorPanel (NEW)       │  │
│  │(DOM orchest) │  │(sidebar panel)   │  │typed property fields for   │  │
│  │5 panel rails │  │MODIFIED: writes  │  │name/type/dates/tags/url    │  │
│  │+view-content │  │cards.content via │  │subscribes to SelectionProv │  │
│  └──────────────┘  │MutationManager   │  │holds MutationManager ref   │  │
│                    └─────────┬────────┘  └────────────┬───────────────┘  │
│                              │                        │                  │
├──────────────────────────────┼────────────────────────┼──────────────────┤
│  Provider Layer (src/providers/)                      │                  │
│  ┌───────────────┐  ┌────────────────────┐  ┌─────────────────────────┐  │
│  │SelectionProv  │  │MutationManager     │  │StateCoordinator         │  │
│  │ephemeral sel  │  │sole write gate     │  │batches provider changes  │  │
│  │drives panel   │  │execute/undo/redo   │  │setTimeout(16) → 1 notif │  │
│  │binding        │  │dirty flag CloudKit │  │per frame                │  │
│  └───────┬───────┘  └────────┬───────────┘  └─────────────────────────┘  │
│          │  subscribe()       │  execute(mutation)                        │
├──────────┼────────────────────┼──────────────────────────────────────────┤
│  Mutation Layer (src/mutations/)                                          │
│  ┌───────────────────────────────────────────────────────────────┐        │
│  │ inverses.ts                                                    │        │
│  │   createCardMutation(input: CardInput): Mutation               │        │
│  │   updateCardMutation(id, before: Card, after: Partial<CardInput>)│      │
│  │   deleteCardMutation(card: Card): Mutation                     │        │
│  │   batchMutation(desc, ...mutations): Mutation                  │        │
│  └───────────────────────────────────────────────────────────────┘        │
├─────────────────────────────────────────────────────────────────────────┤
│  Worker Layer (src/worker/)                                               │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ WorkerBridge: typed async RPC                                     │    │
│  │ send('card:create' | 'card:get' | 'card:update' | 'card:delete') │    │
│  │ send('ui:get' | 'ui:set' | 'ui:delete')                          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│  Database (sql.js WASM — Worker-owned)                                    │
│  ┌───────────────────────────────────────┐  ┌────────────────────────┐   │
│  │  cards table (26 columns)             │  │ ui_state table (kv)    │   │
│  │  id, card_type, name, content, ...    │  │ notebook:{cardId} keys │   │
│  │  tags, status, priority, due_at...    │  │ (LEGACY — being migr.) │   │
│  └───────────────────────────────────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `NotebookExplorer` | Workbench sidebar Markdown write/preview panel; per-card content persistence | MODIFIED: migrate from `ui_state` → `cards.content` via MutationManager |
| `MutationManager` | Sole write gate — execute/undo/redo, dirty flag for CloudKit, rAF-batched notifications | UNCHANGED |
| `inverses.ts` | Forward+inverse SQL factories for create/update/delete | UNCHANGED: `updateCardMutation` already handles `Partial<CardInput>` |
| `SelectionProvider` | Ephemeral selection — drives which card the editor panels show | UNCHANGED |
| `StateCoordinator` | Batches multi-provider change notifications for view re-queries | UNCHANGED |
| `WorkerBridge` | Typed async RPC to sql.js Worker | UNCHANGED: `card:create`, `card:get`, `card:update` already exist |
| `CardEditorPanel` | Full property editor for all 26 card fields; subscribes to SelectionProvider, writes via MutationManager | NEW |
| `CardPropertyFields` | Reusable typed input widgets: tag pill editor, ISO date input, card_type select, priority stepper | NEW |

---

## Recommended Project Structure

```
src/
├── ui/
│   ├── NotebookExplorer.ts     # MODIFIED: inject MutationManager, shadow-buffer, migrate saves
│   ├── CardEditorPanel.ts      # NEW: full property editor (name, type, dates, tags, etc.)
│   ├── CardPropertyFields.ts   # NEW: typed field inputs (tag-pill, date, select, stepper)
│   └── ...existing explorers (unchanged)
├── mutations/
│   ├── inverses.ts             # UNCHANGED
│   └── MutationManager.ts     # UNCHANGED (may add replaceMutation() if needed)
├── providers/
│   └── SelectionProvider.ts    # UNCHANGED
├── styles/
│   ├── notebook-explorer.css   # MODIFIED: expanded mode styles if applicable
│   └── card-editor.css         # NEW: property field layout, tag pill, date input styles
└── views/
    └── CardRenderer.ts         # POSSIBLY MODIFIED: 1x/2x/5x/10x dimension CSS classes
```

### Structure Rationale

- **`CardEditorPanel` in `src/ui/`:** All workbench-level panels live here (PropertiesExplorer, ProjectionExplorer, NotebookExplorer, CalcExplorer). The card editor is a panel, not a view.
- **`CardPropertyFields` as a separate file:** Typed input widgets (tag pill editor, ISO date handling, select for card_type/status) are complex and reusable. Same pattern as `ChartRenderer` being extracted from `NotebookExplorer`.
- **`inverses.ts` unchanged:** `updateCardMutation(id, before, after)` already accepts any `Partial<CardInput>`. No new mutation types are needed — partial field updates of any subset of the 26 columns are already supported.

---

## Architectural Patterns

### Pattern 1: Selection-Driven Panel Binding (EXISTING — replicate exactly)

**What:** Explorer panels subscribe to `SelectionProvider`. On selection change, they flush the current card's pending state, then load the new card. This pattern is fully established in `NotebookExplorer._onSelectionChange()`.

**When to use:** Any panel that is "per-card" — switches its displayed content when the user selects a different card in any view.

**Trade-offs:** The flush-on-switch + stale async guard is load-bearing. Without the stale guard, rapid card switching produces races where a slow card:get response populates the editor with wrong card data.

**Critical details to replicate:**
```typescript
private async _onSelectionChange(): Promise<void> {
    const ids = this._selection.getSelectedIds();
    const newCardId = ids.length > 0 ? ids[0]! : null;

    if (newCardId === this._activeCardId) return;  // same card, no-op

    // Flush pending writes for PREVIOUS card before switching
    if (this._activeCardId !== null && this._dirty) {
        this._cancelSave();
        await this._commitCurrentCard();  // executes mutation
        this._dirty = false;
    }

    this._activeCardId = newCardId;
    if (newCardId === null) { this._setVisible(false); return; }

    // Load new card
    const card = await this._bridge.send('card:get', { id: newCardId });
    if (this._activeCardId !== newCardId) return;  // STALE GUARD — mandatory

    this._snapshot = card;   // capture before state for updateCardMutation
    this._buffer = { ...card };  // mutable working copy
}
```

### Pattern 2: MutationManager Write Gate (EXISTING — extend to Notebook content)

**What:** Every entity write goes through `MutationManager.execute(mutation)`. The mutation object carries both forward SQL and inverse SQL, computed at creation time from `inverses.ts`. This is how undo/redo and CloudKit dirty flagging work.

**When to use:** Any time a card field value changes due to user action in the editor. The card editor must not call `bridge.send('card:update')` directly.

**Critical injection point:** `CardEditorPanel` must receive `MutationManager` in its constructor config. Precedent: `KanbanView` already receives `{ mutationManager }` in its constructor. `NotebookExplorer` currently does NOT have this — it must be added.

**The `before` snapshot rule:** The `before: Card` argument to `updateCardMutation` must be captured when the card is loaded into the editor (on selection change), not when the commit fires. Lazy snapshot capture risks incorporating concurrent mutation side-effects (e.g., a CloudKit sync arriving between edit-start and commit).

### Pattern 3: Shadow Buffer with Session Commit (NEW DECISION)

**What:** Keep a mutable `_buffer` copy of the card in editor memory. User edits update `_buffer` in place (no DB write). A single `updateCardMutation` fires on commit (blur, card-switch, Cmd+S), using the diff of `_snapshot` vs `_buffer` as the `after` argument.

**When to use:** The content field (continuous text input) and all typed property fields. This avoids the undo-history explosion that would result from a mutation-per-keystroke or mutation-per-debounce approach.

**Trade-offs:**
- Commit triggers: blur + card-switch + explicit save (Cmd+S). Auto-save every 30 seconds as a safety net (NOT 500ms — that creates too many undo entries).
- Undo granularity: one undo step per "editing session" on a card. This is better than per-field or per-keystroke.
- Data loss window: content entered in the last 30 seconds before an unexpected close. Acceptable for local-first with persistent sql.js checkpoint.

**DO NOT use the NotebookExplorer's existing 500ms debounce-to-ui_state pattern for MutationManager writes.** That pattern was designed for a key-value store without undo history.

### Pattern 4: Card Creation — Draft Buffer, Commit on Non-Empty Name

**What:** When the card editor opens in "new card" mode (nothing selected), show empty fields. Keep the draft in memory as a `_buffer` object with no `id`. Only INSERT (via `createCardMutation`) when `name.trim() !== ''` and the user commits.

**When to use:** The "start typing to create a card" flow.

**Why not insert immediately on open:** An empty INSERT creates a card with no name that appears in all 9 views. These orphan rows are hard to clean up without a separate garbage-collection step. Deferring INSERT until a non-empty name exists is the correct approach.

**Commit triggers for new cards:** Same as existing card edits — blur, explicit Cmd+S, or switching selection. On commit with a non-empty name, call `createCardMutation`, execute it, then call `selection.select(newCardId)` to bind the editor to the newly created card.

```typescript
private async _commitDraft(): Promise<void> {
    if (this._buffer.name.trim() === '') return;  // never insert unnamed cards

    const mutation = createCardMutation({
        name: this._buffer.name,
        content: this._buffer.content ?? null,
        card_type: this._buffer.card_type ?? 'note',
        source: 'user',
        // ... other buffer fields
    });
    await this._mutationManager.execute(mutation);

    // Transition from draft mode to editing mode
    this._activeCardId = mutation.id;  // id was generated in createCardMutation
    const card = await this._bridge.send('card:get', { id: mutation.id });
    this._snapshot = card;

    // Select the new card so views update and other panels bind to it
    this._selection.select(mutation.id);
}
```

### Pattern 5: Notebook Content Migration (ui_state → cards.content)

**What:** The existing NotebookExplorer saves markdown to `ui_state` (key `notebook:{cardId}`). The new milestone moves this to `cards.content` via MutationManager. Migration must be transparent — existing user data must not be lost.

**Migration path:**
```typescript
// On card load in NotebookExplorer._onSelectionChange():
const legacyResult = await this._bridge.send('ui:get', { key: `notebook:${newCardId}` });
if (legacyResult.value !== null) {
    // Legacy data exists — use it, mark for migration
    this._content = legacyResult.value;
    this._legacyMigrationPending = true;
} else {
    // No legacy data — read from cards.content (new path)
    this._content = card.content ?? '';
    this._legacyMigrationPending = false;
}

// On first commit with _legacyMigrationPending === true:
const mutation = updateCardMutation(cardId, snapshot, { content: this._content });
await this._mutationManager.execute(mutation);
await this._bridge.send('ui:delete', { key: `notebook:${cardId}` });
this._legacyMigrationPending = false;
```

**Invariant after migration:** `cards.content` is the canonical store. `ui_state` entries with `notebook:` prefix are deleted on first save.

---

## Data Flow

### Existing Card Edit Flow

```
User selects card in any view
    |
    v
SelectionProvider.select(cardId) → notifies subscribers
    |
    v
CardEditorPanel._onSelectionChange()
    |
    v
card = await bridge.send('card:get', { id: cardId })
_snapshot = card     ← before state locked here
_buffer = { ...card } ← mutable working copy
    |
    v
User edits field (name, tags, due_at, content, etc.)
    |
_buffer[field] = newValue   ← in-memory ONLY, no DB write
    |
    v
User commits (blur / card-switch / Cmd+S / 30s auto-save)
    |
    v
changedFields = diff(_snapshot, _buffer)
if (changedFields.length > 0):
    mutation = updateCardMutation(cardId, _snapshot, changedFields)
    await mutationManager.execute(mutation)
    _snapshot = await bridge.send('card:get', { id: cardId })  ← refresh snapshot
    |
    v
MutationManager.scheduleNotify() → rAF → subscribers notified
    |
    v
StateCoordinator.scheduleUpdate() → setTimeout(16)
    |
    v
ViewManager._fetchAndRender() → views show updated card data
```

### New Card Creation Flow (start-typing)

```
CardEditorPanel opened with no selection (or explicit "New Card" action)
    |
    v
_state = { mode: 'draft' }
_buffer = { name: '', content: '', card_type: 'note', ... }
    |
    v
User types in name field → _buffer.name updated in memory
    |
    v
User commits (blur / Cmd+S / explicit action)
    |
    v
if (_buffer.name.trim() === '') return  ← no-op, no orphan row
    |
    v
mutation = createCardMutation({ name, content, card_type, source: 'user', ... })
await mutationManager.execute(mutation)
    |
    v
selection.select(mutation.id)   ← views update + editor binds to new card
_state = { mode: 'editing', cardId: mutation.id }
_snapshot = freshCard
```

### Notebook Content Write Flow (post-migration)

```
User edits markdown in NotebookExplorer textarea
    |
_content = textarea.value   (in-memory buffer, _dirty = true)
    |
On commit (blur / card-switch / 30s timer):
    |
    v
mutation = updateCardMutation(cardId, _snapshot, { content: _content })
await mutationManager.execute(mutation)
_dirty = false
_snapshot = { ..._snapshot, content: _content }  ← update local snapshot
    |
    v
MutationManager notifies → StateCoordinator → views re-query
(views read cards.content — now matches what user typed)
```

### State Management

```
[SelectionProvider]
    | subscribe()
    v
[CardEditorPanel / NotebookExplorer]
    | card:get via WorkerBridge
    v
_snapshot captured at load time
    |
user edits → _buffer mutated in memory
    |
commit → diff(_snapshot, _buffer) → updateCardMutation()
    |
[MutationManager.execute()]
    | scheduleNotify() rAF
    v
[MutationManager subscribers]
    | (StateCoordinator registered as subscriber via Provider reg)
    v
[StateCoordinator.scheduleUpdate()]
    | setTimeout(16)
    v
[ViewManager._fetchAndRender()]
    | re-queries Worker
    v
[All 9 views refresh with updated card data]
```

---

## Integration Points

### New vs Modified Components

| Component | Status | Change Description |
|-----------|--------|--------------------|
| `NotebookExplorer` | MODIFIED | Add `MutationManager` to constructor config; replace 500ms-debounce-to-ui_state with shadow-buffer + commit-via-mutation; implement legacy migration path |
| `CardEditorPanel` | NEW | Full property editor for all 26 card fields; subscribes to SelectionProvider; holds MutationManager + WorkerBridge refs; draft buffer for new card creation |
| `CardPropertyFields` | NEW | Typed input widgets: tag pill editor (comma/enter to add, click to remove), ISO date input (display-friendly, store ISO), card_type/status select, priority number stepper |
| `WorkbenchShell` | POSSIBLY MODIFIED | May need new CollapsibleSection entry for CardEditorPanel if it lives in panel rail (currently 5 sections: Notebook, Properties, Projection, LATCH, Calc) |
| `main.ts` | MODIFIED | Inject `mutationManager` into `NotebookExplorer` (currently absent); inject into `CardEditorPanel`; mount `CardEditorPanel` in WorkbenchShell |
| `inverses.ts` | UNCHANGED | `updateCardMutation` already handles `Partial<CardInput>`; no new mutation types needed |
| `MutationManager` | UNCHANGED | `execute()`, `undo()`, `redo()` are sufficient; `replaceMutation()` not needed if shadow-buffer-per-session is used |
| `protocol.ts` | UNCHANGED | `card:create`, `card:update`, `card:get`, `ui:get`, `ui:set`, `ui:delete` all exist |
| `WorkerBridge` | UNCHANGED | |
| `SelectionProvider` | UNCHANGED | |
| `StateCoordinator` | UNCHANGED | |
| `CardRenderer.ts` | POSSIBLY MODIFIED | If 1x/2x/5x/10x card dimension CSS classes are applied globally across views |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `CardEditorPanel` ↔ `SelectionProvider` | `selection.subscribe()` | Stale guard (`if (_activeCardId !== newCardId) return`) is mandatory |
| `CardEditorPanel` ↔ `MutationManager` | `execute(mutation)` | MutationManager injected via constructor config; never call `bridge.send('card:update')` directly |
| `CardEditorPanel` ↔ `WorkerBridge` | `bridge.send('card:get')` read-only queries | Reads bypass MutationManager; writes always go through MutationManager |
| `NotebookExplorer` ↔ `MutationManager` | `execute(updateCardMutation)` | NEW dependency — currently absent; must be added to constructor config |
| `CardEditorPanel` ↔ `NotebookExplorer` | None — siblings in panel rail | Both subscribe independently to SelectionProvider |
| `CardEditorPanel` ↔ `StateCoordinator` | Indirect — MutationManager notifies → coordinator fires | No direct dependency; do not subscribe CardEditorPanel to StateCoordinator |

### Content Field Ownership Decision

Both `NotebookExplorer` (markdown editor) and `CardEditorPanel` (property editor) affect the card. Two models exist:

**Model A — Split ownership (RECOMMENDED for this milestone):**
- `NotebookExplorer` owns `cards.content` (markdown body)
- `CardEditorPanel` owns all other fields (name, card_type, folder, tags, status, priority, dates, url, location)
- Each has its own `_snapshot` and `_buffer` for its field set
- Risk: two separate undo streams. Mitigation: each panel's undo step is labelled (`Update card content` vs `Update card properties`) so the history is readable

**Model B — Unified ownership (deferred):**
- `CardEditorPanel` owns all fields including content
- `NotebookExplorer` becomes a display/edit widget that reports `contentChange` events up to CardEditorPanel
- Cleaner undo history but a larger refactor; better as a follow-on milestone

Model A is recommended here. It minimizes the surface area of change and allows the two panels to evolve independently.

### Card Dimensions Integration

Card dimensions (1x/2x/5x/10x) control per-card display size across views. Assessment:

- The existing `SuperDensityProvider` controls **grid-level** density (compact/normal/spacious/ultra). Dimensions are a **per-card** property. These are orthogonal.
- The 26-column Card schema has no `dimension` field. Adding one requires a schema migration.
- Recommended: Store dimension as `ui_state` key `dimension:{cardId}` to avoid schema migration complexity in this milestone. Apply as CSS class in `CardRenderer` and view-specific render functions. Revisit schema migration in a subsequent milestone if dimensions need to participate in CloudKit sync.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user (current) | All in-memory shadow buffer; sql.js sync; CloudKit for cross-device |
| Multi-card batch edit | `batchMutation()` already exists for atomic multi-field, multi-card operations in one undo step |
| Large content (>100KB markdown) | No change needed — sql.js TEXT columns have no practical size limit for single-user local databases |

### Scaling Priorities

1. **First bottleneck — undo history depth:** `MutationManager` caps at 100 entries (`MAX_HISTORY = 100`). With shadow-buffer-per-session (one mutation per editing session), this is not a problem. If the pattern is changed to per-field or per-debounce, the cap is hit quickly. Preserve session-level granularity.

2. **Second bottleneck — card:get latency on selection change:** Currently fast because sql.js is in-memory (typically <2ms). No change needed for single-user scale. If it ever becomes an issue, the solution is caching the last-loaded card in editor memory, not bypassing the Worker.

---

## Anti-Patterns

### Anti-Pattern 1: Writing Directly via bridge.send('card:update')

**What people do:** Call `bridge.send('card:update', { id, updates })` directly from the card editor.

**Why it's wrong:** Bypasses MutationManager — no undo history, no dirty flag (CloudKit sync is broken), no subscriber notification (views do not re-render). The card silently updates in the DB but the undo stack is inconsistent.

**Do this instead:** Always go through `mutationManager.execute(updateCardMutation(id, before, after))`.

### Anti-Pattern 2: Capturing the Snapshot Inside the Commit Handler

**What people do:** Call `bridge.send('card:get', { id })` inside the commit function to build the `before` parameter.

**Why it's wrong:** The `before` state for the inverse SQL must be captured BEFORE the user starts editing. If captured lazily at commit time, a concurrent mutation (CloudKit sync arriving between edit-start and commit) can corrupt the inverse SQL with stale values — making undo restore a mix of the pre-edit state and the sync-applied state.

**Do this instead:** Capture `_snapshot = card` immediately when the card is loaded into the editor (in `_onSelectionChange`). Use this snapshot as the `before` parameter for the entire editing session.

### Anti-Pattern 3: Creating a Card Row Before the User Commits a Name

**What people do:** INSERT an empty card row when the editor opens in "new card" mode to obtain an ID immediately.

**Why it's wrong:** Creates orphan rows in the DB if the user dismisses without typing. These unnamed cards appear in all 9 views and SuperGrid. Hard to clean up without a separate garbage-collection step.

**Do this instead:** Keep the draft in memory as a `_buffer` object with no `id`. Only call `createCardMutation` when `name.trim() !== ''` at commit time.

### Anti-Pattern 4: Subscribing CardEditorPanel to StateCoordinator

**What people do:** Subscribe the card editor to `StateCoordinator` to refresh card data whenever any provider changes.

**Why it's wrong:** StateCoordinator fires on EVERY provider change — filter adjustments, PAFV axis changes, density changes, etc. The card editor only needs to react to `SelectionProvider` changes. Subscribing to the coordinator causes unnecessary `card:get` round-trips every time the user adjusts a filter or moves an axis.

**Do this instead:** Subscribe only to `SelectionProvider`. The editor data is independent of filter/PAFV/density state.

### Anti-Pattern 5: Using 500ms Debounce to MutationManager

**What people do:** Port the NotebookExplorer's 500ms debounce pattern directly to MutationManager — creating a new mutation every 500ms of typing.

**Why it's wrong:** 500ms typing creates ~60 mutation entries per minute of editing. With a 100-entry undo history cap, a 2-minute editing session fills the entire history with content edits, displacing all other undo steps (card creation, property changes, etc.).

**Do this instead:** Shadow buffer in memory. Commit via a single mutation on session end (blur, card-switch, Cmd+S, or 30-second checkpoint). One undo step per editing session.

---

## Build Order

Based on component dependencies and risk profile:

1. **Inject MutationManager into NotebookExplorer + implement shadow-buffer** — Isolated change to an existing, well-tested component. Validates the shadow-buffer pattern with an existing test harness. Implements the notebook migration path. Lowest risk, highest leverage.

2. **Build CardPropertyFields** — Typed input widgets with no external dependencies. Tag pill editor, ISO date input, card_type/status select, priority stepper. Can be developed and unit-tested in complete isolation.

3. **Build CardEditorPanel** — Depends on CardPropertyFields (step 2), SelectionProvider, MutationManager, WorkerBridge. Wire into WorkbenchShell after standalone component testing. Implement draft buffer + commit logic.

4. **Add start-typing card creation in CardEditorPanel** — Depends on CardEditorPanel (step 3) being functional. The "empty state → draft → commit → selection.select()" flow is the final integration piece.

5. **Card dimensions (ui_state-backed)** — Independent of steps 1-4. Can be added to `CardRenderer` and any view that needs to read `dimension:{cardId}` at any point. No schema migration required.

---

## Sources

- Direct codebase analysis:
  - `src/ui/NotebookExplorer.ts` — selection binding, debounce, ui_state persistence, chart rendering pipeline
  - `src/mutations/inverses.ts` — `createCardMutation`, `updateCardMutation`, `deleteCardMutation`, `batchMutation`
  - `src/mutations/MutationManager.ts` — execute/undo/redo, rAF batching, MAX_HISTORY = 100
  - `src/worker/protocol.ts` — all WorkerRequestTypes, WorkerPayloads, WorkerResponses
  - `src/providers/StateCoordinator.ts` — setTimeout(16) batching, registerProvider, scheduleUpdate
  - `src/providers/SelectionProvider.ts` — subscribe, select, getSelectedIds, stale-guard pattern
  - `src/providers/StateManager.ts` — Tier 2 persistence, PersistableProvider interface
  - `src/database/queries/types.ts` — Card, CardInput, 26-column schema
  - `src/main.ts` — bootstrap wiring: provider injection, MutationManager creation, explorer mounting
  - `src/ui/WorkbenchShell.ts` — 5 CollapsibleSection rail, SECTION_CONFIGS

- All findings are HIGH confidence — derived from reading the actual implementation, not documentation or training data.

---

*Architecture research for: Notebook Card Editor integration into Isometry Workbench*
*Researched: 2026-03-18*
