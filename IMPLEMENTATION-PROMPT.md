# Implementation Kickoff: Isometry Native Data Layer

## Context

You are implementing Isometry's native data layer as specified in the project documentation. Read these files first:

1. `CLAUDE.md` — Development guide and principles
2. `cardboard-architecture-truth.md` — PAFV + LATCH + GRAPH architecture
3. `SQLITE-MIGRATION-PLAN-v2.md` — Complete schema and Swift implementation

## Your Mission

Build a production-ready Swift package that provides:
- Thread-safe SQLite database (Actor-based)
- FTS5 full-text search
- Recursive CTE graph queries
- CloudKit sync infrastructure

## Phase 1: Foundation (Start Here)

### Step 1.1: Create Package Structure

```bash
mkdir -p Sources/Database Sources/Models Sources/Sync Tests Resources
```

Create `Package.swift`:
- Swift 5.9+
- Platforms: iOS 15+, macOS 12+
- No external dependencies (boring stack wins)

### Step 1.2: Create Schema File

Create `Resources/schema-v1.sql` from `SQLITE-MIGRATION-PLAN-v2.md`:
- Nodes table with all LATCH attributes
- Edges table for GRAPH relationships
- FTS5 virtual table with sync triggers
- Sync state and settings tables

### Step 1.3: Write First Failing Test (TDD)

Create `Tests/DatabaseTests.swift`:

```swift
import XCTest
@testable import IsometryDatabase

final class DatabaseTests: XCTestCase {
    
    func testDatabaseInitialization() async throws {
        let db = IsometryDatabase.shared
        try await db.initialize()
        // Should complete without error
    }
}
```

Run test → it should fail (RED).

### Step 1.4: Implement IsometryDatabase Actor

Create `Sources/Database/IsometryDatabase.swift`:
- Actor for thread safety
- SQLite3 direct access (no wrappers)
- PRAGMA configuration (WAL, foreign keys)
- Schema application from `schema-v1.sql`

Run test → it should pass (GREEN).

## Phase 2: CRUD Operations

### For Each Operation, Follow TDD:

1. **Write failing test** in `DatabaseTests.swift`
2. **Implement minimum code** to pass
3. **Refactor** for clarity
4. **Move to next operation**

### Operations to Implement:

```swift
// Create
func saveNode(_ node: Node) throws

// Read
func getNode(_ id: String) throws -> Node?
func getAllNodes(folder: String?, limit: Int) throws -> [Node]

// Update (handled by saveNode with UPSERT)

// Delete
func deleteNode(_ id: String, hard: Bool) throws
```

### Required Models:

Create `Sources/Models/Node.swift`:
- All LATCH attributes from schema
- Codable, Identifiable, Hashable, Sendable
- NodeType, NodeStatus, SyncStatus enums

Create `Sources/Models/Edge.swift`:
- EdgeType enum (LINK, NEST, SEQUENCE, AFFINITY)
- Source/target IDs
- Weight, direction, properties

## Phase 3: FTS5 Search

### Tests to Write First:

```swift
func testBasicSearch() async throws { }
func testPrefixSearch() async throws { }
func testMultiWordSearch() async throws { }
func testEmptyQueryReturnsEmpty() async throws { }
func testSpecialCharactersHandled() async throws { }
```

### Implementation:

```swift
func search(_ query: String, limit: Int) throws -> [Node]
```

- Sanitize input (escape quotes, trim whitespace)
- Add prefix matching for UX (`term*`)
- Join with nodes table for full records
- Rank by bm25 for relevance

## Phase 4: Graph Queries

### Tests to Write First:

```swift
func testConnectedNodes() async throws { }
func testShortestPath() async throws { }
func testNodeImportance() async throws { }
func testNeighbors() async throws { }
func testCycleHandling() async throws { }
```

### Implementation:

Create `Sources/Database/GraphQueries.swift`:

```swift
// Connected nodes (BFS with recursive CTE)
func connectedNodes(from nodeId: String, maxDepth: Int) throws -> [(node: Node, depth: Int)]

// Shortest path
func shortestPath(from: String, to: String, maxDepth: Int) throws -> [String]?

// Node importance (weighted in-degree)
func nodeImportance() throws -> [(nodeId: String, name: String, importance: Double)]
```

## Phase 5: CloudKit Sync

### Tests to Write First:

```swift
func testPendingSyncNodes() async throws { }
func testMarkNodeSynced() async throws { }
func testSyncStateStorage() async throws { }
```

### Implementation:

Create `Sources/Models/SyncState.swift`:
- Change token storage
- Error tracking
- Consecutive failures counter

Create `Sources/Sync/CloudKitSyncManager.swift`:
- Actor-based for thread safety
- Zone creation
- Push/pull operations
- Automatic conflict resolution

## Success Criteria

### Phase 1 Complete When:
- [ ] `swift build` succeeds with no warnings
- [ ] `swift test` passes all initialization tests
- [ ] Schema applied correctly (verify with `PRAGMA table_info(nodes)`)

### Phase 2 Complete When:
- [ ] All CRUD tests pass
- [ ] Soft delete works (deleted_at populated, excluded from queries)
- [ ] UPSERT correctly updates existing nodes

### Phase 3 Complete When:
- [ ] FTS5 tests pass
- [ ] Search returns ranked results
- [ ] Performance: <100ms for 10K nodes

### Phase 4 Complete When:
- [ ] Graph query tests pass
- [ ] Connected nodes respects maxDepth
- [ ] Shortest path handles no-path case
- [ ] Performance: <500ms for 10K nodes with edges

### Phase 5 Complete When:
- [ ] Sync state persists across app launches
- [ ] Pending nodes tracked correctly
- [ ] CloudKit zone created successfully (requires device/simulator with iCloud)

## Quality Gates

Before marking any phase complete:

```bash
# Build must succeed
swift build 2>&1 | grep -i "error\|warning" && exit 1

# All tests must pass
swift test

# No force unwraps in production code
grep -r "!" Sources/ --include="*.swift" | grep -v "!=" | grep -v "//" && echo "Review force unwraps"
```

## Debugging Tips

### SQLite Issues
```sql
-- Check schema
.schema nodes
PRAGMA table_info(nodes);

-- Check FTS5 sync
SELECT * FROM nodes_fts WHERE rowid = (SELECT rowid FROM nodes WHERE id = 'test');

-- Check indexes
PRAGMA index_list(nodes);
```

### Actor Issues
- All database calls must be `await`ed
- Never hold references across await points
- Use `Task` for background work

## Begin

1. Read the three documentation files
2. Create the package structure
3. Write your first failing test
4. Make it pass
5. Repeat

**Remember: TDD is not optional. Every feature starts with a failing test.**

Good luck. Ship excellent code.
