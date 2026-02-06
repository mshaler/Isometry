# Phase 34: Foundation Stabilization - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish stable sql.js + D3.js integration with basic grid rendering and TypeScript compilation cleanup. This phase delivers a working foundation where SQLite queries execute directly in the browser and feed D3.js visualizations without serialization overhead. The grid cells render properly with data binding, and the codebase compiles cleanly with strict TypeScript.

</domain>

<decisions>
## Implementation Decisions

### sql.js Integration Approach
- **Startup timing:** Load sql.js and database file during application startup, always available
- **Asset strategy:** All local (vendored sql.js WASM in public/ folder, self-contained model)
- **Query execution:** Direct synchronous calls - D3 calls `db.exec(sql)` directly in render functions
- **Error handling:** Fail fast approach with error telemetry capture for future Claude Code learning system

### Grid Cell Rendering
- **Density spectrum:** Full Janus model support from foundation - cells handle single cards (sparse) to multi-card with count badges (dense)
- **Density indication:** Count badges for now when multiple cards present in cell
- **State transitions:** Morphing transitions when density controls change cell states (animate card-to-badge transformations)
- **Data structure:** Unified structure `{cards: [...], densityLevel: number, aggregationType: 'none'|'group'|'rollup'}` across all density levels
- **Architecture alignment:** Future-ready structure with D3.js data plane + React control chrome separation
- **Super* enablement:** Minimal cell implementation with structural hooks for selection coordinates, expansion state, and event delegation

### TypeScript Cleanup Priorities
- **Scope:** Data foundation only - sql.js, D3.js, grid types (ignore bridge errors entirely)
- **Approach:** Systematic cleanup in dependency order (deepest imports first, work up to components)
- **Type strictness:** Zero tolerance for `any` types - replace with proper types even if complex
- **Bridge elimination:** Separate parallel/follow-on effort from data foundation cleanup

### Claude's Discretion
- Exact morphing animation implementation for cell transitions
- Specific error telemetry data structure for Claude Code integration
- Selection coordinate system details for Super* feature hooks
- TypeScript migration patterns for complex D3/sql.js integrations

</decisions>

<specifics>
## Specific Ideas

- **Architecture separation:** "D3.js cells handle data binding, rendering, basic interaction - React chrome handles complex UI"
- **Janus model:** Four-level density system (Value/Extent/View/Region) with orthogonal Pan × Zoom controls
- **Foundation principle:** "Same data, different projection" - unified data structure enables all Super* features
- **Systematic approach:** "Build from the ground up" - dependency order prevents cascade effects in TypeScript cleanup

</specifics>

<deferred>
## Deferred Ideas

- **Bridge elimination:** Systematic Swift removal and legacy MessageBridge cleanup - separate phase/effort
- **Super* feature implementation:** Complete catalog captured in planning docs but implementation deferred to future phases
- **Complex error recovery:** Advanced error handling patterns beyond fail fast - enhance after Claude Code integration

</deferred>

---

*Phase: 34-foundation-stabilization*
*Context gathered: 2026-02-05*