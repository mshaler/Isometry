# Phase 170: Integration Testing - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-seam Vitest tests and Playwright CI smoke verify the full ExplorerCanvas path end-to-end — registry-based mount with real DataExplorerPanel content, tab switching via commitProjection, and status slot updates after simulated import. No new features; no ExplorerCanvas changes; testing only.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Test file organization: new file vs extending existing `integration.test.ts` — pick whichever keeps v13.0 stub tests (INTG-01..06) separate from v13.1 real-canvas tests (EINT-01..04)
- Playwright smoke: extend `superwidget-smoke.spec.ts` or new spec — pick whichever keeps the v13.0 transition matrix test clean
- Import simulation approach for EINT-03: mock Worker bridge stats response vs real mini-pipeline — pick the lightest approach that still proves the status slot wiring
- Registry wiring for cross-seam tests: real ExplorerCanvas registered alongside stubs for View/Editor — follow the `registerAllStubs()` + selective real registration pattern

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Success Criteria (verbatim from ROADMAP.md)
- `.planning/ROADMAP.md` §Phase 170 — 4 numbered success criteria defining exact assertions for EINT-01..04

### Requirements
- `.planning/REQUIREMENTS.md` §Integration Testing — EINT-01, EINT-02, EINT-03, EINT-04

### v13.0 Integration Test Pattern (follow this)
- `tests/superwidget/integration.test.ts` — Phase 166 cross-seam tests (INTG-01..06): registerAllStubs(), getCanvasFactory(), commitProjection assertions
- `e2e/superwidget-smoke.spec.ts` — Phase 166 Playwright smoke: harness HTML, __sw.commitProjection, WebKit assertions

### ExplorerCanvas Implementation (what's being tested)
- `src/superwidget/ExplorerCanvas.ts` — Real canvas: mount/destroy, tab containers, getPanel()
- `src/superwidget/statusSlot.ts` — Status slot: renderStatusSlot(), updateStatusSlot()
- `src/superwidget/registry.ts` — Canvas registry with getCanvasFactory()
- `src/superwidget/projection.ts` — Projection type, switchTab(), CanvasComponent interface

### Existing Unit Tests (don't duplicate)
- `tests/superwidget/ExplorerCanvas.test.ts` — EXCV-01..04 unit tests (direct instantiation, not registry)
- `tests/superwidget/statusSlot.test.ts` — 19-test suite for statusSlot.ts

### Prior Phase Context
- `.planning/phases/167-explorercanvas-core/167-CONTEXT.md` — D-01 (full panel mount), D-02 (closure capture), D-03 (sidebar removed)
- `.planning/phases/168-tab-system/168-CONTEXT.md` — D-03 (CSS hide/show), D-04 (onProjectionChange)
- `.planning/phases/169-status-slot/169-CONTEXT.md` — D-01 (inline bar), D-02 (relative time), D-03 (zero counts)

### Harness Infrastructure
- `tests/harness/` — realDb(), makeProviders(), seedCards() shared factories
- `e2e/fixtures/superwidget-harness.html` — Playwright harness mounting SuperWidget

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/superwidget/integration.test.ts`: Phase 166 cross-seam pattern — clearRegistry/registerAllStubs/getCanvasFactory/commitProjection
- `e2e/superwidget-smoke.spec.ts`: Playwright harness pattern — __sw.commitProjection with page.evaluate
- `tests/superwidget/ExplorerCanvas.test.ts`: makeConfig() factory for DataExplorerPanelConfig

### Established Patterns
- Cross-seam tests use `@vitest-environment jsdom` annotation
- Registry tests call clearRegistry() in beforeEach/afterEach
- Playwright specs use superwidget-harness.html fixture with __sw global

### Integration Points
- ExplorerCanvas registered in registry.ts — cross-seam tests need to register real ExplorerCanvas instead of stub
- Status slot wired in main.ts via refreshDataExplorer() — cross-seam test needs to simulate this path
- Playwright harness may need ExplorerCanvas registration to test real DOM

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

*Phase: 170-integration-testing*
*Context gathered: 2026-04-21*
