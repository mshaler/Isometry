# Phase 164: Projection Rendering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 164-projection-rendering
**Areas discussed:** commitProjection API shape, Canvas factory contract, Zone theme label mapping, Render count tracking

---

## commitProjection API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Instance method, void + console.warn | Method on SuperWidget, void return, console.warn on invalid. Simplest, matches RNDR-02 spec literally. | ✓ |
| Instance method, returns boolean | Method on SuperWidget, returns false on invalid, true on success. Slightly richer caller feedback. | |
| Standalone function, void + console.warn | Separate function taking widget + proj + registry. Keeps SuperWidget as pure DOM skeleton. | |

**User's choice:** Instance method, void + console.warn
**Notes:** None — straightforward selection.

---

## Canvas Factory Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Constructor injection | `new SuperWidget(canvasFactory)` — factory required at creation. Clean and explicit. | ✓ |
| Setter injection | `widget.setCanvasFactory(fn)` — matches SchemaProvider/StateManager late-binding pattern. Preserves Phase 162 zero-arg constructor. | |
| Parameter on commitProjection | `widget.commitProjection(proj, factory)` — no stored state, passed each call. Repetitive. | |

**User's choice:** Constructor injection
**Notes:** Accepted that Phase 162 tests will need updating to pass a factory parameter.

---

## Zone Theme Label Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Simple capitalize | `Record<ZoneRole, string>` — "Primary" / "Secondary" / "Tertiary". Low-risk, easy to change later. | ✓ |
| Richer display names | Custom names like "Main Zone" / "Side Zone" / "Auxiliary". More descriptive but speculative. | |
| Configurable map | Label map passed in from outside (constructor or setter). Maximum flexibility. | |

**User's choice:** Simple capitalize
**Notes:** None — stubs that v13.1+ will flesh out.

---

## Render Count Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| All four slots | Every slot tracks data-render-count. Most testable — precise per-slot assertions. | ✓ |
| Canvas only | Only canvas gets data-render-count. Other slots tested via DOM content unchanged. | |
| Canvas + header | Canvas (RNDR-03/04) + header (RNDR-05 updates on zoneRole change). Minimal meaningful set. | |

**User's choice:** All four slots
**Notes:** Maximum observability for the slot-scoped contract.

---

## Claude's Discretion

- Internal state tracking for current Projection (field name, nullability)
- Zone label map placement (module-level constant vs static property)
- Exact console.warn message format
- Reference equality short-circuit optimization

## Deferred Ideas

None — discussion stayed within phase scope.
