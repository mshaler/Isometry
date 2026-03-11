# Phase 72: State Persistence Migration - Research

**Researched:** 2026-03-11
**Domain:** Provider state migration / schema-change degradation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Degradation feedback:**
- Silent degradation — no user-visible notification when persisted state is pruned
- No toast, no console warning — the "right" state just appears after restore
- Users won't notice columns changed between imports; the workspace loads clean

**Pruning granularity:**
- Keep valid filters — if filters reference columns A, B, C and B is removed, A and C stay active
- Null invalid axes only — if groupBy references a removed column but colAxes/rowAxes are valid, only groupBy is nulled (falls back to view default for that axis)
- Individual pruning for sub-filters — axisFilters and rangeFilters (Phase 24/66) entries are pruned per-key, not reset entirely
- Column widths, sort overrides, collapse state survive even when axis fields are pruned

**Validation boundary:**
- StateManager filters first — strips unknown field references BEFORE calling provider.setState()
- StateManager only strips field names, not structural shape — structural validation stays in each provider's setState()
- SchemaProvider injected into StateManager (setter pattern, matching PAFVProvider.setSchemaProvider())
- Providers keep throwing on unknown fields as a safety net — if StateManager's filtering works correctly, the throw never fires; if it does, it's a bug worth catching

**Alias orphan policy:**
- Aliases for missing fields persist indefinitely — never auto-deleted
- If a column disappears and returns in a future import, the alias re-activates automatically
- AliasProvider.setState() skips isValidAxisField() check — accepts any string key (schema-independent)
- getAlias() is schema-unaware — always returns stored alias regardless of current schema validity
- Callers of getAlias() simply won't ask for fields that don't exist in the schema

### Claude's Discretion
- Exact migration function signature and placement within StateManager.restore()
- Whether to use a generic field-extraction helper or per-provider-type filtering logic
- Test fixture design for schema-change scenarios

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 72 adds schema-change resilience to the three Tier 2 persistence providers (FilterProvider, PAFVProvider, AliasProvider) by introducing a migration step in `StateManager.restore()`. The core insight is a two-layer defense: StateManager prunes unknown field names from the raw JSON blob *before* handing state to providers, and each provider's existing validation throws as a second safety net if anything slips through.

The work is self-contained to `src/providers/` — no Worker changes, no schema changes, no UI changes. All three providers already implement `PersistableProvider` with `setState(unknown)`. The pattern to follow is PAFVProvider.setSchemaProvider() (setter injection, not constructor injection) because all three providers are instantiated before SchemaProvider is necessarily wired.

StateManager.restore() is the single choke point where all JSON blobs flow through before reaching providers. Adding `setSchemaProvider()` to StateManager and a `_migrateState(key, parsed)` helper in that method is the minimal, testable change surface.

**Primary recommendation:** Add `StateManager.setSchemaProvider(sp)` setter, implement per-provider-type pruning logic in a private `_migrateState()` method called inside `restore()`, update AliasProvider.setState() to skip the `isValidAxisField()` check, and cover all three pruning paths with integration tests.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRST-01 | StateManager.restore() includes field migration step — filters out unknown fields from persisted state before calling provider setState() | StateManager.restore() is at line 168; add setSchemaProvider() setter + _migrateState() private method; SchemaProvider.isValidColumn() is the validator |
| PRST-02 | FilterProvider.setState() gracefully degrades when encountering fields not in current schema — removes invalid filters instead of resetting all state | Currently throws on unknown fields (line 350-353); change: StateManager prunes first so throw never fires; ensure axisFilters and rangeFilters entries keyed on unknown fields are stripped |
| PRST-03 | PAFVProvider.setState() validates axis fields against SchemaProvider — removes invalid axes instead of crashing at render time | Currently defers all validation to compile() (line 659-691); StateManager pruning nulls xAxis/yAxis/groupBy and filters colAxes/rowAxes before setState() receives them |
| PRST-04 | AliasProvider handles dynamic fields — aliases for fields not in schema are preserved (not deleted) for future schema changes | AliasProvider.setState() currently calls isValidAxisField() and silently skips unknown fields (line 93); change: accept ANY string key (remove isValidAxisField() gate) |
</phase_requirements>

---

## Standard Stack

No new libraries required. All tooling is already in place.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript 5.9 (strict) | 5.9 | All source files | Project standard — strict mode enforced |
| Vitest 4.0 | 4.0 | Test framework | `npm test` → `vitest --run` |
| SchemaProvider | (local) | Runtime schema validation | Already wired to allowlist; isValidColumn() is the gate |

### No new dependencies needed

**Test run command:** `npm test` or `npx vitest --run tests/providers/`

---

## Architecture Patterns

### Recommended Change Surface

```
src/providers/
├── StateManager.ts         # ADD: setSchemaProvider(), _migrateState() private method
├── FilterProvider.ts       # NO CHANGE to setState() — StateManager prunes upstream
├── PAFVProvider.ts         # NO CHANGE to setState() — StateManager prunes upstream
└── AliasProvider.ts        # CHANGE: setState() removes isValidAxisField() gate

tests/providers/
├── StateManager.test.ts    # ADD: schema migration integration tests (schema-change scenarios)
├── FilterProvider.test.ts  # ADD: setState with pruned state still compiles correctly
├── PAFVProvider.test.ts    # ADD: setState with pruned axes doesn't throw at compile()
└── AliasProvider.test.ts   # ADD: setState accepts unknown field keys (orphan preservation)
```

### Pattern 1: StateManager Setter Injection (matches PAFVProvider.setSchemaProvider())

**What:** Add `setSchemaProvider(sp: SchemaProvider | null)` to StateManager. The private field `_schema` is null until wired. When null, `_migrateState()` is a pass-through (no pruning).

**When to use:** Always — the null guard ensures tests that don't wire SchemaProvider continue to pass unchanged.

```typescript
// StateManager.ts
import type { SchemaProvider } from './SchemaProvider';

export class StateManager {
  // existing fields...
  private _schema: SchemaProvider | null = null;

  setSchemaProvider(sp: SchemaProvider | null): void {
    this._schema = sp;
  }
```

**Rationale:** Matches the pattern established by PAFVProvider.setSchemaProvider() (Phase 71-02). Constructor injection would break all StateManager instantiation sites in tests.

### Pattern 2: _migrateState() — Pre-Provider Field Pruning

**What:** Private method called inside `restore()` between JSON.parse and provider.setState(). Returns a new object with unknown field references removed. When SchemaProvider is not wired or not initialized, returns input unchanged.

**Key design principle:** StateManager only strips field *names*, not structural shape. The structural guard (isFilterState, isPAFVState) stays in each provider's setState().

```typescript
// Called inside restore() as:
//   const migrated = this._migrateState(row.key, parsed);
//   provider.setState(migrated);

private _migrateState(key: string, state: unknown): unknown {
  if (!this._schema?.initialized) return state;
  if (typeof state !== 'object' || state === null) return state;

  // Per-provider-type pruning based on registered key
  // (key matches what was passed to registerProvider())
  if (key === 'filter') return this._migrateFilterState(state);
  if (key === 'pafv') return this._migratePAFVState(state);
  // alias: no schema-based pruning — orphan preservation by design
  return state;
}
```

**Alternative:** Generic field-extraction helper that operates on all `string`-valued keys of an object. The per-provider approach is recommended because:
1. FilterProvider has three distinct field-keyed structures (filters[], axisFilters{}, rangeFilters{})
2. PAFVProvider has five axis fields (xAxis, yAxis, groupBy, colAxes[], rowAxes[]) with different null semantics
3. Generic extraction would require shape knowledge anyway — might as well be explicit

### Pattern 3: FilterState Migration

FilterProvider has three distinct pruning sites:

1. **filters[]** — array of `{ field, operator, value }`. Remove entries where `field` is unknown.
2. **axisFilters{}** — Record keyed by field. Delete entries with unknown keys.
3. **rangeFilters{}** — Record keyed by field. Delete entries with unknown keys.

```typescript
private _migrateFilterState(state: unknown): unknown {
  const s = state as Record<string, unknown>;
  const isValid = (f: string) => this._schema!.isValidColumn(f, 'cards');

  // Prune filters array
  const filters = Array.isArray(s['filters'])
    ? (s['filters'] as Array<Record<string, unknown>>).filter(
        f => typeof f['field'] === 'string' && isValid(f['field'])
      )
    : s['filters'];

  // Prune axisFilters record
  const axisFilters = s['axisFilters'] != null && typeof s['axisFilters'] === 'object'
    ? Object.fromEntries(
        Object.entries(s['axisFilters'] as Record<string, unknown>)
          .filter(([k]) => isValid(k))
      )
    : s['axisFilters'];

  // Prune rangeFilters record
  const rangeFilters = s['rangeFilters'] != null && typeof s['rangeFilters'] === 'object'
    ? Object.fromEntries(
        Object.entries(s['rangeFilters'] as Record<string, unknown>)
          .filter(([k]) => isValid(k))
      )
    : s['rangeFilters'];

  return { ...s, filters, axisFilters, rangeFilters };
}
```

### Pattern 4: PAFVState Migration

PAFVProvider has five axis fields. The per-decision pruning semantics:
- `xAxis`, `yAxis`, `groupBy` — null if field is unknown (individual axis nulling)
- `colAxes[]`, `rowAxes[]` — filter out entries with unknown fields (array filter)
- `colWidths`, `sortOverrides`, `collapseState` — **preserved unchanged** (non-field-keyed)

```typescript
private _migratePAFVState(state: unknown): unknown {
  const s = state as Record<string, unknown>;
  const isValid = (f: string) => this._schema!.isValidColumn(f, 'cards');
  const nullIfInvalid = (axis: unknown) => {
    if (axis == null) return axis;
    const a = axis as Record<string, unknown>;
    return typeof a['field'] === 'string' && isValid(a['field']) ? axis : null;
  };
  const filterAxes = (axes: unknown) =>
    Array.isArray(axes)
      ? (axes as Array<Record<string, unknown>>).filter(
          a => typeof a['field'] === 'string' && isValid(a['field'])
        )
      : axes;

  return {
    ...s,
    xAxis: nullIfInvalid(s['xAxis']),
    yAxis: nullIfInvalid(s['yAxis']),
    groupBy: nullIfInvalid(s['groupBy']),
    colAxes: filterAxes(s['colAxes']),
    rowAxes: filterAxes(s['rowAxes']),
    // colWidths, sortOverrides, collapseState: pass through unchanged
  };
}
```

### Pattern 5: AliasProvider — Remove isValidAxisField() Gate

**Current behavior** (line 93 in AliasProvider.ts):
```typescript
if (isValidAxisField(key) && typeof value === 'string') {
  this._aliases.set(key, value);
}
```
This silently drops aliases for fields not in the current schema — the opposite of the orphan-preservation requirement.

**New behavior** — remove the `isValidAxisField(key)` check:
```typescript
if (typeof value === 'string') {
  this._aliases.set(key as AxisField, value);
}
```

The type cast `key as AxisField` is safe because AxisField is `KnownAxisField | (string & {})` (widened in Phase 71-01), so any string is structurally valid. getAlias() always returns stored alias regardless of schema.

**Important:** AliasProvider also has a private `_aliases: Map<AxisField, string>` — the map key type accepts any string due to the widened `AxisField` type from Phase 71-01. No type change needed.

### Pattern 6: Wiring in main.ts

StateManager.setSchemaProvider() should be called after `await bridge.isReady` (when SchemaProvider is already initialized), before `await sm.restore()`:

```typescript
// In main.ts bootstrap sequence:
sm.setSchemaProvider(schemaProvider);
await sm.restore();
sm.enableAutoPersist();
```

This matches the existing `setSchemaProvider(schemaProvider)` calls at lines 119/121 of main.ts.

### Pattern 7: Test Fixture Design for Schema-Change Scenarios

**SchemaProvider test helper** (reusable across all three test files):
```typescript
// Build a minimal SchemaProvider with only specific columns
function makeSchemaProvider(columnNames: string[]): SchemaProvider {
  const sp = new SchemaProvider();
  sp.initialize({
    cards: columnNames.map(name => ({
      name,
      type: 'TEXT',
      notnull: false,
      latchFamily: 'Alphabet' as const,
      isNumeric: false,
    })),
    connections: [],
  });
  return sp;
}
```

**Round-trip test structure** (mirrors existing Phase 32 tests in StateManager.test.ts):
```typescript
// Simulate: user configured state with column X → import drops X → restore
it('filters are preserved for valid fields, dropped for removed fields', async () => {
  const { bridge, store } = makePersistenceMock();

  // Session 1: persist state with columns A and B active
  const fp1 = new FilterProvider();
  fp1.addFilter({ field: 'folder', operator: 'eq', value: 'Projects' }); // will survive
  fp1.addFilter({ field: 'status', operator: 'eq', value: 'active' });   // will be pruned
  store.set('filter', fp1.toJSON());

  // Session 2: schema changed — 'status' removed
  const sp = makeSchemaProvider(['folder', 'card_type', 'name']);
  const fp2 = new FilterProvider();
  const sm = new StateManager(bridge);
  sm.setSchemaProvider(sp);
  sm.registerProvider('filter', fp2);
  await sm.restore();

  // Only 'folder' filter survives
  expect(fp2.getFilters()).toHaveLength(1);
  expect(fp2.getFilters()[0]!.field).toBe('folder');
  // compile() does not throw
  expect(() => fp2.compile()).not.toThrow();
});
```

### Anti-Patterns to Avoid

- **Modifying provider setState() signatures**: Providers already accept `unknown`. StateManager does the pruning, providers handle structural validation. Don't collapse these layers.
- **Using provider keys as magic strings inside _migrateState()**: Keys ('filter', 'pafv') are set by the caller in `registerProvider()`. The mapping inside `_migrateState()` must match exactly what main.ts uses. Consider a `MigrationType` map or at least clear comments.
- **Pruning colWidths/sortOverrides/collapseState**: These are not field-reference data — they use arbitrary keys (colKey strings, sort field names). They survive all schema changes per the locked decision.
- **Re-running field validation in the migration path when SchemaProvider is uninitialized**: The `!this._schema?.initialized` guard is critical. Uninitialized SchemaProvider has empty column sets — everything would be pruned. Pass through when not ready.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column existence check | Custom regex or set lookup | `SchemaProvider.isValidColumn(field, 'cards')` | Already built, handles boot-time fallback |
| Structural JSON validation | Custom shape checks in _migrateState | Existing isFilterState/isPAFVState guards in providers | Migration only strips field refs; structural shape still validated downstream |

---

## Common Pitfalls

### Pitfall 1: Pruning colWidths Object Keys
**What goes wrong:** `colWidths` is `Record<string, number>` keyed by `colKey` (e.g., 'note', 'task') — not column names. Filtering its entries against `isValidColumn()` would incorrectly strip all widths (colKey values don't match column names).
**Why it happens:** colWidths looks like a field-keyed Record but uses a different key domain.
**How to avoid:** Locked decision: "Column widths, sort overrides, collapse state survive even when axis fields are pruned." Pass these through without modification.
**Warning signs:** Test where colWidths is populated shows empty `{}` after restore.

### Pitfall 2: Schema Not Initialized at Restore Time
**What goes wrong:** If `_migrateState()` runs before `schemaProvider.initialized === true`, the empty column set causes ALL fields to be considered invalid and pruned.
**Why it happens:** SchemaProvider starts uninitialized and must receive a `initialize()` call from the Worker `ready` message. If `restore()` is called before `await bridge.isReady`, schema is empty.
**How to avoid:** Guard with `if (!this._schema?.initialized) return state;`. In main.ts, `restore()` is always called after `await bridge.isReady`, but the guard prevents silent data loss in test or edge-case boot paths.
**Warning signs:** After restore, all providers show empty/default state even with valid stored state.

### Pitfall 3: AliasProvider Key Type Mismatch
**What goes wrong:** `_aliases` is `Map<AxisField, string>`. Storing an unknown column key with `this._aliases.set(key as AxisField, value)` may trigger TypeScript errors if AxisField is not sufficiently widened.
**Why it happens:** Pre-Phase 71 AxisField was a narrow literal union. Post-Phase 71 it is `KnownAxisField | (string & {})` — any string is valid.
**How to avoid:** Confirm AxisField is the widened type (it is, per Phase 71-01 STATE.md entry). The cast `key as AxisField` is correct.
**Warning signs:** TypeScript error "Type 'string' is not assignable to type 'AxisField'" after removing the isValidAxisField gate.

### Pitfall 4: _migrateState Key String Coupling
**What goes wrong:** `_migrateState()` switches on `key` (e.g., `if (key === 'filter')`) which must match the registration key used in `registerProvider('filter', ...)` in main.ts. If these drift, migration silently does nothing.
**Why it happens:** The mapping is implicit, not enforced at compile time.
**How to avoid:** Use a strategy Map or at minimum document the coupling with a comment. Test coverage is the primary safety net — schema-change tests wire StateManager with real providers and verify pruning.
**Warning signs:** Schema-change test shows filter with unknown field surviving to setState (no pruning occurred).

### Pitfall 5: Existing Tests Break Due to AliasProvider Change
**What goes wrong:** Current AliasProvider test at line 111: `'setState ignores invalid fields'` explicitly tests that `bogus_field` is dropped. Changing setState() to accept any key will break this test.
**Why it happens:** The existing test was written against the old behavior that dropped unknown fields.
**How to avoid:** Update the test to reflect the new orphan-preservation behavior — `bogus_field: 'Bad'` should now be preserved in the aliases map. Update test description accordingly.
**Warning signs:** Red test "setState ignores invalid fields" after AliasProvider change.

---

## Code Examples

### StateManager Integration (main.ts wiring)

```typescript
// After await bridge.isReady, before await sm.restore():
sm.setSchemaProvider(schemaProvider);
await sm.restore();
sm.enableAutoPersist();
```

### Existing SchemaProvider test fixture columns (from SchemaProvider.test.ts)

```typescript
const CARD_COLUMNS: ColumnInfo[] = [
  { name: 'name',        type: 'TEXT',    notnull: true,  latchFamily: 'Alphabet',   isNumeric: false },
  { name: 'folder',      type: 'TEXT',    notnull: false, latchFamily: 'Category',   isNumeric: false },
  { name: 'status',      type: 'TEXT',    notnull: false, latchFamily: 'Category',   isNumeric: false },
  { name: 'card_type',   type: 'TEXT',    notnull: true,  latchFamily: 'Category',   isNumeric: false },
  { name: 'created_at',  type: 'TEXT',    notnull: true,  latchFamily: 'Time',       isNumeric: false },
  { name: 'priority',    type: 'INTEGER', notnull: true,  latchFamily: 'Hierarchy',  isNumeric: true  },
];
```

### makePersistenceMock (existing helper in StateManager.test.ts)

The persistence mock bridge (lines 455-479 of StateManager.test.ts) simulates ui:set/ui:getAll round-trips using an in-memory Map. All schema-change integration tests should use this helper.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vitest.config.ts` (pool: forks, globalSetup: tests/setup/wasm-init.ts) |
| Quick run command | `npx vitest --run tests/providers/StateManager.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRST-01 | StateManager._migrateState() strips unknown fields before setState() | unit/integration | `npx vitest --run tests/providers/StateManager.test.ts` | ✅ (extend existing) |
| PRST-02 | FilterProvider: valid filters survive, invalid ones pruned; axisFilters/rangeFilters entries pruned per-key | integration | `npx vitest --run tests/providers/StateManager.test.ts` | ✅ (extend existing) |
| PRST-03 | PAFVProvider: unknown xAxis/yAxis/groupBy nulled; unknown colAxes/rowAxes entries filtered; colWidths/sortOverrides/collapseState preserved | integration | `npx vitest --run tests/providers/StateManager.test.ts` | ✅ (extend existing) |
| PRST-04 | AliasProvider: unknown-field aliases preserved across setState(); compile() still works | unit | `npx vitest --run tests/providers/AliasProvider.test.ts` | ✅ (update existing) |

### Wave 0 Gaps

- [ ] `tests/providers/StateManager.test.ts` — add `describe('Phase 72 — schema migration')` block with schema-change integration tests (needs `makeSchemaProvider` helper)
- [ ] `tests/providers/AliasProvider.test.ts` — update `'setState ignores invalid fields'` test to reflect orphan-preservation behavior; add orphan-preservation tests

*(No new test files needed — all tests extend existing files. No new framework installation needed.)*

---

## Open Questions

1. **Registration key coupling in _migrateState()**
   - What we know: keys 'filter', 'pafv', 'alias' are set in main.ts registerProvider() calls
   - What's unclear: whether other callers (tests, future code) use different keys
   - Recommendation: Document the coupling explicitly. Consider a typed constant `const FILTER_PROVIDER_KEY = 'filter'` shared between main.ts and StateManager, or simply accept the magic string and guard it with a test.

2. **sortOverrides field validation**
   - What we know: `sortOverrides` is `SortEntry[]` where `SortEntry = { field: AxisField, direction: ... }`. These are axis field names.
   - What's unclear: Per the locked decision, sort overrides "survive even when axis fields are pruned." But if the sort field no longer exists, compile() will throw when PAFVProvider validates it via validateAxisField().
   - Recommendation: Per the locked decision, pass sortOverrides through unchanged. The throw-at-compile-time behavior is the safety net. If this causes a UI issue, it's a scope-escalation beyond Phase 72. The CONTEXT.md decision is explicit: "Column widths, sort overrides, collapse state survive even when axis fields are pruned."

3. **Test isolation for allowlist module-level `_schemaProvider`**
   - What we know: allowlist.ts has a module-level `_schemaProvider` that is set globally. Tests that call setSchemaProvider() need to reset it in afterEach.
   - What's unclear: Whether the new StateManager tests that wire SchemaProvider to StateManager (not to the allowlist) are fully isolated.
   - Recommendation: StateManager._migrateState() uses `this._schema.isValidColumn()` directly (not via allowlist). Tests can create SchemaProvider instances without calling the global `setSchemaProvider()`. No cross-test pollution risk for the new migration tests.

---

## Sources

### Primary (HIGH confidence)
- `src/providers/StateManager.ts` — full source, restore() at line 168, constructor pattern
- `src/providers/FilterProvider.ts` — setState() at line 344, full filter/axisFilters/rangeFilters structure
- `src/providers/PAFVProvider.ts` — setState() at line 659, all axis fields, structural validation
- `src/providers/AliasProvider.ts` — setState() at line 89, isValidAxisField() gate at line 93
- `src/providers/allowlist.ts` — isValidAxisField/isValidFilterField, SchemaProvider delegation pattern
- `src/providers/SchemaProvider.ts` — isValidColumn() API, initialize() contract
- `tests/providers/StateManager.test.ts` — makePersistenceMock helper, existing round-trip tests
- `tests/providers/AliasProvider.test.ts` — existing test at line 111 that must be updated
- `tests/providers/SchemaProvider.test.ts` — CARD_COLUMNS fixture shape (reusable in new tests)
- `.planning/phases/72-state-persistence-migration/72-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `src/main.ts` — wiring sequence (lines 119, 147, 175, 180) — confirms setter injection is the standard pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing tools verified by source inspection
- Architecture: HIGH — pruning logic derived directly from locked decisions + source code structure
- Pitfalls: HIGH — identified from direct code reading (actual current behaviors, not assumptions)

**Research date:** 2026-03-11
**Valid until:** Stable — pure internal refactor, no external dependencies
