# Phase 164: Projection Rendering - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

SuperWidget accepts a Projection and renders it to the DOM — commit validation (reject invalid with console.warn), canvas lifecycle (destroy prior → mount new), slot-scoped re-renders (only affected slots increment data-render-count), and zone theme header label display. No real canvas implementations — canvas factory returns CanvasComponent interface instances.

</domain>

<decisions>
## Implementation Decisions

### commitProjection API
- **D-01:** `commitProjection(proj: Projection)` is an instance method on SuperWidget. Void return. On invalid projection: logs `console.warn` with the validation reason, leaves DOM unchanged, does not call the canvas factory. Matches RNDR-02 spec literally.

### Canvas Factory Contract
- **D-02:** Constructor injection — `new SuperWidget(canvasFactory)` where `canvasFactory` is `(canvasId: string) => CanvasComponent | undefined`. SuperWidget holds the reference from construction. This changes Phase 162's zero-arg constructor to require a factory parameter.
- **D-03:** Phase 162 tests must be updated to pass a factory (stub/mock). This is acceptable — constructor injection is explicit and clean.

### Zone Theme Label
- **D-04:** Simple capitalize map — `Record<ZoneRole, string>` constant: `{ primary: 'Primary', secondary: 'Secondary', tertiary: 'Tertiary' }`. Lives in SuperWidget.ts (or co-located module). Header slot's textContent is set from this map via `projection.zoneRole` lookup. Self-contained per RNDR-05.

### Render Count Tracking
- **D-05:** All four slots (header, canvas, status, tabs) get `data-render-count` attributes. Initialized to `"0"` on construction. Incremented when a slot is re-rendered by commitProjection.
- **D-06:** RNDR-03 tested by asserting: after tab switch, canvas render count increments while header/status/tabs counts remain unchanged.
- **D-07:** RNDR-04 tested by asserting: after canvas type switch, canvas render count resets to `"1"` (destroy prior + mount new = fresh render). Prior canvas's destroy() called before new canvas's mount().

### Claude's Discretion
- Internal state tracking for current Projection (field name, nullability before first commit)
- Whether zone label map is a module-level constant or static class property
- Exact console.warn message format
- Whether commitProjection short-circuits when new Projection has reference equality with current (optimization leveraging Phase 163's no-op contract)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Requirements
- `.planning/ROADMAP.md` §Phase 164 — Success criteria and requirements (RNDR-01..05)
- `.planning/REQUIREMENTS.md` §Projection Rendering — RNDR-01 through RNDR-05 acceptance criteria
- `.planning/STATE.md` §Accumulated Context — v13.0 handoff decisions, critical pitfalls (slot-scoped re-renders, reference equality bail-out)

### Phase Dependencies (must read)
- `.planning/phases/162-substrate-layout/162-CONTEXT.md` — Slot structure, CSS strategy, slot getter API (D-05 public getters)
- `.planning/phases/163-projection-state-machine/163-CONTEXT.md` — Projection type, transition functions, reference equality contract

### Source Code (must read)
- `src/superwidget/SuperWidget.ts` — Phase 162 substrate class; Phase 164 adds commitProjection method and constructor factory parameter
- `src/superwidget/projection.ts` — Projection type, CanvasType/CanvasBinding/ZoneRole unions, validateProjection function
- `tests/superwidget/SuperWidget.test.ts` — Existing substrate tests (must be updated for constructor change)
- `tests/superwidget/projection.test.ts` — Existing state machine tests

### Existing Patterns (reference for consistency)
- `src/ui/WorkbenchShell.ts` — mount/destroy lifecycle pattern
- `src/styles/superwidget.css` — `--sw-*` token namespace

### Conventions
- `.planning/codebase/CONVENTIONS.md` — File naming, code style, import patterns
- `.planning/codebase/TESTING.md` — Test patterns and directory conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperWidget.ts`: Phase 162 skeleton with mount/destroy lifecycle, slot getters, CSS Grid layout — Phase 164 extends this class with commitProjection and constructor factory injection
- `projection.ts`: Projection type + validateProjection + all transition functions — commitProjection calls validateProjection before rendering
- `superwidget.css`: `--sw-*` CSS tokens already defined for slot styling

### Established Patterns
- Constructor injection for dependencies (changing from Phase 162's zero-arg constructor)
- Setter injection used elsewhere (SchemaProvider, StateManager) but constructor injection chosen here for explicitness
- `data-render-count` attribute pattern: new to SuperWidget but follows `data-*` attribute convention from `data-slot`, `data-tab-role`
- `console.warn` for non-fatal validation failures (no throw, no error state)

### Integration Points
- `SuperWidget.ts` gains: constructor parameter, `commitProjection()` method, internal Projection state, render count management
- Phase 165 will provide the actual canvas factory (registry lookup) that gets passed to SuperWidget constructor
- Phase 166 integration tests will exercise the full commit→render→destroy cycle

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

*Phase: 164-projection-rendering*
*Context gathered: 2026-04-21*
