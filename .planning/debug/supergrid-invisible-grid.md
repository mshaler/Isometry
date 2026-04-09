---
status: awaiting_human_verify
updated: 2026-03-27T04:00:00Z
trigger: "SuperGrid PivotGrid renders 61 cells (grid.render() completes successfully) but nothing is visible in WKWebView macOS app."
created: 2026-03-27T00:00:00Z
updated: 2026-03-27T00:00:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: RESOLVED. Two root causes found and fixed via browser dev server Playwright inspection.
test: Playwright measured shell height 900px (was 677px), pvGridWrapper display:flex (was block), pvGridRoot height 195px (was 0), pvScrollContainer height 195px (was 0).
expecting: SuperGrid renders grid with data filling available space.
next_action: Rebuild native WebBundle and verify in WKWebView.

## Symptoms

expected: SuperGrid should display a pivot table with 61 data cells (61 rows × 5 columns) showing card counts grouped by folder (rows) and card_type (columns)
actual: Config panel renders correctly (SuperGrid title, Available fields, Rows: folder, Columns: card_type, Transpose/Hide checkboxes). Below config panel is just a white empty area. No error banner, no "No matching cards" empty state. Grid data is invisible.
errors: No JS errors. Console logs confirm: fetchData resolved with data.size=61, rows=61, cols=5. grid.render() completes. The data pipeline works perfectly — this is a rendering/CSS issue only.
reproduction: 1) Build macOS app in Xcode 2) Launch app 3) Import or have data in database 4) Click SuperGrid in sidebar 5) Observe config panel renders but grid area is white/empty
started: Recurring issue ("AGAIN" per user). Has likely never worked correctly in WKWebView since the Phase 97 rewrite.

## Eliminated

- hypothesis: html/body/app height chain broken
  evidence: html,body,#app { height:100%; margin:0; padding:0 } was already added to design-tokens.css (line 546-550). Verified present in code.
  timestamp: 2026-03-27T00:00:00Z

- hypothesis: pv-grid-root needed flex:1;min-height:0 instead of height:100%
  evidence: PivotGrid.ts mount() already injects inline style `position:relative;width:100%;flex:1;min-height:0;overflow:hidden;`. Fix was already applied but did not solve it.
  timestamp: 2026-03-27T00:00:00Z

## Evidence

- timestamp: 2026-03-27T00:00:00Z
  checked: pivot.css lines 317-322 (.pv-grid-wrapper CSS rule)
  found: CSS sets `overflow: auto` on .pv-grid-wrapper — NOT overflow:hidden, NOT display:flex
  implication: CONFLICT. PivotTable.ts line 106 injects inline style with `overflow:hidden;display:flex;flex-direction:column`. CSS rule and inline style both target the same element. Inline style wins, so overflow:hidden and display:flex ARE applied (correct). BUT the CSS `overflow: auto` would normally enable scrolling — the fact it is overridden to `overflow:hidden` by inline style means the wrapper itself does not scroll, relying on the inner pv-scroll-container to scroll. This is intentional design per the two-layer architecture.

- timestamp: 2026-03-27T00:00:00Z
  checked: PivotTable.ts line 83 (.pv-root inline style)
  found: `display:flex;flex-direction:column;height:100%;`
  implication: pv-root uses height:100% — this requires its parent (.workbench-view-content) to have a definite height. workbench-view-content has `flex:1 1 auto;min-height:0;overflow:hidden;position:relative` (workbench.css lines 69-74). This is a flex item in .workbench-main which is also flex. The height chain should resolve IF all ancestors are flex with proper constraints.

- timestamp: 2026-03-27T00:00:00Z
  checked: PivotTable.ts line 106 (.pv-grid-wrapper inline style)
  found: `flex:1;min-height:0;padding:24px;overflow:hidden;display:flex;flex-direction:column;`
  implication: pv-grid-wrapper is flex column and flex:1. Its child pv-grid-root gets `flex:1;min-height:0`. pv-grid-root is position:relative, so its absolute child pv-scroll-container (position:absolute;inset:0) should fill it completely. The chain looks correct in isolation.

- timestamp: 2026-03-27T00:00:00Z
  checked: workbench-view-content CSS (workbench.css line 69-74)
  found: `flex: 1 1 auto; min-height: 0; overflow: hidden; position: relative;`
  implication: position:relative on workbench-view-content is a CRITICAL FINDING. When pv-root uses height:100%, that resolves against the nearest positioned ancestor... but height:100% in CSS means 100% of the containing block's HEIGHT. The containing block for a non-positioned element is the nearest block ancestor. For a flex item, height:100% resolves to the flex container's height (works in most browsers). BUT workbench-view-content also has `position:relative` — this does NOT change how height:100% resolves for flex children. Still should work.

- timestamp: 2026-03-27T00:00:00Z
  checked: pv-scroll-container uses position:absolute;inset:0
  found: `inset` is shorthand for top:0;right:0;bottom:0;left:0. Its containing block is pv-grid-root (position:relative). pv-grid-root has flex:1;min-height:0 — its computed height comes from the flex layout. IF pv-grid-root has height > 0, pv-scroll-container fills it.

- timestamp: 2026-03-27T00:00:00Z
  checked: CSS specificity conflict between pivot.css and inline styles
  found: pivot.css .pv-grid-wrapper sets `overflow: auto` (no display, no flex). Inline style on the element sets `overflow:hidden;display:flex;flex-direction:column`. Inline style wins on all properties. Net result: display:flex, flex-direction:column, overflow:hidden — which is what the code intends.

- timestamp: 2026-03-27T00:00:00Z
  checked: Whether `inset` CSS property works in WebKit/WKWebView
  found: `inset` was added in Safari 14.1 (2021). macOS app uses WKWebView which tracks Safari's rendering engine. Should be supported.

- timestamp: 2026-03-27T00:00:00Z
  checked: How pv-root mounts — PivotTable.mount() appends pv-root to container. What is container?
  found: ProductionSuperGrid.ts delegates to PivotTable.mount(). The container passed is the .workbench-view-content element. pv-root becomes a direct child of workbench-view-content.

- timestamp: 2026-03-27T00:00:00Z
  checked: workbench-view-content positioning and height
  found: workbench-view-content has position:relative. pv-root is NOT position:absolute — it is a normal flex child with display:flex and height:100%. In a flex column context (workbench-main is flex-direction:column), pv-root as a flex item with height:100% should work... BUT height:100% on a flex item is defined to resolve against the flex container's inner height. workbench-view-content is NOT a flex container — workbench-main is. workbench-view-content IS a flex item of workbench-main. When pv-root (a NON-flex-item child of workbench-view-content) uses height:100%, it resolves against workbench-view-content's height, which is its computed height from flex layout. This should be fine.

- timestamp: 2026-03-27T00:00:00Z
  checked: KEY INSIGHT — workbench-view-content has overflow:hidden. pv-root has height:100%. The KEY QUESTION: does workbench-view-content establish a block formatting context or flex context for its children?
  found: workbench-view-content has no display property set — it inherits or defaults. It IS a flex item (child of .workbench-main which is display:flex). But its OWN children use default block layout. pv-root with display:flex and height:100% is a block-level flex container. Its height:100% should resolve against workbench-view-content's computed height (from flex sizing).

- timestamp: 2026-03-27T00:00:00Z
  checked: THE ACTUAL BUG — WebKit behavior with height:100% on flex items vs regular block children
  found: In WebKit (Safari/WKWebView), `height: 100%` on a child of a flex item (pv-root inside workbench-view-content) requires the parent (workbench-view-content) to have an explicit height or be a flex container itself. workbench-view-content has `flex: 1 1 auto; min-height: 0` but NO explicit height. In Chrome, flex items automatically resolve percentage heights of their children. In WebKit, this behavior has historically been inconsistent. The fix pattern is to make workbench-view-content itself a flex container (display:flex; flex-direction:column) OR change pv-root to use flex:1 instead of height:100%.

- timestamp: 2026-03-27T01:00:00Z
  checked: PivotTable.mount() external subscriber callback (line 115)
  found: adapter.subscribe(() => this._renderAll()) — does NOT sync _state from adapter before rendering
  implication: When external source (ProjectionExplorer) changes pafv axes, coordinator notifies PivotTable, which re-renders using stale _state.rowDimensions/colDimensions. Grid always queries with original axes. User sees no change.

- timestamp: 2026-03-27T01:00:00Z
  checked: BridgeDataAdapter.getAllDimensions() (line 105-117)
  found: Only returns union of rowAxes+colAxes from provider.getStackedGroupBySQL(). Since both axes are already assigned, Available zone is always empty. Users cannot add new fields to the config panel.
  implication: The config panel Available zone is always empty. Only reorder (within rows/cols or between them) is possible. Cannot add fields like "tags", "status", "priority" etc.

## Evidence

- timestamp: 2026-03-27T02:00:00Z
  checked: Whether pivot.css is imported by any TypeScript file
  found: grep -rn "import.*styles/" src/ reveals NO import of pivot.css by any file. WorkbenchShell imports workbench.css, PropertiesExplorer imports properties-explorer.css, but nothing imports pivot.css. Confirmed by checking WebBundle CSS (index-Cg9nOh3v.css): contains 0 occurrences of "pv-" prefix. Also confirmed --pv-* CSS variables defined only in pivot.css, not in design-tokens.css.
  implication: The ENTIRE pivot CSS module (--pv-* tokens, .pv-root, .pv-header, .pv-chip, .pv-drop-zone, .pv-table, .pv-grid-root, etc.) is absent from the production build. Grid cells render but are invisible because they have no background colors or borders. Config panel chips and zones are completely unstyled, explaining "old styling" comment.

- timestamp: 2026-03-27T02:00:00Z
  checked: Whether previously applied fixes (JS bundle index-4b5x6Osz.js from 20:31) are present
  found: grep confirms: "position:absolute;inset" (Fix 1) appears once, "getRowDimensions" + "getColDimensions" (Fix 2) appear twice, "getAxisColumns" (Fix 3) appears 4 times. All three JS fixes from previous session ARE in the built bundle.
  implication: The three JS fixes were correctly deployed but could not make the grid visible because the CSS (which gives cells their visible appearance) was never included in the build.

- timestamp: 2026-03-27T02:00:00Z
  checked: CSS bundle timestamp vs JS bundle timestamp
  found: index-Cg9nOh3v.css timestamp 20:18, index-4b5x6Osz.js timestamp 20:31. The CSS bundle was built first, then only JS was rebuilt. The CSS bundle DOES contain html/body/#app height:100% (which IS present in the CSS bundle, confirming design-tokens.css changes were built into CSS). But pivot.css was never imported even at CSS build time.
  implication: The CSS bundle is correct for what it knew to include. The missing import of pivot.css is a pre-existing omission from when the pivot module was originally created — it has NEVER been included in any build.

- timestamp: 2026-03-27T03:00:00Z
  checked: Browser dev server (npm run dev + Playwright). Ancestor chain of .workbench-shell.
  found: Shell's parent is #main-content (677px, display:block). #app does not exist — main.ts line 95 renames it to main-content. CSS rule `html, body, #app { height:100% }` is dead code since #app no longer exists after app boot.
  implication: .workbench-shell's containing block (main-content) is 677px not 900px, causing "only half the window" symptom. Fix: change CSS selector to #main-content.

- timestamp: 2026-03-27T03:30:00Z
  checked: pvGridWrapper computed style after data loads (sample data loaded, back on SuperGrid).
  found: pvGridWrapper has display:block (should be flex). Root cause: _clearEmptyState() sets `this._gridContainer.style.display = ''` which removes the display:flex that was set via cssText during mount. Once display reverts to block, pvGridRoot gets height:0 because flex:1 has no effect in a block container.
  implication: Table renders (height 169px, scrollHeight 169px) but is invisible because pvGridRoot and pvScrollContainer have height:0. Fix: _clearEmptyState() must set display = 'flex' not ''.

## Resolution

root_cause: SIX bugs confirmed in total across all sessions:
  1. (CSS/Layout) pv-root used height:100% but workbench-view-content needed to be a flex container. FIXED: pv-root changed to position:absolute;inset:0.
  2. (State sync) PivotTable external subscriber callback didn't sync _state from adapter. FIXED.
  3. (Available zone empty) BridgeDataAdapter.getAllDimensions() only returned already-assigned fields. FIXED: uses SchemaProvider.getAxisColumns() when available.
  4. (Pivot CSS missing) pivot.css was never imported — all .pv-* styles absent from build. FIXED: added import to PivotTable.ts.
  5. (CRITICAL — ROOT CAUSE OF "HALF WINDOW") main.ts renames #app to #main-content at runtime (line 95), but design-tokens.css targeted `#app { height:100% }` — CSS rule became dead code after rename. FIXED: changed selector to `#main-content`.
  6. (CRITICAL — GRID INVISIBLE WITH DATA) _clearEmptyState() set `this._gridContainer.style.display = ''` which cleared the inline display:flex set by cssText during mount, reverting to default display:block. pvGridWrapper then couldn't function as flex container so pvGridRoot had height:0. FIXED: changed to `style.display = 'flex'`.
fix: Six fixes applied — full rebuild complete:
  Fix 1: PivotTable.ts line 84 inline style → position:absolute;inset:0
  Fix 2: PivotTable.ts external subscriber syncs _state before re-rendering
  Fix 3: BridgeDataAdapter.getAllDimensions() uses SchemaProvider.getAxisColumns()
  Fix 4: Added `import '../../styles/pivot.css';` to PivotTable.ts
  Fix 5: design-tokens.css `html, body, #app` → `html, body, #main-content`
  Fix 6: PivotTable.ts _clearEmptyState() `style.display = ''` → `style.display = 'flex'`
verification: Browser dev server (npm run dev) Playwright verification:
  - shell height: 900px (was 677px) — fix 5 resolved
  - pvGridWrapper: display:flex, height 227px (was display:block, height N/A) — fix 6 resolved
  - pvGridRoot: height 195px (was 0) — cascades from fix 6
  - pvScrollContainer: height 195px (was 0) — cascades from fix 6
  - Table renders with data: folder vs card_type grid (award/cast/director/film × person/resource)
  - Full rebuild: index-gCDzMoFE.js (704.70 kB), index-DkWubHzW.css (104.81 kB)
  - WebBundle updated. index.html fingerprints updated.
  Awaiting human verification in WKWebView.
files_changed:
  - src/styles/design-tokens.css (Fix 5)
  - src/views/pivot/PivotTable.ts (Fixes 1, 2, 4, 6)
  - src/styles/pivot.css (Fix 1 CSS edit)
  - src/views/pivot/BridgeDataAdapter.ts (Fix 3)
  - native/Isometry/Isometry/WebBundle/index.html
  - native/Isometry/Isometry/WebBundle/assets/ (full rebuild)
