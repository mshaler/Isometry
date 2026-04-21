# Phase 170: Integration Testing — Research

**Researched:** 2026-04-21
**Domain:** Vitest cross-seam integration tests + Playwright WebKit smoke test for ExplorerCanvas
**Confidence:** HIGH

## Summary

Phase 170 is a testing-only phase with no new production code. It verifies the full ExplorerCanvas path built in Phases 167-169 through two complementary mechanisms: Vitest cross-seam tests that mount ExplorerCanvas via the registry (not by direct import) and assert real DataExplorerPanel DOM, and a Playwright WebKit smoke test that exercises tab switching in the harness.

The test infrastructure is well-established — Phase 166 (integration.test.ts and superwidget-smoke.spec.ts) provides the exact patterns to follow. The primary research task is understanding the exact selectors, wiring, and mocking strategy needed for the four new requirements (EINT-01 through EINT-04). All findings are HIGH confidence because they come directly from reading the production source files.

**Primary recommendation:** Extend integration.test.ts with a new describe block for EINT-01..03 that registers the real ExplorerCanvas (not the stub) for canvasId 'explorer-1'. For EINT-03, call renderStatusSlot + updateStatusSlot directly on the widget's statusEl — this is the lightest valid approach since it tests the same functions main.ts calls. Extend (or add a new test block to) superwidget-smoke.spec.ts for EINT-04 after updating the harness HTML to register the real ExplorerCanvas.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked — all decisions fall under Claude's Discretion.

### Claude's Discretion
- Test file organization: new file vs extending existing `integration.test.ts` — pick whichever keeps v13.0 stub tests (INTG-01..06) separate from v13.1 real-canvas tests (EINT-01..04)
- Playwright smoke: extend `superwidget-smoke.spec.ts` or new spec — pick whichever keeps the v13.0 transition matrix test clean
- Import simulation approach for EINT-03: mock Worker bridge stats response vs real mini-pipeline — pick the lightest approach that still proves the status slot wiring
- Registry wiring for cross-seam tests: real ExplorerCanvas registered alongside stubs for View/Editor — follow the `registerAllStubs()` + selective real registration pattern

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EINT-01 | Cross-seam test verifies ExplorerCanvas mount produces real DataExplorerPanel content (not stub placeholder) | Covered by registry pattern: clearRegistry() + registerAllStubs() + override 'explorer-1' with real ExplorerCanvas; assert `.data-explorer__import-btn` present and `.explorer-canvas-stub` absent |
| EINT-02 | Cross-seam test verifies tab switching between Import/Export, Catalog, and DB Utilities tabs | commitProjection with activeTabId switched to 'catalog' then 'db-utilities'; assert [data-tab-container].classList.contains('active') and [data-tab-active="true"] selector |
| EINT-03 | Cross-seam test verifies status slot ingestion counts update after a simulated import | renderStatusSlot(widget.statusEl) then updateStatusSlot(widget.statusEl, stats) with non-zero counts; assert [data-stat="cards"] textContent; no canvas re-render means canvasEl renderCount stays unchanged |
| EINT-04 | Playwright WebKit smoke test updated to exercise ExplorerCanvas with tab switching | superwidget-harness.html must register real ExplorerCanvas; page.evaluate(__sw.commitProjection with activeTabId); assert .explorer-canvas visible and [data-tab-active="true"] on catalog tab |
</phase_requirements>

---

## Standard Stack

### Core (all pre-existing — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 4.0 | Unit/integration test runner | Project standard |
| jsdom | (Vitest dep) | DOM environment for cross-seam tests | @vitest-environment jsdom annotation |
| Playwright | (existing) | E2E browser automation | WebKit CI gate |

**No new packages required.** All tools are already installed.

### Key Configuration Facts

- Vitest default environment is `node` (WASM). jsdom tests require `// @vitest-environment jsdom` file-level annotation.
- Playwright `playwright.config.ts` routes `**/superwidget-smoke.spec.ts` to WebKit project. New smoke tests in a separate file require adding a `testMatch` to the webkit project config, OR placing the spec in the same file.
- Vitest `pool: 'forks'` + `isolate: true` means each test file is fully isolated — registry state does not leak between files.

---

## Architecture Patterns

### Pattern 1: Cross-Seam Test with Real Canvas Registration

The Phase 166 pattern (INTG-01..06) uses stubs everywhere. For EINT-01..04, the modification is minimal: after `registerAllStubs()`, override the 'explorer-1' entry with a real ExplorerCanvas factory.

```typescript
// @vitest-environment jsdom
import { clearRegistry, getCanvasFactory, register, registerAllStubs } from '../../src/superwidget/registry';
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

beforeEach(() => {
  clearRegistry();
  registerAllStubs();  // registers stubs for view-1, editor-1
  // Override explorer-1 with real ExplorerCanvas
  register('explorer-1', {
    canvasType: 'Explorer',
    create: () => new ExplorerCanvas(makeConfig(), (proj) => widget.commitProjection(proj)),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  widget = new SuperWidget(getCanvasFactory());
  widget.mount(container);
});
```

**Critical detail:** The `commitProjection` callback passed to ExplorerCanvas must reference `widget` — but `widget` is declared before the callback is needed. Forward reference via closure works because the callback is only called after mount, not during construction.

### Pattern 2: Explorer Projection Shape

The real ExplorerCanvas requires `activeTabId` to be one of `'import-export'`, `'catalog'`, or `'db-utilities'` (as defined in ExplorerCanvas.ts TAB_DEFS). The Phase 166 tests used generic `'tab-1'` / `'tab-2'` tab IDs which are only valid for stubs.

```typescript
function makeExplorerProjection(overrides: Partial<Projection> = {}): Projection {
  return {
    canvasType: 'Explorer',
    canvasBinding: 'Unbound',
    zoneRole: 'primary',
    canvasId: 'explorer-1',
    activeTabId: 'import-export',
    enabledTabIds: ['import-export', 'catalog', 'db-utilities'],
    ...overrides,
  };
}
```

### Pattern 3: EINT-03 Status Slot Simulation (Lightest Approach)

The lightest approach that proves wiring without a real Worker bridge:

1. Call `renderStatusSlot(widget.statusEl)` — same as main.ts does at boot
2. Capture `canvasEl.dataset['renderCount']` before update
3. Call `updateStatusSlot(widget.statusEl, { card_count: 42, connection_count: 7, last_import_at: new Date().toISOString() })`
4. Assert `[data-stat="cards"]` textContent is `'42 cards'`
5. Assert `canvasEl.dataset['renderCount']` is unchanged (STAT-04 cross-seam proof)

This approach tests the exact same code path that main.ts's `refreshDataExplorer()` calls. No Worker mock needed — the status slot functions are pure DOM manipulators.

```typescript
import { renderStatusSlot, updateStatusSlot } from '../../src/superwidget/statusSlot';

it('EINT-03: status slot updates card count without canvas re-render', () => {
  widget.commitProjection(makeExplorerProjection());
  renderStatusSlot(widget.statusEl);

  const renderCountBefore = widget.canvasEl.dataset['renderCount'];

  updateStatusSlot(widget.statusEl, {
    card_count: 42,
    connection_count: 7,
    last_import_at: new Date().toISOString(),
  });

  expect(widget.statusEl.querySelector('[data-stat="cards"]')!.textContent).toBe('42 cards');
  expect(widget.statusEl.querySelector('[data-stat="connections"]')!.textContent).toBe('7 connections');
  expect(widget.canvasEl.dataset['renderCount']).toBe(renderCountBefore);
});
```

### Pattern 4: EINT-04 Playwright Harness Update

The existing `superwidget-harness.html` uses `registerAllStubs()` only. It must be updated to register the real ExplorerCanvas for the 'explorer-1' canvas ID and commit an initial ExplorerCanvas projection.

```html
<script type="module">
  import { SuperWidget } from '/src/superwidget/SuperWidget.ts';
  import { registerAllStubs, getCanvasFactory, register } from '/src/superwidget/registry.ts';
  import { ExplorerCanvas } from '/src/superwidget/ExplorerCanvas.ts';
  import { renderStatusSlot } from '/src/superwidget/statusSlot.ts';

  registerAllStubs();

  let sw;
  register('explorer-1', {
    canvasType: 'Explorer',
    create: () => new ExplorerCanvas(
      { onImportFile: () => {}, onExport: () => {}, onExportDatabase: async () => {},
        onVacuum: async () => {}, onFileDrop: () => {}, onSelectCard: () => {},
        onPickAltoDirectory: () => {} },
      (proj) => sw.commitProjection(proj)
    ),
  });

  sw = new SuperWidget(getCanvasFactory());
  sw.mount(document.getElementById('root'));

  const initialProjection = {
    canvasType: 'Explorer', canvasBinding: 'Unbound', zoneRole: 'primary',
    canvasId: 'explorer-1', activeTabId: 'import-export',
    enabledTabIds: ['import-export', 'catalog', 'db-utilities'],
  };
  sw.commitProjection(initialProjection);
  renderStatusSlot(sw.statusEl);

  window.__sw = {
    commitProjection: (proj) => sw.commitProjection(proj),
    getWidget: () => sw,
  };
</script>
```

The Playwright test then exercises tab switching:

```typescript
// In superwidget-smoke.spec.ts or new explorercanvas-smoke.spec.ts
test('ExplorerCanvas tab switching in WebKit', async ({ page }) => {
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => !!(window as any).__sw, { timeout: 10_000 });

  // EINT-01: real canvas rendered
  await expect(page.locator('.explorer-canvas')).toBeVisible();
  await expect(page.locator('[data-tab-id="import-export"][data-tab-active="true"]')).toBeVisible();

  // EINT-04: tab switch
  await page.evaluate(() => {
    (window as any).__sw.commitProjection({
      canvasType: 'Explorer', canvasBinding: 'Unbound', zoneRole: 'primary',
      canvasId: 'explorer-1', activeTabId: 'catalog',
      enabledTabIds: ['import-export', 'catalog', 'db-utilities'],
    });
  });
  await expect(page.locator('[data-tab-id="catalog"][data-tab-active="true"]')).toBeVisible();
  await expect(page.locator('[data-tab-id="import-export"]')).not.toHaveAttribute('data-tab-active', 'true');
});
```

### Recommended Project Structure

No new directories needed. Two touch points:

```
tests/superwidget/
├── integration.test.ts          # EXTEND with new describe block for EINT-01..03
└── (existing files unchanged)

e2e/
├── fixtures/superwidget-harness.html   # UPDATE to register real ExplorerCanvas
└── superwidget-smoke.spec.ts           # EXTEND or new explorercanvas-smoke.spec.ts
```

**File organization decision:** Create a new `tests/superwidget/explorer-canvas-integration.test.ts` file rather than extending `integration.test.ts`. The existing INTG-01..06 tests use stub canvases and generic tab IDs — a separate file keeps the v13.0 and v13.1 test suites clearly separated and avoids confusion.

**Playwright decision:** Add a new describe block inside `superwidget-smoke.spec.ts` rather than a new file. The webkit project `testMatch` in playwright.config.ts already covers this file, and EINT-04 stays alongside the v13.0 transition matrix test.

**IMPORTANT:** The harness HTML update affects the existing INTG-07 Playwright test. After updating the harness to register a real ExplorerCanvas for 'explorer-1', the v13.0 test commits `canvasType: 'Explorer'` with `activeTabId: 'tab-1'` — this will FAIL because the real ExplorerCanvas only recognizes `'import-export'`, `'catalog'`, `'db-utilities'` as valid tab IDs. The harness update must preserve INTG-07 compatibility. Safest approach: keep the harness registering stubs for the transition matrix test, and have the ExplorerCanvas smoke test navigate to a separate harness URL (e.g. `explorercanvas-harness.html`). This avoids modifying the v13.0 harness.

### Anti-Patterns to Avoid

- **Using `'tab-1'` tab IDs with real ExplorerCanvas**: The real canvas uses `'import-export'`, `'catalog'`, `'db-utilities'`. A projection with `activeTabId: 'tab-1'` will pass validation (since it's in enabledTabIds if you put it there), but `onProjectionChange` won't activate any container.
- **Direct ExplorerCanvas instantiation for cross-seam tests**: EINT-01 specifically requires registry-based mount (via `getCanvasFactory()`), not `new ExplorerCanvas(...)` directly. The unit tests (ExplorerCanvas.test.ts, EXCV-01..04) already cover direct instantiation.
- **Modifying ExplorerCanvas.test.ts or statusSlot.test.ts**: These cover different requirements. Don't add EINT tests there.
- **Importing DataExplorerPanel in test files**: The cross-seam test should not import DataExplorerPanel directly. Asserting `.data-explorer__import-btn` exists in the DOM proves DataExplorerPanel content without coupling to its class.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status stats mock | Custom Worker mock | Call `updateStatusSlot()` directly with inline stats object | statusSlot functions are pure DOM — no Worker needed for EINT-03 |
| Tab visibility check | Custom CSS parser | `.classList.contains('active')` | Tab visibility is CSS class, not computed style — established in Phase 168 D-03 |
| DOM environment for tests | jsdom setup | `// @vitest-environment jsdom` annotation | Already the project pattern |
| Playwright webkit project | New playwright.config entry | Add describe block to existing spec (already in webkit testMatch) | Less config surface |

---

## Common Pitfalls

### Pitfall 1: Harness HTML Regression
**What goes wrong:** Updating `superwidget-harness.html` to use real ExplorerCanvas breaks INTG-07, which commits an Explorer projection with `activeTabId: 'tab-1'` (stub-valid, not real-canvas-valid).
**Why it happens:** The stub's `onProjectionChange` is a no-op; the real canvas's `onProjectionChange` tries to find a container with `data-tab-container="tab-1"` and silently fails — but the test asserts `.explorer-canvas` type attribute presence, not tab state, so it may not immediately fail. However the commitProjection with `activeTabId: 'tab-1'` would pass `validateProjection` (since it's in `enabledTabIds`) but the tab switching logic inside ExplorerCanvas silently does nothing.
**How to avoid:** Create a separate `explorercanvas-harness.html` fixture for EINT-04 tests. Keep `superwidget-harness.html` unchanged for INTG-07.
**Warning signs:** INTG-07 assertions pass but tab visibility looks wrong in manual testing.

### Pitfall 2: commitProjection Callback Forward Reference
**What goes wrong:** The `ExplorerCanvas` constructor receives `commitProjection` callback. If `widget` is not yet assigned when the callback is invoked, it throws.
**Why it happens:** `new ExplorerCanvas(config, (proj) => widget.commitProjection(proj))` captures `widget` by reference. Widget is assigned immediately after the beforeEach setup — but the `create()` factory closure captures the let-declared `widget` variable. In tests, `widget` is assigned before `widget.mount()` is called, so the callback reference is valid. No issue in practice, but the pattern must preserve this order.
**How to avoid:** Assign `widget` before calling `widget.mount()`. The existing Phase 166 pattern already does this correctly.

### Pitfall 3: DataExplorerPanel Requires All Config Callbacks
**What goes wrong:** `makeConfig()` missing a required DataExplorerPanelConfig callback causes TypeScript error or silent failure at mount time.
**Why it happens:** DataExplorerPanelConfig requires 7 callbacks. The ExplorerCanvas.test.ts `makeConfig()` factory already provides all 7 as no-ops — copy this exactly.
**How to avoid:** Import and reuse the `makeConfig()` pattern from ExplorerCanvas.test.ts or define the same factory in the new integration test file.

### Pitfall 4: Vitest jsdom + WASM Coexistence
**What goes wrong:** Some test utilities import from the Worker bridge or sql.js paths, triggering WASM load in a jsdom environment, which fails.
**Why it happens:** jsdom doesn't support WASM natively without the global setup. The cross-seam tests must only import from `src/superwidget/` — not from `src/worker/` or any bridge utilities.
**How to avoid:** Keep imports scoped to: `src/superwidget/SuperWidget`, `src/superwidget/registry`, `src/superwidget/projection`, `src/superwidget/ExplorerCanvas`, `src/superwidget/statusSlot`. The `src/ui/DataExplorerPanel` import chain may pull in provider types but should not instantiate WASM.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 (cross-seam) + Playwright (E2E) |
| Config file | `vitest.config.ts` / `playwright.config.ts` |
| Quick run command | `npx vitest run tests/superwidget/explorer-canvas-integration.test.ts` |
| Full suite command | `npx vitest run && npx playwright test --project=webkit` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EINT-01 | ExplorerCanvas mount via registry produces real DataExplorerPanel DOM (not stub) | cross-seam Vitest | `npx vitest run tests/superwidget/explorer-canvas-integration.test.ts` | No — Wave 0 |
| EINT-02 | Tab switching via commitProjection toggles active class and data-tab-active attribute | cross-seam Vitest | `npx vitest run tests/superwidget/explorer-canvas-integration.test.ts` | No — Wave 0 |
| EINT-03 | Status slot card/connection counts update; canvas slot renderCount unchanged | cross-seam Vitest | `npx vitest run tests/superwidget/explorer-canvas-integration.test.ts` | No — Wave 0 |
| EINT-04 | Playwright WebKit smoke: ExplorerCanvas visible, tab switch assertion in real browser | Playwright E2E | `npx playwright test --project=webkit superwidget-smoke.spec.ts` | Partial — new describe block needed |

### Wave 0 Gaps

- [ ] `tests/superwidget/explorer-canvas-integration.test.ts` — new file covering EINT-01, EINT-02, EINT-03
- [ ] `e2e/fixtures/explorercanvas-harness.html` — new harness with real ExplorerCanvas registration (avoids modifying superwidget-harness.html)
- [ ] New describe block in `e2e/superwidget-smoke.spec.ts` for EINT-04 (using explorercanvas-harness.html URL)

---

## Key Selectors and Assertions Reference

Derived from ExplorerCanvas.ts, statusSlot.ts, and UI-SPEC.md.

### EINT-01 Assertions (real canvas, not stub)

| What to assert | Selector | Expected |
|---------------|----------|----------|
| Canvas wrapper mounted | `.explorer-canvas` | not null |
| Tab bar present | `[data-slot="tab-bar"]` inside `.explorer-canvas` | not null |
| Import/Export tab button | `[data-tab-id="import-export"]` | textContent "Import / Export" |
| Catalog tab button | `[data-tab-id="catalog"]` | textContent "Catalog" |
| DB Utilities tab button | `[data-tab-id="db-utilities"]` | textContent "DB Utilities" |
| Import button present | `.data-explorer__import-btn` | not null |
| Stub NOT present | `.explorer-canvas-stub` (or textContent contains `[Explorer:`) | null / absent |

### EINT-02 Assertions (tab switching)

After `commitProjection({ ...proj, activeTabId: 'catalog' })`:
- `[data-tab-container="catalog"].classList.contains('active')` → true
- `[data-tab-container="import-export"].classList.contains('active')` → false
- `[data-tab-id="catalog"][data-tab-active="true"]` → present

After `commitProjection({ ...proj, activeTabId: 'db-utilities' })`:
- `[data-tab-container="db-utilities"].classList.contains('active')` → true
- `[data-tab-container="catalog"].classList.contains('active')` → false

### EINT-03 Assertions (status slot update)

After `renderStatusSlot(widget.statusEl)` + `updateStatusSlot(widget.statusEl, { card_count: 42, connection_count: 7, last_import_at: new Date().toISOString() })`:
- `[data-stat="cards"]`.textContent → `'42 cards'`
- `[data-stat="connections"]`.textContent → `'7 connections'`
- `[data-stat="last-import"]`.textContent → matches `/^Imported /`
- `widget.canvasEl.dataset['renderCount']` → unchanged from pre-update value

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies beyond existing Vitest and Playwright installations. Both already confirmed in the project stack.

---

## Sources

### Primary (HIGH confidence)

All findings sourced directly from codebase inspection:

- `tests/superwidget/integration.test.ts` — Phase 166 cross-seam test pattern
- `e2e/superwidget-smoke.spec.ts` — Phase 166 Playwright WebKit smoke pattern
- `src/superwidget/ExplorerCanvas.ts` — TAB_DEFS, mount logic, onProjectionChange
- `src/superwidget/statusSlot.ts` — renderStatusSlot, updateStatusSlot signatures
- `src/superwidget/registry.ts` — register, registerAllStubs, getCanvasFactory, clearRegistry
- `src/superwidget/SuperWidget.ts` — commitProjection, slot getters, renderCount tracking
- `src/superwidget/ExplorerCanvasStub.ts` — stub text `[Explorer: {id}]` that EINT-01 must NOT see
- `tests/superwidget/ExplorerCanvas.test.ts` — makeConfig() factory, existing EXCV assertions
- `e2e/fixtures/superwidget-harness.html` — current harness structure
- `src/main.ts` (lines 689-701, 1528-1624) — refreshDataExplorer() and registry wiring

### Secondary (MEDIUM confidence)

- `playwright.config.ts` — webkit project testMatch pattern; `vitest.config.ts` — jsdom environment override

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Vitest + Playwright already installed and configured
- Architecture patterns: HIGH — directly read from Phase 166 source files; all patterns verified
- Pitfalls: HIGH — identified from actual code (harness regression, callback forward ref, config shape)

**Research date:** 2026-04-21
**Valid until:** Phase-stable; no external dependencies change
