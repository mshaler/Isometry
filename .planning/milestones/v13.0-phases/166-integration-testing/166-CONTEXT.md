# Phase 166: Integration Testing - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-seam Vitest integration tests verifying the full projection-to-DOM path (INTG-01..06), plus a Playwright WebKit smoke test exercising the transition matrix as a CI hard gate (INTG-07). Includes a targeted code change: extending CanvasFactory to pass CanvasBinding through to canvas stubs, enabling sidecar DOM assertions.

</domain>

<decisions>
## Implementation Decisions

### Factory Binding Wiring
- **D-01:** Extend `CanvasFactory` type from `(canvasId: string) => CanvasComponent | undefined` to `(canvasId: string, binding: CanvasBinding) => CanvasComponent | undefined`. Minimal, explicit signature change.
- **D-02:** `commitProjection` call site changes from `this._canvasFactory(proj.canvasId)` to `this._canvasFactory(proj.canvasId, proj.canvasBinding)`.
- **D-03:** `getCanvasFactory()` in registry.ts passes binding through: `entry.create(binding)` instead of `entry.create()`.
- **D-04:** Binding change on the same canvasId triggers destroy+recreate (consistent with Phase 164 lifecycle pattern). The canvas-lifecycle condition in `commitProjection` broadens to also include `prev.canvasBinding !== proj.canvasBinding`.

### Cross-Seam Test Structure
- **D-05:** New `tests/superwidget/integration.test.ts` for INTG-01..06. Phase 165's `canvasWiring.test.ts` stays intact — it tests what it was designed for.
- **D-06:** Tests use the real registry + stubs (not mocks) — same pattern as canvasWiring.test.ts but with binding-aware factory.

### Playwright WebKit Setup
- **D-07:** Add a `webkit` project alongside `chromium` in existing `playwright.config.ts`. The smoke spec uses project-scoped filtering to run only in WebKit. Existing e2e specs continue running in chromium only.
- **D-08:** WebKit smoke test exercises the transition matrix only: Explorer→View/Bound (sidecar appears), View→Editor (zone label updates), verify DOM elements. Matches success criteria 1-3. Fast, focused, proves real browser path works.

### CI Pipeline
- **D-09:** Extend the existing e2e CI job with a WebKit step running after chromium specs. Hard gate — failure blocks merge. No new parallel job needed.

### Claude's Discretion
- Exact Playwright test helper structure (page object vs inline selectors)
- Whether the smoke spec uses a dedicated HTML harness page or piggybacks on the existing app
- Internal naming of the WebKit project in playwright config
- Whether INTG-06 rapid-commit stress test uses setTimeout or synchronous loop for the 10 rapid commits
- How to update existing Phase 165 tests that pass stubs to the now-extended factory signature (backward-compatible default or explicit update)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Requirements
- `.planning/ROADMAP.md` §Phase 166 — Success criteria and requirements (INTG-01..07)
- `.planning/REQUIREMENTS.md` §Integration Testing — INTG-01 through INTG-07 acceptance criteria
- `.planning/STATE.md` §Accumulated Context — v13.0 handoff decisions, critical pitfalls

### Phase Dependencies (must read)
- `.planning/phases/162-substrate-layout/162-CONTEXT.md` — Slot structure, CSS strategy, slot getter API
- `.planning/phases/163-projection-state-machine/163-CONTEXT.md` — Projection type, CanvasType/CanvasBinding unions, reference equality contract
- `.planning/phases/164-projection-rendering/164-CONTEXT.md` — CanvasFactory injection, commitProjection lifecycle, render-count tracking, destroy-then-mount pattern
- `.planning/phases/165-canvas-stubs-registry/165-CONTEXT.md` — Registry architecture, sidecar rendering, stub visual content, file organization

### Source Code (must read)
- `src/superwidget/SuperWidget.ts` — CanvasFactory type (line 5), commitProjection (line 121+) — both modified by this phase
- `src/superwidget/registry.ts` — getCanvasFactory() (line 25) — modified to pass binding through
- `src/superwidget/ViewCanvasStub.ts` — Sidecar DOM creation in mount() conditioned on binding
- `src/superwidget/projection.ts` — CanvasComponent interface, Projection type with canvasBinding field
- `tests/superwidget/canvasWiring.test.ts` — Phase 165 wiring tests (must update for new factory signature)
- `tests/superwidget/commitProjection.test.ts` — Phase 164 render tests (must update for new factory signature)
- `playwright.config.ts` — Current chromium-only config; WebKit project added here

### Existing Patterns
- `e2e/` — Existing Playwright E2E specs (chromium, sequential, `npm run dev` server)

### Conventions
- `.planning/codebase/CONVENTIONS.md` — File naming, code style, import patterns
- `.planning/codebase/TESTING.md` — Test patterns and directory conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `canvasWiring.test.ts` — `makeProjection()` helper and setup pattern (clearRegistry → registerAllStubs → mount widget) reusable in integration.test.ts
- `registerAllStubs()` — Already wires all three stubs; ViewCanvasStub's `create` already accepts binding parameter
- `ViewCanvasStub` — Already creates `data-sidecar` child element when binding is `Bound`
- `validateProjection()` — Already rejects invalid projections (Bound on Editor)

### Established Patterns
- Destroy-then-mount lifecycle on canvas change in `commitProjection`
- `data-*` attribute convention for all DOM assertions (data-canvas-type, data-render-count, data-sidecar, data-slot)
- Playwright config: sequential, single worker, `npm run dev` server, HTML report

### Integration Points
- `CanvasFactory` type in `SuperWidget.ts` — signature extension is the central code change
- `getCanvasFactory()` in `registry.ts` — must pass binding from closure
- `commitProjection()` canvas-lifecycle condition — must add binding comparison
- `playwright.config.ts` projects array — add webkit project
- CI e2e job — add webkit step

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 166-integration-testing*
*Context gathered: 2026-04-21*
