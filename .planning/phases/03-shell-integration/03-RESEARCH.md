# Phase 3: Three-Canvas Integration - Research

**Researched:** February 8, 2025
**Domain:** Three-Canvas Notebook Architecture with SuperGrid Integration
**Confidence:** MEDIUM

## Summary

Phase 3 focuses on integrating SuperGrid as the Preview canvas within the existing three-canvas notebook architecture (Capture, Shell, Preview). The current implementation shows a working foundation with NotebookLayout managing responsive three-canvas layout, CaptureComponent using MDEditor for markdown editing, and ShellComponent providing terminal integration. SuperGrid V5 is already implemented and ready to serve as the keystone Preview component.

**Key finding:** The three-canvas architecture is already operational with proper focus management, responsive design, and component integration. The main task is enhancing each canvas with full functionality rather than building container infrastructure from scratch.

**Primary recommendation:** Focus on enhancing existing canvas components rather than rebuilding architecture, with special emphasis on making SuperGrid the centerpiece of the Preview canvas.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/react | 3.19.0+ | Rich text editing in Capture | Current industry standard for React editors |
| @tiptap/starter-kit | latest | TipTap extensions bundle | Common extensions package |
| @uiw/react-md-editor | current | Markdown editing (fallback) | Already integrated in CaptureComponent |
| @xterm/xterm | latest | Terminal emulator for Shell | Modern terminal emulator core |
| @xterm/addon-fit | latest | Responsive terminal sizing | Essential for responsive layouts |
| node-pty | latest | Process spawning for commands | Native process communication |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | latest | Claude API integration | AI command execution |
| @xterm/addon-web-links | latest | URL detection in terminal | Enhanced terminal UX |
| react-resizable-panels | latest | Advanced pane resize | If current resize needs enhancement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @uiw/react-md-editor | Pure TipTap | TipTap more powerful but requires more setup |
| Custom resize | react-resizable-panels | Current implementation sufficient for MVP |
| Custom terminal | Terminal in iframe | Current approach gives better control |

**Installation:**
```bash
npm install @tiptap/react @tiptap/starter-kit @xterm/xterm @xterm/addon-fit @anthropic-ai/sdk node-pty
```

## Architecture Patterns

### Three-Canvas Layout Architecture
```
src/
├── components/notebook/
│   ├── NotebookLayout.tsx      # Container with responsive layout
│   ├── CaptureComponent.tsx    # TipTap/MDEditor integration
│   ├── ShellComponent.tsx      # Terminal + Claude AI tabs
│   └── PreviewComponent.tsx    # SuperGrid + visualization tabs
├── contexts/
│   ├── NotebookContext.tsx     # Cross-canvas data sharing
│   ├── FocusContext.tsx        # Keyboard navigation
│   └── TerminalContext.tsx     # Shell state management
```

### Pattern 1: Responsive Canvas Layout
**What:** Three-column desktop, adaptive tablet/mobile stacking
**When to use:** All screen sizes need notebook functionality
**Example:**
```typescript
// Source: NotebookLayout.tsx lines 171-268
const renderLayout = (screenSize: 'mobile' | 'tablet' | 'desktop') => {
  if (screenSize === 'desktop') {
    return (
      <div className="h-full flex gap-0 p-2">
        <CaptureComponent width={captureWidth} />
        <DragDivider />
        <ShellComponent width={shellWidth} />
        <DragDivider />
        <PreviewComponent width={previewWidth} />
      </div>
    );
  }
  // Mobile/tablet: vertical stacking
};
```

### Pattern 2: Cross-Canvas Data Flow
**What:** SuperGrid selections update Capture context, Shell commands affect Preview
**When to use:** User interactions need to propagate across canvases
**Example:**
```typescript
// Source: PreviewComponent.tsx lines 322-334
onCellClick={(node) => {
  const card = cards.find(c => c.nodeId === node.id);
  if (card) {
    setActiveCard(card); // Updates Capture and Shell context
  }
}}
```

### Pattern 3: Tabbed Canvas Content
**What:** Each canvas supports multiple views via tabs
**When to use:** Rich functionality within canvas constraints
**Example:**
```typescript
// Source: ShellComponent.tsx lines 47-52, PreviewComponent.tsx lines 104-110
const tabs = [
  { id: 'claude-ai', icon: Bot, label: 'Claude AI' },
  { id: 'claude-code', icon: Terminal, label: 'Terminal' },
  { id: 'gsd-gui', icon: Settings, label: 'GSD GUI' }
];
```

### Anti-Patterns to Avoid
- **Direct DOM manipulation for resize:** Use React state and CSS transforms instead
- **Tight coupling between canvases:** Use shared contexts for communication
- **Blocking UI during terminal operations:** Ensure async handling with loading states

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich text editing | Custom markdown editor | @tiptap/react | Handles collaborative editing, extensions, mobile input |
| Terminal emulation | DOM-based fake terminal | @xterm/xterm | Full VT100 compatibility, performance, theming |
| Process spawning | WebSocket bridge to backend | node-pty | Direct process communication in Electron/Tauri |
| Pane resizing | Custom drag handlers | CSS Grid + React state | Handles edge cases, touch support, snapping |
| MCP integration | Custom WebSocket client | Existing CardBoard-v3 patterns | Proven context injection and tool execution |

**Key insight:** Terminal emulation especially complex - @xterm handles cursor control, color codes, scrollback, selection that would take months to implement correctly.

## Common Pitfalls

### Pitfall 1: Terminal Integration Scope Creep
**What goes wrong:** Attempting to build full IDE within terminal canvas
**Why it happens:** Terminal powerful, tempting to add file browsers, code completion
**How to avoid:** Keep terminal focused on command execution and Claude AI interaction
**Warning signs:** Terminal components growing beyond 500 lines, complex UI overlays

### Pitfall 2: Cross-Canvas State Synchronization
**What goes wrong:** Infinite re-render loops when canvases update each other
**Why it happens:** Circular dependencies between canvas contexts
**How to avoid:** Use uni-directional data flow, clearly define state ownership
**Warning signs:** useEffect with cross-canvas dependencies, performance warnings

### Pitfall 3: SuperGrid Integration Oversimplification
**What goes wrong:** Treating SuperGrid as simple data table instead of polymorphic system
**Why it happens:** Underestimating PAFV axis mapping and view transitions
**How to avoid:** Implement full Grid Continuum from start, not just basic grid view
**Warning signs:** SuperGrid props missing mode/axis configuration, fixed view assumptions

### Pitfall 4: Mobile Canvas Priority Confusion
**What goes wrong:** All three canvases competing for limited mobile screen space
**Why it happens:** Desktop-first design doesn't consider mobile workflow priorities
**How to avoid:** Implement canvas switching/tabbing for mobile, not forced stacking
**Warning signs:** Tiny unusable canvases on mobile, horizontal scrolling

## Code Examples

### SuperGrid as Preview Canvas
```typescript
// Source: PreviewComponent.tsx lines 315-334
<SuperGrid
  sql="SELECT * FROM nodes WHERE deleted_at IS NULL LIMIT 100"
  mode="supergrid"
  enableSuperStack={true}
  enableDragDrop={true}
  onCellClick={(node) => {
    console.log('SuperGrid cell clicked:', node);
    const card = cards.find(c => c.nodeId === node.id);
    if (card) {
      setActiveCard(card); // Cross-canvas update
    }
  }}
  onHeaderClick={(level, value, axis) => {
    console.log('SuperGrid header clicked:', { level, value, axis });
  }}
/>
```

### Cross-Canvas Focus Management
```typescript
// Source: NotebookLayout.tsx lines 54-77
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey)) {
      switch (event.key) {
        case '1': focusComponent('capture'); break;
        case '2': focusComponent('shell'); break;
        case '3': focusComponent('preview'); break;
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [focusComponent]);
```

### TipTap Enhanced Capture Integration
```typescript
// Source: CaptureComponent.tsx lines 58-95
const handleSaveCard = useCallback(async () => {
  const title = lines[0]?.replace(/^#+\s*/, '') || content.substring(0, 50).trim();
  const nodeId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  dbRun(`INSERT INTO nodes (id, name, summary, markdown_content, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [nodeId, title, summary, content, new Date().toISOString(), new Date().toISOString()]
  );
}, [content, dbRun, setContent]);
```

## State of the Art

| Current Implementation | Phase 3 Enhancement | When Complete | Impact |
|------------------------|---------------------|---------------|--------|
| Basic MDEditor in Capture | TipTap with slash commands | Q1 2025 | Rich editing with templates |
| Mock terminal in Shell | Full xterm + Claude API | Q1 2025 | AI-assisted development |
| Multiple Preview tabs | SuperGrid as primary tab | Q1 2025 | Polymorphic data projection |
| Manual resize handles | Smooth drag boundaries | Q1 2025 | Professional UX |

**Recent developments:**
- TipTap 3.19.0 (published 3 days ago): Enhanced React 19 compatibility
- SuperGrid V5: Grid Continuum operational with PAFV mapping
- sql.js integration: Direct database access eliminates bridge overhead

**Deprecated/outdated:**
- @uiw/react-md-editor: Still functional but TipTap preferred for rich editing
- Custom MessageBridge patterns: Replaced by sql.js direct access
- Terminal mocks: Phase 3.01-3.04 plans implement real terminal

## Integration Readiness Assessment

### SuperGrid V5 Preview Integration: HIGH Confidence
**Current state:** SuperGrid fully implemented with PAFV, Grid Continuum, Janus Density
**Integration points:** Already embedded in PreviewComponent.tsx line 315-334
**Missing:** Only SQL query optimization and cell selection handlers
**Recommendation:** Ready for production use as Preview canvas centerpiece

### Shell Component Enhancement: MEDIUM Confidence
**Current state:** Tab structure ready, terminal hooks stubbed, Claude API planned
**Plans exist:** Phase 3.01-3.04 provide complete implementation roadmap
**Missing:** Actual terminal emulation and Claude API integration
**Recommendation:** Follow existing plans, implementation is well-scoped

### Capture Component TipTap Upgrade: MEDIUM Confidence
**Current state:** MDEditor working, slash commands implemented
**Migration path:** TipTap can replace MDEditor incrementally
**Complexity:** TipTap setup more involved but well-documented
**Recommendation:** Optional enhancement, current MDEditor sufficient for MVP

### Three-Canvas Container: HIGH Confidence
**Current state:** Responsive layout working, focus management operational
**Polish needed:** Resize UX improvements, mobile canvas switching
**Foundation solid:** NotebookLayout.tsx handles all layout concerns correctly
**Recommendation:** Enhance rather than rebuild existing architecture

## Open Questions

1. **Claude API Integration Scope**
   - What we know: @anthropic-ai/sdk available, shell component prepared
   - What's unclear: MCP integration complexity vs. direct API calls
   - Recommendation: Start with direct API, add MCP later if needed

2. **Mobile Canvas Priority**
   - What we know: Responsive stacking implemented
   - What's unclear: Which canvas should be primary on mobile
   - Recommendation: Preview primary (SuperGrid), Capture secondary, Shell on-demand

3. **SuperGrid Performance with sql.js**
   - What we know: Direct sql.js access eliminates serialization
   - What's unclear: Performance at 1000+ nodes in SuperGrid
   - Recommendation: Implement pagination/virtual scrolling if needed

## Sources

### Primary (HIGH confidence)
- Isometry codebase inspection: src/components/notebook/*, src/components/supergrid/*
- Phase 3 execution plans: .planning/phases/03-shell-integration/03-01-PLAN.md through 03-04-PLAN.md
- CardBoard-v3 MCP patterns: src/notebook-app/shell/notebook-shell.ts

### Secondary (MEDIUM confidence)
- TipTap React documentation: https://tiptap.dev/docs/editor/getting-started/install/react
- @xterm/xterm documentation for terminal integration
- @anthropic-ai/sdk for Claude API integration

### Tertiary (LOW confidence)
- General three-canvas layout patterns (no specific documentation found)
- Mobile-first notebook interface best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries well-established and currently in use
- Architecture patterns: HIGH - Existing implementation demonstrates viability
- Integration complexity: MEDIUM - Some components need implementation vs. enhancement
- Mobile experience: LOW - Needs validation with real users

**Research date:** February 8, 2025
**Valid until:** March 10, 2025 (30 days for stable architecture patterns)
**Next research needed:** Phase 4 (Platform & Tooling) requirements after Phase 3 completion