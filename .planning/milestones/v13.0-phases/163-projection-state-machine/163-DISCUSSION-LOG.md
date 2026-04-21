# Phase 163: Projection State Machine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 163-projection-state-machine
**Areas discussed:** Projection type shape, Transition return style, Validation strictness, Extensibility seam

---

## Projection Type Shape

### Q1: How should canvasType, canvasBinding, and zoneRole be typed?

| Option | Description | Selected |
|--------|-------------|----------|
| String literal unions | Lightweight, matches ViewType pattern in views/types.ts. Easy to extend in v13.1+. | ✓ |
| Const enum | TypeScript const enum erased at compile time. Less flexible for JSON round-trips. | |
| Plain strings | Maximum flexibility but loses compile-time safety. | |

**User's choice:** String literal unions (Recommended)
**Notes:** None

### Q2: What should enabledTabIds be — Set or array?

| Option | Description | Selected |
|--------|-------------|----------|
| ReadonlyArray<string> | Simpler JSON round-trip. Reference equality checks straightforward. | ✓ |
| ReadonlySet<string> | O(1) lookup but needs custom JSON serializer. | |

**User's choice:** ReadonlyArray<string> (Recommended)
**Notes:** None

---

## Transition Return Style

### Q3: Should transition functions be standalone exports or methods on the Projection type?

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone exports | switchTab(proj, tabId), etc. Matches 'pure functions in projection.ts' handoff. Tree-shakeable. | ✓ |
| Readonly class with methods | proj.switchTab(tabId). More OOP, slight conflict with handoff decision. | |
| Both — functions + thin wrapper | Extra surface area, satisfies both styles. | |

**User's choice:** Standalone exports (Recommended)
**Notes:** None

---

## Validation Strictness

### Q4: Should validateProjection return the first violation or accumulate all?

| Option | Description | Selected |
|--------|-------------|----------|
| First violation only | Returns {valid: false, reason: string}. Matches PROJ-06 singular 'reason' field. | ✓ |
| Accumulate all violations | Returns {valid: false, reasons: string[]}. More informative but changes return shape. | |

**User's choice:** First violation only (Recommended)
**Notes:** None

### Q5: Should transition functions validate their inputs or trust callers?

| Option | Description | Selected |
|--------|-------------|----------|
| Guard + return original | Each function checks preconditions, returns original ref on invalid. IS the reference equality contract. | ✓ |
| Assert + throw on invalid | Throws on invalid input. Conflicts with reference-equality-on-no-op contract. | |
| No validation in transitions | Blindly apply. Only validateProjection catches problems. Risk of invalid intermediates. | |

**User's choice:** Guard + return original (Recommended)
**Notes:** None

---

## Extensibility Seam

### Q6: Should the Projection type be closed or open for future extension?

| Option | Description | Selected |
|--------|-------------|----------|
| Closed literal union | CanvasType = 'Explorer' \| 'View' \| 'Editor'. Compile-time exhaustiveness. Widen in v13.1+. | ✓ |
| Open string with constants | CanvasType = string. Easier runtime extension but loses exhaustive checking. | |
| Generic + registry-driven | Projection<T>. Maximum extensibility but overkill for 3 types. | |

**User's choice:** Closed literal union (Recommended)
**Notes:** None

---

## Claude's Discretion

- Exact field names for Projection type
- ValidationResult type shape details
- Whether to export a createProjection factory
- Internal helper functions for reference equality comparison

## Deferred Ideas

None — discussion stayed within phase scope.
