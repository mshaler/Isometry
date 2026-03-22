# Architecture Research

**Domain:** Plugin E2E Test Suite — PluginRegistry/FeatureCatalog integration
**Researched:** 2026-03-21
**Confidence:** HIGH (source code verified)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Test Execution Layer                        │
├───────────────────────────┬──────────────────────────────────┤
│  Vitest (jsdom)           │  Playwright (Chromium)            │
│  tests/views/pivot/       │  e2e/harness/                     │
│  Unit + Integration       │  Full-stack harness interaction   │
└───────────┬───────────────┴──────────────────┬───────────────┘
            │                                   │
            ▼                                   ▼
┌───────────────────────┐        ┌──────────────────────────┐
│  Test Helpers Layer   │        │  Vite Dev Server :5173   │
│  makeCtx()            │        │  HarnessShell mounted    │
│  makeRegistry()       │        │  at ?harness=1           │
│  makeFullRegistry()   │        └──────────┬───────────────┘
└───────────┬───────────┘                   │
            │                               │
            ▼                               ▼
┌───────────────────────────────────────────────────────────────┐
│                   Production Code Under Test                    │
│                                                                 │
│  PluginRegistry  ←──── registerCatalog() ────►  FeatureCatalog │
│       │                                              │          │
│       │  enable/disable + dependency graph           │          │
│       ▼                                              ▼          │
│  Plugin Pipeline: transformData → transformLayout → afterRender │
│       │                                                         │
│       ▼                                                         │
│  PivotGrid (D3 data join, CSS Grid layout)                     │
│       │                                                         │
│  PivotTable (orchestrator — state, dimensions, registry wire)  │
│       │                                                         │
│  HarnessShell (sidebar + localStorage persistence)             │
└───────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `PluginRegistry` | Register/enable/disable plugins, run 5 pipeline hooks, notify listeners | FeatureCatalog, PivotGrid, HarnessShell |
| `FeatureCatalog` | 27-plugin taxonomy with shared state objects per category | PluginRegistry (via registerCatalog) |
| `PivotGrid` | D3 data join rendering, overlay pointer routing, passes RenderContext into hooks | PluginRegistry (via setRegistry) |
| `PivotTable` | Dimension state, wires configPanel + grid, calls registry.onChange for rerender | PivotGrid, PivotConfigPanel, PluginRegistry |
| `HarnessShell` | Mount/destroy lifecycle, localStorage persistence, FeaturePanel sidebar | PivotTable, FeaturePanel, PluginRegistry |
| `FeaturePanel` | Checkbox toggle tree, category expand/collapse, enable-all/disable-all buttons | PluginRegistry (read + write) |
| Shared plugin state objects | SuperStackState, zoomState, calcConfig, densityState, searchState, selectionState, auditPluginState | Two or more sibling plugins within same category |

## Recommended Project Structure

```
tests/
├── views/pivot/            # Existing per-plugin unit tests (jsdom)
│   ├── PluginRegistry.test.ts
│   ├── FeatureCatalogCompleteness.test.ts
│   ├── BasePlugins.test.ts
│   ├── SuperSort.test.ts   # pattern: direct factory import + makeCtx()
│   └── ...
├── harness/                # NEW — cross-plugin interaction tests (jsdom)
│   ├── helpers.ts          # makeCtx(), makeRegistry(), makeFullRegistry()
│   ├── all-plugins.test.ts # Full-matrix: registerCatalog + enable-all smoke test
│   ├── plugin-interactions.test.ts  # Pairwise: collapse+aggregate, density+scroll, etc.
│   └── pipeline-order.test.ts       # Verify hook execution order across enabled set
└── seams/
    └── ui/                 # Existing seam tests

e2e/                        # NEW directory or extend existing
├── harness/
│   ├── feature-panel.spec.ts   # Sidebar toggle interaction
│   ├── all-plugins-matrix.spec.ts  # Enable-all, visual smoke + no crash
│   └── plugin-interactions.spec.ts # Collapse→aggregate, sort→scroll combos
└── screenshots/            # Existing visual regression store
```

### Structure Rationale

- **tests/harness/:** Keeps new cross-plugin Vitest tests isolated from per-plugin unit tests. Shared helpers live here rather than duplicating makeCtx across every test file.
- **e2e/harness/:** Separate from any existing `e2e/` visual tests. Harness-specific Playwright specs interact with HarnessShell URL entry point.
- **tests/harness/helpers.ts is the integration seam:** Every new interaction test imports from here. Prevents factory drift as new plugins are added.

## Architectural Patterns

### Pattern 1: Shared State Object Injection (the critical seam)

**What:** Categories with multiple sibling plugins share one state object created inside `registerCatalog()`. The factory closures capture the shared reference. There are 7 shared state objects: `SuperStackState`, `zoomState`, `calcConfig`, `densityState`, `searchState`, `selectionState`, `auditPluginState`.

**When to use:** Any test that exercises plugin interaction within one category — e.g., `superstack.collapse` toggling `superstack.aggregate` display — must use `registerCatalog()` to get the same shared-state injection. Tests that call factory functions directly (current per-plugin pattern) must manually construct and pass shared state, which is only appropriate for isolated unit tests.

**Trade-offs:** `registerCatalog(reg)` automatically wires shared state correctly. Direct factory calls are simpler but cannot model cross-plugin state sharing. Use `registerCatalog` for all interaction tests.

**Example — correct integration test setup:**
```typescript
// tests/harness/helpers.ts
import { PluginRegistry } from '../../src/views/pivot/plugins/PluginRegistry';
import { registerCatalog } from '../../src/views/pivot/plugins/FeatureCatalog';
import type { RenderContext, GridLayout } from '../../src/views/pivot/plugins/PluginTypes';

export function makeFullRegistry(): PluginRegistry {
  const reg = new PluginRegistry();
  registerCatalog(reg);
  return reg;
}

export function makeCtx(overrides?: Partial<RenderContext>): RenderContext {
  return {
    rowDimensions: [],
    colDimensions: [],
    visibleRows: [],
    visibleCols: [],
    data: new Map(),
    rootEl: document.createElement('div'),
    scrollLeft: 0,
    scrollTop: 0,
    isPluginEnabled: () => false,
    ...overrides,
  };
}

export function makeLayout(overrides?: Partial<GridLayout>): GridLayout {
  return {
    headerWidth: 120,
    headerHeight: 36,
    cellWidth: 72,
    cellHeight: 32,
    colWidths: new Map(),
    zoom: 1.0,
    ...overrides,
  };
}
```

### Pattern 2: Full-Matrix Enable Test

**What:** Enable all 27 plugins simultaneously and run the full pipeline. Catches interaction crashes, hook-order regressions, and missing `destroy()` cleanup.

**When to use:** Once per test suite as a smoke gate. Any new plugin added to the catalog must pass this without modification.

**Trade-offs:** Does not verify plugin-specific behaviors, only "no crash" contract. Combine with targeted interaction tests for coverage.

**Example:**
```typescript
// tests/harness/all-plugins.test.ts
// @vitest-environment jsdom
import { makeFullRegistry, makeCtx, makeLayout } from './helpers';
import { FEATURE_CATALOG } from '../../src/views/pivot/plugins/FeatureCatalog';

it('all 27 plugins enabled: pipeline runs without throwing', () => {
  const reg = makeFullRegistry();
  for (const { id } of FEATURE_CATALOG) reg.enable(id);

  const root = document.createElement('div');
  const ctx = makeCtx({ rootEl: root, isPluginEnabled: (id) => reg.isEnabled(id) });
  const layout = makeLayout();

  expect(() => reg.runTransformData([], ctx)).not.toThrow();
  expect(() => reg.runTransformLayout(layout, ctx)).not.toThrow();
  expect(() => reg.runAfterRender(root, ctx)).not.toThrow();

  expect(() => reg.destroyAll()).not.toThrow();
});
```

### Pattern 3: Playwright Harness Entry Point via Query Parameter

**What:** HarnessShell is wired into `src/main.ts` (or added) via a `?harness=1` query param guard. Playwright navigates to `http://localhost:5173/?harness=1` to get HarnessShell instead of the main app. The sidebar checkbox tree is the primary interaction surface. The existing `playwright.config.ts` already points to `:5173` with `npm run dev` as the webServer command.

**When to use:** Any test that needs to verify DOM effects produced by plugin hooks after user-driven sidebar interaction — e.g., clicking a category checkbox, then asserting a footer row or sort indicator appears in the grid.

**Trade-offs:** Requires Vite dev server + Playwright. Slower than Vitest. Use for visual/DOM-effect assertions only; leave logic testing to Vitest.

**Example:**
```typescript
// e2e/harness/feature-panel.spec.ts
import { test, expect } from '@playwright/test';

test('enabling superstack.collapse via sidebar shows collapse controls', async ({ page }) => {
  await page.goto('/?harness=1');
  await page.getByLabel('Collapse Groups').check();
  await expect(page.locator('.pv-col-span--collapsible')).toBeVisible();
});

test('enable-all then disable-all leaves grid clean', async ({ page }) => {
  await page.goto('/?harness=1');
  await page.getByTestId('enable-all-btn').click();
  await expect(page.locator('.pv-grid-root')).toBeVisible();
  await page.getByTestId('disable-all-btn').click();
  await expect(page.locator('.pv-grid-root')).toBeVisible();
});
```

## Data Flow

### Plugin Pipeline Execution Flow

```
PivotGrid.render(rows, cols, data, options)
    │
    ├── Build base CellPlacement[]
    │
    ├── registry.runTransformData(cells, ctx)
    │       Plugin order: Map insertion-order (registration order)
    │       Filters rows: superscroll.virtual
    │       Adds meta: superaudit.overlay, superselect.click
    │
    ├── registry.runTransformLayout(layout, ctx)
    │       Modifies sizing: superzoom.scale, supersize.col-resize
    │
    ├── D3 data join (.data(cells, d => d.key))
    │
    └── registry.runAfterRender(rootEl, ctx)
            Injects DOM: superstack.spanning, superstack.collapse,
            superstack.aggregate, supercalc.footer, superdensity.mini-cards,
            supersearch.highlight, superselect.lasso, superaudit.source
```

### Interaction Test Data Flow (Vitest)

```
makeFullRegistry()
    │  registerCatalog() wires real factories + shared state objects
    │
    ├── reg.enable('superstack.collapse')
    │       Auto-enables: base.grid → base.headers → superstack.spanning → superstack.collapse
    │       Shared: SuperStackState { collapsedSet: Set }
    │
    ├── reg.enable('superstack.aggregate')
    │       Shares the same SuperStackState instance (created once in registerCatalog)
    │
    ├── reg.runAfterRender(root, ctx)
    │       collapse plugin: installs click handlers, reads collapsedSet
    │       aggregate plugin: reads collapsedSet to decide summary rendering
    │
    └── Assert DOM structure in root (collapsed headers, aggregate cells)
```

### Harness State Persistence Flow (Playwright)

```
HarnessShell.mount()
    │
    ├── _restoreState() ← localStorage.getItem('isometry:harness:toggles')
    │
    ├── registry.onChange(() => {
    │       _persistState() → localStorage.setItem(...)
    │       _pivotTable.rerender()
    │   })
    │
    └── FeaturePanel renders checkbox tree
            User toggle → registry.enable/disable → onChange fires
                → persist state
                → rerender PivotGrid with updated plugin set
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 27 plugins (current) | Direct `makeFullRegistry()` is fine — registers in under 1ms |
| 50+ plugins | Split `tests/harness/helpers.ts` into category-specific helpers to keep imports focused |
| Visual regression | Playwright screenshot per plugin combo becomes combinatorially expensive — keep to representative combos, not exhaustive matrix |

### Scaling Priorities

1. **First bottleneck:** Test isolation — shared state objects inside `registerCatalog()` are created once per call. Each test must call `makeFullRegistry()` in `beforeEach`, not share a registry across tests. State objects are mutable (collapsedSet, calcConfig, etc.) and will bleed between tests if shared.

2. **Second bottleneck:** Playwright harness entry point — if `/?harness=1` is not already wired into `src/main.ts`, the E2E tests have no entry point. This is a build-order dependency: verify or add the conditional branch before writing any Playwright harness specs.

## Anti-Patterns

### Anti-Pattern 1: Sharing a Registry Across Tests

**What people do:** Create one `makeFullRegistry()` at the top of a describe block and reuse across all tests.

**Why it's wrong:** Shared plugin state objects (SuperStackState.collapsedSet, selectionState, etc.) are mutated by plugin hooks. Test N's collapse actions leak into Test N+1's baseline state.

**Do this instead:**
```typescript
let reg: PluginRegistry;
beforeEach(() => { reg = makeFullRegistry(); });
afterEach(() => { reg.destroyAll(); });
```

### Anti-Pattern 2: Testing Plugin Logic via Full PivotGrid DOM

**What people do:** Mount a full PivotGrid with real dimensions to test whether a plugin hook changed the DOM.

**Why it's wrong:** PivotGrid DOM setup is expensive and brittle in jsdom (CSS layout does not run, scroll geometry is zero, resize observer does not fire). Plugin hook logic is better tested via the registry pipeline directly.

**Do this instead:** Call `reg.runAfterRender(root, ctx)` with a minimal `document.createElement('div')` root. Assert on DOM mutations to `root` directly, without mounting the full grid.

### Anti-Pattern 3: Playwright Tests for Logic Already Covered by Vitest

**What people do:** Write Playwright tests that verify pipeline output (e.g., assert data transformation results or sorted row order).

**Why it's wrong:** Playwright tests are 10-20x slower and cannot inspect JavaScript state directly. Logic belongs in Vitest.

**Do this instead:** Playwright tests assert only DOM/visual effects visible to a user — elements present, CSS classes applied, interactive behaviors (click/drag). All pipeline logic assertions stay in `tests/harness/`.

### Anti-Pattern 4: Calling Individual Factory Functions to Test Plugin Interactions

**What people do:** For cross-plugin tests (e.g., collapse + aggregate), instantiate both plugins by calling their factory functions directly with separately constructed state objects.

**Why it's wrong:** The two state objects are distinct instances, so they do not share the same `collapsedSet`. The aggregate plugin will not see what the collapse plugin wrote.

**Do this instead:** Call `registerCatalog(reg)` and enable both plugins. The shared state objects are created inside `registerCatalog` — plugins automatically share the same reference.

## Integration Points

### New vs Modified Files

| File | New / Modified | Purpose |
|------|---------------|---------|
| `tests/harness/helpers.ts` | NEW | `makeCtx()`, `makeRegistry()`, `makeFullRegistry()`, `makeLayout()` shared factories |
| `tests/harness/all-plugins.test.ts` | NEW | Full-matrix enable-all smoke test |
| `tests/harness/plugin-interactions.test.ts` | NEW | Pairwise cross-category interaction tests |
| `tests/harness/pipeline-order.test.ts` | NEW | Hook execution order verification |
| `e2e/harness/feature-panel.spec.ts` | NEW | Playwright: sidebar checkbox toggle → DOM effect |
| `e2e/harness/all-plugins-matrix.spec.ts` | NEW | Playwright: enable-all smoke + no crash |
| `src/main.ts` | MODIFIED | Add `?harness=1` query param branch to mount HarnessShell |
| `tests/views/pivot/FeatureCatalogCompleteness.test.ts` | MODIFIED | Update implemented list and stub count as plugins are added |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `makeFullRegistry()` → `registerCatalog()` | Direct function call | Core integration seam — all interaction tests go through this |
| Vitest interaction tests → `PluginRegistry` pipeline | `reg.runTransformData/Layout/AfterRender` | Tests drive the same pipeline PivotGrid uses in production |
| Playwright → `HarnessShell` | HTTP GET `/?harness=1` + DOM interaction | Requires Vite dev server + src/main.ts conditional |
| `FeaturePanel` checkboxes → `PluginRegistry` | `registry.enable(id)` / `registry.disable(id)` | Playwright clicks the checkbox; registry cascade auto-enables deps |

### Build Order for Implementation

1. **`tests/harness/helpers.ts`** — Unblocks all subsequent Vitest interaction tests. No production code changes needed.
2. **`tests/harness/all-plugins.test.ts`** — Establishes the full-matrix smoke gate. Depends on Step 1.
3. **`tests/harness/plugin-interactions.test.ts`** — Category-pair interaction tests (collapse+aggregate, search+highlight, select+lasso+keyboard). Depends on Step 1.
4. **`src/main.ts` modification** — Adds `?harness=1` entry point. Required before any Playwright harness spec can run.
5. **`e2e/harness/feature-panel.spec.ts`** — Playwright sidebar interaction tests. Depends on Step 4.
6. **`e2e/harness/all-plugins-matrix.spec.ts`** — Playwright enable-all smoke. Depends on Step 4.

Steps 1-3 are pure Vitest with zero production code changes. Steps 5-6 block on Step 4.

## Sources

- Source-verified: `src/views/pivot/plugins/PluginRegistry.ts`
- Source-verified: `src/views/pivot/plugins/FeatureCatalog.ts`
- Source-verified: `src/views/pivot/plugins/PluginTypes.ts`
- Source-verified: `src/views/pivot/PivotGrid.ts`
- Source-verified: `src/views/pivot/PivotTable.ts`
- Source-verified: `src/views/pivot/harness/HarnessShell.ts`
- Source-verified: `src/views/pivot/harness/FeaturePanel.ts`
- Source-verified: `playwright.config.ts`
- Pattern reference: `tests/views/pivot/PluginRegistry.test.ts` (makeCtx pattern)
- Pattern reference: `tests/views/pivot/FeatureCatalogCompleteness.test.ts` (full-registry pattern)
- Pattern reference: `tests/views/pivot/SuperSort.test.ts` (direct factory import pattern)
- Pattern reference: `tests/views/pivot/SuperStackAggregate.test.ts` (shared state manual construction)

---
*Architecture research for: Plugin E2E test suite — PluginRegistry/FeatureCatalog integration*
*Researched: 2026-03-21*
