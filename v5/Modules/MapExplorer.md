# MapExplorer

> Geospatial filter navigation — Location axis of LATCH

## Purpose

MapExplorer provides geographic filtering and context for cards with location data. It operates as a **MiniMap** that applies spatial bounding-box filters to the main view, not as a primary visualization.

## Relationship to LATCH

| LATCH Axis | MapExplorer Role |
|------------|------------------|
| **Location** | Primary — bounding box selection filters cards |
| Alphabet | N/A |
| Time | Secondary — time-slider can combine with geo bounds |
| Category | Secondary — category chips overlay on map |
| Hierarchy | N/A |

## Data Requirements

Cards need location data to appear on map:

```sql
-- Cards with extractable location
SELECT c.id, c.title,
       json_extract(c.raw_import, '$.latitude') as lat,
       json_extract(c.raw_import, '$.longitude') as lng,
       json_extract(c.raw_import, '$.location_name') as name
FROM cards c
WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

**Schema-on-read**: Location can come from:
- Explicit lat/lng fields
- Geocoded address strings
- Place name lookups
- IP geolocation
- Photo EXIF data

## MiniMap Architecture

```
┌─────────────────────────────────────┐
│         Main View (Grid/Graph)       │
│                                      │
│   ┌──────────────┐                  │
│   │   MiniMap    │ ← MapExplorer    │
│   │  ┌────────┐  │                  │
│   │  │ bounds │  │ Selection rect   │
│   │  └────────┘  │                  │
│   └──────────────┘                  │
│                                      │
└─────────────────────────────────────┘
```

## Rendering Stack

**Pure D3.js** with tile layer:

```javascript
// MapExplorer uses D3 for everything except base tiles
const projection = d3.geoMercator()
  .center([lng, lat])
  .scale(scale);

const path = d3.geoPath().projection(projection);

// Card markers as D3 circles
svg.selectAll('circle.card-marker')
  .data(cardsWithLocation, d => d.id)
  .join('circle')
    .attr('cx', d => projection([d.lng, d.lat])[0])
    .attr('cy', d => projection([d.lng, d.lat])[1])
    .attr('r', 4);
```

**Tile options** (no external dependencies):
- Static image tiles (MapTiler, Stadia)
- Vector tiles rendered via D3 paths
- No Mapbox GL / Leaflet (keeps pure D3.js)

## Interactions

| Gesture | Action |
|---------|--------|
| Drag rectangle | Set bounding box filter |
| Double-click | Zoom to location |
| Scroll wheel | Zoom in/out |
| Click marker | Select card in main view |
| Shift+drag | Pan map |

## Filter Integration

MapExplorer emits filter predicates:

```javascript
// Bounding box filter
const geoFilter = {
  type: 'geo_bounds',
  bounds: {
    north: 47.6,
    south: 47.5,
    east: -122.3,
    west: -122.4
  }
};

// Applied via PropertiesExplorer filter chain
filterChain.add(geoFilter);
```

## Clustering

For dense datasets, D3 quadtree clustering:

```javascript
const quadtree = d3.quadtree()
  .x(d => d.lng)
  .y(d => d.lat)
  .addAll(cards);

// Cluster at zoom levels
function clusterAtZoom(zoom) {
  const radius = 50 / zoom;
  return clusterPoints(quadtree, radius);
}
```

## State

| State | Stored In |
|-------|-----------|
| Current bounds | Filter chain (PropertiesExplorer) |
| Zoom level | Local component state |
| Visible markers | Derived from filtered cards |

## Not Building

- Full-screen map view (MiniMap only)
- Directions/routing
- Street view
- Custom map styling UI
- Offline map tiles
