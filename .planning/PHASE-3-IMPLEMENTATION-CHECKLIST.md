# Phase 3 Implementation Checklist: Worker Bridge

**Milestone:** Web Runtime v1  
**Phase:** 3 (Worker Bridge)  
**Status:** Not started  
**Goal:** Move all database/query execution off main thread behind a typed WorkerBridge with correlation IDs, structured error propagation, and measurable payload discipline.

---

## 0. Preconditions

- [ ] Confirm v0.1 baseline is green:
  - `npm run typecheck`
  - `npm test`
- [ ] Confirm this phase stays scoped to WKBR-01..04 (+ bootstrap fixes needed to make Phase 3 safe).

**Gate 0 (must pass before Task 1):**
- `npm run typecheck` exits 0
- `npm test` exits 0

---

## 1. Runtime Bootstrap Hardening (Blocker Fixes)

### Task 1.1: Remove browser-unsafe `process.env` access in runtime path
- [ ] Refactor `Database.initialize()` env/path resolution to be browser-safe.
- [ ] Keep test-path override support for WASM location.
- [ ] Keep production schema loading behavior working.

**Test gate:**
- [ ] Add/adjust tests that validate browser-like initialization path (no `process` global dependency).
- [ ] Existing DB initialization tests continue passing.

### Task 1.2: Harden `shortestPath` cycle prevention
- [ ] Update path encoding/matching to correctly prevent revisits including source-at-start edge case.
- [ ] Keep current behavior contract (`[]` for same source/target, `null` when no path).

**Test gate:**
- [ ] Add cycle-heavy graph tests proving no duplicate revisit inflation.
- [ ] Existing graph tests remain green.

---

## 2. Phase 3 Project Bootstrap

### Task 2.1: Add phase dependencies and typing support
- [ ] Add runtime/test deps needed for WorkerBridge implementation and worker tests.
- [ ] Update TS config for worker typing support if required.

**Test gate:**
- [ ] `npm install` cleanly resolves lockfile.
- [ ] `npm run typecheck` passes with worker files included.

### Task 2.2: Create WorkerBridge scaffolding files
- [ ] Add `src/worker/worker.ts` worker entry.
- [ ] Add `src/worker/types.ts` with request/response message envelope and discriminated unions.
- [ ] Add `src/worker/handlers/` modules for DB/query dispatch.
- [ ] Add main-thread `src/worker/WorkerBridge.ts`.

**Test gate:**
- [ ] Worker files compile in strict mode.
- [ ] Imports/exports are stable from public surface as needed.

---

## 3. Core WorkerBridge Protocol (WKBR-01, WKBR-02)

### Task 3.1: Implement typed request/response envelope
- [ ] Request includes correlation ID, message type, payload, timestamp.
- [ ] Response mirrors request ID and includes success/error status + payload/error body.

### Task 3.2: Implement pending request correlation map
- [ ] Main thread stores pending promises by request ID.
- [ ] Response resolves/rejects exactly one pending request.
- [ ] Unknown/missing IDs are handled defensively.

**Test gate:**
- [ ] Unit tests for single request/response happy path.
- [ ] Unit tests for concurrent in-flight requests with out-of-order responses.
- [ ] Unit tests for unknown response ID handling.

---

## 4. Error Propagation (WKBR-03)

### Task 4.1: Standardize worker error envelope
- [ ] Define structured error shape (`code`, `message`, optional `details`).
- [ ] Ensure handler exceptions are wrapped into worker error responses.

### Task 4.2: Ensure main thread receives typed errors
- [ ] Reject pending request with structured error context.
- [ ] Handle worker crash/event errors by rejecting all pending requests.

**Test gate:**
- [ ] Unit tests for SQL handler throw -> structured error response -> main-thread rejection.
- [ ] Unit tests for worker crash/onerror rejection fan-out.

---

## 5. Query/Mutation Routing Through Worker (WKBR-04)

### Task 5.1: Route existing DB operations through worker handlers
- [ ] Implement worker handlers for required query families used by current APIs.
- [ ] Ensure no main-thread sql.js execution remains in runtime path.

### Task 5.2: Preserve current module behavior via bridge-backed APIs
- [ ] Maintain compatibility for card/connection/search/graph operations.
- [ ] Ensure parameterization and soft-delete semantics remain unchanged.

**Test gate:**
- [ ] Integration tests: CRUD/search/graph via WorkerBridge produce expected outputs.
- [ ] Regression test confirms no direct main-thread sql.js calls in runtime execution path.

---

## 6. Serialization and Payload Discipline

### Task 6.1: Enforce projection-first query payloads
- [ ] Avoid `SELECT *` in bridge-driven view/query pathways where not needed.
- [ ] Define minimal fields returned for each operation.

### Task 6.2: Add measurement hooks
- [ ] Capture and expose request duration and payload-size metrics (dev/test visibility).

**Test gate:**
- [ ] Tests/assertions verifying projected field sets for selected operations.
- [ ] Basic profiling log/assertion for request timing and payload size availability.

---

## 7. Phase 3 Final Verification

- [ ] Full test suite green.
- [ ] Typecheck green.
- [ ] WorkerBridge-specific tests green.
- [ ] Documentation updated (`ROADMAP`, requirements traceability, phase summary/verif docs).

**Final gate (phase complete):**
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] WKBR-01..04 marked complete with evidence links in phase verification artifact
- [ ] No known P1 defects open for WorkerBridge path

---

## Deliverables Checklist

- [ ] `src/worker/worker.ts`
- [ ] `src/worker/types.ts`
- [ ] `src/worker/handlers/*`
- [ ] `src/worker/WorkerBridge.ts`
- [ ] WorkerBridge unit/integration tests
- [ ] Updated docs in `.planning/` for traceability and verification

