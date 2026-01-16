# D3.js for Isometry

## Core Philosophy

Isometry uses D3.js as foundational architecture for polymorphic data representations. D3's data binding **replaces** complex state management.

**Key insight**: D3's enter/update/exit pattern IS your state management.

## Quick Start

```javascript
// Basic data binding
const cards = fetchFromSQLite();

d3.select("#container")
  .selectAll(".card")
  .data(cards, d => d.id)  // Key function crucial!
  .join("div")
    .attr("class", "card")
    .text(d => d.title);
```

## Polymorphic Views

Same data, multiple visualizations:

```javascript
// Grid, Kanban, Graph - all use same data
d3.select("#grid").selectAll(".cell").data(cards, d => d.id).join("div");
d3.select("#kanban").selectAll(".card").data(cards, d => d.id).join("div");
d3.select("#graph").selectAll(".node").data(cards, d => d.id).join("circle");
```

## Best Practices

1. Always use key functions: `.data(cards, d => d.id)`
2. Prefer `.join()` over manual enter/update/exit
3. Measure before optimizing
4. Single data source: SQLite → Memory → D3 Views

The "boring stack" wins.
