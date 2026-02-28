# Isometry v5 Properties Explorer Specification

## Overview

Properties Explorer provides LATCH-based category filter navigation controls. It surfaces the taxonomic properties of cards for filtering, grouping, and faceted search.

## LATCH Dimensions

| Axis | Properties | UI Controls |
|------|------------|-------------|
| **L** (Location) | Coordinates, place names | Map picker, location search |
| **A** (Alphabet) | Names, titles | A-Z index, search bar |
| **T** (Time) | Created, modified, due, event | Date pickers, range sliders |
| **C** (Category) | Folders, tags, status, card_type | Chip selectors, tree nav |
| **H** (Hierarchy) | Priority, importance | Slider, numeric filters |

## UI Components

### Category Navigator
- Folder tree with counts
- Tag cloud with frequency
- Status chips (filterable)
- Card type toggles

### Filter Bar
- Active filter chips (removable)
- Quick clear all
- Save filter as preset

### Faceted Counts
- Live counts per facet value
- Zero-result facets dimmed
- Drill-down on click

## Interaction Patterns

1. **Click facet** → Filter cards to that value
2. **Shift-click** → Add to multi-select filter
3. **Drag facet to axis** → Remap PAFV projection
4. **Right-click** → Rename, merge, delete facet

## SQL Patterns

```sql
-- Facet counts
SELECT folder, COUNT(*) as count
FROM cards WHERE deleted_at IS NULL
GROUP BY folder ORDER BY count DESC;

-- Active filters → WHERE clause
WHERE folder IN (?, ?) AND status = ? AND priority >= ?
```

## Key Principles

1. **LATCH separates** — Each dimension is a filter axis
2. **Live counts** — Facet values show current result counts
3. **Composable** — Multiple filters combine with AND
