# Phase 165: Canvas Stubs + Registry - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Three stub CanvasComponent implementations (Explorer, View, Editor) behind the existing CanvasComponent interface, plus a canvas registry module that maps canvasId to typed CanvasRegistryEntry. SuperWidget resolves canvases exclusively through the registry's CanvasFactory closure — zero coupling to concrete stub classes. Stubs are explicitly labeled for replacement in v13.1+.

</domain>

<decisions>
## Implementation Decisions

### Registry Architecture
- **D-01:** Dedicated `registry.ts` module with a module-level `Map<string, CanvasRegistryEntry>`. Exports `register(canvasId, entry)` for adding entries and `getCanvasFactory(): CanvasFactory` that returns a closure over the Map. SuperWidget never sees the Map — only receives the factory.
- **D-02:** `CanvasRegistryEntry` shape: `{ canvasType: CanvasType, create: (binding?: CanvasBinding) => CanvasComponent, defaultExplorerId?: string }`. Only View entries set `defaultExplorerId`. Minimal shape — extend in v13.1+ as needed.
- **D-03:** Explicit wiring point — a `registerAllStubs()` function (in a stubs barrel or registry.ts) called once during app init. No self-registering side effects on import. Clear, debuggable, easy to swap stubs for real canvases in v13.1+.

### Sidecar Rendering
- **D-04:** ViewCanvasStub manages its own sidecar DOM. In Bound mode, `mount()` creates a child element with `data-sidecar` attribute. In Unbound mode, no sidecar element is created. Stub manages sidecar lifecycle internally.
- **D-05:** ViewCanvasStub constructor takes `binding: CanvasBinding` parameter. The registry factory closure captures binding from the Projection when creating the stub. On binding change, SuperWidget destroys + recreates (consistent with Phase 164's destroy-then-mount lifecycle).

### Stub Visual Content
- **D-06:** Stubs display their canvasType and canvasId as text content (e.g., `[Explorer: canvas-1]`). Data attributes (`data-canvas-type`, `data-render-count`) are the real contract; text is a debugging aid for Phase 166 integration testing.

### File Organization
- **D-07:** All files flat in `src/superwidget/`: `registry.ts`, `ExplorerCanvasStub.ts`, `ViewCanvasStub.ts`, `EditorCanvasStub.ts`. Matches existing flat pattern (projection.ts, SuperWidget.ts). Stub filenames contain "Stub" per CANV-07.
- **D-08:** Each stub file begins with a comment: `// STUB — placeholder for replacement in v13.1+` (per CANV-07).

### Claude's Discretion
- Exact `data-render-count` increment logic in stubs (increment on each mount() call per CANV-01)
- Whether `getCanvasFactory()` is called once at SuperWidget construction or lazily
- Internal structure of registerAllStubs() (loop vs individual calls)
- Whether EditorCanvasStub constructor takes binding param (it only supports Unbound, so could be hardcoded)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Requirements
- `.planning/ROADMAP.md` §Phase 165 — Success criteria and requirements (CANV-01..07)
- `.planning/REQUIREMENTS.md` §Canvas Stubs + Registry — CANV-01 through CANV-07 acceptance criteria
- `.planning/STATE.md` §Accumulated Context — v13.0 handoff decisions, critical pitfalls (registry abstraction leak)

### Phase Dependencies (must read)
- `.planning/phases/162-substrate-layout/162-CONTEXT.md` — Slot structure, CSS strategy, slot getter API
- `.planning/phases/163-projection-state-machine/163-CONTEXT.md` — Projection type, CanvasType/CanvasBinding unions, reference equality contract
- `.planning/phases/164-projection-rendering/164-CONTEXT.md` — CanvasFactory injection, commitProjection lifecycle, render-count tracking, destroy-then-mount pattern

### Source Code (must read)
- `src/superwidget/projection.ts` — CanvasComponent interface (lines 42-45), CanvasType/CanvasBinding types, Projection interface
- `src/superwidget/SuperWidget.ts` — CanvasFactory type (line 5), constructor injection (line 34), commitProjection canvas lifecycle (line 151+)
- `tests/superwidget/SuperWidget.test.ts` — Existing tests showing factory mock patterns
- `tests/superwidget/projection.test.ts` — Existing state machine tests

### Conventions
- `.planning/codebase/CONVENTIONS.md` — File naming, code style, import patterns
- `.planning/codebase/STRUCTURE.md` — Source directory layout
- `.planning/codebase/TESTING.md` — Test patterns and directory conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CanvasComponent` interface already defined in `projection.ts` (mount/destroy contract)
- `CanvasFactory` type already defined in `SuperWidget.ts` — registry must produce this exact type
- `CanvasType`, `CanvasBinding` literal unions in `projection.ts` — stubs reference these directly

### Established Patterns
- Constructor injection: SuperWidget takes `CanvasFactory` in constructor (Phase 164 pattern)
- Destroy-then-mount lifecycle: commitProjection destroys current canvas, then mounts new one
- Data attribute convention: `data-slot`, `data-canvas-type`, `data-render-count` used throughout
- Flat file layout in `src/superwidget/` — projection.ts and SuperWidget.ts at top level

### Integration Points
- `SuperWidget.constructor(canvasFactory)` — registry's `getCanvasFactory()` output plugs in here
- `commitProjection()` calls `this._canvasFactory(proj.canvasId)` — registry lookup happens via this closure
- Phase 166 integration tests will exercise the full chain: registry → factory → SuperWidget → DOM

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

*Phase: 165-canvas-stubs-registry*
*Context gathered: 2026-04-21*
