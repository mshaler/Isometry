# Phase 28: N-Level Foundation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

SuperGrid accepts and correctly renders any number of stacking levels on any dimension with no hard depth limit. This phase lifts the current 3-axis cap in PAFVProvider, fixes compound key generation for N-level cells, ensures correct CSS Grid positioning with asymmetric depths, and validates SuperGridQuery GROUP BY with 4+ level configurations.

Scope: STAK-01 through STAK-05 only. Row header visual rendering (RHDR), collapse modes (CLPS), drag reorder (DRAG), and polish (PRST) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Depth Policy
- Remove the hard limit entirely — no cap on axes per dimension
- PAFVProvider._validateStackedAxes drops the `if (axes.length > 3)` check
- Keep duplicate field detection and SQL allowlist validation (safety-critical)
- No new visual feedback for deep nesting — rely on existing MAX_LEAF_COLUMNS = 50 cardinality guard in SuperStackHeader
- All header levels render with uniform visual treatment (same font size, same style) — nesting structure speaks through spanning

### Compound Key Strategy
- Cell keys use \x1f-joined compound values per dimension: `'level0\x1flevel1\x1flevel2'`
- Dimension boundary (row vs. col) uses \x1e (record separator): `'rowL0\x1frowL1\x1e\x1fcolL0\x1fcolL1'` — full cell key format
- Build a shared utility function `buildCompoundKey(cell, axes)` in a new file `supergrid/keys.ts` — single source of truth for SuperGrid, SuperGridSelect, BBoxCache
- Reuse SuperStackHeader's parentPath convention (\x1f-joined ancestor values) for consistency between collapse keys, cell keys, and header keys

### Row Header Parity
- Phase 28 is foundation only — defer row header visual rendering (RHDR-01 through RHDR-04) to a later phase
- Reuse buildHeaderCells for row axis values to get correct spanning math — row headers won't render visual cells yet but the grid math is correct
- Claude's Discretion: whether to reserve CSS Grid space for row header columns in this phase or defer that to the row header phase

### Backward Compatibility
- setState() accepts any length array — the count check is simply removed; structural validation (isAxisMapping) remains
- No explicit cache/key migration needed — setColAxes/setRowAxes already reset colWidths and sortOverrides, BBoxCache.clear() fires on re-render, selection clears on axis change
- Update JSDoc comments from "Up to 3" to "Any number of" — no type changes needed (AxisMapping[] already supports any length)
- No Worker protocol changes — CellDatum's `[key: string]: unknown` already handles N dynamic axis fields; Worker handler iterates config.colAxes/rowAxes dynamically

### Claude's Discretion
- CSS Grid space reservation for asymmetric row/col depths
- Exact key builder function signature and error handling
- Test data shape for 4+ level validation tests

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperStackHeader.buildHeaderCells()`: Already handles N-depth tuples (no hardcoded limit). Run-length spanning, cardinality guard, collapse tracking all work for any depth.
- `SuperGridQuery.buildSuperGridQuery()`: Iterates `colAxes`/`rowAxes` arrays dynamically — no hardcoded limit. SELECT, GROUP BY, ORDER BY all scale to N axes.
- `validateAxisField()` from `providers/allowlist`: SQL safety validation, used by all axis-touching code. No changes needed.
- `SuperStackHeader.buildGridTemplateColumns()`: Per-column px values, zoom-scaled. Works with any leaf column count.

### Established Patterns
- \x1f (U+001F unit separator) used throughout for key separation: cellKey, parentPath, collapse keys, dataset attributes
- Defensive copies everywhere: getState(), getStackedGroupBySQL(), getColWidths() all return copies
- queueMicrotask batching for subscriber notifications (multiple mutations → one notification)
- CellDatum uses `[key: string]: unknown` for dynamic axis values — fully extensible

### Integration Points
- `PAFVProvider._validateStackedAxes()` — the 3-axis cap lives here (line 220). Remove the count check.
- `SuperGrid._renderCells()` — cellMap key construction (line 1402) uses single field. Must switch to compound key utility.
- `SuperGrid._getCellCardIds()` — parses cellKey at \x1f boundary (line 2598-2601). Must handle compound format with \x1e dimension separator.
- `SuperGrid._selectionAnchor` and shift-click range selection — uses rowKey/colKey pair. Must use compound keys.
- `SuperGridSelect` and `SuperGridBBoxCache` — consume cellKey format. Must use shared key utility.
- Worker handler `supergrid.handler.ts` — passes config through to buildSuperGridQuery. No changes expected.

</code_context>

<specifics>
## Specific Ideas

- Compound key within a dimension should match SuperStackHeader's parentPath format for consistency (same \x1f joining, same value ordering)
- The shared `keys.ts` utility should be the ONLY place that knows how to build/parse compound keys — all consumers import from there
- Tests should validate asymmetric depths explicitly (e.g., 3 row axes with 2 col axes, and vice versa)

</specifics>

<deferred>
## Deferred Ideas

- Row header visual rendering at all stacking levels (RHDR-01 through RHDR-04) — separate phase
- Collapse modes: aggregate vs. hide (CLPS-01 through CLPS-06) — separate phase
- Drag reorder within dimension (DRAG-01 through DRAG-04) — separate phase
- Selection correctness with compound keys (PRST-02) — separate phase (Polish)
- Performance budget validation at 4+ levels (PRST-03) — separate phase (Polish)

</deferred>

---

*Phase: 28-n-level-foundation*
*Context gathered: 2026-03-05*
