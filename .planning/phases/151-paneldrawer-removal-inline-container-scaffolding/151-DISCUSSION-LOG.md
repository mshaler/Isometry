# Phase 151: PanelDrawer Removal + Inline Container Scaffolding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 151-paneldrawer-removal-inline-container-scaffolding
**Areas discussed:** PanelDrawer deletion scope, Inline container structure, Test cleanup strategy

---

## PanelDrawer Deletion Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Delete PanelDrawer + CSS, keep PanelRegistry/CollapsibleSection/PanelTypes | Registry becomes state manager for inline slots. PanelDrawer was presentation; Registry is data model. | ✓ |
| Delete everything | Clean slate. Phase 152 builds own toggle system from scratch. | |
| You decide | Claude picks approach minimizing rework in Phases 152-153. | |

**User's choice:** Option 1 — Delete PanelDrawer + CSS, keep PanelRegistry/CollapsibleSection/PanelTypes
**Notes:** Clean separation between presentation layer (deleted) and data model (preserved).

---

## Inline Container Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Merge DataExplorer into new top-slot | Replace `.workbench-data-explorer` with generic `.workbench-slot-top`. Bottom-slot new. Clean vertical stack: `[top-slot] [view-content] [bottom-slot]`. | ✓ |
| Keep DataExplorer separate, add slots alongside | `.workbench-data-explorer` stays as-is. New slots added as additional containers. Avoids touching DataExplorer wiring. | |
| You decide | Claude picks based on what makes Phase 152 integration cleanest. | |

**User's choice:** Option 1 — Merge DataExplorer into new top-slot
**Notes:** Clean vertical stack layout. DataExplorer becomes one of several things mountable in top-slot.

---

## Test Cleanup Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Delete PanelDrawer tests, write new slot tests | Remove dead assertions, replace with slot-existence and vertical-stack-order tests. | |
| Minimal: delete PanelDrawer tests only | Remove dead tests. Phase 154 (Regression Guard) handles new integration tests. | ✓ |
| You decide | Claude picks balance between coverage and minimal change. | |

**User's choice:** Option 2 — Minimal delete only, defer new tests to Phase 154
**Notes:** User confirmed this aligns with Phase 154's explicit regression guard role. Writing slot tests now would be premature since Phase 152 changes what mounts into them.

---

## Claude's Discretion

- Slot accessor API shape (`getTopSlotEl()`/`getBottomSlotEl()` vs `getSlotEl(position)`)
- `getPanelDrawer()` accessor removal/replacement
- `getDataExplorerEl()` accessor evolution during transition
- Initial display state of top-slot and bottom-slot containers
- CSS cleanup scope in `workbench.css`

## Deferred Ideas

None — discussion stayed within phase scope
