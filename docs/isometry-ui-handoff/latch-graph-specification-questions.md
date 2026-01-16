# LATCH*GRAPH FilterNavigation Specification

*CardBoard v3 — January 2025*

This document captures clarifying questions for the LATCH*GRAPH FilterNavigation control system. Please annotate each section with your responses.

---

## Overview

### Framework Summary

| Framework | Nature | Operations | Question Answered |
|-----------|--------|------------|-------------------|
| **LATCH** | Analytics | Filter, Select, Order | "How do I organize these?" |
| **GRAPH** | Synthetics | Connect, Traverse, Cluster | "What emerges from these?" |

---

## L — Location

### Current Understanding

- Committed to SQLite as data layer
- Considering SpatiaLite for PostGIS-like geospatial capabilities
- Need to choose mapping system: Apple Maps, Google Maps, OpenStreetMap, or other

### Recommendations

**SpatiaLite**: Recommended. Provides R-tree spatial indexing, geometry types, spatial queries (`ST_Distance`, `ST_Within`, `ST_Intersects`), and coordinate transformations.

**Mapping System**: Hybrid approach recommended:
- **Native (iOS/macOS)**: MapKit (Apple Maps) — ecosystem alignment
- **Web (D3)**: MapLibre GL JS + OpenStreetMap tiles — free, customizable, D3-friendly

### Clarifying Questions

**Q1.1**: Do you envision Location as primarily:

- [ ] (a) Geographic coordinates (lat/lng for places, travel, contacts)
- [ ] (b) Abstract spatial positioning (x/y canvas coordinates, node positions in network view)
- [ ] (c) Both, with context-dependent interpretation

**Your response**:

```
[Your answer here]
```

**Q1.2**: For geographic location, what's the primary use case?

- [ ] Contact/person locations (home, work addresses)
- [ ] Event locations (meeting venues, travel destinations)
- [ ] Asset locations (where files/resources are stored)
- [ ] All of the above
- [ ] Other: _______________

**Your response**:

```
[Your answer here]
```

**Q1.3**: Should Location support:

- [ ] Point locations only (single lat/lng)
- [ ] Regions/areas (polygons, bounding boxes)
- [ ] Routes/paths (linestrings)
- [ ] All geometry types

**Your response**:

```
[Your answer here]
```

**Q1.4**: For the Location FilterNav control, what interactions do you envision?

- [ ] Map-based selection (draw rectangle, click region)
- [ ] Distance-based filtering ("within 5km of X")
- [ ] Named location search (address autocomplete)
- [ ] Saved location presets ("Home", "Office", "Bay Area")

**Your response**:

```
[Your answer here]
```

---

## A — Alphanumeric

### Current Understanding

- Combination of Excel-style column adaptive filters
- Tokenized faceted search/filtering leveraging CardBoard's DSL

### Clarifying Questions

**Q2.1**: For the DSL, are you thinking:

- [ ] (a) Query language that compiles to SQL (runs against SQLite)
- [ ] (b) Query language that operates on D3 data layer (client-side filtering)
- [ ] (c) Both, with automatic optimization based on data size

**Your response**:

```
[Your answer here]
```

**Q2.2**: Should the adaptive filters show value distributions?

Example: `"CardBoard (12)"` showing count badges

- [ ] Yes, always show counts
- [ ] Optional, user can toggle
- [ ] No, keep it simple

**Your response**:

```
[Your answer here]
```

**Q2.3**: Is there an autocomplete/typeahead component for search?

- [ ] Yes, with fuzzy matching
- [ ] Yes, with prefix matching only
- [ ] Yes, with semantic/AI-powered suggestions
- [ ] No autocomplete needed

**Your response**:

```
[Your answer here]
```

**Q2.4**: What's the DSL syntax you're envisioning? Please provide examples:

```
[Your DSL examples here, e.g.:]
name:CardBoard status:active created:>2024-01 -archived
```

**Q2.5**: Should the Alphanumeric filter support:

- [ ] Exact match (`name:"CardBoard"`)
- [ ] Contains/partial match (`name:Card*`)
- [ ] Regex patterns (`name:/Card.*Board/`)
- [ ] Negation (`-archived`, `NOT status:done`)
- [ ] Boolean combinations (`(status:active OR status:pending) AND priority:high`)

**Your response**:

```
[Your answer here]
```

---

## T — Time

### Current Understanding

Two key features:
1. **SuperTimeSlicer**: Time parsing (natural language → canonical format)
2. **SuperTimeSlider**: Time series filter navigation for non-contiguous card selection and replay

### Clarifying Questions

**Q3.1**: For SuperTimeSlicer parsing, what input formats should be supported?

- [ ] ISO 8601 (`2024-11-15`, `2024-11-15T14:30:00Z`)
- [ ] Natural language relative (`yesterday`, `last week`, `3 days ago`)
- [ ] Natural language absolute (`November 15th`, `Thanksgiving 2024`)
- [ ] Fiscal/business periods (`Q3 2024`, `FY25`, `H1`)
- [ ] Week numbers (`2024-W47`, `week 47`)
- [ ] Fuzzy/approximate (`early November`, `around Christmas`)

**Your response**:

```
[Your answer here]
```

**Q3.2**: How should ambiguity be resolved?

Example: `"11/15"` → November 15 or 15th of November (day/month)?

- [ ] User locale preference
- [ ] Prompt for clarification
- [ ] Default to one format with override syntax
- [ ] Other: _______________

**Your response**:

```
[Your answer here]
```

**Q3.3**: What's the canonical output format for parsed times?

- [ ] ISO 8601 range (`{start: "2024-11-15T00:00:00Z", end: "2024-11-15T23:59:59Z"}`)
- [ ] Unix timestamps (milliseconds)
- [ ] JavaScript Date objects
- [ ] Other: _______________

**Your response**:

```
[Your answer here]
```

**Q3.4**: For SuperTimeSlider replay, what's the playback model?

- [ ] Step through cards chronologically (one at a time)
- [ ] Animate card positions on timeline view
- [ ] Progressive reveal (cards appear as timeline advances)
- [ ] Aggregate view evolution (show how metrics change over time)
- [ ] All of the above, context-dependent

**Your response**:

```
[Your answer here]
```

**Q3.5**: Should time selections be saveable as named presets?

Examples: "Fiscal Q1", "Project Alpha Duration", "Last 30 Days"

- [ ] Yes
- [ ] No

If yes, should presets be:
- [ ] Absolute (fixed dates)
- [ ] Relative (recalculated, e.g., "last 30 days" always means last 30 from today)
- [ ] Both, user chooses

**Your response**:

```
[Your answer here]
```

**Q3.6**: How does non-contiguous time selection interact with GRAPH edges?

- [ ] Show edges only between cards in selected time ranges
- [ ] Show all edges but dim/hide those crossing unselected periods
- [ ] Ignore time selection for edge visibility
- [ ] User-configurable behavior

**Your response**:

```
[Your answer here]
```

**Q3.7**: For replay, what playback controls are needed?

- [ ] Play/Pause
- [ ] Step forward/backward
- [ ] Speed control (0.5x, 1x, 2x, etc.)
- [ ] Jump to specific time
- [ ] Loop
- [ ] Keyframe markers (significant events)

**Your response**:

```
[Your answer here]
```

---

## C — Category

### Current Understanding

Given that SuperGrid PAFV handles both Categories and Hierarchies, there's ambiguity about how Category FilterNav differs from Hierarchy FilterNav.

**Proposed interpretation**: Category FilterNav becomes the **Property/Facet Selector**—choosing WHICH properties are active in the current PAFV context. (e.g., Notes has 70+ properties, but we focus on ~6 at a time)

### Clarifying Questions

**Q4.1**: Do you agree with the interpretation that Category FilterNav = Facet Selector?

- [ ] Yes, this is correct
- [ ] No, I have a different interpretation: _______________
- [ ] Partially, with modifications: _______________

**Your response**:

```
[Your answer here]
```

**Q4.2**: Is the "6 max" active facets a constraint?

- [ ] UX constraint (cognitive load)
- [ ] Technical constraint (rendering complexity)
- [ ] Soft guideline (can exceed if needed)
- [ ] Not a constraint at all

**Your response**:

```
[Your answer here]
```

**Q4.3**: Should facets have type indicators to hint at valid axis assignments?

Types: Temporal, Categorical, Numeric, Text, Boolean, Location, etc.

- [ ] Yes, show type badges
- [ ] Yes, but only when assigning to axes
- [ ] No, keep it simple

**Your response**:

```
[Your answer here]
```

**Q4.4**: Can a facet be "pinned" across view changes?

Example: "Priority" stays visible even when switching from Grid to Kanban

- [ ] Yes, facets can be pinned
- [ ] No, each view has its own facet selection
- [ ] Hybrid: some global, some view-specific

**Your response**:

```
[Your answer here]
```

**Q4.5**: Should there be facet groupings or categories of facets?

Example: "Date facets", "Status facets", "People facets"

- [ ] Yes, group facets by type
- [ ] Yes, allow custom facet groups
- [ ] No, flat list is fine

**Your response**:

```
[Your answer here]
```

---

## H — Hierarchy (PAFV Navigator)

### Current Understanding

The PAFV Navigator enables:
- Drag-and-drop of Axes Cards from one Plane to another
- Reordering Cards within each Plane (Available, xRows, yColumns, zAxis)
- FilterNavigation of Facets within that context

A working v2 prototype exists from the end of the v2 development cycle.

### Clarifying Questions

**Q5.1**: Is the v2 prototype code accessible for reference?

- [ ] Yes, located at: _______________
- [ ] Yes, but needs cleanup/extraction
- [ ] No, need to recreate from memory

**Your response**:

```
[Your answer here]
```

**Q5.2**: What were the pain points or limitations in v2 that v3 should address?

```
[Your answer here]
```

**Q5.3**: For drag-drop between planes, is there validation logic?

Example: "Time facet can only go on x-axis in timeline view"

- [ ] Yes, strict type-to-axis validation
- [ ] Yes, but with warnings (allow override)
- [ ] No, any facet can go anywhere
- [ ] Context-dependent (view type determines rules)

**Your response**:

```
[Your answer here]
```

**Q5.4**: Can multiple facets be assigned to the same plane?

Example: Group by Category, then sub-group by Status (nested grouping)

- [ ] Yes, unlimited nesting
- [ ] Yes, limited to 2-3 levels
- [ ] No, one facet per plane

**Your response**:

```
[Your answer here]
```

**Q5.5**: How do you envision the z-axis (Layers) being used?

- [ ] Stacked cards (card piles)
- [ ] Depth/3D effect
- [ ] Overlay layers (annotations on top of data)
- [ ] Sheet switching (tabs)
- [ ] Animation keyframes
- [ ] Other: _______________

**Your response**:

```
[Your answer here]
```

---

## GRAPH — Synthetics Framework

### Current Understanding

GRAPH provides synthetic operations that derive new information from graph structure:

| Algorithm | Question | Output |
|-----------|----------|--------|
| Pathfinding | "How do I get from A to B?" | Shortest path, MST, all paths |
| Centrality | "Who/what is most important?" | PageRank, betweenness, degree |
| Community Detection | "What natural groupings exist?" | Louvain, Label Prop, Components |
| Similarity | "What's like what?" | Jaccard, cosine, k-NN |
| Link Prediction | "What connections might form?" | Common neighbors, Adamic-Adar |
| Embedding | "How do I represent this for ML?" | Node2Vec, graph vectors |

### Platform Strategy

**Recommendation**: 
- **Web (v3)**: graphology.js for Big Six algorithms
- **Native (v4)**: GraphQLite as SQLite extension + Cypher queries

### Clarifying Questions

**Q6.1**: Do you agree with the graphology (web) → GraphQLite (native) platform strategy?

- [ ] Yes
- [ ] No, prefer: _______________
- [ ] Need more information

**Your response**:

```
[Your answer here]
```

**Q6.2**: When you run a graph algorithm (e.g., PageRank), how should results manifest visually?

- [ ] Node size (larger = higher rank)
- [ ] Node color gradient (heat map)
- [ ] Separate "importance" column in grid view
- [ ] Badge/overlay on cards
- [ ] All of the above, user-selectable

**Your response**:

```
[Your answer here]
```

**Q6.3**: Should LATCH filters apply BEFORE graph algorithms?

Example: "Run community detection on cards from Q3 2024 only"

- [ ] Yes, always filter first, then compute
- [ ] No, compute on full graph, then filter results
- [ ] User chooses (affects results significantly)

**Your response**:

```
[Your answer here]
```

**Q6.4**: Should computed graph properties (PageRank, community ID, etc.) be stored as LATCH facets?

This would enable: "Show top 10% by PageRank" as a LATCH filter

- [ ] Yes, persist computed properties
- [ ] Yes, but mark as "derived" (recalculate on demand)
- [ ] No, keep ephemeral

**Your response**:

```
[Your answer here]
```

**Q6.5**: How do real-time and batch algorithms coexist?

- Force simulation: Real-time (drag node, others respond)
- PageRank: Batch (compute once, display results)

- [ ] Clear visual distinction (interactive vs. computed)
- [ ] Background recomputation with debounce
- [ ] Manual "Recompute" button for batch algorithms
- [ ] Other: _______________

**Your response**:

```
[Your answer here]
```

**Q6.6**: For the Edge Type filter in GRAPH FilterNav:

Current edge types: LINK, NEST, SEQUENCE, AFFINITY

- [ ] These four are sufficient
- [ ] Need additional types: _______________
- [ ] Should be user-extensible

**Your response**:

```
[Your answer here]
```

**Q6.7**: Should GRAPH algorithms respect edge direction?

- [ ] Yes, always use directed algorithms
- [ ] No, always treat as undirected
- [ ] User toggle per algorithm
- [ ] Algorithm-specific defaults

**Your response**:

```
[Your answer here]
```

**Q6.8**: For Link Prediction, how should predicted links be displayed?

- [ ] Dashed/dotted lines
- [ ] Ghost nodes/edges
- [ ] Separate "suggested connections" panel
- [ ] Badge on source node ("3 potential connections")

**Your response**:

```
[Your answer here]
```

---

## Cross-Cutting Questions

### LATCH ↔ GRAPH Interaction

**Q7.1**: Can LATCH and GRAPH filters be combined in a single view?

Example: "Show cards from Q3 2024 (LATCH:Time) with community clustering (GRAPH)"

- [ ] Yes, full composition
- [ ] Partial (some combinations only)
- [ ] No, one mode at a time

**Your response**:

```
[Your answer here]
```

**Q7.2**: Should there be saved "filter presets" that combine LATCH + GRAPH settings?

- [ ] Yes
- [ ] No

If yes, should they be:
- [ ] Global (available across all canvases)
- [ ] Canvas-specific
- [ ] Both

**Your response**:

```
[Your answer here]
```

### FilterNav UI Layout

**Q7.3**: How should the six FilterNav controls (L, A, T, C, H + GRAPH) be arranged?

- [ ] Horizontal tab bar
- [ ] Vertical sidebar
- [ ] Collapsible accordion
- [ ] Floating panels
- [ ] Context-dependent (show relevant controls based on view)

**Your response**:

```
[Your answer here]
```

**Q7.4**: Should there be a "quick filter" bar in addition to the full FilterNav controls?

Example: A simplified search bar that auto-detects LATCH type

- [ ] Yes
- [ ] No

**Your response**:

```
[Your answer here]
```

---

## Additional Notes

Please add any additional context, sketches, references, or thoughts here:

```
[Your additional notes here]
```

---

## Reference Links

- CardBoard Architecture Truth: `/mnt/project/cardboard-architecture-truth.md`
- GraphQLite (Rust/SQLite): https://github.com/colliery-io/graphqlite
- graphology.js: https://graphology.github.io/
- SpatiaLite: https://www.gaia-gis.it/fossil/libspatialite/index
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/

---

*Document generated: January 2025*
*Version: Draft for annotation*
