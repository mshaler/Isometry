# Phase 79: Test Infrastructure - Research

**Researched:** 2026-03-15
**Domain:** Vitest test factory infrastructure — sql.js in-memory database + provider stack wiring
**Confidence:** HIGH

## Summary

Phase 79 is not a new-library problem. Every dependency already exists in the project: sql.js, Vitest, all providers (FilterProvider, PAFVProvider, SuperDensityProvider, SelectionProvider, SchemaProvider, StateCoordinator). The task is purely to build two factory helpers (`realDb()` and `makeProviders()`) and their smoke tests so that Phases 80-83 can wire seam tests in one line each.

The critical complexity is correctness, not discovery. Three things can silently fail: (1) forgetting `setSchemaProvider()` on FilterProvider, PAFVProvider, and SuperDensityProvider after construction — the allowlist module-level singleton `_schemaProvider` is separate from each provider's `_schema` instance variable; (2) using the wrong coordinator flush pattern — the coordinator uses `setTimeout(16)`, not `queueMicrotask`; (3) the `SchemaProvider.initialize()` requires a `{ cards: ColumnInfo[], connections: ColumnInfo[] }` shape derived from PRAGMA table_info, not an ad-hoc object.

**Primary recommendation:** Read the source signatures of every provider constructor before writing a single line of factory code. All constructor signatures are zero-argument; all injection is done via setters after construction. The init order matters: create SchemaProvider, initialize it with PRAGMA data from the real db, then inject into providers that have `setSchemaProvider()`, then register all providers with coordinator.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `realDb()` returns an in-memory sql.js `Database` with production schema, no seed data
- `makeProviders(db)` requires a `realDb()` instance — no stub/optional mode
- Return shape: Named object `{ filter, pafv, density, selection, coordinator, schema }` — tests destructure what they need
- No overrides: Factory always returns clean defaults; tests mutate providers after creation
- Location: `tests/harness/` directory (separate from existing `tests/setup/` which handles WASM init)
- `realDb()` returns bare schema (no rows) — matches INFR-01 spec
- `seedCards(db, cards[])` — separate helper, accepts minimal partial objects with sensible defaults (auto-generates `id`, `created_at`, `updated_at`, `deleted_at=null`)
- `seedConnections(db, connections[])` — separate helper for connections; most seam tests won't need it
- FTS5 always populated — `seedCards()` inserts into both `cards` and `cards_fts` automatically, matching production behavior
- `tests/seams/` — new dedicated directory for all seam tests (Phases 80-83), with subdirectories by domain
- `tests/harness/` — factory code + smoke tests
- `npm run test:harness` — runs `tests/harness/*.test.ts` only
- `npm run test:seams` — runs `tests/seams/**/*.test.ts` only
- `npm run test` — continues to run everything
- TypeScript-only npm scripts — no `swift test` in npm

### Claude's Discretion
- Exact file naming inside `tests/harness/` (e.g., `realDb.ts`, `makeProviders.ts`, etc.)
- Whether smoke tests go in a single file or multiple files
- Internal implementation details of seedCards/seedConnections helpers

### Deferred Ideas (OUT OF SCOPE)
- WA-02 hideEmpty cross-product behavior
- d3.brushX jsdom simulation
- CalcExplorer subscription path
- LATCH→GRAPH round-trip axis clearing
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | `realDb()` factory creates in-memory sql.js DB with production schema, no seed data | Database.ts already has `initialize()` that creates fresh schema; factory is a thin wrapper |
| INFR-02 | `makeProviders()` factory wires FilterProvider, PAFVProvider, SuperDensityProvider, SelectionProvider, StateCoordinator in correct init order | All constructors are zero-arg; init order established; setter injection pattern documented |
| INFR-03 | Smoke tests verify both factories work (insert-query round-trip, provider-coordinator notify) | Flush pattern, lifecycle, PRAGMA-derived ColumnInfo shape all documented |
| SCRP-01 | package.json has `test:seams` and `test:harness` scripts targeting seam + helper tests | Vitest `--run` pattern + glob include filter pattern documented |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.0.18 | Test runner | Already configured with `globalSetup`, `pool: 'forks'`, WASM-aware |
| sql.js | ^1.14.0 | In-memory SQLite (custom FTS5 build) | Production database — the point is to test against real sql.js |
| TypeScript | ^5.9.3 | Type safety | Project-wide, no alternatives |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vi.useFakeTimers() | built-in Vitest | Control `setTimeout(16)` in coordinator tests | All smoke tests that test coordinator notify |
| vi.advanceTimersByTime(20) | built-in Vitest | Advance past coordinator's 16ms setTimeout | Flush coordinator cycle (not `vi.advanceTimersByTimeAsync`) |
| crypto.randomUUID() | Node built-in | Generate test card IDs | Available in Node/Vitest environment |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Real sql.js Database | Mock/stub db | Never mock the database — the entire point of Phase 79 is real database testing |
| `vi.advanceTimersByTime(20)` | `vi.advanceTimersByTimeAsync(16)` | The existing seam test uses synchronous `advanceTimersByTime` + `Promise.resolve()` flushes; either works but synchronous form is already established |

**Installation:**
No new packages required. All dependencies are already in `package.json`.

## Architecture Patterns

### Recommended Project Structure
```
tests/
├── harness/
│   ├── realDb.ts              # realDb() factory — returns Database
│   ├── makeProviders.ts       # makeProviders(db) factory — returns named provider object
│   ├── seedCards.ts           # seedCards(db, cards[]) helper
│   ├── seedConnections.ts     # seedConnections(db, connections[]) helper
│   └── smoke.test.ts          # Smoke tests for both factories (INFR-03)
├── seams/                     # Empty directory for Phases 80-83
│   ├── filter/                # FSQL-01..05, CELL-01..04 (Phase 80)
│   ├── coordinator/           # CORD-01..03, DENS-01..02 (Phase 81)
│   ├── ui/                    # VTAB-01..02, HIST-01..02, CMDB-01..02 (Phase 82)
│   └── etl/                   # EFTS-01..02, WBSH-01..02, CALC-01..02 (Phase 83)
└── setup/
    └── wasm-init.ts           # Existing — DO NOT MODIFY
```

### Pattern 1: realDb() Factory
**What:** Zero-arg async factory that creates a fresh in-memory Database with production schema
**When to use:** In every seam test's `beforeEach`

```typescript
// tests/harness/realDb.ts
import { Database } from '../../src/database/Database';

export async function realDb(): Promise<Database> {
  const db = new Database();
  await db.initialize();
  return db;
}
```

**Key insight:** `Database.initialize()` already handles WASM path resolution via `SQL_WASM_PATH` env var (set by `globalSetup: './tests/setup/wasm-init.ts'`). The factory needs no special WASM logic — just call `new Database()` then `await db.initialize()`.

### Pattern 2: makeProviders() Factory
**What:** Takes a `realDb()` instance, creates all providers, wires SchemaProvider, registers with coordinator
**When to use:** In every seam test's `beforeEach` alongside `realDb()`

```typescript
// tests/harness/makeProviders.ts
import type { Database } from '../../src/database/Database';
import { FilterProvider } from '../../src/providers/FilterProvider';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import { SchemaProvider } from '../../src/providers/SchemaProvider';
import { SelectionProvider } from '../../src/providers/SelectionProvider';
import { StateCoordinator } from '../../src/providers/StateCoordinator';
import { SuperDensityProvider } from '../../src/providers/SuperDensityProvider';
import { setSchemaProvider } from '../../src/providers/allowlist';
import type { ColumnInfo, LatchFamily } from '../../src/worker/protocol';

export interface ProviderStack {
  filter: FilterProvider;
  pafv: PAFVProvider;
  density: SuperDensityProvider;
  selection: SelectionProvider;
  coordinator: StateCoordinator;
  schema: SchemaProvider;
}

export function makeProviders(db: Database): ProviderStack {
  // 1. Build SchemaProvider from real PRAGMA data
  const schema = new SchemaProvider();
  const cardCols = buildColumnInfo(db, 'cards');
  const connCols = buildColumnInfo(db, 'connections');
  schema.initialize({ cards: cardCols, connections: connCols });

  // 2. Wire module-level allowlist singleton (required for validateFilterField/validateAxisField)
  setSchemaProvider(schema);

  // 3. Create providers
  const filter = new FilterProvider();
  const pafv = new PAFVProvider();
  const density = new SuperDensityProvider();
  const selection = new SelectionProvider();

  // 4. Setter injection (v5.3 pattern — CRITICAL)
  filter.setSchemaProvider(schema);   // FilterProvider has NO setSchemaProvider — see note below
  pafv.setSchemaProvider(schema);
  density.setSchemaProvider(schema);

  // 5. Register with coordinator
  const coordinator = new StateCoordinator();
  coordinator.registerProvider('filter', filter);
  coordinator.registerProvider('pafv', pafv);
  coordinator.registerProvider('density', density);
  coordinator.registerProvider('selection', selection);

  return { filter, pafv, density, selection, coordinator, schema };
}
```

**CRITICAL NOTE on FilterProvider:** Reading `FilterProvider.ts` confirms it does NOT have a `setSchemaProvider()` method on the provider instance. The filter allowlist validation goes through the module-level `setSchemaProvider(schema)` in `allowlist.ts` (the singleton). The call `filter.setSchemaProvider(schema)` shown above is WRONG — FilterProvider has no such method. The correct approach is calling `setSchemaProvider(schema)` from `allowlist.ts` directly. PAFVProvider and SuperDensityProvider DO have `setSchemaProvider()` instance methods.

**Corrected `makeProviders()` — no instance setter on FilterProvider:**

```typescript
// Step 2: Wire allowlist module singleton (affects FilterProvider validation globally)
import { setSchemaProvider } from '../../src/providers/allowlist';
setSchemaProvider(schema);  // This is the ONLY way to wire schema into FilterProvider
```

### Pattern 3: seedCards() Helper
**What:** Inserts minimal card rows; auto-generates id/timestamps; FTS5 is automatically synced via triggers
**When to use:** In seam tests that need rows in the database

```typescript
// tests/harness/seedCards.ts
import type { Database } from '../../src/database/Database';

export interface SeedCard {
  id?: string;
  card_type?: 'note' | 'task' | 'event' | 'resource' | 'person';
  name?: string;
  folder?: string | null;
  status?: string | null;
  priority?: number;
  content?: string | null;
  tags?: string | null;  // JSON array string
  deleted_at?: string | null;
  created_at?: string;
  modified_at?: string;
}

export function seedCards(db: Database, cards: SeedCard[]): string[] {
  const now = new Date().toISOString();
  const insertedIds: string[] = [];

  db.run('BEGIN');
  for (const card of cards) {
    const id = card.id ?? crypto.randomUUID();
    insertedIds.push(id);
    db.run(
      `INSERT INTO cards (id, card_type, name, folder, status, priority, content, tags, deleted_at, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        card.card_type ?? 'note',
        card.name ?? 'Unnamed',
        card.folder ?? null,
        card.status ?? null,
        card.priority ?? 0,
        card.content ?? null,
        card.tags ?? null,
        card.deleted_at ?? null,
        card.created_at ?? now,
        card.modified_at ?? now,
      ],
    );
    // FTS5 is populated automatically via the cards_fts_ai trigger defined in schema.sql
    // No manual FTS insert needed — the trigger runs on every INSERT INTO cards
  }
  db.run('COMMIT');

  return insertedIds;
}
```

**Key insight:** The FTS5 trigger `cards_fts_ai` in `schema.sql` fires on every `INSERT INTO cards`, so `seedCards()` does NOT need to manually insert into `cards_fts`. This is cheaper and matches production behavior exactly.

### Pattern 4: Coordinator Flush in Tests
**What:** The coordinator uses `setTimeout(16)` — tests must use fake timers and advance manually
**When to use:** Any smoke test that asserts coordinator notification

```typescript
// Established pattern from tests/integration/seam-coordinator-batch.test.ts

// In beforeEach:
vi.useFakeTimers();

// In afterEach:
coordinator.destroy();
vi.useRealTimers();

// Flush helper:
async function flushCoordinatorCycle(): Promise<void> {
  // Flush microtasks (provider self-notify via queueMicrotask)
  await Promise.resolve();
  await Promise.resolve();
  // Advance past coordinator's 16ms setTimeout
  vi.advanceTimersByTime(20);
  // Flush remaining microtasks
  await Promise.resolve();
}
```

### Pattern 5: PRAGMA-derived ColumnInfo for SchemaProvider
**What:** `SchemaProvider.initialize()` requires `ColumnInfo[]` objects — not raw PRAGMA rows
**When to use:** Inside `makeProviders()` to populate schema from real PRAGMA data

```typescript
// ColumnInfo shape from src/worker/protocol.ts (must read before implementing)
// LatchFamily is: 'Location' | 'Alphabet' | 'Time' | 'Category' | 'Hierarchy'

function buildColumnInfo(db: Database, table: 'cards' | 'connections'): ColumnInfo[] {
  const rows = db.exec(`PRAGMA table_info(${table})`);
  // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
  const cols = rows[0]?.values ?? [];
  return cols.map((row) => {
    const name = row[1] as string;
    const type = (row[2] as string).toUpperCase();
    const isNumeric = type === 'INTEGER' || type === 'REAL';
    return {
      name,
      type,
      isNumeric,
      latchFamily: classifyLatchFamily(name),
    };
  });
}

function classifyLatchFamily(name: string): LatchFamily {
  if (['latitude', 'longitude', 'location_name'].includes(name)) return 'Location';
  if (['created_at', 'modified_at', 'due_at', 'completed_at', 'event_start', 'event_end'].includes(name)) return 'Time';
  if (['folder', 'status', 'card_type', 'tags', 'source', 'mime_type'].includes(name)) return 'Category';
  if (['priority', 'sort_order', 'is_collective'].includes(name)) return 'Hierarchy';
  return 'Alphabet';  // Default for name, content, summary, id, url, etc.
}
```

**Confidence note:** The ColumnInfo type and LatchFamily union must be verified by reading `src/worker/protocol.ts` before implementation. The shape described above is derived from SchemaProvider usage patterns but the exact type definition is in the protocol file.

### Pattern 6: npm Script Format
**What:** Vitest `--run` with `--reporter=verbose` and `--testPathPattern` for targeted scripts
**When to use:** `test:harness` and `test:seams` scripts in package.json

```json
"test:harness": "vitest --run tests/harness",
"test:seams": "vitest --run tests/seams"
```

**Key insight:** Vitest accepts a path pattern as a positional argument. `vitest --run tests/harness` runs all test files under `tests/harness/`. This is simpler than `--include` config overrides.

### Pattern 7: Test Lifecycle (WASM heap cleanup)
**What:** Every test file that creates a `Database` instance MUST call `db.close()` in `afterEach`
**When to use:** Always — prevents WASM heap memory leaks between test files

```typescript
let db: Database;
let providers: ProviderStack;

beforeEach(async () => {
  vi.useFakeTimers();
  db = await realDb();
  providers = makeProviders(db);
});

afterEach(() => {
  providers.coordinator.destroy();
  db.close();
  vi.useRealTimers();
});
```

**Destroy order matters:** Call `coordinator.destroy()` BEFORE `db.close()`. The coordinator holds provider subscriptions; providers reference db operations. Destroy subscriptions first, then close the db heap.

### Anti-Patterns to Avoid

- **Using `vi.advanceTimersByTimeAsync(16)` without double Promise.resolve():** The existing project uses `vi.advanceTimersByTime(20)` (synchronous) plus explicit `await Promise.resolve()` calls. Stay consistent with the pattern in `seam-coordinator-batch.test.ts`.
- **Calling `setSchemaProvider(null)` in afterEach within makeProviders scope:** The allowlist module-level singleton persists between test files in the same process. Since `pool: 'forks'` gives each file its own process, this is safe — but if tests are co-located in the same file, reset the singleton: `setSchemaProvider(null)` in `afterEach`.
- **Manually inserting into cards_fts in seedCards():** The schema defines `cards_fts_ai` trigger on INSERT INTO cards. Manual FTS insert in seedCards would double-insert and corrupt the FTS index.
- **Using `new Database()` without `await db.initialize()`:** Database is not usable until `initialize()` resolves. This is an async factory; `realDb()` must be `async` and awaited.
- **Constructing SchemaProvider without calling `initialize()`:** SchemaProvider's `initialized` getter returns `false` until `initialize()` is called. Providers check `_schema?.initialized` before delegating validation — an uninitialized schema effectively means no delegation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WASM path resolution | Custom locateFile logic | `Database.ts` already handles it via `SQL_WASM_PATH` env + `wasm-init.ts` globalSetup | Path logic exists; duplicating breaks the existing test infrastructure |
| Timer control | Custom promise-based sleep | `vi.useFakeTimers()` + `vi.advanceTimersByTime()` | Vitest fake timers are synchronous and deterministic; async sleep races |
| ColumnInfo classification | Full LATCH heuristic from scratch | Read `src/worker/protocol.ts` ColumnInfo type + port the heuristic from SchemaProvider's existing code | The heuristic already exists in the worker; factory should replicate it consistently |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Available in Node 15+ and all modern browsers; already used in existing seed.ts |
| Transaction batching | Per-row auto-commit | `db.run('BEGIN')` / `db.run('COMMIT')` wrapper | Same pattern as existing `seed.ts`; prevents 10x slowdown on multi-row seeds |

**Key insight:** The project already has a `tests/database/seed.ts` that seeds 10K cards for performance benchmarks. The new `seedCards()` helper in `tests/harness/` is a lightweight variant: smaller API surface (partial card objects), sensible defaults, no random content generation. Do not port the perf-seed logic — build a simpler helper.

## Common Pitfalls

### Pitfall 1: FilterProvider Has No `setSchemaProvider()` Instance Method
**What goes wrong:** Calling `filter.setSchemaProvider(schema)` throws `TypeError: filter.setSchemaProvider is not a function`
**Why it happens:** FilterProvider's allowlist delegation goes through the module-level `setSchemaProvider()` function in `allowlist.ts`, NOT an instance method on FilterProvider. FilterProvider reads from the module singleton at call time.
**How to avoid:** Import `setSchemaProvider` from `../../src/providers/allowlist` and call it with the schema instance after SchemaProvider is initialized.
**Warning signs:** TypeScript error "property 'setSchemaProvider' does not exist on type 'FilterProvider'"

### Pitfall 2: SchemaProvider Not Initialized Before Injection
**What goes wrong:** `pafv.setSchemaProvider(schema)` succeeds but `pafv._getSupergridDefaults()` returns hardcoded defaults because `schema.initialized === false`
**Why it happens:** SchemaProvider initializes lazily via `initialize({ cards, connections })`. Constructing it and injecting it before calling `initialize()` means providers see an empty schema.
**How to avoid:** Call `schema.initialize(...)` BEFORE calling `pafv.setSchemaProvider(schema)` or `density.setSchemaProvider(schema)`.
**Warning signs:** `schema.initialized` is `false` after `makeProviders()` returns; test assertions on dynamic fields silently fail.

### Pitfall 3: Wrong Coordinator Flush Pattern
**What goes wrong:** Test asserts `expect(callback).toHaveBeenCalledTimes(1)` but callback count is 0 — coordinator never fired
**Why it happens:** Provider notifications use `queueMicrotask` (resolved with `await Promise.resolve()`). Coordinator notification uses `setTimeout(16)` (requires `vi.advanceTimersByTime(20)`). Forgetting either step leaves the notification pending.
**How to avoid:** Use the exact `flushCoordinatorCycle()` pattern from `seam-coordinator-batch.test.ts`. Two `Promise.resolve()` awaits, then `vi.advanceTimersByTime(20)`, then one more `Promise.resolve()`.
**Warning signs:** Test hangs or callback count stays at 0 even after `await Promise.resolve()`.

### Pitfall 4: FTS5 Double-Insert
**What goes wrong:** FTS queries return double results or SQLite throws "cannot add content to content table"
**Why it happens:** `schema.sql` defines `cards_fts_ai` trigger on INSERT INTO cards. If `seedCards()` also manually inserts into `cards_fts`, the FTS index gets corrupted.
**How to avoid:** Do NOT insert into `cards_fts` manually in `seedCards()`. The trigger handles it automatically.
**Warning signs:** FTS MATCH query returns 2x expected rows; "FTS integrity check" fails.

### Pitfall 5: WASM Heap Leak (No `db.close()`)
**What goes wrong:** Test suite slows progressively or OOMs on long runs
**Why it happens:** sql.js WASM heap is a fixed-size ArrayBuffer. Not calling `db.close()` leaves it allocated between test files. With `pool: 'forks'` each file gets its own process, so leaks are scoped per file — but within a file, each `beforeEach` that creates a new Database without `afterEach` close accumulates heap.
**How to avoid:** Always pair `await realDb()` in `beforeEach` with `db.close()` in `afterEach`.
**Warning signs:** "Maximum call stack size exceeded" or "Out of memory" in WASM-heavy test files.

### Pitfall 6: `makeProviders()` Called Without `vi.useFakeTimers()` in Coordinator Smoke Tests
**What goes wrong:** Coordinator smoke test for "filter change fires notification" times out waiting for real 16ms setTimeout
**Why it happens:** `StateCoordinator.scheduleUpdate()` uses real `setTimeout(16)`. Without fake timers, the test must actually wait 16ms — which works but is fragile and slow in CI.
**How to avoid:** Always call `vi.useFakeTimers()` in `beforeEach` for any test that asserts coordinator behavior. Call `vi.useRealTimers()` in `afterEach`.
**Warning signs:** Test passes locally but is flaky in CI due to timer resolution.

### Pitfall 7: Vitest Script Path Targeting
**What goes wrong:** `vitest --run tests/harness` runs no tests (0 test files found)
**Why it happens:** Vitest path pattern matching is relative to the project root. If the script is run from a different directory, the path won't match.
**How to avoid:** Use `vitest --run --reporter=verbose tests/harness` from the project root. Consider adding `include: ['tests/harness/**/*.test.ts']` as a Vitest project config override via CLI, or rely on the default path pattern which works when run from project root.
**Warning signs:** "No test files found" even though files exist.

## Code Examples

Verified patterns from project source code:

### Database lifecycle (from tests/database/Database.test.ts)
```typescript
// Source: tests/database/Database.test.ts lines 10-19
let db: Database;

beforeEach(async () => {
  db = new Database();
  await db.initialize();
});

afterEach(() => {
  db.close(); // Required: releases WASM heap, prevents leaks between tests
});
```

### StateCoordinator flush (from tests/integration/seam-coordinator-batch.test.ts)
```typescript
// Source: tests/integration/seam-coordinator-batch.test.ts lines 28-38
async function flushCoordinatorCycle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  vi.advanceTimersByTime(20);
  await Promise.resolve();
}

// Usage in test:
beforeEach(() => {
  vi.useFakeTimers();
  coordinator = new StateCoordinator();
  coordinator.registerProvider('filter', filter);
});
afterEach(() => {
  coordinator.destroy();
  vi.useRealTimers();
});
```

### Provider construction — zero-arg constructors
```typescript
// All constructors confirmed zero-arg from source reading:
const filter = new FilterProvider();       // FilterProvider.ts line 43
const pafv = new PAFVProvider();           // PAFVProvider.ts line 103
const density = new SuperDensityProvider(); // SuperDensityProvider.ts line 62
const selection = new SelectionProvider(); // SelectionProvider.ts line 17
const coordinator = new StateCoordinator(); // StateCoordinator.ts line 27
const schema = new SchemaProvider();       // SchemaProvider.ts line 28
```

### SchemaProvider.initialize() call signature
```typescript
// Source: SchemaProvider.ts lines 51-58
// initialize() takes: { cards: ColumnInfo[], connections: ColumnInfo[] }
schema.initialize({ cards: cardColumnInfoArray, connections: connColumnInfoArray });
// After this call: schema.initialized === true
```

### PRAGMA table_info result shape
```typescript
// db.exec returns: { columns: string[], values: unknown[][] }[]
// PRAGMA table_info columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk']
// values[i] = [0, 'id', 'TEXT', 1, null, 1]  (index corresponds to column position)
const rows = db.exec('PRAGMA table_info(cards)');
// rows[0].columns = ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk']
// rows[0].values = [[0, 'id', 'TEXT', 1, null, 1], [1, 'card_type', 'TEXT', 1, "'note'", 0], ...]
```

### Allowlist module-level setter (critical for FilterProvider)
```typescript
// Source: src/providers/allowlist.ts lines 46-48
// This is the ONLY way to wire schema into FilterProvider validation
import { setSchemaProvider } from '../../src/providers/allowlist';
setSchemaProvider(schema);  // Must be called after schema.initialize()
// To reset in afterEach if needed: setSchemaProvider(null);
```

### seedCards FTS trigger behavior
```typescript
// Source: src/database/schema.sql lines 135-138
// FTS trigger fires automatically on INSERT INTO cards:
// CREATE TRIGGER cards_fts_ai AFTER INSERT ON cards BEGIN
//   INSERT INTO cards_fts(rowid, name, content, folder, tags)
//   VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
// END;
//
// Therefore seedCards() does NOT need manual cards_fts inserts.
```

### Existing bench seed pattern (for reference — do NOT copy verbatim)
```typescript
// Source: tests/database/seed.ts lines 216-243
// Shows the BEGIN/COMMIT batch pattern + db.run() with positional params
db.run('BEGIN');
for (const card of cards) {
  db.run(`INSERT INTO cards(...) VALUES (?, ?, ...)`, [id, cardType, ...]);
}
db.run('COMMIT');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct `new Database()` in every test | `realDb()` shared factory | Phase 79 (this phase) | Seam tests become one-liners |
| Manual provider construction per test | `makeProviders(db)` factory | Phase 79 (this phase) | No more forgetting `setSchemaProvider()` |
| Static ALLOWED_FILTER_FIELDS frozen set | Module-level `_schemaProvider` singleton + per-provider `_schema` instance | Phase 70-71 (v5.3) | Dynamic schema support; factory must wire BOTH paths |
| No seam test organization | `tests/seams/` directory with domain subdirectories | Phase 79 (this phase) | Phases 80-83 have a home |

**Deprecated/outdated:**
- Direct ALLOWED_FILTER_FIELDS/ALLOWED_AXIS_FIELDS iteration in test code: use SchemaProvider delegation instead. The frozen sets are fallback-only after v5.3.
- Single-transaction card + FTS dual inserts in tests: schema triggers handle FTS sync automatically since Phase 1.

## Open Questions

1. **ColumnInfo type shape in `src/worker/protocol.ts`**
   - What we know: SchemaProvider.initialize() takes `{ cards: ColumnInfo[], connections: ColumnInfo[] }`. ColumnInfo has at minimum `name`, `type`, `isNumeric`, and `latchFamily` fields (inferred from SchemaProvider usage).
   - What's unclear: Exact TypeScript interface definition. There may be additional optional fields.
   - Recommendation: Read `src/worker/protocol.ts` as the first action in Wave 1 before implementing `buildColumnInfo()`.

2. **PAFVProvider.setSchemaProvider() null cleanup in afterEach**
   - What we know: `pafv.setSchemaProvider(null)` resets the instance reference. `setSchemaProvider(null)` in allowlist resets the module singleton.
   - What's unclear: Whether the `pool: 'forks'` isolation makes explicit cleanup unnecessary.
   - Recommendation: Since each test file gets its own process (vitest `pool: 'forks'` + `isolate: true`), module-level state does not leak between files. Within a single file, if multiple describe blocks share `makeProviders()`, reset with `setSchemaProvider(null)` in the outermost `afterEach` for safety.

3. **test:harness and test:seams in CI**
   - What we know: CONTEXT.md says "Add to CI — `test:harness` and `test:seams` as CI jobs alongside existing typecheck/lint/test". The current CI has 3 parallel jobs.
   - What's unclear: Whether SCRP-01 only requires package.json scripts or also CI YAML changes.
   - Recommendation: SCRP-01 explicitly scopes to package.json scripts. CI updates are desirable but not part of INFR-01..03 or SCRP-01. Treat CI update as stretch goal and note in PLAN.

## Sources

### Primary (HIGH confidence)
- Direct source reading: `src/providers/FilterProvider.ts` — confirmed zero-arg constructor, no `setSchemaProvider()` instance method, uses module-level allowlist singleton
- Direct source reading: `src/providers/PAFVProvider.ts` — confirmed `setSchemaProvider(sp: SchemaProvider | null)` instance method at line 120
- Direct source reading: `src/providers/SuperDensityProvider.ts` — confirmed `setSchemaProvider(sp: SchemaProvider | null)` instance method at line 77
- Direct source reading: `src/providers/StateCoordinator.ts` — confirmed `registerProvider(key, provider)`, `scheduleUpdate()` uses `setTimeout(16)`, `destroy()` pattern
- Direct source reading: `src/providers/SchemaProvider.ts` — confirmed `initialize({ cards, connections })`, `initialized` getter
- Direct source reading: `src/providers/allowlist.ts` — confirmed module-level `setSchemaProvider(sp)` singleton, fallback sets
- Direct source reading: `src/database/Database.ts` — confirmed `initialize(wasmBinary?, dbData?)` async method, `close()`, WASM path via `SQL_WASM_PATH` env
- Direct source reading: `src/database/schema.sql` — confirmed FTS trigger names (`cards_fts_ai`, `cards_fts_ad`, `cards_fts_au`), all 6 v6.0 covering/expression indexes
- Direct source reading: `tests/integration/seam-coordinator-batch.test.ts` — confirmed exact `flushCoordinatorCycle()` pattern
- Direct source reading: `tests/database/seed.ts` — confirmed BEGIN/COMMIT batch pattern, column list for INSERT
- Direct source reading: `vitest.config.ts` — confirmed `pool: 'forks'`, `isolate: true`, `globalSetup: './tests/setup/wasm-init.ts'`, `environment: 'node'`
- Direct source reading: `package.json` — confirmed existing script names, no `test:harness` or `test:seams` yet

### Secondary (MEDIUM confidence)
- `tests/setup/wasm-init.ts` + `Database.ts` WASM path logic: high confidence that `SQL_WASM_PATH` env var is the correct hook point; confirmed by cross-reading both files

### Tertiary (LOW confidence)
- ColumnInfo type shape: inferred from SchemaProvider usage; must verify against `src/worker/protocol.ts` before implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already in the project; versions confirmed from package.json
- Architecture: HIGH — all constructor signatures, setter methods, and lifecycle patterns verified from source
- Pitfalls: HIGH — FilterProvider/allowlist confusion is definitively confirmed by source reading; FTS trigger behavior confirmed from schema.sql

**Research date:** 2026-03-15
**Valid until:** Stable — these are internal project files, not external libraries. Valid until source code changes.
