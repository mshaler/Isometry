# Super* Features Catalog

**Purpose:** Comprehensive tracking of all SuperGrid Super* features for GSD planning and implementation.

**Status:** Captured from research - awaiting roadmap integration and phase planning.

---

## Core Super* Features (Foundation Requirements)

### Foundational Features
- **SuperGrayScale**: NeXTSTEP UI (Numbers-like appearance) with other color palettes to follow
- **SuperDensitySparsity**: User-configurable scaling for card stacking per cell (1 card vs multiple aggregated cards)
- **SuperPosition**: Card position tracking system for SuperGrid side of SuperJanus polymorphic view enablement
- **SuperCards**: Generated cards (SuperStack headers, SuperAudit overlays) vs standard Data Cards in cells

### Core Grid Features
- **SuperStack**: Child headers support parents progressively (3-level deep headers span correctly)
- **SuperDynamic**: Direct control over axis SuperCards across planes (transpose and beyond) with drag/hover visual cues
- **SuperSize**: Direct control over SuperCard header cell sizing (drag, shift-drag, universal sizing from lower right)
- **SuperZoom**: Upper left corner stays pinned (contrary to D3 default zoom behavior)
- **SuperSelect**: Z-axis aware Card and SuperCard selection (lasso needs z-context)

## Advanced Super* Features

### Calculation & Audit Features
- **SuperAudit**: Highlight calculated/enriched and CRUD values
- **SuperZ**: Property depth aware rich data type Card display (checkboxes, sliders, cell-based controls)
- **SuperFormat**: PAFV aware formatting of text, cells via D3 palettes
- **SuperCalc**: Category aware calculations (HyperFormula integration)

### Time & Data Features
- **SuperTime**: Smart time series data parsing, header builder, non-contiguous time selection
- **SuperReplay**: Hans Rösling-style (Gapminder) playback of card changes
- **SuperLink**: Every cell and Canvas has an x-callback-URL
- **SuperIntent**: Support for Apple Intelligence app intents

### Platform & Collaboration Features
- **SuperVersion**: Git-style version control (branch, merge, pull)
- **SuperTemplates**: Shared header sets and template support for building shareable views
- **SuperViz**: Context-aware visualizations following data-to-viz decision tree

### Navigation & Search Features
- **SuperSort**: PAFV aware sort by header
- **SuperFilter**: PAFV aware filter by header (Excel column auto-filter style)
- **SuperSearch**: PAFV aware faceted/tokenized search like HotNotes (fast fuzzy indexed search)
- **SuperActive**: Database segmentation by starred/VIP (⭐️ = hot/in-memory), active, archive

---

## Janus Density Model (4-Level System)

| Level | Name | Control | What It Does |
|-------|------|---------|-------------|
| 1 | Value Density | Zoom (Per-facet slider) | Collapse hierarchy: Jan,Feb,Mar → Q1 |
| 2 | Extent Density | Pan (Extent slider) | Hide/show empty rows and columns |
| 3 | View Density | View selector | Spreadsheet (1 card/row) ↔ Matrix (cards at intersections) |
| 4 | Region Density | Welding (Region config) | Mix sparse + dense columns on shared axis |

### Pan × Zoom Independence
Users can be:
- **Panned out (ultra-sparse extent) + zoomed in (leaf values)**: Jan, Feb, Mar with all empty cells
- **Panned in (populated only) + zoomed out (collapsed)**: Q1 with only populated data
- All four quadrants of Pan×Zoom are valid and useful

---

## Implementation Priority Phases

### Phase 34: Foundation Stabilization (Current)
**Foundation enablers:**
- SuperPosition: Basic coordinate tracking for all future features
- SuperDensitySparsity: Unified data structure supporting density spectrum

### Phase 35: PAFV Grid Core
**Core grid features:**
- SuperDynamic: Drag-and-drop axis repositioning
- SuperSize: Multi-card cell expansion with count badges
- SuperSelect: Z-axis aware selection system

### Phase 36: SuperGrid Headers
**Advanced grid features:**
- SuperStack: Nested PAFV headers with hierarchical spanning
- SuperZoom: Cartographic navigation with pinned upper-left anchor

### Phase 37: Grid Continuum
**View integration:**
- Grid Continuum: Seamless transitions between gallery, list, kanban, grid projections
- SuperViz: Context-aware visualizations

### Future Phases (Post-MVP)
**Platform & advanced features:**
- SuperCalc + SuperAudit: Formula bar with computed cell highlighting
- SuperTime + SuperReplay: Time series and animation capabilities
- SuperVersion + SuperTemplates: Collaboration and sharing
- SuperLink + SuperIntent: Platform integration
- SuperSearch + SuperFilter + SuperSort: Advanced data navigation

---

## Architecture Integration Notes

### D3.js Data Plane
- SuperPosition, SuperDensitySparsity, SuperStack live in D3.js
- Direct sql.js data binding with zero serialization
- All Super* rendering happens in D3.js layer

### React Control Chrome
- SuperDynamic, SuperSize, SuperCalc controls live in React
- Event delegation from D3.js to React for complex UI
- SuperAudit, SuperFilter UI panels in React chrome

### sql.js Foundation
- SuperActive: Database segmentation through sql.js queries
- SuperSearch: FTS5 full-text search integration
- SuperTime: Date/time parsing in SQL with recursive CTEs

---

## Success Criteria Per Feature

Each Super* feature needs:
1. **Foundation support** — Basic grid cells can accommodate the feature
2. **D3/React integration** — Clear boundary between data plane and control chrome
3. **PAFV awareness** — Works with axis mappings and view transitions
4. **Performance** — Maintains 60fps with 10k+ cards
5. **Janus compatibility** — Functions across all density levels

---

*Captured: 2026-02-05*
*Source: SuperGrid modules.md, REVISED-PHASE-DESCRIPTIONS.md, architectural research*
*Status: Ready for roadmap integration*