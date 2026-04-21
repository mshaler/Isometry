# Phase 168: Tab System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 168-tab-system
**Areas discussed:** Apps section mapping, Tab switch mechanism, Tab bar ownership

---

## Apps Section Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Merge into Import/Export | Apps content (Notes, Reminders, Calendar importers) becomes part of the Import/Export tab — it's all import sources | ✓ |
| 4th tab | Add Apps as a 4th tab alongside the other 3 | |
| Hide for now | Apps section is not rendered in the tab system — deferred to a future phase | |
| Fold into Catalog | Apps section content moves under the Catalog tab | |

**User's choice:** Merge into Import/Export
**Notes:** None

### Follow-up: Apps layout within Import/Export

| Option | Description | Selected |
|--------|-------------|----------|
| Separate sub-section | Apps section remains its own CollapsibleSection inside the Import/Export tab — two collapsibles stacked vertically | ✓ |
| Interleaved | Apps import buttons appear alongside file-based import controls in a single unified section | |

**User's choice:** Separate sub-section
**Notes:** None

---

## Tab Switch Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| CSS hide/show (Recommended) | All 3 tab containers are mounted once. Switching toggles display:none/block. Matches D-01 language, preserves scroll position and form state across switches, zero re-render cost. | ✓ |
| Destroy/remount sections | Only the active tab's sections are in the DOM. Switching destroys current, mounts new. Lighter DOM but loses transient state. | |

**User's choice:** CSS hide/show (Recommended)
**Notes:** None

### Follow-up: How ExplorerCanvas learns about tab switches

| Option | Description | Selected |
|--------|-------------|----------|
| CanvasComponent method (Recommended) | Add onProjectionChange(proj) to CanvasComponent interface. SuperWidget calls it in commitProjection when activeTabId changes. | ✓ |
| ExplorerCanvas reads Projection | ExplorerCanvas subscribes to a Projection observable/callback passed at construction. Decoupled but adds subscription wiring. | |
| You decide | Claude picks whichever approach fits cleanest | |

**User's choice:** CanvasComponent method (Recommended)
**Notes:** None

---

## Tab Bar Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Inside canvas slot (Recommended) | ExplorerCanvas renders its own tab bar at the top of the canvas container. Self-contained — other canvases don't see it. | ✓ |
| SuperWidget tabs slot | ExplorerCanvas populates the existing SuperWidget tabsEl with its tab buttons. Reuses the slot but couples ExplorerCanvas to SuperWidget layout. | |
| You decide | Claude picks based on CANV-06 and existing patterns | |

**User's choice:** Inside canvas slot (Recommended)
**Notes:** None

### Follow-up: Tab click flow to Projection state

| Option | Description | Selected |
|--------|-------------|----------|
| commitProjection callback (Recommended) | ExplorerCanvas receives a commitProjection callback at construction. Tab click calls switchTab() then commitProjection(). | ✓ |
| Event dispatch | Tab click dispatches a CustomEvent on the canvas container. SuperWidget listens and handles the Projection update. | |

**User's choice:** commitProjection callback (Recommended)
**Notes:** None

---

## Claude's Discretion

- Tab bar styling and CSS class naming
- Internal DOM structure of 3 tab containers
- Whether onProjectionChange is optional on CanvasComponent or a separate interface
- Default activeTabId value on first mount

## Deferred Ideas

None — discussion stayed within phase scope.
