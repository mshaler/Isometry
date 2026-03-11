# Phase 71: Dynamic Schema Integration - Research

**Researched:** 2026-03-11
**Domain:** TypeScript refactoring -- replacing hardcoded field lists with SchemaProvider reads
**Confidence:** HIGH

## Summary

Phase 71 replaces all hardcoded field-list constants across 8+ source files with runtime reads from SchemaProvider (built in Phase 70). The SchemaProvider already exposes typed accessors (`getColumns()`, `getNumericColumns()`, `getFieldsByFamily()`, `getLatchFamilies()`) and is wired into main.ts via the onSchema callback pattern. The allowlist delegation (DYNM-01/02) is already partially complete from Phase 70 -- `isValidFilterField` and `isValidAxisField` already delegate to SchemaProvider when wired.

The primary challenge is a **dual LatchFamily type system**: `protocol.ts` defines `LatchFamily = 'Location' | 'Alphabet' | 'Time' | 'Category' | 'Hierarchy'` (used by SchemaProvider), while `latch.ts` defines `LatchFamily = 'L' | 'A' | 'T' | 'C' | 'H'` (used by all UI explorers). Phase 71 must bridge this mapping. The secondary challenge is **TypeScript type widening** for `AxisField` and `FilterField` -- these are currently literal unions that must accept dynamic fields at flow-through boundaries while preserving autocomplete and type narrowing for known fields.

**Primary recommendation:** Proceed in two waves: (1) Core type widening + allowlist + latch.ts migration + SchemaProvider accessors, (2) UI explorer migrations + grep audit.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DYNM-01 | allowlist.ts fields populated from SchemaProvider with hardcoded fallback | Phase 70 already wired delegation for isValid*; remaining work is making ALLOWED_*_FIELDS mutable or derived |
| DYNM-02 | validate/assert functions preserve D-003 boundary -- same signatures, different backing data | Type signatures unchanged; backing data switches from frozen Set to SchemaProvider.isValidColumn() |
| DYNM-03 | AxisField/FilterField types accept dynamic fields with literal unions for known fields | Pattern: `type AxisField = KnownAxisField \| (string & {})` preserves autocomplete |
| DYNM-04 | LATCH_FAMILIES in latch.ts sourced from SchemaProvider.getLatchFamilies() with fallback | Requires LatchFamily letter-to-fullname mapping bridge |
| DYNM-05 | PropertiesExplorer iterates SchemaProvider columns instead of importing ALLOWED_AXIS_FIELDS | SchemaProvider.getAxisColumns() returns ColumnInfo[] with latchFamily |
| DYNM-06 | ProjectionExplorer available-field pool from SchemaProvider | Same pattern as DYNM-05 -- replace ALLOWED_AXIS_FIELDS import |
| DYNM-07 | CalcExplorer NUMERIC_FIELDS from SchemaProvider.getNumericColumns() | ColumnInfo.isNumeric already available |
| DYNM-08 | CalcExplorer FIELD_DISPLAY_NAMES replaced with AliasProvider.getAlias() | AliasProvider already injected into CalcExplorer's parent context |
| DYNM-09 | LatchExplorers CATEGORY/HIERARCHY/TIME_FIELDS from SchemaProvider.getFieldsByFamily() | Requires letter-to-fullname family mapping |
| DYNM-10 | SuperGridQuery ALLOWED_TIME_FIELDS from SchemaProvider.getFieldsByFamily('Time') | Worker-side; may use validColumnNames Set instead since SuperGridQuery runs in Worker |
| DYNM-11 | PAFVProvider VIEW_DEFAULTS use SchemaProvider-aware field selection | Default axes (card_type, folder) should remain as fallback when SchemaProvider not initialized |
| DYNM-12 | SuperDensityProvider displayField validation uses SchemaProvider | Replace ALLOWED_AXIS_FIELDS.has() with SchemaProvider.isValidColumn() |
| DYNM-13 | All 15 hardcoded field list locations verified replaced -- grep audit | See inventory below |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 | Static type system | Project standard |
| SchemaProvider | Phase 70 | Runtime column metadata | Already built -- single source of truth |
| AliasProvider | Phase 55 | Display name resolution | Already used across all explorers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.0 | Unit testing | Verify all migrated code paths |

**No new dependencies required.** This is purely a refactoring phase.

## Architecture Patterns

### Pattern 1: SchemaProvider Injection via Config Object

All UI explorers already receive dependencies via config objects. SchemaProvider follows the same pattern.

**What:** Add `schema: SchemaProvider` to each explorer's config interface.
**When to use:** Every explorer that currently imports ALLOWED_AXIS_FIELDS or hardcoded field lists.
**Example:**
```typescript
// Before:
import { ALLOWED_AXIS_FIELDS } from '../providers/allowlist';
// ...
for (const f of ALLOWED_AXIS_FIELDS) { ... }

// After:
// Config receives SchemaProvider
interface PropertiesExplorerConfig {
  schema: SchemaProvider;  // NEW
  alias: AliasProvider;
  container: HTMLElement;
}
// ...
const columns = this._config.schema.getAxisColumns();
for (const col of columns) { ... }  // col.name, col.latchFamily, col.isNumeric
```

### Pattern 2: LatchFamily Mapping Bridge

Two incompatible LatchFamily types exist:
- `protocol.ts`: `'Location' | 'Alphabet' | 'Time' | 'Category' | 'Hierarchy'` (SchemaProvider uses this)
- `latch.ts`: `'L' | 'A' | 'T' | 'C' | 'H'` (UI explorers use this)

**What:** Add a mapping function in latch.ts to convert between the two.
**When to use:** Anywhere SchemaProvider data flows into UI code that uses single-letter families.
**Example:**
```typescript
// In latch.ts:
import type { LatchFamily as SchemaLatchFamily } from '../worker/protocol';

const FAMILY_TO_LETTER: Record<SchemaLatchFamily, LatchFamily> = {
  Location: 'L',
  Alphabet: 'A',
  Time: 'T',
  Category: 'C',
  Hierarchy: 'H',
};

const LETTER_TO_FAMILY: Record<LatchFamily, SchemaLatchFamily> = {
  L: 'Location',
  A: 'Alphabet',
  T: 'Time',
  C: 'Category',
  H: 'Hierarchy',
};

export function toLetter(family: SchemaLatchFamily): LatchFamily {
  return FAMILY_TO_LETTER[family];
}

export function toFullName(letter: LatchFamily): SchemaLatchFamily {
  return LETTER_TO_FAMILY[letter];
}
```

### Pattern 3: AxisField/FilterField Type Widening

**What:** Use branded string pattern to accept dynamic fields while preserving literal union autocomplete.
**When to use:** Flow-through boundaries (AxisMapping.field, Filter.field) where persisted state may contain dynamic column names.
**Example:**
```typescript
// In types.ts:
// Known fields retain autocomplete
type KnownAxisField =
  | 'created_at' | 'modified_at' | 'due_at'
  | 'folder' | 'status' | 'card_type'
  | 'priority' | 'sort_order' | 'name';

// Widened type accepts any string but preserves autocomplete for known fields
type AxisField = KnownAxisField | (string & {});

// Similarly for FilterField:
type KnownFilterField =
  | 'card_type' | 'name' | 'folder' | 'status' | 'source'
  | 'created_at' | 'modified_at' | 'due_at' | 'completed_at'
  | 'event_start' | 'event_end'
  | 'latitude' | 'longitude' | 'location_name'
  | 'priority' | 'sort_order';

type FilterField = KnownFilterField | (string & {});
```

The `(string & {})` trick preserves autocomplete for known literals while accepting any string at runtime. Runtime validation remains via `isValidAxisField()` / `isValidFilterField()` which now delegate to SchemaProvider.

### Pattern 4: Dynamic LATCH_FAMILIES from SchemaProvider

**What:** Replace the frozen `Record<AxisField, LatchFamily>` with a function that reads from SchemaProvider.
**When to use:** latch.ts replacement for LATCH_FAMILIES constant.
**Example:**
```typescript
// In latch.ts -- dynamic replacement for LATCH_FAMILIES constant
let _schemaProvider: SchemaProvider | null = null;

export function setLatchSchemaProvider(sp: SchemaProvider | null): void {
  _schemaProvider = sp;
}

// Returns single-letter family for a given field name
export function getLatchFamily(field: string): LatchFamily {
  if (_schemaProvider?.initialized) {
    const columns = _schemaProvider.getColumns('cards');
    const col = columns.find(c => c.name === field);
    if (col) return toLetter(col.latchFamily);
  }
  // Fallback to hardcoded mapping
  return LATCH_FAMILIES_FALLBACK[field as AxisField] ?? 'A';
}

// Rename existing constant to FALLBACK
const LATCH_FAMILIES_FALLBACK: Readonly<Record<string, LatchFamily>> = Object.freeze({
  name: 'A', created_at: 'T', modified_at: 'T', due_at: 'T',
  folder: 'C', status: 'C', card_type: 'C',
  priority: 'H', sort_order: 'H',
});
```

### Pattern 5: Worker-Side Field Lists (SuperGridQuery + calc handler)

SuperGridQuery and chart.handler run in the Worker context. They cannot access SchemaProvider (which lives on the main thread). However, the Worker already has `validColumnNames: Set<string>` populated from PRAGMA at init.

**What:** For DYNM-10, the ALLOWED_TIME_FIELDS in SuperGridQuery should check ColumnInfo metadata rather than a hardcoded set. Since SuperGridQuery receives its config from the main thread, the main thread can pass schema-derived field metadata.
**When to use:** Any field list used inside Worker-side code.
**Approach:** The Worker-side `validColumnNames` Set provides SQL safety. For semantic classification (is this a time field?), the main thread should pre-compute and pass classification data in the query config, OR the Worker can use the PRAGMA-derived schema metadata it already has.

### Anti-Patterns to Avoid
- **Do NOT remove the frozen Set fallbacks.** They are essential for boot safety (before SchemaProvider initializes) and test isolation.
- **Do NOT change SchemaProvider's LatchFamily type.** The protocol type is canonical; the UI adapter layer handles conversion.
- **Do NOT add SchemaProvider as a constructor dependency to Worker-side code.** SchemaProvider lives on the main thread only.

## Hardcoded Field List Inventory (DYNM-13 Audit Target)

Complete inventory of frozen field-list literals in source code (excluding test fixtures):

| # | File | Constant/Pattern | DYNM Req | Action |
|---|------|-----------------|----------|--------|
| 1 | `src/providers/allowlist.ts` | `ALLOWED_FILTER_FIELDS` frozen Set | DYNM-01 | Keep as fallback, add SchemaProvider delegation |
| 2 | `src/providers/allowlist.ts` | `ALLOWED_AXIS_FIELDS` frozen Set | DYNM-01 | Keep as fallback, add SchemaProvider delegation |
| 3 | `src/providers/latch.ts` | `LATCH_FAMILIES` frozen Record | DYNM-04 | Replace with dynamic getter, keep as fallback |
| 4 | `src/providers/types.ts` | `FilterField` literal union type | DYNM-03 | Widen with `(string & {})` |
| 5 | `src/providers/types.ts` | `AxisField` literal union type | DYNM-03 | Widen with `(string & {})` |
| 6 | `src/providers/SuperDensityProvider.ts` | `ALLOWED_AXIS_FIELDS` import for displayField validation | DYNM-12 | Delegate to SchemaProvider |
| 7 | `src/providers/PAFVProvider.ts` | `VIEW_DEFAULTS` hardcoded axis fields | DYNM-11 | Use SchemaProvider-aware defaults |
| 8 | `src/providers/DensityProvider.ts` | `ALLOWED_TIME_FIELDS` frozen Set | N/A (not in scope) | Keep -- DensityProvider is semantically locked to 3 time fields |
| 9 | `src/ui/PropertiesExplorer.ts` | `ALLOWED_AXIS_FIELDS` import | DYNM-05 | Replace with SchemaProvider.getAxisColumns() |
| 10 | `src/ui/ProjectionExplorer.ts` | `ALLOWED_AXIS_FIELDS` import | DYNM-06 | Replace with SchemaProvider.getAxisColumns() |
| 11 | `src/ui/CalcExplorer.ts` | `NUMERIC_FIELDS` frozen Set | DYNM-07 | Replace with SchemaProvider.getNumericColumns() |
| 12 | `src/ui/CalcExplorer.ts` | `FIELD_DISPLAY_NAMES` object | DYNM-08 | Replace with AliasProvider.getAlias() |
| 13 | `src/ui/LatchExplorers.ts` | `CATEGORY_FIELDS`, `HIERARCHY_FIELDS`, `TIME_FIELDS` arrays | DYNM-09 | Replace with SchemaProvider.getFieldsByFamily() |
| 14 | `src/views/supergrid/SuperGridQuery.ts` | `ALLOWED_TIME_FIELDS` Set | DYNM-10 | Derive from SchemaProvider |
| 15 | `src/views/supergrid/SuperGridQuery.ts` | `NUMERIC_FIELDS` Set (line 235) | DYNM-07 | Derive from SchemaProvider metadata passed in config |
| 16 | `src/views/SuperGrid.ts` | `ALLOWED_COL_TIME_FIELDS` Set | DYNM-10 | Derive from SchemaProvider |
| 17 | `src/views/SuperGrid.ts` | `NUMERIC_FIELDS` Set (line 126) | DYNM-07 | Derive from SchemaProvider |
| 18 | `src/ui/charts/ChartRenderer.ts` | `ALLOWED_AXIS_FIELDS` import | DYNM-06 | Replace with SchemaProvider |

**Total: 18 hardcoded locations across 10 files** (requirements say 15; actual count is 18).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column validation | Custom validation logic | SchemaProvider.isValidColumn() | Already built, PRAGMA-derived, SCHM-07 safe |
| Numeric field detection | Hardcoded field names | ColumnInfo.isNumeric | SQLite type affinity is authoritative |
| LATCH classification | Hardcoded field-to-family map | SchemaProvider.getFieldsByFamily() | Heuristic already in classifyColumns() |
| Display name resolution | FIELD_DISPLAY_NAMES object | AliasProvider.getAlias() | Already used everywhere else |

## Common Pitfalls

### Pitfall 1: LatchFamily Type Mismatch
**What goes wrong:** SchemaProvider returns `'Time'` but PropertiesExplorer expects `'T'`.
**Why it happens:** Two independent LatchFamily type definitions from different phases.
**How to avoid:** Create explicit mapping functions in latch.ts (toLetter/toFullName). Use these at every SchemaProvider-to-UI boundary.
**Warning signs:** TypeScript compile errors comparing incompatible string literal types.

### Pitfall 2: Boot Race Condition
**What goes wrong:** Explorer mounts before SchemaProvider is initialized, gets empty column list.
**Why it happens:** SchemaProvider.initialize() is async (onSchema callback from Worker ready message).
**How to avoid:** SchemaProvider initializes BEFORE isReady resolves (Phase 70 design). After `await bridge.isReady`, schema is guaranteed populated. Explorers mount after this point. Fallback to frozen sets handles the unlikely case.
**Warning signs:** Empty field lists in UI on first render.

### Pitfall 3: Test Isolation
**What goes wrong:** Tests that don't initialize SchemaProvider get empty field lists or different validation behavior.
**Why it happens:** SchemaProvider is module-level singleton in allowlist.ts.
**How to avoid:** Keep frozen Set fallbacks. Tests can either (a) use default behavior (frozen sets) by not calling setSchemaProvider(), or (b) create a test SchemaProvider with mock data. The `setSchemaProvider(null)` cleanup pattern already exists from Phase 70.
**Warning signs:** Test failures after refactoring that weren't present before.

### Pitfall 4: AxisField Type Widening Cascading Errors
**What goes wrong:** Changing AxisField from a closed union to an open one causes hundreds of TypeScript errors.
**Why it happens:** Code throughout the codebase pattern-matches on AxisField literal values.
**How to avoid:** Use `(string & {})` trick instead of plain `string`. This preserves autocomplete and type narrowing for known values while accepting any string. The compile-time guarantee shifts from "only these 9 values" to "these 9 values plus any string validated at runtime."
**Warning signs:** `switch` statements that exhaustively match AxisField values will need default cases.

### Pitfall 5: Worker-Side vs Main-Thread Schema Access
**What goes wrong:** Trying to import SchemaProvider in Worker code.
**Why it happens:** SuperGridQuery and chart handlers run in the Worker, which has its own separate module scope.
**How to avoid:** Worker already has `validColumnNames` Set and can derive PRAGMA metadata independently. For semantic classification (time field, numeric field), either pass metadata in the query config from the main thread, or have the Worker use its own PRAGMA-derived ColumnInfo array.
**Warning signs:** Import cycle or undefined reference errors in Worker bundle.

### Pitfall 6: LATCH_FAMILIES Backward Compatibility
**What goes wrong:** Code that does `LATCH_FAMILIES[field]` with the Record type breaks when LATCH_FAMILIES becomes a function.
**Why it happens:** Changing from property access to function call.
**How to avoid:** Export both the fallback constant (renamed `LATCH_FAMILIES_FALLBACK`) and a new `getLatchFamily(field)` function. Migrate callers incrementally.
**Warning signs:** Runtime "undefined is not a function" or "cannot read property of undefined."

## Code Examples

### Dynamic PropertiesExplorer Column Iteration
```typescript
// Before (hardcoded):
for (const f of ALLOWED_AXIS_FIELDS) {
  if (LATCH_FAMILIES[f] === family) {
    fields.push(f);
  }
}

// After (dynamic):
const allColumns = this._config.schema.getAxisColumns();
for (const col of allColumns) {
  if (toLetter(col.latchFamily) === family) {
    fields.push(col.name as AxisField);
  }
}
```

### Dynamic CalcExplorer Numeric Detection
```typescript
// Before (hardcoded):
const NUMERIC_FIELDS: ReadonlySet<string> = new Set(['priority', 'sort_order']);
const isNumeric = NUMERIC_FIELDS.has(field);

// After (dynamic):
const numericColumns = this._config.schema.getNumericColumns();
const numericSet = new Set(numericColumns.map(c => c.name));
const isNumeric = numericSet.has(field);
```

### Dynamic LatchExplorers Field Lists
```typescript
// Before (hardcoded):
const CATEGORY_FIELDS: AxisField[] = ['folder', 'status', 'card_type'];

// After (dynamic):
const categoryColumns = this._config.schema.getFieldsByFamily('Category');
const categoryFields = categoryColumns.map(c => c.name as AxisField);
```

### SuperDensityProvider Dynamic Validation
```typescript
// Before:
if (!(ALLOWED_AXIS_FIELDS as Set<string>).has(field)) {
  throw new Error(`invalid field "${field}"`);
}

// After:
if (!this._schemaProvider?.isValidColumn(field, 'cards')) {
  // Fallback to frozen set during bootstrap
  if (!(ALLOWED_AXIS_FIELDS as Set<string>).has(field)) {
    throw new Error(`invalid field "${field}"`);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Frozen literal unions | Dynamic `(string & {})` widened types | Phase 71 | Accepts custom columns while preserving autocomplete |
| Hardcoded LATCH mapping | SchemaProvider-derived classification | Phase 71 | New columns auto-classify on import |
| FIELD_DISPLAY_NAMES object | AliasProvider.getAlias() | Phase 71 | Consistent display names across all UI |

## Open Questions

1. **DensityProvider ALLOWED_TIME_FIELDS**
   - What we know: DensityProvider has its own `ALLOWED_TIME_FIELDS` set locked to 3 fields
   - What's unclear: Should this be dynamic too? Requirements don't mention DensityProvider explicitly
   - Recommendation: Keep DensityProvider frozen -- it's semantically correct that only _at columns are time fields. SchemaProvider's getFieldsByFamily('Time') can serve as dynamic equivalent elsewhere.

2. **SuperGrid.ts Worker-Side NUMERIC_FIELDS and ALLOWED_COL_TIME_FIELDS**
   - What we know: SuperGrid.ts is main-thread code that has its own hardcoded sets matching CalcExplorer and SuperGridQuery
   - What's unclear: Whether SuperGrid should receive SchemaProvider as a dependency or derive from existing provider chain
   - Recommendation: SuperGrid already receives PAFVProvider and SuperDensityProvider in its config. Add SchemaProvider to its config object. The Worker-side SuperGridQuery.ts should receive classification metadata in its query config payload.

3. **ChartRenderer ALLOWED_AXIS_FIELDS usage**
   - What we know: ChartRenderer uses ALLOWED_AXIS_FIELDS for reverse alias lookup (_resolveField)
   - What's unclear: Whether to inject SchemaProvider or iterate SchemaProvider.getAxisColumns()
   - Recommendation: Inject SchemaProvider via ChartRenderer config. Replace ALLOWED_AXIS_FIELDS iteration with SchemaProvider.getAxisColumns().

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of all 10 affected files
- Phase 70 SchemaProvider implementation (already committed)
- Protocol types in `src/worker/protocol.ts`

### Secondary (MEDIUM confidence)
- TypeScript `(string & {})` widening trick -- well-known pattern, verified in TypeScript 5.x handbook

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all pieces exist
- Architecture: HIGH - patterns follow existing codebase conventions
- Pitfalls: HIGH - all identified from direct code analysis of dual LatchFamily types and import chains

**Research date:** 2026-03-11
**Valid until:** Indefinite (internal refactoring, no external dependencies)
