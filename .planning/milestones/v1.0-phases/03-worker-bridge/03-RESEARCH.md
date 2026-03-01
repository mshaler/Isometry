# Phase 3: Worker Bridge - Research

**Researched:** 2026-02-28
**Domain:** Web Worker typed RPC protocol, sql.js WASM initialization, message correlation
**Confidence:** HIGH

## Summary

Phase 3's Worker Bridge is already substantially implemented and tested. The existing codebase has 111 passing unit tests across protocol types, WorkerBridge client, worker router, and handler modules. There are 26 skipped integration tests in `integration.test.ts` that use placeholder types and commented-out imports — these need to be connected to the real implementation and enabled.

The implementation deviates from the original canonical spec (`v5/Modules/Core/WorkerBridge.md`) in intentional, positive ways: domain-typed request types (`card:create`, `search:cards`) instead of generic SQL passthrough (`db:query`), UUID correlation IDs instead of incrementing counters, and structured error codes instead of string error messages. These are improvements over the spec, not gaps.

**Primary recommendation:** This is a verification + gap-closure phase. Enable the 26 skipped integration tests by connecting them to the real WorkerBridge, verify all WKBR requirements have coverage, and add `@vitest/web-worker` for real Worker tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Run all existing worker tests (111 pass, 26 skipped as of 2026-02-28)
- Map each BRIDGE requirement to specific code and test coverage
- Identify any gaps between the spec (WorkerBridge.md) and implementation
- Mark BRIDGE-01..07 as complete in REQUIREMENTS.md once verified
- Address any skipped integration tests that should pass
- Existing implementation is locked — already shipped:
  - Protocol types in `src/worker/protocol.ts`
  - WorkerBridge client in `src/worker/WorkerBridge.ts`
  - Worker entry in `src/worker/worker.ts`
  - Handlers: cards, connections, search, graph, export, ui-state
  - Phase 4 extensions: ui:get/set/delete/getAll and db:exec

### Claude's Discretion
- Whether to add Transferable object support for db:export (spec mentions it, code doesn't implement it)
- Whether skipped integration tests need to be unskipped or are acceptable as-is
- Whether any additional edge-case tests are needed for queue replay behavior
- Level of coverage verification detail in the plan

### Deferred Ideas (OUT OF SCOPE)
- Per-operation-type timeout tuning (different timeouts for graph algos vs card:get)
- Queue size limits and backpressure
- Worker health checks / heartbeat monitoring
- Transferable object support for large payloads
</user_constraints>

<phase_requirements>
## Phase Requirements

Note: ROADMAP uses `BRIDGE-01..07` but REQUIREMENTS.md uses `WKBR-01..07`. They are the same requirements. The canonical IDs from REQUIREMENTS.md are WKBR-01 through WKBR-07.

| ID | Description | Research Support | Implementation Status |
|----|-------------|------------------|-----------------------|
| WKBR-01 | WorkerBridge sends typed WorkerMessage with UUID correlation ID | `WorkerBridge.send()` uses `crypto.randomUUID()` for correlation IDs, typed `WorkerRequest<T>` envelope | IMPLEMENTED — tested in WorkerBridge.test.ts |
| WKBR-02 | Worker responds with WorkerResponse matching request correlation ID | `handleResponse()` matches `response.id` to `pending` map, resolves/rejects the originating promise | IMPLEMENTED — tested in WorkerBridge.test.ts |
| WKBR-03 | Worker errors propagate to main thread with error code and message | `createWorkerError()` classifies errors, `WorkerError` has `code` + `message` + optional `stack` | IMPLEMENTED — tested in worker.test.ts and WorkerBridge.test.ts |
| WKBR-04 | All database operations execute in Web Worker (main thread never blocked) | All bridge methods call `this.send()` which posts to Worker; `worker.ts` runs Database operations in Worker global scope | IMPLEMENTED — architecture verified, needs integration test |
| WKBR-05 | MutationManager generates inverse SQL for every mutation (undo support) | MutationManager already shipped in Phase 4 with `db:exec` handler | IMPLEMENTED in Phase 4 |
| WKBR-06 | MutationManager sets dirty flag on write and notifies subscribers | MutationManager already shipped in Phase 4 | IMPLEMENTED in Phase 4 |
| WKBR-07 | User can undo/redo mutations via command log (Cmd+Z / Cmd+Shift+Z) | MutationManager already shipped in Phase 4 with keyboard shortcuts | IMPLEMENTED in Phase 4 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | 1.14 | SQLite in WASM — system of record | Already installed, custom FTS5 build |
| Vitest | 4.0 | Test framework | Already installed, project standard |
| @vitest/web-worker | 4.0.18 | Real Worker environment in tests | STATE.md specifies this exact version |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.9 | Type safety | Already installed |

### Alternatives Considered
None — stack is locked. No new production dependencies needed.

**Installation:**
```bash
npm install -D @vitest/web-worker@4.0.18
```

**tsconfig.json update:**
Add `"WebWorker"` to `lib` array (per STATE.md).

## Architecture Patterns

### Existing Project Structure (locked)
```
src/worker/
├── protocol.ts          # Type system: envelopes, payloads, responses, error codes
├── WorkerBridge.ts      # Main-thread client: isReady, send(), correlation, timeout, singleton
├── worker.ts            # Worker entry: self-init, queue, router, error classification
├── handlers/
│   ├── cards.handler.ts
│   ├── connections.handler.ts
│   ├── search.handler.ts
│   ├── graph.handler.ts
│   ├── export.handler.ts
│   ├── ui-state.handler.ts
│   └── index.ts
└── index.ts             # Barrel exports

tests/worker/
├── protocol.test.ts      # Type guard and protocol shape tests
├── WorkerBridge.test.ts  # Client tests with mock worker
├── worker.test.ts        # Router + handler unit tests
├── ui-state.handler.test.ts  # Phase 4 handler tests
├── integration.test.ts   # 26 skipped integration tests
└── fixtures.ts           # Shared test utilities
```

### Pattern 1: Await-Before-Send
**What:** Every public bridge method awaits `this.isReady` before posting messages
**When:** Every bridge operation — prevents race conditions (Pitfall P11)
**Code:**
```typescript
async send<T extends WorkerRequestType>(type: T, payload: WorkerPayloads[T]): Promise<WorkerResponses[T]> {
  await this.isReady; // Blocks until worker signals ready
  return new Promise<WorkerResponses[T]>((resolve, reject) => {
    const id = crypto.randomUUID();
    // ... timeout setup, pending tracking, postMessage
  });
}
```

### Pattern 2: FIFO Message Queue During Init
**What:** Worker queues messages received before initialization completes, replays in order after ready
**When:** Worker startup — prevents dropped messages during WASM load
**Code:**
```typescript
// worker.ts
self.onmessage = async (event) => {
  if (!isInitialized) {
    pendingQueue.push(request);
    return;
  }
  await handleRequest(request);
};
```

### Pattern 3: Exhaustive Switch Router
**What:** TypeScript `never` check in default case ensures all request types are handled
**When:** Worker routing — compile-time safety against missing handlers
**Code:**
```typescript
default: {
  const _exhaustive: never = type;
  throw new Error(`Unknown request type: ${_exhaustive}`);
}
```

### Anti-Patterns to Avoid
- **Raw SQL across the bridge:** Implementation correctly uses typed domain actions, not generic SQL passthrough (unlike the original spec which exposed `db:query`)
- **Incrementing message IDs:** Implementation correctly uses `crypto.randomUUID()`, not incrementing counters (avoids collision in concurrent scenarios)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker test environment | Custom mock workers | `@vitest/web-worker` | Simulates real Worker API in Node/Vitest |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Already used in implementation, RFC 4122 compliant |
| Error classification | Regex-heavy error parser | Existing `classifyError()` | Already handles CONSTRAINT_VIOLATION, NOT_FOUND, NOT_INITIALIZED, TIMEOUT |

## Common Pitfalls

### Pitfall 1: Worker Init Race (P11 from project pitfalls)
**What goes wrong:** Messages sent before WASM loads are silently dropped
**Why it happens:** Worker needs to download + compile WASM before processing requests
**How to avoid:** Queue + replay pattern (already implemented in worker.ts)
**Status:** MITIGATED — pendingQueue + processPendingQueue() in worker.ts, isReady await in WorkerBridge.ts

### Pitfall 2: FTS+SQL Combine Bug (P21 from project pitfalls)
**What goes wrong:** id vs rowid type mismatch in FTS JOIN queries
**Why it happens:** FTS5 content tables use rowid, not text id column
**How to avoid:** Always JOIN on rowid, never on id
**Status:** Should be verified in integration tests — search handler uses `search.searchCards()` which was tested in Phase 2

### Pitfall 3: Pending Promise Unbounded Growth (P12 from project pitfalls)
**What goes wrong:** If worker never responds, pending map grows forever, promises never resolve
**Why it happens:** Worker crash or hang without error event
**How to avoid:** Configurable timeout on every request
**Status:** MITIGATED — `setTimeout` in `send()` rejects after `config.timeout` (default 30s), tested in WorkerBridge.test.ts

### Pitfall 4: Late Response After Timeout
**What goes wrong:** Response arrives after timeout, resolves wrong promise or causes error
**Why it happens:** Worker was slow but not dead; response arrives after pending was cleaned up
**How to avoid:** Delete from pending map on timeout; ignore responses for unknown IDs
**Status:** MITIGATED — tested: "should not reject late responses after timeout" passes

### Pitfall 5: @vitest/web-worker Version Mismatch
**What goes wrong:** `@vitest/web-worker` must match installed Vitest version exactly
**Why it happens:** Internal API dependency between Vitest and its web-worker plugin
**How to avoid:** Install `@vitest/web-worker@4.0.18` to match Vitest 4.0
**Status:** TO DO — STATE.md documents this requirement

## Code Examples

### Integration Test Pattern (connecting skipped tests)
```typescript
// Replace placeholder types with real import
import { createWorkerBridge, WorkerBridge } from '../../src/worker/WorkerBridge';

describe('WorkerBridge Integration', () => {
  let bridge: WorkerBridge;

  beforeAll(async () => {
    bridge = createWorkerBridge();
    await bridge.isReady;
  });

  afterAll(() => {
    bridge.terminate();
  });

  it('should create a card via worker round-trip', async () => {
    const card = await bridge.createCard({ name: 'Test Card' });
    expect(card).toHaveProperty('id');
    expect(card.name).toBe('Test Card');
  });
});
```

### Vitest Web Worker Config
```typescript
// vitest.config.ts — add web worker plugin
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ... existing config
  },
  plugins: [
    // @vitest/web-worker provides Worker simulation
  ],
});
```

## State of the Art

| Old Approach (spec) | Current Approach (implementation) | When Changed | Impact |
|---------------------|-----------------------------------|--------------|--------|
| Generic `db:query` SQL passthrough | Domain-typed `card:create`, `search:cards` | Phase 2-3 | Type safety, no raw SQL across bridge |
| `status: 'success' \| 'error'` | `success: boolean` + typed `WorkerError` | Phase 3 | Machine-readable error codes |
| Incrementing `messageId` | `crypto.randomUUID()` | Phase 3 | Collision-proof correlation |
| No init queueing | FIFO queue + replay | Phase 3 | Zero dropped messages during WASM load |
| `app_state` table | `ui_state` table | Phase 4 | Different column structure, same purpose |

## Gap Analysis

### Gaps Found

1. **Integration tests disabled (26 tests):** `integration.test.ts` uses `describe.skip` and placeholder type aliases. The real `WorkerBridge` class is implemented but the integration file never imports it. These tests need to be connected to the real implementation.

2. **`@vitest/web-worker` not installed:** STATE.md says to add it, but it hasn't been installed yet. Required for tests that actually create real Worker instances.

3. **tsconfig `WebWorker` lib not added:** STATE.md says to add `"WebWorker"` to tsconfig `lib` array. Needs verification.

4. **Requirement ID discrepancy:** ROADMAP says `BRIDGE-01..07`, REQUIREMENTS.md says `WKBR-01..07`. Plans should use WKBR IDs (canonical from REQUIREMENTS.md).

5. **REQUIREMENTS.md doesn't exist at expected path:** Init tried `.planning/REQUIREMENTS.md` but the actual file is `.planning/REQUIREMENTS-v5-CORRECTED.md`. This is a cosmetic issue, not blocking.

### No Gaps (Already Covered)

- Protocol types: Complete with exhaustive type union
- WorkerBridge client: isReady, correlation IDs, timeout, singleton, factory
- Worker entry: Self-init, queue, exhaustive router, error classification
- All handlers: cards, connections, search, graph, export, ui-state, db:exec
- Error propagation: Structured codes (CONSTRAINT_VIOLATION, NOT_FOUND, NOT_INITIALIZED, TIMEOUT, UNKNOWN, INVALID_REQUEST)
- Phase 4 extensions: ui:get/set/delete/getAll and db:exec already wired

## Open Questions

1. **@vitest/web-worker compatibility with sql.js WASM**
   - What we know: @vitest/web-worker simulates the Worker API in Vitest
   - What's unclear: Whether WASM initialization works inside the simulated Worker environment
   - Recommendation: Try it; if WASM init fails in simulated Worker, integration tests may need to remain as mock-based tests with a `TODO` for browser-based E2E testing

2. **Transferable objects for db:export**
   - What we know: Spec mentions Transferable for ArrayBuffer transfer; code uses structuredClone
   - What's unclear: Performance impact at current data sizes
   - Recommendation: DEFERRED per user decision — not needed at current scale

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/worker/` — direct code analysis
- Existing tests: `tests/worker/` — 111 passing, 26 skipped
- `v5/Modules/Core/WorkerBridge.md` — canonical spec
- `CLAUDE-v5.md` — architectural decisions D-001..D-010
- `.planning/STATE.md` — Phase 3 entry state

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS-v5-CORRECTED.md` — WKBR-01..07 requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already known, version-locked
- Architecture: HIGH - Implementation already exists and is tested
- Pitfalls: HIGH - All known pitfalls from project documentation are mitigated or have clear remediation path

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable — no external dependencies changing)
