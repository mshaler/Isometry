# Architecture Patterns: v4.2 Polish + QoL

**Domain:** Build health fixes, UX polish (empty states, keyboard shortcuts, visual refinements), stability hardening, ETL end-to-end validation
**Researched:** 2026-03-07
**Confidence:** HIGH -- all work modifies existing components with established patterns; no new architectural modules

---

## Executive Summary

v4.2 is a polish milestone. The critical architectural constraint is: **no new modules, no new abstractions, no new bridge message types.** Every integration point already exists. The work is about improving quality within existing boundaries.

The codebase has 276 TypeScript strict mode errors (mostly `TS2532` null checks and `TS4111` index signature access patterns), a broken `npm run build` script, provisioning profile gaps, and a generic empty state that says "No cards match current filters" regardless of whether the database is actually empty or filters are active. Keyboard shortcuts exist in two places (MutationManager shortcuts.ts and AuditOverlay keydown handler) but there is no unified registry -- each component registers its own `document.addEventListener('keydown', ...)` independently.

The architecture for v4.2 is: fix what's broken, fill what's missing, validate what shipped. No new systems.

---

## 1. Build Health: Where Fixes Land

### 1.1 TypeScript Strict Mode Errors (276 errors)

**Current state:** `npm run build` fails because it runs `tsc && vite build`. `tsc --noEmit` produces 276 errors. `build:native` sidesteps this by skipping `tsc`. Vite transpiles correctly regardless (it uses esbuild, not tsc).

**Error distribution by file:**

| File | Error Count | Primary Error Type |
|------|-------------|-------------------|
| tests/etl/SQLiteWriter.test.ts | 70 | TS2532 (null checks), TS2739 (missing properties) |
| tests/etl/parsers/HTMLParser.test.ts | 48 | TS2532 (null checks) |
| src/native/NativeBridge.ts | 27 | TS4111 (index signature access) |
| tests/views/SuperGrid.bench.ts | 20 | TS2532 (null checks) |
| src/etl/parsers/JSONParser.ts | 14 | TS4111 (index signature access) |
| tests/etl/DedupEngine.test.ts | 14 | TS2532 (null checks) |
| tests/views/SuperGrid.test.ts | 12 | TS2532 (null checks) |
| src/etl/parsers/MarkdownParser.ts | 11 | TS4111 (index signature access) |
| Remaining files | 60 | Mixed |

**Error types by code:**

| Error Code | Count | Fix Pattern |
|-----------|-------|-------------|
| TS2532 | 116 | Add non-null assertions or null checks on potentially undefined values |
| TS4111 | 68 | Replace `obj.prop` with `obj['prop']` for index signature access (`noPropertyAccessFromIndexSignature`) |
| TS2322 | 31 | Fix type assignment mismatches |
| TS2739 | 17 | Add missing required properties to object literals |
| TS2741 | 13 | Add missing properties in type assignments |
| TS2345 | 11 | Fix argument type mismatches |
| TS18048 | 11 | Add undefined checks |
| Other | 9 | Miscellaneous |

**Integration point:** These fixes are purely in source files. No architectural changes. The fixes land in:
- `src/etl/parsers/*.ts` -- production code using index signature access patterns
- `src/native/NativeBridge.ts` -- production code with index signature access in `normalizeNativeCard()`
- `src/views/SuperGrid.ts` -- 2 pre-existing `AxisMapping` type mismatches at lines 1518/1522
- `tests/**/*.ts` -- test files with missing null checks (the largest group)

**Build script fix:** The `"build"` script in package.json runs `tsc && vite build`. After fixing all 276 errors, this will work. Until then, the fix is either: (a) fix all errors, or (b) separate `tsc` into a standalone `typecheck` step and have `build` just run `vite build`.

### 1.2 npm Run Script Build Phase (Xcode)

**Current state:** The Xcode project has a "Run Script" build phase that runs `npm run build:native`. This fails because the package.json path is mismatched -- the script expects `package.json` at the Xcode project root, but it's at the repository root.

**Integration point:** This is an Xcode build phase configuration change. The fix is updating the script's working directory to the repository root (`$SRCROOT/../..` or an absolute path) or adjusting the script to `cd` to the correct directory first.

### 1.3 Provisioning Profile

**Current state:** Two gaps:
1. iCloud Documents entitlement needs regeneration in Apple Developer Portal
2. CloudKit capability needs provisioning profile regeneration (carried from v2.0)

**Integration point:** Apple Developer Portal and Xcode project settings only. No code changes.

### 1.4 Component Diagram: Build Health

```
Build Health Fixes — No new components, no architectural changes

package.json "build" script ──── Fix: make tsc pass (276 errors)
                                  or: split typecheck from build

Xcode "Run Script" phase ─────── Fix: correct working directory path

src/etl/parsers/*.ts ─────────── Fix: bracket notation for index sigs
src/native/NativeBridge.ts ────── Fix: bracket notation + type casts
src/views/SuperGrid.ts ────────── Fix: AxisMapping type on drag payload
tests/**/*.ts ─────────────────── Fix: null checks, missing properties

Apple Developer Portal ────────── Fix: regenerate provisioning profile
```

---

## 2. Empty States: Where They Live

### 2.1 Current Empty State Architecture

The existing empty state is handled in **one place**: `ViewManager._showEmpty()`. It creates a `<div class="view-empty">` with the text "No cards match current filters" and appends it to the container.

```
ViewManager._fetchAndRender()
  |
  ├── cards.length === 0 ?
  │     YES → _showEmpty()  ←── single generic message
  │     NO  → currentView.render(cards)
  |
  └── _clearErrorAndEmpty() before each fetch
```

**Problem:** The message "No cards match current filters" is wrong in two cases:
1. **Database is truly empty** (first launch, no imports) -- should say "Import data to get started" with an action
2. **Active filters excluding all results** -- current message is correct here
3. **View-specific empty guidance** -- a Network view with no connections is different from a Calendar view with no dated cards

### 2.2 Recommended Architecture: Context-Aware Empty States

Empty states should remain in `ViewManager` (the component that already owns this concern) but become context-aware. No new module or abstraction needed.

**Approach:** Extend `_showEmpty()` to accept context, and pass that context from `_fetchAndRender()`.

```
ViewManager._fetchAndRender()
  |
  ├── cards.length === 0 ?
  │     ├── isDbEmpty ? → _showEmpty('first-launch')
  │     ├── hasActiveFilters ? → _showEmpty('filtered')
  │     └── otherwise → _showEmpty('view-specific', currentViewType)
  |
  └── _showEmpty(context, viewType?) renders appropriate content
```

**How to detect "database is empty":** A single count query to the Worker. `SELECT COUNT(*) FROM cards WHERE deleted_at IS NULL` is cheap (covered by the existing soft-delete index) and can be cached for the session or until the next mutation.

**Integration points:**

| Existing Component | Modification | Impact |
|-------------------|-------------|--------|
| `ViewManager._showEmpty()` | Accept context parameter, render different content | Moderate -- 20-30 lines |
| `ViewManager._fetchAndRender()` | Before showing empty, check if DB has zero cards | Minor -- one additional query |
| `views.css` `.view-empty` | Add sub-styles for different empty states | Minor CSS |
| `main.ts` | No changes | None |

**New components:** None. Empty state logic stays in ViewManager.

### 2.3 Empty State Content Per View

| View | First Launch | Filtered Empty | View-Specific |
|------|-------------|----------------|---------------|
| All views | "No data yet. Import files or connect sources to get started." + Import button | "No cards match current filters" + Clear Filters button | -- |
| Network | -- | -- | "No connections found. Cards need relationships to appear in Network view." |
| Tree | -- | -- | "No hierarchy found. Cards need parent-child connections for Tree view." |
| Calendar | -- | -- | "No dated cards. Cards need due dates to appear on the calendar." |
| Timeline | -- | -- | "No dated cards. Cards need dates to appear on the timeline." |
| SuperGrid | -- | -- | "Configure row and column axes to project cards onto the grid." |

### 2.4 Empty State DOM Structure

```html
<!-- First launch -->
<div class="view-empty view-empty--first-launch">
  <div class="view-empty-icon"><!-- SVG icon --></div>
  <div class="view-empty-title">No data yet</div>
  <div class="view-empty-message">Import files or connect sources to get started</div>
  <button class="view-empty-action">Import...</button>
</div>

<!-- Filtered empty -->
<div class="view-empty view-empty--filtered">
  <div class="view-empty-message">No cards match current filters</div>
  <button class="view-empty-action">Clear Filters</button>
</div>
```

**Integration with native shell:** The "Import..." button in the first-launch empty state needs to trigger the same import flow as the toolbar button. In native mode, this means posting to `NotificationCenter.default` via `evaluateJavaScript`. In web mode, it can directly call `window.__isometry.bridge.importFile()`. The simplest approach: dispatch a CustomEvent that `main.ts` listens for, then routes to the appropriate import path.

---

## 3. Keyboard Shortcut System

### 3.1 Current Keyboard Shortcut Architecture

Keyboard shortcuts are handled in **three independent places** with no central registry:

1. **MutationManager shortcuts** (`src/mutations/shortcuts.ts`):
   - `Cmd+Z` / `Ctrl+Z` -- undo
   - `Cmd+Shift+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` -- redo
   - Registers `document.addEventListener('keydown', ...)` directly
   - Returns cleanup function
   - Has input field guard (INPUT, TEXTAREA, contentEditable)

2. **AuditOverlay keyboard** (`src/audit/AuditOverlay.ts`):
   - `Shift+A` -- toggle audit mode
   - Registers `document.addEventListener('keydown', ...)` directly
   - Has input field guard (same pattern, copy-pasted)
   - Cleanup in `destroy()`

3. **macOS Commands** (`native/Isometry/IsometryApp.swift`):
   - `Cmd+I` -- import file (via NotificationCenter -> evaluateJavaScript)
   - `Cmd+Z` -- undo (via NotificationCenter -> evaluateJavaScript -> MutationManager)
   - `Cmd+Shift+Z` -- redo (same path)
   - These are SwiftUI `.keyboardShortcut()` modifiers on menu items

**Problem:** No central registry means:
- No keyboard shortcut discoverability (no "?" help overlay)
- Duplicate input field guards (same 6-line pattern copied)
- Adding new shortcuts requires finding all the existing ones
- Potential conflicts (though none exist currently)

### 3.2 Recommended Architecture: Lightweight Shortcut Registry

Do NOT build a heavy abstraction. The existing pattern (document-level keydown listeners with input guards) works. The improvement is centralizing the registration so shortcuts are discoverable and guards are shared.

**Approach:** A `ShortcutRegistry` class in `src/ui/ShortcutRegistry.ts` that:
1. Owns a single `document.addEventListener('keydown', ...)` handler
2. Maintains a `Map<string, ShortcutEntry>` of registered shortcuts
3. Checks the input field guard once per keydown event (not per shortcut)
4. Provides a `getAll(): ShortcutEntry[]` method for help overlay rendering
5. Cleanup via a single `destroy()` that removes the one listener

```typescript
interface ShortcutEntry {
  /** Key combo string for display: "Cmd+Z", "Shift+A" */
  label: string;
  /** Description for help overlay */
  description: string;
  /** Shortcut matcher */
  matches: (e: KeyboardEvent) => boolean;
  /** Handler */
  handler: () => void;
}

class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutEntry>();
  private listener: ((e: KeyboardEvent) => void) | null = null;

  register(id: string, entry: ShortcutEntry): void { ... }
  unregister(id: string): void { ... }
  getAll(): ShortcutEntry[] { ... }
  mount(): void { /* single document listener */ }
  destroy(): void { /* remove listener */ }
}
```

### 3.3 Integration with Existing Components

| Existing Component | Current Approach | After v4.2 |
|-------------------|-----------------|------------|
| `shortcuts.ts` | Own keydown listener | Registers with ShortcutRegistry |
| `AuditOverlay.ts` | Own keydown listener | Registers with ShortcutRegistry |
| `main.ts` | Creates components independently | Creates ShortcutRegistry, passes to components |
| macOS Commands | SwiftUI `.keyboardShortcut()` | **Unchanged** -- these are native menu shortcuts, not web shortcuts |

**Critical insight:** macOS Commands (`Cmd+I`, `Cmd+Z`, `Cmd+Shift+Z`) are SwiftUI menu items that fire via `NotificationCenter` and `evaluateJavaScript`. They do NOT go through the web keydown handler. They will **continue to work independently** of the ShortcutRegistry. The ShortcutRegistry handles web-side shortcuts only.

**Overlap avoidance:** `Cmd+Z` and `Cmd+Shift+Z` are registered both in SwiftUI Commands AND in `shortcuts.ts`. In native mode (app:// protocol), the SwiftUI Commands intercept these before they reach the WKWebView keydown handler. In web dev mode, the shortcuts.ts handler handles them. This dual registration is intentional and correct -- the ShortcutRegistry should still register them for discoverability but mark them as "handled by native shell when in app mode."

### 3.4 New Keyboard Shortcuts for v4.2

| Shortcut | Action | Component |
|----------|--------|-----------|
| `?` or `Cmd+/` | Toggle help overlay (show all shortcuts) | ShortcutRegistry + HelpOverlay |
| `Cmd+1..9` | Switch to view by position (list=1, grid=2, ...) | ViewManager |
| `Escape` | Clear selection / close overlays | SelectionProvider, overlays |
| `Cmd+F` | Focus search (when in SuperGrid) | SuperGrid FTS |

### 3.5 Help Overlay

A simple overlay that reads `registry.getAll()` and renders a two-column table. Pure DOM (like ImportToast, AuditOverlay -- no D3, no framework).

```
┌────────────────────────────────────────┐
│            Keyboard Shortcuts          │
│                                        │
│  Cmd+Z          Undo                   │
│  Cmd+Shift+Z    Redo                   │
│  Shift+A        Toggle Audit Mode      │
│  Cmd+1..9       Switch View            │
│  Escape         Clear Selection        │
│  ?              Toggle This Help       │
│                                        │
│           Press ? to dismiss           │
└────────────────────────────────────────┘
```

**Location:** `src/ui/HelpOverlay.ts` -- follows existing UI component pattern (ImportToast, AuditOverlay).

### 3.6 Component Diagram: Keyboard Shortcuts

```
                    ShortcutRegistry (new)
                    src/ui/ShortcutRegistry.ts
                    Single document.addEventListener('keydown')
                    Shared input field guard
                           |
           ┌───────────────┼───────────────────┐
           |               |                   |
    setupMutationShortcuts AuditOverlay    New shortcuts
    (refactored to use     (refactored)    (view switch,
     registry.register())                   escape, search)
                           |
                      HelpOverlay (new)
                      src/ui/HelpOverlay.ts
                      Reads registry.getAll()

    macOS Commands (UNCHANGED — SwiftUI layer, independent)
    Cmd+I, Cmd+Z, Cmd+Shift+Z → NotificationCenter → evaluateJavaScript
```

---

## 4. ETL End-to-End Validation

### 4.1 Architecture for Validation

ETL validation is not a code change -- it is a **test exercise** that may reveal code fixes needed. The architecture for validation is:

```
For each of 9 sources:
  1. Import sample data through the appropriate pipeline
  2. Verify cards land in sql.js with correct schema
  3. Switch through all 9 views
  4. Verify rendering (no crashes, correct card count)
  5. Verify dedup on re-import (same source, same source_id)

File-based sources (6):      Via ImportOrchestrator → Parser → DedupEngine → SQLiteWriter
  - Apple Notes JSON         Via AppleNotesParser
  - Markdown                 Via MarkdownParser
  - Excel                    Via ExcelParser
  - CSV                      Via CSVParser
  - JSON                     Via JSONParser
  - HTML                     Via HTMLParser

Native sources (3):          Via NativeImportAdapter → bridge → Worker handler
  - Native Reminders         Via RemindersAdapter → etl:import-native → DedupEngine → SQLiteWriter
  - Native Calendar          Via CalendarAdapter → etl:import-native → DedupEngine → SQLiteWriter
  - Native Notes             Via NotesAdapter → etl:import-native → DedupEngine → SQLiteWriter
```

### 4.2 Integration Points for Fixes

If validation reveals breakage, fixes land in:

| Issue Type | Fix Location |
|-----------|-------------|
| Parser fails on edge case | `src/etl/parsers/<Source>Parser.ts` |
| Dedup misidentifies records | `src/etl/DedupEngine.ts` |
| SQLiteWriter constraint error | `src/etl/SQLiteWriter.ts` |
| View crashes on certain card shapes | `src/views/<View>.ts` |
| D3 data join missing key function | `src/views/<View>.ts` render() |
| SuperGrid axis error on imported data | `src/views/supergrid/SuperGridQuery.ts` |
| Native bridge card normalization | `src/native/NativeBridge.ts normalizeNativeCard()` |
| Native adapter field mapping | `native/Isometry/Isometry/<Adapter>.swift` |

### 4.3 Known Potential Issues

From the technical debt list:

| Issue | Risk | Location |
|-------|------|----------|
| Note-to-note link URL formats not verified against actual user data | Medium | `NotesAdapter.swift` |
| Tables in Apple Notes render as [Table] placeholder | Low | `ProtobufToMarkdown.swift` |
| GalleryView pure HTML (no D3 data join) -- tiles rebuilt on render() | Low | `GalleryView.ts` |
| 4 pre-existing SuperGridSizer test failures | Low | `SuperGridSizer.test.ts` |
| 5 pre-existing supergrid.handler.test.ts failures | Low | `supergrid.handler.test.ts` |

---

## 5. Stability and Error Recovery

### 5.1 Existing Error Handling Architecture

Error handling follows a layered pattern:

```
Layer 1: Worker Bridge
  - Correlation ID timeout (30s default, 300s for ETL)
  - WorkerResponse.success === false → reject Promise
  - Worker onerror → log and reject pending promises

Layer 2: ViewManager
  - _fetchAndRender() try/catch → _showError(message, onRetry)
  - Error banner with retry button
  - Loading spinner after 200ms delay

Layer 3: Native Bridge
  - BridgeManager crash recovery overlay
  - checkForSilentCrash() for webkit bug #176855
  - webViewWebContentProcessDidTerminate → reload

Layer 4: Database
  - DatabaseManager atomic write (.tmp → .bak → .db)
  - loadDatabase() falls back to .bak on corruption
  - Autosave every 30s when dirty
```

### 5.2 Where Stability Fixes Land

| Concern | Existing Component | Modification |
|---------|-------------------|-------------|
| Worker timeout on slow queries | `WorkerBridge.ts` | Possibly increase default timeout or add retry |
| View render crash on malformed data | Individual views | Add null guards in render() |
| ETL parser crash on unexpected input | `src/etl/parsers/*.ts` | Add try/catch in parse loops |
| SuperGrid crash on empty axes | `SuperGrid.ts` | Guard against zero-length axis arrays |
| Checkpoint corruption | `DatabaseManager.swift` | Already handled (.bak fallback) |
| CloudKit sync failure recovery | `SyncManager.swift` | Already handled (offline queue) |

### 5.3 Test Coverage Gaps

The existing test suite has ~2,037 tests. Known gaps:

| Gap | Where to Add Tests |
|-----|-------------------|
| Empty state rendering | `tests/views/ViewManager.test.ts` (new) |
| View transitions with zero cards | `tests/views/transitions.test.ts` |
| ETL parser edge cases (empty files, huge files) | `tests/etl/parsers/*.test.ts` |
| Keyboard shortcut conflicts | `tests/ui/ShortcutRegistry.test.ts` (new) |
| SuperGrid with no axes configured | `tests/views/SuperGrid.test.ts` |

---

## 6. Visual Polish Integration

### 6.1 CSS Architecture

The existing CSS is organized into 5 files loaded by `index.html`:

```
design-tokens.css ──── CSS custom properties (colors, spacing, radius, transitions)
views.css ──────────── Loading, error, empty, card base styles, drag-drop
audit.css ──────────── Audit overlay, change tracking, source provenance
supergrid.css ──────── SuperGrid-specific styles (headers, cells, zoom, density)
import-toast.css ───── Import progress toast
```

### 6.2 Where Visual Polish Lands

| Polish Area | File | Changes |
|------------|------|---------|
| Typography consistency | `design-tokens.css` | Add font-family, font-weight, line-height tokens |
| Spacing consistency | `design-tokens.css` | Verify all spacing uses tokens (no magic numbers) |
| Color refinement | `design-tokens.css` | Adjust muted/secondary/accent colors |
| Animation smoothness | `design-tokens.css` | Tune transition timing values |
| Empty state styling | `views.css` | Add `.view-empty--first-launch`, `.view-empty--filtered` |
| Help overlay styling | New: `help-overlay.css` or in `views.css` | Overlay positioning, backdrop |
| Card hover/focus states | `views.css` | Refine `.card:hover`, add `:focus-visible` |

### 6.3 No New CSS Architecture

All visual polish is additive CSS within the existing file structure. No CSS-in-JS, no CSS modules, no preprocessor. Pure CSS custom properties as the design system.

---

## 7. Component Boundary Summary

### 7.1 Existing Components: No Changes Required

| Component | Rationale |
|-----------|-----------|
| StateCoordinator.ts | No new providers to register |
| PAFVProvider.ts | No axis changes |
| FilterProvider.ts | No filter changes (clear filters action calls existing API) |
| SuperPositionProvider.ts | No scroll/zoom changes |
| SuperDensityProvider.ts | No density changes |
| DedupEngine.ts | Validated, not modified |
| CatalogWriter.ts | Validated, not modified |
| WorkerBridge.ts | No protocol changes |
| DatabaseManager.swift | No persistence changes |
| BridgeManager.swift | No bridge protocol changes |
| SyncManager.swift | No sync changes |
| AssetsSchemeHandler.swift | No serving changes |
| SubscriptionManager.swift | No tier changes |

### 7.2 Existing Components: Modified

| Component | What Changes | Scope |
|-----------|-------------|-------|
| `src/etl/parsers/JSONParser.ts` | Bracket notation for 14 index sig accesses | Trivial |
| `src/etl/parsers/MarkdownParser.ts` | Bracket notation for 11 index sig accesses | Trivial |
| `src/native/NativeBridge.ts` | Bracket notation for 27 index sig accesses | Trivial |
| `src/views/SuperGrid.ts` | Fix 2 AxisMapping type mismatches | Trivial |
| `src/mutations/shortcuts.ts` | Refactor to use ShortcutRegistry | Minor |
| `src/audit/AuditOverlay.ts` | Refactor keyboard handler to use ShortcutRegistry | Minor |
| `src/views/ViewManager.ts` | Context-aware empty states | Moderate |
| `src/styles/views.css` | Empty state variants, visual polish | Minor CSS |
| `src/main.ts` | Create ShortcutRegistry, pass to components | Minor wiring |
| `tests/**/*.ts` | Fix ~200 null check and type errors | Mechanical |
| `package.json` | Fix `build` script | Trivial |

### 7.3 New Components

| Component | Location | Purpose | Complexity |
|-----------|----------|---------|------------|
| ShortcutRegistry | `src/ui/ShortcutRegistry.ts` | Central keyboard shortcut management | Low (~80 lines) |
| HelpOverlay | `src/ui/HelpOverlay.ts` | Keyboard shortcut help display | Low (~60 lines) |
| (none in Swift) | -- | No new Swift files | -- |

---

## 8. Recommended Build Order

Build order is driven by dependencies and risk. All phases are independent except where noted.

### Phase 1: Build Health (foundation -- unblocks everything else)

**Why first:** Fixing `tsc` unblocks `npm run build`. Fixing the Xcode build phase unblocks native builds. These are prerequisites for reliable development.

**Independence:** Fully independent. Can be done in parallel with any other phase.

**Work:**
1. Fix 68 TS4111 errors in production files (bracket notation -- mechanical)
2. Fix 116 TS2532 errors in test files (null checks -- mechanical)
3. Fix remaining ~92 errors (type mismatches, missing properties)
4. Verify `npm run build` passes
5. Fix Xcode Run Script working directory
6. Regenerate provisioning profile (Apple Developer Portal)

### Phase 2: Empty States (high user impact, moderate effort)

**Why second:** Empty states are the first thing a new user sees. High value, no dependencies on other v4.2 work.

**Independence:** Independent of keyboard shortcuts and ETL validation.

**Work:**
1. Add "is database empty?" query to ViewManager (or cache on bridge)
2. Extend `_showEmpty()` with context-aware content
3. Add first-launch empty state with Import action
4. Add per-view empty state messages
5. Style empty state variants in CSS
6. Test all 9 views with empty database and with active filters

### Phase 3: Keyboard Shortcuts (medium user impact, low risk)

**Why third:** Builds on existing patterns. ShortcutRegistry is the only new component.

**Independence:** Independent of empty states and ETL validation. Depends on main.ts wiring.

**Work:**
1. Create ShortcutRegistry class
2. Create HelpOverlay class
3. Refactor setupMutationShortcuts to use registry
4. Refactor AuditOverlay to use registry
5. Add view-switch shortcuts (Cmd+1..9)
6. Add Escape to clear selection
7. Wire registry in main.ts
8. Test shortcut conflicts and input field guards

### Phase 4: Visual Polish (low risk, independent)

**Why fourth:** Purely additive CSS. Cannot break functionality.

**Independence:** Fully independent. Can be done in parallel with anything.

**Work:**
1. Audit design-tokens.css for consistency
2. Add font-family, font-weight tokens
3. Refine card hover/focus states
4. Verify spacing uses tokens throughout
5. Smooth animation timing

### Phase 5: ETL End-to-End Validation (validation, may surface fixes)

**Why fifth:** Validation exercise that may uncover issues in any layer. Better done after build health is fixed so `tsc` errors don't mask real issues.

**Depends on:** Phase 1 (build health) for clean test runs.

**Work:**
1. Import sample data from all 6 file sources
2. Import from all 3 native sources (requires macOS with permissions)
3. Switch through all 9 views after each import
4. Verify dedup on re-import
5. Fix any breakage found
6. Add regression tests for fixes

### Phase 6: Stability Hardening (risk-driven, informed by previous phases)

**Why last:** Stability issues are often surfaced by the validation and polish work. Do this after all other phases have been exercised.

**Depends on:** All previous phases (issues surface during their work).

**Work:**
1. Add null guards to view render() methods for malformed data
2. Add try/catch in ETL parser loops for unexpected input
3. Test SuperGrid with edge case axis configurations
4. Verify Worker timeout behavior under load
5. Add ViewManager test coverage
6. Fix pre-existing test failures (4 SuperGridSizer + 5 supergrid.handler)

---

## 9. Patterns to Follow

### Pattern 1: Fix-in-Place (No Abstraction Escalation)

v4.2 fixes should be surgical. Do not introduce abstractions to "solve" a category of problems. Fix the specific instance.

**Good:** Change `obj.data` to `obj['data']` in JSONParser.ts (fixes TS4111).
**Bad:** Create a `SafeAccessor<T>` utility class that wraps all index signature access.

### Pattern 2: CSS Custom Properties for All Visual Values

All visual values (colors, spacing, radii, transitions) MUST use design tokens. No magic numbers in component CSS.

**Good:** `padding: var(--space-sm);`
**Bad:** `padding: 8px;`

### Pattern 3: Single Document Listener for Keyboard Shortcuts

After ShortcutRegistry, there should be exactly ONE `document.addEventListener('keydown', ...)` for web-side shortcuts. Components register with the registry, not with the document directly.

**Good:** `registry.register('audit-toggle', { ... })`
**Bad:** `document.addEventListener('keydown', myHandler)` in a component

### Pattern 4: Context-Aware Empty States via ViewManager

Empty state rendering stays in ViewManager. Views do NOT render their own empty states. ViewManager decides the context (first-launch vs filtered vs view-specific) and renders the appropriate content.

**Good:** ViewManager checks card count and filter state, then calls `_showEmpty('first-launch')`.
**Bad:** Each view class implements its own empty state in `render([])`.

---

## 10. Anti-Patterns to Avoid

### Anti-Pattern 1: New Provider for Keyboard Shortcuts

**What:** Creating a `KeyboardProvider` registered with StateCoordinator that manages shortcut state.

**Why bad:** Keyboard shortcuts have no persistent state (Tier 3 at most). They don't participate in the provider-notification-render cycle. StateCoordinator exists for data-driven re-renders, not input handling.

**Instead:** ShortcutRegistry is a standalone utility class, like ImportToast. It does not extend PersistableProvider or register with StateCoordinator.

### Anti-Pattern 2: View-Specific Empty States in Each View Class

**What:** Adding empty state rendering logic inside ListView.render(), GridView.render(), etc.

**Why bad:** ViewManager already owns the empty state concern. Adding it to views creates dual responsibility. ViewManager calls `_showEmpty()` INSTEAD of `currentView.render([])` -- so the view's render() is never called with an empty array.

**Instead:** Keep all empty state logic in ViewManager. If a view needs a specific empty message, ViewManager reads the current view type and selects the appropriate text.

### Anti-Pattern 3: Over-Engineering the Help Overlay

**What:** Building a searchable, filterable, categorized keyboard shortcut browser.

**Why bad:** There are ~10 shortcuts total. A simple two-column table is sufficient. Over-engineering this wastes time and adds code to maintain.

**Instead:** HelpOverlay renders a flat list from `registry.getAll()`. No search, no categories, no animation. `?` toggles visibility.

### Anti-Pattern 4: Fixing TypeScript Errors by Loosening tsconfig

**What:** Changing `noPropertyAccessFromIndexSignature` to `false` or `noUncheckedIndexedAccess` to `false` to eliminate errors.

**Why bad:** These strict mode options catch real bugs. Loosening them hides issues that should be fixed.

**Instead:** Fix each error at the source. The TS4111 errors require bracket notation (`obj['prop']` instead of `obj.prop`). The TS2532 errors require null checks. Both are good practices.

---

## 11. Data Flow Diagrams

### 11.1 Empty State Decision Flow

```
ViewManager._fetchAndRender()
  |
  ├── Query Worker: SELECT COUNT(*) FROM cards WHERE deleted_at IS NULL
  │   (cached: only re-query after mutations)
  |
  ├── Query Worker: db:query with compiled query
  │
  ├── result cards.length > 0 ?
  │     YES → currentView.render(cards)
  │     NO  ↓
  │
  ├── totalCardCount === 0 ?
  │     YES → _showEmpty('first-launch')
  │           ├── Icon + title + message
  │           └── Import button → dispatch 'isometry:import-request' event
  │     NO  ↓
  │
  ├── filterProvider.hasActiveFilters() ?
  │     YES → _showEmpty('filtered')
  │           ├── Message: "No cards match current filters"
  │           └── Clear button → filterProvider.clearAll()
  │     NO  ↓
  │
  └── _showEmpty('view-specific', currentViewType)
        └── View-appropriate guidance message
```

### 11.2 Keyboard Shortcut Flow

```
User presses key combo
  |
  ├── In WKWebView native mode (app:// protocol)?
  │     ├── SwiftUI Commands intercept Cmd+Z, Cmd+Shift+Z, Cmd+I
  │     │     └── NotificationCenter → ContentView.onReceive → evaluateJavaScript
  │     │
  │     └── Other keys pass through to WKWebView
  │
  └── document.keydown fires
        |
        └── ShortcutRegistry handler
              |
              ├── Is target INPUT/TEXTAREA/contentEditable?
              │     YES → return (don't intercept)
              │
              ├── Match against registered shortcuts
              │     ├── Cmd+Z → MutationManager.undo()
              │     ├── Cmd+Shift+Z → MutationManager.redo()
              │     ├── Shift+A → AuditState.toggle()
              │     ├── ? → HelpOverlay.toggle()
              │     ├── Cmd+1..9 → ViewManager.switchTo(viewN)
              │     ├── Escape → SelectionProvider.clear()
              │     └── No match → event propagates normally
              │
              └── e.preventDefault() on matched shortcuts
```

---

## 12. Scalability Considerations

| Concern | Impact at Current Scale | At 10K Cards | At 100K Cards |
|---------|----------------------|--------------|---------------|
| Empty state card count query | <1ms | <5ms | <10ms (indexed) |
| ShortcutRegistry lookup | O(n) with n=10 shortcuts | Same | Same |
| TypeScript error fixes | One-time effort | N/A | N/A |
| Visual polish CSS | Zero runtime cost | Zero | Zero |
| ETL validation | Test-time only | Same | Same |

No scalability concerns for v4.2. All changes are either one-time fixes or O(1) runtime operations.

---

## Sources

- Existing codebase analysis (HIGH confidence -- direct source code review)
  - `src/main.ts` -- app bootstrap and wiring
  - `src/views/ViewManager.ts` -- empty state handling
  - `src/mutations/shortcuts.ts` -- keyboard shortcut pattern
  - `src/audit/AuditOverlay.ts` -- keyboard shortcut pattern (duplicate)
  - `src/native/NativeBridge.ts` -- native bridge protocol
  - `native/Isometry/Isometry/IsometryApp.swift` -- macOS Commands
  - `native/Isometry/Isometry/ContentView.swift` -- view switching, import flow
  - `package.json` -- build scripts
  - `tsconfig.json` -- strict mode configuration
  - `tsc --noEmit` output -- 276 errors categorized
