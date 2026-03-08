# Phase 56: Visual + LATCH Explorers - Research

**Researched:** 2026-03-08
**Domain:** DOM layout, HTML range input, FilterProvider wiring, CSS flex layout
**Confidence:** HIGH

## Summary

Phase 56 adds two new explorer modules to the workbench: a **VisualExplorer** that wraps SuperGrid with a vertical zoom slider rail, and **LatchExplorers** that populates the existing LATCH collapsible section with per-axis filter controls wired to FilterProvider. Both modules follow the established mount/update/destroy lifecycle pattern used by PropertiesExplorer and ProjectionExplorer (Phase 55).

The Visual Explorer is primarily a layout refactoring task: the existing `workbench-view-content` div must become a horizontal flex container holding the zoom rail and the SuperGrid scroll area, with the zoom rail only visible when SuperGrid is the active view. The zoom slider wires bidirectionally to SuperPositionProvider.zoomLevel and SuperZoom.applyZoom() -- both APIs already exist and are well-tested. The LATCH explorers are a straightforward data-driven UI: 5 sub-collapsible sections (one per LATCH family) with filter controls that call FilterProvider.setAxisFilter() for checkbox lists, FilterProvider.addFilter() for time ranges, and FilterProvider.addFilter() with 'contains' operator for text search.

**Primary recommendation:** Build VisualExplorer as a thin DOM wrapper that replaces workbench-view-content, handles zoom rail rendering and ViewManager integration. Build LatchExplorers as a separate module that mounts into the existing LATCH CollapsibleSection body. Both follow the same constructor-injection + lifecycle pattern as existing explorers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Continuous slider (not stepped) -- smooth analog feel matching existing wheel zoom behavior
- Percentage label visible near the slider, updating in real time during drag (e.g., "150%")
- Clicking the percentage label resets zoom to 100% (mirrors existing Cmd+0 shortcut)
- Small min/max labels at rail ends: "50%" at bottom, "300%" at top
- Arrow keys nudge zoom when slider is focused (standard slider a11y pattern)
- Subtle tick mark on the rail at the 1.0x baseline position for orientation
- Narrow rail width (~24-32px including padding) to minimize SuperGrid space impact
- Zoom rail sits outside the scrollable SuperGrid area, to its left -- always visible regardless of horizontal scroll
- Collapsing the Visual Explorer section hides both zoom rail and SuperGrid together
- Visual Explorer replaces the current `view-content` div as the flex:1 bottom container -- no extra nesting; contains horizontal flex row: [zoom rail | SuperGrid scroll area]
- Zoom rail only visible when SuperGrid is the active view -- hidden for Network, Tree, Timeline, and other views
- Category fields (folder, status, card_type): multi-select checkbox lists showing all distinct values -- maps to FilterProvider.setAxisFilter() IN clause
- Time fields (created_at, modified_at, due_at): preset range buttons (Today, This Week, This Month, This Year, Custom) -- maps to FilterProvider gte/lte operators
- Alphabet (name): text search input using FilterProvider 'contains' operator -- complements existing FTS in CommandBar
- Hierarchy (priority, sort_order): checkbox lists like Category
- Location: empty state placeholder ("No location properties available") since location fields are FilterField-only, not AxisFields
- Each LATCH axis (L, A, T, C, H) is its own sub-collapsible section inside the LATCH panel -- reuses CollapsibleSection or lighter variant
- Active filter count badge per axis header (e.g., "Category (2)") -- uses FilterProvider.getAxisFilter() to compute; badge hidden when no filters active
- Collapse state persisted to localStorage with keys like `workbench:latch-L`, `workbench:latch-A`, etc. -- matches existing CollapsibleSection pattern
- Conditional "Clear all" link/button at top of LATCH panel -- only visible when at least one axis filter is active; calls FilterProvider.clearAllAxisFilters()

### Claude's Discretion
- Exact slider thumb styling and colors (respecting design tokens)
- How preset time ranges compute their date boundaries
- Whether text search input debounces or fires on each keystroke
- How checkbox list values are fetched (SQL DISTINCT query vs provider cache)
- Internal DOM structure details for the Visual Explorer flex row

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VISL-01 | Visual Explorer wraps existing SuperGrid with left vertical zoom rail slider | Layout pattern: horizontal flex container replaces workbench-view-content; HTML `<input type="range">` with orient="vertical" or CSS rotation; SuperZoom/SuperPositionProvider already provide all zoom APIs |
| VISL-02 | Zoom slider wired bidirectionally to SuperPositionProvider.zoomLevel | SuperPositionProvider has zoomLevel getter/setter clamped to [0.5, 3.0]; SuperZoom.applyZoom() sets CSS custom properties; onZoomChange callback in SuperZoom constructor enables slider-to-grid sync; slider input event enables grid-to-slider sync |
| VISL-03 | Visual Explorer section uses fillRemaining (flex: 1 1 auto) for available vertical space | Existing workbench-view-content already has `flex: 1 1 auto; min-height: 0` -- Visual Explorer inherits these properties; SuperGrid root sets height:100% + overflow:auto which works inside flex child |
| LTCH-01 | LatchExplorers renders collapsible sections for each LATCH axis (Location, Alphabet, Time, Category, Hierarchy) | LATCH_ORDER, LATCH_LABELS, LATCH_COLORS constants provide family ordering and display info; CollapsibleSection pattern (or lightweight inline variant) handles collapse/expand with localStorage persistence |
| LTCH-02 | Filter controls wired to existing FilterProvider -- no parallel filter stack | FilterProvider.setAxisFilter(field, values) for checkbox IN-clause filters; FilterProvider.addFilter({field, operator, value}) for time range (gte/lte) and text search (contains); FilterProvider.clearAllAxisFilters() for bulk clear; subscribe() for reactive badge updates |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 | Language | Project standard -- strict mode |
| D3.js | 7.9 | DOM rendering | selection.join for checkbox lists (INTG-03) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SuperPositionProvider | n/a | Zoom state | Already exists -- zoomLevel getter/setter clamped [0.5, 3.0] |
| SuperZoom | n/a | Zoom application | Already exists -- applyZoom() sets CSS custom properties |
| FilterProvider | n/a | Filter state + SQL compilation | Already exists -- setAxisFilter(), addFilter(), compile() |
| CollapsibleSection | n/a | Collapse/expand primitive | Already exists -- reuse for LATCH sub-sections |
| LATCH constants | n/a | Family classification | LATCH_ORDER, LATCH_LABELS, LATCH_COLORS, LATCH_FAMILIES |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML `<input type="range">` | Custom div + drag handler | Range input provides free keyboard a11y (arrow keys), ARIA support, and focus management -- custom slider would need all of that hand-built |
| D3 selection.join for checkbox lists | Plain DOM loops | D3 join handles enter/update/exit automatically for dynamic value lists -- consistent with INTG-03 pattern |
| Lightweight inline collapse | Full CollapsibleSection instances | CollapsibleSection has the exact API needed (mount, setCount, getCollapsed, localStorage persistence) -- no reason to build a lighter variant |

## Architecture Patterns

### Recommended Project Structure
```
src/
  ui/
    VisualExplorer.ts     # Zoom rail + SuperGrid wrapper
    LatchExplorers.ts     # LATCH axis filter sections
  styles/
    visual-explorer.css   # Zoom rail + layout styles
    latch-explorers.css   # LATCH filter control styles
```

### Pattern 1: Visual Explorer as Layout Wrapper
**What:** VisualExplorer creates a horizontal flex row containing [zoom rail | view content area]. It replaces `workbench-view-content` as the flex:1 bottom container in WorkbenchShell.
**When to use:** When a view needs companion UI that stays fixed alongside a scrollable content area.

```typescript
// VisualExplorer creates this DOM structure:
// .visual-explorer (flex: 1 1 auto; display: flex; flex-direction: row)
//   .visual-explorer__zoom-rail (flex-shrink: 0; width: 28px)
//     input[type="range"] (vertical orientation)
//     span.zoom-label ("150%")
//   .visual-explorer__content (flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden)
//     [ViewManager mounts views here]
```

**Integration with WorkbenchShell:**
- WorkbenchShell replaces `_viewContentEl` (class `workbench-view-content`) with VisualExplorer's root element
- VisualExplorer.getContentEl() returns the inner `.visual-explorer__content` element
- ViewManager receives this inner element as its container -- no ViewManager changes needed
- WorkbenchShell.getViewContentEl() returns the inner content element (not the outer wrapper)

### Pattern 2: Zoom Rail Visibility Toggle
**What:** Zoom rail shown only when SuperGrid is the active view, hidden for all other views.
**When to use:** When companion UI is view-type-specific.

```typescript
// In main.ts, wire ViewManager.onViewSwitch to toggle zoom rail:
viewManager.onViewSwitch = (viewType) => {
  viewTabBar.setActive(viewType);
  visualExplorer.setZoomRailVisible(viewType === 'supergrid');
};
```

### Pattern 3: Bidirectional Zoom Sync
**What:** Slider updates SuperPositionProvider and SuperGrid, wheel zoom updates slider position.
**When to use:** When two UI controls manage the same state.

```typescript
// Slider -> Grid:
slider.addEventListener('input', () => {
  positionProvider.zoomLevel = parseFloat(slider.value);
  superZoom.applyZoom();
  updateLabel();
});

// Grid -> Slider (via SuperZoom onZoomChange callback):
// SuperZoom constructor already accepts onZoomChange callback.
// The VisualExplorer passes a callback that updates the slider:
const zoom = new SuperZoom(positionProvider, (newZoom) => {
  slider.value = String(newZoom);
  updateLabel();
});
```

**Critical insight:** SuperZoom is constructed inside the SuperGrid factory in main.ts. The onZoomChange callback is the hook for slider synchronization. However, since SuperGrid creates its own SuperZoom internally, the VisualExplorer needs a different approach: **subscribe to SuperPositionProvider** changes by polling or use a lightweight wrapper. Since SuperPositionProvider is NOT a subscribable provider (no subscribe/notify -- it's Tier 3 ephemeral), the approach is:

- **SuperZoom already fires onZoomChange** on every wheel zoom event
- SuperGrid's constructor could accept an onZoomChange callback and pass it to SuperZoom
- OR: VisualExplorer can set a listener on the SuperGrid root element for a custom 'zoom' event
- OR: The simplest approach -- add a lightweight `onZoomChange` callback to SuperPositionProvider

**Recommended:** Add a simple callback setter to SuperPositionProvider (not full pub/sub, just one callback slot) so VisualExplorer can react to zoom changes from any source (wheel, Cmd+0, programmatic). This avoids coupling VisualExplorer to SuperGrid internals.

### Pattern 4: LATCH Filter Controls via D3 Join
**What:** Checkbox lists for Category/Hierarchy fields rendered with D3 selection.join, data fetched via WorkerBridge SQL DISTINCT query.
**When to use:** When rendering dynamic-length lists that change based on imported data.

```typescript
// Fetch distinct values for a field:
const result = await bridge.send('db:query', {
  sql: `SELECT DISTINCT ${field} FROM cards WHERE deleted_at IS NULL AND ${field} IS NOT NULL ORDER BY ${field}`,
  params: [],
});

// Render checkboxes with D3 join:
select(container)
  .selectAll('.latch-checkbox')
  .data(values, d => d)
  .join(
    enter => enter.append('label').attr('class', 'latch-checkbox')
      .each(function(value) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = activeFilters.includes(value);
        this.appendChild(checkbox);
        this.appendChild(document.createTextNode(value));
      }),
    update => update.each(function(value) {
      const cb = this.querySelector('input');
      if (cb) cb.checked = activeFilters.includes(value);
    }),
    exit => exit.remove()
  );
```

### Pattern 5: Time Range Preset Buttons
**What:** Buttons for Today, This Week, This Month, This Year that compute ISO date boundaries and use FilterProvider.addFilter() with gte/lte operators.
**When to use:** For temporal filtering on time-type LATCH fields.

```typescript
function computeRange(preset: string): { start: string; end: string } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return {
        start: startOfDay.toISOString(),
        end: new Date(startOfDay.getTime() + 86400000).toISOString()
      };
    case 'week': {
      const dayOfWeek = startOfDay.getDay();
      const weekStart = new Date(startOfDay.getTime() - dayOfWeek * 86400000);
      return {
        start: weekStart.toISOString(),
        end: new Date(weekStart.getTime() + 7 * 86400000).toISOString()
      };
    }
    // ... month, year similar
  }
}
```

### Anti-Patterns to Avoid
- **Nested flex containers:** Do NOT add an extra wrapper div between workbench-view-content and ViewManager. Visual Explorer IS the view-content replacement -- one level, not two.
- **Parallel filter state:** LATCH controls MUST use FilterProvider exclusively. No local filter arrays that shadow FilterProvider state.
- **SuperPositionProvider subscribe overhead:** Do NOT make SuperPositionProvider a full PersistableProvider with 60fps subscriber notifications. A single callback slot is sufficient for the zoom slider.
- **CSS transform: rotate for vertical slider:** Avoid `transform: rotate(-90deg)` on the range input -- it breaks layout flow and makes width/height calculations confusing. Use `-webkit-appearance: slider-vertical` + `writing-mode: bt-lr` or the new CSS `appearance: slider-vertical` (supported in Safari 18+ and Chrome 120+). For maximum compatibility, use a `writing-mode: vertical-lr` approach with `direction: rtl` so low values are at bottom.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vertical slider | Custom drag-based slider control | `<input type="range">` with vertical orientation CSS | Free keyboard a11y (arrow keys, page up/down), ARIA, focus ring, thumb styling via CSS pseudos |
| Collapsible LATCH sections | Custom expand/collapse logic | Existing `CollapsibleSection` class | Already has localStorage persistence, chevron animation, count badge, ARIA disclosure, keyboard support |
| Filter state management | Local filter state Map | `FilterProvider.setAxisFilter()` / `addFilter()` | Single source of truth, batched notifications, SQL compilation, Tier 2 persistence |
| Date range computation | Manual string manipulation | `new Date()` arithmetic | Handles DST, leap years, month boundaries correctly |
| Distinct value queries | Hand-built value lists | SQL `SELECT DISTINCT` via WorkerBridge | Always reflects actual data, handles new values from imports automatically |

## Common Pitfalls

### Pitfall 1: Flex min-height: 0 Missing
**What goes wrong:** SuperGrid sticky headers break because the flex child doesn't collapse below content height.
**Why it happens:** Default min-height: auto on flex children prevents overflow scrolling.
**How to avoid:** Both the Visual Explorer root AND its inner content div must have `min-height: 0`. The existing `workbench-view-content` already has this -- preserve it on the replacement element.
**Warning signs:** Sticky column headers scroll with content instead of staying fixed.

### Pitfall 2: Range Input Vertical Orientation Cross-Browser
**What goes wrong:** `<input type="range" orient="vertical">` only works in Firefox. WebKit/Chrome need different approaches.
**Why it happens:** No universal standard for vertical range inputs until recently.
**How to avoid:** Use `writing-mode: vertical-lr; direction: rtl` combined with `appearance: slider-vertical`. The `direction: rtl` flips so min is at bottom and max is at top. This approach works in Safari 14+ and Chrome 120+. Since this runs in WKWebView (Safari 17+), it is safe.
**Warning signs:** Slider renders horizontally, or min/max are reversed.

### Pitfall 3: SuperZoom Callback Not Reaching Slider
**What goes wrong:** Wheel zoom changes the grid but slider doesn't update.
**Why it happens:** SuperZoom's onZoomChange callback is wired at SuperGrid construction time inside the factory. VisualExplorer doesn't have access to that callback chain.
**How to avoid:** Add a lightweight `onZoomChange` callback to SuperPositionProvider's zoomLevel setter. When the setter fires, call the callback. VisualExplorer sets this callback during mount.
**Warning signs:** Pinch/wheel zoom changes grid but slider stays at old position.

### Pitfall 4: FilterProvider Validation on Axis Filter Fields
**What goes wrong:** FilterProvider.setAxisFilter() throws "SQL safety violation" for invalid field names.
**Why it happens:** setAxisFilter() calls validateFilterField() which checks against ALLOWED_FILTER_FIELDS, not ALLOWED_AXIS_FIELDS. The field names used by LATCH (folder, status, card_type, priority, sort_order, name, created_at, modified_at, due_at) are ALL in ALLOWED_FILTER_FIELDS already, so this is safe.
**How to avoid:** Only use field names from LATCH_FAMILIES keys (which are AxisField values) -- all of which are also valid FilterFields.
**Warning signs:** Filter throws on setAxisFilter call -- verify field name is in allowlist.

### Pitfall 5: Checkbox State Desync After FilterProvider Notification
**What goes wrong:** Checkbox displays checked state that doesn't match FilterProvider's actual axis filter values.
**Why it happens:** FilterProvider uses queueMicrotask for batched notifications. If checkbox state is read synchronously before the microtask fires, it may reflect stale state.
**How to avoid:** Always read FilterProvider.getAxisFilter(field) in the subscriber callback, never cache it locally. Re-render checkboxes from provider state, not from DOM checkbox state.
**Warning signs:** Toggling a checkbox appears to work but then reverts, or shows wrong state after rapid clicks.

### Pitfall 6: DISTINCT Query Returns NULL Values
**What goes wrong:** Checkbox list shows "null" or empty string as a selectable value.
**Why it happens:** SQL DISTINCT includes NULL values unless filtered out.
**How to avoid:** Add `AND ${field} IS NOT NULL` to the DISTINCT query. Also filter out empty strings in the result processing.
**Warning signs:** Checkbox list has a blank or "null" entry.

### Pitfall 7: Time Range addFilter vs setAxisFilter Confusion
**What goes wrong:** Time filters use addFilter() (which creates individual filter entries) while checkbox filters use setAxisFilter(). Clearing axis filters via clearAllAxisFilters() won't clear time range filters created via addFilter().
**Why it happens:** Two different filter mechanisms serve different needs -- IN-clause vs comparison operators.
**How to avoid:** For time range filters, use a consistent approach: either (a) use addFilter with 'gte'/'lte' operators and track the filter indices for removal, or (b) use setAxisFilter with pre-computed value lists. Recommended: use addFilter for time ranges and track filter indices in LatchExplorers for targeted removal. Store filter indices per time field so "Clear" per axis works correctly.
**Warning signs:** Clearing LATCH filters leaves orphaned time range filters in the compiled SQL.

### Pitfall 8: CSS max-height Override for LATCH Content
**What goes wrong:** LATCH section body gets clipped at 500px (the default CollapsibleSection max-height).
**Why it happens:** workbench.css sets `.collapsible-section__body { max-height: 500px }` for the collapse animation.
**How to avoid:** Add a CSS override for `.collapsible-section__body:has(> .latch-explorers) { max-height: 2000px; }` matching the existing pattern for properties-explorer and projection-explorer.
**Warning signs:** LATCH content truncated, last axis sections not visible.

## Code Examples

### Vertical Range Input (Cross-Browser)
```css
/* Vertical range input for WebKit (Safari 17+) */
.visual-explorer__zoom-slider {
  writing-mode: vertical-lr;
  direction: rtl;               /* min at bottom, max at top */
  appearance: slider-vertical;
  -webkit-appearance: slider-vertical;
  width: 20px;
  height: 100%;                 /* fills zoom rail height */
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

/* Thumb styling */
.visual-explorer__zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-surface);
  cursor: pointer;
}

/* Track styling */
.visual-explorer__zoom-slider::-webkit-slider-runnable-track {
  width: 4px;
  background: var(--border-subtle);
  border-radius: 2px;
}

/* Focus ring */
.visual-explorer__zoom-slider:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

### SuperPositionProvider Zoom Callback Extension
```typescript
// Add to SuperPositionProvider (minimal change):
private _onZoomChange: ((zoom: number) => void) | null = null;

/** Register a callback for zoom level changes. Only one callback at a time. */
setOnZoomChange(cb: ((zoom: number) => void) | null): void {
  this._onZoomChange = cb;
}

set zoomLevel(value: number) {
  this._zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
  this._onZoomChange?.(this._zoomLevel);
}
```

### VisualExplorer Constructor Pattern
```typescript
export interface VisualExplorerConfig {
  positionProvider: SuperPositionProvider;
  /** Called when user clicks the percentage label (reset to 100%) */
  onZoomReset: () => void;
}

export class VisualExplorer {
  private _rootEl: HTMLElement | null = null;
  private _railEl: HTMLElement | null = null;
  private _contentEl: HTMLElement | null = null;
  private _sliderEl: HTMLInputElement | null = null;
  private _labelEl: HTMLElement | null = null;

  mount(container: HTMLElement): void { /* ... */ }
  getContentEl(): HTMLElement { /* returns inner content div for ViewManager */ }
  setZoomRailVisible(visible: boolean): void { /* show/hide rail based on active view */ }
  destroy(): void { /* cleanup */ }
}
```

### LatchExplorers Constructor Pattern
```typescript
export interface LatchExplorersConfig {
  filter: FilterProvider;
  bridge: WorkerBridgeLike;
  container: HTMLElement;  // from WorkbenchShell.getSectionBody('latch')
}

export class LatchExplorers {
  mount(): void { /* creates 5 sub-sections, one per LATCH family */ }
  update(): void { /* re-fetch distinct values and re-render checkboxes */ }
  destroy(): void { /* cleanup subscriptions and DOM */ }
}
```

### DISTINCT Value Query for Checkbox Lists
```typescript
// Category/Hierarchy checkbox values:
async function fetchDistinctValues(bridge: WorkerBridgeLike, field: string): Promise<string[]> {
  const result = await bridge.send('db:query', {
    sql: `SELECT DISTINCT ${field} FROM cards WHERE deleted_at IS NULL AND ${field} IS NOT NULL ORDER BY ${field}`,
    params: [],
  });
  const rows = (result as { rows: Record<string, unknown>[] }).rows ?? [];
  return rows
    .map(r => String(r[field] ?? ''))
    .filter(v => v !== '');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `orient="vertical"` attribute (Firefox-only) | `writing-mode: vertical-lr` + `direction: rtl` | 2024+ | Cross-browser vertical sliders without CSS transform hacks |
| Zoom via CSS `transform: scale()` | Zoom via CSS custom properties (--sg-col-width, --sg-row-height) | Phase 17 (v3.0) | Preserves overflow:auto scroll behavior -- locked architecture decision |
| Separate filter state per UI module | Single FilterProvider with axis filters | Phase 24 (v3.0) | No parallel state, SQL compilation from single source of truth |

## Open Questions

1. **DISTINCT query timing: when to fetch?**
   - What we know: Checkbox lists need distinct values for each filterable field. These change only after imports, not after filter changes.
   - What's unclear: Should we query on mount, on each update(), or on a coordinator subscription?
   - Recommendation: Query on mount + subscribe to coordinator for re-queries after imports. Cache results to avoid redundant queries during filter-only state changes. Use a `_valuesDirty` flag: set true on coordinator notification, read on next expand of the axis section (lazy fetch).

2. **Time range filter removal tracking**
   - What we know: addFilter() returns void and uses array index for removeFilter(). Time range presets may add 2 filters (gte + lte) per field.
   - What's unclear: How to track which filter indices belong to a given LATCH time section for targeted removal.
   - Recommendation: Before applying a new time range, clear any existing time range filters for that field by scanning FilterProvider.getFilters() for matching field+operator pairs and removing them by index (iterate in reverse to avoid index shift). This is the same pattern used elsewhere -- scan and remove matching filters.

3. **Debounce strategy for text search input**
   - What we know: Text input for Alphabet (name) field uses FilterProvider 'contains' operator. Typing each character would trigger a filter recompile + query.
   - What's unclear: How aggressive should debouncing be?
   - Recommendation: 300ms debounce. This matches typical search UX patterns and prevents excessive Worker queries during fast typing. Use a simple setTimeout/clearTimeout pattern.

## Sources

### Primary (HIGH confidence)
- Source code: `src/providers/SuperPositionProvider.ts` -- zoomLevel getter/setter, ZOOM_MIN/ZOOM_MAX constants
- Source code: `src/views/supergrid/SuperZoom.ts` -- onZoomChange callback, applyZoom(), attach/detach lifecycle
- Source code: `src/providers/FilterProvider.ts` -- setAxisFilter(), addFilter(), clearAllAxisFilters(), compile(), subscribe()
- Source code: `src/providers/latch.ts` -- LATCH_FAMILIES, LATCH_ORDER, LATCH_LABELS, LATCH_COLORS
- Source code: `src/ui/CollapsibleSection.ts` -- mount/destroy lifecycle, localStorage persistence, setCount(), getBodyEl()
- Source code: `src/ui/WorkbenchShell.ts` -- getSectionBody('latch'), getViewContentEl(), section layout
- Source code: `src/main.ts` -- SuperGrid factory, ViewManager wiring, onViewSwitch callback
- Source code: `src/styles/workbench.css` -- .workbench-view-content flex layout, min-height: 0

### Secondary (MEDIUM confidence)
- CSS `writing-mode: vertical-lr` for range inputs -- verified in WebKit source (Safari 17+ support confirmed by project's iOS 17+ target)
- CSS `appearance: slider-vertical` -- Chrome 120+ and Safari 18+ (project targets Safari 17+ in WKWebView)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries and APIs already exist in the codebase
- Architecture: HIGH - follows exact patterns from Phase 55 (PropertiesExplorer, ProjectionExplorer)
- Pitfalls: HIGH - identified from direct source code reading of existing APIs and their constraints
- Layout: HIGH - workbench.css flex layout is straightforward; SuperGrid scroll behavior well understood

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- internal codebase patterns unlikely to change)
