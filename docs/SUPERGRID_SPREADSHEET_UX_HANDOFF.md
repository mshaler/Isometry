# SuperGrid Spreadsheet UX — Handoff to Claude Code

**When to apply:** Next milestone, as a dedicated polish sprint. This is not a bug fix — it is a
targeted UX upgrade to make SuperGrid's spreadsheet mode read as a genuine spreadsheet rather than
a card board embedded in a grid.

**Source:** Cross-model review (Gemini + Codex) of SuperGrid's visual and interaction model,
synthesized and arbitrated by Claude.

**Scope:** Four tightly scoped work areas. No new data model. No new providers. No new routes.
All existing tests must stay green. Zero new runtime dependencies.

**TypeScript errors remain P0 — zero allowed after this pass.**

---

## Context

SuperGrid already has strong spreadsheet primitives: sticky headers, virtual scrolling, column
resize, lasso selection, sort, filter, FTS5 search. The gap is perceptual, not functional. Two
independent reviewers converged on the same diagnosis: the spreadsheet mode still reads as a card
board because card affordances dominate the primary reading path.

The highest-leverage changes are:
1. Value-first cell rendering in spreadsheet mode (replaces card-pill-first rendering)
2. A row index gutter and CSS visual baseline (gridlines, zebra striping, compact tokens)
3. Active-cell focus model with row/column crosshair highlight
4. CSS token migration for the inline styles that fight consistency

All work is scoped to:
- `src/views/SuperGrid.ts`
- `src/views/supergrid/SuperStackHeader.ts`
- `src/styles/supergrid.css`
- `src/styles/design-tokens.css` (token additions only)

Read each file's current state before making changes.

---

## Work Area 1 — Value-First Spreadsheet Rendering (P0)

**The core fix. Both reviewers identified this independently.**

### Problem

In spreadsheet mode, each non-empty cell prepends a dashed italic `supergrid-card` count chip
and renders card pills as the primary visual. Reference: `SuperGrid.ts:1927-1985` (approximate —
read current file). This makes cells read as card containers, not as data cells.

### Fix: `spreadsheet-classic` rendering path

Add a `spreadsheet-classic` rendering mode alongside the existing `spreadsheet` mode. The new
mode is activated when `densityProvider.viewMode === 'spreadsheet'` AND a new `classicSheet`
boolean flag is `true` (default `true` — ship classic as the default, keep legacy as opt-in for
one release cycle then remove).

**Cell rendering rules for `spreadsheet-classic`:**

| Cell contents | Renders as |
|---------------|-----------|
| 0 cards | Empty cell — `''` |
| 1 card | Card name as plain text, single line, `text-overflow: ellipsis` |
| 2+ cards | First card name + `+N` count badge (e.g. `"Project Alpha +3"`) |

Implementation:

```ts
// In _renderCells(), replace the spreadsheet pill-rendering block with:
if (viewMode === 'spreadsheet' && this._classicSheet) {
  const cards = cellCardIds.map(id => this._cardNameCache.get(id) ?? id);
  if (cards.length === 0) {
    cellEl.textContent = '';
  } else if (cards.length === 1) {
    cellEl.textContent = cards[0];
  } else {
    const nameSpan = document.createElement('span');
    nameSpan.className = 'sg-cell-primary-value';
    nameSpan.textContent = cards[0];

    const badge = document.createElement('span');
    badge.className = 'sg-cell-overflow-badge';
    badge.textContent = `+${cards.length - 1}`;

    cellEl.replaceChildren(nameSpan, badge);
  }
  cellEl.classList.add('sg-cell--value-first');
  return; // early return from pill rendering
}
```

**Card name cache:** Add `private _cardNameCache = new Map<string, string>()` populated from
the query result rows (`row.name` keyed by `row.id`) at query time in `_fetchAndRender()`.
Invalidate on every `_fetchAndRender()` call.

**SuperCard tooltip:** The existing SuperCard hover tooltip must still appear on `+N` badge
hover. Wire the tooltip trigger to the `.sg-cell-overflow-badge` element, not the whole cell.
This preserves full card exploration without it being the default visual.

**Search mark preservation:** FTS5 `<mark>` highlighting from `_applySearchMarks()` must
still work in classic mode. Apply marks after text content is set using the existing DOM
walking logic. The `text-overflow: ellipsis` on `.sg-cell-primary-value` will clip long
highlighted names gracefully.

**CSS to add in `supergrid.css`:**

```css
.sg-cell--value-first {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
}

.sg-cell-primary-value {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  font-size: var(--sg-cell-font-size, 12px);
  color: var(--text-primary);
}

.sg-cell-overflow-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  padding: 0 4px;
  line-height: 16px;
  cursor: default;
}
```

**Regression test to add:**

- Mount SuperGrid in spreadsheet mode with one card per cell. Assert cell contains plain text
  (card name), not a `.supergrid-card` pill element.
- Mount with 3 cards per cell. Assert cell contains primary name + `.sg-cell-overflow-badge`
  with text `+2`.
- Assert existing FTS5 `<mark>` elements are still present after `_applySearchMarks()` runs.

---

## Work Area 2 — CSS Visual Baseline (P0)

**Low implementation cost. High perceptual impact.**

### Problem

Visual consistency is enforced through inline style mutation scattered across `SuperGrid.ts`
(~510-750, ~1919-2024, ~3443-3683). `supergrid.css` is minimal (~18 lines). Pixel values and
color literals are hardcoded rather than driven by tokens. This makes visual changes require
grep-and-replace across TypeScript.

### Fix: Expand `supergrid.css` + add tokens

**Step 1 — Add tokens to `design-tokens.css` (additions only, no removals):**

```css
/* SuperGrid structural tokens */
--sg-cell-padding:         2px 6px;
--sg-cell-font-size:       12px;
--sg-cell-alt-bg:          rgba(255, 255, 255, 0.025);   /* zebra stripe — dark theme */
--sg-header-bg:            var(--bg-surface);
--sg-gridline:             var(--border-subtle);
--sg-selection-border:     var(--accent);
--sg-selection-bg:         rgba(26, 86, 240, 0.08);
--sg-number-font:          'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;
--sg-frozen-shadow:        2px 0 4px rgba(0, 0, 0, 0.15);  /* sticky col right-edge shadow */
```

**Step 2 — Add semantic classes to `supergrid.css`:**

```css
/* ── Grid container ─────────────────────────────────── */
.sg-grid {
  font-size: var(--sg-cell-font-size);
}

/* ── Cells ──────────────────────────────────────────── */
.sg-cell {
  padding: var(--sg-cell-padding);
  border-right: 1px solid var(--sg-gridline);
  border-bottom: 1px solid var(--sg-gridline);
  box-sizing: border-box;
  overflow: hidden;
}

.sg-cell--empty {
  background-color: transparent;
}

.sg-cell--populated {
  background-color: transparent;
}

/* Zebra striping — applied via JS to even row groups */
.sg-row--alt .sg-cell {
  background-color: var(--sg-cell-alt-bg);
}

/* ── Headers ────────────────────────────────────────── */
.sg-header {
  background-color: var(--sg-header-bg);
  border-right: 1px solid var(--sg-gridline);
  border-bottom: 1px solid var(--border-muted);
  padding: var(--sg-cell-padding);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sg-header--sticky-left {
  box-shadow: var(--sg-frozen-shadow);
}

/* ── Selection ──────────────────────────────────────── */
.sg-selected {
  background-color: var(--sg-selection-bg) !important;
  outline: 2px solid var(--sg-selection-border);
  outline-offset: -2px;
}

/* ── Active cell ────────────────────────────────────── */
.sg-cell--active {
  outline: 2px solid var(--sg-selection-border);
  outline-offset: -2px;
}

.sg-col--active-crosshair .sg-header {
  background-color: var(--accent-bg);
  color: var(--accent);
}

.sg-row--active-crosshair .sg-cell {
  background-color: rgba(26, 86, 240, 0.04);
}

/* ── Count badges / numeric content ─────────────────── */
.sg-numeric {
  font-family: var(--sg-number-font);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ── Row index gutter ───────────────────────────────── */
.sg-row-index {
  font-family: var(--sg-number-font);
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  color: var(--text-tertiary);
  text-align: right;
  padding: var(--sg-cell-padding);
  border-right: 1px solid var(--border-muted);
  background-color: var(--sg-header-bg);
  user-select: none;
  pointer-events: none;
}

/* ── Mode-scoped overrides ───────────────────────────── */
[data-view-mode="spreadsheet"] .sg-grid {
  --sg-cell-padding: 2px 6px;
}

[data-view-mode="matrix"] .sg-grid {
  --sg-cell-padding: 4px 8px;
}
```

**Step 3 — Apply `sg-cell` and `sg-header` classes in `_renderCells()` and `_createColHeaderCell()`:**

When constructing cell elements, add `sg-cell` (and `sg-cell--empty` or `sg-cell--populated`
as appropriate) to the class list. Do the same for header elements with `sg-header`.

Do NOT remove existing inline styles that encode data-driven values (e.g., `grid-column`,
`grid-row`, `width` from `_sizer`). Remove only presentational inline styles that duplicate
what the new CSS classes handle (border, padding, background-color in non-selected state).

**Zebra striping:** In `_renderCells()`, after row groups are determined, add `sg-row--alt` to
the CSS grid row track container for every other row-value group. Since SuperGrid uses CSS Grid
for layout, add the class to the row-spanning header element for each row group and propagate
via a CSS attribute-based row marker (`[data-row-index]` even/odd selector).

**Step 4 — Migrate `sg-selected` class into `_updateSelectionVisuals()`:**

This is already specified in the Bug Fix handoff (Fix 6 — `sg-selected` sentinel class). If
that fix is already applied, this work area requires only verifying `sg-selected` uses the
token `--sg-selection-bg` rather than a hardcoded color literal.

**No regression tests needed for token/class migration** — existing render tests cover
correctness. If visual regression snapshots exist, update baselines.

---

## Work Area 3 — Row Index Gutter (P0)

**The single biggest perceptual signal that this is a spreadsheet.**

### Problem

SuperGrid has no row number gutter. Classic spreadsheets (Excel, Sheets, Airtable) universally
show a fixed-width left column with sequential row numbers (1, 2, 3…). Its absence is the
primary reason SuperGrid reads as a "card matrix" rather than a "sheet."

### Fix: Row index gutter column

Add a fixed-width `sg-row-index` column as the leftmost column of the CSS Grid layout, to the
left of the row header hierarchy.

**Implementation:**

In `_buildGridTemplate()` (or wherever `grid-template-columns` is assembled), prepend a fixed
`28px` track for the row index gutter:

```ts
// Before:
const colTemplate = [rowHeaderWidth, ...colWidths].join(' ');

// After:
const gutterWidth = this._showRowIndex ? '28px' : '0px';
const colTemplate = [gutterWidth, rowHeaderWidth, ...colWidths].join(' ');
```

Add a private field:
```ts
/** Controls row index gutter visibility. Default true in spreadsheet mode. */
private _showRowIndex = true;
```

In `_renderCells()`, after row values are determined and before cells are placed, emit one gutter
cell per row value:

```ts
// After row values loop — emit gutter cells
if (this._showRowIndex) {
  rowValues.forEach((_, rowIdx) => {
    const gutterEl = document.createElement('div');
    gutterEl.className = 'sg-row-index';
    gutterEl.textContent = String(rowIdx + 1);
    gutterEl.style.gridRow = `${rowGridRow}`;
    gutterEl.style.gridColumn = '1'; // always column 1
    gridEl.appendChild(gutterEl);
  });
}
```

The corner cell (intersection of row index gutter and column header row) should render a
`sg-corner-cell` div:

```ts
const cornerEl = document.createElement('div');
cornerEl.className = 'sg-corner-cell';
// No content — cosmetic spacer
```

**CSS for corner cell:**

```css
.sg-corner-cell {
  background-color: var(--sg-header-bg);
  border-right: 1px solid var(--border-muted);
  border-bottom: 1px solid var(--border-muted);
  grid-row: 1;
  grid-column: 1;
  position: sticky;
  top: 0;
  left: 0;
  z-index: 4; /* above row headers (z=2) and col headers (z=3) */
}
```

**Mode coupling:** `_showRowIndex` defaults to `true` when `densityProvider.viewMode ===
'spreadsheet'` or `'spreadsheet-classic'`. It is `false` in `matrix` mode. The density
subscriber in `SuperGrid.ts` should update `_showRowIndex` accordingly and trigger a re-render.

**Do NOT** make the gutter interactive in this pass (no select-all on click, no row selection
highlight from gutter). Those are Phase D (future) additions. The gutter is visual-only.

**Regression test to add:**
- Mount in spreadsheet mode. Assert the DOM contains `.sg-row-index` elements equal in count
  to the number of visible row values.
- Mount in matrix mode. Assert no `.sg-row-index` elements are present.

---

## Work Area 4 — Active Cell Focus Model (P1)

**Implement after Work Areas 1–3 and after the Bug Fix pass (Fix 6) is applied.**

### Problem

SuperGrid has selection (multi-cell, lasso, Cmd+click) but no concept of an "active cell" —
the single focused cell that keyboard navigation and formula bars address in classic
spreadsheets. The absence of an active cell focus ring is a significant perceptual gap.

### Fix: Active cell state

Add a single active cell concept tracked independently of the multi-cell selection.

**Private state:**
```ts
/** The currently active (last-clicked or keyboard-navigated) cell key. */
private _activeCellKey: string | null = null;
```

**Setting the active cell:** On single cell click (not lasso start), set `_activeCellKey` to
the clicked cell's key. On lasso end with a range, set `_activeCellKey` to the anchor cell
(the cell where the lasso began). On `Escape`, clear `_activeCellKey`.

**Visual rendering of active cell** — add to `_updateSelectionVisuals()`:
```ts
// Clear previous active cell
this._gridEl?.querySelectorAll('.sg-cell--active').forEach(el => {
  el.classList.remove('sg-cell--active');
});
this._gridEl?.querySelectorAll('.sg-col--active-crosshair, .sg-row--active-crosshair').forEach(el => {
  el.classList.remove('sg-col--active-crosshair', 'sg-row--active-crosshair');
});

if (this._activeCellKey) {
  const activeEl = this._gridEl?.querySelector(`[data-key="${this._activeCellKey}"]`);
  if (activeEl) {
    activeEl.classList.add('sg-cell--active');

    // Crosshair: highlight the active cell's column header and row header
    const colKey = activeEl.dataset['colKey'];
    const rowKey = activeEl.dataset['rowKey'];

    if (colKey) {
      this._gridEl?.querySelectorAll(`[data-col-key="${colKey}"].sg-header`)
        .forEach(el => el.classList.add('sg-col--active-crosshair'));
    }
    if (rowKey) {
      // Row crosshair: add to all cells in the row
      this._gridEl?.querySelectorAll(`[data-row-key="${rowKey}"].sg-cell`)
        .forEach(el => el.classList.add('sg-row--active-crosshair'));
    }
  }
}
```

**Fill handle affordance (visual only):** When `_activeCellKey` is set, render a 6×6px
`sg-fill-handle` div absolutely positioned at the bottom-right corner of the active cell:

```css
.sg-fill-handle {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 6px;
  height: 6px;
  background-color: var(--sg-selection-border);
  border: 1px solid var(--bg-primary);
  cursor: crosshair;
  z-index: 5;
  pointer-events: none; /* visual only — not interactive in this pass */
}
```

The active cell element needs `position: relative` to host the fill handle. Add to `.sg-cell`:
```css
.sg-cell {
  position: relative;
  /* ...existing properties... */
}
```

**Scope:** Active cell is visual only in this pass. No keyboard arrow-key navigation (that is
Work Area 5, future). No formula bar. No range-fill behavior on the fill handle. The fill
handle is a perceptual affordance, not a functional one.

**Regression test to add:**
- Click a cell. Assert `sg-cell--active` is present on that cell element.
- Assert corresponding column header has `sg-col--active-crosshair`.
- Assert the row's cells have `sg-row--active-crosshair`.
- Click a different cell. Assert `sg-cell--active` has moved and the old crosshair classes
  are cleared.

---

## Permanently Out of Scope for This Pass

The following were recommended by the reviewers but are deferred or rejected:

| Recommendation | Decision | Reason |
|---------------|----------|--------|
| Arrow-key cell navigation | **Deferred — Phase D** | Conflicts with lasso interaction model; requires focus management architecture not yet designed |
| Tab/Enter flow navigation | **Deferred — Phase D** | Same dependency as arrow-key nav |
| Functional fill handle (range-fill) | **Deferred — future milestone** | No data model support for range-fill semantics |
| A/B/C column letters as primary headers | **Rejected** | Anti-PAFV: SuperGrid columns are semantic LATCH facet projections, not positional indices |
| Toolbar IA split (Sheet vs. Data controls) | **Deferred — SuperFilter/SuperSearch context** | Correct architectural direction; implement when toolbar has enough controls to split meaningfully |
| Visual regression snapshot tests | **Deferred — post-stabilization** | Add after inline style migration settles; adding now against inline styles creates maintenance burden |
| "Classic" optional column letters (A/B/C secondary) | **Deferred** | Low-value given semantic headers; revisit if user research demands it |

---

## Execution Order

Apply work areas in this sequence:

1. **Bug Fix Pass first** — `SUPERGRID_BUG_FIX_HANDOFF.md` must be applied and green before
   this work begins. Specifically Fix 6 (lasso/selection bleed + `sg-selected` class) is a
   direct prerequisite for Work Area 4.
2. **Work Area 2** — CSS tokens and classes (`design-tokens.css` + `supergrid.css`). No
   TypeScript changes. Establishes the visual vocabulary the other work areas depend on.
3. **Work Area 1** — Value-first rendering. TypeScript changes to `_renderCells()` only.
   The CSS classes from Work Area 2 must exist first.
4. **Work Area 3** — Row index gutter. TypeScript changes to grid template assembly and cell
   rendering. CSS class `sg-row-index` from Work Area 2 must exist first.
5. **Work Area 4** — Active cell focus model. Depends on `sg-selected` sentinel class from the
   Bug Fix pass and CSS classes from Work Area 2.

---

## Success Criteria

- All pre-existing tests pass (zero regressions)
- 4 new regression tests added (one per Work Area)
- Zero TypeScript errors (`npx tsc --noEmit`)
- `npx vitest run` reports all tests green
- In spreadsheet mode: cells containing 1 card show card name as plain text (no pill elements)
- In spreadsheet mode: cells containing N>1 cards show first card name + `+N-1` badge
- SuperCard tooltip still accessible on `+N` badge hover
- FTS5 search marks still appear within card name text in classic mode
- Row index gutter (1..N) is visible in spreadsheet mode, hidden in matrix mode
- Active cell has visible focus ring + row/column crosshair highlight
- Selected cells retain their blue tint after a canceled lasso drag
- No new runtime dependencies added

---

*Prepared by Claude (claude.ai) — to be executed by Claude Code.*
*Source: Gemini + Codex review of SuperGrid v5.0, synthesized and arbitrated by Claude.*
*Prerequisite: `SUPERGRID_BUG_FIX_HANDOFF.md` applied and green.*
