# Phase 176: Explorer Sidecar + Status Slots - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Bound views auto-show their explorer sidecar with CSS grid transitions; unbound views auto-hide it. Status slots show rich contextual content (card count, filter summary, selection info, card title, dataset info, sync status) per canvas type. Replaces the temporary passthrough slots from Phase 175. 12 requirements: SIDE-01 through SIDE-05, STAT-01 through STAT-07.

</domain>

<decisions>
## Implementation Decisions

### Sidecar Grid Integration
- **D-01:** Root-level 3rd grid column on the SuperWidget root grid. Layout becomes `grid-template-columns: auto 1fr auto` (sidebar | canvas | sidecar). The sidecar is a peer slot alongside sidebar, header, tabs, canvas, and status — not nested inside the canvas area.
- **D-02:** CSS `grid-template-columns` transition animates the sidecar column width between `0` and its natural width (SIDE-03). Because the sidecar is outside the canvas slot entirely, show/hide does not trigger canvas re-renders (SIDE-05).
- **D-03:** The temporary passthrough slots (`getTopSlotEl()` / `getBottomSlotEl()` from Phase 175 D-02) are replaced. Explorer panels move from inside the canvas slot into the new sidecar slot.

### Status Slot Ownership
- **D-04:** Canvas-owned status rendering. Each CanvasComponent renders its own status content into the shared `[data-slot="status"]` element. ViewCanvas adds view name, card count, filter count (STAT-05), and selection count (STAT-07). EditorCanvas adds card title (STAT-02). ExplorerCanvas adds dataset name and last import time (STAT-03).
- **D-05:** SuperWidget owns the sync status indicator (STAT-06) — always visible regardless of canvas type. This is the only status content SuperWidget renders directly.

### Status Clearing on Canvas Switch
- **D-06:** `commitProjection()` clears the status slot (`this._statusEl.innerHTML = ''`) before mounting the new canvas (STAT-04). Single point of responsibility. After clearing, SuperWidget re-appends the sync indicator, then the new canvas renders its own status content on mount.

### Claude's Discretion
- Sidecar slot grid-area naming and row spanning (should span all 4 content rows like sidebar, or a subset)
- Whether sidecar column width is a CSS custom property (`--sw-sidecar-width`) or hardcoded
- Exact CSS transition duration and easing for sidecar show/hide
- Whether the sync indicator is a standalone element or part of a persistent status wrapper that survives clearing
- How ViewCanvas receives filter count and selection count (callback, provider subscription, or DOM event)
- Whether ExplorerCanvas reads dataset info from CatalogWriter or a bridge query

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperWidget Architecture
- `src/superwidget/SuperWidget.ts` — Root grid layout, `commitProjection()` lifecycle, temporary passthrough accessors (lines 105-109, 287-289)
- `src/superwidget/ViewCanvas.ts` — VIEW_SIDECAR_MAP constant, `onSidecarChange` callback, existing `_updateStatus()` with view name + card count
- `src/superwidget/EditorCanvas.ts` — Existing status slot DOM traversal pattern (line 77-78)
- `src/superwidget/statusSlot.ts` — Phase 169 `renderStatusSlot()` / `updateStatusSlot()` for global card/connection counts
- `src/superwidget/projection.ts` — Projection type, `commitProjection` contract

### CSS
- `src/styles/superwidget.css` — Current 2-column grid (lines 36-42), sidebar slot (line 53), temporary explorer passthrough slots (lines 359-380)

### Wiring
- `src/main.ts` — Lines 646-684 (current passthrough slot mounting of explorers), lines 692+ (status slot setup), line 1606-1607 (sidecar TODO)

### Phase 175 Context (predecessor)
- `.planning/phases/175-shell-replacement/175-CONTEXT.md` — D-02 temporary passthrough, D-01 5th sidebar slot

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VIEW_SIDECAR_MAP` in ViewCanvas.ts: Already maps `supergrid → 'explorer-1'`. Sidecar visibility logic can key off this.
- `onSidecarChange` callback: Already wired through ViewCanvasConfig — fires on view switch with explorer ID or null.
- `renderStatusSlot()` / `updateStatusSlot()`: Existing global status bar pattern — may need to coexist with per-canvas status or be replaced.
- `sw-view-status-bar` in ViewCanvas: Existing per-canvas status pattern with `[data-stat]` spans.

### Established Patterns
- Data-attribute selectors (`data-component`, `data-slot`, `data-stat`) — no class-based selectors in SuperWidget
- CSS custom property tokens with `--sw-*` namespace
- CSS Grid for SuperWidget layout — all slots are grid areas
- DOM traversal for status slot: `container.parentElement?.querySelector('[data-slot="status"]')`

### Integration Points
- `commitProjection()`: Status clearing happens here before canvas mount/destroy
- `main.ts` explorer mounting: Currently mounts explorers into passthrough slots — must rewire to sidecar slot
- `ViewCanvas._notifySidecar()`: Already calls `onSidecarChange` — will drive sidecar show/hide
- Existing `sw-explorer-slot-top` / `sw-explorer-slot-bottom` CSS classes: Replaced by sidecar slot internals

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: CSS grid-template-columns transition for sidecar (not JS animation), and CANV-06 preserved (SuperWidget has no canvas-type knowledge).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 176-explorer-sidecar-status-slots*
*Context gathered: 2026-04-22*
