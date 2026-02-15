---
phase: 98-isometry-embeds
plan: 02
type: summary
status: complete
completed_at: 2026-02-14
---

# Phase 98-02 Summary: Live Data Updates

## Objective Achieved

Embeds now automatically update when underlying data changes, using the dataVersion reactivity pattern from SQLiteProvider. LATCH filter parameters are fully supported.

## What Was Built

### Task 1: useEmbedData Hook

Created `src/hooks/embed/useEmbedData.ts` with:

- **useEmbedData()** - Core hook for live data fetching with automatic refetch on dataVersion changes
- **useSuperGridData()** - Convenience wrapper for SuperGrid embeds
- **useNetworkData()** - Convenience wrapper for Network embeds with edge loading
- **useTimelineData()** - Convenience wrapper for Timeline embeds

Key features:
- Leverages useSQLiteQuery which depends on dataVersion from SQLiteProvider
- Supports LATCH filter parameter (SQL WHERE clause)
- Includes edge fetching for network embeds with proper IN clause optimization
- Transform functions for converting database rows to Node and Edge types

### Task 2: Live Data in EmbedNode Components

Updated `src/components/notebook/editor/nodes/EmbedNode.tsx`:

**SuperGridEmbed:**
- Uses useEmbedData with type 'supergrid'
- Renders grid layout with D3.js enter/update/exit pattern
- Shows card cells with name truncation
- Displays "Showing X of Y cards" summary

**NetworkEmbed:**
- Uses useEmbedData with includeEdges: true
- Implements D3 force-directed graph with simulation
- Transforms edge source_id/target_id to D3 link format
- Proper simulation cleanup on unmount

**TimelineEmbed:**
- Uses useEmbedData for temporal data
- Uses d3.scaleTime for time-based positioning
- Renders events as circles on timeline axis
- Sorts nodes by createdAt timestamp

All components:
- Read filter from node.attrs.filter
- Show loading and error states
- Handle empty data gracefully
- Clean up D3 resources on unmount

### Task 3: Filter Parameter Support

Updated `src/components/notebook/editor/extensions/EmbedExtension.ts`:

- Added `filter` attribute with data-filter HTML attribute mapping
- Filter syntax documented: SQL WHERE clause format
- Examples: `"folder = 'work'"`, `"status = 'active' AND folder = 'work'"`
- Default empty string for unfiltered view

## Files Modified

| File | Change |
|------|--------|
| src/hooks/embed/useEmbedData.ts | Created - Live data hook with filter support |
| src/hooks/embed/index.ts | Created - Barrel exports |
| src/hooks/index.ts | Updated - Export embed hooks |
| src/components/notebook/editor/nodes/EmbedNode.tsx | Updated - D3 rendering with live data |
| src/components/notebook/editor/extensions/EmbedExtension.ts | Updated - Filter attribute |

## Verification

- [x] `npm run typecheck` passes with zero errors
- [x] useEmbedData hook exports from src/hooks/embed/index.ts
- [x] Filter attribute added to EmbedExtension
- [x] All three embed types use useEmbedData
- [x] D3 cleanup on unmount (simulation.stop(), svg.selectAll('*').remove())

## Key Insights

1. **dataVersion reactivity** - useSQLiteQuery already depends on dataVersion, so useEmbedData automatically gets live updates without additional work

2. **Edge field naming** - Database uses source_id/target_id, D3 forceLink uses source/target objects. Transform happens in NetworkEmbed.

3. **D3 simulation lifecycle** - Force simulation must be stopped and nulled on unmount to prevent memory leaks

4. **Filter as SQL WHERE** - Simple approach: filter attribute is a raw SQL WHERE clause. This defers validation to SQLite and gives full LATCH flexibility.

## Next Steps

Plan 98-03 will add:
- EmbedToolbar for view switching (already scaffolded)
- Filter editor UI
- PAFV axis configuration
