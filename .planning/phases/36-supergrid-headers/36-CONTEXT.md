# Phase 36: SuperGrid Headers - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement nested PAFV headers with hierarchical spanning across multiple dimension levels. This transforms the current flat header system into a multi-level hierarchical structure where parent headers span their children with visual boundaries, enabling n-dimensional data projection through stacked headers with orthogonal density controls.

</domain>

<decisions>
## Implementation Decisions

### Header hierarchy structure
- Dynamic/unlimited nesting depth — data complexity determines depth, not arbitrary limits
- Automatic grouping + progressive disclosure for complexity management (applies to SuperTime and other LATCH controls)
- Semantic grouping → data density as grouping strategy, with user-configurable settings
- Level picker tabs + zoom controls for navigation (headers form primary breadcrumb device - 3D camera stairstepping)
- Context menu for multi-level expand/collapse operations (starting point; Shift+click and double-click to explore later)
- Per-dataset, per-app state persistence
- Morphing boundary animation style using D3 transitions
- Progressive rendering with lazy rendering fallback when performance budgets exceeded

### Zoom and pan controls
- Separate controls initially (combined widget and other approaches to experiment with later)
- Smooth animation transitions ("quiet app" aesthetic)
- User toggle for sparse/dense display via SparsityDensity slider
- Fixed corner anchor for zoom operations (selection-based and user-definable to explore later)

### Expand/collapse interaction
- Morphing boundary animations using D3 transitions
- Progressive rendering unless consistently exceeding performance budgets, then lazy rendering fallback
- Context menu for multi-level operations ("Expand All" / "Collapse All")
- Per-dataset and per-app state persistence

### Visual spanning layout
- Hybrid span calculation: data-proportional primary sizing + content-based minimums + equal distribution fallback (mirrors Numbers/Excel)
- Content-aware alignment: center for short spans, left-align for long spans, numeric right-align, dates left-align (serves scannability over uniformity)
- Dynamic reflow with horizontal scroll fallback for layout conflict resolution
- Breakpoint adaptation with semantic grouping for responsive behavior (reduce header depth on smaller screens)

### Header click behavior
- Geometric click zones with "innermost wins + parent label exclusion" rule
- Parent label zone (~32px) for structural operations (expand/collapse)
- Child header body for data group selection
- Data cell body for individual card selection
- Cursor feedback eliminates guesswork about click targets
- Zone-specific cursor changes on hover boundaries

### Claude's Discretion
- Exact hover highlight transition timing and easing curves
- Performance monitoring thresholds for lazy rendering fallback
- Minimum header cell dimensions for readability
- Specific breakpoint values for responsive adaptation

</decisions>

<specifics>
## Specific Ideas

- "I like the idea of morphing boundaries, taking advantage of D3 animation"
- "Headers will form the primary breadcrumb navigational device (think of the user's POV as a 3D camera stairstepping their way down the hierarchy of PAFV axis headers)"
- "Hybrid with minimum widths. Data-proportional for primary sizing (columns with more data get more space), content-based minimums prevent illegibility (header text must fit), equal distribution as fallback when data counts are uniform. Mirrors how Numbers and modern pivot tables handle column sizing."
- "Content-aware alignment. Center for short spans (1-3 words like 'Q1', 'Jan'), left-align for long spans (multi-word categories like 'Engineering & Design'). Numeric content right-aligns regardless of span length. Dates left-align. Alignment serves scannability, not uniformity."
- "Dynamic reflow with horizontal scroll fallback. Automatically adjust layout to prevent conflicts while respecting minimum widths. When reflow can't resolve (screen too narrow), fall back to horizontal scroll rather than truncation."
- "Breakpoint adaptation with semantic grouping. On smaller screens, reduce visible header depth (collapse to 2 levels on tablet, 1 on phone) using the same semantic grouping mechanism from auto-grouping."

</specifics>

<deferred>
## Deferred Ideas

- GitHub issue needed for user application settings stored in SQLite (referenced in semantic grouping strategy)
- Shift+click and double-click behavior for multi-level header operations (start with context menu)
- Combined widget approach for zoom/pan controls (start with separate controls)
- Selection-based and user-definable anchor points for zoom (start with fixed corner)
- Hover expansion for progressive disclosure (adds latency and complexity)
- Canvas rendering for data plane optimization (start with SVG/DOM)

</deferred>

---

*Phase: 36-supergrid-headers*
*Context gathered: 2026-02-07*