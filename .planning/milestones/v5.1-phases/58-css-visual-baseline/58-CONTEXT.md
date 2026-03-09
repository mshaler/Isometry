# Phase 58: CSS Visual Baseline - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate SuperGrid cells and headers from inline `.style.` assignments to semantic CSS classes driven by `--sg-*` design tokens. Zero presentational inline styles for border, padding, or background color on cell and header elements. Toolbar, tooltips, dropdowns, and context menus are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Zebra stripe appearance
- Subtle stripe (~2-3% opacity shift, Google Sheets style) — guides the eye without visual noise
- Per-row alternation (every other data row), not per row-group
- Spreadsheet mode only — matrix mode does not get zebra stripes (row-group borders provide separation)
- Dedicated `--sg-cell-alt-bg` token with theme-aware values in both dark and light palettes (not reusing existing `--cell-alt`)

### Cell padding by mode
- Tight spreadsheet (2-4px), spacious matrix (6-8px) — clear visual density distinction between modes
- Zoom factor (`--sg-zoom`) continues to scale padding in both modes via `calc(Xpx * var(--sg-zoom, 1))`
- Own `--sg-cell-padding-spreadsheet` and `--sg-cell-padding-matrix` pixel-value tokens (not referencing the `--space-*` scale — grid cells have unique density needs)
- Mode selected via `data-view-mode` attribute on grid container div (`[data-view-mode="spreadsheet"]` / `[data-view-mode="matrix"]`), not per-cell classes

### Migration boundary
- **In scope:** Cell and header element visual properties (border, padding, background, font styles)
- **Out of scope:** Toolbar (~40 inline styles), tooltips/context menus/filter dropdowns (~60 inline styles) — these stay as inline styles for now
- **Always inline:** Dynamic positional styles (gridRow, gridColumn, position: sticky, left/top offsets) — CSS = appearance, inline = layout position
- Selection highlight migrates to `.sg-selected` class in supergrid.css — SuperGridSelect.ts toggles the class instead of setting inline backgroundColor/outline/outlineOffset

### Header visual treatment
- Column headers and row headers share the same `sg-header` class — identical bg, font-weight, and border treatment
- Own `--sg-header-bg` token formalized in design-tokens.css (code already references `var(--sg-header-bg, var(--bg-surface))` in ~8 places — promote to real token, start with same value as `--bg-surface`)
- `--sg-frozen-shadow` token defined as a box-shadow value (CSSB-01 requirement, needed by Phase 60 Row Index Gutter)
- Headers use same font size as data cells (`--sg-cell-font-size`), differentiated by `font-weight: bold` only — no separate header font size token

### Claude's Discretion
- Exact opacity values for `--sg-cell-alt-bg` in dark vs light themes
- Exact pixel values for spreadsheet vs matrix padding (within the 2-4px / 6-8px ranges)
- `--sg-frozen-shadow` box-shadow value
- Border color choice for `--sg-gridline` token (likely `--border-subtle`)
- Whether `--sg-number-font` uses system monospace or a specific font stack

</decisions>

<specifics>
## Specific Ideas

- The existing fallback pattern `var(--sg-header-bg, var(--bg-surface))` already appears in ~8 places in SuperGrid.ts — formalizing the token should make those fallbacks unnecessary
- The `data-view-mode` attribute approach means mode switching requires only one attribute change on the container, no per-cell class updates
- CSSB-02 requires these semantic classes: `sg-cell`, `sg-header`, `sg-selected`, `sg-row--alt`, `sg-numeric`, `sg-row-index`, `sg-corner-cell`
- CSSB-01 requires these tokens: `--sg-cell-padding`, `--sg-cell-font-size`, `--sg-cell-alt-bg`, `--sg-header-bg`, `--sg-gridline`, `--sg-selection-border`, `--sg-selection-bg`, `--sg-number-font`, `--sg-frozen-shadow`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `design-tokens.css`: Mature multi-theme system (dark/light/system) with spacing, radius, typography scales — new `--sg-*` tokens slot into this file
- `supergrid.css`: Currently minimal (content-visibility for virtual scroll) — will become the home for all semantic class rules
- Existing theme-aware tokens already referenced by SuperGrid inline styles: `--border-subtle`, `--border-muted`, `--bg-surface`, `--cell-hover`, `--cell-alt`, `--selection-bg`, `--selection-outline`, `--text-sm`, `--text-xs`

### Established Patterns
- CSS custom properties with var() fallbacks: `var(--sg-header-bg, var(--bg-surface))` pattern already in use
- `content-visibility: auto` on `.data-cell` for virtual scroll performance (must not be broken)
- `[data-theme]` attribute selector pattern for theme scoping — `[data-view-mode]` follows the same convention
- Design token test pattern: CSS file read as text with token presence assertions (tests/styles/design-tokens.test.ts)

### Integration Points
- `SuperGrid.ts` (main file, ~3800 lines): 200+ inline `.style.` assignments, ~100 of which target cells/headers (in scope)
- `SuperGridSelect.ts`: Selection highlight inline styles (backgroundColor, outline, outlineOffset) — migrates to `.sg-selected` class toggle
- `views.css`: Has `.data-cell:focus-visible` rule — may need coordination with new `.sg-cell` class
- `design-tokens.css` body transition list includes `.data-cell` — may need `.sg-cell` added

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 58-css-visual-baseline*
*Context gathered: 2026-03-08*
