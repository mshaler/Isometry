# Isometry v5 SPEC.md 
# Executive Summary
**Isometry** is a polymorphic data projection platform. The same LATCH-filtered, GRAPH-connected schema-on-read dataset renders through PAFV spatial projection as grid, kanban, network, or timeline — with view transitions that change the SQL projection, not the data. Isometry's keystone feature is **SuperGrid**: nested dimensional headers, orthogonal density controls, and direct sql.js→D3.js rendering with zero serialization.

## The Problem
Every knowledge worker lives in the gap between how their tools organize information and how their minds actually work. We categorize *and* connect. We filter *and* relate. We think in timelines *and* networks *and* hierarchies — often about the same things, simultaneously.

**Excel's Tyranny of the 2D Grid.** The grid is the view *and* the data model. Want to see the same data differently? Copy it to another sheet. The atomic unit is a cell address — A1 — which carries zero semantic meaning. Excel is a lossy compression of multidimensional reality into a 2D surface.

**Notion's Tyranny of Schema-First.** Before you can capture a single thought, you must design a database. Six months later, you have databases with dozens of mostly-empty columns because your needs evolved but your schema didn't.

## The Insight
**LATCH separates, GRAPH joins.** This is the fundamental duality of human information organization. LATCH represents every possible way to *separate* things. GRAPH represents every possible way to *connect* things. Traditional tools choose a side. Humans do both simultaneously, all the time.

**Any axis can map to any plane.** Your data has LATCH dimensions already present: everything has a timestamp, a name, a category, a priority. PAFV lets you choose which of those dimensions map to x, y, or z. A view transition isn't rebuilding data — it's remapping axes to planes.

## Foundational Concepts
| Concept | Definition |
| --- | --- |
| LATCH Analytics | Richard Saul Wurman coined the notion of “the five hat racks” for organizing information in his 1989 book *Information Anxiety *as follows:\n- Location\n- Alphabet\n- Time\n- Category\n- Hierarchy\nThese pillars define filter navigation controls, what are called "Explorers" in Isometry. |
| Graph Synthetics | Labeled Property Graph supports Cards as nodes and edges as both first-class entities with properties, stored in SQLite. Edges are cards and the following graph algorithms enable connected insights in Isometry:\n- Dystra shortest path\n- Jaccard similarity\n- Louvain community\n- PageRank centrality\n- Link Adams-Adar\n- Embedding Node2vec |

### LATCH vs GRAPH: The Fundamental Duality

|  | LATCH | GRAPH |
| --- | --- | --- |
| **Operation** | Separation | Connection |
| **SQL analog** | `WHERE`, `GROUP BY`, `ORDER BY` | `JOIN` |
| **Question** | "How do I organize these?" | "How are these related?" |
| **Result** | Filters, sorts, groups cards | Traverses, aggregates, clusters cards |

### LATCH Views (Separation)
- **Grid/SuperGrid**: Separate by two+ axes mapped to x/y/z planes
- **Kanban**: Separate by category axis (status)
- **Calendar/Timeline**: Separate by time axis
- **List**: Separate by hierarchy or alphabet axis

### GRAPH Views (Connection)
- **Network**: Connect by explicit link edges
- **Tree**: Connect by nest edges (containment hierarchy)

### GRAPH Edge Types
| Type | Purpose | Example |
| --- | --- | --- |
| **LINK** | Explicit association | "This note references that note" |
| **NEST** | Containment hierarchy | "Project contains these tasks" |
| **SEQUENCE** | Ordered progression | "Step 1 → Step 2 → Step 3" |
| **AFFINITY** | Computed similarity | "These cards share tags/timing" |

| PAFV Projection | PAFV is the SuperGrid spatial projection system.\n- **Planes**: x, y, z (screen coordinates)\n- **Axes**: LATCH dimensions mapped to planes\n- **Facets**: Specific attributes within an axis (e.g., CreatedAt within Time)\n- **Values**: Cards (Nodes + Edges in the LPG) |
# Purpose 
Isometry is built as a local‑first, tangible, multidimensional application for the following use cases:
- Knowledge organization 
- Project management 
- Visual query building 
- App composition 
 
Isometry is inspired by the following innovations: 
- Lotus Improv: Pito Salas' separate views from data via category algebra applied to nested, multidimensional layouts 
- NeXTSTEP Interface Builder: componentized UI app builder
- Notion/Coda: block authoring and slash commands
- "Information Anxiety" by Richard Saul Wurman, author of LATCH
- Richard Feynman: "The first principle is that you must not fool yourself, and you are the easiest person to fool."
 
V1 is optimized for:
- Agility 
- Determinism 
- Offline performance 
- Fast iteration 

#  Values
| Values | Implementation | Benefits |
| --- | --- | --- |
| Useful | Show me what I need to see | Visibility |
| Helpful | Do what I mean | Tangibility |
# Principles 
1. **LATCH separates, GRAPH joins**
2. **Nodes and Edges are Cards**
3. **Any axis maps to any plane**
4. **Boring stack wins** — SQLite + D3.js + TypeScript
5. **Swift is plumbing, D3 is UI** — all visual rendering in D3.js via WKWebView
6. **Bridge elimination** — sql.js puts SQLite in the same JS runtime as D3.js
7. **Schema-on-read** — Structure emerges from projection selection, not upfront declaration
8. **Data-first** — Capture first, organize by looking at it, not by pre-designing containers
9. **Edges are cards** — Relationships are first-class, searchable, filterable, projectable

## Schema-on-Read vs Schema-on-Write

Traditional tools force **schema-on-write**: you must design your data structure before capturing anything.

Isometry uses **schema-on-read**: data arrives with whatever properties it naturally carries. Structure is applied at the moment you look at your data via PAFV projection selection.

| Approach | When Structure Is Defined | Trade-off |
| --- | --- | --- |
| Schema-on-write | Before data entry | Rigid but consistent |
| Schema-on-read | At query time | Flexible but requires PAFV |

A Slack message has a sender, timestamp, and channel. An email has a sender, timestamp, subject, and thread. In Isometry, they coexist as cards with different properties — you choose which shared properties to project onto axes.

## Local‑first truth 
 **SQLite is the system of record** 
 All data elements are persisted in SQLite and there is no separate client data model. 
- entities 
- relationships 
- formulas 
- layout metadata 
- projections 
  
## Projection‑driven UI 
UI never mutates raw data. 
 
```
User actions → SQL mutation → projection recompute → render
```
 
## Tangible multidimensionality 
Structure is visible and directly manipulable: 
- Facets can move between rows and columns 
- Nested headers provide hierarchy 
- Dragging changes query semantics 
 
## Minimal reactive surface 
Reactive system is: 
- SQLite (data dependencies) 
- Small observable layout store (UI state) 
 
## High‑Level Architecture 
## Runtime layers 
### **Native Shell host**
v1: macOS/iOS: Swift/SwiftUI
v2: Android, Windows, and Web
 
Responsibilities: 
- Native windowing 
- File system access 
- iCloud/CloudKit sync 
- WebView container 

Native Shell supports two variants for macOS, iOS, and Android hosts, which enable a tiered distribution strategy differentiated by platform delivery:
1. **SQLite**: Full-on Designer Workbench targeted primarily for macOS, fully feature complete with all the ETL/DB capabilities along with everything in the table below targeting sophisticated users at higher value
2. **JSON file**: Lightweight, simple distribution mechanism for Isometry apps (JS/JSON only with thin reusable SwiftUI shell). The JS/JSON version will be targeted for iOS/Android Doers as less expensive, drive awareness/demand generation, and do one thing well
3. **JSON to SQLite migration on upgrade**: An iOS app user can migrate from JSON to SQLite if they upgrade to Isometry Designer Workbench, and we need to be able to import and sync their JSON payload to SQLite

## **Tech Stack**
| Layer | Technology | Notes |
| Language | TypeScript (strict mode) | No ==any==. Fix all errors before committing. |
| Data | sql.js (SQLite in WASM) | FTS5 + recursive CTEs required |
| Visualization | D3.js v7 | All rendering. ==.join()== with key functions always. |
| Build | Vite | ==npm run dev== for development |
| Test | Vitest | TDD. Tests first. ==npm run test== |
| Package manager | npm | See ==package.json== in Isometry repo |
**What Is NOT in the Stack**

- ❌ Redux / Zustand / MobX — D3's data join IS state management
- ❌ React/React Native — this is a web app in a native shell
- ❌ SQLite.swift — replaced by sql.js
- ❌ MessageBridge.swift — eliminated entirely
- ❌ KuzuDB or any graph database — SQLite recursive CTEs handle graph queries
- ❌ Next.js / Remix / server frameworks — this is a local-first app

**Web Runtime (Pure D3.js)**

Inside WKWebView — no React, no framework:

| Component | Technology | Role |
| --- | --- | --- |
| Rendering | D3.js v7 | ALL visualization and interaction |
| Data | sql.js (WASM) | Query engine, synchronous in same JS runtime |
| State | D3.js data join | `.join()` IS state management — no Redux/Zustand |
| Layout | Custom observable store | UI-only: viewport, selection, drag state |
| Heavy compute | Web Worker | SQL execution, graph algorithms |

**Data Flow:**
```
User action → D3 event handler → db.exec(SQL) → D3 re-renders
```

One function call. Same memory space. No serialization. No bridge. 
 
## Threading model
Main thread: 
- D3 rendering 
- Interaction handling 
- Layout state 
 
Worker thread: 
- SQL execution 
- Projection materialization 
- Graph algorithms (future) 
 
Communication: 
- Thin async RPC bridge (Comlink optional) 
 
# Data Model 
## Core primitives  
**Card** 
Represents an entity with four default types: note, task, event, or resource 
 
**Category (Facet)** 
Dimensions such as: 
- Folder 
- Subfolder 
- Tag 
- Year 
- Month 
 
**Membership**
Many‑to‑many between cards and categories

## Connections: The via_card_id Pattern

Connections record when a Card relates to another Card. The richness comes from what they bridge, not from columns on the connection table.

```
Person A  ←──connection──→  Person B
                │
            via_card_id: Note C

Note C contains the meeting notes, the email thread,
the shared document. The connection's richness comes
from the Card it passes through.
```

This enables rich relationships without schema-on-write. A connection between two People isn't characterized by relationship-type enums — it's characterized by the Notes, Events, and Resources that sit between them.

## Implicit → Explicit Workflow

```
LATCH reveals       →  Human recognizes  →  GRAPH records
(SuperGrid shows        (user sees two       (user drags a
 two Cards share         Cards adjacent,      connection,
 a Category axis)        notices pattern)     makes it explicit)
```

SuperGrid is where latent structure becomes visible. Implicit connections (LATCH coincidences) are discoverable through projection. Explicit connections are what the user promotes into the graph.

## Formulas
Formulas are defined at the **category level**. 
 
Stored as: 
- DSL expression 
- Compiled SQL view 
 
```javascript
Excel‑style formulas → SQL translation 
```
 
## Layout metadata 
Persisted in SQLite: 
- Row facets (ordered) 
- Column facets (ordered) 
- Sorting 
- Filters 
- Measures 
- Expanded/collapsed state 
 
# Projection Engine 
A projection is a parameterized SQL query that returns: 
- Header hierarchy 
- Cell coordinates 
- Aggregates 
- Card membership 
 
Example default Apple Notes view: 
Rows: 
```javascript
Folder → Subfolder → Tag 
```
Columns: 
```javascript
Year → Month 
```
Changing layout = recompiling projection 
 
# Observable Layout Store 
## Responsibilities 
UI‑only state: 
- Current view layout 
- Drag state 
- Selection 
- Hover 
- Viewport 
 
## Properties 
- Transactional updates 
- Fine‑grained subscriptions 
- Deterministic 
- Framework‑agnostic 
 
## Non‑responsibilities  
The observable layout store does **not** store: 
- Cards 
- Categories 
- Query results 
 Those live in SQLite.
 
# Interaction Model 
## Facet drag between axes 
 Drag Tag from rows → columns: 
```javascript
Update layout store 
Persist layout to SQLite 
Recompute projection 
Re‑render 
```
 No client data reshaping.

## Direct manipulation 
Examples: 
```javascript
Resize column → layout metadata update 
Reorder facet → layout metadata update
```
All persisted
 
# D3.js Rendering System
D3.js is used for: 
- Layout computation for hierarchical headers 
- Virtualized grid rendering 
- Animated structural transitions 
- Hit‑testing for interaction 
 
D3 is **not** a state container.

## View Dimensionality Progression

Each view type is a different PAFV axis allocation. The SQL projection changes, not the data.

| View | Dimensions | Axis Mapping | Use Case |
| --- | --- | --- | --- |
| Gallery | 0 explicit | Position only | Icon/thumbnail browsing |
| List | 1 | y-axis (hierarchy/alphabet) | Sequential reading |
| Kanban | 1 facet | x-axis (category) | Status workflow |
| 2D Grid | 2 | x + y fully mapped | Cross-tabulation |
| SuperGrid | n | Stacked PAFV headers, z-axis depth | Multidimensional analysis |
| Timeline | 1 | x-axis (time) + lanes | Temporal sequencing |
| Network | GRAPH | Edges replace axes | Relationship exploration |
| Charts | 2 + aggregation | Statistical projection | Quantitative analysis |

**Polymorphic Transitions:**
When you switch from list to kanban to grid, the same cards flow from one arrangement to another via D3.js transitions. Selection persists. Filters persist. The animation proves: the data didn't change, only the projection did.

# DSL and Authoring 
## Slash command interface 
Notion‑style input: 
```
/tag #urgent
/sum Effort
/group by Project
```
 
## Compilation pipeline 
```javascript
DSL → AST → SQL 
```
DSL will also enable app builders to simplify app development: in Designer Workbench a slash command can be instantiated as a button.
 
## Categories as first‑class computation units 
 Formulas attach to categories, not individual cells. 
 
# Designer Workbench 
 The grid is also a UI builder for Interface‑Builder‑style visual composition backed by SQLite metadata 
 
Users can: 
- Define views 
- Compose components 
- Bind layout to projections 
 
# Sync Strategy 
V1 target: 
- Apple platforms only 
 
Sync layer: 
- CloudKit mirroring SQLite file 
 
Conflict model: 
- Last‑writer‑wins for layout metadata 
- Row‑level merge for entities 
 
# **Algorithms**
Worker can run: 
```javascript
Dystra shortest path
Jaccard similarity
Louvain community
PageRank centrality
Link Adams-Adar
Embedding Node2vec
```
 Results are materialized as tables and exposed as categories. 
#   Modular Components 
```javascript
For more detail: Isometry v5 Modules spec.md
```
| **#** | **Element** | **Description** |
| 1 | Cards | 4 default entities: Notes, Contacts, Events, and Resources |
| 2 | Views | 9 views: List, Gallery, Kanban, Grid, SuperGrid, Map, Timeline, Charts, and Graphs |
| 3 | Data Explorer | ETL/CAS/Catalog/MCP/Extensions: Import/export/sync Markdown, HTML, XLSX, DOCX, org-mode, SQLite-to-SQLite, MCP server, browser extensions, share sheets, and Data Catalog (Dataset of datasets: Settings, help/documentation, versions, templates, CAS, and apps) |
| 4 | Properties Explorer | Category: LATCH*GRAPH Properties filter navigation controls |
| 5 | Projection Explorer | Hierarchy: PAFV filter navigation controls such as Audit View |
| 6 | Time Explorer | Time: Temporal filter navigation controls for histogram, slider, zoom, and replay |
| 7 | Map Explorer | Location: MiniMap geospatial filter navigation controls for zoom/selection |
| 8 | Search Explorer | Alphanumeric: HotNotes.app styled indexed faceted search |
| 9 | Graph Explorer | Synthetics: Graph algorithms such as path, centrality, community, similarity, link, and embed |
| 10 | Formula Explorer | DSL/SQL/Graph: Formulas, queries, algorithms, and computed formats/views |
| 11 | Notebook | Capture/Preview (Card editor, WebView/D3.js viz) |
| 12 | Interface Builder | App Builder: Composable UI components/layout engine |
| 13 | Native Shell | SwiftUI for macOS and iOS, Kotlin for Android |
# What We Are Explicitly Not Using

| Technology | Why Not | What We Use Instead |
| --- | --- | --- |
| React/Vue/Angular | Framework overhead, virtual DOM unnecessary | Pure D3.js data join |
| Redux/Zustand/MobX | D3's enter/update/exit IS state management | D3.js `.join()` pattern |
| React Native | Not a framework app | Web app in native shell |
| SQLite.swift | Bridge overhead | sql.js (same JS runtime) |
| MessageBridge | Eliminated by sql.js architecture | Direct `db.exec()` calls |
| KuzuDB/Neo4j | Graph DB overhead | SQLite recursive CTEs |
| IndexedDB | Not needed | SQLite as primary store |
| Next.js/Remix | Server frameworks | Local-first app |
| RxJS | Complexity without benefit | Simple observable store |
 
# Why This Architecture  
## Performance 
- Set‑based computation in SQLite 
- Minimal JS memory pressure 
 
## Determinism  
Everything is reproducible from: 
- Database 
- Layout metadata 
- [This spec]
 
## Tangibility  
Query structure is the UI. 
 
## Evolvability 
V2 will progress without rewriting UI model: 
- DuckDB swap for large data 
- Collaborative features 
- Android/Windows/Web  
 
# V1 Success Criteria 
- Apple Notes imported as cards 
- Default multidimensional grid 
- Drag facets between axes 
- Category‑level formulas working 
- Layout persistence 
- Smooth interaction at scale 
 
# Open Questions 
- Undo/redo log location (SQLite vs store) 
- Materialized vs on‑demand projections 
- Incremental projection recompute 
- Layout versioning 
 
# Summary 
 This system treats: 
- SQLite as the computation engine 
- D3 as the visual runtime 
- Observable store as the interaction coordinator 
 
The result is a deterministic, tangible, multidimensional environment that unifies: 
- Knowledge work 
- Data modeling 
- App building  
