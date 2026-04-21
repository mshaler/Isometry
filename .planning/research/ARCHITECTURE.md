# Architecture Research

**Domain:** ViewCanvas + EditorCanvas integration into SuperWidget substrate
**Researched:** 2026-04-21
**Confidence:** HIGH (primary source is the live codebase — no external research needed)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          main.ts (boot wiring)                       │
│  providers · ViewManager · NotebookExplorer · DockNav · shell        │
├─────────────────────────────────────────────────────────────────────┤
│                    SuperWidget (4-slot CSS Grid)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  header  │  │   tabs   │  │   canvas slot    │  │   status    │ │
│  └──────────┘  └──────────┘  └────────┬─────────┘  └─────────────┘ │
│                                        │ mount(canvasEl)             │
├────────────────────────────────────────┼────────────────────────────┤
│             CanvasComponent (interface)│                             │
│  ┌──────────────┐  ┌───────────────┐  │  ┌──────────────────────┐  │
│  │ ExplorerCanvas│  │  ViewCanvas   │◄─┘  │   EditorCanvas       │  │
│  │  (SHIPPED)   │  │  (v13.2 NEW)  │     │   (v13.2 NEW)        │  │
│  │              │  │               │     │                      │  │
│  │DataExplorer  │  │  ViewManager  │     │ NotebookExplorer      │  │
│  │Panel wrapper │  │  wrapper      │     │ wrapper              │  │
│  └──────────────┘  └───────────────┘     └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                       Canvas Registry                                │
│  Map<string, CanvasRegistryEntry> · register() · getCanvasFactory() │
│  canvasId "explorer-1" → ExplorerCanvas                             │
│  canvasId "view-1"     → ViewCanvas      (replaces ViewCanvasStub)  │
│  canvasId "editor-1"   → EditorCanvas    (replaces EditorCanvasStub)│
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `SuperWidget` | 4-slot CSS Grid host; runs `commitProjection` → `canvasFactory` pipeline; calls `mount/destroy/onProjectionChange` on canvas | UNCHANGED |
| `Projection` | Immutable value type; 5 pure transition functions; `canvasType/canvasId/canvasBinding/activeTabId/enabledTabIds` | UNCHANGED |
| Canvas Registry | `Map<string, CanvasRegistryEntry>`; `CanvasRegistryEntry.defaultExplorerId` marks Bound views; `getCanvasFactory()` is the only seam SuperWidget crosses | REGISTRY ENTRY ADDED |
| `ExplorerCanvas` | Wraps `DataExplorerPanel`; 3-tab navigation driven by `onProjectionChange`; status slot live counts | SHIPPED v13.1 |
| `ViewCanvas` | NEW: wraps `ViewManager`; mounts 9 D3 views into the SuperWidget canvas slot; status shows view name + card count | NEW v13.2 |
| `EditorCanvas` | NEW: wraps `NotebookExplorer`; binds to `SelectionProvider` for card ID; status shows card title | NEW v13.2 |
| `ViewManager` | Owns D3 view lifecycle (switchTo/destroy); renders into its `container` div; re-renders on `StateCoordinator` subscription | UNCHANGED (re-used) |
| `NotebookExplorer` | Card editor: shadow-buffer title+content, SelectionProvider subscription, MutationManager commit | UNCHANGED (re-used) |

## Recommended Project Structure

The existing `src/superwidget/` directory already contains the right structure. Only new files:

```
src/superwidget/
├── projection.ts        # UNCHANGED -- CanvasType/CanvasBinding/Projection/CanvasComponent
├── SuperWidget.ts       # UNCHANGED -- 4-slot host, commitProjection
├── registry.ts          # MODIFIED -- replace ViewCanvasStub+EditorCanvasStub registrations
├── statusSlot.ts        # UNCHANGED -- renderStatusSlot / updateStatusSlot helpers
├── ExplorerCanvas.ts    # SHIPPED v13.1 -- production canvas (reference pattern)
├── ExplorerCanvasStub.ts# UNCHANGED (stub kept for test isolation)
├── ViewCanvas.ts        # NEW -- production ViewCanvas (replaces ViewCanvasStub)
├── EditorCanvas.ts      # NEW -- production EditorCanvas (replaces EditorCanvasStub)
├── ViewCanvasStub.ts    # UNCHANGED (stub kept for test isolation)
└── EditorCanvasStub.ts  # UNCHANGED (stub kept for test isolation)

tests/superwidget/
├── ViewCanvas.test.ts                  # NEW -- unit tests for ViewCanvas (jsdom)
├── EditorCanvas.test.ts                # NEW -- unit tests for EditorCanvas (jsdom)
├── view-canvas-integration.test.ts     # NEW -- cross-seam integration (real ViewManager mock)
├── editor-canvas-integration.test.ts   # NEW -- cross-seam integration (real NotebookExplorer mock)
└── (existing files unchanged)

e2e/fixtures/
├── viewcanvas-harness.html       # NEW -- ViewCanvas WebKit harness
└── editorcanvas-harness.html     # NEW -- EditorCanvas WebKit harness
```

### Structure Rationale

- **One file per canvas:** ExplorerCanvas.ts is the established pattern. Each production canvas is a single file named after its class.
- **Stubs retained:** `ViewCanvasStub.ts` and `EditorCanvasStub.ts` remain; they are the default for `registerAllStubs()` used by all integration tests that test SuperWidget behavior without loading real canvases.
- **No new `src/` subdirectories:** The superwidget folder is the right home. Adding a `canvases/` subfolder would violate the existing flat convention (ExplorerCanvas lives at the top level of `superwidget/`).

## Architectural Patterns

### Pattern 1: CanvasComponent Wrapper

Every production canvas follows the ExplorerCanvas pattern: the CanvasComponent is a thin wrapper around an existing component that owns the real functionality. The canvas's job is:
1. Accept a `config` object in its constructor that carries all external dependencies (providers, bridge, callbacks)
2. `mount(container)` — create a wrapper div, instantiate the wrapped component, call `wrappedComponent.mount(wrapperDiv)`, then append wrapper to `container`
3. `onProjectionChange(proj)` — drive internal state (tab visibility, explorer sidecar) from the new projection
4. `destroy()` — call `wrappedComponent.destroy()`, remove wrapper from DOM, null all refs

```typescript
export class ViewCanvas implements CanvasComponent {
  private _config: ViewCanvasConfig;
  private _commitProjection: (proj: Projection) => void;
  private _viewManager: ViewManager | null = null;
  private _wrapperEl: HTMLElement | null = null;
  private _currentProj: Projection | null = null;

  constructor(config: ViewCanvasConfig, commitProjection: (proj: Projection) => void) {
    this._config = config;
    this._commitProjection = commitProjection;
  }

  mount(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'view-canvas';
    this._wrapperEl = wrapper;
    // instantiate ViewManager with config.container = wrapper
    // call viewManager.switchTo(initialViewType)
    container.appendChild(wrapper);
  }

  onProjectionChange(proj: Projection): void {
    // drive view switching, status slot updates
  }

  destroy(): void {
    this._viewManager?.destroy();
    this._viewManager = null;
    this._wrapperEl?.remove();
    this._wrapperEl = null;
  }
}
```

**When to use:** All production canvas implementations.
**Trade-offs:** The wrapper div adds one extra DOM level, but this is the established pattern (ExplorerCanvas also uses a `.explorer-canvas` wrapper) and is negligible.

### Pattern 2: Registry Entry with Config Closure

The registry's `create()` function is called by `getCanvasFactory()` on every canvas mount. The entry's `create` function captures its dependencies via closure at registration time:

```typescript
// In main.ts production registration
register('view-1', {
  canvasType: 'View',
  create: (binding: CanvasBinding = 'Unbound') =>
    new ViewCanvas(viewCanvasConfig, commitProjection),
  defaultExplorerId: 'explorer-1',  // makes this view "Bound" — Explorer sidecar auto-shows
});
```

**When to use:** All canvas registrations that need real dependencies.
**Trade-offs:** The config object must be assembled before `register()` is called; main.ts assembles it and passes it in — the same pattern used for ExplorerCanvas.

### Pattern 3: Projection-Driven Status Slot

Status slot content is entirely determined by `onProjectionChange`. The canvas writes to `statusEl` via the slot helpers or directly. Neither SuperWidget nor any external caller touches the status content after the canvas mounts.

For ViewCanvas: view type label + card count from last render (e.g., "SuperGrid · 47 cards").
For EditorCanvas: active card name (e.g., "Meeting Notes · Editing").

### Pattern 4: Bound/Unbound Sidecar

The `CanvasBinding` field in `Projection` is `'Bound' | 'Unbound'`. For ViewCanvas:
- `'Bound'` — the ViewCanvas shows the Explorer sidecar (ProjectionExplorer is auto-shown above the view; `defaultExplorerId` points at the explorer canvas in the registry)
- `'Unbound'` — no explorer sidecar; ViewCanvas is standalone

The current ViewCanvasStub already renders a `[data-sidecar]` child div when Binding is Bound. The production ViewCanvas must preserve this behavior. The mechanism: a `onBindingChange` callback in ViewCanvasConfig that main.ts wires to PanelManager show/hide.

## Data Flow

### ViewCanvas Projection Flow

```
DockNav click (sectionKey: 'visualize', itemKey: 'supergrid')
  |
  v
main.ts onActivateItem handler
  |
  v
commitProjection({ canvasType: 'View', canvasId: 'view-1', canvasBinding: 'Bound' })
  |
  v
SuperWidget.commitProjection()
  -- validateProjection() [guard]
  -- reference equality bail-out
  -- canvasFactory('view-1', 'Bound')  [registry lookup]
     -- new ViewCanvas(config, commitProjection) [constructor]
     -- canvas.mount(canvasEl)           [ViewManager instantiated, initial switchTo]
  -- canvas.onProjectionChange(proj)    [initial tab/binding state applied]
  |
  v
ViewManager.switchTo('supergrid', factory)
  -- StateCoordinator.subscribe() [re-render subscription]
  -- _fetchAndRender()             [initial Worker query]
  -- ProductionSuperGrid.render()  [D3 data join]
```

### EditorCanvas Projection Flow

```
User clicks a card in any D3 view
  |
  v
SelectionProvider.select(cardId)
  |
  v
commitProjection({ canvasType: 'Editor', canvasId: 'editor-1' })
  |
  v
SuperWidget.commitProjection()
  -- canvasFactory('editor-1', 'Unbound')
  -- new EditorCanvas(config, commitProjection)
  -- canvas.mount(canvasEl)
     -- NotebookExplorer.mount(wrapperEl)
        -- SelectionProvider.subscribe() [auto-loads card on mount]
  |
  v
NotebookExplorer._onSelectionChange()
  -- bridge.send('card:get', { id })
  -- _showEditor() / populates title + textarea
  |
  v
statusEl updated: card name from SelectionProvider
```

### Key Data Flows

1. **View-type switching inside ViewCanvas:** `onProjectionChange` maps `proj.activeTabId` to a ViewType (if tabs encode view types) and calls `viewManager.switchTo()`. Alternatively, the DockNav callback fires `commitProjection` with the new canvasId — whatever convention is chosen, it must be consistent.

2. **Bound/Unbound toggle:** `onProjectionChange` detects `proj.canvasBinding` change, calls `config.onBindingChange(binding)` which main.ts wires to `panelManager.show('projection')` / `panelManager.hide('projection')`.

3. **Status slot updates in ViewCanvas:** After each `_fetchAndRender()` completes in ViewManager, ViewCanvas needs a callback. Options: (a) ViewCanvas adds a post-render hook to ViewManager config, or (b) ViewCanvas overrides `coordinator.subscribe()` to read `viewManager.getLastCards().length` after render. Option (a) is cleaner — add `onAfterRender?: (cardCount: number) => void` to `ViewManagerConfig`.

## New vs. Modified (Explicit)

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/superwidget/ViewCanvas.ts` | NEW | Production ViewCanvas wrapping ViewManager |
| `src/superwidget/EditorCanvas.ts` | NEW | Production EditorCanvas wrapping NotebookExplorer |
| `src/superwidget/registry.ts` | MODIFIED | Update `register('view-1')` and `register('editor-1')` entries OR add `registerProduction()` function |
| `src/views/ViewManager.ts` | POSSIBLY MODIFIED | Add `onAfterRender` hook to `ViewManagerConfig` if status slot needs card count |
| `src/main.ts` | MODIFIED | Assemble ViewCanvasConfig + EditorCanvasConfig; register with production canvases |
| `tests/superwidget/ViewCanvas.test.ts` | NEW | Unit tests (jsdom) |
| `tests/superwidget/EditorCanvas.test.ts` | NEW | Unit tests (jsdom) |
| `tests/superwidget/view-canvas-integration.test.ts` | NEW | Cross-seam integration |
| `tests/superwidget/editor-canvas-integration.test.ts` | NEW | Cross-seam integration |
| `e2e/superwidget-smoke.spec.ts` | MODIFIED | Add ViewCanvas + EditorCanvas harness tests |
| `e2e/fixtures/viewcanvas-harness.html` | NEW | WebKit harness |
| `e2e/fixtures/editorcanvas-harness.html` | NEW | WebKit harness |

Files that must NOT be modified:
- `SuperWidget.ts` — substrate complete; CANV-06 zero-import contract must hold
- `projection.ts` — all transitions, types, and validation are final
- `ExplorerCanvas.ts` / `statusSlot.ts` — shipped v13.1; do not touch
- All provider files — consumed as-is

## Integration Points

### ViewCanvas Integration Points

| Point | How ViewCanvas Connects |
|-------|------------------------|
| ViewManager | ViewCanvas receives a `ViewManagerConfig` (minus `container`) via constructor config; creates a `ViewManager` instance on `mount()` binding `wrapperEl` as the container |
| StateCoordinator subscription | Transparent — ViewManager handles internally; ViewCanvas does not subscribe to coordinator directly |
| Provider stack (PAFVProvider, FilterProvider, QueryBuilder, bridge) | Passed into `ViewManagerConfig` within the ViewCanvas config object |
| Status slot card count | `onAfterRender` callback in `ViewManagerConfig` notifies ViewCanvas; ViewCanvas writes to `statusEl` |
| Bound/Unbound sidecar | `onBindingChange: (binding: CanvasBinding) => void` in ViewCanvasConfig; main.ts wires to PanelManager |
| WorkerBridge | Passed into ViewManagerConfig |

### EditorCanvas Integration Points

| Point | How EditorCanvas Connects |
|-------|--------------------------|
| NotebookExplorer | EditorCanvas creates a `NotebookExplorer` instance on `mount()`; same `NotebookExplorerConfig` shape |
| SelectionProvider | Passed into `NotebookExplorerConfig`; NE subscribes internally; EditorCanvas adds one minimal subscriber for status slot only |
| MutationManager, FilterProvider, AliasProvider, SchemaProvider, WorkerBridge | Passed into `NotebookExplorerConfig` |
| Status slot card name | EditorCanvas minimal SelectionProvider subscriber reads `selection.getSelectedIds()[0]` and bridge.send('card:get') to get name; writes to `statusEl` |

### Critical Seam: CANV-06

`SuperWidget.ts` has zero imports to canvas implementations. This must remain true after v13.2. All concrete references (`ViewCanvas`, `EditorCanvas`) live only in:
1. `registry.ts` (the `create()` factory function)
2. `main.ts` (the registration call with assembled config)

Neither `SuperWidget.ts` nor `projection.ts` may import from `ViewCanvas.ts` or `EditorCanvas.ts`.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| ViewCanvas ↔ ViewManager | Direct instance ownership; config struct | ViewCanvas creates, owns, and destroys the ViewManager instance |
| EditorCanvas ↔ NotebookExplorer | Direct instance ownership; config struct | EditorCanvas creates, owns, and destroys the NE instance |
| ViewCanvas ↔ StatusSlot | Direct DOM write to `statusEl` | ViewCanvas writes its own status schema — NOT the 3-span explorer schema from `renderStatusSlot` |
| ViewCanvas ↔ SuperWidget | `CanvasComponent` interface only | mount/destroy/onProjectionChange — no direct field access |
| Registry ↔ main.ts | `register()` call with closure | Config captured at registration; factory called on each `commitProjection` canvas change |

## Suggested Build Order

The dependency graph dictates this ordering. Each step must be green (tests passing) before starting the next.

**Step 1 — ViewCanvas production implementation**
- Write `ViewCanvas.ts`: CanvasComponent wrapper around ViewManager
- Constructor: `ViewCanvasConfig` (all provider refs + bridge + statusEl + callbacks) + `commitProjection`
- `mount()`: wrapper div, ViewManager instantiation, `switchTo(defaultViewType)`
- `onProjectionChange(proj)`: view-type changes and binding changes
- `destroy()`: ViewManager teardown
- Write `ViewCanvas.test.ts` unit tests (jsdom, mock ViewManager)

Rationale: ViewCanvas is higher complexity (ViewManager wiring) and has no dependency on EditorCanvas. Tackle first while the ExplorerCanvas pattern is fresh.

**Step 2 — ViewCanvas registry + main.ts wiring**
- Update `registry.ts`: replace `ViewCanvasStub` in the production path
- Update `main.ts`: assemble `ViewCanvasConfig` with real providers; `register('view-1', ...)` with production entry
- Run existing integration tests — all should still pass

**Step 3 — Bound/Unbound Explorer sidecar**
- `ViewCanvas.onProjectionChange()` detects `canvasBinding` changes
- `onBindingChange` callback triggers PanelManager show/hide for ProjectionExplorer
- Write `view-canvas-integration.test.ts`: Bound→Unbound→Bound transitions
- Verify E2E: sidecar appears/disappears correctly in browser

**Step 4 — ViewCanvas status slot**
- Hook into ViewManager's post-render via `onAfterRender` in `ViewManagerConfig`
- Write view type label + card count to `statusEl`
- Test: status updates after switchTo and after coordinator-driven re-renders

**Step 5 — EditorCanvas production implementation**
- Write `EditorCanvas.ts`: CanvasComponent wrapper around NotebookExplorer
- Constructor: `EditorCanvasConfig` (NotebookExplorerConfig shape + statusEl) + `commitProjection`
- `mount()`: wrapper div, NE instantiation, NE.mount(), minimal SelectionProvider subscriber for status
- `onProjectionChange(proj)`: minimal for EditorCanvas — NE drives itself via SelectionProvider
- `destroy()`: NE.destroy(), unsubscribe, remove wrapper
- Write `EditorCanvas.test.ts` unit tests

**Step 6 — EditorCanvas registry + main.ts wiring**
- Same pattern as Step 2 for EditorCanvas
- Assemble `EditorCanvasConfig` with all NE dependencies
- `register('editor-1', ...)` with production entry

**Step 7 — 3-canvas transition matrix E2E**
- Write `viewcanvas-harness.html` and `editorcanvas-harness.html` fixtures
- Extend `superwidget-smoke.spec.ts` with full Explorer→View→Editor transition tests using real canvases
- This is the CI gate for v13.2

## Anti-Patterns

### Anti-Pattern 1: ViewCanvas Creating Its Own Providers

**What people do:** Instantiate a new FilterProvider or PAFVProvider inside ViewCanvas for isolation.
**Why it's wrong:** The whole system shares a single StateCoordinator → FilterProvider → QueryBuilder chain. A second FilterProvider breaks filter persistence and cross-view state.
**Do this instead:** Receive all providers via constructor config; ViewManager uses them as-is.

### Anti-Pattern 2: Importing ViewCanvas from SuperWidget.ts

**What people do:** Add `import { ViewCanvas } from './ViewCanvas'` to `SuperWidget.ts` as a shortcut.
**Why it's wrong:** Violates CANV-06 (zero concrete canvas imports in SuperWidget). Breaks the plug-in seam.
**Do this instead:** All canvas references go through the registry's `create()` factory function.

### Anti-Pattern 3: Status Slot Using ExplorerCanvas's 3-Span Schema

**What people do:** Call `renderStatusSlot(statusEl)` in ViewCanvas or EditorCanvas since it already exists.
**Why it's wrong:** `renderStatusSlot` creates cards/connections/last-import spans — meaningless for a View or Editor canvas. The function is idempotent but writes ExplorerCanvas DOM structure.
**Do this instead:** Each canvas writes its own status DOM structure. Only ExplorerCanvas uses `renderStatusSlot`.

### Anti-Pattern 4: ViewCanvas Calling `coordinator.scheduleUpdate()` Directly

**What people do:** Have ViewCanvas drive re-renders by calling coordinator when the projection changes.
**Why it's wrong:** ViewManager already subscribes to the coordinator. Double-scheduling causes duplicate Worker queries.
**Do this instead:** Let ViewManager's coordinator subscription handle all re-renders. ViewCanvas only calls `viewManager.switchTo()` on view-type change.

### Anti-Pattern 5: EditorCanvas Double-Subscribing SelectionProvider

**What people do:** Add a second SelectionProvider subscriber in EditorCanvas separate from NotebookExplorer's own subscriber.
**Why it's wrong:** NE already subscribes internally. Two full subscribers cause double `card:get` calls and race conditions on rapid selection changes.
**Do this instead:** EditorCanvas adds one minimal subscriber that only reads `selection.getSelectedIds()[0]` for the status slot card title — no async calls, no `card:get`.

## Sources

- `src/superwidget/SuperWidget.ts` — commitProjection lifecycle (validate→destroy→mount), CANV-06 contract
- `src/superwidget/projection.ts` — CanvasComponent interface, Projection type, transition functions
- `src/superwidget/registry.ts` — CanvasRegistryEntry, registerAllStubs, getCanvasFactory
- `src/superwidget/ExplorerCanvas.ts` — production canvas reference pattern (v13.1)
- `src/superwidget/statusSlot.ts` — renderStatusSlot/updateStatusSlot helpers and schema
- `src/views/ViewManager.ts` — ViewManagerConfig, switchTo lifecycle, coordinator subscription pattern
- `src/ui/NotebookExplorer.ts` — NotebookExplorerConfig, mount/destroy, SelectionProvider binding internals
- `src/main.ts` — provider wiring, viewFactory map, DockNav callbacks, top-slot/bottom-slot structure, registry usage
- `tests/superwidget/integration.test.ts` — integration test patterns (makeProjection helper, canvas transition assertions)
- `e2e/superwidget-smoke.spec.ts` — E2E harness pattern (window.__sw, commitProjection via page.evaluate)

---
*Architecture research for: ViewCanvas + EditorCanvas integration into SuperWidget substrate*
*Researched: 2026-04-21*
