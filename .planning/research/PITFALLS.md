# Domain Pitfalls: SuperGrid + Three-Canvas Notebook

**Domain:** Knowledge Management App (SuperGrid + Three-Canvas Notebook)
**Researched:** 2026-02-05 (SuperGrid), 2026-02-10 (Notebook)
**Context:** Adding SuperGrid + Notebook features to proven sql.js + D3.js foundation

---

# Part 1: SuperGrid Implementation Pitfalls

## Critical Pitfalls

### Pitfall 1: D3 Data Binding Without Key Functions
**What goes wrong:** Manual enter/update/exit patterns without proper key functions cause DOM thrashing and data inconsistency. Elements get created/destroyed unnecessarily, losing state and causing performance degradation.
**Why it happens:** Developers skip the key function parameter in `.data()` calls, defaulting to array index binding
**Consequences:**
- 50% slower rendering on data updates
- Lost selection states during re-renders
- Visual flicker and incorrect animations
- Memory leaks from orphaned event listeners
**Prevention:**
- ALWAYS use `.data(cards, d => d.id)` pattern
- ALWAYS use `.join()` over manual enter/update/exit
- Validate key functions return unique, stable identifiers
**Detection:** Watch for DOM element count mismatches after data updates; monitor for visual flicker during transitions

### Pitfall 2: WASM Memory Overflow with Large sql.js Databases
**What goes wrong:** WebAssembly.instantiate() out of memory errors when loading databases >100MB or during frequent reinitializations. Browser crashes or fails to load.
**Why it happens:**
- sql.js loads entire database into WASM memory space (4GB limit)
- Multiple WASM instances created without proper cleanup
- Page reloads accumulate memory without proper disposal
**Consequences:**
- Application won't start with production data
- Memory leaks causing progressive slowdown
- Safari particularly susceptible to WASM range errors
**Prevention:**
- Implement proper DatabaseService disposal in useEffect cleanup
- Monitor database file size; implement data archiving at 50MB
- Use single DatabaseService instance across app lifecycle
- Add memory monitoring to detect leaks early
**Detection:**
- Monitor WASM heap usage in browser dev tools
- Test with 100MB+ database files
- Check for increasing memory usage on page reloads

### Pitfall 3: SQL Performance Regression from Missing Indexes
**What goes wrong:** SuperGrid dynamic axis queries bypass existing indexes, causing 10x+ slower queries as data grows. What works with 1K records fails with 100K.
**Why it happens:**
- PAFV axis mappings generate dynamic WHERE clauses
- Indexes built for static queries don't match dynamic patterns
- FTS5 fallback to LIKE queries scales poorly
**Consequences:**
- Grid becomes unusable with real-world datasets
- Users abandon app due to perceived "hanging"
- CPU usage spikes block UI interactions
**Prevention:**
- Create composite indexes for common LATCH combinations
- Profile queries with EXPLAIN QUERY PLAN
- Set maximum query time limits (500ms) with user feedback
- Implement query result pagination for large datasets
**Detection:** Monitor query execution times; alert if >100ms for typical operations

## Moderate Pitfalls

### Pitfall 4: React-D3 Lifecycle Conflicts
**What goes wrong:** React re-renders conflict with D3 DOM manipulation, causing "double updates" where React overwrites D3 changes or D3 modifies React-controlled elements.
**Prevention:**
- Use refs to create D3-only DOM zones
- Never let React and D3 manage same DOM elements
- Trigger D3 updates via useEffect, not render cycles
- Use React for chrome/controls, D3 for data visualization only

### Pitfall 5: SuperGrid Cell Content Overflow
**What goes wrong:** Nested headers and multi-card cells break layout when content exceeds calculated cell dimensions. Text truncation and visual clipping.
**Prevention:**
- Implement text measurement before rendering
- Add ellipsis handling for long content
- Design responsive cell sizing with minimum dimensions
- Test with worst-case content (long names, many categories)

### Pitfall 6: PAFV State Synchronization Drift
**What goes wrong:** Axis assignments become inconsistent between FilterNav controls and actual grid rendering, causing "phantom" columns or incorrect data display.
**Prevention:**
- Single source of truth for PAFV state in React context
- Validate axis assignments before triggering re-renders
- Add development-mode state consistency checks
- Implement axis assignment snapshots for debugging

### Pitfall 7: Z-Axis Header Spanning Performance
**What goes wrong:** CSS-based header spanning calculations become expensive with deep hierarchies (4+ axis levels), causing layout thrashing.
**Prevention:**
- Limit maximum axis depth to 3 levels initially
- Pre-calculate spanning dimensions, cache results
- Use CSS transforms over layout-triggering properties
- Measure spanning calculation performance, optimize hot paths

---

# Part 2: Three-Canvas Notebook Pitfalls

**Researched:** 2026-02-10
**Confidence:** HIGH

## Critical Pitfalls (Notebook-Specific)

### Pitfall N1: TipTap Editor Re-renders on Every Transaction

**What goes wrong:**
The TipTap editor re-renders on every keystroke, causing severe performance degradation with large documents (>10,000 characters). React component tree re-renders cascade through parent components, making each render exponentially more expensive. In a three-pane layout, this can trigger unnecessary re-renders in Shell and Preview panes.

**Why it happens:**
The `useEditor` hook by default re-renders the editor on every transaction (every keystroke, selection change, or content update). When `EditorProvider` and `useEditor` are used together, or when the editor is nested in a React component tree with unstable contexts, every character typed triggers a full React reconciliation.

**How to avoid:**
```typescript
// In Capture pane TipTap integration
const editor = useEditor({
  extensions: [...],
  content: initialContent,
  shouldRerenderOnTransaction: false, // CRITICAL: prevents re-render on every keystroke
  immediatelyRender: false, // Required for SSR/hydration stability
  onUpdate: ({ editor }) => {
    // Debounce expensive operations like database writes
    debouncedSave(editor.getJSON());
  }
});
```

Additional prevention:
- Isolate editor component from parent re-renders using `React.memo` with strict equality checks
- Never place editor inside a Context Provider that updates frequently
- Use React Node Views sparingly - each creates a new React root and mounts asynchronously

**Warning signs:**
- Typing lag with >1,000 characters in editor
- Browser DevTools Performance tab shows excessive React reconciliation during typing
- Memory profiler shows growing heap during editing sessions
- CPU usage spikes during normal typing

**Phase to address:**
Phase 3: Three-Canvas Integration - Capture pane implementation

**Sources:**
- [React rendering performance demo | Tiptap Editor Docs](https://tiptap.dev/docs/examples/advanced/react-performance)
- [Integration performance | Tiptap Editor Docs](https://tiptap.dev/docs/guides/performance)

---

### Pitfall N2: Claude API Rate Limit Cascading Failures

**What goes wrong:**
Multiple Shell tabs making concurrent Claude API requests hit rate limits (429 errors), but the application continues making requests without exponential backoff, triggering acceleration limits that persist for hours. User loses access across ALL Claude API integrations (not just this app).

**Why it happens:**
Claude API has three-dimensional rate limiting: requests per minute (50-4,000 RPM depending on tier), input tokens per minute (ITPM), and output tokens per minute (OTPM). Exceeding ANY of these triggers a 429 with a `retry-after` header. Without queue-based throttling, multiple Shell tabs race to make requests, creating a thundering herd. Acceleration limits kick in when usage spikes sharply, even if under absolute limits.

**How to avoid:**
```typescript
// Shell integration: Queue-based architecture with backoff
class ClaudeAPIQueue {
  private queue: Request[] = [];
  private processing = false;
  private lastRequest = 0;

  async enqueue(request: Request): Promise<Response> {
    // Monitor response headers PROACTIVELY
    const checkHeaders = (response: Response) => {
      const remaining = response.headers.get('anthropic-ratelimit-requests-remaining');
      const resetAt = response.headers.get('anthropic-ratelimit-requests-reset');
      if (remaining && parseInt(remaining) < 5) {
        // Throttle BEFORE hitting limit
        this.throttleUntil(resetAt);
      }
    };

    try {
      const response = await this.processWithBackoff(request);
      checkHeaders(response);
      return response;
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.headers.get('retry-after');
        await this.exponentialBackoff(retryAfter);
        return this.enqueue(request); // Retry with backoff
      }
      throw error;
    }
  }

  private async exponentialBackoff(retryAfter?: string) {
    const waitMs = retryAfter
      ? parseInt(retryAfter) * 1000
      : Math.min(1000 * Math.pow(2, this.retryCount), 60000);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}
```

Additional prevention:
- Implement prompt caching: cached tokens don't count toward ITPM limits (5x effective throughput)
- Ramp up usage gradually in new deployments to avoid acceleration limits
- Use batch requests: combine multiple small prompts into single well-structured requests
- Monitor tier status - Tier 1 (50 RPM) vs Tier 4 (4,000 RPM) has 80x difference

**Warning signs:**
- 429 errors in Shell console
- `retry-after` headers in responses
- Sudden drop in successful requests after period of high activity
- All requests failing with 529 (Anthropic overload) vs 429 (your limit)

**Phase to address:**
Phase 3: Three-Canvas Integration - Shell Claude AI tab implementation

**Sources:**
- [Rate limits - Claude API Docs](https://platform.claude.com/docs/en/api/rate-limits)
- [Claude API Rate Limits: Production Scaling Guide](https://www.hashbuilds.com/articles/claude-api-rate-limits-production-scaling-guide-for-saas)
- [How to Fix Claude API 429 Rate Limit Error: Complete 2026 Guide](https://www.aifreeapi.com/en/posts/fix-claude-api-429-rate-limit-error)

---

### Pitfall N3: xterm.js Remote Code Execution via DCS Commands

**What goes wrong:**
Malicious input to the terminal emulator (from AI-generated code, copy-pasted commands, or compromised data sources) contains Device Control String (DCS) sequences that execute arbitrary code in the browser context. Since the terminal has access to the file system via Tauri APIs, RCE can read/write local files, exfiltrate SQLite database, or corrupt data.

**Why it happens:**
xterm.js inherited a vulnerability from term.js (2013) where DCS responses weren't properly sanitized. While the specific DCS bug (CVE-2019-0542) was patched, the fundamental attack surface remains: terminal input goes through JavaScript, and any JS on the page can intercept keystrokes (including passwords). ANSI escape sequences can manipulate terminal display to hide malicious commands (MinTTY, Xshell, ZOC vulnerabilities).

**How to avoid:**
```typescript
// Shell/Terminal.tsx: Sanitize and sandbox
import { Terminal as XTermTerminal } from '@xterm/xterm';
import { sanitizeAnsiEscapes } from './terminal-sanitization';

// 1. Input sanitization for ALL sources
const sanitizeInput = (input: string): string => {
  // Strip DCS sequences entirely
  const withoutDCS = input.replace(/\x1bP[^\x1b]*\x1b\\/g, '');
  // Validate against allowlist of ANSI codes
  return sanitizeAnsiEscapes(withoutDCS);
};

// 2. Restrict file system access via Tauri permissions
// tauri.conf.json:
{
  "plugins": {
    "fs": {
      "scope": {
        "allow": [
          "$APPDATA/**",
          "$DOCUMENT/**"
        ],
        "deny": [
          "**/.env",
          "**/credentials.json",
          "**/.ssh/**",
          "**/id_rsa*"
        ]
      }
    }
  }
}

// 3. Separate terminal contexts for AI output vs user input
const createSandboxedTerminal = () => {
  const term = new XTermTerminal({
    allowProposedApi: false, // Disable experimental features
    allowTransparency: false,
    disableStdin: true // For AI output display only
  });
  return term;
};

// 4. Paste protection: inspect before execution
const handlePaste = async (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData('text');
  if (!text) return;

  // Warning for suspicious patterns
  if (text.match(/\x1b|curl.*\||wget.*\||rm\s+-rf/)) {
    const confirmed = await confirmDialog(
      'Pasted content contains potentially dangerous commands. Review before executing?'
    );
    if (confirmed) {
      showTextEditor(text); // Review in safe editor first
      return;
    }
  }

  terminal.paste(sanitizeInput(text));
};
```

**Warning signs:**
- Terminal displays unexpected characters or formatting after paste
- File system errors in Tauri console when terminal is active
- Browser console shows errors related to terminal input processing
- Security scanner flags outdated xterm.js version

**Phase to address:**
Phase 3: Three-Canvas Integration - Shell terminal emulator implementation

**Sources:**
- [Security - xterm.js Docs](https://xtermjs.org/docs/guides/security/)
- [Vulnerability in xterm.js - CVE-2019-0542](https://goteleport.com/blog/xterm-js-vulnerability-affects-vs-code-users/)
- [Don't Trust This Title: Abusing Terminal Emulators with ANSI Escape Characters](https://www.cyberark.com/resources/threat-research-blog/dont-trust-this-title-abusing-terminal-emulators-with-ansi-escape-characters)

---

### Pitfall N4: Three-Pane Context Cascade Re-renders

**What goes wrong:**
Capture pane edit triggers NotebookContext update → re-renders Shell and Preview panes → D3.js visualization in Preview re-initializes → loses zoom/pan state, triggers expensive SQL query re-execution → UI freezes for 500ms-2s on every keystroke in Capture.

**Why it happens:**
React Context value changes trigger re-renders in ALL consumers, even if they only use a portion of the context. In a three-pane layout with shared NotebookContext:
```typescript
// ANTI-PATTERN
const NotebookContext = createContext({
  activeCard: card,           // Changes on every Capture edit
  cards: allCards,            // Changes when Capture saves
  layout: layoutState,        // Changes when user resizes panes
  createCard: fn,             // Stable but in same object
  updateCard: fn,             // Stable but in same object
  // ... 15+ more properties
});

// Preview pane only needs activeCard.id, but re-renders on ALL changes
```

Unpreventable re-renders occur because there's no way to subscribe to a subset of Context value, even with useMemo. Components that use API-only (createCard, updateCard) still re-render when data (activeCard) changes.

**How to avoid:**
```typescript
// CORRECT: Split context into orthogonal concerns
// 1. Data context (changes frequently)
const NotebookDataContext = createContext({
  activeCard: card,
  cards: allCards,
});

// 2. API context (stable, never changes)
const NotebookAPIContext = createContext({
  createCard: fn,
  updateCard: fn,
  deleteCard: fn,
});

// 3. Layout context (changes independently)
const NotebookLayoutContext = createContext({
  layout: layoutState,
  updateLayout: fn,
});

// Shell pane: only uses API, won't re-render on Capture edits
function ShellPane() {
  const { createCard } = useContext(NotebookAPIContext); // Stable
  // No re-render when activeCard changes in Capture
}

// Preview pane: memoize expensive D3 operations
function PreviewPane() {
  const { activeCard } = useContext(NotebookDataContext);

  // Re-render only when activeCard.id changes, not on every property change
  const cardId = activeCard?.id;
  const d3Visualization = useMemo(() => {
    return createD3Viz(cardId);
  }, [cardId]); // Stable until different card selected

  return <div ref={d3Visualization.ref} />;
}

// 4. Memoize Context Provider value at root
function NotebookProvider({ children }) {
  const [activeCard, setActiveCard] = useState(null);

  // Memoize to prevent re-render if parent re-renders
  const dataValue = useMemo(() => ({ activeCard }), [activeCard]);
  const apiValue = useMemo(() => ({
    createCard: createCardFn,
    updateCard: updateCardFn,
  }), []); // Stable, never changes

  return (
    <NotebookAPIContext.Provider value={apiValue}>
      <NotebookDataContext.Provider value={dataValue}>
        {children}
      </NotebookDataContext.Provider>
    </NotebookAPIContext.Provider>
  );
}
```

**Warning signs:**
- React DevTools Profiler shows excessive re-renders in non-edited panes
- D3.js visualizations reset zoom/pan state unexpectedly
- Browser Performance tab shows React reconciliation during typing in Capture
- `useEffect` hooks in Preview/Shell fire on every Capture keystroke

**Phase to address:**
Phase 3: Three-Canvas Integration - notebook context architecture

**Sources:**
- [How to Handle React Context Performance Issues](https://oneuptime.com/blog/post/2026-01-24-react-context-performance-issues/view)
- [How to write performant React apps with Context](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context)
- [Pitfalls of overusing React Context](https://blog.logrocket.com/pitfalls-of-overusing-react-context/)

---

### Pitfall N5: Notebook Card Sync Conflicts with PAFV Projections

**What goes wrong:**
User creates a notebook card in Capture pane, it gets a `node_id` linking to the `nodes` table. Meanwhile, SuperGrid in Preview pane displays filtered nodes via LATCH queries. The new notebook card appears in SuperGrid immediately (FTS5 trigger indexed it), but has incomplete LATCH metadata (no folder, no tags, no priority). SuperGrid groups it in "undefined" column, breaking column spanning calculations. User edits LATCH properties in SuperGrid → updates `nodes` table → orphans the `notebook_cards` row because the join assumes `node_id` is immutable.

**Why it happens:**
The `notebook_cards` table extends `nodes` with notebook-specific fields (markdown_content, rendered_content, card_type, layout_position). The join is one-to-one via `node_id`. But PAFV projections query `nodes` directly for performance, not the joined view. Two concurrent write paths exist:
1. Capture pane → `notebook_cards` table → creates linked `nodes` row with minimal LATCH data
2. SuperGrid → `nodes` table directly → updates LATCH properties, doesn't know about `notebook_cards`

No transaction coordinates the two writes. No trigger propagates SuperGrid changes back to `notebook_cards.properties`.

**How to avoid:**
```typescript
// db/notebook-integration.ts: Single source of truth for notebook card operations

// 1. Atomic creation with complete LATCH metadata
async function createNotebookCard(
  type: NotebookCardType,
  initialLatchData: Partial<LatchProperties>
): Promise<NotebookCard> {
  const db = await getDatabase();

  // Transaction ensures both rows created atomically
  await db.transaction(async (tx) => {
    const nodeId = crypto.randomUUID();
    const cardId = crypto.randomUUID();

    // Create node FIRST with complete LATCH data
    await tx.run(`
      INSERT INTO nodes (id, node_type, name, folder, tags, priority, status, created_at, modified_at)
      VALUES (?, 'notebook', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [nodeId, initialLatchData.name || 'Untitled', initialLatchData.folder,
        JSON.stringify(initialLatchData.tags || []), initialLatchData.priority || 0,
        initialLatchData.status || 'draft']);

    // Create notebook_cards row with reference
    await tx.run(`
      INSERT INTO notebook_cards (id, node_id, card_type, markdown_content, properties, created_at, modified_at)
      VALUES (?, ?, ?, '', '{}', datetime('now'), datetime('now'))
    `, [cardId, nodeId, type]);

    return { id: cardId, nodeId, cardType: type };
  });
}

// 2. Bidirectional sync: SuperGrid changes propagate to notebook_cards.properties
CREATE TRIGGER IF NOT EXISTS sync_nodes_to_notebook_cards
AFTER UPDATE ON nodes
WHEN NEW.node_type = 'notebook'
BEGIN
  UPDATE notebook_cards
  SET properties = json_set(
    COALESCE(properties, '{}'),
    '$.latch_folder', NEW.folder,
    '$.latch_tags', NEW.tags,
    '$.latch_priority', NEW.priority,
    '$.latch_status', NEW.status
  ),
  modified_at = datetime('now')
  WHERE node_id = NEW.id;
END;

// 3. PAFV queries use materialized view for notebook cards
CREATE VIEW IF NOT EXISTS notebook_nodes_view AS
SELECT
  n.*,
  nc.markdown_content,
  nc.card_type,
  nc.layout_position
FROM nodes n
LEFT JOIN notebook_cards nc ON nc.node_id = n.id
WHERE n.node_type = 'notebook';

// SuperGrid queries this view, not raw nodes table
const notebookNodes = await db.exec(`
  SELECT * FROM notebook_nodes_view
  WHERE folder = ? AND deleted_at IS NULL
  ORDER BY created_at DESC
`, [selectedFolder]);
```

**Warning signs:**
- Notebook cards appearing in SuperGrid "undefined" column
- SuperGrid edits to notebook card properties not reflected in Capture pane
- FTS5 search finding notebook cards but missing LATCH filters
- Database integrity check errors on `node_id` foreign key

**Phase to address:**
Phase 3: Three-Canvas Integration - notebook cards in PAFV projections

---

### Pitfall N6: Memory Leaks from D3.js Event Listeners in Preview Pane

**What goes wrong:**
Preview pane switches between SuperGrid, Network, and Timeline views. Each D3.js renderer attaches event listeners (zoom, drag, click) to SVG elements. When view switches, React unmounts the component but D3 event listeners persist on detached DOM nodes. After 10+ view switches, browser memory grows by 50-100MB, eventually causing tab crash.

**Why it happens:**
D3.js uses `selection.on('event', handler)` which doesn't participate in React's lifecycle. When React unmounts a component containing a D3 visualization:
```typescript
// ANTI-PATTERN
function PreviewPane({ activeView }) {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // D3 attaches listeners
    svg.call(d3.zoom().on('zoom', handleZoom));
    svg.selectAll('.node').on('click', handleClick);
    svg.selectAll('.node').on('drag', d3.drag().on('drag', handleDrag));

    // MISSING: cleanup on unmount
    // Listeners remain attached to detached nodes
  }, [activeView]);

  return <svg ref={svgRef} />;
}
```

Browser garbage collector can't free the SVG node because D3 event handlers hold references. `handleZoom`, `handleClick`, `handleDrag` closures also capture component state, preventing that from being GC'd.

**How to avoid:**
```typescript
// CORRECT: Explicit cleanup in useEffect return
function PreviewPane({ activeView }) {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // Create zoom behavior
    const zoomBehavior = d3.zoom().on('zoom', handleZoom);
    svg.call(zoomBehavior);

    // Attach node listeners
    const nodes = svg.selectAll('.node');
    nodes.on('click', handleClick);

    const dragBehavior = d3.drag()
      .on('start', handleDragStart)
      .on('drag', handleDrag)
      .on('end', handleDragEnd);
    nodes.call(dragBehavior);

    // CRITICAL: cleanup on unmount or view change
    return () => {
      // Remove D3 zoom
      svg.on('.zoom', null); // Removes all zoom listeners

      // Remove node listeners
      nodes.on('click', null);
      nodes.on('.drag', null); // Removes all drag listeners

      // Clear D3 selections to release references
      svg.selectAll('*').remove();
    };
  }, [activeView]); // Re-run when view changes

  return <svg ref={svgRef} />;
}

// For complex visualizations, use disposal pattern
class D3Visualization {
  private svg: d3.Selection;
  private listeners: Array<{ element: any; event: string }> = [];

  attach(svgElement: SVGElement) {
    this.svg = d3.select(svgElement);
    this.setupVisualization();
  }

  private on(selection: d3.Selection, event: string, handler: Function) {
    selection.on(event, handler);
    this.listeners.push({ element: selection, event });
  }

  dispose() {
    // Remove all tracked listeners
    this.listeners.forEach(({ element, event }) => {
      element.on(event, null);
    });
    this.listeners = [];

    // Clear SVG
    this.svg.selectAll('*').remove();
    this.svg = null;
  }
}

// React integration with proper cleanup
function PreviewPane() {
  const vizRef = useRef<D3Visualization>();

  useEffect(() => {
    const viz = new D3Visualization();
    viz.attach(svgRef.current);
    vizRef.current = viz;

    return () => {
      viz.dispose(); // Guaranteed cleanup
    };
  }, [activeView]);
}
```

**Warning signs:**
- Browser DevTools Memory Profiler shows growing heap over time
- Performance tab shows increasing GC pauses
- Detached DOM nodes count increasing in memory snapshot
- Browser tab becomes sluggish after multiple view switches

**Phase to address:**
Phase 3: Three-Canvas Integration - Preview pane view switching

**Sources:**
- [Best text editors for React - Memory Management](https://blog.logrocket.com/best-text-editors-react/)
- React D3.js integration patterns (general D3 cleanup practices)

---

## Technical Debt Patterns (Combined)

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip key functions in D3 data binding | Faster initial implementation | Performance degradation, state loss | Never - always use key functions |
| Store TipTap content as HTML in database | Faster initial render (no markdown parsing) | Can't query structure, versioning impossible, XSS risk | Never - use ProseMirror JSON |
| Single NotebookContext for all state | Simpler to implement (one provider) | Re-render cascade kills performance with 3+ panes | Never - split by concern |
| Skip terminal input sanitization | Launch faster, one less dependency | RCE vulnerability, user data at risk | Never - security non-negotiable |
| Poll Claude API instead of queue | Simpler code (no queue logic) | Hit rate limits immediately, unpredictable failures | Never - queue is 50 LOC |
| Inline D3.js in React components | Familiar React patterns | Memory leaks, broken React DevTools, impossible to debug | Only for static visualizations |
| Store notebook layout in component state | Works for single session | Lost on refresh, can't persist per-user | Only for MVP demo |
| Use localStorage for notebook_cards | No sql.js dependency initially | Can't join with LATCH queries, no FTS5 search | Never - defeats PAFV architecture |
| Skip TipTap `shouldRerenderOnTransaction: false` | Default behavior, less config | Typing lag with >1,000 chars, unusable at scale | Never - one line of config |
| Hardcode grid dimensions | Simple initial layout | Poor responsive behavior | Prototype only |
| Manual enter/update/exit over .join() | More explicit control | Harder to maintain, error-prone | Never - .join() is canonical |
| Store full database in WASM memory | Fast queries | Memory overflow with real data | Development only |
| Skip EXPLAIN QUERY PLAN profiling | Faster development | Slow queries at scale | Early prototyping only |

## Integration Gotchas (Combined)

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TipTap + React | Using `EditorProvider` AND `useEditor` together | Use `useEditor` only - `EditorProvider` is wrapper around it |
| xterm.js + Tauri | Allowing shell access to entire file system | Whitelist `$APPDATA` and `$DOCUMENT`, blacklist credentials |
| Claude API | Ignoring `retry-after` header, using static backoff | Read header, use it as minimum wait time, exponential fallback |
| D3.js + sql.js | Fetching all nodes, filtering in JavaScript | Push filters to SQL WHERE clause, return minimal result set |
| FTS5 + notebook_cards | Querying `nodes_fts` without joining `notebook_cards` | Create `notebook_cards_fts` with triggers, or use `notebook_nodes_view` |
| ProseMirror collab | Using Y.js for single-user local app | Don't add Y.js unless multi-user needed - adds 200KB bundle |
| React Context + D3 | Passing D3 instance through context | Pass container ref, create D3 instance in child useEffect |
| TipTap Node Views | Using React components for every node type | Only for complex interactive nodes - use native for text/paragraphs |
| React-D3 Integration | Letting React manage D3-controlled DOM | Use refs to create D3-only zones |
| PAFV State Management | Creating new context for SuperGrid | Extend existing FilterContext/PAFVContext |
| Database Queries | Using separate DB instances | Single DatabaseService instance with proper cleanup |

## Performance Traps (Combined)

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| TipTap default re-render | Typing lag, CPU spikes | Set `shouldRerenderOnTransaction: false` | >1,000 characters in document |
| Context cascade re-renders | All panes re-render on Capture edit | Split contexts by concern (data/API/layout) | 3+ consumers of same context |
| D3 memory leaks | Browser tab crash after 10+ view switches | Remove event listeners in useEffect cleanup | Every view switch without cleanup |
| Claude API thundering herd | All requests fail with 429 | Queue-based architecture with header monitoring | 3+ concurrent Shell tabs |
| sql.js query in D3 render | Preview pane freezes on every data change | Memoize query results, only re-query on filter change | >1,000 nodes in result set |
| FTS5 re-indexing | 500ms lag on every card save | Debounce writes, batch updates in transaction | >10,000 notebook cards |
| localStorage for layout | Can't sync across windows/tabs | Use sql.js table for layout, subscribe to changes | User opens 2+ windows |
| Missing key functions in D3 data binding | Visual flicker, slow updates | Always use `d => d.id` key functions | >100 DOM elements |
| WASM memory accumulation | Progressive slowdown | Proper database disposal, memory monitoring | >50MB database size |
| Synchronous SQL queries on main thread | UI freezing | Move queries to web workers (future consideration) | >10K records |
| Missing indexes for dynamic queries | Slow grid updates | Create composite indexes for LATCH combinations | >5K records |
| Header spanning calculations | Layout thrashing | Cache spanning dimensions, use CSS transforms | >3 axis levels |

## Security Mistakes (Combined)

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting terminal input from AI | RCE via DCS sequences, arbitrary file access | Sanitize ANSI escapes, whitelist file paths in Tauri config |
| Storing API keys in notebook cards | Keys leaked in database exports, CloudKit sync | Use system keychain (Tauri + keytar), never in database |
| Rendering unsanitized markdown in Preview | XSS if user pastes malicious HTML | Use DOMPurify before rendering markdown → HTML |
| Allowing terminal access to .env files | Credentials exfiltrated via `cat .env` | Blacklist credential files in Tauri fs plugin scope |
| No rate limiting on notebook card creation | DoS by creating 100K cards crashes browser | Client-side throttle (1 card/sec), validate in sql.js trigger |
| Trusting clipboard content in terminal | Malicious paste executes hidden commands | Show paste preview, sanitize ANSI escapes |
| Eval-ing Claude API responses | AI-generated code executes arbitrary JavaScript | Never eval - only execute in sandboxed terminal |
| SQL injection in dynamic queries | Data corruption | Use parameterized queries only |
| Memory dumps containing data | Data exposure | Clear sensitive data from memory |

## UX Pitfalls (Combined)

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Preview pane loses zoom state on edit | User must re-zoom after every Capture keystroke | Memoize D3 state, only re-render data layer |
| No loading state during Claude API call | Appears frozen, user clicks multiple times | Show spinner, disable input, queue subsequent requests |
| Terminal doesn't show CWD | User doesn't know where commands execute | Display CWD in header, update on `cd` |
| Capture pane auto-saves on every keystroke | Database writes cause lag, wear SSD | Debounce saves to 500ms, batch in transaction |
| No error when hitting rate limit | Confusing silent failure | Show toast with retry countdown from `retry-after` header |
| Pane resize doesn't persist | User re-adjusts every session | Store layout in sql.js, restore on mount |
| No undo in TipTap editor | User can't recover from accidental deletion | Enable TipTap history extension (built-in undo/redo) |
| Shell output mixed with errors | Can't distinguish command success/failure | Use ANSI colors, prefix errors with '✗' |
| No loading states during slow queries | Users think app is frozen | Progressive loading indicators |
| Abrupt view transitions | Jarring experience | Smooth animated transitions |
| Inconsistent interaction patterns | Confusion about what's clickable | Unified hover/click behaviors |
| No error recovery from failed queries | Dead-end user experience | Graceful error handling with retry options |

## "Looks Done But Isn't" Checklist (Combined)

### SuperGrid
- [ ] **D3 Data Binding:** Often missing key functions — verify `d => d.id` pattern used consistently
- [ ] **Memory Management:** Often missing WASM disposal — verify stable memory usage during extended use
- [ ] **Query Performance:** Often missing index optimization — verify sub-100ms query times with real datasets
- [ ] **React Integration:** Often mixing React/D3 DOM control — verify clean separation of responsibilities
- [ ] **Error Handling:** Often missing query failure recovery — verify graceful degradation on database errors
- [ ] **State Consistency:** Often missing PAFV validation — verify axis assignments stay synchronized
- [ ] **Responsive Design:** Often hardcoded dimensions — verify grid adapts to different screen sizes
- [ ] **Transition States:** Often missing loading indicators — verify user feedback during operations

### Three-Canvas Notebook
- [ ] **TipTap editor:** Typing works, but did you verify >10,000 character performance with `shouldRerenderOnTransaction: false`?
- [ ] **Claude API integration:** Successful responses work, but did you test 429 handling with exponential backoff + queue?
- [ ] **Terminal emulator:** Basic commands work, but did you sanitize DCS sequences and restrict file access in Tauri config?
- [ ] **Three-pane context:** Panes render, but did you split into separate Data/API/Layout contexts to prevent cascade re-renders?
- [ ] **D3.js visualizations:** Views display, but did you add cleanup in useEffect to remove event listeners on unmount?
- [ ] **notebook_cards PAFV:** Cards appear in SuperGrid, but did you verify bidirectional sync with triggers and materialized view?
- [ ] **Markdown preview:** Renders correctly, but did you sanitize with DOMPurify to prevent XSS?
- [ ] **Auto-save:** Saves on edit, but did you debounce to 500ms and batch in transactions?
- [ ] **Layout persistence:** Resizes work, but does layout survive page refresh (sql.js storage)?
- [ ] **FTS5 search:** Finds nodes, but does it search notebook_cards.markdown_content with dedicated FTS5 table?
- [ ] **Memory profiling:** App runs, but did you test 20+ view switches and verify no detached DOM node growth?
- [ ] **Rate limit monitoring:** API works, but did you implement proactive header monitoring BEFORE hitting limits?

## Recovery Strategies (Combined)

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| D3 data binding without keys | MEDIUM | Refactor data bindings to include key functions, test performance |
| WASM memory overflow | HIGH | Implement database cleanup, add memory monitoring, reduce data size |
| Missing SQL indexes | LOW | Add indexes for common query patterns, re-test performance |
| React-D3 DOM conflicts | MEDIUM | Refactor to separate React/D3 DOM ownership, test edge cases |
| PAFV state drift | MEDIUM | Add state validation, implement consistency checks |
| TipTap re-render cascade shipped | LOW | Add `shouldRerenderOnTransaction: false` to useEditor config, deploy hotfix |
| Hit Claude API acceleration limit | MEDIUM | Wait for limit reset (hours), implement queue, deploy, ramp up gradually |
| xterm.js RCE exploited | HIGH | Revoke compromised API keys, audit file system access logs, add sanitization, security audit |
| Context cascade re-renders shipped | MEDIUM | Split contexts, memoize providers, may require refactor of 3-5 components |
| D3 memory leaks in production | MEDIUM | Add cleanup to useEffect, test with memory profiler, deploy, advise users to refresh |
| notebook_cards orphaned from nodes | HIGH | Write migration to re-link via properties, add bidirectional sync trigger |
| No rate limiting on card creation | LOW | Add client-side throttle + sql.js trigger CHECK constraint on creation rate |
| Eval'd Claude responses | CRITICAL | Immediate incident response, assume compromise, rotate all credentials, add sandboxing |

## Pitfall-to-Phase Mapping (Combined)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| **SuperGrid Pitfalls** |||
| D3 data binding without keys | Phase 2: SuperGrid | Code review mandatory for all D3 patterns |
| WASM memory overflow | Phase 1: Foundation | Memory monitoring and cleanup testing |
| SQL performance regression | Phase 2: SuperGrid | Query profiling with real datasets |
| React-D3 DOM conflicts | Phase 2: SuperGrid | Clear DOM ownership boundaries |
| PAFV state drift | Phase 2: SuperGrid | State validation layer |
| Z-axis spanning performance | Phase 2: SuperGrid | Limit initial depth, profile calculations |
| **Notebook Pitfalls** |||
| TipTap re-renders | Phase 3: Capture pane | Type 10,000 chars, verify <16ms frame time in DevTools |
| Claude API rate limits | Phase 3: Shell AI tab | Spawn 5 Shell tabs, make concurrent requests, verify queue serialization |
| xterm.js RCE | Phase 3: Shell terminal | Paste malicious DCS sequence, verify sanitization blocked it |
| Context cascade | Phase 3: Notebook architecture | Edit in Capture, verify Shell/Preview don't re-render in React DevTools |
| D3 memory leaks | Phase 3: Preview pane | Switch views 20 times, verify heap size stable in Memory Profiler |
| notebook_cards sync | Phase 3: PAFV integration | Edit LATCH in SuperGrid, verify reflected in Capture pane |
| Markdown XSS | Phase 3: Preview rendering | Paste `<img src=x onerror=alert(1)>`, verify sanitized |
| No auto-save debounce | Phase 3: Capture pane | Type rapidly, verify <1 database write per 500ms |
| Layout lost on refresh | Phase 3: Layout persistence | Resize panes, refresh, verify restored |
| FTS5 notebook search | Phase 3: Search integration | Search markdown content, verify finds notebook_cards |
| Terminal file access | Phase 3: Shell security | Try `cat ~/.ssh/id_rsa`, verify Tauri blocked |
| Rate limit monitoring | Phase 3: API integration | Monitor headers, verify throttle at 5 remaining requests |

## Sources

### SuperGrid (HIGH Confidence)
- IsometryKB integration gaps analysis (/Users/mshaler/Developer/Projects/IsometryKB/notes/apple-notes/CardBoard/⚠️ Integration Gaps-.md)
- Existing SuperGrid.ts implementation (/Users/mshaler/Developer/Projects/Isometry/src/d3/SuperGrid.ts)
- DatabaseService architecture (/Users/mshaler/Developer/Projects/Isometry/src/db/DatabaseService.ts)
- SuperGrid architecture specification (/Users/mshaler/Developer/Projects/IsometryKB/V1V2_Port/SuperGrid.md)

### Notebook - TipTap Performance (HIGH Confidence)
- [React rendering performance demo | Tiptap Editor Docs](https://tiptap.dev/docs/examples/advanced/react-performance)
- [Integration performance | Tiptap Editor Docs](https://tiptap.dev/docs/guides/performance)
- [React node views | Tiptap Editor Docs](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react)
- [Frequently Asked Questions | Tiptap Editor Docs](https://tiptap.dev/docs/guides/faq)

### Notebook - Claude API Rate Limiting (HIGH Confidence)
- [Rate limits - Claude API Docs](https://platform.claude.com/docs/en/api/rate-limits)
- [Our approach to rate limits for the Claude API](https://support.claude.com/en/articles/8243635-our-approach-to-rate-limits-for-the-claude-api)
- [Claude API Rate Limits: Production Scaling Guide](https://www.hashbuilds.com/articles/claude-api-rate-limits-production-scaling-guide-for-saas)
- [How to Fix Claude API 429 Rate Limit Error: Complete 2026 Guide](https://www.aifreeapi.com/en/posts/fix-claude-api-429-rate-limit-error)

### Notebook - Terminal Security (HIGH Confidence)
- [Security - xterm.js Docs](https://xtermjs.org/docs/guides/security/)
- [Vulnerability in xterm.js - CVE-2019-0542](https://goteleport.com/blog/xterm-js-vulnerability-affects-vs-code-users/)
- [Don't Trust This Title: Abusing Terminal Emulators with ANSI Escape Characters](https://www.cyberark.com/resources/threat-research-blog/dont-trust-this-title-abusing-terminal-emulators-with-ansi-escape-characters)

### Notebook - React Context Performance (HIGH Confidence)
- [How to Handle React Context Performance Issues (2026)](https://oneuptime.com/blog/post/2026-01-24-react-context-performance-issues/view)
- [How to write performant React apps with Context](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context)
- [Pitfalls of overusing React Context](https://blog.logrocket.com/pitfalls-of-overusing-react-context/)
- [React re-renders guide: everything, all at once](https://www.developerway.com/posts/react-re-renders-guide)

### Notebook - Rich Text Editor Performance (MEDIUM Confidence)
- [Best text editors for React - LogRocket](https://blog.logrocket.com/best-text-editors-react/)
- [Which is the best React rich text editor? Five options compared](https://www.contentful.com/blog/react-rich-text-editor/)

### Notebook - Architecture Patterns (MEDIUM Confidence)
- [Observable for Jupyter Users](https://observablehq.com/@observablehq/observable-for-jupyter-users)
- [Interesting ideas in Observable Framework](https://simonwillison.net/2024/Mar/3/interesting-ideas-in-observable-framework/)
- [Collaborative editing - Hocuspocus Docs](https://tiptap.dev/docs/hocuspocus/guides/collaborative-editing)
- [Collaborative Text Editor Sync - Convex](https://www.convex.dev/components/prosemirror-sync)

### General (MEDIUM Confidence)
- D3.js performance optimization best practices (Web search: D3.js grid visualization performance anti-patterns, 2025)
- sql.js WASM memory limitations (Web search: sql.js WASM memory issues, GitHub issues, 2025)
- CardBoard historical failure patterns from IsometryKB evolution

### Architecture Analysis (MEDIUM Confidence - derived from codebase)
- Notebook sync patterns based on existing schema.sql and notebook types
- D3.js + sql.js integration patterns from existing Isometry codebase

---
*Research focus: SuperGrid + Three-Canvas Notebook implementation pitfalls*
*Researched: 2026-02-05 (SuperGrid), 2026-02-10 (Notebook)*
*Overall confidence: HIGH (security and performance), MEDIUM (notebook sync patterns - based on architectural analysis)*
