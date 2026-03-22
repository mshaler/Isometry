---
phase: 103-supercalc-v2-null-handling-filter-scope
verified: 2026-03-21T19:56:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 103: SuperCalc v2 — Null Handling + Filter Scope Verification Report

**Phase Goal:** Extend SuperCalc with null handling modes (exclude/zero/strict), COUNT semantics (column vs all rows), aggregation scope (filter-aware vs full dataset), and structured AggResult return type. Wire UI controls for scope toggle, null mode, and count sub-mode.
**Verified:** 2026-03-21T19:56:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                 | Status     | Evidence                                                                      |
|----|---------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------|
| 1  | computeAggregate returns AggResult object with value and optional warning             | VERIFIED   | SuperCalcFooter.ts L123-192: returns `{ value, warning? }` in all code paths |
| 2  | nullMode 'zero' substitutes 0 for nulls; AVG divides by total rows                   | VERIFIED   | SuperCalcFooter.ts L157-188: `working = values.map(v => v === null ? 0 : v)`, AVG uses `values.length` denominator |
| 3  | nullMode 'strict' returns warning when any null present                               | VERIFIED   | SuperCalcFooter.ts L133-135: early return `{ value: null, warning: 'incomplete-data' }` |
| 4  | countMode 'all' returns total row count; 'column' with 'zero' still counts non-nulls | VERIFIED   | SuperCalcFooter.ts L138-144: `countMode === 'all'` returns `values.length`; 'column' always `filter(v => v !== null).length` |
| 5  | RenderContext.allRows carries pre-filter row combinations                              | VERIFIED   | PluginTypes.ts L75: `allRows: string[][]` on RenderContext; PivotGrid.ts L215: `const allRows = rowCombinations` before hide-empty filter |
| 6  | Footer reads allRows when scope 'all', visibleRows when scope 'view'                  | VERIFIED   | SuperCalcFooter.ts L234: `const rows = config.scope === 'all' ? ctx.allRows : ctx.visibleRows` |
| 7  | Scope toggle in config sidebar updates calcConfig.scope and triggers rerender         | VERIFIED   | SuperCalcConfig.ts L100-103: `sharedConfig.scope = mode; onConfigChange?.()` in radio change handler |
| 8  | Per-column null mode selector; hidden when fn === 'NONE'                              | VERIFIED   | SuperCalcConfig.ts L160-176: `hns-calc-null-mode` select; L169: `display = currentFn === 'NONE' ? 'none' : ''` |
| 9  | COUNT sub-mode selector shown only when fn === 'COUNT'                                | VERIFIED   | SuperCalcConfig.ts L178-196: `hns-calc-count-mode` select; L189: `display = currentFn === 'COUNT' ? '' : 'none'` |
| 10 | Warning cells render with --pv-warning-fg/bg tokens and tooltip text                  | VERIFIED   | SuperCalcFooter.ts L259-265: `color: var(--pv-warning-fg)`, `background: var(--pv-warning-bg)`, `title=` set, `WARNING_GLYPH` displayed |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                              | Expected                                               | Status     | Details                                                                       |
|-------------------------------------------------------|--------------------------------------------------------|------------|-------------------------------------------------------------------------------|
| `src/views/pivot/plugins/SuperCalcFooter.ts`          | NullMode, CountMode, ScopeMode, ColCalcConfig, CalcConfig, AggResult, computeAggregate, WARNING_GLYPH, getColConfig | VERIFIED   | All 9 types/exports present (L29-96, L123-192, L205); 287 LOC                |
| `src/views/pivot/plugins/PluginTypes.ts`              | allRows: string[][] on RenderContext                    | VERIFIED   | L74-75: JSDoc + field on RenderContext                                        |
| `src/views/pivot/PivotGrid.ts`                        | allRows populated before hide-empty filter              | VERIFIED   | L215: `const allRows = rowCombinations`; L277: in ctx; L140, L588: `allRows: []` for scroll/overlay contexts |
| `src/views/pivot/plugins/SuperCalcConfig.ts`          | Null mode select, count mode select, scope radio fieldset | VERIFIED   | hns-calc-scope (2 uses), hns-calc-null-mode (1 use), hns-calc-count-mode (1 use); 223 LOC |
| `src/views/pivot/plugins/FeatureCatalog.ts`           | CalcConfig construction with cols Map and scope        | VERIFIED   | L360-363: `const calcConfig: CalcConfig = { cols: new Map<number, ColCalcConfig>(), scope: 'view' }` |
| `tests/views/pivot/SuperCalc.test.ts`                 | Null mode, count mode, strict mode, scope, regression tests | VERIFIED   | 59 tests across 11 describe blocks; 405 LOC (exceeds 250 line minimum)       |

### Key Link Verification

| From                        | To                           | Via                                         | Status  | Details                                                                           |
|-----------------------------|------------------------------|---------------------------------------------|---------|-----------------------------------------------------------------------------------|
| SuperCalcFooter.ts          | PluginTypes.ts               | `ctx.allRows` in afterRender                | WIRED   | L234: `config.scope === 'all' ? ctx.allRows : ctx.visibleRows`                    |
| PivotGrid.ts                | PluginTypes.ts               | allRows field populated in ctx              | WIRED   | L277: `allRows,` in main render ctx                                               |
| FeatureCatalog.ts           | SuperCalcFooter.ts           | CalcConfig passed to createSuperCalcFooterPlugin | WIRED   | L364-366: `createSuperCalcFooterPlugin(calcConfig)`                               |
| FeatureCatalog.ts           | SuperCalcConfig.ts           | CalcConfig passed to createSuperCalcConfigPlugin | WIRED   | L367-369: `createSuperCalcConfigPlugin(calcConfig, () => registry.notifyChange())` |
| SuperCalcConfig.ts          | SuperCalcFooter.ts           | imports CalcConfig, getColConfig, NullMode, CountMode, ScopeMode | WIRED   | L16-23: explicit named imports                                                    |

### Requirements Coverage

| Requirement | Source Plan | Description                                                              | Status     | Evidence                                                                                  |
|-------------|------------|--------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------|
| SC2-01      | 103-01     | NullMode, CountMode, ScopeMode, ColCalcConfig, CalcConfig, AggResult exported | SATISFIED  | SuperCalcFooter.ts L29-58: all 6 types exported                                           |
| SC2-02      | 103-01     | computeAggregate returns AggResult with nullMode/countMode params         | SATISFIED  | SuperCalcFooter.ts L123-128: 4-param signature, `): AggResult`                            |
| SC2-03      | 103-01     | nullMode 'zero': substitutes 0; AVG divides by total rows                 | SATISFIED  | SuperCalcFooter.ts L157-180: zero-substitution + `sum / values.length` for AVG           |
| SC2-04      | 103-01     | nullMode 'strict': returns warning when nulls present                     | SATISFIED  | SuperCalcFooter.ts L133-135: strict early-return with `warning: 'incomplete-data'`       |
| SC2-05      | 103-01     | countMode 'all': total row count regardless of nulls                      | SATISFIED  | SuperCalcFooter.ts L139-141: `return { value: values.length }`                           |
| SC2-06      | 103-01     | countMode 'column' with nullMode 'zero': still counts original non-nulls  | SATISFIED  | SuperCalcFooter.ts L143: COUNT/column always uses `filter(v => v !== null).length`; confirmed by test L190-193 |
| SC2-07      | 103-01     | RenderContext.allRows in PluginTypes.ts, populated by PivotGrid.ts        | SATISFIED  | PluginTypes.ts L75; PivotGrid.ts L215, L277                                              |
| SC2-08      | 103-02     | Scope toggle updates calcConfig.scope                                     | SATISFIED  | SuperCalcConfig.ts L100-103: radio change handler mutates `sharedConfig.scope`            |
| SC2-09      | 103-01     | Footer reads ctx.allRows when scope 'all', ctx.visibleRows when scope 'view' | SATISFIED  | SuperCalcFooter.ts L234                                                                   |
| SC2-10      | 103-01     | WARNING_GLYPH constant alongside GLYPHS record                            | SATISFIED  | SuperCalcFooter.ts L65: `export const WARNING_GLYPH = '\u26A0'`; GLYPHS at L71          |
| SC2-11      | 103-02     | Warning cell renders with --pv-warning-fg/bg tokens and tooltip           | SATISFIED  | SuperCalcFooter.ts L261-264: `var(--pv-warning-fg)`, `var(--pv-warning-bg)`, title set   |
| SC2-12      | 103-02     | Null mode select per column; hidden when fn === 'NONE'                    | SATISFIED  | SuperCalcConfig.ts L160-176, L169: `display = currentFn === 'NONE' ? 'none' : ''`       |
| SC2-13      | 103-02     | Count sub-mode select shown only when fn === 'COUNT'                      | SATISFIED  | SuperCalcConfig.ts L178-196, L189: `display = currentFn === 'COUNT' ? '' : 'none'`      |
| SC2-14      | 103-01, 103-02 | All existing pivot tests still pass                                    | SATISFIED  | `npx vitest run tests/views/pivot/`: 313/313 passing (17 test files)                     |
| SC2-15      | 103-01, 103-02 | No TypeScript errors                                                   | SATISFIED  | `npx tsc --noEmit`: exits 0 (zero errors)                                                |

All 15 requirements from ROADMAP.md are covered. Plans 103-01 claims SC2-01..SC2-07, SC2-09, SC2-10, SC2-14, SC2-15. Plan 103-02 claims SC2-08, SC2-11, SC2-12, SC2-13, SC2-14, SC2-15. No orphaned requirements.

### Anti-Patterns Found

| File                | Line | Pattern                              | Severity | Impact |
|---------------------|------|--------------------------------------|----------|--------|
| FeatureCatalog.ts   | 51   | "placeholder" in JSDoc comment       | Info     | Pre-existing comment for a named noop factory type — not unimplemented code; no impact |

No blockers or warnings found.

### Human Verification Required

No human verification required for this phase. All observable behaviors are verifiable programmatically via the existing test suite and static code analysis.

Note: The warning cell rendering (SC2-11) uses `--pv-warning-fg` and `--pv-warning-bg` CSS custom properties. Whether these tokens resolve to visually appropriate colors depends on the CSS variable definitions in the theme. This is out of scope for this phase (no CSS file was modified) and the tokens follow the established naming convention from the design token system.

### Gaps Summary

No gaps. All phase must-haves are verified at all three levels (exists, substantive, wired). The 59/59 SuperCalc test suite provides comprehensive behavioral coverage of all 6 new semantic modes. The 313/313 all-pivot pass confirms zero regressions. TypeScript strict mode passes with zero errors.

---

_Verified: 2026-03-21T19:56:00Z_
_Verifier: Claude (gsd-verifier)_
