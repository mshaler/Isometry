# Phase 163: Projection State Machine - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Five pure transition functions (`switchTab`, `setCanvas`, `setBinding`, `toggleTabEnabled`, `validateProjection`) operating on an immutable `Projection` type. Strict reference equality contract on no-op transitions. No DOM, no events, no rendering — pure state logic in `projection.ts`.

</domain>

<decisions>
## Implementation Decisions

### Projection Type Shape
- **D-01:** `CanvasType`, `CanvasBinding`, and `ZoneRole` are string literal unions (e.g., `type CanvasType = 'Explorer' | 'View' | 'Editor'`). Matches existing `ViewType` union pattern in `views/types.ts`.
- **D-02:** `enabledTabIds` is `ReadonlyArray<string>`. Simpler JSON round-trip than Set (PROJ-01 requires JSON serialization without data loss).
- **D-03:** Closed literal union for `CanvasType` — exactly 3 values. When v13.1+ adds real canvases, widen the union and let TypeScript catch all switch sites.

### API Style
- **D-04:** Standalone exported functions: `switchTab(proj, tabId)`, `setCanvas(proj, canvasId, type)`, `setBinding(proj, binding)`, `toggleTabEnabled(proj, tabId)`, `validateProjection(proj)`. No class wrapper. Matches the "pure functions in projection.ts" handoff decision.

### Validation
- **D-05:** `validateProjection` returns first violation only: `{valid: false, reason: string}` or `{valid: true}`. Singular `reason` field per PROJ-06 spec.
- **D-06:** Transition functions guard their own preconditions and return the original reference on invalid input (e.g., `setBinding` with Bound on non-View returns original). This IS the reference equality contract — not a separate concern.

### Claude's Discretion
- Exact field names for `Projection` type (as long as the 6 fields from PROJ-01 are present)
- `ValidationResult` type shape details
- Whether to export a `createProjection` factory or just use object literals in tests
- Internal helper functions for reference equality comparison

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Requirements
- `.planning/ROADMAP.md` §Phase 163 — Success criteria and requirements (PROJ-01..07)
- `.planning/REQUIREMENTS.md` §Projection State Machine — PROJ-01 through PROJ-07 acceptance criteria
- `.planning/STATE.md` §Accumulated Context — v13.0 handoff decisions and critical pitfalls (reference equality, no DOM coupling)

### Existing Patterns (reference for consistency)
- `src/superwidget/SuperWidget.ts` — Phase 162 substrate; Phase 163 adds state that Phase 164 will connect to this class
- `src/views/types.ts` — Existing string literal union pattern (`ViewType`) to follow
- `src/providers/PAFVProvider.ts` — Pure-function-with-immutable-state pattern reference

### Conventions
- `.planning/codebase/CONVENTIONS.md` — File naming, code style, import patterns
- `.planning/codebase/STRUCTURE.md` — Source directory layout
- `.planning/codebase/TESTING.md` — Test patterns and directory conventions

### Phase Dependencies
- `.planning/phases/162-substrate-layout/162-CONTEXT.md` — Slot structure that Projection maps to

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperWidget.ts`: mount/destroy lifecycle with slot getters — Projection maps canvasType to the canvas slot, zoneRole to header slot
- `PAFVProvider.ts`: demonstrates immutable state + pure transition pattern already used in the codebase
- `views/types.ts`: existing `ViewType` string literal union — `CanvasType` follows the same pattern

### Established Patterns
- String literal unions for closed type sets (ViewType, DensityLevel)
- Readonly/immutable data objects returned from pure functions
- Tests under `tests/superwidget/` (locked convention from v13.0 handoff)

### Integration Points
- `src/superwidget/projection.ts` — new file for Projection type + transition functions
- `tests/superwidget/` — test files for all PROJ requirements
- Phase 164 will import from `projection.ts` to wire into `SuperWidget.commitProjection()`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 163-projection-state-machine*
*Context gathered: 2026-04-21*
