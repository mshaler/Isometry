# Phase 69: Bug Fixes - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two independent bugs: (1) SVG text elements in chart blocks and histogram scrubbers inherit CSS letter-spacing from HTML containers, causing rendering artifacts; (2) deleted_at field accessed in non-SQL code paths without null-safety, risking null dereference. SQL filtering (deleted_at IS NULL) continues to work correctly.

</domain>

<decisions>
## Implementation Decisions

### SVG text fix scope
- Global SVG text CSS reset rule, NOT component-scoped — prevents any future SVG from inheriting text styling artifacts
- Full SVG text reset covering `letter-spacing`, `text-transform`, and `word-spacing` in one rule — SuperGrid headers use `text-transform: uppercase` which could also leak
- Reset rule lives in the main app stylesheet (top-level CSS entry point)
- Audit and consolidate all 6 existing `letter-spacing` declarations across CSS files (latch-explorers.css, projection-explorer.css, help-overlay.css, command-palette.css, audit.css, SuperGrid.ts inline) — check for redundancy, consider design token consolidation

### deleted_at null-safety
- Full audit of ALL non-SQL code paths that access `card.deleted_at` — not just known crash paths
- Convention: `null deleted_at` = active card (matches existing SQL convention `deleted_at IS NULL`)
- No helper function or sentinel value — TypeScript already types `deleted_at: string | null`; fix spots that aren't handling null correctly
- Key files to audit: NativeBridge.ts (sync merge), inverses.ts (undo/redo), exporters (CSV/JSON/Markdown), DedupEngine.ts, etl/types.ts, database/queries/helpers.ts

### Verification strategy
- Extend existing E2E specs (`filter-histogram.spec.ts`, `notebook-chart.spec.ts`) with SVG text assertions
- Assert BOTH computed CSS (`getComputedStyle(svgText).letterSpacing === 'normal'`) AND text content readability
- Integration round-trip test for null deleted_at: import card with null deleted_at, verify export produces correct output without crash
- Browser coverage for SVG fix: Claude's discretion based on BUGF-02 requirement (Safari/Chrome/Firefox verification required)

### Claude's Discretion
- Whether to run E2E SVG tests across all 3 Playwright browsers or Chromium-only (BUGF-02 says Safari/Chrome/Firefox but Claude judges CI tradeoff)
- Exact letter-spacing consolidation approach (design tokens vs keeping per-component declarations)
- Which specific non-SQL deleted_at paths need runtime guards vs are already safe

</decisions>

<specifics>
## Specific Ideas

- The SVG letter-spacing bug manifests as visually garbled axis labels in chart blocks and histogram scrubber tick marks — letters are spaced apart unnaturally
- Keep existing letter-spacing on HTML elements (section headers, badges) — those are intentional design choices. The SVG reset prevents inheritance, not removal.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HistogramScrubber.ts`: D3 SVG mini bar chart with d3.brushX — creates SVG text for axis ticks
- `ChartRenderer.ts` + `BarChart.ts`, `PieChart.ts`, `LineChart.ts`, `ScatterChart.ts`: all create SVG text elements for labels/legends
- `filter-histogram.spec.ts` and `notebook-chart.spec.ts`: existing E2E specs that exercise SVG-rendering code paths

### Established Patterns
- CSS design token system (`--text-xs`..`--text-xl` typography scale) — letter-spacing consolidation should align with this
- D3 data join with key function (D-003 mandatory) — all SVG rendering follows this pattern
- `deleted_at: string | null` type defined in both `etl/types.ts` and `database/queries/types.ts`
- FilterProvider always starts with `deleted_at IS NULL` as base WHERE clause

### Integration Points
- 6 CSS files with `letter-spacing` rules that can inherit into SVG: `latch-explorers.css`, `projection-explorer.css`, `help-overlay.css`, `command-palette.css`, `audit.css`, `SuperGrid.ts` (inline style)
- 67 files reference `deleted_at` — SQL paths are safe; non-SQL paths (NativeBridge sync merge, undo/redo inverses, ETL exporters) need audit
- `database/queries/helpers.ts:60` already handles null mapping with `?? null` — this pattern should be verified consistent

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 69-bug-fixes*
*Context gathered: 2026-03-11*
