# Project Research Summary

**Project:** Isometry v13.2 — View + Editor Canvases
**Domain:** Canvas-based composite UI integration into SuperWidget substrate
**Researched:** 2026-04-21
**Confidence:** HIGH

## Executive Summary

v13.2 adds two production canvas implementations — ViewCanvas and EditorCanvas — to the SuperWidget substrate established in v13.1. Both canvases follow the same thin-wrapper pattern proven by ExplorerCanvas: a CanvasComponent class that owns one wrapped production component (ViewManager for ViewCanvas, NotebookExplorer for EditorCanvas), constructor-injects all external dependencies, and communicates with SuperWidget exclusively through the `mount / destroy / onProjectionChange` interface. Zero new npm dependencies are required. Every capability needed already exists in the codebase.

The recommended approach is additive and pattern-faithful. ViewCanvas and EditorCanvas are new files in `src/superwidget/` — the ExplorerCanvas implementation is the template. The registry stubs for 'view-1' and 'editor-1' are replaced with real factory registrations in `main.ts`. The critical constraint (CANV-06) that `SuperWidget.ts` must have zero imports to concrete canvas implementations is preserved by routing all concrete references through registry `create()` closures. The most technically complex element is the Bound/Unbound sidecar mechanic for ViewCanvas, which must read `defaultExplorerId` from the registry entry rather than hardcoding ProjectionExplorer.

The top risks are resource leak patterns on canvas destroy: ViewManager's `container.innerHTML = ''` in destroy() will corrupt the shared canvas slot unless ViewCanvas uses an inner wrapper div; NotebookExplorer's four subscription handles and its 500ms debounced auto-save timer must all be fully cleaned up by EditorCanvas.destroy(). All eight identified pitfalls have concrete, low-effort preventions. TDD is the required execution model — write red tests for each pitfall before implementing the corresponding behavior.

## Key Findings

### Recommended Stack

No new dependencies. The existing TypeScript 5.9, Vitest 4.0, and Playwright 1.58.2 stack covers all implementation and testing needs. ViewCanvas and EditorCanvas are pure structural files — thin wrappers that delegate all rendering, data fetching, and subscription management to ViewManager and NotebookExplorer respectively. Supporting libraries (D3, DOMPurify, marked, sql.js) are transparent to the canvas wrappers and require no changes.

**Core technologies:**
- TypeScript 5.9 (strict): implementation language — locked, all existing code
- Vitest 4.0: unit and integration tests — `@vitest-environment jsdom` for DOM lifecycle tests
- Playwright 1.58.2: 3-canvas E2E transition matrix — existing harness extended, WebKit CI gate

### Expected Features

**Must have (table stakes):**
- ViewCanvas implementing CanvasComponent — mounts ViewManager, implements onProjectionChange for view-type switching and binding changes, implements destroy
- EditorCanvas implementing CanvasComponent — mounts NotebookExplorer, implements destroy, updates status slot with active card title
- Registry stub replacement — register('view-1') and register('editor-1') with real factories; ViewCanvasStub and EditorCanvasStub retired from production path
- Status slot: ViewCanvas shows view name + card count ("SuperGrid · 342 cards"); EditorCanvas shows active card title ("Meeting Notes · Editing")
- Bound/Unbound sidecar toggle for ViewCanvas — calls onBindingChange callback driven by registry entry's defaultExplorerId
- 3-canvas transition matrix E2E spec (Playwright WebKit) as CI hard gate replacing stub-based smoke test
- Cross-seam Vitest integration tests: ViewCanvas and EditorCanvas lifecycle

**Should have (differentiator):**
- Explorer sidecar auto-show for SuperGrid only — onViewSwitch from ViewManager drives sidecar visibility per view type, preserving v11.1 inline-embedding invariant
- Card selection propagation from ViewCanvas to EditorCanvas via shared SelectionProvider — zero cross-canvas wiring needed if the same instance is passed to both

**Defer (v2+):**
- Per-view icon in SuperWidget tabs slot reflecting current ViewType
- Cmd+E keyboard shortcut to move focus from ViewCanvas to EditorCanvas
- Multiple simultaneous canvases in secondary/tertiary zones
- EditorCanvas multi-card batch edit via lasso selection

### Architecture Approach

The architecture is a layered wrapper pattern: SuperWidget (4-slot CSS Grid host) calls the canvas registry to instantiate a CanvasComponent; the CanvasComponent is a thin coordinator that owns one wrapped production component; all rendering, subscriptions, and data access live inside the wrapped component. CANV-06 enforces that SuperWidget.ts has zero imports to concrete canvas implementations — all concrete references exist only in registry.ts (the `create()` closure) and main.ts (the registration call). The projection state machine (CanvasType, CanvasBinding, transition functions) is frozen; canvas implementations only consume it, never modify it.

**Major components:**
1. ViewCanvas (NEW) — CanvasComponent wrapper around ViewManager; drives view-type switching via onProjectionChange; manages Bound/Unbound sidecar callback; writes view name + card count to statusEl
2. EditorCanvas (NEW) — CanvasComponent wrapper around NotebookExplorer; adds one minimal SelectionProvider subscriber for status slot only; delegates all card editing to NotebookExplorer
3. Canvas Registry (MODIFIED) — replace stub entries for 'view-1' and 'editor-1' with production factory closures assembled in main.ts

### Critical Pitfalls

1. **ViewManager container ownership collision** — ViewManager.destroy() calls `container.innerHTML = ''`. Pass a wrapper div as ViewManager's container, never `_canvasEl` directly. Write the wrapper-isolation test as the very first red step.

2. **Four NotebookExplorer subscriptions not cleaned up on destroy** — NE maintains `_unsubscribeSelection`, `_unsubscribeMutation`, `_unsubscribeFilter`, and a ChartRenderer filter subscription. Write a subscriber-count test (before/after mount/destroy) that must go red before any destroy() cleanup is implemented.

3. **NotebookExplorer 500ms debounced auto-save fires after EditorCanvas destroy** — clearTimeout must be called in NE.destroy(). Write a 600ms post-destroy bridge.send assertion before implementing destroy().

4. **onProjectionChange not implemented for tab-switch path** — SuperWidget calls onProjectionChange on both full canvas replacement AND tab-switch. Both canvases must implement onProjectionChange; the interface marks it optional but skipping it means tab switching silently fails.

5. **Sidecar binding semantics misread** — Read `defaultExplorerId` from the registry entry; do not assume 'Bound' always maps to ProjectionExplorer. Write three parameterized sidecar tests before implementing the code path.

6. **ViewManager switchTo() called with wrong ViewType** — Define a `TAB_ID_TO_VIEW_TYPE` map in ViewCanvas covering all 9 view types; fail fast with console.error on unknown tab IDs.

7. **Coordinator subscription leak** — ViewCanvas.mount() must be synchronous and must not subscribe to StateCoordinator directly; let ViewManager own the coordinator subscription entirely.

8. **Force simulation Worker timer outliving NetworkView** — Verify NetworkView.destroy() sends `simulation:stop` and removes its notification listener; include NetworkView in the 9-view full-cycle integration test.

## Implications for Roadmap

### Phase 1: ViewCanvas Production Implementation
**Rationale:** Higher complexity (6-dependency ViewManagerConfig, 9-view type mapping, Bound/Unbound sidecar mechanic) and no dependency on EditorCanvas. Tackle while ExplorerCanvas pattern is fresh. Pitfalls 1, 5, 6, 7, 8 are ViewCanvas-specific.
**Delivers:** `src/superwidget/ViewCanvas.ts`, `ViewCanvas.test.ts`, updated registry.ts and main.ts for 'view-1', Bound/Unbound sidecar callback wired, status slot showing view name + card count
**Addresses:** All table-stakes ViewCanvas features
**Avoids:** Container ownership collision, coordinator leak, wrong ViewType mapping, sidecar hardcoding, onProjectionChange tab-switch miss

### Phase 2: EditorCanvas Production Implementation
**Rationale:** Simpler than ViewCanvas but has its own destroy-safety pitfalls (2, 3). Builds on the wrapper pattern proven in Phase 1.
**Delivers:** `src/superwidget/EditorCanvas.ts`, `EditorCanvas.test.ts`, updated registry.ts and main.ts for 'editor-1', status slot showing active card title
**Addresses:** All table-stakes EditorCanvas features
**Avoids:** Four subscription leaks, debounced auto-save after destroy, onProjectionChange tab-switch miss

### Phase 3: 3-Canvas Transition Matrix E2E + CI Gate
**Rationale:** Depends on both canvases being production-complete. Replaces the stub-based smoke test and proves all 9 two-way canvas transitions maintain a single child in `_canvasEl`.
**Delivers:** `viewcanvas-harness.html`, `editorcanvas-harness.html`, extended `superwidget-smoke.spec.ts`, Playwright WebKit CI hard gate

### Phase Ordering Rationale

- ViewCanvas before EditorCanvas: higher complexity, same pattern; solving ViewCanvas first means EditorCanvas benefits from a refined pattern and all tooling is already working.
- E2E gate last: cannot be written until both canvases are production-complete; stub-based E2E remains in CI until then.
- All pitfall-prevention tests are written red before the corresponding implementation — TDD is non-negotiable.
- CANV-06 must be verified at each phase boundary.

### Research Flags

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1 (ViewCanvas):** ExplorerCanvas is a direct, production-verified template. ViewManagerConfig interface is fully known.
- **Phase 2 (EditorCanvas):** NotebookExplorerConfig is fully known. Wrapper pattern identical to Phase 1.
- **Phase 3 (E2E):** Existing harness pattern and mock bridge approach are established.

No phases require additional research — all findings were resolved from direct codebase analysis.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct analysis of package.json, all 6 superwidget files, ViewManager.ts, NotebookExplorer.ts — no external sources needed |
| Features | HIGH | All seams confirmed from live source; ExplorerCanvas is direct precedent; stub files define exact replacement surface |
| Architecture | HIGH | CANV-06 contract confirmed from SuperWidget.ts; data flow traced end-to-end in main.ts |
| Pitfalls | HIGH | All 8 pitfalls derived from direct source analysis (ViewManager line 398, NE subscription fields, ExplorerCanvas test patterns) |

**Overall confidence:** HIGH

### Gaps to Address

- **TAB_ID_TO_VIEW_TYPE naming convention:** The exact tab IDs used in production DockNav registrations were not confirmed. Verify in main.ts during ViewCanvas implementation — the mapping must cover all 9 view types exhaustively.
- **onAfterRender vs onViewSwitch for card count:** Research recommends adding `onAfterRender?: (cardCount: number) => void` to ViewManagerConfig. Alternatively, `viewManager.getLastCards().length` inside the existing `onViewSwitch` callback achieves the same result without a ViewManagerConfig change. Choose at implementation time based on which avoids modifying ViewManager.
- **ChartRenderer subscription completeness:** Verify the current NotebookExplorer.destroy() covers the ChartRenderer filter subscription before writing the subscription-count test.

## Sources

### Primary (HIGH confidence)
- `src/superwidget/` (all 6 files) — CanvasComponent interface, SuperWidget lifecycle, ExplorerCanvas pattern, registry, statusSlot, stubs
- `src/views/ViewManager.ts` — ViewManagerConfig, switchTo(), onViewSwitch, getLastCards(), destroy() (container.innerHTML = '' on line 398)
- `src/ui/NotebookExplorer.ts` — NotebookExplorerConfig, 4 subscription handles, debounced auto-save, mount/destroy lifecycle
- `src/main.ts` (lines 1528–1623) — provider wiring, registration pattern, DockNav callbacks
- `tests/superwidget/explorer-canvas-integration.test.ts` — integration test pattern to replicate
- `e2e/superwidget-smoke.spec.ts` — E2E harness pattern
- `.planning/PROJECT.md` — v13.2 milestone goal, CANV-06 contract, v11.1 inline-embedding invariant

### Secondary (MEDIUM confidence)
- `tests/superwidget/integration.test.ts` — INTG-01..INTG-06 shapes, sidecar data-attribute pattern
- `tests/superwidget/canvasWiring.test.ts` — existing stub-based wiring tests

---
*Research completed: 2026-04-21*
*Ready for roadmap: yes*
