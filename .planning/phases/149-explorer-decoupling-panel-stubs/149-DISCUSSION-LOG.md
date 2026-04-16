# Phase 149: Explorer Decoupling + Panel Stubs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 149-explorer-decoupling-panel-stubs
**Areas discussed:** Panel layout in main area, Activation model, Stub entry behavior

---

## Panel Layout in Main Area

| Option | Description | Selected |
|--------|-------------|----------|
| Side drawer | PanelDrawer relocates into .workbench-main as a visible flex column (VS Code style) | ✓ |
| Overlay drawer | Panel slides over view content (position:absolute), view stays full-width | |
| Replace view | Explorer replaces view content entirely when active | |
| You decide | Claude picks best approach | |

**User's choice:** Side drawer
**Notes:** User wants iteration flexibility — expects multiple cycles of experimentation to get the UX right. Side drawer chosen as starting point, not final form. VS Code is the reference mental model but user wants to validate the approach through use.

---

## Activation Model

| Option | Description | Selected |
|--------|-------------|----------|
| Dock click toggles panel | Clicking dock item opens/toggles that explorer in the drawer, PanelDrawer icon strip hidden | ✓ |
| Dock click replaces drawer | Only one explorer visible at a time, clicking swaps content | |
| Dock opens drawer, strip picks panels | DockNav opens drawer as a whole, PanelDrawer icon strip handles individual panel selection | |
| You decide | Claude picks based on existing wiring | |

**User's choice:** Dock click toggles panel
**Notes:** Most intuitive mapping — dock icon = panel toggle. PanelDrawer icon strip becomes redundant since DockNav already shows all explorer entries.

---

## Stub Entry Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Register as PanelMeta | Each stub gets PanelMeta + factory returning PanelHook with placeholder div | ✓ |
| Special-case in onActivateItem | Detect three item keys, show static placeholder without PanelRegistry | |

**User's choice:** Register as PanelMeta
**Notes:** Registry pattern pays for itself — future phases just swap the factory function with real content. No special-case rip-out needed.

---

## Claude's Discretion

- PanelDrawer icon strip: hide vs delete (hiding preferred for iteration)
- DataExplorer special-case merge strategy
- DOM ordering in .workbench-main
- CSS drawer transitions
- onActivateItem routing for explorer sections
- Scroll-to-section implementation

## Deferred Ideas

None — discussion stayed within phase scope
