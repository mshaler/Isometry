# CardBoard Architecture Truth: PAFV + LATCH + GRAPH

*December 2024*

## The Three Layers

| Layer | Purpose | Operations |
|-------|---------|------------|
| **PAFV** | Spatial projection | Map logical organization to screen coordinates |
| **LATCH** | Separation | Filter, sort, group (nodes AND edges) |
| **GRAPH** | Connection | Traverse, aggregate, cluster |

All three operate on **Values** (Cards), which include both Nodes and Edges.

## PAFV: Planes → Axes → Facets → Values

### Planes (Spatial Projection)
- **x-plane**: Horizontal organization (columns)
- **y-plane**: Vertical organization (rows)
- **z-plane**: Depth/layering organization (sheets/cards)

### Axes (Logical Organization - LATCH)
- **L**ocation: Spatial position (coordinates, geography)
- **A**lphabet: Lexical naming (A→Z, titles, labels)
- **T**ime: Temporal position (created, due, modified)
- **C**ategory: Taxonomic membership (project, status, tags)
- **H**ierarchy: Ordinal ranking (priority 1-5, importance)

### Key Insight
**Any axis can map to any plane.** View transitions are simply remapping axes to planes.

## LATCH vs GRAPH: The Fundamental Duality

| | LATCH | GRAPH |
|---|---|---|
| **Operation** | Separation | Connection |
| **SQL analog** | `WHERE`, `GROUP BY`, `ORDER BY` | `JOIN` |
| **Question** | "How do I organize these?" | "How are these related?" |

### LATCH Views (Separation)
- **Grid**: Separate by two axes mapped to x/y planes
- **Kanban**: Separate by category axis (status)
- **Calendar**: Separate by time axis

### GRAPH Views (Connection)
- **Network**: Connect by explicit links
- **Tree**: Connect by containment hierarchy

## Architecture Decision: No Graph Database

SQLite + D3.js covers all use cases:

| Capability | Implementation |
|------------|----------------|
| Store nodes + edges | SQLite tables with foreign keys |
| LATCH filtering | Standard SQL WHERE, GROUP BY |
| Path finding | SQLite recursive CTE |
| PageRank, clustering | D3.js on filtered subset |

**The boring stack wins.**
