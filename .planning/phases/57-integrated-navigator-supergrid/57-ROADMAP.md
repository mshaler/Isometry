# Phase 57: Integrated Navigator + SuperGrid + Sliders Layout

## Overview

Implement the unified UI layout combining Navigator, SuperGrid, and density sliders based on Figma design.

## Prerequisites (COMPLETE)

- [x] Phase 56: SuperGrid PAFV Projection - Data flow wired
  - Navigator → PAFVContext → SuperGrid → GridRenderingEngine → 2D render
  - `mappingsToProjection()` converts axis mappings to projection config
  - SuperGrid receives and applies projection via `setProjection()`

## Current State

### Navigator (`?test=navigator`)
- LATCH buckets with expandable facets (Location, Alphabet, Time, Category, Hierarchy, Graph)
- Three plane drop zones: X, Y, COLOR
- Drag-and-drop facet assignment
- Current mappings display at bottom

### SuperGrid (`?test=supergrid`)
- Dropdown-based axis mapping (simplified UI)
- 2D grid rendering with column/row headers
- Cards positioned by facet values
- "Unassigned" bucket for null values

### Sliders (TO IMPLEMENT)
- Zoom slider: leaf values ↔ collapsed (Janus model)
- Pan slider: dense (populated only) ↔ sparse (full Cartesian)
- View/Region controls (future)

## Awaiting

**Figma Design** from user specifying:
1. Layout arrangement (sidebar? header? floating panels?)
2. Navigator position and size
3. SuperGrid viewport dimensions
4. Slider placement and style
5. Responsive behavior

## Implementation Plan (TBD after Figma)

Will be broken into plans (57-01, 57-02, etc.) once design is received.

Likely tasks:
- Create unified layout component
- Integrate Navigator into layout
- Integrate SuperGrid into layout
- Add Zoom/Pan sliders with Janus state binding
- Wire all components to shared PAFVContext
- Responsive/resize handling

## Files to Modify

Pending design, likely:
- `src/App.tsx` - New test route or main app integration
- `src/components/IntegratedLayout.tsx` - New unified layout
- `src/components/Navigator.tsx` - Possible adjustments
- `src/components/SuperGridDemo.tsx` or new component
- `src/components/DensitySliders.tsx` - New slider component

## Resume Command

To resume this work after Figma is ready:

```
/gsd:resume 57-integrated-navigator-supergrid
```

Or start fresh with:
```
Read .planning/phases/57-integrated-navigator-supergrid/57-ROADMAP.md and implement based on attached Figma design
```

## Context Links

- Phase 56 summary: `.planning/phases/56-supergrid-pafv-projection/56-VERIFICATION.md`
- Navigator component: `src/components/Navigator.tsx`
- SuperGrid: `src/d3/SuperGrid.ts`
- GridRenderingEngine: `src/d3/grid-rendering/GridRenderingEngine.ts`
- PAFV types: `src/types/grid.ts` (PAFVProjection, mappingsToProjection)

---

*Created: 2026-02-10*
*Status: AWAITING FIGMA DESIGN*
