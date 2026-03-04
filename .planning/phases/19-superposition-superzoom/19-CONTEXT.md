# Phase 19: SuperPosition + SuperZoom - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can zoom in/out via trackpad pinch or mouse wheel with frozen headers and upper-left corner anchor. PAFV coordinates are tracked as Tier 3 ephemeral state for cross-view scroll position restoration. CSS Custom Property scaling drives zoom — no d3.zoom, no CSS transform.

</domain>

<decisions>
## Implementation Decisions

### Zoom UX & Controls
- Transient toast overlay showing zoom percentage (e.g., "150%") that fades after ~1 second — like macOS volume HUD. No persistent UI element.
- Reset-to-100% via double-tap trackpad or Cmd+0 keyboard shortcut (familiar browser/design tool pattern)
- Zoom range: 0.5x–3.0x
- Smooth continuous zoom (not discrete steps) — each pinch increment updates proportionally, fluid like Google Maps

### Column Width Mode
- Fixed 120px data columns at 1x zoom (replacing current `minmax(60px, 1fr)` flex columns). Grid may be narrower or wider than viewport — that's expected.
- Row header column stays fixed at 160px regardless of zoom level — labels remain readable as stable anchor
- Scale everything with zoom: font size, count badge size, padding all scale proportionally. 2x zoom = 2x larger text. True zoom feel.
- 60px minimum column width at max zoom-out (0.5x) is acceptable — count badges still visible, text may truncate but overview is the point

### Frozen Header Styling
- Subtle tint background (#f5f5f5 or similar light gray) on all sticky headers — distinguishes from data cells without being heavy
- No drop shadow on frozen headers — clean, flat look with background color + border only
- Header text scales with zoom proportionally like cell content — consistent visual scaling across entire grid
- Grip handles (⠿) always visible on axis headers, even when sticky — no interaction changes during scroll

### Position Restore Scope
- Filter change → reset scroll to (0,0). Different data = contextually meaningless scroll position.
- Same-dimension axis reorder (DYNM-03) → preserve scroll position. Same data, reshuffled layout — keep user's context.
- Cross-dimension axis transpose → reset scroll to (0,0) (per research — deliberate reflow action)
- View switch (leaving then returning to SuperGrid) → restore both scroll position AND zoom level from SuperPositionProvider
- Filter change → preserve zoom level. Zoom is a view preference, not tied to data. User chose 1.5x for density — keep it.

### Claude's Discretion
- Exact toast overlay animation/positioning
- Precise zoom sensitivity curve (WHEEL_SCALE_SPEEDUP tuning)
- CSS Custom Property naming conventions (--sg-col-width, --sg-row-height, etc.)
- rAF throttling implementation details for scroll handler
- Whether SuperPositionProvider stores zoom level or SuperGrid keeps it as a private field

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGrid.ts` — rootEl (overflow:auto), gridEl (display:grid), _fetchAndRender()/_renderCells() pipeline, mount/destroy lifecycle. All modifications land here.
- `SuperStackHeader.ts` — `buildGridTemplateColumns()` returns `minmax(60px, 1fr)` — needs update to `var(--sg-col-width, 120px)` for zoom scaling.
- `StateCoordinator` — setTimeout(16) batching. SuperPositionProvider MUST NOT register here (would trigger 60fps worker calls during scroll).

### Established Patterns
- Constructor injection: SuperGrid takes (provider, filter, bridge, coordinator). SuperPositionProvider would be a 5th dependency.
- D3 data join with key function in _renderCells() — zoom CSS Custom Properties won't require changing the join logic.
- Crossfade transition via d3.select opacity animation in _fetchAndRender() — scroll restore must happen AFTER this completes.
- Module-level singleton pattern (_dragPayload) for HTML5 DnD state.

### Integration Points
- `_renderCells()` — sticky CSS properties added to existing header/corner cell creation code
- `mount()` — wheel event listener + scroll event listener + position restore after first _fetchAndRender()
- `destroy()` — cleanup: removeEventListener for wheel/scroll, cancelAnimationFrame for rAF
- `buildGridTemplateColumns()` — replace `minmax(60px, 1fr)` with CSS Custom Property reference
- Data cell `minHeight: '40px'` — replace with `var(--sg-row-height)` CSS Custom Property

</code_context>

<specifics>
## Specific Ideas

- Zoom toast should feel like the macOS volume/brightness overlay — brief, centered, unobtrusive
- Column width change from flexible to fixed is intentional — the grid should feel more like a spreadsheet at this point, not a responsive layout
- Frozen headers should "just work" — user shouldn't notice the mechanism, only that headers stay put when scrolling

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-superposition-superzoom*
*Context gathered: 2026-03-04*
