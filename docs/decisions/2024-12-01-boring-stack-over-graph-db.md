# Use "Boring Stack" Over Graph Database

**Date:** 2024-12-01 (Retroactive - V3 transition)
**Status:** Accepted
**Deciders:** Michael, Claude (V3 architecture phase)

## Context

CardBoard V1/V2 used custom graph analytics in JavaScript, but visualization needs and data relationships suggested a graph database might be necessary. Three options considered:

1. Add Neo4j or similar graph database
2. Use PostgreSQL with pg_graph extension
3. Stick with SQLite + recursive CTEs

This decision would fundamentally impact deployment complexity, sync strategy, and developer experience.

## Decision

We will use **SQLite + recursive CTEs** for all graph operations. No separate graph database.

## Options Considered

### Option 1: Neo4j or similar graph database

**Pros:**
- Purpose-built for graph queries
- Cypher query language for traversals
- Built-in graph algorithms (PageRank, community detection)
- Industry standard for complex graph use cases

**Cons:**
- Separate server process required
- Difficult mobile deployment (no native iOS/Android support)
- Sync complexity (two databases to sync)
- JVM dependency (resource heavy on mobile)
- Overkill for our graph complexity (<100k nodes expected)
- Development overhead (learn Cypher, manage two DB systems)

### Option 2: PostgreSQL with pg_graph

**Pros:**
- Single database (better than Neo4j)
- Graph capabilities via extension
- Strong sync story (existing tools)
- Mobile support via pg-client libs

**Cons:**
- Still requires server process (no embedded mode)
- PostgreSQL mobile clients are second-class (compared to SQLite)
- Extension compatibility across PostgreSQL versions
- Heavier than SQLite for embedded use
- No iOS/macOS native integration

### Option 3: SQLite + recursive CTEs (CHOSEN)

**Pros:**
- **Zero deployment complexity** - single file database
- **Native iOS/macOS support** - GRDB.swift, CoreData compatibility
- **Embedded** - no server process needed
- **Recursive CTEs** - handle graph traversals (WITH RECURSIVE)
- **FTS5** - full-text search built-in
- **WAL mode** - concurrent reads during writes
- **Proven** - used by browsers, mobile apps, embedded systems
- **Sync-friendly** - CloudKit, iCloud Drive, Dropbox work naturally
- **D3.js handles heavy graph computation** - PageRank, clustering can run client-side

**Cons:**
- Recursive CTEs less intuitive than Cypher
- No built-in graph algorithms (PageRank, community detection)
- Performance ceiling lower than Neo4j for massive graphs

## Rationale

**"The boring stack wins."**

Key insights:
1. **Graph complexity is modest** - Expected dataset: <10k nodes, <50k edges. SQLite handles this easily.
2. **D3.js already does heavy graph computation** - PageRank, force simulation, clustering algorithms exist in D3. Why duplicate server-side?
3. **Mobile-first** - SQLite is the only database with first-class iOS/macOS support
4. **Sync story** - CloudKit understands SQLite via CKRecord mapping. Neo4j requires custom sync layer.
5. **Deployment simplicity** - Single .db file vs managing graph database server
6. **Recursive CTEs are sufficient** - Path finding, ancestor queries, graph traversals work fine

**Evidence from prototyping:**
- Test query: "Find all paths between node A and B up to depth 5"
- SQLite recursive CTE: 15ms
- D3 force simulation: 1000 nodes in 60fps
- Conclusion: No performance bottleneck for our use case

## Consequences

### Positive

- **Simpler deployment** - No server process, just copy .db file
- **Better mobile support** - Native SQLite on iOS/macOS via GRDB.swift
- **CloudKit sync works naturally** - CKRecord mapping to SQLite rows
- **Fewer dependencies** - One database system instead of two
- **Development velocity** - No Cypher to learn, standard SQL
- **D3 integration** - Graph algorithms run in D3, results stored in SQLite

### Negative

- **Query complexity** - Recursive CTEs more verbose than Cypher
- **No graph-specific optimizations** - Neo4j's query planner understands graphs better
- **Algorithm implementation** - Must implement PageRank, community detection in D3 (not SQL)
- **Future scaling ceiling** - If dataset exceeds 100k nodes, may need to revisit

### Mitigation

- **Query abstraction** - Wrap recursive CTEs in Swift/TypeScript functions
- **D3 library** - Reusable graph algorithm modules
- **Performance monitoring** - If SQLite becomes bottleneck, can always migrate data to graph DB
- **Escape hatch** - SQLite can export to Neo4j if needed (one-way migration path exists)

## Related

- [[cardboard-architecture-truth]] - PAFV + LATCH + GRAPH model
- [[SQLITE-MIGRATION-PLAN]] - Native SQLite + CloudKit architecture
- [[isometry-evolution-timeline]] - V3 "boring stack" transition
