# Isometry Modular Components
Isometry's 13 modular components are the building flocks of Isometry's two primary user interfaces:
1. **Designer Workbench**: Isometry's primary "kitchen sink" interface for building apps
2. **Isometry Apps**: Apps are primary delivery  vehicle for usage of the Isometry platform.  An example app is "Inbox" which consolidates, prioritizes, and filters all notifications from other apps such Mail.app, Messages.app, and Slack.app for simpler GTD clarification and action.
| **#** | **Element** | **Description** | Specification |
| 1 | Cards | **4 default entities**: Notes, Contacts, Events, and Resources | Cards.md |
| 2 | Views | **9 views**: List, Gallery, Kanban, Grid, SuperGrid, Map, Timeline, Charts, and Graphs | Views.md |
| 3 | Data Explorer | **ETL/CAS/Catalog/MCP/Extensions**: \n- Import/export/sync Markdown, HTML, XLSX, DOCX, org-mode, and SQLite-to-SQLite sync (eg, Apple Notes roundtrip)\n- Data Catalog: Dataset of datasets, including CAS managed storage (files/blobs), user configurable Settings, versions, templates, and app registries, and help/documentation\n- MCP server, browser extensions, and share sheets | DataExplorer.md |
| 4 | Properties Explorer | **Category**: LATCH*GRAPH Properties filter navigation controls | PropertiesExplorer.md |
| 5 | Projection Explorer | **Hierarchy**: PAFV filter navigation controls such as Audit View | ProjectionExplorer.md |
| 6 | Time Explorer | **Time**: Temporal filter navigation controls for histogram, slider, zoom, and replay | TimeExplorer.md |
| 7 | Map Explorer | **Location**: MiniMap geospatial filter navigation controls for zoom/selection | MapExplorer.md |
| 8 | Search Explorer | **Alphanumeric**: HotNotes.app styled indexed faceted search | SearchExplorer.md |
| 9 | Graph Explorer | **Synthetics**: Graph algorithms for connected data insights\n- Dystra shortest path\n- Jaccard similarity\n- Louvain community\n- PageRank centrality\n- Link Adams-Adar\n- Embedding Node2vec\n | GraphExplorer.md |
| 10 | Formula Explorer | **DSL/SQL/Graph**: Formulas, queries, algorithms, and computed formats/views | FormulaExplorer.md |
| 11 | Notebook | Card editor and Preview (WebView/D3.js viz) | Notebook.md |
| 12 | Interface Builder | **App Builder**: Composable UI components/layout engine | InterfaceBuilder.md |
| 13 | Native Shell | SwiftUI for macOS and iOS, Kotlin for Android | NativeShell.md |