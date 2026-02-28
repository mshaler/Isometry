# Isometry v5 Projection Explorer Specification

## Overview

Projection Explorer manages PAFV axis mappings and view configurations. It's the control center for how data is spatially projected.

## PAFV Model

| Component | Definition |
|-----------|------------|
| **Planes** | x (horizontal), y (vertical), z (depth/layers) |
| **Axes** | LATCH dimensions mapped to planes |
| **Facets** | Specific attributes within an axis |
| **Values** | Cards rendered at coordinates |

## UI Components

### Axis Mapper
- Visual representation of current mapping
- Drag axes between x/y/z positions
- Remove/add axes

### Facet Selector
- Choose which facet within an axis
- e.g., Time axis → created_at vs due_at

### Audit View Toggle
- Highlight computed vs source values
- Show formula provenance
- Display aggregation rollups

## Saved Projections

```sql
CREATE TABLE projections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  x_axis TEXT,
  y_axis TEXT,
  z_axis TEXT,
  filters TEXT,  -- JSON
  sort_config TEXT,  -- JSON
  created_at TEXT
);
```

## Interaction Patterns

1. **Swap axes** → Transpose grid
2. **Add axis** → Increase dimensionality
3. **Save projection** → Reusable view
4. **Audit toggle** → Show computed cells

## Key Principles

1. **Any axis maps to any plane**
2. **View = PAFV projection**, not data copy
3. **Projections are saveable and shareable**
