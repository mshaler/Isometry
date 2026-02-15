# Phase 93: Polish & Performance - Research

**Researched:** 2026-02-14
**Domain:** React virtual scrolling, D3.js performance optimization, accessibility, CSS animations
**Confidence:** HIGH

## Summary

Phase 93 focuses on optimizing SuperGrid for production-level performance with 10K+ cells while maintaining smooth 60fps interactions, ensuring accessibility compliance, and polishing visual transitions. The keystone requirement is virtual scrolling to render only visible content, coupled with sticky headers, ARIA semantics, informative empty states, and smooth collapse/expand animations.

The existing codebase already has @tanstack/react-virtual installed (v3.13.18) and implements sticky headers via CSS positioning. The architecture uses D3.js for data binding with sql.js providing synchronous data access, which eliminates serialization overhead. The challenge is virtualizing D3-rendered SVG cells while maintaining the existing SuperStack header hierarchy and data cell integration (Phase 92).

Performance optimization for D3.js at this scale requires canvas rendering (up to 10x faster than SVG for large datasets), virtual scrolling (80% reduction in render time), and object pooling to reuse DOM elements. The sticky header implementation already exists via CSS `position: sticky` with proper z-indexing. Accessibility requires ARIA grid semantics with focus management and keyboard navigation already partially implemented (Phase 91).

**Primary recommendation:** Implement TanStack Virtual for data grid virtualization while preserving D3.js data binding, upgrade from SVG to canvas rendering for data cells above 1000 nodes, add FPS monitoring during development, complete ARIA grid implementation with proper row/cell roles, and enhance collapse/expand animations using D3 transitions with GPU-accelerated transforms.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-virtual | 3.13.18 | Virtual scrolling for large datasets | Already installed, most popular virtualization library (2026), headless architecture fits D3.js integration |
| D3.js | 7.9.0 | Data binding and rendering | Already installed, direct sql.js integration eliminates serialization overhead |
| CSS position: sticky | Native | Sticky headers during scroll | Native browser support (92%), zero dependencies, already implemented in SuperGridScrollContainer.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| requestAnimationFrame | Native | FPS monitoring and smooth animations | Performance measurement during development, custom animation loops |
| Canvas API | Native | High-performance rendering for >1000 cells | Fallback when SVG performance drops below 30fps |
| ARIA Grid Pattern | W3C Standard | Screen reader accessibility | Required for all grid implementations per A11Y-01 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Virtual | react-window | react-window is lighter (3KB vs 10-15KB) but less actively maintained; TanStack Virtual is current standard (2026) |
| Canvas rendering | SVG only | SVG is simpler but 10x slower for large datasets; use SVG for <1000 cells, canvas for >1000 |
| CSS sticky | JavaScript scroll listeners | JS scroll listeners allow custom behavior but require manual performance optimization and cause layout thrashing |

**Installation:**
```bash
# Already installed in package.json:
# @tanstack/react-virtual: ^3.13.18
# No additional packages required
```

## Architecture Patterns

### Recommended Integration Structure
```
src/
├── d3/
│   ├── SuperGridEngine/
│   │   ├── VirtualRenderer.ts        # NEW: TanStack Virtual + D3 integration
│   │   ├── CanvasCellRenderer.ts     # NEW: Canvas fallback for >1000 cells
│   │   ├── PerformanceMonitor.ts     # NEW: FPS tracking via requestAnimationFrame
│   │   └── Renderer.ts               # EXISTING: SVG renderer for <1000 cells
│   └── header-interaction/
│       └── HeaderAnimationController.ts # EXISTING: already implements D3 transitions
└── components/
    └── supergrid/
        ├── SuperGrid.tsx              # EXISTING: main component
        ├── SuperGridScrollContainer.tsx # EXISTING: sticky header implementation
        └── SuperGridVirtualized.tsx  # NEW: TanStack Virtual wrapper
```

### Pattern 1: Virtual Scrolling with D3.js Data Binding
**What:** TanStack Virtual calculates visible rows, D3.js binds data only to visible cells
**When to use:** Data grids with >1000 cells requiring smooth scrolling
**Example:**
```typescript
// Integration pattern from TanStack Virtual docs + D3.js .join() pattern
import { useVirtualizer } from '@tanstack/react-virtual'
import * as d3 from 'd3'

function VirtualizedGrid({ cells, coordinateSystem, onCellClick }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGGElement>(null)

  // TanStack Virtual calculates visible indices
  const rowVirtualizer = useVirtualizer({
    count: cells.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => coordinateSystem.cellHeight,
    overscan: 5, // Render 5 extra rows for smooth scrolling
  })

  // D3 binds data only to visible cells
  useEffect(() => {
    if (!svgRef.current) return

    const visibleCells = rowVirtualizer.getVirtualItems().map(virtualRow =>
      cells[virtualRow.index]
    )

    // D3.js data binding with key function (ALWAYS use .join())
    d3.select(svgRef.current)
      .selectAll('.cell')
      .data(visibleCells, d => d.id)
      .join(
        enter => enter.append('rect')
          .attr('class', 'cell')
          .attr('y', d => virtualRow.start)
          .attr('height', virtualRow.size),
        update => update
          .attr('y', d => virtualRow.start)
          .attr('height', virtualRow.size),
        exit => exit.remove()
      )
  }, [rowVirtualizer.getVirtualItems(), cells])
}
```

### Pattern 2: Canvas Rendering for >1000 Cells
**What:** Switch from SVG to Canvas when cell count exceeds performance threshold
**When to use:** Data grids with >1000 cells experiencing <30fps performance
**Example:**
```typescript
// Canvas rendering pattern from D3.js performance optimization guides
function CanvasCellRenderer({ cells, coordinateSystem, viewport }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and redraw only visible cells
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    cells.forEach(cell => {
      // Check if cell is in viewport (virtual scrolling)
      if (!isInViewport(cell, viewport)) return

      const { x, y } = coordinateSystem.logicalToScreen(cell.gridX, cell.gridY)

      // Canvas drawing is 10x faster than SVG for large datasets
      ctx.fillStyle = '#fff'
      ctx.fillRect(x, y, coordinateSystem.cellWidth, coordinateSystem.cellHeight)
      ctx.strokeStyle = '#e5e7eb'
      ctx.strokeRect(x, y, coordinateSystem.cellWidth, coordinateSystem.cellHeight)

      // Render text
      ctx.fillStyle = '#000'
      ctx.fillText(cell.nodeCount.toString(), x + 5, y + 20)
    })
  }, [cells, viewport, coordinateSystem])

  return <canvas ref={canvasRef} width={1920} height={1080} />
}
```

### Pattern 3: FPS Monitoring During Development
**What:** Track frame rate using requestAnimationFrame to ensure 60fps during scrolling
**When to use:** Development and QA testing for performance validation
**Example:**
```typescript
// FPS monitoring pattern from React performance guides
function usePerformanceMonitor() {
  const [fps, setFps] = useState(60)
  const frameTimestamps = useRef<number[]>([])

  useEffect(() => {
    let rafId: number

    const measureFPS = (timestamp: number) => {
      frameTimestamps.current.push(timestamp)

      // Keep only last second of frames
      const oneSecondAgo = timestamp - 1000
      frameTimestamps.current = frameTimestamps.current.filter(t => t > oneSecondAgo)

      // Calculate FPS (target: 60)
      const currentFPS = frameTimestamps.current.length
      setFps(currentFPS)

      rafId = requestAnimationFrame(measureFPS)
    }

    rafId = requestAnimationFrame(measureFPS)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return fps
}
```

### Pattern 4: ARIA Grid with Keyboard Navigation
**What:** Implement ARIA grid role with proper focus management for screen readers
**When to use:** All data grids (accessibility requirement A11Y-01)
**Example:**
```typescript
// ARIA grid pattern from W3C APG (ARIA Authoring Practices Guide)
function AccessibleGrid({ cells, onCellClick }) {
  const gridRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="Data grid with row and column headers"
      aria-rowcount={cells.length}
      aria-colcount={10}
    >
      {/* Column headers */}
      <div role="row">
        {columnHeaders.map((header, i) => (
          <div
            key={header.id}
            role="columnheader"
            aria-colindex={i + 1}
            tabIndex={0}
          >
            {header.value}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {cells.map((row, rowIndex) => (
        <div key={row.id} role="row" aria-rowindex={rowIndex + 1}>
          <div role="rowheader" aria-colindex={1} tabIndex={0}>
            {row.rowHeader}
          </div>
          {row.cells.map((cell, colIndex) => (
            <div
              key={cell.id}
              role="gridcell"
              aria-colindex={colIndex + 2}
              tabIndex={-1} // Only one cell focusable at a time
              onClick={() => onCellClick(cell)}
            >
              {cell.value}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

### Pattern 5: Smooth Collapse/Expand Animations
**What:** Use D3 transitions with GPU-accelerated transforms for smooth animations
**When to use:** Header collapse/expand interactions (already partially implemented in HeaderAnimationController.ts)
**Example:**
```typescript
// Already implemented in src/d3/header-interaction/HeaderAnimationController.ts (lines 166-194)
// Enhancement: ensure GPU acceleration via transform instead of width/height
function animateHeaderExpansion(node: HeaderNode) {
  const transitionId = `toggle-${node.id}-${Date.now()}`

  // GOOD: GPU-accelerated transform (opacity, scale, translate)
  d3.select(element)
    .transition()
    .duration(300)
    .ease(d3.easeQuadOut)
    .style('transform', node.isExpanded ? 'scaleY(1)' : 'scaleY(0)')
    .style('opacity', node.isExpanded ? 1 : 0)
    .style('transform-origin', 'top')

  // AVOID: Layout-triggering properties (width, height, top, left)
  // These cause full page recalculation on every frame
}
```

### Anti-Patterns to Avoid
- **Rendering all cells in DOM:** Causes severe performance degradation above 1000 cells; always use virtual scrolling
- **Animating width/height:** Triggers layout recalculation on every frame; use transform: scale() instead
- **Missing key functions in D3 .data():** Breaks data binding and causes full re-render; always use `.data(items, d => d.id)`
- **Scroll event listeners for sticky headers:** Causes layout thrashing; use CSS `position: sticky` instead
- **aria-hidden on interactive elements:** Makes grid unusable for screen readers; ensure proper role attributes instead

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scrolling logic | Custom viewport calculation + element pooling | TanStack Virtual | Already installed, handles edge cases (variable heights, overscan, smooth scrolling), actively maintained |
| FPS monitoring | Manual timestamp tracking | requestAnimationFrame + existing browser DevTools | Native API provides precise frame timing, browser DevTools show real-time performance |
| Sticky headers | JavaScript scroll listeners + manual positioning | CSS `position: sticky` | Already implemented in SuperGridScrollContainer.tsx, zero JavaScript overhead, native browser optimization |
| Screen reader support | Custom announcement system | ARIA grid pattern + native semantic HTML | W3C standard, tested with JAWS/NVDA/VoiceOver, built-in browser support |
| Animation easing | Custom easing functions | D3 easings (easeQuadOut, easeCubicInOut) | Already available in D3.js, mathematically precise, consistent with existing HeaderAnimationController.ts |

**Key insight:** Virtual scrolling is deceptively complex due to edge cases: variable row heights, scroll momentum, overscan optimization, and scroll anchor preservation during data changes. TanStack Virtual handles all of these and is already installed. Don't rebuild it.

## Common Pitfalls

### Pitfall 1: Virtual Scrolling Breaks Sticky Headers
**What goes wrong:** When overflow: auto is set on the container for virtual scrolling, CSS `position: sticky` stops working on nested headers
**Why it happens:** CSS sticky requires the scrolling container to be the direct parent; virtual scrolling creates intermediate wrapper divs
**How to avoid:** Place sticky headers outside the virtual scroll container using CSS Grid layout (already implemented in SuperGridScrollContainer.tsx lines 70-80)
**Warning signs:** Headers scroll with content instead of staying fixed; z-index changes don't affect header visibility

### Pitfall 2: SVG Performance Cliff Above 1000 Elements
**What goes wrong:** Grid becomes unresponsive when rendering >1000 SVG cells; scroll drops below 30fps
**Why it happens:** SVG rendering requires full DOM element creation for each cell; browser paint/layout cost scales linearly
**How to avoid:** Implement performance threshold check; switch to Canvas rendering when cell count exceeds 1000 (Canvas is 10x faster per search results)
**Warning signs:** FPS monitor shows <30fps during scroll; Chrome DevTools profiler shows >50ms paint times

### Pitfall 3: ARIA Grid Without Focus Management
**What goes wrong:** Screen reader users can navigate to grid but can't select individual cells; keyboard navigation doesn't work
**Why it happens:** ARIA grid role requires JavaScript focus management; browsers don't provide default keyboard navigation for role="grid"
**How to avoid:** Implement arrow key navigation with roving tabindex pattern (one focusable cell at a time, arrow keys move focus)
**Warning signs:** Screen reader announces "grid" but doesn't read cell contents; Tab key skips entire grid

### Pitfall 4: Animating Layout Properties Instead of Transforms
**What goes wrong:** Collapse/expand animations are janky (stuttering, dropped frames); FPS drops during animation
**Why it happens:** Animating width/height/top/left triggers layout recalculation on every frame (16.67ms budget includes layout + paint + composite)
**How to avoid:** Use transform: scale() and opacity only; these are GPU-accelerated and skip layout/paint (compositor-only)
**Warning signs:** Chrome DevTools timeline shows purple "Layout" bars during animation; FPS monitor drops below 50fps during transitions

### Pitfall 5: overscanCount Too High in TanStack Virtual
**What goes wrong:** Virtual scrolling still renders too many off-screen rows; performance gains are minimal
**Why it happens:** overscanCount adds extra rows above/below viewport to prevent white flashes during fast scrolling; default is often too conservative
**How to avoid:** Start with overscan: 5 (renders 5 extra rows each direction); tune based on scroll speed and cell render cost
**Warning signs:** DOM inspector shows many more rows than visible viewport; scroll performance not significantly better than non-virtualized

### Pitfall 6: Empty State Not Informative
**What goes wrong:** User sees blank screen when no data matches filters; unclear if grid is broken or intentionally empty
**Why it happens:** Developers focus on data-present case and treat empty state as edge case; no design guidance for "what should user do next"
**How to avoid:** Follow empty state UX pattern: clear explanation (why empty) + actionable CTA (what to do next) + optional visual (illustration or icon)
**Warning signs:** User reports "grid is broken"; support tickets asking "where is my data"

## Code Examples

Verified patterns from official sources:

### TanStack Virtual Grid Virtualization
```typescript
// Source: https://tanstack.com/virtual/latest/docs/framework/react/examples/table
// Verified HIGH confidence: official TanStack docs, React integration guide

import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedSuperGrid({ cells, coordinateSystem }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: cells.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => coordinateSystem.cellHeight,
    overscan: 5, // Prevent white flash during fast scrolling
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalHeight = rowVirtualizer.getTotalSize()

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualRows.map(virtualRow => {
          const cell = cells[virtualRow.index]
          return (
            <div
              key={cell.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Render cell content */}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### CSS Sticky Headers with Z-Index Layering
```css
/* Source: https://css-tricks.com/position-sticky-and-table-headers/
   Verified HIGH confidence: CSS-Tricks, tested cross-browser pattern
   Already implemented in SuperGridScrollContainer.tsx lines 82-141 */

.supergrid__corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 3; /* Above both column and row headers */
  background: #f5f5f5;
}

.supergrid__column-headers {
  position: sticky;
  top: 0;
  z-index: 2; /* Above data cells, below corner */
  background: #f5f5f5;
}

.supergrid__row-headers {
  position: sticky;
  left: 0;
  z-index: 1; /* Above data cells, below column headers */
  background: #f5f5f5;
}

.supergrid__data-grid {
  /* No sticky positioning - scrolls normally */
  z-index: 0;
}
```

### ARIA Grid Pattern with Keyboard Navigation
```typescript
// Source: https://wai-aria-practices.netlify.app/aria-practices/#grid
// Verified HIGH confidence: W3C ARIA Authoring Practices Guide (official spec)

function useGridKeyboardNavigation(gridRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const currentCell = document.activeElement
      if (!currentCell || !grid.contains(currentCell)) return

      const row = currentCell.closest('[role="row"]')
      const cells = Array.from(row?.querySelectorAll('[role="gridcell"]') || [])
      const currentIndex = cells.indexOf(currentCell as Element)

      let nextCell: Element | null = null

      switch (event.key) {
        case 'ArrowRight':
          nextCell = cells[currentIndex + 1] || null
          break
        case 'ArrowLeft':
          nextCell = cells[currentIndex - 1] || null
          break
        case 'ArrowDown':
          // Get cell in same column, next row
          const nextRow = row?.nextElementSibling
          const nextRowCells = nextRow?.querySelectorAll('[role="gridcell"]')
          nextCell = nextRowCells?.[currentIndex] || null
          break
        case 'ArrowUp':
          // Get cell in same column, previous row
          const prevRow = row?.previousElementSibling
          const prevRowCells = prevRow?.querySelectorAll('[role="gridcell"]')
          nextCell = prevRowCells?.[currentIndex] || null
          break
      }

      if (nextCell) {
        event.preventDefault()
        ;(nextCell as HTMLElement).focus()
      }
    }

    grid.addEventListener('keydown', handleKeyDown)
    return () => grid.removeEventListener('keydown', handleKeyDown)
  }, [gridRef])
}
```

### GPU-Accelerated Collapse/Expand Animation
```typescript
// Source: https://developer.chrome.com/blog/performant-expand-and-collapse
// Verified MEDIUM confidence: Chrome DevRel blog, best practices guide

function animateCollapse(element: HTMLElement, isExpanded: boolean) {
  // GOOD: GPU-accelerated properties (transform, opacity)
  // These properties are composited by GPU, skip layout/paint
  element.animate(
    [
      {
        transform: 'scaleY(1)',
        opacity: 1,
        transformOrigin: 'top',
      },
      {
        transform: 'scaleY(0)',
        opacity: 0,
        transformOrigin: 'top',
      },
    ],
    {
      duration: 300,
      easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material Design easing
      fill: 'forwards',
      direction: isExpanded ? 'normal' : 'reverse',
    }
  )

  // AVOID: Animating height directly (triggers layout on every frame)
  // element.style.height = isExpanded ? '0px' : 'auto' // BAD
}
```

### FPS Monitoring Hook
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-15-react-native-performance-metrics/view
// Verified MEDIUM confidence: OneUptime blog, 2026 performance guide

function useFPSMonitor() {
  const [fps, setFps] = useState(60)
  const framesRef = useRef<number[]>([])

  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()

    const tick = (currentTime: number) => {
      // Calculate time since last frame
      const delta = currentTime - lastTime
      lastTime = currentTime

      // Add frame timestamp
      framesRef.current.push(currentTime)

      // Keep only last second of frames
      const oneSecondAgo = currentTime - 1000
      framesRef.current = framesRef.current.filter(t => t > oneSecondAgo)

      // Update FPS (target: 60fps = 16.67ms per frame)
      const currentFPS = framesRef.current.length
      setFps(currentFPS)

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)
  }, [])

  return {
    fps,
    isPerformant: fps >= 30, // PERF-01 requirement
    isSmooth: fps >= 55, // Target 60fps with 5fps buffer
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-window for virtualization | TanStack Virtual | 2023-2024 | TanStack Virtual has active maintenance, better TypeScript support, more flexible API; react-window maintenance slowed |
| Manual scroll listeners for sticky headers | CSS `position: sticky` | 2019 (92% browser support) | Zero JavaScript overhead, native browser optimization, simpler implementation |
| SVG for all grid rendering | Canvas above 1000 cells | Ongoing best practice | Canvas is 10x faster for large datasets but requires manual text measurement; SVG easier for <1000 cells |
| aria-label for grid cells | ARIA grid pattern with roles | 2021 W3C APG update | Proper grid semantics enable screen reader table navigation mode; aria-label alone doesn't convey structure |
| height: auto animations | grid-template-rows: 0fr → 1fr | 2025-2026 (emerging) | Native CSS support for smooth height transitions without JavaScript; still requires browser support checks |

**Deprecated/outdated:**
- **react-virtualized:** Superseded by react-window (lighter) and TanStack Virtual (more features); still works but not recommended for new projects
- **JavaScript-based sticky positioning:** CSS sticky is now standard (92% support); polyfills no longer needed for modern browsers
- **aria-owns for grid structure:** Deprecated in ARIA 1.3; use native DOM structure with proper role attributes instead

## Open Questions

1. **Canvas vs SVG threshold for this specific use case**
   - What we know: Canvas is 10x faster for large datasets (search results), SVG is easier for interaction/selection
   - What's unclear: Exact cell count threshold where Canvas becomes necessary; impact on existing D3.js data binding patterns
   - Recommendation: Start with SVG, add FPS monitoring, switch to Canvas if performance drops below 30fps in real-world testing

2. **TanStack Virtual integration with D3.js .join() pattern**
   - What we know: TanStack Virtual calculates visible indices, D3 binds data to elements
   - What's unclear: Whether D3's .join() enter/update/exit pattern conflicts with TanStack Virtual's element reuse
   - Recommendation: Prototype integration with small dataset (100 cells), verify D3 key function correctly identifies reused elements

3. **ARIA grid compatibility with virtual scrolling**
   - What we know: ARIA grid requires aria-rowcount attribute with total rows, visible rows have aria-rowindex
   - What's unclear: How screen readers handle aria-rowindex gaps when rows 1-5 and 95-100 are rendered but 6-94 are virtualized
   - Recommendation: Test with NVDA/JAWS/VoiceOver; if gaps cause issues, implement ARIA live regions to announce scroll position

4. **Animation performance budget for header collapse/expand**
   - What we know: Target 60fps (16.67ms per frame), D3 transitions already implemented in HeaderAnimationController.ts
   - What's unclear: How many simultaneous header animations can run at 60fps; whether batch collapse ("Collapse All") needs animation throttling
   - Recommendation: Add FPS monitoring during multi-header collapse; if FPS drops below 55, disable animations for batch operations

5. **Empty state design specifics**
   - What we know: Should have explanation + CTA + optional visual (search results)
   - What's unclear: Exact UX messaging for different empty states (no data vs. filtered out vs. loading error)
   - Recommendation: Design three empty state variants: first-use ("Add your first item"), no-results ("No items match your filters"), and error ("Failed to load data"); user test for clarity

## Sources

### Primary (HIGH confidence)
- TanStack Virtual official docs: https://tanstack.com/virtual/latest - Virtual scrolling API, React integration patterns
- W3C ARIA Authoring Practices Guide: https://wai-aria-practices.netlify.app/aria-practices/#grid - Official ARIA grid pattern specification
- CSS-Tricks sticky positioning: https://css-tricks.com/position-sticky-and-table-headers/ - Cross-browser sticky header implementation
- MDN Web Docs ARIA: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA - ARIA roles and properties reference
- Chrome DevRel performance guide: https://developer.chrome.com/blog/performant-expand-and-collapse - GPU-accelerated animation best practices

### Secondary (MEDIUM confidence)
- [TanStack Virtual performance optimization](https://medium.com/@sanjivchaudhary416/from-lag-to-lightning-how-tanstack-virtual-optimizes-1000s-of-items-smoothly-24f0998dc444) - Real-world optimization patterns
- [D3.js virtual scrolling techniques](https://billdwhite.com/wordpress/2014/05/17/d3-scalability-virtual-scrolling-for-large-visualizations/) - Integration patterns for D3 + virtual scrolling
- [React FPS monitoring 2026](https://oneuptime.com/blog/post/2026-01-15-react-native-performance-metrics/view) - requestAnimationFrame-based performance tracking
- [Empty state UX best practices](https://www.eleken.co/blog-posts/empty-state-ux) - Design patterns for empty states

### Tertiary (LOW confidence - needs validation)
- [react-window best practices](https://blog.logrocket.com/how-to-virtualize-large-lists-using-react-window/) - Alternative virtualization approach (react-window is less maintained than TanStack Virtual)
- [CSS animations performance 2026](https://jdsteinbach.com/css/holy-grail-css-animation/) - General animation guidelines (not grid-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Virtual already installed, CSS sticky already implemented, D3.js already in use
- Architecture: HIGH - Patterns verified against official docs (TanStack, W3C, MDN), existing codebase structure understood
- Pitfalls: MEDIUM - Performance thresholds (1000 cells, 30fps) based on search results not project-specific testing; ARIA grid + virtual scrolling compatibility needs validation

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days for stable web standards; TanStack Virtual API unlikely to change significantly)

**Notes for planner:**
- Phase 92 (Data Cell Integration) is dependency - useDataCellRenderer hook and SelectionContext must be working before virtualizing
- Existing SuperGridScrollContainer.tsx (lines 58-163) implements sticky headers correctly; preserve this pattern during virtualization
- HeaderAnimationController.ts (lines 166-194) already implements D3 transitions; enhancement needed for GPU acceleration (use transform instead of width/height)
- FPS monitoring should be development-only feature; remove from production builds via process.env.NODE_ENV check
- ARIA grid implementation will require updates to SuperGrid.tsx (lines 584-767) to add role attributes to existing DOM structure
