# Phase 179: Dock Wiring Repair - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 179-dock-wiring-repair
**Areas discussed:** Settings click behavior, Help click behavior, Toggle vs. navigation active state, Mount-time state sync

---

## Settings Click Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Open CommandPalette | Reuses existing component, consistent with Cmd+K pattern | ✓ |
| Open CommandPalette filtered to settings | Opens palette pre-filtered to settings-related commands | |
| You decide | Claude picks simplest working approach | |

**User's choice:** Open CommandPalette
**Notes:** None — straightforward reuse of existing component.

---

## Help Click Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle HelpOverlay | Reuses existing component, same as pressing ? key | ✓ |
| Open CommandPalette filtered to help | Opens palette pre-filtered to help commands | |
| You decide | Claude picks simplest working approach | |

**User's choice:** Toggle HelpOverlay
**Notes:** None — straightforward reuse of existing component.

---

## Toggle vs. Navigation Active State

| Option | Description | Selected |
|--------|-------------|----------|
| Same visual for both | Accent background means active/on, no distinction needed | ✓ |
| Subtle distinction | View items get solid accent, toggle items get accent border/outline only | |
| You decide | Claude picks approach | |

**User's choice:** Same visual for both
**Notes:** User understands from context which items are view-select vs. toggle-open. No visual distinction needed.

---

## Mount-time State Sync

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — sync on mount | After PanelManager init, read open panels and call setItemPressed | ✓ |
| No — clean slate | Dock starts with no toggle items highlighted | |
| You decide | Claude picks approach | |

**User's choice:** Yes — sync on mount
**Notes:** Dock must be accurate from first paint when panels are restored from persisted state.

---

## Claude's Discretion

- Implementation details for mount-time sync panel state query method
- Routing pattern for help section items (inline handler vs. dockToPanelMap extension)

## Deferred Ideas

None — discussion stayed within phase scope.
