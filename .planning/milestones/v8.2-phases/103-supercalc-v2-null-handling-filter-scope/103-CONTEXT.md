# Phase 103: SuperCalc v2 — Null Handling + Filter Scope - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** PRD Express Path (docs/supercalc-v2-handoff.md)

<domain>
## Phase Boundary

Extend SuperCalc plugin with user-configurable null handling modes, aggregation scope toggle, COUNT semantics, and structured AggResult return type. Enhancement to existing plugin files only — no new plugins, no new Worker queries. Config is ephemeral (matches existing plugin shared state pattern).

Touches 6 files: SuperCalcFooter.ts, SuperCalcConfig.ts, PluginTypes.ts, PivotGrid.ts, FeatureCatalog.ts, SuperCalc.test.ts.

</domain>

<decisions>
## Implementation Decisions

### Return Type
- computeAggregate returns AggResult { value: number | null; warning?: 'incomplete-data' } — NOT a string sentinel union
- Callers check result.warning for strict mode, always read result.value for the number

### Null Handling Modes (per-column)
- Three modes: 'exclude' (default, preserves current behavior), 'zero' (substitute 0 for nulls), 'strict' (return warning if any null present)
- For SUM: 'exclude' and 'zero' produce identical numeric results (semantic distinction only)
- For AVG under 'zero': divides by values.length (total rows), not by non-null count
- For COUNT(column) under 'zero': still counts originally non-null values (zero-substitution is computation transform, not data mutation)
- For MIN/MAX under 'zero': 0 is a candidate value
- For 'strict': if ANY null present, return { value: null, warning: 'incomplete-data' } immediately

### Aggregation Scope (global, not per-column)
- Two modes: 'view' (default, filter-aware) and 'all' (full dataset)
- Scope is a property of the view, not of individual columns
- Pipeline finding (RESOLVED): ctx.visibleRows is already post-filter; ctx.data is full Map
- For scope 'all': add allRows: string[][] to RenderContext, populated by PivotGrid before hide-empty filter
- Footer reads ctx.allRows when scope 'all', ctx.visibleRows when scope 'view'

### COUNT Semantics
- Sub-mode: 'column' (default, count non-null values) vs 'all' (count all rows)
- Only visible in config sidebar when fn === 'COUNT'
- Tooltip: "Non-null values (original data)" to disambiguate zero-substitution interaction

### UI Controls
- Per-column null mode <select> beside existing aggregate function selector (hidden when fn === 'NONE')
- COUNT sub-mode <select> appears only when fn === 'COUNT'
- Global scope toggle as <fieldset> with radio inputs above per-column rows
- WARNING_GLYPH constant alongside GLYPHS record (not hardcoded in render path)
- Warning cell: var(--pv-warning-fg/bg) tokens, title tooltip

### Wiring
- calcConfig constructed in registerAllPlugins() inside FeatureCatalog.ts (line ~356), NOT HarnessShell.ts
- Config is ephemeral — constructed fresh per session, matching density/zoom/sort pattern
- ColCalcConfig shape: { fn: AggFunction, nullMode: NullMode, countMode: CountMode }
- CalcConfig shape: { cols: Map<number, ColCalcConfig>, scope: ScopeMode }

### Claude's Discretion
- getColConfig helper placement (exported utility in SuperCalcFooter.ts vs inlined)
- Exact CSS token values for --pv-warning-fg and --pv-warning-bg
- Whether scope radio uses <fieldset> or toggle button
- Internal implementation of null substitution (pre-filter array vs inline check)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperCalc Plugin Files (modify in place)
- `src/views/pivot/plugins/SuperCalcFooter.ts` — computeAggregate function + footer plugin factory
- `src/views/pivot/plugins/SuperCalcConfig.ts` — sidebar config UI plugin factory
- `src/views/pivot/plugins/PluginTypes.ts` — RenderContext, PluginHook, CellPlacement interfaces
- `src/views/pivot/PivotGrid.ts` — render() pipeline, ctx construction, hide-empty filtering
- `src/views/pivot/plugins/FeatureCatalog.ts` — registerAllPlugins() with calcConfig wiring (line ~356)
- `tests/views/pivot/SuperCalc.test.ts` — existing computeAggregate + factory shape tests

### Architecture Reference
- `docs/supercalc-v2-handoff.md` — Full design doc (Rev 2) with all decisions, semantics, and test requirements

</canonical_refs>

<specifics>
## Specific Ideas

### Execution Order (from handoff doc)
1. Work Area 1 (types + RenderContext + PivotGrid) — must land first
2. Work Area 2 (computeAggregate) — pure function, TDD-friendly
3. Work Area 3 (scope switching) — one conditional using ctx.allRows
4. Work Area 5 (FeatureCatalog wiring) — CalcConfig shape
5. Work Area 4 (UI controls) — depends on types + wiring

### Key Test Cases (must pass)
```
// nullMode: 'zero'
computeAggregate('AVG', [10, null, null], 'zero', 'column').value ~= 3.33
computeAggregate('SUM', [10, null, 30], 'zero', 'column').value === 40
computeAggregate('MIN', [10, null, 30], 'zero', 'column').value === 0

// nullMode: 'strict'
computeAggregate('SUM', [10, null, 30], 'strict', 'column').warning === 'incomplete-data'
computeAggregate('SUM', [10, 20, 30], 'strict', 'column').value === 60

// countMode: 'all'
computeAggregate('COUNT', [10, null, 30], 'exclude', 'all').value === 3
computeAggregate('COUNT', [10, null, 30], 'zero', 'column').value === 2  // NOT 3

// regressions
computeAggregate('SUM', [], 'exclude', 'column').value === null
computeAggregate('COUNT', [], 'exclude', 'column').value === 0
```

### Regression Guard
- All existing pivot tests must still pass: `npx vitest run tests/views/pivot/`
- Stub count in FeatureCatalogCompleteness.test.ts unchanged (15)
- No TypeScript errors: `npx tsc --noEmit`

</specifics>

<deferred>
## Deferred Ideas

- Config persistence to ui_state (follow-up if needed)
- Denominator labels (n=X) for SUM exclude-vs-zero visual differentiation
- Discriminated union for ColCalcConfig when fn === 'NONE'
- SQL-backed aggregation (Worker query)
- Per-column scope override
- Weighted averages

</deferred>

---

*Phase: 103-supercalc-v2-null-handling-filter-scope*
*Context gathered: 2026-03-21 via PRD Express Path*
