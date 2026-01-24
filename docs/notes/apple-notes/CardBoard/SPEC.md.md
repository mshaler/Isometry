---
title: "SPEC.md"
id: 139506
created: 2026-01-09T03:27:53Z
modified: 2026-01-13T19:57:18Z
folder: "Learning/CardBoard"
attachments:
  - id: "7227a86e-6c94-4bcb-950d-dab14e3d7737"
    type: "com.apple.notes.table"
    content: "<table>\n<tr><td>View</td><td>Sparsity</td><td>Density</td></tr>\n<tr><td>0D</td><td>Flat list</td><td>Gallery</td></tr>\n<tr><td>1D</td><td>Tree list</td><td>Kanban</td></tr>\n<tr><td>2D</td><td>List grid</td><td>Card grid</td></tr>\n<tr><td>nD</td><td>SuperGrid</td><td>3D SuperGrid</td></tr>\n<tr><td>xD</td><td>Graph</td><td>Charts</td></tr>\n</table>\n"
  - id: "ae0db6d5-2824-4de0-a586-112f71984ad0"
    type: "com.apple.notes.table"
    content: "<table>\n<tr><td>Location</td><td>Semantic-aware maps Spacialite? OSM? Google? Apple?</td></tr>\n<tr><td>Alphanumeric</td><td>Faceted tokenized context-aware search/filter/sort/query builder</td></tr>\n<tr><td>Time</td><td>TimeSlicer/TimeSlider</td></tr>\n<tr><td>Category</td><td>PAFV selector (old Time fan-out left panel)</td></tr>\n<tr><td>Hierarchy</td><td>PAFV navigator (old DN)</td></tr>\n</table>\n"
  - id: "26882bd3-6d3d-40d5-a6f9-9f3e67273514"
    type: "com.apple.notes.table"
    content: "<table>\n<tr><td><b>Pathfinding</b></td><td>Finding optimal routes between nodes (shortest path, minimum spanning tree, etc)</td><td>Used for navigation, dependency analysis, root cause analysis</td></tr>\n<tr><td><b>Centrality</b></td><td>Measuring the importance or influence of nodes based on their position and connections</td><td>Includes degree centrality, betweenness centrality, closeness centrality, and PageRank</td></tr>\n<tr><td><b>Community Detection</b></td><td>Identifying clusters or groups of nodes that are more densely connected to each other than to the rest of the network</td><td>Algorithms include Louvain, Label Propagation, and Connected Components</td></tr>\n<tr><td><b>Similarity</b></td><td>Calculating how alike nodes are based on their properties or their connections within the graph</td><td>Includes Jaccard similarity, cosine similarity, and k-nearest neighbors</td></tr>\n<tr><td><b>Link Prediction</b></td><td>Estimating the likelihood that a relationship might form between currently unconnected nodes</td><td>Uses structural patterns like common neighbors, preferential attachment, and Adamic-Adar</td></tr>\n<tr><td><b>Node Embedding / Graph Embedding</b></td><td>Translating nodes and their relationships into numerical vectors that capture network position and context</td><td>Techniques like Node2Vec enable downstream ML tasks</td></tr>\n</table>\n"
  - id: "bfcf8010-d745-46b5-8ec9-21f54f895b20"
    type: "com.apple.notes.inlinetextattachment.hashtag"
    content: "<a class=\"tag link\" href=\"/tags/CardBoard\">#CardBoard</a>"
links: []
source: notes://showNote?identifier=28d13699-cd0b-43b0-b391-ec49858bc10a
---
SPEC.md

## Backend

* SQLite DDL

* JSON file format

* SQLite.swift bridge

* Content Aware Storage 

* ETL.swift suite

* Catalog dataset

* Taxonomy dataset

## Views

| View | Sparsity | Density |

|---|---|---|

| 0D | Flat list | Gallery |

| 1D | Tree list | Kanban |

| 2D | List grid | Card grid |

| nD | SuperGrid | 3D SuperGrid |

| xD | Graph | Charts |

## FilterNavs

- Left panel is shared by LATCH and GRAPH

* Unfurled section is active, furled section shows filters/algorithms applied

## LATCH

 Need to differentiate between Category and Hierarchy in PAFV FilterNavs

| Location | Semantic-aware maps Spacialite? OSM? Google? Apple? |

|---|---|

| Alphanumeric | Faceted tokenized context-aware search/filter/sort/query builder |

| Time | TimeSlicer/TimeSlider |

| Category | PAFV selector (old Time fan-out left panel) |

| Hierarchy | PAFV navigator (old DN) |

## GRAPH

 LadybugDB to replace Kuzu—and get all these in Cypher/Open Cypher?

 OR: GraphQLite (?)

The six types of graph algorithms/analytics commonly cited are:

| **Pathfinding*

* | Finding optimal routes between nodes (shortest path, minimum spanning tree, etc) | Used for navigation, dependency analysis, root cause analysis |

|---|---|---|

| **Centrality*

* | Measuring the importance or influence of nodes based on their position and connections | Includes degree centrality, betweenness centrality, closeness centrality, and PageRank |

| **Community Detection*

* | Identifying clusters or groups of nodes that are more densely connected to each other than to the rest of the network | Algorithms include Louvain, Label Propagation, and Connected Components |

| **Similarity*

* | Calculating how alike nodes are based on their properties or their connections within the graph | Includes Jaccard similarity, cosine similarity, and k-nearest neighbors |

| **Link Prediction*

* | Estimating the likelihood that a relationship might form between currently unconnected nodes | Uses structural patterns like common neighbors, preferential attachment, and Adamic-Adar |

| **Node Embedding / Graph Embedding*

* | Translating nodes and their relationships into numerical vectors that capture network position and context | Techniques like Node2Vec enable downstream ML tasks |

[#CardBoard](/tags/CardBoard)

---

[Open in Notes](notes://showNote?identifier=28d13699-cd0b-43b0-b391-ec49858bc10a)