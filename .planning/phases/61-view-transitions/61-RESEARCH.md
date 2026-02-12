# Phase 61: View Transitions - Research

**Researched:** 2026-02-12
**Domain:** D3.js v7 animated transitions, object constancy, state preservation
**Confidence:** HIGH

## Summary

Phase 61 implements smooth animated view transitions when users change PAFV axis mappings in the Navigator. The existing codebase already has foundation pieces (GridRenderingEngine with card positioning, PAFVContext for state, SelectionContext for preserving selections), but lacks coordinated animation between cards and headers during axis remapping.

D3.js v7's transition system provides native support for this use case through `.transition()` chained with `.join()`, with key functions ensuring "object constancy" — visual tracking of elements through animation. The 300ms animation standard aligns with D3 best practices (200-500ms range for smooth but snappy interactions).

**Primary recommendation:** Use D3's `.join()` with key functions (`d => d.id`) for cards and headers, apply `.transition().duration(300)` inside enter/update/exit callbacks, coordinate multi-element animations with staggered delays, and leverage PAFVContext state changes as animation triggers.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7 | Transitions and data binding | Industry standard for data-driven animations, selection.join() is canonical pattern |
| d3-transition | v7 (bundled) | Animation interpolation | Built-in, handles colors/numbers/transforms automatically |
| d3-ease | v7 (bundled) | Easing functions | Provides easeCubicOut and other motion profiles |

**Note:** Project already uses D3.js v7 throughout. No new dependencies required.

### Existing Codebase Components
| Component | Location | Purpose | Integration Point |
|-----------|----------|---------|-------------------|
| GridRenderingEngine | `src/d3/grid-rendering/GridRenderingEngine.ts` | Card and header rendering | Add transitions to `.renderCards()` and `.renderProjectionHeaders()` |
| PAFVContext | `src/state/PAFVContext.tsx` | Axis mapping state | Listen for `state.mappings` changes to trigger transitions |
| SelectionContext | `src/state/SelectionContext.tsx` | Selected card IDs | Preserve selectedIds Set across re-renders |
| HeaderAnimationSystem | `src/d3/header-animation/HeaderAnimationSystem.ts` | Header expand/collapse | Pattern reference for coordinated animations |
| TransitionManager | `src/d3/viewcontinuum/transitionManager.ts` | View switching | Pattern reference for transition lifecycle |

**Installation:**
```bash
# No new packages needed - D3.js v7 already installed
# Verify current version:
npm list d3
```

## Architecture Patterns

### Recommended Transition Flow

```
User changes axis mapping in Navigator
    ↓
PAFVContext.setMapping() called
    ↓
React re-renders with new state
    ↓
GridRenderingEngine.render() called
    ↓
computeAllPositions() recalculates card.x, card.y
    ↓
renderCards() with D3 .join() + .transition()
    ↓
Cards animate to new positions (300ms)
    ↓
renderProjectionHeaders() with transitions
    ↓
Headers animate to new structure (300ms)
```

### Pattern 1: Object Constancy with Key Functions

**What:** Using stable IDs in D3's data join to track elements through transitions
**When to use:** Always — critical for preserving visual identity during animations

**Example:**
```typescript
// Source: D3 Official Documentation + Object Constancy article
// https://bost.ocks.org/mike/constancy/

// BAD: Default join-by-index (misleading during reordering)
selection.data(cards).join("g")

// GOOD: Explicit key function ensures visual tracking
selection
  .data(cards, d => d.id)  // Key function: returns unique ID
  .join("g")
```

**Why it matters:** Without key functions, D3 matches elements by array position. When data reorders (axis change), the wrong elements animate to wrong positions, breaking visual continuity.

### Pattern 2: Transitions in .join() Enter/Update/Exit

**What:** Applying animations separately to entering, updating, and exiting elements
**When to use:** During axis remapping where cards may move, appear, or disappear

**Example:**
```typescript
// Source: D3 selection.join() documentation
// https://d3js.org/d3-selection/joining

cardContainer
  .selectAll(".card")
  .data(cards, d => d.id)
  .join(
    // Enter: New cards fade in at target position
    enter => enter.append("g")
      .attr("class", "card")
      .attr("transform", d => `translate(${d.x}, ${d.y})`)
      .attr("opacity", 0)
      .transition()
        .duration(300)
        .attr("opacity", 1),

    // Update: Existing cards move to new positions
    update => update
      .transition()
        .duration(300)
        .attr("transform", d => `translate(${d.x}, ${d.y})`),

    // Exit: Removed cards fade out
    exit => exit
      .transition()
        .duration(300)
        .attr("opacity", 0)
        .remove()
  );
```

**Critical detail:** If enter/update functions return transitions, D3 merges underlying selections and returns them from `.join()`.

### Pattern 3: Coordinated Multi-Element Animations

**What:** Headers and cards animating simultaneously with optional staggering
**When to use:** When both structure (headers) and content (cards) change together

**Example:**
```typescript
// Source: D3 transitions coordination patterns
// https://gramener.github.io/d3js-playbook/transitions.html

const ANIMATION_DURATION = 300;
const transitionId = `axis-change-${Date.now()}`;

// 1. Start header transitions (stagger by index for visual polish)
headerContainer
  .selectAll(".col-header")
  .data(newColumns, d => d)
  .join(
    enter => enter.append("g")
      .attr("class", "col-header")
      .attr("transform", (d, i) => `translate(${i * cellWidth}, 0)`)
      .attr("opacity", 0)
      .transition(transitionId)
        .delay((d, i) => i * 20)  // Stagger: 20ms per header
        .duration(ANIMATION_DURATION)
        .attr("opacity", 1),
    update => update
      .transition(transitionId)
        .delay((d, i) => i * 20)
        .duration(ANIMATION_DURATION)
        .attr("transform", (d, i) => `translate(${i * cellWidth}, 0)`)
  );

// 2. Coordinate card transitions (same duration, no delay)
cardContainer
  .selectAll(".card")
  .data(cards, d => d.id)
  .join(
    enter => /* ... enter transition ... */,
    update => update
      .transition(transitionId)  // Same ID = coordinated timing
        .duration(ANIMATION_DURATION)
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
  );
```

**Coordination technique:** Named transitions (`transitionId`) ensure all elements animate in sync, with optional per-element delays for staggering.

### Pattern 4: Selection State Preservation

**What:** Maintaining which cards are selected before/during/after transition
**When to use:** Always during view transitions (TRANS-03 requirement)

**Example:**
```typescript
// Source: Existing SelectionContext implementation
// src/state/SelectionContext.tsx

// BEFORE transition: Capture selected IDs
const selectedIds = new Set(selectionContext.selection.selectedIds);

// DURING transition: Re-render with new positions
// (React automatically preserves SelectionContext state)

// AFTER transition: D3 applies selected class based on preserved state
cardSelection
  .classed("selected", d => selectedIds.has(d.id))
  .select(".card-bg")
    .attr("stroke", d => selectedIds.has(d.id) ? "#2563eb" : "#e1e5e9")
    .attr("stroke-width", d => selectedIds.has(d.id) ? 2 : 1);
```

**Integration point:** SelectionContext is React-managed and persists across renders. D3 rendering code reads `selectedIds` and applies visual styling.

### Anti-Patterns to Avoid

**Anti-pattern 1: Starting transitions before positions computed**
```typescript
// BAD: Transition starts before card.x/card.y calculated
render() {
  this.renderCards();  // Starts transitions
  this.computeAllPositions(cards);  // TOO LATE
}

// GOOD: Compute positions first, then render with transitions
render() {
  this.computeAllPositions(cards);
  this.renderCards();  // Now has correct target positions
}
```

**Anti-pattern 2: Missing key functions during reordering**
```typescript
// BAD: Elements matched by index, visual identity lost
.data(cards)  // Default join-by-index

// GOOD: Explicit ID matching preserves identity
.data(cards, d => d.id)
```

**Anti-pattern 3: Interrupting transitions without cleanup**
```typescript
// BAD: New transition starts before old one cancelled
function onAxisChange() {
  render();  // Starts new transition, old one left running
}

// GOOD: Explicit interrupt before new transition
function onAxisChange() {
  container.selectAll(".card").interrupt();
  render();
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation interpolation | Custom tween functions for x/y positions | D3's built-in `.transition().attr()` | D3 automatically detects numeric attributes and interpolates linearly, handles edge cases |
| Easing curves | Custom cubic-bezier implementations | `d3.easeCubicOut` from d3-ease | 20+ built-in easing functions, optimized, widely recognized motion profiles |
| Transition interruption | Manual transition state tracking | `.interrupt()` method | D3 manages active transitions per element, handles cleanup, dispatches events |
| Object tracking | Custom ID→element mapping | Key functions in `.data(data, d => d.id)` | D3's internal identity map is battle-tested, handles duplicates, preserves DOM order |
| Staggered animations | setTimeout cascades | `.delay((d, i) => i * 20)` | Declarative, cancellable, coordinated with main transition lifecycle |

**Key insight:** D3 transitions are a "limited form of key frame animation with only two key frames: start and end." This constraint is actually ideal for view transitions — you specify where elements should end up, D3 handles the journey. Avoid overcomplicating by trying to build multi-stage animations; chain simple transitions instead.

## Common Pitfalls

### Pitfall 1: Forgetting to Recompute Positions Before Transition

**What goes wrong:** Cards animate to old positions because `computeAllPositions()` wasn't called after axis mapping changed.

**Why it happens:** GridRenderingEngine.render() flow isn't obvious — positions are computed separately from rendering.

**How to avoid:**
```typescript
// In GridRenderingEngine.render()
public render(activeFilters: unknown[] = []): void {
  // ... setup ...

  // CRITICAL: Compute positions BEFORE rendering
  if (this.currentData.cards) {
    if (this.currentProjection) {
      this.computeAllPositions(this.currentData.cards);  // ← MUST happen first
    }
  }

  this.renderCards();  // Now transitions to correct positions
}
```

**Warning signs:** Cards stay in place when axis changes, or snap to new positions without animating.

### Pitfall 2: Selection State Lost During Re-Render

**What goes wrong:** Selected cards lose their selection styling after axis change animation.

**Why it happens:** SelectionContext state is preserved (React manages it), but D3 rendering doesn't re-apply the selected class after updating card positions.

**How to avoid:**
```typescript
// In GridRenderingEngine.renderCards()
const selectedIds = /* get from SelectionContext */;

// After update transition, re-apply selection styling
cardSelection
  .transition()
    .duration(300)
    .attr("transform", d => `translate(${d.x}, ${d.y})`)
    .on("end", function(d) {  // ← Re-apply after transition
      d3.select(this)
        .classed("selected", selectedIds.has(d.id));
    });
```

**Warning signs:** Selected cards visible before transition, lose highlight after animation completes.

### Pitfall 3: Headers and Cards Animating Out of Sync

**What goes wrong:** Headers finish animating before cards, or vice versa, creating janky visual experience.

**Why it happens:** Separate `.transition()` calls with different durations or missing coordination.

**How to avoid:**
```typescript
const ANIMATION_DURATION = 300;

// Headers: Same duration as cards
headerContainer.selectAll(".col-header")
  .transition()
    .duration(ANIMATION_DURATION)  // ← Match card duration
    .attr("transform", ...);

// Cards: Same duration as headers
cardContainer.selectAll(".card")
  .transition()
    .duration(ANIMATION_DURATION)  // ← Match header duration
    .attr("transform", ...);
```

**Alternative: Named transitions for explicit coordination**
```typescript
const transitionId = "axis-change";

// Both use same transition name = coordinated
headerContainer.selectAll(".col-header")
  .transition(transitionId)
    .duration(300)
    .attr("transform", ...);

cardContainer.selectAll(".card")
  .transition(transitionId)
    .duration(300)
    .attr("transform", ...);
```

**Warning signs:** Visual delay between header movement and card movement, elements "catching up" to each other.

### Pitfall 4: Rapid Axis Changes Causing Animation Buildup

**What goes wrong:** User rapidly changes axes, multiple transitions queue up, animations stutter or freeze.

**Why it happens:** New transitions start without interrupting previous ones.

**How to avoid:**
```typescript
// In GridRenderingEngine.render(), before starting transitions
public render(activeFilters: unknown[] = []): void {
  // Interrupt any ongoing transitions
  this.container.selectAll(".card").interrupt();
  this.container.selectAll(".col-header").interrupt();
  this.container.selectAll(".row-header").interrupt();

  // Now safe to start new transitions
  this.renderCards();
  this.renderProjectionHeaders();
}
```

**Warning signs:** Animation speed varies with interaction frequency, UI feels sluggish after rapid clicking.

## Code Examples

Verified patterns from official sources and existing codebase:

### Animated Card Repositioning (TRANS-01)

```typescript
// Source: GridRenderingEngine.renderCards() + D3 transition patterns
// Location: src/d3/grid-rendering/GridRenderingEngine.ts

private renderCards(): void {
  const cardContainer = this.container.select('.grid-content');

  type CardRecord = Record<string, unknown>;

  const cardSelection = cardContainer
    .selectAll<SVGGElement, CardRecord>('.card')
    .data(
      this.currentData.cards as CardRecord[],
      (d: CardRecord) => String(d.id)  // Key function for object constancy
    );

  // Enter: New cards fade in
  const cardEnter = cardSelection
    .enter()
    .append('g')
    .attr('class', 'card')
    .attr('data-card-id', (d: CardRecord) => String(d.id))
    .attr('transform', (d: CardRecord) =>
      `translate(${(d.x as number) || 0}, ${(d.y as number) || 0})`
    )
    .attr('opacity', 0);

  // Add card visuals (rect, text, etc.)
  // ... (existing code) ...

  // Animate enter
  cardEnter
    .transition()
    .duration(this.config.enableAnimations ? 300 : 0)
    .attr('opacity', 1);

  // Update: Existing cards move to new positions
  cardSelection
    .transition()
    .duration(this.config.enableAnimations ? 300 : 0)
    .ease(d3.easeCubicOut)
    .attr('transform', (d: CardRecord) =>
      `translate(${(d.x as number) || 0}, ${(d.y as number) || 0})`
    );

  // Exit: Removed cards fade out
  cardSelection
    .exit()
    .transition()
    .duration(this.config.enableAnimations ? 200 : 0)
    .attr('opacity', 0)
    .remove();
}
```

### Coordinated Header Transitions (TRANS-02)

```typescript
// Source: GridRenderingEngine.renderProjectionHeaders() + stagger patterns
// Location: src/d3/grid-rendering/GridRenderingEngine.ts

private renderProjectionHeaders(): void {
  const headerContainer = this.container.select('.headers');
  const rowHeaderWidth = this.config.rowHeaderWidth;
  const { columns, rows } = this.currentHeaders!;
  const config = this.config;

  // Column headers with stagger
  headerContainer
    .selectAll<SVGGElement, string>('.col-header')
    .data(columns, d => d)  // Key function: column value
    .join(
      // Enter: New headers slide in from top
      enter => enter.append('g')
        .attr('class', 'col-header')
        .attr('transform', (_, i) =>
          `translate(${rowHeaderWidth + config.padding + i * (config.cardWidth + config.padding)}, -20)`
        )
        .attr('opacity', 0)
        .call(g => {
          // Add header visuals
          g.append('rect')
            .attr('width', config.cardWidth)
            .attr('height', config.headerHeight)
            .attr('fill', '#f0f0f0');
          g.append('text')
            .attr('x', config.cardWidth / 2)
            .attr('y', config.headerHeight / 2)
            .text(d => d);
        })
        .transition()
          .delay((_, i) => i * 20)  // Stagger: 20ms per header
          .duration(config.enableAnimations ? 300 : 0)
          .attr('transform', (_, i) =>
            `translate(${rowHeaderWidth + config.padding + i * (config.cardWidth + config.padding)}, 0)`
          )
          .attr('opacity', 1),

      // Update: Existing headers reposition
      update => update
        .transition()
          .delay((_, i) => i * 20)
          .duration(config.enableAnimations ? 300 : 0)
          .attr('transform', (_, i) =>
            `translate(${rowHeaderWidth + config.padding + i * (config.cardWidth + config.padding)}, 0)`
          ),

      // Exit: Old headers slide out
      exit => exit
        .transition()
          .duration(config.enableAnimations ? 200 : 0)
          .attr('transform', (_, i) =>
            `translate(${rowHeaderWidth + config.padding + i * (config.cardWidth + config.padding)}, -20)`
          )
          .attr('opacity', 0)
          .remove()
    );

  // Row headers (similar pattern, vertical axis)
  // ... (parallel implementation for rows) ...
}
```

### Selection Preservation (TRANS-03)

```typescript
// Source: SelectionContext integration pattern
// Location: Integration between SelectionContext and GridRenderingEngine

// In React component that wraps GridRenderingEngine:
const { selection } = useSelection();
const selectedIds = useMemo(
  () => selection.selectedIds,
  [selection.selectedIds]
);

// Pass to GridRenderingEngine via callback or prop:
gridEngine.updateCallbacks({
  onCardRender: (cardSelection) => {
    // Re-apply selection styling after transition
    cardSelection
      .classed('selected', d => selectedIds.has(d.id))
      .select('.card-bg')
        .attr('stroke', d => selectedIds.has(d.id) ? '#2563eb' : '#e1e5e9')
        .attr('stroke-width', d => selectedIds.has(d.id) ? 2 : 1);
  }
});
```

**Alternative: Within GridRenderingEngine**
```typescript
// Add method to accept selection state:
public setSelectedIds(selectedIds: Set<string>): void {
  this.selectedIds = selectedIds;
}

// In renderCards(), apply styling based on state:
cardEnter
  .append('rect')
  .attr('class', 'card-bg')
  .attr('stroke', (d: CardRecord) =>
    this.selectedIds?.has(String(d.id)) ? '#2563eb' : '#e1e5e9'
  )
  .attr('stroke-width', (d: CardRecord) =>
    this.selectedIds?.has(String(d.id)) ? 2 : 1
  );

// Update selection styling after transitions complete:
cardSelection
  .transition()
    .duration(300)
    .attr('transform', ...)
    .on('end', function(d: CardRecord) {
      d3.select(this).select('.card-bg')
        .attr('stroke', this.selectedIds?.has(String(d.id)) ? '#2563eb' : '#e1e5e9');
    }.bind(this));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual enter/update/exit | `.join()` with callbacks | D3 v5 (2018) | Simpler API, less boilerplate, better readability |
| Join-by-index (default) | Explicit key functions | Always available, best practice since v3 | Object constancy, visual tracking through transitions |
| Global transition names | Per-element transition IDs | D3 v4 (2016) | Better coordination, interrupt control |
| Custom interpolators | Built-in attribute detection | D3 v3+ (2012) | Automatic color/number/transform interpolation |
| Promise-based timing | Transition events `.on('end')` | D3 v4 (2016) | Better composition, no promise overhead |

**Deprecated/outdated:**
- `transition.each()` for coordination: Use named transitions or `.on('end')` chaining instead
- `d3.timer()` for custom animations: D3 transitions handle scheduling internally, use `.tween()` for custom interpolation
- `attrTween()` for simple numeric transitions: Built-in `.attr()` interpolation is sufficient for x/y positioning

## Open Questions

1. **Should nested/stacked headers animate differently than single-level headers?**
   - What we know: HeaderAnimationSystem exists with expand/collapse patterns, GridRenderingEngine has `renderNestedAxisHeaders()`
   - What's unclear: Whether nested headers should collapse→reposition→expand vs. morph boundaries in place
   - Recommendation: Start with same 300ms repositioning as single-level headers (consistency), add specialized morphing in follow-up if needed

2. **How to handle animation interruption during rapid axis changes?**
   - What we know: D3's `.interrupt()` cancels active transitions, new transitions implicitly interrupt on start
   - What's unclear: Whether to batch rapid changes (debounce) or allow each change to interrupt previous
   - Recommendation: Explicit `.interrupt()` before each render (responsive to every change), add optional debouncing in PAFVContext if users report jankiness during drag-and-drop axis assignment

3. **Should "Unassigned" bucket cells animate differently?**
   - What we know: Cards with null facet values go to "Unassigned" column/row
   - What's unclear: Whether cards moving to/from Unassigned need different animation (e.g., fade vs. slide)
   - Recommendation: Same animation as other cells (treat Unassigned as just another bucket value), revisit if user testing shows confusion

## Sources

### Primary (HIGH confidence)
- [D3 Transitions Official Docs](https://d3js.org/d3-transition) - API reference, timing, control flow
- [D3 Selection Joining](https://d3js.org/d3-selection/joining) - join() method, key functions, animated updates
- [Object Constancy by Mike Bostock](https://bost.ocks.org/mike/constancy/) - Why key functions matter, visual tracking
- GridRenderingEngine.ts - Existing card rendering with positions
- PAFVContext.tsx - Axis mapping state management
- SelectionContext.tsx - Selection state preservation
- HeaderAnimationSystem.ts - Pattern reference for coordinated animations

### Secondary (MEDIUM confidence)
- [D3 Transitions Tutorial](https://www.d3indepth.com/transitions/) - Practical examples, timing patterns
- [D3 Playbook Transitions](https://gramener.github.io/d3js-playbook/transitions.html) - Staggered animations, coordination
- [Working with Transitions](https://bost.ocks.org/mike/transition/) - Interrupt handling, chaining

### Tertiary (LOW confidence)
- [FLIP Technique](https://css-tricks.com/animating-layouts-with-the-flip-technique/) - CSS animation approach, not directly applicable to D3 SVG but concept of first/last/invert/play is relevant for complex layout changes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - D3.js v7 already in use, no new dependencies, official docs verified
- Architecture: HIGH - Existing GridRenderingEngine patterns identified, PAFVContext integration clear
- Pitfalls: MEDIUM-HIGH - Common D3 transition mistakes well-documented, project-specific issues inferred from codebase patterns
- Selection preservation: HIGH - SelectionContext implementation already exists, integration point clear

**Research date:** 2026-02-12
**Valid until:** 90 days (D3.js stable, v7 released 2021, v8 not announced)
