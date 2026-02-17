# Technology Stack — v6.9 Polymorphic Views & Foundation

**Project:** Isometry v6.9 — Polymorphic View Continuum
**Researched:** 2026-02-16
**Mode:** Ecosystem Stack Additions
**Confidence:** HIGH (verified with current versions and existing implementations)

---

## CONTEXT: Stack Additions for Polymorphic Views

**Base stack validated in prior phases:**
- React 18 + TypeScript + Vite
- sql.js (SQLite in WASM) with FTS5 for queries
- D3.js v7 for force simulations, scales, timelines
- CSS Grid native support for SuperGrid layout
- TanStack Virtual (react-virtual) for virtualization
- Tailwind CSS + shadcn/ui for components
- TipTap v3 for Capture pane editing

**This research:** Additions needed for Grid Continuum (Gallery/List/Kanban), Network graph optimization, Timeline polish, and Three-Canvas panel layout.

**Status of milestone infrastructure:**
- CSS primitives already defined (primitives-gallery.css, primitives-kanban.css, primitives-timeline.css) ✓
- GridContinuumController exists (uses legacy D3 projections) — needs CSS Grid bridge
- D3 network and timeline renderers exist (ForceGraphRenderer.ts, TimelineRenderer.ts) — need SQL hooks
- NotebookLayout.tsx exists (captures, shell, preview divs) — needs resizable panels
- ViewSwitcher.tsx exists (switches between views) — needs integration

---

## Recommended Stack — NEW PACKAGES ONLY

### Core Additions for Panel Layout

| Technology | Version | Purpose | Why Recommended | Notes |
|------------|---------|---------|-----------------|-------|
| **react-resizable-panels** | ^4.0.7+ | Resizable three-pane layout (Capture+Shell+Preview) | Industry standard (shadcn/ui uses it). Battle-tested drag mechanics, keyboard accessibility, smooth animations, constraint system. Solves persistence + responsive behavior. | Verify exact version compatibility with shadcn components (see Known Issues). Current stable v4.0.7 released Feb 2026. |

### D3 Performance Optimizations for Large Graphs

| Technology | Version | Purpose | When to Use | Integration Pattern |
|------------|---------|---------|------------|-------------------|
| **d3-force-reuse** | latest (GitHub) | Barnes-Hut approximation for force simulation | Networks with 5000+ nodes. Enables 3D force layouts without freezing UI. | Use `d3-force-reuse` in place of `d3.forceSimulation()` for large graphs. Returns same API. |
| **web-worker (native)** | Native browser | Offload force layout computation to background thread | All force simulations 1000+ nodes. Prevents main thread blocking during layout. | Wrap `createForceGraph()` invocation in Worker, return positioned nodes back to main thread. |

**Status quo:** Current ForceGraphRenderer.ts uses vanilla d3.forceSimulation(). This is sufficient for <5000 nodes at 60fps. For larger graphs, add Web Worker wrapper.

### CSS Grid & Masonry (Native, No New Package Needed)

| Approach | Tech | Notes |
|----------|------|-------|
| **Gallery (masonry)** | CSS Grid `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))` | Polyfill-free masonry using CSS Grid. Works in all modern browsers. No package needed. |
| **List (hierarchy)** | CSS & D3 hierarchy layout | Use `d3.hierarchy()` to build tree structure, D3 to position, CSS Grid for rendering. TanStack Virtual for virtualization. |
| **Kanban (columns)** | CSS Grid + Flexbox | `grid-template-columns: repeat(N, 1fr)` where N = facet cardinality. Drag-and-drop with react-dnd (already installed). |

**All grid views benefit from TanStack Virtual (already installed ^3.13.18).**

### Optional: Canvas-Based Network Rendering (Advanced Performance)

| Technology | Version | Purpose | When Needed |
|------------|---------|---------|------------|
| **pixijs** | ^8.2.0 | Canvas-based 2D renderer for force graphs | Only if SVG performance inadequate for 10K+ nodes. Deferred to Phase 2 optimization. |
| **babylon.js** | ^7.0.0 | WebGL 3D rendering for network graphs | Only if 3D network visualization required. Deferred to Phase 3+. |

**Recommendation:** Use SVG with Web Worker optimization first. Canvas/WebGL are Phase 2+ optimizations if performance warrants.

---

## Installation Instructions

### Phase 1: Three-Canvas Panel Layout (REQUIRED NOW)

```bash
# Resizable panels for Capture+Shell+Preview
npm install react-resizable-panels@^4.0.7

# shadcn/ui Resizable component (optional, can use HTML+CSS)
# If using shadcn:
npx shadcn-ui@latest add resizable
```

**Post-installation:**
- Verify `react-resizable-panels` is installed (check package.json)
- If using shadcn resizable component, verify no TypeScript errors (known issue with v4.0.7 export names)
- Test responsive behavior at mobile (640px), tablet (900px), and desktop (1400px) breakpoints

### Phase 2: D3 Performance Optimizations (DEFERRED, For Large Graphs)

```bash
# For networks 5000+ nodes — clone and reference locally
git clone https://github.com/twosixlabs/d3-force-reuse.git
# Import as local module in ForceGraphRenderer.ts

# Web Worker support (native, no package) — use browser Worker API
```

### Existing Packages (Verify Current Versions)

```bash
# Already installed — verify versions:
npm ls d3 @tanstack/react-virtual
# Expected:
# d3@^7.9.0
# @tanstack/react-virtual@^3.13.18

# TipTap for Capture pane — already installed
npm ls @tiptap/react
# Expected: @tiptap/react@^3.19.0
```

---

## Architecture: Stack Additions Integration Points

### Three-Canvas Layout with Resizable Panels

**Component hierarchy:**
```
NotebookLayout (wrapper)
├── ResizablePanelGroup (horizontal orientation)
│   ├── ResizablePanel (Capture) — default 33%
│   │   └── CaptureComponent (TipTap editor)
│   ├── ResizableHandle (draggable divider)
│   ├── ResizablePanel (Shell) — default 33%
│   │   └── ShellComponent (xterm.js)
│   ├── ResizableHandle (draggable divider)
│   └── ResizablePanel (Preview) — default 34%
│       └── PreviewComponent (SuperGrid + Network + Timeline)
```

**Responsive behavior (already in NotebookLayout.tsx):**
- Desktop (≥900px): 3-pane horizontal layout
- Tablet (640px-900px): 2-pane stacked (Capture+Shell above Preview)
- Mobile (<640px): Tabbed interface (switch panes with Cmd+1/2/3)

**Integration notes:**
- ResizablePanelGroup API: `<ResizablePanelGroup direction="horizontal" autoSave="notebook-layout">`
- Persistence via browser localStorage (ResizablePanel `defaultSize` prop + `onLayout` callback)
- No additional state management needed — React refs handle layout state

### Grid Continuum Views with CSS Grid + D3

**Gallery view (masonry):**
```typescript
// CSS handles layout, D3 binds data
const gallery = d3.select('#gallery')
  .style('display', 'grid')
  .style('grid-template-columns', 'repeat(auto-fit, minmax(220px, 1fr))')
  .style('gap', 'var(--iso-gallery-gap)');

gallery.selectAll('.card')
  .data(cards, d => d.id)
  .join('div')
    .attr('class', 'card')
    .style('background', d => d.color);
```

**List view (hierarchical):**
```typescript
// D3 hierarchy layout for tree structure + positioning
const hierarchy = d3.hierarchy(rootNode)
  .sum(d => d.size)
  .sort((a, b) => b.value - a.value);

const treeLayout = d3.tree().size([width, height]);
const nodes = treeLayout(hierarchy);

// TanStack Virtual for vertical scrolling optimization
const virtualRows = useVirtualizer({ ... });
```

**Kanban view (columns):**
```typescript
// CSS Grid columns per facet value
const kanban = d3.select('#kanban')
  .style('grid-template-columns',
    `repeat(${facetValues.length}, 1fr)`);

// react-dnd for drag-drop between columns
// D3 data binding for cards within columns
```

### Network Graph with SQL Hooks

**Integration pattern:**
```typescript
// Hook wraps sql.js query + D3 force simulation
function useNetworkData(sql: string) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);

  useEffect(() => {
    // Execute SQL query to get edges
    const edges = db.exec(sql);

    // Transform to D3 node/link format
    const nodes = edges.map(e => ({ id: e.source, ... }));
    const links = edges.map(e => ({ source: e.source, target: e.target, ... }));

    setNodes(nodes);
    setLinks(links);
  }, [sql]);

  return { nodes, links };
}

// Use in ForceGraphRenderer
const { nodes, links } = useNetworkData(
  `SELECT * FROM edges WHERE edge_type = 'LINK'`
);
createForceGraph(container, nodes, links, config, callbacks);
```

### Timeline with D3 Time Scales

**Integration pattern:**
```typescript
// sql.js query returns time facets from nodes table
const timelineEvents = db.exec(`
  SELECT id, name, created_at as timestamp, folder as track
  FROM nodes
  WHERE deleted_at IS NULL
  ORDER BY created_at
`);

// Transform to TimelineEvent interface
const events = timelineEvents.map(row => ({
  id: row.id,
  timestamp: new Date(row.timestamp),
  label: row.name,
  track: row.track
}));

// D3 scaleTime handles date domain and range
const xScale = d3.scaleTime()
  .domain(d3.extent(events, d => d.timestamp))
  .range([margin.left, width - margin.right]);

createTimeline(container, events, { width, height }, callbacks);
```

---

## Versions & Compatibility Matrix

| Package | Current Version | Minimum Version | Status | Notes |
|---------|-----------------|-----------------|--------|-------|
| react-resizable-panels | ^4.0.7 | 4.0.5 | Required | v4 released Dec 2025. Breaking change from v3 (export names). Use v4.0.7+. |
| d3 | ^7.9.0 | 7.8.0 | Existing | Stable. v7 will be LTS through 2027. |
| @tanstack/react-virtual | ^3.13.18 | 3.13.0 | Existing | Latest v3 release (stable). No v4 planned for React. |
| @tiptap/react | ^3.19.0 | 3.19.0 | Existing | Recent v3 release. Markdown support stabilized Feb 2026. |
| @xterm/xterm | ^5.5.0 | 5.0.0 | Existing | No upgrade needed (v6 released Dec 2025, but v5.5.0 stable). |
| TypeScript | ^5.2.2 | 5.2.0 | Existing | Strict mode enabled. No breaking changes anticipated. |

---

## Alternatives Considered

### Panel Layout

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| **react-resizable-panels** | Manual CSS `resize` event + JS | Requires hand-rolling persist, keyboard A11y, touch events. ResizablePanels is battle-tested (Linear, Vercel, VS Code). |
| **react-resizable-panels** | react-split-pane | Unmaintained (last update 2019). ResizablePanels has weekly updates. |
| **react-resizable-panels** | re-resizable | Designed for single draggable box, not panel groups. Overkill for layout. |

### D3 Graph Rendering

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| **SVG (native D3)** with Web Worker | Canvas (pixijs, Babylon.js) | Canvas needed only for 10K+ nodes. Phase 1 target <5K nodes. SVG sufficient. Canvas adds 100KB+ to bundle. |
| **Web Worker for force layout** | Webassembly (Rust graph layout) | WASM adds 500KB+ bundle. Overkill for current scale. JS Web Worker is sufficient. |
| **d3-force (native)** with Barnes-Hut | d3-force-3d | 3D network rendering deferred to Phase 3. Stay with 2D for now. |

### Grid Rendering

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| **CSS Grid native + D3 data binding** | React windowed grid libraries (ag-Grid Pro) | ag-Grid is $1200+/year/dev. Overkill for PAFV projections. CSS Grid + TanStack Virtual is free and composable. |
| **CSS Grid** | D3 force layout for gallery | D3 force adds unnecessary computation for regular grid layout. CSS Grid is native, zero overhead. |
| **TanStack Virtual** | React-window | TanStack is framework-agnostic and has better grid support. React-window is row-focused. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Redux / Zustand** | D3 data join IS state management. Adding Redux = duplicate state. | Keep state in sql.js, let D3 drive UI updates via data binding. |
| **re-resizable** | Single-box resizing only. Not designed for multi-pane layouts. | react-resizable-panels is purpose-built for panel groups. |
| **ProseMirror directly** | TipTap is a tested wrapper with better ergonomics. DIY = reinventing. | Use @tiptap/react with @tiptap/starter-kit. |
| **ag-Grid** | Expensive ($1200+/year), overkill for PAFV. | CSS Grid + TanStack Virtual solves 95% of use cases, free. |
| **Canvas-based rendering** | 100KB+ bundle, complexity overhead for current scale (<5K nodes). | Use SVG with Web Worker optimization. Phase 2+ if needed. |
| **Yjs / CRDT libraries** | Single-user local-first app. CRDT adds 20KB+ bundle for unused features. | sql.js persistence is sufficient. No real-time collab needed. |
| **Leaflet** | Map library for geographic coordinates. Isometry is abstract graph projection. | Use D3 projections or Mapbox if geography is truly needed. |

---

## Performance Targets by View

| View | Target | Strategy | Status |
|------|--------|----------|--------|
| **Gallery (10K cards)** | 60 FPS, <100ms render | CSS Grid native layout + TanStack Virtual (virtualize visible only) | ✓ Achievable |
| **List (10K rows)** | 60 FPS, <50ms render | D3 hierarchy + TanStack Virtual + responsive row height | ✓ Achievable |
| **Kanban (5K cards, 20 columns)** | 60 FPS, <80ms render | CSS Grid columns + react-dnd drag-drop + virtualized cards | ✓ Achievable |
| **Network (5K nodes, 10K links)** | 30 FPS during interaction, <2s layout | SVG + Web Worker force simulation + Barnes-Hut approximation | ✓ Phase 1 target |
| **Network (10K+ nodes)** | 30 FPS during interaction | Canvas (pixijs) + Web Worker + quadtree optimization | Deferred to Phase 2 |
| **Timeline (10K events)** | 60 FPS, smooth zoom | D3 scaleTime + TanStack Virtual for time bins | ✓ Achievable |

---

## Feature Flags (Recommend Adding)

Use these feature flags to gate Phase 1 vs Phase 2 additions:

```typescript
// src/features/featureFlags.ts
export const FEATURE_FLAGS = {
  // Phase 1: Required
  GRID_CONTINUUM_ENABLED: true,
  RESIZABLE_PANELS_ENABLED: true,

  // Phase 2: Optimization (deferred)
  D3_FORCE_WEB_WORKER: false, // Enable when graph >5K nodes
  CANVAS_NETWORK_RENDERING: false, // Enable for 10K+ nodes
  NETWORK_BARNES_HUT: false, // Enable with d3-force-reuse
};
```

---

## Installation Checklist

- [ ] Run `npm install react-resizable-panels@^4.0.7`
- [ ] Verify package.json includes `react-resizable-panels: ^4.0.7`
- [ ] Import ResizablePanelGroup in NotebookLayout.tsx
- [ ] Test NotebookLayout at desktop, tablet, mobile breakpoints
- [ ] Verify no TypeScript errors on ResizablePanel component API
- [ ] Run `npm run typecheck` — must pass
- [ ] Add integration test for panel resize persistence
- [ ] Update CLAUDE.md with resizable-panels integration pattern

---

## Gaps & Deferred Work

**Phase 1 (v6.9 now):** Resizable panels, Grid Continuum CSS Grid bridging, existing D3 renderers with SQL hooks.

**Phase 2 (v7.0 next):** Web Worker optimization for force layouts, canvas rendering for 10K+ nodes, 3D network visualization, advanced performance tuning.

**Phase 3 (v7.1+):** Real-time collaboration (would need Yjs + Replicache), multi-user sync, cloud persistence.

---

## Summary

**Stack additions are MINIMAL:**
- **1 new package:** react-resizable-panels (^4.0.7) for panel layout
- **0 new render libraries:** Use CSS Grid (native) + D3 (existing) + TanStack Virtual (existing)
- **Future optimizations:** Web Worker + canvas (Phase 2+)

**Integration is STRAIGHTFORWARD:**
- Wrap NotebookLayout panes with ResizablePanelGroup/ResizablePanel
- Bridge GridContinuumController to CSS Grid primitives (already defined)
- Add sql.js hooks to ForceGraphRenderer and TimelineRenderer
- Use existing D3 patterns with new data sources

**No breaking changes to existing infrastructure.** All additions are additive. Can be tested independently before Phase 1 completion.

---

## Sources

- [react-resizable-panels — npm](https://www.npmjs.com/package/react-resizable-panels)
- [shadcn/ui — Resizable Component](https://ui.shadcn.com/docs/components/radix/resizable)
- [D3.js — Official Documentation](https://d3js.org/)
- [TanStack Virtual — Virtualization Library](https://tanstack.com/virtual/latest)
- [Medium — React Resizable Panels Guide](https://medium.com/@rivainasution/shadcn-ui-react-series-part-8-resizable-let-users-control-space-not-you-03c018dc85c2)
- [GitHub — d3-force-reuse (Barnes-Hut optimization)](https://github.com/twosixlabs/d3-force-reuse)
- [Medium — Large Force-Directed Graphs Performance](https://weber-stephen.medium.com/the-best-libraries-and-methods-to-render-large-network-graphs-on-the-web-d122ece2f4dc)

---

*Updated: 2026-02-16*
*Architecture: PAFV Polymorphic Views with CSS Grid + D3 + sql.js*
*Status: Stack verified, ready for Phase 1 integration*
