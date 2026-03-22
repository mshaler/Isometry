# Stack Research

**Domain:** Plugin E2E test suite — Vitest integration layer + Playwright against HarnessShell
**Researched:** 2026-03-21
**Confidence:** HIGH (existing stack already installed; research narrows to what to add/not-add)

---

## Context: What Already Exists

Do not re-evaluate these — they are locked:

| Tool | Version | Role |
|------|---------|------|
| `@playwright/test` | 1.58.2 | E2E runner — already installed, `e2e/` dir with 16 specs |
| `vitest` | 4.0.18 | Unit/integration runner — `// @vitest-environment jsdom` annotation pattern established |
| `jsdom` | 28.1.0 | DOM environment for plugin hook tests (`@vitest-environment jsdom` per-file) |
| `@vitest/coverage-v8` | 4.0.18 | Coverage — wired into CI |
| `typescript` | 5.9.3 | Strict mode, no changes needed |

The existing pattern for plugin unit tests is `// @vitest-environment jsdom` at the top of the file with `pool: 'forks'` and `isolate: true` in vitest.config.ts. This works correctly for DOM testing in Node. No environment changes are needed.

---

## Recommended Stack Additions

### Nothing New for Vitest Integration Layer

**Verdict: zero new packages.** The `// @vitest-environment jsdom` + per-file environment annotation pattern is already validated across 17 plugin test files in `tests/views/pivot/`. The existing `PluginRegistry` + `makeCtx()` + `document.createElement()` factory pattern covers all plugin hook testing. Adding `@testing-library/dom` or similar is not warranted — the codebase uses raw D3 DOM manipulation, not a component framework, so Testing Library's abstractions add friction without benefit.

### Nothing New for Playwright E2E Layer

**Verdict: zero new packages.** Playwright 1.58.2 is already at the current release. The `e2e/helpers/isometry.ts` helper file already provides the pattern for DOM assertion helpers (`countElements`, `getTexts`, `getGridMetrics`). The `harness-superstack.spec.ts` file demonstrates the complete pattern for HarnessShell plugin testing.

---

## Recommended Stack for New Plugin E2E Capabilities

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@playwright/test` | 1.58.2 (current) | E2E runner | Already installed. `expect(locator).toContainClass()` (added v1.53) and `expect(locator).toMatchAriaSnapshot()` (matured v1.50+) are available without upgrading |
| `vitest` | 4.0.18 (current) | Plugin hook unit tests | `// @vitest-environment jsdom` per-file annotation is the correct pattern for DOM-touching plugin tests that don't need WASM |

### Supporting Libraries (NO NEW INSTALLS NEEDED)

The following patterns are available using only what is already installed:

| Capability | How to Achieve | Using |
|------------|---------------|-------|
| D3 SVG attribute assertions | `locator.getAttribute('data-col-span')` + `expect().not.toBeNull()` | Playwright built-in |
| CSS custom property assertions | `locator.evaluate(el => getComputedStyle(el).getPropertyValue('--sg-zoom'))` | Playwright `evaluate()` |
| CSS class assertions | `expect(locator).toContainClass('pv-col-span--collapsed')` | Playwright 1.53+ built-in |
| Plugin DOM state after render | `page.locator('.pv-agg-cell').count()` | Playwright built-in |
| Plugin unit hook testing | `document.createElement('div')` + jsdom environment | Vitest + jsdom 28 |
| Shared Playwright helpers | Extend `e2e/helpers/harness.ts` with harness-specific functions | No new package |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@testing-library/dom` | Adds query-by-text/role abstractions designed for React component trees; D3's imperative DOM manipulation means elements often lack the ARIA roles and accessible names Testing Library expects. Adds an impedance mismatch layer, not a simplification. | Raw `document.querySelector` / Playwright `locator()` with data attributes |
| `@testing-library/user-event` | Simulates user events for React components. Playwright's built-in `locator.click()`, `locator.dispatchEvent()`, and `page.keyboard` cover all interaction patterns needed for plugin tests. | `locator.click({ modifiers: ['Meta'] })`, `locator.dispatchEvent('pointerdown', ...)` |
| Vitest Browser Mode (`@vitest/browser`) | Experimental as of 2025-06. Runs tests in real Chromium via Playwright — but the existing codebase already uses Playwright for real-browser tests and jsdom for unit tests. Adding Browser Mode creates a third test tier with a non-stable API. The WASM incompatibility that affects jsdom also affects Browser Mode for the sql.js layer. | Playwright E2E for browser tests, jsdom for unit tests — the two-tier split already in place |
| `playwright-testing-library` | Community wrapper porting Testing Library query API onto Playwright locators. Adds a dependency for a pattern that Playwright's native `getByRole`, `getByText`, and `locator.filter({ hasText })` already handle natively. | Playwright built-in locators |
| Separate `e2e/fixtures/` Playwright fixture file for harness | Harness tests are short-running serial suites sharing one `Page` via `test.beforeAll`. Playwright's `test.extend()` fixture pattern is for per-test resource setup/teardown. The existing `beforeAll` + `page.close()` in `afterAll` is correct for a shared browser session. | Current pattern in `harness-superstack.spec.ts` |
| `canvas-testing-library` or `jest-canvas-mock` | PivotGrid and HarnessShell use CSS table layout + SVG, not `<canvas>`. No canvas element is involved in the plugin pipeline. | N/A — not applicable |

---

## Integration Patterns for New Plugin Tests

### Pattern A: Vitest jsdom — Plugin Hook Unit Test

Use for: testing `transformData`, `transformLayout`, `afterRender` hooks in isolation, without a real browser.

File header annotation:
```
// @vitest-environment jsdom
```

This matches the pattern in `tests/views/pivot/PluginRegistry.test.ts`. The `makeCtx()` helper returns a `RenderContext` with `rootEl: document.createElement('div')`, which gives jsdom a real DOM node for `afterRender` mutations. D3 data joins work in jsdom — `d3.select(el).selectAll().data().join()` executes correctly.

**Key constraint:** jsdom does not support `getComputedStyle` for CSS Grid layout values (`grid-column`, `grid-template-columns`). Test the data driving CSS Grid (cell placement `colStart`/`colSpan` values) not the computed CSS output. CSS custom property reads also return empty strings in jsdom — test layout logic, not CSS rendering.

### Pattern B: Playwright — HarnessShell Plugin E2E

Use for: full plugin pipeline exercised through the HarnessShell UI (`/harness.html`), including click interactions, dependency cascade, DOM visual state.

Established patterns from `e2e/harness-superstack.spec.ts`:
- `page.goto('/harness.html')` + `waitForSelector('.hns-root')`
- `page.locator('.hns-plugin-row').nth(i)` iteration for plugin lookup (text-is selector is unreliable — use the iteration pattern)
- `page.waitForTimeout(300)` after each toggle (render is synchronous but D3 transitions fire after paint)
- `countElements(page, selector)` for DOM count assertions
- `expect(locator).toContainClass(className)` for CSS class state assertions (Playwright 1.53+)
- `locator.getAttribute('data-*')` for data attribute regression guards

**Extension point:** Add `e2e/helpers/harness.ts` (separate from `isometry.ts`) with harness-specific helpers. The `waitForHarnessReady`, `togglePlugin`, `enablePlugin`, `disablePlugin` functions that exist inline in `harness-superstack.spec.ts` should be extracted here so additional plugin E2E specs can share them without duplication.

### Pattern C: Playwright CSS Computed Property Assertion

For testing CSS custom properties set by zoom or layout plugins — `toHaveCSS()` does not support custom properties:

```typescript
const zoom = await page.locator('.pv-root').evaluate(
  (el) => getComputedStyle(el).getPropertyValue('--sg-zoom').trim()
);
expect(zoom).toBe('1.5');
```

Use `evaluate()` for custom properties; use `expect(locator).toHaveCSS('display', 'grid')` for standard properties.

### Pattern D: Playwright Data Attribute Regression Guard

For verifying plugin DOM output is structurally correct (regression guard, not visual):

```typescript
const firstCollapsible = page.locator('.pv-col-span--collapsible').first();
expect(await firstCollapsible.getAttribute('data-parent-path')).not.toBeNull();
expect(await firstCollapsible.getAttribute('data-col-start')).not.toBeNull();
expect(await firstCollapsible.getAttribute('data-col-span')).not.toBeNull();
```

This pattern is already in use in `harness-superstack.spec.ts` (test 2). Apply it to all new plugins that set data attributes.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@playwright/test@1.58.2` | Node 18+, macOS 14 | Current release. `toContainClass()` available since 1.53. No upgrade needed. |
| `vitest@4.0.18` | `jsdom@28.1.0` | Known compatibility issue with jsdom 28 in Vitest 4.0.15-16; 4.0.18 resolves this. Do not upgrade jsdom independently. |
| `@vitest/coverage-v8@4.0.18` | `vitest@4.0.18` | Must match vitest version exactly — these are monorepo packages. |

---

## Installation

No new packages required. All capabilities needed for comprehensive plugin E2E testing are available in the current dependency set.

```bash
# Verify Playwright browsers are installed (needed after fresh clone or CI setup)
npx playwright install chromium
```

---

## Alternatives Considered

| Recommended | Alternative | When Alternative is Better |
|-------------|-------------|---------------------------|
| Extract `e2e/helpers/harness.ts` | `@playwright/test` `test.extend()` fixtures | Fixtures make sense for stateful resources needing per-test setup/teardown. The harness uses a shared page across a serial suite — `beforeAll`/`afterAll` is correct here. |
| jsdom per-file `// @vitest-environment jsdom` | Vitest Browser Mode | Browser Mode is appropriate when unit tests need real CSS layout (e.g., `getBoundingClientRect`). Plugin hooks manipulate DOM structure, not layout — jsdom is sufficient and faster. Revisit if CSS Grid span computation needs verification. |
| `locator.evaluate(el => getComputedStyle(el).getPropertyValue('--prop'))` | `expect(locator).toHaveCSS()` | `toHaveCSS()` is simpler for single standard property assertions. Use `evaluate` for CSS custom properties (`--sg-zoom`, `--sg-cell-width`) or multi-property reads in one round-trip. |

---

## Sources

- [Playwright Release Notes](https://playwright.dev/docs/release-notes) — verified v1.58.2 current, `toContainClass()` since v1.53, aria snapshots stable — HIGH confidence
- [Playwright Assertions](https://playwright.dev/docs/test-assertions) — `toHaveCSS`, `toContainClass`, `toMatchAriaSnapshot` API verification — HIGH confidence
- [Vitest Browser Mode Guide](https://vitest.dev/guide/browser/) — experimental status confirmed as of 2025-06 — MEDIUM confidence
- [InfoQ: Vitest Introduces Browser Mode as Alternative to JSDOM](https://www.infoq.com/news/2025/06/vitest-browser-mode-jsdom/) — comparative analysis, experimental status — MEDIUM confidence
- Codebase inspection — `e2e/harness-superstack.spec.ts`, `e2e/helpers/isometry.ts`, `vitest.config.ts`, `tests/views/pivot/*.test.ts`, `package.json` — HIGH confidence (first-party, definitive)

---

*Stack research for: Plugin E2E test suite — Vitest integration + Playwright HarnessShell*
*Researched: 2026-03-21*
