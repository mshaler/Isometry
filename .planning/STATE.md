# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** Polymorphic data projection platform with PAFV spatial projection system
**Current focus:** v4.7 Schema-on-Read — Dynamic YAML property discovery

## Current Position

Phase: 64 of 65 (ETL Pipeline Upgrade)
Plan: 01 of 03 COMPLETE
Status: In progress
Last activity: 2026-02-12 — Completed 64-01-PLAN.md (Foundation Dependencies)

Progress (v4.7): [####################] 50% (4/8 requirements)

## Performance Metrics

**Previous Milestones:**
- v3.1: 18 plans, 7 phases, 3 days
- v4.1: 27 plans, 9 phases, 5 days
- v4.2: 12 plans, 4 phases, same day
- v4.3: 4 plans, 2 phases, same day
- v5.0: 3-wave parallel (bypassed phased plan), same day
- v4.4: 9 plans, 4 phases (56-59), same day
- v4.5: 3 plans, 1 phase (60), ~25 minutes
- v4.6: 1 plan, 1 phase (61), ~6 minutes (Phase 62 deferred)

**Recent completions (Phase 66 - parallel):**
- Phase 66-01: COMPLETE (~15m) — SuperGrid spreadsheet-like scroll behavior

**Recent completions (Phase 64):**
- Phase 64-01: COMPLETE (2m 34s) — gray-matter + yaml + SHA-256 source_id

**Previous (Phase 63):**
- Phase 63-01: COMPLETE (2m 27s) — EAV table + SQL injection fix

**Phase 62 (parallel execution):**
- Phase 62-01: COMPLETE (7m) — Density filtering in GridRenderingEngine

**Previous (Phase 61):**
- Phase 61-01: COMPLETE (6m 4s) — View Transitions with selection persistence

## Accumulated Context

### Decisions

**v4.7 Roadmap Structure:**
- ROADMAP-01: 3 phases derived from 8 requirements (SCHEMA, QUERY, ETL, FACET)
- ROADMAP-02: Phase 63 foundation (schema+query), Phase 64 ETL, Phase 65 UI surface
- ROADMAP-03: Dependency chain: 63 → 64 → 65 (table → parser → discovery)
- ROADMAP-04: v4.6 Phase 62 deferred to v4.8 (density filtering deprioritized)

**Phase 66-01 decisions (parallel - scroll fix):**
- SCROLL-01: CSS sticky positioning for headers (single scroll container)
- SCROLL-02: D3 zoom scale-only mode (translateExtent locked to 0,0)
- SCROLL-03: CSS native scroll handles all panning (panTo deprecated)
- SCROLL-04: Corner cell sticky at top+left with z-index: 3 for header intersection

**Phase 64-01 decisions:**
- YAML-01: Use yaml package as gray-matter engine for full YAML 1.2 spec support
- ID-01: SHA-256 truncated to 16 chars for human-readable collision-resistant IDs
- ID-02: Sort frontmatter keys before JSON stringification for key-order independence

**Phase 63-01 decisions:**
- SCHEMA-01: Use EAV table (node_properties) per roadmap spec rather than JSON column
- QUERY-01: Parameter binding via stmt.bind() before stmt.step() loop

**Phase 62-01 decisions:**
- DENS-IMPL-01: Level 1 = sparse (full Cartesian), Level 2+ = dense (populated-only)
- DENS-IMPL-02: Cartesian grid generates empty placeholders in sparse mode before filtering
- DENS-IMPL-03: Selection persistence inherits Phase 61 pattern (no changes needed)

**Phase 61-01 decisions:**
- TRANS-IMPL-01: Use transition interruption at render start to prevent animation buildup
- TRANS-IMPL-02: Nested headers use opacity fade-in only; repositioning deferred
- TRANS-IMPL-03: Selection styling applied in transition .on('end') callback

**Phase 60-03 decisions:**
- SORT-01: Sort state stored in PAFVContext for global access (not just D3)
- SORT-02: Three-state toggle cycle: asc -> desc -> null (clear)
- SORT-03: Sort not persisted to URL (sortConfig: null in serialization)

### What's Wired (Phase 61 COMPLETE)

```
Navigator -> PAFVContext -> SuperGrid -> GridRenderingEngine -> 2D render
    |           |            |              |
LATCH+Planes  mappings   projection    headers + positions
   +           +             +              +
Transpose   densityLevel  setDensityLevel  Janus zoom/pan
   +           +             +              +
Encoding   colorEncoding setColorEncoding  color scale -> card fill
Dropdowns  sizeEncoding  setSizeEncoding   size multiplier
   +           +
Sort       sortConfig    setSortBy
   +
LATCHSliders -> LATCHFilterService -> SuperGrid.query() -> filtered results
   +
Within-well -> getMappingsForPlane -> stacked axis support -> reorderMappingsInPlane
reorder       addMappingToPlane

Phase 60 Stacked Headers:
 AxisProjection.facets? -> StackedAxisConfig -> generateStackedHierarchy() -> HeaderHierarchy
  -> GridRenderingEngine.renderProjectionHeaders()
  -> renderStackedProjectionHeaders()
  -> SuperGridHeaders.renderStackedHeaders()
  -> HeaderProgressiveRenderer.renderMultiLevel()
  -> handleHeaderSortClick() with toggle cycle
  -> HeaderAnimationController.animateSortIndicator()

Phase 61 View Transitions:
GridRenderingEngine.render()
  -> interrupt() existing transitions
  -> renderProjectionHeaders() with .join() enter/update/exit
  -> renderNestedAxisHeaders() with opacity fade-in
  -> renderCards() with 300ms transitions
  -> .on('end') selection styling

SelectionContext -> SuperGrid.handleSelectionChange()
  -> renderingEngine.setSelectedIds()
  -> transitions preserve selection state

Phase 62 Density Filtering:
PAFVContext.densityLevel -> SuperGrid.setDensityLevel()
  -> constructDensityState(level)
  -> GridRenderingEngine.mapDensityLevelToExtent(level)
  -> renderingEngine.setDensityState(state)
  -> render() pipeline:
    -> prepareCardsForDensity() - generates Cartesian grid in sparse mode
    -> filterCardsByDensity() - removes empty cells in dense mode
    -> renderProjectionHeaders() - expands/contracts headers based on density
    -> renderCards() - filters visible cards with transitions
```

### v4.7 Requirements Coverage

**Total requirements:** 8
- SCHEMA-01: Store arbitrary YAML keys in node_properties -> Phase 63
- SCHEMA-02: Foreign key with cascade delete -> Phase 63
- QUERY-01: Use stmt.bind(params) instead of interpolation -> Phase 63
- ETL-01: Replace custom parser with yaml package -> Phase 64
- ETL-02: Preserve unknown keys to node_properties -> Phase 64
- ETL-03: Deterministic source_id generation -> Phase 64
- FACET-01: Query node_properties for dynamic facets -> Phase 65
- FACET-02: Dynamic properties in Navigator UI -> Phase 65

**Coverage:** 8/8 mapped (100%), 4/8 implemented (50%)
- [x] SCHEMA-01: node_properties table (Phase 63-01)
- [x] SCHEMA-02: Foreign key with cascade delete (Phase 63-01)
- [x] QUERY-01: stmt.bind(params) in execute() (Phase 63-01)
- [x] ETL-01: yaml package parser (Phase 64-01 - parseFrontmatter with gray-matter)
- [ ] ETL-02: Unknown keys to node_properties (Phase 64-02/03)
- [x] ETL-03: Deterministic source_id (Phase 64-01 - generateDeterministicSourceId)
- [ ] FACET-01: Query node_properties for facets (Phase 65)
- [ ] FACET-02: Dynamic properties in Navigator (Phase 65)

### Pending Todos

- [x] Phase 62: Density Filtering (COMPLETE - executed in parallel with 63)
- [x] Phase 63: Schema & Query Safety (COMPLETE)
- [~] Phase 64: YAML ETL Parser (IN PROGRESS - 64-01 complete, 64-02/03 remaining)
- [ ] Phase 65: Facet Discovery UI
- [ ] Knip unused exports cleanup (ratchet from 1000 down over time)
- [ ] Directory health: src/services (22/15 files)
- [ ] Nested header repositioning animation (deferred from 61-01)

### Blockers/Concerns

None — Phase 64-01 complete, ready for Phase 64-02.

## Session Continuity

Last session: 2026-02-12
Stopped at: Phase 64-01 complete, ready for Phase 64-02 (YAML Field Mapping)
Resume file: .planning/phases/64-etl-pipeline-upgrade/64-01-SUMMARY.md
