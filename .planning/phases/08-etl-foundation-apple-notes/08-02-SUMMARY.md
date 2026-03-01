---
phase: 08-etl-foundation-apple-notes
plan: 02
subsystem: worker-protocol
tags: [etl, worker-bridge, protocol, rpc]
requirements: [ETL-03]
dependencies:
  requires: []
  provides: [etl-protocol-types, etl-bridge-methods]
  affects: [worker-protocol, worker-bridge]
tech_stack:
  added: []
  patterns: [extended-timeout-pattern]
key_files:
  created:
    - src/etl/types.ts
  modified:
    - src/worker/protocol.ts
    - src/worker/WorkerBridge.ts
    - tests/worker/protocol.test.ts
decisions:
  - id: D-ETL-01
    title: 300-second timeout for ETL operations
    rationale: Large imports (5000+ notes) require extended processing time beyond default 30s
    alternatives: [streaming-import, chunked-processing]
    tradeoffs: Simple but blocks worker for duration
  - id: D-ETL-02
    title: Created src/etl/types.ts as blocking dependency
    rationale: Plan 08-02 imports from etl/types but depends_on was empty - created minimal types to unblock
    alternatives: [skip-plan, wait-for-08-01]
    tradeoffs: Slight deviation from wave order but enables parallel execution
metrics:
  duration: 419
  tasks_completed: 3
  files_modified: 3
  files_created: 1
  commits: 3
  tests_added: 5
  lines_added: 235
completed_date: 2026-03-01
---

# Phase 8 Plan 2: Worker Protocol Extensions Summary

**One-liner:** Extended Worker protocol with ETL message types (`etl:import`, `etl:export`) and typed WorkerBridge methods with 300s timeout for large imports.

## What Was Built

Added ETL operations to the Worker Bridge RPC system:

1. **Protocol Extensions** (src/worker/protocol.ts)
   - Added `etl:import` and `etl:export` to WorkerRequestType union
   - Added WorkerPayloads for both operations (source/data/options, format/cardIds)
   - Added WorkerResponses (ImportResult, export data/filename)
   - Added ETL_TIMEOUT constant (300,000ms = 5 minutes)
   - Re-exported SourceType and ImportResult from etl/types

2. **WorkerBridge Methods** (src/worker/WorkerBridge.ts)
   - `importFile(source, data, options)` - Uses extended 300s timeout
   - `exportFile(format, cardIds?)` - Standard timeout
   - Both methods provide typed access to ETL RPC operations

3. **Protocol Tests** (tests/worker/protocol.test.ts)
   - Validates ETL_TIMEOUT equals 300000ms
   - Tests etl:import payload accepts all SourceType values
   - Tests etl:export payload with optional cardIds
   - Validates response shapes match ImportResult and export interfaces

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Created src/etl/types.ts**
- **Found during:** Task 1 execution start
- **Issue:** Plan 08-02 imports `SourceType` and `ImportResult` from `../etl/types` but that file doesn't exist. Plan 08-01 should create it, but `depends_on: []` was empty so executor started without it.
- **Fix:** Created minimal `src/etl/types.ts` with SourceType union and ImportResult interface to unblock execution
- **Files created:** src/etl/types.ts (48 lines)
- **Commit:** 4909177 (combined with Task 1)
- **Rationale:** Rule 3 (auto-fix blocking issues) - missing dependency prevents completing task. Wave 1 plans should be parallelizable, so creating the dependency allows both plans to execute concurrently.

**2. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes errors in WorkerBridge**
- **Found during:** Task 2 TypeScript verification
- **Issue:** TypeScript complained about assigning `{ options: Options | undefined }` to `{ options?: Options }` due to `exactOptionalPropertyTypes: true` in tsconfig
- **Fix:** Build payload conditionally - only set optional fields if value is defined
- **Files modified:** src/worker/WorkerBridge.ts
- **Commit:** f32eccf (part of Task 2)
- **Pattern:**
  ```typescript
  const payload: WorkerPayloads['etl:import'] = { source, data };
  if (options !== undefined) payload.options = options;
  ```

## Implementation Notes

### ETL Timeout Pattern

The extended timeout is applied per-request via config mutation:

```typescript
async importFile(...) {
  const originalTimeout = this.config.timeout;
  this.config.timeout = ETL_TIMEOUT;
  try {
    return await this.send('etl:import', { source, data, options });
  } finally {
    this.config.timeout = originalTimeout;  // Always restore
  }
}
```

This ensures only `etl:import` gets the extended timeout while other operations continue using default 30s.

### Exhaustive Switch Handling

The worker.ts already contains stub handlers for `etl:import` and `etl:export` that throw "not yet implemented" errors. This satisfies TypeScript's exhaustive switch check while clearly documenting they're not functional until Plan 08-05.

### Type Re-exports

The protocol.ts re-exports `SourceType` and `ImportResult` so consumers only need to import from `worker/protocol` rather than reaching into the etl module:

```typescript
import type { SourceType, ImportResult } from './protocol';
```

This maintains the protocol module as the single source of truth for Worker RPC types.

## Verification Results

All success criteria met:

- ✅ WorkerRequestType includes 'etl:import' and 'etl:export'
- ✅ WorkerPayloads['etl:import'] has source, data, options fields
- ✅ WorkerPayloads['etl:export'] has format, cardIds fields
- ✅ WorkerResponses match ImportResult and export shapes
- ✅ WorkerBridge.importFile() uses 300s timeout
- ✅ WorkerBridge.exportFile() method exists
- ✅ Protocol tests pass (32 tests, 5 new ETL tests)
- ✅ TypeScript compiles (stub handlers satisfy exhaustive check)

Test results:
```
Test Files  1 passed (1)
Tests       32 passed (32)
Duration    5ms
```

## Task Completion

| Task | Name | Status | Commit | Files Modified |
|------|------|--------|--------|----------------|
| 1 | Add ETL types to Worker protocol | ✅ Complete | 4909177 | src/worker/protocol.ts, src/etl/types.ts |
| 2 | Add importFile() and exportFile() methods to WorkerBridge | ✅ Complete | f32eccf | src/worker/WorkerBridge.ts |
| 3 | Add protocol extension tests | ✅ Complete | 7e48ad4 | tests/worker/protocol.test.ts |

## Integration Points

### Upstream Dependencies
- **src/etl/types.ts** - Created as blocking dependency (should be from 08-01)
- **src/worker/protocol.ts** - Extended with ETL types
- **src/worker/WorkerBridge.ts** - Added ETL methods

### Downstream Consumers
- **Plan 08-05** - Will implement worker handlers for `etl:import` and `etl:export`
- **Future UI** - Can use `bridge.importFile()` and `bridge.exportFile()` for ETL operations

### Type Flow
```
etl/types.ts (SourceType, ImportResult)
  → worker/protocol.ts (re-export + payload/response types)
  → worker/WorkerBridge.ts (typed methods)
  → UI components (import/export actions)
```

## Known Limitations

1. **Worker handlers not implemented** - Cases exist in worker.ts but throw "not yet implemented" until Plan 08-05
2. **No streaming support** - 300s timeout blocks worker for entire import duration
3. **No progress feedback** - RPC returns only final ImportResult, no intermediate progress

These are expected - this plan only extends the protocol layer. Full ETL pipeline comes in Plans 08-03, 08-04, 08-05.

## Self-Check: PASSED

Verified all created files exist:
```bash
✅ src/etl/types.ts (48 lines)
✅ src/worker/protocol.ts (modified)
✅ src/worker/WorkerBridge.ts (modified)
✅ tests/worker/protocol.test.ts (modified)
```

Verified all commits exist:
```bash
✅ 4909177 - feat(08-02): add ETL types to Worker protocol
✅ f32eccf - feat(08-02): add importFile() and exportFile() methods to WorkerBridge
✅ 7e48ad4 - test(08-02): add protocol extension tests
```

All must-haves satisfied:
- ✅ WorkerRequestType union includes 'etl:import' and 'etl:export'
- ✅ WorkerBridge.importFile() method exists with proper typing
- ✅ WorkerBridge.exportFile() method exists with proper typing
- ✅ etl:import uses 300-second timeout (not default 30s)
- ✅ src/worker/protocol.ts provides ETL protocol extensions
- ✅ src/worker/WorkerBridge.ts exports importFile and exportFile
- ✅ tests/worker/protocol.test.ts provides protocol extension tests (>20 lines)
- ✅ Key link: protocol.ts imports ImportResult from etl/types.ts
- ✅ Key link: WorkerBridge.ts uses WorkerPayloads['etl:import']
