# Phase 6: Time + Visual Views - Research

**Researched:** 2026-02-28
**Domain:** D3.js scaleTime, CSS Grid calendar layout, HTML-based tile gallery, SVG swimlane timeline
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Calendar layout**: Month grid default; 7-column CSS Grid; DensityProvider granularity maps directly to BOTH SQL GROUP BY AND visual layout (day/week/month/quarter/year); HTML-based (CSS Grid); crossfade transition to/from SVG views
- **Calendar overflow**: 2-3 card chips per day cell then "+N more" label — Google/Apple Calendar pattern
- **Timeline axis**: Horizontal left-to-right; `d3.scaleTime()` on x-axis; fixed left column for swimlane row labels; overlapping cards stack vertically (sub-rows) — no cards hidden; SVG-based; morph transitions possible with List/Grid; 'timeline' added to SVG_VIEWS in transitions.ts
- **Gallery tiles**: Uniform tile size larger than 180x120; responsive column count; image-less cards use CARD_TYPE_ICONS; resource cards render body_text as img src with fallback; HTML-based (CSS Grid); crossfade transition
- **Date field handling**: Add `due_at` and `body_text` to CardDatum; cards with NULL date excluded from Calendar/Timeline (still appear in List/Grid/Kanban/Gallery); no event_start/event_end
- **Transition classification**: SVG_VIEWS = list, grid, timeline; HTML_VIEWS = kanban, calendar, gallery; LATCH-GRAPH switch always crossfades
- **Reuse IView interface unchanged**: mount/render/destroy; CardRenderer.renderHtmlCard() for Calendar/Gallery; CardRenderer.renderSvgCard() for Timeline
- **DensityProvider.compile()** returns `{ groupExpr }` — CalendarView and TimelineView consume this to drive SQL GROUP BY at all five granularity levels
- **toCardDatum()** needs expansion for due_at and body_text
- **transitions.ts SVG_VIEWS set**: add 'timeline'; **HTML_VIEWS set**: add 'calendar', 'gallery'

### Claude's Discretion

- Gallery tile dimensions (larger than 180x120 — exact size TBD)
- Calendar navigation controls (prev/next month arrows, today button)
- Calendar mini-month layout for quarter/year granularity
- Timeline zoom/pan behavior
- Timeline tick mark density and label formatting
- Loading skeleton design for each new view
- Exact spacing and typography within calendar cells

### Deferred Ideas (OUT OF SCOPE)

- Multi-day event spans in Timeline (event_start → event_end bars)
- Calendar drag-drop to reschedule cards
- Timeline zoom/scroll linked to DensityProvider granularity switching
- Gallery lightbox/preview overlay for resource images
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-04 | CalendarView renders cards on a month/week/day grid based on date fields with DensityProvider | CSS Grid 7-column layout; DensityProvider.compile() drives SQL GROUP BY; `new Date(y, m, 1).getDay()` for first-column offset; granularity maps to visual mode |
| VIEW-05 | TimelineView renders cards on a continuous time axis with swimlane grouping | `d3.scaleTime()` x-axis; SVG g.swimlane groups keyed by PAFVProvider groupBy field; sub-row stacking for overlapping cards; `d3.axisBottom()` tick rendering |
| VIEW-06 | GalleryView renders cards as visual tiles with image/cover display | CSS Grid responsive columns; img tag for resource body_text; CARD_TYPE_ICONS fallback; renderHtmlCard() adaptation or custom tile renderer |
</phase_requirements>

---

## Summary

Phase 6 adds three new IView implementations: CalendarView (HTML/CSS Grid), TimelineView (SVG/D3), and GalleryView (HTML/CSS Grid). All three follow the established mount/render/destroy lifecycle, consume provider state through the existing QueryBuilder/DensityProvider/PAFVProvider pipeline, and integrate with the existing transition infrastructure via updated SVG_VIEWS and HTML_VIEWS sets.

The primary research concern is correctness of integration with the DensityProvider: the CONTEXT.md decision that granularity must change BOTH the SQL GROUP BY expression AND the visual layout means CalendarView must re-build its DOM structure (not just re-render data) when granularity switches. This is the main architectural distinction from how GridView/KanbanView work.

TimelineView is the most technically demanding: `d3.scaleTime()` with jsdom has known pitfalls (getBBox, axis rendering, SVG text layout), but these are navigable by following the existing Phase 5 patterns (no transform transitions, sync exits, direct attr() not transition() for positions). Timeline joins SVG_VIEWS so morphTransition must work between list/grid/timeline — the SVG g.card key function pattern established in Phase 5 makes this straightforward.

GalleryView is the simplest of the three: it is structurally analogous to KanbanView but without drag-drop. The primary new concern is image loading (resource cards) and the img error fallback.

**Primary recommendation:** Implement in order — types.ts expansion first (due_at, body_text), then CalendarView (simpler, HTML-only), then GalleryView (HTML-only), then TimelineView (SVG + most complex logic). Update transitions.ts as the final integration step.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3 | ^7.9.0 (already installed) | scaleTime(), axisBottom(), time intervals, time format | Project-mandated (D-001), already in package.json |
| TypeScript | ^5.9.3 | Type safety for Date math, CardDatum expansion | Project-mandated |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom | ^28.1.0 (already installed) | Test DOM environment for HTML views | All CalendarView/GalleryView tests via `@vitest-environment jsdom` |
| CSS Grid (browser-native) | — | Calendar and Gallery layout | Both HTML-based views; no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled calendar date math | date-fns | date-fns not in project; JavaScript Date is sufficient for month grid construction; avoids a new dependency |
| d3.scaleUtc for timeline | d3.scaleTime | scaleUtc is preferred for UTC-stored ISO dates (avoids local timezone issues in tests); document this choice |
| CSS Flexbox for gallery | CSS Grid | Grid gives uniform tile sizing and automatic reflow with no JS column tracking; strictly better here |

**Installation:** No new packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure
```
src/views/
├── types.ts              # Add due_at, body_text to CardDatum; update toCardDatum()
├── CalendarView.ts       # HTML/CSS Grid calendar (new)
├── TimelineView.ts       # SVG D3 timeline (new)
├── GalleryView.ts        # HTML/CSS Grid gallery (new)
├── transitions.ts        # Update SVG_VIEWS/HTML_VIEWS sets
├── index.ts              # Add exports for 3 new views
└── [existing files unchanged]

tests/views/
├── CalendarView.test.ts  # @vitest-environment jsdom
├── TimelineView.test.ts  # @vitest-environment jsdom
└── GalleryView.test.ts   # @vitest-environment jsdom
```

### Pattern 1: CardDatum Expansion (types.ts)

**What:** Add `due_at` and `body_text` to the CardDatum interface and update `toCardDatum()`.
**When to use:** This is Wave 0 — must happen before any view implementation touches these fields.

```typescript
// In src/views/types.ts — add to CardDatum interface:
export interface CardDatum {
  // ... existing fields ...
  /** ISO timestamp for time-axis views (Calendar, Timeline); null if no due date */
  due_at: string | null;
  /** Raw body content; Gallery uses as img src for resource cards; other views ignore */
  body_text: string | null;
}

// In toCardDatum() — add mappings:
export function toCardDatum(row: Record<string, unknown>): CardDatum {
  return {
    // ... existing fields ...
    due_at: row['due_at'] != null ? String(row['due_at']) : null,
    body_text: row['body_text'] != null ? String(row['body_text']) : null,
  };
}
```

**Confidence:** HIGH — direct code inspection of existing types.ts and toCardDatum().

### Pattern 2: CalendarView — CSS Grid Month Layout

**What:** HTML div grid with 7 columns (one per weekday). First day offset via `grid-column-start`. Cards appear as chips inside day cells.
**When to use:** CalendarView mount() and render(); layout rebuilt when granularity changes.

```typescript
// Core CSS Grid for month layout — no library needed
const grid = document.createElement('div');
grid.className = 'calendar-grid';
grid.style.display = 'grid';
grid.style.gridTemplateColumns = 'repeat(7, 1fr)';

// First-day-of-month offset
const firstDay = new Date(year, month, 1);
const startCol = firstDay.getDay(); // 0=Sun, 6=Sat
const firstCell = document.createElement('div');
firstCell.style.gridColumnStart = String(startCol + 1); // CSS grid is 1-indexed

// Day cells keyed by date string for D3-style reconciliation
// Each cell contains card chips: renderHtmlCard() truncated to chip size
// Overflow: if cellCards.length > MAX_CHIPS (2), show last item as "+N more" span
const MAX_CHIPS = 2;
```

**Confidence:** HIGH — verified via [zellwk.com/blog/calendar-with-css-grid/](https://zellwk.com/blog/calendar-with-css-grid/) and MDN Date.prototype.getDay().

### Pattern 3: DensityProvider Granularity → Visual Layout Switch

**What:** CalendarView must rebuild its structural DOM when granularity changes, not just re-bind data.
**When to use:** Inside render() — detect granularity change, call _buildStructure() before _bindCards().

```typescript
// CalendarView tracks last-rendered granularity
private _lastGranularity: TimeGranularity | null = null;
private _densityState: { timeField: string; granularity: TimeGranularity } | null = null;

render(cards: CardDatum[]): void {
  const density = this._densityProvider.getState();
  const structureChanged = density.granularity !== this._lastGranularity;

  if (structureChanged) {
    this._buildStructure(density.granularity, density.timeField);
    this._lastGranularity = density.granularity;
  }
  this._bindCards(cards, density.timeField);
}

// Granularity → display mode map:
// 'day' → single expanded day (list of hours)
// 'week' → 7-col single week
// 'month' → full month grid (default)
// 'quarter' → 3 mini-months side-by-side
// 'year' → 12 mini-months (4 cols x 3 rows)
```

**Confidence:** HIGH — derived from CONTEXT.md locked decisions.

### Pattern 4: TimelineView — SVG with d3.scaleTime()

**What:** SVG-based view with horizontal time axis, fixed swimlane labels, cards positioned by date.
**When to use:** TimelineView.mount() creates the SVG structure; render() updates the scale domain and repositions cards.

```typescript
// Source: d3js.org/d3-scale/time (verified)
// Use scaleUtc (not scaleTime) for predictable behavior with ISO UTC dates

mount(container: HTMLElement): void {
  // Fixed left column for swimlane labels
  const labelColWidth = 120;
  const axisHeight = 40;

  this.svg = d3.select(container).append('svg').attr('width', '100%');

  // Time axis group (bottom of axis area)
  this.axisG = this.svg.append('g')
    .attr('class', 'timeline-axis')
    .attr('transform', `translate(${labelColWidth}, ${axisHeight})`);

  // Swimlane container group
  this.swimlaneG = this.svg.append('g')
    .attr('class', 'swimlanes')
    .attr('transform', `translate(${labelColWidth}, ${axisHeight + 10})`);
}

render(cards: CardDatum[], groupField: string): void {
  const width = this.container!.clientWidth - LABEL_COL_WIDTH;

  // Parse ISO dates from CardDatum.due_at (or created_at as fallback)
  const dates = cards
    .filter(d => d.due_at != null)
    .map(d => new Date(d.due_at!));

  const xScale = d3.scaleUtc()
    .domain(d3.extent(dates) as [Date, Date])
    .range([0, width])
    .nice();

  // Render axis — IMPORTANT: d3.axisBottom().call() triggers getBBox in jsdom
  // For tests: mock SVGElement.prototype.getBBox = () => ({ x:0, y:0, width:0, height:0 })
  const axis = d3.axisBottom(xScale).ticks(6);
  this.axisG!.call(axis);

  // Group cards by swimlane (PAFVProvider groupBy field)
  const swimlanes = d3.group(cards.filter(d => d.due_at), d => d[groupField as keyof CardDatum] ?? 'None');

  // Render swimlane rows with sub-row stacking for overlaps
  // Each swimlane: g.swimlane with label (left col) + card rects (x = xScale(due_at))
  // Cards within same swimlane: stack vertically if x-positions overlap
}
```

**Confidence:** HIGH for scaleUtc API — verified via [d3js.org/d3-scale/time](https://d3js.org/d3-scale/time). MEDIUM for getBBox workaround pattern — verified via jsdom GitHub issues.

### Pattern 5: GalleryView — CSS Grid Responsive Tiles

**What:** HTML div grid with responsive column count; resource cards show image, others show icon.
**When to use:** GalleryView.render(); analogous to GridView but HTML not SVG.

```typescript
// Responsive column count (same pattern as GridView.render())
const cols = Math.max(1, Math.floor(container.clientWidth / GALLERY_TILE_WIDTH));
this.grid!.style.gridTemplateColumns = `repeat(${cols}, ${GALLERY_TILE_WIDTH}px)`;

// Resource cards: use body_text as img src
function renderGalleryTile(d: CardDatum): HTMLDivElement {
  const tile = document.createElement('div');
  tile.className = 'gallery-tile';
  tile.dataset['id'] = d.id;

  if (d.card_type === 'resource' && d.body_text) {
    const img = document.createElement('img');
    img.src = d.body_text;
    img.alt = d.name;
    img.className = 'tile-image';
    img.onerror = () => {
      // Fall back to icon on load failure
      img.replaceWith(makeFallbackIcon(d));
    };
    tile.appendChild(img);
  } else {
    tile.appendChild(makeFallbackIcon(d));
  }

  const nameEl = document.createElement('span');
  nameEl.className = 'tile-name';
  nameEl.textContent = d.name;
  tile.appendChild(nameEl);

  return tile;
}

function makeFallbackIcon(d: CardDatum): HTMLDivElement {
  const icon = document.createElement('div');
  icon.className = 'tile-icon';
  icon.textContent = CARD_TYPE_ICONS[d.card_type] ?? 'N';
  return icon;
}
```

**Confidence:** HIGH — derived from existing KanbanView/CardRenderer patterns in codebase + CONTEXT.md decisions.

### Pattern 6: Transitions Integration

**What:** Update SVG_VIEWS and HTML_VIEWS sets in transitions.ts; shouldUseMorph will now return true for list↔timeline and grid↔timeline.
**When to use:** Final integration step after all three views are implemented.

```typescript
// In src/views/transitions.ts — update both sets:
const SVG_VIEWS = new Set<ViewType>(['list', 'grid', 'timeline']); // add timeline
const HTML_VIEWS = new Set<ViewType>(['kanban', 'calendar', 'gallery']); // add calendar, gallery
```

**Note:** morphTransition() works on `g.card` elements in the shared SVG container. TimelineView must produce `g.card` elements (same as ListView and GridView) for morph to work. This means TimelineView's card rendering must follow the same SVG `g.card` data join pattern established in Phase 5.

**Confidence:** HIGH — direct inspection of transitions.ts SVG_VIEWS set and shouldUseMorph logic.

### Anti-Patterns to Avoid

- **Do not call d3.axis.call() in tests without mocking getBBox:** `d3.axisBottom().call(selection)` triggers `getBBox()` on SVG text elements in jsdom, which throws. Either mock at prototype level or test axis output by checking attribute values rather than calling .call() in the test.
- **Do not use d3.transition() on 'transform' attribute in jsdom:** This is a known Phase 5 lesson. Use `.attr('transform', ...)` directly; use transition only for opacity.
- **Do not re-use a single shared grid container across granularity changes:** CalendarView must tear down and rebuild its structural DOM (day cells) when granularity changes. Trying to reconcile existing cells with a D3 join when the number of columns changes will produce incorrect layouts.
- **Do not use d3.scaleTime() for UTC dates:** Use `d3.scaleUtc()` instead. ISO timestamp strings stored in SQLite are UTC; `scaleTime()` applies local timezone offset which causes test failures (especially on CI servers in different timezones).
- **Do not leave calendar state (current month/year) in ViewManager:** CalendarView owns its navigation state (current month/year); ViewManager only calls render(cards) when provider state changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time scale x-axis | Custom tick positioning math | `d3.scaleUtc()` + `d3.axisBottom()` | Handles DST, interval alignment, nice tick selection across all granularities |
| Date bucketing for calendar cells | Custom date math | `new Date(year, month, day).toISOString().slice(0, 10)` + group by string | JavaScript Date handles month length, leap years; ISO slice gives stable string key |
| Responsive column count | Custom ResizeObserver | `Math.floor(container.clientWidth / TILE_WIDTH)` read at render time | Same pattern as GridView — simple, testable, no observer lifecycle |
| Image load failure fallback | Try/catch async image loading | `img.onerror` event handler | Native browser event; synchronous handler; replaceWith() for DOM swap |
| Card-to-swimlane grouping | Custom groupBy | `d3.group(cards, d => d[field])` | Returns Map; integrates with D3 data joins; same key function pattern |

**Key insight:** The CSS Grid + native Date math combination covers the entire calendar layout problem. The main engineering work is DOM reconciliation (deciding when to rebuild structure vs. re-bind data) and the DensityProvider integration, not the layout mechanics.

---

## Common Pitfalls

### Pitfall 1: getBBox crash in jsdom when calling d3.axisBottom()

**What goes wrong:** `TypeError: this.getBBox is not a function` thrown when `axisG.call(axis)` runs in a jsdom test environment.
**Why it happens:** jsdom does not implement SVG layout APIs; `d3.axisBottom()` calls `getBBox()` internally on text elements to adjust tick label positions.
**How to avoid:** In test setup (or at the top of TimelineView.test.ts), add the prototype mock:
```typescript
// @vitest-environment jsdom
beforeAll(() => {
  SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 80, height: 16 });
});
```
Alternatively, test axis presence (check `g.timeline-axis` exists and has child elements) rather than testing axis call output directly.
**Warning signs:** Test suite crashes with getBBox TypeError on any TimelineView test that calls render().

**Confidence:** HIGH — confirmed by jsdom GitHub issues #1664, #3159 and Phase 5 precedent (transform transition crashes similarly).

### Pitfall 2: scaleTime() vs scaleUtc() timezone shift

**What goes wrong:** Calendar day cells show cards on wrong day; timeline x-positions are off by hours.
**Why it happens:** `d3.scaleTime()` interprets Date objects in local time. On a machine with UTC-8 timezone, `new Date('2026-01-15T00:00:00Z')` maps to Jan 14 locally. Tests pass in UTC CI but fail in local dev (or vice versa).
**How to avoid:** Use `d3.scaleUtc()` for the time axis. When grouping calendar cards by day, use `card.due_at!.slice(0, 10)` (the ISO date prefix) rather than `new Date(card.due_at!).toLocaleDateString()`.
**Warning signs:** Calendar tests pass in Node (UTC) but cards appear on wrong day when tested with `TZ=America/New_York`.

**Confidence:** HIGH — documented in d3js.org/d3-scale/time (scaleUtc section).

### Pitfall 3: Calendar structure rebuild vs. data rebind

**What goes wrong:** Switching from month to week granularity shows 31 cells with only 7 populated — old month cells still visible.
**Why it happens:** Treating render() as a pure data join (like GridView does) means the structural DOM (number of columns, number of cells) stays fixed while only card chips are updated.
**How to avoid:** CalendarView must track the last-rendered granularity. On granularity change, clear the grid and call `_buildStructure()` before `_bindCards()`. Only skip rebuild when granularity is unchanged.
**Warning signs:** Cell count doesn't match expected layout for the new granularity after a DensityProvider state change.

**Confidence:** HIGH — derived from CONTEXT.md locked decision that each granularity changes BOTH SQL AND visual layout.

### Pitfall 4: Timeline morph requires g.card elements

**What goes wrong:** Switching list → timeline triggers morphTransition (both in SVG_VIEWS) but cards don't animate — they disappear and reappear.
**Why it happens:** morphTransition() selects `g.card` elements and animates their transform attribute. If TimelineView renders cards as `g.timeline-card` or uses a different structure, D3's key-based data join finds no matching elements to animate.
**How to avoid:** TimelineView card groups MUST use `g.card` as their CSS class (same as ListView and GridView) and MUST use `d => d.id` as the key function. The card content inside the `g.card` can differ (swimlane position, different rect dimensions) but the container class must match.
**Warning signs:** morphTransition() shows all cards as ENTER (fade in from opacity 0) instead of animating existing cards to new positions.

**Confidence:** HIGH — direct inspection of morphTransition() in transitions.ts which selects `.card` class.

### Pitfall 5: NULL due_at cards in Calendar/Timeline

**What goes wrong:** Cards without a due_at date crash the date parsing or appear on Jan 1 1970.
**Why it happens:** `new Date(null)` returns invalid date; `d3.scaleUtc().domain([invalid, invalid])` produces NaN positions.
**How to avoid:** Filter out cards with `due_at === null` before building the timeline domain and calendar card lists. These cards should simply not appear in Calendar/Timeline (per CONTEXT.md — "still appear in List/Grid/Kanban/Gallery"). Apply the filter in `_bindCards()` not in ViewManager (ViewManager passes all cards; view is responsible for time-field filtering).
**Warning signs:** NaN in SVG transform attributes; calendar cells getting cards that have no due date.

**Confidence:** HIGH — derived from CONTEXT.md locked decision on NULL handling.

### Pitfall 6: img.onerror not firing in jsdom

**What goes wrong:** GalleryView tests for the image fallback behavior pass but the onerror handler never runs — test doesn't actually validate the fallback.
**Why it happens:** jsdom does not load external resources by default; `img.src` assignment does not trigger load/error events unless `resources: 'usable'` is passed to JSDOM constructor (not configured in this project).
**How to avoid:** Test the onerror handler directly: get the img element after render, dispatch an `error` event manually (`img.dispatchEvent(new Event('error'))`), then assert the fallback icon is present.
**Warning signs:** GalleryView test for fallback icon passes but when run in a browser, broken image links show the img placeholder instead of the icon.

**Confidence:** MEDIUM — consistent with jsdom's documented resource loading behavior; verified in pattern with KanbanView's DragEvent polyfill precedent.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### d3.scaleUtc() time axis (verified from d3js.org/d3-scale/time)

```typescript
// Source: https://d3js.org/d3-scale/time
import * as d3 from 'd3';

// Parse ISO UTC dates from CardDatum
const dates = cards
  .filter(c => c.due_at != null)
  .map(c => new Date(c.due_at!));

const [minDate, maxDate] = d3.extent(dates) as [Date, Date];

const xScale = d3.scaleUtc()
  .domain([minDate, maxDate])
  .range([0, timelineWidth])
  .nice();

// Axis with sensible tick count
const xAxis = d3.axisBottom(xScale).ticks(6);
axisGroup.call(xAxis); // → needs getBBox mock in jsdom
```

### Calendar first-day offset (verified from zellwk.com + MDN)

```typescript
// Source: https://zellwk.com/blog/calendar-with-css-grid/
// MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getDay

function buildMonthGrid(year: number, month: number, cards: CardDatum[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'calendar-month-grid';
  // grid-template-columns: repeat(7, 1fr) set in CSS

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    cell.dataset['date'] = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (day === 1 && firstDayOfWeek > 0) {
      cell.style.gridColumnStart = String(firstDayOfWeek + 1); // CSS grid is 1-indexed
    }

    // Cards for this day
    const dateKey = cell.dataset['date']!;
    const dayCards = cards.filter(c => c.due_at?.slice(0, 10) === dateKey);

    // Render up to MAX_CHIPS card chips
    const MAX_CHIPS = 2;
    dayCards.slice(0, MAX_CHIPS).forEach(c => {
      cell.appendChild(renderHtmlCard(c)); // from CardRenderer
    });
    if (dayCards.length > MAX_CHIPS) {
      const more = document.createElement('span');
      more.className = 'overflow-label';
      more.textContent = `+${dayCards.length - MAX_CHIPS} more`;
      cell.appendChild(more);
    }
    grid.appendChild(cell);
  }
  return grid;
}
```

### Swimlane grouping with d3.group (verified from d3js.org)

```typescript
// Source: https://d3js.org/d3-array/group
// Group cards by the active PAFVProvider groupBy field value

function groupBySwimlane(cards: CardDatum[], groupField: string): Map<string, CardDatum[]> {
  return d3.group(
    cards.filter(c => c.due_at != null),
    c => String((c as Record<string, unknown>)[groupField] ?? 'None')
  );
}

// Render swimlanes
swimlanes.forEach((laneCards, laneLabel) => {
  const laneG = swimlaneContainer.append('g').attr('class', 'swimlane');

  // Label in fixed left column
  laneG.append('text')
    .attr('class', 'swimlane-label')
    .attr('x', -LABEL_COL_WIDTH + PADDING)
    .attr('y', laneY + LANE_HEIGHT / 2)
    .text(laneLabel);

  // Cards within lane — D3 data join with key d => d.id (VIEW-09)
  laneG.selectAll<SVGGElement, CardDatum>('g.card')
    .data(laneCards, d => d.id)
    .join(/* ... enter/update/exit ... */);
});
```

### getBBox mock for jsdom (MEDIUM confidence — community pattern)

```typescript
// @vitest-environment jsdom
// In TimelineView.test.ts beforeAll:

beforeAll(() => {
  // jsdom does not implement SVG layout APIs
  // d3.axisBottom() calls getBBox() on text tick labels — mock returns safe defaults
  SVGElement.prototype.getBBox = () =>
    ({ x: 0, y: 0, width: 80, height: 16 } as DOMRect);
});
```

### Gallery image fallback test pattern

```typescript
// Manually trigger onerror since jsdom does not load resources
it('falls back to icon when image fails to load', () => {
  const resourceCard = makeCard({ card_type: 'resource', body_text: 'https://example.com/img.png' });
  view.render([resourceCard]);

  const img = container.querySelector<HTMLImageElement>('.tile-image')!;
  expect(img).toBeTruthy();

  // Manually trigger onerror (jsdom does not load external resources)
  img.dispatchEvent(new Event('error'));

  // Icon should replace the img
  expect(container.querySelector('.tile-image')).toBeNull();
  expect(container.querySelector('.tile-icon')).not.toBeNull();
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `d3.scaleTime()` for all time scales | `d3.scaleUtc()` for UTC-stored data | D3 v4+ | Eliminates timezone bugs in test environments |
| Manual tick interval calculation | `d3.axisBottom(scale).ticks(d3.timeDay)` | D3 v4+ | D3 handles sensible interval selection automatically |
| CSS float/table for calendar grids | CSS Grid `grid-template-columns: repeat(7, 1fr)` + `grid-column-start` | CSS Grid widespread (2018+) | 3 lines of CSS replaces complex table markup |

**Deprecated/outdated:**
- `d3.time.scale()` (v3 API): replaced by `d3.scaleTime()` in v4; project uses v7, use `d3.scaleUtc()` for UTC data
- `d3.time.format()` (v3 API): replaced by `d3.timeFormat()` in v4; already used correctly in project

---

## Open Questions

1. **d3.group() availability in d3@7.9.0**
   - What we know: `d3.group()` was added in d3-array v2 which ships with D3 v6+. Project uses d3@7.9.0.
   - What's unclear: Need to confirm the exact import path — it may be `d3.group` (included in the d3 bundle) or require `import { group } from 'd3-array'`.
   - Recommendation: Use `import * as d3 from 'd3'` and call `d3.group()` — this is the project's existing pattern; it will be available since d3@7 includes d3-array v3.

2. **CalendarView DensityProvider subscription**
   - What we know: ViewManager subscribes to StateCoordinator and calls `view.render(cards)` on every state change. CalendarView also needs DensityProvider state to know which field to group by and which granularity to display.
   - What's unclear: Should CalendarView receive DensityProvider as a constructor dependency (like KanbanView receives MutationManager), or should ViewManager pass granularity metadata alongside the cards array?
   - Recommendation: Inject DensityProvider into CalendarView and TimelineView constructors (same pattern as KanbanView's MutationManager injection). This keeps view dependencies explicit and testable. ViewManager already has access to all providers.

3. **Timeline card width (point vs. span)**
   - What we know: CONTEXT.md defers multi-day event spans. Cards are positioned by `due_at` as a single point.
   - What's unclear: What width should a point-in-time card rectangle have? A fixed pixel width may cause overlap for dense clusters.
   - Recommendation: Use a fixed minimum card width (e.g., 80px) and rely on sub-row stacking for overlaps (already specified in CONTEXT.md: "overlapping cards within the same swimlane stack vertically"). Claude's discretion on the overlap detection algorithm (simple x-interval overlap check).

4. **Gallery tile recommended dimensions**
   - What we know: CONTEXT.md says "larger than GridView's 180x120" and leaves exact dimensions to Claude's discretion.
   - Recommendation: 240x160px provides ~33% more area than 180x120, maintains the same 3:2 aspect ratio, and gives enough space for an image or a large icon. At 240px wide, a 1200px container holds 5 tiles, which feels like a photo library browser.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts (root) |
| Quick run command | `npx vitest --run tests/views/` |
| Full suite command | `npx vitest --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIEW-04 | CalendarView renders month grid with correct day cells | unit (jsdom) | `npx vitest --run tests/views/CalendarView.test.ts` | Wave 0 |
| VIEW-04 | CalendarView places first day in correct column (getDay offset) | unit (jsdom) | `npx vitest --run tests/views/CalendarView.test.ts` | Wave 0 |
| VIEW-04 | CalendarView shows +N more overflow when day has >2 cards | unit (jsdom) | `npx vitest --run tests/views/CalendarView.test.ts` | Wave 0 |
| VIEW-04 | Switching density granularity rebuilds calendar structure | unit (jsdom) | `npx vitest --run tests/views/CalendarView.test.ts` | Wave 0 |
| VIEW-04 | DensityProvider groupExpr changes SQL GROUP BY (not just display) | unit | `npx vitest --run tests/providers/DensityProvider.test.ts` | Exists (PROV-07/08) |
| VIEW-05 | TimelineView renders SVG with g.card elements keyed by d.id | unit (jsdom) | `npx vitest --run tests/views/TimelineView.test.ts` | Wave 0 |
| VIEW-05 | TimelineView x-positions cards by due_at date via scaleUtc | unit (jsdom) | `npx vitest --run tests/views/TimelineView.test.ts` | Wave 0 |
| VIEW-05 | TimelineView groups cards into swimlane rows | unit (jsdom) | `npx vitest --run tests/views/TimelineView.test.ts` | Wave 0 |
| VIEW-05 | shouldUseMorph returns true for list↔timeline (after SVG_VIEWS update) | unit | `npx vitest --run tests/views/transitions.test.ts` | Exists — add cases |
| VIEW-06 | GalleryView renders resource cards with img tag | unit (jsdom) | `npx vitest --run tests/views/GalleryView.test.ts` | Wave 0 |
| VIEW-06 | GalleryView renders non-resource cards with CARD_TYPE_ICONS fallback | unit (jsdom) | `npx vitest --run tests/views/GalleryView.test.ts` | Wave 0 |
| VIEW-06 | GalleryView img.onerror replaces img with fallback icon | unit (jsdom) | `npx vitest --run tests/views/GalleryView.test.ts` | Wave 0 |
| VIEW-06 | GalleryView column count adapts to container clientWidth | unit (jsdom) | `npx vitest --run tests/views/GalleryView.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest --run tests/views/`
- **Per wave merge:** `npx vitest --run`
- **Phase gate:** Full suite green (currently 727 tests passing) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/views/CalendarView.test.ts` — covers VIEW-04 (all calendar behaviors)
- [ ] `tests/views/TimelineView.test.ts` — covers VIEW-05 (all timeline behaviors); needs getBBox mock in beforeAll
- [ ] `tests/views/GalleryView.test.ts` — covers VIEW-06 (all gallery behaviors)
- [ ] `src/views/CalendarView.ts` — new implementation file
- [ ] `src/views/TimelineView.ts` — new implementation file
- [ ] `src/views/GalleryView.ts` — new implementation file
- [ ] `src/views/types.ts` — add `due_at` and `body_text` fields to CardDatum; update toCardDatum()
- [ ] `src/views/transitions.ts` — add 'timeline' to SVG_VIEWS; add 'calendar', 'gallery' to HTML_VIEWS
- [ ] `src/views/index.ts` — export CalendarView, TimelineView, GalleryView

*(Existing DensityProvider tests cover PROV-07/08 — no gaps there. Existing transitions.test.ts needs new test cases for shouldUseMorph with timeline, calendar, gallery.)*

---

## Sources

### Primary (HIGH confidence)
- [d3js.org/d3-scale/time](https://d3js.org/d3-scale/time) — scaleTime/scaleUtc API, domain/range with Date objects, ticks, tickFormat, nice()
- [d3js.org/d3-axis](https://d3js.org/d3-axis) — axisBottom(), ticks with time intervals, tickFormat, rendering to SVG
- [zellwk.com/blog/calendar-with-css-grid/](https://zellwk.com/blog/calendar-with-css-grid/) — CSS Grid month calendar technique, first-day grid-column-start
- [MDN Date.prototype.getDay()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getDay) — getDay() returns 0=Sun, provides first-column offset
- Codebase inspection: `src/views/transitions.ts`, `src/views/CardRenderer.ts`, `src/views/types.ts`, `src/views/GridView.ts`, `src/views/KanbanView.ts`, `src/providers/DensityProvider.ts`, `src/providers/QueryBuilder.ts`

### Secondary (MEDIUM confidence)
- jsdom GitHub issues [#1664](https://github.com/jsdom/jsdom/issues/1664), [#3159](https://github.com/jsdom/jsdom/issues/3159) — getBBox not implemented in jsdom; SVGElement.prototype mock is standard workaround
- [d3js.org/d3-array/group](https://d3js.org/d3-array) — d3.group() for swimlane card grouping (included in d3@7 bundle)

### Tertiary (LOW confidence)
- None — all major findings verified through primary or secondary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already installed and in use
- Architecture: HIGH — 3 views follow established IView pattern; integration points confirmed by direct code inspection
- CalendarView patterns: HIGH — CSS Grid technique verified via official sources; date math is standard JS
- TimelineView patterns: HIGH for scaleUtc API; MEDIUM for getBBox workaround (well-documented community pattern)
- GalleryView patterns: HIGH — structurally analogous to KanbanView with img tag addition
- Pitfalls: HIGH (getBBox, timezone, NULL filtering) / MEDIUM (img.onerror in jsdom)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (D3 v7 API is stable; CSS Grid is stable; jsdom behavior unlikely to change)
