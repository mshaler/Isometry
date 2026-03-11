# Phase 72: State Persistence Migration - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Persisted provider state from prior sessions degrades gracefully when the database schema has changed (columns added/removed/renamed between imports). StateManager.restore() filters unknown fields before providers see them. Individual invalid entries are pruned rather than resetting entire provider state. Alias orphans are preserved indefinitely.

</domain>

<decisions>
## Implementation Decisions

### Degradation feedback
- Silent degradation — no user-visible notification when persisted state is pruned
- No toast, no console warning — the "right" state just appears after restore
- Users won't notice columns changed between imports; the workspace loads clean

### Pruning granularity
- Keep valid filters — if filters reference columns A, B, C and B is removed, A and C stay active
- Null invalid axes only — if groupBy references a removed column but colAxes/rowAxes are valid, only groupBy is nulled (falls back to view default for that axis)
- Individual pruning for sub-filters — axisFilters and rangeFilters (Phase 24/66) entries are pruned per-key, not reset entirely
- Column widths, sort overrides, collapse state survive even when axis fields are pruned

### Validation boundary
- StateManager filters first — strips unknown field references BEFORE calling provider.setState()
- StateManager only strips field names, not structural shape — structural validation stays in each provider's setState()
- SchemaProvider injected into StateManager (setter pattern, matching PAFVProvider.setSchemaProvider())
- Providers keep throwing on unknown fields as a safety net — if StateManager's filtering works correctly, the throw never fires; if it does, it's a bug worth catching

### Alias orphan policy
- Aliases for missing fields persist indefinitely — never auto-deleted
- If a column disappears and returns in a future import, the alias re-activates automatically
- AliasProvider.setState() skips isValidAxisField() check — accepts any string key (schema-independent)
- getAlias() is schema-unaware — always returns stored alias regardless of current schema validity
- Callers of getAlias() simply won't ask for fields that don't exist in the schema

### Claude's Discretion
- Exact migration function signature and placement within StateManager.restore()
- Whether to use a generic field-extraction helper or per-provider-type filtering logic
- Test fixture design for schema-change scenarios

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The pattern should follow the existing `setSchemaProvider()` wiring convention used by PAFVProvider.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SchemaProvider.isValidColumn(name, table)`: validates column existence against PRAGMA metadata — use for field filtering
- `SchemaProvider.getFieldsByFamily(family)`: returns typed column info — available for fallback axis selection
- `validateFilterField()` / `validateAxisField()` in `allowlist.ts`: existing validation functions that throw on unknown fields
- `isValidAxisField()` in `allowlist.ts`: non-throwing boolean check used by AliasProvider
- `PAFVProvider.setSchemaProvider()`: established setter injection pattern for SchemaProvider wiring

### Established Patterns
- `PersistableProvider` interface: `toJSON()`, `setState(unknown)`, `resetToDefaults()` — all three providers implement this
- Backward compat in setState(): optional fields with fallback defaults (colAxes, rangeFilters, colWidths, etc.)
- `structuredClone()` for deep copy isolation in PAFVProvider state
- Subscriber notification suppressed during setState() (snap-to-state pattern)

### Integration Points
- `StateManager.restore()` (line 168): the single restore entry point — currently passes raw JSON to providers
- `StateManager` constructor: takes `WorkerBridge` and `debounceMs` — SchemaProvider injection would add here or via setter
- `FilterProvider.setState()` (line 344): validates all filters then throws on unknown fields
- `PAFVProvider.setState()` (line 659): restores state without field validation (defers to compile())
- `AliasProvider.setState()` (line 89): currently skips entries failing `isValidAxisField()` — needs to accept any key
- App bootstrap in `src/index.ts`: where StateManager is created and providers registered

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 72-state-persistence-migration*
*Context gathered: 2026-03-11*
