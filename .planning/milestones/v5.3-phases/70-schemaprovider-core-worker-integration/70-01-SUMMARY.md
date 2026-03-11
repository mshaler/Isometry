---
phase: 70-schemaprovider-core-worker-integration
plan: 01
subsystem: database
tags: [schema, pragma, worker, provider, allowlist, latch, dynamic-schema]

# Dependency graph
requires:
  - phase: 62-68-supercalc-workbench-b
    provides: Worker handler infrastructure and sql.js PRAGMA access
  - phase: 04-providers
    provides: allowlist frozen sets and PersistableProvider pattern
provides:
  - LatchFamily type and ColumnInfo interface in protocol.ts
  - classifyColumns() pure function for Worker-side PRAGMA introspection
  - WorkerReadyMessage.schema field with classified column arrays
  - Worker-side validColumnNames Set populated before processPendingQueue()
  - SchemaProvider class with typed accessors and subscribe/notify
  - setSchemaProvider() for runtime allowlist delegation
  - allowlist dynamic schema validation via SchemaProvider delegation
affects: [phase 71, phase 72, phase 73, allowlist, SchemaProvider, WorkerBridge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - classifyColumns pure function callable in Worker context (no DOM/Worker globals)
    - onSchema callback in WorkerBridgeConfig — passes through schema, does not store it
    - queueMicrotask batching for SchemaProvider subscriber notifications (same as AliasProvider)
    - Module-level _schemaProvider singleton in allowlist.ts for delegation pattern
    - setSchemaProvider(null) for test isolation cleanup

key-files:
  created:
    - src/worker/schema-classifier.ts
    - src/providers/SchemaProvider.ts
    - tests/worker/schema-classifier.test.ts
    - tests/providers/SchemaProvider.test.ts
  modified:
    - src/worker/protocol.ts (LatchFamily, ColumnInfo, WorkerReadyMessage.schema, onSchema in WorkerBridgeConfig)
    - src/worker/worker.ts (PRAGMA introspection, validColumnNames Set, schema in ready message)
    - src/worker/WorkerBridge.ts (_onSchema private field, onSchema callback before resolveReady)
    - src/providers/allowlist.ts (setSchemaProvider, _schemaProvider, delegation in isValidFilterField/isValidAxisField)
    - src/providers/index.ts (export SchemaProvider and setSchemaProvider)
    - src/main.ts (SchemaProvider creation, onSchema wiring, setSchemaProvider after isReady)
    - tests/worker/fixtures.ts (createReadyMessage includes schema: {cards:[], connections:[]})
    - tests/worker/WorkerBridge.test.ts (2 new onSchema tests)

key-decisions:
  - "onSchema callback in WorkerBridgeConfig stored as _onSchema private field in WorkerBridge (config only retains timeout/debug)"
  - "SchemaProvider is NOT PersistableProvider — schema is PRAGMA-derived, not user state"
  - "classifyColumns() uses indexOf for column position lookup — robust against PRAGMA column order changes"
  - "setSchemaProvider(null) allowed for test isolation cleanup"
  - "weight column in connections classified as Hierarchy (same heuristic as priority/sort_order)"

patterns-established:
  - "PRAGMA -> classifyColumns() -> WorkerReadyMessage.schema -> onSchema callback -> SchemaProvider.initialize() -> allowlist delegation"
  - "onSchema fires BEFORE resolveReady() so schema is synchronously available after await bridge.isReady"
  - "Allowlist falls back to frozen sets when SchemaProvider not wired (boot safety + test isolation)"

requirements-completed: [SCHM-01, SCHM-02, SCHM-03, SCHM-04, SCHM-05, SCHM-06, SCHM-07]

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 70 Plan 01: SchemaProvider Core Worker Integration Summary

**PRAGMA-derived schema pipeline: Worker classifies columns into LATCH families at init, embeds in ready message, SchemaProvider exposes typed accessors, allowlist validation delegates dynamically**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T12:40:19Z
- **Completed:** 2026-03-11T12:48:50Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 10

## Accomplishments

- Worker runs PRAGMA table_info(cards/connections) after db.initialize() and classifies all columns into LATCH families (Location/Alphabet/Time/Category/Hierarchy) using hardcoded heuristics
- SchemaProvider class with 7 typed accessors (getColumns, isValidColumn, getFilterableColumns, getAxisColumns, getNumericColumns, getFieldsByFamily, getLatchFamilies) and queueMicrotask-batched subscribe/notify
- allowlist.ts isValidFilterField and isValidAxisField delegate to SchemaProvider when wired via setSchemaProvider(), preserving frozen-set fallback for test isolation and early boot
- 62 new tests (25 schema-classifier, 35 SchemaProvider + allowlist delegation, 2 WorkerBridge onSchema)

## Task Commits

Each task was committed atomically (all TDD: test → impl):

1. **Task 1: ColumnInfo types + classifyColumns() + unit tests** - `9655d95d` (feat)
2. **Task 2: Worker PRAGMA introspection + validColumnNames Set + WorkerBridge onSchema** - `7eb718d2` (feat)
3. **Task 3: SchemaProvider class + allowlist delegation + main.ts wiring** - `013b08c4` (feat)

**Plan metadata:** (docs commit below)

_Note: All tasks used TDD red-green flow. Tests written first, implementation second._

## Files Created/Modified

- `src/worker/schema-classifier.ts` — classifyColumns() pure function with LATCH heuristics
- `src/worker/protocol.ts` — LatchFamily type, ColumnInfo interface, WorkerReadyMessage.schema, onSchema in WorkerBridgeConfig
- `src/worker/worker.ts` — PRAGMA introspection, validColumnNames Set, schema in ready message
- `src/worker/WorkerBridge.ts` — _onSchema private field, callback before resolveReady
- `src/providers/SchemaProvider.ts` — Full SchemaProvider class with typed accessors
- `src/providers/allowlist.ts` — setSchemaProvider(), _schemaProvider, delegation in type guards
- `src/providers/index.ts` — Export SchemaProvider and setSchemaProvider
- `src/main.ts` — SchemaProvider creation, onSchema wiring, setSchemaProvider after isReady
- `tests/worker/schema-classifier.test.ts` — 25 unit tests (LATCH classification, exclusions, edge cases)
- `tests/providers/SchemaProvider.test.ts` — 35 unit tests (accessors, subscribe/notify, allowlist delegation)
- `tests/worker/fixtures.ts` — createReadyMessage() updated with schema field
- `tests/worker/WorkerBridge.test.ts` — 2 new onSchema callback tests

## Decisions Made

- `onSchema` stored as `_onSchema` private field in WorkerBridge (not in `config` — the config field is typed as `Required<Pick<WorkerBridgeConfig, 'timeout' | 'debug'>>`)
- SchemaProvider is NOT PersistableProvider — schema derives from runtime PRAGMA, not user state that should persist across sessions
- classifyColumns uses `indexOf` for column position lookup rather than positional index — more robust against future PRAGMA column order changes
- `setSchemaProvider(null)` permitted for test isolation cleanup (afterEach reset)
- `weight` column in connections table classified as Hierarchy (same heuristic as priority/sort_order — positional/ordinal values)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test column count (23 vs actual 24)**
- **Found during:** Task 1 (RED phase test run)
- **Issue:** Test expected 23 exposed columns but cards table has 26 total rows (id + 24 data cols + deleted_at) — excluding id and deleted_at = 24, not 23
- **Fix:** Updated test assertion from 23 to 24 with corrected comment
- **Files modified:** tests/worker/schema-classifier.test.ts
- **Verification:** Test passes with correct count
- **Committed in:** `9655d95d` (part of Task 1 commit)

**2. [Rule 1 - Bug] Fixed Biome format: classifyColumns signature on single line**
- **Found during:** Task 3 verification (biome check)
- **Issue:** classifyColumns function signature split across 3 lines; Biome required single-line form
- **Fix:** Collapsed multi-line parameter signature to one line
- **Files modified:** src/worker/schema-classifier.ts
- **Verification:** `npx biome check` reports no errors
- **Committed in:** `013b08c4` (part of Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — bugs)
**Impact on plan:** Both corrections minor. No scope creep.

## Issues Encountered

- TypeScript error: `this.config.onSchema` doesn't exist because `config` field is typed as `Required<Pick<WorkerBridgeConfig, 'timeout' | 'debug'>>`. Fixed by storing `onSchema` as a separate `_onSchema` private field in WorkerBridge constructor.

## Next Phase Readiness

- SchemaProvider pipeline complete — PRAGMA -> classifyColumns -> WorkerReadyMessage.schema -> SchemaProvider.initialize() -> allowlist delegation all wired
- Worker-side `validColumnNames` Set populated and exported for use by handlers (SCHM-06)
- Phase 70 Plan 02 can now build on SchemaProvider for UI-facing schema exploration features

## Self-Check: PASSED

All created files exist and all task commits verified.

---
*Phase: 70-schemaprovider-core-worker-integration*
*Completed: 2026-03-11*
