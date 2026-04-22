# Phase 173: 3-Canvas E2E Gate - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Full 6-direction canvas transition matrix as a Playwright WebKit CI hard gate, replacing the stub-based 3-direction smoke test. Also covers 9-view cycle DOM leak detection, CANV-06 import invariant verification (unit test), and rapid-switching stress test. This phase does NOT modify any canvas implementation, add new views, or change SuperWidget — it writes tests that prove the Phase 171/172 implementations are correct under all transition and stress scenarios.

</domain>

<decisions>
## Implementation Decisions

### Test File Strategy
- **D-01:** New dedicated E2E spec file (e.g. `canvas-e2e-gate.spec.ts`) owns all 4 INTG requirements. Existing `superwidget-smoke.spec.ts` stays untouched — it's a v13.0 artifact with different scope.
- **D-02:** The new spec file IS the phase 173 deliverable. One file maps 1:1 to the INTG requirements for clean traceability.

### CANV-06 Assertion Placement (INTG-03)
- **D-03:** CANV-06 verification stays as a Vitest unit test only — update existing `registry.test.ts` to also assert SuperWidget.ts has zero import references to `ViewCanvas` and `EditorCanvas` (the real class names, not just stubs). No Playwright-level readFileSync assertion.
- **D-04:** Rationale: readFileSync is static source analysis, not runtime behavior. CI runs both Vitest and Playwright, so the gate holds either way.

### Leak Detection (INTG-02)
- **D-05:** Canvas slot child count assertion — exactly 1 child after each view transition in the 9-view cycle. Simple, deterministic, catches the most common leak (orphaned view containers not cleaned up on destroy).
- **D-06:** No DOM node delta counting, no Worker subscription instrumentation. Production code stays unchanged — no test-only hooks.

### Rapid Switching (INTG-04)
- **D-07:** Synchronous tight loop — fire 3 `commitProjection()` calls in one `page.evaluate()` block with no awaits. Tests whether destroy-before-mount ordering survives synchronous re-entry (the strictest scenario).
- **D-08:** Assertions after the burst settles: (a) canvas slot has exactly 1 child, (b) visible canvas matches the LAST committed projection (intermediate states may be skipped), (c) no console errors.

### Prior Decisions (carry forward)
- **D-09:** SuperWidget.ts has zero import references to any canvas — registry plug-in seam only (CANV-06, from 171 D-09 / 172 D-12).
- **D-10:** Destroy-before-mount ordering holds under rapid switching, 3+ transitions < 500ms (from 171 D-11 / 172 D-14).
- **D-11:** Wrapper-div isolation — inner div, never _canvasEl directly (from 171 D-10 / 172 D-13).

### Claude's Discretion
- Exact spec file name and test.describe block organization
- Whether to use the existing `superwidget-harness.html` or create a new harness for the 3-canvas gate
- Playwright wait strategy after rapid-switching burst (fixed timeout vs waitForFunction)
- Whether the 9-view cycle test reuses the `ALL_VIEWS` constant pattern from `view-switch.spec.ts`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing E2E Specs (reference patterns)
- `e2e/superwidget-smoke.spec.ts` — Current 3-direction transition test + ExplorerCanvas tab switching. Shows harness URL, projection objects, commitProjection pattern, data-canvas-type selectors.
- `e2e/view-switch.spec.ts` — 9-view cycle with card count preservation. Shows ALL_VIEWS constant, `page.evaluate` view switching pattern.

### E2E Harness
- `e2e/fixtures/superwidget-harness.html` — SuperWidget test harness with `__sw` global. May need updates for real ViewCanvas/EditorCanvas provider wiring.
- `e2e/fixtures/explorercanvas-harness.html` — ExplorerCanvas-specific harness (reference for harness patterns).

### CANV-06 Unit Tests
- `tests/superwidget/registry.test.ts` lines 127+ — Existing readFileSync CANV-06 assertions checking for stub class names. Must be extended with real class names.

### SuperWidget Architecture
- `src/superwidget/SuperWidget.ts` — SuperWidget DOM skeleton, commitProjection, canvas slot structure
- `src/superwidget/projection.ts` — Projection type, CanvasComponent interface, transition functions
- `src/superwidget/registry.ts` — Canvas registry (register, getRegistryEntry, getCanvasFactory)

### Canvas Implementations
- `src/superwidget/ViewCanvas.ts` — Phase 171 deliverable, 9-view mounting via ViewManager
- `src/superwidget/EditorCanvas.ts` — Phase 172 deliverable, NotebookExplorer mounting
- `src/superwidget/ExplorerCanvas.ts` — Sibling canvas reference

### Requirements
- `.planning/REQUIREMENTS.md` — INTG-01 through INTG-04 success criteria (source of truth for assertions)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **superwidget-smoke.spec.ts**: Projection object shapes for all 3 canvas types (explorerProjection, viewBoundProjection, editorProjection). Can be copied/adapted for the full 6-direction matrix.
- **view-switch.spec.ts**: `ALL_VIEWS` constant listing all 9 view types. Pattern for cycling through views via `page.evaluate`.
- **superwidget-harness.html**: Working harness with `__sw` global exposing SuperWidget. May already support all 3 real canvases if main.ts registration is wired.
- **registry.test.ts CANV-06 block**: readFileSync + resolve pattern for static source assertion. Extend with `ViewCanvas` and `EditorCanvas` string checks.

### Established Patterns
- `page.evaluate(() => __sw.commitProjection(proj))` for triggering canvas transitions in Playwright
- `page.locator('[data-canvas-type="X"]')` for verifying which canvas is mounted
- `page.waitForFunction()` for waiting on async harness initialization
- `test.describe.configure({ retries: 0 })` for hard gate (no flaky retries)

### Integration Points
- CI pipeline (Playwright WebKit job) — new spec auto-discovered by Playwright config
- `registry.test.ts` — add 2 new CANV-06 assertions for real class names alongside existing stub checks

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established E2E patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 173-3-canvas-e2e-gate*
*Context gathered: 2026-04-21*
