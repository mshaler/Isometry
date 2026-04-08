# Phase 140: Transform Pipeline Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 140-transform-pipeline-wiring
**Areas discussed:** Cell array construction

---

## Cell Array Construction

| Option | Description | Selected |
|--------|-------------|----------|
| A — Build flat, partition for D3 | `render()` builds flat array, runs `runTransformData`, `_renderTable` receives transformed array and groups by `rowIdx` via `Map<number, CellPlacement[]>`. Clean pipeline but requires new grouping step in `_renderTable`. | |
| B — Build flat, pass flat, restructure _renderTable | Same upstream construction, `_renderTable` receives flat array + row/col counts, builds `<tr>` structure from flat list. Most invasive refactor. | |
| C — Build flat in render(), keep per-row D3 join | `render()` builds flat array, runs `runTransformData`, passes both transformed array AND `visibleRows`/`visibleCols` to `_renderTable`. `_renderTable` still iterates `visibleRows` but looks up cells from pre-built map instead of constructing inline. Minimal refactor. | ✓ |

**User's choice:** Option C — minimal refactor, lookup swap
**Notes:** User raised downstream concern about future multi-format copy/paste (flat grid, HTML table with spans, spreadsheet matrix). This reinforced C because the flat array exists as a shareable intermediate in `render()` scope. User agreed to attach cells to `RenderContext` as forward-looking enabler (D-02).

---

## Layout Application Timing

**User's choice:** Claude's discretion
**Notes:** Recommended passing transformed GridLayout as parameter to `_renderTable`/`_renderOverlay` instead of reading from private fields. Private fields remain as defaults only.

## Verification Scope

**User's choice:** Claude's discretion
**Notes:** Two smoke tests per roadmap (SuperZoom 1.5x, SuperSort reorder) plus all 52 E2E specs passing.

## Claude's Discretion

- Layout application timing (D-04): pass transformed GridLayout as parameter
- Verification scope (D-05): two smoke tests + full E2E suite

## Deferred Ideas

- Multi-format copy/paste (flat grid, HTML with spans, spreadsheet matrix) — future phase, not yet specified
