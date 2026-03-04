# Native Shell Gap Analysis: Swift Code Review vs. Architecture Specs

*Prepared for Claude Code — follow-up pass on the Swift native shell push*

Reference documents: `cardboard-architecture-truth.md`, `SQLITE-MIGRATION-PLAN-v2.md`

---

## Context

A senior architecture review has identified gaps between the Swift code just produced and the canonical architecture specs. This document lists required fixes, ordered by severity. Please address all items marked 🔴 before proceeding to Phase 4. Items marked 🟡 are spec gaps to fill. Items marked 🔵 are logic that has landed on the wrong side of the Swift/JS boundary and must be moved.

Do not over-engineer. Fix what is listed. Do not add new capabilities beyond what is specified here.

---

## 🔴 Critical Fixes Required

### 1. Edges Are Not First-Class Cards (Breaks Core LPG Principle)

**The spec states explicitly:** *"Edges are Cards too."* The current implementation has `Node` and `Edge` as entirely separate types with no unified treatment. This breaks the LPG model in three concrete ways:

**1a. No FTS5 for edges.**
Edges have `label`, `subject`, and `channel` fields — all searchable content. There is no `edges_fts` virtual table and no triggers to keep it in sync. The `search()` method only queries `nodes_fts`.

**Fix required:**
- Add `edges_fts` virtual table to the schema covering `label`, `subject`, `channel`
- Add `AFTER INSERT`, `AFTER DELETE`, `AFTER UPDATE` triggers to keep it in sync (mirror the pattern used for `nodes_fts`)
- Update the `search()` method in `IsometryDatabase` to union results from both FTS tables, with a `record_type` discriminator (`'node'` vs `'edge'`) so callers can distinguish them

**1b. Edge CRUD is missing from `IsometryDatabase`.**
There are no `saveEdge()`, `getEdge()`, `deleteEdge()`, or `getAllEdges()` methods on the actor.

**Fix required:** Add the following method signatures to `IsometryDatabase`, implemented consistently with the existing `Node` CRUD pattern:

```swift
public func saveEdge(_ edge: Edge) throws
public func getEdge(_ id: String) throws -> Edge?
public func getEdgesForNode(_ nodeId: String, direction: EdgeDirection) throws -> [Edge]
public func deleteEdge(_ id: String) throws

public enum EdgeDirection { case outgoing, incoming, both }
```

**1c. Edge sync is entirely absent from `CloudKitSyncManager`.**
`pushLocalChanges()` and `pullRemoteChanges()` handle only `Node` records. Edges are never pushed or pulled. A device that syncs will show nodes with no connections.

**Fix required:**
- Add `sync_status` and `last_synced_at` columns to the `edges` table schema
- Add `getPendingSyncEdges()` and `markEdgeSynced(_:syncVersion:)` to `IsometryDatabase`
- Add edge push/pull to `CloudKitSyncManager`, using record type `"Edge"` in CloudKit. Mirror the batched `CKModifyRecordsOperation` pattern used for nodes.

---

### 2. `ConflictResolution` Enum — Compiler Bug

The `ConflictResolution` enum is defined as:

```swift
case needsUserInput
```

But the call site in `autoResolveConflict` passes associated values:

```swift
return .needsUserInput(local, remote)
```

**This will not compile.** Fix the enum definition to:

```swift
case needsUserInput(Node, Node)
```

---

## 🟡 Spec Gaps — Missing Implementations

### 3. No `subgraph()` Method on `IsometryDatabase`

The SQL query library (`graph-queries.sql`) includes a `subgraph` query that returns both nodes and edges for a connected component — this is the **primary data payload** the JS/D3 layer needs to render a network view. However, there is no corresponding Swift method to call it.

The existing graph methods (`connectedNodes`, `shortestPath`) return only `Node` arrays. D3 cannot render a force-directed graph without edges.

**Fix required:** Add a `SubgraphPayload` struct and a corresponding method:

```swift
public struct SubgraphPayload: Codable, Sendable {
    public let nodes: [Node]
    public let edges: [Edge]
}

public func subgraph(startingAt nodeId: String, maxDepth: Int = 3) throws -> SubgraphPayload
```

Use the existing `subgraph` SQL from `graph-queries.sql`. This is the method the WorkerBridge on the JS side will call to populate network views. It must return both nodes and edges, not nodes alone.

---

### 4. PAFV `facets` Table Has No Read API

The `facets` table is populated with default data in the schema, which is correct. However, `IsometryDatabase` exposes no method to read facets. The JS layer needs to query the facets table at startup to know what axes and attributes are available.

**Fix required:** Add a single read method:

```swift
public struct Facet: Codable, Sendable {
    public let id: String
    public let name: String
    public let facetType: String
    public let axis: String       // L, A, T, C, H
    public let sourceColumn: String
    public let options: String?   // JSON array for select types
    public let icon: String?
    public let color: String?
    public let enabled: Bool
    public let sortOrder: Int
}

public func getAllFacets() throws -> [Facet]
```

Do **not** add projection logic or axis-to-plane mapping to the Swift layer. That logic belongs in the JS WorkerBridge. Swift's job is to return the facets table contents as data.

---

## 🔵 Logic on the Wrong Side of the Swift/JS Boundary

### 5. Remove `nodeImportance()` from `IsometryDatabase`

The architecture spec assigns graph algorithms to D3/JS explicitly:

> *"PageRank, clustering → D3.js on filtered subset"*

`nodeImportance()` computes weighted in-degree centrality in SQLite. This is a graph algorithm. It must not live in the Swift layer because:

- It runs on the full dataset rather than a filtered MB-scale subset
- It cannot benefit from D3's force simulation context
- It creates a duplicate/conflicting implementation with whatever D3 computes

**Fix required:** Delete `nodeImportance()` from `IsometryDatabase`. The correct flow is: Swift returns a `SubgraphPayload` (nodes + edges), JS/D3 computes centrality on that subset.

---

### 6. Do Not Wire Up `clustering_candidates` from `graph-queries.sql`

The Jaccard similarity query in `graph-queries.sql` is a community detection algorithm. The spec comment in that file even flags it: *"Expensive query — run as background job, cache results."*

This query must not be surfaced as a method on `IsometryDatabase`. Community detection belongs in D3/JS on filtered subsets. If a Swift method for this is added in a future pass, flag it for architecture review first.

**No action required now** — just do not implement it.

---

## Summary Checklist

| # | Item | Severity | Action |
|---|------|----------|--------|
| 1a | Add `edges_fts` + triggers + update `search()` | 🔴 Critical | Implement |
| 1b | Add `saveEdge`, `getEdge`, `deleteEdge`, `getEdgesForNode` | 🔴 Critical | Implement |
| 1c | Add edge sync to `CloudKitSyncManager` | 🔴 Critical | Implement |
| 2 | Fix `ConflictResolution.needsUserInput(Node, Node)` enum | 🔴 Critical | Fix compiler error |
| 3 | Add `subgraph(startingAt:maxDepth:) -> SubgraphPayload` | 🟡 Gap | Implement |
| 4 | Add `getAllFacets() -> [Facet]` | 🟡 Gap | Implement |
| 5 | Remove `nodeImportance()` | 🔵 Wrong layer | Delete |
| 6 | Do not implement `clustering_candidates` | 🔵 Wrong layer | No-op |

TypeScript errors are P0. Swift compiler errors are P0. All 🔴 items must resolve before Phase 4 begins.
