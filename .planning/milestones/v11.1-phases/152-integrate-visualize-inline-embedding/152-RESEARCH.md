# Phase 152: Integrate + Visualize Inline Embedding - Research

**Researched:** 2026-04-16
**Domain:** TypeScript DOM wiring — top-slot child layout, PanelRegistry integration, view-switch hooks
**Confidence:** HIGH

## Summary

Phase 152 is a pure wiring phase: no new libraries, no new components, no new CSS files. All infrastructure was laid by Phase 151. The `.workbench-slot-top` container exists and returns `display:none` inline. Three child divs must be created inside it — one for each explorer — and the existing toggle and view-switch code in `main.ts` must be extended to show/hide those children correctly.

The Data + Properties toggle (`integrate:catalog`) currently only calls `showDataExplorer()`/`hideDataExplorer()`. It must be extended to also create and show/hide a `.slot-top__properties-explorer` child div, mounting `PropertiesExplorer` into it via the existing PanelRegistry factory. The Projections auto-visibility hook belongs inside the existing `visualize` branch of `onActivateItem` in `main.ts`, immediately after the `viewManager.switchTo()` call.

The entire implementation lives in `src/main.ts` with one CSS addition to `src/styles/workbench.css` for the three child-div selectors. No changes to `WorkbenchShell`, `DockNav`, `PanelRegistry`, `PropertiesExplorer`, or `ProjectionExplorer` are required.

**Primary recommendation:** Create the three child divs eagerly at boot (alongside the existing `dataExplorerEl = shell.getTopSlotEl()` assignment), then drive all visibility via `element.style.display = 'block'/'none'` + a shared `syncTopSlotVisibility()` helper that shows/hides the parent.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** All three explorers (Data Explorer, Properties Explorer, Projections Explorer) are stacked vertically as separate child divs inside `.workbench-slot-top`. Data on top, Properties below, Projections at the bottom.
- **D-02:** Single "Data" dock item (`integrate:catalog`) toggles both Data Explorer and Properties Explorer as a unit. No separate Properties dock entry. One click shows both, second click hides both.
- **D-03:** Projections Explorer visibility is purely automatic — driven by view-switch logic. Shows when SuperGrid is the active view, hides for all other views. No manual toggle, no dock item for Projections. User cannot manually dismiss Projections while on SuperGrid.
- **D-04:** DataExplorer remains a special case in `main.ts` (`showDataExplorer()`/`hideDataExplorer()`). Not folded into PanelRegistry this phase. The "toggle both" logic calls `showDataExplorer()` alongside mounting Properties into its child div in the top slot. Properties stays PanelRegistry-managed.

### Claude's Discretion
- How Properties Explorer mounts into its child div — direct instantiation like DataExplorer, or via PanelRegistry factory invocation
- Whether `.workbench-slot-top` visibility is managed by showing/hiding the parent container or by showing/hiding individual child divs (parent `display:none` when all children hidden is likely simplest)
- Where the view-switch hook for Projections auto-show lives — in the existing `onActivateItem` visualize branch or a separate `viewManager` callback
- Whether Projections gets its own child div created eagerly (like top/bottom slots) or lazily on first SuperGrid activation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTG-01 | User clicks Data icon in dock → Data Explorer + Properties Explorer appear at top of main view area | D-01/D-02: child divs in `.workbench-slot-top`, `showDataExplorer()` extended to also show Properties child div |
| INTG-02 | User clicks Data icon again → both hide (toggle behavior) | D-02: `hideDataExplorer()` extended to also hide Properties child div; `syncTopSlotVisibility()` collapses parent |
| VIZ-01 | User activates SuperGrids → Projections Explorer appears above the grid | D-03: visualize branch in `onActivateItem` shows `.slot-top__projection-explorer` when `itemKey === 'supergrid'` |
| VIZ-02 | User activates non-SuperGrid view → Projections Explorer hidden | D-03: visualize branch hides `.slot-top__projection-explorer` for all other itemKeys |
| VIZ-03 | Switching back to SuperGrids → Projections Explorer reappears | Same visualize branch logic — no special case needed, view switch always re-evaluates |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (strict) | 5.9 | All implementation | Project standard — no alternatives |
| D3.js | v7.9 | Already powers all explorers | Used by PropertiesExplorer, ProjectionExplorer |
| Vitest | 4.0.18 | Test runner | Project standard |

No new packages. Phase 152 uses zero new npm dependencies.

**Installation:** none required.

---

## Architecture Patterns

### Recommended Project Structure

No new files or directories. All changes are in:
```
src/
├── main.ts                    ← primary change surface (~50-80 LOC delta)
└── styles/workbench.css       ← ~10 LOC addition for child div selectors
```

### Pattern 1: Eager Child Div Creation at Boot

**What:** Create all three child divs inside `.workbench-slot-top` at startup, alongside the existing `dataExplorerEl` assignment. Store references as module-level variables in the boot closure.

**When to use:** Always — matches Phase 151 pattern where `topSlot` and `bottomSlot` are created eagerly in `WorkbenchShell` constructor.

**Example:**
```typescript
// After: const dataExplorerEl = shell.getTopSlotEl();
const topSlotEl = shell.getTopSlotEl();

// Create child divs eagerly — visibility starts as 'none'
const dataExplorerChildEl = document.createElement('div');
dataExplorerChildEl.className = 'slot-top__data-explorer';
dataExplorerChildEl.style.display = 'none';
topSlotEl.appendChild(dataExplorerChildEl);

const propertiesChildEl = document.createElement('div');
propertiesChildEl.className = 'slot-top__properties-explorer';
propertiesChildEl.style.display = 'none';
topSlotEl.appendChild(propertiesChildEl);

const projectionChildEl = document.createElement('div');
projectionChildEl.className = 'slot-top__projection-explorer';
projectionChildEl.style.display = 'none';
topSlotEl.appendChild(projectionChildEl);
```

**IMPORTANT:** The existing `dataExplorerEl` variable is currently assigned `shell.getTopSlotEl()` (i.e., the parent slot container itself). In the Phase 152 refactor, `DataExplorerPanel` must mount into `dataExplorerChildEl` (the child div), not the parent. This is the primary migration concern — see Pitfall 1 below.

### Pattern 2: Shared Parent Visibility Helper

**What:** A small function that inspects all three child divs and shows/hides the parent `.workbench-slot-top` accordingly.

**When to use:** Called from `showDataExplorer()`, `hideDataExplorer()`, and the Projections view-switch hook.

**Example:**
```typescript
function syncTopSlotVisibility(): void {
  const anyVisible =
    dataExplorerChildEl.style.display !== 'none' ||
    propertiesChildEl.style.display !== 'none' ||
    projectionChildEl.style.display !== 'none';
  topSlotEl.style.display = anyVisible ? 'block' : 'none';
}
```

### Pattern 3: Properties Explorer — Direct Instantiation into Child Div

**What:** Properties Explorer is mounted lazily the first time Data toggle is activated (matching DataExplorer's lazy-mount pattern). Subsequent toggles just show/hide the child div.

**When to use:** Consistent with D-04 (DataExplorer remains special case). The PanelRegistry `mount(container)` factory is invoked with `propertiesChildEl` as the container on first show; afterward only visibility toggling happens.

**Example:**
```typescript
// Track mount state (parallel to dataExplorerMounted)
let propertiesExplorerMounted = false;

function showPropertiesExplorer(): void {
  propertiesChildEl.style.display = 'block';
  if (!propertiesExplorerMounted) {
    panelRegistry.enable('properties'); // triggers factory mount(propertiesChildEl)?
    // OR: direct instantiation matching DataExplorer pattern
    propertiesExplorerMounted = true;
  }
}
```

**Note on PanelRegistry vs direct instantiation:** The `PanelRegistry.enable('properties')` path calls `factory()` but the factory's `mount(container)` is given whatever container PanelRegistry provides internally — which is currently undefined for inline slots. The cleanest path (at Claude's discretion) is to bypass PanelRegistry for Properties in this phase, matching DataExplorer's direct-instantiation approach. The PropertiesExplorer factory closure at line 1370 can be called directly: `new PropertiesExplorer({...}).mount(propertiesChildEl)`.

### Pattern 4: Projections Auto-Visibility in visualize Branch

**What:** The `onActivateItem` visualize branch already calls `viewManager.switchTo()`. Projections logic attaches after the switch, tracking the current view type.

**When to use:** Always — no separate callback or viewManager hook needed.

**Example:**
```typescript
if (sectionKey === 'visualize') {
  const viewType = itemKey as ViewType;
  const viewContentEl = shell.getViewContentEl();
  viewContentEl.style.opacity = '0';
  void viewManager
    .switchTo(viewType, () => viewFactory[viewType]())
    .then(() => {
      viewContentEl.style.opacity = '1';
    });

  // Projections auto-visibility (VIZ-01, VIZ-02, VIZ-03)
  if (viewType === 'supergrid') {
    showProjectionExplorer();
  } else {
    hideProjectionExplorer();
  }
  return;
}
```

### Pattern 5: Projections Explorer — Lazy Mount on First SuperGrid Activation

**What:** Projections Explorer is created on first SuperGrid activation. Subsequent switches just toggle `projectionChildEl.style.display`.

**When to use:** Consistent with lazy-mount pattern for all explorers. No reason to mount Projections before user ever sees SuperGrid.

**Example:**
```typescript
let projectionExplorerMounted = false;

function showProjectionExplorer(): void {
  projectionChildEl.style.display = 'block';
  if (!projectionExplorerMounted) {
    // Direct instantiation matching DataExplorer pattern
    projectionExplorer = new ProjectionExplorer({...}); // existing factory params
    projectionExplorer.mount(projectionChildEl);
    projectionExplorerMounted = true;
  }
  syncTopSlotVisibility();
}

function hideProjectionExplorer(): void {
  projectionChildEl.style.display = 'none';
  syncTopSlotVisibility();
}
```

### Pattern 6: DockNav aria-pressed for integrate:catalog

**What:** The UI-SPEC requires `aria-pressed="true"` on the Data dock button when explorers are visible. DockNav currently uses `aria-selected` for view items (visualize section). The integrate:catalog item is a toggle, not a view selection, so `aria-pressed` is the correct ARIA pattern.

**When to use:** Update the `integrate:catalog` button after show/hide to set `aria-pressed`.

**Example:**
```typescript
// After show:
dockNav.setIntegrateCatalogPressed(true);  // new helper, OR:
// Direct DOM manipulation:
const btn = dockNav.getItemEl('integrate:catalog'); // if accessor exists
btn?.setAttribute('aria-pressed', 'true');
```

**Note:** DockNav exposes `_itemEls` as private. The cleanest path is to add a `setItemPressed(compositeKey: string, pressed: boolean)` public method to DockNav, or to set `aria-pressed` via the DockNav `setActiveItem()` mechanism. Review whether the existing `setActiveItem()` / `dock-nav__item--active` CSS class satisfies the visual requirement — if so, calling `dockNav.setActiveItem('integrate', 'catalog')` on show and clearing on hide may be sufficient.

### Anti-Patterns to Avoid
- **Mounting DataExplorerPanel into the parent topSlotEl directly:** The existing code does this (line 632: `const dataExplorerEl = shell.getTopSlotEl()`). Phase 152 must redirect DataExplorer to mount into `dataExplorerChildEl` instead, or the stacking order breaks.
- **Toggling `.workbench-slot-top` display directly without syncTopSlotVisibility:** If Projections is visible and user hides Data+Properties, the parent must stay visible. Always compute parent visibility from child states.
- **Using CSS class toggling instead of inline style:** Project pattern (established from DataExplorer) uses `element.style.display = 'block'/'none'`. Do not introduce a CSS class toggle — match existing pattern exactly.
- **Subscribing Projections to a StateCoordinator callback:** Projections auto-visibility is a UI-wiring concern, not a data concern. It belongs in `onActivateItem`, not in a provider subscription.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Explorer lifecycle (mount/destroy) | Custom lifecycle manager | Existing PanelRegistry or direct instantiation | Already handles factory invocation, dependency enforcement |
| Parent collapse when all children hidden | CSS `grid` tricks or ResizeObserver | `syncTopSlotVisibility()` helper + inline style | Three lines, no observer needed |
| Active state on integrate:catalog | Custom indicator component | `dockNav.setActiveItem()` or `aria-pressed` attribute | DockNav already has `dock-nav__item--active` CSS |

**Key insight:** This phase is 100% wiring of existing infrastructure. Any custom mechanism is over-engineering.

---

## Common Pitfalls

### Pitfall 1: DataExplorer Mounts into Wrong Container
**What goes wrong:** `dataExplorerEl` is currently `shell.getTopSlotEl()` (the parent). After Phase 152, DataExplorer must mount into the `slot-top__data-explorer` child div. If `showDataExplorer()` still calls `dataExplorer.mount(dataExplorerEl)` where `dataExplorerEl` is the parent, all three explorers will compete for the same container.

**Why it happens:** Line 632 of `main.ts` assigns `const dataExplorerEl = shell.getTopSlotEl()`. This worked when DataExplorer was the only occupant. Phase 152 introduces siblings.

**How to avoid:** Rename `dataExplorerEl` to `dataExplorerChildEl` and assign it the new child div. Audit all references to `dataExplorerEl` in `main.ts` — there are references in `showDataExplorer()` (lines 699, 766, 850) and `hideDataExplorer()` (line 857). All must point to the child div.

**Warning signs:** DataExplorer renders but Properties or Projections never appear, OR layout is broken with explorers stacked inside DataExplorer's DOM.

### Pitfall 2: Parent slot visibility not recalculated on partial hide
**What goes wrong:** User hides Data+Properties while SuperGrid is active (Projections visible). `topSlotEl` gets set to `display:none` inside `hideDataExplorer()`, which also hides Projections unexpectedly.

**Why it happens:** Phase 151 pattern sets `dataExplorerEl.style.display = 'none'` which was the parent. After Phase 152, the parent must only hide when ALL children are hidden.

**How to avoid:** Never set `topSlotEl.style.display` directly in show/hide functions. All parent visibility changes must go through `syncTopSlotVisibility()`.

**Warning signs:** Projections disappears when user toggles Data off while on SuperGrid.

### Pitfall 3: PropertiesExplorer wired to wrong container then double-mounted
**What goes wrong:** `panelRegistry.enable('properties')` is called from `showDataExplorer()`, but the PanelRegistry factory's `mount(container)` call uses whatever container was passed at registration time. If PanelRegistry was wired to a stale container (e.g., a removed PanelDrawer slot), PropertiesExplorer mounts into a detached node.

**Why it happens:** Phase 151 removed PanelDrawer. Any PanelRegistry containers that previously pointed to PanelDrawer slots are now orphaned.

**How to avoid:** Either bypass PanelRegistry for Properties (direct instantiation into `propertiesChildEl`), or check what container PanelRegistry passes to the `mount()` factory and redirect it. The CONTEXT.md explicitly leaves this at Claude's discretion — direct instantiation matching DataExplorer is the simpler path.

**Warning signs:** PropertiesExplorer mounted but invisible, or console errors about mounting into null container.

### Pitfall 4: Projections mounted but no data (propertiesExplorer not yet initialized)
**What goes wrong:** User opens SuperGrid before ever clicking Data toggle. Projections mounts and calls `enabledFieldsGetter: () => propertiesExplorer?.getEnabledFields() ?? new Set()`. The `propertiesExplorer?.` optional chaining handles `undefined` safely — this is already guarded at line 1419. Not a bug but worth confirming the guard survives the restructuring.

**Why it happens:** Lazy mount of Properties (on first Data toggle) is independent of Projections lazy mount (on first SuperGrid). They can mount in either order.

**How to avoid:** Verify the `propertiesExplorer?.getEnabledFields() ?? new Set()` guard is preserved in the Projections factory after restructuring.

**Warning signs:** Projections renders with empty axis wells when it should show fields.

### Pitfall 5: DockNav active-state mismatch for integrate:catalog toggle
**What goes wrong:** The `integrate:catalog` item gets `aria-selected="true"` + `dock-nav__item--active` class when clicked (via `_setActive`), but the visualize section then deactivates it when a view is clicked. The Data explorers remain visible even though the dock item is no longer styled as active.

**Why it happens:** `_setActive` in DockNav only tracks one active key — switching to a visualize item clears the integrate:catalog active state. But the explorers persist until explicitly toggled off.

**How to avoid:** The UI-SPEC calls for `aria-pressed` (not `aria-selected`) on the integrate:catalog button, since it's a toggle not a navigation item. Implement `aria-pressed` separately from the DockNav active-item mechanism. On show: `btn.setAttribute('aria-pressed', 'true')`. On hide: `btn.setAttribute('aria-pressed', 'false')`. This keeps the visual active indicator consistent with explorer visibility state regardless of which view is selected.

---

## Code Examples

Verified patterns from existing source (HIGH confidence — read from source):

### Current showDataExplorer / hideDataExplorer structure
```typescript
// main.ts line 632
const dataExplorerEl = shell.getTopSlotEl(); // ← currently THE PARENT

// main.ts line 696
function showDataExplorer(): void {
  if (!dataExplorerMounted) {
    dataExplorerEl.style.display = 'block';  // ← shows PARENT
    dataExplorer = new DataExplorerPanel({...});
    dataExplorer.mount(dataExplorerEl);       // ← mounts into PARENT
    dataExplorerMounted = true;
    // ...
  } else {
    dataExplorerEl.style.display = 'block';  // ← shows PARENT again
    void refreshDataExplorer();
  }
}

function hideDataExplorer(): void {
  if (!dataExplorerMounted) return;
  dataExplorerEl.style.display = 'none';    // ← hides PARENT
}
```

After Phase 152, the parent must be managed by `syncTopSlotVisibility()` and DataExplorer must mount into `dataExplorerChildEl` (the child div).

### Current onActivateItem visualize branch (lines 1008-1018)
```typescript
if (sectionKey === 'visualize') {
  const viewType = itemKey as ViewType;
  const viewContentEl = shell.getViewContentEl();
  viewContentEl.style.opacity = '0';
  void viewManager
    .switchTo(viewType, () => viewFactory[viewType]())
    .then(() => {
      viewContentEl.style.opacity = '1';
    });
  return;  // ← Phase 152 Projections logic inserts BEFORE this return
}
```

### DockNav setActive (line 348) — existing active-item CSS pattern
```typescript
itemEl.classList.add('dock-nav__item--active');
itemEl.setAttribute('aria-current', 'page');
itemEl.setAttribute('aria-selected', 'true');
```

The `dock-nav__item--active` class + `aria-selected` is for navigation items (visualize). For `integrate:catalog` (a toggle), use `aria-pressed` instead.

### PanelRegistry enable/disable lifecycle
```typescript
// PanelRegistry.ts line 54
enable(id: string): void {
  if (!this._panels.has(id)) return;
  this._enableWithDeps(id);  // calls factory() → instance = factory()
  this._notify();
}
// The factory result's mount(container) is called by _enableSingle via factory()
// But wait — _enableSingle calls factory() which returns a PanelHook.
// mount() is called as factory() → PanelHook; mount is not called by registry.
// The caller (main.ts) wires mount in the factory closure itself (line 1371).
```

**Important finding:** PanelRegistry's `_enableSingle` calls `entry.factory()` which returns a `PanelHook`. Looking at line 1370, the Properties factory is `() => ({ mount(container) {...}, update() {}, destroy() {} })`. The PanelRegistry calls `factory()` but does NOT call `mount()` — the factory closure is responsible for mount. This means PanelRegistry does not control which container the panel mounts into. The container is determined entirely by the factory closure captured variables.

This confirms that for Phase 152, the simplest approach is to call the Properties factory directly (bypassing PanelRegistry.enable) OR to rewrite the factory closure to accept `propertiesChildEl` as its mount target before calling `panelRegistry.enable('properties')`.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — pure TypeScript DOM wiring, no CLI tools, services, or runtimes beyond the project's existing Node/Vitest stack)

---

## Validation Architecture

Note: `workflow.research` is `false` in `.planning/config.json` but `workflow.nyquist_validation` key is absent, treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- --reporter=dot` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-01 | Data + Properties appear in top slot on integrate:catalog click | unit (jsdom) | `npm run test -- tests/seams/ui/ -t "integrate:catalog"` | ❌ Wave 0 |
| INTG-02 | Second click hides both explorers | unit (jsdom) | same file | ❌ Wave 0 |
| VIZ-01 | Projections appears when supergrid view activated | unit (jsdom) | `npm run test -- tests/seams/ui/ -t "projections"` | ❌ Wave 0 |
| VIZ-02 | Projections hidden for non-supergrid views | unit (jsdom) | same file | ❌ Wave 0 |
| VIZ-03 | Projections reappears on return to supergrid | unit (jsdom) | same file | ❌ Wave 0 |

These behaviors are DOM/event-wiring tests. Given the project's `tests/seams/` pattern for cross-component integration, the natural home is `tests/seams/ui/inline-embedding.test.ts`.

However, these tests require the full `main.ts` boot sequence which is complex to unit-test in isolation. The project's Playwright E2E suite (which already has 15 specs) may be the more practical validation path for INTG/VIZ requirements. Manual smoke-test is a viable fallback given the low complexity of the wiring.

### Sampling Rate
- **Per task commit:** Manual browser smoke test (open app, click Data toggle, switch to SuperGrid)
- **Per wave merge:** `npm run test` (full suite, regression guard)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/seams/ui/inline-embedding.test.ts` — covers INTG-01, INTG-02, VIZ-01, VIZ-02, VIZ-03 (OR accept Playwright E2E as equivalent)

*(If the planner opts for manual smoke + regression suite only, Wave 0 gap is "None — wiring phase validated by manual smoke and full regression suite.")*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DataExplorer in PanelDrawer side column | DataExplorer in `.workbench-slot-top` | Phase 151 | Top slot is now the sole container for Data, Properties, Projections |
| PanelDrawer side panel for Properties/Projections | Inline top slot | Phase 152 (this phase) | PanelRegistry mount targets change |
| Single explorer in top slot | Three stacked explorer child divs | Phase 152 (this phase) | Parent needs child-aware visibility logic |

---

## Open Questions

1. **aria-pressed vs dock-nav__item--active for integrate:catalog**
   - What we know: DockNav `_setActive` uses `aria-selected` + CSS class. UI-SPEC calls for `aria-pressed="true"` on show.
   - What's unclear: Whether DockNav needs a new `setItemPressed(key, pressed)` public method, or whether `aria-pressed` can be set by `main.ts` via a direct DOM accessor (`dockNav.getItemEl('integrate:catalog')`).
   - Recommendation: Add `setItemPressed(compositeKey: string, pressed: boolean): void` to DockNav — one-line method that finds the element in `_itemEls` and sets the attribute. Minimal surface, correct encapsulation.

2. **Properties Explorer mount strategy: direct vs PanelRegistry**
   - What we know: PanelRegistry does not call `mount()` — the factory closure does. The existing factory closure for `properties` (line 1370) does not know about `propertiesChildEl` yet.
   - What's unclear: Whether to (a) update the factory closure to capture `propertiesChildEl` before calling `panelRegistry.enable('properties')`, or (b) bypass PanelRegistry entirely and instantiate PropertiesExplorer directly.
   - Recommendation: Update the factory closure. The factory at line 1370 uses `container` argument — change the registration to pass `propertiesChildEl` as the mount target. This preserves PanelRegistry lifecycle without bypassing it.

3. **PropertiesExplorer subscribe wiring**
   - What we know: The Properties factory (line 1385) subscribes to `propertiesExplorer.subscribe(() => { projectionExplorer?.update?.(); coordinator.scheduleUpdate(); })`. This subscription must remain active regardless of whether Properties is visible.
   - What's unclear: If Properties is lazy-mounted, is the subscription wired at first mount or should it be wired eagerly?
   - Recommendation: Wire subscription inside the mount factory (as today). The subscription fires on Properties data changes, not on visibility changes — it must be active whenever Properties is mounted, which is from first show onward.

---

## Sources

### Primary (HIGH confidence)
- `src/main.ts` — read directly, lines 620-1035 and 1355-1460
- `src/ui/WorkbenchShell.ts` — read directly, complete file
- `src/ui/DockNav.ts` — read directly, lines 1-395
- `src/ui/panels/PanelRegistry.ts` — read directly, complete file
- `src/ui/section-defs.ts` — read directly, complete file
- `src/styles/workbench.css` — read directly, complete file
- `.planning/phases/152-integrate-visualize-inline-embedding/152-CONTEXT.md` — read directly
- `.planning/phases/152-integrate-visualize-inline-embedding/152-UI-SPEC.md` — read directly
- `.planning/REQUIREMENTS.md` — read directly

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — project constraints, Phase 151 decisions

### Tertiary (LOW confidence)
- None

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 152 |
|-----------|---------------------|
| Think before coding — state assumptions explicitly | Planner must document the `dataExplorerEl` → child div migration as an explicit assumption in task descriptions |
| Simplicity first — minimum code, no speculative abstractions | `syncTopSlotVisibility()` should be a 3-line helper, not a class |
| Surgical changes — touch only what you must | Only `main.ts` and `workbench.css` change; no other files |
| Match existing style | Use `element.style.display = 'block'/'none'` pattern exactly (no classList toggle) |
| TDD non-negotiable (from MEMORY.md) | Wave 0 must establish test coverage or explicit manual-smoke justification |
| No bare element selectors in CSS (SHEL-06) | New child div selectors must start with `.slot-top__` or `.workbench-` |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all verified from source
- Architecture: HIGH — all patterns derived from reading actual source code
- Pitfalls: HIGH — all identified by reading current `main.ts` implementation
- Open questions: MEDIUM — recommendations are judgment calls at Claude's discretion

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable codebase, no external dependencies)
