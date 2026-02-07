# Phase 36: SuperGrid Headers - Discussion Template

## Header Hierarchy Structure

### Question 1: Maximum nesting depth
**How many levels of nesting should the SuperGrid headers support?**

- 2-3 levels max — Keep it simple, most real-world data has 2-3 meaningful groupings
- 4-5 levels — More flexibility for complex datasets, but risk of visual clutter
- Dynamic/unlimited — Let the data determine depth, could get unwieldy
- You decide — Claude determines based on data complexity

```
ANSWER: Dynamic/unlimited for now. I had to overthink that answer far longer than warranted...:)
```

### Question 2: Visual complexity management
**When headers get deeply nested, what should happen to prevent UI chaos?**

- Visual compression — Smaller fonts, tighter spacing as depth increases (like file trees)
- Automatic grouping — Collapse intermediate levels when depth exceeds threshold
- Scrollable header area — Let headers scroll horizontally if they get too wide
- Progressive disclosure — Show only 2-3 levels at once, with expand/drill-down controls

```
ANSWER: Automatic grouping AND progressive disclosure sound like a great UX, and this same principle applies to other LATCH filter navigation controls such as Time Slider (SuperTime as well)
```

### Question 3: Grouping strategy
**When auto-grouping kicks in, what should be the grouping strategy?**

- Semantic grouping — Combine levels that represent the same concept (Year+Quarter+Month → "Time")
- Visual threshold — Group when header height exceeds viewport percentage (e.g., >30% of screen)
- Data density — Group levels with low cardinality (if only 1-2 unique values at a level)
- User preference — Let users set their own complexity threshold in settings

```
ANSWER: Semantic grouping then data density, with user-configurable settings (And we need to create a GitHub issue for user application settings stored in SQLite.)
```

### Question 4: Progressive disclosure navigation
**For the progressive disclosure interaction, how should users navigate between header levels?**

- Breadcrumb trail — Show current path with clickable segments (Time > 2024 > Q1 > January)
- Level picker tabs — Horizontal tabs showing available detail levels (Year | Quarter | Month | Day)
- Zoom controls — Plus/minus buttons or slider to zoom in/out of header detail levels
- Hover expansion — Temporarily show deeper levels on hover, click to pin

```
ANSWER: Level picker tabs AND zoom controls. Ideally, the headers will form the primary breadcrumb navigational device (think of the user's POV as a 3D camera stairstepping their way down the hierachicy of PAFV axis headers) and therefore we might not need breadcrumb trail for now. Hover sounds pretty complicated?
```

### Question 5: Header click behavior
**When users click a header cell at any level, what should the interaction behavior be?**

- Filter toggle — Click to filter data to just that header's subset (like current LATCH filtering)
- Expand/collapse — Click to show/hide child levels beneath that header
- Context menu — Right-click or long-press for header-specific actions (sort, filter, group)
- Different click zones — Left side expands/collapses, right side filters, center selects

```
ANSWER: One of the hardest parts of optimizing the Isometry user experience for PAFV is how to navigate the logical z-axis and in turn the visual representation of the z-axis.  In this case, the requirement is to enable a great user experience for selecting and operating controls such as React headers. The lowest z-axis elements are the grid Values, including ungrouped header cells and data cells, painted by D3.js. The child (ungrouped) headers and each level of parent (spanning logic of parents grouped by common children) headers have multiple potential selection mechanisms
```

---

## Zoom and Pan Controls

### Question 1: Orthogonal control separation
**How should the Janus model (value zoom vs extent pan) be visually represented?**

- Separate controls — Distinct zoom slider and pan slider in different UI areas
- Combined widget — Single control that handles both zoom and pan with different interaction modes
- Contextual controls — Controls appear near headers when hovering or selecting
- Keyboard shortcuts — Primary interaction through keyboard, minimal UI chrome

```
ANSWER: I think all of these need to be experimented with, but starting with separate controls seems likes a simpler entry point.  Yes to all with priority on separate controls, pending your recommended enhancements.
```

### Question 2: Value zoom behavior
**When zooming into value density (leaf values → collapsed), what should the transition look like?**

- Smooth animation — Headers morph and resize with easing transitions
- Instant swap — Immediate switch between zoom levels for performance
- Fade transition — Cross-fade between different header configurations
- Progressive reveal — Show intermediate levels during zoom transition

```
ANSWER: Smooth animation.  I like the elegance of a "quiet" app.
```

### Question 3: Extent pan behavior
**When panning through extent density (full Cartesian → populated-only), how should empty areas be handled?**

- Show empty cells — Display grid structure even for unpopulated combinations
- Hide empty cells — Compress grid to show only populated combinations
- Fade empty cells — Show empty areas with reduced opacity/styling
- User toggle — Let users choose between sparse and dense display modes

```
ANSWER: User toggle via SparsityDensity slider and other related controls
```

### Question 4: Zoom anchor point
**Where should the "pinned upper-left anchor" be positioned during zoom operations?**

- Fixed corner — Always pin to top-left corner of visible grid area
- Selection-based — Pin to currently selected cell or header
- Content-aware — Pin to area with highest data density
- User-definable — Let users click to set their own anchor point

```
ANSWER: Fixed corner for now
```

---

## Expand/Collapse Interaction

### Question 1: Collapse animation style
**When headers collapse, what visual feedback should users see?**

- Accordion style — Headers slide up/down with smooth height transitions
- Fade and scale — Headers fade out while scaling down toward parent
- Morphing boundaries — Header boundaries reshape to indicate grouping
- Instant with indicator — No animation, but clear visual indicator of collapsed state

```
ANSWER: I like the idea of morphing boundaries, taking advantage of D3 animation
```

### Question 2: Performance during state changes
**How should the system handle performance when expanding/collapsing large header hierarchies?**

- Lazy rendering — Only render visible headers, virtualize the rest
- Batch operations — Queue multiple expand/collapse operations together
- Progressive rendering — Show skeleton/placeholder while loading complex hierarchies
- Performance budgets — Limit operations per frame to maintain 60fps

```
ANSWER: Progressive rednerign unless consistently exceeding performance budgets, then fall back to lazy rendering
```

### Question 3: Multi-level operations
**Should users be able to expand/collapse multiple levels at once?**

- Single level only — Each click affects one hierarchy level
- Shift+click for multi — Hold modifier key to affect all child levels
- Double-click behavior — Double-click to expand/collapse entire branch
- Context menu options — Right-click menu for "Expand All" / "Collapse All"

```
ANSWER: I think each of these needs to be experimented with, but let's start wtih context menu options as a simpler starting point
```

### Question 4: State persistence
**Should expand/collapse states persist across sessions or view changes?**

- Session memory — Remember states during current session only
- Full persistence — Save states to database/localStorage
- Per-dataset basis — Different persistence rules for different data sources
- User preference — Let users choose persistence behavior in settings

```
ANSWER: Per-dataset and per-app (an Isometry app can combine multiple views and multiple datasets)
```

---

## Visual Spanning Layout

### Question 1: Span calculation method
**How should header cells determine their visual span across child dimensions?**

- Equal distribution — Child headers get equal width regardless of content
- Content-based sizing — Header width based on content length and importance
- Data-proportional — Width proportional to number of data points in each group
- Hybrid approach — Combine content and data considerations with minimum widths

```
ANSWER: Hybrid with minimum widths. Data-proportional for primary sizing (columns with more data get more space), content-based minimums prevent illegibility (header text must fit), equal distribution as fallback when data counts are uniform. Mirrors how Numbers and modern pivot tables handle column sizing.
```

### Question 2: Alignment strategy
**When headers span multiple columns, how should text/content be aligned?**

- Center alignment — Center text within the span area
- Left alignment — Align to left edge of span with padding
- Smart alignment — Center for short spans, left-align for long spans
- Content-aware — Alignment based on header content type (text, numbers, dates)

```
ANSWER: Content-aware alignment. Center for short spans (1-3 words like "Q1", "Jan"), left-align for long spans (multi-word categories like "Engineering & Design"). Numeric content right-aligns regardless of span length. Dates left-align. Alignment serves scannability, not uniformity.
```

### Question 3: Layout conflict resolution
**When header spans would overlap or conflict, what resolution strategy should be used?**

- Priority-based — Higher-level headers get precedence over lower levels
- Compression — Compress conflicting headers to fit available space
- Overflow handling — Let conflicting headers scroll or wrap to next row
- Dynamic reflow — Automatically adjust entire layout to prevent conflicts

```
ANSWER: Dynamic reflow with horizontal scroll fallback. Automatically adjust layout to prevent conflicts while respecting minimum widths. When reflow can't resolve (screen too narrow), fall back to horizontal scroll rather than truncation. Priority-based rejected (rigid hierarchies break with user customization). Compression rejected (sacrifices legibility).
```

### Question 4: Responsive behavior
**How should header spanning adapt to different screen sizes and grid widths?**

- Proportional scaling — All spans scale proportionally with grid width
- Breakpoint adaptation — Different spanning rules for mobile/tablet/desktop
- Minimum span limits — Enforce minimum header widths even if content overflows
- Intelligent wrapping — Wrap complex headers to multiple rows on smaller screens

```
ANSWER: Breakpoint adaptation with semantic grouping. On smaller screens, reduce visible header depth (collapse to 2 levels on tablet, 1 on phone) using the same semantic grouping mechanism from auto-grouping. Proportional scaling alone makes headers illegible on mobile. The semantic grouping contract ensures collapsed views remain meaningful.
```