# Phase 98: Isometry Embeds & Polish - Research

**Researched:** 2026-02-14
**Domain:** TipTap Node Extensions, D3.js Embedded Visualizations, Editor Performance
**Confidence:** HIGH

## Summary

This phase involves creating custom TipTap node extensions that embed live D3.js visualizations (SuperGrid, Network, Timeline) within the Capture pane editor. The codebase already has mature patterns for both custom TipTap extensions (CalloutExtension, ToggleExtension, BookmarkExtension) and D3.js renderers (SuperGridEngine, ForceGraphRenderer, TimelineRenderer), making this primarily an integration task rather than greenfield development.

The key technical challenges are: (1) creating atom nodes that host React components with D3.js visualizations, (2) parsing LATCH filter parameters from slash command syntax, (3) subscribing to sql.js data changes for live updates, and (4) managing ResizeObserver for responsive embed sizing. The existing `useSQLiteQuery` hook with `dataVersion` tracking already provides the reactive data foundation.

**Primary recommendation:** Implement embed nodes as atom TipTap extensions using ReactNodeViewRenderer, following the existing BookmarkExtension pattern but with D3.js visualization containers instead of link previews.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/core | 3.19.0 | Node extension API | Already installed, provides Node.create() |
| @tiptap/react | 3.19.0 | ReactNodeViewRenderer | Already installed, bridges TipTap to React |
| D3.js | 7.9.0 | Visualization rendering | Already used for SuperGrid/Network/Timeline |
| sql.js | 1.13.0 | Database queries | Already provides synchronous queries + dataVersion |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ResizeObserver (native) | N/A | Responsive embeds | Built into modern browsers |
| tippy.js | 6.3.7 | Parameter input UI | Already used for slash command menus |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom ResizeObserver | react-respo library | Extra dependency for minimal benefit |
| Inline parameter parsing | Modal dialog | Slash command syntax is faster UX |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/notebook/editor/
  extensions/
    SuperGridEmbedExtension.ts   # Node extension definition
    NetworkEmbedExtension.ts
    TimelineEmbedExtension.ts
    embeds/
      index.ts                   # Re-exports all embed extensions
      parseEmbedParams.ts        # LATCH filter parameter parser
      useEmbedData.ts            # Hook for live data subscription
  nodes/
    SuperGridEmbedNode.tsx       # React component with D3 container
    NetworkEmbedNode.tsx
    TimelineEmbedNode.tsx
```

### Pattern 1: Atom Node Extension with ReactNodeViewRenderer
**What:** Create non-editable block nodes that host React components
**When to use:** For embeds that should be treated as single units (not editable content)
**Example:**
```typescript
// Source: Existing BookmarkExtension.ts + TipTap docs
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SuperGridEmbedNode } from '../nodes/SuperGridEmbedNode';

export interface SuperGridEmbedAttributes {
  sql: string;           // Custom SQL query (optional)
  xAxis: string;         // LATCH axis for columns
  yAxis: string;         // LATCH axis for rows
  xFacet: string;        // Column facet
  yFacet: string;        // Row facet
  height: number;        // Embed height in pixels
  valueDensity: number;  // Initial density level (0-3)
  extentDensity: string; // 'sparse' | 'dense'
}

export const SuperGridEmbedExtension = Node.create({
  name: 'supergridEmbed',
  group: 'block',
  atom: true, // Non-editable, treated as single unit

  addAttributes() {
    return {
      sql: { default: '' },
      xAxis: { default: 'category' },
      yAxis: { default: 'time' },
      xFacet: { default: 'folder' },
      yFacet: { default: 'year' },
      height: { default: 400 },
      valueDensity: { default: 0 },
      extentDensity: { default: 'dense' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-supergrid-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-supergrid-embed': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SuperGridEmbedNode);
  },

  addCommands() {
    return {
      setSuperGridEmbed: (attrs = {}) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
        });
      },
    };
  },
});
```

### Pattern 2: Embed Node Component with D3 Container
**What:** React component that hosts D3 visualization with ResizeObserver
**When to use:** For all embed nodes that render D3 visualizations
**Example:**
```typescript
// Source: TipTap React node views docs + existing ForceGraphRenderer pattern
import { useRef, useEffect, useState, useMemo } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { SuperGridEngine } from '@/d3/SuperGridEngine';

export function SuperGridEmbedNode({ node, updateAttributes }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const engineRef = useRef<SuperGridEngine | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: node.attrs.height });

  // Build SQL from LATCH parameters
  const sql = useMemo(() => {
    if (node.attrs.sql) return node.attrs.sql;
    return `SELECT * FROM nodes WHERE deleted_at IS NULL`;
  }, [node.attrs.sql]);

  // Subscribe to data changes via dataVersion
  const { data: nodes, loading } = useSQLiteQuery(sql);

  // ResizeObserver for responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: node.attrs.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [node.attrs.height]);

  // Initialize D3 engine when container ready
  useEffect(() => {
    if (!svgRef.current || loading) return;

    // Create or update engine
    if (!engineRef.current) {
      engineRef.current = new SuperGridEngine(db, {
        width: dimensions.width,
        height: dimensions.height,
      });
      engineRef.current.mount(svgRef.current);
    }

    // Update data
    if (nodes?.length) {
      engineRef.current.setData(nodes);
    }

    return () => {
      engineRef.current?.unmount();
      engineRef.current = null;
    };
  }, [nodes, dimensions, loading]);

  return (
    <NodeViewWrapper className="supergrid-embed">
      <div ref={containerRef} className="supergrid-embed__container">
        {loading ? (
          <div className="supergrid-embed__loading">Loading...</div>
        ) : (
          <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
        )}
      </div>
      <div className="supergrid-embed__controls" contentEditable={false}>
        <button onClick={() => updateAttributes({ height: node.attrs.height + 100 })}>
          Expand
        </button>
      </div>
    </NodeViewWrapper>
  );
}
```

### Pattern 3: Slash Command Integration
**What:** Add embed commands to existing slash command registry
**When to use:** For triggering embed insertion via /supergrid, /network, /timeline
**Example:**
```typescript
// Source: Existing slash-commands.ts
// Add to SLASH_COMMANDS array
{
  id: 'supergrid',
  label: 'SuperGrid',
  description: 'Embed live SuperGrid visualization',
  category: 'isometry',
  shortcut: 'supergrid',
  action: ({ editor, range }) => {
    editor.chain()
      .focus()
      .deleteRange(range)
      .setSuperGridEmbed({
        xAxis: 'category',
        xFacet: 'folder',
        yAxis: 'time',
        yFacet: 'year',
        height: 400,
      })
      .run();
  },
},
```

### Anti-Patterns to Avoid
- **Re-rendering on every transaction:** Must use `shouldRerenderOnTransaction: false` in editor config
- **Creating new D3 instances on every render:** Use refs to persist D3 engine instances
- **Blocking main thread with large queries:** Use useSQLiteQuery hook (already optimized)
- **Hard-coded dimensions:** Always use ResizeObserver for responsive sizing
- **Manual DOM manipulation outside D3:** Let D3 own its SVG, React owns wrapper

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parameter parsing | Custom regex parser | Existing slash command suggestion system | Already handles completion, validation |
| Live data updates | Custom event system | useSQLiteQuery + dataVersion | Already tracks mutations |
| Responsive sizing | Manual resize handlers | ResizeObserver API | Native, performant, handles all cases |
| Node view lifecycle | Custom mount/unmount | ReactNodeViewRenderer props | Handles selection, focus, cleanup |
| Visualization engines | New D3 renderers | SuperGridEngine, ForceGraphRenderer, TimelineRenderer | Already built and tested |

**Key insight:** This phase is 80% integration, 20% new code. The hard parts (D3 renderers, TipTap extensions, sql.js reactivity) are already solved in the codebase.

## Common Pitfalls

### Pitfall 1: Editor Performance Degradation
**What goes wrong:** Embeds cause editor lag, especially with multiple embeds or large documents
**Why it happens:** React re-renders on every TipTap transaction; D3 visualizations are expensive
**How to avoid:**
- Set `shouldRerenderOnTransaction: false` (already done in useTipTapEditor)
- Use `atom: true` to prevent content selection inside embeds
- Debounce ResizeObserver callbacks (100ms minimum)
- Stop D3 simulations when embed scrolls out of viewport
**Warning signs:** Frame drops below 30fps, input lag exceeds 50ms

### Pitfall 2: Memory Leaks from D3 Instances
**What goes wrong:** D3 force simulations and event listeners persist after unmount
**Why it happens:** Missing cleanup in useEffect, or refs not cleared
**How to avoid:**
- Always return cleanup function from useEffect
- Call `engine.unmount()` or `renderer.destroy()` in cleanup
- Clear refs: `engineRef.current = null`
**Warning signs:** Memory increases over time when switching cards

### Pitfall 3: Stale Data in Embeds
**What goes wrong:** Embeds show outdated data after CRUD operations
**Why it happens:** Not subscribing to dataVersion changes from useSQLite
**How to avoid:**
- Use useSQLiteQuery hook (includes dataVersion dependency)
- Pass dataVersion as dependency in useEffect for D3 updates
**Warning signs:** Edit a node in Preview, embed doesn't update

### Pitfall 4: Embed Height Collapse
**What goes wrong:** Embeds collapse to 0 height or overflow container
**Why it happens:** Missing height constraints, CSS issues with atom nodes
**How to avoid:**
- Set explicit minHeight on embed containers
- Use CSS `aspect-ratio` for proportional sizing
- Test with ResizeObserver disabled to catch issues
**Warning signs:** Embeds invisible or overlap other content

### Pitfall 5: Parameter Serialization Issues
**What goes wrong:** LATCH parameters lost on save/reload
**Why it happens:** Attributes not properly serialized to HTML/Markdown
**How to avoid:**
- Define all attributes in addAttributes() with parseHTML/renderHTML
- Use data-* attributes for HTML serialization
- Test round-trip: insert -> save -> reload
**Warning signs:** Embeds reset to defaults after reopening document

## Code Examples

Verified patterns from the existing codebase:

### Existing Extension Pattern (BookmarkExtension)
```typescript
// Source: src/components/notebook/editor/extensions/BookmarkExtension.ts
export const BookmarkExtension = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') || '',
        renderHTML: (attributes) => ({ 'data-url': attributes.url }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkNode);
  },

  addCommands() {
    return {
      setBookmark: (url = '') => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { url },
        });
      },
    };
  },
});
```

### Existing D3 Renderer Pattern (ForceGraphRenderer)
```typescript
// Source: src/d3/visualizations/network/ForceGraphRenderer.ts
export class ForceGraphRenderer {
  private instance: ForceGraphInstance | null = null;
  private container: SVGGElement | null = null;

  render(
    container: SVGGElement,
    nodes: GraphNode[],
    links: GraphLink[],
    config: Partial<ForceGraphConfig> = {},
    callbacks: ForceGraphCallbacks = {}
  ): void {
    this.container = container;
    this.instance = createForceGraph(container, nodes, links, config, callbacks);
  }

  destroy(): void {
    this.instance?.stop();
    if (this.container) {
      d3.select(this.container).selectAll('*').remove();
    }
    this.instance = null;
    this.container = null;
  }
}
```

### Existing Reactive Data Hook (useSQLiteQuery)
```typescript
// Source: src/hooks/database/useSQLiteQuery.ts
export function useSQLiteQuery<T>(sql: string, params: unknown[] = []): QueryState<T> {
  const { execute, dataVersion } = useSQLite();

  const fetchData = useCallback(() => {
    const rows = execute(sql, params);
    setData(rows);
  }, [execute, sql, paramsKey, dataVersion]); // dataVersion triggers refetch

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
```

### Existing Node View Pattern (CalloutNode)
```typescript
// Source: src/components/notebook/editor/nodes/CalloutNode.tsx
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react';

export function CalloutNode({ node, updateAttributes }: NodeViewProps) {
  const type = node.attrs.type;

  return (
    <NodeViewWrapper className={`callout callout--${type}`}>
      <div className="callout__header">
        <select
          value={type}
          onChange={(e) => updateAttributes({ type: e.target.value })}
          contentEditable={false}
        >
          {/* options */}
        </select>
      </div>
      <NodeViewContent className="callout__content" />
    </NodeViewWrapper>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual D3 enter/update/exit | D3 .join() method | D3 v5 (2018) | Simpler code, less bugs |
| ViewBox for responsive SVG | ResizeObserver + explicit dimensions | 2020+ | Better control, smoother resize |
| Redux for embed state | TipTap node attributes + sql.js | Current codebase | Single source of truth |
| Polling for data updates | useSQLiteQuery dataVersion | Current codebase | Automatic reactivity |

**Deprecated/outdated:**
- `shouldRerenderOnTransaction: true` (default) - causes severe performance issues with large docs
- Manual ProseMirror plugin for node views - use ReactNodeViewRenderer instead
- Custom event bus for data changes - use dataVersion from SQLiteProvider

## Open Questions

1. **Parameter Input UX**
   - What we know: Slash commands can pass default attributes
   - What's unclear: Should parameters be editable after insertion? Modal vs. inline editing?
   - Recommendation: Start with non-editable defaults, add edit button later (like BookmarkNode)

2. **Viewport-Based Rendering**
   - What we know: D3 simulations can be stopped/started
   - What's unclear: Should embeds pause when scrolled out of viewport?
   - Recommendation: Implement IntersectionObserver for pause/resume in Phase 99

3. **Markdown Serialization**
   - What we know: TipTap Markdown extension handles basic serialization
   - What's unclear: How to represent embeds in Markdown export?
   - Recommendation: Use fenced code block with embed metadata: ` ```isometry-supergrid {...params} ``` `

## Sources

### Primary (HIGH confidence)
- [TipTap React Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react) - Extension API, ReactNodeViewRenderer
- [TipTap Performance Guide](https://tiptap.dev/docs/guides/performance) - shouldRerenderOnTransaction, optimization
- Existing codebase: BookmarkExtension.ts, CalloutExtension.ts, ForceGraphRenderer.ts

### Secondary (MEDIUM confidence)
- [TipTap Node API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node) - addAttributes, addCommands
- [React + D3 Integration](https://gist.github.com/alexcjohnson/a4b714eee8afd2123ee00cb5b3278a5f) - useRef + useEffect pattern
- [Responsive D3 with ResizeObserver](https://reactviz.com/scatterplots/responsive-resize-observer) - Modern responsive pattern

### Tertiary (LOW confidence)
- None - all findings verified against official docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in codebase
- Architecture: HIGH - Existing patterns from CalloutExtension, BookmarkExtension, ForceGraphRenderer
- Pitfalls: HIGH - Derived from existing useTipTapEditor performance notes and D3 cleanup patterns

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - stable domain, TipTap 3.x mature)
