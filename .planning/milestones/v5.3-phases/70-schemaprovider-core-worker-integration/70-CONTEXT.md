# Phase 70: SchemaProvider Core + Worker Integration - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Runtime schema metadata derived from PRAGMA table_info() — replaces hardcoded column knowledge with introspection. SchemaProvider exposes typed column metadata (name, type, nullability, LATCH family) available synchronously before any provider restore or query validation. Covers cards AND connections tables.

</domain>

<decisions>
## Implementation Decisions

### LATCH classification rules
- Hardcoded pattern-matching heuristics (not config-driven): `*_at` → Time, `name` → Alphabet, `folder/status/card_type/source` → Category, `priority/sort_order` → Hierarchy, `latitude/longitude/location_name` → Location
- Unmatched columns fall back to **Alphabet** family (most generic, always safe)
- Numeric detection uses **SQLite type affinity** from PRAGMA (INTEGER/REAL → numeric) — no separate hardcoded numeric list
- Introspect **both cards and connections** tables (all user-facing tables)

### Allowlist migration
- SchemaProvider **replaces** the frozen Set instances in `allowlist.ts` as the single runtime validation source
- Compile-time union types (`FilterField`, `AxisField`) **stay** in `types.ts` for compile-time safety — belt-and-suspenders
- Allowlist validation functions (`isValidFilterField`, `validateAxisField`, etc.) **delegate to SchemaProvider** instead of frozen sets
- Worker side gets a **raw `Set<string>`** of valid column names from PRAGMA — lightweight, no full SchemaProvider class in Worker context

### Validation strictness
- Column names failing `[a-zA-Z0-9_]` regex: **skip + console.warn** — one bad column doesn't prevent startup
- SQLite system columns (`rowid`, `_rowid_`, `oid`, underscore-prefixed): **excluded** from exposed schema
- `deleted_at`: **excluded** — internal plumbing, always in WHERE clause implicitly
- `id` (UUID primary key): **excluded** — FK plumbing, never user-facing for filter/sort/group

### Ready message shape
- Worker runs PRAGMA on both tables, **pre-classifies** into ColumnInfo objects with LATCH family — main thread trusts Worker classification
- **Extend WorkerReadyMessage**: `{ type: 'ready', timestamp, schema: { cards: ColumnInfo[], connections: ColumnInfo[] } }`
- WorkerBridge receives ready message, extracts schema, **passes to SchemaProvider.initialize(columns)** — SchemaProvider is single owner, WorkerBridge doesn't store it

### Claude's Discretion
- ColumnInfo interface shape (exact fields beyond name/type/nullability/latchFamily)
- SchemaProvider subscribe/notify implementation details (follows existing queueMicrotask pattern)
- How allowlist.ts validation functions are re-routed (import path changes)
- Worker-side raw Set<string> implementation details
- Test structure and fixture design

</decisions>

<specifics>
## Specific Ideas

- SchemaProvider should feel like other providers — subscribe/notify pattern, registered with StateCoordinator
- The PRAGMA-to-ColumnInfo classification should be a pure function (testable in isolation, called from Worker context)
- Ready message schema payload must be structuredClone-safe (no class instances, just plain objects)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `allowlist.ts`: Existing validation functions (`isValidFilterField`, `validateAxisField`, `validateFilterField`) — will be re-routed to delegate to SchemaProvider
- `types.ts`: `FilterField`, `AxisField` union types — remain for compile-time safety
- Provider pattern: `subscribe(cb) → () => void` + `queueMicrotask` batching (FilterProvider, PAFVProvider, etc.)
- `StateCoordinator`: Cross-provider batching — SchemaProvider will be registered here

### Established Patterns
- Dual validation: compile-time union types + runtime Set-based validation — SchemaProvider replaces the runtime half
- Worker init flow: `initialize()` → `Database.init()` → `postMessage(readyMessage)` → `processPendingQueue()`
- `WorkerReadyMessage`: `{ type: 'ready', timestamp }` — will be extended with `schema` field
- `PersistableProvider` / `SubscribableProvider` interfaces — SchemaProvider is NOT persistable (derived from PRAGMA, not user state)

### Integration Points
- `worker.ts` `initialize()`: PRAGMA introspection + classification happens here, results included in ready message
- `WorkerBridge.ts`: Receives extended ready message, extracts schema, passes to SchemaProvider
- `allowlist.ts`: Validation functions re-routed to SchemaProvider.isValid*() methods
- `StateManager.restore()`: Must run AFTER SchemaProvider is populated (schema arrives in ready message, before restore)
- `main.ts`: SchemaProvider instantiation + StateCoordinator registration

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 70-schemaprovider-core-worker-integration*
*Context gathered: 2026-03-11*
