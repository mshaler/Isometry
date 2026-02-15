# Isometry

**Domain:** Native knowledge management with hybrid PAFV+LATCH+GRAPH visualization
**Type:** Native iOS/macOS applications with React prototype bridge
**Timeline:** Production-ready native implementation

## Previous Milestones

### v4.1 SuperGrid Foundation (SHIPPED)
Core SuperGrid polymorphic data projection system with bridge elimination, Janus density controls, and unified ViewEngine architecture.

### v4.2 Three-Canvas Notebook (SHIPPED)
Unified capture-shell-preview workspace with Shell, Preview, TipTap Editor, and Live Data Synchronization.

### v4.3 Navigator Integration (SHIPPED)
Property classification to Navigator UI with dynamic LATCH+GRAPH buckets and drag-and-drop facet-to-plane mapping.

### v5.0 Type Safety Restoration (SHIPPED)
Eliminated all 1,347 TypeScript compilation errors. Pre-commit hook fully restored. 140 files changed via 3-wave parallel agent strategy.

### v4.4 SuperGrid PAFV Projection (SHIPPED)
PAFV context integration, 2D cell positioning with _projectedRow/_projectedCol, dynamic header generation from unique facet values. Phases 56-59.

### v4.5 Stacked/Nested Headers (SHIPPED)
Multi-facet stacked axis support with d3.stratify hierarchy, multi-level header rendering, header click sorting with visual indicators. Phase 60.

### v4.6 SuperGrid Polish (SHIPPED)
D3 animated view transitions with selection persistence. Phases 61-62 complete.

### v5.1 Notebook Integration (SHIPPED)
Collapsible NotebookLayout panel in IntegratedLayout with context wiring. Phase 80 complete.

### v5.2 Cards & Connections (SHIPPED)
Schema migration from nodes/edges to cards/connections with 4-type constraint. Phase 84 complete.

## Current Milestone: v6.4 Hardcoded Values Cleanup

**Goal:** Eliminate or externalize hardcoded LATCH filter values (priority, status, folder options, etc.) to support true schema-on-read architecture.

**Problem:** Hardcoded LATCH filter values have crept into the codebase, violating schema-on-read principles where metadata should come from source data.

**Target changes:**
- **Settings Registry** — SQLite `settings` table for configuration key-value pairs
- **Discovery Queries** — Dynamic facet value discovery from actual data
- **UI Integration** — CardDetailModal, LATCHFilter use discovery over hardcoded values
- **Property Classifier** — Handle missing columns gracefully without assumptions
- **Test Fixtures** — Minimal schema assumptions, realistic test data

**Hardcoded values to eliminate:**
- `sample-data.ts`: FACETS_SEED_SQL seeding status/priority facets
- `CardDetailModal.tsx`: Hardcoded folder/status options and status colors
- `LATCHFilter.tsx`: Hardcoded priority range [1, 10]
- `property-classifier.ts`: Numeric defaults for priority/importance/sort_order
- `fixtures.ts`: TEST_FACETS/TEST_NODES with hardcoded status/priority values

**Reference:** `MILESTONE-CONTEXT.md`

## Previous Milestone: v6.3 SuperStack SQL Integration (COMPLETE)

**Goal:** Connect SuperStack headers to live SQLite data via sql.js with query builders, React hooks, and integration tests.

**Shipped:** 2026-02-15 (Phase 99, 5 plans)

## Previous Milestone: v6.2 Capture Writing Surface (COMPLETE)

**Goal:** Transform Capture into a world-class writing surface combining Apple Notes fluency, Notion flexibility, and Obsidian power — with Isometry-native view embeds.

**Shipped:** 2026-02-14 (17 plans across 5 phases)

## Previous Milestone: v6.1 SuperStack Enhancement (COMPLETE)

**Goal:** Dramatically enhance SuperGrid via SuperStack—the nested hierarchical header system that transforms SuperGrid from a flat grid into a true dimensional pivot table.

**Target features:**
- **Multi-level nested headers** on both row and column axes
- **Collapsible hierarchy** with expand/collapse at any level
- **Span calculation** where parent headers span child headers visually
- **Click-to-filter** to drill down to header subsets
- **PAFV integration** mapping Facets to Planes via header trees

**Implementation Phases:**
1. **Static Headers** — Type definitions, tree builder, D3.js renderer with correct spans
2. **SQL Integration** — Build headers from live SQLite queries (strftime, json_each)
3. **Interactions** — Collapse/expand, click-to-filter, keyboard navigation
4. **Data Cell Integration** — Connect headers to data cells, coordinate scroll
5. **Polish** — Virtual scrolling, sticky headers, accessibility, animations

**Reference Documents:**
- `superstack-implementation-plan.md` — Complete implementation specification
- `src/superstack/` — Implementation directory (being created)

## Previous Milestone: v6.0 Interactive Shell

**Goal:** Complete Shell implementation with working Terminal, Claude AI, and GSD GUI tabs.

**Target features:**
- **Terminal Tab**: Dual-mode execution (Claude Code subprocess + native shell) with toggle
- **Claude AI Tab**: Full MCP server protocol with resources, tools, and prompts
- **GSD GUI Tab**: Bidirectional sync with `.planning/` files (read + write)

**Reference Documents:**
- `src/components/notebook/ShellComponent.tsx` — Shell container with tabs
- `src/components/shell/Terminal.tsx` — xterm.js terminal component
- `src/components/gsd/GSDInterface.tsx` — GSD GUI component
- `src/services/claude-code/` — Claude Code services

## Previous Milestone: v5.0 SuperGrid MVP (COMPLETE)

**Goal:** Implemented critical SuperGrid features bringing MVP from 30% → 90% completion.

**Phases A/B/C + Polish:** All complete
- ✅ **SuperStack Multi-Level Headers** — Nested headers with visual spanning
- ✅ **SuperDensity Controls** — Value (GROUP BY) + Extent (empty cell filtering)
- ✅ **SuperZoom Upper-Left Anchor** — Pin zoom to top-left corner
- ✅ **Header Click Zones** — Zone-based hit testing and cursor feedback
- ✅ **SuperDynamic** — Drag-and-drop axis repositioning
- ✅ **SuperSize** — Cell & header resize with persistence
- ✅ **SuperSelect** — Multi-selection with lasso and range
- ✅ **SuperPosition** — PAFV coordinate tracking for view transitions
- ✅ **SuperFilter/Sort/Cards/Audit** — Phase C visual polish

## Previous Milestone: v4.9 Data Layer (COMPLETE)

**Goal:** Complete data layer features for production readiness.

**Delivered:**
- ✅ Versioning with auto-increment trigger
- ✅ URL deep linking with ?nodeId= parameter
- ✅ Filter state serialization to URL
- ✅ Catalog Browser with facet aggregates
- ✅ FilterBreadcrumb navigation

## Previous Milestone: v4.7 Schema-on-Read (COMPLETE)

**Goal:** Dynamic YAML property discovery and storage for true schema-on-read semantics.

**Delivered features:**
- Dynamic `node_properties` table for arbitrary YAML frontmatter storage
- Query parameter binding fix (sql.js `execute()` ignores params)
- Upgraded YAML parser (replace custom parser with `yaml` package)
- Dynamic facet discovery (surface YAML keys as Navigator facets)
- Deterministic ETL identity (harden `source_id` generation)

## Core Value

Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

## Problem Statement

Developers need a unified workspace that combines:
- Rapid note capture with structured card properties
- Terminal access with AI assistance (Claude Code)
- Universal content preview including visualizations
- Seamless data flow into existing knowledge graph systems

Current tools force context switching between separate applications, breaking flow state and fragmenting information.

## Solution Approach

Three-component React sidecar application:

1. **Capture**: Notion-style markdown editor with Isometry card properties, slash commands, and auto-save
2. **Shell**: Embedded terminal with Claude Code API integration and project context awareness
3. **Preview**: WKWebView browser with D3.js visualization support and universal content rendering

**Integration Strategy**: Extend existing Isometry React prototype architecture, sharing SQLite database, context providers, and TypeScript interfaces while maintaining component boundaries.

## Success Criteria

**Core Workflow Success:**
- User captures ideas as Isometry cards with zero friction
- Cards automatically appear in main Isometry application
- Terminal commands execute with full project context
- Visualizations render live during content creation
- Export workflows handle markdown, PDF, and data formats

**Integration Success:**
- Notebook cards participate in existing PAFV projections
- LATCH filters work across notebook and main application data
- GRAPH connections link notebook cards to existing knowledge
- Provider hierarchy remains consistent and performant
- TypeScript interfaces maintain type safety across components

**User Experience Success:**
- Single-window workflow without context switching
- Responsive layout adapts to different screen sizes
- Theme consistency with existing Isometry applications
- Performance maintains 60fps with 1000+ cards
- Data persistence survives application restarts

## Technical Constraints

**Architecture Constraints:**
- Must extend existing React prototype patterns
- Cannot break existing SQLite schema compatibility
- Must maintain provider hierarchy and hook patterns
- TypeScript strict mode compliance required

**Platform Constraints:**
- React 18+ for concurrent features
- Modern browsers (Safari 14+, Chrome 90+)
- macOS/iOS compatibility for WKWebView integration
- Node.js 18+ for development environment

**Integration Constraints:**
- SQLite database shared with main application
- Existing context providers must remain functional
- D3.js visualization engine compatibility required
- Claude Code API integration within usage limits

**Performance Constraints:**
- Component rendering under 16ms (60fps)
- SQLite queries under 100ms for real-time features
- Memory usage under 500MB for typical workloads
- Bundle size under 10MB compressed

## Non-Goals

- Complete IDE replacement (use existing tools)
- Real-time collaboration (single-user focused)
- Custom markdown parser (use proven libraries)
- Full browser engine (platform WKWebView only)
- Complex plugin architecture (fixed three-component design)
- Advanced terminal features (delegate to system terminal)

## Risk Assessment

**High Risk:**
- Claude Code API integration complexity and usage costs
- Terminal embedding security with project file access
- Three-component state synchronization without race conditions

**Medium Risk:**
- WKWebView integration across macOS/iOS platforms
- Performance optimization with large notebook collections
- SQLite schema evolution without breaking changes

**Low Risk:**
- Markdown editor integration (mature libraries available)
- React component architecture (established patterns)
- Theme and styling consistency (existing CSS variables)

## Requirements

### Validated

- Bridge message batching with <16ms latency for 60fps responsiveness - v3.1
- Binary serialization with 40-60% payload reduction via MessagePack - v3.1
- Query result pagination with maximum 50 records per message - v3.1
- Circuit breaker patterns for bridge reliability and failure recovery - v3.1
- Performance monitoring dashboard for real-time bridge operation metrics - v3.1
- Live query results using GRDB ValueObservation with <100ms change detection - v3.1
- Optimistic updates with rollback capability for failed operations - v3.1
- Real-time change notifications from native database to React components - v3.1
- Connection state awareness with offline/online operation modes - v3.1
- Change event correlation and sequencing to prevent race conditions - v3.1
- Bridge-level transaction control with ACID guarantees - v3.1
- Multi-operation transaction support across bridge boundaries - v3.1
- Conflict resolution framework for multi-device editing scenarios - v3.1
- Transaction rollback mechanisms with <50ms state cleanup - v3.1
- Operation correlation IDs for tracking and debugging - v3.1
- Virtual scrolling integration using TanStack Virtual for large datasets - v3.1
- Intelligent query result caching with TTL and invalidation strategies - v3.1
- Memory management patterns preventing cross-bridge reference cycles - v3.1
- Background sync queue with retry logic and exponential backoff - v3.1
- Bandwidth-aware sync optimization based on connection quality - v3.1
- LiveDataProvider installed in main application provider tree - v3.1
- Canvas component migrated from data props to SQL query API - v3.1
- Main application components connected to live database infrastructure - v3.1
- End-to-end live data flow verified and accessible to users - v3.1
- TypeScript compilation succeeding with live database integration - v3.1
- Basic grid cells with D3.js data binding using key functions - v4.1
- Row headers with LATCH dimension mapping - v4.1
- Column headers with LATCH mapping and visual hierarchy - v4.1
- Virtual scrolling for 10k+ cells maintaining 60fps - v4.1
- Keyboard navigation with visible cell selection - v4.1
- Column resizing with drag handles and state persistence - v4.1
- Header sorting with visual sort indicators - v4.1
- Nested PAFV headers with hierarchical spanning - v4.1
- Dynamic axis assignment via drag-drop wells - v4.1
- Grid continuum transitions (gallery/list/kanban/grid) - v4.1
- Janus density model with orthogonal zoom/pan controls - v4.1
- D3.js direct sql.js binding with zero serialization - v4.1
- Real-time LATCH reassignment between planes - v4.1
- Semantic position preservation during view transitions - v4.1
- Consistent PAFV context across all interactions - v4.1
- PAFVContext integration without breaking LATCH filtering - v4.1
- sql.js foundation maintaining bridge elimination architecture - v4.1
- TypeScript interface preservation and extension - v4.1
- D3.js visualization component compatibility - v4.1
- React context provider coordination - v4.1

### Active

- [x] SuperGrid consuming PAFV axis mappings from PAFVContext - v4.4
- [x] 2D cell positioning based on X-axis (column) and Y-axis (row) facet values - v4.4
- [x] Dynamic header generation from unique axis values - v4.4
- [x] D3 animated transitions when axis mappings change - v4.6
- [ ] Sparse/dense cell filtering based on density level - v4.6 (Phase 62 pending)
- [ ] Dynamic property storage for arbitrary YAML frontmatter keys
- [ ] Query parameter binding via stmt.bind() instead of string interpolation
- [ ] Full YAML parser with unknown key preservation
- [ ] Dynamic facet discovery from node_properties table
- [ ] Deterministic source_id generation with collision-free fallback

### Out of Scope

- Complex ORM layer - Direct SQL provides better performance and control
- Real-time everything - Selective real-time based on user interaction patterns prevents performance degradation
- Automatic conflict merging - Knowledge management requires user control over conflict resolution to preserve data integrity
- Advanced query builder UI - Defer complex query building to future milestones

## Context

**Current codebase state:** 156,240 LOC TypeScript
**Tech stack:** React 18, sql.js (WASM), D3.js v7, TanStack Virtual, IndexedDB (idb), Tailwind CSS

**User feedback themes:**
- SuperGrid provides excellent data density visualization
- View transitions between Grid/List/Kanban well-received
- IndexedDB persistence handles large datasets effectively

**Known issues / technical debt:**
- ~~1,347 TypeScript compilation errors~~ → 0 (v5.0 shipped)
- ~~Pre-commit hook bypassed~~ → Fully restored (5/5 checks passing)
- Directory health check failing for src/services (22/15 files)
- knip reports 275 unused files — baseline ratchet at 1000, needs cleanup

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| sql.js-fts5 over CDN sql.js | FTS5 support, local asset strategy | Good |
| TanStack Virtual for scrolling | Proven library, 10k+ cell performance | Good |
| Unified CellData structure | Morphing consistency across density levels | Good |
| Separate zoom/pan controls | Simpler UX than combined widget | Good |
| Fixed upper-left anchor | Predictable cartographic navigation | Good |
| ViewEngine architecture | Unified D3 rendering, eliminated dual paths | Good |
| idb over raw IndexedDB | Promise-based access, better DX | Good |
| Bridge elimination via sql.js | Zero serialization, 40KB code removal | Good |

## Dependencies

**External:**
- Claude Code API access and usage quotas
- React ecosystem stability (18.2+)
- SQLite compatibility with browser environment

**Internal:**
- Existing Isometry React prototype codebase
- Established provider hierarchy and context patterns
- SQLite schema and TypeScript interface definitions
- D3.js visualization components and themes

---
*Last updated: 2026-02-15 — Milestone v6.4 Hardcoded Values Cleanup started*
