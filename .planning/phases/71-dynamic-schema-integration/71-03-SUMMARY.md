---
phase: 71-dynamic-schema-integration
plan: 03
subsystem: ui-explorers
tags: [dynamic-schema, schema-provider, latch, calc, chart, properties, projection]
dependency_graph:
  requires: [Phase 70 SchemaProvider, Phase 71 Plan 01 (type widening + getLatchFamily)]
  provides: [SchemaProvider-driven field lists in all 5 explorer panels + ChartRenderer]
  affects:
    - src/ui/PropertiesExplorer.ts
    - src/ui/ProjectionExplorer.ts
    - src/ui/CalcExplorer.ts
    - src/ui/LatchExplorers.ts
    - src/ui/charts/ChartRenderer.ts
    - src/ui/NotebookExplorer.ts
    - src/main.ts
tech_stack:
  added: []
  patterns:
    - optional schema injection via config interface (schema?: SchemaProvider)
    - schema-or-fallback pattern: schema?.initialized ? schema.getXxx() : hardcodedFallback
    - _getFieldsForFamily() private method encapsulating fallback switch
    - _isNumeric() private method delegating to SchemaProvider
    - _displayName() private method delegating to AliasProvider
key_files:
  created: []
  modified:
    - src/ui/PropertiesExplorer.ts
    - src/ui/ProjectionExplorer.ts
    - src/ui/CalcExplorer.ts
    - src/ui/LatchExplorers.ts
    - src/ui/charts/ChartRenderer.ts
    - src/ui/NotebookExplorer.ts
    - src/main.ts
decisions:
  - "schema?: SchemaProvider optional on all explorer configs — tests exercise fallback path without wiring"
  - "NUMERIC_FIELDS renamed to NUMERIC_FIELDS_FALLBACK; FIELD_DISPLAY_NAMES removed from CalcExplorer"
  - "LatchExplorers CATEGORY/HIERARCHY/TIME_FIELDS module-level constants replaced by _getFieldsForFamily() switch-case fallbacks"
  - "ChartRenderer passes schema through NotebookExplorer config chain (NotebookExplorer -> ChartRenderer)"
  - "exactOptionalPropertyTypes requires spread pattern for optional schema in NotebookExplorer constructor"
metrics:
  duration: 8 minutes
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_modified: 7
---

# Phase 71 Plan 03: UI Explorer SchemaProvider Migration Summary

All 5 UI explorer panels (Properties, Projection, Calc, LatchExplorers) and ChartRenderer migrated from hardcoded field lists to SchemaProvider-driven column iteration, with ALLOWED_AXIS_FIELDS fallback for test isolation.

## Objective

Migrate all 5 UI explorer panels and ChartRenderer from hardcoded field lists to SchemaProvider-driven column iteration. Adding a column to the cards table now causes it to automatically appear in Properties, Projection, Calc, LATCH, and Chart explorers without code changes.

## Tasks Completed

### Task 1: Migrate PropertiesExplorer + ProjectionExplorer + ChartRenderer
**Commit:** 8b2a2aad

- Added `schema?: SchemaProvider` to `PropertiesExplorerConfig` (DYNM-05)
- `PropertiesExplorer._createColumn()` uses `schema.getAxisColumns()` when initialized, falls back to `ALLOWED_AXIS_FIELDS`
- `PropertiesExplorer` constructor builds initial `_enabledFields` from dynamic field list
- Replaced `LATCH_FAMILIES[f]` with `getLatchFamily(f)` for open-type safety (no TS2538 risk on widened Record)
- Added `schema?: SchemaProvider` to `ProjectionExplorerConfig` (DYNM-06)
- `ProjectionExplorer._createZControls()` display select iterates `schema.getAxisColumns()` when available
- Added `schema?: SchemaProvider` to `ChartRendererConfig` (DYNM-06 extension)
- `ChartRenderer._resolveField()` uses `schema.getAxisColumns()` for both direct lookup and reverse alias scan
- Added `schema?: SchemaProvider` to `NotebookExplorerConfig` and forwarded to `ChartRenderer` constructor
- Wired `schemaProvider` into PropertiesExplorer, ProjectionExplorer, NotebookExplorer in `src/main.ts`

### Task 2: Migrate CalcExplorer + LatchExplorers
**Commit:** e590b07d

- Added `schema?: SchemaProvider` and `alias?: AliasProvider` to `CalcExplorerConfig` (DYNM-07, DYNM-08)
- Renamed `NUMERIC_FIELDS` to `NUMERIC_FIELDS_FALLBACK`
- Added `_isNumeric(field)` private method: delegates to `schema.getNumericColumns()` when initialized
- Added `_displayName(field)` private method: delegates to `alias.getAlias()` when available, falls back to snake_case-to-Title-Case
- Removed `FIELD_DISPLAY_NAMES` constant entirely — fully replaced by `_displayName()` + AliasProvider
- Added `schema?: SchemaProvider` to `LatchExplorersConfig` (DYNM-09)
- Added `_getFieldsForFamily(family)` private method: delegates to `schema.getFieldsByFamily()` when initialized, falls back to inline switch case with hardcoded arrays
- Replaced all `CATEGORY_FIELDS` / `HIERARCHY_FIELDS` / `TIME_FIELDS` module-level constant usages with `_getFieldsForFamily()` calls across 8 methods
- Wired `schema + alias` into CalcExplorer config in `src/main.ts`
- Wired `schema` into LatchExplorers config in `src/main.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] ChartRenderer injected via NotebookExplorer config chain**
- **Found during:** Task 1
- **Issue:** ChartRenderer is constructed lazily inside `NotebookExplorer._renderPreview()` — no direct construction site accessible from main.ts. Plan noted "find where ChartRenderer is constructed (likely in NotebookExplorer or a chart mount function) and inject schemaProvider."
- **Fix:** Added `schema?: SchemaProvider` to `NotebookExplorerConfig`, stored as `this._schema`, passed via spread to ChartRenderer constructor
- **Files modified:** `src/ui/NotebookExplorer.ts`
- **Commit:** 8b2a2aad

**2. [Rule 1 - Bug] exactOptionalPropertyTypes incompatibility in NotebookExplorer**
- **Found during:** TypeScript compile check after Task 1
- **Issue:** `this._schema` typed `SchemaProvider | undefined` cannot be directly spread into `ChartRendererConfig` under `exactOptionalPropertyTypes: true` — undefined is not assignable to `SchemaProvider`
- **Fix:** Used conditional spread pattern `...(this._schema !== undefined && { schema: this._schema })`
- **Files modified:** `src/ui/NotebookExplorer.ts`
- **Commit:** 8b2a2aad

## Verification Results

1. `npx tsc --noEmit` — PASSED (zero errors in our modified files; 4 pre-existing SuperGrid.ts errors from Plan 71-04 scope)
2. `npx vitest run tests/ui/` — PASSED (282/282 tests across 11 test files)
3. All 5 explorers + ChartRenderer accept optional SchemaProvider in config
4. When SchemaProvider is not wired (tests), fallback to existing hardcoded behavior
5. DYNM-05 through DYNM-09 satisfied

## Key Decisions

1. **schema?: SchemaProvider optional on all configs** — tests exercise the fallback path without wiring; all 282 UI tests pass without injecting SchemaProvider.

2. **FIELD_DISPLAY_NAMES constant removed from CalcExplorer** — AliasProvider is the authoritative display name source; the constant was redundant and could diverge.

3. **LatchExplorers uses inline switch fallbacks** — module-level constants converted to inline switch-case inside `_getFieldsForFamily()`. The hardcoded values remain as documented fallbacks but no longer pollute module scope or require import.

4. **ChartRenderer schema injection through NotebookExplorer** — NotebookExplorer acts as the schema bridge for ChartRenderer since ChartRenderer is constructed lazily inside the preview render path.

## Self-Check

### Files Exist
- `src/ui/PropertiesExplorer.ts` — FOUND
- `src/ui/ProjectionExplorer.ts` — FOUND
- `src/ui/CalcExplorer.ts` — FOUND
- `src/ui/LatchExplorers.ts` — FOUND
- `src/ui/charts/ChartRenderer.ts` — FOUND
- `src/ui/NotebookExplorer.ts` — FOUND
- `src/main.ts` — FOUND

### Commits Exist
- 8b2a2aad (feat(71-03): migrate PropertiesExplorer + ProjectionExplorer + ChartRenderer to SchemaProvider) — FOUND
- e590b07d (feat(71-03): migrate CalcExplorer + LatchExplorers to SchemaProvider) — FOUND

## Self-Check: PASSED
