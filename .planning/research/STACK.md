# Stack Research: View + Editor Canvases

**Milestone:** v13.2 View + Editor Canvases
**Date:** 2026-04-21
**Confidence:** HIGH

## Summary

Zero new npm dependencies required. ViewCanvas and EditorCanvas are thin lifecycle wrappers over existing production components (ViewManager and NotebookExplorer). Every capability is already in the codebase. The ExplorerCanvas (v13.1) establishes the exact pattern to follow.

---

## Finding: No New Dependencies Required

After analyzing the full integration surface — SuperWidget, projection state machine, CanvasComponent interface, ExplorerCanvas production implementation, ViewManager config and switchTo() interface, NotebookExplorer config and lifecycle — the conclusion is unambiguous: ViewCanvas and EditorCanvas require zero new npm packages. Every capability needed is already present.

This is corroborated by the ExplorerCanvas precedent: it wraps DataExplorerPanel (a complex multi-section component with its own internal DOM lifecycle) using only the existing CanvasComponent interface. ViewCanvas and EditorCanvas follow the same pattern.

---

## What Already Exists (Do Not Re-research)

### The CanvasComponent Contract

Defined in `src/superwidget/projection.ts`. Three methods:

```typescript
interface CanvasComponent {
  mount(container: HTMLElement): void;
  destroy(): void;
  onProjectionChange?(proj: Projection): void;  // optional, called on tab switch
}
```

SuperWidget calls `canvasFactory(canvasId, binding)` from `registry.ts` to instantiate, then `canvas.mount(canvasEl)`. Teardown is `canvas.destroy()`. `onProjectionChange` is called on tab-only transitions. This is the complete integration surface.

### ViewManager (the component ViewCanvas wraps)

`src/views/ViewManager.ts` — requires `ViewManagerConfig`:

```typescript
interface ViewManagerConfig {
  container: HTMLElement;   // ViewManager owns this element's innerHTML
  coordinator: StateCoordinator;
  queryBuilder: QueryBuilder;
  bridge: WorkerBridgeLike;
  pafv: PAFVProviderLike;
  filter: FilterProviderLike;
  announcer?: Announcer;
  getDimension?: () => '1x' | '2x' | '5x';
}
```

Critical detail: ViewManager has no `mount()` method — the container is passed at construction time. ViewCanvas must create a child div in its own `mount(container)`, then instantiate `ViewManager` with that div as `config.container`.

`viewManager.getLastCards().length` gives the card count for the status slot after each view switch via `viewManager.onViewSwitch` callback. No additional Worker query needed.

### NotebookExplorer (the component EditorCanvas wraps)

`src/ui/NotebookExplorer.ts` — requires `NotebookExplorerConfig`:

```typescript
interface NotebookExplorerConfig {
  bridge: WorkerBridge;
  selection: SelectionProvider;
  filter: FilterProvider;
  alias: AliasProvider;
  schema?: SchemaProvider;
  mutations: MutationManager;
}
```

Has `mount(container)` and `destroy()`. Auto-subscribes to SelectionProvider on mount. EditorCanvas creates one child div in its `mount()`, passes it to `notebookExplorer.mount()`.

The active card title for the status slot requires a separate `selection.subscribe()` call in EditorCanvas — EditorCanvas owns the statusEl updates, NotebookExplorer owns the editor UI. These are separate subscriptions on the same provider.

### Canvas Registry

`src/superwidget/registry.ts` — `register(canvasId, entry)` replaces a stub with a real factory. The `defaultExplorerId` field on `CanvasRegistryEntry` is already scaffolded for Bound/Unbound sidecar mechanics.

---

## New Capabilities Needed (Patterns, Not Libraries)

### TypeScript Patterns

| Pattern | Purpose | Precedent |
|---------|---------|-----------|
| Thin wrapper class implementing CanvasComponent | ViewCanvas/EditorCanvas wrap ViewManager/NotebookExplorer | ExplorerCanvas wrapping DataExplorerPanel |
| Constructor-injected statusEl | Status slot updates without coupling to SuperWidget internals | ExplorerCanvas receives `commitProjection` callback at construction |
| Separate SelectionProvider subscription in EditorCanvas | Status slot card title independent of NotebookExplorer internals | SelectionProvider.subscribe() pattern already in NotebookExplorer |
| `viewManager.onViewSwitch` callback for status updates | Card count in status slot after each view switch | Already exists as `onViewSwitch: ((viewType: ViewType) => void) \| null` |

### CSS (no new dependencies)

The canvas wrappers need minimal CSS — the existing `src/styles/superwidget.css` (which defines the `--sw-*` token namespace) should accommodate any layout needs. ViewCanvas may need a thin flex wrapper to ensure ViewManager fills the canvas slot; EditorCanvas similarly. Neither needs design tokens beyond what exists.

---

## Recommended Stack

### Core Technologies (unchanged)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript (strict) | 5.9.3 | Implementation language | Locked — all existing code |
| Vitest | 4.0.18 | Unit/integration tests | `@vitest-environment jsdom` for DOM tests; existing test infra |
| Playwright | 1.58.2 | E2E WebKit smoke | Already in CI; new harness HTML for 3-canvas transition matrix |

### Supporting Libraries (Already Present, Transparent to Canvas Wrappers)

| Library | Used By | Canvas Wrapper Interaction |
|---------|---------|---------------------------|
| D3.js 7.9 | ViewManager, NotebookExplorer | None — transparent to wrapper |
| DOMPurify 3.3.2 | NotebookExplorer | None — transparent to wrapper |
| marked 17.0.4 | NotebookExplorer | None — transparent to wrapper |
| sql.js 1.14 | Worker/ViewManager | None — transparent to wrapper |

---

## Installation

```bash
# Nothing to install — zero new dependencies
```

---

## Integration Points

### ViewCanvas Wiring in main.ts

```typescript
register('view-1', {
  canvasType: 'View',
  defaultExplorerId: 'explorer-1',
  create: (binding) => new ViewCanvas({
    binding,
    coordinator,
    queryBuilder,
    bridge,
    pafv,
    filter,
    announcer,
    getDimension: () => visualExplorer.getDimension(),
    createView: (type) => makeView(type),
    commitProjection: (proj) => superWidget.commitProjection(proj),
    statusEl: superWidget.statusEl,
  }),
});
```

### EditorCanvas Wiring in main.ts

```typescript
register('editor-1', {
  canvasType: 'Editor',
  create: () => new EditorCanvas({
    bridge,
    selection,
    filter,
    alias,
    schema,
    mutations,
    statusEl: superWidget.statusEl,
  }),
});
```

### Bound/Unbound Mechanics

`defaultExplorerId: 'explorer-1'` on the view-1 registry entry is the existing scaffolding. The calling code in `main.ts` (not inside ViewCanvas) reads this to auto-switch SuperWidget when a Bound view becomes active. ViewCanvas itself only needs to know its `CanvasBinding` from the Projection to conditionally show/hide an explorer sidecar div.

---

## E2E Test Harness Pattern

Existing patterns: `e2e/fixtures/explorercanvas-harness.html` + `e2e/fixtures/superwidget-harness.html`.

For the 3-canvas transition matrix E2E, a new harness HTML (or extension of existing) is needed. The challenge is that ViewCanvas with a real ViewManager requires WorkerBridge (WASM). Recommendation:

Use a **mock bridge** that returns empty card arrays. The 3-canvas transition matrix test is about canvas mount/destroy lifecycle and status slot updates — not D3 rendering fidelity. D3 rendering is covered by existing view-specific Vitest tests and the production SuperGrid E2E spec.

A mock bridge for the harness can be a plain object implementing `WorkerBridgeLike` with stubbed `send()` returning empty arrays — the same approach used in `tests/superwidget/` Vitest tests via `vi.fn()`.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Wrap existing ViewManager directly | Create new view orchestrator | ViewManager has all 9 views, coordinator subscription, empty states, crossfade transitions, and 200+ tests. Rewrapping duplicates the entire view lifecycle. |
| Wrap existing NotebookExplorer directly | Build new card editor | NotebookExplorer has shadow-buffer undo safety, typed property inputs, D3 chart blocks, Markdown persistence, card creation state machine — all tested, production-validated. |
| Construct ViewManager once in mount() | Construct in onProjectionChange() | ViewManager is stateful (subscriptions, current view, timing). Constructing on every projection change would create subscription leaks. |
| Separate SelectionProvider subscription in EditorCanvas for status | Access NotebookExplorer private `_activeCardId` | Breaks encapsulation; `_activeCardId` is private and subject to change. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new npm package | Zero packages needed; all capabilities exist | Existing ViewManager, NotebookExplorer, CanvasComponent interface |
| Accessing NotebookExplorer private fields | Breaks encapsulation, creates fragile coupling | Separate SelectionProvider.subscribe() in EditorCanvas |
| Re-creating ViewManager in onProjectionChange | Creates subscription leaks | Construct once in mount(), switch views via viewManager.switchTo() |
| Modifying ViewManager or NotebookExplorer internals | These are stable, tested components | Thin wrapper pattern — additive only |
| Sharing statusEl DOM writes across canvas transitions | Each canvas type needs different status content | Clear and rebuild statusEl content on canvas mount |

---

## Sources

- Direct analysis: `src/superwidget/` (all 6 files) — HIGH confidence
- Direct analysis: `src/views/ViewManager.ts` (interface and config) — HIGH confidence
- Direct analysis: `src/ui/NotebookExplorer.ts` (interface and lifecycle) — HIGH confidence
- Direct analysis: `src/main.ts` lines 1528–1623 (wiring pattern) — HIGH confidence
- Direct analysis: `package.json` (exact dependency versions) — HIGH confidence
- Direct analysis: `tests/superwidget/explorer-canvas-integration.test.ts` (test pattern) — HIGH confidence
- Direct analysis: `e2e/superwidget-smoke.spec.ts` (E2E harness pattern) — HIGH confidence

---
*Stack research for: ViewCanvas + EditorCanvas (v13.2 View + Editor Canvases)*
*Researched: 2026-04-21*
