# Phase 5: Core D3 Views + Transitions - Research

**Researched:** 2026-02-28
**Domain:** D3.js v7 data joins, transitions, view lifecycle management, HTML5 drag-drop
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card Rendering**
- Minimal card template: name + subtitle line (folder or status, whichever is set)
- One shared CardRenderer function used by all three views — identical DOM structure enables smooth morph transitions
- Cards are `<g>` groups in SVG for List/Grid, HTML `<div>` for Kanban (drag-drop needs HTML)
- Truncate name with ellipsis if it exceeds card width
- Card type indicator via small icon or badge (note/task/event/resource/person)

**ListView**
- Single-column vertical list with configurable sort (name, created_at, modified_at, priority)
- Sort controls in a small toolbar above the list (dropdown + asc/desc toggle)
- Each row: card content left-aligned, date/time right-aligned
- Fixed row height for clean alignment and predictable scroll

**GridView**
- Fixed-size uniform tiles arranged in a responsive grid (columns adapt to container width)
- Cards wrap to fill available space — `Math.floor(width / cellWidth)` columns
- PAFV axis mappings determine sort order within the grid
- No masonry — uniform height for clean transitions

**KanbanView**
- Column grouping field is configurable via PAFVProvider's groupBy (defaults to `status`, can be `folder` or `card_type`)
- Columns render in alphabetical order of the grouping field's values; empty columns still show with header + empty state text
- Drag-drop between columns fires a MutationManager mutation (undoable via Cmd+Z)
- HTML-based rendering (not SVG) since HTML5 drag-and-drop is required
- Vertical scroll within each column when cards overflow

**View Transitions**
- LATCH family transitions (List↔Grid↔Kanban) morph card positions using d3-transition with 400ms duration and ease-out-cubic
- Cross-family transitions (LATCH↔GRAPH) use 300ms crossfade (opacity out → opacity in)
- Transitions triggered by ViewManager.switchTo(viewType) — UI trigger mechanism is implementation detail
- Each card animates individually to its new position (staggered by index for visual flow)
- If a card enters during transition (new data), it fades in at destination; if it exits, it fades out from source

**ViewManager Lifecycle**
- ViewManager holds a reference to the current active view
- On switchTo(): call currentView.destroy() first (removes subscriptions, clears DOM), then mount new view
- destroy() MUST unsubscribe from StateCoordinator — the "10 mount/destroy cycles = unchanged subscriber count" criterion
- ViewManager subscribes to StateCoordinator for data change notifications, forwards to current view's render()

**Loading & Error States**
- Loading: show a centered spinner (CSS animation, not SVG) with "Loading..." text below — appears after 200ms delay (avoid flash for fast queries)
- Error: inline banner at top of view area with error message + "Retry" button — red-tinted background, not a modal/toast
- Empty state: centered message "No cards match current filters" when query returns zero results

### Claude's Discretion
- Exact card dimensions (width, height, padding) — follow design system spacing scale
- Sort control UI specifics (dropdown vs segmented control vs icon buttons)
- Stagger timing for individual card animations during transitions
- Spinner design and animation details
- Whether GridView cells show a subtle border or rely on spacing alone
- Kanban column width (fixed vs flexible)

### Deferred Ideas (OUT OF SCOPE)
- Table View — full data table with column sorting/filtering
- Selection highlighting in views — SelectionProvider integration for multi-select (Tier 3, not persisted)
- Keyboard navigation within views (arrow keys to move between cards)
- Card detail panel / expand-on-click — separate interaction layer
- View-specific settings persistence (zoom level, column widths)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-01 | ListView renders cards as a single-column list with sort controls | D3 selectAll/data/join on SVG `<g>` groups, translate(0, i*rowHeight), QueryBuilder.buildCardQuery() |
| VIEW-02 | GridView renders cards in a two-axis grid with PAFVProvider axis mappings | D3 data join with Math.floor(width/cellWidth) column wrapping, PAFVProvider.compile().orderBy |
| VIEW-03 | KanbanView renders cards in columns grouped by category field with drag-drop | HTML div columns, d3.group() grouping, HTML5 dataTransfer drag-drop API, MutationManager.execute() |
| VIEW-09 | Every D3 `.data()` call uses a stable key function (`d => d.id`) | D3 data(data, d => d.id) — prevents index-based DOM reuse, enables stable morph transitions |
| VIEW-10 | ViewManager mounts/unmounts views and calls `destroy()` before switching | Interface IView { mount, destroy, render }, ViewManager.switchTo() calls destroy() then mount() |
| VIEW-11 | Each view applies view-specific defaults from a VIEW_DEFAULTS map on first mount | PAFVProvider.VIEW_DEFAULTS already defined; views call setViewType() on mount if first-time |
| VIEW-12 | KanbanView drag-drop triggers mutations through MutationManager (undoable) | updateCardMutation(id, beforeCard, { status: newColumn }) → MutationManager.execute() |
| REND-03 | Animated view transitions morph cards between LATCH views using d3-transition | d3-transition, easeCubicOut, 400ms, selection.transition().attr('transform', newPos) |
| REND-04 | Cross-family transitions (LATCH↔GRAPH) use crossfade instead of morph | Opacity fade: out current container (300ms), in new container (300ms) |
| REND-07 | Views show loading state during Worker query execution | 200ms debounced spinner via setTimeout, CSS animation, cleared on data arrival |
| REND-08 | Failed queries display error messages in views, not blank screens | Error banner with retry button; WorkerBridge rejection → catch → error state |
</phase_requirements>

---

## Summary

Phase 5 establishes the canonical D3 data-join rendering pattern for all subsequent views. The core technical challenge is threefold: (1) building a proper D3 data-join view contract with stable key functions, (2) implementing cross-view morph transitions that make the "data-as-projection" insight visible, and (3) integrating KanbanView drag-drop with the MutationManager so column changes are fully undoable.

The D3 data join pattern (`selectAll → data(key) → join(enter, update, exit)`) is the structural backbone. Every view MUST use `d => d.id` as the key function so D3 tracks cards by identity rather than array index. Without this, sort/filter changes cause arbitrary DOM churn and transitions animate to wrong positions. This is a locked architectural decision that cannot be retrofitted after the views exist.

Testing D3 DOM-manipulating code requires the jsdom environment (not the current global `node` environment). The current `vitest.config.ts` uses `environment: 'node'` globally; view tests need `// @vitest-environment jsdom` docblocks at the top of each view test file. D3 transitions complicate testing further: the recommended approach is to stub `performance.now = () => Infinity` and call `d3.timerFlush()` to flush transitions synchronously, or to simply test DOM state before and after data joins without asserting transition intermediates.

**Primary recommendation:** Build the IView interface contract first, wire the ViewManager lifecycle, then implement views in order of complexity: ListView (simplest) → GridView → KanbanView (most complex). Establish transition infrastructure after the first two views are rendering correctly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3 | 7.9.0 | Data joins, transitions, scales, grouping | Locked dependency (D-001); already in project per STATE.md |
| @types/d3 | 7.4.3 | TypeScript types for D3 | Required for strict TypeScript; per STATE.md |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-ease | (bundled in d3@7.9.0) | Easing functions for transitions | Use `d3.easeCubicOut` for LATCH morphs (400ms ease-out), linear for crossfade |
| d3-transition | (bundled in d3@7.9.0) | selection.transition() | LATCH-family position morph transitions |
| vitest (jsdom) | 4.0.18 (already installed) | DOM testing environment for view unit tests | Per-file `@vitest-environment jsdom` docblock |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML5 native drag-drop | d3-drag | d3-drag intercepts and prevents native dragstart/selectstart events — incompatible with HTML5 dataTransfer API needed for cross-column Kanban. Native HTML5 is correct here. |
| SVG `<g>` for Kanban cards | HTML `<div>` for Kanban | HTML5 drag-drop requires HTML elements (locked decision) |
| Global jsdom environment | Per-file jsdom docblock | Per-file is correct: WASM tests (database, mutations, providers) MUST stay in `node` environment; only view tests need jsdom |

**Installation:**
```bash
# d3 and @types/d3 not yet installed — add to project (per STATE.md phase 3 entry)
npm install d3@7.9.0
npm install --save-dev @types/d3@7.4.3
```

Note: `@vitest/web-worker@4.0.18` is also pending from STATE.md (needed for Phase 3 Worker Bridge). D3 installation should be done in Wave 0 of this phase.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── views/
│   ├── types.ts              # IView interface, CardDatum type, ViewState
│   ├── CardRenderer.ts       # Shared card rendering function (SVG + HTML variants)
│   ├── ViewManager.ts        # Mount/destroy lifecycle, StateCoordinator forwarding
│   ├── ListView.ts           # SVG-based list, sort toolbar, QueryBuilder.buildCardQuery()
│   ├── GridView.ts           # SVG-based grid, Math.floor(width/cellWidth) layout
│   └── KanbanView.ts         # HTML-based columns, drag-drop, d3.group() grouping
├── styles/
│   ├── design-tokens.css     # CSS variables from D3Components.md (if not already present)
│   └── views.css             # View-specific styles: spinner, error banner, kanban columns
tests/
└── views/
    ├── ListView.test.ts       # @vitest-environment jsdom
    ├── GridView.test.ts       # @vitest-environment jsdom
    ├── KanbanView.test.ts     # @vitest-environment jsdom
    └── ViewManager.test.ts    # @vitest-environment jsdom
```

### Pattern 1: IView Interface Contract

**What:** All views implement a common interface enabling ViewManager to manage them uniformly.
**When to use:** Every view class. This contract is the structural foundation of Phase 5 and all subsequent views.

```typescript
// Source: D3Components.md + Views.md canonical contract
export interface IView {
  /** Mount the view into the container element. Called once per view instance. */
  mount(container: HTMLElement): void;

  /** Re-render with new card data. Called by ViewManager on StateCoordinator notifications. */
  render(cards: CardDatum[]): void;

  /** Tear down: unsubscribe from StateCoordinator, clear DOM, cancel pending timers. */
  destroy(): void;
}

export interface CardDatum {
  id: string;
  name: string;
  folder: string | null;
  status: string | null;
  card_type: 'note' | 'task' | 'event' | 'resource' | 'person';
  created_at: string;
  modified_at: string;
  priority: number;
  // ...other fields as needed per view
}
```

### Pattern 2: D3 Data Join with Stable Key Function

**What:** The canonical selectAll → data(key) → join pattern that ALL views MUST follow.
**When to use:** Every D3 render call. The key function `d => d.id` is a hard requirement (VIEW-09).

```typescript
// Source: https://d3js.org/d3-selection/joining
// CRITICAL: d => d.id prevents index-based DOM reuse

// SVG-based views (List, Grid):
const groups = svg.selectAll<SVGGElement, CardDatum>('g.card')
  .data(cards, d => d.id)           // key function: MANDATORY
  .join(
    enter => enter.append('g')
      .attr('class', 'card')
      .call(renderCardEnter)        // set initial position + content
      .attr('opacity', 0)
      .call(g => g.transition()
        .duration(200)
        .attr('opacity', 1)),       // fade in on enter
    update => update,               // position update handled by transition below
    exit => exit
      .call(g => g.transition()
        .duration(200)
        .attr('opacity', 0)
        .remove())                  // fade out on exit
  );

// After join, animate ALL cards (enter + update) to new positions:
svg.selectAll<SVGGElement, CardDatum>('g.card')
  .transition()
  .duration(400)
  .ease(d3.easeCubicOut)
  .delay((_, i) => i * 15)         // stagger: 15ms per card (discretion)
  .attr('transform', (d, i) => computePosition(d, i));
```

### Pattern 3: ViewManager Lifecycle

**What:** ViewManager manages one active view at a time, calling destroy() before switching.
**When to use:** This is the only entry point for view switching (VIEW-10).

```typescript
// Source: CONTEXT.md + StateCoordinator pattern (Phase 4)
export class ViewManager {
  private currentView: IView | null = null;
  private coordinatorUnsub: (() => void) | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly coordinator: StateCoordinator,
    private readonly bridge: WorkerBridge,
    private readonly queryBuilder: QueryBuilder
  ) {}

  async switchTo(viewType: ViewType): Promise<void> {
    // 1. Destroy current view FIRST (prevents subscriber leaks)
    if (this.currentView) {
      this.currentView.destroy();
      this.currentView = null;
    }
    if (this.coordinatorUnsub) {
      this.coordinatorUnsub();
      this.coordinatorUnsub = null;
    }

    // 2. Clear container
    this.container.innerHTML = '';

    // 3. Mount new view
    const view = createView(viewType, this.bridge, this.queryBuilder);
    view.mount(this.container);
    this.currentView = view;

    // 4. Subscribe to StateCoordinator — forward to view.render()
    this.coordinatorUnsub = this.coordinator.subscribe(async () => {
      const cards = await this.fetchCards();
      view.render(cards);
    });

    // 5. Initial fetch
    const cards = await this.fetchCards();
    view.render(cards);
  }

  destroy(): void {
    this.currentView?.destroy();
    this.coordinatorUnsub?.();
    this.currentView = null;
    this.coordinatorUnsub = null;
  }
}
```

### Pattern 4: LATCH Morph Transition (List ↔ Grid ↔ Kanban)

**What:** Cards animate from old positions to new positions using d3-transition. The shared SVG container persists across view switches; only the position computation changes.
**When to use:** Switching between List, Grid (both SVG). Note: Kanban is HTML, so List/Grid ↔ Kanban requires crossfade (see Pattern 5).

```typescript
// Source: https://d3js.org/d3-transition
// NOTE: Only possible when BOTH views use SVG. List ↔ Grid can true-morph.
// List/Grid ↔ Kanban must use crossfade because DOM types differ (SVG vs HTML).

function morphToNewLayout(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  cards: CardDatum[],
  computePosition: (d: CardDatum, i: number) => string,
  duration = 400
): void {
  svg.selectAll<SVGGElement, CardDatum>('g.card')
    .data(cards, d => d.id)   // MANDATORY key function
    .join(
      enter => enter.append('g').attr('class', 'card')
        .call(renderCardContent)
        .attr('opacity', 0)
        .attr('transform', (d, i) => computePosition(d, i)),
      update => update,
      exit => exit.transition()
        .duration(200)
        .attr('opacity', 0)
        .remove()
    )
    .transition()
    .duration(duration)
    .ease(d3.easeCubicOut)
    .delay((_, i) => i * 15)
    .attr('transform', (d, i) => computePosition(d, i))
    .attr('opacity', 1);
}
```

### Pattern 5: Cross-Family Crossfade Transition

**What:** Opacity-based crossfade for LATCH↔GRAPH family switches (and List/Grid↔Kanban since DOM types differ). The old container fades out while the new one fades in.
**When to use:** Any transition where DOM types differ OR crossing LATCH/GRAPH family boundary (REND-04).

```typescript
// Source: D3 transition opacity pattern + CONTEXT.md 300ms crossfade decision
async function crossfadeTransition(
  container: HTMLElement,
  mountNewView: (el: HTMLElement) => void,
  duration = 300
): Promise<void> {
  const outgoing = container.querySelector('.view-root') as HTMLElement | null;

  // Fade out outgoing view
  if (outgoing) {
    await new Promise<void>(resolve => {
      d3.select(outgoing)
        .transition()
        .duration(duration)
        .style('opacity', '0')
        .on('end', () => resolve());
    });
    outgoing.remove();
  }

  // Mount new view (starts at opacity 0)
  const incoming = document.createElement('div');
  incoming.className = 'view-root';
  incoming.style.opacity = '0';
  container.appendChild(incoming);
  mountNewView(incoming);

  // Fade in incoming view
  d3.select(incoming)
    .transition()
    .duration(duration)
    .style('opacity', '1');
}
```

### Pattern 6: Loading and Error State Management

**What:** 200ms debounced loading spinner (avoids flash for fast queries), inline error banner with retry.
**When to use:** Every async data fetch in every view.

```typescript
// Source: CONTEXT.md locked decisions for loading/error states
class ViewState {
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;

  showLoading(container: HTMLElement): void {
    // 200ms delay prevents spinner flash for fast (<200ms) queries
    this.loadingTimer = setTimeout(() => {
      // Insert spinner HTML — CSS animation spinner
      container.innerHTML = `
        <div class="view-loading">
          <div class="spinner"></div>
          <div class="spinner-label">Loading...</div>
        </div>`;
    }, 200);
  }

  clearLoading(container: HTMLElement): void {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    container.querySelector('.view-loading')?.remove();
  }

  showError(container: HTMLElement, message: string, onRetry: () => void): void {
    this.clearLoading(container);
    const banner = document.createElement('div');
    banner.className = 'view-error-banner';
    banner.innerHTML = `
      <span class="error-message">${message}</span>
      <button class="retry-btn">Retry</button>`;
    banner.querySelector('.retry-btn')!.addEventListener('click', onRetry);
    container.prepend(banner);
  }
}
```

### Pattern 7: KanbanView Drag-Drop with MutationManager

**What:** HTML5 dataTransfer API for drag-drop; on drop, fire an updateCardMutation and execute via MutationManager.
**When to use:** KanbanView only (VIEW-03, VIEW-12).

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Kanban_board
// Store card ID in dataTransfer, retrieve on drop to build mutation

// On card element (dragstart):
cardEl.setAttribute('draggable', 'true');
cardEl.addEventListener('dragstart', (e) => {
  e.dataTransfer!.setData('text/x-kanban-card-id', card.id);
  e.dataTransfer!.effectAllowed = 'move';
  cardEl.classList.add('dragging');  // visual feedback: opacity 0.4
});

cardEl.addEventListener('dragend', () => {
  cardEl.classList.remove('dragging');
});

// On column drop zone (dragover + drop):
columnEl.addEventListener('dragover', (e) => {
  if (e.dataTransfer!.types.includes('text/x-kanban-card-id')) {
    e.preventDefault();  // required to allow drop
    columnEl.classList.add('drag-over');
  }
});

columnEl.addEventListener('dragleave', () => {
  columnEl.classList.remove('drag-over');
});

columnEl.addEventListener('drop', async (e) => {
  e.preventDefault();
  columnEl.classList.remove('drag-over');

  const cardId = e.dataTransfer!.getData('text/x-kanban-card-id');
  const targetColumn = columnEl.dataset['columnValue']!;  // e.g., "todo"

  // Fetch current card state (needed for inverse mutation)
  const beforeCard = cards.find(c => c.id === cardId);
  if (!beforeCard || beforeCard.status === targetColumn) return;

  // Build and execute mutation (fully undoable via Cmd+Z)
  const mutation = updateCardMutation(cardId, beforeCard as Card, {
    status: targetColumn
  });
  await mutationManager.execute(mutation);
  // ViewManager will re-render via StateCoordinator notification
});
```

### Pattern 8: ListView Position Computation

**What:** Single-column SVG list with fixed row height.

```typescript
// Source: Views.md D3 implementation
const ROW_HEIGHT = 48;  // px — fixed for clean alignment

function computeListPosition(_d: CardDatum, i: number): string {
  return `translate(0, ${i * ROW_HEIGHT})`;
}
```

### Pattern 9: GridView Position Computation

**What:** Responsive grid wrapping based on container width.

```typescript
// Source: Views.md D3 implementation
const CELL_WIDTH = 180;
const CELL_HEIGHT = 120;

function computeGridPosition(_d: CardDatum, i: number, containerWidth: number): string {
  const cols = Math.max(1, Math.floor(containerWidth / CELL_WIDTH));
  const col = i % cols;
  const row = Math.floor(i / cols);
  return `translate(${col * CELL_WIDTH}, ${row * CELL_HEIGHT})`;
}
```

### Anti-Patterns to Avoid

- **Missing key function on .data():** `svg.selectAll('g').data(cards)` without `d => d.id` causes D3 to match by array index, corrupting animations and breaking VIEW-09.
- **Destroying old view AFTER mounting new view:** ViewManager MUST call `destroy()` before `mount()` — mounting first causes duplicate StateCoordinator subscriptions.
- **d3-drag for KanbanView:** d3-drag intercepts `dragstart` and calls `preventDefault()`, which breaks HTML5 dataTransfer. Use native HTML5 drag-drop events on HTML elements instead.
- **Calling `this.currentView.destroy()` inside the subscribe callback:** The callback fires asynchronously; the view may already be destroyed. Always guard with null checks.
- **Showing spinner immediately on every render:** Causes flash for sub-200ms Worker queries. The 200ms `setTimeout` before showing spinner is mandatory.
- **Testing D3 view files with `environment: 'node'`:** D3 DOM manipulation requires `document` and `window`. Mark all view test files with `// @vitest-environment jsdom` at the top.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Easing functions | Custom cubic-bezier math | `d3.easeCubicOut` from bundled d3-ease | d3-ease provides 40+ named functions with correct math; wrong easing feels "off" |
| Card position interpolation | Custom tween logic | `transition.attr('transform', fn)` | D3 transition automatically interpolates transform strings (translate values) |
| Grouping cards by status | Manual array grouping | `d3.group(cards, d => d.status)` | d3-array group() returns Map with correct key ordering |
| Timer debounce for loading spinner | Custom debounce | `setTimeout` + `clearTimeout` pattern | Simple enough; hand-rolling is fine here |
| DOM element creation for Kanban | D3 selection append | Direct `document.createElement` + classList | D3 works fine for HTML too, but native DOM is cleaner for event-heavy Kanban |

**Key insight:** D3 transitions handle interpolation, easing, and sequencing automatically. Never implement custom animation loops (`requestAnimationFrame` manually) for anything D3 can express as a transition.

---

## Common Pitfalls

### Pitfall 1: Missing Key Function Causes Wrong Transitions
**What goes wrong:** Cards animate to wrong positions on sort/filter changes; entering cards appear at exit positions.
**Why it happens:** Without `d => d.id`, D3 matches data to elements by array index. When sort order changes, element[0] gets datum[0] regardless of ID — the element doesn't "move", it just gets a new datum with a new position, causing adjacent elements to swap instead of the correct card flying to its new slot.
**How to avoid:** EVERY `.data()` call gets the key function. No exceptions. Enforce via code review checklist.
**Warning signs:** Transitions look like random shuffles rather than cards flying to correct positions.

### Pitfall 2: Subscriber Leak on View Switch
**What goes wrong:** After 10 mount/destroy cycles, StateCoordinator has 10 active subscribers for the same view slot — each render triggers 10 queries and 10 DOM updates.
**Why it happens:** ViewManager calls `coordinator.subscribe()` on each `switchTo()` but doesn't call the returned unsubscribe function before the next switch.
**How to avoid:** Store the unsubscribe function; call it at the start of `switchTo()` AND in `ViewManager.destroy()`. Mirror the pattern from Phase 4's `StateCoordinator` tests.
**Warning signs:** Re-renders multiply with each view switch; memory grows linearly.

### Pitfall 3: d3-drag Breaks HTML5 Kanban Drag-Drop
**What goes wrong:** Cards cannot be dragged if d3-drag is attached to the card elements — d3-drag calls `event.preventDefault()` on `dragstart`, which prevents the browser from starting the native drag gesture that dataTransfer requires.
**Why it happens:** d3-drag is designed for custom drag/mouse tracking, not HTML5 dataTransfer-based DnD. They are incompatible patterns.
**How to avoid:** Do NOT use d3-drag on KanbanView cards. Use `element.setAttribute('draggable', 'true')` and native `dragstart/dragover/drop` event listeners.
**Warning signs:** Cards don't lift on drag, or `dataTransfer.getData()` returns empty string.

### Pitfall 4: D3 Transition Tests Fail in Node Environment
**What goes wrong:** `document is not defined` errors or `d3.select` returns empty selections in view unit tests.
**Why it happens:** The global `vitest.config.ts` sets `environment: 'node'`. D3 DOM manipulation requires browser globals (`document`, `window`, `SVGElement`).
**How to avoid:** Add `// @vitest-environment jsdom` as the FIRST line of every test file in `tests/views/`. This overrides the global node environment for that file only. The WASM/provider/mutation tests in other directories continue running in `node` (correct).
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'createElement')` or selections with zero-length.

### Pitfall 5: Transition Testing — Async Timing
**What goes wrong:** Tests asserting transition end-state DOM values fail because transitions are asynchronous.
**Why it happens:** `selection.transition().attr('transform', fn)` schedules changes over time using `performance.now()`. Tests complete before transitions finish.
**How to avoid:** Two options:
1. **Recommended:** Test DOM structure and data join correctness (enter/update/exit) without testing transition intermediates. Verify that after `render(cards)`, the correct number of `<g.card>` elements exist with correct data bound — not their final transform values.
2. **If transition end state must be tested:** Stub `performance.now = () => Infinity` and call `d3.timerFlush()` to synchronously complete all pending transitions.
**Warning signs:** Tests pass in isolation but fail under fake timers; intermittent failures.

### Pitfall 6: KanbanView Empty Column Missing
**What goes wrong:** When all cards are moved out of a status column, the column disappears entirely instead of showing an empty state.
**Why it happens:** `d3.group(cards, d => d.status)` only includes groups that have at least one card. Columns derived from this Map omit empty statuses.
**How to avoid:** Pre-compute the full column domain from PAFVProvider's groupBy field. Enumerate all known values (from a `SELECT DISTINCT ${groupByField} FROM cards` or from a static allowlist), then merge with d3.group() output. Render a column for each domain value regardless of whether d3.group() returned it.
**Warning signs:** Columns disappear during testing; cards that were dragged to empty a column cannot receive drops.

### Pitfall 7: SVG Height Not Updated on Card Count Change
**What goes wrong:** ListView SVG is clipped or has extra empty space when card count changes.
**Why it happens:** SVG `height` attribute is set on mount but not updated when data changes.
**How to avoid:** In ListView.render(), update `svg.attr('height', cards.length * ROW_HEIGHT + PADDING)` before applying the data join and transition.
**Warning signs:** Cards at the bottom are clipped; scrolling doesn't reach them.

---

## Code Examples

Verified patterns from official sources and project codebase:

### Canonical D3 Data Join (from d3js.org)
```typescript
// Source: https://d3js.org/d3-selection/joining
// Key function (d => d.id) is MANDATORY for stable transitions

const cards = svg.selectAll<SVGGElement, CardDatum>('g.card')
  .data(data, d => d.id)
  .join(
    enter => enter.append('g').attr('class', 'card'),
    update => update,
    exit => exit.remove()
  );
```

### D3 Transition with Ease (from d3js.org/d3-transition)
```typescript
// Source: https://d3js.org/d3-transition + https://d3js.org/d3-ease
// easeCubicOut: fast start, slow finish — maps to CONTEXT.md "ease-out-cubic"

selection.transition()
  .duration(400)
  .ease(d3.easeCubicOut)
  .attr('transform', (d, i) => `translate(${x}, ${y})`);
```

### StateCoordinator Subscribe Pattern (from Phase 4 codebase)
```typescript
// Source: src/providers/StateCoordinator.ts
// Return value of subscribe() MUST be stored and called in destroy()

const unsub = coordinator.subscribe(() => {
  this.fetchAndRender();
});
// In destroy():
unsub();
```

### Per-File Vitest jsdom Environment (from vitest.dev docs)
```typescript
// Source: https://vitest.dev/guide/environment
// Place on LINE 1 of every tests/views/*.test.ts file

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
// ... test code using document, SVGElement, etc.
```

### d3.group() for Kanban Columns (from d3-array)
```typescript
// Source: bundled d3-array (part of d3@7.9.0)
// Returns Map<string, CardDatum[]> — iterate for column rendering

const grouped: Map<string, CardDatum[]> = d3.group(cards, d => d.status ?? 'none');

for (const [columnValue, columnCards] of grouped) {
  renderColumn(columnEl, columnValue, columnCards);
}
```

### timerFlush for Transition Tests (from github.com/d3/d3 issue #1789)
```typescript
// Source: https://github.com/d3/d3/issues/1789
// Only needed when testing transition END STATE — prefer testing data join structure instead

import * as d3 from 'd3';

// Flush all pending D3 transitions synchronously:
const originalNow = performance.now.bind(performance);
performance.now = () => Infinity;
d3.timerFlush();
performance.now = originalNow;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.enter().append().exit().remove()` manual 3-phase | `.join(enter, update, exit)` unified | D3 v5 | Cleaner, less boilerplate, enter+update share chained calls |
| `d3.layout` for positioning | Manual position math + `d3.group()` | D3 v4-v5 | Layouts removed; explicit math is clearer and more flexible |
| `d3.drag()` for all drag interactions | HTML5 native drag-drop for dataTransfer DnD | D3 v4+ | d3-drag doesn't expose dataTransfer; native API required for HTML DnD |
| `d3.ease.cubicOut` (v3 syntax) | `d3.easeCubicOut` (v4+ syntax) | D3 v4 | Function reference, not method chain |

**Deprecated/outdated:**
- `d3.layout.tree()`, `d3.layout.force()`: Replaced by `d3.tree()`, `d3.forceSimulation()` in v4.
- `d3.select().enter().append()` then `.exit().remove()` as separate chains: Replaced by `.join()` in v5.
- `d3.ease('cubic-out')` string syntax: Replaced by `d3.easeCubicOut` function reference in v4.

---

## Open Questions

1. **D3 installation timing**
   - What we know: `d3@7.9.0` and `@types/d3@7.4.3` are listed in STATE.md as "Dependencies to Add (Phase 3 setup)" but are NOT in `package.json` yet.
   - What's unclear: Were they installed in Phase 3 (not yet planned/executed) or deferred?
   - Recommendation: Wave 0 of Phase 5 must `npm install d3@7.9.0` and `npm install --save-dev @types/d3@7.4.3`. Confirm with `node -e "require('d3')"` before writing any D3 code.

2. **WorkerBridge availability for Phase 5 views**
   - What we know: Phase 3 (Worker Bridge) is listed as pending in STATE.md. Views need `bridge.send('db:query', ...)` for data fetching.
   - What's unclear: Is Phase 3 complete before Phase 5 starts, or does Phase 5 need a bridge mock/stub?
   - Recommendation: Per the roadmap, Phase 5 depends on Phase 4 (complete), not explicitly Phase 3. If Phase 3 is incomplete, views should accept a `WorkerBridge`-shaped interface and test with a mock bridge identical to the MutationBridge mock pattern from Phase 4.

3. **SVG vs HTML for List/Grid morph transition**
   - What we know: List and Grid are both SVG (locked). Kanban is HTML (locked).
   - What's unclear: List ↔ Kanban and Grid ↔ Kanban transitions — can we true-morph SVG cards into HTML divs?
   - Recommendation: No. SVG `<g>` elements cannot morph into HTML `<div>` elements. List↔Kanban and Grid↔Kanban MUST use crossfade (Pattern 5), even though they are both LATCH family. List↔Grid CAN true-morph. ViewManager must detect whether both views are SVG-based or cross the SVG/HTML boundary when choosing transition type.

4. **Card data shape for views**
   - What we know: Views use `QueryBuilder.buildCardQuery()` → `bridge.send('db:exec', ...)` → rows from `cards` table.
   - What's unclear: The Worker bridge response type for `db:exec` — what does the row array look like?
   - Recommendation: Views should define a minimal `CardDatum` interface using fields they actually render (id, name, folder, status, card_type, created_at, modified_at, priority). Map from the raw Worker response in a `parseCards()` function.

---

## Integration Points (Phase 4 Assets Ready to Use)

These Phase 4 classes are already implemented and can be used directly:

| Asset | File | How Views Use It |
|-------|------|-----------------|
| `StateCoordinator` | `src/providers/StateCoordinator.ts` | `coordinator.subscribe(cb)` → re-render; `unsub()` in destroy() |
| `QueryBuilder` | `src/providers/QueryBuilder.ts` | `qb.buildCardQuery({ limit: 500 })` → `{ sql, params }` for Worker |
| `PAFVProvider` | `src/providers/PAFVProvider.ts` | `pafv.compile().orderBy` for sort; `pafv.compile().groupBy` for Kanban columns |
| `MutationManager` | `src/mutations/MutationManager.ts` | `mm.execute(mutation)` for Kanban drag-drop |
| `updateCardMutation` | `src/mutations/inverses.ts` | `updateCardMutation(id, before, { status: newCol })` → Mutation object |
| CSS design tokens | `v5/Modules/D3Components.md` | `--bg-card`, `--text-primary`, `--space-*`, `--radius-*` CSS variables |

---

## Sources

### Primary (HIGH confidence)
- https://d3js.org/d3-selection/joining — D3 data join API, selection.join(), key function patterns
- https://d3js.org/d3-transition — D3 transition API, duration, ease, attr, style
- https://d3js.org/d3-ease — Named easing functions; confirmed `d3.easeCubicOut` for "ease-out-cubic"
- https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Kanban_board — HTML5 drag-drop for kanban boards
- https://vitest.dev/guide/environment — Per-file `@vitest-environment jsdom` docblock
- Project codebase: `src/providers/StateCoordinator.ts`, `src/mutations/MutationManager.ts`, `src/providers/PAFVProvider.ts` — integration patterns

### Secondary (MEDIUM confidence)
- https://github.com/d3/d3/issues/1789 — D3 transition testing via `performance.now = () => Infinity` + `d3.timerFlush()`
- https://www.d3indepth.com/transitions/ — D3 transition behavior documentation
- `v5/Modules/D3Components.md` — Project design system (CSS variables, spacing, typography)
- `v5/Modules/Views.md` — Project view architecture and D3 implementation examples

### Tertiary (LOW confidence)
- WebSearch results on D3 transition testing with Vitest — limited specific 2025 documentation found; timerFlush approach is from 2016-era issue tracker and may have changed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — D3 v7.9.0 is locked in project (D-001); API verified from official docs
- Architecture patterns: HIGH — IView interface, ViewManager lifecycle are derived from CONTEXT.md locked decisions and existing Phase 4 patterns
- Transition mechanics: HIGH — verified from d3js.org/d3-transition and d3js.org/d3-ease official docs
- Drag-drop: HIGH — verified from MDN Kanban board official documentation
- Pitfalls: HIGH (subscriber leak, key function) / MEDIUM (transition test approach — timerFlush from older source)
- Testing environment: HIGH — `@vitest-environment jsdom` per-file docblock verified from vitest.dev

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (D3 API is stable; vitest environment API is stable)
