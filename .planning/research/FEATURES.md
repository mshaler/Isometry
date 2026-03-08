# Feature Landscape

**Domain:** Explorer/panel-based data projection UI (Workbench shell with collapsible explorers driving a dimensional grid)
**Researched:** 2026-03-08
**Confidence:** HIGH -- patterns well-established from Tableau, Power BI, Looker, VS Code, Figma; ARIA accordion spec is formal W3C; CSS Grid height animation is stable in Chromium/Firefox/Safari.

**Comparable products studied:** Tableau Desktop (shelves/pills), Power BI Desktop (field wells/buckets), Looker Explore (field picker/pivots), VS Code (panel stack/properties), Figma (inspector panel), Excel PivotTable (field list)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

### 1. Collapsible Panel Sections (CollapsibleSection)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Click header to expand/collapse | Every panel-based app (VS Code, Figma, Tableau) uses this as the primary interaction | Low | Single click toggles, no double-click needed |
| Arrow icon rotation on toggle | Visual affordance telling user "this is collapsible" and showing current state | Low | CSS rotate transform on chevron: 0deg=collapsed, 90deg=expanded (or down/right pattern) |
| Keyboard operable (Enter/Space) | WCAG 2.1 SC 2.1.1 -- all mouse actions must be keyboard-achievable; W3C ARIA accordion pattern requires it | Low | Header element with `role="button"`, `tabindex="0"`, Enter/Space event handlers |
| `aria-expanded` attribute | W3C APG accordion pattern -- screen readers must announce expanded/collapsed state | Low | Toggle `aria-expanded="true"/"false"` on header button element |
| `aria-controls` linking header to body | W3C APG accordion pattern -- assistive tech must know which content region the button controls | Low | `aria-controls="panel-{id}"` pointing to body element's `id` |
| Smooth height animation | Abrupt show/hide feels broken in 2026; every modern panel UI animates height | Med | Use CSS `grid-template-rows: 0fr` to `1fr` transition (Chrome 107+, Firefox 66+, Safari 16+). Fallback: instant toggle for older Safari. Do NOT use `max-height` hack (janky timing). See animation section below |
| Collapse state persistence across sessions | Tableau, VS Code, Figma all remember which panels were open. Losing layout on reload is disorienting | Low | Persist to StateManager (Tier 2) keyed by panel ID. Read on mount, write on toggle. Matches existing collapseState pattern in PAFVProvider |
| Multiple panels expandable simultaneously | VS Code sidebar behavior -- users need to see Properties and Projection at once while editing | Low | NOT mutual exclusion (accordion). Each section is independent. Spec confirms: "collapsible explorer sections" not "accordion" |
| CSS scoped under `.workbench-shell` | Prevent style bleed into SuperGrid's CSS Grid layout. Spec section 7.2 explicitly requires this | Low | No bare element selectors. All new CSS scoped to `.workbench-shell` or child classes |

**Animation implementation guidance:**

The CSS `grid-template-rows` technique is the correct approach for Isometry's browser targets (Safari 16+ / macOS 14+):

```css
.collapsible-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--transition-normal) ease;
  overflow: hidden;
}
.collapsible-body[data-expanded="true"] {
  grid-template-rows: 1fr;
}
.collapsible-body > .collapsible-inner {
  overflow: hidden;  /* Required for 0fr to actually collapse to 0 */
}
```

CSS `interpolate-size: allow-keywords` (height: 0 to height: auto) is Chromium-only as of March 2026 -- Safari and Firefox do not support it. Do not use it; the grid-template-rows approach has equivalent browser support to Isometry's existing targets.

**Dependency on existing architecture:** CollapsibleSection is a new DOM primitive with no provider dependency. It writes to StateManager for persistence (existing Tier 2 pattern). It is consumed by every explorer module.

### 2. Properties Explorer (PropertiesExplorer)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Grouped property list by LATCH axis | Tableau groups fields by table/folder; Power BI groups by table. Isometry groups by LATCH axis family (Location, Alphabet, Time, Category, Hierarchy) which is architecturally native | Med | 5 groups mapping to LATCH families + possible ungrouped. Data derived from `PAFVProvider` metadata and `ALLOWED_AXIS_FIELDS` allowlist -- 9 fields across LATCH categories |
| Toggle checkbox per property | Power BI field list has checkboxes; Tableau Data pane shows selected fields highlighted. Toggle controls whether a property is available in the Projection wells | Low | Checkbox input, fires `property:toggled` event. State drives what appears in ProjectionExplorer "available" well |
| Group collapse/expand with count badge | VS Code Explorer shows file counts on collapsed folders; Power BI shows field counts per table | Low | Reuse CollapsibleSection per LATCH group. Badge shows `enabled / total` count for the group |
| Inline display name editing | Power BI allows field rename in the model view. Inline edit avoids modal friction for a common customization | Med | Click-to-edit pattern: `<span>` swaps to `<input>` on click/Enter, blur/Enter confirms, Escape cancels. `property:renamed` event dispatched |
| Visual distinction between enabled/disabled properties | Must be obvious at a glance which properties are active. Dim disabled rows | Low | `opacity: 0.5` or `color: var(--text-muted)` on unchecked rows |
| Provider-derived property catalog | Spec section 5.2: "Property catalog must be derived from provider metadata -- not static mock data." Prevents definition duplication | Low | Read from `ALLOWED_AXIS_FIELDS` and PAFVProvider state. Single source of truth |

**LATCH grouping for Isometry's 9 allowlisted axis fields:**

| LATCH Axis | Fields | Count |
|------------|--------|-------|
| Location | (none currently in ALLOWED_AXIS_FIELDS) | 0 |
| Alphabet | name | 1 |
| Time | created_at, modified_at, due_at | 3 |
| Category | card_type, status, priority, sort_order | 4 |
| Hierarchy | folder | 1 |

**Events (typed, dispatched on the module's root element per spec section 5.2):**
```typescript
'property:toggled'     // detail: { propertyId: string; enabled: boolean }
'property:renamed'     // detail: { propertyId: string; name: string }
'axis:group-collapsed' // detail: { axis: 'L'|'A'|'T'|'C'|'H'; collapsed: boolean }
```

**Dependency on existing architecture:** Reads from `ALLOWED_AXIS_FIELDS` (src/providers/allowlist.ts). Writes to PAFVProvider via events consumed by WorkbenchShell. Does NOT directly call PAFVProvider -- event dispatch pattern per spec section 6. Constructor injection of provider references from WorkbenchShell.

### 3. Projection Explorer (ProjectionExplorer)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 4 wells: Available, X, Y, Z | Direct analog to Tableau's Rows/Columns/Marks shelves and Power BI's Axis/Values/Legend wells. This is the core interaction model for dimensional projection tools | Med | "Available" holds unassigned properties; X/Y wells map to PAFVProvider colAxes/rowAxes. Z-plane is the value/cell dimension |
| Drag-and-drop chips between wells | Tableau's entire UX is built on dragging pills between shelves. Power BI uses drag-from-field-list-to-wells. This is THE defining interaction for a data projection tool | High | HTML5 DnD with `dragstart`/`dragover`/`drop` events. Module singleton payload (matching SuperGrid's existing `dragPayload` pattern). No external DnD library |
| Reorder chips within a well | Tableau allows reordering pills on Rows/Columns shelf; Power BI allows reorder in wells. Order determines nesting depth in SuperGrid | Med | Insertion line indicator on dragover between existing chips. Drop reorders array, fires provider update |
| Visual feedback during drag | Dotted outline / insertion indicator showing where chip will land. Tableau shows "black dotted line indicates active areas where you can add headers" during drag | Med | CSS class on dragover target: `var(--drag-over-bg)` already exists in design tokens. Insertion line between chips during within-well reorder. Source chip dims (`opacity: 0.4`) during drag |
| Remove button (X) on well chips | Power BI shows X icon on each well entry. Tableau: right-click menu "Remove". Users need a way to unassign without dragging | Low | Small X button per chip in X/Y/Z wells. Clicking moves chip back to Available well |
| Minimum axis validation | X and Y wells must each have at least 1 property for SuperGrid to render. Empty projection = broken view | Low | Prevent removing last chip from X or Y well. Grey out remove button / reject drop that would empty X or Y. Spec section 5.3.1 explicitly requires this |
| Chip pill styling | Tableau uses colored pills (blue=discrete, green=continuous). Power BI shows field type icons. Pills are the visual vocabulary of projection tools | Low | Rounded rectangle chips with field name. Uses existing design tokens for styling |
| Z-plane controls (density, audit, aggregation) | Power BI's Values well has aggregation type dropdown per measure. Z-plane controls configure what appears in grid cells | Med | Density select wires to `DensityProvider.setDensity()`, audit toggle wires to existing AuditState, aggregation wires to `PAFVProvider.setAggregation()` -- maps to real SQL GROUP BY semantics (spec section 13, resolved decision 2) |
| ARIA listbox role on wells | W3C APG: reorderable lists should use `role="listbox"` / `role="option"`. Spec section 10 explicitly requires this | Low | `role="listbox"` on well containers, `role="option"` on chip elements |

**DnD contract (from spec section 5.3.1):**

```typescript
// Drag payload (set on dragstart, read on drop)
interface ProjectionDragPayload {
  propertyId: string;
  sourceWell: 'available' | 'x' | 'y' | 'z';
  sourceIndex: number;
}

// Drop target (resolved from drop event)
interface ProjectionDropTarget {
  targetWell: 'available' | 'x' | 'y' | 'z';
  targetIndex?: number;  // undefined = append
}
```

**Critical implementation constraint:** Spec section 5.3.1: "Do not extend SuperGridSelect.ts for projection DnD." These are independent DnD implementations that share only naming conventions (`data-drag-payload`, `data-drop-zone` dataset attributes). Implementation uses `dragstart`/`dragover`/`drop` native events with event delegation on each well container.

**State mapping to existing providers:**

| Well | Provider method | Effect |
|------|----------------|--------|
| X (columns) | `PAFVProvider.setColAxes(axes)` | Updates column grouping in SuperGrid |
| Y (rows) | `PAFVProvider.setRowAxes(axes)` | Updates row grouping in SuperGrid |
| Z (values) | Density + Aggregation controls | Updates cell content rendering |
| Available | No provider call | Purely UI state -- properties not assigned to any dimension |

**Dependency on existing architecture:** Reads/writes PAFVProvider (colAxes, rowAxes via existing setter methods), DensityProvider, AuditState. ALL changes flow through `StateCoordinator.scheduleUpdate()` (spec section 6). Constructor injection of provider references from WorkbenchShell.

### 4. Visual Explorer (SuperGrid Wrapper with Zoom Rail)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Vertical zoom slider alongside grid | Figma has zoom slider in bottom toolbar; Google Sheets has zoom slider in status bar; Power BI has zoom slider. Physical slider provides precise, discoverable zoom control beyond Ctrl+wheel | Med | Vertical `<input type="range">` oriented with CSS `writing-mode: vertical-lr` or `transform: rotate(-90deg)`. Wires to `SuperPositionProvider.zoomLevel` |
| Slider reflects current zoom level bidirectionally | When user Ctrl+wheels in SuperGrid, slider thumb must track. Bidirectional sync | Low | Read `SuperPositionProvider.zoomLevel` on each grid render cycle. Set slider value to match. Existing ZOOM_MIN=0.5, ZOOM_MAX=3.0, ZOOM_DEFAULT=1.0 |
| Zoom percentage label | "100%" next to slider so user knows exact level | Low | Computed from `zoomLevel * 100`, displayed as text label below/above slider |
| Reset-to-100% button | Figma has "Reset zoom" button; VS Code has zoom reset in status bar. Quick return to default | Low | Small button next to slider, dispatches `SuperPositionProvider.zoomLevel = 1.0` + `SuperZoom.applyZoom()`. Complement to existing Cmd+0 shortcut |
| fillRemaining layout | Visual Explorer must take ALL remaining vertical space after other panels. This is the main content area | Low | `flex: 1 1 auto` on the CollapsibleSection. Spec section 5.4 explicitly requires `fillRemaining: true` |
| SuperGrid unchanged in new mount point | SuperGrid must render identically after being re-parented from `#app` to `.workbench-view-content`. Sticky headers, CSS Grid, virtual scrolling must all work | Low | `.workbench-view-content` container must have `overflow: hidden` and defined height via flex (spec section 4.1.1 guard) |

**Slider step increment:** Step of 0.1 (10% increments) gives 26 discrete levels from 0.5x to 3.0x. Fine enough for precision, coarse enough for quick adjustment. Matches the granularity of Ctrl+Wheel zoom in SuperZoom.

**Dependency on existing architecture:** Wraps SuperGrid (unchanged). Reads/writes SuperPositionProvider (existing, Tier 3 ephemeral). SuperZoom already handles Ctrl+Wheel zoom; slider is an additional input mechanism for the same state.

### 5. CommandBar

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| App icon/logo on left | Every toolbar-based app has an app identity anchor | Low | SVG icon or text mark in left position |
| Command input field | Spec section 4.3: "Command input (placeholder `Command palette...`)." Click focuses existing CommandPalette (Cmd+K) | Low | Click/focus triggers CommandPalette open. NOT a new search implementation -- reuses existing Cmd+K infrastructure from v4.4 Phase 51 |
| Settings trigger on right | Access to preferences, theme toggle, about | Low | Button that opens a dropdown or triggers existing settings flow |
| Horizontal layout, compact height | Must not consume vertical space needed by explorers and grid | Low | ~40px compact bar. Flex row layout |
| Menu keyboard navigation | Spec section 10: "ArrowDown + Escape for command/settings menus" | Low | Standard menu keyboard pattern |
| ARIA roles on menus | Spec section 10: `role="menu"` / `role="menuitem"` for menus | Low | Standard ARIA menu pattern |

**Dependency on existing architecture:** Triggers existing CommandPalette (shipped in v4.4 Phase 51). Triggers existing ShortcutRegistry. Does NOT introduce new search or command infrastructure.

### 6. LATCH Explorers (Phase A Skeleton)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One collapsible section per LATCH axis | Consistent with Properties Explorer grouping. Each axis gets its own filter control surface | Med | 5 sections: Location, Alphabet, Time, Category, Hierarchy. Each wraps CollapsibleSection |
| Filter controls wired to FilterProvider | Filters must actually work, not just render. Wiring to existing FilterProvider ensures consistency with SuperFilter dropdowns and CommandPalette filter actions | Med | Each section exposes controls appropriate to its type: dropdowns for category/status, date range for time, text input for alphabet. ALL mutations go through `FilterProvider.addFilter()` then `StateCoordinator.scheduleUpdate()` |
| "Active filter" indicator on collapsed headers | When a LATCH axis has active filters, collapsed header should show visual indicator | Low | Read `FilterProvider.getFilters()`, count filters per axis, show badge count |
| Clear filters per axis | "Clear" button within each LATCH section to remove only that axis's filters | Low | Remove filters matching the axis field, then `StateCoordinator.scheduleUpdate()` |

**Phase A scope boundary:** Skeleton + basic filter wiring only. Phase B (deferred) adds histogram scrubber for time, category chips with counts, hierarchy tree band. Spec section 5.5 and PROJECT.md Out of Scope both confirm Phase B is future polish.

**Dependency on existing architecture:** Reads/writes FilterProvider (existing `addFilter()`/`removeFilter()`/`getFilters()` API). ALL changes through `StateCoordinator.scheduleUpdate()`. Constructor injection from WorkbenchShell.

### 7. Notebook Explorer v1 (NotebookExplorer)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Textarea for Markdown input | Simplest possible editor -- no contenteditable complexity, no formatting toolbar, no WYSIWYG. Plain `<textarea>` is the v1 decision (spec section 5.1) | Low | Standard `<textarea>` element with monospace font |
| Sanitized HTML preview | Users must see rendered Markdown to validate their formatting. XSS prevention is non-negotiable for innerHTML | Med | `marked.parse(content)` + `DOMPurify.sanitize(html)`. Two new dependencies (~20KB combined gzipped). Spec section 5.1: "Use an existing or minimal sanitizer dependency; do not roll a custom one" |
| Side-by-side or stacked layout | Standard split-pane Markdown editor pattern (GitHub, StackEdit, IntelliJ). Side-by-side on wide screens, stacked on narrow | Low | CSS flexbox with `flex-wrap: wrap`. Each pane `min-width: 200px; flex: 1 1 50%`. Wraps to stacked when container is narrow |
| Session-only persistence | Spec section 5.1 resolved decision: "Session-only in v1. No writes to IsometryDatabase." Content lives in component state only | Low | In-memory string state. Lost on page reload. Intentional -- persistence deferred until native actor migration is complete |
| Debounced preview update | Typing in textarea should update preview without lag, but parsing on every keystroke is wasteful for long documents | Low | 150-200ms debounce on input event before running `marked.parse()` |
| D3 chart preview stub | Spec section 5.1: "reserved `<div class="notebook-chart-preview">` container, no chart rendering until Phase 4 polish" | Low | Empty div placeholder only. No chart rendering in v1 |

**v1 scope boundary (spec section 5.1):** No formatting toolbar, no D3 chart block rendering, no persistence to database. All explicitly deferred to Phase B polish.

**Dependency on existing architecture:** No provider dependencies. Pure UI component. New dependencies: `marked` (Markdown parser, ~30KB) and `DOMPurify` (sanitizer, ~15KB). Both well-established and actively maintained.

---

## Differentiators

Features that set the product apart. Not expected, but valued by power users.

### Collapsible Panel Sections

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Double-click header to "solo" panel | Figma pattern: double-click expands one panel and collapses all others. Fast way to focus | Low | Double-click handler collapses all siblings, expands target |
| Panel overflow scroll indicator | Subtle gradient fade at bottom of scrollable panel content indicating more content below | Low | CSS `mask-image: linear-gradient(...)` on panel body when scrollHeight > clientHeight |

### Properties Explorer

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tri-state group checkbox | Parent checkbox for each LATCH group: checked (all enabled), unchecked (none), indeterminate (some). Power BI and Windows installer pattern | Low | `checkbox.indeterminate = true` when partial selection within group |

### Projection Explorer

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Chip color coding by LATCH family | Tableau colors pills blue (discrete) vs green (continuous). Isometry colors by LATCH category, making the dimensional model visible | Low | 5 background tint colors from design tokens, one per LATCH axis family |
| Animated chip transitions on drop | FLIP animation when chip moves between wells -- smooth positional transition rather than instant teleport | Med | Uses Web Animations API (WAAPI) matching existing FLIP pattern from SuperGrid column reorder (v3.1). 200ms ease-out |
| Quick-assign via double-click | Double-click chip in Available to auto-assign to first well with room (X, then Y, then Z). Faster than drag for simple assignments | Low | Double-click handler checks wells in order, adds to first non-full well |
| Aggregation function per Z-field | Power BI allows COUNT/SUM/AVG per measure in the Values well. Expose aggregation type picker | Med | Dropdown on Z-well chips: Count, Sum, Average, Min, Max. Maps to `PAFVProvider.setAggregation()` |

### Visual Explorer

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zoom slider snap-to-100% | When dragging slider near 1.0x, it snaps to exactly 100%. Prevents accidental 98% or 102% zoom | Low | Detect proximity to 1.0 (within 0.05) during input event, snap slider value |
| Zoom presets | "50%", "100%", "200%" as quick-select buttons alongside slider | Low | 3 preset buttons above slider |

### Notebook Explorer

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Synchronized scroll | When scrolling editor, preview follows to same approximate position. IntelliJ, VS Code Markdown preview do this | Med | Map editor scroll percentage to preview scroll percentage |
| Toggle between split and preview-only modes | Some users want full-width preview. Tab or button to toggle modes | Low | Three mode buttons in notebook header. CSS class toggles flex basis |

### CommandBar

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Breadcrumb showing current projection state | "Category > Status | Folder" showing current X/Y axis assignments. At-a-glance context | Med | Read PAFVProvider.getState() colAxes/rowAxes, render as breadcrumb chips |
| Active filter badge count | Show "3 filters" badge when filters are active. Quick visibility into filter state | Low | Read FilterProvider.getFilters().length, show badge when > 0 |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| React/Tailwind/shadcn runtime dependencies | PROJECT.md Out of Scope: "React/Tailwind/shadcn runtime dependencies for Workbench UI -- pure TypeScript + D3/DOM per spec." Spec section 3 explicitly removes all React artifacts | Plain TypeScript + D3 `selection.join()` + native DOM events + CSS custom properties |
| Mutual-exclusion accordion behavior | VS Code, Figma, and Tableau all allow multiple panels open simultaneously. Accordion forces single-open which makes cross-panel comparison impossible | Independent CollapsibleSection instances. Each toggles independently |
| External DnD library (react-dnd, dnd-kit, SortableJS) | Spec section 5.3.1: "Do not import an external DnD library." Native HTML5 DnD with event delegation matches existing SuperGrid patterns | `dragstart`/`dragover`/`drop` native events with `data-drag-payload` / `data-drop-zone` dataset attributes |
| Notebook formatting toolbar in v1 | Spec section 5.1 defers toolbar to Phase B polish. Adding it in v1 expands scope significantly (bold/italic/heading buttons, selection handling, cursor position management) | Plain textarea. Users who know Markdown type directly. Toolbar comes in Phase B |
| D3 chart blocks in notebook v1 | Spec section 5.1: "stub only in v1 -- reserved div, no chart rendering." Chart blocks require defining a schema, parsing chart directives from Markdown, rendering D3 visualizations | Reserved `<div class="notebook-chart-preview">` placeholder only |
| Notebook persistence to database | Spec section 13 resolved decision: "Session-only in v1. No writes to IsometryDatabase." Adding persistence creates a second write path competing with future native actor migration | In-memory state only. Lost on reload |
| Drag-to-resize between all explorer panels | Adds significant complexity (resize handles, min/max height constraints, layout recalculation, persistence). VS Code does this but has years of iteration | Fixed proportional layout. CollapsibleSection expand/collapse is the space management mechanism |
| Properties Explorer "Select All" / "Deselect All" toggle | With only 9 axis fields, bulk toggle saves negligible time. Adds edge case complexity (what happens to wells when all properties are deselected?) | Per-property toggle is sufficient for 9 fields |
| Minimap in zoom rail | High complexity for a feature benefiting only massive grids. SuperGrid already has virtual scrolling for 10K+ rows. Minimap adds a rendering pipeline for a tiny preview | Zoom slider + percentage label + reset button provide adequate zoom control |
| Secondary visualization in Visual Explorer | Spec section 5.4 and PROJECT.md Out of Scope both explicitly exclude this | SuperGrid only. Other views remain accessible via ViewManager/CommandPalette |
| LATCH Phase B subpanes in v5.0 | Histogram scrubber, category chips with counts, hierarchy tree band. Spec section 5.5 and PROJECT.md both defer to future polish | Phase A skeleton with basic filter controls is the v5.0 scope |
| New providers or bridge message types | Workbench is a UI shell, not a data layer change. All explorers use existing provider APIs | Existing PAFVProvider, FilterProvider, DensityProvider, StateCoordinator |
| Explorer directly calling SuperGrid APIs | Architectural violation -- creates tight coupling, bypasses provider/coordinator pattern | All changes route through providers + `StateCoordinator.scheduleUpdate()` (spec section 6) |
| Shared DnD implementation between Explorer and SuperGrid | Two DnD systems have different payloads and targets (chip-well vs axis-reorder) | Independent implementations, shared naming convention only (spec section 5.3.1) |
| Bare element CSS selectors in new stylesheets | Spec section 7.2: "No bare element selectors (e.g., `div`, `button`, `input`) at the top level" | All selectors scoped under `.workbench-shell` or child class |
| `* { box-sizing: border-box }` in new CSS | Spec section 7.2: "SuperGrid relies on the current box model" | Scope to `.workbench-shell *` if needed |

---

## Feature Dependencies

```
CollapsibleSection (new primitive)
  |
  +---> PropertiesExplorer (uses CollapsibleSection per LATCH group)
  |       |
  |       +---> ProjectionExplorer (Available well populated from enabled properties)
  |               |
  |               +---> PAFVProvider.setColAxes() / .setRowAxes()
  |               |       |
  |               |       +---> StateCoordinator.scheduleUpdate()
  |               |               |
  |               |               +---> SuperGrid re-renders (existing flow)
  |               |
  |               +---> DensityProvider / AuditState (Z-plane controls)
  |
  +---> LatchExplorers (uses CollapsibleSection per LATCH axis)
  |       |
  |       +---> FilterProvider.addFilter() / .removeFilter()
  |               |
  |               +---> StateCoordinator.scheduleUpdate()
  |
  +---> NotebookExplorer (uses CollapsibleSection as container)
  |       |
  |       +---> marked + DOMPurify (new dependencies, no provider wiring)
  |
  +---> Visual Explorer (uses CollapsibleSection with fillRemaining)
          |
          +---> SuperPositionProvider.zoomLevel (zoom rail slider)
          |
          +---> SuperGrid (mounted unchanged inside .workbench-view-content)

WorkbenchShell (new orchestrator)
  |
  +---> CommandBar (reuses existing CommandPalette + ShortcutRegistry)
  |
  +---> Panel Rail (stacks all explorers in collapsible sections)
  |
  +---> View Content Host (passed to ViewManager.mount())

main.ts (composition root)
  |
  +---> WorkbenchShell (replaces direct ViewManager mount on #app)
  |
  +---> ViewManager.mount(shell.getViewContentEl())  // new mount point
```

**Critical dependency chain:**
1. CollapsibleSection MUST ship first -- every explorer depends on it
2. WorkbenchShell + CommandBar MUST ship alongside CollapsibleSection -- they create the DOM hierarchy that ViewManager mounts into
3. PropertiesExplorer SHOULD ship before ProjectionExplorer -- Properties defines what's "available" for Projection wells
4. Visual Explorer MUST ship with or before Projection Explorer -- users need to see the grid respond to projection changes
5. LatchExplorers and NotebookExplorer are independent of each other and of Projection -- can ship in any order

**Critical regression gate:** After WorkbenchShell changes the ViewManager mount point from `#app` to `.workbench-view-content`, ALL existing SuperGrid tests must remain green. SuperGrid's CSS Grid layout depends on specific container constraints (`overflow: hidden`, defined height via flex). Spec section 11 Phase 1 gate: "Verify SuperGrid renders identically in new mount point before Phase 2."

---

## MVP Recommendation

Prioritize based on the spec's 4-phase rollout (section 11):

**Phase 1: Shell Scaffolding (Low Risk)**
1. WorkbenchShell -- DOM hierarchy creation, panel rail, view content host
2. CollapsibleSection -- reusable primitive with animation, keyboard, ARIA, persistence
3. CommandBar -- app icon, command input trigger, settings button
4. ViewManager mount point change -- `.workbench-view-content` instead of `#app`
5. **Gate:** SuperGrid renders identically in new mount point

**Phase 2: Properties + Projection Explorers**
1. PropertiesExplorer -- LATCH-grouped property list with toggle checkboxes, inline name editing, count badges
2. ProjectionExplorer -- 4 wells with DnD chip assignment, reorder within wells, Z-plane controls
3. Provider wiring through StateCoordinator.scheduleUpdate()
4. Unit tests for move/reorder/toggle flows
5. **Gate:** All existing SuperGrid tests remain green

**Phase 3: Visual + LATCH Explorers**
1. Visual Explorer -- zoom rail slider wrapping SuperGrid
2. LatchExplorers Phase A -- skeleton sections with filter controls wired to FilterProvider
3. **Gate:** No regression in SuperGrid performance benchmarks

**Phase 4: Notebook + Polish**
1. NotebookExplorer v1 -- textarea + sanitized Markdown preview (add `marked` + `DOMPurify` deps)
2. Final spacing/typography polish
3. Keyboard accessibility pass across all explorers
4. **Gate:** All new UI components have tests, Biome lint clean

**Defer to future polish:**
- Drag-to-resize panel heights (med complexity, low urgency)
- Notebook formatting toolbar (explicitly deferred per spec)
- D3 chart blocks in notebook (explicitly deferred per spec)
- Notebook persistence to database (explicitly deferred per spec)
- LATCH Phase B subpanes (explicitly deferred per spec)
- Minimap in zoom rail (high complexity, low value)
- FLIP animations on chip transitions (nice-to-have, not blocking)

---

## Implementation Patterns from Comparable Tools

### Tableau: The Shelf/Pill Model

Tableau's entire interaction model is drag-pill-to-shelf. Key UX details:
- **Discrete fields (blue pills)** create headers; **continuous fields (green pills)** create axes
- Dragging a field to Rows/Columns shelf immediately restructures the visualization
- "While dragging fields, you can hover over the different areas in the view to see how the field will be incorporated" -- live preview of where the field will land
- Fields can be dragged from one shelf to another (move, not copy)
- Shift+drag to the Marks Color property ADDS without replacing existing
- Remove by dragging off the shelf or via right-click > "Remove"

**Isometry analog:** Available -> X/Y/Z wells. Fields are LATCH properties (all discrete in current schema). Moving between wells is analogous to changing shelf assignment. X=Columns, Y=Rows is the direct mapping.

### Power BI: The Field Well Model

Power BI's Visualizations pane has wells that change based on visualization type:
- Column chart: Axis, Legend, Values, Tooltips
- Matrix: Rows, Columns, Values

Key UX details:
- "When you select a field or drag it onto the canvas, Power BI adds that field to one of the buckets" -- auto-assignment based on field type
- Each well entry has a dropdown for aggregation type (Count, Sum, Average, etc.)
- X icon to remove a field from a well
- Reordering within wells changes visual structure

**Isometry analog:** Simpler than Power BI because Isometry has a fixed well structure (Available/X/Y/Z) rather than visualization-dependent wells. Z-plane controls (density, audit, aggregation) map to Power BI's per-field aggregation dropdowns.

### Looker: The Field Picker Model

Looker's Explore uses a sidebar field picker with click-to-add:
- Fields listed in expandable sections by "view" (table)
- Click to add/remove from query (toggled highlight)
- Separate sections for Dimensions and Measures
- Pivoted dimensions move to a separate group when pivoted
- Drag-and-drop for column reorder in the data table

**Isometry analog:** PropertiesExplorer is closest to Looker's field picker. Toggle checkboxes map to Looker's click-to-add. LATCH grouping maps to Looker's view-based grouping.

### W3C ARIA Accordion/Disclosure Pattern

The authoritative specification for collapsible panels:
- Header MUST be a button or element with `role="button"`
- `aria-expanded` MUST be present and toggled dynamically
- `aria-controls` SHOULD reference the controlled panel's `id`
- Keyboard: Enter/Space to toggle. Optional: Arrow keys between headers, Home/End
- NOT required: `role="region"` on panels (recommended only when 6 or fewer panels visible simultaneously -- Isometry has 5-7 panels, borderline)

### Enterprise Data Table Patterns

From Pencil & Paper's enterprise data table analysis:
- **Display density controls**: 3 preset levels (condensed/regular/relaxed) via icon switcher. Isometry already has 4-level density (DensityProvider)
- **Column visibility toggles**: Dropdown controls on column headers for hide/show. Isometry's PropertiesExplorer serves this role
- **Sticky headers**: Mandatory for vertical scrolling. Isometry already has this via SuperGrid CSS Grid sticky positioning
- **Contextual toolbars**: Appear on selection, not permanently. Isometry follows this with CommandPalette and context menus

---

## Sources

### Collapsible Panels and ARIA
- [W3C ARIA Authoring Practices -- Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- [Harvard Digital Accessibility -- Expandable Sections Technique](https://accessibility.huit.harvard.edu/technique-expandable-sections)
- [The A11Y Collective -- Accessible Accordion Components](https://www.a11y-collective.com/blog/accessible-accordion/)
- [The A11Y Collective -- Practical Guide to aria-expanded](https://www.a11y-collective.com/blog/aria-expanded/)
- [CSS-Tricks -- CSS Grid Can Do Auto Height Transitions](https://css-tricks.com/css-grid-can-do-auto-height-transitions/)
- [Stefan Judis -- How to Animate Height with CSS Grid](https://www.stefanjudis.com/snippets/how-to-animate-height-with-css-grid/)
- [Chrome Developers -- Animate to height: auto with interpolate-size](https://developer.chrome.com/docs/css-ui/animate-to-height-auto) (Chromium-only; documented for awareness, not recommended)
- [Welie.com -- Collapsible Panels Pattern](http://www.welie.com/patterns/showPattern.php?patternID=collapsible-panels)

### Projection / Field Well UX
- [Tableau -- Shelves and Cards Reference](https://help.tableau.com/current/pro/desktop/en-us/buildmanual_shelves.htm)
- [Tableau -- Start Building a Visualization by Dragging Fields](https://help.tableau.com/current/pro/desktop/en-us/buildmanual_dragging.htm)
- [Tableau Terminology 101 -- Pills, Shelves, Dashboards (InterWorks)](https://interworks.com/blog/skennedy/2014/05/01/tableau-terminology-101-pills-shelves-and-dashboards-oh-my/)
- [Microsoft Learn -- Add Visualizations to a Power BI Report](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-report-add-visualizations-ii)
- [TheBricks -- What is a Field Well in Power BI?](https://www.thebricks.com/resources/guide-what-is-field-well-in-power-bi)
- [Google Cloud -- Creating and Editing Explores in Looker](https://docs.cloud.google.com/looker/docs/creating-and-editing-explores)

### Data Table / Grid UX
- [Pencil and Paper -- UX Pattern Analysis: Enterprise Data Tables](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- [Smashing Magazine -- Cognitive-Friendly UX Design Through Pivot Tables and Grids](https://www.smashingmagazine.com/2023/06/universal-cognitive-friendly-ux-design-tables-grids/)
- [W3C APG -- Grid (Interactive Tabular Data) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Pencil and Paper -- Drag and Drop UX Design Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-drag-and-drop)

### Markdown Editor Preview
- [SitePoint -- Build a Markdown Previewer with Vanilla JavaScript](https://www.sitepoint.com/build-real-time-markdown-previewer-vanilla-javascript/)
- [Zuunote -- How to Build a Markdown Editor with Real-Time Editing](https://zuunote.com/blog/how-to-build-a-markdown-editor-with-real-time-editing/)
- [marked.js Documentation](https://marked.js.org/)
- [GitHub -- safe-marked (marked + DOMPurify wrapper)](https://github.com/azu/safe-marked)

### Native HTML5 DnD
- [Medium -- HTML5 Drag and Drop Sortable List](https://medium.com/@tarasbobak/html5-drag-and-drop-sortable-list-8776f0d9941c)
- [Eleken -- Drag and Drop UI Examples and UX Tips from SaaS Products](https://www.eleken.co/blog-posts/drag-and-drop-ui)
- [Taha Shashtari -- Building a Seamless Drag-to-Reorder Widget with Vanilla JavaScript](https://tahazsh.com/blog/seamless-ui-with-js-drag-to-reorder-example/)
