# Pitfalls Research

**Domain:** Plugin E2E test suite — adding comprehensive integration and E2E tests to 27 composable plugins with shared state, D3.js rendering, virtual scrolling, and cross-plugin interactions.
**Researched:** 2026-03-21
**Confidence:** HIGH — derived from direct codebase inspection (PluginRegistry, PluginTypes, SuperScrollVirtual, SuperZoomWheel, PivotGrid, existing test files) combined with verified community sources on jsdom, Playwright, and plugin system testing.

---

## Critical Pitfalls

### Pitfall 1: Shared State Object Leaks Between Tests

**What goes wrong:**
`ZoomState`, `SelectionState`, and `SuperStackState` are created once and passed to multiple plugin factories. If a test mutates one of these objects (e.g., sets `zoomState.zoom = 2.0`) without resetting it in `afterEach`, subsequent tests in the same file inherit the mutated state. Test 10 fails mysteriously because Test 3 left zoom at 2.0. The failure is non-deterministic if test ordering changes.

**Why it happens:**
Shared state objects are passed by reference into plugin factories — this is by design (it is how wheel and slider stay in sync). Tests that create the shared state at module scope rather than in `beforeEach` share the same object across all tests in the file. A developer writes `const zoomState = createZoomState()` at the top of a describe block once, assuming it is scoped per-describe, but any mutation from a prior test persists.

**How to avoid:**
Create ALL shared state objects inside `beforeEach`, never at describe or module scope. The pattern is:
```typescript
let zoomState: ZoomState;
beforeEach(() => {
  zoomState = createZoomState(); // fresh object every test
});
```
Add an ESLint rule or code review checklist item: shared state factories (`createZoomState`, `createSelectionState`, `createSuperStackState`) must only be called inside `beforeEach` or inside the test body itself.

**Warning signs:**
- Tests pass individually but fail when the full suite runs
- Test failure message references a value that was only set in a different test
- `describe.only` on the failing test makes it pass
- Tests in the same file have different pass/fail depending on `--reporter=verbose` ordering

**Phase to address:**
Phase 1 (Test Infrastructure Setup) — establish the `beforeEach` pattern before any test file is written. A fixture factory pattern (`makeZoomState`, `makePluginHarness`) should be in a shared `tests/views/pivot/helpers.ts` so every file uses consistent fresh-object construction.

---

### Pitfall 2: jsdom Returns Zero for All Layout Measurements

**What goes wrong:**
`clientHeight`, `clientWidth`, `scrollTop`, `getBoundingClientRect()`, and `offsetHeight` all return 0 in jsdom. Code that depends on these values — virtual scroll windowing, zoom pixel calculations, sticky header top offsets — silently uses the zero fallback and the test exercises the wrong code path. `SuperScrollVirtual.transformData` uses `DEFAULT_CONTAINER_HEIGHT = 600` when `scrollContainer.clientHeight` is 0, so tests verify behavior at 600px even though no container exists.

**Why it happens:**
jsdom implements the DOM API surface but does not run a layout engine. Every dimension property is zero unless explicitly mocked with `Object.defineProperty`. Developers write tests that create a `<div>` and attach it to the plugin's `rootEl`, expecting the plugin to measure it — but the measurement always returns 0, so the fallback constant is always used.

**How to avoid:**
Separate layout-dependent code into extractable pure functions and test the pure function, not the DOM measurement path. For `SuperScrollVirtual`, the `getVisibleRange()` pure function is already exported — test it directly with explicit numeric arguments. For tests that require specific container dimensions, use `Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })` before invoking the plugin.

Document the two-tier test strategy explicitly:
- **Tier A (jsdom):** Test plugin logic via pure function exports and explicit mock dimensions
- **Tier B (Playwright):** Test actual scroll behavior in real browser where layout works

Never write a jsdom test that asserts scroll behavior without explicitly mocking the container dimensions first.

**Warning signs:**
- A test passes with any scroll position because the fallback constant always produces the same range
- `clientHeight` or `getBoundingClientRect` are read in plugin code without a fallback — the test will never exercise the fallback guard
- A virtual scroll test asserts that rows 50-80 are visible but passes at scrollTop=0

**Phase to address:**
Phase 1 (Test Infrastructure) — add a `mockContainerDimensions(el, { clientHeight, clientWidth })` helper to the shared test utilities so the pattern is consistent. Phase 2 (Plugin Unit Tests) — use the helper in every test that exercises layout-sensitive plugins.

---

### Pitfall 3: `afterRender` Attaches Event Listeners Every Render Cycle

**What goes wrong:**
`SuperZoomWheelPlugin.afterRender` removes then re-attaches a `wheel` listener and a `keydown` listener on `document` on every render. If a test calls `afterRender` multiple times without calling `destroy`, the previous listener is removed but the reference to `_scrollEl` may differ. In jsdom, `document` global event listeners accumulate across tests if the plugin instance is not destroyed. A `keydown` listener registered in test 1 fires during test 2's key-event simulation.

**Why it happens:**
`afterRender` is designed to be idempotent by removing existing listeners before re-adding. However, the removal depends on `_scrollEl` being the same element reference. In tests that recreate `rootEl` between calls but reuse the same plugin instance, the old listener attached to the old `_scrollEl` is never removed. jsdom does not isolate `document`-level listeners between tests.

**How to avoid:**
Always call `plugin.destroy()` in `afterEach` for any plugin that attaches `document`-level listeners. Document in a comment on `createSuperZoomWheelPlugin` and `createSuperSelectKeyboardPlugin` that they attach document listeners and must be destroyed between tests. Add a lint check or test helper that wraps plugin factory calls with automatic destroy in afterEach:
```typescript
function usePlugin<T extends PluginHook>(factory: () => T): T {
  const instance = factory();
  afterEach(() => instance.destroy?.());
  return instance;
}
```

**Warning signs:**
- Key event tests pass individually but interfere when run together
- Zoom resets unexpectedly in the middle of a test suite
- `document.addEventListener` call count grows with test count
- Tests that simulate `Ctrl+wheel` affect plugins in adjacent describe blocks

**Phase to address:**
Phase 2 (Plugin Unit Tests) — add the `usePlugin` helper to shared test utilities and enforce its use via code review for any plugin that registers document-level listeners.

---

### Pitfall 4: PluginRegistry `defaultEnabled` Bleeds Into Tests That Do Not Reset

**What goes wrong:**
Several plugins have `defaultEnabled: true`. When `PluginRegistry` is constructed and plugins are registered, those plugins are immediately enabled. A test that registers plugins and then asserts `isEnabled(id) === false` will fail for any plugin with `defaultEnabled: true`. Worse: tests that test pipeline execution assume only plugins they explicitly enable will run, but base plugins (`base.grid`, `base.headers`) auto-enable on registration and their hooks fire unexpectedly.

**Why it happens:**
`PluginRegistry._enableSingle(id)` is called during `register()` when `meta.defaultEnabled` is true. The registry used in tests is typically constructed fresh in `beforeEach`, but if tests import a pre-wired registry (e.g., the production `createPivotRegistry()` factory), they get a pre-populated registry with defaults already active.

**How to avoid:**
Tests should NEVER import the production `createPivotRegistry()` function. All tests should construct a bare `new PluginRegistry()` and register only the plugins they care about. The `FeatureCatalog.ts` wiring is integration-level, not unit-level. If a test needs to verify default-enabled behavior specifically, it should be an explicit labeled test in a `describe('defaultEnabled plugins')` block.

**Warning signs:**
- Pipeline test runs hooks that the test never explicitly enabled
- Tests that disable a plugin find it re-enabled on the next operation (transitive dep auto-enabled it)
- A test file that imports `createPivotRegistry` passes locally but breaks in CI after a new default-enabled plugin is added

**Phase to address:**
Phase 1 (Test Infrastructure) — document the bare `new PluginRegistry()` pattern as the canonical test approach. Warn in `FeatureCatalog.ts` file header that it is not safe for direct import in unit tests.

---

### Pitfall 5: Virtual Scroll Test Bypasses Virtualization Threshold

**What goes wrong:**
`SuperScrollVirtual` only activates when `totalRows > VIRTUALIZATION_THRESHOLD` (100). A test that creates 50 cells to stay "lightweight" never exercises the windowing logic — `transformData` returns the input unchanged. The test passes trivially because it tested the bypass path, not the virtualization path. The actual filtering, range computation, and sentinel insertion are never covered.

**Why it happens:**
Developers write small test datasets by habit to keep tests fast. With normal data-join tests (e.g., SuperSort, SuperStack) a small dataset is sufficient. For SuperScroll specifically, 50 rows exercises a different code branch than 200 rows. The threshold constant is `100` but is not prominently documented at the call sites.

**How to avoid:**
Maintain both test sizes explicitly:
- "below threshold" tests: `VIRTUALIZATION_THRESHOLD - 1` rows (tests bypass path)
- "above threshold" tests: `VIRTUALIZATION_THRESHOLD + 1` rows minimum (tests windowing path)

Export `VIRTUALIZATION_THRESHOLD` from `SuperScrollVirtual.ts` (already done) and use it in tests: `makeCells(VIRTUALIZATION_THRESHOLD + 50, 1)` so tests automatically stay above threshold even if the constant changes.

**Warning signs:**
- All SuperScroll tests pass but `uniqueRows === cells.length` in every assertion (bypass path)
- The `_lastRange` state is never set (only set when virtualization activates)
- Sentinel `<div>` elements are never created in any test

**Phase to address:**
Phase 2 (Plugin Unit Tests) — the existing `SuperScroll.test.ts` already has both paths (`VIRTUALIZATION_THRESHOLD` and `VIRTUALIZATION_THRESHOLD + 1`). New tests for cross-plugin interactions must also use above-threshold datasets when SuperScroll is in the pipeline.

---

### Pitfall 6: Cross-Plugin Interaction Tests Use Wrong Pipeline Order

**What goes wrong:**
The PluginRegistry runs hooks in Map insertion order (registration order). A test that manually calls `plugin.transformData()` → `plugin2.transformData()` in the wrong order produces different results than `registry.runTransformData()`. For example: `SuperScrollVirtual` must run `transformData` BEFORE `SuperStackCollapse` processes rows, otherwise virtual scroll filters against pre-collapse row indices that don't match post-collapse indices. A test that inverts this order will pass (getting some cell subset) but will not match production behavior.

**Why it happens:**
Manual plugin chaining in tests ignores registration order, which is only enforced by the registry's Map iteration. Developers testing interaction between two plugins call them in "logical" order that seems correct but differs from the actual registration sequence in `FeatureCatalog.ts`.

**How to avoid:**
Cross-plugin interaction tests should ALWAYS use a `PluginRegistry` instance with plugins registered in the same order as `FeatureCatalog.ts`. Create a test helper `makePluginHarness(pluginIds: string[])` that registers plugins in canonical order and returns the registry. Do not test cross-plugin behavior by calling individual plugin hooks manually.

**Warning signs:**
- A cross-plugin test passes but the assertion checks only the count of cells, not which specific rows survived
- The test result changes when you add a third plugin to the same describe block
- Sentinel spacers have incorrect heights after running SuperScroll + SuperZoom together

**Phase to address:**
Phase 3 (Cross-Plugin Interaction Tests) — establish `makePluginHarness` as the canonical interaction test pattern. Every cross-plugin test must go through the registry pipeline, not direct hook calls.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Mock `Object.defineProperty` for layout dimensions in jsdom | Unblocks unit tests without a real browser | Tests pass with mocked values that don't reflect real-world DOM behavior; bugs in dimension calculation go undetected | Acceptable for logic tests; must be paired with Playwright E2E for behavior tests |
| Test only the pure function export (e.g., `getVisibleRange`) instead of the full plugin | Fast, isolated, no DOM setup needed | Plugin integration bugs (wrong DOM selector, wrong fallback constant) go untested | Acceptable as first-pass coverage; integration test must exist before phase ships |
| Reuse a single `PluginRegistry` instance across describe blocks | Less boilerplate setup | State from one describe block (enabled plugins, listener list) bleeds into the next | Never — always construct fresh in `beforeEach` |
| Import `createPivotRegistry()` production wiring in unit tests | Tests run against "real" plugin set | Tests break whenever any default-enabled plugin is added; test intent becomes unclear | Never in unit tests; acceptable only in E2E fixtures |
| Use `vi.useFakeTimers()` globally without restoring | Simplifies debounce testing | D3 transition timers and `requestAnimationFrame` polyfills break in subsequent tests | Only when paired with `afterEach(() => vi.useRealTimers())` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| D3 transitions in jsdom | Assert DOM attributes change immediately after calling `plugin.afterRender()` | D3 transitions run asynchronously; in jsdom they are synchronous only if `d3.transition().duration(0)` is used or if `selection.interrupt()` is called; in Playwright wait for the transition to settle |
| SuperScroll + Playwright | `page.evaluate(() => container.scrollTop)` returns 0 before scroll event fires | Use `page.locator(selector).evaluate(el => el.scrollTop)` after `page.mouse.wheel(0, 500)` with `await expect.poll()` to retry until non-zero |
| ZoomState listeners Set | Forgetting to unsubscribe a test listener from `zoomState.listeners` | Always use `zoomState.listeners.clear()` in `afterEach` when manually adding listeners in tests; leaked listeners cause zoom side-effects in later tests |
| PluginRegistry `onChange` | Not unsubscribing onChange handlers in `afterEach` | Always call the returned unsubscribe function; store in `let unsubscribe: () => void` and call in `afterEach` |
| Playwright + Vite dev server | Starting Playwright before Vite is ready causes connection refused on first test | Use `webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true }` in `playwright.config.ts`; add explicit `await page.waitForLoadState('networkidle')` in test fixtures |
| `destroy()` not called between tests | Plugin DOM elements (sentinels, overlays) accumulate in jsdom's global document | jsdom does not reset between tests within a file; always clean up by calling `registry.destroyAll()` and removing the `rootEl` from document in `afterEach` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Creating `makeCells(1000, 50)` in every test | Suite takes >30s; CI timeout | Use minimum dataset that exercises the code path; `makeCells(VIRTUALIZATION_THRESHOLD + 1, 1)` for scroll tests | Any file with >10 tests using large datasets |
| Calling `registry.runTransformData()` in a tight loop to assert ordering | CPU spike in CI; test timeouts | Test ordering with a `log: string[]` spy, not by running the pipeline 100 times | Pipelines with >5 plugins |
| Playwright test against Vite dev server without `--headed` flags cached | Dev server cold-starts add 5-10s per test run | Use `reuseExistingServer: true` so Vite only starts once per suite | Any CI environment without warm server |
| Mounting a full `PivotGrid` DOM tree for every plugin unit test | DOM setup overhead in jsdom; 50ms+ per test | Test plugin hooks in isolation with a plain `document.createElement('div')` as rootEl; only mount full PivotGrid in integration tests | Suites with >20 plugin unit tests |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Testing plugin enable/disable but not the visual delta | Tests pass but toggling a plugin in the harness produces no visible change (plugin logic runs but DOM changes are undetectable) | Always include at least one `afterRender` assertion that checks a specific DOM attribute changed (e.g., `position: sticky` was applied, a sentinel `<div>` was inserted) |
| Asserting that `registry.notifyChange()` was called but not what it caused | Listener count increments but the test does not verify the render consequence | Mock the listener and assert it was called with the expected arguments, then separately verify the DOM state after a re-render |
| Testing zoom only with `transformLayout` hook, never with a real wheel event | Plugin tests all green; real Ctrl+wheel in browser does nothing because `addEventListener` path is broken | Include at least one `afterRender` test that dispatches a synthetic `WheelEvent` with `ctrlKey: true` and verifies `zoomState.zoom` changes |

---

## "Looks Done But Isn't" Checklist

- [ ] **SuperScroll coverage:** Verify tests include BOTH below-threshold (bypass) AND above-threshold (windowing) datasets — a file that only has `makeCells(50, 3)` has zero windowing coverage.
- [ ] **Plugin destroy coverage:** Every plugin that implements `destroy()` must have a test that calls `destroy()` and verifies DOM cleanup — sentinel divs removed, listeners detached.
- [ ] **Shared state reset:** Every test file that uses `ZoomState`, `SelectionState`, or `SuperStackState` must construct it in `beforeEach`, not at module scope.
- [ ] **Cross-plugin order:** Any test asserting the output of two or more plugins interacting must route through `registry.runTransformData()`, not manual hook chaining.
- [ ] **Playwright stable selector:** Every Playwright assertion must use a `data-testid` attribute or ARIA role, not a CSS class that could be renamed — D3 re-renders replace DOM nodes, making `nth-child` selectors unreliable.
- [ ] **Document listener cleanup:** All test files for `SuperZoomWheel`, `SuperSelectKeyboard`, and any other plugin that calls `document.addEventListener` must have `afterEach(() => plugin.destroy())`.
- [ ] **jsdom dimension mock:** Any test asserting scroll windowing behavior must use `Object.defineProperty` to set non-zero `clientHeight` before calling `transformData`.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shared state leak across tests | LOW | Add `beforeEach` fresh construction for the shared state object; run `vitest --reporter=verbose` to identify which test mutates the state |
| Document listener accumulation | LOW | Add `afterEach(() => plugin.destroy())` to every affected describe block; run with `vi.spyOn(document, 'addEventListener')` to count listener additions |
| Virtualization threshold bypass | LOW | Increase test dataset to `VIRTUALIZATION_THRESHOLD + 50` rows; verify `_lastRange` is set by asserting sentinel divs exist in DOM |
| Wrong pipeline order in cross-plugin test | MEDIUM | Replace manual hook calls with `registry.runTransformData()`; re-verify all assertions against actual pipeline output |
| Playwright flakiness from D3 transition timing | MEDIUM | Replace `waitForTimeout` with `expect.poll(() => page.locator(sel).getAttribute(attr))` pattern; add `{ timeout: 2000 }` to match D3 default 250ms transition + buffer |
| Full PivotGrid mount in every unit test (performance) | LOW | Extract rootEl creation to `beforeEach`; replace PivotGrid mount with plain `document.createElement('div')` for plugin-level tests |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shared state object leaks | Phase 1 — Test Infrastructure | `makeZoomState` / `makeSelectionState` helpers exist in `tests/views/pivot/helpers.ts`; no test file has shared state at module scope |
| jsdom zero layout measurements | Phase 1 — Test Infrastructure | `mockContainerDimensions` helper exists; every scroll/zoom test uses it |
| Document listener accumulation | Phase 2 — Plugin Unit Tests | All test files with `afterRender` listener plugins call `destroy()` in `afterEach`; grep for `document.addEventListener` confirms no leaks |
| `defaultEnabled` bleeding | Phase 1 — Test Infrastructure | No test file imports `createPivotRegistry`; all unit tests use `new PluginRegistry()` |
| Virtualization threshold bypass | Phase 2 — Plugin Unit Tests | SuperScroll test file has explicit above-threshold test block; `VIRTUALIZATION_THRESHOLD` constant is used by reference, not hardcoded |
| Wrong pipeline order | Phase 3 — Cross-Plugin Tests | `makePluginHarness` helper exists; no cross-plugin test calls individual `transformData` hooks directly |
| Playwright transition timing | Phase 4 — E2E Tests | No `waitForTimeout` calls in E2E files; all animation waits use `expect.poll` or `waitForFunction` |

---

## Sources

- jsdom `getBoundingClientRect` always-zero: [jsdom issue #653](https://github.com/jsdom/jsdom/issues/653), [jsdom issue #1590](https://github.com/jsdom/jsdom/issues/1590)
- jsdom layout API limitations: [Vitest SVG discussion #1766](https://github.com/vitest-dev/vitest/discussions/1766), [scrollHeight always zero — Testing Library #353](https://github.com/testing-library/react-testing-library/issues/353)
- Playwright flakiness from async/animation: [Avoiding Flaky Tests in Playwright — Better Stack](https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/), [How to Detect and Avoid Playwright Flaky Tests — BrowserStack 2026](https://www.browserstack.com/guide/playwright-flaky-tests)
- Playwright wait strategies: [Understanding Playwright Wait Types — BrowserStack](https://www.browserstack.com/guide/playwright-wait-types), [Why Your Playwright Tests Are Still Flaky — Medium Feb 2026](https://medium.com/codetodeploy/why-your-playwright-tests-are-still-flaky-and-its-not-because-of-timing-9c005d0e83a3)
- D3 transition handling in Playwright: [d3/d3-transition GitHub](https://github.com/d3/d3-transition), [Automating Animation Testing with Playwright — The Green Report](https://www.thegreenreport.blog/articles/automating-animation-testing-with-playwright-a-practical-guide/automating-animation-testing-with-playwright-a-practical-guide.html)
- Shared state test isolation: [Test Independence Done Right — DEV Community](https://dev.to/mmonfared/test-independence-done-right-how-to-write-truly-isolated-tests-363m), [How to Fix Test Isolation Issues — 2026](https://oneuptime.com/blog/post/2026-01-24-fix-test-isolation-issues/view)
- Composable plugin test isolation in Vitest: [Testing Reactive Composables in Nuxt & Vitest — DEV Community](https://dev.to/it-wibrc/testing-reactive-composables-in-nuxt-vitest-overcoming-mocking-challenges-139i)
- Codebase: direct inspection of `PluginRegistry.ts`, `SuperScrollVirtual.ts`, `SuperZoomWheel.ts`, `PluginTypes.ts`, `PivotGrid.ts`, and existing test files in `tests/views/pivot/`

---
*Pitfalls research for: plugin E2E test suite — 27 composable plugins with shared state, D3.js/jsdom, Playwright/Vite, virtual scrolling, cross-plugin interaction*
*Researched: 2026-03-21*
