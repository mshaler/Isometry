# Pitfalls Research

**Domain:** Adding ViewCanvas and EditorCanvas to SuperWidget substrate (v13.2)
**Researched:** 2026-04-21
**Confidence:** HIGH — all findings derived from direct codebase analysis (ViewManager.ts, NotebookExplorer.ts, SuperWidget.ts, registry.ts, projection.ts, ExplorerCanvas.ts, integration tests)

---

## Critical Pitfalls

### Pitfall 1: ViewManager Container Ownership Collision

**What goes wrong:**
`ViewManager.destroy()` calls `this.container.innerHTML = ''` as final cleanup (ViewManager.ts line 398). If ViewCanvas passes SuperWidget's `_canvasEl` directly as the ViewManager container, this wipes `_canvasEl` on destroy. If a new canvas has already been mounted into `_canvasEl` (async race with in-flight `_fetchAndRender` promise), the new canvas's DOM is immediately cleared.

**Why it happens:**
`ViewManager` is designed to own its container — it treats `container.innerHTML = ''` as a safe full-reset. SuperWidget's `_canvasEl` slot is shared across all canvas types. The ExplorerCanvas reference implementation mounts into a wrapper div, not directly into the container, but this pattern is not enforced by the CanvasComponent interface.

**How to avoid:**
In `ViewCanvas.mount(container)`:
```typescript
const wrapper = document.createElement('div');
wrapper.dataset['viewCanvasWrapper'] = '';
container.appendChild(wrapper);
this._viewManager = new ViewManager({ container: wrapper, ... });
```
In `ViewCanvas.destroy()`:
```typescript
this._viewManager?.destroy();
this._wrapperEl?.remove();
this._wrapperEl = null;
```
This scopes ViewManager's `innerHTML = ''` to the wrapper, leaving `_canvasEl` intact for the next canvas to mount.

**Warning signs:**
- `_canvasEl.innerHTML` is empty after ViewCanvas destroy (it should be empty only after full SuperWidget destroy)
- Two canvas type data-attributes present simultaneously in `_canvasEl` (new canvas mounted, then cleared, leaving the residual)
- CANV-06 leak test fails because `_canvasEl` is empty after a valid commitProjection

**Phase to address:**
ViewCanvas implementation phase — write a wrapper-isolation test as the very first red step before implementing mount().

---

### Pitfall 2: Coordinator Subscription Leak via ViewManager Wrapping

**What goes wrong:**
ViewManager subscribes to `StateCoordinator` via `coordinator.subscribe()` in `switchTo()`. The unsub is stored in `coordinatorUnsub` and called in `_teardownCurrentView()`. If `ViewCanvas.destroy()` is not called correctly (e.g., an error during `canvasFactory` execution means `_currentCanvas` is never set in SuperWidget), the coordinator subscription outlives the canvas. Subsequent provider state changes trigger `_fetchAndRender()` on a ViewManager whose container div has been detached.

**Why it happens:**
`SuperWidget.commitProjection()` sets `_currentCanvas` only after `canvas.mount()` completes. If mount throws, the canvas has already subscribed to the coordinator but `_currentCanvas` is null, so the next `commitProjection` won't call `canvas.destroy()`.

**How to avoid:**
Ensure `ViewCanvas.mount()` is synchronous and does not subscribe to StateCoordinator during mount itself. Defer subscription setup to the first `ViewManager.switchTo()` call, which ViewManager already manages internally. Additionally, guard `canvasFactory` in SuperWidget with try/catch that calls `canvas.destroy()` on failure.

**Warning signs:**
- StateCoordinator subscriber count growing monotonically across canvas switch cycles in long-running tests
- `_fetchAndRender()` triggered when ViewCanvas is not the active canvas (bridge.send called with no visible canvas in DOM)

**Phase to address:**
ViewCanvas implementation phase — add coordinator subscriber count assertions to cross-seam integration tests, matching the pattern from ExplorerCanvas integration tests.

---

### Pitfall 3: Force Simulation Worker Timer Outliving NetworkView

**What goes wrong:**
NetworkView runs a force simulation in a Worker via a `stop()+tick()` loop. When a user switches to a different view inside ViewCanvas (triggering `ViewManager.switchTo()` → `currentView.destroy()`), if `NetworkView.destroy()` does not stop the Worker simulation, the Worker continues posting tick results via WorkerNotification (broadcast, no correlation ID). These arrive after the new view has mounted and may attempt DOM mutations on detached nodes.

**Why it happens:**
WorkerBridge's broadcast listener pattern — notifications that use WorkerNotification protocol (no correlation ID) are received by any subscriber that was registered. If NetworkView registers a direct `message` handler on the Worker or bridge, and destroy() does not remove it, ticks arrive post-destroy.

**How to avoid:**
Verify that NetworkView's destroy() sends a `simulation:stop` message to the Worker AND removes its notification listener. Write a test: (1) mount NetworkView inside a ViewCanvas, (2) immediately call ViewCanvas.destroy(), (3) wait one microtask, (4) assert no further bridge messages arrive.

**Warning signs:**
- Console errors about missing DOM elements after switching away from NetworkView
- High Worker CPU usage persisting after NetworkView is no longer mounted
- Vitest test isolation failures where simulation ticks from one test bleed into another

**Phase to address:**
ViewCanvas implementation phase — NetworkView must be included in the 9-view full-cycle integration test.

---

### Pitfall 4: NotebookExplorer Debounced Auto-Save Fires After EditorCanvas Destroy

**What goes wrong:**
NotebookExplorer has a 500ms debounced auto-save for per-card content persistence (`notebook:{cardId}` key in ui_state). When the user switches away from EditorCanvas, `EditorCanvas.destroy()` calls `notebookExplorer.destroy()`. If `NotebookExplorer.destroy()` does not cancel the pending debounce timer, the timer fires 500ms later and calls `bridge.send('db:exec', ...)` on a bridge that is still live — writing stale data to a key that may have been superseded by a card deletion or undo.

**Why it happens:**
The flush-on-switch guard in NotebookExplorer is invoked when switching *cards within* the notebook (SelectionProvider fires a new selection). Canvas-level destroy is a different code path that does not pass through the card-switch flush. The debounce timer reference must be explicitly cancelled in `destroy()`.

**How to avoid:**
Verify `NotebookExplorer.destroy()` calls `clearTimeout(this._saveTimer)` (or equivalent) as part of cleanup. Write an EditorCanvas destroy test that: (1) mounts EditorCanvas, (2) loads a card and modifies content (starting the debounce), (3) destroys EditorCanvas, (4) waits 600ms, (5) asserts no `db:exec` call occurred after destroy timestamp.

**Warning signs:**
- `bridge.send` spy showing `notebook:{cardId}` writes after EditorCanvas destroy timestamp
- Stale notebook content appearing in a subsequently-mounted EditorCanvas (debounce wrote old content over new)

**Phase to address:**
EditorCanvas implementation phase — the debounced-save-after-destroy test must be the first test written (red step before implementing destroy()).

---

### Pitfall 5: Four NotebookExplorer Subscriptions Not All Cleaned Up on EditorCanvas Destroy

**What goes wrong:**
NotebookExplorer maintains four subscription handles: `_unsubscribeSelection`, `_unsubscribeMutation`, `_unsubscribeFilter`, and a `ChartRenderer` filter subscription. If any of these survive `EditorCanvas.destroy()`, every subsequent card selection, mutation, or filter change triggers the NotebookExplorer's handler on a destroyed explorer whose DOM elements are all null — producing silent failures or TypeScript null-access errors in strict mode.

**Why it happens:**
The subscription cleanup is distributed across NotebookExplorer — there is no single `_unsubscribeAll()` helper. During EditorCanvas implementation, developers may test that `_unsubscribeSelection` is cleared but miss `_unsubscribeMutation` or the ChartRenderer filter sub. Selection leaks are the most visible because SelectionProvider fires on every card click.

**How to avoid:**
Write a subscription-count test for EditorCanvas that: (1) records SelectionProvider, FilterProvider, and MutationManager subscriber counts before mount, (2) mounts EditorCanvas, (3) confirms all counts increased, (4) destroys EditorCanvas, (5) confirms all counts return to pre-mount values. Mirrors the CANV-06 file-size leak pattern but for subscriptions.

**Warning signs:**
- `Cannot set properties of null (setting 'textContent')` in NotebookExplorer after destroy
- SelectionProvider subscriber count growing monotonically across repeated Editor→View→Editor transitions

**Phase to address:**
EditorCanvas implementation phase — subscription count test must be red before any destroy() cleanup is implemented.

---

### Pitfall 6: Sidecar Binding Semantics Misread — Hardcoding ProjectionExplorer

**What goes wrong:**
`Bound` binding means "auto-show the sidecar explorer registered as `defaultExplorerId` in the registry entry". Developers writing ViewCanvas may assume `Bound` always means ProjectionExplorer, ignoring the registry entry. This breaks for view types like ListView, GridView, or GalleryView that have no PAFV axis concept and should have no sidecar — and for future canvases that may have different sidecars.

**Why it happens:**
The existing integration tests (INTG-01, INTG-02) use ViewCanvasStub which checks `this._binding === 'Bound'` and unconditionally adds `[data-sidecar]`. The real ViewCanvas must read `defaultExplorerId` from the registry entry, not hardcode a sidecar type.

**How to avoid:**
In `ViewCanvas.onProjectionChange(proj)`:
```typescript
const entry = getRegistryEntry(proj.canvasId);
const showSidecar = proj.canvasBinding === 'Bound' && !!entry?.defaultExplorerId;
```
Write three parameterized tests: (1) canvasId with no `defaultExplorerId` + Bound → no sidecar, (2) canvasId with `defaultExplorerId` + Bound → sidecar shown, (3) canvasId with `defaultExplorerId` + Unbound → sidecar hidden.

**Warning signs:**
- ProjectionExplorer appearing above ListView (which has no PAFV axis concept)
- SuperGrid rendering without ProjectionExplorer even though Bound was set
- `defaultExplorerId` missing from registry entries for non-SuperGrid view canvases

**Phase to address:**
ViewCanvas implementation phase — sidecar tests must be written before the Bound/Unbound code path is implemented.

---

### Pitfall 7: onProjectionChange Not Implemented for Tab-Switch Path

**What goes wrong:**
`SuperWidget.commitProjection()` has two branches: (A) full canvas replacement (destroy old, mount new, call `onProjectionChange`) and (B) tab-switch only (same canvasId + canvasType, different activeTabId — also calls `onProjectionChange`). If ViewCanvas or EditorCanvas implements internal state as "set on first mount only" without implementing `onProjectionChange`, tab switches are silently ignored. For ViewCanvas, this means the active D3 view type never changes when the user clicks view type tabs. For EditorCanvas, this means the status slot never updates for tab switches.

**Why it happens:**
`onProjectionChange` is optional on the `CanvasComponent` interface (`onProjectionChange?(proj: Projection): void`). The stub implementations don't implement it. ExplorerCanvas models the correct pattern (it updates the active tab container on every `onProjectionChange` call), but this may not be seen as the model when implementing the new canvases.

**How to avoid:**
Both ViewCanvas and EditorCanvas must implement `onProjectionChange`. Write a test for each: (1) mount canvas, (2) call `commitProjection` with same `canvasId + canvasType` but different `activeTabId`, (3) assert internal state updated (view type changed / status slot refreshed).

**Warning signs:**
- Tab switching via the SuperWidget tabs slot works on initial mount but stops working after navigation to a different canvas and back
- Status slot frozen at initial state after tab switch within ViewCanvas

**Phase to address:**
ViewCanvas and EditorCanvas implementation phases — include a tab-switch assertion in both initial test suites.

---

### Pitfall 8: ViewManager switchTo() Called with Wrong View Type on Projection Change

**What goes wrong:**
When `ViewCanvas.onProjectionChange(proj)` is called, ViewCanvas must determine which D3 view type to mount. The Projection's `activeTabId` likely corresponds to the view type name (e.g., `'supergrid'`, `'list'`). If the mapping between `activeTabId` and `ViewType` is not 1-to-1 (e.g., if tab IDs use different naming conventions than ViewType strings), `viewManager.switchTo()` receives an invalid ViewType. ViewManager then calls `pafv.setViewType()` with an invalid type, which may silently apply wrong VIEW_DEFAULTS or trigger SQL with unrecognized field names.

**Why it happens:**
The Projection type is agnostic — `activeTabId` is just a string. The convention that tab IDs equal view type names must be explicitly established and tested. If ViewCanvas registers tab IDs as `'view-list'` but ViewType expects `'list'`, the mapping is off-by-one.

**How to avoid:**
Define a `TAB_ID_TO_VIEW_TYPE` map in ViewCanvas that is the single source of truth for this mapping. Write a test that exhaustively checks all 9 view types are reachable by tab ID. Fail fast with a console.error + early return if the tab ID is not in the map.

**Warning signs:**
- `pafv.setViewType()` called with undefined or a non-ViewType string
- All 9 view tab buttons render but only some actually switch the view
- SuperGrid appearing when list view tab is selected (wrong VIEW_DEFAULTS applied)

**Phase to address:**
ViewCanvas implementation phase — the tab-ID-to-view-type mapping test must cover all 9 entries before implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Passing `_canvasEl` directly to ViewManager | Fewer DOM nodes | ViewManager.destroy() clears the slot, breaking subsequent canvas mounts | Never |
| Skipping onProjectionChange implementation | Less code to write | Tab-switch and binding-change events silently ignored | Never for production canvases |
| Not cancelling debounce timers in NotebookExplorer.destroy() | Less cleanup code | Auto-save fires 500ms after canvas is gone, writes stale data | Never |
| Hardcoding ProjectionExplorer as the sidecar | Simpler initial code | Breaks for any view registered without a sidecar | Never |
| Subscribing to StateCoordinator in ViewCanvas.mount() directly (outside ViewManager) | Avoids refactor | Double subscription: ViewManager subscribes on switchTo(), creating a duplicate | Never |
| Constructing a new NotebookExplorer on every EditorCanvas mount/destroy cycle | Avoids singleton state | Four subscriptions created and destroyed on every canvas switch; subscribe/unsub noise in tests | Never — construct once per EditorCanvas lifetime |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ViewManager + StateCoordinator | Adding a second coordinator.subscribe() call in ViewCanvas on top of ViewManager's own subscription | Let ViewManager own the coordinator subscription entirely; ViewCanvas only calls viewManager.switchTo() |
| NotebookExplorer + SelectionProvider | Not threading SelectionProvider into EditorCanvas constructor | EditorCanvas must receive SelectionProvider and pass it to NotebookExplorer config |
| SuperGrid + ProjectionExplorer sidecar | Mounting ProjectionExplorer inside `_canvasEl` (inside ViewCanvas) | ProjectionExplorer is an inline top-slot explorer above the view area, not inside the canvas slot |
| ViewCanvas + commitProjection reference equality | Spreading a new Projection object on every view-type switch instead of using transition functions | Use `setCanvas()`, `setBinding()`, `switchTab()` which return the exact same reference on no-op |
| EditorCanvas + status slot | Updating the status slot with card title inside `onProjectionChange` before the card is loaded | Update the status slot only after `NotebookExplorer` resolves the card data from the bridge |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-instantiating ViewManager on every ViewCanvas mount | Each mount creates a new coordinator subscription; old ones accumulate | Create ViewManager once on first ViewCanvas mount; call switchTo() for view-type changes | Immediately — N transitions = N live subscriptions |
| rAF wrapper in ViewCanvas on top of ViewManager's existing rAF in _focusContainer | Double-frame delay before focus; unpredictable animation ordering | Do not add rAF in ViewCanvas; ViewManager._focusContainer() already handles focus timing | At any scale — pure timing bug |
| NetworkView force simulation Worker not stopped on view switch | Worker CPU stays elevated after switching away from NetworkView | NetworkView.destroy() must post simulation:stop before returning | Immediately — visible in Chrome Performance tab at any data size |
| ChartRenderer FilterProvider subscription surviving EditorCanvas destroy | Every filter change re-renders charts in a destroyed canvas | ChartRenderer.destroy() must unsubscribe; EditorCanvas.destroy() must call it | At any data size with active filters |

---

## "Looks Done But Isn't" Checklist

- [ ] **ViewCanvas mount:** ViewManager is constructed with a wrapper div, not `_canvasEl` directly — verify `_canvasEl` only contains `[data-view-canvas-wrapper]` after mount.
- [ ] **ViewCanvas destroy:** After `canvas.destroy()`, verify StateCoordinator subscriber count equals pre-mount count.
- [ ] **ViewCanvas 9-view cycle:** All 9 view types are reachable via `viewManager.switchTo()` inside ViewCanvas — verify with an explicit cycle test.
- [ ] **ViewCanvas sidecar:** After Bound commitProjection on a canvasId with `defaultExplorerId`, verify the sidecar explorer is active. After Unbound commitProjection on the same canvasId, verify it is hidden.
- [ ] **EditorCanvas destroy:** After `canvas.destroy()`, wait 600ms and verify no `db:exec` calls to `ui_state` with `notebook:*` key prefix.
- [ ] **EditorCanvas destroy:** SelectionProvider, FilterProvider, and MutationManager subscriber counts equal pre-mount counts after destroy.
- [ ] **Both canvases:** After a tab-switch commitProjection (same canvasId + canvasType, different activeTabId), verify `onProjectionChange` was called and internal state updated.
- [ ] **Status slot — ViewCanvas:** After ViewCanvas mounts and fetches first data, verify `[data-stat="cards"]` reflects the live count, not the "0 cards" initial state from statusSlot.ts.
- [ ] **Status slot — EditorCanvas:** After a card is loaded, verify status slot shows the card title, not a generic placeholder.
- [ ] **3-canvas transition matrix:** Run all 9 two-way transitions (Explorer→View, View→Editor, Editor→Explorer, etc.) and verify `_canvasEl.children.length === 1` after each.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| ViewManager container collision discovered after ViewCanvas shipped | MEDIUM | Add wrapper div in ViewCanvas.mount(); update all tests that assert on `_canvasEl` direct children; verify CANV-06 still passes |
| Coordinator subscription leak discovered late | MEDIUM | Add subscriber-count tracking test; trace which subscribe() call lacks a matching unsub; add cleanup to ViewCanvas.destroy() |
| Force simulation timer leak discovered via E2E slowness | LOW | Add simulation:stop message to NetworkView.destroy(); write Worker tick assertion test |
| Debounced auto-save firing after EditorCanvas destroy | LOW | Add clearTimeout to NotebookExplorer.destroy(); add 600ms post-destroy bridge.send assertion |
| All four NotebookExplorer subscriptions not cleaned up | LOW | Add a _unsubscribeAll() helper to NotebookExplorer that calls all four unsubs; call it from destroy() |
| Sidecar hardcoded to ProjectionExplorer | LOW | Refactor to read defaultExplorerId from registry entry; update sidecar tests with parameterized canvasId variations |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| ViewManager container ownership collision | ViewCanvas implementation phase | `_canvasEl` still has wrapper div as only child after mount; `innerHTML` not empty after ViewCanvas.destroy() |
| Coordinator subscription leak | ViewCanvas implementation phase | `coordinator.getSubscriberCount()` equals pre-mount count after ViewCanvas.destroy() |
| Force simulation timer outliving NetworkView | ViewCanvas phase — 9-view cycle test | Bridge spy confirms zero simulation messages after NetworkView destroy |
| NotebookExplorer debounced auto-save after destroy | EditorCanvas implementation phase | 600ms post-destroy bridge.send count assertion |
| Four NotebookExplorer subscriptions leaked | EditorCanvas implementation phase | SelectionProvider + FilterProvider + MutationManager subscriber counts before/after |
| Sidecar binding semantics misread | ViewCanvas implementation phase | Three-parameter sidecar test: (no defaultExplorerId + Bound), (defaultExplorerId + Bound), (defaultExplorerId + Unbound) |
| onProjectionChange tab-switch branch missed | ViewCanvas + EditorCanvas phases | Tab-switch commitProjection test for each canvas type |
| switchTo() called with wrong ViewType | ViewCanvas implementation phase | Exhaustive 9-entry TAB_ID_TO_VIEW_TYPE coverage test |

---

## Sources

- `/Users/mshaler/Developer/Projects/Isometry/src/superwidget/SuperWidget.ts` — commitProjection lifecycle (two branches), destroy() behavior, onProjectionChange call sites
- `/Users/mshaler/Developer/Projects/Isometry/src/superwidget/projection.ts` — CanvasComponent interface, optional onProjectionChange, Bound/Unbound semantics
- `/Users/mshaler/Developer/Projects/Isometry/src/superwidget/registry.ts` — defaultExplorerId field, CanvasRegistryEntry, registerAllStubs
- `/Users/mshaler/Developer/Projects/Isometry/src/superwidget/ExplorerCanvas.ts` — reference CanvasComponent implementation: wrapper div pattern, onProjectionChange tab state, destroy() cleanup
- `/Users/mshaler/Developer/Projects/Isometry/src/views/ViewManager.ts` — container.innerHTML = '' in destroy() (line 398), coordinator subscription lifecycle, async _fetchAndRender race, _teardownCurrentView
- `/Users/mshaler/Developer/Projects/Isometry/src/ui/NotebookExplorer.ts` — four subscription handles (_unsubscribeSelection, _unsubscribeMutation, _unsubscribeFilter, ChartRenderer sub), debounced auto-save pattern
- `/Users/mshaler/Developer/Projects/Isometry/tests/superwidget/integration.test.ts` — INTG-01..INTG-06 test shapes, sidecar data-attribute pattern
- `PROJECT.md` — v13.0 SuperWidget decisions, CANV-06 leak test requirement, Bound/Unbound mechanics, commitProjection lifecycle contract

---
*Pitfalls research for: Adding ViewCanvas and EditorCanvas to SuperWidget substrate (v13.2)*
*Researched: 2026-04-21*
