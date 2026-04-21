# Phase 166: Integration Testing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 166-integration-testing
**Areas discussed:** Factory binding wiring, Playwright WebKit setup, Cross-seam test structure, CI pipeline integration

---

## Factory Binding Wiring

### Q1: How should binding flow from Projection to the canvas factory?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend CanvasFactory signature (Recommended) | Change to (canvasId, binding) => CanvasComponent. commitProjection passes proj.canvasBinding. Minimal change. | ✓ |
| Projection-aware factory | Change to (proj: Projection) => CanvasComponent. More future-proof but couples factory to Projection type. | |
| Separate setBinding() call | Keep factory as-is, add setBinding() to CanvasComponent interface. No factory type change but more method calls. | |

**User's choice:** Extend CanvasFactory signature
**Notes:** Clean, explicit, minimal change to factory type + registry + commitProjection call site.

### Q2: Should binding changes on the same canvasId trigger destroy+recreate or in-place rebind?

| Option | Description | Selected |
|--------|-------------|----------|
| Destroy+recreate (Recommended) | Consistent with Phase 164 existing lifecycle. No new interface method. | ✓ |
| In-place rebind | Add optional rebind(binding) to CanvasComponent. More efficient but adds interface complexity for stubs. | |

**User's choice:** Destroy+recreate
**Notes:** Consistent with existing lifecycle pattern. Canvas-lifecycle condition broadens to include canvasBinding comparison.

---

## Playwright WebKit Setup

### Q3: How should the WebKit smoke test be structured in the Playwright config?

| Option | Description | Selected |
|--------|-------------|----------|
| Add WebKit project to existing config (Recommended) | Add 'webkit' project alongside 'chromium'. Smoke spec uses project filtering. | ✓ |
| Separate config file | New playwright.webkit.config.ts. Isolates completely but second config to maintain. | |
| Replace chromium with WebKit | Switch single project to WebKit. All specs run in WebKit. Riskier. | |

**User's choice:** Add WebKit project to existing config
**Notes:** Existing e2e specs continue in chromium only.

### Q4: What should the WebKit smoke test exercise?

| Option | Description | Selected |
|--------|-------------|----------|
| Transition matrix only (Recommended) | Exercise 3 canvas transitions, verify DOM. Matches success criteria 1-3. Fast, focused. | ✓ |
| Full INTG-01..06 mirror | Mirror all 6 cross-seam scenarios in Playwright. More coverage but slower. | |
| Transition matrix + error case | Transitions plus invalid projection case (INTG-04). | |

**User's choice:** Transition matrix only
**Notes:** Proves real browser path works without duplicating Vitest coverage.

---

## Cross-Seam Test Structure

### Q5: Where should Phase 166 cross-seam tests live?

| Option | Description | Selected |
|--------|-------------|----------|
| New integration.test.ts (Recommended) | Dedicated tests/superwidget/integration.test.ts for INTG-01..06. Clean separation. | ✓ |
| Extend canvasWiring.test.ts | Add to existing file. Consolidates but blurs Phase 165/166 boundary. | |
| Split by concern | transitions.test.ts, validation.test.ts, stress.test.ts. More files, each focused. | |

**User's choice:** New integration.test.ts
**Notes:** Phase 165's canvasWiring.test.ts stays intact.

---

## CI Pipeline Integration

### Q6: How should the WebKit smoke test plug into CI?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing e2e job (Recommended) | Add WebKit step to existing e2e CI job. Hard gate. No 6th parallel job. | ✓ |
| New parallel CI job | Dedicated 'webkit-smoke' job. Cleaner isolation but adds CI complexity. | |
| Fold into test job | Split Phase 166 across test and e2e jobs. | |

**User's choice:** Extend existing e2e job
**Notes:** Hard gate — failure blocks merge.

---

## Claude's Discretion

- Playwright test helper structure (page object vs inline selectors)
- Whether smoke spec uses dedicated HTML harness or existing app
- Internal naming of WebKit project in config
- INTG-06 rapid-commit implementation (setTimeout vs synchronous loop)
- How to update existing Phase 165 tests for extended factory signature

## Deferred Ideas

None — discussion stayed within phase scope.
