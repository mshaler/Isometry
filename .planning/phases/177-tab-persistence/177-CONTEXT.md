# Phase 177: Tab Persistence - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Active tab selection and enabled tab list survive page reload and app restart via StateManager. Fresh sessions with no prior tab state initialize cleanly without errors. 4 requirements: PRST-01 through PRST-04.

</domain>

<decisions>
## Implementation Decisions

### SuperWidgetStateProvider Shape
- **D-01:** Full PersistableProvider class — `SuperWidgetStateProvider` implementing `PersistableProvider` interface (toJSON, setState, resetToDefaults). Registered with StateManager under `sw:zone:{role}:tabs` key convention (PRST-02). Gets auto-persist via `enableAutoPersist()`, debounced writes, and corrupt-JSON isolation for free.
- **D-02:** Must expose a `subscribe()` method so StateManager can listen for changes and trigger debounced writes. Tab state changes on every tab switch, create, close, and reorder — debouncing matters.

### Boot Sequencing
- **D-03:** Delayed restore — SuperWidgetStateProvider is registered with StateManager early but skipped during the main `sm.restore()` call. After canvas registration completes in main.ts, a targeted restore runs for just the tab provider. Other providers restore normally at boot time.
- **D-04:** This avoids reshuffling the entire main.ts boot sequence. StateManager already supports per-key `persist(key)` — a per-key restore is a natural extension of the same pattern.

### Claude's Discretion
- Exact serialization shape of tab state JSON (array of TabSlot projections, or a flattened structure)
- Whether the per-key restore is a new `StateManager.restoreKey(key)` method or handled externally by the provider
- How SuperWidgetStateProvider receives tab change notifications from SuperWidget (callback injection, event, or direct coupling)
- Whether `resetToDefaults()` creates a single default tab (matching `makeTabSlot()` behavior) or an empty tab list
- Migration logic for PRST-04 — whether to check for key absence or use a schema version sentinel

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### StateManager & Persistence Pattern
- `src/providers/StateManager.ts` — Full PersistableProvider pattern: registerProvider, restore, enableAutoPersist, markDirty, per-key persist, scoped keys, schema migration
- `src/providers/types.ts` — PersistableProvider interface definition (toJSON, setState, resetToDefaults)
- `src/providers/PAFVProvider.ts` — Reference PersistableProvider implementation (lines 662+): toJSON/setState/resetToDefaults pattern
- `src/providers/DensityProvider.ts` — Another PersistableProvider reference (lines 163+)

### SuperWidget Tab State
- `src/superwidget/SuperWidget.ts` — `_tabs: TabSlot[]`, `_activeTabSlotId`, `_switchToTab()`, `_createTab()`, `_closeTab()`, `_reorderTabs()` — all state mutation points that must trigger persistence
- `src/superwidget/TabSlot.ts` — TabSlot type, `makeTabSlot()` default factory
- `src/superwidget/projection.ts` — Projection type serialized per tab

### Boot Sequence
- `src/main.ts` — Lines 257-261 (StateManager creation), ~286 (sm.restore() call), canvas registration wiring (later in boot)

### Phase 174/176 Context (predecessors)
- `.planning/phases/174-tab-management/174-CONTEXT.md` — TabSlot type decisions, D-01 default canvas type, D-02 shared provider state
- `.planning/phases/176-explorer-sidecar-status-slots/176-CONTEXT.md` — Sidecar and status slot decisions (phase 177 depends on 176)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StateManager`: Full persistence infrastructure already built — registerProvider, restore, enableAutoPersist, markDirty with 500ms debounce, corrupt-JSON isolation, schema migration hooks
- `PAFVProvider` / `DensityProvider` / `SuperDensityProvider`: Three existing PersistableProvider implementations to follow as templates
- `makeTabSlot()`: Default tab factory — resetToDefaults() should produce matching output

### Established Patterns
- PersistableProvider registration: `sm.registerProvider('key', provider)` then `sm.restore()` then `sm.enableAutoPersist()`
- Subscribable providers: `subscribe(callback: () => void): () => void` pattern for auto-persist
- ui_state table: Key-value JSON store accessed via `bridge.send('ui:set'/'ui:get'/'ui:getAll')`
- Scoped keys: `sm.registerProvider('key', provider, { scoped: true })` for per-dataset state — tabs are likely global (not scoped)

### Integration Points
- `SuperWidget._switchToTab()`, `_createTab()`, `_closeTab()`, `_reorderTabs()`: All tab mutation points that must notify the state provider
- `main.ts` boot sequence: SuperWidgetStateProvider registers before `sm.restore()`, targeted restore after canvas registration
- `sm.enableAutoPersist()`: Subscribes to all registered providers — SuperWidgetStateProvider will be auto-subscribed

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: follow the existing PersistableProvider pattern exactly (PAFVProvider as template), and ensure delayed restore doesn't leave SuperWidget in an invalid state during the gap between boot and canvas registration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 177-tab-persistence*
*Context gathered: 2026-04-22*
