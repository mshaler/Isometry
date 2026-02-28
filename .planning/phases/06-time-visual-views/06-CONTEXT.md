# Phase 6: Time + Visual Views - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Calendar, Timeline, and Gallery views with DensityProvider time-axis SQL integration exercised at all five granularity levels. Three new IView implementations following the established mount/render/destroy lifecycle. No new view types beyond these three.

</domain>

<decisions>
## Implementation Decisions

### Calendar layout
- Month grid as default display mode
- 7-column grid with day cells, standard calendar layout (like Apple Calendar month view)
- Overflow handling: show 2-3 card chips per day cell, then "+N more" label; clicking expands or navigates to day view
- DensityProvider granularity maps directly to display modes:
  - day = single day expanded
  - week = 7-column single week
  - month = full month grid (default)
  - quarter = 3 mini-months
  - year = 12 mini-months
- Each granularity changes BOTH the SQL GROUP BY expression AND the visual layout
- HTML-based rendering using CSS Grid — matches Kanban approach
- Crossfade transition to/from SVG views (List, Grid, Timeline)

### Timeline axis
- Horizontal time axis (left-to-right) using d3.scaleTime()
- Fixed left column with swimlane row labels (field determined by PAFVProvider GROUP BY)
- Cards positioned along x-axis by date value, grouped into swimlane rows
- Overlapping cards within the same swimlane stack vertically (sub-rows expand swimlane height) — no cards hidden
- SVG-based rendering — d3.scaleTime() axis, tick marks, and cards all native SVG
- Morph transitions possible with List/Grid (all SVG LATCH views)
- Timeline joins the SVG_VIEWS set in transitions.ts

### Gallery tiles
- Uniform tile size (larger than GridView's 180x120 — exact dimensions Claude's discretion)
- Responsive column count based on container width (same pattern as GridView)
- Image-less cards (notes, tasks, events, persons): large card-type icon/letter centered with card name below, using existing CARD_TYPE_ICONS pattern
- Resource-type cards: render body_text as image src (img tag); fall back to placeholder on load failure
- HTML-based rendering using CSS Grid — img tags render natively
- Crossfade transition to/from SVG views

### Date field handling
- Add `due_at` to CardDatum projection (already exists in cards table and DensityProvider)
- Add `body_text` to CardDatum projection (Gallery needs it for resource card images; other views ignore it)
- Cards with NULL for the active DensityProvider time field are excluded from Calendar/Timeline — they still appear in List/Grid/Kanban/Gallery
- No event_start/event_end fields in CardDatum for now — defer multi-day span rendering

### Transition classification
- SVG_VIEWS: list, grid, timeline (morph transitions between these)
- HTML_VIEWS: kanban, calendar, gallery (crossfade transitions)
- LATCH↔GRAPH family switch always crossfades (existing behavior preserved)

### Claude's Discretion
- Gallery tile dimensions (larger than 180x120 but exact size TBD)
- Calendar navigation controls (prev/next month arrows, today button)
- Calendar mini-month layout for quarter/year granularity
- Timeline zoom/pan behavior
- Timeline tick mark density and label formatting
- Loading skeleton design for each new view
- Exact spacing and typography within calendar cells

</decisions>

<specifics>
## Specific Ideas

- Calendar overflow pattern follows Google/Apple Calendar "+N more" convention
- Timeline swimlanes should be clearly separated — row labels act as a fixed sidebar
- Gallery should feel like a photo library browser — clean uniform grid of visual tiles
- The direct density-to-display mapping is key: switching DensityProvider granularity must visibly change the calendar layout, not just the underlying SQL

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IView` interface (mount/render/destroy): all 3 new views implement this unchanged
- `CardRenderer.renderHtmlCard()`: Calendar and Gallery can use for card chips/tiles
- `CardRenderer.renderSvgCard()`: Timeline can use for SVG card rendering
- `CardRenderer.CARD_TYPE_ICONS`: Gallery uses for image-less card placeholders
- `DensityProvider.compile()`: returns `{ groupExpr }` strftime() SQL — Calendar/Timeline consume this
- `ViewManager`: handles lifecycle, loading/error/empty states — no changes needed
- `morphTransition()` / `crossfadeTransition()`: existing transition infrastructure
- `toCardDatum()`: needs expansion to include due_at and body_text

### Established Patterns
- SVG views: D3 data join with key `d => d.id`, g.card groups, opacity fade enter/exit
- HTML views: document.createElement, CSS classes, ViewManager crossfade on switch
- Provider subscription: subscribe() returns unsubscribe function, batched notifications
- Sort/filter: handled by providers + QueryBuilder, views just render cards they receive

### Integration Points
- `transitions.ts` SVG_VIEWS set: add 'timeline'
- `transitions.ts` HTML_VIEWS set: add 'calendar', 'gallery'
- `CardDatum` in `views/types.ts`: add due_at and body_text fields
- `toCardDatum()` mapper: map new fields from Worker response rows
- `views/index.ts` barrel: export CalendarView, TimelineView, GalleryView
- `providers/types.ts` ViewType: already includes 'calendar', 'timeline', 'gallery' — no change needed

</code_context>

<deferred>
## Deferred Ideas

- Multi-day event spans in Timeline (event_start → event_end bars) — requires adding event_start/event_end to CardDatum
- Calendar drag-drop to reschedule cards — would need MutationManager integration like Kanban
- Timeline zoom/scroll linked to DensityProvider granularity switching
- Gallery lightbox/preview overlay for resource images

</deferred>

---

*Phase: 06-time-visual-views*
*Context gathered: 2026-02-28*
