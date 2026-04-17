# Phase 156: PanelManager Extraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 156-panelmanager-extraction
**Areas discussed:** Lazy-mount migration strategy, Coupled toggle logic, Visibility state tracking, Dock routing extraction

---

## Lazy-mount Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fat factory closures | Move wiring logic into PanelFactory closures capturing dependencies from PanelManager constructor scope. Each explorer gets a self-contained factory in its own file. | ✓ |
| Thin factory + post-mount config | Keep factories minimal, add configure() hook to PanelHook interface for post-mount wiring. | |
| You decide | Claude picks based on existing PanelRegistry patterns. | |

**User's choice:** Fat factory closures (Recommended)
**Notes:** DataExplorer's ~150 LOC factory closure moves out of main.ts entirely.

---

## Coupled Toggle Logic

| Option | Description | Selected |
|--------|-------------|----------|
| PanelManager owns coupling | Declarative group/coupling methods (e.g., showGroup('integrate')). Coupling rules co-located with panel definitions. Dock callback becomes thin router. | ✓ |
| Coupling stays in dock routing | PanelManager is dumb show/hide dispatcher. Dock callback keeps if/else coupling logic. | |
| PanelRegistry dependencies handle it | Use existing dependency mechanism. Conflates 'depends on' with 'shown together'. | |

**User's choice:** PanelManager owns coupling (Recommended)
**Notes:** None.

---

## Visibility State Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Mount once, toggle visibility | Track mounted + visible separately. First show mounts via factory; subsequent toggles display:none. Preserves explorer internal state. | ✓ |
| Destroy on hide, recreate on show | Every hide calls destroy(), every show calls factory(). Simpler but loses explorer state. | |
| You decide | Claude picks based on current explorer behavior and regression risk. | |

**User's choice:** Mount once, toggle visibility (Recommended)
**Notes:** PanelManager adds visibility layer on top of PanelRegistry's enable/disable lifecycle.

---

## Dock Routing Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Panel logic moves, view logic stays | All panel show/hide/toggle calls move to PanelManager. View switching stays in dock callback. | ✓ |
| Everything moves to PanelManager | PanelManager receives dock events and dispatches both views and panels. Over-scoped. | |
| Minimal extraction | Only show/hide pairs move. Dock callback keeps if/else structure calling PanelManager.toggle(). | |

**User's choice:** Panel logic moves, view logic stays (Recommended)
**Notes:** Dock callback shrinks to view switches + PanelManager delegation.

---

## Claude's Discretion

- Whether PanelManager is a new class or extends/wraps PanelRegistry
- File organization for panel factory closures
- toggle() convenience method
- syncTopSlotVisibility/syncBottomSlotVisibility handling
- dockToPanelMap placement

## Deferred Ideas

None — discussion stayed within phase scope
