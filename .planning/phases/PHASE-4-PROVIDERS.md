# Phase 4: Providers + MutationManager

**Status:** Not started  
**Depends on:** Phase 3 (Worker Bridge) — COMPLETE 2026-02-28  
**Blocks:** Phase 5 (Core D3 Views + Transitions)

---

## Goal

UI state compiles to safe parameterized SQL through an allowlisted Provider system. Every mutation is undoable. All Tier 1/2 state persists across launch.

---

## Requirements Addressed

### SQL Safety (SAFE-01..06)

| Requirement | Description |
|-------------|-------------|
| SAFE-01 | FilterProvider validates fields against ALLOWED_FILTER_FIELDS allowlist |
| SAFE-02 | FilterProvider validates operators against ALLOWED_OPERATORS set |
| SAFE-03 | All dynamic query values use parameterized placeholders (?) |
| SAFE-04 | Unknown fields rejected — TypeScript union + runtime validation |
| SAFE-05 | Unknown operators rejected — TypeScript union + runtime validation |
| SAFE-06 | SQL injection test suite passes |

### Providers (PROV-01..07)

| Requirement | Description |
|-------------|-------------|
| PROV-01 | FilterProvider compiles filters to parameterized SQL WHERE clauses |
| PROV-02 | AxisProvider compiles axis mappings to SQL ORDER BY/GROUP BY |
| PROV-03 | SelectionProvider holds selected card IDs in-memory only (Tier 3) |
| PROV-04 | DensityProvider controls row/column density settings (Tier 2) |
| PROV-05 | ViewProvider tracks current view type (Tier 2) |
| PROV-06 | Tier 2 state persists to ui_state table and restores on launch |
| PROV-07 | Tier 3 state is never persisted to any storage |

### MutationManager (WKBR-05..07)

| Requirement | Description |
|-------------|-------------|
| WKBR-05 | MutationManager generates inverse SQL for every mutation (undo support) |
| WKBR-06 | MutationManager sets dirty flag on write and notifies subscribers |
| WKBR-07 | User can undo/redo mutations via command log (Cmd+Z / Cmd+Shift+Z) |

---

## Success Criteria

From `ROADMAP.md` — all must be TRUE before Phase 4 is complete:

1. **FilterProvider compiles filter state to `{where, params}` SQL fragments with allowlisted columns only** — SQL injection strings, unknown fields, and unknown operators are all rejected at runtime

2. **AxisProvider maps LATCH dimensions to ORDER BY / GROUP BY SQL fragments and suspends/restores view family state when switching between LATCH and GRAPH views** — no state is lost across the boundary

3. **SelectionProvider holds selected card IDs in memory only (Cmd+click toggle, Shift+click range, select-all)** and this state is never written to any storage tier

4. **DensityProvider compiles all five time granularities (day, week, month, quarter, year) to strftime() SQL expressions** — DensityProvider state changes the SQL, not only the CSS

5. **User presses Cmd+Z and the last mutation is reversed; Cmd+Shift+Z re-applies it** — undo and redo work through the full command log with correct inverse SQL ordering for batch mutations

6. **Filter, axis, density, and view state (Tier 2) survive app restart** — ui_state is written on change and restored on launch

---

## Architecture

### Three-Tier State Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           State Tiers                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Tier 1: SQLite (cards, connections)                                   │
│  ────────────────────────────────────                                   │
│  • Source of truth for all data                                        │
│  • Survives restart, export, sync                                      │
│  • Modified via MutationManager                                        │
│                                                                         │
│  Tier 2: ui_state table (filters, axes, density, view)                 │
│  ──────────────────────────────────────────────────────                 │
│  • Persists across restart                                             │
│  • Does NOT sync to CloudKit                                           │
│  • Each provider owns its keys                                         │
│                                                                         │
│  Tier 3: Memory only (selection)                                       │
│  ────────────────────────────────                                       │
│  • Lost on page refresh                                                │
│  • Never touches storage                                               │
│  • SelectionProvider only                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Provider Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Main Thread                                     │
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │FilterProvider │  │ AxisProvider  │  │DensityProvider│               │
│  │               │  │               │  │               │               │
│  │ • filters[]   │  │ • xAxis       │  │ • timeField   │               │
│  │ • compile()   │  │ • yAxis       │  │ • granularity │               │
│  │ → {where,     │  │ • compile()   │  │ • compile()   │               │
│  │    params}    │  │ → {orderBy,   │  │ → strftime()  │               │
│  │               │  │    groupBy}   │  │               │               │
│  │ Tier 2 ───────│  │ Tier 2 ───────│  │ Tier 2 ───────│               │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘               │
│          │                  │                  │                        │
│          ▼                  ▼                  ▼                        │
│  ┌──────────────────────────────────────────────────────┐              │
│  │                   QueryBuilder                        │              │
│  │   Combines provider outputs into complete SQL query   │              │
│  └──────────────────────────┬───────────────────────────┘              │
│                             │                                           │
│  ┌───────────────┐          │          ┌───────────────┐               │
│  │SelectionProv. │          │          │  ViewProvider │               │
│  │               │          │          │               │               │
│  │ • selectedIds │          │          │ • currentView │               │
│  │ • toggle()    │          │          │ • viewFamily  │               │
│  │ • range()     │          │          │ • latchState  │               │
│  │               │          │          │ • graphState  │               │
│  │ Tier 3 (mem)  │          │          │ Tier 2 ───────│               │
│  └───────────────┘          │          └───────────────┘               │
│                             │                                           │
│                             ▼                                           │
│  ┌──────────────────────────────────────────────────────┐              │
│  │                   WorkerBridge                        │              │
│  │        (sends compiled SQL to Worker)                │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### MutationManager Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MutationManager                                    │
│                                                                         │
│  User Action                                                            │
│      │                                                                  │
│      ▼                                                                  │
│  ┌─────────────────────┐                                               │
│  │  Create Mutation    │                                               │
│  │  {                  │                                               │
│  │    id: uuid,        │                                               │
│  │    forward: SQL[],  │  ◄── The operation to perform                 │
│  │    inverse: SQL[],  │  ◄── How to undo it (computed at creation)    │
│  │    description      │                                               │
│  │  }                  │                                               │
│  └──────────┬──────────┘                                               │
│             │                                                           │
│             ▼                                                           │
│  ┌─────────────────────┐      ┌─────────────────────┐                  │
│  │  Execute forward[]  │─────►│  Append to history  │                  │
│  │  via WorkerBridge   │      │  (command log)      │                  │
│  └──────────┬──────────┘      └─────────────────────┘                  │
│             │                                                           │
│             ▼                                                           │
│  ┌─────────────────────┐      ┌─────────────────────┐                  │
│  │  Set dirty = true   │─────►│  Notify subscribers │                  │
│  └─────────────────────┘      └─────────────────────┘                  │
│                                                                         │
│  Cmd+Z (Undo)                  Cmd+Shift+Z (Redo)                       │
│      │                              │                                   │
│      ▼                              ▼                                   │
│  ┌─────────────────────┐      ┌─────────────────────┐                  │
│  │  Pop from history   │      │  Pop from redoStack │                  │
│  │  Execute inverse[]  │      │  Execute forward[]  │                  │
│  │  Push to redoStack  │      │  Push to history    │                  │
│  └─────────────────────┘      └─────────────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── providers/
│   ├── types.ts                 # Shared types (Filter, Axis, etc.)
│   ├── allowlist.ts             # ALLOWED_FILTER_FIELDS, ALLOWED_OPERATORS
│   ├── FilterProvider.ts        # Filter state → SQL WHERE
│   ├── AxisProvider.ts          # Axis mapping → ORDER BY/GROUP BY
│   ├── SelectionProvider.ts     # Selected card IDs (Tier 3)
│   ├── DensityProvider.ts       # Time granularity → strftime()
│   ├── ViewProvider.ts          # Current view + family state
│   ├── QueryBuilder.ts          # Combines providers → complete SQL
│   ├── StateManager.ts          # Tier 2 persistence coordinator
│   └── index.ts                 # Public exports
├── mutations/
│   ├── types.ts                 # Mutation, MutationCommand types
│   ├── MutationManager.ts       # Command log, undo/redo
│   ├── inverses.ts              # Inverse SQL generators
│   └── index.ts                 # Public exports
├── worker/
│   ├── ... (Phase 3)
│   ├── handlers/
│   │   ├── ... (Phase 3)
│   │   └── ui-state.handler.ts  # NEW: ui_state CRUD
│   └── protocol.ts              # Add ui_state request types
└── index.ts                     # Re-export providers + mutations
```

---

## Implementation Plans

### Plan 4-01: Allowlist and Types

**Delivers:** `src/providers/types.ts`, `src/providers/allowlist.ts`

**Contract:**

```typescript
// types.ts
export type FilterField = 
  | 'card_type' | 'folder' | 'status' | 'priority' 
  | 'created_at' | 'modified_at' | 'due_at' | 'source';

export type FilterOperator = 
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' 
  | 'contains' | 'startsWith' | 'in' | 'isNull' | 'isNotNull';

export interface Filter {
  field: FilterField;
  operator: FilterOperator;
  value: unknown;  // Type depends on field/operator
}

export type AxisField = 
  | 'created_at' | 'modified_at' | 'due_at'  // Time (T)
  | 'folder' | 'status' | 'card_type'         // Category (C)
  | 'priority' | 'sort_order'                  // Hierarchy (H)
  | 'name';                                    // Alphabet (A)

export type SortDirection = 'asc' | 'desc';

export interface AxisMapping {
  field: AxisField;
  direction: SortDirection;
}

export type TimeGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type ViewType = 
  | 'list' | 'grid' | 'kanban' | 'calendar' | 'timeline' | 'gallery'  // LATCH
  | 'network' | 'tree'                                                  // GRAPH
  | 'table';                                                            // Raw

export type ViewFamily = 'latch' | 'graph';

// allowlist.ts
export const ALLOWED_FILTER_FIELDS: ReadonlySet<FilterField>;
export const ALLOWED_OPERATORS: ReadonlySet<FilterOperator>;
export const ALLOWED_AXIS_FIELDS: ReadonlySet<AxisField>;

export function isValidFilterField(field: string): field is FilterField;
export function isValidOperator(op: string): op is FilterOperator;
export function isValidAxisField(field: string): field is AxisField;
```

**Acceptance:**
- [ ] TypeScript union types enforce compile-time safety for literals
- [ ] Runtime validation functions throw on unknown values
- [ ] Allowlist sets are frozen (Object.freeze)

**Test:** `tests/providers/allowlist.test.ts`

---

### Plan 4-02: FilterProvider

**Delivers:** `src/providers/FilterProvider.ts`

**Contract:**

```typescript
interface CompiledFilter {
  where: string;      // e.g., "folder = ? AND status IN (?, ?)"
  params: unknown[];  // e.g., ["Projects", "active", "pending"]
}

class FilterProvider {
  private filters: Filter[] = [];
  
  // State management
  addFilter(filter: Filter): void;
  removeFilter(index: number): void;
  clearFilters(): void;
  getFilters(): readonly Filter[];
  
  // SQL compilation (SAFE-01..06)
  compile(): CompiledFilter;
  
  // Tier 2 persistence
  toJSON(): string;
  static fromJSON(json: string): FilterProvider;
}
```

**Compilation rules:**
- `eq` → `field = ?`
- `neq` → `field != ?`
- `gt/gte/lt/lte` → `field >/>=/</<= ?`
- `contains` → `field LIKE ?` (with `%value%` wrapping)
- `startsWith` → `field LIKE ?` (with `value%` wrapping)
- `in` → `field IN (?, ?, ...)` (expands array)
- `isNull` → `field IS NULL` (no param)
- `isNotNull` → `field IS NOT NULL` (no param)

**Rejection rules:**
- Unknown field → throw `Error('Invalid filter field: ${field}')`
- Unknown operator → throw `Error('Invalid filter operator: ${op}')`
- SQL injection in value → safe because parameterized (value never interpolated)

**Acceptance:**
- [ ] SAFE-01: Fields validated against allowlist
- [ ] SAFE-02: Operators validated against allowlist
- [ ] SAFE-03: All values parameterized
- [ ] SAFE-04: Unknown fields throw
- [ ] SAFE-05: Unknown operators throw
- [ ] SAFE-06: Injection test suite passes

**Test:** `tests/providers/FilterProvider.test.ts`

---

### Plan 4-03: AxisProvider

**Delivers:** `src/providers/AxisProvider.ts`

**Contract:**

```typescript
interface CompiledAxis {
  orderBy: string;    // e.g., "ORDER BY created_at DESC, name ASC"
  groupBy: string;    // e.g., "GROUP BY folder" (for Kanban)
}

interface AxisState {
  x: AxisMapping | null;  // Horizontal organization
  y: AxisMapping | null;  // Vertical organization (for Grid)
  group: AxisMapping | null;  // Grouping (for Kanban)
}

class AxisProvider {
  private state: AxisState;
  
  // State management
  setXAxis(mapping: AxisMapping | null): void;
  setYAxis(mapping: AxisMapping | null): void;
  setGroupAxis(mapping: AxisMapping | null): void;
  getState(): Readonly<AxisState>;
  
  // SQL compilation (PROV-02)
  compile(): CompiledAxis;
  
  // View family state suspension/restoration
  suspendState(): AxisState;
  restoreState(state: AxisState): void;
  
  // Tier 2 persistence
  toJSON(): string;
  static fromJSON(json: string): AxisProvider;
}
```

**Acceptance:**
- [ ] PROV-02: Compiles to valid ORDER BY/GROUP BY
- [ ] Axis fields validated against allowlist
- [ ] State suspends on LATCH→GRAPH switch
- [ ] State restores on GRAPH→LATCH switch

**Test:** `tests/providers/AxisProvider.test.ts`

---

### Plan 4-04: SelectionProvider

**Delivers:** `src/providers/SelectionProvider.ts`

**Contract:**

```typescript
class SelectionProvider {
  private selectedIds: Set<string> = new Set();
  private lastSelectedId: string | null = null;  // For range selection
  
  // Selection operations
  select(id: string): void;           // Replace selection
  toggle(id: string): void;           // Cmd+click
  range(id: string, allIds: string[]): void;  // Shift+click
  selectAll(ids: string[]): void;
  clear(): void;
  
  // Queries
  isSelected(id: string): boolean;
  getSelectedIds(): readonly string[];
  getSelectionCount(): number;
  
  // Subscribers (for UI updates)
  subscribe(callback: () => void): () => void;
  
  // PROV-03, PROV-07: No persistence methods
}
```

**Acceptance:**
- [ ] PROV-03: Selection in-memory only
- [ ] PROV-07: No toJSON/fromJSON/persist methods exist
- [ ] Toggle adds if absent, removes if present
- [ ] Range selects from lastSelectedId to current id
- [ ] Subscribers notified on any change

**Test:** `tests/providers/SelectionProvider.test.ts`

---

### Plan 4-05: DensityProvider

**Delivers:** `src/providers/DensityProvider.ts`

**Contract:**

```typescript
interface CompiledDensity {
  groupExpr: string;  // e.g., "strftime('%Y-%m', created_at)"
  labelExpr: string;  // e.g., "strftime('%b %Y', created_at)"
}

class DensityProvider {
  private timeField: 'created_at' | 'modified_at' | 'due_at' = 'created_at';
  private granularity: TimeGranularity = 'month';
  
  // State management
  setTimeField(field: 'created_at' | 'modified_at' | 'due_at'): void;
  setGranularity(granularity: TimeGranularity): void;
  getTimeField(): string;
  getGranularity(): TimeGranularity;
  
  // SQL compilation (PROV-04)
  compile(): CompiledDensity;
  
  // Tier 2 persistence
  toJSON(): string;
  static fromJSON(json: string): DensityProvider;
}
```

**Granularity → strftime mapping:**
- `day` → `strftime('%Y-%m-%d', field)`
- `week` → `strftime('%Y-W%W', field)`
- `month` → `strftime('%Y-%m', field)`
- `quarter` → `strftime('%Y-Q', field) || ((CAST(strftime('%m', field) AS INT) - 1) / 3 + 1)`
- `year` → `strftime('%Y', field)`

**Acceptance:**
- [ ] PROV-04: All five granularities produce valid SQL
- [ ] Granularity change triggers query recompilation (via subscriber)
- [ ] Calendar/Timeline views use DensityProvider output

**Test:** `tests/providers/DensityProvider.test.ts`

---

### Plan 4-06: ViewProvider

**Delivers:** `src/providers/ViewProvider.ts`

**Contract:**

```typescript
interface ViewState {
  currentView: ViewType;
  viewFamily: ViewFamily;
  
  // Suspended state for family switching
  latchState: {
    lastView: ViewType;
    axisState: AxisState;
  } | null;
  
  graphState: {
    lastView: ViewType;
    // Graph views don't use axis state
  } | null;
}

class ViewProvider {
  private state: ViewState;
  
  // View switching
  setView(view: ViewType): void;
  getView(): ViewType;
  getViewFamily(): ViewFamily;
  
  // Family detection
  static getFamily(view: ViewType): ViewFamily;
  
  // State suspension/restoration (coordinated with AxisProvider)
  onFamilySwitch(from: ViewFamily, to: ViewFamily): void;
  
  // Tier 2 persistence (PROV-05)
  toJSON(): string;
  static fromJSON(json: string): ViewProvider;
  
  // Subscribers
  subscribe(callback: (view: ViewType) => void): () => void;
}
```

**Acceptance:**
- [ ] PROV-05: Current view persists to ui_state
- [ ] Family switch suspends/restores axis state
- [ ] LATCH views: list, grid, kanban, calendar, timeline, gallery
- [ ] GRAPH views: network, tree

**Test:** `tests/providers/ViewProvider.test.ts`

---

### Plan 4-07: StateManager (Tier 2 Persistence)

**Delivers:** `src/providers/StateManager.ts`

**Contract:**

```typescript
interface StateManagerConfig {
  bridge: WorkerBridge;
  debounceMs?: number;  // Default 500ms
}

class StateManager {
  constructor(config: StateManagerConfig);
  
  // Provider registration
  registerProvider(key: string, provider: PersistableProvider): void;
  
  // Persistence (PROV-06)
  persist(key: string): Promise<void>;
  persistAll(): Promise<void>;
  restore(): Promise<void>;
  
  // Dirty tracking
  markDirty(key: string): void;
  isDirty(key: string): boolean;
  
  // Auto-persist on change (debounced)
  enableAutoPersist(): void;
  disableAutoPersist(): void;
}

interface PersistableProvider {
  toJSON(): string;
  // Note: fromJSON is static, called during restore
}
```

**ui_state keys:**
- `filter` → FilterProvider state
- `axis` → AxisProvider state  
- `density` → DensityProvider state
- `view` → ViewProvider state

**Acceptance:**
- [ ] PROV-06: All Tier 2 providers restore on launch
- [ ] Debounced writes prevent thrashing
- [ ] Graceful handling of missing/corrupt ui_state

**Test:** `tests/providers/StateManager.test.ts`

---

### Plan 4-08: QueryBuilder

**Delivers:** `src/providers/QueryBuilder.ts`

**Contract:**

```typescript
interface CompiledQuery {
  sql: string;
  params: unknown[];
}

class QueryBuilder {
  constructor(
    private filter: FilterProvider,
    private axis: AxisProvider,
    private density: DensityProvider
  );
  
  // Build complete SELECT query for cards
  buildCardQuery(options?: {
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): CompiledQuery;
  
  // Build COUNT query (for pagination)
  buildCountQuery(): CompiledQuery;
  
  // Build grouped query (for Kanban/Calendar)
  buildGroupedQuery(groupField: AxisField): CompiledQuery;
}
```

**Acceptance:**
- [ ] Combines filter WHERE, axis ORDER BY, density GROUP BY
- [ ] Always includes `deleted_at IS NULL` unless includeDeleted
- [ ] Proper SQL fragment ordering

**Test:** `tests/providers/QueryBuilder.test.ts`

---

### Plan 4-09: MutationManager

**Delivers:** `src/mutations/MutationManager.ts`, `src/mutations/types.ts`, `src/mutations/inverses.ts`

**Contract:**

```typescript
// types.ts
interface MutationCommand {
  sql: string;
  params: unknown[];
}

interface Mutation {
  id: string;
  timestamp: number;
  description: string;
  forward: MutationCommand[];
  inverse: MutationCommand[];
}

// MutationManager.ts
class MutationManager {
  private history: Mutation[] = [];
  private redoStack: Mutation[] = [];
  private dirty = false;
  
  constructor(private bridge: WorkerBridge);
  
  // Execute mutations (WKBR-05)
  async execute(mutation: Mutation): Promise<void>;
  
  // Undo/Redo (WKBR-07)
  async undo(): Promise<boolean>;  // Returns false if nothing to undo
  async redo(): Promise<boolean>;
  
  // State
  canUndo(): boolean;
  canRedo(): boolean;
  getHistory(): readonly Mutation[];
  
  // Dirty flag (WKBR-06)
  isDirty(): boolean;
  clearDirty(): void;
  
  // Subscribers
  subscribe(callback: () => void): () => void;
}

// inverses.ts
function createCardMutation(input: CardInput): Mutation;
function updateCardMutation(id: string, before: Card, after: Partial<Card>): Mutation;
function deleteCardMutation(card: Card): Mutation;
function createConnectionMutation(input: ConnectionInput): Mutation;
function deleteConnectionMutation(conn: Connection): Mutation;
```

**Inverse generation rules:**
- `INSERT` → `DELETE WHERE id = ?`
- `DELETE` → `INSERT ... VALUES (...)`  (need full row data)
- `UPDATE` → `UPDATE ... SET ... WHERE id = ?` (restore old values)
- Batch mutations: inverse array is reversed order

**Acceptance:**
- [ ] WKBR-05: Every mutation has inverse
- [ ] WKBR-06: Dirty flag set on execute, cleared on save
- [ ] WKBR-07: Cmd+Z/Cmd+Shift+Z work correctly
- [ ] Batch inverse ordering is reversed

**Test:** `tests/mutations/MutationManager.test.ts`

---

### Plan 4-10: Worker ui_state Handler

**Delivers:** Updates to `src/worker/protocol.ts`, `src/worker/handlers/ui-state.handler.ts`

**Contract:**

Add to protocol.ts:
```typescript
type WorkerRequestType =
  | ... // existing
  | 'ui:get'
  | 'ui:set'
  | 'ui:delete'
  | 'ui:getAll';

interface WorkerPayloads {
  // ... existing
  'ui:get': { key: string };
  'ui:set': { key: string; value: string };
  'ui:delete': { key: string };
  'ui:getAll': Record<string, never>;
}

interface WorkerResponses {
  // ... existing
  'ui:get': { key: string; value: string | null; updated_at: string | null };
  'ui:set': void;
  'ui:delete': void;
  'ui:getAll': Array<{ key: string; value: string; updated_at: string }>;
}
```

**Acceptance:**
- [ ] ui_state CRUD via WorkerBridge
- [ ] StateManager uses these handlers
- [ ] Existing tests still pass

**Test:** `tests/worker/ui-state.test.ts`

---

### Plan 4-11: SQL Injection Test Suite

**Delivers:** `tests/providers/sql-injection.test.ts`

**Contract:**

Test cases:
- Injection in filter value: `{ field: 'folder', operator: 'eq', value: "'; DROP TABLE cards; --" }`
- Unknown field: `{ field: 'DROP TABLE' as FilterField, ... }`
- Unknown operator: `{ ..., operator: 'UNION SELECT' as FilterOperator, ... }`
- Injection in axis field: `{ field: "name; DROP TABLE cards" as AxisField, ... }`
- Bobby Tables: `{ field: 'name', operator: 'eq', value: "Robert'); DROP TABLE students;--" }`

**Acceptance:**
- [ ] SAFE-06: All injection attempts either throw or produce safe parameterized SQL
- [ ] Zero actual SQL execution (test compilation only)

---

### Plan 4-12: Keyboard Shortcuts

**Delivers:** `src/mutations/shortcuts.ts`

**Contract:**

```typescript
function setupMutationShortcuts(manager: MutationManager): () => void;
// Returns cleanup function

// Listens for:
// - Cmd+Z (Mac) / Ctrl+Z (Windows) → manager.undo()
// - Cmd+Shift+Z / Ctrl+Y → manager.redo()
```

**Acceptance:**
- [ ] WKBR-07: Keyboard shortcuts trigger undo/redo
- [ ] Platform detection (Cmd vs Ctrl)
- [ ] Cleanup removes listeners

**Test:** `tests/mutations/shortcuts.test.ts`

---

## Technical Decisions

### Decision: Compile-Time vs Runtime Validation

**Both.** TypeScript union types catch literal misuse at compile time. Runtime validation catches dynamic input (e.g., from stored state or user input).

```typescript
// Compile-time catch:
addFilter({ field: 'invalid' }); // TS error

// Runtime catch:
addFilter({ field: fieldFromJSON }); // Validated at runtime
```

---

### Decision: Inverse Computation Strategy

**Compute inverse at mutation creation, not at undo time.**

Rationale:
- Undo must work even if current state has changed
- Batch operations need their inverses in reverse order
- Computing at creation time captures the "before" state

---

### Decision: Provider Instantiation

**Singleton providers managed by a ProviderContext.**

```typescript
// Future Phase 5 usage
const ctx = getProviderContext();
ctx.filter.addFilter(...);
ctx.axis.setXAxis(...);

const query = ctx.queryBuilder.buildCardQuery();
const cards = await bridge.query(query);
```

---

### Decision: Debounce Strategy for Persistence

**500ms debounce per provider key.**

Rationale:
- User may rapidly change filters
- Each keystroke shouldn't trigger write
- 500ms balances responsiveness with efficiency

---

## Test Strategy

### Unit Tests

| Test File | Covers |
|-----------|--------|
| `tests/providers/allowlist.test.ts` | Validation functions, frozen sets |
| `tests/providers/FilterProvider.test.ts` | Compilation, rejection, serialization |
| `tests/providers/AxisProvider.test.ts` | ORDER BY/GROUP BY generation |
| `tests/providers/SelectionProvider.test.ts` | Toggle, range, no persistence |
| `tests/providers/DensityProvider.test.ts` | strftime() generation |
| `tests/providers/ViewProvider.test.ts` | Family switching, state suspension |
| `tests/providers/StateManager.test.ts` | Persist/restore, debounce |
| `tests/providers/QueryBuilder.test.ts` | Combined query assembly |
| `tests/mutations/MutationManager.test.ts` | Execute, undo, redo, dirty |
| `tests/mutations/inverses.test.ts` | Inverse SQL generation |

### Security Tests

| Test File | Covers |
|-----------|--------|
| `tests/providers/sql-injection.test.ts` | SAFE-06 injection suite |

### Integration Tests

| Test File | Covers |
|-----------|--------|
| `tests/providers/persistence.test.ts` | Full ui_state round-trip |
| `tests/mutations/undo-redo.test.ts` | Full mutation workflow |

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Complex inverse generation for batch ops | Broken undo | Medium | Comprehensive inverse test suite |
| State restoration race with view render | Blank screen | Low | StateManager.restore() awaited before first render |
| ui_state corruption | Lost preferences | Low | Graceful fallback to defaults |
| Provider subscription leaks | Memory growth | Medium | Return cleanup functions, test in Phase 5 |

---

## Definition of Done

Phase 4 is complete when:

1. [ ] All Success Criteria (6/6) verified
2. [ ] All Plans (12/12) implemented and merged
3. [ ] All tests passing (`npm test` green)
4. [ ] TypeScript compiles (`npm run typecheck` green)
5. [ ] SAFE-06 injection test suite passes
6. [ ] Manual test: Cmd+Z undoes card creation
7. [ ] Manual test: App restart restores filter state
8. [ ] `ROADMAP.md` Phase 4 status updated to "Complete"

---

## Appendix: ui_state Key Schema

| Key | Provider | Example Value |
|-----|----------|---------------|
| `filter` | FilterProvider | `{"filters":[{"field":"folder","operator":"eq","value":"Projects"}]}` |
| `axis` | AxisProvider | `{"x":{"field":"created_at","direction":"desc"},"y":null,"group":null}` |
| `density` | DensityProvider | `{"timeField":"created_at","granularity":"month"}` |
| `view` | ViewProvider | `{"currentView":"kanban","viewFamily":"latch","latchState":null,"graphState":null}` |

---

*Phase 4 spec created: 2026-02-28*
*Author: Claude + Michael*
