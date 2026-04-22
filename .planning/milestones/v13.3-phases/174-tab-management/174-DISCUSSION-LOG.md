# Phase 174: Tab Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 174-tab-management
**Areas discussed:** Tab identity & new-tab defaults, Close behavior & guarding, Drag reorder approach, Overflow navigation

---

## Tab Identity & New-Tab Defaults

### Q1: What canvas type should a new tab start as?

| Option | Description | Selected |
|--------|-------------|----------|
| Default to View (Bound) (Recommended) | New tab opens as a Bound View canvas. Matches existing single-tab behavior. | ✓ |
| Canvas chooser screen | Unbound placeholder with buttons to pick Explorer / View / Editor. | |
| Clone current tab | Duplicates the active tab's Projection. | |

**User's choice:** Default to View (Bound) — recommended default accepted
**Notes:** None

### Q2: Should tabs have independent or shared state?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared state across tabs (Recommended) | All tabs read from same FilterProvider / PAFVProvider / DensityProvider. | ✓ |
| Independent state per tab | Each tab gets own filter/PAFV/density snapshot. Requires provider cloning. | |
| You decide | Claude picks based on provider architecture. | |

**User's choice:** Shared state across tabs
**Notes:** Keeps provider architecture intact, avoids cloning complexity.

---

## Close Behavior & Guarding

### Q3: Which tab activates when a tab is closed?

| Option | Description | Selected |
|--------|-------------|----------|
| Adjacent tab (Recommended) | Right neighbor, or left if rightmost closed. Browser convention. | ✓ |
| Previously active tab | Tab history stack, return to last-active. VS Code style. | |
| Always first tab | Jump to index 0. Simple but jarring. | |

**User's choice:** Adjacent tab — recommended default accepted
**Notes:** None

### Q4: Confirmation on close with unsaved Editor content?

| Option | Description | Selected |
|--------|-------------|----------|
| No confirmation (Recommended) | Close immediately. Auto-save covers risk. | ✓ |
| Confirm on dirty Editor tabs | Save / Discard / Cancel dialog. | |
| You decide | Claude picks based on canvas state. | |

**User's choice:** No confirmation
**Notes:** Editor auto-saves via 500ms debounce notebook persistence.

---

## Drag Reorder Approach

### Q5: Visual feedback style for tab drag reorder?

| Option | Description | Selected |
|--------|-------------|----------|
| Insertion line (Recommended) | Vertical line at drop target, dimmed source. Matches SuperDynamic pattern. | ✓ |
| Ghost tab follows pointer | Semi-transparent clone follows cursor. New pattern for codebase. | |
| Swap on hover | Tabs physically swap as pointer moves. Can feel jumpy. | |

**User's choice:** Insertion line
**Notes:** Consistent with existing SuperDynamic axis reorder pattern.

---

## Overflow Navigation

### Q6: How should overflow chevrons work?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace fade with chevrons (Recommended) | Remove CSS mask-image fade. Add directional chevron buttons. | ✓ |
| Chevrons over fade | Keep edge fade AND add overlaid chevrons. Double signal. | |
| You decide | Claude picks cleanest approach. | |

**User's choice:** Replace fade with chevrons
**Notes:** Explicit affordance, cleaner than dual fade+chevron.

---

## Claude's Discretion

- TabSlot type shape details
- Chevron scroll implementation (scrollBy smooth vs manual)
- Tab ordering data structure
- Cmd+W handler routing
- FLIP animation decision for reorder

## Deferred Ideas

None — discussion stayed within phase scope.
