# Pitfalls Research

**Domain:** Notebook-as-Card-Editor — adding card creation, property editing, and card dimension rendering to an existing sql.js/D3/MutationManager system
**Researched:** 2026-03-18
**Confidence:** HIGH — all pitfalls derived from direct inspection of the existing codebase (MutationManager.ts, inverses.ts, NotebookExplorer.ts, schema.sql, SelectionProvider.ts, BridgeManager.swift) and known system invariants

---

## Critical Pitfalls

### Pitfall 1: Start-Typing Creates a Card on First Keystroke — Before the User Commits

**What goes wrong:**
`createCardMutation` is called on the first `input` event. Every subsequent field edit is an `updateCardMutation` on a real `cards` row. The user presses Backspace twice and expects an empty Notebook — they get a redo stack full of mutations and a ghost card in every D3 view.

**Why it happens:**
The spec says "first keystroke triggers createCardMutation" without specifying the guard condition. Developers wire the `input` event handler directly to `createCardMutation`, which fires on every character including accidental touches, IME composition events, and auto-correct insertions.

**How to avoid:**
Buffer the first keystroke in a local `string` variable. Only call `createCardMutation` when the buffer is non-empty AND the user pauses (debounce) or focuses away (blur). Use a state machine with three states: `idle` (no card, no content) → `buffering` (content exists, no DB row yet) → `editing` (card row exists, all edits are `updateCardMutation`). The transition from `buffering` → `editing` is the only place `createCardMutation` fires. The `idle` → `buffering` transition is invisible to MutationManager.

**Warning signs:**
- Undo after typing two characters undoes a card CREATE, not a content update
- D3 views flash a new card node on the first keystroke while the user is still typing
- Pressing Escape while in `buffering` state causes a no-op undo (nothing in history)

**Phase to address:**
Phase 1 of the milestone (NotebookExplorer card binding + start-typing creation) — define the state machine before writing any `input` handler.

---

### Pitfall 2: Inverse SQL Captured Against Stale `before` Card State

**What goes wrong:**
`updateCardMutation(id, before, after)` computes the inverse at creation time using the `before` snapshot. If two rapid edits race — the second mutation's `before` snapshot is taken before the first mutation's `exec()` has resolved — both mutations restore to the same stale row. Undoing both produces incorrect state.

**Why it happens:**
MutationManager's `execute()` is `async` — it awaits each `bridge.exec()` call. If the Notebook's debounce fires before the prior `exec()` completes (possible when the Worker is under load), the next `updateCardMutation` is built against the old `before` object. The existing card query that populates `before` is not awaited atomically with `execute()`.

**How to avoid:**
Two constraints working together prevent this:

1. Serialize mutations from the same editor source: maintain a `Promise` chain (`_mutationQueue`) in NotebookExplorer. Enqueue each mutation — the next one only builds its `before` snapshot after the previous one's `execute()` resolves.

2. Alternatively, widen the debounce window enough that per-keystroke mutations never overlap. A 500ms debounce with sequential execution makes the race window effectively zero at human typing speeds.

The existing MutationManager supports both — it is a linear history, not a concurrent log. The caller is responsible for sequencing.

**Warning signs:**
- Undo twice on a rapidly-edited field restores to the same wrong value both times
- `updateCardMutation` logging shows two mutations with identical `before` params
- Only appears under slow Worker response (large dataset, query contention)

**Phase to address:**
Phase 1 (MutationManager integration) — add a mutation sequencer or serialize the async chain.

---

### Pitfall 3: Notebook Content Persisted to `ui_state` Orphaned After Migration to `cards.content`

**What goes wrong:**
The existing `NotebookExplorer` stores content at `notebook:{cardId}` in `ui_state`. After the migration, `cards.content` is the source of truth, but old `ui_state` entries remain. On first load after the upgrade, `_onSelectionChange()` reads from `ui_state` and wins — the user sees old content instead of the current `cards.content`.

**Why it happens:**
`_onSelectionChange()` currently does `await this._bridge.send('ui:get', { key: 'notebook:{cardId}' })`. If that key still exists in `ui_state`, it returns stale data even after `cards.content` has been populated. Nothing cleans up the old keys.

**How to avoid:**
Two-step migration:

1. During NotebookExplorer v2 mount, perform a one-time migration: query all `ui_state` rows with `key LIKE 'notebook:%'`, for each find the matching card, write `cards.content` via `updateCardMutation` if `cards.content` is currently NULL, then DELETE the `ui_state` row. Guard this migration with a version sentinel in `ui_state` (e.g., `key = 'notebook:migration:v1'`) so it only runs once per device.

2. Remove all `bridge.send('ui:get', { key: 'notebook:...' })` and `bridge.send('ui:set', ...)` calls from the new NotebookExplorer. The new implementation reads `cards.content` via a card fetch, not `ui_state`.

**Warning signs:**
- Users who had content in the old Notebook see it overwrite their actual `cards.content` on first launch
- `ui_state` table grows unboundedly as the new editor keeps writing new card IDs to the old path
- Tests that seed `ui_state` entries pass but production users see wrong content

**Phase to address:**
Phase 1 — the migration must ship in the same phase as the persistence change, not deferred.

---

### Pitfall 4: Property Editor Sends `updateCardMutation` Without Fetching `before` Card First

**What goes wrong:**
`updateCardMutation(id, before, after)` requires the full `before: Card` object to construct the inverse SQL. A property editor that only knows the field name and new value cannot call `updateCardMutation` correctly without first fetching the current row. Developers skip the fetch and pass a partially constructed `before` object, leaving null-valued inverse params. Undo silently NULLs out every field not explicitly captured.

**Why it happens:**
Property editors are typically built as `<input>` or `<select>` elements with just an `onChange`. The temptation is to call `updateCardMutation(id, { [field]: oldValue }, { [field]: newValue })` using only the field being changed. This is incorrect — `updateCardMutation` takes `before: Card` (the full row), not a partial. The function's `changedFields` loop reads `(before as Record<string, unknown>)[field]` — if `before` is a partial, any field not present becomes `undefined`, which becomes `NULL` in the inverse SQL.

**How to avoid:**
Fetch the full card from the Worker (`db:exec('SELECT * FROM cards WHERE id = ?', [id])`) before building any `updateCardMutation`. Cache the last-fetched card state in the editor component — update the cache after each successful `execute()` resolves. The cache is the `before` for the next mutation.

**Warning signs:**
- Undoing a `status` field change also clears `priority` to NULL
- The inverse SQL for a single-field update has more than one SET clause unexpectedly
- `console.warn` from MutationManager about "history depth exceeded" with many NOOPs (empty inverse arrays)

**Phase to address:**
Phase 2 (property editors) — establish `CardEditorState` — a class that owns the live `Card` snapshot and exposes typed setters that internally build correct mutations.

---

### Pitfall 5: FTS5 Triggers Fire Per-Keystroke Through MutationManager, Creating Index Churn

**What goes wrong:**
Every `updateCardMutation` for `name` or `content` fires the `cards_fts_au` trigger (schema.sql lines 147–152). The trigger is a delete-then-insert into the FTS5 virtual table. At 500ms debounce, a fast typist firing ~2 edits/second generates 2 FTS index writes/second — each write acquires an FTS5 exclusive lock, which can briefly block concurrent search queries from the CommandBar or SuperSearch.

**Why it happens:**
The trigger is always-on for UPDATE OF name, content, folder, tags. The ETL path disables triggers and rebuilds in bulk — but MutationManager does not. Card editor edits come through the normal `db:exec` path with triggers active.

**How to avoid:**
The 500ms debounce is sufficient at human typing speeds — do not tighten it below 300ms. Do not batch content edits differently than other fields; let the trigger fire per-mutation (this is correct behavior). The risk is latency on a concurrent search, not correctness. Mitigation: document the debounce floor as a contract (no content mutations faster than 300ms), and add a seam test that verifies FTS results are correct immediately after an `updateCardMutation` on `content`.

**Warning signs:**
- Search results return stale content immediately after typing in the Notebook (FTS not yet updated)
- Search results briefly return the pre-edit content when switching from Notebook to CommandBar quickly
- FTS seam test `etl-to-fts5.test.ts` needs a new case: single `updateCardMutation` followed by immediate FTS query

**Phase to address:**
Phase 1 (MutationManager integration) — add the seam test; Phase 2 (property editors) — document the debounce contract.

---

### Pitfall 6: SelectionProvider Not Updated After `createCardMutation` — New Card Is Never Selected

**What goes wrong:**
`createCardMutation` inserts a new row with a UUID generated at call time. After `execute()` resolves, the new card exists in the database, but `SelectionProvider` still holds the old selection (empty or a different card). NotebookExplorer's `_onSelectionChange()` is bound to `SelectionProvider` — without an explicit `selection.select(newCardId)`, the new card never appears in the Notebook editor. The user sees the editor go blank or retain the previous card's content.

**Why it happens:**
`SelectionProvider` is Tier 3 ephemeral — it has no direct knowledge of card creation. The mutation executes and sets dirty, but nothing calls `selection.select()` afterward. Developers assume that the MutationManager subscriber notification will somehow propagate to selection — it does not.

**How to avoid:**
After `await mutationManager.execute(createMutation)`, immediately call `selection.select(newCardId)`. The UUID is computed at mutation creation time (inside `createCardMutation`, returned in `mutation.id` — but note that `mutation.id` is the mutation's own UUID, not the card's UUID). The card UUID must be extracted before `createCardMutation` wraps it.

The cleanest pattern: create a `buildCreateCardMutation(input)` factory that returns `{ mutation: Mutation, cardId: string }`. NotebookExplorer calls this, passes `mutation` to `execute()`, then calls `selection.select(cardId)`.

**Warning signs:**
- After typing in an empty Notebook, the card appears in D3 views but the editor goes blank
- Notebook shows "no card selected" state immediately after creation
- Selection count is 0 after card creation

**Phase to address:**
Phase 1 (start-typing card creation) — define the factory pattern before implementing the `input` handler.

---

### Pitfall 7: CloudKit Sync Skips New Cards Created via MutationManager

**What goes wrong:**
CloudKit sync is triggered by the `mutated` message from the JS runtime to Swift (BridgeManager.swift line 160). The `mutated` message requires a `payload.changes` array with card/connection data for CKSyncEngine. If `NotebookExplorer` sends the `mutated` message without a valid changeset (or does not send it at all), new cards are written to sql.js but never uploaded to CloudKit. Other devices never see them.

**Why it happens:**
The existing MutationManager marks the dirty flag (`this.dirty = true`) and notifies subscribers — but it does NOT send the `mutated` bridge message. That message must be sent explicitly by the caller with the card's current state as the changeset. The existing KanbanView and other views that write through MutationManager send `mutated` after mutations. A new NotebookExplorer implementation that bypasses the existing changeset dispatch pattern will silently drop sync.

**How to avoid:**
After each successful `execute()`, send the `mutated` bridge message with the affected card serialized as a changeset. Use the same format as all other callers (inspect the Worker's existing `mutated` dispatch path). A shared `dispatchMutation(cardId)` helper that fetches the card and sends `mutated` should be extracted and reused. Do NOT inline the changeset construction per-editor.

**Warning signs:**
- New cards created in Notebook appear only on the device where they were created
- CloudKit dashboard shows no new records after Notebook card creation
- `isDirty` in Swift is `true` (checkpoint autosave fires) but `syncManager` queue shows no pending uploads

**Phase to address:**
Phase 1 (MutationManager integration) — test the CloudKit changeset path before shipping.

---

### Pitfall 8: Type Coercion in Property Editors — Numeric Fields Stored as Strings

**What goes wrong:**
The `cards` schema defines `latitude REAL`, `longitude REAL`, `priority INTEGER`, `sort_order INTEGER`. A property editor backed by `<input type="text">` or `<input type="number">` returns values as JavaScript strings. When these strings reach `updateCardMutation`, they flow into the SQL params as strings. SQLite's type affinity will coerce them on INSERT/UPDATE — but the inverse SQL captures the string, not the number. On undo, the field is restored to a string representation, which can cause type mismatches in downstream queries.

**Why it happens:**
JavaScript `<input>` elements always yield `string` values. TypeScript's `CardInput` type has `priority?: number` — TypeScript catches this at the type boundary, but property editors that use `as unknown` casting or receive values from untyped DOM events bypass the check.

**How to avoid:**
Enforce coercion at the property editor layer, not at the mutation layer. Create a `coerceCardField(field: keyof CardInput, rawValue: string): unknown` utility that applies the correct JS type conversion per field. Keep the mutation layer type-safe — `updateCardMutation` already handles `boolToInt` and `serializeTags` for known special fields. Extend those special cases to cover the numeric fields explicitly.

**Warning signs:**
- `typeof card.priority` is `'string'` after a round-trip through the property editor
- Undo/redo of a priority change alternates between number and string representation
- SuperGrid GROUP BY on `priority` returns unexpected groupings (string sort vs numeric sort)

**Phase to address:**
Phase 2 (property editors) — coercion utility must be implemented before any `<input>` handler wires to `updateCardMutation`.

---

### Pitfall 9: Card Dimension Rendering (1x/2x/5x/10x) Adds Parallel State Outside D3 Data Join

**What goes wrong:**
Card dimension (1x/2x/5x/10x) is a display property. If stored in a JS object outside the D3 data join (e.g., a `Map<string, DimensionSize>` module-level variable), it becomes parallel state that can diverge from the D3-bound data. D3 view re-renders will not see dimension changes, and dimension state survives card deletion (memory leak for deleted card IDs).

**Why it happens:**
The spec says "card dimension rendering" per Figma design — developers reach for the simplest solution (a module-level Map) to avoid threading dimension through the database schema. This violates the project's "no parallel state" constraint (D-005).

**How to avoid:**
Store dimension in `ui_state` using a `dimension:{cardId}` key. This matches the existing persistence tier model and survives sessions. Read it during card load in NotebookExplorer and the card detail view. D3 views read dimension from `ui_state` during their render cycle, not from a parallel Map. NotebookExplorer writes `ui:set` for dimension changes — dimension is UI state, not card data, so it correctly stays in `ui_state` rather than going through MutationManager.

**Warning signs:**
- Card dimension resets after a D3 view re-render triggered by a filter change
- Dimension state for deleted cards remains in memory, growing without bound
- Two D3 views render the same card at different dimensions simultaneously

**Phase to address:**
Phase 3 (card dimension rendering) — establish the `ui_state` key convention before implementing any dimension UI.

---

### Pitfall 10: Undo After Start-Typing Card Creation Deletes the Card While the User Is Still Editing

**What goes wrong:**
The user types "My new card" and then immediately presses Cmd+Z. The undo history has one entry: the `createCardMutation`. Undoing it deletes the card from the database. NotebookExplorer's MutationManager subscriber fires, which triggers a coordinator re-query, which removes the card from all D3 views — while the Notebook editor still shows content. The next keystroke attempts an `updateCardMutation` on a non-existent ID, which executes with zero `changes` and silently fails.

**Why it happens:**
MutationManager's `execute()` is the only gate for card creation. Undo is unconditional — it does not check whether the editor is currently open on the card being deleted. There is no "edit session" concept in MutationManager.

**How to avoid:**
NotebookExplorer must subscribe to MutationManager. When the undo callback fires:

1. Check whether `_activeCardId` matches a card that was just deleted
2. If so, reset `_activeCardId` to `null`, clear the editor, and set state back to `idle`
3. Call `selection.clear()` so the selection state is consistent

The MutationManager subscriber notification is the correct hook — it fires after every `undo()` and `redo()`. NotebookExplorer should listen and respond defensively.

Additionally, after an undo that deletes the current card, the buffered content should be discarded — not auto-saved. Guard `_scheduleSave()` with a check that `_activeCardId` still exists in the database (or more practically: that the editor is not in `idle` state).

**Warning signs:**
- After Cmd+Z on a new card, the next keystroke produces a Worker error: "no card with id ..."
- D3 views correctly remove the card, but the Notebook editor retains the typed content
- `selection.getSelectedIds()` returns a card ID that no longer exists in the database

**Phase to address:**
Phase 1 (start-typing + MutationManager integration) — handle undo-delete in NotebookExplorer subscriber callback.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip `buffering` state machine, fire `createCardMutation` on first character | Simpler code | Ghost cards on accidental touch, IME composition creates blank cards | Never |
| Store card dimension in a module-level `Map` | Zero schema changes | Parallel state, memory leaks, D3 join divergence (violates D-005) | Never |
| Read `ui_state` for content after migration without cleanup | No migration code needed | Users see stale content overwriting real `cards.content` | Never |
| Build `before` Card snapshot from partial fields | Fewer async fetches | Inverse SQL NULLs fields not explicitly captured; silent data corruption on undo | Never |
| Skip `mutated` changeset dispatch after card creation | Fewer bridge calls | New cards invisible on other devices; CloudKit divergence | Never |
| Debounce floor below 300ms for content mutations | More responsive feel | FTS lock contention during concurrent CommandBar/SuperSearch queries | Never below 300ms |
| Use `<input type="text">` for numeric fields without coercion | Faster to build | String-typed DB values, sort/grouping bugs in SuperGrid, undo restores string instead of number | Only if TypeScript strict mode catches it at the type boundary — otherwise never |

---

## Integration Gotchas

Common mistakes when connecting to the existing system's components.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MutationManager + SelectionProvider | Assume MutationManager notifies selection after card creation | Explicitly call `selection.select(newCardId)` after `execute()` resolves; SelectionProvider has no card-creation awareness |
| MutationManager + CloudKit (BridgeManager) | Assume dirty flag alone triggers sync upload | Send `mutated` bridge message with card changeset after every card-writing mutation; dirty flag only triggers checkpoint |
| NotebookExplorer + MutationManager undo | Subscribe to StateCoordinator for re-renders, miss undo-delete events | Subscribe directly to MutationManager; StateCoordinator is for query-driven re-renders, not command log events |
| FTS5 triggers + MutationManager | Assume bulk-import FTS optimization (disable/rebuild) applies to per-keystroke edits | It does not; triggers are always-on for the `db:exec` path; accept per-mutation FTS writes, enforce debounce floor |
| ui_state notebook keys + cards.content migration | Leave old `notebook:{cardId}` keys in place after migration | Run one-time migration on first launch; guard with `notebook:migration:v1` sentinel key |
| Property editors + `updateCardMutation` | Fetch `before` card per-field-change inline in each handler | Cache the `before` card in `CardEditorState`; update cache after each `execute()` resolves; never use a partial `before` |
| Card dimension + D3 data join | Store dimension in a component-local `Map` | Store in `ui_state`; read during render; D3 join remains the single data source |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full Card row before every `updateCardMutation` without caching | Per-debounce-tick Worker roundtrips (5–20ms each) | Cache `before` Card in `CardEditorState`; refresh only on card switch | Any usage — adds latency proportional to typing speed |
| Per-field property editors each subscribing to SelectionProvider independently | N subscribers fire on every selection change for N fields; 26 re-renders per switch | Single parent editor subscribes; child fields receive card state via parameter | At 26 fields, 26 listeners thrash on any selection event |
| Running `selection.select(newCardId)` before `execute()` resolves | Editor loads before card row exists; Worker query returns empty result | Sequence: `execute()` → `selection.select()`, never parallel | Any concurrent Worker load |
| Card dimension `ui:get` on every selection change without caching | Extra Worker roundtrip on every card switch in the Notebook | Batch dimension fetch with the card fetch; or cache dimension per session (Tier 2) | At fast card switching speeds via keyboard |
| Sending `mutated` changeset with full card object for every content debounce tick | Bridge IPC overhead per debounce tick; 26 fields JSON-encoded per tick | Debounce at 500ms (already enforced); dispatch `mutated` only after `execute()` settles | At typing speeds faster than the debounce interval |

---

## UX Pitfalls

Common user experience mistakes specific to card editors.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Undo stack includes every auto-saved content update as a separate step | Cmd+Z through 20 characters of typing; each is a separate undo step | Compound mutations: coalesce content edits within the same "typing session" into one undo step (session gap > 1000ms or focus lost) |
| Property editor shows raw ISO string for date fields | Users see "2026-03-18T00:00:00.000Z" instead of "Mar 18, 2026" | Format dates for display; parse display format back to ISO on commit |
| Card creation with empty name creates an "Untitled" card that cannot be naturally deleted | Orphan cards accumulate via accidental touches or IME insertions | Require at least one non-whitespace character in `name` before triggering `createCardMutation` |
| Null numeric fields displayed as empty string in property editor | User cannot distinguish "0" (intentional zero) from "not set" (NULL) | Display NULL as placeholder text; coerce empty string back to NULL on blur |
| 1x/2x/5x/10x dimension control with no visual preview | Users don't know what dimensions mean until they commit | Show a thumbnail preview of the dimension in the picker |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Start-typing card creation:** Verify that typing one character, pressing Undo, and typing again creates exactly one card — not two. Verify IME composition (holding a key on macOS) does not create multiple cards.
- [ ] **Property editor inverse SQL:** Undo any single-field edit and verify that ONLY that field is restored — no other fields are NULLed. Inspect the `inverse` array of the mutation for correct field count.
- [ ] **FTS5 sync after content edit:** After editing `name` or `content` via the Notebook, run a CommandBar search for the new text. Verify FTS returns the updated card immediately, not a stale pre-edit result.
- [ ] **CloudKit changeset:** After creating a card via Notebook, check `syncManager`'s offline queue — verify a record appears. Test on a second device: the card must appear after sync completes.
- [ ] **ui_state migration:** Run the migration on a device with existing `notebook:{cardId}` entries. Verify the content appears in `cards.content` and the `ui_state` rows are deleted.
- [ ] **Selection after creation:** After the new card is created, verify `selection.getSelectedIds()` returns the new card's ID and the Notebook editor is bound to that card (not blank).
- [ ] **Undo-delete safety:** Verify that Cmd+Z immediately after card creation resets the Notebook to `idle` state (empty, no active card) and does not leave a bound editor pointing at a deleted card.
- [ ] **Type coercion:** After editing `priority` or `latitude` via a property editor, verify `typeof card.priority === 'number'` in a roundtrip test through the Worker.
- [ ] **Card dimension persistence:** Verify dimension survives a session restart (read from `ui_state` on mount, not from a component-local variable).
- [ ] **Seam test coverage:** Add a seam test covering `NotebookExplorer → createCardMutation → SelectionProvider → FTS5` for the full creation path.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Ghost cards from first-keystroke creation | MEDIUM | Migration: DELETE FROM cards WHERE name = '' AND content IS NULL created in a date range; fix buffering state machine |
| Stale `ui_state` content overwriting `cards.content` | LOW | Re-run migration with corrected sentinel; migration is idempotent if written correctly |
| Undo NULLing fields via wrong `before` snapshot | HIGH | Manual data recovery or CloudKit last-writer-wins restore; fix `CardEditorState` caching pattern; no automatic recovery path for already-corrupted rows |
| New cards missing from CloudKit sync | MEDIUM | Use `export-all-cards` bridge message to trigger full re-upload; fix `mutated` dispatch; affected users run "Sync Now" |
| Parallel state in dimension Map | LOW | Delete the Map, implement `ui_state` reads in next release; no data loss (dimension is display-only) |
| FTS out of sync after content migration | LOW | Run `INSERT INTO cards_fts(cards_fts) VALUES('rebuild')` via DB Utilities (already present in existing tooling) |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Start-typing creates card too eagerly (#1) | Phase 1 — state machine in NotebookExplorer | Vitest unit test: first character → `idle→buffering`, pause → `buffering→editing`, Cmd+Z → `editing→idle` |
| Stale `before` snapshot race condition (#2) | Phase 1 — mutation sequencer | Seam test: rapid two content mutations, verify undo restores each step correctly |
| ui_state orphan content survives migration (#3) | Phase 1 — one-time migration on mount | Integration test: seed `ui_state` with old content, mount NotebookExplorer, verify `cards.content` wins and `ui_state` row is deleted |
| Property editor missing `before` card fetch (#4) | Phase 2 — `CardEditorState` class | Unit test: edit one field, undo, verify only that field changed and all 25 others match the original row exactly |
| FTS churn from per-keystroke mutations (#5) | Phase 1 (document debounce floor) + Phase 2 (seam test) | Extend `etl-to-fts5.test.ts`: single `updateCardMutation` on `content`, FTS query returns updated text |
| SelectionProvider not updated after creation (#6) | Phase 1 — `buildCreateCardMutation` factory pattern returning `{mutation, cardId}` | Integration test: create card, assert `selection.getSelectedIds()[0] === cardId` |
| CloudKit changeset not dispatched (#7) | Phase 1 — shared `dispatchMutation` helper | Integration test: execute `createCardMutation`, assert `mutated` message sent with correct `changes` array |
| Type coercion in property editors (#8) | Phase 2 — `coerceCardField` utility | Unit test: edit `priority` to "3" via text input, verify `typeof card.priority === 'number'` after roundtrip |
| Card dimension as parallel state (#9) | Phase 3 — `ui_state` key convention established | Integration test: change dimension, trigger D3 re-render, verify dimension persists across re-render |
| Undo-delete while editor is open (#10) | Phase 1 — MutationManager subscriber in NotebookExplorer | Seam test: create card, Cmd+Z, verify `_activeCardId === null` and next keystroke does not throw |

---

## Sources

- Direct code inspection: `/Users/mshaler/Developer/Projects/Isometry/src/mutations/MutationManager.ts`
- Direct code inspection: `/Users/mshaler/Developer/Projects/Isometry/src/mutations/inverses.ts`
- Direct code inspection: `/Users/mshaler/Developer/Projects/Isometry/src/mutations/types.ts`
- Direct code inspection: `/Users/mshaler/Developer/Projects/Isometry/src/ui/NotebookExplorer.ts` (existing ui_state persistence path)
- Direct code inspection: `/Users/mshaler/Developer/Projects/Isometry/src/database/schema.sql` (FTS5 triggers `cards_fts_ai`, `cards_fts_ad`, `cards_fts_au`)
- Direct code inspection: `/Users/mshaler/Developer/Projects/Isometry/src/providers/SelectionProvider.ts` (Tier 3 ephemeral, no card-creation awareness)
- Direct code inspection: `/Users/mshaler/Developer/Projects/Isometry/native/Isometry/Isometry/BridgeManager.swift` (mutated message, CloudKit changeset dispatch at line 160)
- Project decisions D-005 (three-tier persistence), D-009 (command log undo/redo), D-010 (dirty flag + debounce sync) from `.planning/PROJECT.md`
- Known system invariants: "D3 data join IS state management — no parallel state", "MutationManager is the sole write gate"

---
*Pitfalls research for: Notebook Card Editor (v7.1) — adding to existing sql.js/D3/MutationManager system*
*Researched: 2026-03-18*
