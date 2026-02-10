# Architecture Patterns: Three-Canvas Notebook Integration

**Domain:** Three-Canvas Notebook integration with existing Isometry architecture
**Researched:** 2026-02-10

## Recommended Architecture

### Integration Pattern: Provider Hierarchy Extension

The Three-Canvas Notebook integrates with existing architecture through **provider composition**, not replacement. Existing providers (FilterContext, PAFVContext, SelectionContext) remain unchanged. NotebookContext joins at the same level.

```
<App>
  <DatabaseProvider>          ← Unchanged (sql.js)
    <FilterProvider>          ← Unchanged (LATCH filters)
      <PAFVProvider>          ← Unchanged (axis mappings)
        <SelectionProvider>   ← Unchanged (selection state)
          <NotebookProvider>  ← NEW (notebook state)
            <ThemeProvider>   ← Unchanged
              <NotebookLayout>  ← NEW (three-canvas container)
                <CapturePane>   ← NEW
                <ShellPane>     ← NEW
                <PreviewPane>   ← MODIFIED (wraps existing D3 views)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **NotebookProvider** | Card CRUD, template management, layout state | DatabaseContext (sql.js), NotebookIntegration hook |
| **NotebookLayout** | Three-pane container, resize handles, state persistence | NotebookContext (layout state) |
| **CapturePane** | TipTap editor, slash commands, property editor | NotebookContext (createCard, updateCard), FilterContext (LATCH filters) |
| **ShellPane** | Terminal tabs (Claude AI, Claude Code, GSD GUI) | TerminalContext (shell state), GSD service (command routing) |
| **PreviewPane** | Tab router (SuperGrid, Network, Data Inspector) | Existing D3 renderers via ViewEngine, PAFVContext, FilterContext |

### Data Flow

#### Card Creation (Capture → Database → Preview)

```
1. User types in TipTap editor (CapturePane)
2. Slash command `/save-card` triggers
3. CapturePane calls NotebookContext.createCard(type, templateId?)
4. NotebookContext:
   a. Creates node in `nodes` table via db.execute()
   b. Creates linked record in `notebook_cards` table
   c. Updates local state (cards array)
   d. Triggers re-render
5. PreviewPane re-queries via existing FilterContext
6. D3 renderer binds new card via .join()
```

**SQL queries:**
```sql
-- Step 1: Insert node
INSERT INTO nodes (id, name, content, folder, created_at, modified_at)
VALUES (?, ?, ?, 'notebook', datetime('now'), datetime('now'));

-- Step 2: Insert notebook_card (links to node)
INSERT INTO notebook_cards (id, node_id, card_type, markdown_content, properties, created_at, modified_at)
VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'));
```

#### Shell Command Execution (Shell → Terminal → GSD)

```
1. User types command in ShellPane terminal (xterm.js)
2. TerminalContext captures input
3. GSD integration hook parses command
4. Routes to:
   - Claude AI MCP server (if AI command)
   - Claude Code WebSocket (if /gsd command)
   - Local shell (if system command)
5. Output streams back to terminal
6. GSD GUI renders structured output (if applicable)
```

#### PAFV Projection (Preview → D3 → sql.js)

```
1. User changes axis mapping in PAFVContext
2. PAFVContext dispatches new state
3. PreviewPane's active D3 renderer receives update via props
4. Renderer calls db.exec() with new SQL WHERE/ORDER BY clause
5. sql.js returns results synchronously
6. D3 .join() re-binds data with key function (d => d.id)
7. Enter/update/exit handles visual transition
```

**No serialization boundary.** D3 renderer calls `db.exec()` directly in same JS runtime.

## Patterns to Follow

### Pattern 1: Notebook Cards Join PAFV Projections

**What:** Notebook cards are nodes with extended metadata. They participate in all PAFV projections just like regular nodes.

**When:** User switches to Preview tab showing SuperGrid, Network, or any D3 view.

**Implementation:**
```typescript
// In D3 renderer (e.g., SuperGrid.ts)
function render(container: HTMLElement, data: Node[], config: ViewConfig) {
  // Query includes notebook_cards via JOIN
  const results = db.exec(`
    SELECT
      n.*,
      nc.card_type,
      nc.markdown_content,
      nc.properties
    FROM nodes n
    LEFT JOIN notebook_cards nc ON nc.node_id = n.id
    WHERE n.deleted_at IS NULL
      ${config.filters.compiledSQL}
    ORDER BY ${config.pafvProjection.orderByClause}
  `);

  // Same .join() pattern, key function ensures continuity
  d3.select(container)
    .selectAll('.card')
    .data(results, d => d.id)
    .join('div')
      .attr('class', d => `card ${d.card_type || 'regular'}`)
      .text(d => d.name);
}
```

### Pattern 2: React Controls, D3 Renders

**What:** React components (CapturePane, ShellPane, PreviewPane) dispatch state changes. D3 renderers consume state and render visualizations.

**When:** Any user interaction that changes what's displayed.

**Implementation:**
```typescript
// In PreviewPane (React component)
function PreviewPane() {
  const { state } = usePAFV();
  const { compiledQuery } = useFilters();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // D3 renderer is pure function
    // React tells it WHAT to render, not HOW
    const renderer = getRendererForViewType(activeTab);
    renderer.render(containerRef.current, [], {
      viewType: activeTab,
      pafvProjection: state,
      filters: compiledQuery
    });

    return () => renderer.destroy();
  }, [activeTab, state, compiledQuery]);

  return <div ref={containerRef} />;
}
```

**Never:** Pass D3 selections or DOM references through React state. React owns the container `<div>`, D3 owns everything inside.

### Pattern 3: Terminal State Isolation

**What:** TerminalContext holds current working directory (CWD) as a ref, not state. Avoids re-renders on every CWD change.

**When:** User runs `cd` commands or shell navigates directories.

**Implementation:**
```typescript
// TerminalContext.tsx (already exists)
export function TerminalProvider({ children }: { children: ReactNode }) {
  const currentWorkingDirectory = useRef('/Users/mshaler/Developer/Projects/Isometry');

  const setWorkingDirectory = useCallback((path: string) => {
    currentWorkingDirectory.current = path; // Ref mutation, not state update
  }, []);

  return (
    <TerminalContext.Provider value={{ currentWorkingDirectory, setWorkingDirectory }}>
      {children}
    </TerminalContext.Provider>
  );
}
```

**Why:** Terminal output can be hundreds of lines. Using state would trigger re-render on every line append. Refs + manual DOM manipulation (via xterm.js) is correct pattern here.

### Pattern 4: TipTap Slash Commands → sql.js Writes

**What:** TipTap editor's slash command system creates notebook cards by writing directly to sql.js.

**When:** User types `/save-card`, `/send-to-shell`, or custom slash commands.

**Implementation:**
```typescript
// In CaptureComponent.tsx
function CaptureComponent() {
  const { createCard } = useNotebook();
  const { db } = useSQLite();

  const slashCommands = useMemo(() => [
    {
      id: 'save-card',
      label: 'Save as Card',
      category: 'isometry',
      action: async () => {
        const content = editor.getHTML();
        const { title, summary } = extractCardInfo(content);

        // Direct sql.js write via NotebookContext
        const card = await createCard('capture', undefined);

        // Update with markdown content
        await db.execute(
          'UPDATE notebook_cards SET markdown_content = ? WHERE id = ?',
          [content, card.id]
        );
      }
    }
  ], [createCard, db]);

  return <TipTapEditor slashCommands={slashCommands} />;
}
```

### Pattern 5: Three-Canvas Layout Persistence

**What:** User's pane sizes and positions are stored in localStorage and restored on app load.

**When:** User resizes panes or app restarts.

**Implementation:**
```typescript
// In NotebookLayout.tsx (to be created)
function NotebookLayout() {
  const { layout, updateLayout } = useNotebook();

  const handleResize = useCallback((component: 'capture' | 'shell' | 'preview', newSize: LayoutPosition) => {
    updateLayout(component, newSize);
    // updateLayout internally calls layoutManager.saveLayout()
  }, [updateLayout]);

  return (
    <ResizableLayout
      initialSizes={{
        capture: layout.capture,
        shell: layout.shell,
        preview: layout.preview
      }}
      onResize={handleResize}
    >
      <CapturePane />
      <ShellPane />
      <PreviewPane />
    </ResizableLayout>
  );
}
```

**Storage:**
```json
// localStorage['notebook_layout']
{
  "capture": { "x": 0, "y": 0, "width": 40, "height": 100 },
  "shell": { "x": 40, "y": 0, "width": 30, "height": 100 },
  "preview": { "x": 70, "y": 0, "width": 30, "height": 100 }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Dual State Management

**What:** Storing the same data in both NotebookContext and FilterContext/PAFVContext.

**Why bad:** State drift. Notebook cards are nodes, so they're already in the nodes table. Don't duplicate in a separate notebook-specific cache.

**Instead:** NotebookContext manages `notebook_cards` table (extended metadata). FilterContext queries `nodes` table with LEFT JOIN to `notebook_cards` when needed. Single source of truth.

### Anti-Pattern 2: React Rendering D3 Content

**What:** Using React components to render individual cards in SuperGrid.

**Why bad:** Breaks "D3 renders, React controls" principle. Thousands of React components for grid cells = performance disaster. D3's .join() is designed for this use case.

**Instead:** React renders one `<div ref={containerRef} />`. D3 populates it with cards via `.join()`. React never touches card DOM elements.

### Anti-Pattern 3: Terminal Output via React State

**What:** Storing terminal output lines in useState and mapping to `<div>` elements.

**Why bad:** Every output line triggers re-render of entire terminal component. xterm.js already manages its own DOM efficiently.

**Instead:** Use xterm.js's built-in terminal instance. Pass ref to TerminalContext. Write to terminal via `terminal.writeln()` (DOM mutation, not state update).

### Anti-Pattern 4: Bridging D3 and React via Callbacks

**What:** D3 renderer calling React setState on every interaction (click, drag, zoom).

**Why bad:** Creates serialization boundary we eliminated. D3 should handle interaction directly, only dispatching to React when control-level state changes (e.g., switching views).

**Instead:** D3 owns interaction. On selection change, D3 updates SelectionContext (existing pattern). On view switch, React tells D3 which renderer to use via ViewEngine.

### Anti-Pattern 5: Mixing Notebook Mode and Regular Mode

**What:** Trying to support both "notebook mode" and "regular app mode" with different component trees.

**Why bad:** Code duplication. NotebookLayout just wraps existing components.

**Instead:** NotebookLayout is always rendered. When `isNotebookMode = false`, render PreviewPane at 100% width and hide Capture/Shell. Single component tree, conditional visibility.

## Scalability Considerations

| Concern | At 100 cards | At 10K cards | At 1M cards |
|---------|--------------|--------------|-------------|
| **Card list loading** | Query all (fast) | Query all (acceptable) | Virtual scrolling + pagination (infinite scroll) |
| **Template library** | Load all to localStorage | Load all (5-10 templates) | Same (templates don't scale with cards) |
| **PAFV projection** | D3 renders all | D3 renders all | Canvas fallback for >50K visible cells |
| **FTS5 search** | Instant (<1ms) | Fast (10-50ms) | Indexed (50-200ms), acceptable for user-triggered search |
| **Terminal history** | Array in memory | Array in memory | Circular buffer (max 1000 lines) |

### Virtual Scrolling Strategy (10K+ cards)

```typescript
// For large card sets in PreviewPane
import { FixedSizeList } from 'react-window';

function PreviewPane() {
  const { cards } = useNotebook();

  if (cards.length > 5000) {
    // Use virtual scrolling for large sets
    return (
      <FixedSizeList
        height={window.innerHeight}
        itemCount={cards.length}
        itemSize={60}
        width="100%"
      >
        {({ index, style }) => (
          <div style={style}>
            <CardRow card={cards[index]} />
          </div>
        )}
      </FixedSizeList>
    );
  }

  // For smaller sets, render directly via D3
  return <D3GridView cards={cards} />;
}
```

**Decision point:** 5,000 cards. Below = D3 .join(). Above = react-window + D3 for visible rows only.

## Integration Points

### New Components

| Component | Path | Purpose |
|-----------|------|---------|
| `NotebookLayout` | `src/components/notebook/NotebookLayout.tsx` | Three-pane container with resize handles |
| `CapturePane` (enhanced) | `src/components/notebook/CaptureComponent.tsx` | TipTap editor with slash commands, property panel |
| `ShellPane` (enhanced) | `src/components/notebook/ShellComponent.tsx` | Terminal tabs (Claude AI, Claude Code, GSD GUI) |
| `PreviewPane` (enhanced) | `src/components/notebook/PreviewComponent.tsx` | Tab router for D3 views (SuperGrid, Network, Data Inspector) |

**Status:** Skeleton implementations exist. Need enhancement for full integration.

### Modified Components

| Component | Path | Modification |
|-----------|------|---------|
| `SuperGrid` | `src/d3/SuperGrid.ts` | Add LEFT JOIN to notebook_cards, render card_type badge |
| `FilterContext` | `src/contexts/FilterContext.tsx` | Add notebook card type filter (capture/shell/preview) |
| `DatabaseProvider` | `src/db/DatabaseContext.tsx` | Ensure notebook_cards table exists on init |

**Scope:** Minimal. Existing D3 renderers already query nodes table. Adding LEFT JOIN to notebook_cards is 1-line change.

### New Contexts

| Context | Path | Purpose |
|---------|------|---------|
| `NotebookContext` | `src/contexts/NotebookContext.tsx` | Card CRUD, template management, layout state |

**Status:** Exists. Needs integration testing with sql.js.

### Dependencies to Add

| Library | Version | Purpose |
|---------|---------|---------|
| `@tiptap/react` | ^3.19.0 | TipTap editor core |
| `@tiptap/pm` | ^3.19.0 | ProseMirror dependencies |
| `@tiptap/starter-kit` | ^3.19.0 | Basic TipTap extensions |
| `xterm-for-react` | ^2.0.2 | Terminal component wrapper |
| `xterm` | ^5.5.0 | Terminal emulator library |
| `react-window` | ^1.8.10 | Virtual scrolling for large lists |

**Installation:**
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit xterm-for-react xterm react-window
```

## Build Order (Dependency-Aware)

### Phase 1: Foundation (Week 1)

1. **Verify sql.js notebook_cards table**
   - Run schema.sql in test environment
   - Verify FTS5 triggers work
   - Test INSERT/UPDATE/DELETE on notebook_cards

2. **Install UI dependencies**
   - npm install TipTap, xterm, react-window
   - Verify no version conflicts with existing D3/React versions

3. **Test NotebookContext in isolation**
   - Write unit tests for createCard, updateCard, deleteCard
   - Mock sql.js execute function
   - Verify localStorage persistence for layout/templates

### Phase 2: Individual Panes (Week 2)

4. **Build CapturePane**
   - TipTap editor with markdown support
   - Slash command system (`/save-card`, `/send-to-shell`)
   - Property panel (tags, priority, status)
   - Autosave to notebook_cards table

5. **Build ShellPane**
   - xterm.js terminal component
   - Tab switching (Claude AI, Claude Code, GSD GUI)
   - TerminalContext integration for CWD
   - Command history (up/down arrows)

6. **Build PreviewPane**
   - Tab router (SuperGrid, Network, Data Inspector)
   - Pass-through to existing D3 renderers
   - ViewEngine integration

**Test each pane standalone before integration.**

### Phase 3: Layout Integration (Week 3)

7. **Build NotebookLayout**
   - Three-pane container
   - Resize handles (react-resizable or custom)
   - Layout persistence to localStorage
   - Toggle notebook mode (show/hide Capture + Shell)

8. **Connect PreviewPane to FilterContext**
   - Add notebook card_type filter
   - Verify LATCH filters work on joined query
   - Test PAFV axis changes trigger re-render

9. **Connect CapturePane to PreviewPane**
   - Save card in Capture
   - Verify appears in Preview SuperGrid
   - Test property changes propagate

### Phase 4: Polish (Week 4)

10. **Add keyboard shortcuts**
    - Cmd+S to save card
    - Cmd+Enter to send to shell
    - Cmd+1/2/3 to switch panes

11. **Add template library UI**
    - Template picker in CapturePane
    - Built-in templates (meeting notes, code snippet, etc.)
    - Custom template creation from existing cards

12. **Performance testing**
    - Load 10K notebook cards
    - Measure render time in SuperGrid
    - Add virtual scrolling if needed
    - Test FTS5 search performance

**Gate:** All tests pass, no console errors, < 100ms render time for 1K cards.

## Data Flow Changes

### Before (Regular App Mode)

```
User interaction
  → React dispatches to FilterContext
  → FilterContext compiles to SQL
  → D3 renderer calls db.exec()
  → D3 .join() re-binds data
```

### After (Notebook Mode)

```
User types in Capture
  → NotebookContext.createCard()
  → db.execute(INSERT INTO notebook_cards)
  → (same as before for Preview updates)

User switches Preview tab
  → PreviewPane state change
  → ViewEngine selects renderer
  → D3 renderer calls db.exec() with LEFT JOIN notebook_cards
  → D3 .join() re-binds data
```

**Key insight:** Data flow is additive, not replaced. Notebook mode adds CapturePane and ShellPane as data input sources. PreviewPane still uses existing FilterContext → D3 → sql.js pipeline.

## Suggested Build Order (Tasks)

1. ✅ Verify sql.js with notebook_cards schema
2. ✅ Install TipTap, xterm, react-window dependencies
3. ✅ Test NotebookContext CRUD operations
4. ⬜ Build CapturePane with TipTap + slash commands
5. ⬜ Build ShellPane with xterm.js tabs
6. ⬜ Build PreviewPane tab router
7. ⬜ Build NotebookLayout three-pane container
8. ⬜ Integrate FilterContext with notebook card_type filter
9. ⬜ Connect CapturePane → PreviewPane flow
10. ⬜ Add keyboard shortcuts
11. ⬜ Add template library UI
12. ⬜ Performance test with 10K cards

**Parallelizable:** Tasks 4, 5, 6 can be built independently and tested in isolation.

**Sequential:** Tasks 7-9 require 4-6 complete. Tasks 10-12 require 7-9 complete.

## Sources

**Existing Architecture:**
- `/Users/mshaler/Developer/Projects/Isometry/CLAUDE.md` — Architecture truth document
- `/Users/mshaler/Developer/Projects/Isometry/src/contexts/NotebookContext.tsx` — Existing notebook context implementation
- `/Users/mshaler/Developer/Projects/Isometry/src/contexts/FilterContext.tsx` — LATCH filter → SQL compilation
- `/Users/mshaler/Developer/Projects/Isometry/src/state/PAFVContext.tsx` — PAFV axis mappings
- `/Users/mshaler/Developer/Projects/Isometry/src/db/schema.sql` — SQLite schema with notebook_cards table
- `/Users/mshaler/Developer/Projects/Isometry/src/engine/contracts/ViewEngine.ts` — D3 renderer interface

**Dependencies:**
- [TipTap React Integration](https://tiptap.dev/docs/editor/getting-started/install/react) — Official TipTap React docs (2026)
- [xterm-for-react](https://github.com/robert-harbison/xterm-for-react) — React wrapper for xterm.js
- [@pablo-lion/xterm-react](https://www.npmjs.com/package/@pablo-lion/xterm-react) — Alternative xterm React wrapper
- [react-window](https://www.npmjs.com/package/react-window) — Virtual scrolling for large lists

**Confidence:** HIGH — Architecture patterns verified in existing codebase, dependencies actively maintained, integration points well-defined.
