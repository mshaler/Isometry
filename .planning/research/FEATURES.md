# Feature Research

**Domain:** Canvas-based composite UI — ViewCanvas and EditorCanvas for SuperWidget substrate
**Researched:** 2026-04-21
**Confidence:** HIGH (based on direct source reads: ExplorerCanvas, SuperWidget, projection state machine, ViewManager, NotebookExplorer, registry, statusSlot, existing stubs, test files)

---

## What Already Exists (Do Not Rebuild)

These are shipped and locked. They define the seams this milestone must fit into.

| Existing Feature | Relevant Seam for v13.2 |
|-----------------|------------------------|
| SuperWidget four-slot CSS Grid (header, canvas, status, tabs) | ViewCanvas and EditorCanvas mount into the canvas slot via `mount(container)` |
| Projection state machine (`CanvasType`, `CanvasBinding`, `ZoneRole`, transition functions, `validateProjection`) | `onProjectionChange(proj)` is the signal for view-type switching and binding changes |
| `commitProjection` lifecycle: destroy-before-mount, tab-switch distinction | SuperWidget already differentiates new-canvas from tab-switch; ViewCanvas.onProjectionChange handles both |
| CanvasComponent interface (`mount`, `destroy`, optional `onProjectionChange`) | Both new canvases implement this — same contract as ExplorerCanvas |
| ExplorerCanvas production implementation (v13.1) | Pattern to follow: constructor injection, tab bar with event delegation, onProjectionChange driving active container |
| `statusSlot.ts` with `renderStatusSlot` / `updateStatusSlot` | ExplorerCanvas uses this for card/connection/import counts; ViewCanvas and EditorCanvas need their own status content |
| Canvas registry with `register()` / `getCanvasFactory()` / `registerAllStubs()` | Replace stub registrations for 'view-1' and 'editor-1' with real canvas factories |
| ViewManager with `switchTo()`, `onViewSwitch` callback, `getLastCards()`, `destroy()` | ViewCanvas wraps this; all its public API is available |
| NotebookExplorer with constructor injection, `mount()`, `destroy()`, SelectionProvider subscription | EditorCanvas wraps this; subscription to SelectionProvider is internal |
| SelectionProvider (Tier 3 ephemeral) | Shared instance across ViewCanvas and EditorCanvas enables implicit card-click → editor propagation |
| Bound/Unbound mechanics scaffolded in ViewCanvasStub | `[data-sidecar]` div exists in stub — real ViewCanvas must wire to actual explorer visibility |
| DockNav inline explorer embedding (v11.1): ProjectionExplorer auto-shown above SuperGrid | ViewCanvas must preserve this invariant when hosting the SuperGrid view |
| Playwright CI hard gate (5-job parallel: typecheck/lint/test/bench/e2e) | E2E spec for 3-canvas transition matrix must land as a hard gate |

---

## Table Stakes

Features that ViewCanvas and EditorCanvas must have. Missing any means the milestone is incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ViewCanvas implements CanvasComponent | SuperWidget's canvasFactory expects mount/destroy/onProjectionChange — same contract as ExplorerCanvas | LOW | No new patterns; follow ExplorerCanvas exactly |
| ViewManager mounted inside canvas slot | ViewCanvas wraps existing ViewManager; the container element passed to mount() is the ViewManager container | MEDIUM | ViewManagerConfig requires 6+ injected dependencies — all must be constructor-injected into ViewCanvas via a ViewCanvasConfig interface |
| View switching via onProjectionChange | When activeTabId encodes a view type (or ViewCanvas owns a separate view-type signal), onProjectionChange calls ViewManager.switchTo() | MEDIUM | Requires a convention: does activeTabId map 1:1 to ViewType strings ('list','grid','supergrid',etc.), or does ViewCanvas maintain its own currentViewType and use activeTabId only for sub-tabs? |
| destroy() tears down ViewManager cleanly | ViewCanvas.destroy() calls ViewManager.destroy(), which unsubscribes from coordinator — no listener leaks | LOW | ViewManager.destroy() is already correct |
| EditorCanvas implements CanvasComponent | Same interface contract | LOW | Follow ExplorerCanvas pattern |
| NotebookExplorer mounted inside canvas slot | EditorCanvas wraps NotebookExplorer; container element passed to mount() | MEDIUM | NotebookExplorerConfig requires bridge, selection, filter, alias, mutations — constructor-inject via EditorCanvasConfig |
| EditorCanvas.destroy() tears down NotebookExplorer | NotebookExplorer.destroy() unsubscribes selection, filter, mutation listeners | LOW | NotebookExplorer.destroy() is already correct |
| Status slot update from ViewCanvas | Current view name + card count (e.g., "SuperGrid · 342 cards") | LOW | Wire into ViewManager.onViewSwitch callback and getLastCards().length; call into statusEl directly (different content shape from statusSlot.ts) |
| Status slot update from EditorCanvas | Active card title (e.g., "My Note") | LOW | Subscribe to SelectionProvider; on card change, read name from a passed card-name getter or a bridge query |
| Registry stub replacement | register('view-1') and register('editor-1') replaced with real canvas factories; registerAllStubs() updated or deprecated | LOW | Identical pattern to how ExplorerCanvas replaced ExplorerCanvasStub in v13.1 |
| Bound/Unbound sidecar toggle for ViewCanvas | When canvasBinding is 'Bound', ProjectionExplorer (or the relevant explorer named by defaultExplorerId) becomes visible above the view | MEDIUM | The cleanest pattern: inject an `onSidecarToggle?: (show: boolean, explorerId: string) => void` callback into ViewCanvasConfig; ViewCanvas calls it on mount and on onProjectionChange when binding changes |

---

## Differentiators

Features beyond table stakes that deliver the full intended milestone experience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Explorer sidecar auto-show for SuperGrid only | ViewManager.onViewSwitch fires with 'supergrid' → show ProjectionExplorer; all other view types → hide. Preserves the v11.1 inline-embedding invariant inside SuperWidget | MEDIUM | onSidecarToggle callback driven by onViewSwitch; no new infrastructure needed |
| Card selection propagates implicitly from ViewCanvas to EditorCanvas | A card click in ViewCanvas updates SelectionProvider; NotebookExplorer already subscribes to SelectionProvider internally at mount() — if both canvases share the same SelectionProvider instance, propagation is automatic | LOW | Zero cross-canvas wiring needed if SelectionProvider is shared; the dependency graph already handles it |
| Full 3-canvas transition E2E tests (Explorer → View → Editor) with Playwright WebKit | Proves destroy-before-mount, slot isolation, and canvas-specific DOM presence across all three real implementations | HIGH | superwidget-smoke.spec.ts harness already exists and tests against stubs — replace stubs with real impls and update assertions |
| onProjectionChange tab-switch branch in ViewCanvas | When only activeTabId changes (not canvasId), ViewCanvas calls ViewManager.switchTo() without full canvas remount — SuperWidget already routes this correctly; ViewCanvas.onProjectionChange just needs to handle both code paths | MEDIUM | The distinction between "new canvas" and "tab switch" is already made by SuperWidget in commitProjection — ViewCanvas.onProjectionChange receives both cases via the same method but can distinguish them by checking if it has already mounted |

---

## Anti-Features

Features that must explicitly not be built for this milestone.

| Anti-Feature | Why Not | What to Do Instead |
|--------------|---------|-------------------|
| ViewCanvas constructing its own ViewManager dependencies | Would invert the dependency graph; ViewManager needs coordinator, bridge, queryBuilder, pafv, filter — top-level app concerns | Inject ViewManager (or ViewManagerConfig) into ViewCanvas at construction time via ViewCanvasConfig |
| EditorCanvas polling SelectionProvider on a timer | Violates subscription-first architecture; causes display drift | NotebookExplorer already subscribes to SelectionProvider at mount() — just mount it with a shared SelectionProvider instance |
| Canvas-level crossfade animations | SuperWidget's commitProjection already handles canvas-level transitions (destroy-before-mount); adding per-canvas animation fights the existing pattern | Trust SuperWidget's existing CSS transition; focus on correct lifecycle sequencing |
| ViewCanvas re-implementing view switching logic | Duplicates ViewManager.switchTo() and breaks single source of truth for view type | Use ViewManager.switchTo() as the only view-switch path |
| Routing NotebookExplorer's Write/Preview tabs through Projection.enabledTabIds | Notebook's tab state is internal to NotebookExplorer; Projection already has a tab mechanism but it would require round-tripping every write/preview toggle through SuperWidget | NotebookExplorer handles its own write/preview tab internally; EditorCanvas.onProjectionChange need not touch it |
| New CSS namespace tokens for ViewCanvas or EditorCanvas canvas content | The `--sw-*` namespace (SuperWidget substrate) is already established; canvas-specific content should use existing component namespaces | ViewCanvas renders ViewManager content (existing CSS); EditorCanvas renders NotebookExplorer content (existing notebook-explorer.css) |
| Storing Projection.activeTabId → ViewType mapping outside ViewCanvas | If the mapping lives in registry.ts or projection.ts, it creates a dependency between the pure state machine and the view layer | Keep the activeTabId → ViewType mapping inside ViewCanvas or in a ViewCanvasConfig property |

---

## Feature Dependencies

```
ViewCanvas
    └──constructor-injects──> ViewManagerConfig
                                  └──requires──> StateCoordinator, QueryBuilder, WorkerBridge, PAFVProvider, FilterProvider
    └──constructor-injects──> onSidecarToggle callback (optional)
    └──uses──> ViewManager.switchTo() (on view switch)
    └──uses──> ViewManager.onViewSwitch (for status slot + sidecar)
    └──uses──> ViewManager.getLastCards() (for card count)
    └──uses──> ViewManager.destroy() (in own destroy())

EditorCanvas
    └──constructor-injects──> NotebookExplorerConfig
                                  └──requires──> WorkerBridge, SelectionProvider, FilterProvider, AliasProvider, MutationManager
    └──uses──> NotebookExplorer.mount() / .destroy()

SelectionProvider (shared app-level instance)
    ──flows into──> ViewCanvas (card click updates selection)
    ──flows into──> EditorCanvas (NotebookExplorer subscribes internally)

registry.ts
    ──provides 'view-1'──> ViewCanvas factory (replaces ViewCanvasStub)
    ──provides 'editor-1'──> EditorCanvas factory (replaces EditorCanvasStub)
    ──still provides 'explorer-1'──> ExplorerCanvas (unchanged from v13.1)
```

### Dependency Notes

- **ViewCanvas requires ViewManager:** Because ViewManagerConfig has 6 required dependencies, inject them at construction time, not at mount() time. This mirrors how ExplorerCanvas receives DataExplorerPanelConfig at construction.
- **Bound/Unbound sidecar:** The cleanest design is a callback (`onSidecarToggle`) passed into ViewCanvasConfig. ViewCanvas calls it on mount (with current binding) and again on onProjectionChange when binding changes. The caller (app root or harness) wires it to actual explorer show/hide logic. This avoids ViewCanvas depending on explorer code directly.
- **SelectionProvider shared instance:** If both ViewCanvas and EditorCanvas receive the same SelectionProvider instance (from app root), card selection in the view automatically propagates to the NotebookExplorer with zero cross-canvas wiring. This is the correct architecture — do not add a separate selection callback channel.
- **Status slot shape:** ExplorerCanvas uses statusSlot.ts (`renderStatusSlot` / `updateStatusSlot`) for card count + connection count + import time. ViewCanvas and EditorCanvas need different content shapes (view name + count; card title). Either extend statusSlot.ts with additional update functions, or write directly to statusEl using the same `[data-stat]` attribute pattern without the shared helper.

---

## MVP Definition

### Launch With (v13.2 — this milestone)

- [ ] ViewCanvas class implementing CanvasComponent — mounts ViewManager, implements onProjectionChange for view switching and binding changes, implements destroy
- [ ] EditorCanvas class implementing CanvasComponent — mounts NotebookExplorer, implements destroy, updates status slot with card title
- [ ] registry.ts updated: register('view-1') → ViewCanvas factory, register('editor-1') → EditorCanvas factory; ViewCanvasStub and EditorCanvasStub retired
- [ ] Status slot: ViewCanvas shows view name + card count; EditorCanvas shows active card title
- [ ] Bound/Unbound sidecar toggle for ViewCanvas — calls onSidecarToggle callback on binding change
- [ ] 3-canvas transition matrix E2E spec (Playwright WebKit): Explorer → View → Editor and reverse paths, as a CI hard gate replacing the stub-based smoke test
- [ ] Cross-seam Vitest integration tests: ViewCanvas mount/destroy/onProjectionChange lifecycle, EditorCanvas mount/destroy lifecycle, registry wiring

### Add After Validation (v13.x)

- [ ] Per-view icon in SuperWidget tabs slot reflecting current ViewType — trigger: user UAT feedback that view tabs feel generic
- [ ] Cmd+E keyboard shortcut to move focus from ViewCanvas to EditorCanvas — trigger: power user request

### Future Consideration (v2+)

- [ ] Multiple simultaneous canvases in secondary/tertiary zones showing different view types — requires Zone orchestration above SuperWidget
- [ ] EditorCanvas multi-card batch edit via lasso selection in ViewCanvas — requires SelectionProvider.getSelectedIds() multi-selection API

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| ViewCanvas wrapping ViewManager | HIGH | LOW | P1 |
| EditorCanvas wrapping NotebookExplorer | HIGH | LOW | P1 |
| Registry stub replacement | HIGH | LOW | P1 |
| Status slot — view name + card count | MEDIUM | LOW | P1 |
| Status slot — card title in EditorCanvas | MEDIUM | LOW | P1 |
| Bound/Unbound sidecar toggle | HIGH | MEDIUM | P1 |
| 3-canvas E2E transition matrix | HIGH | MEDIUM | P1 |
| Cross-seam Vitest integration tests | HIGH | MEDIUM | P1 |
| Per-view icon in tabs slot | LOW | LOW | P2 |
| Cmd+E focus-jump shortcut | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for milestone completion
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Sources

All findings are HIGH confidence — derived entirely from direct source reads:

- `src/superwidget/SuperWidget.ts` — commitProjection lifecycle, slot structure, canvasFactory contract
- `src/superwidget/ExplorerCanvas.ts` — production CanvasComponent pattern to follow
- `src/superwidget/registry.ts` — CanvasRegistryEntry interface, stub registrations to replace
- `src/superwidget/projection.ts` — CanvasComponent interface, Projection type, transition functions
- `src/superwidget/statusSlot.ts` — status slot update API and content shape
- `src/superwidget/ViewCanvasStub.ts` — stub to replace; sidecar div pattern
- `src/superwidget/EditorCanvasStub.ts` — stub to replace
- `src/views/ViewManager.ts` — ViewManagerConfig, switchTo(), onViewSwitch, getLastCards(), destroy()
- `src/ui/NotebookExplorer.ts` — NotebookExplorerConfig, SelectionProvider subscription at mount(), destroy()
- `tests/superwidget/canvasWiring.test.ts` — existing wiring tests (stubs)
- `tests/superwidget/explorer-canvas-integration.test.ts` — ExplorerCanvas integration test pattern to replicate
- `e2e/superwidget-smoke.spec.ts` — existing 3-canvas transition matrix harness (stub-based; to be upgraded)
- `.planning/PROJECT.md` — v13.2 milestone goal, v13.1 ExplorerCanvas precedent, v11.1 inline-embedding context, locked constraints

---
*Feature research for: ViewCanvas and EditorCanvas — SuperWidget canvas-based composite UI (v13.2)*
*Researched: 2026-04-21*
