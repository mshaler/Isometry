# Architecture Patterns

**Domain:** Isometry Notebook Sidecar
**Researched:** January 25, 2026

## Recommended Architecture

### Three-Component Layout with Shared State

```
┌─────────────────────────────────────────────────────────────────┐
│                        ISOMETRY NOTEBOOK                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│                 │                 │                             │
│    CAPTURE      │      SHELL      │           PREVIEW           │
│                 │                 │                             │
│  ┌───────────┐  │  ┌───────────┐  │  ┌─────────────────────────┐ │
│  │ Markdown  │  │  │ Terminal  │  │  │     WKWebView/          │ │
│  │ Editor    │  │  │ (xterm.js)│  │  │     Browser             │ │
│  │           │  │  │           │  │  │                         │ │
│  ├───────────┤  │  ├───────────┤  │  ├─────────────────────────┤ │
│  │Properties │  │  │Claude API │  │  │  D3 Visualizations      │ │
│  │Editor     │  │  │Integration│  │  │  (live preview)         │ │
│  └───────────┘  │  └───────────┘  │  └─────────────────────────┘ │
│                 │                 │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
│                                                                 │
│                     SHARED CONTEXT LAYER                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │NotebookCtx  │ │ FilterCtx   │ │  PAFVCtx    │ │ThemeCtx   │ │
│  │(new)        │ │ (existing)  │ │ (existing)  │ │(existing) │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
│                                                                 │
│                        DATA LAYER                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               SQLite Database                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │   │
│  │  │  nodes  │ │  edges  │ │ facets  │ │notebook_    │   │   │
│  │  │(exist.) │ │(exist.) │ │(exist.) │ │cards (new) │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Capture | Card editing, markdown, properties, save to SQLite | NotebookContext, existing FilterContext |
| Shell | Terminal, Claude API, command routing, development workflow | NotebookContext, Claude API, system terminal |
| Preview | Browser rendering, visualization, export, file preview | NotebookContext, D3 for visualizations |
| NotebookContext | Notebook-specific state, card management, component coordination | All three components + existing contexts |

### Data Flow

**Capture → Database → Main App:**
1. User edits markdown in Capture component
2. Auto-save writes to `notebook_cards` table
3. Card metadata populates standard `nodes` table
4. Main Isometry app queries `nodes` and sees notebook cards
5. Notebook cards participate in PAFV+LATCH+GRAPH operations

**Shell → Claude API → Capture:**
1. User types command in Shell terminal
2. Claude Code API processes command with notebook context
3. Response flows back to Shell display
4. If command generates content, flows to Capture component

**Preview → Visualization → Export:**
1. Preview component receives card content from NotebookContext
2. Markdown content renders in WKWebView
3. D3 visualizations render for data preview
4. Export functionality generates files

## Patterns to Follow

### Pattern 1: Context Provider Hierarchy (Existing Isometry Pattern)
**What:** Extend existing provider hierarchy with NotebookContext
**When:** All notebook components need shared state
**Example:**
```typescript
<ThemeProvider>
  <DatabaseProvider>
    <FilterProvider>
      <PAFVProvider>
        <NotebookProvider>  {/* New */}
          <NotebookLayout />
        </NotebookProvider>
      </PAFVProvider>
    </FilterProvider>
  </DatabaseProvider>
</ThemeProvider>
```

### Pattern 2: Component Communication via Context (Existing Pattern)
**What:** Components communicate through shared contexts, not direct props
**When:** Cross-component state updates needed
**Example:**
```typescript
// In Capture component
const { currentCard, saveCard } = useNotebook();
const { applyFilters } = useFilters(); // Existing

// In Shell component
const { currentCard } = useNotebook();
const { executeCommand } = useClaudeAPI();

// In Preview component
const { currentCard } = useNotebook();
const { renderVisualization } = useD3(); // Existing
```

### Pattern 3: SQLite Schema Extension (New but Based on Existing)
**What:** Extend existing schema without breaking changes
**When:** Need to store notebook-specific data
**Example:**
```sql
-- Extend existing nodes table for notebook cards
-- notebook_cards table for notebook-specific metadata
-- Maintain foreign key relationships with existing tables
```

### Pattern 4: Hook-Based Integration (Existing Pattern)
**What:** Use custom hooks for component logic, following existing patterns
**When:** Complex state management or API integration needed
**Example:**
```typescript
// Follow existing hook patterns
const useNotebookEditor = () => { /* markdown editor logic */ };
const useTerminalEmbed = () => { /* terminal embedding */ };
const useClaudeAPI = () => { /* API integration */ };
const useBrowserPreview = () => { /* browser component */ };
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Component Communication
**What:** Components calling each other's methods directly
**Why bad:** Tight coupling, breaks React patterns, hard to test
**Instead:** Use shared context and event-driven patterns

### Anti-Pattern 2: Separate Database for Notebook
**What:** Creating isolated storage for notebook cards
**Why bad:** Breaks integration with main app, duplicates data
**Instead:** Extend existing SQLite schema, maintain referential integrity

### Anti-Pattern 3: Reinventing Isometry Patterns
**What:** Creating new state management, styling, or data patterns
**Why bad:** Inconsistency, maintenance burden, integration friction
**Instead:** Extend existing FilterContext, use established hook patterns

### Anti-Pattern 4: Overly Complex Three-Way Binding
**What:** Complex synchronization between all three components simultaneously
**Why bad:** Race conditions, difficult debugging, performance issues
**Instead:** Hub-and-spoke pattern with NotebookContext as central coordinator

## Scalability Considerations

| Concern | At 100 cards | At 1K cards | At 10K cards |
|---------|--------------|-------------|--------------|
| SQLite Performance | Direct queries | Add indexes | Consider pagination |
| Terminal History | Memory buffer | Disk persistence | Rotation policy |
| Preview Rendering | Immediate | Debounced updates | Virtual scrolling |
| Context State Size | Full state | Selective state | Lazy loading |

## Integration with Existing Isometry Architecture

### Leverage Existing Infrastructure

**Database Layer:**
- Reuse `useSQLiteQuery` hook pattern
- Extend existing schema rather than creating parallel storage
- Maintain compatibility with existing `Node` and `Edge` types

**State Management:**
- Follow established Context provider pattern
- Integrate with existing FilterContext for data queries
- Use existing PAFVContext for visualization components

**UI Consistency:**
- Use existing Tailwind CSS variables and theme system
- Leverage established Radix UI components
- Follow existing responsive design patterns

**Type Safety:**
- Extend existing TypeScript interfaces
- Maintain compatibility with existing `ViewRenderer` interface
- Use established type converters and validators

### Data Flow Integration

**Notebook Cards as First-Class Citizens:**
```typescript
interface NotebookCard extends Node {
  notebookId: string;
  markdown: string;
  properties: Record<string, any>;
  shellContext: string | null;
  previewUrl: string | null;
}
```

**Seamless Query Integration:**
- Notebook cards appear in main app queries automatically
- Filter operations work on notebook cards using existing LATCH patterns
- Visualization components can render notebook cards alongside other data

## Sources

- [React Context Best Practices](https://kentcdodds.com/blog/how-to-use-react-context-effectively) - HIGH confidence
- [xterm.js Architecture Guide](https://xtermjs.org/docs/guides/architecture/) - HIGH confidence
- [WKWebView Integration Patterns](https://developer.apple.com/documentation/webkit/wkwebview) - HIGH confidence
- [SQLite Extension Patterns](https://sqlite.org/lang_altertable.html) - HIGH confidence