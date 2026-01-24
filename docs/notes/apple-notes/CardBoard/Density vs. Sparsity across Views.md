---
title: "Density vs. Sparsity across Views"
id: 139091
created: 2025-12-23T04:08:08Z
modified: 2026-01-11T00:20:14Z
folder: "Learning/CardBoard"
attachments:
  - id: "00b650e9-bcef-44b5-9d8b-02b8a3dc5992"
    type: "com.apple.notes.table"
    content: "<table>\n<tr><td></td><td>Lists</td><td>Kanban</td><td>Grid</td><td>SuperGrid</td><td>D3/Mermaid viz</td><td>Graph</td></tr>\n<tr><td>Density</td><td>Gallery</td><td>Kanban Cards</td><td>Card Grid</td><td>Aggregate tabular analytics</td><td>Aggregate visual analytics</td><td>Aggregate visual synthesis</td></tr>\n<tr><td>Sparsity</td><td>Flat list</td><td>Outline</td><td>List Grid</td><td>Contextual tabular analytics</td><td>Contextual visual analytics</td><td>Contextual visual synthesis</td></tr>\n</table>\n"
  - id: "0e98e6c0-2786-4593-99fb-95f5ae110bf6"
    type: "com.apple.notes.table"
    content: "<table>\n<tr><td>Project</td><td>Checkbox</td><td>Slider</td><td>To Do</td><td>Doing</td><td>Done</td><td>Gantt chart range control</td></tr>\n<tr><td>Project #1</td><td>TRUE</td><td>4</td><td>Task card #1</td><td></td><td></td><td>Start-end dates</td></tr>\n<tr><td>Project #2</td><td>FALSE</td><td>3</td><td></td><td>Task card #2</td><td></td><td>Start-end dates</td></tr>\n<tr><td>Project #3</td><td>TRUE</td><td>2</td><td></td><td></td><td>Task card #3</td><td>Start-end dates</td></tr>\n</table>\n"
  - id: "0d4242d0-9b2f-498e-a0a9-74583d05cd9c"
    type: "com.apple.notes.inlinetextattachment.hashtag"
    content: "<a class=\"tag link\" href=\"/tags/CardBoard\">#CardBoard</a>"
links: []
source: notes://showNote?identifier=9c56b0de-556e-48ce-b9fa-8098b7481fc1
---
Density vs. Sparsity across Views

In discussing SuperDensitySparsity yesterday, we came across the 2D Grid example of Card Grid vs. List Grid.  CardGrid shows cards in their SuperGrid-style position at the intersection of two individual row and column headers, whereas List Grid is a simple list of Card entities by row with columns representing properties, including positional properties in higher dimension views. I took a swipe at mapping views by dimensionality to test our hyposthesis about Janus applied to views. Here’s the (slightly-overfitted) model, with a further enumeration of the project example showing how dense and sparse views might be joined in CardBoard apps with rich data types.

|  | Lists | Kanban | Grid | SuperGrid | D3/Mermaid viz | Graph |

|---|---|---|---|---|---|---|

| Density | Gallery | Kanban Cards | Card Grid | Aggregate tabular analytics | Aggregate visual analytics | Aggregate visual synthesis |

| Sparsity | Flat list | Outline | List Grid | Contextual tabular analytics | Contextual visual analytics | Contextual visual synthesis |

Welding templates will mean joining sparse but rich data types with dense but impactful positional elements.

Projects and Checkbox and Slider are sparse and To Do/Doing/Done are dense, with a Gantt chart adding even more timeline density:

| Project | Checkbox | Slider | To Do | Doing | Done | Gantt chart range control |

|---|---|---|---|---|---|---|

| Project #1 | TRUE | 4 | Task card #1 |  |  | Start-end dates |

| Project #2 | FALSE | 3 |  | Task card #2 |  | Start-end dates |

| Project #3 | TRUE | 2 |  |  | Task card #3 | Start-end dates |

[#CardBoard](/tags/CardBoard)

---

[Open in Notes](notes://showNote?identifier=9c56b0de-556e-48ce-b9fa-8098b7481fc1)