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
- Toast appears/updates on every zoom level change immediately — always shows current percentage during active zooming. Most responsive feel.
- Toast shows on Cmd+0 reset too — brief "100%" confirmation. All zoom changes get feedback.
- Dark semi-transparent rounded pill (like macOS HUD): dark bg, white text, centered "150%" text. Fade in/out.
- Toast positioned center of visible grid area — matches macOS volume HUD placement.

### Font & Content Scaling
- True proportional zoom: font size, padding, count badge size ALL scale with zoom via CSS Custom Properties
- Single `--sg-zoom` CSS Custom Property drives all scaling. Other values derived via `calc()`: `font-size: calc(12px * var(--sg-zoom))`, `padding: calc(4px * var(--sg-zoom))`, etc. One `setProperty()` call per zoom change.
- `--sg-col-width` and `--sg-row-height` are still derived: `calc(120px * var(--sg-zoom))` and `calc(40px * var(--sg-zoom))`
- No minimum font floor — at 0.5x, badges are ~6px. Overview is the point of zoom-out, not reading. Consistent proportionality across entire range.

### Column Width Mode
- Fixed 120px data columns at 1x zoom (replacing current `minmax(60px, 1fr)` flex columns). Grid may be narrower or wider than viewport — that's expected.
- Row header column stays fixed at 160px regardless of zoom level — labels remain readable as stable anchor
- 60px minimum column width at max zoom-out (0.5x) is acceptable — count badges still visible, text may truncate but overview is the point

### Frozen Header Styling
- Subtle tint background (#f5f5f5 or similar light gray) on all sticky headers — distinguishes from data cells without being heavy
- No drop shadow on frozen headers — clean, flat look with background color + border only
- Header text scales with zoom proportionally like cell content — consistent visual scaling across entire grid
- Grip handles always visible on axis headers, even when sticky — no interaction changes during scroll

### Position Restore Scope
- Filter change → reset scroll to (0,0). Different data = contextually meaningless scroll position.
- Same-dimension axis reorder (DYNM-03) → preserve scroll position. Same data, reshuffled layout — keep user's context.
- Cross-dimension axis transpose → reset scroll to (0,0). Deliberate reflow action — previous position is contextually invalid.
- View switch (leaving then returning to SuperGrid) → restore both scroll position AND zoom level from SuperPositionProvider
- Filter change → preserve zoom level. Zoom is a view preference, not tied to data. User chose 1.5x for density — keep it.
- POSN-02 "survive axis transpose" means: SuperPositionProvider state is NOT corrupted or reset by transpose. Scroll visually resets to (0,0) but provider still holds last-good coordinates. Provider stays valid — it just doesn't attempt pixel-position restoration on transpose.

### Zoom Level Ownership
- Zoom level (`_zoomLevel`) lives on SuperPositionProvider, grouped with scroll state — both are "how/where the user is looking at the grid"
- SuperPositionProvider is injected as a 5th constructor dependency: `(provider, filter, bridge, coordinator, positionProvider)`. Testable — inject mock in tests. Follows existing DI pattern.
- SuperPositionProvider NOT registered with StateCoordinator (would trigger 60fps worker calls during scroll)
- Zoom API on SuperPositionProvider: simple get/set property style (`provider.zoomLevel = 1.5`, `const z = provider.zoomLevel`)
- `reset()` clears scroll position but preserves zoom level. Zoom is a preference that outlives individual grid sessions.

### Claude's Discretion
- Precise zoom sensitivity curve (WHEEL_SCALE_SPEEDUP tuning)
- CSS Custom Property naming conventions beyond --sg-zoom (e.g., --sg-header-bg)
- rAF throttling implementation details for scroll handler
- Toast fade animation timing and easing
- Whether to debounce toast display during rapid zoom changes

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGrid.ts` — rootEl (overflow:auto), gridEl (display:grid), _fetchAndRender()/_renderCells() pipeline, mount/destroy lifecycle, 4-arg constructor (provider, filter, bridge, coordinator). Axis DnD working (Phase 18 shipped).
- `SuperStackHeader.ts` — `buildGridTemplateColumns()` returns `minmax(60px, 1fr)` — needs update to `var(--sg-col-width, 120px)` for zoom scaling.
- `StateCoordinator` — setTimeout(16) batching. SuperPositionProvider MUST NOT register here (would trigger 60fps worker calls during scroll).
- Module-level `_dragPayload` singleton pattern — reference for how to handle module-level state (but SuperPositionProvider should use constructor injection, not singleton).

### Established Patterns
- Constructor injection: SuperGrid takes (provider, filter, bridge, coordinator). SuperPositionProvider becomes 5th dependency.
- D3 data join with key function in _renderCells() — zoom CSS Custom Properties won't require changing the join logic.
- Crossfade transition via d3.select opacity animation in _fetchAndRender() — scroll restore must happen AFTER this completes.
- Inline styles on all cells (no external CSS file) — sticky styles and CSS var references follow same pattern.

### Integration Points
- `_renderCells()` — sticky CSS properties added to existing header/corner cell creation code
- `_renderCells()` — `min-height: '40px'` on data cells → `calc(var(--sg-row-height))` or `calc(40px * var(--sg-zoom))`
- `mount()` — wheel event listener (passive:false) + scroll event listener (passive:true) + position restore after first _fetchAndRender()
- `destroy()` — cleanup: removeEventListener for wheel/scroll, cancelAnimationFrame for rAF
- `buildGridTemplateColumns()` — replace `minmax(60px, 1fr)` with `var(--sg-col-width, 120px)` (or `calc(120px * var(--sg-zoom, 1))`)
- `main.ts` — wire SuperPositionProvider as 5th constructor arg to SuperGrid

</code_context>

<specifics>
## Specific Ideas

- Zoom toast should feel like the macOS volume/brightness overlay — brief, centered, unobtrusive, dark pill on semi-transparent bg
- Column width change from flexible to fixed is intentional — the grid should feel more like a spreadsheet at this point, not a responsive layout
- Frozen headers should "just work" — user shouldn't notice the mechanism, only that headers stay put when scrolling
- Single --sg-zoom custom property is the "one source of truth" for zoom — everything derives from it via calc(). Only one setProperty() call needed per zoom tick.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-superposition-superzoom*
*Context gathered: 2026-03-04*
