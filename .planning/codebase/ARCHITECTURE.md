# System Architecture

**Analysis Date:** 2026-01-21

## Architectural Pattern

**Dual-Stack Application:**
- React Prototype: Web-based rapid UI iteration
- Native Apps: Production iOS/macOS with CloudKit sync

## Core Frameworks

### PAFV (Planes → Axes → Facets → Values)
Spatial projection framework for data visualization.

| Layer | Purpose | Example |
|-------|---------|---------|
| **Planes** | 2D projection surfaces | Canvas, Card grid |
| **Axes** | Coordinate systems | X = Category, Y = Time |
| **Facets** | Filterable dimensions | Priority, Status, Folder |
| **Values** | Data binding | Node properties → visual attributes |

### LATCH (Location, Alphabet, Time, Category, Hierarchy)
Information filtering framework from Richard Saul Wurman.

| Axis | Filter Type | SQL Column |
|------|-------------|------------|
| **L** (Location) | Geographic | latitude, longitude |
| **A** (Alphabet) | Text search | name (FTS5) |
| **T** (Time) | Date ranges | created_at, modified_at, due_at |
| **C** (Category) | Tags/folders | folder, tags, status |
| **H** (Hierarchy) | Priority/importance | priority, importance |

### GRAPH (Links, Nesting, Sequence)
Relationship modeling between nodes.

| Type | Purpose | Example |
|------|---------|---------|
| **LINK** | References | Note links to Project |
| **NEST** | Parent-child | Folder contains Notes |
| **SEQUENCE** | Order | Task follows Task |
| **AFFINITY** | Similarity | Related by tags |

## Data Flow

### React Prototype

```
User Interaction
       ↓
React Context (FilterContext, PAFVContext)
       ↓
Filter Compiler (LATCH → SQL)
       ↓
useSQLiteQuery Hook
       ↓
DatabaseContext.execute()
       ↓
sql.js Query
       ↓
Transform (rowToNode)
       ↓
View Renderer (Grid, List, Network)
       ↓
D3.js Visualization
```

### Native Apps

```
User Action (SwiftUI)
       ↓
AppState ViewModel (@Published)
       ↓
IsometryDatabase Actor
       ↓
GRDB.swift SQLite Driver
       ↓
[Node] Result Array
       ↓
SwiftUI View
       ↓
CloudKitSyncManager (background)
```

## Provider Hierarchy (React)

```typescript
<ErrorBoundary>
  <BrowserRouter>
    <ThemeProvider>           // UI theme
      <DatabaseProvider>      // sql.js instance
        <AppStateProvider>    // Current app/view/dataset
          <FilterProvider>    // LATCH filters + DSL
            <PAFVProvider>    // Axis assignments
              <SelectionProvider>  // Selected nodes
                <AppContent />
              </SelectionProvider>
            </PAFVProvider>
          </FilterProvider>
        </AppStateProvider>
      </DatabaseProvider>
    </ThemeProvider>
  </BrowserRouter>
</ErrorBoundary>
```

**Nesting Rationale:**
- Inner contexts depend on outer providers
- Filters require Database
- Views require Filters + Database
- Selection is independent

## Key Abstractions

### ViewRenderer Interface
```typescript
interface ViewRenderer {
  readonly type: ViewType;
  setXAxis(facetId: string | null): void;
  setYAxis(facetId: string | null): void;
  render(container: D3Container, nodes: Node[], dimensions: Dimensions): void;
  destroy(): void;
}
```

**Implementations:** Grid, List, Kanban, Timeline, Calendar, Charts, Network, Tree

### Database Actor (Native)
```swift
public actor IsometryDatabase {
  // Thread-safe SQLite operations
  public func createNode(_ node: Node) async throws
  public func updateNode(_ node: Node) async throws
  public func deleteNode(id: String) async throws

  // Graph algorithms
  public func connectedNodes(from: String, maxDepth: Int) async throws -> [Node]
  public func shortestPath(from: String, to: String) async throws -> [Node]?
  public func pageRank(iterations: Int) async throws -> [(Node, Double)]
}
```

## Query Compilation

### Filter → SQL
```typescript
// Input: LATCH filter state
const filters = {
  category: { folders: ['Work', 'Personal'] },
  time: { preset: 'last-week' }
};

// Output: Parameterized SQL
const compiled = {
  sql: "folder IN (?, ?) AND created_at >= date('now', '-7 days')",
  params: ['Work', 'Personal']
};
```

### DSL → SQL
```
status:active AND priority:>5
       ↓ (Parser)
AST: AndNode { FilterNode, FilterNode }
       ↓ (Compiler)
SQL: "status = ? AND priority > ?" [active, 5]
```

## Graph Algorithms (Native)

| Algorithm | Implementation | Use Case |
|-----------|---------------|----------|
| **BFS** | Recursive CTE | Connected nodes within depth |
| **Shortest Path** | Recursive CTE | Path finding between nodes |
| **PageRank** | Iterative power method | Node importance ranking |
| **Dijkstra** | Weighted shortest path | Edge-weight pathfinding |

## Sync Architecture (Native)

```
Local SQLite ←→ CloudKitSyncManager ←→ CloudKit
      ↑                                    ↑
   sync_version                    CKServerChangeToken
   last_synced_at                  Zone changes
```

**Conflict Resolution:**
1. Detect: Compare syncVersion vs server version
2. Strategy: Apply configured resolution (default: latestWins)
3. Merge: Union tags, prefer newer text
4. Update: Increment syncVersion, set conflictResolvedAt

---

*Architecture analysis: 2026-01-21*
*Update when patterns change*
