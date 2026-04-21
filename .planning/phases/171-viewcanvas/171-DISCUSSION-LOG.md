# Phase 171: ViewCanvas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 171-viewcanvas
**Areas discussed:** Status slot content, Sidecar lifecycle, Tab-to-ViewType mapping

---

## Status Slot Content

| Option | Description | Selected |
|--------|-------------|----------|
| Replace entirely | ViewCanvas renders its own status content: view name + card count. Each canvas type owns its status slot content completely. | ✓ |
| Augment with view name prefix | Keep existing cards/connections/import bar but prepend view name. | |
| Two-zone status bar | Left side view name, right side card count. Different layout from ExplorerCanvas. | |

**User's choice:** Replace entirely (Recommended)
**Notes:** Each canvas owns its slot — clean separation.

### Follow-up: View Name Display

| Option | Description | Selected |
|--------|-------------|----------|
| Human-readable label | Display names like 'SuperGrid', 'Calendar', 'Network Graph'. Lookup table provides mapping. | ✓ |
| ViewType literal as-is | Show 'supergrid', 'calendar', 'network' directly. Simpler but less polished. | |

**User's choice:** Human-readable label (Recommended)

---

## Sidecar Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Callback from SuperWidget | ViewCanvas calls onSidecarChange callback injected via constructor/registry, passing defaultExplorerId or null. | ✓ |
| Event dispatch on canvas element | CustomEvent ('sidecar-change') on container element. Loosely coupled but requires event wiring. | |
| Provider notification | New SidecarProvider publishes active explorer ID. More infrastructure but consistent with provider pattern. | |

**User's choice:** Callback from SuperWidget (Recommended)
**Notes:** Clean decoupling — registry's defaultExplorerId feeds the callback value.

---

## Tab-to-ViewType Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Tab IDs ARE ViewType literals | Convention: tab IDs are ViewType strings directly. ViewCanvas casts. No lookup table. | ✓ |
| Lookup table in ViewCanvas | Map<string, ViewType> in ViewCanvas. Tab IDs can be anything. More flexible but adds indirection. | |
| Registry-driven mapping | Each registry entry includes viewType field. Extends CanvasRegistryEntry. | |

**User's choice:** Tab IDs ARE ViewType literals (Recommended)
**Notes:** Zero indirection — direct cast convention.

---

## Claude's Discretion

- Display-name map shape (inline constant vs. exported)
- ViewCanvas constructor signature (options bag vs. positional)
- Render callback wiring approach
- Test file organization

## Deferred Ideas

None — discussion stayed within phase scope.
