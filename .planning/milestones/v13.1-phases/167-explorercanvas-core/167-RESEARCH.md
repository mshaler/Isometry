# Phase 167: ExplorerCanvas Core - Research

**Researched:** 2026-04-21
**Domain:** SuperWidget canvas plug-in implementation / DataExplorerPanel lifecycle
**Confidence:** HIGH

## Summary

Phase 167 replaces `ExplorerCanvasStub` with a real `ExplorerCanvas` class that wraps `DataExplorerPanel` inside the SuperWidget canvas slot. All three requirements (EXCV-01, EXCV-04, EXCV-05) are achievable by following patterns already established in the codebase — no new patterns need to be invented.

The work has four distinct concerns: (1) create `src/superwidget/ExplorerCanvas.ts` implementing `CanvasComponent`; (2) register it in `registry.ts` via a closure that captures the 7 `DataExplorerPanelConfig` callbacks from `main.ts`; (3) expose the `DataExplorerPanel` instance reference so `refreshDataExplorer()` can still call `updateStats()` / `updateRecentCards()`; (4) remove the sidebar `dataExplorerChildEl` wiring from `main.ts` and `PanelManager` configuration.

The CANV-06 contract (SuperWidget.ts has zero import references to `ExplorerCanvas`) is already tested by `tests/superwidget/registry.test.ts` — no new test infrastructure is needed for that guarantee. The existing test file structure in `tests/superwidget/` uses `@vitest-environment jsdom` and runs under Vitest 4.x with jsdom.

**Primary recommendation:** Create `ExplorerCanvas.ts` as a thin wrapper over `DataExplorerPanel`. Capture callbacks in the `create` closure in `main.ts`. Expose the panel instance via a getter or return value so `refreshDataExplorer()` retains its call target. Remove sidebar wiring cleanly.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Section Re-use Strategy:** Mount the entire DataExplorerPanel instance inside the canvas slot container. All 4 sections (Import/Export, Catalog, Apps, DB Utilities) appear as-is. No refactoring of private `_build*Section()` methods. Phase 168 later hides/shows sections for tab switching.

**D-02 — Callback Wiring:** Closure capture at registration time. When registering ExplorerCanvas in the canvas registry, the `create` closure captures the 7 DataExplorerPanelConfig callbacks from the surrounding scope in main.ts (where bridge, worker, and UI context are available). The `CanvasRegistryEntry.create()` factory signature remains unchanged — no new parameters or abstractions.

**D-03 — Sidebar Coexistence:** Replace — remove the sidebar DataExplorerPanel entirely. SuperWidget's canvas slot becomes the only place DataExplorerPanel lives. The Integrate dock section no longer toggles an inline DataExplorerPanel. This means SuperWidget must be visible/mounted for users to access import/export/catalog.

### Claude's Discretion

- ExplorerCanvas internal class structure (private fields, method names) — follow existing stub/panel conventions
- How to clean up the sidebar DataExplorerPanel wiring in main.ts (removal of `dataExplorerChildEl`, toggle logic, etc.)
- Whether `registerAllStubs()` is replaced or supplemented with a new `registerExplorerCanvas()` call

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXCV-01 | ExplorerCanvas implements CanvasComponent (mount/destroy) and replaces ExplorerCanvasStub in the canvas registry | `CanvasComponent` interface is `mount(container: HTMLElement): void` + `destroy(): void` in `src/superwidget/projection.ts`. Registry `register()` call with `canvasId: 'explorer-1'` replaces stub. `registerAllStubs()` can be modified to call real implementation or supplemented. |
| EXCV-04 | ExplorerCanvas mount re-uses existing DataExplorerPanel section DOM builders without rewriting business logic | `DataExplorerPanel.mount(container)` calls all 4 `_build*Section()` methods internally — ExplorerCanvas just instantiates `DataExplorerPanel` with config and calls `mount()`. No private method access needed. |
| EXCV-05 | SuperWidget.ts maintains zero references to ExplorerCanvas class (CANV-06 contract preserved) | `tests/superwidget/registry.test.ts` line 122-145 already enforces this via `readFileSync` content check. ExplorerCanvas is only accessed through the factory closure — no import in SuperWidget.ts. |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies)

| Component | Version | Purpose | Source |
|-----------|---------|---------|--------|
| TypeScript | 5.9 (strict) | Implementation language | Existing |
| Vitest 4.x | 4.0 | Test runner | Existing |
| jsdom | via `@vitest-environment jsdom` | DOM test environment for superwidget tests | Existing |

No new npm packages are required. This phase is entirely new TypeScript class + wiring changes.

**Installation:** none

---

## Architecture Patterns

### Recommended File Structure

```
src/superwidget/
├── ExplorerCanvas.ts       ← NEW (replaces ExplorerCanvasStub as active implementation)
├── ExplorerCanvasStub.ts   ← KEEP (still imported by registry.ts — see registry notes)
├── registry.ts             ← MODIFY (register ExplorerCanvas for 'explorer-1')
├── SuperWidget.ts          ← UNCHANGED (zero references to ExplorerCanvas — CANV-06)
└── projection.ts           ← UNCHANGED

tests/superwidget/
├── ExplorerCanvas.test.ts  ← NEW (mirrors ExplorerCanvasStub.test.ts structure)
└── registry.test.ts        ← MAY UPDATE (update stub tests if registerAllStubs changes)

src/
└── main.ts                 ← MODIFY (remove sidebar wiring, add ExplorerCanvas registration)
```

### Pattern 1: CanvasComponent Implementation

`ExplorerCanvas` follows the identical shape as `ExplorerCanvasStub`. Key difference: `mount()` instantiates `DataExplorerPanel`, calls `panel.mount(wrapperEl)`, mounts catalog grid, and calls `refreshDataExplorer()`.

```typescript
// Source: src/superwidget/ExplorerCanvasStub.ts (pattern to follow)
import type { CanvasComponent } from './projection';
import { DataExplorerPanel } from '../ui/DataExplorerPanel';
import type { DataExplorerPanelConfig } from '../ui/DataExplorerPanel';

export class ExplorerCanvas implements CanvasComponent {
  private _config: DataExplorerPanelConfig;
  private _panel: DataExplorerPanel | null = null;
  private _wrapperEl: HTMLElement | null = null;

  constructor(config: DataExplorerPanelConfig) {
    this._config = config;
  }

  mount(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'explorer-canvas';
    this._wrapperEl = wrapper;
    this._panel = new DataExplorerPanel(this._config);
    this._panel.mount(wrapper);
    container.appendChild(wrapper);
  }

  destroy(): void {
    this._panel?.destroy();
    this._panel = null;
    this._wrapperEl?.remove();
    this._wrapperEl = null;
  }

  // Expose panel reference so main.ts can call updateStats/updateRecentCards
  getPanel(): DataExplorerPanel | null {
    return this._panel;
  }
}
```

### Pattern 2: Registry Closure Capture (D-02)

The registration happens in `main.ts` where bridge, worker, and all 7 callback dependencies are in scope. The existing `PanelRegistry` factory pattern (lines 1525-1694 in main.ts) shows the exact closure capture style:

```typescript
// Source: src/main.ts ~line 1534 (PanelRegistry factory pattern)
// In main.ts, after bridge/worker/etc are initialized:
import { register, getCanvasFactory, clearRegistry } from './superwidget/registry';
import { ExplorerCanvas } from './superwidget/ExplorerCanvas';
import { SuperWidget } from './superwidget/SuperWidget';

// Register real ExplorerCanvas — callbacks captured from surrounding scope
register('explorer-1', {
  canvasType: 'Explorer',
  create: () => new ExplorerCanvas({
    onImportFile: importFileHandler,
    onExport: (format) => { /* ... */ },
    onExportDatabase: async () => { /* ... */ },
    onVacuum: async () => { /* ... */ },
    onFileDrop: (file) => { /* ... */ },
    onSelectCard: (cardId) => { selection.select(cardId); },
    onPickAltoDirectory: () => { /* ... */ },
  }),
});

const widget = new SuperWidget(getCanvasFactory());
```

### Pattern 3: refreshDataExplorer() Continuity

The `refreshDataExplorer()` function in main.ts currently holds a reference to `dataExplorer: DataExplorerPanel | null`. After this phase, `dataExplorer` is no longer directly managed by PanelManager — it lives inside `ExplorerCanvas`. Two viable approaches:

**Option A (recommended): Track ExplorerCanvas instance in main.ts scope**

```typescript
let explorerCanvas: ExplorerCanvas | null = null;

register('explorer-1', {
  canvasType: 'Explorer',
  create: () => {
    const canvas = new ExplorerCanvas({ ... });
    explorerCanvas = canvas;
    return canvas;
  },
});

async function refreshDataExplorer(): Promise<void> {
  const panel = explorerCanvas?.getPanel();
  if (!panel) return;
  const stats = await bridge.send('datasets:stats', {});
  panel.updateStats(stats);
  const recentCards = await bridge.send('datasets:recent-cards', {});
  panel.updateRecentCards(recentCards);
  catalogGrid?.refresh();
}
```

**Option B: Keep `dataExplorer` variable, assign in create closure**

```typescript
create: () => {
  const canvas = new ExplorerCanvas({ ... });
  dataExplorer = canvas.getPanel(); // assign to existing var
  return canvas;
},
```

Option A is cleaner — tracks the canvas directly rather than reaching through it for the panel. Option B preserves the existing `dataExplorer` variable name used throughout main.ts.

**Recommendation:** Option B minimizes diff size — the existing `dataExplorer` variable and `refreshDataExplorer()` body stay unchanged. Just assign `dataExplorer = canvas.getPanel()` inside the `create` closure. On `destroy`, the SuperWidget tears down the canvas; the `dataExplorer` reference becomes stale but `refreshDataExplorer()` guards on `if (!dataExplorer) return` already.

**Critical:** `catalogGrid` must also be mounted from within the `create` closure (same as current PanelRegistry factory pattern). `ExplorerCanvas.getPanel().getCatalogBodyEl()` returns the element to mount into.

### Pattern 4: Sidebar Removal (D-03)

The sidebar wiring spans three locations in main.ts:

1. **Line 642-645:** `dataExplorerChildEl` creation and append to `topSlotEl` — remove these 4 lines
2. **Lines 659-660:** `dataExplorerChildEl.style.display !== 'none'` check in `syncTopSlotVisibility()` — remove this condition arm
3. **Line 1701:** `{ id: 'data-explorer', container: dataExplorerChildEl, slot: 'top' }` in PanelManager slots array — remove this entry
4. **Lines 1525-1694:** The entire `panelRegistry.register(...)` block for `'data-explorer'` — remove (the factory is replaced by the direct `register()` call with `ExplorerCanvas`)

After removal, the `'integrate'` group in PanelManager (`groups: [{ name: 'integrate', panelIds: ['data-explorer', 'properties'] }]`) must also be updated to remove `'data-explorer'`.

### Pattern 5: registerAllStubs() vs. Direct register()

**Decision (Claude's Discretion):** The cleanest approach is to NOT modify `registerAllStubs()`. Instead, in `main.ts`, call `register('explorer-1', ...)` with the real `ExplorerCanvas` factory *after* calling `registerAllStubs()`. The `register()` function uses `_registry.set()` which overwrites any existing entry for `'explorer-1'`. This means:
- `registerAllStubs()` still works for unit tests that want stub behavior
- Integration tests can selectively override `'explorer-1'` with a real ExplorerCanvas
- No changes to `ExplorerCanvasStub.ts` (still imported by registry.ts for `registerAllStubs`)

Alternatively, skip `registerAllStubs()` in main.ts entirely and register all three manually. This is also clean but more verbose. The overwrite approach is simpler.

### Anti-Patterns to Avoid

- **Importing ExplorerCanvas in SuperWidget.ts:** CANV-06 contract forbids this. The existing test in `registry.test.ts` lines 121-145 enforces it via source text check — it will catch the violation.
- **Calling DataExplorerPanel._build*Section() directly:** These are private. ExplorerCanvas calls `panel.mount(container)` which runs all 4 builders internally.
- **Adding new parameters to CanvasRegistryEntry.create():** D-02 explicitly locks the signature as `(binding?: CanvasBinding) => CanvasComponent`. The callbacks are captured via closure, not passed as parameters.
- **Creating a separate `explorer-canvas.css` file:** UI-SPEC mandates new styles go in `src/styles/superwidget.css` scoped to `[data-component="superwidget"] .explorer-canvas`.
- **Forgetting to mount catalogGrid in create closure:** `getCatalogBodyEl()` only returns non-null after `DataExplorerPanel.mount()` has been called, so catalogGrid must be mounted after the panel mounts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section content | Custom builders | `DataExplorerPanel.mount()` | All 4 section builders are private and already complete |
| Event cleanup | Manual handler tracking | `DataExplorerPanel.destroy()` | Already tracks drag handlers, removes listeners on destroy |
| Collapsible sections | Custom accordion | `CollapsibleSection` (already used by DataExplorerPanel) | Persistence, keyboard, state management built in |
| Canvas registration seam | Module-level import | `register()` + `getCanvasFactory()` | CANV-06 contract — registry IS the seam |

---

## Common Pitfalls

### Pitfall 1: catalogGrid Mount Race

**What goes wrong:** Mounting `catalogGrid` before `DataExplorerPanel.mount()` is called means `getCatalogBodyEl()` returns `null` and catalogGrid silently skips mounting.

**Why it happens:** `_catalogBodyEl` is set inside `DataExplorerPanel._buildCatalogSection()` which runs during `mount()`.

**How to avoid:** Always mount the catalog grid *after* calling `panel.mount(wrapperEl)`. The sequence is:
```
panel.mount(wrapperEl)
const bodyEl = panel.getCatalogBodyEl()  // non-null only after mount
if (bodyEl) { catalogGrid = new CatalogSuperGrid({...}); catalogGrid.mount(bodyEl); }
```

### Pitfall 2: Stale dataExplorer Reference After SuperWidget Destroy

**What goes wrong:** When SuperWidget destroys the ExplorerCanvas, the `dataExplorer` variable in main.ts still points to the destroyed `DataExplorerPanel` instance. If `refreshDataExplorer()` is triggered, it calls `updateStats()` on a panel whose DOM has been removed.

**Why it happens:** ExplorerCanvas.destroy() calls `panel.destroy()` (removes DOM) but the outer reference in main.ts is not nulled.

**How to avoid:** Either (a) null `dataExplorer` in the `create` closure's returned object (if ExplorerCanvas exposes an `onDestroy` hook), or (b) accept the stale reference — `panel.updateStats()` writes to `_statsEls` which are DOM refs that simply don't exist anymore. No crash, just a no-op. The simpler approach: `refreshDataExplorer()` already guards `if (!dataExplorer) return` — the only problem is it won't know the panel was destroyed. For Phase 167 scope, this is acceptable since SuperWidget isn't destroyed during normal operation.

### Pitfall 3: CANV-06 Test Catches Import via re-export

**What goes wrong:** If `ExplorerCanvas.ts` is imported from `registry.ts`, and `registry.ts` is imported from `SuperWidget.ts`, the CANV-06 text check (`readFileSync` of `SuperWidget.ts`) won't catch it — but the spirit of CANV-06 is violated.

**Why it happens:** The test only checks `SuperWidget.ts` source text, not its transitive imports.

**How to avoid:** Import `ExplorerCanvas` only in `main.ts` (the registration site), not in `registry.ts`. `registry.ts` imports only interfaces (`CanvasComponent`, `CanvasBinding`) — concrete classes go through `main.ts` closures.

### Pitfall 4: Sidebar 'data-explorer' PanelRegistry Entry Still Active

**What goes wrong:** If the PanelRegistry entry for `'data-explorer'` is not removed, the Integrate dock section may still try to mount a DataExplorerPanel into the sidebar `dataExplorerChildEl` — but that element no longer exists, causing a `null.appendChild()` crash or silently mounting nowhere.

**Why it happens:** `panelRegistry.register()` wires the factory. PanelManager owns lifetime. If the entry remains, toggling the Integrate section calls the factory.

**How to avoid:** Remove the entire `panelRegistry.register({ id: 'data-explorer', ... }, () => ({ ... }))` block from main.ts. Also remove `{ id: 'data-explorer', container: dataExplorerChildEl, slot: 'top' }` from PanelManager slots and `'data-explorer'` from the `'integrate'` group.

---

## Code Examples

### ExplorerCanvas CSS wrapper (in superwidget.css)

```css
/* Source: 167-UI-SPEC.md CSS Authoring Rules */
[data-component="superwidget"] .explorer-canvas {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: auto;
}
```

### Test shape for ExplorerCanvas (mirrors ExplorerCanvasStub.test.ts)

```typescript
// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { ExplorerCanvas } from '../../src/superwidget/ExplorerCanvas';
import type { DataExplorerPanelConfig } from '../../src/ui/DataExplorerPanel';

function makeConfig(): DataExplorerPanelConfig {
  return {
    onImportFile: () => {},
    onExport: () => {},
    onExportDatabase: async () => {},
    onVacuum: async () => {},
    onFileDrop: () => {},
    onSelectCard: () => {},
    onPickAltoDirectory: () => {},
  };
}

describe('EXCV-01: ExplorerCanvas mount lifecycle', () => {
  let container: HTMLElement;
  let canvas: ExplorerCanvas;

  beforeEach(() => {
    container = document.createElement('div');
    canvas = new ExplorerCanvas(makeConfig());
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('mount appends .explorer-canvas wrapper to container', () => {
    canvas.mount(container);
    expect(container.querySelector('.explorer-canvas')).not.toBeNull();
  });

  it('mount produces real DataExplorerPanel DOM (not stub label)', () => {
    canvas.mount(container);
    // DataExplorerPanel renders .data-explorer root
    expect(container.querySelector('.data-explorer')).not.toBeNull();
    // No stub placeholder text
    expect(container.textContent).not.toContain('[Explorer:');
  });

  it('destroy removes .explorer-canvas wrapper from container', () => {
    canvas.mount(container);
    canvas.destroy();
    expect(container.querySelector('.explorer-canvas')).toBeNull();
  });

  it('destroy() before mount() does not throw', () => {
    expect(() => canvas.destroy()).not.toThrow();
  });
});

describe('EXCV-04: ExplorerCanvas re-uses DataExplorerPanel section builders', () => {
  it('mount produces Import/Export section', () => {
    const container = document.createElement('div');
    const canvas = new ExplorerCanvas(makeConfig());
    canvas.mount(container);
    expect(container.querySelector('.data-explorer__import-btn')).not.toBeNull();
    canvas.destroy();
  });

  it('getCatalogBodyEl() returns element after mount', () => {
    const container = document.createElement('div');
    const canvas = new ExplorerCanvas(makeConfig());
    canvas.mount(container);
    expect(canvas.getPanel()?.getCatalogBodyEl()).not.toBeNull();
    canvas.destroy();
  });
});
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/superwidget/ExplorerCanvas.test.ts` |
| Full suite command | `npx vitest run tests/superwidget/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXCV-01 | ExplorerCanvas mounts/destroys as CanvasComponent | unit | `npx vitest run tests/superwidget/ExplorerCanvas.test.ts` | Wave 0 |
| EXCV-01 | Registry returns ExplorerCanvas (not stub) for 'explorer-1' | unit | `npx vitest run tests/superwidget/registry.test.ts` | Existing — may need update |
| EXCV-04 | mount() produces DataExplorerPanel DOM, not stub text | unit | `npx vitest run tests/superwidget/ExplorerCanvas.test.ts` | Wave 0 |
| EXCV-04 | getCatalogBodyEl() non-null after mount | unit | `npx vitest run tests/superwidget/ExplorerCanvas.test.ts` | Wave 0 |
| EXCV-05 | SuperWidget.ts has no ExplorerCanvas reference | static text check | `npx vitest run tests/superwidget/registry.test.ts` | Existing — passes as long as ExplorerCanvas not imported in SuperWidget.ts |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/superwidget/`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/superwidget/ExplorerCanvas.test.ts` — covers EXCV-01, EXCV-04

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is a pure TypeScript class + DOM wiring change. No new CLIs, databases, or services required.)

---

## Open Questions

1. **catalogGrid destruction on ExplorerCanvas.destroy()**
   - What we know: `catalogGrid` is a module-level variable in main.ts; `ExplorerCanvas.destroy()` only tears down the DataExplorerPanel.
   - What's unclear: Does `catalogGrid` need explicit destruction when the canvas is destroyed? `DataExplorerPanel.destroy()` removes `_catalogBodyEl` from DOM, which implicitly removes catalog grid DOM — but `catalogGrid` instance holds listeners.
   - Recommendation: Set `catalogGrid = null` inside the `create` closure's returned canvas `destroy()` path, or have ExplorerCanvas accept an `onDestroy` callback. Simpler: reference-track `catalogGrid` inside the `create` closure and null it when the canvas is destroyed. Phase 167 scope — acceptable to null it and let GC handle listener cleanup if `CatalogSuperGrid` doesn't have critical teardown.

2. **registerAllStubs() mutation vs. supplemental register()**
   - What we know: `registerAllStubs()` registers `'explorer-1'` with `ExplorerCanvasStub`. Calling `register('explorer-1', ...)` after would overwrite it.
   - What's unclear: Whether tests that call `registerAllStubs()` expect stub behavior to persist.
   - Recommendation: In main.ts, call `registerAllStubs()` then immediately overwrite `'explorer-1'` with the real ExplorerCanvas. Unit tests call `clearRegistry()` in `beforeEach` and `registerAllStubs()` directly — they remain unaffected. The overwrite happens only in the production main.ts boot path.

---

## Sources

### Primary (HIGH confidence)

All findings are from direct source file reads — no external documentation required for this phase.

- `src/superwidget/projection.ts` — `CanvasComponent` interface definition (mount/destroy)
- `src/superwidget/registry.ts` — `register()`, `getCanvasFactory()`, `registerAllStubs()` implementation
- `src/superwidget/SuperWidget.ts` — `commitProjection()` canvas lifecycle, `CanvasFactory` type
- `src/superwidget/ExplorerCanvasStub.ts` — stub pattern to follow
- `src/ui/DataExplorerPanel.ts` — `DataExplorerPanelConfig`, mount/destroy/getCatalogBodyEl/updateStats/updateRecentCards API
- `src/main.ts` lines 620-700, 1520-1714 — current sidebar wiring and PanelRegistry factory
- `tests/superwidget/registry.test.ts` — CANV-06 enforcement test (lines 121-145)
- `tests/superwidget/ExplorerCanvasStub.test.ts` — test shape to mirror
- `tests/superwidget/integration.test.ts` — full projection-to-DOM integration test pattern
- `.planning/phases/167-explorercanvas-core/167-UI-SPEC.md` — CSS authoring rules, interaction contract

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technology is existing project stack, no new dependencies
- Architecture patterns: HIGH — patterns are directly readable from existing codebase files
- Pitfalls: HIGH — identified from direct code inspection of integration points
- Test shape: HIGH — mirrors existing test files in `tests/superwidget/`

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable codebase — no external dependencies)
