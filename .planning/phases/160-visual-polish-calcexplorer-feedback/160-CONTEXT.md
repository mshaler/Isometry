# Phase 160: Visual Polish + CalcExplorer Feedback - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Explorer layout has clear visual boundaries between the 4 layout zones (DockNav, top-slot explorers, view content, bottom-slot explorers) and CalcExplorer provides visual feedback on active aggregations and column types. Deliverable: distinct visual boundaries via borders + standardized padding, consistent typography hierarchy across all 8 explorers, and CalcExplorer active/type indicators.

</domain>

<decisions>
## Implementation Decisions

### Visual Boundaries (VCSS-05)
- **D-01:** Borders only — keep existing 1px `--border-subtle` between zones. No background shifts, no gap-based separation.
- **D-02:** DockNav strip keeps its current treatment — no additional visual differentiation needed.
- **D-03:** Standardize padding at the slot level — add consistent padding (`--space-2` or `--space-3`) to `.workbench-slot-top` and `.workbench-slot-bottom`. Individual explorers inherit uniform spacing from their containing slot.

### Typography Hierarchy (VCSS-06)
- **D-04:** Explorer panel headers: `--text-base` (13px) with `font-weight: 600` (semi-bold).
- **D-05:** Explorer labels: `--text-sm` (11px) with `font-weight: 400` (normal).
- **D-06:** Explorer meta/hints: `--text-xs` (10px) with `font-weight: 400`.
- **D-07:** This 3-tier scale (base-semibold / sm-normal / xs-normal) applies consistently across all 8 explorers.

### Active Aggregation Indicator (EXPX-08)
- **D-08:** Active columns (aggregation != 'off') get `font-weight: 600` and `color: var(--text-primary)` on their label. Inactive columns ('off') stay at `font-weight: 400` and `color: var(--text-secondary)`.
- **D-09:** Label only — the `<select>` dropdown stays visually neutral regardless of active/off state.

### Column Type Indicators (EXPX-09)
- **D-10:** Glyph prefix: `#` before numeric column names, `Aa` before text column names. Prepended to the label text.
- **D-11:** Type glyph rendered in `--text-muted` color — visible but secondary to the column name. Does not change based on active/inactive state.

### Claude's Discretion
- Exact padding token for slot-level standardization (`--space-2` vs `--space-3` — whichever looks right)
- Whether type glyph is a separate `<span>` or prepended inline to label text
- Order of CSS changes across the 8 explorer files
- Whether `.calc-row` hardcoded padding (`4px 8px`) migrates to tokens in this phase or stays (Phase 155 D-04 says spacing should be tokenized)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `src/styles/design-tokens.css` — Master token definitions (spacing, color, typography). All values must come from here.

### Layout Targets
- `src/styles/workbench.css` lines 77-107 — `.workbench-slot-top`, `.workbench-slot-bottom` slot containers (VCSS-05 boundary targets)
- `src/styles/workbench.css` lines 548-573 — `.calc-row`, `.calc-select` styles (EXPX-08/09 targets)
- `src/styles/dock-nav.css` — DockNav strip styles (boundary reference — no changes expected)

### CalcExplorer Source
- `src/ui/CalcExplorer.ts` — `_render()` method builds rows with label + select. `_isNumeric()` already detects column type. `_displayName()` provides display labels.

### Explorer CSS Files (typography audit targets)
- `src/styles/algorithm-explorer.css`
- `src/styles/visual-explorer.css`
- `src/styles/projection-explorer.css`
- `src/styles/latch-explorers.css`
- `src/styles/properties-explorer.css`
- `src/styles/data-explorer.css`
- `src/styles/notebook-explorer.css`
- `src/styles/catalog-actions.css`

### Prior Context
- `.planning/phases/155-css-namespace-design-token-audit/155-CONTEXT.md` — D-03 (no fallback values), D-04 (zero-hardcoded scope)

### Requirements
- `.planning/REQUIREMENTS.md` — VCSS-05, VCSS-06, EXPX-08, EXPX-09

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CalcExplorer._isNumeric()**: Already detects numeric vs text columns via SchemaProvider — no new detection logic needed for EXPX-09.
- **CalcExplorer._displayName()**: Returns alias-aware column names — type glyph should prepend to this output.
- **Design tokens**: Full typography scale (`--text-xs` through `--text-xl`) and spacing scale already defined.

### Established Patterns
- **BEM namespace convention**: All explorers use `.[explorer-name]__*` selectors (Phase 155).
- **No fallback values**: `var(--token)` without fallback — breakage surfaces immediately (Phase 155, D-03).
- **CalcExplorer styles in workbench.css**: `.calc-row` and `.calc-select` live in workbench.css, not a dedicated explorer CSS file. Still has hardcoded `4px 8px` padding and fallback values from Phase 62.

### Integration Points
- **CalcExplorer._render()**: Label/glyph/weight changes happen in the `_render()` method where `<label>` and `<select>` elements are created.
- **Slot containers**: Padding standardization goes on `.workbench-slot-top` and `.workbench-slot-bottom` in workbench.css.
- **Explorer headers**: Each explorer's header element needs typography token alignment — scattered across 8 CSS files.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 160-visual-polish-calcexplorer-feedback*
*Context gathered: 2026-04-18*
