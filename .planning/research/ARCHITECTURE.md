# Architecture Patterns: v5.3 Dynamic Schema Integration

**Domain:** Runtime schema introspection, dynamic field allowlists, user-configurable LATCH mappings for Isometry v5 web runtime
**Researched:** 2026-03-10
**Confidence:** HIGH -- all integration points identified by reading existing source code; architecture follows established Provider + allowlist + Worker patterns

---

## Executive Summary

v5.3 replaces the hardcoded schema model (fixed `AxisField` and `FilterField` unions, frozen `ALLOWED_*` sets, hardcoded LATCH family maps) with a runtime-introspected schema driven by `PRAGMA table_info(cards)`. The transformation is surgical: a new `SchemaProvider` singleton reads the database schema at Worker init, broadcasts it to the main thread, and feeds into the existing allowlist validation, LATCH classification, and UI rendering pipelines. Every existing provider, explorer, and query builder consumes schema information through the same interfaces -- only the **source** of that information changes from compile-time constants to a runtime singleton.

The critical architectural insight is that this project has **one source of schema truth (the SQLite database) but 15 hardcoded reflections of it scattered across 8 files**. SchemaProvider consolidates all 15 into a single runtime-queried source, while preserving the SQL safety invariant (D-003) that no unvalidated field name enters a SQL string.

No new Worker message types are strictly required -- the schema can ride the existing `ready` message or a new `schema:info` notification. No schema migration is needed. No new external dependencies are needed.

---

## Recommended Architecture

### System-Level Data Flow (Before vs After)

**Before (hardcoded):**
```
compile-time constants (types.ts, allowlist.ts, latch.ts)
    |
    v
Providers validate against frozen sets
    |
    v
QueryBuilder assembles SQL from provider outputs
    |
    v
Worker executes SQL against cards table
```

**After (dynamic):**
```
Worker init --> PRAGMA table_info(cards) --> SchemaProvider (Worker-side)
    |
    v (schema:info notification via postMessage)
SchemaProvider (main thread) -- singleton, lazy init
    |
    v
Providers validate against SchemaProvider.getAllowedAxisFields() / getAllowedFilterFields()
    |
    v
LatchExplorers / PropertiesExplorer read field lists from SchemaProvider
    |
    v
QueryBuilder assembles SQL from provider outputs (unchanged)
    |
    v
Worker executes SQL against cards table (unchanged)
```

### Component Boundaries

| Component | Responsibility | Communicates With | Change Type |
|-----------|---------------|-------------------|-------------|
| **SchemaProvider** (NEW) | Runtime schema introspection, field classification, LATCH mapping | Worker (reads PRAGMA), all providers (validation), all explorers (field lists) | NEW singleton |
| **Worker init** | Reads PRAGMA table_info at startup, posts schema to main thread | SchemaProvider | MODIFY (add PRAGMA read + notification) |
| **allowlist.ts** | SQL safety validation functions | SchemaProvider (gets field sets from it) | MODIFY (dynamic sets from SchemaProvider instead of frozen literals) |
| **types.ts** | TypeScript type unions for AxisField, FilterField | None at runtime (types become `string` with runtime validation) | MODIFY (widen types or keep as documentation) |
| **latch.ts** | LATCH family classification map | SchemaProvider (reads classification from it) | MODIFY (dynamic map from SchemaProvider) |
| **FilterProvider** | Filter state + SQL compilation | SchemaProvider (via allowlist validation) | MINIMAL (validation functions unchanged, just backed by dynamic set) |
| **PAFVProvider** | Axis mapping + SQL compilation | SchemaProvider (via allowlist validation) | MINIMAL (same pattern) |
| **PropertiesExplorer** | LATCH-grouped property catalog | SchemaProvider (reads field lists + LATCH families) | MODIFY (dynamic field iteration instead of ALLOWED_AXIS_FIELDS) |
| **LatchExplorers** | LATCH filter sections | SchemaProvider (reads field-to-family mapping for chip/histogram population) | MODIFY (dynamic field lists per family instead of hardcoded arrays) |
| **CalcExplorer** | Aggregate function config | SchemaProvider (reads numeric/text classification) | MODIFY (NUMERIC_FIELDS set from SchemaProvider) |
| **ProjectionExplorer** | 4-well axis assignment | SchemaProvider (reads available fields) | MODIFY (available chips from SchemaProvider) |
| **AliasProvider** | Display name aliases | SchemaProvider (validates field names) | MINIMAL (isValidAxisField now delegates to SchemaProvider) |
| **chart.handler.ts** | Chart query builder | SchemaProvider (via validateAxisField) | NONE (validation function unchanged at call site) |
| **histogram.handler.ts** | Histogram query builder | SchemaProvider (via validateFilterField) | NONE (validation function unchanged at call site) |
| **SuperGridQuery.ts** | Multi-axis GROUP BY builder | SchemaProvider (via validateAxisField) | NONE (validation function unchanged at call site) |

### New Component: SchemaProvider

```typescript
// src/providers/SchemaProvider.ts

/** Column metadata from PRAGMA table_info */
interface ColumnInfo {
  name: string;
  type: string;        // TEXT, INTEGER, REAL, etc.
  notnull: boolean;
  defaultValue: string | null;
  pk: boolean;
}

/** Field classification for LATCH, axis/filter eligibility */
interface FieldDescriptor {
  name: string;
  sqlType: string;
  latchFamily: LatchFamily | null;   // null = not LATCH-classifiable (e.g., id, content)
  isAxisEligible: boolean;           // Can appear in ORDER BY / GROUP BY
  isFilterEligible: boolean;         // Can appear in WHERE
  isNumeric: boolean;                // Supports SUM/AVG/MIN/MAX
  displayName: string;               // Default human-readable name
}

class SchemaProvider {
  private _fields: Map<string, FieldDescriptor> = new Map();
  private _subscribers: Set<() => void> = new Set();
  private _initialized = false;

  /** Called once when Worker posts schema info after PRAGMA read */
  setSchema(columns: ColumnInfo[]): void;

  /** All fields eligible for ORDER BY / GROUP BY */
  getAxisFields(): ReadonlySet<string>;

  /** All fields eligible for WHERE clauses */
  getFilterFields(): ReadonlySet<string>;

  /** LATCH family for a field (null if unclassified) */
  getLatchFamily(field: string): LatchFamily | null;

  /** All fields grouped by LATCH family */
  getFieldsByFamily(): Map<LatchFamily, string[]>;

  /** Whether a field supports numeric aggregation */
  isNumericField(field: string): boolean;

  /** Field descriptor for a specific field */
  getField(field: string): FieldDescriptor | undefined;

  /** All field descriptors */
  getAllFields(): FieldDescriptor[];

  /** Display name for a field (pre-alias) */
  getDisplayName(field: string): string;

  /** Validation: is this a valid axis field? */
  isValidAxisField(field: string): boolean;

  /** Validation: is this a valid filter field? */
  isValidFilterField(field: string): boolean;

  subscribe(callback: () => void): () => void;
}
```

### Data Flow: Worker Init to UI Rendering

```
1. Worker receives 'init' or 'wasm-init'
2. Database.initialize() runs schema.sql
3. NEW: Worker runs PRAGMA table_info(cards)
4. NEW: Worker posts WorkerNotification { type: 'schema:info', columns: [...] }
5. Main thread WorkerBridge receives notification
6. Main thread calls SchemaProvider.setSchema(columns)
7. SchemaProvider classifies columns (LATCH family, axis/filter eligibility, numeric)
8. SchemaProvider notifies subscribers
9. PropertiesExplorer, LatchExplorers, ProjectionExplorer re-render with dynamic fields
10. allowlist.ts validation functions delegate to SchemaProvider.isValid*()
```

---

## Hardcoded Pattern Inventory (15 Patterns in 8 Files)

These are the exact locations that must change to dynamic reads from SchemaProvider:

### 1. `src/providers/types.ts` -- Type unions

| Pattern | Lines | Current | Change |
|---------|-------|---------|--------|
| `FilterField` union | 17-33 | 16 literal string members | Widen to `string` with runtime validation, OR keep as documentation-only |
| `AxisField` union | 61-70 | 9 literal string members | Same approach |

**Recommendation:** Keep the union types as documentation and default set, but make runtime validation delegate to SchemaProvider. This preserves compile-time safety for code that uses known fields while allowing dynamic fields from runtime introspection.

### 2. `src/providers/allowlist.ts` -- Frozen validation sets

| Pattern | Lines | Current | Change |
|---------|-------|---------|--------|
| `ALLOWED_FILTER_FIELDS` | 22-41 | Frozen Set of 16 fields | Delegate to SchemaProvider.getFilterFields() |
| `ALLOWED_AXIS_FIELDS` | 67-79 | Frozen Set of 9 fields | Delegate to SchemaProvider.getAxisFields() |
| `ALLOWED_OPERATORS` | 47-61 | Frozen Set of 11 operators | UNCHANGED (operators are not schema-dependent) |
| `isValidFilterField()` | 93-95 | Checks frozen set | Delegate to SchemaProvider |
| `isValidAxisField()` | 117-119 | Checks frozen set | Delegate to SchemaProvider |
| `validateFilterField()` | 131-138 | Throws on invalid | Delegate validation, same throw pattern |
| `validateAxisField()` | 161-168 | Throws on invalid | Delegate validation, same throw pattern |

**Critical invariant:** The validation functions MUST continue to throw `"SQL safety violation:"` errors. The error message pattern is load-bearing -- `classifyError()` in worker.ts matches on it to return `INVALID_REQUEST` error codes.

### 3. `src/providers/latch.ts` -- LATCH family classification

| Pattern | Lines | Current | Change |
|---------|-------|---------|--------|
| `LATCH_FAMILIES` map | 36-46 | Frozen Record mapping 9 AxisFields to families | Delegate to SchemaProvider.getFieldsByFamily() |

**Note:** `LATCH_ORDER`, `LATCH_LABELS`, and `LATCH_COLORS` remain static -- they describe the LATCH framework itself (5 families), not the fields within each family.

### 4. `src/ui/PropertiesExplorer.ts` -- Hardcoded field iteration

| Pattern | Lines | Current | Change |
|---------|-------|---------|--------|
| `ALLOWED_AXIS_FIELDS` import | 17 | Imports frozen set for iteration | Import from SchemaProvider |
| `LATCH_FAMILIES[f]` lookup | 177 | Iterates ALLOWED_AXIS_FIELDS, looks up family | Iterate SchemaProvider.getFieldsByFamily() |
| `new Set(ALLOWED_AXIS_FIELDS)` default | 79 | All 9 fields start enabled | All axis-eligible fields from SchemaProvider start enabled |

### 5. `src/ui/LatchExplorers.ts` -- Hardcoded field-to-family arrays

| Pattern | Lines | Current | Change |
|---------|-------|---------|--------|
| `CATEGORY_FIELDS` | 50 | `['folder', 'status', 'card_type']` | SchemaProvider.getFieldsByFamily().get('C') |
| `HIERARCHY_FIELDS` | 51 | `['priority', 'sort_order']` | SchemaProvider.getFieldsByFamily().get('H') |
| `TIME_FIELDS` | 52 | `['created_at', 'modified_at', 'due_at']` | SchemaProvider.getFieldsByFamily().get('T') |

### 6. `src/ui/CalcExplorer.ts` -- Hardcoded numeric classification

| Pattern | Lines | Current | Change |
|---------|-------|---------|--------|
| `NUMERIC_FIELDS` set | 41 | `new Set(['priority', 'sort_order'])` | SchemaProvider.isNumericField() |
| `FIELD_DISPLAY_NAMES` | 60-70 | Hardcoded 9-entry Record | SchemaProvider.getDisplayName() |

### 7. `src/views/supergrid/SuperGridQuery.ts` -- Hardcoded numeric set

| Pattern | Lines | Current | Change |
|---------|-------|---------|--------|
| `NUMERIC_FIELDS` set | 235 | `new Set(['priority', 'sort_order'])` | Import from SchemaProvider (or shared constant derived from it) |
| `ALLOWED_TIME_FIELDS` | 25 | `new Set(['created_at', 'modified_at', 'due_at'])` | SchemaProvider.getFieldsByFamily().get('T') |

### 8. `src/ui/ProjectionExplorer.ts` -- Available fields source

| Pattern | Lines | Current | Change |
|---------|-------|---------|--------|
| `ALLOWED_AXIS_FIELDS` import | 17 | Imports frozen set for available chip pool | Import from SchemaProvider.getAxisFields() |

---

## LATCH Classification Strategy

The LATCH family assignment for each field must be deterministic and extensible. The classification algorithm in SchemaProvider:

```
For each column from PRAGMA table_info(cards):
  1. Skip system columns: id, deleted_at, content, summary, url, mime_type,
     is_collective, source, source_id, source_url, tags
  2. Classify by SQL type and column name:
     - name contains 'lat' or 'lng' or 'longitude' or 'location' --> L (Location)
     - name is 'name' --> A (Alphabet)
     - SQL type is TEXT and name contains '_at' or '_start' or '_end' --> T (Time)
     - SQL type is TEXT and not Time --> C (Category)
     - SQL type is INTEGER or REAL (and not Location) --> H (Hierarchy)
  3. User overrides (from ui_state 'schema:latch-overrides') take precedence
```

**Default classifications matching current hardcoded behavior:**

| Field | SQL Type | Default LATCH | Axis? | Filter? | Numeric? |
|-------|----------|---------------|-------|---------|----------|
| name | TEXT | A | Yes | Yes | No |
| latitude | REAL | L | No | Yes | No |
| longitude | REAL | L | No | Yes | No |
| location_name | TEXT | L | No | Yes | No |
| created_at | TEXT | T | Yes | Yes | No |
| modified_at | TEXT | T | Yes | Yes | No |
| due_at | TEXT | T | Yes | Yes | No |
| completed_at | TEXT | T | No | Yes | No |
| event_start | TEXT | T | No | Yes | No |
| event_end | TEXT | T | No | Yes | No |
| folder | TEXT | C | Yes | Yes | No |
| status | TEXT | C | Yes | Yes | No |
| card_type | TEXT | C | Yes | Yes | No |
| priority | INTEGER | H | Yes | Yes | Yes |
| sort_order | INTEGER | H | Yes | Yes | Yes |

**Key design decision:** The default axis eligibility matches the current 9-field `ALLOWED_AXIS_FIELDS`. New fields added to the schema are **axis-eligible by default** if they match the classification heuristic, but users can toggle them off via PropertiesExplorer. The user's enabled/disabled state is persisted in ui_state under `schema:axis-enabled` key.

---

## User-Configurable Preferences (ui_state Persistence)

Three new ui_state keys for user schema preferences:

| Key | Value Shape | Purpose |
|-----|-------------|---------|
| `schema:latch-overrides` | `Record<string, LatchFamily>` | User reassignment of field LATCH families |
| `schema:axis-enabled` | `string[]` | Which fields appear in axis wells / SuperGrid headers |
| `schema:display-prefs` | `Record<string, { sortField?: string, sortDir?: string }>` | Per-view default sort field and direction |

These persist via the existing `bridge.send('ui:set', ...)` path and restore via `bridge.send('ui:get', ...)` during SchemaProvider initialization.

---

## Patterns to Follow

### Pattern 1: Provider Singleton with Lazy Init

**What:** SchemaProvider is a singleton that initializes when the Worker posts schema info. All consumers subscribe and re-render when schema arrives.

**When:** Always -- SchemaProvider must be available before any provider validation runs.

**Example:**
```typescript
// In index.ts (app bootstrap)
const schemaProvider = new SchemaProvider();

// WorkerBridge notification handler
bridge.onNotification('schema:info', (columns) => {
  schemaProvider.setSchema(columns);
});

// PropertiesExplorer subscribes
const unsub = schemaProvider.subscribe(() => {
  propertiesExplorer.update();
});
```

### Pattern 2: Backward-Compatible Validation Delegation

**What:** allowlist.ts validation functions delegate to SchemaProvider but fall back to hardcoded defaults if SchemaProvider is not yet initialized. This prevents the bootstrap race condition.

**When:** During the transition period before schema:info arrives.

**Example:**
```typescript
// allowlist.ts -- modified
import { schemaProvider } from './SchemaProvider';

export function isValidAxisField(field: string): boolean {
  if (schemaProvider.isInitialized()) {
    return schemaProvider.isValidAxisField(field);
  }
  // Fall back to hardcoded defaults during bootstrap
  return DEFAULT_AXIS_FIELDS.has(field);
}
```

### Pattern 3: WorkerNotification for Schema Broadcast

**What:** Schema info rides the existing WorkerNotification protocol (fire-and-forget, no correlation ID) -- same pattern as import progress notifications.

**When:** Immediately after Worker database initialization, before processing queued messages.

**Example:**
```typescript
// worker.ts -- in initialize()
async function initialize(wasmBinary?, dbData?) {
  db = new Database();
  await db.initialize(wasmBinary, dbData);

  // NEW: Read schema and broadcast
  const columns = db.exec("PRAGMA table_info(cards)");
  const schemaNotification: WorkerNotification = {
    type: 'schema:info',
    data: parseColumns(columns),
  };
  self.postMessage(schemaNotification);

  isInitialized = true;
  // ... rest of init
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Duplicated Schema Knowledge

**What:** Adding SchemaProvider while keeping the old hardcoded sets as active validation sources.
**Why bad:** Two sources of truth for the same information. Divergence causes fields to work in some contexts but not others.
**Instead:** All validation delegates to SchemaProvider. Hardcoded defaults only serve as bootstrap fallback before schema:info arrives.

### Anti-Pattern 2: Worker-Side SchemaProvider

**What:** Making the Worker query SchemaProvider for validation in handlers.
**Why bad:** Worker handlers already call `validateAxisField()` / `validateFilterField()` -- those functions just need to be backed by dynamic sets. No new Worker-side singleton needed.
**Instead:** Worker-side validation uses a module-level `Set` that is populated from PRAGMA at init time. Main-thread SchemaProvider is a separate instance populated from the notification.

### Anti-Pattern 3: Breaking the Type System

**What:** Changing `AxisField` to `string` everywhere, losing compile-time safety.
**Why bad:** 90% of code uses known canonical fields. Widening destroys IDE autocomplete and catch-at-compile benefits.
**Instead:** Keep `AxisField` union for known fields. Add `string` overloads only where dynamic fields enter (SchemaProvider API, allowlist validation). Use `as AxisField` casts at the boundary where dynamic fields are validated.

### Anti-Pattern 4: Fetching Schema on Every Render

**What:** Querying PRAGMA table_info each time a UI component needs field lists.
**Why bad:** PRAGMA is synchronous in sql.js but adds unnecessary Worker round-trips. Schema does not change during a session (no ALTER TABLE).
**Instead:** Query once at init, cache in SchemaProvider, invalidate only on database re-init (which only happens on app restart or full sync reset).

---

## Suggested Build Order

The build order is driven by the dependency chain: SchemaProvider must exist before anything can consume it, and consumers deeper in the stack (UI components) depend on consumers higher up (providers).

### Phase 1: SchemaProvider Core + Worker Integration

**What builds:**
- `SchemaProvider` class with `setSchema()`, field classification, LATCH assignment
- Worker init modification to read PRAGMA and post `schema:info` notification
- WorkerBridge notification handler to route schema:info to SchemaProvider
- Tests for SchemaProvider classification logic

**Dependencies:** None (foundation layer)
**Unlocks:** Everything else

### Phase 2: Allowlist Delegation + Provider Integration

**What builds:**
- Modify `allowlist.ts` to delegate `isValid*()` / `validate*()` to SchemaProvider
- Worker-side allowlist set populated from PRAGMA at init (parallel to main-thread SchemaProvider)
- Modify `latch.ts` LATCH_FAMILIES to read from SchemaProvider
- Update `FilterProvider`, `PAFVProvider` setState() to accept dynamically-validated fields
- Tests for backward compatibility (existing tests must still pass)

**Dependencies:** Phase 1
**Unlocks:** UI components can read dynamic fields

### Phase 3: Explorer Panel Updates

**What builds:**
- PropertiesExplorer: dynamic field iteration from SchemaProvider
- LatchExplorers: dynamic CATEGORY_FIELDS, HIERARCHY_FIELDS, TIME_FIELDS from SchemaProvider
- ProjectionExplorer: available chip pool from SchemaProvider
- CalcExplorer: NUMERIC_FIELDS and FIELD_DISPLAY_NAMES from SchemaProvider
- Tests for dynamic rendering

**Dependencies:** Phase 2
**Unlocks:** UI reflects actual schema

### Phase 4: User Preferences + Persistence

**What builds:**
- LATCH family override persistence (`schema:latch-overrides` in ui_state)
- Axis-enabled set persistence (`schema:axis-enabled` in ui_state)
- Display preference persistence (`schema:display-prefs` in ui_state)
- PropertiesExplorer toggle state linked to SchemaProvider axis-enabled set
- LatchExplorers drag-to-reassign family (if scoped)

**Dependencies:** Phase 3
**Unlocks:** User customization persists across sessions

### Phase 5: Bug Fixes + Polish

**What builds:**
- SVG letter-spacing fix
- deleted_at optional handling fixes
- Any regression fixes from dynamic schema transition
- Integration tests for full pipeline (import -> schema detect -> UI render)

**Dependencies:** Phase 4 (or can run in parallel for bug fixes)
**Unlocks:** Milestone completion

---

## Integration Point Details

### WorkerBridge Notification Extension

The existing WorkerBridge already handles notifications via `onmessage` routing. A new notification type `schema:info` is added to the `WorkerNotification` union in `protocol.ts`:

```typescript
// protocol.ts addition
interface SchemaInfoNotification {
  type: 'schema:info';
  data: {
    columns: Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;
  };
}
```

WorkerBridge's existing notification handler (which routes `import-progress`, `import-finalizing`, etc.) gains one more case.

### StateManager Integration

SchemaProvider does NOT implement `PersistableProvider` and is NOT managed by StateManager. Rationale:
- Schema comes from the database itself (PRAGMA), not from user state
- User **preferences** about the schema (LATCH overrides, enabled fields) are separate keys in ui_state, managed by SchemaProvider directly via bridge.send

### StateCoordinator Integration

SchemaProvider should NOT be registered with StateCoordinator. Schema changes don't trigger view re-queries (schema is static within a session). User preference changes (LATCH override, axis enable/disable) should notify via SchemaProvider's own subscriber system, which downstream components (PropertiesExplorer, LatchExplorers) already subscribe to.

### SuperGrid Impact

SuperGrid itself (`src/views/SuperGrid.ts`) is **not directly modified**. It reads axes from PAFVProvider, which validates against the allowlist, which now delegates to SchemaProvider. The pipeline is transparent. The only SuperGrid-adjacent changes are in `SuperGridQuery.ts` (NUMERIC_FIELDS, ALLOWED_TIME_FIELDS) and `CalcExplorer.ts` (NUMERIC_FIELDS, FIELD_DISPLAY_NAMES).

---

## Scalability Considerations

| Concern | Current (9 axis fields) | After v5.3 (N fields) | At 50+ columns |
|---------|------------------------|----------------------|-----------------|
| Validation speed | O(1) Set.has() on 9-element set | O(1) Set.has() on N-element set | Identical -- Set.has() is O(1) |
| PropertiesExplorer render | 9 D3 join items across 5 columns | N items across 5 columns | D3 join handles efficiently |
| LatchExplorers chip fetch | 5 fields x 1 SQL each | N fields x 1 SQL each | May need batching if N > 20 |
| PRAGMA query cost | N/A | Once at init (~1ms) | Once at init (~1ms) |
| ui_state payload size | ~500 bytes | ~500 + (N * 50) bytes | ~3KB -- negligible |

---

## Sources

- All findings from direct source code reading of the Isometry v5 codebase:
  - `src/providers/allowlist.ts` -- validation functions and frozen sets
  - `src/providers/types.ts` -- type unions
  - `src/providers/latch.ts` -- LATCH family classification
  - `src/providers/FilterProvider.ts` -- filter compilation with allowlist validation
  - `src/providers/PAFVProvider.ts` -- axis mapping with allowlist validation
  - `src/providers/QueryBuilder.ts` -- SQL assembly from provider outputs
  - `src/ui/PropertiesExplorer.ts` -- hardcoded ALLOWED_AXIS_FIELDS iteration
  - `src/ui/LatchExplorers.ts` -- hardcoded CATEGORY/HIERARCHY/TIME_FIELDS arrays
  - `src/ui/CalcExplorer.ts` -- hardcoded NUMERIC_FIELDS and FIELD_DISPLAY_NAMES
  - `src/ui/ProjectionExplorer.ts` -- ALLOWED_AXIS_FIELDS for available chip pool
  - `src/views/supergrid/SuperGridQuery.ts` -- NUMERIC_FIELDS and ALLOWED_TIME_FIELDS
  - `src/worker/worker.ts` -- Worker init and message routing
  - `src/worker/handlers/supergrid.handler.ts` -- validateAxisField usage
  - `src/worker/handlers/chart.handler.ts` -- validateAxisField usage
  - `src/worker/handlers/histogram.handler.ts` -- validateFilterField usage
  - `src/database/schema.sql` -- canonical cards table with 25 columns
- SQLite PRAGMA table_info documentation: returns cid, name, type, notnull, dflt_value, pk per column (HIGH confidence -- stable SQLite API)
