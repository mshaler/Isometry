# Phase 176: Explorer Sidecar + Status Slots - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 176-explorer-sidecar-status-slots
**Areas discussed:** Sidecar grid integration, Status slot ownership, Status clearing on canvas switch

---

## Sidecar Grid Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Root-level 3rd column | SuperWidget grid becomes `auto 1fr auto` (sidebar \| canvas \| sidecar). Sidecar is a peer slot. CSS transition on grid-template-columns. | ✓ |
| Nested sub-container | Keep explorers inside canvas area in a nested grid/flex. Transition on inner element. Less structural change but blurs CANV-06. | |

**User's choice:** Root-level 3rd column
**Notes:** Cleaner for SIDE-03 (CSS grid transition) and SIDE-05 (no canvas re-render on show/hide since sidecar is outside canvas slot entirely).

---

## Status Slot Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas-owned status | Each CanvasComponent renders its own status content into the shared status element. Sync indicator owned by SuperWidget separately. | ✓ |
| SuperWidget-owned status | SuperWidget owns a unified status bar with setStatus(StatusData) API. Canvases push structured data upward. | |

**User's choice:** Canvas-owned status, SuperWidget owns sync indicator only
**Notes:** Matches existing pattern in ViewCanvas._updateStatus(). Preserves CANV-06 — SuperWidget doesn't need canvas-type knowledge.

---

## Status Clearing on Canvas Switch

| Option | Description | Selected |
|--------|-------------|----------|
| commitProjection clears | SuperWidget's commitProjection() does innerHTML = '' before mounting new canvas, then re-appends sync indicator. Single point of responsibility. | ✓ |
| Canvas destroy cleans up | Each canvas's destroy() removes its own status DOM. Relies on every canvas implementing cleanup correctly. | |

**User's choice:** commitProjection clears
**Notes:** Safer — one place guarantees clean slate. Sync indicator re-appended after clearing.

---

## Claude's Discretion

- Sidecar slot grid-area naming and row spanning
- Sidecar column width (CSS custom property vs hardcoded)
- CSS transition duration and easing
- Sync indicator DOM preservation strategy
- How ViewCanvas receives filter/selection counts
- How ExplorerCanvas reads dataset info

## Deferred Ideas

None — discussion stayed within phase scope.
