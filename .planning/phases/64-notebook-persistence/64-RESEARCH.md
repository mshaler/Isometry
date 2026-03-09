# Phase 64: Notebook Persistence - Research

**Researched:** 2026-03-09
**Domain:** Per-card ui_state persistence with debounced auto-save and card-selection binding
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- First selected card drives the notebook — when multiple cards are selected (Cmd+click), show the first card's notebook
- Hide the notebook section entirely when zero cards are selected (don't show a placeholder message)
- Auto-save immediately (flush to ui_state) when the user switches from card A to card B — bypass debounce on card switch to prevent data loss
- If user was on Preview tab, switching cards stays on Preview with the new card's rendered content
- Debounced auto-save on every keystroke input event, at 500ms interval (matches existing StateManager debounce)
- No visual dirty-state indicator — 500ms debounce is fast enough that save state is invisible, consistent with other providers
- No manual save button — auto-save is the only mechanism
- Empty textarea with grayed-out placeholder text ("Write Markdown...") for cards with no saved notebook content — no template, no boilerplate
- Instant content swap on card switch — no spinner, no skeleton (ui:get is sub-millisecond SQLite lookup)
- Remember notebook section collapsed/expanded state across card switches — WorkbenchShell already persists this via storageKey
- Leave orphaned `notebook:{cardId}` rows in ui_state when cards are deleted — no cascade delete, preserves content if deletion is undone
- No cleanup/GC mechanism for orphaned rows — text is tiny, negligible storage impact, YAGNI
- No per-card size limit on notebook content — SQLite handles large text fine
- CloudKit sync is automatic — ui_state rows are part of the SQLite database checkpoint, server-wins conflict resolution applies, zero additional sync work needed

### Claude's Discretion
- Whether NotebookExplorer subscribes to SelectionProvider directly or WorkbenchShell passes activeCardId down — pick based on existing wiring patterns
- Whether to use StateManager register/markDirty pattern or direct bridge.send('ui:set') calls — notebook is per-card (many keys per provider) which differs from the one-key-per-provider StateManager model

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTE-03 | Notebook is per-card — each card has its own markdown content, switching cards loads the relevant note | SelectionProvider subscription pattern, `ui:get` per card ID, card-switch flush logic |
| NOTE-04 | Notebook markdown persisted via ui_state table (`notebook:{cardId}` key convention) | Direct `bridge.send('ui:set')` pattern from CalcExplorer, debounce timer pattern |
| NOTE-05 | Notebook content survives app reload and is included in database checkpoint (CloudKit sync via existing flow) | ui_state rows included in db:export checkpoint automatically; load on mount via `ui:get` |
</phase_requirements>

## Summary

Phase 64 adds per-card persistence to the existing NotebookExplorer (Phase 57/63). The core task is wiring three things together: (1) SelectionProvider tells the notebook which card is active, (2) `bridge.send('ui:get'/'ui:set')` loads and saves markdown keyed as `notebook:{cardId}`, and (3) a debounce timer auto-saves on keystroke with an immediate flush on card switch.

No new infrastructure is needed. The ui_state table, WorkerBridge protocol, and checkpoint flow already exist. The pattern is nearly identical to CalcExplorer's direct `bridge.send('ui:set')` persistence — the only difference is that notebook has many keys (one per card) rather than one fixed key.

**Primary recommendation:** Use direct `bridge.send('ui:set')` calls (not StateManager) with the CalcExplorer debounce pattern, and subscribe NotebookExplorer directly to SelectionProvider (matching how CalcExplorer subscribes to PAFVProvider).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 | Implementation language | Project standard |
| sql.js | 1.14 | ui_state table storage | System of record |
| Vitest | 4.0 | Unit testing | Project test framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| marked | (existing) | Markdown preview rendering | Already imported in NotebookExplorer |
| DOMPurify | (existing) | XSS sanitization | Already imported in NotebookExplorer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct bridge.send() | StateManager register/markDirty | StateManager assumes one key per provider; notebook needs N keys (one per card). Direct calls are simpler and match CalcExplorer precedent. |
| NotebookExplorer subscribes to SelectionProvider | WorkbenchShell passes activeCardId down | WorkbenchShell is a thin DOM orchestrator with zero business logic (by design). Subscribing directly matches CalcExplorer→PAFVProvider and LatchExplorers→FilterProvider patterns. |

**Installation:**
No new dependencies needed.

## Architecture Patterns

### Recommended Changes
```
src/
├── ui/
│   └── NotebookExplorer.ts    # MODIFY: Add bridge, selection, debounce, card binding
├── main.ts                     # MODIFY: Pass bridge + selection to NotebookExplorer
└── (no new files)
```

### Pattern 1: Direct bridge.send('ui:set') Persistence (CalcExplorer Pattern)
**What:** Explorer components that need ui_state persistence use bridge.send() directly instead of going through StateManager. They manage their own debounce timer.
**When to use:** When the component has a non-standard key pattern (not one-key-per-provider).
**Example (from CalcExplorer.ts lines 227-238):**
```typescript
private _persist(): void {
    if (this._persistTimer !== null) {
        clearTimeout(this._persistTimer);
    }
    this._persistTimer = setTimeout(() => {
        this._persistTimer = null;
        void this._bridge.send('ui:set', {
            key: 'calc:config',
            value: JSON.stringify(this._config),
        });
    }, 300);
}
```
**For notebook:** Same pattern but key is `notebook:{cardId}` and value is raw markdown string (no JSON wrapping — ui_state value column is TEXT).

### Pattern 2: Provider Subscription for Card Switch
**What:** NotebookExplorer subscribes to SelectionProvider.subscribe() to detect card switches, loads content via bridge.send('ui:get'), and flushes pending saves before switching.
**When to use:** When a UI component needs to react to selection changes.
**Example (from CalcExplorer mount → PAFVProvider subscription):**
```typescript
this._unsubscribePafv = this._pafv.subscribe(() => {
    this._render();
});
```
**For notebook:** On selection change: (1) flush current card's content immediately, (2) read new card's content via ui:get, (3) update textarea.

### Pattern 3: Constructor Dependency Injection Config Object
**What:** Explorer constructors accept a config object with all dependencies (bridge, providers, container).
**When to use:** All explorer components in this codebase.
**Example (from CalcExplorer):**
```typescript
export interface CalcExplorerConfig {
    bridge: WorkerBridge;
    pafv: PAFVProvider;
    container: HTMLElement;
    onConfigChange: (config: CalcConfig) => void;
}
```
**For notebook:** Similar config with `bridge: WorkerBridge` and `selection: SelectionProvider`.

### Pattern 4: Visibility Toggle on Zero Selection
**What:** Hide the entire notebook body when zero cards are selected. Show when >= 1 card is selected.
**When to use:** Decision from CONTEXT.md — "Hide the notebook section entirely when zero cards are selected."
**Implementation:** Set `_rootEl.style.display = 'none'` when `selection.getSelectedIds().length === 0`, restore when >= 1.

### Anti-Patterns to Avoid
- **Using StateManager for notebook persistence:** StateManager's PersistableProvider interface (toJSON/setState/resetToDefaults) assumes one JSON blob per provider key. Notebook has N keys (one per card). Don't force it.
- **Using localStorage for notebook content:** All persistent state goes through ui_state via WorkerBridge. localStorage is only for ephemeral UI chrome (collapse states). This is a locked architectural decision.
- **Debounce-only save on card switch:** If user types, switches cards within 500ms, debounce hasn't fired. The pending content would be lost. MUST flush immediately on card switch.
- **Re-rendering preview on every keystroke:** Only render preview when switching to Preview tab. _content field tracks latest text.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce timer | Custom debounce utility | Inline setTimeout/clearTimeout | CalcExplorer already uses this pattern; 4 lines of code, no abstraction needed |
| Key-value storage | New table or localStorage | Existing ui_state via bridge.send('ui:set') | Table exists, handlers exist, checkpoint includes it automatically |
| Card selection tracking | Custom event system | SelectionProvider.subscribe() | Already tracks selection set, notifies via queueMicrotask |
| CloudKit sync for notebook | New CKRecord type | Existing database checkpoint flow | ui_state rows are IN the SQLite database; sendCheckpoint() exports entire database |

**Key insight:** Zero new infrastructure is needed. Every persistence and sync primitive already exists. This phase is purely wiring.

## Common Pitfalls

### Pitfall 1: Lost Content on Rapid Card Switch
**What goes wrong:** User types in card A's notebook, quickly switches to card B. Debounce timer (500ms) hasn't fired yet. Card A's content is lost.
**Why it happens:** Debounce-only save doesn't account for card switches that happen before the timer fires.
**How to avoid:** On card switch: (1) cancel pending debounce timer, (2) immediately flush current content via bridge.send('ui:set'), (3) then load new card's content.
**Warning signs:** Content disappearing when switching cards rapidly.

### Pitfall 2: Stale Content After Card Switch
**What goes wrong:** User switches from card A to card B, but card B's content shows card A's text briefly before the async ui:get resolves.
**Why it happens:** bridge.send('ui:get') is async; textarea still shows old value during the microtask gap.
**How to avoid:** Clear textarea to empty string synchronously before the async load. Use the placeholder text as visual feedback during the (sub-millisecond) load.
**Warning signs:** Flash of old content when switching cards.

### Pitfall 3: Preview Tab Content Not Updating on Card Switch
**What goes wrong:** User is on Preview tab viewing card A's rendered Markdown. Switches to card B. Preview still shows card A's rendered HTML.
**Why it happens:** _switchTab('preview') is not called; the preview panel doesn't know content changed.
**How to avoid:** After loading new card's content, if `_activeTab === 'preview'`, call `_renderPreview()` to refresh the HTML.
**Warning signs:** Preview shows wrong card's content after switching.

### Pitfall 4: Multiple Rapid ui:get Calls Race
**What goes wrong:** User clicks cards A, B, C rapidly. Three ui:get calls are in flight. Card B's response arrives after card C's response, overwriting the textarea with wrong content.
**Why it happens:** Async responses don't guarantee order matches request order.
**How to avoid:** Track the "expected card ID" (e.g., `_activeCardId`). When ui:get response arrives, only apply it if it matches the current `_activeCardId`. Discard stale responses.
**Warning signs:** Wrong card's content appearing after rapid clicking.

### Pitfall 5: Sync Between _content Field and Textarea
**What goes wrong:** After calling _undoSafeInsert() (formatting toolbar), _content may not be in sync with textarea.value.
**Why it happens:** execCommand('insertText') may not fire input event in all WebKit versions (already noted in Phase 63 code comments).
**How to avoid:** The existing explicit `this._content = textarea.value` sync after _undoSafeInsert() handles this. The debounce save should read from `_content` field (which is the source of truth after explicit sync).
**Warning signs:** Formatted text not persisting.

## Code Examples

### Card Switch Handler
```typescript
// Source: Derived from CalcExplorer pattern + SelectionProvider API
private async _onSelectionChange(): Promise<void> {
    const ids = this._selection.getSelectedIds();
    const newCardId = ids.length > 0 ? ids[0] : null;

    if (newCardId === this._activeCardId) return; // Same card, no-op

    // 1. Flush current card's content immediately (bypass debounce)
    if (this._activeCardId !== null && this._dirty) {
        this._cancelDebounce();
        await this._bridge.send('ui:set', {
            key: `notebook:${this._activeCardId}`,
            value: this._content,
        });
        this._dirty = false;
    }

    // 2. Update active card
    this._activeCardId = newCardId;

    // 3. Handle zero selection
    if (newCardId === null) {
        this._setVisible(false);
        return;
    }

    // 4. Load new card's content
    this._setVisible(true);
    const result = await this._bridge.send('ui:get', {
        key: `notebook:${newCardId}`,
    });

    // 5. Guard against stale response (rapid card switching)
    if (this._activeCardId !== newCardId) return;

    // 6. Apply content
    this._content = result.value ?? '';
    if (this._textareaEl) {
        this._textareaEl.value = this._content;
    }
    if (this._activeTab === 'preview') {
        this._renderPreview();
    }
}
```

### Debounced Auto-Save (500ms)
```typescript
// Source: CalcExplorer._persist() pattern adapted for notebook
private _scheduleSave(): void {
    this._dirty = true;
    if (this._saveTimer !== null) {
        clearTimeout(this._saveTimer);
    }
    this._saveTimer = setTimeout(() => {
        this._saveTimer = null;
        if (this._activeCardId === null) return;
        void this._bridge.send('ui:set', {
            key: `notebook:${this._activeCardId}`,
            value: this._content,
        });
        this._dirty = false;
    }, 500);
}
```

### Input Event Wiring
```typescript
// Replace existing input handler in mount()
this._textareaEl.addEventListener('input', () => {
    this._content = this._textareaEl!.value;
    this._scheduleSave(); // NEW: trigger debounced persistence
});
```

### Mount Signature Change
```typescript
// Current: mount(container: HTMLElement): void
// New: constructor accepts config, mount unchanged
export interface NotebookExplorerConfig {
    bridge: WorkerBridge;
    selection: SelectionProvider;
}

constructor(config: NotebookExplorerConfig) {
    this._bridge = config.bridge;
    this._selection = config.selection;
}
```

### main.ts Wiring Update
```typescript
// Current (Phase 57):
const notebookExplorer = new NotebookExplorer();
notebookExplorer.mount(notebookBody!);

// New (Phase 64):
const notebookExplorer = new NotebookExplorer({
    bridge,
    selection,
});
notebookExplorer.mount(notebookBody!);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Session-only _content field | Persisted via ui_state | Phase 64 (this phase) | Content survives reload |
| No card binding | Per-card keyed storage | Phase 64 (this phase) | Each card has its own notebook |
| mount(container) only | Constructor config + mount | Phase 64 (this phase) | Matches CalcExplorer/LatchExplorers pattern |

## Open Questions

1. **Ordering guarantee for first selection + mount**
   - What we know: At mount time, a card may already be selected (e.g., after restore from ui_state). SelectionProvider.getSelectedIds() returns current state synchronously.
   - What's unclear: Whether NotebookExplorer.mount() is called before or after the first card selection in main.ts bootstrap.
   - Recommendation: In mount(), after subscribing to selection, read current selection immediately and load content if a card is already selected. This handles both "mount before selection" and "mount after selection" cases.

## Sources

### Primary (HIGH confidence)
- `src/ui/CalcExplorer.ts` — Direct bridge.send('ui:set') persistence pattern with debounce timer (lines 227-238)
- `src/ui/NotebookExplorer.ts` — Current session-only implementation to be modified (434 lines)
- `src/providers/SelectionProvider.ts` — subscribe() API, getSelectedIds(), queueMicrotask batching
- `src/worker/handlers/ui-state.handler.ts` — ui:get/ui:set/ui:delete/ui:getAll handlers
- `src/worker/protocol.ts` — WorkerPayloads and WorkerResponses type definitions for ui:get/ui:set
- `src/main.ts` — Current NotebookExplorer wiring at line 640-647, selection variable available at line 130
- `src/native/NativeBridge.ts` — sendCheckpoint() exports entire database (confirms ui_state included in sync)
- `src/providers/StateManager.ts` — PersistableProvider interface (confirms it's wrong fit for per-card keys)
- `src/ui/WorkbenchShell.ts` — getSectionBody('notebook') accessor for mounting

### Secondary (MEDIUM confidence)
- `.planning/phases/64-notebook-persistence/64-CONTEXT.md` — User decisions constraining implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components already exist in the codebase
- Architecture: HIGH — CalcExplorer provides exact pattern to follow
- Pitfalls: HIGH — race conditions and flush-on-switch are well-understood async patterns

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable — no external dependencies)
