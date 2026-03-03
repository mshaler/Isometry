# CLAUDE.md — Isometry Native Data Layer

*Claude Code Implementation Guide for SQLite + CloudKit Architecture*

---

## Mission

Build Isometry's native data layer: **SQLite for storage, CloudKit for sync**. Pure Swift, pure native, no compromises.

**What we're building:**
- Thread-safe SQLite database using Swift Actors
- FTS5 full-text search
- Recursive CTEs for graph traversal (LATCH separates, GRAPH joins)
- CloudKit bidirectional sync with automatic conflict resolution
- iOS 15+ / macOS 12+ deployment targets

**What we're NOT building:**
- Web technologies (no sql.js, no IndexedDB, no WASM)
- Third-party graph databases (no KuzuDB)
- Complex dependencies (boring stack wins)

---

## Development Philosophy: GSD + TDD

### Get Stuff Done (GSD)

1. **Ship working code, not perfect code.** Start simple, iterate.
2. **One thing at a time.** Complete each task before starting the next.
3. **Fail fast, fix fast.** Run tests continuously, fix breaks immediately.
4. **When stuck, simplify.** Remove complexity, don't add it.

### Test-Driven Development (TDD)

**The Red-Green-Refactor cycle is non-negotiable:**

```
1. RED    → Write a failing test that defines desired behavior
2. GREEN  → Write minimum code to make it pass
3. REFACTOR → Clean up while keeping tests green
```

**TDD Rules:**
- No production code without a failing test first
- Tests must be fast (<100ms each)
- Tests must be independent (no shared state)
- Test behavior, not implementation
- One assertion per test (conceptually)

**Test Categories:**
| Type | Speed | Scope | When to Run |
|------|-------|-------|-------------|
| Unit | <10ms | Single function | Every save |
| Integration | <500ms | Multiple components | Before commit |
| Performance | <2s | Full system | Before PR |

---

## Project Structure

```
Isometry/
├── Package.swift
├── CLAUDE.md                    ← You are here
├── Sources/
│   ├── Database/
│   │   ├── IsometryDatabase.swift    ← Actor-based SQLite wrapper
│   │   ├── DatabaseError.swift       ← Error types
│   │   ├── RowDecoder.swift          ← SQLite → Swift decoding
│   │   └── GraphQueries.swift        ← Recursive CTE library
│   ├── Models/
│   │   ├── Node.swift                ← Core data model
│   │   ├── Edge.swift                ← Graph relationships
│   │   └── SyncState.swift           ← CloudKit sync metadata
│   ├── Sync/
│   │   ├── CloudKitSyncManager.swift ← Bidirectional sync
│   │   └── ConflictResolver.swift    ← Auto-resolution logic
│   └── Views/
│       └── SyncStatusView.swift      ← SwiftUI sync indicator
├── Tests/
│   ├── DatabaseTests.swift
│   ├── GraphQueryTests.swift
│   ├── SyncTests.swift
│   └── PerformanceTests.swift
└── Resources/
    ├── schema-v1.sql
    └── sample-data.sql
```

---

## Implementation Order

Follow this sequence exactly. Do not skip ahead.

### Phase 1: Schema & Foundation

**1.1 Create Package.swift**
```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "IsometryDatabase",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "IsometryDatabase", targets: ["IsometryDatabase"]),
    ],
    targets: [
        .target(name: "IsometryDatabase", dependencies: []),
        .testTarget(name: "IsometryDatabaseTests", dependencies: ["IsometryDatabase"]),
    ]
)
```

**1.2 Create schema-v1.sql**
- See `SQLITE-MIGRATION-PLAN-v2.md` for complete schema
- Nodes table with LATCH attributes
- Edges table for GRAPH relationships
- FTS5 virtual table with triggers
- Sync metadata tables

**1.3 Write Foundation Tests First (TDD)**
```swift
func testDatabaseInitialization() async throws {
    let db = IsometryDatabase.shared
    try await db.initialize()
    // Should not throw
}

func testPragmasApplied() async throws {
    // WAL mode, foreign keys, etc.
}
```

### Phase 2: CRUD Operations

**Write tests first for each operation:**

```swift
// Test: Create node
func testSaveNode() async throws {
    let node = Node(name: "Test")
    try await db.saveNode(node)
    let retrieved = try await db.getNode(node.id)
    XCTAssertEqual(retrieved?.name, "Test")
}

// Test: Update node
func testUpdateNode() async throws { ... }

// Test: Soft delete
func testSoftDelete() async throws { ... }

// Test: Hard delete
func testHardDelete() async throws { ... }
```

**Implementation pattern:**
1. Write failing test
2. Implement just enough to pass
3. Refactor for clarity
4. Move to next operation

### Phase 3: FTS5 Search

**Test first:**
```swift
func testBasicSearch() async throws {
    try await db.saveNode(Node(name: "Apple Pie", content: "delicious"))
    try await db.saveNode(Node(name: "Banana Bread", content: "yellow"))
    
    let results = try await db.search("apple")
    XCTAssertEqual(results.count, 1)
}

func testPrefixSearch() async throws {
    try await db.saveNode(Node(name: "Programming Tutorial"))
    
    let results = try await db.search("prog")
    XCTAssertEqual(results.count, 1)
}

func testEmptyQueryReturnsEmpty() async throws {
    let results = try await db.search("")
    XCTAssertTrue(results.isEmpty)
}
```

### Phase 4: Graph Queries

**Test the LATCH/GRAPH duality:**

```swift
// Test: Connected nodes (BFS)
func testConnectedNodes() async throws {
    // Create: A → B → C
    // Query from A with maxDepth 2
    // Expect: [A(0), B(1), C(2)]
}

// Test: Shortest path
func testShortestPath() async throws {
    // Create: A → B → C, A → D → C (two paths)
    // Query: shortest path A to C
    // Expect: length 2
}

// Test: Node importance
func testNodeImportance() async throws {
    // Create nodes with varying in-degree
    // Query importance
    // Expect: highest in-degree = highest importance
}
```

### Phase 5: CloudKit Sync

**Test sync operations:**

```swift
func testPendingSyncNodes() async throws {
    let node = Node(name: "Pending")
    try await db.saveNode(node)
    
    let pending = try await db.getPendingSyncNodes()
    XCTAssertTrue(pending.contains { $0.id == node.id })
}

func testMarkNodeSynced() async throws {
    let node = Node(name: "To Sync")
    try await db.saveNode(node)
    try await db.markNodeSynced(node.id, syncVersion: 1)
    
    let retrieved = try await db.getNode(node.id)
    XCTAssertEqual(retrieved?.syncStatus, .synced)
}
```

---

## Code Quality Gates

### Before Every Commit

```bash
# 1. Format code
swift format --in-place --recursive Sources/ Tests/

# 2. Run all tests
swift test

# 3. Check for warnings
swift build 2>&1 | grep -i warning && exit 1 || echo "No warnings"
```

### Quality Thresholds

| Metric | Threshold | Action if Failed |
|--------|-----------|------------------|
| Test coverage | >80% | Add missing tests |
| Build warnings | 0 | Fix all warnings |
| Test duration | <30s total | Optimize slow tests |
| FTS5 search | <100ms | Check indexes |
| Graph traversal | <500ms (10K nodes) | Optimize CTE |

---

## Architecture Principles

### PAFV: Planes → Axes → Facets → Values

Every view is a projection of the same data:
- **Planes**: x/y/z spatial coordinates
- **Axes**: LATCH organizing principles
- **Facets**: Specific attributes (due_date, status, priority)
- **Values**: Cards (Nodes + Edges)

**Key insight:** Any axis can map to any plane. View transitions are remappings, not rebuilds.

### LATCH Separates, GRAPH Joins

| Operation | SQL Pattern | Use Case |
|-----------|-------------|----------|
| LATCH filter | `WHERE folder = ?` | Grid, List, Calendar |
| LATCH group | `GROUP BY status` | Kanban |
| LATCH sort | `ORDER BY priority` | Ranked list |
| GRAPH traverse | Recursive CTE | Network, Tree |
| GRAPH aggregate | `JOIN` + `COUNT` | Relationship strength |

### Edges Are Cards

LPG (Labeled Property Graph) in SQLite:
- Edges have properties (channel, timestamp, weight)
- LATCH applies to edges too (filter by time, category)
- Enables rich relationship visualization

---

## Common Patterns

### Actor-Based Database Access

```swift
// Good: All database access through actor
public actor IsometryDatabase {
    public func query<T: Decodable>(_ sql: String) throws -> [T] { ... }
}

// Usage: Always await
let nodes = try await IsometryDatabase.shared.getAllNodes()
```

### Transaction Pattern

```swift
// Wrap multiple operations in transaction
try await db.transaction {
    try await db.saveNode(parent)
    try await db.saveNode(child)
    try await db.saveEdge(Edge(sourceId: parent.id, targetId: child.id))
}
```

### Error Handling

```swift
// Be specific, not generic
public enum DatabaseError: LocalizedError {
    case notInitialized
    case prepareFailed(String)
    case executeFailed(String)
    // ...
}

// Handle errors at boundaries
do {
    try await db.saveNode(node)
} catch DatabaseError.executeFailed(let sql) {
    logger.error("Failed to save node: \(sql)")
    // Recover or propagate
}
```

### Sync State Machine

```
idle → syncing → (success) → idle
                ↘ (failure) → retrying → syncing
                             ↘ (max retries) → error → (user action) → syncing
```

---

## Performance Guidelines

### SQLite Optimization

```swift
// Connection settings (apply at init)
PRAGMA journal_mode = WAL;      // Concurrent reads
PRAGMA foreign_keys = ON;       // Referential integrity
PRAGMA synchronous = NORMAL;    // Balance durability/speed
PRAGMA cache_size = -64000;     // 64MB cache
```

### Query Optimization

```sql
-- Use covering indexes for common queries
CREATE INDEX idx_nodes_folder_modified 
ON nodes(folder, modified_at DESC) 
WHERE deleted_at IS NULL;

-- Use partial indexes for filtered queries
CREATE INDEX idx_nodes_pending_sync 
ON nodes(modified_at) 
WHERE sync_status = 'pending';
```

### Batch Operations

```swift
// Bad: N queries
for node in nodes {
    try await db.saveNode(node)
}

// Good: 1 query with batch
try await db.batchSaveNodes(nodes)
```

---

## Debugging Checklist

### Database Issues

- [ ] Is database initialized? Check `isInitialized` flag
- [ ] Are foreign keys enabled? `PRAGMA foreign_keys`
- [ ] Is WAL mode on? `PRAGMA journal_mode`
- [ ] Check for locked database: Another connection holding write lock?

### FTS5 Issues

- [ ] Are triggers firing? Check rowid alignment
- [ ] Is content synced? `SELECT * FROM nodes_fts WHERE rowid = ?`
- [ ] Query syntax correct? FTS5 uses different operators

### Sync Issues

- [ ] Is iCloud signed in? Check `CKAccountStatus`
- [ ] Does zone exist? Check CloudKit Dashboard
- [ ] Is change token valid? May need full sync
- [ ] Network available? Handle offline gracefully

---

## What NOT to Do

### ❌ Don't Add Dependencies

```swift
// Bad: Adding third-party database wrapper
dependencies: [
    .package(url: "https://github.com/some/sqlwrapper", from: "1.0.0"),
]

// Good: Use native SQLite3 directly
import SQLite3
```

### ❌ Don't Skip Tests

```swift
// Bad: "I'll add tests later"
func saveNode(_ node: Node) throws {
    // Implementation without test
}

// Good: Test first, always
func testSaveNode() async throws {
    // Write this BEFORE implementation
}
```

### ❌ Don't Over-Engineer

```swift
// Bad: Abstract factory for database providers
protocol DatabaseProvider { }
class SQLiteProvider: DatabaseProvider { }
class MockProvider: DatabaseProvider { }
class ProviderFactory { }

// Good: One actor, direct SQLite access
actor IsometryDatabase {
    func query(_ sql: String) -> [Row] { }
}
```

### ❌ Don't Ignore Errors

```swift
// Bad: Silent failure
try? db.execute(sql)

// Good: Handle or propagate
do {
    try db.execute(sql)
} catch {
    logger.error("SQL failed: \(error)")
    throw error
}
```

---

## Ready to Build

You have everything you need:

1. **Architecture truth** → `cardboard-architecture-truth.md`
2. **Implementation plan** → `SQLITE-MIGRATION-PLAN-v2.md`
3. **Development guide** → This file

**Start with:**
```bash
mkdir -p Sources/Database Sources/Models Sources/Sync Tests
# Then write your first failing test
```

**Remember:**
- TDD is not optional
- Boring stack wins
- LATCH separates, GRAPH joins
- Ship working code

---

*Let's build something excellent.*
