# Phase 3: Worker Bridge

**Status:** Complete  
**Completed:** 2026-02-28  
**Depends on:** Phase 2 (v0.1 Data Foundation) — SHIPPED 2026-02-28  
**Blocks:** Phase 4 (Providers + MutationManager)

---

## Goal

All database operations execute in a Web Worker via a typed async protocol. The main thread is never blocked by SQL. All initialization race conditions and silent hangs are prevented.

---

## Requirements Addressed

| Requirement | Description |
|-------------|-------------|
| WKBR-01 | WorkerBridge sends typed WorkerMessage with UUID correlation ID |
| WKBR-02 | Worker responds with WorkerResponse matching request correlation ID |
| WKBR-03 | Worker errors propagate to main thread with error code and message |
| WKBR-04 | All database operations execute in Web Worker (main thread never blocked) |

---

## Success Criteria

From `ROADMAP.md` — all must be TRUE before Phase 3 is complete:

1. **Worker initializes sql.js WASM, applies schema, and messages sent before initialization completes are queued and replayed** — no messages are dropped
2. **WorkerBridge sends typed messages with UUID correlation IDs and receives responses matched to the originating promise** — concurrent requests resolve independently
3. **Every pending promise times out and rejects after a configurable duration** — silent Worker errors never hang the main thread indefinitely
4. **Message router dispatches correctly to query, mutate, graph, fts, and export handlers using existing v0.1 query modules without modification**
5. **`isReady` promise resolves before any public bridge method executes** — callers cannot race against initialization

---

## Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Main Thread (UI)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    WorkerBridge                           │   │
│  │  • Singleton (or createWorkerBridge factory)             │   │
│  │  • isReady: Promise<void>                                │   │
│  │  • Public methods: cards.*, connections.*, search.*, ... │   │
│  │  • Correlation map: Map<string, PendingRequest>          │   │
│  │  • Timeout enforcement (configurable, default 30s)       │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ postMessage (WorkerRequest)         │
│                           ▼                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │ structuredClone boundary
┌───────────────────────────┼─────────────────────────────────────┐
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Worker Entry (worker.ts)                 │   │
│  │  • Self-initializes Database on load                     │   │
│  │  • Queues messages until initialization complete         │   │
│  │  • Routes by message.type to handler modules             │   │
│  │  • Posts WorkerResponse with correlation id              │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │              Handler Modules (thin wrappers)              │   │
│  │  cards.handler.ts   → cards.ts (v0.1)                    │   │
│  │  connections.handler.ts → connections.ts (v0.1)          │   │
│  │  search.handler.ts  → search.ts (v0.1)                   │   │
│  │  graph.handler.ts   → graph.ts (v0.1)                    │   │
│  │  export.handler.ts  → db.export()                        │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │                    Database (v0.1)                        │   │
│  │  • sql.js WASM (FTS5 build)                              │   │
│  │  • Schema applied once on initialize()                   │   │
│  │  • exec() / run() methods                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                        Web Worker                               │
└─────────────────────────────────────────────────────────────────┘
```

### Message Protocol

```typescript
// src/worker/protocol.ts

/**
 * All possible request types. Each maps to a handler function signature.
 * This union becomes the exhaustive switch in the worker router.
 */
export type WorkerRequestType =
  // Cards (CARD-01..06)
  | 'card:create'
  | 'card:get'
  | 'card:update'
  | 'card:delete'
  | 'card:undelete'
  | 'card:list'
  // Connections (CONN-01..04)
  | 'connection:create'
  | 'connection:get'
  | 'connection:delete'
  // Search (SRCH-01..04)
  | 'search:cards'
  // Graph (PERF-04)
  | 'graph:connected'
  | 'graph:shortestPath'
  // Export (for native shell persistence)
  | 'db:export';

/**
 * Request envelope sent from main thread to worker.
 * Type parameter T enforces payload shape per request type.
 */
export interface WorkerRequest<T extends WorkerRequestType = WorkerRequestType> {
  /** UUID correlation ID — used to match response to originating promise */
  id: string;
  /** Request type — determines which handler processes the message */
  type: T;
  /** Payload shape depends on type — see WorkerPayloads */
  payload: WorkerPayloads[T];
}

/**
 * Response envelope sent from worker to main thread.
 */
export interface WorkerResponse<T = unknown> {
  /** Matches the request.id that triggered this response */
  id: string;
  /** True if handler completed without throwing */
  success: boolean;
  /** Result data (only present if success === true) */
  data?: T;
  /** Error info (only present if success === false) */
  error?: WorkerError;
}

/**
 * Structured error for WKBR-03 compliance.
 */
export interface WorkerError {
  /** Error classification code */
  code: WorkerErrorCode;
  /** Human-readable message (from Error.message or custom) */
  message: string;
  /** Optional: original stack trace (dev mode only) */
  stack?: string;
}

export type WorkerErrorCode =
  | 'UNKNOWN'
  | 'NOT_INITIALIZED'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'CONSTRAINT_VIOLATION'
  | 'TIMEOUT';

/**
 * Payload type map — keys are WorkerRequestType, values are payload shapes.
 * Import types from v0.1 query modules (no duplication).
 */
import type { CardInput, CardListOptions, Card } from '../database/queries/types';
import type { ConnectionInput, ConnectionDirection, Connection } from '../database/queries/types';
import type { SearchResult, CardWithDepth } from '../database/queries/types';

export interface WorkerPayloads {
  // Cards
  'card:create': { input: CardInput };
  'card:get': { id: string };
  'card:update': { id: string; updates: Partial<Omit<CardInput, 'card_type'>> };
  'card:delete': { id: string };
  'card:undelete': { id: string };
  'card:list': { options?: CardListOptions };
  // Connections
  'connection:create': { input: ConnectionInput };
  'connection:get': { cardId: string; direction?: ConnectionDirection };
  'connection:delete': { id: string };
  // Search
  'search:cards': { query: string; limit?: number };
  // Graph
  'graph:connected': { startId: string; maxDepth?: number };
  'graph:shortestPath': { fromId: string; toId: string };
  // Export
  'db:export': Record<string, never>; // empty payload
}

/**
 * Response type map — keys are WorkerRequestType, values are response data shapes.
 */
export interface WorkerResponses {
  'card:create': Card;
  'card:get': Card | null;
  'card:update': void;
  'card:delete': void;
  'card:undelete': void;
  'card:list': Card[];
  'connection:create': Connection;
  'connection:get': Connection[];
  'connection:delete': void;
  'search:cards': SearchResult[];
  'graph:connected': CardWithDepth[];
  'graph:shortestPath': string[] | null;
  'db:export': Uint8Array;
}
```

---

## File Structure

```
src/
├── worker/
│   ├── protocol.ts          # Type definitions (WorkerRequest, WorkerResponse, etc.)
│   ├── worker.ts             # Worker entry point (self-initializing, message router)
│   ├── handlers/
│   │   ├── cards.handler.ts      # Thin wrapper → cards.ts
│   │   ├── connections.handler.ts
│   │   ├── search.handler.ts
│   │   ├── graph.handler.ts
│   │   └── export.handler.ts
│   └── WorkerBridge.ts       # Main-thread client (singleton or factory)
├── database/
│   ├── Database.ts           # (v0.1 — unchanged)
│   ├── schema.sql            # (v0.1 — unchanged)
│   └── queries/
│       ├── cards.ts          # (v0.1 — unchanged)
│       ├── connections.ts    # (v0.1 — unchanged)
│       ├── search.ts         # (v0.1 — unchanged)
│       ├── graph.ts          # (v0.1 — unchanged)
│       ├── helpers.ts        # (v0.1 — unchanged)
│       └── types.ts          # (v0.1 — unchanged)
└── index.ts                  # Re-exports WorkerBridge (not Database)
```

---

## Implementation Plans

### Plan 3-01: Protocol Types

**Delivers:** `src/worker/protocol.ts`

**Contract:**
- Define `WorkerRequest<T>`, `WorkerResponse<T>`, `WorkerError`, `WorkerErrorCode`
- Define `WorkerPayloads` and `WorkerResponses` type maps
- Import types from v0.1 `queries/types.ts` — no duplication
- Export all types for use by worker.ts and WorkerBridge.ts

**Acceptance:**
- [ ] TypeScript compiles with no errors
- [ ] All 13 request types defined in `WorkerRequestType` union
- [ ] Payload shapes reference existing types (CardInput, etc.) not inline definitions

---

### Plan 3-02: Worker Entry and Router

**Delivers:** `src/worker/worker.ts`

**Contract:**
- Self-initializes `Database` on script load (no external trigger needed)
- Queues incoming messages in a `pendingQueue: WorkerRequest[]` until `isInitialized = true`
- After initialization, processes `pendingQueue` in FIFO order, then handles live messages
- Routes by `request.type` to handler functions (switch statement with exhaustive check)
- Wraps each handler call in try/catch; posts `WorkerResponse` with `success: false` on error
- Posts `WorkerResponse` with `success: true` and `data` on success

**Acceptance:**
- [ ] Worker initializes without external trigger
- [ ] Messages sent before init completes are queued (not dropped)
- [ ] Router switch is exhaustive (TypeScript `never` check on default)
- [ ] Errors are caught and returned as `WorkerError` objects

**Test:**
- `tests/worker/worker.test.ts` — unit test router dispatch and error handling

---

### Plan 3-03: Handler Modules

**Delivers:** `src/worker/handlers/*.handler.ts`

**Contract:**
- Each handler is a thin wrapper: receives payload, calls v0.1 query function, returns result
- Handlers receive the shared `Database` instance from worker.ts
- No business logic in handlers — that stays in v0.1 modules
- Export a single function per file matching the pattern:

```typescript
// cards.handler.ts
import { Database } from '../../database/Database';
import * as cards from '../../database/queries/cards';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

export function handleCardCreate(
  db: Database,
  payload: WorkerPayloads['card:create']
): WorkerResponses['card:create'] {
  return cards.createCard(db, payload.input);
}

export function handleCardGet(
  db: Database,
  payload: WorkerPayloads['card:get']
): WorkerResponses['card:get'] {
  return cards.getCard(db, payload.id);
}
// ... etc
```

**Acceptance:**
- [ ] All 13 request types have corresponding handler functions
- [ ] Handlers call v0.1 functions without modification
- [ ] Handler return types match `WorkerResponses[T]`

**Test:**
- `tests/worker/handlers/*.test.ts` — unit test each handler (mocking Database)

---

### Plan 3-04: WorkerBridge Client

**Delivers:** `src/worker/WorkerBridge.ts`

**Contract:**
- Creates and owns the Worker instance
- Exposes `isReady: Promise<void>` that resolves when worker posts 'ready' message
- All public methods await `isReady` before sending requests (WKBR-04 compliance)
- Generates UUID correlation IDs via `crypto.randomUUID()`
- Maintains `pendingRequests: Map<string, PendingRequest>` for correlation
- Enforces configurable timeout (default 30s) on each request — rejects with `TIMEOUT` error
- Provides typed public API:

```typescript
class WorkerBridge {
  readonly isReady: Promise<void>;

  // Cards
  createCard(input: CardInput): Promise<Card>;
  getCard(id: string): Promise<Card | null>;
  updateCard(id: string, updates: Partial<Omit<CardInput, 'card_type'>>): Promise<void>;
  deleteCard(id: string): Promise<void>;
  undeleteCard(id: string): Promise<void>;
  listCards(options?: CardListOptions): Promise<Card[]>;

  // Connections
  createConnection(input: ConnectionInput): Promise<Connection>;
  getConnections(cardId: string, direction?: ConnectionDirection): Promise<Connection[]>;
  deleteConnection(id: string): Promise<void>;

  // Search
  searchCards(query: string, limit?: number): Promise<SearchResult[]>;

  // Graph
  connectedCards(startId: string, maxDepth?: number): Promise<CardWithDepth[]>;
  shortestPath(fromId: string, toId: string): Promise<string[] | null>;

  // Export
  exportDatabase(): Promise<Uint8Array>;

  // Lifecycle
  terminate(): void;
}
```

**Acceptance:**
- [ ] `isReady` blocks all methods until worker signals ready
- [ ] Concurrent requests resolve independently (correlation IDs work)
- [ ] Timeout rejects with `WorkerError { code: 'TIMEOUT' }`
- [ ] `terminate()` calls `worker.terminate()` and cleans up pending requests

**Test:**
- `tests/worker/WorkerBridge.test.ts` — integration test with real worker

---

### Plan 3-05: Integration Tests

**Delivers:** `tests/worker/integration.test.ts`

**Contract:**
- Full round-trip tests: WorkerBridge → Worker → Database → Worker → WorkerBridge
- Tests run in Node via Vitest with web worker polyfill or Playwright
- Cover:
  - Card CRUD round-trip
  - Connection CRUD round-trip
  - Search returns ranked results
  - Graph traversal returns correct depths
  - Export returns valid SQLite bytes
  - Concurrent requests resolve correctly
  - Error propagation (e.g., FK violation)
  - Initialization queueing (send requests before ready)

**Acceptance:**
- [ ] All tests pass
- [ ] No flaky tests (deterministic initialization)
- [ ] Coverage: all 13 request types exercised

---

### Plan 3-06: Vite Worker Configuration

**Delivers:** Updates to `vite.config.ts`

**Contract:**
- Configure Vite to bundle `src/worker/worker.ts` as a Web Worker
- Ensure WASM loads correctly in worker context
- Worker is inlined or uses `?worker` import syntax

```typescript
// Usage in WorkerBridge.ts
import WorkerScript from './worker?worker';

const worker = new WorkerScript();
```

**Acceptance:**
- [ ] `npm run build` produces working worker bundle
- [ ] Worker loads WASM without CORS issues
- [ ] Dev server hot-reloads worker changes

---

### Plan 3-07: Remove Direct Database Access

**Delivers:** Updates to `src/index.ts` and documentation

**Contract:**
- `src/index.ts` exports `WorkerBridge` (not `Database`)
- Add JSDoc comment to `Database` class: `@internal — use WorkerBridge for all operations`
- Update `CLAUDE.md` or similar docs to reflect new API surface

**Acceptance:**
- [ ] No public export of `Database` class
- [ ] Consumers cannot accidentally bypass worker

---

## Technical Decisions

### Decision: Singleton vs Factory for WorkerBridge

**Options:**
1. **Singleton:** `WorkerBridge.shared` — simpler, matches Database pattern
2. **Factory:** `createWorkerBridge()` — allows multiple instances, easier testing

**Decision:** Factory function that returns a singleton by default, with option to create isolated instances for testing.

```typescript
let sharedBridge: WorkerBridge | null = null;

export function getWorkerBridge(): WorkerBridge {
  if (!sharedBridge) {
    sharedBridge = new WorkerBridge();
  }
  return sharedBridge;
}

export function createWorkerBridge(): WorkerBridge {
  return new WorkerBridge();
}
```

---

### Decision: Structured Clone Overhead

**Concern:** Large result sets (1000+ cards) may have serialization overhead.

**Mitigation:**
1. Enforce SQL projection discipline in Phase 4 (no `SELECT *` in view queries)
2. For now, accept overhead — optimize only if PERF benchmarks fail
3. Phase 7 Network view will batch position updates, not full card objects

**Monitor:** Add timing telemetry to WorkerBridge in dev mode.

---

### Decision: Worker Initialization Strategy

**Options:**
1. **Eager:** Worker initializes Database immediately on script load
2. **Lazy:** Worker waits for explicit 'init' message

**Decision:** Eager initialization. Rationale:
- Simpler protocol (no init message)
- Worker script load is already async (Vite handles this)
- `isReady` promise on WorkerBridge provides the gate for callers

---

### Decision: Timeout Behavior

**Default:** 30 seconds

**Rationale:**
- Long enough for WASM cold start + large operations
- Short enough to catch hung workers
- Configurable via `createWorkerBridge({ timeout: ms })`

**On timeout:**
- Promise rejects with `WorkerError { code: 'TIMEOUT' }`
- Request removed from `pendingRequests` map
- Worker is NOT terminated (may still complete)

---

## Test Strategy

### Unit Tests

| Test File | Covers |
|-----------|--------|
| `tests/worker/protocol.test.ts` | Type assertions, exhaustiveness checks |
| `tests/worker/handlers/*.test.ts` | Each handler in isolation (mock Database) |

### Integration Tests

| Test File | Covers |
|-----------|--------|
| `tests/worker/WorkerBridge.test.ts` | Full round-trip, correlation, timeout |
| `tests/worker/initialization.test.ts` | Message queueing before ready |
| `tests/worker/concurrent.test.ts` | Multiple in-flight requests |
| `tests/worker/errors.test.ts` | Error propagation, FK violations |

### Environment

- **Vitest:** Use `@vitest/web-worker` or `threads.js` polyfill for Node
- **Playwright (optional):** Browser integration tests if polyfill is insufficient

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| WASM fails to load in Worker context | Blocks Phase 3 | Low | Test early in Plan 3-06; Vite handles this well |
| Structured clone performance | Degrades UX | Medium | Projection discipline (Phase 4); monitor timing |
| Worker crashes silently | Hangs UI | Low | Timeout enforcement; error event handler |
| Vitest Worker polyfill gaps | Flaky tests | Medium | Use Playwright fallback for full integration |

---

## Definition of Done

Phase 3 is complete when:

1. [x] All Success Criteria (5/5) verified
2. [x] All Plans (7/7) implemented and merged
3. [x] All tests passing (`npm test` green) — 198 passing, 26 skipped (browser-only integration)
4. [x] TypeScript compiles (`npm run typecheck` green)
5. [x] No direct `Database` usage outside `src/worker/` — `src/index.ts` exports WorkerBridge as primary API
6. [x] Documentation updated — JSDoc on all public APIs
7. [x] `ROADMAP.md` Phase 3 status updated to "Complete"

---

## Appendix: v0.1 API Surface (Preserved)

These functions are wrapped by handlers but **not modified**:

```typescript
// cards.ts
createCard(db: Database, input: CardInput): Card
getCard(db: Database, id: string): Card | null
updateCard(db: Database, id: string, updates: Partial<...>): void
deleteCard(db: Database, id: string): void
undeleteCard(db: Database, id: string): void
listCards(db: Database, options?: CardListOptions): Card[]

// connections.ts
createConnection(db: Database, input: ConnectionInput): Connection
getConnections(db: Database, cardId: string, direction?: ConnectionDirection): Connection[]
deleteConnection(db: Database, id: string): void

// search.ts
searchCards(db: Database, query: string, limit?: number): SearchResult[]

// graph.ts
connectedCards(db: Database, startId: string, maxDepth?: number): CardWithDepth[]
shortestPath(db: Database, fromId: string, toId: string): string[] | null
```

---

*Phase 3 spec created: 2026-02-28*
*Author: Claude + Michael*
