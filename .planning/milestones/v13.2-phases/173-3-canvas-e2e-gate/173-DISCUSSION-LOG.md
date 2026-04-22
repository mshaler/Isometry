# Phase 173: 3-Canvas E2E Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 173-3-canvas-e2e-gate
**Areas discussed:** Test file strategy, CANV-06 assertion placement, Leak detection approach, Rapid switching simulation

---

## Test File Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing smoke spec | Add reverse transitions + new test blocks to `superwidget-smoke.spec.ts` | |
| New dedicated spec | Create `canvas-e2e-gate.spec.ts` owning all 4 INTG requirements. Old smoke untouched. | ✓ |

**User's choice:** New dedicated spec
**Notes:** Clean separation — new file maps 1:1 to INTG requirements and is the phase 173 deliverable. Old smoke stays as v13.0 artifact.

---

## CANV-06 Assertion Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Unit test only | Update `registry.test.ts` readFileSync to also check real class names (ViewCanvas, EditorCanvas) | ✓ |
| Playwright assertion | Put readFileSync check inside the new E2E spec | |
| Both | Unit test for detail, Playwright as gate guard | |

**User's choice:** Unit test only
**Notes:** readFileSync is static source analysis, not runtime behavior. CI runs both test suites so gate holds either way.

---

## Leak Detection Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas slot child count | Exactly 1 child after each transition. Simple, deterministic. | ✓ |
| DOM node delta | Count total DOM nodes before/after cycle with tolerance. More thorough but potentially flaky. | |
| DOM + Worker subscription audit | Child count plus Worker message listener count. Requires production code instrumentation. | |

**User's choice:** Canvas slot child count
**Notes:** No production code changes for testability. No DOM delta counting or Worker subscription instrumentation.

---

## Rapid Switching Simulation

| Option | Description | Selected |
|--------|-------------|----------|
| Tight synchronous loop | 3 commitProjection calls in one page.evaluate, no awaits. Strictest stress test. | ✓ |
| setTimeout cascade | Fire at 0/150/300ms. More realistic but less thorough. | |

**User's choice:** Tight synchronous loop
**Notes:** Maximum stress — synchronous re-entry. If destroy-before-mount survives this, real-world usage is covered. Assert: last projection wins, exactly 1 child, no console errors.

---

## Claude's Discretion

- Exact spec file name and test.describe organization
- Harness strategy (reuse existing vs new)
- Playwright wait strategy after rapid-switching burst
- Whether to reuse ALL_VIEWS constant from view-switch.spec.ts

## Deferred Ideas

None — discussion stayed within phase scope.
