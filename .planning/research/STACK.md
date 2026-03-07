# Technology Stack — v4.2 Polish + QoL

**Project:** Isometry v5
**Researched:** 2026-03-07
**Confidence:** HIGH -- polish milestone requires minimal new dependencies; most work is fixing existing code and adding CSS/HTML

---

## Context: Locked Existing Stack (Do Not Re-Research)

These are validated and final. No changes permitted:

| Technology | Version | Status |
|------------|---------|--------|
| TypeScript | 5.9 (strict) | Locked |
| sql.js | 1.14 (custom FTS5 WASM 756KB) | Locked |
| D3.js | v7.9 | Locked |
| Vite | 7.3 | Locked |
| Vitest | 4.0 | Locked |
| Swift | iOS 17+ / macOS 14+ | Locked |
| SwiftUI | iOS 17 / macOS 14 | Locked |
| WKWebView + WKURLSchemeHandler | iOS 17 / macOS 14 | Locked |
| ETL deps | gray-matter, PapaParse, xlsx/SheetJS | Locked |
| Native deps | EventKit, SQLite3 C, SwiftProtobuf 1.28+, CKSyncEngine | Locked |

**This document covers ONLY what is needed for the v4.2 polish/QoL scope.**

---

## Conclusion Up Front

v4.2 is a polish milestone. The guiding principle is **fix and refine, not add**. Of the six work areas (build health, empty states, keyboard shortcuts, visual polish, stability, ETL validation), only ONE justifies a new dev dependency: Biome for unified linting/formatting. Everything else is achievable with existing tools and hand-written CSS/TypeScript.

1. **Build health: ONE new dev dependency (Biome 2.x).** Replaces the absent linter/formatter gap. The project currently has zero linting or formatting tools -- 23,535 LOC of TypeScript with no automated style enforcement. Biome is a single tool that replaces ESLint + Prettier, runs 15x faster, and requires near-zero configuration. The 314 TypeScript strict mode errors are fixable without new tools (they are all `TS4111` bracket-access and `TS2532` narrowing issues across 6 src files + 25 test files).

2. **Empty states: ZERO new dependencies.** Inline SVG illustrations + CSS animations. No illustration library needed -- 9 simple, themeable SVGs matching the existing dark design token system. Each view gets a `<div class="view-empty">` with an inline SVG icon and contextual text.

3. **Keyboard shortcuts: ZERO new dependencies.** The existing `setupMutationShortcuts()` pattern (document.addEventListener + cleanup function) is correct and proven. Adding more shortcuts follows the same pattern. A dedicated shortcut library is overkill for ~15 bindings. The codebase already manages 7 keydown listeners across SuperGrid, SuperZoom, AuditOverlay, and MutationManager.

4. **Visual polish / accessibility / stability / ETL validation: ZERO new dependencies.** Pure CSS refinement using existing design tokens. ARIA attributes added inline. Error boundaries are TypeScript try/catch. ETL validation is test-driven.

**Total new dependencies: 1 (dev-only).** This is correct for a polish milestone.

---

## Recommended Stack

### Build Health: Linting + Formatting

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @biomejs/biome | ^2.4 | Unified linter + formatter for TypeScript, JSON, CSS | Single tool replaces ESLint + Prettier. Rust-based, 15x faster than ESLint. 450+ lint rules including typescript-eslint equivalents. Type-aware rules (noFloatingPromises) without requiring separate tsconfig plugin. Flat config via `biome.json`. Zero-config CSS formatting covers the 5 existing `.css` files. JSON formatting catches `tsconfig.json` / `package.json` drift. |

**Why Biome over ESLint + Prettier:**
- The project has ZERO linting today. Starting fresh with Biome avoids the ESLint flat config migration, the eslint-config-prettier conflict dance, and the 6+ plugin packages (`@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, etc.)
- Biome is one `npm install`, one `biome.json`, done
- Biome 2.x has type-aware linting without requiring `parserOptions.project` (the tsconfig integration that makes ESLint slow)
- Format-on-save works with VS Code extension (`biomejs.biome`)

**Why NOT ESLint 9 + Prettier:**
- ESLint 9 flat config is stable but requires 3-6 packages for TypeScript projects
- Prettier requires a second tool + `eslint-config-prettier` to prevent conflicts
- Slower execution (ESLint is single-threaded JavaScript; Biome is multi-threaded Rust)
- For a greenfield linter setup on an existing codebase, Biome's "format everything consistently, lint the important things" approach is less friction

### Build Health: TypeScript Strict Mode Fixes

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript (existing) | 5.9 | Fix 314 `tsc --noEmit` errors | No new dependency. The errors are concentrated in 6 src files and 25 test files. Error breakdown: 116x `TS2532` (Object possibly undefined -- add narrowing guards), 30x `TS4111` (bracket access for index signatures -- change `obj.key` to `obj['key']`), remaining are type mismatches in tests (update mock shapes to match current interfaces). Estimated effort: 2-4 hours of mechanical fixes. |

### Build Health: CI Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | N/A | CI pipeline for typecheck + lint + test | No `.github/` directory exists. A minimal workflow running `tsc --noEmit`, `biome check`, and `vitest --run` on push/PR catches regressions. Single YAML file. No new npm dependency. |

**CI workflow scope (minimal):**
```yaml
# .github/workflows/ci.yml
# Steps: checkout, setup-node, npm ci, tsc --noEmit, biome check, vitest --run
```

No Xcode CI (Swift builds require macOS runners, expensive). TypeScript CI only.

### Build Health: npm Build Phase Fix

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Xcode Build Phase (existing) | N/A | Fix pre-existing npm Run Script failure | The `package.json` path mismatch in the Xcode npm Run Script build phase is a known debt item. Fix is updating the script path, not adding dependencies. |

### Empty States

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Inline SVG + CSS | N/A | Empty state illustrations for 9 views | No library needed. Each view's empty state is a small inline SVG (icon + text) styled with existing CSS custom properties (`--text-muted`, `--bg-surface`, etc.). SVG is the right format because: (a) scales to any container size, (b) themeable via `currentColor` and CSS variables, (c) no asset loading/caching overhead, (d) accessible via `<title>` and `aria-label`. |

**Why NOT an illustration library:**
- Libraries like unDraw, Storyset, or Flaticon provide generic illustrations that clash with Isometry's dark, data-dense aesthetic
- Each empty state needs contextual messaging ("Import data to see your knowledge graph" vs "No cards match your filter")
- Inline SVG is ~500 bytes per icon vs ~50KB+ per library illustration
- CSS `@keyframes` animation (subtle fade-in, gentle bounce) is sufficient -- no GSAP or Framer Motion needed

### Keyboard Shortcuts

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `addEventListener('keydown')` (existing) | N/A | Centralized shortcut registry | No library needed. The project already has 7 keydown handlers across 4 files using a consistent pattern: register on mount, return cleanup function, guard against input fields. A centralized `ShortcutRegistry` class (~100 LOC) can deduplicate this pattern while preserving the same addEventListener approach. |

**Why NOT hotkeys-js or tinykeys:**
- hotkeys-js (4.0.2, ~4KB) and tinykeys (3.0.0, ~650B) are both good libraries, but the project already has a working keyboard pattern
- Adding a library means migrating 7 existing handlers to its API -- risk for zero gain
- The total shortcut count is ~15 bindings (Cmd+Z, Cmd+Shift+Z, Cmd+F, Cmd+/, Escape, arrow keys for zoom, etc.) -- well within "hand-roll" territory
- A registry class provides the same benefits (centralized binding table, conflict detection, help overlay data source) without an external dependency

**Shortcut registry design (new internal module):**
```typescript
// src/shortcuts/ShortcutRegistry.ts
// Centralizes all keyboard bindings
// Provides: register(combo, handler), unregister(combo), getAll() for help overlay
// Guards: skip when focus in INPUT/TEXTAREA/contentEditable
// Platform: auto-detects Mac vs non-Mac for Cmd/Ctrl
```

### Visual Polish + Accessibility

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS custom properties (existing) | N/A | Typography, spacing, color consistency | Extend `design-tokens.css` with missing tokens (e.g., `--font-mono`, `--shadow-card`, `--border-subtle`). No new tool. |
| ARIA attributes (native HTML) | N/A | Screen reader support for interactive elements | The codebase has exactly 1 ARIA attribute (`aria-live` on ImportToast). Interactive elements (sidebar buttons, toolbar controls, filter dropdowns, keyboard-navigable cells) need `role`, `aria-label`, `aria-expanded`, `tabindex`. No library needed -- these are HTML attributes. |

**Why NOT an accessibility testing library (axe-core, pa11y):**
- Axe-core (17KB) is excellent but requires a DOM environment for testing -- Vitest runs in Node with `pool: 'forks'`, not jsdom
- The views create DOM in test via jsdom document stubs, but full axe audits need a rendered page
- Manual ARIA attribute addition is more valuable than automated scanning at this stage (the app has 1 ARIA attribute total)
- Consider axe-core in a future milestone when the app has browser-based integration tests

### Stability + Error Recovery

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript try/catch (existing) | N/A | Error boundaries for view render, import, and bridge operations | No library needed. Wrap `render()` calls in try/catch with user-visible error banners (the ViewManager already has `_showError()`). Add `window.onerror` and `unhandledrejection` handlers for uncaught errors. |

### ETL End-to-End Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest (existing) | 4.0 | Integration tests: import source -> render in view | No new dependency. Write integration tests that: (a) parse test fixtures through each of the 6 TS parsers + 3 native adapter mocks, (b) write to sql.js, (c) query back, (d) verify CardDatum shape matches what views expect. The gap is not tooling -- it's missing test coverage for the full pipeline. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Linter/formatter | Biome 2.x | ESLint 9 + Prettier | 3-6 package install, config conflict potential, slower execution. Biome is one package, one config. |
| Linter/formatter | Biome 2.x | oxlint (oxc) | Oxlint is linter-only (no formatter). Would still need Prettier for formatting. Biome covers both. |
| Linter/formatter | Biome 2.x | dprint | dprint is formatter-only (no linter). Would still need ESLint for linting. Biome covers both. |
| Keyboard shortcuts | Native addEventListener + registry | hotkeys-js 4.0.2 | Would require migrating 7 existing handlers. 15 bindings is below the complexity threshold for a library. |
| Keyboard shortcuts | Native addEventListener + registry | tinykeys 3.0.0 | Same migration cost. Tinykeys is tiny (~650B) but still a dependency for something the project already does. |
| Empty states | Inline SVG + CSS | Lottie animations | Lottie adds 50KB+ runtime + JSON animation files. Overkill for static empty state placeholders. Mismatches the data-dense aesthetic. |
| Empty states | Inline SVG + CSS | Illustration library (unDraw, Storyset) | Generic illustrations clash with dark theme. Each adds 50-200KB of assets. |
| A11y testing | Manual ARIA + future axe-core | pa11y | Requires a running HTTP server and headless browser. Too heavy for current test infrastructure. |
| A11y testing | Manual ARIA + future axe-core | vitest-axe | Requires jsdom environment. Vitest is configured with `environment: 'node'` and `pool: 'forks'` for WASM isolation. Switching environments risks breaking 1,893 existing tests. |
| CI | GitHub Actions | None (defer) | The project has 314 TS errors accumulating across milestones. Without CI, these will keep growing. A 20-line YAML file prevents regression. |

---

## What NOT to Add

This is critical for a polish milestone. Resist scope creep.

| Do NOT Add | Why Not | Do This Instead |
|------------|---------|-----------------|
| React / Preact / Lit | The project is pure TypeScript + D3 by architectural decision (D-001). Empty states and UI components are vanilla DOM. | Hand-write `<div>` + inline SVG + CSS |
| Tailwind CSS | 5 CSS files with 77 design tokens is not a scale that benefits from utility-first CSS. Tailwind would add build complexity and conflict with existing custom properties. | Extend `design-tokens.css` with missing tokens |
| Storybook | No component library to document. Views are D3 data joins, not reusable components. | Use `npm run dev` + manual testing |
| Jest | Vitest 4.0 is locked and working (1,893 tests). Jest migration has zero upside. | Keep Vitest |
| Playwright / Cypress | E2E testing requires a running app + browser automation. Valuable but out of scope for a polish milestone. Consider for a future QA milestone. | Integration tests in Vitest |
| Motion libraries (GSAP, Framer Motion, anime.js) | The project uses D3 transitions for SVG views and WAAPI for SuperGrid. Adding a third animation system creates inconsistency. | CSS `@keyframes` for empty state fade-in; existing D3/WAAPI for everything else |
| State management library (Zustand, Jotai, Valtio) | D3 data join IS state management (D-001). Provider system + StateCoordinator is the state layer. | Keep existing provider pattern |
| Component testing library (@testing-library/dom) | Views are D3 data joins rendering to SVG/div. @testing-library's `getByRole`/`getByText` queries are less useful when DOM structure is D3-generated. | Query DOM directly in Vitest tests (existing pattern) |

---

## Installation

### New Dev Dependency

```bash
# Biome -- unified linter + formatter (dev-only)
npm install -D --save-exact @biomejs/biome
```

### Biome Configuration

```jsonc
// biome.json (project root)
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "off"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      }
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "dist-native",
      ".build",
      "*.wasm"
    ]
  },
  "css": {
    "formatter": {
      "enabled": true
    },
    "linter": {
      "enabled": true
    }
  }
}
```

### Package.json Script Additions

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "ci": "tsc --noEmit && biome check . && vitest --run"
  }
}
```

### GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx biome check .
      - run: npx vitest --run
```

---

## TypeScript Strict Mode Fix Plan

The 314 errors across 31 files break down into mechanical categories:

| Error Type | Count | Fix Pattern | Risk |
|------------|-------|-------------|------|
| `TS2532` (possibly undefined) | 116 | Add `!` assertion or null guard at call site | LOW -- tests already verify the values exist |
| `TS4111` (index signature access) | ~30 | Change `obj.key` to `obj['key']` | ZERO -- purely syntactic |
| `TS2322` (type mismatch) | ~30 | Update mock types to include new `source` field (added in v4.1) | LOW -- additive |
| `TS2739` (missing properties) | 10 | Add `updatedIds`, `deletedIds` to ImportResult mocks | LOW -- additive |
| `TS2345` (argument type) | ~8 | Cast `vi.fn()` to correct function type | LOW -- test-only |
| `TS18048` (possibly undefined) | ~5 | Add null guard | LOW |
| `TS2352` (conversion overlap) | 3 | Use `as unknown as HTMLElement` | LOW -- test-only |
| Remaining | ~112 | Various narrowing / type alignment | LOW-MEDIUM |

**Src files (6):** JSONParser.ts, MarkdownParser.ts, NativeBridge.ts, SuperGrid.ts, SortState.ts, etl-import-native.handler.ts
**Test files (25):** Mostly view tests and ETL tests needing mock shape updates

**All fixes are non-behavioral.** No runtime logic changes. The existing 1,893 tests serve as the safety net.

---

## Design Token Extensions

The existing `design-tokens.css` has 77 tokens. Polish work will need:

| Token | Value | Purpose |
|-------|-------|---------|
| `--font-mono` | `'SF Mono', 'Fira Code', monospace` | Code/ID display in card details |
| `--font-size-xs` | `11px` | Badges, metadata labels |
| `--font-size-sm` | `13px` | Secondary text, subtitles |
| `--font-size-md` | `14px` | Body text (current implicit default) |
| `--font-size-lg` | `16px` | Section headers |
| `--shadow-card` | `0 2px 8px rgba(0,0,0,0.3)` | Card elevation (Gallery, Kanban) |
| `--shadow-dropdown` | `0 4px 16px rgba(0,0,0,0.4)` | Filter dropdowns, context menus |
| `--border-subtle` | `1px solid rgba(255,255,255,0.08)` | Section dividers |
| `--border-focus` | `2px solid var(--accent)` | Focus ring for keyboard navigation |
| `--empty-state-icon` | `rgba(255,255,255,0.15)` | Empty state SVG fill color |

No new CSS file needed -- extend `design-tokens.css`.

---

## Accessibility Baseline

Current state: 1 ARIA attribute in entire codebase (`aria-live="polite"` on ImportToast).

Minimum ARIA coverage for v4.2:

| Element | Attribute | Value |
|---------|-----------|-------|
| Sidebar view buttons | `role` | `"tab"` |
| Sidebar view buttons | `aria-selected` | `"true"` / `"false"` |
| Sidebar container | `role` | `"tablist"` |
| Sidebar container | `aria-label` | `"View selector"` |
| Toolbar buttons | `aria-label` | Descriptive label per button |
| Filter dropdowns | `role` | `"listbox"` |
| Filter options | `role` | `"option"` |
| Filter options | `aria-selected` | `"true"` / `"false"` |
| SuperGrid cells | `role` | `"gridcell"` |
| SuperGrid headers | `role` | `"columnheader"` / `"rowheader"` |
| Help overlay | `role` | `"dialog"` |
| Help overlay | `aria-modal` | `"true"` |
| Empty state | `role` | `"status"` |
| Error banner | `role` | `"alert"` |
| Error banner | `aria-live` | `"assertive"` |

No testing library needed. Attributes added inline during DOM creation in existing TypeScript view code.

---

## Sources

- [Biome official documentation](https://biomejs.dev/) -- Biome v2 feature overview, configuration, installation -- HIGH confidence (official documentation)
- [Biome v2 announcement (Biotype)](https://biomejs.dev/blog/biome-v2/) -- Type-aware linting, plugin system, nested configs -- HIGH confidence (official blog)
- [Biome npm package](https://www.npmjs.com/package/@biomejs/biome) -- Latest version 2.4.6, published 2026-03-06 -- HIGH confidence (npm registry)
- [Biome 2026 roadmap](https://biomejs.dev/blog/roadmap-2026/) -- Future direction confirmation -- MEDIUM confidence (official roadmap)
- [hotkeys-js GitHub](https://github.com/jaywcjlove/hotkeys-js) -- Evaluated as keyboard shortcut alternative -- MEDIUM confidence (GitHub)
- [tinykeys GitHub](https://github.com/jamiebuilds/tinykeys) -- Evaluated as keyboard shortcut alternative (~650B) -- MEDIUM confidence (GitHub)
- [WCAG 2.1 ARIA practices](https://www.w3.org/WAI/ARIA/apg/) -- Grid, tab, listbox, dialog patterns -- HIGH confidence (W3C)

---

## Open Questions (Phase Research Flags)

- **Biome + Vite integration:** Biome runs standalone (CLI), not as a Vite plugin. The `biome check` command runs in CI and as a pre-commit hook. Verify that Biome's import organization does not conflict with Vite's import resolution (particularly for `?raw` and `?worker` imports). **Flag for Phase 1: run `biome check --write` on full codebase, review changes before committing.**

- **TypeScript strict mode test breakage:** Fixing the 314 errors may reveal latent type issues in test mocks that were masked by the errors. Run full test suite after each file group fix. **Flag for Phase 1: fix src files first (6 files), run tests, then fix test files (25 files).**

- **Provisioning profile regeneration:** The provisioning profile needs iCloud + CloudKit entitlement regeneration. This is an Apple Developer Portal task, not a code change. Cannot be validated in CI. **Flag for Phase 1: document the manual steps, mark as done when developer confirms.**

---

*Stack research for: Isometry v4.2 Polish + QoL -- build health, empty states, keyboard shortcuts, visual polish, stability, ETL validation*
*Researched: 2026-03-07*
