# Isometry Design System — Figma Make Prompt

## Application Context

Isometry is a polymorphic data visualization platform — "the next-dimension spreadsheet." It imports databases (starting with Apple Notes' ~80 properties), classifies every property into one of 5 LATCH axes (Location, Alphabet, Time, Category, Hierarchy), and lets users project any axis onto any spatial plane (X, Y, Z) through drag-and-drop. The result is a SuperGrid: a multidimensional spreadsheet with stacked headers, semantic zoom, and density controls that no existing tool handles well.

**Design language:** NeXTSTEP-inspired. Muted grays, beveled edges, system fonts, subtle depth. Think "1990s workstation aesthetic refined for 2026 Retina screens." Monospaced labels on chrome, proportional on content. Dark mode primary. Functional density over decorative whitespace.

**Data narrative:** User opens Isometry. Apple Notes database imports via schema-on-read. ~80 properties auto-classify into LATCH buckets. User checks properties, drags them to planes, adjusts sliders. SuperGrid renders the projection live.

---

## Component 1: LATCH×GRAPH Properties Filter Navigator

**Purpose:** Semantic pan — "What am I looking at?" This is the coin sorter: schema-on-read classifies every imported database property into one of 5 LATCH axes (plus a GRAPH column for edge types). Users check/uncheck properties to control what's visible downstream.

**Layout:** Full window width, horizontal arrangement of 6 columns (5 LATCH + 1 GRAPH). Each column is a vertical drop well.

### Column Headers (left to right)
| Column | Label | Badge Color | Icon |
|--------|-------|-------------|------|
| L | Location | Blue (#4A90D9) | 📍 |
| A | Alphabet | Green (#7CB342) | 🔤 |
| T | Time | Orange (#FF9800) | ⏱ |
| C | Category | Purple (#9C27B0) | 🏷 |
| H | Hierarchy | Red (#E53935) | 📊 |
| GRAPH | Graph | Gray (#78909C) | 🔗 |

### Property Chips
- Each chip is a horizontal bar the full width of its column drop well
- Standard spreadsheet cell height (~28px)
- Left side: checkbox (☑/☐)
- Center: display name with alias support (e.g., "📅 Created" instead of "ZINCEPTIONTIMESTAMP")
- Right side: subtle type indicator icon (date, text, number, select)
- Chips are vertically stacked within each column
- Vertical order is determined by the property classifier (relevance/frequency ranking) and is positionally static — chips don't move, they toggle on/off
- Selected (checked) chips have a subtle highlight/active state with the column's badge color as a left border accent
- Unselected chips are dimmed but still visible and readable

### Example Properties per Column
**Location:** ☑ Location Name, ☐ Address, ☐ Latitude, ☐ Longitude
**Alphabet:** ☑ Title, ☐ Summary, ☐ Source
**Time:** ☑ Created, ☑ Modified, ☐ Due Date, ☐ Event Start, ☐ Event End, ☐ Completed
**Category:** ☑ Folder, ☑ Tags, ☐ Status, ☑ Note Type, ☐ Source App
**Hierarchy:** ☑ Priority, ☐ Importance, ☐ Sort Order
**Graph:** ☑ Links, ☐ Nesting, ☐ Sequence, ☐ Affinity

### Property Alias System
Each chip shows a user-configurable display alias rather than the raw database column name. A small edit icon appears on hover to the right of the display name, opening an inline rename field. The alias mapping persists per-dataset. Examples:
- `ZINCEPTIONTIMESTAMP` → "📅 Created"
- `ZMODIFICATIONDATE` → "📅 Modified"  
- `ZTITLE2` → "Title"
- `ZFOLDER` → "📁 Folder"

### Behavioral Notes
- Checking a property makes it available in the PAFV Navigator below AND visible as a potential SuperGrid header
- Unchecking cascades: if the property was assigned to a plane in the PAFV Navigator, it gets unmapped automatically
- Column collapse: each column header is clickable to collapse/expand its property list
- Property count badge on each column header showing "3/12" (selected/total)

---

## Component 2: PAFV Projection Navigator

**Purpose:** Semantic zoom — "How am I looking at it?" Given the checked properties from Navigator 1, users drag-and-drop axis chips onto planes to define the spatial projection.

**Layout:** Horizontal strip below the LATCH Navigator. Four drop wells arranged left to right.

### Drop Wells
| Well | Label | Purpose | Width |
|------|-------|---------|-------|
| Available | Available | Holding area for quick access | ~40% |
| X | x-plane (Columns) | Horizontal axis assignment | ~20% |
| Y | y-plane (Rows) | Vertical axis assignment | ~20% |
| Z | z-plane (Layers) | Depth/stacking assignment | ~20% |

### Axis Chips
- Same visual style as LATCH Navigator chips but with drag handles (⠿ grip dots on left)
- Each chip shows its LATCH bucket as a color-coded left border matching the badge colors from Navigator 1
- Chips can be dragged between wells and reordered within wells
- When dragged over a valid drop target, the well highlights with a subtle glow
- Multiple chips can stack in X and Y wells (creating stacked SuperGrid headers — this is how you get nested Year→Quarter→Month columns)
- Stack order within a well determines nesting hierarchy (top chip = outermost header level)
- Transpose button (⇄) between X and Y wells for quick axis swap

### Z-Plane Special Controls
The Z well contains, in addition to axis chips, the following controls styled as same-size chips:

**Display Property Dropdown:**
- Dropdown chip labeled "Display: Title ▾"
- Determines which property value appears on each Card in the SuperGrid cells
- Options include all checked text/title properties from Navigator 1
- Default is Title (the node name)

**Audit View Toggle:**
- Checkbox chip labeled "☐ Audit View"
- When enabled, activates SuperAudit highlighting across the entire grid:
  - Computed/formula cells get a subtle blue tint
  - ETL-enriched cells get a subtle green tint
  - Recently modified cells get a brief amber flash on change
  - Anomalous values (statistical outliers) get a red border

**Additional Z-Plane Controls (recommended):**

*Card Density Selector:*
- Chip labeled "Cards: Compact ▾"
- Options: Compact (title only), Standard (title + 1 property), Expanded (title + 3 properties), Full (mini-card with all checked properties)
- Controls how much information each Card shows within its SuperGrid cell

*Aggregation Mode:*
- Chip labeled "Agg: Count ▾"
- Options: Count, Sum, Average, Min, Max, List
- When multiple cards occupy the same cell intersection, this determines how they're summarized in dense view

*Color Encoding:*
- Chip labeled "Color: None ▾"  
- Dropdown of all checked properties
- Maps a selected property to a color gradient across cards (e.g., Priority → red-to-green gradient)

*Size Encoding:*
- Chip labeled "Size: None ▾"
- Maps a numeric property to relative card size within cells

### Cascade from Navigator 1
- Only properties checked in the LATCH Navigator appear in the Available well
- Unchecking a property in Navigator 1 removes it from all PAFV wells (with a brief exit animation)
- Checking a new property in Navigator 1 adds it to the Available well (with a brief enter animation)

---

## Component 3: SuperGrid

**Purpose:** The main data canvas. A multidimensional spreadsheet where stacked headers create dimensional depth along both row and column axes, with Cards at cell intersections.

### Architecture
```
┌──────────────┬────────────────────────────────────────────────┐
│              │              Column Headers                    │
│   Corner     │  ┌─────────────────────────────────────────┐   │
│   Cell       │  │ Level 0: Year (2023, 2024, 2025)        │   │
│              │  │ Level 1: Quarter (Q1, Q2, Q3, Q4)       │   │
│  Shows axis  │  │ Level 2: Month (Jan, Feb, Mar...)       │   │
│  config      │  └─────────────────────────────────────────┘   │
├──────────────┼────────────────────────────────────────────────┤
│ Row Headers  │                                                │
│ ┌──────────┐ │              Data Cells                        │
│ │ Level 0: │ │                                                │
│ │ Project  │ │   Each cell = intersection of row × column     │
│ │          │ │   Contains 0-n Cards                           │
│ │ Level 1: │ │   Cards show Display Property (from Z-plane)   │
│ │ Status   │ │                                                │
│ │          │ │   Empty cells show subtle dot or dash          │
│ └──────────┘ │                                                │
│              │                                                │
└──────────────┴────────────────────────────────────────────────┘
```

### SuperStack Headers (Nested PAFV Headers)
- Multi-level headers that visually span child dimensions
- Parent headers merge across their children with spanning borders
- Example: Q1 header spans across Jan, Feb, Mar sub-headers
- Nesting depth is dynamic — determined by how many chips are stacked in X or Y wells
- Click a parent header to collapse/expand its children
- Morphing boundary animation on collapse/expand (D3-style smooth transitions)
- Header cells have resize handles on right edge (drag to resize column/row)
- Shift+drag resizes all sibling headers proportionally
- Right-click context menu: Expand All, Collapse All, Sort Ascending, Sort Descending, Hide

### Corner Cell
- Shows current axis configuration as a mini legend
- Format: "ROWS: [Status] COLS: [Quarter → Priority]"
- Clicking opens a quick-configuration overlay

### Data Cells
- Each cell sits at the intersection of row and column header values
- Cells contain 0 to n Cards depending on how many data items match that intersection
- Single card: displays inline with the Display Property
- Multiple cards: shows a count badge and stacked card indicators
- Click to expand a multi-card cell into a card list popover
- Drag cards between cells to reassign their property values (e.g., dragging a card from "To Do" column to "Done" column updates the card's status)
- Empty cells: subtle centered dot (·) to indicate the intersection exists but has no data
- Populated cells: light background tint proportional to card count (heat map mode, toggleable)

### Card Rendering Within Cells
Based on Card Density setting from Z-plane:
- **Compact:** Single line showing Display Property value, truncated with ellipsis. Fits ~3 cards per standard cell height.
- **Standard:** Display Property on first line, one additional property on second line in smaller text.
- **Expanded:** Mini-card with title + 3 property rows. One card per cell unless scrollable.
- **Full:** Full mini-card rendering with all checked properties as key-value pairs. Cells expand to accommodate.

### SuperGrid Interaction Patterns
- **SuperZoom:** Pinch/scroll zoom anchors to upper-left corner (not center). Row headers stay frozen during horizontal scroll. Column headers stay frozen during vertical scroll. Cannot scroll past grid boundaries (elastic bounce-back).
- **SuperSelect:** Click to select card. ⌘-click for multi-select. Shift-click for range select. Lasso select by clicking empty space and dragging. Selection respects z-axis depth (clicking a header selects the header, not the cards behind it).
- **SuperDynamic:** Drag column/row headers to reorder. This updates the axis ordering in the PAFV Navigator to stay in sync.
- **SuperSort:** Click header to sort. First click: ascending. Second: descending. Third: clear sort. Sort indicator arrows (▲/▼) appear in the header.
- **SuperFilter:** Dropdown filter icon (▼) in each header cell. Opens a checkbox filter list showing all unique values for that facet. Selected items filter the grid immediately.

### Grid Continuum
SuperGrid exists on a continuum from simple to complex:
- 0 axes assigned: Gallery (cards in a flow layout)
- 1 axis (Y only): List view
- 1 axis (X only): Kanban columns  
- 2 axes (X + Y): Standard 2D grid
- 2+ axes with stacking: Full SuperGrid with nested headers

The same component handles all cases — the view adapts based on how many axes are assigned in the PAFV Navigator.

---

## Component 4: LATCH Sliders

**Purpose:** Continuous spectral filter controls — "tuning knobs" for what gets filtered, sorted, and analyzed. Each LATCH domain gets its own horizontal slider strip with domain-specific controls.

**Layout:** Stacked horizontally below the SuperGrid (or in a collapsible bottom panel). Each slider spans the full width of the panel.

### 4.1 Location Slider

**Visual:** Miniature map strip with cluster indicators

**Controls:**
- **Cluster Selector:** Segmented control: Metro Area | State/Province | Country | Custom
- **Bounding Box:** Click-and-drag on the mini-map to draw a selection rectangle. Selected region highlights, cards outside the region dim in the SuperGrid.
- **Smart Geospatial Query Bar:** Text input accepting DSL queries like:
  - `within 50mi of Denver`
  - `in Colorado`  
  - `between San Francisco and Los Angeles`
- **Cluster Visualization:** Dots on the mini-map scaled by card count per location cluster. Color intensity reflects density.
- **Clear button** (✕) to reset location filter

### 4.2 Alphabet Slider

**Visual:** Excel-style column filter panel

**Controls:**
- **Property Selector:** Dropdown to choose which text property to filter (Name, Folder, Tags, etc.)
- **Filter Input:** Text field with live search/regex support
  - Standard text matching (contains, starts with, exact)
  - Toggle for regex mode (subtle /.*/ icon button)
- **Value List:** Scrollable checklist of all unique values for the selected property, with counts
  - Select All / Deselect All toggle
  - Search within the value list
- **Sort Toggle:** A→Z / Z→A / Count (most frequent first)
- **Clear button** (✕) to reset text filter

### 4.3 Time Slider

**Visual:** Rich, multilayered timeline control — the most complex slider.

**Layer 1 — Timeline Histogram (Background):**
- Adaptive, zoomable timeline showing card frequency per time unit
- Bar height = card count in that time bucket
- Time buckets adapt to zoom level: Year → Quarter → Month → Week → Day → Hour
- Color coding: darker bars = more cards
- Scrollable/pannable along the time axis

**Layer 2 — Range Selection Slider (Foreground):**
- Draggable left and right handles defining the active time range
- Semi-transparent highlight between handles shows selected range
- Handles snap to time bucket boundaries for precision
- Drag the center of the selection to slide the window without changing its width
- Double-click a histogram bar to snap the range to that single time bucket

**Layer 3 — Non-Contiguous Selection:**
- Additional range sliders can be added by ⌘-clicking outside the current selection
- Each additional range appears as a separate highlighted band
- Example: Select Q1 + Q3 (skipping Q2) with two separate range bands
- Small "+" button at the right edge to add another range band
- "×" button on each band to remove it

**Zoom Controls:**
- Pinch or scroll-zoom to change time granularity
- Zoom level indicator: "Month view" / "Week view" / "Day view"
- Zoom recenters on the current selection midpoint

**Smart Time Shortcuts:**
- Preset buttons below the slider: Today | This Week | This Month | This Quarter | This Year | All Time
- These set the range handles instantly

### 4.4 Category Slider

**Visual:** Faceted tag cloud with proportional representation

**Recommended Design:**

**Multi-Facet Selector Panel:**
- Horizontal strip divided into sub-sections, one per category property (Folder, Tags, Status, Note Type, etc.)
- Each sub-section shows its values as selectable chips/pills
- Chip size is proportional to card count for that value (larger chip = more cards)
- Click to toggle selection (multi-select)
- Selected chips are filled with the purple Category color; unselected are outlined
- Cross-category AND/OR toggle: when multiple categories have selections, toggle between "cards matching ALL selected" vs "cards matching ANY selected"

**Hierarchy within Category:**
- For hierarchical categories (e.g., Folder → Subfolder), show a collapsible tree within the sub-section
- Parent nodes show aggregate counts
- Selecting a parent auto-selects all children
- Partial selection (some children selected) shows a mixed-state indicator (◐) on the parent

**Visual Distribution Bar:**
- Below each sub-section, a horizontal stacked bar showing the proportional distribution of all values
- Hovering a segment highlights that value's cards in the SuperGrid
- Clicking a segment toggles that value's selection

### 4.5 Hierarchy Slider

**Visual:** Priority/ranking spectrum with continuous control

**Recommended Design:**

**Range Spectrum Slider:**
- Horizontal slider with the full range of the selected hierarchy property (e.g., Priority 1-5, Importance 0-100)
- Left handle = minimum value to show, right handle = maximum
- Background gradient from low (cool blue) to high (hot red)
- Tick marks at each discrete value with card counts below each tick
- Histogram bars above the slider showing distribution

**Hierarchy Property Selector:**
- Dropdown above the slider to choose which hierarchy facet to control (Priority, Importance, Sort Order)

**Threshold Mode:**
- Toggle between Range mode (show values between A and B) and Threshold mode (show values above/below X)
- In threshold mode, a single draggable line divides the spectrum

**Semantic Grouping:**
- Below the slider, show semantic labels if defined: "Critical | High | Medium | Low | None"
- These labels map to numeric ranges and are clickable to select that group
- Clicking "High" selects the range 4-5 (for a 1-5 priority scale)

**Weighted Composite:**
- Advanced toggle to combine multiple hierarchy facets into a composite score
- Example: 0.7×Priority + 0.3×Importance = Composite ranking
- Slider then shows the composite score distribution

---

## Component 5: Sparsity↔Density Slider

**Purpose:** The "Janus" control — a unified aggregation slider that controls semantic zoom across all LATCH dimensions simultaneously. This is a vertical slider (unique among the controls) because it represents a conceptual z-axis: up = density (aggregation), down = sparsity (granularity).

**Layout:** Vertical slider positioned at the right edge of the SuperGrid, spanning the full grid height.

### Visual Design
- Vertical track with draggable thumb
- Top label: "Dense" with icon (▦ or stacked squares)
- Bottom label: "Sparse" with icon (◻ or single square)  
- 4 notched positions along the track (can also be continuously dragged between notches):

| Position | Level | Name | Effect on SuperGrid |
|----------|-------|------|---------------------|
| Top | 4 | Region Density | Mixed sparse + dense regions coexist. Power user mode. |
| Upper | 3 | View Density | Matrix view: cards at intersections, one card per cell max. Aggregation rows visible. |
| Lower | 2 | Extent Density | Populated-only: hide empty rows/columns, grid compresses to show only occupied intersections. |
| Bottom | 1 | Value Sparsity | Full Cartesian product. Every possible row×column intersection shown. Empty cells visible. Maximum granularity. |

### Behavioral Details

**Sliding up (toward Dense):**
- Time headers collapse: Jan, Feb, Mar → Q1
- Category values merge: Capture, Backlog, TODO → "To Do"
- Empty intersections disappear
- Card counts aggregate: cell shows "12 cards" instead of individual cards
- Aggregation row/column appears at each collapsed boundary (like a spreadsheet SUM row)

**Sliding down (toward Sparse):**
- Collapsed headers expand back to leaf values
- Merged categories split to original granularity
- Empty intersections reappear
- Aggregation rows disappear
- Individual cards become visible

**Key guarantee:** Density changes are lossless. Sparse view shows full precision, dense view shows aggregated truth. The underlying data never changes.

### Multi-Stage Indicator
- The slider thumb shows the current density level number (1-4)
- The track shows subtle gradient from sparse (light) to dense (dark)
- Tick marks at each level with a tooltip on hover explaining what that level does
- Current effect previewed in real-time as the user drags (live update of SuperGrid)

### Axis-Specific Density (Advanced)
- Small expansion arrow on the slider opens a panel showing individual density controls per LATCH axis
- Each axis gets its own mini horizontal slider
- Example: Time at dense (Quarters), Category at sparse (all individual tags visible)
- The main vertical slider sets the global level; per-axis sliders override for fine control

---

## Visual Integration: Full Application Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Toolbar                                                   │ ••• │
├─────────────────────────────────────────────────────────────────┤
│ Navigator 1: LATCH×GRAPH Properties Filter                      │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌─────┐                      │
│ │ L  │ │ A  │ │ T  │ │ C  │ │ H  │ │GRAPH│                      │
│ │    │ │    │ │    │ │    │ │    │ │     │                      │
│ │☑ ──│ │☑ ──│ │☑ ──│ │☑ ──│ │☑ ──│ │☑ ───│                      │
│ │☐ ──│ │    │ │☑ ──│ │☑ ──│ │☐ ──│ │☐ ───│                      │
│ │    │ │    │ │☐ ──│ │☐ ──│ │    │ │     │                      │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └─────┘                      │
├─────────────────────────────────────────────────────────────────┤
│ Navigator 2: PAFV Projection                                    │
│ ┌─────────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐     │
│ │  Available  │ │ X Cols  │ │ Y Rows  │ │ Z Controls      │     │
│ │  ⠿ modified │ │ ⠿ folder│ │ ⠿priorty│ │ Display: Title ▾│     │
│ │  ⠿ tags     │ │         │ │         │ │ ☐ Audit View    │     │
│ │  ⠿ location │ │         │ │         │ │ Cards: Std ▾    │     │
│ │             │ │    ⇄    │ │         │ │ Agg: Count ▾    │     │
│ └─────────────┘ └─────────┘ └─────────┘ └─────────────────┘     │
├─────────────────────────────────────────────────────────┬───────┤
│                                                         │  ▦    │
│               SuperGrid                                 │Dense  │
│  ┌──────┬──────────────────────────────────────┐        │  │    │
│  │      │  Q1          │  Q2          │  Q3    │        │  ●    │
│  │      │ Jan│Feb│Mar  │ Apr│May│Jun  │ Jul│...│        │  │    │
│  ├──────┼────┼───┼─────┼────┼───┼─────┼────┼───┤        │  │    │
│  │ P1   │ ██ │ █ │     │ ██ │   │ █   │    │   │        │  │    │
│  │ P2   │    │ █ │ ██  │    │ █ │     │ ██ │   │        │  │    │
│  │ P3   │ █  │   │ █   │ █  │ ██│ █   │    │ █ │        │  │    │
│  └──────┴────┴───┴─────┴────┴───┴─────┴────┴───┘        │  │    │
│                                                         │Sparse │
│                                                         │  ◻    │
├─────────────────────────────────────────────────────────┴───────┤
│ LATCH Sliders                                                   │
│ 📍 Location  ┃ ═══○═════○═══════════════════════════ ┃ ✕        │
│ 🔤 Alphabet  ┃ [Search: ___________] [A→Z ▾] Values ┃ ✕       │
│ ⏱ Time       ┃ ▃▅▇▅▃▁▃▅▇█▇▅▃▅▇▅▃ [|══════|] +     ┃ ✕       │
│ 🏷 Category  ┃ ●Folder ●Tags ○Status  [AND/OR]      ┃ ✕       │
│ 📊 Hierarchy ┃ ═══○══════════════○═══ [1━━━5] Thresh ┃ ✕       │
└─────────────────────────────────────────────────────────────────┘
│ Command Bar  ┃ ⌘ [_________________________________] ┃         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Specifications

### Typography
- Chrome/labels: SF Mono or system monospace, 11px
- Property chip text: SF Pro Text or system sans, 13px  
- Header text: SF Pro Text, 13px, semibold
- Card content: SF Pro Text, 12px
- Section labels: SF Pro Text, 11px, uppercase tracking 0.5px, 60% opacity

### Color System (Dark Mode Primary)
- Background: #1E1E1E (panels), #252525 (chrome), #2D2D2D (wells)
- Text: #E0E0E0 (primary), #999 (secondary), #666 (disabled)
- Borders: #3A3A3A (subtle), #555 (active)
- Accent: #4A90D9 (selection blue)
- LATCH colors as specified in column header table above
- Chip selected state: column color at 15% opacity as background, column color as left border (3px)
- Chip hover: lighten background 5%

### Spacing
- Chip height: 28px
- Chip horizontal padding: 8px
- Column gap in LATCH Navigator: 4px
- Well padding: 8px
- Section gap between navigators: 1px (minimal — these are one continuous control surface)
- SuperGrid cell minimum: 40px × 28px
- Header cell padding: 6px 8px

### Interaction States
- Default: base styling
- Hover: subtle background lighten, cursor pointer
- Active/Selected: accent border + tinted background
- Dragging: elevated shadow, slight scale(1.02), ghost at original position
- Drop target valid: well border glows with accent color
- Drop target invalid: well border shows red
- Disabled: 40% opacity, no pointer events

### Responsive Behavior
- Below 1200px: LATCH Navigator columns stack 3+3 (two rows of 3)
- Below 900px: PAFV Navigator wells stack 2×2
- LATCH Sliders always full width, collapsible individually
- SuperGrid fills remaining vertical space (flex-grow)
