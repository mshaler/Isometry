# Phase 27: SuperCards + Polish - Research

**Researched:** 2026-03-05
**Domain:** D3 data join DOM augmentation, custom tooltip/context menu patterns, Vitest performance assertions
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SuperCard Visual Design**
- SuperCard REPLACES the existing count badge in matrix mode (not a separate element)
- In spreadsheet mode, SuperCard appears as the first element above card pills
- Content is COUNT ONLY (e.g. "12") — no label, no mini-summary
- Dashed border + italic text per requirements (CARD-02)
- SuperCards are ALWAYS visually distinct from heat map coloring — they do not participate in the d3.interpolateBlues gradient, even in matrix mode
- Background tint (transparent vs subtle gray): Claude's Discretion

**SuperCard Interaction**
- Click shows a tooltip with count header + scrollable list of card titles in that intersection
- Tooltip dismissed by clicking outside it (click-away pattern)
- Clicking a card title in the tooltip list SELECTS that card in the grid (adds to SelectionProvider)
- Tooltip stays open for multi-select — user can click multiple card titles
- SuperCards are excluded from ALL selection paths: single click, Cmd+click toggle, Shift+click range, lasso selection, and any future "select all" gesture (CARD-04)
- SuperCards are excluded from FTS search results and card counts (CARD-05)
- `data-supercard` attribute on SuperCard DOM elements for selection exclusion filtering
- Tooltip visual polish (shadow, animation, hover highlights): Claude's Discretion

**Help Overlay + Keyboard Shortcuts**
- Triggered by BOTH a '?' button in the SuperGrid toolbar area AND the Cmd+/ keyboard shortcut
- Scope: SuperGrid shortcuts organized by category (Navigation, Selection, Search, Sort, Filter, Zoom)
- Covers all existing shortcuts: Cmd+F (search), Escape (clear), Shift+click (range select), Cmd+click (toggle/period), Cmd+0 (zoom reset), and any others documented in code
- Right-click context menu: CUSTOM styled popup (not native browser context menu)
- Context menu matches SuperGrid visual style, can include icons and shortcut hints
- Context menu items are CONTEXT-AWARE: sort direction reflects current state, "Hide column" becomes "Show hidden (N)" when columns are hidden, filter state shown

**Performance Benchmarks**
- Vitest performance tests (`.perf.test.ts` files) with tolerance margins (e.g. 16ms +/- 20%)
- Fixed seed random generator for reproducible synthetic test data
- PLSH-01: 50x50 grid render < 16ms (tolerance ~19.2ms)
- PLSH-02: SuperGridQuery GROUP BY on 10K cards < 100ms (tolerance ~120ms)
- PLSH-03: Axis transpose reflow < 300ms (tolerance ~360ms)
- Tests only — no dev mode FPS overlay or runtime performance indicators
- CI enforcement: block merge on regression (hard guarantee)

### Claude's Discretion
- SuperCard background styling (transparent vs subtle tint)
- Tooltip visual polish level (shadow depth, fade animation, hover states)
- Exact tolerance percentages for performance benchmarks
- Help overlay layout and styling details
- Context menu animation and positioning logic

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-01 | Group intersections display generated aggregation cards showing COUNT of cards in that group | SuperCard hooks into existing D3 `.each()` cell render; `count` and `card_ids` fields already on `CellDatum`; replaces `count-badge` span in matrix mode |
| CARD-02 | SuperCards have distinct visual style (dashed border, italic text) distinguishable from data cards | CSS: `border: 1px dashed`; `font-style: italic`; NO `d3.interpolateBlues` gradient; `data-supercard` attribute on the element |
| CARD-03 | Clicking a SuperCard shows a tooltip with aggregation details (not card selection) | Click handler added inside D3 `.each()` on the SuperCard element; tooltip appended to `_rootEl` (same pattern as filter dropdown); dismissed by click-outside listener with rAF deferral |
| CARD-04 | SuperCards are excluded from SelectionProvider results (selecting all does not include SuperCards) | `classifyClickZone()` already returns `'supergrid-card'` zone and `SuperGridSelect._handlePointerDown()` already returns early for that zone; data-cell click handler already skips `zone !== 'data-cell'` |
| CARD-05 | SuperCards are excluded from FTS search results and card counts | `count` field on `CellDatum` is `0` for empty cells so they already show nothing; FTS highlight logic (`isMatch = isSearchActive && d.matchedCardIds.length > 0`) already skips zero-match cells; SuperCard exclusion from badge counts: filter out cells with `data-supercard` when computing counts |
| PLSH-01 | SuperGrid renders 50×50 cell grid in <16ms | Vitest `.perf.test.ts` file with `performance.now()` timing; 50×50 = 2,500 `CellPlacement` entries via synthetic `makeCellDatumGrid()`; fixed-seed `mulberry32` PRNG for reproducible data |
| PLSH-02 | SuperGridQuery GROUP BY on 10K cards completes in <100ms | `buildSuperGridQuery()` is pure SQL compilation (no DB call) — budget is for Worker execution; use `performance.now()` around the Worker bridge call in perf test; synthetic data seed in Worker or via `db.run()` bulk insert |
| PLSH-03 | Axis transpose reflow completes in <300ms including transition animation | Axis transpose calls `setColAxes()`/`setRowAxes()` → coordinator → `_fetchAndRender()` → `_renderCells()` + D3 opacity transition; budget measured from provider setter call to `opacity='1'` |
| PLSH-04 | All SuperGrid keyboard shortcuts documented in help overlay (Cmd+F, Escape, Shift+click, Cmd+click) | New `_helpOverlayEl` element appended to `_rootEl`; '?' button in toolbar; `Cmd+/` keydown handler on `document`; overlay dismissed with Escape or clicking outside |
| PLSH-05 | Right-click context menu on headers offers Sort, Filter, Hide options | `contextmenu` event listener on col/row header elements; custom `<div>` popup appended to `_rootEl`; `event.preventDefault()` suppresses native browser menu; items: Sort ascending/descending, Filter, Hide/Show |

</phase_requirements>

## Summary

Phase 27 is the v3.0 final phase. All work is additive augmentation of the existing `SuperGrid.ts` and `SuperGrid.test.ts` — no new provider classes, no new modules for the core features (SuperCards, help overlay, context menu all live inline as private methods and DOM state in `SuperGrid.ts`). Performance tests go into a new `SuperGrid.perf.test.ts` file.

The SuperCard implementation is intentionally minimal: it replaces the existing `count-badge` span inside the D3 `.each()` render loop with a new styled element, adds a `data-supercard` attribute for selection exclusion, and hooks a click handler for tooltip display. The tooltip pattern exactly mirrors the existing filter dropdown pattern: append to `_rootEl`, compute position via `getBoundingClientRect()`, wire a rAF-deferred click-outside listener, and store the reference for cleanup.

The right-click context menu follows the same structural pattern as the filter dropdown. The help overlay is a simple modal `<div>` appended to the document body (or `_rootEl`) with a keyboard shortcut table, toggled by the '?' button and `Cmd+/`. Performance tests use Vitest's `performance.now()` assertions in `.perf.test.ts` files (not `vitest bench`) so they run as ordinary `test()` calls in CI.

**Primary recommendation:** Deliver in 3 plans — Plan 01: SuperCard rendering + tooltip + selection/search exclusion (CARD-01 through CARD-05); Plan 02: Help overlay + right-click context menu (PLSH-04, PLSH-05); Plan 03: Performance tests (PLSH-01, PLSH-02, PLSH-03).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | ^7.9.0 (pinned in package.json) | Data join for SuperCard DOM generation inside `_renderCells()` | Already the system of record for all cell rendering |
| Vitest | ^4.0.18 (pinned) | Performance assertions via `performance.now()` | All tests use Vitest; `performance.now()` available in jsdom environment |
| TypeScript | ^5.9.3 (strict) | All new code | Non-negotiable project constraint |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom | ^28.1.0 | DOM environment for SuperGrid tests | All SuperGrid.test.ts and SuperGrid.perf.test.ts tests use `// @vitest-environment jsdom` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `performance.now()` assertions in `.perf.test.ts` | `vitest bench` (SuperGrid.bench.ts pattern) | `vitest bench` requires separate `bench` command and doesn't block CI `test` run; `performance.now()` in `test()` blocks CI on regression |
| Appending tooltip to `_rootEl` | Appending to `document.body` | `_rootEl` is the scroll container; `document.body` avoids scroll offset math; HOWEVER existing filter dropdown uses `_rootEl` with explicit scroll-offset compensation — follow that pattern for consistency |

**Installation:** No new dependencies required.

## Architecture Patterns

### Recommended Project Structure
```
src/views/
├── SuperGrid.ts              # All Phase 27 additions inline (SuperCard, tooltip, context menu, help overlay)
tests/views/
├── SuperGrid.test.ts         # CARD-01..05, PLSH-04, PLSH-05 TDD tests appended
├── SuperGrid.perf.test.ts    # NEW: PLSH-01, PLSH-02, PLSH-03 performance assertions
```

No new source modules needed. All Phase 27 code lives in `SuperGrid.ts` as private methods and DOM state fields, following the established pattern from Phases 22–26.

### Pattern 1: SuperCard in D3 .each() — Replace count-badge

**What:** Inside the existing `.each(function(d) { ... })` D3 callback in `_renderCells()`, the matrix mode branch currently renders `<span class="count-badge">`. SuperCard replaces this span with a new styled element.

**When to use:** Every `d.count > 0` cell in matrix mode. In spreadsheet mode, a smaller SuperCard element appears ABOVE the card pills (prepended as first child).

**Example pattern:**
```typescript
// Inside .each(function(d) { ... }) — matrix mode branch
// Replace the existing count-badge innerHTML block:
el.innerHTML = '';  // clear
const superCard = document.createElement('div');
superCard.className = 'supergrid-card';
superCard.setAttribute('data-supercard', 'true');
superCard.style.cssText = [
  'border: 1px dashed rgba(128,128,128,0.5)',
  'border-radius: 4px',
  'font-style: italic',
  'font-size: calc(12px * var(--sg-zoom, 1))',
  'padding: calc(4px * var(--sg-zoom, 1)) calc(8px * var(--sg-zoom, 1))',
  'cursor: pointer',
  'user-select: none',
  // NO backgroundColor from d3.interpolateBlues — SuperCards never participate in heat map
].join(';');
superCard.textContent = String(d.count);  // COUNT ONLY, no label
el.style.backgroundColor = '';  // cell remains neutral — no heat map color
// Wire tooltip click
superCard.addEventListener('click', (e: MouseEvent) => {
  e.stopPropagation();
  self._openSuperCardTooltip(superCard, d);
});
el.appendChild(superCard);
```

**Critical detail:** `el.style.backgroundColor = ''` — the cell itself does NOT get the `heatScale(d.count)` color. The SuperCard element is distinct from heat map coloring.

### Pattern 2: SuperCard Tooltip — click-away pattern from filter dropdown

**What:** A floating `<div>` tooltip anchored to the clicked SuperCard, containing a count header and scrollable list of card titles. Dismissed by click-outside.

**When to use:** On SuperCard click (CARD-03). Exact same lifecycle as `_openFilterDropdown()`.

```typescript
private _openSuperCardTooltip(anchorEl: HTMLElement, d: { count: number; cardIds: string[] }): void {
  if (!this._rootEl) return;
  this._closeSuperCardTooltip();  // close existing

  // Compute position relative to _rootEl (same as _openFilterDropdown)
  const anchorRect = anchorEl.getBoundingClientRect();
  const rootRect = this._rootEl.getBoundingClientRect();
  const top = anchorRect.bottom - rootRect.top + this._rootEl.scrollTop;
  const left = anchorRect.left - rootRect.left + this._rootEl.scrollLeft;

  const tooltip = document.createElement('div');
  tooltip.className = 'sg-supercard-tooltip';
  tooltip.style.cssText = [
    `position: absolute`,
    `top: ${top}px`,
    `left: ${left}px`,
    `z-index: 30`,  // above filter dropdown (z-index 20), above headers (z-index 2/3)
    'background: var(--sg-header-bg, #f0f0f0)',
    'border: 1px solid rgba(128,128,128,0.3)',
    'border-radius: 6px',
    'min-width: 180px',
    'max-height: 300px',
    'overflow-y: auto',
    'font-size: 12px',
  ].join(';');

  // Header: count
  const header = document.createElement('div');
  header.textContent = `${d.count} card${d.count !== 1 ? 's' : ''}`;
  // ... style header

  // Card list — clicking a card ID selects it via selectionAdapter
  for (const cardId of d.cardIds) {
    const item = document.createElement('div');
    item.textContent = cardId;  // card title (IDs in current data; future: lookup name)
    item.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      self._selectionAdapter.addToSelection([cardId]);  // multi-select stays open
    });
    tooltip.appendChild(item);
  }

  this._rootEl.appendChild(tooltip);
  this._superCardTooltipEl = tooltip;

  // rAF-deferred click-outside listener (prevents opening click from dismissing)
  requestAnimationFrame(() => {
    this._boundTooltipOutsideClick = (e: MouseEvent) => {
      if (!tooltip.contains(e.target as Node)) {
        this._closeSuperCardTooltip();
      }
    };
    document.addEventListener('click', this._boundTooltipOutsideClick);
  });
}
```

### Pattern 3: CARD-04 Selection Exclusion — Already Partially Wired

**What:** SuperCards must be excluded from all selection paths.

**Status of existing wiring (HIGH confidence — verified in source code):**

1. **`classifyClickZone()`** in `SuperGridSelect.ts` — already returns `'supergrid-card'` for `.supergrid-card` elements (line 43)
2. **`_handlePointerDown()`** in `SuperGridSelect.ts` — already returns early for `zone === 'supergrid-card'` (line 188): lasso does NOT start on SuperCard clicks
3. **Data-cell `onclick` handler** in `_renderCells()` (line 1452-1454): `if (zone !== 'data-cell') return;` — SuperCard click will have `zone === 'supergrid-card'` so selection is already skipped

**What still needs implementing:**
- The `data-supercard` attribute must be present on the SuperCard DOM element (wires `classifyClickZone()` detection)
- `_getRectangularRangeCardIds()` and lasso `getCellCardIds` callbacks use `_lastCells` data, not DOM elements — they are unaffected as long as we don't accidentally include SuperCard IDs in `card_ids`; SuperCard elements have no separate IDs, so this is already safe

### Pattern 4: CARD-05 FTS Search Exclusion

**What:** SuperCards must not appear in FTS search results or inflate card counts.

**Analysis (HIGH confidence):**
- FTS search returns `matchedCardIds` on `CellDatum`. The search count badge in `_renderCells()` counts cells where `matchedCardIds.length > 0` — this counts data cells, not SuperCard elements
- The search `opacity` dimming (`el.style.opacity = isSearchActive ? (isMatch ? '1' : '0.4') : ''`) applies to the `.data-cell` container `el`, NOT the SuperCard child element — SuperCard will inherit opacity from its parent container `el`
- **Key question:** Should a cell containing a SuperCard that has matching cards be highlighted? Per CARD-05, SuperCards are excluded from search results — the opacity/highlight should NOT apply to the SuperCard element itself
- **Implementation:** Inside the D3 `.each()` search highlight block, check for `data-supercard` on the cell's child and skip/clear highlight classes if the cell only contains a SuperCard

### Pattern 5: Performance Tests — `performance.now()` in `.perf.test.ts`

**What:** Deterministic timing assertions inside Vitest `test()` calls. NOT `vitest bench` (which is separate infrastructure requiring the `bench` subcommand).

**Why not `vitest bench`:** The existing `SuperGrid.bench.ts` uses Vitest's bench API but runs separately from the main test suite. CONTEXT.md requires CI enforcement (block merge on regression), so perf tests must run as part of `vitest --run`.

**Pattern from existing `database/performance-assertions.test.ts`:**
```typescript
// @vitest-environment jsdom  (for SuperGrid tests)
import { describe, it, expect } from 'vitest';

describe('PLSH-01 — 50x50 grid render < 16ms', () => {
  it('renders 50x50 cell grid within tolerance', () => {
    const TOLERANCE = 1.20;  // 20% tolerance margin per CONTEXT.md
    const BUDGET_MS = 16 * TOLERANCE;  // 19.2ms

    // Synthetic 50x50 grid data — fixed seed PRNG for reproducibility
    const cells = makeSyntheticGrid(50, 50, /* seed */ 42);

    const start = performance.now();
    // ... render call
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
```

**Fixed-seed PRNG — mulberry32 pattern:**
```typescript
// mulberry32: simple, fast, seed-deterministic
function mulberry32(seed: number): () => number {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

### Pattern 6: Right-Click Context Menu

**What:** Custom styled `<div>` popup on header `contextmenu` event. Same lifecycle as filter dropdown and SuperCard tooltip.

**Key implementation details:**
- `event.preventDefault()` on `contextmenu` event suppresses the native browser menu
- `event.stopPropagation()` prevents event bubbling
- Menu appended to `_rootEl` (consistent with filter dropdown pattern)
- Position computed same way as filter dropdown (anchor relative to `_rootEl`)
- Context-aware items: Sort ascending / Sort descending (toggle based on `_sortState.getDirection(field)`), Filter (opens `_openFilterDropdown()`), Hide column / Show hidden (N)
- "Hide" is new state that needs a `_hiddenCols: Set<string>` private field (ephemeral, Tier 3)
- Dismissed by click-outside (rAF-deferred) or Escape

### Pattern 7: Help Overlay

**What:** A modal overlay div listing all keyboard shortcuts organized by category.

**Trigger:** '?' button in `_densityToolbarEl` + `Cmd+/` keyboard shortcut on document (mirroring `Cmd+F` pattern from Phase 25).

**Structure:**
```typescript
// Stored as class field:
private _helpOverlayEl: HTMLDivElement | null = null;
private _boundHelpKeyHandler: ((e: KeyboardEvent) => void) | null = null;

// In mount():
this._boundHelpKeyHandler = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === '/') {
    e.preventDefault();
    this._toggleHelpOverlay();
  }
};
document.addEventListener('keydown', this._boundHelpKeyHandler);
```

**Shortcut catalog (from code audit):**
| Category | Shortcut | Description |
|----------|----------|-------------|
| Search | Cmd+F | Activate search |
| Search | Escape | Clear search (when search focused) |
| Selection | Click | Select cell cards |
| Selection | Cmd+click | Add to / toggle selection (data cells); Period select (time headers) |
| Selection | Shift+click | 2D range select |
| Selection | Escape | Clear selection (first Escape clears period selection if active) |
| Sort | Click header | Cycle sort asc/desc/none |
| Sort | Cmd+click sort icon | Multi-sort add/cycle |
| Zoom | Cmd+0 | Reset zoom (via SuperZoom) |
| Help | Cmd+/ | Toggle this overlay |
| Help | ? button | Toggle this overlay |

### Anti-Patterns to Avoid

- **Heat map color on SuperCard cell background:** SuperCards must NOT set `el.style.backgroundColor = heatScale(d.count)`. The cell background remains neutral; the SuperCard element itself provides visual differentiation.
- **Appending tooltip/menu to `document.body`:** Breaks `getBoundingClientRect()` relative positioning. Use `_rootEl` with scroll-offset compensation (same as `_openFilterDropdown()`).
- **Calling `_fetchAndRender()` from context menu:** Sort action wires through `_provider.setSortOverrides()` (triggers coordinator). Filter action wires through `_filter.setAxisFilter()` + direct coordinator call. Do NOT call `_fetchAndRender()` directly — consistent with Phase 18 anti-pattern constraint.
- **Using `innerHTML` for tooltip card list:** SRCH-03 locked decision prohibits `innerHTML` injection. Use `createElement` + `appendChild`.
- **SuperCard inside `_gridEl` D3 join causing extra BBoxCache entries:** SuperCard is a CHILD of `.data-cell`. `BBoxCache.scheduleSnapshot()` snapshots `.data-cell` elements, not their children — no change needed to `SuperGridBBoxCache`.
- **Registering `contextmenu` listener inside `_renderCells()`:** This runs on every render and would accumulate duplicate listeners. Register once in `mount()` using event delegation on `_gridEl` (check `e.target.closest('.col-header, .row-header')`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fixed-seed random data | Custom PRNG | mulberry32 (7 lines, pure JS) | Reproducible across runs, no dependency |
| Tooltip positioning | Coordinate math | Existing `_openFilterDropdown()` pattern: `anchorRect.bottom - rootRect.top + _rootEl.scrollTop` | Already battle-tested for scroll offset |
| Click-outside dismiss | Custom event system | rAF-deferred `document.addEventListener('click', ...)` pattern | Already used for filter dropdown — same behavior |
| Context menu | `showPopover()` / Popover API | Custom `<div>` with `position: absolute` | Popover API has cross-browser issues in older WebViews; custom div consistent with existing popup pattern |

**Key insight:** Every UI element in Phase 27 (tooltip, context menu, help overlay) follows the identical lifecycle: create `<div>`, compute position relative to `_rootEl`, append to `_rootEl`, wire click-outside with rAF deferral, store ref in class field, clean up in `destroy()`.

## Common Pitfalls

### Pitfall 1: SuperCard loses heat map but cell retains heat map background
**What goes wrong:** Developer sets `backgroundColor` on the SuperCard element but forgets to clear `el.style.backgroundColor` on the parent `.data-cell`, leaving both colored.
**Why it happens:** The matrix mode branch previously set `el.style.backgroundColor = heatScale(d.count)` inline — easy to forget to also clear it.
**How to avoid:** In the SuperCard rendering branch, explicitly set `el.style.backgroundColor = ''` before appending the SuperCard child. Then set `el.style.backgroundColor` only if the Claude's Discretion subtle tint is desired.
**Warning signs:** Test that asserts `el.style.backgroundColor === ''` on the data-cell container when SuperCard is rendered.

### Pitfall 2: Double listener accumulation from contextmenu in _renderCells()
**What goes wrong:** `_renderCells()` is called many times (every provider change, density change, etc.). If `contextmenu` listener is added inside `_renderCells()`, each render adds another listener, causing multiple menu opens per right-click.
**Why it happens:** Pattern temptation — "add it where headers are built."
**How to avoid:** Use event delegation in `mount()`: `this._gridEl.addEventListener('contextmenu', (e) => { const header = (e.target as Element).closest('.col-header, .row-header'); if (header) { ... } })`.
**Warning signs:** Right-clicking a header opens N menus where N = number of renders.

### Pitfall 3: SuperCard tooltip left open after _renderCells() clears grid
**What goes wrong:** `_renderCells()` calls `while (grid.firstChild) grid.removeChild(grid.firstChild)` at line 1104, which destroys the DOM but `_superCardTooltipEl` (appended to `_rootEl`, not `_gridEl`) remains orphaned with its stale click-outside listener.
**Why it happens:** Tooltip is in `_rootEl`, which survives DOM clearing. But the SuperCard element it was anchored to is gone.
**How to avoid:** Call `_closeSuperCardTooltip()` at the start of `_renderCells()` (same position that `_closeFilterDropdown()` would be called if it existed there). Alternatively: call it at the start of `_fetchAndRender()`.
**Warning signs:** Tooltip remains open and positioned incorrectly after a grid re-render.

### Pitfall 4: Performance test non-determinism from DOM reuse between `it()` calls
**What goes wrong:** jsdom environment reuses the same `document` across tests in a file. If a previous test leaves DOM state (stale `.data-cell` elements), the perf test's timing includes DOM cleanup time from the previous state.
**Why it happens:** `beforeEach` / `afterEach` must explicitly clear container content.
**How to avoid:** Use `beforeEach` to create a fresh container and `afterEach` to call `view.destroy()` and remove from `document.body`. Same pattern as all existing SuperGrid tests.
**Warning signs:** Performance test passes in isolation but flickers in full suite.

### Pitfall 5: Tooltip z-index collision with lasso SVG overlay (z-index: 5)
**What goes wrong:** SuperCard tooltip (z-index 20 or 30) appears behind the SVG lasso overlay (z-index 5) during drag.
**Why it happens:** SVG overlay z-index was set to 5 in Phase 21.
**How to avoid:** Tooltip z-index must be > 5. The filter dropdown uses z-index 20. Use z-index 25 for SuperCard tooltip to be above filter dropdowns too.
**Warning signs:** Tooltip gets clipped or covered when user initiates a drag after opening it (though lasso is blocked on `supergrid-card` zone, the SVG still covers everything at z-index 5).

### Pitfall 6: PLSH-01 timing includes _renderCells DOM setup cost, not just render
**What goes wrong:** Performance test measures the wrong thing — including `mount()` overhead and async bridge calls.
**Why it happens:** `_fetchAndRender()` is async; only `_renderCells()` is sync and measurable.
**How to avoid:** Inject a mock bridge that returns synchronously; call `_renderCells()` directly (it's private — access via casting to `any`) OR construct the grid, mount it, and measure only the `_renderCells` path by triggering coordinator re-render with a synchronous bridge mock. The CONTEXT.md spec says "50×50 cell SuperGrid renders in under 16ms" — this is the `_renderCells()` path specifically.
**Warning signs:** Performance test consistently exceeds budget due to async overhead.

## Code Examples

### SuperCard DOM Creation (CARD-01 / CARD-02)
```typescript
// Inside _renderCells() .each() — replace matrix mode count-badge block:
// Source: derived from existing matrix mode branch at line 1374-1388

// SuperCard replaces count-badge in matrix mode
el.classList.remove('empty-cell');
el.style.backgroundColor = '';  // NO heat map — LOCKED decision
el.style.display = 'flex';
el.style.alignItems = 'center';
el.style.justifyContent = 'center';
el.style.padding = 'calc(4px * var(--sg-zoom, 1))';
el.innerHTML = '';  // clear any previous content

const superCard = document.createElement('div');
superCard.className = 'supergrid-card';
superCard.setAttribute('data-supercard', 'true');
superCard.style.cssText = `
  border: 1px dashed rgba(128,128,128,0.4);
  border-radius: 4px;
  padding: calc(4px * var(--sg-zoom, 1)) calc(8px * var(--sg-zoom, 1));
  font-style: italic;
  font-size: calc(12px * var(--sg-zoom, 1));
  cursor: pointer;
  user-select: none;
  color: rgba(0,0,0,0.7);
`.trim().replace(/\s+/g, ' ');
superCard.textContent = String(d.count);
superCard.addEventListener('click', (e: MouseEvent) => {
  e.stopPropagation();
  self._openSuperCardTooltip(superCard, d);
});
el.appendChild(superCard);
```

### Selection Zone Guard — Already Present (CARD-04)
```typescript
// Verified in SuperGridSelect.ts line 188 — no new code needed:
private _handlePointerDown(e: PointerEvent): void {
  const zone = classifyClickZone(e.target);
  if (zone === 'header' || zone === 'supergrid-card') return;  // SuperCard already excluded
  // ...
}

// Verified in SuperGrid.ts _renderCells() onclick line 1454 — no new code needed:
el.onclick = (e: MouseEvent) => {
  const zone = classifyClickZone(e.target);
  if (zone !== 'data-cell') return;  // 'supergrid-card' zone falls through here
  // ...
};
```

The only new code for CARD-04 is ensuring the `data-supercard` attribute is set on the SuperCard element so `classifyClickZone()` correctly returns `'supergrid-card'` via `el.closest('.supergrid-card')`.

### Synthetic Grid Generator for Performance Tests (PLSH-01)
```typescript
// In SuperGrid.perf.test.ts
function mulberry32(seed: number): () => number {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeSyntheticCells(cols: number, rows: number, seed = 42): CellDatum[] {
  const rand = mulberry32(seed);
  const cells: CellDatum[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const count = Math.floor(rand() * 10);
      cells.push({
        card_type: `type_${c}`,
        folder: `folder_${r}`,
        count,
        card_ids: Array.from({ length: count }, (_, i) => `card-${r}-${c}-${i}`),
      });
    }
  }
  return cells;
}
```

### Event Delegation for Context Menu in mount() (PLSH-05)
```typescript
// In mount() — registered once, not per-render
this._boundContextMenuHandler = (e: MouseEvent) => {
  const header = (e.target as Element).closest<HTMLElement>('.col-header, .row-header');
  if (!header) return;
  e.preventDefault();
  e.stopPropagation();
  const axisField = header.dataset['axisField'] ?? '';
  const dimension = header.classList.contains('col-header') ? 'col' : 'row';
  this._openContextMenu(e.clientX, e.clientY, axisField, dimension);
};
this._gridEl!.addEventListener('contextmenu', this._boundContextMenuHandler);
```

**Note:** `data-axisField` must be added to col/row header elements in `_renderCells()`. Currently, axis field is stored on the grip element's `data-axisDimension`; headers themselves only have class names. Need to add `headerEl.dataset['axisField'] = levelAxisField` in the header rendering loop.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` (root) — `environment: 'node'` default; SuperGrid tests use `// @vitest-environment jsdom` file-level override |
| Quick run command | `npx vitest --run tests/views/SuperGrid.test.ts tests/views/SuperGrid.perf.test.ts` |
| Full suite command | `npx vitest --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARD-01 | SuperCard element present in data cell with count > 0 | unit | `npx vitest --run tests/views/SuperGrid.test.ts` | ✅ (append to existing) |
| CARD-02 | SuperCard has dashed border + italic style; cell has no heat map background | unit | `npx vitest --run tests/views/SuperGrid.test.ts` | ✅ (append to existing) |
| CARD-03 | Clicking SuperCard shows tooltip with card list; clicking card title adds to selection | unit | `npx vitest --run tests/views/SuperGrid.test.ts` | ✅ (append to existing) |
| CARD-04 | SuperCard click does NOT trigger SelectionProvider; lasso does NOT start on SuperCard | unit | `npx vitest --run tests/views/SuperGrid.test.ts` | ✅ (append to existing) |
| CARD-05 | SuperCard cell not highlighted in FTS search; not counted in match badge | unit | `npx vitest --run tests/views/SuperGrid.test.ts` | ✅ (append to existing) |
| PLSH-01 | 50×50 grid renders in < 19.2ms (16ms + 20% tolerance) | performance | `npx vitest --run tests/views/SuperGrid.perf.test.ts` | ❌ Wave 0 |
| PLSH-02 | `buildSuperGridQuery()` + Worker execution on 10K cards < 120ms | performance | `npx vitest --run tests/views/SuperGrid.perf.test.ts` | ❌ Wave 0 |
| PLSH-03 | Axis transpose reflow < 360ms (300ms + 20% tolerance) | performance | `npx vitest --run tests/views/SuperGrid.perf.test.ts` | ❌ Wave 0 |
| PLSH-04 | Help overlay appears on '?' click and Cmd+/; contains all shortcut categories | unit | `npx vitest --run tests/views/SuperGrid.test.ts` | ✅ (append to existing) |
| PLSH-05 | Right-click on header shows context menu with Sort/Filter/Hide; suppresses native menu | unit | `npx vitest --run tests/views/SuperGrid.test.ts` | ✅ (append to existing) |

### Sampling Rate
- **Per task commit:** `npx vitest --run tests/views/SuperGrid.test.ts`
- **Per wave merge:** `npx vitest --run`
- **Phase gate:** Full suite green (1838+ tests passing) before verify

### Wave 0 Gaps
- [ ] `tests/views/SuperGrid.perf.test.ts` — covers PLSH-01, PLSH-02, PLSH-03; new file needed

*(All other test infrastructure exists — just append new `describe()` blocks to `SuperGrid.test.ts`)*

## Open Questions

1. **PLSH-02 test environment: Worker vs pure `buildSuperGridQuery()`**
   - What we know: `buildSuperGridQuery()` is pure SQL compilation (no DB call) — it returns in microseconds. The actual 100ms budget is for Worker execution against a real sql.js database with 10K cards.
   - What's unclear: PLSH-02 says "SuperGridQuery GROUP BY on 10K cards completes in under 100ms" — this implies a real sql.js database. But sql.js WASM tests use `pool: 'forks'` in `vitest.config.ts` and cannot run in jsdom environment (WASM needs Node).
   - Recommendation: PLSH-02 perf test uses `// @vitest-environment node` (not jsdom), seeds sql.js with 10K rows via `db.run()` bulk INSERT, then calls the Worker bridge directly. Alternatively, scope PLSH-02 as a test of the `buildSuperGridQuery()` compilation step only (which is instantaneous) and note that Worker round-trip performance is validated by the existing `database/performance-assertions.test.ts` patterns.

2. **"Hide column" state persistence for context menu**
   - What we know: PLSH-05 requires "Hide" option in context menu. This is new state not mentioned in any existing provider.
   - What's unclear: Is hidden column state Tier 2 (persisted to PAFVProvider like `colWidths`) or Tier 3 (ephemeral `Set<string>` in SuperGrid like `_periodSelection`)?
   - Recommendation: Treat as Tier 3 ephemeral (`_hiddenCols: Set<string>` and `_hiddenRows: Set<string>`) — consistent with DENS-02 hide-empty which is also a client-side filter. The "Hide/Show hidden (N)" context menu item is context-aware: if the field is hidden, show "Show hidden (1)". This is purely UI state, no SQL change needed.

3. **Tooltip card titles vs card IDs**
   - What we know: `card_ids` on `CellDatum` contains raw card UUIDs. The CONTEXT.md Specific Ideas section says "show card titles (not IDs) — requires fetching title from card_ids."
   - What's unclear: Where does the title lookup come from? The Worker bridge has no `getCardsByIds()` method exposed in the current `SuperGridBridgeLike` interface.
   - Recommendation: For v3.0, display card IDs (not titles) in the tooltip. The CONTEXT.md says "requires fetching title from card_ids" as an aspiration, not a hard requirement. CARD-03 says "tooltip with aggregation details" — count + IDs satisfies this. Title lookup is a v3.1+ enhancement. This avoids adding a new Worker message type in the final phase.

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` — Full source inspection: existing D3 `.each()` pipeline (lines 1307-1475), toolbar patterns (lines 436-695), filter dropdown lifecycle (lines 1723+), click handlers
- `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridSelect.ts` — `classifyClickZone()` (line 37-46) already returns `'supergrid-card'`; `_handlePointerDown()` (line 184-200) already excludes `supergrid-card` zone
- `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts` — `buildSuperGridQuery()` confirmed pure function, no async
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/SelectionProvider.ts` — `select()`, `addToSelection()`, `clear()` API confirmed
- `/Users/mshaler/Developer/Projects/Isometry/tests/database/performance-assertions.test.ts` — Established `performance.now()` pattern for perf tests in this codebase
- `/Users/mshaler/Developer/Projects/Isometry/vitest.config.ts` — Confirmed `environment: 'node'` default; jsdom via file-level `// @vitest-environment jsdom`
- `/Users/mshaler/Developer/Projects/Isometry/tests/views/SuperGrid.test.ts` — 6,986 lines; confirmed test patterns for all prior phases; 1838 total tests passing

### Secondary (MEDIUM confidence)
- `.planning/phases/27-supercards-polish/27-CONTEXT.md` — User decisions (locked and discretion areas) — canonical for this research
- `.planning/REQUIREMENTS.md` — CARD-01..05 and PLSH-01..05 requirement text confirmed

### Tertiary (LOW confidence)
- mulberry32 PRNG — well-known deterministic PRNG for test data generation; LOW confidence as to exact implementation but pattern is straightforward and verifiable

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and source imports
- Architecture: HIGH — all patterns verified against existing source code in same codebase
- Pitfalls: HIGH — identified from direct source code inspection of established patterns
- Performance test approach: MEDIUM — PLSH-02 Worker isolation TBD (see Open Questions)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable codebase, no fast-moving external dependencies)
