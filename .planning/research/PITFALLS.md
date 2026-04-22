# Pitfalls Research

**Domain:** Tabbed shell replacement for a stateful data projection tool (v13.3)
**Researched:** 2026-04-21
**Confidence:** HIGH — analysis grounded in the live codebase (SuperWidget.ts, ViewCanvas.ts, EditorCanvas.ts, projection.ts, WorkbenchShell.ts, StateManager.ts)

---

## Critical Pitfalls

### Pitfall 1: Tab Management Code Breaks CANV-06

**What goes wrong:**
Tab management requires knowing which canvas is in each tab. The temptation is to import ViewCanvas or EditorCanvas directly into the tab bar logic to read their state (current view type, card count, editor dirty flag). This immediately violates CANV-06 — "SuperWidget.ts references only CanvasComponent interface — zero references to concrete stub classes." The invariant is enforced by a `readFileSync` assertion in the Playwright CI gate (INTG-03). Any concrete import into SuperWidget.ts, or into a file that SuperWidget.ts imports, breaks the gate.

**Why it happens:**
Tab status badges ("9 cards", "editing: Card Title") seem like they belong on the tab element, and the tab element is owned by SuperWidget. The natural reach is to ask the canvas directly. The correct pattern — canvas signals up via callback, tab bar reflects that signal — requires an indirection layer that isn't obvious when adding the first tab.

**How to avoid:**
Tab metadata (display name, badge text, dirty flag) must flow upward via callbacks registered at canvas construction time, never via downward canvas inspection. The CanvasComponent interface should gain an optional `onTabMetadataChange?(meta: TabMeta): void` callback slot — or the factory layer in registry.ts wraps the canvas and adds the signaling. SuperWidget.ts holds the tab state as plain data; it never interrogates the canvas for display state.

**Warning signs:**
- Any `import { ViewCanvas }` or `import { EditorCanvas }` in `src/superwidget/SuperWidget.ts` or files it imports
- Tab badge text being computed inside SuperWidget.commitProjection() via instanceof checks
- CI gate `readFileSync` assertion failing in INTG-03

**Phase to address:**
Tab management UX phase (first phase of v13.3). Gate must be verified before merging any tab management code.

---

### Pitfall 2: Concurrent Canvas Instances From Rapid Tab Switching

**What goes wrong:**
The current `commitProjection` flow is: destroy prior canvas → create new canvas → mount. This is safe for single-tab use. With tab management, a user can switch tabs faster than a canvas can complete its async initialization (ViewManager's `switchTo` returns a Promise; NotebookExplorer has debounced auto-save). If a second tab switch fires before the first canvas's async setup finishes, two canvases may both hold references to the same DOM container, the same StateCoordinator subscription, or the same Worker correlation IDs.

**Why it happens:**
`commitProjection` is synchronous. Canvas `mount()` is synchronous. But ViewManager.switchTo() is async — it fires a Worker query and updates the DOM in the callback. If the canvas is destroyed before the query resolves, the callback fires on a null container. EditorCanvas has the same pattern: the `card:get` bridge call in `_updateStatus` captures `this._statusEl` at fire time but checks it after the await. A destroy between fire and resolution will hit the null guard, but stale Worker correlation IDs remain in flight and will time out rather than cancel.

**How to avoid:**
Each canvas should have an internal `_destroyed` flag checked at every async continuation boundary. ViewCanvas's onProjectionChange already calls `void this._viewManager!.switchTo(...)` — add a guard: `if (this._viewManager === null) return;` before the async resolve. EditorCanvas's `_updateStatus` async bridge call already checks `if (!this._statusEl) return` after the await — this pattern must be upheld in all new status slots. For tab switching specifically: enforce a minimum tab dwell time (100–200ms debounce on `commitProjection`) so rapid key-cycling doesn't queue 5 simultaneous canvas create/destroy cycles.

**Warning signs:**
- `[WorkerBridge] request timed out` errors appearing in console during rapid tab switching
- `Cannot set properties of null` in ViewCanvas or EditorCanvas after view switch
- The existing INTG-04 rapid-switching stress test (3 transitions in <500ms) passing but 5+ transitions failing

**Phase to address:**
Tab management UX phase. Add a tab-switch debounce at the projection commit layer, and add a `_destroyed` boolean to both ViewCanvas and EditorCanvas as a prerequisite to wiring tab switching.

---

### Pitfall 3: WorkbenchShell Teardown Race Conditions

**What goes wrong:**
WorkbenchShell owns: CommandBar (with its StateCoordinator subscriptions), DockNav, PanelRegistry (which holds references to all 8 explorers), the top/bottom slot DOM elements, and the view content element where ViewManager is mounted. When SuperWidget replaces WorkbenchShell as the top-level container, both may exist in the DOM simultaneously during the transition. If WorkbenchShell.destroy() is called while a Provider subscription callback is in flight (e.g., StateCoordinator's 16ms batch fires at the wrong moment), the callback will write to a destroyed DOM element.

**Why it happens:**
The existing pattern for replacing the shell is to `destroy()` the old shell and `mount()` the new one. But StateCoordinator uses a `setTimeout(16ms)` for cross-provider batching. If WorkbenchShell.destroy() runs during that 16ms window, the timer fires afterward and the subscriber (now pointing at a removed DOM node) executes. CommandBar.destroy() calls `_commandBar.destroy()` which cancels its own listeners, but doesn't cancel the StateCoordinator batch timers.

**How to avoid:**
The replacement sequence must be: (1) pause/drain StateCoordinator — call `StateCoordinator.destroy()` before touching the DOM, (2) destroy WorkbenchShell, (3) mount SuperWidget, (4) re-wire StateCoordinator to the new canvas. Alternatively, if StateCoordinator is not replaced but reused, call `unsubscribeAll()` before destroying the shell. The transition should be tested with a seam test that verifies no DOM write happens after WorkbenchShell.destroy() returns.

**Warning signs:**
- `Cannot read properties of null (reading 'dataset')` errors in test output after shell switch
- StateCoordinator subscriptions firing after the WorkbenchShell DOM element has been removed (detectable via `document.contains(el)` check in subscriber callbacks)
- WorkbenchShell.destroy() not being the last call before SuperWidget.mount()

**Phase to address:**
Shell replacement phase (first phase of v13.3). Write the seam test for the WorkbenchShell → SuperWidget handoff before any integration code.

---

### Pitfall 4: Explorer Sidecar Show/Hide Triggering Unnecessary Worker Re-queries

**What goes wrong:**
The sidecar show/hide for bound views (e.g., ProjectionExplorer auto-appearing when SuperGrid is active) currently works via `onSidecarChange` callback from ViewCanvas. When the explorer transitions in or out (CSS animation), the container resize triggers layout recalculation. If the explorer container resize event is wired to the StateCoordinator (even indirectly — e.g., via ResizeObserver on the view content area), it triggers a `supergrid:query` Worker re-query with identical parameters, burning ~25ms per occurrence (per Phase 74 baselines).

**Why it happens:**
SuperGrid uses `SuperPositionProvider` for zoom state and reads container dimensions to calculate the visible cell range. A ResizeObserver is a natural fit for container dimension changes. But the sidecar animation is a CSS transition that fires multiple intermediate resize events over 200–300ms. Without debouncing, each intermediate resize dispatches a Worker query.

**How to avoid:**
Two safeguards: (1) ResizeObserver callbacks on the SuperGrid container must debounce at >= the sidecar transition duration (currently ~200ms based on DockNav animation patterns). (2) The `onSidecarChange` signal from ViewCanvas should set a flag that suppresses ResizeObserver-driven re-queries for the transition duration. The sidecar show/hide must not call any Provider `setState()` method — it must be DOM-only (CSS class toggle).

**Warning signs:**
- PerfTrace logs showing multiple `supergrid:query` Worker messages in rapid succession when toggling a bound explorer
- StateCoordinator `_schedule()` calls during explorer CSS transition (detectable by adding a PerfTrace hook to StateCoordinator._schedule)
- Explorer toggle latency exceeding 50ms in the UI

**Phase to address:**
Explorer sidecar polish phase. Include a performance regression test: toggle the sidecar 3x and assert fewer than 2 Worker queries fire per toggle.

---

### Pitfall 5: Status Slot DOM Ownership Conflict Between Canvas Types

**What goes wrong:**
The status slot element (`[data-slot="status"]`) is a single shared DOM element. ViewCanvas writes `.sw-view-status-bar` to it. EditorCanvas writes `.sw-editor-status-bar`. statusSlot.ts writes `.sw-status-bar`. When a canvas is destroyed and replaced, the old status bar DOM is left inside the slot unless explicitly removed. The new canvas's idempotent guard (`if (statusEl.querySelector('.sw-view-status-bar')) return`) will find the old bar and skip setup — which is correct only if it's the same canvas type. A ViewCanvas → EditorCanvas transition will find the old `.sw-view-status-bar`, skip EditorCanvas's own setup, and display stale view data under the editor.

**Why it happens:**
Each canvas does an idempotent guard on its own class name but does not remove other canvas types' DOM. The `commitProjection` destroy path calls `canvas.destroy()` which nulls `_statusEl` but does not clear the status slot DOM.

**How to avoid:**
Status slot must be fully cleared before a new canvas type mounts. The cleanest fix: SuperWidget.commitProjection() empties the status slot DOM (`statusEl.textContent = ''`) whenever the canvas type changes (i.e., when `prev.canvasType !== proj.canvasType`). Canvas-specific setup then runs fresh on each type transition. This is already guarded by the `prev.canvasType !== proj.canvasType` check in commitProjection — add `statusEl.textContent = ''` there.

**Warning signs:**
- Status bar showing "List · 42 cards" while EditorCanvas is mounted
- EditorCanvas status showing stale card count from prior ViewCanvas session
- Test: transition Explorer→View→Editor and assert `.sw-view-status-bar` is absent while editor is active

**Phase to address:**
Rich status slot phase, or the tab management phase (whichever introduces multi-canvas type switching).

---

### Pitfall 6: Tab Persistence Desync After Dataset Switch or CloudKit Merge

**What goes wrong:**
Tab state (which tabs exist, which is active, tab ordering, per-tab Projection) will be persisted to the `ui_state` table via StateManager. The `ui_state` table is synced via CloudKit (every checkpoint write includes all ui_state rows). When a dataset is switched (`StateManager.setActiveDatasetId`), StateManager restores the persisted tab state for the new dataset. But if the user has CloudKit sync enabled and a second device was active on a different dataset, the merge may bring in a `tabs:active` key from the other device's session. The restored tab Projection may reference a `canvasId` that no longer exists in the registry, or an `activeTabId` (ViewType) that was valid when persisted but is now behind a FeatureGate the current tier doesn't unlock.

**Why it happens:**
Projection validation (`validateProjection`) guards structural correctness but not registry membership. A canvasId not in the registry causes `canvasFactory` to return `undefined`, which currently logs a warning and stores the Projection without a canvas. Tab state from a different device or tier can survive a merge intact but be unrenderable.

**How to avoid:**
Tab persistence must go through a migration layer analogous to `StateManager._migrateState()`. On restore: (1) validate each Projection with `validateProjection`, (2) check `getRegistryEntry(proj.canvasId)` — unknown canvasIds fall back to a default Projection, (3) check FeatureGate for the canvasType — downgraded tabs collapse to Explorer canvas. Document this in the StateManager restore path, not in SuperWidget itself. Add a test: persist a Projection with `canvasId: 'nonexistent-canvas'`, simulate CloudKit restore, assert the shell shows a graceful fallback rather than a blank canvas.

**Warning signs:**
- Blank canvas area with no status content after a reload or dataset switch
- `[SuperWidget] canvasFactory returned undefined` warnings in the console after CloudKit sync
- Restored tab active tab ID not matching any ViewType in VIEW_DISPLAY_NAMES

**Phase to address:**
Tab persistence phase. The migration layer must be implemented in the same phase as initial persistence — retrofitting it later is a rewrite risk.

---

### Pitfall 7: Projection State Machine Not Designed for Multi-Tab

**What goes wrong:**
The current `Projection` type encodes a single view's state: `canvasType`, `canvasBinding`, `canvasId`, `activeTabId`, `enabledTabIds`. A tab bar with multiple tabs requires persisting N Projections (one per tab slot) plus the index of the active tab. Extending Projection directly (e.g., adding `tabs: Projection[]`) creates a recursive type that breaks reference equality bail-out logic and makes `validateProjection` significantly more complex. Alternatively, encoding all tab state into a single flat Projection (e.g., `enabledTabIds` as the tab list) reuses `activeTabId` for tab selection — but then `switchTab` semantics collide with ViewCanvas's use of `activeTabId` to encode the current ViewType.

**Why it happens:**
`enabledTabIds` and `activeTabId` were designed to encode which views are visible within a single canvas (e.g., which of the 9 D3 views a ViewCanvas has enabled). Tab management at the shell level is a different dimension of state. Using the same fields for both purposes creates ambiguity: does `activeTabId: 'supergrid'` mean "the SuperGrid view tab is active inside this ViewCanvas" or "the canvas in tab slot named 'supergrid' is active"?

**How to avoid:**
Multi-tab state must live at a layer above the Projection type. Introduce a `TabSlot` type: `{ tabId: string; label: string; projection: Projection }`. The shell manages `TabSlot[]` and the index of the active slot. The active `TabSlot.projection` is what gets passed to `SuperWidget.commitProjection()`. This preserves the existing Projection semantics (activeTabId = ViewType within a ViewCanvas) without collision. The `enabledTabIds` field retains its meaning as the set of ViewType tabs enabled within a ViewCanvas. Tab management state is never encoded inside Projection.

**Warning signs:**
- `activeTabId` values appearing in both tab bar rendering logic and ViewCanvas.onProjectionChange
- `enabledTabIds` being used to enumerate the tab bar's visible tabs instead of the canvas's enabled views
- `validateProjection` growing conditional logic based on whether the projection is "top-level tab state" vs "canvas-internal state"

**Phase to address:**
Tab management UX phase, before any tab state is persisted. The type design is load-bearing — getting it wrong causes a rewrite.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Persist tab state as a flat JSON blob in a single `ui_state` row | Fast to implement | Migration is a full reparse; adding a field requires versioning the entire blob | Only for initial prototype — migrate to per-field keys before CloudKit sync is enabled for tabs |
| Reuse WorkbenchShell's `_viewContentEl` as the SuperWidget canvas slot during transition | Avoids parallel DOM tree | WorkbenchShell destroy pulls the canvas slot out from under SuperWidget | Never — the two shells must have independent DOM trees |
| Trigger explorer show/hide from StateCoordinator subscription | Reuses existing notification pathway | Fires on every Provider state change, not just view switches — O(N) resize events per filter change | Never — sidecar show/hide must be driven by the ViewCanvas onSidecarChange callback only |
| Skip status slot cleanup between canvas type transitions | Simpler destroy path | Stale status DOM from prior canvas type remains; next canvas's idempotent guard skips initialization | Never — clear the slot on canvas type change |
| Write tab metadata directly from within commitProjection | Avoids callback indirection | Pulls concrete canvas knowledge into SuperWidget, breaking CANV-06 | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| StateManager tab persistence | Registering tab state under a non-scoped key so it survives dataset switch | Use `sm.registerScopedProvider('tabs', ...)` so tab layout is per-dataset |
| CloudKit sync + tab state | Syncing tab state as part of the base `ui_state` table — devices with different tier subscriptions restore incompatible canvasIds | Filter tab Projections through FeatureGate on restore; downgrade unknown canvasTypes to Explorer |
| ViewCanvas status slot vs statusSlot.ts | statusSlot.ts creates `.sw-status-bar`; ViewCanvas creates `.sw-view-status-bar` — two different schemas, same container | ViewCanvas owns its status DOM schema; statusSlot.ts is for ExplorerCanvas only. Do not mix the two schemas in the same slot element |
| EditorCanvas card:get bridge call during rapid tab switching | The async bridge call outlives the canvas lifecycle; the null guard fires but the Worker correlation ID hangs | Add `_destroyed` flag; check flag before `void bridge.send(...)` is called |
| DockNav + SuperWidget coexistence | DockNav lives in WorkbenchShell's sidebar slot; SuperWidget is the content area. If SuperWidget takes over WorkbenchShell's role, DockNav must be re-parented, not re-created | Preserve DockNav instance across the shell transition; re-parent its DOM element into SuperWidget's header slot or a sibling container |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Status slot update on every StateCoordinator tick | Status bar flickering; Worker re-queries correlated with filter changes | Status updates must be driven by ViewCanvas.onViewSwitch callback or SelectionProvider.subscribe, not StateCoordinator | Any active filter — every filter change fires StateCoordinator |
| Per-tab Projection validation on every commitProjection call | Noticeable latency on tab switch at 20K cards | validateProjection is O(N) on enabledTabIds.length — keep tab counts below 10; negligible at human scales | Only relevant if enabledTabIds is misused to encode large arrays |
| ResizeObserver on SuperWidget root triggering SuperGrid re-render during sidecar animation | Multiple Worker queries during explorer toggle (see Pitfall 4) | Debounce ResizeObserver callback at >= transition duration | Any sidecar animation — immediately when explorer show/hide is animated |
| Bridge `card:get` per status update in EditorCanvas | Each selection change issues a Worker round-trip to fetch the card name for status display | Pre-load card name into SelectionProvider as metadata, or cache `{ id → name }` in EditorCanvas | With rapid selection changes (keyboard navigation through cards) |
| Tab persistence writes on every tab switch | Multiple `ui:set` Worker messages per second during drag-reorder | Debounce tab state persistence at 500ms (same as notebook autosave pattern) | When tab reordering is fast — immediately |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tab bar shows canvasId strings (e.g., "view-1") instead of human labels | Users see internal IDs, not meaningful names | Tab label comes from the canvas registry entry's display name field, not the canvasId |
| Tab close removes the only tab | Blank canvas with no recovery path | Guard: never allow closing the last tab; hide close button at 1 tab |
| Explorer sidecar obscures tab bar during transition | Sidecar slides in and covers the tab strip | Sidecar must expand into the content area below the tab bar; SuperWidget CSS Grid row order is header → tabs → canvas → status |
| Tab reorder triggers dataset switch | User accidentally drops a tab onto the wrong zone | Tab reorder DnD must be strictly within the tab bar; no drop zones outside |
| Status slot empty during canvas mount | Brief blank status creates layout shift | Status slot renders a loading skeleton immediately on canvas mount, replaced with real data when canvas signals |

---

## "Looks Done But Isn't" Checklist

- [ ] **Tab persistence:** Tab state is saved — but verify it survives `window.location.reload()`, dataset switch, and a CloudKit merge with a stale `tabs:active` key from a different device.
- [ ] **CANV-06 invariant:** Tab management UI is wired — but run the `readFileSync` assertion test to confirm SuperWidget.ts has zero concrete canvas imports.
- [ ] **Explorer sidecar show/hide:** Animation works visually — but verify via PerfTrace that no supergrid:query fires during the sidecar CSS transition.
- [ ] **Status slot cleanup:** Status updates correctly for each canvas type — but verify that a View→Editor→View roundtrip shows the correct view status (not editor status) on the final View.
- [ ] **Destroy ordering on tab close:** Canvas destroy is called — but verify StateCoordinator subscriptions are cancelled before the DOM element is removed (seam test: `document.contains(el)` must be false before any subscriber callback fires).
- [ ] **WorkbenchShell retirement:** SuperWidget is the active shell — but verify WorkbenchShell.destroy() was called (no orphaned CommandBar, no leaked DockNav subscription, no duplicate StateManager registrations).
- [ ] **Rapid-switching stress test:** 3 transitions pass (existing INTG-04) — but verify 10 rapid transitions produce no orphaned Worker correlation IDs (check WorkerBridge pending-request Map after stress).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CANV-06 broken by tab management code | LOW | Move the concrete import to registry.ts or main.ts; pass metadata via callback; re-run CI gate |
| Concurrent canvas instances from rapid switching | MEDIUM | Add `_destroyed` flag to both ViewCanvas and EditorCanvas; add debounce to tab switching; write INTG-04 variant for 10 rapid switches |
| WorkbenchShell teardown race | MEDIUM | Audit all StateCoordinator.subscribe() callsites in WorkbenchShell; ensure all are unsubscribed in destroy(); add seam test for post-destroy callback safety |
| Tab state desync after CloudKit merge | HIGH | Add Projection migration layer to StateManager restore path; write test for round-trip with unknown canvasId; migration is load-bearing and requires its own phase |
| Projection type collision (activeTabId dual semantics) | HIGH | Introduce TabSlot wrapper type before any persistence code is written; retrofitting after persistence is wired is a rewrite |
| Status slot DOM conflict between canvas types | LOW | Add `statusEl.textContent = ''` in commitProjection on canvas type change; write test for View→Editor→View status content |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CANV-06 broken by tab management | Tab management UX (first phase) | `readFileSync` assertion in Playwright gate; zero concrete canvas imports in SuperWidget.ts |
| Concurrent canvas instances from rapid switching | Tab management UX (first phase) | INTG-04 variant: 10 rapid switches, assert Worker pending-request Map is empty after |
| WorkbenchShell teardown race | Shell replacement phase | Seam test: post-destroy StateCoordinator callback must not write to DOM |
| Explorer sidecar triggering re-queries | Explorer sidecar polish phase | PerfTrace assertion: fewer than 2 supergrid:query messages per sidecar toggle |
| Status slot DOM conflict | Rich status slots phase | Test: View→Editor→View roundtrip, assert correct status schema in slot |
| Tab persistence desync after CloudKit | Tab persistence phase (same phase as initial persistence) | Test: restore Projection with unknown canvasId → graceful fallback, no blank canvas |
| Projection type collision | Tab management type design (before persistence) | TypeScript strict mode: TabSlot type isolates tab-level from canvas-level activeTabId semantics |

---

## Sources

- Live source: `src/superwidget/SuperWidget.ts` — commitProjection lifecycle, single-canvas assumptions
- Live source: `src/superwidget/projection.ts` — Projection type, validateProjection, transition functions
- Live source: `src/superwidget/ViewCanvas.ts` — async onProjectionChange, status slot DOM pattern, onSidecarChange callback
- Live source: `src/superwidget/EditorCanvas.ts` — async bridge call in _updateStatus, destroy ordering (D-14)
- Live source: `src/superwidget/statusSlot.ts` — ExplorerCanvas status schema (distinct from ViewCanvas schema)
- Live source: `src/ui/WorkbenchShell.ts` — DOM structure being replaced, CommandBar ownership
- Live source: `src/providers/StateManager.ts` — scoped key pattern, debounce autosave, _migrateState precedent
- Project history: v13.0 REQUIREMENTS.md — CANV-06 specification and readFileSync gate
- Project history: v13.2 REQUIREMENTS.md — INTG-04 rapid-switching stress test, D-14 destroy ordering
- Project history: PROJECT.md — WorkbenchShell lifecycle decisions (v5.0 validated), StateCoordinator batching (v3.0 validated), CloudKit sync merge patterns (v4.1 validated)

---
*Pitfalls research for: SuperWidget Shell replacement — tab management, explorer sidecar, rich status slots*
*Researched: 2026-04-21*
