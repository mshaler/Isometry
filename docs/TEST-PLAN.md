# Test Plan: Seam Tests + E2E Coverage

Derived from the approved Critical Path Inventory (Flows 0-11).
Two test layers: seam tests protect the wiring, E2E tests protect the user experience.

---

## Part 1: Seam Map

Five cross-component seams were identified. For each: which flows stress it, and what breaks visibly if the seam is severed.

### Seam 1: Filter -> SuperGrid calc query -> Footer renderer

**What it protects:** The calc query must include both `rowAxes` AND `colAxes` in its GROUP BY, and the footer renderer must filter the result rows by each column's leaf value before displaying. If either side is wrong, every column footer shows the same grand total (UAT Bug #2).

**Flows that stress it:**
| Flow | How it stresses the seam |
|------|--------------------------|
| Flow 2 | Category chip filter changes `where`/`params` -- footer must re-query with same filter and show per-column filtered totals |
| Flow 6 | Histogram range filter adds `priority >= ? AND priority <= ?` -- footer must reflect the narrowed range per column |
| Flow 8 | CalcExplorer changes aggregation mode (SUM -> AVG -> OFF) -- footer re-queries with new `aggregates` payload |
| Flow 10 | Clear all removes filters -- footer must return to unfiltered per-column totals |
| Flow 11 | Compound filter (3 filter types) -- footer must reflect all three simultaneously |

**Observable failure mode if broken:**
All column footers display the same number (the grand total across all columns). Changing a filter updates the grid cells but the footer stays stale or shows wrong totals. Switching aggregation mode has no visible effect on footer values.

---

### Seam 2: Selection -> NotebookExplorer -> ChartRenderer

**What it protects:** When the user selects a card (in any view), NotebookExplorer must: (a) flush the previous card's content to `ui_state`, (b) load the new card's content, (c) if on Preview tab, re-mount charts for the new card. If the selection change doesn't propagate, the notebook shows stale content. If the flush is skipped, content is silently lost. If the chart doesn't re-mount, the preview shows the previous card's charts.

**Flows that stress it:**
| Flow | How it stresses the seam |
|------|--------------------------|
| Flow 4 | Card selection in Network -> notebook appears, switches content between cards, round-trips through ui_state |
| Flow 5 | Chart block in notebook -> must mount fresh charts on Preview tab, not inherit stale charts from previous card |
| Flow 9 | Exclusive selection (select, not toggle) -> notebook must switch cleanly. Multi-select via Shift must not cause chart disappearance (Bug #6) |

**Observable failure mode if broken:**
Notebook textarea shows content from the previously selected card. Typing in the notebook and switching cards loses the typed content (flush skipped). Chart preview shows the previous card's chart config instead of the current card's. Standard click on a network node deselects the only selected card, causing the notebook panel to hide and any chart to disappear.

---

### Seam 3: Filter -> ChartRenderer -> chart:query

**What it protects:** When a filter changes while the notebook Preview tab is open, ChartRenderer must re-query `chart:query` with the updated `where`/`params` from FilterProvider, and the result must match what the grid/list view shows for the same data. If the chart doesn't subscribe to filter changes, it shows stale data. If the query doesn't include the filter, chart values diverge from the grid (UAT Bug #3).

**Flows that stress it:**
| Flow | How it stresses the seam |
|------|--------------------------|
| Flow 5 | Chart renders in preview, then filter applied -- chart must live-update with 300ms debounce |
| Flow 2 | Category chip filter applied -- if chart is open, it must re-query with the same axis filter the grid uses |
| Flow 11 | Compound filter with 3 types -- chart query must compile all filter types into its WHERE clause |

**Observable failure mode if broken:**
Chart bars/values don't change when a filter is applied. Chart shows all cards while the grid shows only filtered cards. The chart and grid disagree on counts for the same category. Rapid filter changes cause the chart to show data from an old query (generation counter failure).

---

### Seam 4: Filter -> HistogramScrubber -> histogram:query

**What it protects:** The histogram scrubber sends `histogram:query` to the Worker, which returns binned data. When the user drags a brush, the scrubber calls `FilterProvider.setRangeFilter()`, which must compile into the same WHERE clause used by all other views. When "Clear all" is clicked, the brush must visually clear and the range filter must be removed. If the brush extent doesn't translate correctly to filter params, the range is wrong. If clear doesn't remove the range filter, cards stay hidden.

**Flows that stress it:**
| Flow | How it stresses the seam |
|------|--------------------------|
| Flow 6 | Drag brush on Priority histogram -> range filter applied -> all views show only cards in range |
| Flow 10 | Clear all -> histogram brush visually clears AND range filter removed from FilterProvider |

**Observable failure mode if broken:**
Dragging the brush has no effect on the grid (range filter not compiled into WHERE). The grid filters but the histogram's own visual doesn't show the selected range. "Clear all" removes chip filters but the histogram brush stays and cards remain filtered by the stale range. Brush min/max values are off-by-one or use wrong bin boundaries.

---

### Seam 5: StateCoordinator batching -> multi-view render

**What it protects:** StateCoordinator batches all provider change notifications via `setTimeout(16)` and fires a single update to all subscribers. If batching breaks, views may see partial state (e.g., filter updated but PAFV not yet), render with stale data, or miss updates entirely. The ViewManager also has its own fetch/render cycle with a 200ms spinner delay and timer cancellation logic -- if concurrent calls orphan a timer, the spinner persists forever (the v4.2 stuck-spinner bug).

**Flows that stress it:**
| Flow | How it stresses the seam |
|------|--------------------------|
| Flow 0 | Cold start: `switchTo('timeline')` triggers both immediate fetch AND coordinator subscription. Timer must not be orphaned. |
| Flow 1 | Rapid view switching: destroy/mount cycle must unsubscribe coordinator cleanly -- no stale subscriber fires into destroyed view |
| Flow 3 | Projection drag changes PAFV axes -> coordinator batches with any concurrent filter changes |
| Flow 7 | Text search with 300ms debounce -> coordinator must not fire stale intermediate states |

**Observable failure mode if broken:**
Loading spinner appears and never disappears (orphaned timer). View shows stale data from a previous query. Rapid view switching causes a flash of wrong view content or a blank container. Provider change (e.g., axis drag) doesn't trigger a re-render because the coordinator subscription was lost during the previous switchTo.

---

## Part 2: E2E Coverage Plan

All tests share a common baseline setup:

**Baseline fixture (`e2e/fixtures.ts`):**
1. Navigate to app URL (Vite dev server)
2. Wait for welcome panel heading "Explore Isometry" to be visible
3. Click "Try: Meryl Streep Career" button
4. Wait for the view to render (Timeline renders cards, tab bar shows "Timeline" active)
5. Capture the initial card count from the ARIA live region or view ARIA label

This fixture establishes the Baseline State defined in the Critical Path Inventory.

---

### `e2e/cold-start.spec.ts`

**Flow 0: Cold start renders without race conditions**

```
test('app loads sample data and renders Timeline with correct card count, no persisting spinner')
```

Interactions:
1. Navigate to app URL (fresh, no fixture -- this test IS the cold start)
2. Assert: welcome panel heading "Explore Isometry" is visible
3. Assert: "Try: Meryl Streep Career" button is visible
4. Click "Try: Meryl Streep Career"
5. Wait for tab bar to show "Timeline" as active (text match, not class)
6. Assert: no element with text "Loading..." is visible (spinner gone)
7. Assert: the view container has rendered content (at least one visible child element in the view area)
8. Assert: LATCH panel has at least one chip with a count badge showing a number > 0
9. Wait 2 seconds, re-assert: no "Loading..." spinner has reappeared (no orphaned timer)

---

### `e2e/view-switching.spec.ts`

**Flow 1: View switching preserves card count**

```
test('switching between List, SuperGrid, Network, and back preserves card count')
```

Interactions (starts from baseline fixture):
1. Note the card count from the current view (Timeline)
2. Click "List" tab in ViewTabBar
3. Wait for List view content to appear (table rows or list items visible)
4. Assert: tab bar shows "List" active
5. Assert: no spinner visible
6. Click "SuperGrid" tab
7. Wait for SuperGrid content (grid headers visible)
8. Assert: tab bar shows "SuperGrid" active
9. Click "Network" tab
10. Wait for Network SVG to appear (SVG element with circles visible)
11. Assert: tab bar shows "Network" active
12. Click "List" tab again
13. Assert: same content renders as step 3

---

### `e2e/filter-category.spec.ts`

**Flow 2: Category filter propagates to grid, footer, and chart**

```
test('clicking a category chip filters SuperGrid and updates footer totals')
```

Interactions (starts from baseline fixture):
1. Click "SuperGrid" tab
2. Wait for grid to render with data cells
3. Note the footer row values (capture text content of footer cells)
4. In LATCH panel, locate Category section
5. Find a chip under "Folder" that has a visible count badge (e.g., the first chip)
6. Note its label text (e.g., "Film") and count
7. Click the chip
8. Assert: the chip visually shows active state (has the active styling -- accent background)
9. Assert: the "Clear all" button in LATCH is now visible
10. Wait for grid to re-render
11. Assert: the number of visible data cells has decreased
12. Assert: footer row values have changed from step 3 (at least one cell differs)
13. Click the same chip again (toggle off)
14. Assert: chip returns to inactive state
15. Assert: grid data cells return to original count

---

### `e2e/projection-config.spec.ts`

**Flow 3: Drag axis property -> SuperGrid restructures**

```
test('dragging a property from Available to X well adds a column axis to SuperGrid')
```

Interactions (starts from baseline fixture):
1. Click "SuperGrid" tab, wait for grid headers
2. Count the number of distinct column header labels (level-1 headers)
3. In Projection Explorer panel, locate the Available well
4. Locate a chip in Available (e.g., "Status")
5. Drag the chip from Available well to X well
6. Wait for SuperGrid to re-render (headers change)
7. Assert: column headers now include the dragged property label
8. Assert: number of distinct column header labels has increased
9. Assert: CalcExplorer (if expanded) shows a new dropdown for the added field

**Known gap — DnD interaction coverage:**
HTML5 DnD and D3 drag are notoriously unreliable in headless Playwright. The primary implementation will attempt real drag via Playwright's `page.dragAndDrop()` or manual `mouse.down()`/`mouse.move()`/`mouse.up()` sequences. If that proves flaky, the fallback is to call `window.__isometry.pafv.setColAxes()` via `page.evaluate()` to inject the axis change directly.

The tradeoff is explicit: **the fallback tests the data wiring (PAFV -> SuperGrid re-render -> header restructure) but NOT the drag interaction itself.** If the DnD event handlers in ProjectionExplorer (`dragstart`, `dragover`, `drop`) are ever broken — e.g., wrong MIME type, missing `preventDefault()`, broken drop index calculation — the fallback will not catch it. This gap is accepted because:
1. The DnD event handlers have dedicated unit tests in `tests/ui/ProjectionExplorer.test.ts` (including the `_setDragState()` test helper).
2. The E2E value of Flow 3 is verifying the seam (axis change -> grid restructure), not the drag gesture.
3. If real DnD works in headed mode, we can add a `@slow` tagged test that runs in headed CI for the gesture specifically.

---

### `e2e/notebook-selection.spec.ts`

**Flow 4: Card selection drives notebook binding**

```
test('clicking a network node shows notebook, typing persists, switching cards round-trips content')
```

Interactions (starts from baseline fixture):
1. Click "Network" tab, wait for SVG with circle nodes
2. Assert: Notebook panel is not visible (no card selected)
3. Click the first visible circle node in the SVG
4. Assert: Notebook panel becomes visible
5. Assert: Notebook textarea is visible and empty (or has prior content)
6. Type "# Test note for first card" into the textarea
7. Wait 600ms (debounced save fires at 500ms)
8. Click a different circle node
9. Assert: Notebook textarea content has changed (not the text we just typed)
10. Click the first circle node again
11. Assert: Notebook textarea contains "# Test note for first card" (round-trip through ui_state)

---

### `e2e/notebook-chart.spec.ts`

**Flow 5: Chart block renders in preview with current filters**

```
test('chart code block renders as bar chart in preview and updates when filter changes')
```

Interactions (starts from baseline fixture):
1. Click "Network" tab, click a node to select a card
2. In Notebook panel, ensure Write tab is active
3. Clear the textarea, type a chart code block:
   ```
   ```chart
   type: bar
   x: card_type
   ```
   ```
4. Wait 600ms for save
5. Click "Preview" tab
6. Assert: an SVG element appears inside the notebook preview area (the rendered chart)
7. Assert: the SVG contains rect elements (bar chart bars)
8. Count the bars, note the count
9. In LATCH panel, click a Folder chip to apply a category filter
10. Wait 500ms (chart debounce is 300ms + query time)
11. Assert: the SVG still exists (chart didn't disappear)
12. Assert: bar count or bar sizes have changed from step 8

---

### `e2e/filter-histogram.spec.ts`

**Flow 6: Histogram brush filters all views**

```
test('dragging a brush on the Priority histogram filters the grid and updates chip counts')
```

Interactions (starts from baseline fixture):
1. Click "SuperGrid" tab, wait for grid
2. Note the total visible data cells count
3. In LATCH panel, open Hierarchy section
4. Locate the Priority histogram SVG (an SVG inside the Hierarchy section under "Priority")
5. Perform a brush drag on the histogram (click and drag from ~30% to ~70% of the SVG width)
6. Wait for grid to re-render
7. Assert: visible data cells count has decreased from step 2
8. Assert: "Clear all" button in LATCH is visible
9. Assert: at least one chip count in Category section has decreased (chips re-fetched)
10. Assert: footer row values have changed

Note: Brush interaction uses Playwright's `mouse.move()` + `mouse.down()` + `mouse.move()` + `mouse.up()` to simulate the D3 brush gesture.

---

### `e2e/filter-search.spec.ts`

**Flow 7: Alphabet search filters card list**

```
test('typing in the search input filters visible cards after debounce')
```

Interactions (starts from baseline fixture):
1. Click "List" tab, wait for list rows
2. Count visible list rows, note as `totalCount`
3. In LATCH panel, open Alphabet section
4. Click the search input, type "Sophie"
5. Wait 400ms (300ms debounce + render time)
6. Assert: visible list rows count < `totalCount`
7. Assert: Alphabet section badge shows "1"
8. Clear the search input (triple-click + Delete, or select all + Backspace)
9. Wait 400ms
10. Assert: visible list rows count equals `totalCount`
11. Assert: Alphabet section badge is no longer visible or shows "0"

---

### `e2e/calc-footer.spec.ts`

**Flow 8: Calc aggregation mode change updates footer**

```
test('changing CalcExplorer from SUM to AVG updates SuperGrid footer values')
```

Interactions (starts from baseline fixture):
1. Click "SuperGrid" tab, wait for grid
2. Expand the Calc panel (click its header to uncollapse)
3. Locate the Priority dropdown in CalcExplorer
4. Assert: the dropdown currently shows "SUM" (default for numeric fields)
5. Note the footer row cell values (capture text of all footer cells that contain numbers)
6. Change the dropdown from SUM to AVG
7. Wait for footer to re-render
8. Assert: at least one footer cell value has changed from step 5
9. Change the dropdown to OFF
10. Wait for footer to re-render
11. Assert: the footer row has fewer numeric values (the OFF field is excluded)

---

### `e2e/network-selection.spec.ts`

**Flow 9: Network click selects exclusively, notebook follows**

```
test('standard click selects one node exclusively, Shift-click adds to selection')
```

Interactions (starts from baseline fixture):
1. Click "Network" tab, wait for SVG nodes
2. Click the first visible node (node A)
3. Assert: Notebook panel is visible
4. Note the notebook textarea content (or that it's empty -- this is card A's content)
5. Click the second visible node (node B) -- standard click, no modifier
6. Assert: Notebook panel is still visible (did NOT hide -- Bug #6 prevented)
7. Assert: notebook textarea content has changed (now card B's content or empty)
8. Shift-click the third visible node (node C)
9. Assert: Notebook panel is still visible
10. Assert: notebook textarea still shows card B's content (first selected card, not replaced by C)
11. Click the fourth visible node (node D) -- standard click
12. Assert: Notebook panel shows card D's content (exclusive select replaced multi-selection)

---

### `e2e/filter-clear-all.spec.ts`

**Flow 10: Clear all restores unfiltered state**

```
test('Clear all removes all filter types and restores full dataset')
```

Interactions (starts from baseline fixture):
1. Click "SuperGrid" tab, wait for grid
2. Note the total data cell count as `unfilteredCount`
3. In LATCH Category section, click a chip to filter by folder
4. In LATCH Alphabet section, type "Meryl" in the search input
5. Wait 400ms for debounce
6. Assert: data cell count < `unfilteredCount`
7. Assert: "Clear all" button is visible
8. Click "Clear all"
9. Wait for grid to re-render
10. Assert: data cell count equals `unfilteredCount`
11. Assert: no chip has active styling
12. Assert: search input is empty
13. Assert: "Clear all" button is hidden
14. Assert: all section badges show "0" or are not visible

---

### `e2e/filter-compound.spec.ts`

**Flow 11: Multiple filter types compose correctly**

```
test('applying three filter types narrows results monotonically, removing one broadens')
```

Interactions (starts from baseline fixture):
1. Click "List" tab, wait for list rows
2. Count rows as `count0` (full dataset)
3. In LATCH Category, click a Folder chip (e.g., first one)
4. Wait for re-render, count rows as `count1`
5. Assert: `count1` < `count0`
6. In LATCH Alphabet, type "Meryl" in search input
7. Wait 400ms, count rows as `count2`
8. Assert: `count2` <= `count1`
9. In LATCH Time section, click "This Year" preset on the first time field
10. Wait for re-render, count rows as `count3`
11. Assert: `count3` <= `count2`
12. Assert: three section badges are independently visible (Category, Alphabet, Time each show counts)
13. Click the same Folder chip again to toggle it off
14. Wait for re-render, count rows as `count4`
15. Assert: `count4` >= `count3` (removing one filter broadens)
16. Assert: `count4` < `count0` (other filters still active)

---

## Part 3: Execution Order

Ordered by: (a) number of seams covered, (b) UAT bug recurrence risk, (c) dependency (earlier tests establish patterns reused by later tests).

### Tier 1: Foundation (implement first -- these establish the baseline fixture and test the most seams)

| Order | Test File | Flows | Seams Covered | Rationale |
|-------|-----------|-------|---------------|-----------|
| 1 | `e2e/cold-start.spec.ts` | Flow 0 | Seam 5 | Must work before anything else. Validates the fixture pattern. Targets the mount/query race that caused the v4.2 stuck-spinner. |
| 2 | `e2e/filter-category.spec.ts` | Flow 2 | Seams 1, 3, 5 | Highest seam coverage (3 seams). Directly re-tests UAT Bug #2 and #3. Validates the most critical wiring: filter -> calc query -> footer. |
| 3 | `e2e/network-selection.spec.ts` | Flow 9 | Seam 2 | Directly re-tests UAT Bug #6 (chart disappears on click). Selection is the trigger for the notebook/chart chain. |

### Tier 2: High-value cross-component paths (implement second)

| Order | Test File | Flows | Seams Covered | Rationale |
|-------|-----------|-------|---------------|-----------|
| 4 | `e2e/notebook-chart.spec.ts` | Flow 5 | Seams 2, 3 | Validates the full chart rendering pipeline: write -> preview -> query -> render -> filter live update. Covers 2 seams. |
| 5 | `e2e/filter-histogram.spec.ts` | Flow 6 | Seams 1, 4 | Validates histogram brush -> range filter -> footer update. Covers Seam 4 (only test for this seam). |
| 6 | `e2e/calc-footer.spec.ts` | Flow 8 | Seam 1 | Validates calc config -> footer re-query. Isolated test of Seam 1 with different trigger (aggregation mode, not filter). |

### Tier 3: Coverage completeness (implement third)

| Order | Test File | Flows | Seams Covered | Rationale |
|-------|-----------|-------|---------------|-----------|
| 7 | `e2e/view-switching.spec.ts` | Flow 1 | Seam 5 | Validates destroy/mount lifecycle and coordinator unsubscribe. Lower risk (no UAT bugs here) but important for stability. |
| 8 | `e2e/notebook-selection.spec.ts` | Flow 4 | Seam 2 | Validates notebook content round-trip through ui_state. Lower risk but covers the flush/load seam without the chart complication. |
| 9 | `e2e/filter-search.spec.ts` | Flow 7 | Seam 5 | Validates debounce + coordinator batching for text search. Lower risk, isolated path. |
| 10 | `e2e/filter-clear-all.spec.ts` | Flow 10 | Seams 1, 4, 5 | Validates that ALL filter types clear simultaneously. Good regression net but requires Flows 2+6+7 patterns to be working first. |
| 11 | `e2e/filter-compound.spec.ts` | Flow 11 | Seams 1, 3, 5 | Validates compound WHERE clause compilation. Depends on all filter types working individually. Capstone test. |
| 12 | `e2e/projection-config.spec.ts` | Flow 3 | Seam 5 | Validates DnD axis config -> SuperGrid restructure. Last because DnD is the most mechanically complex Playwright interaction and may need special handling. |

### Seam coverage summary

| Seam | Tests that cover it | First covered by |
|------|---------------------|------------------|
| Seam 1 (Filter -> Calc -> Footer) | #2, #5, #6, #10, #11 | Test #2 (order 2) |
| Seam 2 (Selection -> Notebook -> Chart) | #3, #4, #8 | Test #3 (order 3) |
| Seam 3 (Filter -> ChartRenderer -> chart:query) | #2, #4, #11 | Test #2 (order 2) |
| Seam 4 (Filter -> Histogram -> histogram:query) | #5, #10 | Test #5 (order 5) |
| Seam 5 (Coordinator -> multi-view render) | #1, #7, #9, #10, #11, #12 | Test #1 (order 1) |

All 5 seams are covered by order 5. The remaining tests (6-12) add depth and regression safety.

### Parallel seam test implementation

While the E2E tests above exercise seams via real browser interactions, the seam tests (Vitest, no browser) should be implemented in lockstep. Each seam test wires real provider instances to real handler logic with a mock database -- no component mocks at the boundary. Recommended seam test files:

| Seam Test File | Seam | What it wires |
|----------------|------|---------------|
| `tests/integration/seam-calc-footer.test.ts` | Seam 1 | Real FilterProvider + real `buildSuperGridCalcQuery()` + mock DB rows -> verify footer renderer gets per-column values |
| `tests/integration/seam-selection-notebook.test.ts` | Seam 2 | Real SelectionProvider -> real NotebookExplorer -> mock bridge -> verify flush/load sequence and chart mount |
| `tests/integration/seam-filter-chart.test.ts` | Seam 3 | Real FilterProvider -> real ChartRenderer -> mock bridge -> verify chart:query includes filter WHERE clause |
| `tests/integration/seam-filter-histogram.test.ts` | Seam 4 | Real FilterProvider -> real HistogramScrubber -> mock bridge -> verify range filter compiles into WHERE |
| `tests/integration/seam-coordinator-batch.test.ts` | Seam 5 | Real StateCoordinator + multiple providers -> verify single batched callback, no orphaned timers |

These seam tests run in Vitest (fast, no browser overhead) and protect the wiring. The E2E tests run in Playwright (real browser) and protect the user experience. Neither layer alone is sufficient.
