# Domain Pitfalls: Polish + QoL on Existing Complex System

**Domain:** Adding build health fixes, UX polish (empty states, keyboard shortcuts, visual refinements), stability hardening, and end-to-end ETL validation to an existing 30K+ LOC data visualization app with 9 views, 9 import sources, and a dual TypeScript/Swift codebase
**Researched:** 2026-03-07
**Overall confidence:** HIGH (all pitfalls derived from direct codebase inspection of production code, test results, and build output -- not speculation)

---

## Critical Pitfalls

Mistakes that cause regressions, break shipping features, or require significant rework.

### Pitfall 1: Keyboard Shortcut Collision Layer Cake

**What goes wrong:** New keyboard shortcuts conflict with existing shortcuts registered at different layers, causing double-firing, swallowed events, or broken native behavior.

**Why it happens:** Isometry has **four independent keydown listener layers** that all bind to `document.addEventListener('keydown', ...)`:

1. **MutationManager shortcuts** (`src/mutations/shortcuts.ts`): Cmd+Z, Cmd+Shift+Z, Ctrl+Y
2. **AuditOverlay** (`src/audit/AuditOverlay.ts`): Shift+A
3. **SuperGrid-specific** (`src/views/SuperGrid.ts`): Cmd+F (search focus), Cmd+/ (help overlay), Escape (close panels). **SuperZoom** (`src/views/supergrid/SuperZoom.ts`): Cmd+0 (zoom reset). Plus Cmd+click for multi-select and sort.
4. **Native macOS Commands** (`IsometryApp.swift`): Cmd+I (import), Cmd+Z/Cmd+Shift+Z (undo/redo via NotificationCenter routing)

Adding new shortcuts (e.g., Cmd+1-9 for view switching, Cmd+E for export, Cmd+, for settings) can collide at multiple levels:
- **macOS reserves** Cmd+H (hide), Cmd+Q (quit), Cmd+W (close window), Cmd+M (minimize), Cmd+comma (preferences). WKWebView intercepts these before JS sees them.
- **SuperGrid shortcuts are only active when SuperGrid is mounted** -- but document-level listeners from MutationManager and AuditOverlay fire regardless of which view is active.
- **Input field guards are inconsistent.** MutationManager (`shortcuts.ts` line 46-55) and AuditOverlay (`AuditOverlay.ts` line 55-61) both check for INPUT/TEXTAREA/contentEditable. But SuperZoom's Cmd+0 handler (`SuperZoom.ts` line 140-143) has **NO input field guard** -- pressing 0 in a filter input with Cmd held will reset zoom.

**Consequences:** Users type in a filter/search input and accidentally trigger shortcuts. New shortcuts fire in wrong views. macOS menu bar commands silently swallowed by JS `preventDefault()`. Duplicate undo/redo execution (both macOS Commands and JS shortcuts fire for Cmd+Z in WKWebView).

**Prevention:**
- Create a single `ShortcutRegistry` module that centralizes all keyboard bindings with view-scoping and priority
- Fix SuperZoom.ts missing input field guard immediately (line 140-143) -- add the same INPUT/TEXTAREA/contentEditable check that shortcuts.ts uses
- Test every new shortcut against: (1) SuperGrid active with search focused, (2) non-SuperGrid view active, (3) filter dropdown open, (4) macOS menu bar equivalents
- Never bind Cmd+H, Cmd+Q, Cmd+W, Cmd+M, Cmd+comma in JS -- macOS owns these
- For view-switching shortcuts (Cmd+1-9), route through the native bridge to `ContentView.swift` sidebar selection rather than handling in JS -- avoids double-handling with any future macOS Commands
- Extend the existing SuperGrid help overlay (`Cmd+/`) to show all app-wide shortcuts, not just SuperGrid-specific ones

**Detection:** Any keydown handler that calls `e.preventDefault()` without checking `target.tagName` for form elements. Any shortcut binding that uses `document.addEventListener` instead of being scoped to a view element.

---

### Pitfall 2: Empty State DOM Injection Corrupts D3 Data Joins

**What goes wrong:** Adding empty state UI inside individual view containers breaks D3's `selectAll().data().join()` cycle because D3 finds unexpected DOM elements during its next render.

**Why it happens:** ViewManager currently handles empty states at the **manager level** (`ViewManager.ts` lines 248-250): when `cards.length === 0`, it appends a `div.view-empty` to the container and **skips** calling `view.render()`. This works because the empty state element lives in the shared container, outside the view's managed DOM subtree. But the codebase has **three inconsistent empty state patterns** that must be reconciled:

1. **ViewManager** (lines 351-355): Appends `div.view-empty` with text "No cards match current filters". Cleared by `_clearErrorAndEmpty()` before next fetch.

2. **NetworkView** (line 164-167): Internal early-return on empty cards -- calls `_clear()` which removes all SVG content. Does NOT show any empty message. If ViewManager also shows its empty state, the user sees the ViewManager message but with a blank SVG background.

3. **TreeView** (line 209-212): Internal early-return on empty cards with SVG clearing. Same pattern as NetworkView.

4. **KanbanView** (lines 166-181): Has per-column empty states (`div.kanban-empty` with "No cards"). This is separate from zero-total-cards empty state -- it's for individual columns that have no cards after grouping.

5. **SuperGrid** (`render()` at line 983): Render is a **no-op** -- data comes from `bridge.superGridQuery()`, not from ViewManager's fetch. SuperGrid's empty state is unreachable through ViewManager's code path. It must handle its own empty state internally (when `_lastCells` is empty after query).

6. **GalleryView** (line 69): Uses `innerHTML = ''` on every render() call, destroying any previously injected empty state elements.

The danger: if individual views add their own empty state elements (with icons, import CTAs, view-specific messages), they can conflict with D3 data joins on the next render:
- SVG views (List, Grid, Timeline) create `<g class="cards">` for D3 -- appending a `<div>` inside SVG is invalid DOM
- D3 `selectAll('.card')` may accidentally match empty state elements if class names overlap
- Views that clear their container (`GalleryView.innerHTML = ''`, NetworkView `_clear()`) will destroy injected empty states

**Consequences:** Visual glitches where empty state persists alongside real cards. D3 enter/update/exit cycles get confused. SVG rendering errors. Duplicate empty state messages (ViewManager shows one, NetworkView/TreeView have their own).

**Prevention:**
- Keep empty state handling in ViewManager._showEmpty() as the **single source of truth** -- do NOT add per-view empty state rendering
- Enhance _showEmpty() to be view-type-aware: accept the current viewType and display contextual messages ("No connections found -- import data with connections to see the network" for network/tree, "No cards match current filters" for filtered views, "Import data to get started" for zero-data first launch)
- Remove redundant empty handling from NetworkView (line 164-167) and TreeView (line 209-212) -- let ViewManager handle it before calling render()
- For SuperGrid: add empty state detection in the `_handleSuperGridQueryResult()` path when filtered cells array is empty, but render the empty state **outside** the CSS Grid container element, not inside it
- KanbanView per-column empty state is correct and should remain -- it's a different concern (grouping empty, not data empty)
- Test cycle: import data, render view, delete all cards, confirm empty state appears without console errors, import again, confirm empty state disappears and cards render correctly

**Detection:** Any code that appends non-D3-managed elements to the same parent element that D3 uses for `selectAll().data().join()`.

---

### Pitfall 3: Build Pipeline Fix Cascade -- TS Strict Mode

**What goes wrong:** Fixing TypeScript strict mode errors to enable `tsc --noEmit` as a CI gate causes a cascade of changes across 26 files, and "mechanical" fixes can introduce subtle runtime behavior changes.

**Why it happens:** Current state from `npx tsc --noEmit` (measured 2026-03-07):

| Error type | Count | Files | Fix complexity |
|------------|-------|-------|---------------|
| TS4111 (noPropertyAccessFromIndexSignature) | ~250 | 20+ (mostly tests) | Mechanical: `obj.data` to `obj['data']` |
| TS2345 (argument type mismatch) | ~30 | SuperGrid.ts, test files | Requires understanding each case |
| TS2322 (type assignment mismatch) | ~20 | NativeBridge.ts, test mocks | Requires type narrowing or assertion |
| Other | ~14 | Scattered | Case-by-case |

**Total: 314 errors across 26 files (56 in production code, 258 in test files)**

The build pipeline has **intentional workarounds** that are load-bearing:

1. **`build:native` skips tsc** -- runs `vite build` directly. Vite uses esbuild for transpilation, which ignores type errors entirely. The app works at runtime.

2. **`as any` casts in production code are structural**, not sloppy:
   - `ImportOrchestrator.ts` (5 instances, line 168-198): Parser options generic type doesn't narrow correctly per source type
   - `NativeBridge.ts` (4 instances): `window.__isometry` dynamic property access and bridge method override
   - `TreeView.ts` (line 518/522): D3 HierarchyNode `children` property is readonly -- mutation requires `as any` cast
   - `SuperGrid.ts` (line 871): SuperPositionProvider doesn't exactly match SuperZoom's expected interface

3. **The npm Run Script build phase in Xcode** (project.pbxproj line 275) uses `REPO_ROOT="$(dirname "$(dirname "$SRCROOT")")"` to find package.json. This path calculation assumes `native/Isometry/Isometry.xcodeproj` is exactly two directories deep from the repo root. It already fails pre-existing ("Pre-existing npm Run Script build phase fails -- package.json path mismatch" per PROJECT.md).

**Consequences:** "Fix typecheck" becomes a 300+ line change touching ETL parsers, NativeBridge, SuperGrid, and 20+ test files. Each TS4111 fix is safe (bracket notation is semantically identical to dot notation). But TS2345/TS2322 fixes require understanding why the types don't match -- incorrect fixes can narrow types incorrectly and crash at runtime.

**Prevention:**
- Fix TS errors in **strict batches by error type**, running `npx vitest --run` after each batch:
  - **Batch 1:** TS4111 bracket notation fixes in production code (mechanical, zero runtime risk, ~26 errors in 4 files)
  - **Batch 2:** TS4111 bracket notation fixes in test files (~224 errors in 16 files, also mechanical)
  - **Batch 3:** TS2345/TS2322 type narrowing in production code (~30 errors in 3 files, requires understanding each case)
  - **Batch 4:** TS2345/TS2322 in test files (~30 errors in 10 files)
- Do NOT "fix" `as any` casts unless you understand why they exist. TreeView's `(node as any).children` works around D3's HierarchyNode readonly constraint -- there is no clean alternative.
- For the Xcode Run Script build phase: hardcode `REPO_ROOT="$SRCROOT/../../.."` or use `REPO_ROOT="$(git -C "$SRCROOT" rev-parse --show-toplevel)"` for robustness
- Consider `tsconfig.build.json` that excludes test files to separate production type-safety from test type-safety
- Add `npm run typecheck` to a pre-commit hook or CI step only **after** all errors are fixed -- not before

**Detection:** Any commit that adds `@ts-ignore`, `@ts-expect-error`, or new `as any` casts is hiding a problem, not fixing it.

---

### Pitfall 4: ETL Real-World Data Edge Cases Across 9 Sources

**What goes wrong:** ETL parsers work with test fixtures but fail on real-world data containing unexpected encodings, missing fields, malformed structures, or extreme sizes.

**Why it happens:** Each of the 9 import sources has documented-but-untested edge cases:

**File-based (TypeScript ETL):**

| Source | Known edge case | Risk |
|--------|---------------|------|
| Apple Notes JSON | Note-to-note link URLs unverified against real data (3 formats: `applenotes:`, `notes://`, `x-coredata://`). Tables render as `[Table]` placeholder. | MEDIUM -- link patterns may not match real exports |
| Markdown | YAML frontmatter `tags` assumes `string \| string[]` (MarkdownParser.ts line 184-193). `date` field may be a JS Date object, not string (line 249-253). gray-matter handles this but downstream code may not. | MEDIUM -- Obsidian/Jekyll frontmatter varies widely |
| Excel | SheetJS ~1MB dynamic import. Merged cells, formulas (evaluated as values), custom number formats may produce unexpected strings. | LOW -- SheetJS is mature |
| CSV | PapaParse handles encoding well. Semicolon-delimited tags means real CSV data containing semicolons in content fields gets corrupted during import-then-export round-trip. | LOW -- well-tested |
| JSON | Expects `data`, `items`, `cards`, or `records` wrapper keys (JSONParser.ts line 116-134). Flat arrays or nested structures with different key names produce **empty imports with no error or warning**. | HIGH -- silent failure |
| HTML | Regex-based parsing (no DOM). Complex HTML with deeply nested tables, iframes, or script tags may produce garbled content. | MEDIUM -- regex is fragile by nature |

**Native (Swift adapters):**

| Source | Known edge case | Risk |
|--------|---------------|------|
| Apple Notes SQLite | Schema varies by macOS version (runtime detection). Protobuf body extraction has three-tier fallback. Notes with embedded drawings, scanned documents, or shared collaboration markers may fail silently at body extraction. | MEDIUM -- fallback chain handles gracefully |
| Reminders EventKit | Completed reminders limited to 30-day window. Reminders with rich links or subtasks may lose metadata. Recurring reminder expansion varies by completion state. | LOW -- EventKit API is stable |
| Calendar EventKit | All-day events vs timed events have different datetime handling. Recurring events expand to instances. Attendee cards use `source_url: "attendee-of:..."` prefix convention. | LOW -- well-tested in v4.0 |

**Consequences:** Users import their real data, see missing cards, corrupted content, or silent empty results. Hard to debug because test fixtures pass. The JSON parser silent failure mode is the highest risk -- users import a valid JSON file with a different structure and get zero cards with no error message.

**Prevention:**
- **JSON parser:** Add explicit warning when no recognized wrapper key (`data`, `items`, `cards`, `records`) is found. Log the actual top-level keys to help users understand the expected format.
- **Markdown parser:** Test with real Obsidian vault exports (wikilinks, YAML arrays in frontmatter, Dataview annotations, embedded images with `![[...]]` syntax).
- **Real corpus testing:** Import your own Apple Notes, Calendar events, and Reminders. Run each import through all 9 views to verify rendering.
- **Round-trip validation:** For each source: import -> inspect in list view -> export to JSON -> re-import -> compare card counts. Any discrepancy reveals a data loss path.
- **Edge case matrix:** For each parser, test with: empty input, single item, 1000+ items, Unicode content (emoji, CJK, RTL text), maximum-length fields, NULL/missing required fields.
- **Error surface:** Any parser that returns 0 cards should produce a toast notification explaining why (not just "Import complete: 0 cards").

**Detection:** Any parser function that returns an empty array without logging a warning or emitting a notification.

---

## Moderate Pitfalls

### Pitfall 5: View-Specific Empty State Inconsistency Across 9 Views

**What goes wrong:** Each of the 9 views has different internal structure and different existing behavior when receiving zero cards, leading to inconsistent empty state UX if not unified.

**Prevention:**
- Map each view's current empty handling:
  - **ListView/GridView/TimelineView** (SVG): No internal empty handling -- relies entirely on ViewManager
  - **CalendarView** (SVG/HTML hybrid): No internal empty handling -- relies on ViewManager
  - **KanbanView** (HTML): Has per-column empty state (`div.kanban-empty` "No cards") -- separate concern from zero-data
  - **GalleryView** (pure HTML): Clears `innerHTML` on every render -- no empty handling
  - **NetworkView** (SVG): Internal `_clear()` on empty cards -- clears SVG but shows no message
  - **TreeView** (SVG): Internal early-return on empty -- clears SVG but shows no message
  - **SuperGrid** (CSS Grid): `render()` is no-op. Data via `superGridQuery()`. ViewManager empty path unreachable.
- Standardize: ViewManager._showEmpty() is the single empty state path. View-type-aware messages:
  - Default: "No cards match current filters"
  - First launch (zero cards in DB): "Import data to get started" with import CTA button
  - Network/Tree with zero connections: "No connections found -- import data with relationships"
  - SuperGrid needs its own empty path in query result handler

### Pitfall 6: CSS Specificity Wars During Visual Polish

**What goes wrong:** Visual polish changes (spacing, typography, colors) conflict with existing CSS that uses inline styles set by JavaScript or high-specificity selectors.

**Prevention:**
- SuperGrid sets many styles via inline `style.cssText` and `style.setProperty()` in JavaScript -- CSS stylesheet changes to `.supergrid-cell`, `.sg-header-cell`, etc. will be overridden by inline styles
- CSS Custom Properties (design tokens in `design-tokens.css`) are the safe path -- change token values, not individual selectors
- Audit overlay uses `.audit-mode` class on `#app` container with CSS cascading -- any container-level style changes interact with audit mode
- SuperGrid zoom uses CSS Custom Properties (`--sg-col-width`, `--sg-row-height`, `--sg-zoom`) -- do not set fixed pixel values that fight these
- Test every visual change at zoom levels 0.5x, 1.0x, and 2.0x
- Test with audit mode ON and OFF for every visual change
- Do not add `!important` to any rule -- it creates an escalation that is impossible to maintain

### Pitfall 7: Pre-Existing Test Failures Mask New Regressions

**What goes wrong:** The 4 pre-existing test failures in `SuperGridSizer.test.ts` (expect 160px default column width, get 80px after v3.1 depth change) and 5 failures in `supergrid.handler.test.ts` (db.prepare not a function) create noise that masks new regressions.

**Prevention:**
- Fix or skip the 4 `SuperGridSizer.test.ts` failures FIRST to establish a clean baseline. These are caused by the v3.1 depth change reducing default column width from 160px to 80px -- the tests need their expected values updated.
- The 5 `supergrid.handler.test.ts` failures (db.prepare not a function) are a mock infrastructure issue -- the test creates a mock db without the `prepare` method. Fix the mock or skip with `it.skip()` and a documented reason.
- After fixing pre-existing failures, the test suite should be at 0 failures. Any new failure during v4.2 is immediately attributable to v4.2 changes.
- `@vitest/web-worker` shares Worker module state between test instances -- tests that modify Worker global state (e.g., database state) can bleed into subsequent tests. Avoid test ordering dependencies.
- Run `npx vitest --run` before and after every phase to catch regressions early.

### Pitfall 8: Provisioning Profile Entitlement Regeneration

**What goes wrong:** Fixing the provisioning profile for CloudKit capability requires regenerating it in Apple Developer Portal, which may drop or misconfigure other capabilities.

**Prevention:**
- Current entitlements in `Isometry.entitlements`:
  - iCloud (both Documents and CloudKit)
  - Push Notifications (for CloudKit remote push)
  - Any capability required by StoreKit 2 (in-app purchases)
- Regeneration must include ALL capabilities simultaneously -- Apple Developer Portal does not merge, it replaces
- StoreKit 2 products need App Store Connect setup for production (local `.storekit` sandbox works without real profile)
- Test on physical device after profile changes -- Simulator does not validate provisioning profiles
- The npm Run Script build phase path mismatch is a separate issue from provisioning -- fix both but test independently
- Document exact capabilities and entitlement keys in the fix commit message

### Pitfall 9: Native Bridge Side-Effects When Adding New Features

**What goes wrong:** Adding new `native:action` kinds (e.g., for keyboard shortcuts that trigger native behavior, or for settings changes) without properly handling both sides of the bridge creates silent failures or crashes.

**Prevention:**
- The bridge has 6 message types -- extending via new `native:action` kind values is the correct pattern (not adding new message types)
- Both `BridgeManager.swift` (Swift dispatch switch) and `NativeBridge.ts` (JS dispatch) must handle new kinds
- `native:blocked` response path must be tested for new feature-gated actions
- v4.1 added `native:sync` and `native:export-all-cards` -- verify these still work after bridge changes
- The `SyncMerger` unwrapped send pattern (capture `bridge.send` before mutation hook) in NativeBridge.ts is fragile -- any changes to the bridge `send` method signature will silently break sync echo loop prevention
- The `window.__isometry` object is populated in two phases: `waitForLaunchPayload()` sets `receive`, then `main()` merges bridge/provider refs. Race conditions are possible if new code accesses `window.__isometry` between these two phases.

### Pitfall 10: SuperGrid Zoom Interaction with Visual Polish

**What goes wrong:** Typography and spacing changes that look correct at 1.0x zoom break at other zoom levels because SuperGrid uses CSS Custom Properties for zoom-dependent sizing.

**Prevention:**
- SuperZoom sets `--sg-col-width`, `--sg-row-height`, `--sg-zoom` on the grid element
- Any font-size, padding, or margin that should scale with zoom must use `calc(Npx * var(--sg-zoom))` -- not fixed pixel values
- Cell content truncation (text-overflow: ellipsis) depends on the column width, which changes with zoom -- test at min (0.5x) and max (2.0x) zoom
- The help overlay shortcut list is rendered inside the SuperGrid container and should also respect zoom
- Column resize (SuperSize) sets explicit pixel widths per column -- visual polish must not override these with percentage or fr-unit values

---

## Minor Pitfalls

### Pitfall 11: Animation Polish Breaking jsdom Tests

**What goes wrong:** Adding CSS transitions or JavaScript animations to polish view transitions causes jsdom-based tests to fail because jsdom does not support `requestAnimationFrame` timing, CSS transitions, or Web Animations API faithfully.

**Prevention:**
- Existing pattern: SVG morph transitions use direct `.attr()` in tests, CSS transitions only in real browser. FLIP animations (v3.1) work in tests because they are progressive enhancement.
- Do not `await` animation completion in test code paths -- jsdom resolves rAF synchronously
- New CSS transitions should use design token durations (`var(--transition-fast)`) so they can be overridden to 0ms in test environments
- D3 `.transition()` on SVG transform crashes jsdom (known debt from v0.5) -- use direct `.attr()` for position changes, transition only for opacity

### Pitfall 12: Context Menu Scope Leaks on View Switch

**What goes wrong:** Right-click context menus registered on one view persist after switching to another view because the event listener was attached to `document` rather than the view's container element.

**Prevention:**
- SuperGrid already has context menu registration on its root element (Phase 27 polish)
- New context menus must follow the pattern: register on the view's root element during `mount()`, remove during `destroy()`
- On macOS, WKWebView native context menus may conflict with custom JS context menus -- use `e.preventDefault()` on `contextmenu` event to suppress default menu
- Test: open context menu, switch views, verify old context menu is gone and new view's context menu works

### Pitfall 13: Accessibility Regressions During Visual Polish

**What goes wrong:** Visual polish (reducing contrast for aesthetics, icon-only buttons, color-only indicators) reduces accessibility without anyone noticing until a user reports it.

**Prevention:**
- Audit overlay color coding for 9 import sources -- ensure colors pass WCAG 2.1 AA contrast ratio (4.5:1 for text, 3:1 for UI components)
- New icon-only buttons must have `title` attribute (already done for audit toggle: `title='Toggle Audit Mode (Shift+A)'`) and ideally `aria-label`
- Keyboard focus indicators (`:focus-visible` outlines) must not be removed during visual polish
- Empty state text should use semantic HTML (`<p>`) not bare `textContent` on a `div`
- All interactive elements must be reachable via Tab key navigation

### Pitfall 14: GalleryView innerHTML Rebuild on Every Polish Change

**What goes wrong:** GalleryView uses pure HTML (no D3 data join) with `innerHTML = ''` on every render. Any enhancement that adds state to gallery tiles (hover effects, selection indicators, expand/collapse) will be lost on re-render because the entire DOM is rebuilt.

**Prevention:**
- GalleryView is the only view without D3 data join ownership -- it's listed as known technical debt
- Do not add interactive state (tooltips, expand/collapse) to gallery tiles unless GalleryView is refactored to use D3 data join
- Visual-only polish (spacing, border-radius, typography) is safe because it's CSS, not DOM state
- If gallery tiles need selection highlighting, add it via CSS class on the tile element, applied during the innerHTML rebuild (not after)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Build health: TS strict mode | Pitfall 3 -- 314 errors across 26 files | Fix by error type in batches (TS4111 first, then TS2345/TS2322), test after each batch |
| Build health: npm build phase | Pitfall 3 -- dirname chain path mismatch | Hardcode correct path relative to SRCROOT or use git rev-parse |
| Build health: provisioning profile | Pitfall 8 -- entitlement regeneration | Include ALL capabilities, test on physical device |
| Build health: CI pipeline | Pitfalls 3 + 7 -- test failures mask regressions | Fix pre-existing test failures first to establish clean baseline |
| UX: empty states | Pitfalls 2 + 5 -- DOM corruption + inconsistency | Single empty state path in ViewManager, remove redundant handlers |
| UX: keyboard shortcuts | Pitfall 1 -- collision across 4 layers | Centralized registry, fix SuperZoom missing input guard, avoid macOS-reserved combos |
| UX: visual polish | Pitfalls 6 + 10 + 13 -- CSS wars, zoom, accessibility | Change design tokens not selectors, test at multiple zoom levels, maintain contrast |
| UX: context menus | Pitfall 12 -- scope leaks on view switch | Register on view element, clean up in destroy() |
| Stability: test baseline | Pitfall 7 -- 4 SuperGridSizer + pre-existing failures | Fix or skip with documented reason before starting polish work |
| Stability: animations | Pitfall 11 -- jsdom incompatibility | Use design token durations, no await on animations in tests |
| ETL validation | Pitfall 4 -- real-world data edge cases | Real corpus testing, explicit error messages for empty results, JSON parser silent failure |
| ETL: JSON import | Pitfall 4 (highest risk) -- unrecognized wrapper key returns 0 cards silently | Add warning when no known key found, log actual keys |
| ETL: round-trip | Pitfall 4 -- data loss paths | Import -> all 9 views -> export -> re-import -> compare counts |
| Native bridge changes | Pitfall 9 -- side effects and sync breakage | Update both Swift and JS sides, test sync after bridge changes |

---

## Sources

All sources are direct codebase inspection (HIGH confidence):

- `src/mutations/shortcuts.ts` -- undo/redo keyboard shortcuts with input guard (lines 44-55)
- `src/audit/AuditOverlay.ts` -- audit toggle keyboard handler with input guard (lines 53-66)
- `src/views/SuperGrid.ts` -- Cmd+F (line 779-786), Cmd+/ (line 798-805), Escape (line 918-939)
- `src/views/supergrid/SuperZoom.ts` -- Cmd+0 handler **missing** input guard (lines 140-143)
- `src/views/ViewManager.ts` -- empty state handling (lines 248-250, 351-355, 362-366)
- `src/views/NetworkView.ts` -- redundant empty handling (line 164-167)
- `src/views/TreeView.ts` -- redundant empty handling (line 209-212)
- `src/views/KanbanView.ts` -- per-column empty state (lines 166-181)
- `src/views/GalleryView.ts` -- innerHTML rebuild (line 69)
- `src/views/SuperGrid.ts` -- render() no-op (line 983), self-managed data
- `native/Isometry/Isometry/IsometryApp.swift` -- macOS Commands: Cmd+I, Cmd+Z, Cmd+Shift+Z (lines 212-238)
- `tsconfig.json` -- strict mode flags (noPropertyAccessFromIndexSignature, exactOptionalPropertyTypes)
- `npx tsc --noEmit` output -- 314 errors: 56 production (6 files), 258 test (20 files)
- `npx vitest --run` output -- 4 pre-existing failures in SuperGridSizer.test.ts (80px vs 160px expected)
- `project.pbxproj` line 275 -- npm Run Script shellScript with dirname chain
- `src/etl/parsers/JSONParser.ts` -- wrapper key detection (lines 116-134)
- `src/native/NativeBridge.ts` -- `window.__isometry` population and `as any` casts (lines 157-159)
- `.planning/PROJECT.md` -- canonical known technical debt inventory
