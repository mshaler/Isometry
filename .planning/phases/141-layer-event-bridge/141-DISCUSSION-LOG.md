# Phase 141: Layer 1/2 Event Bridge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 141-layer-event-bridge
**Areas discussed:** (none — user skipped discussion)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Event bridge wiring | How Layer 1 pointer events reach the plugin pipeline — scroll container delegation vs per-cell listeners | |
| Audit targeting change | SuperAudit currently targets overlay divs — success criteria say data cells, not overlay divs | |
| Skip — all clear | Success criteria are specific enough, let Claude handle based on existing patterns | ✓ |

**User's choice:** Skip — all clear
**Notes:** User confirmed the success criteria and existing codebase patterns are sufficient to guide all implementation decisions. All four decisions (D-01 through D-04) captured as Claude's Discretion.

---

## Claude's Discretion

- D-01: Data attributes from CellPlacement fields during D3 enter+merge
- D-02: Event delegation on scroll container (matches v6.0 pattern)
- D-03: Audit plugins target Layer 1 table cells, not overlay divs
- D-04: CSS user-select: none on .pv-data-cell

## Deferred Ideas

None
