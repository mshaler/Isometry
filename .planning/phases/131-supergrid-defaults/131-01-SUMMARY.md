---
phase: 131-supergrid-defaults
plan: 01
subsystem: ui
tags: [pafv, supergrid, schema, axis, defaults, registry]

# Dependency graph
requires:
  - phase: 130-foundation
    provides: Per-dataset scoped state namespacing and StateManager lifecycle

provides:
  - ViewDefaultsRegistry: static frozen Map with 10 source-type entries mapping to ordered colAxes/rowAxes fallback lists
  - resolveDefaults(): validates each candidate via SchemaProvider.isValidColumn() and returns first valid axis
  - PAFVProvider.applySourceDefaults(): single entry point that wires registry resolution to axis setters
  - main.ts import wiring: both importFile and importNative apply source-type defaults after successful import

affects: [131-02, supergrid-defaults, preset-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static frozen Map registry: compile-time constants, zero database overhead, forward-compat by design"
    - "Ordered fallback resolution: first valid column wins; empty axes if none valid (D-04)"
    - "alto_index prefix match: exact match first, then startsWith('alto_index') to 'alto_index' key (D-07)"
    - "Single public entry point (applySourceDefaults) on provider instead of standalone function"

key-files:
  created:
    - src/providers/ViewDefaultsRegistry.ts
    - tests/providers/ViewDefaultsRegistry.test.ts
  modified:
    - src/providers/PAFVProvider.ts
    - src/main.ts

key-decisions:
  - "applySourceDefaults lives on PAFVProvider (not standalone) to keep axis-setting logic centralized"
  - "resolveDefaults returns first valid col/row as single-element AxisMapping[]; empty [] if no valid candidates"
  - "Object.freeze on Map makes it frozen at object level; ReadonlyMap type prevents .set() at TS compile time"
  - "Wired in both importFile and importNative wrappers — called after result returned, before audit/toast"

patterns-established:
  - "ViewDefaultsRegistry pattern: frozen Map<string, DefaultMapping> keyed by source type string"
  - "resolveDefaults validates every axis candidate through schema before returning (SGDF-02 invariant)"

requirements-completed: [SGDF-01, SGDF-02, SGDF-03]

# Metrics
duration: 12min
completed: 2026-03-27
---

# Phase 131 Plan 01: SuperGrid Defaults Summary

**ViewDefaultsRegistry with 10 source-type entries + resolveDefaults using SchemaProvider.isValidColumn() wired into both import paths via PAFVProvider.applySourceDefaults()**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-27T11:48:00Z
- **Completed:** 2026-03-27T12:00:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created ViewDefaultsRegistry: frozen Map with 10 entries covering all 9 SourceType values plus alto_index catch-all
- resolveDefaults() validates each axis candidate through SchemaProvider.isValidColumn() with ordered fallback
- PAFVProvider.applySourceDefaults() is the single wiring point: resolves defaults then calls setColAxes/setRowAxes
- Wired into both import flows (file and native) so first-import auto-configures SuperGrid axes

## Task Commits

Each task was committed atomically:

1. **Task 1: ViewDefaultsRegistry — static Map + resolveDefaults with SchemaProvider validation** - `3c76262a` (feat)
2. **Task 2: Wire first-import defaults application into main.ts post-import flow** - `46b19d8d` (feat)

## Files Created/Modified
- `src/providers/ViewDefaultsRegistry.ts` - Frozen Map + resolveDefaults + DefaultMapping interface
- `tests/providers/ViewDefaultsRegistry.test.ts` - 13 tests covering all 7 behavior cases
- `src/providers/PAFVProvider.ts` - Added applySourceDefaults() public method + resolveDefaults import
- `src/main.ts` - Added applySourceDefaults call in both importFile and importNative wrappers

## Decisions Made
- applySourceDefaults() lives on PAFVProvider (not as a standalone function) — keeps axis-setting logic centralized with existing setColAxes/setRowAxes
- resolveDefaults returns a single-element array per axis (first valid candidate) matching AxisMapping[] type
- ReadonlyMap TypeScript type enforces immutability at compile time; Object.freeze enforces at runtime
- Both import wrappers call applySourceDefaults after the result returns — before audit/toast, doesn't affect result propagation

## Deviations from Plan

### Minor Adjustment

**1. [Rule 1 - Test fixture] Fixed frozen Map test assertion**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Test asserted `.set()` throws, but Object.freeze on a Map doesn't make `.set()` throw — it only freezes the object's properties. ReadonlyMap enforces at TS level.
- **Fix:** Updated test to assert `Object.isFrozen(VIEW_DEFAULTS_REGISTRY) === true` (correct runtime check)
- **Verification:** 13 tests pass
- **Committed in:** 3c76262a

---

**Total deviations:** 1 (test fixture correction)
**Impact on plan:** Minimal — corrected test to match correct JavaScript semantics.

## Issues Encountered
None — plan executed smoothly.

## Next Phase Readiness
- ViewDefaultsRegistry and applySourceDefaults are complete and tested
- Plan 02 adds the first-import flag gate (`view:defaults:applied:{datasetId}`) to prevent overwriting user customizations on re-import

---
*Phase: 131-supergrid-defaults*
*Completed: 2026-03-27*
