# Phase 175: Shell Replacement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 175-shell-replacement
**Areas discussed:** Slot mapping strategy, Migration sequencing, CommandBar ownership, ViewManager integration

---

## Slot Mapping Strategy

### Explorer Slot Landing

| Option | Description | Selected |
|--------|-------------|----------|
| Temporary passthrough | SuperWidget exposes getTopSlotEl()/getBottomSlotEl() returning simple container divs. Phase 176 replaces with real sidecar. | ✓ |
| Inline in canvas slot | Explorer containers baked into canvas slot DOM. Simpler but couples to canvas layout. | |
| Keep outside SuperWidget | Explorer slots remain as standalone DOM siblings of SuperWidget. | |

**User's choice:** Temporary passthrough (Recommended)
**Notes:** Clean bridge to Phase 176.

### DockNav Slot

| Option | Description | Selected |
|--------|-------------|----------|
| SuperWidget sidebar slot | New 5th slot in CSS grid. DockNav mounts there. Matches SHEL-02. | ✓ |
| Sibling of SuperWidget | DockNav stays as sibling div at #app level. Doesn't match SHEL-01 goal. | |

**User's choice:** SuperWidget sidebar slot (Recommended)
**Notes:** None.

### Section State Stubs

| Option | Description | Selected |
|--------|-------------|----------|
| Drop entirely | Dead code — remove getSectionStates/restoreSectionStates wiring. | ✓ |
| Carry forward as stubs | Keep no-op pattern on SuperWidget for API compat. | |

**User's choice:** Drop entirely (Recommended)
**Notes:** None.

---

## Migration Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Big-bang swap | Delete WorkbenchShell, rewire all 17 call sites in one plan. Thin 131 LOC, contained blast radius. | ✓ |
| Incremental (2 plans) | Plan 1: proxy wrap. Plan 2: peel off calls. Adds intermediate state. | |
| Strangler fig | Coexist briefly, migrate progressively. Most complex. | |

**User's choice:** Big-bang swap (Recommended)
**Notes:** None.

---

## CommandBar Ownership

### Ownership Location

| Option | Description | Selected |
|--------|-------------|----------|
| SuperWidget header slot | SuperWidget accepts CommandBar and mounts in header. Matches SHEL-03. | ✓ |
| Standalone in main.ts | Created directly in main.ts, mounted into exposed headerEl. | |
| Injected via config | Constructor takes config object, creates CommandBar internally. | |

**User's choice:** SuperWidget header slot (Recommended)

### Creation Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Receive as parameter | SuperWidget takes existing CommandBar instance. Pure container pattern. | ✓ |
| Create internally via config | SuperWidget takes CommandBarConfig, creates internally. Couples to CommandBar. | |

**User's choice:** Receive as parameter (Recommended)
**Notes:** Consistent with DockNav pattern (created externally, mounted into slot).

---

## ViewManager Integration

| Option | Description | Selected |
|--------|-------------|----------|
| ViewCanvas wraps ViewManager | ViewCanvas provides DOM target. ViewManager owns view switching. 8 getViewContentEl() calls route through ViewCanvas. | ✓ |
| Direct canvas slot access | SuperWidget exposes canvas slot element directly. Overlap with commitProjection lifecycle. | |
| You decide | Claude picks best fit. | |

**User's choice:** ViewCanvas wraps ViewManager (Recommended)
**Notes:** None.

### StateCoordinator Drain

| Option | Description | Selected |
|--------|-------------|----------|
| Ordering guarantee | Ensure wiring complete before providers fire. Vitest test verifies no void callbacks. | ✓ |
| Explicit flush | Call StateCoordinator.flush() at swap boundary. Defensive but likely unnecessary. | |

**User's choice:** Ordering guarantee (Recommended)
**Notes:** Big-bang swap means no live teardown — ordering suffices.

---

## Claude's Discretion

- CSS grid template for 5-slot layout
- SuperWidget constructor signature shape
- Temporary passthrough accessor naming
- Explorer container internal DOM structure
- Vitest smoke test approach (unit vs bootstrap)

## Deferred Ideas

None — discussion stayed within phase scope.
