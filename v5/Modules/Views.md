# Views

> The nine view types — PAFV projections rendered in D3.js

## View Dimensionality Progression

Views progress from minimal to maximal visual dimensions:

| View | Dims | Primary Use |
|------|------|-------------|
| List | 1D | Scanning, reading |
| Grid | 2D | Overview, comparison |
| Calendar | 2D | Time-based planning |
| Timeline | 2D | Chronological narrative |
| Map | 2D | Geospatial context |
| Kanban | 2D | Workflow stages |
| Graph | 2D+ | Relationship exploration |
| SuperGrid | 3D | Multi-facet analysis |
| Table | nD | Data manipulation |

## Architecture

All views share the same rendering pattern:

```javascript
// Every view implements this contract
const view = {
  // Data binding via D3
  render(cards, projection) {
    const selection = container.selectAll('.card')
      .data(cards, d => d.id)
      .join(
        enter => enter.append('g').call(this.enterCard),
        update => update.call(this.updateCard),
        exit => exit.call(this.exitCard)
      );
  },

  // PAFV projection controls what axes mean
  applyProjection(projection) {
    // Map PAFV axes to visual encodings
  }
};
```

---

## 1. List View

**1D sequential** — Cards as rows

```
┌─────────────────────────────────────┐
│ ☐ Card Title One          2024-01-15 │
│ ☐ Card Title Two          2024-01-14 │
│ ☐ Card Title Three        2024-01-13 │
│ ☐ Card Title Four         2024-01-12 │
└─────────────────────────────────────┘
```

**PAFV mapping**:
- Y-axis: Sort order (alphabet, time, category)
- No X-axis (single column)

**D3 implementation**:
```javascript
svg.selectAll('g.list-row')
  .data(cards, d => d.id)
  .join('g')
    .attr('transform', (d, i) => `translate(0, ${i * rowHeight})`);
```

---

## 2. Grid View

**2D spatial** — Cards as tiles

```
┌───────┬───────┬───────┬───────┐
│ Card  │ Card  │ Card  │ Card  │
│  1    │  2    │  3    │  4    │
├───────┼───────┼───────┼───────┤
│ Card  │ Card  │ Card  │ Card  │
│  5    │  6    │  7    │  8    │
└───────┴───────┴───────┴───────┘
```

**PAFV mapping**:
- X-axis: Column (derived from sort + wrap)
- Y-axis: Row (derived from sort + wrap)
- Size: Can map to value field
- Color: Can map to category

**D3 implementation**:
```javascript
const columns = Math.floor(width / cellWidth);
svg.selectAll('g.grid-cell')
  .data(cards, d => d.id)
  .join('g')
    .attr('transform', (d, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      return `translate(${col * cellWidth}, ${row * cellHeight})`;
    });
```

---

## 3. Calendar View

**2D temporal** — Cards placed on date grid

```
     Mon   Tue   Wed   Thu   Fri   Sat   Sun
    ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
 W1 │     │ ●●  │ ●   │     │ ●●● │     │     │
    ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
 W2 │ ●   │     │ ●●  │ ●   │     │ ●   │     │
    └─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

**PAFV mapping**:
- X-axis: Day of week (fixed)
- Y-axis: Week number
- Cell content: Cards with that date

**D3 implementation**:
```javascript
const dayOfWeek = d3.timeFormat('%w');
const weekOfYear = d3.timeFormat('%W');

svg.selectAll('g.calendar-cell')
  .data(cards, d => d.id)
  .join('g')
    .attr('transform', d => {
      const x = +dayOfWeek(d.date) * cellWidth;
      const y = +weekOfYear(d.date) * cellHeight;
      return `translate(${x}, ${y})`;
    });
```

---

## 4. Timeline View

**2D chronological** — Cards on time axis

```
2024-01 ──●────●──────●─────────────●──────
2024-02 ────●───●────────●──────●──────────
2024-03 ●─────────●────────────●───────────
         ───────────────────────────────────→
                      Time
```

**PAFV mapping**:
- X-axis: Time (continuous scale)
- Y-axis: Swim lanes (by category/source)

**D3 implementation**:
```javascript
const timeScale = d3.scaleTime()
  .domain([minDate, maxDate])
  .range([0, width]);

svg.selectAll('circle.event')
  .data(cards, d => d.id)
  .join('circle')
    .attr('cx', d => timeScale(d.date))
    .attr('cy', d => laneScale(d.category));
```

---

## 5. Map View

**2D geospatial** — Cards at locations

```
    ┌─────────────────────────────┐
    │         ●                   │
    │    ●         ●●             │
    │              ●              │
    │       ●            ●        │
    │  ●                          │
    └─────────────────────────────┘
```

**PAFV mapping**:
- X-axis: Longitude
- Y-axis: Latitude
- Size: Can map to value
- Color: Can map to category

**D3 implementation**:
```javascript
const projection = d3.geoMercator()
  .fitSize([width, height], geojson);

svg.selectAll('circle.marker')
  .data(cards, d => d.id)
  .join('circle')
    .attr('cx', d => projection([d.lng, d.lat])[0])
    .attr('cy', d => projection([d.lng, d.lat])[1]);
```

---

## 6. Kanban View

**2D categorical** — Cards in stage columns

```
┌─────────┬─────────┬─────────┬─────────┐
│  TODO   │   WIP   │ REVIEW  │  DONE   │
├─────────┼─────────┼─────────┼─────────┤
│ ┌─────┐ │ ┌─────┐ │ ┌─────┐ │ ┌─────┐ │
│ │Card │ │ │Card │ │ │Card │ │ │Card │ │
│ └─────┘ │ └─────┘ │ └─────┘ │ └─────┘ │
│ ┌─────┐ │ ┌─────┐ │         │ ┌─────┐ │
│ │Card │ │ │Card │ │         │ │Card │ │
│ └─────┘ │ └─────┘ │         │ └─────┘ │
└─────────┴─────────┴─────────┴─────────┘
```

**PAFV mapping**:
- X-axis: Status category (discrete)
- Y-axis: Sort within column
- Drag-drop: Updates status field

**D3 implementation**:
```javascript
const columns = d3.group(cards, d => d.status);
const columnScale = d3.scaleBand()
  .domain(['todo', 'wip', 'review', 'done'])
  .range([0, width]);

svg.selectAll('g.kanban-column')
  .data(columns)
  .join('g')
    .attr('transform', ([status]) => `translate(${columnScale(status)}, 0)`);
```

---

## 7. Graph View

**2D+ relational** — Cards as nodes, connections as edges

```
        ┌───┐
        │ A │
        └─┬─┘
          │
    ┌─────┼─────┐
    │     │     │
  ┌─┴─┐ ┌─┴─┐ ┌─┴─┐
  │ B │ │ C │ │ D │
  └───┘ └─┬─┘ └───┘
          │
        ┌─┴─┐
        │ E │
        └───┘
```

**PAFV mapping**:
- X-axis: Force-directed or hierarchical layout
- Y-axis: Force-directed or hierarchical layout
- Size: Degree, PageRank, or value field
- Color: Community or category

**D3 implementation**:
```javascript
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(edges).id(d => d.id))
  .force('charge', d3.forceManyBody().strength(-100))
  .force('center', d3.forceCenter(width/2, height/2));

simulation.on('tick', () => {
  links.attr('x1', d => d.source.x)...
  nodes.attr('cx', d => d.x).attr('cy', d => d.y);
});
```

---

## 8. SuperGrid View

**3D faceted** — Grid with grouped rows/columns

```
              │ Category A │ Category B │ Category C │
──────────────┼────────────┼────────────┼────────────┤
   Source 1   │    ●●●     │     ●      │    ●●      │
──────────────┼────────────┼────────────┼────────────┤
   Source 2   │     ●      │    ●●●●    │            │
──────────────┼────────────┼────────────┼────────────┤
   Source 3   │    ●●      │     ●      │    ●●●     │
──────────────┴────────────┴────────────┴────────────┘
```

**PAFV mapping**:
- X-axis: First grouping facet
- Y-axis: Second grouping facet
- Cell: Cards matching both facets
- Aggregation: Count, sum, or card list

**D3 implementation**:
```javascript
const grouped = d3.rollup(cards,
  v => v,
  d => d.category,
  d => d.source
);

// Render as nested grid
const rows = svg.selectAll('g.row')
  .data(grouped)
  .join('g');

rows.selectAll('g.cell')
  .data(d => d[1])
  .join('g');
```

---

## 9. Table View

**nD tabular** — Full data table with sorting/filtering

```
┌────────────────┬────────────┬────────────┬─────────┐
│ Title        ▼ │ Created    │ Category   │ Tags    │
├────────────────┼────────────┼────────────┼─────────┤
│ Card One       │ 2024-01-15 │ Feature    │ api, v2 │
│ Card Two       │ 2024-01-14 │ Bug        │ urgent  │
│ Card Three     │ 2024-01-13 │ Feature    │ ui      │
└────────────────┴────────────┴────────────┴─────────┘
```

**PAFV mapping**:
- X-axis: Columns (selected fields)
- Y-axis: Rows (cards)
- Sort: Any column
- Filter: Column-level filters

**D3 implementation**:
```javascript
const table = d3.select('#table');
const thead = table.append('thead');
const tbody = table.append('tbody');

thead.selectAll('th')
  .data(columns)
  .join('th')
    .text(d => d.label)
    .on('click', sortByColumn);

tbody.selectAll('tr')
  .data(cards, d => d.id)
  .join('tr')
  .selectAll('td')
    .data(d => columns.map(col => d[col.field]))
    .join('td')
      .text(d => d);
```

---

## View Switching

Smooth transitions between views using D3:

```javascript
function switchView(fromView, toView) {
  // Shared key function preserves identity
  const key = d => d.id;

  // Transition to new positions
  container.selectAll('.card')
    .data(cards, key)
    .transition()
    .duration(750)
    .attr('transform', d => toView.getPosition(d));
}
```

## State

| State | Stored In |
|-------|-----------|
| Current view type | URL parameter / app state |
| View-specific settings | localStorage per view |
| Projection mapping | PAFV configuration |
| Zoom/pan state | D3 zoom behavior |
