# Phase 107: Playwright E2E - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-browser Playwright tests verify that toggling each HarnessShell plugin category produces the expected DOM output, multi-category combos render additive combined state, and the full suite runs in CI on every push. Does NOT modify plugin implementations, add new plugins, or change HarnessShell behavior — pure E2E test coverage and CI wiring.

</domain>

<decisions>
## Implementation Decisions

### Spec file organization
- One spec file per plugin category, flat in `e2e/` with `harness-` prefix: `harness-base.spec.ts`, `harness-superzoom.spec.ts`, `harness-supersort.spec.ts`, etc.
- Keep existing `harness-superstack.spec.ts` as-is — other 10 categories get new parallel files following same pattern
- Single `harness-combos.spec.ts` file for all 5 multi-plugin combination specs (5 describe blocks)
- All files flat in `e2e/` directory matching existing convention — no subdirectory

### DOM assertion strategy
- Per-category specs assert structural DOM changes when category is enabled: category-specific elements must appear (e.g., `.pv-calc-footer` for SuperCalc, `input.pv-search` for SuperSearch, sort indicators for SuperSort)
- D3 transition settling handled via `expect.poll()` on DOM conditions — no `waitForTimeout` anywhere (E2E-04 requirement)
- Multi-plugin combo specs assert additive DOM presence: enable Sort+Search+Select → assert sort indicators + search input + selection styling ALL present simultaneously

### Sidebar vs programmatic toggle
- Per-category specs use sidebar checkbox clicks to toggle plugins — proves the actual UI path users take
- Combo specs use `window.__harness` programmatic API for speed — testing combined state, not toggle UI
- Both paths exercised across the full suite

### Screenshot baselines
- ~5-8 key visual state screenshots for E2E-03: SuperZoom at 150%, SuperSize with resized columns, SuperScroll with sentinel spacers visible, SuperStack collapsed, SuperDensity mini-cards mode, SuperCalc footer visible, SuperSearch highlight active, full combo state
- Stored in `e2e/screenshots/` matching existing `harness-*.png` naming convention
- Committed to git as regression baselines (E2E-03 requires "stored in the repository")

### CI integration
- New `e2e` job in `.github/workflows/ci.yml` running in parallel with existing typecheck/lint/test/bench jobs
- Hard gate: PR check fails if any E2E spec fails (E2E-05 requirement)
- Trigger: `push` to all branches (matches existing CI trigger pattern)
- Browser install cached via `actions/cache` with `~/.cache/ms-playwright` key to save 30-60s per run

### Claude's Discretion
- Exact DOM selectors per plugin category (derive from actual plugin afterRender output)
- Which 5 multi-plugin combos to test (derive from meaningful coupling pairs identified in Phase 106)
- Exact screenshot capture points within each spec
- Whether to use page.waitForSelector() or expect.poll() case-by-case (both allowed, just no waitForTimeout)
- Playwright browser cache key versioning strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing E2E harness code (extend this)
- `e2e/helpers/harness.ts` — waitForHarnessReady, enablePlugin, disablePlugin, togglePlugin, getEnabledPlugins helpers
- `e2e/harness-superstack.spec.ts` — Reference pattern for per-category spec structure (421 lines, 9 test cases)

### HarnessShell (test target)
- `src/views/pivot/harness/HarnessShell.ts` — window.__harness API (enable/disable/isEnabled/getAll/getEnabled), window.__harnessReady flag
- `src/views/pivot/harness/FeaturePanel.ts` — Sidebar checkbox toggle tree with category expand/collapse, enable/disable all per category

### Plugin catalog (category taxonomy)
- `src/views/pivot/plugins/FeatureCatalog.ts` — All 27 plugins across 11 categories: Base, SuperStack, SuperZoom, SuperSize, SuperDensity, SuperCalc, SuperScroll, SuperSearch, SuperSort, SuperSelect, SuperAudit

### Existing Playwright config
- `playwright.config.ts` — testDir: ./e2e, Chromium only, 1440x900 viewport, dark mode, Vite dev server webServer config

### CI pipeline
- `.github/workflows/ci.yml` — Current 4 jobs (typecheck, lint, test, bench), push trigger on all branches

### Phase 106 coupling pairs (inform combo selection)
- `.planning/phases/106-cross-plugin-interactions/106-CONTEXT.md` — 7 coupling pairs and triple combos identified for cross-plugin testing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `e2e/helpers/harness.ts`: Full programmatic plugin control API (waitForHarnessReady, enablePlugin, disablePlugin, togglePlugin, getEnabledPlugins)
- `e2e/harness-superstack.spec.ts`: 421-line reference spec with screenshot helper, toggle assertions, dependency chain tests — pattern to replicate
- `e2e/fixtures.ts`: Existing test fixtures for main app E2E (may have reusable data patterns)
- `e2e/helpers/isometry.ts`: Main app helpers (screenshot, waitForAppReady) — parallel pattern, do not modify

### Established Patterns
- Harness specs use self-contained screenshot helper (not imported from isometry.ts)
- `waitForHarnessReady()` navigates to `/?harness=1` and polls `window.__harnessReady`
- Plugin control via `page.evaluate()` calling `window.__harness` API
- Sequential test execution (`fullyParallel: false, workers: 1` in playwright.config.ts)
- Screenshot naming: `harness-{description}.png` in `e2e/screenshots/`

### Integration Points
- `.github/workflows/ci.yml`: Add new `e2e` job with Playwright install + cache
- `playwright.config.ts`: May need updates if Playwright cache or reporter config changes
- `e2e/screenshots/`: Baseline PNGs committed to git

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 107-playwright-e2e*
*Context gathered: 2026-03-21*
