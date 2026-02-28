# InterfaceBuilder

> App composition and layout configuration

## Purpose

InterfaceBuilder allows users to compose custom interfaces from Isometry's Explorer modules, views, and components. It's the meta-layer for building purpose-specific applications without code.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       InterfaceBuilder                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌────────────────────────────────────────┤
│  │  Component      │  │        Canvas (Drop Zone)              │
│  │  Palette        │  │  ┌─────────────┬─────────────────────┐ │
│  │                 │  │  │             │                     │ │
│  │  ├─ Views       │  │  │  Sidebar    │    Main View        │ │
│  │  │  ├─ Grid     │  │  │  (dropped)  │    (dropped)        │ │
│  │  │  ├─ Graph    │  │  │             │                     │ │
│  │  │  └─ Table    │  │  │             │                     │ │
│  │  │              │  │  └─────────────┴─────────────────────┘ │
│  │  ├─ Explorers   │  │                                        │
│  │  │  ├─ Search   │  │  ┌──────────────────────────────────┐  │
│  │  │  ├─ Props    │  │  │  Bottom Panel (dropped)          │  │
│  │  │  └─ Time     │  │  └──────────────────────────────────┘  │
│  │  │              │  │                                        │
│  │  └─ Widgets     │  └────────────────────────────────────────┤
│  │     ├─ Stats    │                                           │
│  │     └─ Actions  │  [Save Layout]  [Preview]  [Export]       │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Layout System

### Container Types

| Container | Behavior |
|-----------|----------|
| **Split** | Resizable divider between two panels |
| **Tabs** | Stacked panels, one visible at a time |
| **Stack** | Vertical or horizontal arrangement |
| **Grid** | CSS Grid-based layout |
| **Float** | Overlapping panels (dialogs, popovers) |

### Layout Schema

```javascript
const layout = {
  id: 'research-app',
  name: 'Research Dashboard',
  root: {
    type: 'split',
    direction: 'horizontal',
    sizes: [25, 75], // Percentages
    children: [
      {
        type: 'stack',
        direction: 'vertical',
        children: [
          { type: 'component', component: 'SearchExplorer' },
          { type: 'component', component: 'PropertiesExplorer' }
        ]
      },
      {
        type: 'split',
        direction: 'vertical',
        sizes: [70, 30],
        children: [
          { type: 'component', component: 'GraphView' },
          { type: 'component', component: 'TableView' }
        ]
      }
    ]
  }
};
```

## Component Registry

All available building blocks:

### Views
| Component | Description |
|-----------|-------------|
| `ListView` | 1D card list |
| `GridView` | 2D card grid |
| `GraphView` | Force-directed graph |
| `TableView` | Data table |
| `CalendarView` | Date-based calendar |
| `TimelineView` | Chronological timeline |
| `MapView` | Geospatial map |
| `KanbanView` | Stage-based board |
| `SuperGridView` | Faceted grid |

### Explorers
| Component | Description |
|-----------|-------------|
| `SearchExplorer` | Full-text search |
| `PropertiesExplorer` | LATCH filters |
| `ProjectionExplorer` | PAFV axis mapping |
| `TimeExplorer` | Time range selection |
| `MapExplorer` | Geo bounding box |
| `GraphExplorer` | Graph algorithms |
| `FormulaExplorer` | Computed fields |
| `DataExplorer` | Import/export |

### Widgets
| Component | Description |
|-----------|-------------|
| `StatsWidget` | Count/sum/avg display |
| `ActionBar` | Toolbar with buttons |
| `Breadcrumb` | Navigation trail |
| `CardDetail` | Selected card inspector |
| `Minimap` | Overview navigation |

## Wiring

Components communicate through a shared state bus:

```javascript
// Component emits event
searchExplorer.on('results', (cardIds) => {
  stateBus.emit('filtered_cards', cardIds);
});

// Other components subscribe
graphView.subscribe('filtered_cards', (cardIds) => {
  this.setData(cardIds);
});

// Wiring defined in layout
const wiring = {
  connections: [
    {
      from: { component: 'SearchExplorer', event: 'results' },
      to: { component: 'GraphView', action: 'setData' }
    },
    {
      from: { component: 'GraphView', event: 'selection' },
      to: { component: 'CardDetail', action: 'showCard' }
    }
  ]
};
```

## Drag-and-Drop Builder

### Canvas Operations

| Action | Result |
|--------|--------|
| Drag component → canvas | Add to layout |
| Drag component → edge | Create split |
| Drag component → existing | Replace or tab |
| Drag divider | Resize panels |
| Right-click panel | Panel context menu |
| Double-click tab | Rename panel |

### Component Configuration

Each dropped component has settings:

```javascript
const componentConfig = {
  component: 'GraphView',
  props: {
    layout: 'force-directed',
    showLabels: true,
    nodeSize: 'pagerank'
  },
  bindings: {
    data: 'filtered_cards', // State subscription
    selection: 'selected_card' // Bidirectional
  }
};
```

## Presets

Built-in layout presets:

| Preset | Components |
|--------|------------|
| **Research** | Search + Graph + Properties + Detail |
| **Kanban** | Kanban + Filters + Stats |
| **Data Studio** | Table + Formulas + Import |
| **Timeline** | Timeline + Time Explorer + List |
| **Network** | Graph + Graph Explorer + Minimap |
| **Notebook** | Notebook + Card Grid + Detail |

## Persistence

Layouts stored in SQLite:

```sql
CREATE TABLE layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  layout_json TEXT NOT NULL, -- Full layout tree
  wiring_json TEXT NOT NULL, -- Component connections
  is_preset INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE layout_components (
  id TEXT PRIMARY KEY,
  layout_id TEXT REFERENCES layouts(id),
  component_type TEXT NOT NULL,
  config_json TEXT NOT NULL
);
```

## URL Routing

Layouts can be URL-addressable:

```
/app/research          → Load "Research" layout
/app/research?q=api    → Load + apply search query
/app/kanban?status=wip → Load + filter by status
```

```javascript
// Route parsing
const route = parseRoute(url);
const layout = await loadLayout(route.layoutId);
const initialState = parseQueryParams(route.params);
applyLayout(layout, initialState);
```

## Export/Import

### Export App
```javascript
async function exportApp(layoutId) {
  const layout = await getLayout(layoutId);
  const components = await getComponentConfigs(layoutId);
  const wiring = await getWiring(layoutId);

  return {
    version: '1.0',
    layout,
    components,
    wiring,
    // Optional: include referenced formulas, filters
  };
}
```

### Import App
```javascript
async function importApp(appJson) {
  // Validate schema
  validateAppSchema(appJson);

  // Create layout
  const layoutId = await createLayout(appJson.layout);

  // Register components
  for (const comp of appJson.components) {
    await registerComponent(layoutId, comp);
  }

  // Set up wiring
  await createWiring(layoutId, appJson.wiring);

  return layoutId;
}
```

## Responsive Behavior

Layouts adapt to screen size:

```javascript
const breakpoints = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1440
};

const responsiveLayout = {
  desktop: layout, // Full layout
  tablet: collapseToTabs(layout), // Side panels become tabs
  mobile: stackVertically(layout) // Everything stacks
};
```

## State

| State | Stored In |
|-------|-----------|
| Layout definitions | SQLite `layouts` table |
| Current layout | URL + app state |
| Panel sizes | localStorage (per layout) |
| Component configs | SQLite `layout_components` |
| Wiring connections | SQLite (in layout JSON) |

## Not Building

- Visual programming / node-based logic
- Custom component development UI
- Layout version history
- Multi-user layout editing
- Runtime component hot-reload
