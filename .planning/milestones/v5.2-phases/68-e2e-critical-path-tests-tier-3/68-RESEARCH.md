# Phase 68: E2E Critical-Path Tests Tier 3 - Research

**Researched:** 2026-03-10
**Domain:** End-to-end testing / Playwright browser automation
**Confidence:** HIGH

## Summary

Phase 68 completes the E2E test suite by covering the 4 remaining critical-path flows from the Critical Path Inventory that have no dedicated E2E spec file. The existing Tier 1+2 suite includes 6 dedicated E2E spec files covering Flows 0, 2, 5, 6, 8, 9, plus the large `supergrid-visual.spec.ts` covering import, axis config, selection, sort, zoom, filter, search, virtual scrolling, lasso, and view round-trips. The Tier 3 gap is 4 specific multi-step flows that exercise cross-component interactions not fully covered by the existing specs: view-switch card count preservation (Flow 1), Projection Explorer axis reconfiguration (Flow 3), card selection driving notebook binding (Flow 4), compound filter conjunction correctness (Flow 11). Flows 7 (Alphabet search) and 10 (Clear all filters) are partially covered by existing specs (`supergrid-visual.spec.ts` tests FTS5 search and filter clearing) but lack dedicated assertion coverage of their full interaction sequence.

**Primary recommendation:** Add 4 new E2E spec files (`view-switch.spec.ts`, `projection-axis.spec.ts`, `notebook-binding.spec.ts`, `compound-filter.spec.ts`) using the existing shared baseline fixture (`e2e/fixtures.ts`) and helper library (`e2e/helpers/isometry.ts`). Each spec follows the established pattern: load Meryl Streep sample dataset, exercise the full interaction sequence, assert observable success conditions from the Critical Path Inventory.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | ^1.58.2 | Browser automation + assertions | Already installed, all existing E2E specs use it |
| Vite | 7.3 | Dev server for webServer config | Playwright config already has `npm run dev` as webServer command |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| e2e/fixtures.ts | N/A | Shared baseline fixture (loads Meryl Streep dataset) | All Tier 3 tests start from identical baseline |
| e2e/helpers/isometry.ts | N/A | Helper functions (switchToView, setColAxes, etc.) | Reuse for all programmatic interactions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Programmatic API via page.evaluate | Real DOM interactions (click, type) | Programmatic is more reliable for cross-component seam testing; DOM interactions better for true user simulation but fragile with D3/SVG coordinates |

**Installation:**
No new dependencies needed. `@playwright/test` ^1.58.2 is already in devDependencies.

## Architecture Patterns

### Recommended Project Structure
```
e2e/
├── fixtures.ts              # Shared baseline (loads Meryl Streep dataset)
├── helpers/
│   └── isometry.ts          # Programmatic helpers (switchToView, setColAxes, etc.)
├── cold-start.spec.ts       # Flow 0 (Tier 1)
├── filter-category.spec.ts  # Flow 2 (Tier 2)
├── notebook-chart.spec.ts   # Flow 5 (Tier 2)
├── filter-histogram.spec.ts # Flow 6 (Tier 2)
├── calc-footer.spec.ts      # Flow 8 (Tier 2)
├── network-selection.spec.ts# Flow 9 (Tier 2)
├── supergrid-visual.spec.ts # Visual regression suite (Tier 1)
├── view-switch.spec.ts      # Flow 1 (Tier 3) ← NEW
├── projection-axis.spec.ts  # Flow 3 (Tier 3) ← NEW
├── notebook-binding.spec.ts # Flow 4 (Tier 3) ← NEW
└── compound-filter.spec.ts  # Flow 11 (Tier 3) ← NEW
```

### Pattern 1: Shared Baseline Fixture
**What:** All Tier 3 tests use the `test` export from `e2e/fixtures.ts` which pre-loads the Meryl Streep Career sample dataset (47 films, 35 persons, 21 awards, ~140 edges) and waits for Timeline to render.
**When to use:** Every spec that needs data to interact with.
**Example:**
```typescript
import { test, expect } from './fixtures';

test.describe('Flow N: Description', () => {
  test('interaction sequence produces expected result', async ({ page, baselineCardCount }) => {
    expect(baselineCardCount).toBeGreaterThan(0);
    // ...test body
  });
});
```

### Pattern 2: Programmatic API via window.__isometry
**What:** Tests interact with providers and managers via `page.evaluate()` calling into `window.__isometry` (the global exposed by `main.ts`). This bypasses DOM fragility and tests the exact seam wiring.
**When to use:** For all provider-level interactions (filter, selection, axis config, view switching).
**Example:**
```typescript
// View switching via ViewManager
await page.evaluate(async () => {
  const { viewManager, viewFactory } = (window as any).__isometry;
  await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
});

// Filter interaction via FilterProvider
await page.evaluate(() => {
  const { filter, coordinator } = (window as any).__isometry;
  filter.setAxisFilter('folder', ['Film']);
  coordinator.scheduleUpdate();
});
```

### Pattern 3: Wait-for-Function Assertions
**What:** Use `page.waitForFunction()` to poll for DOM state changes after programmatic interactions, then assert with Playwright `expect()`.
**When to use:** After any interaction that triggers async re-rendering (view switch, filter change, axis change).
**Example:**
```typescript
// Wait for view tab to become active
await page.waitForFunction(
  () => {
    const activeTab = document.querySelector('.view-tab--active');
    return activeTab?.textContent?.includes('SuperGrid');
  },
  { timeout: 15_000 },
);
```

### Pattern 4: Card Count Ground Truth via SQL Query
**What:** Read card count directly from sql.js via bridge to establish ground truth, independent of DOM rendering.
**When to use:** For Flow 1 (view switching preserves count) and any assertion that card data is complete.
**Example:**
```typescript
const cardCount = await page.evaluate(async () => {
  const { bridge } = (window as any).__isometry;
  const result = await bridge.send('db:query', {
    sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
    params: [],
  });
  return result.rows[0]?.cnt ?? 0;
});
```

### Anti-Patterns to Avoid
- **Relying on CSS class presence for data assertions:** Use `bridge.send('db:query')` for ground truth, DOM for UI state.
- **Hard-coded timeouts without polling:** Always use `page.waitForFunction()` with a condition, not bare `page.waitForTimeout()`.
- **Testing view internals (SVG coordinates, D3 datum):** Test observable UI state (cell count, header text, visibility). D3 internals are covered by unit tests.
- **Sharing mutable state between tests in the same describe block:** Each test should start from the baseline. Use `test.describe.configure({ mode: 'serial' })` only when prior test state is intentionally consumed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Baseline data loading | Custom setup per spec | `import { test, expect } from './fixtures'` | Shared fixture already handles Meryl Streep load + Timeline render wait |
| View switching | Raw evaluate with waits | `switchToView(page, 'supergrid')` from helpers | Already handles wait-for-render timing |
| Axis configuration | Manual PAFVProvider calls | `setColAxes(page, [...])`, `setRowAxes(page, [...])` from helpers | Already handles coordinator.scheduleUpdate() + render wait |
| Filter application | Direct FilterProvider manipulation | `addFilter(page, field, value)` from helpers | Already handles coordinator trigger + wait |
| Card count query | Custom SQL evaluation | `getCardCount(page)` from helpers | Already wraps bridge.send('db:query') |

**Key insight:** The `e2e/helpers/isometry.ts` library already provides wrappers for every common interaction. Tier 3 tests should compose these helpers, not duplicate them.

## Common Pitfalls

### Pitfall 1: Race conditions in view switching
**What goes wrong:** View switch triggers both immediate `_fetchAndRender()` AND a `StateCoordinator` subscription callback. If the test doesn't wait for the render to settle, assertions fire against stale DOM.
**Why it happens:** The v4.2 stuck-spinner fix cancels in-flight timers, but the second fetch still takes time.
**How to avoid:** Always use `page.waitForFunction()` to poll for the expected DOM state (e.g., active tab text, cell count > 0) after calling `switchToView()`. The helper already adds a 800ms wait, but assertions should have their own polling.
**Warning signs:** Flaky failures where cell count is 0 or active tab is wrong.

### Pitfall 2: SuperGrid uses its own query path
**What goes wrong:** Tests assume SuperGrid uses `ViewManager._fetchAndRender()` → `QueryBuilder.buildCardQuery()`, but SuperGrid bypasses this entirely with `SuperGrid._fetchAndRender()` → `WorkerBridge.send('supergrid:query')`.
**Why it happens:** SuperGrid has its own query builder for axis-based GROUP BY queries.
**How to avoid:** For SuperGrid-specific assertions, check `.sg-cell`, `.sg-header`, `.col-header`, `.data-cell` classes, not generic card count.
**Warning signs:** Card count assertions that pass for List/Timeline but fail for SuperGrid.

### Pitfall 3: Compound filter conjunction ordering
**What goes wrong:** Tests apply multiple filters but don't verify the compound WHERE clause is correct.
**Why it happens:** `FilterProvider.compile()` concatenates axis filters, range filters, and FTS in a specific order. Tests that only check cell count might pass even if the conjunction is wrong (coincidental data match).
**How to avoid:** For Flow 11, assert both `compile().where` content AND cell count monotonically decreasing at each step.
**Warning signs:** Tests pass but only because the dataset is small enough that wrong conjunctions still produce correct-looking counts.

### Pitfall 4: Network view force simulation timing
**What goes wrong:** Network view nodes aren't positioned yet when test tries to interact with them.
**Why it happens:** Force simulation runs in a Worker. Node positions stabilize after 200-300 ticks.
**How to avoid:** Wait for SVG circles to appear (`svg.network-view circle` count >= expected), then add a 2000ms stabilization wait as done in `network-selection.spec.ts`.
**Warning signs:** Clicks hit wrong nodes or miss entirely.

### Pitfall 5: Playwright `fullyParallel: false` config
**What goes wrong:** New spec files may accidentally depend on state from prior spec files.
**Why it happens:** Playwright config has `fullyParallel: false` and `workers: 1` for the serial supergrid-visual suite.
**How to avoid:** Each Tier 3 spec uses the shared `fixtures.ts` which creates a fresh page and loads data independently. No cross-file state sharing.
**Warning signs:** Tests pass individually but fail when run as a full suite.

## Code Examples

### Flow 1: View Switch Card Count Preservation
```typescript
// From CRITICAL-PATH-INVENTORY.md:
// "Each view renders with the same card count. Announcer fires
//  'Switched to [View] view, N cards' with identical N."

import { test, expect } from './fixtures';

test('view switching preserves card count across all 9 views', async ({ page, baselineCardCount }) => {
  const views = ['list', 'grid', 'kanban', 'calendar', 'timeline', 'gallery', 'network', 'tree', 'supergrid'];

  for (const view of views) {
    await page.evaluate(async (vt) => {
      const { viewManager, viewFactory } = (window as any).__isometry;
      await viewManager.switchTo(vt, () => viewFactory[vt]());
    }, view);

    // Wait for view to render
    await page.waitForFunction(
      (viewName) => {
        const tab = document.querySelector('.view-tab--active');
        return tab?.textContent?.toLowerCase().includes(viewName.toLowerCase());
      },
      view,
      { timeout: 15_000 },
    );

    // Card count from database should be unchanged
    const count = await page.evaluate(async () => {
      const { bridge } = (window as any).__isometry;
      const r = await bridge.send('db:query', {
        sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
        params: [],
      });
      return r.rows[0]?.cnt ?? 0;
    });

    expect(count).toBe(baselineCardCount);
  }
});
```

### Flow 3: Projection Explorer Axis Reconfiguration
```typescript
// The key assertion: adding an axis field to colAxes produces multi-level headers,
// and CalcExplorer dropdown list updates to include the new field.

await page.evaluate(() => {
  const { pafv, coordinator } = (window as any).__isometry;
  pafv.setColAxes([
    { field: 'card_type', direction: 'asc' },
    { field: 'status', direction: 'asc' },
  ]);
  coordinator.scheduleUpdate();
});

// Wait for multi-level headers
await page.waitForFunction(() => {
  const headers = document.querySelectorAll('.col-header, .sg-header');
  return headers.length > 2; // Multi-level produces more headers
}, { timeout: 10_000 });
```

### Flow 4: Card Selection Drives Notebook Binding
```typescript
// Key seam: SelectionProvider.select(cardId) → NotebookExplorer._onSelectionChange()
// → flush old → load new → textarea update

// 1. Select card A
await page.evaluate((id) => {
  const { selection } = (window as any).__isometry;
  selection.select(id);
}, cardIds[0]);

// 2. Type content
await page.evaluate(() => {
  const textarea = document.querySelector('.notebook-textarea') as HTMLTextAreaElement;
  if (textarea) {
    textarea.value = '# Notes on Card A';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

// 3. Wait for debounced save
await page.waitForTimeout(800);

// 4. Switch to card B
await page.evaluate((id) => {
  const { selection } = (window as any).__isometry;
  selection.select(id);
}, cardIds[1]);

// 5. Switch back to card A — content should be restored
await page.evaluate((id) => {
  const { selection } = (window as any).__isometry;
  selection.select(id);
}, cardIds[0]);

await page.waitForFunction(() => {
  const textarea = document.querySelector('.notebook-textarea') as HTMLTextAreaElement;
  return textarea?.value?.includes('Notes on Card A');
}, { timeout: 5_000 });
```

### Flow 11: Compound Filter Conjunction
```typescript
// Key assertion: each filter step strictly decreases card count (conjunction narrows)

// Step 1: Category filter
await page.evaluate(() => {
  const { filter, coordinator } = (window as any).__isometry;
  filter.setAxisFilter('folder', ['Film']);
  coordinator.scheduleUpdate();
});
// ... capture count1

// Step 2: Text search
await page.evaluate(() => {
  const { filter, coordinator } = (window as any).__isometry;
  filter.setSearchQuery('Meryl');
  coordinator.scheduleUpdate();
});
// ... capture count2
expect(count2).toBeLessThan(count1);

// Step 3: Range filter
await page.evaluate(() => {
  const { filter, coordinator } = (window as any).__isometry;
  filter.setRangeFilter('priority', 3, 7);
  coordinator.scheduleUpdate();
});
// ... capture count3
expect(count3).toBeLessThanOrEqual(count2);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| supergrid-visual.spec.ts only (Tier 1) | 6 dedicated flow specs + visual suite (Tier 1+2) | Phase 68 (2026-03-10) | Covers 6 of 12 critical-path flows |
| Serial shared-page tests | Shared baseline fixture + independent pages | Phase 68 | Each spec gets fresh browser page, no cross-spec pollution |

## Open Questions

1. **Flow 3 (Projection Explorer) — drag interaction testing**
   - What we know: The Projection Explorer uses custom MIME type DnD (`application/x-isometry-axis`). Playwright can simulate drag via `page.mouse` but HTML5 DnD dataTransfer is notoriously hard to automate.
   - What's unclear: Whether to test the actual drag gesture or just the programmatic `pafv.setColAxes()` call that the drag handler fires.
   - Recommendation: Use programmatic API (`pafv.setColAxes()`) to test the seam (axis change -> grid restructure). The drag gesture itself is a UI interaction test, not a critical-path seam test. This matches the pattern used by all existing specs.

2. **Flow 7 (Alphabet search) and Flow 10 (Clear all filters) — coverage gap analysis**
   - What we know: `supergrid-visual.spec.ts` test 1.18 covers FTS5 search and test 1.17 covers filter clearing. `filter-histogram.spec.ts` tests Clear All button click.
   - What's unclear: Whether these partial coverages are sufficient or if dedicated specs are needed.
   - Recommendation: These two flows are sufficiently covered by existing specs. Tier 3 should focus on the 4 truly uncovered flows (1, 3, 4, 11) rather than duplicating partial coverage. If the planner disagrees, Flows 7 and 10 can be added as stretch goals.

3. **npm script update for e2e**
   - What we know: The `e2e` npm script currently only runs `supergrid-visual.spec.ts`. The 6 newer specs (Tier 2) are not included in the default npm run e2e command.
   - Recommendation: Update the npm script to run all e2e specs: `npx playwright test` (runs everything in `e2e/` directory).

## Existing Infrastructure Summary

### window.__isometry API (exposed by main.ts)
All providers and managers accessible via `page.evaluate()`:
- `bridge` — WorkerBridge (importFile, send for db:query/supergrid:query/chart:query)
- `viewManager` — switchTo(), getCurrentView()
- `viewFactory` — factory functions for all 9 views
- `pafv` — PAFVProvider (setColAxes, setRowAxes, getStackedGroupBySQL)
- `filter` — FilterProvider (setAxisFilter, setRangeFilter, clearFilters, setSearchQuery, compile, hasRangeFilter, etc.)
- `selection` — SelectionProvider (select, toggle, getSelectedIds, getSelectionCount)
- `coordinator` — StateCoordinator (scheduleUpdate)
- `sampleManager` — SampleDataManager (load, clear)
- `latchExplorers`, `notebookExplorer`, `calcExplorer` — workbench panel managers
- `announcer` — ARIA announcement utility

### Meryl Streep Dataset (baseline fixture)
- 47 films, 35 persons, 21 awards, ~140 connections
- Folders: Film, Person, Award (3 distinct values)
- card_type: film, person, award
- Status: varied across card types
- Priority: integer values for numeric aggregation tests
- Default view: Timeline

### Existing E2E Specs (Tier 1+2)
| File | Flow | What It Tests |
|------|------|---------------|
| `cold-start.spec.ts` | Flow 0 | Welcome panel → sample load → Timeline render → no stuck spinner |
| `filter-category.spec.ts` | Flow 2 | Category chip → FilterProvider → SuperGrid + footer update |
| `notebook-chart.spec.ts` | Flow 5 | Chart code block → marked extension → D3 SVG render → filter live update |
| `filter-histogram.spec.ts` | Flow 6 | Range filter → SuperGrid + Clear All button + footer |
| `calc-footer.spec.ts` | Flow 8 | CalcExplorer SUM → AVG → OFF → footer value changes |
| `network-selection.spec.ts` | Flow 9 | Exclusive select vs toggle, notebook follows selection, Bug #6 regression |
| `supergrid-visual.spec.ts` | Mixed | Import, axes, selection, sort, zoom, filter, search, virtual scroll, lasso, view round-trip |

### Seam Tests (Vitest, not Playwright)
| File | Seam | What It Tests |
|------|------|---------------|
| `seam-calc-footer.test.ts` | Seam 1 | Filter → calc query SQL builder → GROUP BY correctness |
| `seam-selection-notebook.test.ts` | Seam 2 | SelectionProvider select/toggle behavior |
| `seam-coordinator-batch.test.ts` | Seam 5 | StateCoordinator batching (single callback per batch) |

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/docs/CRITICAL-PATH-INVENTORY.md` — Canonical flow definitions (Flows 0-11)
- `/Users/mshaler/Developer/Projects/Isometry/e2e/` — All existing spec files and helpers (read in full)
- `/Users/mshaler/Developer/Projects/Isometry/playwright.config.ts` — Test runner configuration
- `/Users/mshaler/Developer/Projects/Isometry/src/main.ts` — window.__isometry API surface (lines 731-763)

### Secondary (MEDIUM confidence)
- `/Users/mshaler/Developer/Projects/Isometry/tests/integration/` — Seam tests (3 files, Vitest-based)
- `/Users/mshaler/Developer/Projects/Isometry/.planning/STATE.md` — "Tier 1+2 complete (10 E2E tests, 35 seam tests). Tier 3 covers remaining 4 flows."

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @playwright/test already installed and configured, no new dependencies
- Architecture: HIGH - established patterns from 7 existing spec files, shared fixture and helper library
- Pitfalls: HIGH - patterns extracted from reading all existing specs and understanding the async rendering pipeline

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable — no dependency changes expected)
