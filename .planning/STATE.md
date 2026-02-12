# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** Polymorphic data projection platform with PAFV spatial projection system
**Current focus:** v4.8 ETL Consolidation — Canonical schema and multi-format importers

## Current Position

Phase: 69 of 72 (File Importers)
Plan: 06 of 06 COMPLETE
Status: Phase 69 COMPLETE — All 6 file importers implemented
Last activity: 2026-02-12 — Completed Phase 69-06 (ExcelImporter)

Progress (v4.7): [##############################] 100% (8/8 requirements) ✅ MILESTONE COMPLETE
Progress (v4.8): [###############...............] 50% (3/6 phases)

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

**Recent completions (Phase 69 - v4.8 File Importers):**
- Phase 69-06: COMPLETE (~5m) — ExcelImporter with SheetJS multi-sheet support
- Phase 69-05: COMPLETE (~6m) — WordImporter with mammoth.js for DOCX to HTML
- Phase 69-04: COMPLETE (~6m) — HtmlImporter with native DOMParser
- Phase 69-03: COMPLETE (~7m) — CsvImporter with PapaParse RFC 4180 compliance
- Phase 69-02: COMPLETE (~4m) — JsonImporter with flexible LATCH mapping
- Phase 69-01: COMPLETE (~7m) — MarkdownImporter with gray-matter + marked HTML

**Recent completions (Phase 68 - v4.8 ETL Consolidation):**
- Phase 68-01: COMPLETE (~5m) — Import Coordinator with extension-based routing
- Phase 67-01: COMPLETE (~10m) — Canonical Node Schema with Zod validation

**Recent completions (Phase 65 - v4.7 Schema-on-Read - MILESTONE COMPLETE):**
- Phase 65-02: COMPLETE (~3m) — Dynamic property Navigator UI with visual distinction
- Phase 65-01: COMPLETE (~4m) — Dynamic property discovery with LATCH inference

**Recent completions (Phase 66 - parallel):**
- Phase 66-01: COMPLETE (~15m) — SuperGrid spreadsheet-like scroll behavior

**Recent completions (Phase 64):**
- Phase 64-02: COMPLETE (4m 26s) — Property storage + importer integration
- Phase 64-01: COMPLETE (2m 34s) — gray-matter + yaml + SHA-256 source_id

**Previous (Phase 63):**
- Phase 63-01: COMPLETE (2m 27s) — EAV table + SQL injection fix

**Phase 62 (parallel execution):**
- Phase 62-01: COMPLETE (7m) — Density filtering in GridRenderingEngine

**Previous (Phase 61):**
- Phase 61-01: COMPLETE (6m 4s) — View Transitions with selection persistence

## Accumulated Context

### Decisions

**Phase 69-01 decisions (MarkdownImporter):**
- MD-DEC-01: Tests use toMatch() for ISO dates due to gray-matter Date object parsing
- MD-DEC-02: Flexible key detection supports created/createdAt/created_at variations
- MD-DEC-03: Unknown frontmatter keys stored in properties with originalFormat marker

**Phase 69-06 decisions (ExcelImporter):**
- EXCEL-DEC-01: Sheet name used as folder for organizational hierarchy
- EXCEL-DEC-02: No fallback to arbitrary column values for name - use sheet+row number format

**Phase 69-03 decisions (CsvImporter):**
- CSV-DEC-01: Use PapaParse for RFC 4180 compliance (handles quoted fields, commas in values)
- CSV-DEC-02: Store raw row as JSON in content field for debugging
- CSV-DEC-03: Case-insensitive column header matching for flexibility
- CSV-DEC-04: Priority string mapping (high=5, medium=3, low=1)


**Phase 69-04 decisions (HtmlImporter):**
- HTML-DEC-01: Use native DOMParser (zero dependencies, jsdom in tests)
- HTML-DEC-02: Title fallback: <title> -> <h1> -> filename
- HTML-DEC-03: Meta tag mapping: description->summary, keywords->tags, author->properties
- HTML-DEC-04: Semantic content priority: <main> > <article> > <body>
- HTML-DEC-05: Preserve HTML formatting in content field (not strip tags)

**Phase 69-05 decisions (WordImporter):**
- WORD-DEC-01: Mock mammoth for unit tests (simpler than creating real DOCX)
- WORD-DEC-02: Extract title from first H1/H2/H3 heading with regex
- WORD-DEC-03: Store conversion warnings in properties.conversionWarnings
- WORD-DEC-04: Support both base64 and UTF-8 encoding via toBuffer()

**Phase 69-02 decisions (JsonImporter):**
- JSON-DEC-01: Use native JSON.parse (no dependencies)
- JSON-DEC-02: Array items map to multiple nodes with index-based sourceId
- JSON-DEC-03: Flexible key detection for LATCH (name/title/subject, created/createdAt/date, etc.)
- JSON-DEC-04: Priority string mapping (high=5, medium=3, low=1)

**Phase 68-01 decisions (Import Coordinator):**
- DEC-68-01: Extension-based format detection with path.extname() and lowercase normalization
- DEC-68-02: Sequential batch import (for-of loop) for simpler error handling vs parallelization
- DEC-68-03: Mandatory validation of all nodes with CanonicalNodeSchema.parse() in importFile()
- DEC-68-04: Template Method pattern for importers (parse → validate → transform pipeline)

**Phase 65-02 decisions (Dynamic Property Navigator UI):**
- UI-DEC-01: Sparkles icon for dynamic properties (visual distinction from schema-defined)
- UI-DEC-02: Dashed border styling for subtle differentiation
- UI-DEC-03: Node count badge shows data coverage (only when isDynamic && nodeCount > 0)
- UI-DEC-04: Theme-specific yellow tones (NeXTSTEP yellow-400, Modern yellow-500)

**Phase 65-01 decisions (Dynamic Property Discovery):**
- FACET-DEC-01: Node count threshold = 3 (properties in <3 nodes filtered out to reduce UI noise)
- FACET-DEC-02: LATCH inference priority: Time (date patterns) -> Location (address patterns) -> default Alphabet
- FACET-DEC-03: Collision handling adds "(custom)" suffix rather than skip/override schema facets
- FACET-DEC-04: sourceColumn format "node_properties.{key}" signals query builders to JOIN EAV table

**v4.8 ETL Consolidation (Phases 67-72):**
- Canonical schema + Zod validation + multi-format importers
- TypeScript-based file ETL, Swift for native frameworks
- 6 phases: Schema -> Coordinator -> Importers -> Integration -> Bridge -> Quality

**Phase 67-01 decisions (Canonical Schema):**
- SCHEMA-DEC-01: Used Zod 3.x (stable) for schema validation
- SCHEMA-DEC-02: Included gridX/gridY for SuperGrid positioning compatibility
- SCHEMA-DEC-03: Properties stored in EAV table (node_properties), not JSON column
- SCHEMA-DEC-04: Tags array converted to JSON string for SQL storage

**v4.7 Roadmap Structure:**
- ROADMAP-01: 3 phases derived from 8 requirements (SCHEMA, QUERY, ETL, FACET)
- ROADMAP-02: Phase 63 foundation (schema+query), Phase 64 ETL, Phase 65 UI surface
- ROADMAP-03: Dependency chain: 63 -> 64 -> 65 (table -> parser -> discovery)
- ROADMAP-04: v4.6 Phase 62 deferred to v4.8 (density filtering deprioritized)

**Phase 66-01 decisions (parallel - scroll fix):**
- SCROLL-01: CSS sticky positioning for headers (single scroll container)
- SCROLL-02: D3 zoom scale-only mode (translateExtent locked to 0,0)
- SCROLL-03: CSS native scroll handles all panning (panTo deprecated)
- SCROLL-04: Corner cell sticky at top+left with z-index: 3 for header intersection

**Phase 64-02 decisions:**
- STORE-01: Use KNOWN_KEYS set to distinguish schema-mapped vs unknown frontmatter keys
- STORE-02: JSON.stringify for complex values (arrays, objects) in node_properties
- STORE-03: Deterministic property ID format: prop-{nodeId}-{key}

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

### What's Wired (Phase 64-02 COMPLETE)

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

Phase 64 ETL Pipeline:
File.content -> parseAltoFile() -> parseFrontmatter() [gray-matter]
  -> mapToNodeRecord(parsed, filePath, rawFrontmatter)
  -> generateDeterministicSourceId(filePath, frontmatter, 'alto-index') [SHA-256]
  -> db.run(INSERT nodes)
  -> storeNodeProperties(db, nodeId, rawFrontmatter) [unknown keys -> EAV]

Phase 65 Schema-on-Read (COMPLETE):
node_properties table (EAV)
  -> discoverDynamicProperties() [nodeCount >= 3 threshold]
  -> inferLATCHBucket() [smart type routing]
  -> ClassifiedProperty[] with isDynamic=true & nodeCount
  -> usePropertyClassification()
  -> PafvNavigator.getAllLatchProperties()
  -> DraggablePropertyChip renders:
    - Sparkles icon (yellow-400/500)
    - Dashed border
    - Node count badge
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

**Coverage:** 8/8 mapped (100%), 8/8 implemented (100%) ✅ MILESTONE COMPLETE
- [x] SCHEMA-01: node_properties table (Phase 63-01)
- [x] SCHEMA-02: Foreign key with cascade delete (Phase 63-01)
- [x] QUERY-01: stmt.bind(params) in execute() (Phase 63-01)
- [x] ETL-01: yaml package parser (Phase 64-01 - parseFrontmatter with gray-matter)
- [x] ETL-02: Unknown keys to node_properties (Phase 64-02 - storeNodeProperties)
- [x] ETL-03: Deterministic source_id (Phase 64-01/02 - generateDeterministicSourceId wired)
- [x] FACET-01: Query node_properties for facets (Phase 65-01 - discoverDynamicProperties + inferLATCHBucket)
- [x] FACET-02: Dynamic properties in Navigator (Phase 65-02 - DraggablePropertyChip with sparkle icon, dashed border, node count badge)

### v4.8 Requirements Coverage

**Total phases:** 6 (Phases 67-72)
- Phase 67: Canonical Schema (SCHEMA-01, SCHEMA-02, SCHEMA-03)
- Phase 68: Import Coordinator (COORD-01, COORD-02, COORD-03)
- Phase 69: File Importers (IMP-01 through IMP-06)
- Phase 70: Integration (INT-01, INT-02, INT-03)
- Phase 71: Swift Bridge (BRIDGE-01, BRIDGE-02)
- Phase 72: Quality & Docs (QUAL-01, QUAL-02, QUAL-03)

**Coverage:** 3/6 phases complete (50%)
- [x] Phase 67: Canonical Schema — Zod validation, JSON Schema, SQL mapping
- [x] Phase 68: Import Coordinator — Extension-based routing, Template Method pattern, validation infrastructure
- [x] Phase 69: File Importers — 6 importers (MD, JSON, CSV, HTML, Word, Excel) with TDD

### Pending Todos

**v4.7 (Schema-on-Read): ✅ COMPLETE**
- [x] Phase 62: Density Filtering (COMPLETE - executed in parallel with 63)
- [x] Phase 63: Schema & Query Safety (COMPLETE)
- [x] Phase 64: YAML ETL Parser (COMPLETE - 2 plans, ~7 minutes)
- [x] Phase 65: Facet Discovery (COMPLETE - 2 plans, ~7 minutes total)

**v4.8 (ETL Consolidation):**
- [x] Phase 67: Canonical Schema (COMPLETE - ~10 minutes)
- [x] Phase 68: Import Coordinator (COMPLETE - ~5 minutes)
- [x] Phase 69: File Importers (COMPLETE - ~8 minutes parallel, 6 importers)
- [ ] Phase 70: Integration — next action
- [ ] Phase 71: Swift Bridge
- [ ] Phase 72: Quality & Docs

**Technical debt:**
- [ ] Knip unused exports cleanup (ratchet from 1000 down over time)
- [ ] Directory health: src/services (22/15 files)
- [ ] Nested header repositioning animation (deferred from 61-01)

### Blockers/Concerns

None — v4.7 milestone complete (Schema-on-Read). Phase 69 complete, ready for Phase 70 (Integration).

**v4.7 Milestone Achievement:**
Schema-on-read capability fully functional. Users can add arbitrary YAML frontmatter keys to markdown files, which are stored in node_properties EAV table and automatically discovered/classified into LATCH buckets with smart type inference. Dynamic properties surface in Navigator UI with sparkle icons, dashed borders, and node count badges for complete visual feedback loop.

## Session Continuity

Last session: 2026-02-12
Stopped at: Phase 69 COMPLETE — all 6 file importers implemented
Resume file: .planning/phases/69-file-importers/69-VERIFICATION.md
