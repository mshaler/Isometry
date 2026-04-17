# Phase 154: Regression Guard + Hardening - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

All existing tests pass with no regressions after the explorer relocation (Phases 151-153), and new integration tests verify the complete inline embedding flow end-to-end: top-slot Data toggle, Projections auto-visibility for SuperGrid, and LATCH Filters persistence across view switches.

</domain>

<decisions>
## Implementation Decisions

### Test Layers
- **D-01:** Two test layers — seam tests (jsdom, Vitest) for DOM wiring logic + one Playwright E2E spec as a smoke test for the full inline embedding flow.

### File Organization
- **D-02:** Single seam file `tests/seams/ui/inline-embedding.test.ts` with `describe` blocks per flow (top-slot toggle, Projections auto-visibility, bottom-slot persistence). Single E2E file `e2e/inline-embedding.spec.ts` for smoke.

### Regression Fix Scope
- **D-03:** Fix anything red regardless of cause. Success criterion is "full test suite green" — not limited to Phase 151-153 regressions only.

### Claude's Discretion
- Seam test setup strategy — how much of WorkbenchShell/DockNav to instantiate vs stub for the jsdom integration tests
- E2E spec granularity — whether the single E2E spec has one test per flow or combines flows into fewer assertions
- Whether the seam test reuses `makeProviders()` or needs a lighter harness given this is UI wiring (not data flow)
- Describe block naming within the seam file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Success Criteria (from ROADMAP.md)
- `.planning/ROADMAP.md` lines 188-197 — Phase 154 goal, depends-on, success criteria (4 assertions)

### Requirements
- `.planning/REQUIREMENTS.md` — REGR-01 (all existing tests pass with no regressions)

### Existing Seam Test Patterns
- `tests/seams/ui/workbench-shell.test.ts` — Closest existing seam test for WorkbenchShell DOM assertions. Reference for setup pattern.
- `tests/seams/ui/calc-explorer.test.ts` — Example of jsdom seam test with provider wiring.

### Existing E2E Patterns
- `e2e/` directory — 11 existing Playwright specs. Reference for page object patterns and test structure.
- `playwright.config.ts` — E2E configuration.

### Phase 151-153 Implementation (what's being tested)
- `src/ui/WorkbenchShell.ts` — `getTopSlotEl()`, `getBottomSlotEl()` accessors for inline slot containers.
- `src/main.ts` — `showDataExplorer()`/`hideDataExplorer()`, `showPropertiesExplorer()`/`hidePropertiesExplorer()`, `showProjectionExplorer()`/`hideProjectionExplorer()`, `showLatchFilters()`/`hideLatchFilters()`, `showFormulasExplorer()`/`hideFormulasExplorer()`, `syncTopSlotVisibility()`, `syncBottomSlotVisibility()`, `onActivateItem` handler with integrate/visualize/analyze branches.
- `src/ui/DockNav.ts` — `setItemPressed()` for aria-pressed toggle state.
- `src/ui/section-defs.ts` — `SECTION_DEFS`, `DOCK_DEFS` with integrate/visualize/analyze sections.

### Test Infrastructure
- `tests/harness/` — `realDb()`, `makeProviders()`, `seedCards()` factories.
- `vite.config.ts` — Vitest configuration, jsdom per-file annotation pattern.

### Prior Phase Context
- `.planning/phases/151-paneldrawer-removal-inline-container-scaffolding/151-CONTEXT.md` — D-06: deferred new slot tests to Phase 154.
- `.planning/phases/152-integrate-visualize-inline-embedding/152-CONTEXT.md` — Top-slot decisions D-01 through D-04.
- `.planning/phases/153-analyze-section-inline-embedding/153-CONTEXT.md` — Bottom-slot decisions D-01 through D-08, filter persistence D-04.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/seams/ui/workbench-shell.test.ts` — Existing seam test with WorkbenchShell DOM setup; pattern for creating shell instance in jsdom
- `tests/harness/realDb()` + `makeProviders()` — Real provider wiring if needed for filter persistence test
- Playwright page object patterns from existing 11 E2E specs
- `// @vitest-environment jsdom` annotation for DOM test files

### Established Patterns
- Seam tests: describe blocks per concern, real providers via factories, DOM assertions via querySelector
- E2E: Playwright `page.locator()`, `expect(locator).toBeVisible()`, dock click → assert visibility
- Anti-patching rule: fix app code if test fails, never weaken assertions

### Integration Points
- Seam test needs to exercise: DockNav item activation → onActivateItem handler → show/hide functions → DOM visibility
- E2E test needs to exercise: click dock item → verify slot container visibility in browser
- Filter persistence test: activate filter → switch view → verify filter DOM still present

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

*Phase: 154-regression-guard-hardening*
*Context gathered: 2026-04-17*
