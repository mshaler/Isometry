# Phase 62: SuperCalc Footer Rows - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Display live SQL aggregate calculations (SUM/AVG/COUNT/MIN/MAX) at the bottom of each row group in SuperGrid. Users configure per-column aggregate functions via a new Workbench panel section. Footer rows update automatically when filters, density, or axis assignments change. Aggregation runs as a separate Worker query (`supergrid:calc`) using SQL GROUP BY.

</domain>

<decisions>
## Implementation Decisions

### Footer row placement
- Inline at group bottom — footer renders as the last row of each group, scrolls with data
- Footer rows bypass the virtualizer — always rendered in DOM even when their group's data rows are windowed out (small DOM cost: one row per group)
- Always show footer even with a single group (acts as grand total row) — consistent behavior regardless of axis configuration
- When a SuperStack group is collapsed, footer row remains visible (group header + footer row shown, data rows hidden) — pivot table summary behavior

### Workbench config panel
- New 5th CollapsibleSection in WorkbenchShell panel rail (after LATCH) — dedicated "Calc" section with icon Σ or 🧮
- Per-column `<select>` dropdown showing available aggregate functions (SUM/AVG/COUNT/MIN/MAX/OFF) — compact, scannable, familiar spreadsheet pattern
- Only columns currently assigned to row/col axes appear in the Calc panel — list updates dynamically when axes change
- Each column includes an OFF option to suppress footer calculation for that column (shows blank/dash)
- Calc config persisted via `ui:set` with key `calc:config` — survives reload and syncs via CloudKit checkpoint

### Footer visual styling
- Subtle background tint + bold text — `--sg-header-bg` at 50% opacity, distinguishable but not jarring
- Footer cells show label prefix: "SUM: 42", "AVG: 3.7", "COUNT: 5" — clear what the number means at a glance (small text for label, normal for value)
- Row index gutter cell shows Σ symbol instead of a number — compact, universally understood
- Numeric values formatted with `Intl.NumberFormat` — locale-aware separators, SUM/COUNT as integers, AVG/MIN/MAX with up to 2 decimal places

### Column type defaults
- Numeric columns default to SUM — matches spreadsheet conventions
- Text columns default to COUNT — the only meaningful aggregate for text
- Column type detected via hardcoded field mapping (the 9 AxisField values are fixed and known at build time)
- Text columns locked to COUNT + OFF only in their dropdown — SUM/AVG on text is meaningless, prevents confusing results
- Text column footer shows "COUNT: N" with same label prefix pattern as numeric columns

### Claude's Discretion
- Exact CSS class names and token values for footer row styling
- `supergrid:calc` Worker message payload/response shape (parallel to existing `supergrid:query`)
- Calc section mount/update/destroy lifecycle implementation details
- How to handle edge cases (empty groups, NULL values in aggregation)
- Loading/transition behavior during recalculation
- Dark mode token derivation for footer tint

</decisions>

<specifics>
## Specific Ideas

- Footer rows should feel like a pivot table summary — collapsed groups show header + footer, expanded groups show header + data + footer
- Σ symbol in the gutter is a strong visual anchor — keeps the row index column meaningful for footer rows
- The Calc panel should feel as lightweight as the existing LATCH section — not overwhelming

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGridQuery.buildSuperGridQuery()`: Already supports `AggregationMode` (count/sum/avg/min/max) from Phase 55 — the calc query can reuse this with per-group GROUP BY
- `AggregationMode` type in `src/providers/types.ts`: Exact type needed for function selection
- `CollapsibleSection`: Reusable panel primitive with mount/destroy lifecycle, localStorage persistence, ARIA disclosure — new Calc section follows same pattern
- `WorkerBridge` protocol: Typed `WorkerPayloads`/`WorkerResponses` — new `supergrid:calc` message type follows existing pattern
- `supergrid.handler.ts`: Existing handler with `_columnarToRows()` helper and prepare/all SQL execution pattern
- CSS `--sg-*` design tokens: 9 structural tokens + 7 semantic classes — footer rows add `sg-footer` class
- `SuperGridVirtualizer`: Row windowing with OVERSCAN_ROWS — footer rows excluded from windowing range
- `ui:get`/`ui:set` Worker messages: Existing persistence pattern for calc config storage

### Established Patterns
- Worker message protocol: `domain:action` naming (e.g., `supergrid:calc`), typed payloads via protocol.ts
- SQL GROUP BY for aggregation with `validateAxisField()` allowlist (D-003 SQL safety)
- CSS Grid layout with sticky positioning for headers — footer rows use similar grid placement
- D3 `selection.join` for cell rendering — footer cells can use separate join keyed by group
- `mount/update/destroy` lifecycle for all Workbench explorer panels
- `Intl.NumberFormat` not yet used but standard browser API — no library needed

### Integration Points
- `WorkbenchShell.SECTION_CONFIGS` array: Add 5th entry for Calc section
- `src/worker/protocol.ts`: Add `supergrid:calc` to `WorkerRequestType` union, `WorkerPayloads`, `WorkerResponses`
- `src/worker/worker.ts`: Add handler routing for `supergrid:calc` message type
- `SuperGrid._renderCells()`: Append footer rows after data rows in CSS Grid, outside virtual window
- `SuperGrid._fetchAndRender()`: Fire parallel `supergrid:calc` query alongside existing `supergrid:query`
- `src/styles/supergrid.css`: Add `sg-footer` class with tint + bold styling
- `src/main.ts`: Wire Calc section into WorkbenchShell initialization

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 62-supercalc-footer-rows*
*Context gathered: 2026-03-09*
