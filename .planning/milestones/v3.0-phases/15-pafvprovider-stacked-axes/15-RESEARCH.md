# Phase 15: PAFVProvider Stacked Axes - Research

**Researched:** 2026-03-03
**Domain:** TypeScript provider extension — state shape evolution, serialization compatibility, SQL fragment generation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**State shape coexistence:**
- Add `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` as NEW fields on PAFVState alongside existing `xAxis`/`yAxis`/`groupBy`
- SuperGrid reads colAxes/rowAxes; other views read xAxis/yAxis/groupBy — no interference
- All VIEW_DEFAULTS entries get `colAxes: []` and `rowAxes: []` — uniform state shape, no null checks
- colAxes/rowAxes participate in view family suspension (LATCH <-> GRAPH) — suspended and restored with the rest of the state
- xAxis/yAxis/groupBy are left as-is when switching to supergrid — SuperGrid simply ignores them
- No convenience getter like getActiveAxes() — keep PAFVProvider lean, each consumer knows what it needs

**Setter API:**
- Array setters: `setColAxes(axes: AxisMapping[])` and `setRowAxes(axes: AxisMapping[])` — caller provides full array, atomic update
- SuperDynamic (Phase 18) can build reorder helpers on top of the array setter

**Default supergrid axes:**
- VIEW_DEFAULTS.supergrid pre-populates: `colAxes: [{ field: 'card_type', direction: 'asc' }]`, `rowAxes: [{ field: 'folder', direction: 'asc' }]`
- Matches current hardcoded DEFAULT_COL_FIELD/DEFAULT_ROW_FIELD in SuperGrid.ts
- Provides seamless transition when Phase 17 removes those hardcoded constants

**Backward compatibility (legacy JSON):**
- If persisted JSON lacks colAxes/rowAxes fields, setState() defaults them to `[]` — no throw, no reset
- isPAFVState type guard accepts legacy shape and fills in defaults

**Axis limits & validation:**
- Maximum 3 axes per dimension (colAxes and rowAxes each capped at 3)
- Matches SuperGridQuery's existing support for up to 3 axes per dimension
- Throw immediately on overflow: "Maximum 3 axes per dimension"
- Throw immediately on invalid field via validateAxisField() — consistent with existing setXAxis() pattern
- Reject duplicate fields within same dimension — throw "Duplicate axis field"
- Allow cross-dimension duplicates (same field in both colAxes and rowAxes) — supports correlation matrix pivots

**getStackedGroupBySQL() contract:**
- Returns `{ colAxes: AxisMapping[], rowAxes: AxisMapping[] }` — the axes portion of SuperGridQueryConfig
- Caller (Phase 16 Worker) combines with FilterProvider's WHERE clause and passes to buildSuperGridQuery()
- Works for any viewType (no supergrid gate) — returns arrays regardless, may be empty for non-supergrid views
- Validates all axis fields via validateAxisField() at call time — catches corrupt JSON-restored state early, consistent with compile()
- Returns defensive copies (`[...this._state.colAxes]`) — matches getState()'s shallow-copy pattern

### Claude's Discretion

- Exact error message wording for overflow and duplicate violations
- Whether to deep-copy or shallow-copy AxisMapping objects within the defensive copy
- Internal helper method organization

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-01 | PAFVProvider exposes `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` with setter methods validated against existing allowlist | Existing `validateAxisField()` in allowlist.ts is directly reusable. Setter pattern mirrors `setXAxis()`/`setYAxis()`. |
| FOUN-02 | PAFVProvider provides `getStackedGroupBySQL()` method separate from `compile()` that returns multi-field GROUP BY SQL from stacked axes | `SuperGridQueryConfig` in SuperGridQuery.ts already defines the exact return shape `{ colAxes, rowAxes }`. Method is a pure projection of internal state with defensive copy. |
| FOUN-03 | PAFVProvider stacked axes serialize/deserialize via `toJSON()`/`setState()` with round-trip fidelity | `toJSON()` already serializes `this._state` as JSON. `isPAFVState()` type guard needs extension to accept optional arrays. Legacy JSON (missing fields) defaults to `[]` in setState(). |
| FOUN-04 | All 8 non-SuperGrid views continue using `compile()` unaffected by stacked axes addition | `compile()` uses only `xAxis`/`yAxis`/`groupBy` — adding `colAxes`/`rowAxes` to state does not touch compile(). VIEW_DEFAULTS for all 8 non-supergrid views get `colAxes: []`, `rowAxes: []`. |

</phase_requirements>

---

## Summary

Phase 15 is a pure TypeScript state extension with no new dependencies, no UI changes, and no integration with the Worker. The task is to extend one class (`PAFVProvider`) and its associated types/test file. Every pattern needed already exists in the codebase — the new setter API is a direct parallel of `setXAxis()`/`setYAxis()`, the new method `getStackedGroupBySQL()` is modeled on `compile()`, and the type guard extension for `isPAFVState()` is a small backward-compatible addition.

The primary technical concern is backward compatibility with persisted JSON that was written before this phase. The locked decision — that `setState()` fills missing `colAxes`/`rowAxes` with `[]` rather than throwing — handles this cleanly. The `isPAFVState()` type guard must be updated to accept objects that lack these fields (optional presence) and the provider fills them in at `setState()` time.

The second concern is zero regression on the 8 non-SuperGrid views. Because `compile()` is untouched and the new fields start as `[]` in `VIEW_DEFAULTS`, no existing code path changes. The test requirement (FOUN-04) is satisfied by running the existing test suite unchanged after the extension.

**Primary recommendation:** Extend PAFVState interface + VIEW_DEFAULTS, add two setters + one query method following existing patterns, extend isPAFVState() for backward compatibility, then add test groups for the new behavior. Zero new dependencies.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Type safety for state shape changes | Project standard (D-001 locked) |
| Vitest | 4.0.18 | Test framework | Project standard, used by all existing provider tests |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | This phase adds no new dependencies |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shallow copy of AxisMapping arrays | structuredClone of each AxisMapping | Deep copy prevents aliasing if callers mutate returned objects; shallow copy is faster and matches getState() pattern |

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Recommended Project Structure

No new files. Changes are confined to:

```
src/
├── providers/
│   ├── PAFVProvider.ts        # ← extend PAFVState, VIEW_DEFAULTS, add setters/method, extend type guard
│   └── types.ts               # ← no changes needed (AxisMapping already defined)
tests/
└── providers/
    └── PAFVProvider.test.ts   # ← add new describe blocks for stacked axes
```

### Pattern 1: PAFVState Interface Extension

**What:** Add `colAxes` and `rowAxes` as required fields on the internal `PAFVState` interface. TypeScript will then enforce that all `VIEW_DEFAULTS` entries include them.

**When to use:** Any time state shape grows — add fields, update defaults, let TypeScript flag all gaps.

**Example:**
```typescript
// BEFORE (existing)
interface PAFVState {
  viewType: ViewType;
  xAxis: AxisMapping | null;
  yAxis: AxisMapping | null;
  groupBy: AxisMapping | null;
}

// AFTER (Phase 15)
interface PAFVState {
  viewType: ViewType;
  xAxis: AxisMapping | null;
  yAxis: AxisMapping | null;
  groupBy: AxisMapping | null;
  colAxes: AxisMapping[];   // NEW — SuperGrid column dimension
  rowAxes: AxisMapping[];   // NEW — SuperGrid row dimension
}
```

TypeScript compile errors after this change will point to every location needing update — VIEW_DEFAULTS, structuredClone calls, etc.

### Pattern 2: Array Setter with Validation

**What:** Validate each element in the incoming array before assigning to state. Pattern mirrors existing scalar setters (`setXAxis`), extended to validate: (a) field allowlist, (b) max 3 items, (c) no duplicate fields within the array.

**When to use:** Any setter that accepts an externally-provided array that feeds into SQL.

**Example:**
```typescript
// Follows the established: validate → assign → _scheduleNotify pattern
setColAxes(axes: AxisMapping[]): void {
  if (axes.length > 3) {
    throw new Error('Maximum 3 axes per dimension');
  }
  const seen = new Set<string>();
  for (const axis of axes) {
    validateAxisField(axis.field as string); // reuses existing assertion
    if (seen.has(axis.field)) {
      throw new Error(`Duplicate axis field: "${axis.field}"`);
    }
    seen.add(axis.field);
  }
  this._state.colAxes = [...axes]; // defensive copy on assignment
  this._scheduleNotify();
}
```

### Pattern 3: getStackedGroupBySQL() — Pure Projection

**What:** A synchronous, side-effect-free method that validates stored state and returns a defensive copy of the axes arrays. Same pattern as `compile()` but returns `{ colAxes, rowAxes }` instead of `{ orderBy, groupBy }`.

**When to use:** Any provider method that exposes internal arrays — always return copies.

**Example:**
```typescript
// Modeled on compile() — validate at call time, return copies
getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] } {
  for (const axis of [...this._state.colAxes, ...this._state.rowAxes]) {
    validateAxisField(axis.field as string); // catches corrupt JSON-restored state
  }
  return {
    colAxes: [...this._state.colAxes],
    rowAxes: [...this._state.rowAxes],
  };
}
```

Note: The return type matches the `colAxes`/`rowAxes` subset of `SuperGridQueryConfig` (defined in SuperGridQuery.ts). Phase 16 will combine this output with FilterProvider's compiled WHERE clause to produce a full `SuperGridQueryConfig`.

### Pattern 4: isPAFVState() Extension for Backward Compatibility

**What:** The type guard must accept legacy JSON that lacks `colAxes`/`rowAxes` (written before Phase 15). Rather than failing validation, missing fields are accepted and `setState()` fills them with `[]`.

**When to use:** Any time a serialized state shape gains new optional fields.

**Example:**
```typescript
// BEFORE
function isPAFVState(value: unknown): value is PAFVState {
  // ... existing checks for viewType, xAxis, yAxis, groupBy ...
  return true;
}

// AFTER — accept missing colAxes/rowAxes (legacy JSON), validate arrays if present
function isPAFVState(value: unknown): value is PAFVState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj['viewType'] !== 'string') return false;
  if (obj['xAxis'] !== null && !isAxisMapping(obj['xAxis'])) return false;
  if (obj['yAxis'] !== null && !isAxisMapping(obj['yAxis'])) return false;
  if (obj['groupBy'] !== null && !isAxisMapping(obj['groupBy'])) return false;

  // NEW: colAxes/rowAxes are optional (legacy JSON won't have them)
  // If present, must be arrays of AxisMapping-shaped objects
  if (obj['colAxes'] !== undefined) {
    if (!Array.isArray(obj['colAxes'])) return false;
    if (!(obj['colAxes'] as unknown[]).every(isAxisMapping)) return false;
  }
  if (obj['rowAxes'] !== undefined) {
    if (!Array.isArray(obj['rowAxes'])) return false;
    if (!(obj['rowAxes'] as unknown[]).every(isAxisMapping)) return false;
  }

  return true;
}

// setState() fills missing fields:
setState(state: unknown): void {
  if (!isPAFVState(state)) {
    throw new Error('[PAFVProvider] setState: invalid state shape');
  }
  this._state = {
    ...state,
    colAxes: (state as any).colAxes ?? [],  // legacy JSON default
    rowAxes: (state as any).rowAxes ?? [],  // legacy JSON default
  };
  this._suspendedStates.clear();
}
```

The type guard has a structural mismatch problem: `isPAFVState` returns `value is PAFVState`, but PAFVState now has required `colAxes`/`rowAxes`. The solution is to define a `LegacyPAFVState` type internally (with optional fields) or to fill the defaults inside `setState()` after the guard passes. The cleanest approach given the codebase pattern is to fill defaults in `setState()` using `?? []` — the type guard validates shape, `setState()` normalizes missing fields.

### Pattern 5: VIEW_DEFAULTS Update

**What:** Every entry in `VIEW_DEFAULTS` gains `colAxes: []` and `rowAxes: []`. The supergrid entry gets non-empty defaults matching current hardcoded constants.

**Example:**
```typescript
const VIEW_DEFAULTS: Record<ViewType, PAFVState> = {
  list:     { viewType: 'list',     xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  grid:     { viewType: 'grid',     xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  kanban:   { viewType: 'kanban',   xAxis: null, yAxis: null, groupBy: { field: 'status', direction: 'asc' }, colAxes: [], rowAxes: [] },
  calendar: { viewType: 'calendar', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  timeline: { viewType: 'timeline', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  gallery:  { viewType: 'gallery',  xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  network:  { viewType: 'network',  xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  tree:     { viewType: 'tree',     xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  // SuperGrid default: mirrors current hardcoded DEFAULT_COL_FIELD / DEFAULT_ROW_FIELD
  supergrid: {
    viewType: 'supergrid',
    xAxis: null,
    yAxis: null,
    groupBy: null,
    colAxes: [{ field: 'card_type', direction: 'asc' }],
    rowAxes: [{ field: 'folder',    direction: 'asc' }],
  },
};
```

### Anti-Patterns to Avoid

- **Mutating the returned array from getStackedGroupBySQL():** Always return `[...this._state.colAxes]` — callers must not be able to mutate internal state through the returned reference.
- **Gating getStackedGroupBySQL() on viewType === 'supergrid':** The locked decision says it works for any viewType — the worker decides what to do with empty arrays.
- **Throwing in setState() when colAxes/rowAxes is absent:** Legacy JSON won't have them — fill with `[]`, don't throw.
- **Adding colAxes/rowAxes to compile():** compile() is for the 8 non-SuperGrid views. It must not change at all.
- **Calling _scheduleNotify() inside getStackedGroupBySQL():** It's a pure read method, not a mutation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL field safety validation | Custom allowlist checker | `validateAxisField()` from allowlist.ts | Already exists, tested, throws with canonical "SQL safety violation:" prefix |
| Duplicate detection within array | Custom nested loop | `Set<string>` with `.has()` check | O(N) vs O(N²), idiomatic JS |
| Deep copy of AxisMapping | Recursive clone | Spread `[...axes]` of `{ ...axis }` objects | AxisMapping is a flat 2-field object — spread is sufficient; structuredClone overkill |

**Key insight:** Everything needed for validation already exists in `allowlist.ts`. The only "new" logic is the array-level constraints (max 3, no duplicates within dimension) which are trivial.

---

## Common Pitfalls

### Pitfall 1: Aliasing on Setter Assignment

**What goes wrong:** `this._state.colAxes = axes` — if caller mutates the array they passed in, internal state mutates too.

**Why it happens:** Arrays are reference types.

**How to avoid:** Always copy on assignment: `this._state.colAxes = [...axes]`. The locked decision says "caller provides full array, atomic update" — take a snapshot of it.

**Warning signs:** Tests that mutate the array after calling setColAxes() and see the mutation reflected in getState().

### Pitfall 2: Type Guard / setState() Shape Mismatch

**What goes wrong:** `isPAFVState()` returns `value is PAFVState`, but PAFVState now requires `colAxes`/`rowAxes`. Legacy JSON fails the guard even though it's valid legacy data.

**Why it happens:** TypeScript interface requires all fields; JSON from before Phase 15 has none of the new fields.

**How to avoid:** The type guard checks for optional presence. `setState()` fills missing fields with `[]` after the guard passes. The guard validates that IF the fields are present they are the right shape.

**Warning signs:** `setState()` throwing on round-tripped JSON from Phase 14 (before colAxes/rowAxes existed).

### Pitfall 3: VIEW_DEFAULTS Sharing References

**What goes wrong:** Two different PAFVProvider instances share the same `colAxes` array from VIEW_DEFAULTS if they aren't cloned on construction.

**Why it happens:** `PAFVProvider` already uses `structuredClone(VIEW_DEFAULTS[DEFAULT_VIEW_TYPE])` on construction — this is correct. The pitfall is forgetting to do the same in `resetToDefaults()` or the family-restoration path.

**How to avoid:** Check that `resetToDefaults()` continues to use `structuredClone(VIEW_DEFAULTS[...])` — this is already the pattern and must not regress.

**Warning signs:** One provider's setColAxes() call affecting another provider's getState().colAxes.

### Pitfall 4: Suspension Missing New Fields

**What goes wrong:** View family suspension uses `structuredClone(this._state)` — if PAFVState adds new fields, they are automatically included in the clone because structuredClone is deep. No action needed, but must verify colAxes/rowAxes are present in suspended state.

**Why it happens:** structuredClone clones all enumerable own properties — adding fields to the interface automatically means they're included.

**How to avoid:** Write a test that sets colAxes, suspends (setViewType to graph), restores (setViewType back), and asserts colAxes survived.

**Warning signs:** Test failures showing colAxes = [] after restoration even though non-empty colAxes were set before suspension.

### Pitfall 5: getStackedGroupBySQL() Not Matching SuperGridQueryConfig Shape

**What goes wrong:** Phase 16 expects `{ colAxes: AxisMapping[], rowAxes: AxisMapping[] }` — any deviation in property names or types breaks Phase 16 integration.

**Why it happens:** Return type written from memory instead of matching the existing interface.

**How to avoid:** Import or reference `SuperGridQueryConfig` from SuperGridQuery.ts when documenting the return type in JSDoc. The return type is the `colAxes`/`rowAxes` subset of that interface.

---

## Code Examples

Verified from direct source inspection of `/Users/mshaler/Developer/Projects/Isometry/src/providers/PAFVProvider.ts` and `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts`:

### Existing setXAxis() Pattern (model for new setters)

```typescript
// Source: src/providers/PAFVProvider.ts lines 120-126
setXAxis(axis: AxisMapping | null): void {
  if (axis !== null) {
    validateAxisField(axis.field as string);
  }
  this._state.xAxis = axis;
  this._scheduleNotify();
}
```

### Existing compile() Pattern (model for getStackedGroupBySQL())

```typescript
// Source: src/providers/PAFVProvider.ts lines 195-222
compile(): CompiledAxis {
  const orderParts: string[] = [];

  if (this._state.xAxis !== null) {
    validateAxisField(this._state.xAxis.field as string);
    orderParts.push(
      `${this._state.xAxis.field} ${this._state.xAxis.direction.toUpperCase()}`
    );
  }
  // ... etc
}
```

### Existing isPAFVState() (must be extended)

```typescript
// Source: src/providers/PAFVProvider.ts lines 304-316
function isPAFVState(value: unknown): value is PAFVState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj['viewType'] !== 'string') return false;

  // xAxis, yAxis, groupBy must be null or a valid AxisMapping shape
  if (obj['xAxis'] !== null && !isAxisMapping(obj['xAxis'])) return false;
  if (obj['yAxis'] !== null && !isAxisMapping(obj['yAxis'])) return false;
  if (obj['groupBy'] !== null && !isAxisMapping(obj['groupBy'])) return false;

  return true;
}
```

### SuperGridQueryConfig Return Shape (getStackedGroupBySQL() output matches this)

```typescript
// Source: src/views/supergrid/SuperGridQuery.ts lines 24-33
export interface SuperGridQueryConfig {
  /** Up to 3 column axis mappings (primary, secondary, tertiary) */
  colAxes: AxisMapping[];
  /** Up to 3 row axis mappings (primary, secondary, tertiary) */
  rowAxes: AxisMapping[];
  /** SQL WHERE clause fragment from FilterProvider.compile() (may be empty string) */
  where: string;
  /** Parameterized values corresponding to the WHERE clause placeholders */
  params: unknown[];
}
```

### Existing Hardcoded Constants in SuperGrid.ts (Phase 15 pre-populates VIEW_DEFAULTS to match)

```typescript
// Source: src/views/SuperGrid.ts lines 40-41
// Default axis fields when no PAFVProvider is supplied
const DEFAULT_COL_FIELD = 'card_type';
const DEFAULT_ROW_FIELD = 'folder';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded col/row fields in SuperGrid.ts | PAFVProvider VIEW_DEFAULTS.supergrid | Phase 15 | Phase 17 can remove the hardcoded constants safely |
| Single-axis scalar state (xAxis/yAxis/groupBy) | Extended with multi-axis arrays (colAxes/rowAxes) | Phase 15 | SuperGrid can now receive dynamic axis config from provider |

**No deprecated patterns in this phase.** All changes are additive.

---

## Open Questions

1. **Shallow vs. deep copy of AxisMapping objects within the defensive copy**
   - What we know: AxisMapping is `{ field: AxisField, direction: SortDirection }` — two primitive strings, no nesting
   - What's unclear: Whether `[...axes]` (shallow array copy, same object references) or `axes.map(a => ({ ...a }))` (new AxisMapping objects) is preferred
   - Recommendation: `[...axes]` is sufficient — AxisMapping objects are structurally flat; the spread prevents external mutation of the array itself; individual AxisMapping objects are tiny and callers have no reason to mutate them. Use shallow copy to match `getState()`'s `{ ...this._state }` pattern.

2. **Exact error message wording** (Claude's discretion)
   - What we know: Existing error messages follow "SQL safety violation: ..." format for field violations
   - What's unclear: Whether overflow/duplicate errors should also start with "SQL safety violation:" or use a different prefix
   - Recommendation: Use a distinct prefix for constraint violations: `"Maximum 3 axes per dimension"` and `"Duplicate axis field: \"${field}\""`. Keep "SQL safety violation:" exclusively for allowlist violations to preserve grep-ability. Tests should match on the start of the message.

3. **resetToDefaults() behavior for colAxes/rowAxes on supergrid view**
   - What we know: `resetToDefaults()` resets to `VIEW_DEFAULTS['list']` regardless of current view type
   - What's unclear: Not actually unclear — resetToDefaults() always goes to list view, so colAxes/rowAxes will be `[]` after reset, which is correct
   - Recommendation: No change needed to resetToDefaults() behavior. Document that it resets to list view (not current view's defaults).

---

## Sources

### Primary (HIGH confidence)

- Direct source inspection: `/Users/mshaler/Developer/Projects/Isometry/src/providers/PAFVProvider.ts` — full class structure, existing patterns
- Direct source inspection: `/Users/mshaler/Developer/Projects/Isometry/src/providers/allowlist.ts` — validateAxisField(), ALLOWED_AXIS_FIELDS
- Direct source inspection: `/Users/mshaler/Developer/Projects/Isometry/src/providers/types.ts` — AxisMapping, AxisField, PAFVState interfaces
- Direct source inspection: `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts` — SuperGridQueryConfig, buildSuperGridQuery()
- Direct source inspection: `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` — DEFAULT_COL_FIELD, DEFAULT_ROW_FIELD
- Direct source inspection: `/Users/mshaler/Developer/Projects/Isometry/tests/providers/PAFVProvider.test.ts` — existing test structure and patterns
- Direct source inspection: `/Users/mshaler/Developer/Projects/Isometry/vitest.config.ts` — test runner config (Vitest 4.x, node env, pool:forks)
- CONTEXT.md: `/Users/mshaler/Developer/Projects/Isometry/.planning/phases/15-pafvprovider-stacked-axes/15-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

None required — all findings are from direct codebase inspection.

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing test files
- Architecture patterns: HIGH — verified from direct inspection of PAFVProvider.ts, all patterns confirmed in existing code
- Pitfalls: HIGH — derived from code structure (reference semantics, type guard behavior) and locked decisions

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase — these files change only when phases execute)
