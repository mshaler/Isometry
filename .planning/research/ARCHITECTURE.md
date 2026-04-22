# Architecture Research

**Domain:** SuperWidget Shell Integration — v13.3
**Researched:** 2026-04-21
**Confidence:** HIGH (sourced entirely from production codebase — no external research required)

## Standard Architecture

### System Overview: Current State (v13.2)

```
document.getElementById('app') [#app, role="main"]
  WorkbenchShell (.workbench-shell)
    CommandBar (.workbench-commandbar)  [full width, wordmark]
    .workbench-body (flex-row)
      .workbench-sidebar
        DockNav (48px icon strip, verb-noun taxonomy)
      .workbench-main
        .workbench-main__content (flex-col)
          .workbench-slot-top
            .slot-top__data-explorer
              SuperWidget [data-component="superwidget"]  <-- CURRENT LOCATION
                [data-slot="header"]  "Zone" label
                [data-slot="tabs"]    placeholder 3 buttons
                [data-slot="canvas"]  ExplorerCanvas (active)
                [data-slot="status"]  DB stats (cards, connections, last import)
            .slot-top__properties-explorer  (PanelManager managed)
            .slot-top__projection-explorer  (PanelManager managed)
          .workbench-view-content
            VisualExplorer
              ViewManager → IView (9 views)
          .workbench-slot-bottom
            .slot-bottom__latch-filters    (PanelManager managed)
            .slot-bottom__formulas-explorer (PanelManager managed)
document.body overlays: HelpOverlay, CommandPalette, toasts, AppDialog
```

### SuperWidget Internal Structure (v13.2)

```
SuperWidget [data-component="superwidget"]  (CSS Grid, 4 rows: auto / auto / 1fr / auto)
  [data-slot="header"]   zone label text — static "Zone" string
  [data-slot="tabs"]     placeholder buttons (Tab 1/2/3 + config gear)
  [data-slot="canvas"]   CanvasComponent mount point
    ExplorerCanvas (canvasId: explorer-1)
      tab-bar (import-export / catalog / db-utilities)
      3 tab containers (DataExplorerPanel sections)
    ViewCanvas (canvasId: view-1) — registered, not yet primary
      ViewManager → IView (9 views)
    EditorCanvas (canvasId: editor-1) — registered, not yet primary
      NotebookExplorer
  [data-slot="status"]   statusSlot (DB stats: card count · connections · last import)
```

### Target Architecture: v13.3

```
document.getElementById('app') [#app, role="main"]
  SuperWidget [data-component="superwidget"]  <-- TOP-LEVEL CONTAINER
    [data-slot="header"]
      CommandBar content (wordmark, dataset name, menu actions)
    [data-slot="tabs"]
      TabBar (ARIA tablist: Explorer | View | Editor tabs)
      create-tab button, close-tab, reorder, persist
    [data-slot="canvas"]
      .sw-canvas-layout (flex-row)
        .sw-canvas-layout__sidebar
          DockNav (48px icon strip)
          .workbench-slot-top (inline explorer containers)
          .workbench-slot-bottom (inline filter containers)
        .sw-canvas-layout__main
          active CanvasComponent (Explorer / View / Editor)
    [data-slot="status"]
      contextual per canvas type:
        ExplorerCanvas → DB stats (card count, connections, last import)
        ViewCanvas     → view name + card count (+ filter summary)
        EditorCanvas   → selected card title
document.body overlays: HelpOverlay, CommandPalette, toasts, AppDialog
```

## Component Responsibilities

| Component | Current Responsibility | v13.3 Change |
|-----------|----------------------|--------------|
| `WorkbenchShell` | Top-level DOM orchestrator — CommandBar, DockNav sidebar, top/bottom slots, view-content | **Retired.** SuperWidget becomes top-level. |
| `SuperWidget` | 4-slot CSS Grid container; commitProjection drives canvas lifecycle | **Promoted to top-level.** Owns full app area. |
| `[data-slot="header"]` | Zone label text (static "Zone" string) | Hosts CommandBar content — wordmark, dataset name, menu actions. |
| `[data-slot="tabs"]` | Placeholder 3 static buttons | Real ARIA tablist: create, close, reorder tabs; persisted via StateManager. |
| `[data-slot="canvas"]` | CanvasComponent mount point (ExplorerCanvas today) | Flex-row wrapper holding sidebar (DockNav + slots) + main canvas content. |
| `[data-slot="status"]` | statusSlot DB stats (card count, connections, last import) | Rich contextual status per canvas type — each canvas owns its status structure. |
| `Projection` | Immutable value object: canvasType, canvasId, activeTabId, enabledTabIds, zoneRole, canvasBinding | **Not extended for shell tabs** (see Anti-Pattern 2). Shell tabs are a separate TabManager concern. |
| `ExplorerCanvas` | DataExplorerPanel with internal 3-tab bar | Unchanged internally. Status slot cleared on mount (Anti-Pattern 3 fix). |
| `ViewCanvas` | ViewManager + 9 views + `onSidecarChange` stub | `onSidecarChange` wired to real `panelManager.show/hide('projection')` in main.ts. |
| `EditorCanvas` | NotebookExplorer + SelectionProvider-driven status | Unchanged. Status slot cleared on mount. |
| `DockNav` | Mounts into `WorkbenchShell.getSidebarEl()` | **Re-parents** into `.sw-canvas-layout__sidebar` inside canvas slot. |
| `PanelManager` | Manages inline top/bottom slot visibility | **Re-wired** to new slot containers inside `.sw-canvas-layout__sidebar`. |
| `StateManager` | Tier 2 persistence to ui_state table | **New keys:** `tabs:active`, `tabs:list` for tab persistence. |
| `statusSlot.ts` | `renderStatusSlot` / `updateStatusSlot` for DB stats | ExplorerCanvas calls these explicitly after clearing; not called from main.ts post-mount. |

## Architectural Patterns

### Pattern 1: Incremental Shell Replacement (Recommended)

**What:** SuperWidget absorbs WorkbenchShell responsibilities in 3 phases. WorkbenchShell stays functional until the final cutover phase.

**When to use:** main.ts has ~1,986 lines with ~40 distinct wiring points to `shell.*` API surfaces. Any one of them silently untouched during a big-bang swap = runtime failure with no compile error.

**Trade-offs:**
- Pro: Each phase ships independently and is testable in isolation
- Pro: 245+ superwidget tests and 3 E2E specs remain green through the transition
- Con: Short period of dual-shell references in main.ts during Phase 2

**Migration path:**

```
Phase A — Canvas system complete (SHIPPED v13.2)
  SuperWidget in top-slot above ViewManager
  ExplorerCanvas / ViewCanvas / EditorCanvas all production

Phase B — Tab management (v13.3 Phase 1)
  Placeholder tabs slot → real ARIA TabBar
  Shell-level tab switches via setCanvas() Projection transitions
  Tab state persisted via StateManager (tabs:active key)
  WorkbenchShell unchanged

Phase C — Shell hoisting (v13.3 Phase 2)
  SuperWidget mounts on #app (not inside WorkbenchShell)
  Canvas slot gets .sw-canvas-layout flex-row wrapper
  DockNav re-parents into .sw-canvas-layout__sidebar
  Inline slot containers recreated inside sidebar
  CommandBar migrates to header slot
  ViewManager re-rooted to main content div
  WorkbenchShell.destroy() called
  main.ts: all shell.get*() → direct container refs

Phase D — Sidecar polish + rich status (v13.3 Phase 3)
  onSidecarChange wired: ViewCanvas → panelManager.show/hide('projection')
  Auto-show/hide transitions (CSS opacity + max-height)
  Status slot cleared on canvas switch
  ViewCanvas status: add filter summary (active filter count)
  ExplorerCanvas calls renderStatusSlot after clearing status slot
```

### Pattern 2: Shell Tabs as Separate Concern from Projection Tabs

**What:** There are two distinct "tab" concepts in the system. Conflating them breaks existing tests.

**ExplorerCanvas-internal tabs** (existing):
- `enabledTabIds`: `['import-export', 'catalog', 'db-utilities']`
- `activeTabId`: drives `switchTab()` Projection transition
- Rendered by ExplorerCanvas's own tab bar
- `onProjectionChange()` shows/hides tab containers

**Shell-level canvas tabs** (new in v13.3):
- Which canvas is active: Explorer | View | Editor
- Drives `setCanvas(canvasId, canvasType)` Projection transition
- Rendered by TabBar in `[data-slot="tabs"]`
- Tab list stored in `TabMetadata[]` array in TabManager scope
- Persisted as `tabs:active` and `tabs:list` in ui_state

**Rule:** Shell-level tab switching = `setCanvas()`. ExplorerCanvas tab switching = `switchTab()`. Never mix.

**Example of correct shell tab implementation:**

```typescript
// TabBar fires this when user clicks a shell tab
onTabSelect(tab: TabMetadata): void {
  const newProj = setCanvas(currentProjection, tab.canvasId, tab.canvasType);
  superWidget.commitProjection(newProj);
  // StateManager persistence
  void bridge.send('ui:set', { key: 'tabs:active', value: tab.canvasId });
}
```

### Pattern 3: Canvas Slot Flex-Row Wrapper

**What:** The canvas slot must hold both the DockNav sidebar and the main canvas content side by side. SuperWidget's CSS Grid gives the canvas slot `1fr` of height. The content inside that slot must use flex-row to split horizontal space.

**Implementation:**

```typescript
// In SuperWidget or SuperWidgetShell, after mounting:
const canvasLayout = document.createElement('div');
canvasLayout.className = 'sw-canvas-layout';  // display: flex; flex-direction: row

const sidebar = document.createElement('div');
sidebar.className = 'sw-canvas-layout__sidebar';

const main = document.createElement('div');
main.className = 'sw-canvas-layout__main';  // flex: 1 1 auto; min-width: 0

canvasLayout.appendChild(sidebar);
canvasLayout.appendChild(main);
this._canvasEl.appendChild(canvasLayout);
```

The DockNav, top-slot, and bottom-slot containers mount into `sidebar`. The active CanvasComponent mounts into `main` (via `commitProjection`).

**Important:** `this._canvasEl` in SuperWidget currently receives the CanvasComponent directly via `canvas.mount(this._canvasEl)`. For v13.3, `canvas.mount(mainDiv)` instead — SuperWidget passes `mainDiv` not `this._canvasEl` to the canvas factory.

This means the DOM traversal in ViewCanvas and EditorCanvas that finds status slot via `container.parentElement?.querySelector('[data-slot="status"]')` still works — `container` is `mainDiv`, `mainDiv.parentElement` is `canvasLayout`, `canvasLayout.parentElement` is `this._canvasEl`, and `this._canvasEl.parentElement` is `this._root` which contains the status slot. One extra parent hop.

**Fix:** Update traversal to `container.closest('[data-component="superwidget"]')?.querySelector('[data-slot="status"]')` — more robust than counting `.parentElement` hops.

### Pattern 4: Status Slot Ownership by Active Canvas

**What:** Each canvas clears the status slot on `mount()` and writes its own status DOM structure.

**Why needed:** Currently `renderStatusSlot()` is called from main.ts at line 1656 (after ExplorerCanvas mounts). ViewCanvas and EditorCanvas each have their own `_updateStatus()` methods that create `.sw-view-status-bar` and `.sw-editor-status-bar` respectively. These accumulate in the DOM across canvas switches.

**Correct approach:**

```typescript
// In SuperWidget.commitProjection, before mounting new canvas:
if (!prev || prev.canvasType !== proj.canvasType || prev.canvasId !== proj.canvasId) {
  this._statusEl.textContent = '';  // clear stale status DOM
}
```

Each canvas then renders its own status on mount. `renderStatusSlot()` is called by ExplorerCanvas in its `mount()`. `ViewCanvas._updateStatus()` and `EditorCanvas._updateStatus()` fire post-mount as they do today.

## Data Flow

### Tab Switch Flow (Shell-Level, v13.3)

```
User clicks shell tab in [data-slot="tabs"] TabBar
    |
TabBar.onTabSelect(tab: TabMetadata)
    |
setCanvas(currentProjection, tab.canvasId, tab.canvasType) → newProjection
    |
superWidget.commitProjection(newProjection)
    |-- [canvasId changed]
    |   statusEl.textContent = ''  (clear stale DOM)
    |   currentCanvas.destroy()
    |   newCanvas = canvasFactory(newProjection.canvasId, newProjection.canvasBinding)
    |   newCanvas.mount(mainDiv)
    |   currentCanvas = newCanvas
    |
    |-- [only activeTabId changed - ExplorerCanvas internal tab]
        currentCanvas.onProjectionChange(newProjection)
    |
bridge.send('ui:set', { key: 'tabs:active', value: newProjection.canvasId })
(persisted to ui_state via Worker Bridge)
```

### Explorer Sidecar Flow (v13.3 Target)

```
ViewCanvas._notifySidecar(viewType)
    |
this._config.onSidecarChange(explorerId | null)
    |    [currently console.debug → must become:]
    |
if (explorerId === 'explorer-1')
    panelManager.show('projection')
else
    panelManager.hide('projection')
    |
PanelManager.show/hide → projectionChildEl.style.display toggled
    |
syncTopSlotVisibility() → topSlotEl always block (SuperWidget always visible)
```

### Status Slot Update Flow (Per Canvas Type)

```
ExplorerCanvas mounts
  → statusEl.textContent = ''
  → renderStatusSlot(statusEl)  [creates .sw-status-bar]
  → refreshDataExplorer() calls updateStatusSlot(statusEl, stats) periodically

ViewCanvas mounts
  → statusEl.textContent = ''
  → ViewManager.onViewSwitch fires → _updateStatus(viewType)  [creates .sw-view-status-bar]
  → shows view name + card count

EditorCanvas mounts
  → statusEl.textContent = ''
  → SelectionProvider.subscribe → _updateStatus()  [creates .sw-editor-status-bar]
  → shows selected card title (async bridge card:get)
```

## New vs Modified Components

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `TabBar` | `src/superwidget/TabBar.ts` | Interactive ARIA tablist with create/close/reorder; replaces placeholder tab buttons in SuperWidget constructor |
| `TabManager` | `src/superwidget/TabManager.ts` | Tab list state: add, remove, reorder, boot restore from StateManager; keeps tab metadata separate from Projection |

### Modified Components

| Component | File | Change |
|-----------|------|--------|
| `SuperWidget` | `src/superwidget/SuperWidget.ts` | (1) Clear status slot on canvas type/id change in commitProjection; (2) Pass `mainDiv` (not `canvasEl`) to `canvas.mount()`; (3) Inject TabBar into tabs slot instead of placeholder buttons |
| `ViewCanvas` | `src/superwidget/ViewCanvas.ts` | Update status slot DOM traversal to use `container.closest('[data-component="superwidget"]')` instead of counting parentElement hops |
| `EditorCanvas` | `src/superwidget/EditorCanvas.ts` | Same DOM traversal fix as ViewCanvas |
| `main.ts` | `src/main.ts` | (Phase 1) Wire shell tab switches to setCanvas(); (Phase 2) Mount SuperWidget on #app, re-parent DockNav, migrate CommandBar to header slot, wire sidecar callback; (Phase 3) Pass tab list to TabManager |

## Integration Points

### WorkbenchShell API Migration Map

| WorkbenchShell Method | Current Call Site | v13.3 Replacement |
|-----------------------|------------------|-------------------|
| `getCommandBar()` | `shell.getCommandBar().setSubtitle(name)` | CommandBar instance in header slot; direct ref `commandBar.setSubtitle(name)` |
| `getViewContentEl()` | ViewManager mount, crossfade opacity, shortcut closures | `mainDiv` inside canvas layout; `visualExplorer.mount(mainDiv)` |
| `getSidebarEl()` | `dockNav.mount(shell.getSidebarEl())` | `dockNav.mount(sidebarDiv)` where `sidebarDiv` is `.sw-canvas-layout__sidebar` |
| `getTopSlotEl()` | Slot child div creation for explorers | New `topSlotEl` inside `sidebarDiv` |
| `getBottomSlotEl()` | Slot child div creation for filters | New `bottomSlotEl` inside `sidebarDiv` |
| `getPanelRegistry()` | PanelManager construction | Unchanged — PanelRegistry stays; PanelManager gets new container refs |
| `getSectionStates()` | LayoutPresetManager | No-op stub already; remains no-op |
| `restoreSectionStates()` | LayoutPresetManager, createPresetCommands | No-op stub already; same |
| `destroy()` | — | Called once in Phase 2 after SuperWidget is live |

### Sidecar Wiring Gap (Current TODO)

`ViewCanvas.ts` line 1616-1619 in main.ts:
```typescript
onSidecarChange: (explorerId) => {
  // TODO Phase 172+: wire sidecar visibility to ExplorerCanvas panel
  console.debug('[ViewCanvas] sidecar:', explorerId);
},
```

This must become:
```typescript
onSidecarChange: (explorerId) => {
  if (explorerId) {
    panelManager?.show('projection');
    dockNav.setItemPressed('visualize:supergrid', true);  // optional UX signal
  } else {
    panelManager?.hide('projection');
  }
},
```

`panelManager` is forward-declared as `let panelManager: PanelManager | null = null` and assigned after panel registrations. The closure captures the variable reference so this is safe (same pattern as other closures in main.ts).

### Status Slot Conflict Resolution

The conflict exists at two levels:

1. **main.ts level:** `renderStatusSlot(superWidget.statusEl)` called at line 1656 after ExplorerCanvas mounts. In v13.3, this call moves into `ExplorerCanvas.mount()` after `statusEl.textContent = ''`.

2. **SuperWidget level:** `commitProjection` adds a single clear: `if (canvasChanged) this._statusEl.textContent = ''`. This is the load-bearing fix — it ensures canvas switches always start with a clean status slate.

## Suggested Build Order

### Phase 1: Tab Management (no shell changes)

**Prerequisite:** None — SuperWidget still in top-slot above ViewManager.

**Build sequence:**
1. `TabBar` class with ARIA tablist, create/close/reorder, `onTabSelect(tabId)` callback
2. `TabManager` with add/remove/reorder logic, StateManager persistence (`tabs:active` key)
3. `SuperWidget` constructor: replace placeholder tab buttons with injected `TabBar`
4. `main.ts` wiring: shell-level tab clicks → `setCanvas()` → `commitProjection()`
5. Boot restore: `bridge.send('ui:get', { key: 'tabs:active' })` before `initialProjection` construction

**Test requirements:** TabBar unit tests, TabManager persistence round-trip, SuperWidget commitProjection with real canvas switching by tabId, Playwright E2E verifying tab switch activates correct canvas.

### Phase 2: Shell Hoisting

**Prerequisite:** Phase 1 complete.

**Build sequence:**
1. `.sw-canvas-layout` CSS + flex-row wrapper creation in SuperWidget or new `SuperWidgetShell`
2. SuperWidget `commitProjection`: pass `mainDiv` (not `canvasEl`) to `canvas.mount()`; clear status on canvas change
3. `main.ts` Phase 2 changes:
   - Move SuperWidget mount from `dataExplorerChildEl` to `container` (#app)
   - `dockNav.mount(sidebarDiv)` instead of `shell.getSidebarEl()`
   - Recreate `topSlotEl` and `bottomSlotEl` inside `sidebarDiv`
   - `visualExplorer.mount(mainDiv)` instead of `shell.getViewContentEl()`
   - CommandBar mount moves to `superWidget.headerEl`
   - `WorkbenchShell` instantiation removed; `shell.destroy()` called if shell was created
4. Update ViewCanvas and EditorCanvas DOM traversal to `closest('[data-component="superwidget"]')`
5. Remove `WorkbenchShell` import from main.ts

**Test requirements:** All 245+ superwidget tests pass. Playwright WebKit E2E all 6 directional transitions. DockNav seam tests with new container. PanelManager seam tests with new containers.

### Phase 3: Sidecar Polish + Rich Status

**Prerequisite:** Phase 2 complete.

**Build sequence:**
1. Wire `onSidecarChange` callback in main.ts: replace `console.debug` with `panelManager?.show/hide('projection')`
2. CSS transitions for sidecar: `opacity` + `max-height` on `.slot-top__projection-explorer`
3. Status slot clear in `commitProjection` (the single fix for Anti-Pattern 3)
4. `ExplorerCanvas.mount()`: clear status slot, then call `renderStatusSlot()`
5. `ViewCanvas._updateStatus()`: add filter summary span (active filter count via `filter.hasActiveFilters()`)
6. `renderStatusSlot` call removed from main.ts (now handled by ExplorerCanvas)

**Test requirements:** Sidecar seam test (ViewCanvas → onSidecarChange → panelManager), status slot content verified per canvas type, CSS transition smoke in Playwright.

## Anti-Patterns

### Anti-Pattern 1: Big Bang Shell Replacement

**What people do:** Delete WorkbenchShell, rewrite main.ts in one pass, mount SuperWidget directly on #app.

**Why it's wrong:** main.ts is 1,986 lines with ~40 wiring points to `shell.*`. Any silently untouched reference = runtime failure with no compile error (TypeScript would catch `shell.*` but not a stale closure). The 245+ superwidget tests and 3 E2E specs need to pass through every intermediate state.

**Do this instead:** 3-phase incremental migration. Each phase is independently shippable and testable.

### Anti-Pattern 2: Extending Projection for Shell-Level Tabs

**What people do:** Add `tabs: ReadonlyArray<Tab>` to the `Projection` interface to represent which canvas tabs are open.

**Why it's wrong:** The existing 245+ superwidget tests and 3 Playwright E2E specs all use the current Projection shape. `enabledTabIds`/`activeTabId` are used by ExplorerCanvas's internal tab bar (import-export/catalog/db-utilities). `switchTab()` and `toggleTabEnabled()` operate on those fields. Changing the Projection interface breaks the entire canvas system test suite.

**Do this instead:** Shell-level tabs are a separate `TabMetadata[]` array in `TabManager` scope. Shell tab switching uses `setCanvas()` Projection transition. `TabManager` persists the shell tab list separately as `tabs:list` in ui_state. Projection stays structurally unchanged.

### Anti-Pattern 3: Status Slot Shared DOM Ownership Without Clearing

**What people do:** Multiple canvases write to the status slot with idempotent guards (`querySelector` before creating), assuming each canvas's check prevents conflict.

**Why it's wrong:** `ViewCanvas` checks for `.sw-view-status-bar` before creating. `ExplorerCanvas` (via statusSlot.ts) checks for `.sw-status-bar`. Switching from Explorer to View leaves `.sw-status-bar` alongside `.sw-view-status-bar` — both guards pass because each looks for its own class. Status slot accumulates stale DOM.

**Do this instead:** `SuperWidget.commitProjection()` clears `statusEl.textContent` when the canvas changes. One clear, correct location. Each canvas then renders a clean status structure.

### Anti-Pattern 4: Counting parentElement Hops for Status Slot Discovery

**What people do:** ViewCanvas and EditorCanvas find the status slot via `container.parentElement?.querySelector('[data-slot="status"]')`.

**Why it's wrong:** This breaks when the canvas slot content gains the `.sw-canvas-layout` flex-row wrapper (Phase 2). `container` is now `mainDiv`, not the canvas slot directly. The parent chain is: `mainDiv` → `canvasLayout` → `canvasEl` → `superWidget root`. One extra hop.

**Do this instead:** `container.closest('[data-component="superwidget"]')?.querySelector('[data-slot="status"]')`. More robust, immune to intermediate wrapper additions.

## Sources

- `src/superwidget/SuperWidget.ts` — 4-slot grid, commitProjection, canvas lifecycle
- `src/superwidget/projection.ts` — Projection interface, 5 transition functions, validateProjection
- `src/superwidget/registry.ts` — CanvasRegistryEntry, register/getCanvasFactory
- `src/superwidget/ViewCanvas.ts` — VIEW_SIDECAR_MAP, onSidecarChange stub (console.debug), status slot DOM traversal
- `src/superwidget/EditorCanvas.ts` — SelectionProvider-driven status, 4-step destroy ordering
- `src/superwidget/ExplorerCanvas.ts` — 3-tab bar with switchTab, DataExplorerPanel wrapping
- `src/superwidget/statusSlot.ts` — renderStatusSlot, updateStatusSlot (DB stats view)
- `src/ui/WorkbenchShell.ts` — current shell API surface (getCommandBar, getViewContentEl, getSidebarEl, etc.)
- `src/main.ts` — full wiring: shell creation at line 557, DockNav at 873, PanelManager at 1740, sidecar TODO at line 1616, renderStatusSlot at line 1656
- `.planning/PROJECT.md` — v13.3 milestone goal definition, v13.2 completion context

---
*Architecture research for: v13.3 SuperWidget Shell integration*
*Researched: 2026-04-21*
