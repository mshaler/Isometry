# Phase 152: Integrate + Visualize Inline Embedding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 152-integrate-visualize-inline-embedding
**Areas discussed:** Top-slot mounting strategy, Data icon toggle scope, Projections auto-visibility, DataExplorer ↔ PanelRegistry unification

---

## Top-Slot Mounting Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked vertically | Data Explorer on top, Properties below, Projections at bottom. Each gets own child div inside `.workbench-slot-top`. | ✓ |
| Two sub-slots | A "user-toggled" sub-slot (Data + Properties) and an "auto" sub-slot (Projections). Keeps two visibility models separate in DOM. | |
| You decide | Claude picks the DOM structure simplest for toggle logic. | |

**User's choice:** Stacked vertically
**Notes:** Straightforward layout, all three as children of the single top-slot container.

---

## Data Icon Toggle Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single "Data" dock item toggles both | Clicking `integrate:catalog` shows/hides Data Explorer + Properties Explorer as a unit. No separate Properties toggle. | ✓ |
| Two separate dock items | Rename dock item + add Properties item under Integrate, each toggling independently. | |
| Single dock item + internal collapse | One click opens slot, user can collapse individual explorers within it via CollapsibleSection. | |

**User's choice:** Single dock item toggles both as a unit
**Notes:** No separate Properties dock entry needed.

---

## Projections Auto-Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Purely automatic | View switch to SuperGrid shows it, any other view hides it. No dock toggle. User can't manually hide while on SuperGrid. | ✓ |
| Automatic with manual dismiss | Auto-shows on SuperGrid, user can click to hide. Reappears next time they switch to SuperGrid. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** Purely automatic
**Notes:** No manual override — entirely view-switch driven.

---

## DataExplorer ↔ PanelRegistry Unification

| Option | Description | Selected |
|--------|-------------|----------|
| Keep special case | DataExplorer stays as-is in `main.ts`. Toggle logic calls `showDataExplorer()` + mounts Properties side-by-side. Less refactoring risk. | ✓ |
| Fold into PanelRegistry | Register DataExplorer as proper panel with factory. "Toggle both" becomes `panelRegistry.enable('data'); panelRegistry.enable('properties')`. Cleaner but more churn. | |
| You decide | Claude picks approach balancing risk vs. cleanup. | |

**User's choice:** Keep special case
**Notes:** Less churn this phase. DataExplorer stays wired directly in main.ts.

---

## Claude's Discretion

- Properties mounting mechanism (direct vs PanelRegistry factory)
- Top-slot visibility management (parent vs individual child divs)
- View-switch hook location for Projections auto-show
- Projections child div creation timing (eager vs lazy)

## Deferred Ideas

None — discussion stayed within phase scope
