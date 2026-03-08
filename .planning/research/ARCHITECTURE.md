# Architecture Patterns: v5.0 Designer Workbench

**Domain:** Workbench shell + explorer panel integration into existing Isometry v5 web runtime
**Researched:** 2026-03-08
**Confidence:** HIGH -- all five integration questions resolved by reading existing source code; no external dependencies, no new architectural primitives, no changes to Worker/DB/Bridge layers

---

## Executive Summary

The Workbench UI inserts a new DOM layer (`WorkbenchShell`) between `#app` and `ViewManager` without touching any data layer. All five integration questions have clear answers derived from the existing codebase:

1. **Re-rooting ViewManager** is safe because ViewManager already accepts its container via constructor config -- changing the element from `#app` to `.workbench-view-content` requires zero changes to ViewManager itself. SuperGrid's CSS Grid + sticky headers work because SuperGrid creates its own `overflow: auto` root inside whatever container it receives.

2. **Provider injection** follows the exact pattern already used for SuperGrid (7 constructor params) and ViewManager (7 config fields). WorkbenchShell receives all providers from main.ts and passes them to explorer constructors.

3. **Explorer lifecycle** mirrors the IView `mount/render/destroy` pattern already proven across 9 views. Explorers add `update()` for incremental state reflection.

4. **State observation** uses the pull-on-scheduleUpdate model. Explorers subscribe to StateCoordinator and read provider state when notified -- the same pattern ViewManager uses today.

5. **DnD boundaries** are physically isolated. ProjectionExplorer DnD operates on chip elements inside `.explorer-projection`. SuperGrid DnD operates on header cells inside `.supergrid-view`. The two never share DOM ancestry.

---

## 1. DOM Re-Rooting Strategy

### 1.1 The Problem

ViewManager currently receives `#app` directly:

```typescript
// main.ts (current)
const container = document.getElementById('app')!;
const viewManager = new ViewManager({ container, ... });
```

ViewManager calls `this.container.innerHTML = ''` on view switches (line 267, 308). It also uses `this.container.appendChild()` for loading/error/empty states. If WorkbenchShell were a child of `#app` alongside ViewManager, innerHTML clearing would destroy the shell.

### 1.2 The Solution

WorkbenchShell creates its own DOM tree inside `#app` and exposes a child element for ViewManager. ViewManager never touches anything above its own container.

```
#app                                   <-- WorkbenchShell receives this
  .workbench-shell                     <-- WorkbenchShell creates this (flex column)
    .workbench-command-bar             <-- CommandBar module
    .workbench-panel-rail              <-- Explorer panels (overflow-y: auto)
      .explorer-notebook
      .explorer-properties
      .explorer-projection
      .explorer-latch
    .workbench-view-content            <-- ViewManager receives THIS
      [SuperGrid / other views]
```

**main.ts wiring change (the only change to existing code):**

```typescript
// main.ts (new)
const appEl = document.getElementById('app')!;
const shell = new WorkbenchShell(appEl, { pafv, filter, density, superDensity, coordinator, bridge, ... });
shell.mount();

const viewHost = shell.getViewContentEl();
const viewManager = new ViewManager({ container: viewHost, coordinator, queryBuilder, bridge, pafv, filter, announcer });
```

### 1.3 Why SuperGrid Is Safe

SuperGrid's CSS Grid + sticky headers work regardless of the parent container because SuperGrid creates its own scroll container. From `SuperGrid.mount()` (line 508-514):

```typescript
mount(container: HTMLElement): void {
    const root = document.createElement('div');
    root.className = 'supergrid-view view-root';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.overflow = 'auto';    // <-- SuperGrid owns its own scroll context
    root.style.position = 'relative';
```

The sticky headers use `position: sticky` relative to SuperGrid's own scroll container (`.supergrid-view`), NOT relative to `#app` or any ancestor. The only requirement is that `.workbench-view-content` provides a defined height so the `100% height` on `.supergrid-view` has a reference. This is satisfied by:

```css
.workbench-view-content {
    flex: 1 1 auto;
    overflow: hidden;
    min-height: 0;   /* Critical: allows flex child to shrink below content size */
}
```

The `min-height: 0` is essential. Without it, the flex item defaults to `min-height: auto` (content size), which prevents SuperGrid from scrolling internally -- it would expand the container instead.

### 1.4 Other Modules Affected by Re-Rooting

Four existing modules currently mount to `#app` or its parent:

| Module | Current Mount | Impact | Fix |
|--------|--------------|--------|-----|
| ViewTabBar | `container.parentElement.insertBefore(el, container)` | Would insert before `#app` in body -- wrong | WorkbenchShell replaces ViewTabBar (explorers are the new nav) |
| AuditOverlay | `container.appendChild(btn)` where container = `#app` | Button would be inside `.workbench-shell` | Mount to `shell.getViewContentEl()` instead (audit is view-contextual) |
| AuditLegend | Same as AuditOverlay | Same | Mount to `shell.getViewContentEl()` |
| CommandPalette | `commandPalette.mount(container)` where container = `#app` | Overlay should cover entire app | Mount to `#app` directly (above shell), or mount to document.body like Announcer |
| HelpOverlay | `helpOverlay.mount(container)` where container = `#app` | Same as CommandPalette | Mount to `#app` directly |
| ImportToast | `new ImportToast(container)` | Same | Mount to `#app` directly |

**Rule of thumb:** Overlays (palette, help, toasts) mount to `#app` or `document.body`. View-contextual UI (audit overlay, views) mount to `shell.getViewContentEl()`.

### 1.5 CSS Scoping Guard

All new CSS selectors scoped under `.workbench-shell` or child classes:

```css
/* workbench-shell.css */
.workbench-shell { ... }
.workbench-shell .workbench-command-bar { ... }
.workbench-shell .workbench-panel-rail { ... }
.workbench-shell .workbench-view-content { ... }

/* explorers.css */
.explorer-notebook { ... }
.explorer-properties { ... }
.explorer-projection { ... }
.explorer-latch { ... }
```

No bare element selectors. No `* { box-sizing }` resets. This prevents bleed into SuperGrid's CSS Grid layout, which depends on the default box model for grid-template-columns calculations.

**CSS import order (additive, not replacing):**

```
design-tokens.css       (first -- variables)
accessibility.css
views.css
supergrid.css
workbench-shell.css     (NEW -- after existing, before explorers)
explorers.css           (NEW -- last)
```

---

## 2. Provider Injection Pattern

### 2.1 Existing Precedent

Constructor injection with explicit dependencies is the established pattern in this codebase. Two examples:

**SuperGrid constructor (7 dependencies):**
```typescript
constructor(
    provider: SuperGridProviderLike,
    filter: SuperGridFilterLike,
    bridge: SuperGridBridgeLike,
    coordinator: { subscribe(cb: () => void): () => void },
    positionProvider: SuperGridPositionLike,
    selectionAdapter: SuperGridSelectionLike,
    densityProvider: SuperGridDensityLike,
)
```

**ViewManager config (7 fields):**
```typescript
interface ViewManagerConfig {
    container: HTMLElement;
    coordinator: StateCoordinator;
    queryBuilder: QueryBuilder;
    bridge: WorkerBridgeLike;
    pafv: PAFVProviderLike;
    filter: FilterProviderLike;
    announcer?: Announcer;
}
```

### 2.2 WorkbenchShell Injection Pattern

WorkbenchShell receives all providers from main.ts and distributes them to explorer constructors:

```typescript
interface WorkbenchShellConfig {
    // Providers (passed through to explorers)
    pafv: PAFVProvider;
    filter: FilterProvider;
    density: DensityProvider;
    superDensity: SuperDensityProvider;
    coordinator: StateCoordinator;
    bridge: WorkerBridgeLike;

    // Explorer-specific config
    auditState: AuditState;
    announcer: Announcer;
}

export class WorkbenchShell {
    constructor(
        private readonly rootEl: HTMLElement,
        private readonly config: WorkbenchShellConfig,
    ) {}

    mount(): void {
        // Create shell DOM structure
        // ...

        // Create explorers with explicit provider injection
        this.propertiesExplorer = new PropertiesExplorer({
            container: this.panelRail,
            pafv: this.config.pafv,
            coordinator: this.config.coordinator,
        });

        this.projectionExplorer = new ProjectionExplorer({
            container: this.panelRail,
            pafv: this.config.pafv,
            density: this.config.density,
            auditState: this.config.auditState,
            coordinator: this.config.coordinator,
        });

        this.latchExplorers = new LatchExplorers({
            container: this.panelRail,
            filter: this.config.filter,
            coordinator: this.config.coordinator,
        });
    }
}
```

### 2.3 Narrow Interface Principle

Each explorer should declare the narrowest possible interface for its dependencies, not the full provider class. This pattern is already established (ViewManager uses `FilterProviderLike`, not `FilterProvider`; SuperGrid uses `SuperGridProviderLike`, not `PAFVProvider`).

```typescript
// PropertiesExplorer only needs these methods from PAFVProvider
interface PropertiesProviderLike {
    getAvailableAxes(): AxisField[];
    getColAxes(): AxisMapping[];
    getRowAxes(): AxisMapping[];
    setPropertyEnabled(propertyId: string, enabled: boolean): void;
}
```

This keeps explorers testable without full provider construction in tests.

### 2.4 No Singletons, No Global Imports

The D3-UI-IMPLEMENTATION-SPEC-v2 explicitly states:

> "Explorer modules receive provider references via constructor injection from WorkbenchShell / main.ts. They do not import providers as singletons directly." (Section 6)

This means explorers never `import { pafvProvider } from '../providers'`. They always receive instances through their constructors. This preserves testability and prevents hidden coupling.

---

## 3. Explorer Lifecycle Pattern

### 3.1 Existing IView Pattern

All 9 views implement the `IView` interface:

```typescript
interface IView {
    mount(container: HTMLElement): void;    // Create DOM, subscribe
    render(cards: CardDatum[]): void;       // D3 data join update
    destroy(): void;                         // Remove DOM, unsubscribe
}
```

### 3.2 Explorer Module Interface

Explorers extend this pattern with an `update()` method for incremental state reflection. Unlike views, explorers are not recreated on view switches -- they persist in the panel rail for the lifetime of the shell.

```typescript
interface IExplorer {
    /** Create DOM structure, subscribe to coordinator, render initial state */
    mount(container: HTMLElement): void;

    /** Incrementally update DOM to reflect current provider state.
     *  Called by WorkbenchShell when StateCoordinator fires.
     *  Must NOT trigger provider changes (would cause infinite loop). */
    update(): void;

    /** Remove DOM, unsubscribe from all listeners, release references */
    destroy(): void;
}
```

### 3.3 Lifecycle Differences from IView

| Aspect | IView (existing) | IExplorer (new) |
|--------|-----------------|-----------------|
| Lifespan | Created on view switch, destroyed on next switch | Created once in shell.mount(), destroyed in shell.destroy() |
| Container ownership | Receives container, may `innerHTML = ''` it | Receives container, appends own root (never clears container) |
| Data source | Receives `CardDatum[]` from ViewManager | Reads provider state directly |
| Update trigger | ViewManager calls `render(cards)` after Worker query | WorkbenchShell calls `update()` after coordinator fires |
| Multiple instances | One active at a time | All active simultaneously |

### 3.4 WorkbenchShell Coordinator Subscription

WorkbenchShell subscribes once to StateCoordinator and fans out to all explorers:

```typescript
mount(): void {
    // ... create DOM, create explorers ...

    // Single coordinator subscription for all explorers
    this._coordinatorUnsub = this.config.coordinator.subscribe(() => {
        this.propertiesExplorer.update();
        this.projectionExplorer.update();
        this.latchExplorers.update();
        // Visual explorer does NOT need update -- SuperGrid handles itself
    });

    // Initial render
    this.propertiesExplorer.update();
    this.projectionExplorer.update();
    this.latchExplorers.update();
}

destroy(): void {
    this._coordinatorUnsub?.();
    this.propertiesExplorer.destroy();
    this.projectionExplorer.destroy();
    this.latchExplorers.destroy();
    this.commandBar.destroy();
    this.notebookExplorer.destroy();
    this._shellEl?.remove();
}
```

### 3.5 CollapsibleSection as Lifecycle Wrapper

Each explorer is wrapped in a CollapsibleSection that manages show/hide without destroying the explorer's DOM:

```typescript
// Inside WorkbenchShell.mount()
const propSection = new CollapsibleSection({
    title: 'Properties',
    defaultCollapsed: false,
});
propSection.mount(this.panelRail);

this.propertiesExplorer = new PropertiesExplorer({ ... });
this.propertiesExplorer.mount(propSection.getBodyEl());
```

When collapsed, the section's body gets `display: none` (or height animation). The explorer's DOM remains in the document but hidden. `update()` can short-circuit with an early return when the section is collapsed (optimization, not correctness):

```typescript
update(): void {
    if (this._collapsed) return;  // Don't update hidden DOM
    // ... read providers, update DOM ...
}
```

---

## 4. State Observation: Pull-on-Notify Model

### 4.1 The Pattern Already in Use

StateCoordinator uses a "notify, then pull" pattern. When any provider changes:

1. Provider self-notifies via `queueMicrotask`
2. StateCoordinator batches with `setTimeout(16)` (fires after microtasks settle)
3. Subscribers are called with no arguments -- they receive no payload
4. Each subscriber reads current state from providers directly

This is already how ViewManager works:

```typescript
// ViewManager subscribes to coordinator
this.coordinatorUnsub = this.coordinator.subscribe(() => {
    void this._fetchAndRender();  // Reads from queryBuilder, which reads from providers
});
```

### 4.2 Explorer Observation Pattern

Explorers follow the same pull-on-notify model:

```typescript
// ProjectionExplorer.update() -- called by WorkbenchShell on coordinator notify
update(): void {
    const colAxes = this._pafv.getColAxes();
    const rowAxes = this._pafv.getRowAxes();

    // D3 data join for chip rendering
    d3.select(this._xWellEl)
        .selectAll('.projection-chip')
        .data(colAxes, d => d.field)
        .join(
            enter => enter.append('div').attr('class', 'projection-chip') /* ... */,
            update => update /* ... */,
            exit => exit.remove(),
        );

    // Update z controls from density/audit state
    this._updateZControls();
}
```

### 4.3 Why NOT Push Subscription

An alternative is for each explorer to subscribe independently to individual providers:

```typescript
// ANTI-PATTERN -- each explorer subscribes to providers directly
constructor(config) {
    this.pafv = config.pafv;
    this._pafvUnsub = this.pafv.subscribe(() => this._onPafvChange());
    this._filterUnsub = config.filter.subscribe(() => this._onFilterChange());
}
```

This is worse because:

1. **Multiple updates per frame.** If a user action changes both PAFV and filter simultaneously, each explorer would update twice. The coordinator's 16ms batching exists to prevent this.
2. **Leak management.** Each explorer manages its own unsubscribe lifecycle. The single-subscription pattern in WorkbenchShell centralizes cleanup.
3. **Consistency.** ViewManager uses coordinator subscription. Explorers should use the same pattern.

### 4.4 Explorer-Initiated Changes

When an explorer modifies provider state (e.g., ProjectionExplorer drops a chip into a well), it follows the exact pattern from the spec (Section 6):

```typescript
onWellDrop(payload: ProjectionDragPayload, target: ProjectionDropTarget): void {
    const updatedAxes = this.computeNewAxes(payload, target);
    this._pafv.setAxes(updatedAxes);          // 1. Update provider
    this._coordinator.scheduleUpdate();         // 2. Schedule coordinated update
    // Do NOT call this.update() here -- coordinator will trigger it
}
```

The coordinator fires, which calls WorkbenchShell's subscription, which calls all `explorer.update()` methods AND triggers ViewManager's subscription (which re-queries the Worker). This ensures all explorers and the view stay in sync.

### 4.5 Avoiding Infinite Loops

The loop risk: explorer.update() reads state, renders DOM, DOM event fires, modifies provider, triggers coordinator, which calls update() again.

Prevention:

1. **update() is read-only.** It reads provider state and renders DOM. It never modifies provider state.
2. **Event handlers are separate.** Click/drop/change handlers call provider setters + `scheduleUpdate()`. They do not call `update()` directly.
3. **StateCoordinator deduplicates.** If `scheduleUpdate()` is called during a pending timeout, it's a no-op (line 113: `if (this.pendingUpdate !== null) return;`).

---

## 5. DnD Boundary: ProjectionExplorer vs SuperGrid

### 5.1 Physical Separation

The two DnD systems operate on completely separate DOM subtrees:

```
#app
  .workbench-shell
    .workbench-panel-rail
      .explorer-projection         <-- ProjectionExplorer DnD here
        .well-available
        .well-x
        .well-y
        .well-z
    .workbench-view-content
      .supergrid-view              <-- SuperGrid DnD here
        .supergrid-container
          .col-header (draggable)
          .row-header (draggable)
          .axis-drop-zone--col
          .axis-drop-zone--row
```

### 5.2 SuperGrid DnD (Existing)

SuperGrid's axis DnD uses a module-level singleton `_dragPayload` (declared at SuperGrid.ts line 106):

```typescript
let _dragPayload: AxisDragPayload | null = null;
```

Drag events are registered on header cells inside `.supergrid-container`. Drop zones are `.axis-drop-zone--col` and `.axis-drop-zone--row` elements positioned at the edges of the grid. The payload contains `{ field, sourceDimension, sourceIndex }` and resolves to axis reorder/transpose operations on PAFVProvider.

### 5.3 ProjectionExplorer DnD (New)

ProjectionExplorer DnD uses a separate module-level singleton in its own file:

```typescript
// ProjectionExplorer.ts
let _projectionDragPayload: ProjectionDragPayload | null = null;
```

Drag events are registered on chip elements inside `.explorer-projection`. Drop zones are well containers (`.well-available`, `.well-x`, `.well-y`, `.well-z`). The payload contains `{ propertyId, sourceWell, sourceIndex }` and resolves to axis assignment operations on PAFVProvider.

### 5.4 Why They Don't Interfere

1. **Event delegation scope.** SuperGrid registers dragover/drop on `.supergrid-container`. ProjectionExplorer registers on `.explorer-projection`. These are in different DOM subtrees -- events don't bubble between them.

2. **Separate dragPayload singletons.** Each module has its own `_dragPayload` variable. Even if a drag somehow crossed boundaries, the wrong module's drop handler would find its own payload as `null`.

3. **dataTransfer type discrimination.** For defense in depth, each system sets a distinct MIME type on `dataTransfer`:

```typescript
// SuperGrid
e.dataTransfer.setData('application/x-isometry-axis', '');

// ProjectionExplorer
e.dataTransfer.setData('application/x-isometry-projection', '');
```

Drop handlers check for their expected type and ignore foreign drags.

### 5.5 Shared Naming Convention

Per the spec (Section 5.3.1), both DnD systems use consistent dataset attributes:

```typescript
// Both use:
element.dataset['dragPayload'] = JSON.stringify(payload);  // data-drag-payload
container.dataset['dropZone'] = 'x';                       // data-drop-zone
```

This is a naming convention for consistency and debugging, not a shared mechanism. The attributes are on different elements in different subtrees.

### 5.6 State Convergence

Both DnD systems ultimately modify the same PAFVProvider. This is correct and intentional:

- SuperGrid DnD: reorders axes within a dimension, or transposes between col/row
- ProjectionExplorer DnD: assigns properties to wells (which map to col/row/z axes)

Both call `pafv.setAxes()` (or the equivalent setter) followed by `coordinator.scheduleUpdate()`. The coordinator batches both into one notification, so the view re-renders once with the final state.

**Important:** If both DnD operations could fire simultaneously (they can't -- a user can only drag one thing at a time), the last write to PAFVProvider wins. Since both use `scheduleUpdate()` with its dedup guard, only one re-render occurs.

---

## 6. Component Boundaries

### 6.1 New Components

| Component | File | Type | Dependencies |
|-----------|------|------|-------------|
| WorkbenchShell | `src/ui/WorkbenchShell.ts` | Shell orchestrator | All providers, StateCoordinator, all explorers |
| CollapsibleSection | `src/ui/CollapsibleSection.ts` | Reusable primitive | None (pure DOM) |
| CommandBar | `src/ui/CommandBar.ts` | UI module | ShortcutRegistry, CommandPalette (optional) |
| PropertiesExplorer | `src/ui/PropertiesExplorer.ts` | Explorer | PAFVProvider, StateCoordinator |
| ProjectionExplorer | `src/ui/ProjectionExplorer.ts` | Explorer | PAFVProvider, DensityProvider, AuditState, StateCoordinator |
| LatchExplorers | `src/ui/LatchExplorers.ts` | Explorer | FilterProvider, StateCoordinator |
| NotebookExplorer | `src/ui/NotebookExplorer.ts` | Explorer | None (session-only state) |
| workbench-shell.css | `src/styles/workbench-shell.css` | Styles | design-tokens.css |
| explorers.css | `src/styles/explorers.css` | Styles | design-tokens.css |

### 6.2 Modified Components

| Component | What Changes | Risk |
|-----------|-------------|------|
| main.ts | Create WorkbenchShell, pass viewHost to ViewManager, remount overlays | LOW -- additive wiring, no logic changes |
| ViewManager | None -- receives a different container element, all internal logic unchanged | NONE |
| SuperGrid | None -- mounts into whatever container ViewManager provides | NONE |
| AuditOverlay | Mount target changes from `#app` to viewHost | LOW -- one line change |
| ViewTabBar | Replaced by WorkbenchShell navigation (may be removed or kept as fallback) | LOW |

### 6.3 Unchanged Components

| Component | Why Unchanged |
|-----------|--------------|
| All 9 views | Mount into the same container ViewManager provides; container identity doesn't matter |
| All providers (Filter, PAFV, Selection, Density, SuperDensity, SuperPosition) | No API changes; explorers use existing methods |
| StateCoordinator | No changes; WorkbenchShell subscribes like any other consumer |
| WorkerBridge | No new message types |
| MutationManager | No changes |
| QueryBuilder | No changes |
| Database schema | No changes |
| Swift native shell | No changes |

---

## 7. Data Flow

### 7.1 Explorer -> Provider -> View Update

```
User drops chip from "available" well to "x" well in ProjectionExplorer
  |
  v
ProjectionExplorer.onWellDrop()
  |-- pafv.setColAxes([...existing, newAxis])     // 1. Mutate provider
  |-- coordinator.scheduleUpdate()                  // 2. Schedule batch
  |
  v
~16ms later: StateCoordinator fires all subscribers
  |
  +-- WorkbenchShell.onCoordinatorUpdate()
  |     |-- propertiesExplorer.update()   // Reads pafv, reflects new axis assignments
  |     |-- projectionExplorer.update()   // Reads pafv, reflects chip in new well
  |     |-- latchExplorers.update()       // Reads filter (unchanged), no DOM changes
  |
  +-- ViewManager._fetchAndRender()
        |-- queryBuilder.buildCardQuery() // Reads pafv + filter + density
        |-- bridge.send('db:query', ...)
        |-- currentView.render(cards)     // SuperGrid re-renders with new axes
```

### 7.2 Visual Explorer Zoom

```
User drags zoom slider in Visual Explorer
  |
  v
superPositionProvider.zoomLevel = newLevel  // Direct property set
  |
  v
SuperGrid reads zoomLevel on next scroll/render cycle
  // SuperPositionProvider is NOT in StateCoordinator (would cause 60fps Worker calls)
  // Zoom is a CSS transform, not a data change
```

This is the existing pattern (documented in PROJECT.md, decision line 293).

---

## 8. Suggested Build Order

### Phase 1: Shell Scaffolding (Lowest Risk)

**Build:** WorkbenchShell, CollapsibleSection, CommandBar
**Wire:** main.ts creates shell, ViewManager receives sub-element
**Gate:** All existing tests pass. SuperGrid renders identically in new mount point.

**Rationale:** This phase changes the DOM hierarchy but not any behavior. It's the riskiest phase because it touches main.ts composition, so it should go first so any regression is caught early. The gate is simple: run the full test suite and visually verify SuperGrid.

**Risk:** SuperGrid sticky headers breaking if `.workbench-view-content` doesn't have correct flex/overflow/min-height. Mitigated by explicit CSS rules (Section 1.3) and immediate manual verification.

### Phase 2: Properties + Projection Explorers

**Build:** PropertiesExplorer, ProjectionExplorer with DnD
**Wire:** Explorer update() called from shell coordinator subscription
**Gate:** All existing SuperGrid tests green. New explorer tests pass. Axis changes from explorer correctly trigger SuperGrid re-render.

**Rationale:** These two explorers are the core value -- they replace the existing scattered control surfaces with a unified panel interface. Building them together allows testing the full provider-to-view pipeline through explorers.

### Phase 3: Visual Explorer + LATCH Explorers

**Build:** Visual Explorer (zoom rail wrapper), LatchExplorers Phase A
**Wire:** Zoom slider to SuperPositionProvider, filter controls to FilterProvider
**Gate:** No regression in SuperGrid performance benchmarks.

**Rationale:** Visual Explorer is thin (wraps existing SuperGrid + adds zoom slider). LatchExplorers Phase A is skeleton + filter wiring. Both are lower risk than Phase 2.

### Phase 4: Notebook Explorer + Polish

**Build:** NotebookExplorer v1 (textarea + markdown preview, session-only)
**Polish:** Final spacing, typography, keyboard accessibility
**Gate:** Full accessibility pass (ARIA roles, focus management)

**Rationale:** Notebook has zero integration with providers (session-only state). It's the most independent module and benefits from all prior CSS and layout work being stable.

---

## 9. Anti-Patterns to Avoid

### Anti-Pattern 1: Explorer Directly Calling SuperGrid

**What:** Explorer module imports SuperGrid and calls `grid.render()` or `grid.query()`
**Why bad:** Creates coupling between sidebar and view. Breaks when view type changes (SuperGrid is only one of 9 views). Bypasses StateCoordinator batching.
**Instead:** Always go through providers + `coordinator.scheduleUpdate()`. The spec (Section 6) calls this out as "the primary architectural failure mode to prevent."

### Anti-Pattern 2: Global CSS Reset in New Files

**What:** Adding `* { box-sizing: border-box }` in workbench-shell.css
**Why bad:** SuperGrid's CSS Grid template calculations depend on the current box model. A global reset changes the layout of all existing cells and headers.
**Instead:** Scope to `.workbench-shell *` if needed. But prefer explicit sizing on new elements over global resets.

### Anti-Pattern 3: Explorer Subscribing Directly to Providers

**What:** Each explorer calls `provider.subscribe()` independently
**Why bad:** Multiple updates per frame when several providers change simultaneously. Each explorer manages its own unsubscribe lifecycle. Diverges from the ViewManager/StateCoordinator pattern.
**Instead:** WorkbenchShell subscribes to StateCoordinator once, fans out `update()` calls to all explorers.

### Anti-Pattern 4: ViewManager.mount() Accepting Different Elements Over Time

**What:** Calling `viewManager.mount(newElement)` to re-root after initial construction
**Why bad:** ViewManager's container is set once in the constructor and used throughout. Adding a re-mount API introduces lifecycle complexity and state management for the container reference.
**Instead:** Set the correct container at construction time. WorkbenchShell creates its DOM first, then ViewManager is constructed with the final container.

### Anti-Pattern 5: Shared DnD Library Between Explorer and SuperGrid

**What:** Creating a shared DnD framework used by both ProjectionExplorer and SuperGrid
**Why bad:** The two DnD systems have different payloads, different drop targets, different validation rules. Abstraction adds complexity without value. SuperGrid DnD is battle-tested and should not be modified.
**Instead:** Independent implementations that share only naming conventions (`data-drag-payload`, `data-drop-zone`).

### Anti-Pattern 6: Explorer Calling update() on Itself After Provider Change

**What:** `onWellDrop() { pafv.setAxes(...); coordinator.scheduleUpdate(); this.update(); }`
**Why bad:** update() runs immediately with potentially stale state from other providers. Then coordinator fires and update() runs again. Double-render with inconsistent state on the first pass.
**Instead:** Let coordinator handle all update fan-out. The explorer's UI will be stale for ~16ms (one frame) -- imperceptible.

---

## 10. Scalability Considerations

| Concern | At Current Scale | At 100 Properties | At 1000 Cards |
|---------|-----------------|-------------------|---------------|
| PropertiesExplorer render | ~10 properties, trivial | D3 data join handles it; 100 div elements is fast | N/A (properties don't scale with cards) |
| ProjectionExplorer wells | 4 wells x ~5 chips | 4 wells x ~20 chips -- still fine | N/A |
| Coordinator fan-out | Shell + ViewManager = 2 subscribers | Same | Same (subscriber count doesn't scale with data) |
| Explorer update frequency | ~1-2 per user action | Same (rAF coalesced) | Same |
| CSS Grid impact | SuperGrid handles 10K+ with virtual scrolling | No impact -- new CSS is on separate elements | Virtual scrolling unchanged |

The Workbench UI is a constant-cost shell around the existing data pipeline. Explorer complexity is O(properties), not O(cards). The heaviest operation (SuperGrid rendering) is unchanged.

---

## Sources

- `src/main.ts` -- current composition root, provider wiring (lines 48-503)
- `src/views/ViewManager.ts` -- container ownership, innerHTML clearing, coordinator subscription (lines 122-641)
- `src/views/SuperGrid.ts` -- mount() creates own scroll container (lines 508-538), DnD payload singleton (line 106)
- `src/providers/StateCoordinator.ts` -- subscribe/scheduleUpdate pattern (lines 27-121)
- `src/ui/ViewTabBar.ts` -- parentElement insertion pattern (line 60)
- `src/audit/AuditOverlay.ts` -- container.appendChild mount pattern (line 49)
- `src/styles/supergrid.css` -- content-visibility, sticky header rules (lines 1-20)
- `docs/D3-UI-IMPLEMENTATION-SPEC-v2.md` -- authoritative DOM hierarchy, StateCoordinator contract, DnD separation, CSS scoping rules
- `.planning/PROJECT.md` -- architectural decisions, constraint documentation
