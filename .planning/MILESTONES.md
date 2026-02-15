# Project Milestones: Isometry

## v6.4 Hardcoded Values Cleanup (In Progress)

**Goal:** Eliminate or externalize hardcoded LATCH filter values (priority, status, folder options, etc.) to support true schema-on-read architecture.

**Phases planned:** 100-102 (3 phases, 22 requirements)
- Phase 100: Settings & Discovery Layer (8 requirements)
- Phase 101: UI Integration (8 requirements)
- Phase 102: Sample Data & Test Cleanup (6 requirements)

**What v6.4 Delivers:**
- Settings registry in SQLite for configuration values
- Dynamic facet value discovery from actual data
- UI components using discovery instead of hardcoded options
- Property classifier handling missing columns gracefully
- Clean sample data and test fixtures with minimal schema assumptions

**Hardcoded values to eliminate:**
- `sample-data.ts`: FACETS_SEED_SQL seeding status/priority facets
- `CardDetailModal.tsx`: Hardcoded folder/status options and colors
- `LATCHFilter.tsx`: Hardcoded priority range [1, 10]
- `property-classifier.ts`: Numeric defaults for priority/importance/sort_order
- `fixtures.ts`: TEST_FACETS/TEST_NODES with hardcoded status/priority values

**Reference:** MILESTONE-CONTEXT.md

**Started:** 2026-02-15
**Status:** Phase 100 awaiting plan execution

---

## v6.3 SuperStack SQL Integration (Shipped: 2026-02-15)

**Goal:** Connect SuperStack headers to live SQLite data via sql.js with query builders, React hooks, and integration tests.

**Phases completed:** 99 (single phase, 5 plans)

**Key accomplishments:**
- SQL query builders with json_each() and strftime() support
- Query utilities for facet chain creation and validation
- Integration tests with real sql.js database
- useSuperStackData React hook for data fetching
- Demo component with live data rendering

---

## v6.2 Capture Writing Surface (Shipped: 2026-02-14)

**Goal:** Transform Capture into world-class writing surface with Apple Notes fluency, Notion flexibility, Obsidian power, and Isometry-native embeds.

**Phases planned:** 94-98 (5 phases)
- Phase 94: Foundation & Critical Fixes (11 requirements)
- Phase 95: Data Layer & Backlinks (9 requirements)
- Phase 96: Block Types & Slash Commands (14 requirements)
- Phase 97: Inline Properties (4 requirements)
- Phase 98: Isometry Embeds & Polish (7 requirements)

**What v6.2 Delivers:**
- Apple Notes keyboard fluency (53 shortcuts)
- Notion-style slash commands (30+ commands)
- Obsidian power features (backlinks, templates, inline properties)
- Isometry-native live embeds (SuperGrid, Network, Timeline in notes)
- Critical fixes: Markdown serialization, XSS sanitization, memory cleanup

**Reference:** CAPTURE-ROADMAP.md, CAPTURE-REQUIREMENTS.md

**Created:** 2026-02-14
**Status:** Roadmap complete, awaiting `/gsd:plan-phase 94`

---

## v6.1 SuperStack Enhancement (In Progress)

**Goal:** Dramatically enhance SuperGrid via SuperStack—the nested hierarchical header system that transforms SuperGrid from a flat grid into a true dimensional pivot table.

**Phases planned:** 89-93 (5 phases)
- Phase 89: Static Headers Foundation (6 requirements)
- Phase 90: SQL Integration (5 requirements)
- Phase 91: Interactions (5 requirements)
- Phase 92: Data Cell Integration (4 requirements)
- Phase 93: Polish & Performance (5 requirements)

**What SuperStack Delivers:**
- Multi-level nested headers on both row and column axes
- Collapsible hierarchy with expand/collapse at any level
- Span calculation where parent headers span child headers visually
- Click-to-filter to drill down to header subsets
- Foundation for all SuperGrid interactions

**Reference:** Complete implementation specification in `superstack-implementation-plan.md`

**Started:** 2026-02-13

---

## v6.0 Interactive Shell (Deferred)

**Goal:** Complete Shell implementation with working Terminal, Claude AI, and GSD GUI tabs.

**Phases planned:** 85-88 (4 phases, 22 requirements)
**Status:** Roadmap created, not started
**Resume:** `/gsd:plan-phase 85`

---

## v5.2 Cards & Connections (Shipped: 2026-02-13)

**Delivered:** Migrated from nodes/edges to cards/connections with 4-type constraint

**Phase completed:** 84 (4 plans)

**Key accomplishments:**
- Schema migration from 12 node_types to 4 card_types (note, person, event, resource)
- Connections use lowercase labels (schema-on-read) instead of edge_type enum
- via_card_id enables bridge cards for rich relationship modeling
- Backup tables for rollback safety

---

## v5.1 Notebook Integration (Shipped: 2026-02-14)

**Delivered:** Integrated NotebookLayout into IntegratedLayout as a collapsible panel

**Phase completed:** 80 (2 plans)

**Key accomplishments:**
- Collapsible Notebook panel below Command Bar
- Context wiring with NotebookContext in IntegratedLayout tree
- Smooth expand/collapse animation with theme support

---

## v5.0 Type Safety Restoration (Shipped: 2026-02-10)

**Delivered:** Eliminated all TypeScript compilation errors, restored pre-commit hooks and CI quality gates

**Original plan:** 52-55 (4 phases, 12 plans)
**Actual execution:** 3-wave parallel agent strategy (bypassed phased plan)

**Error baseline:** 1,347 TypeScript errors across ~141 files

**Execution:**
- Wave 1 (8 agents by directory): 1,347 → 853 errors (494 eliminated)
- Wave 2 (6 agents targeting clusters): 853 → 339 errors (514 eliminated)
- Wave 3 (4 agents final cleanup): 339 → 0 errors

**Stats:**
- 140 files changed (2,938 insertions, 1,544 deletions)
- Single commit: `23de1fa5`
- Pre-commit hook: fully restored (5/5 checks passing)
- knip baseline: `--max-issues 1000` (pre-existing unused exports)

**Key decisions:**
- Parallel wave strategy over sequential phases — much faster for mechanical fixes
- Local interface extensions over global type changes — avoids cascading breaks
- knip ratchet at 1000 — tolerate pre-existing unused exports, clean up incrementally

**Unblocked:** Pre-commit hook, CI quality gates, future milestone development

---

## v4.1 SuperGrid Foundation (Shipped: 2026-02-10)

**Delivered:** Core SuperGrid polymorphic data projection system with bridge elimination, Janus density controls, and unified ViewEngine architecture

**Phases completed:** 34-42 (9 phases, 27 plans total)

**Key accomplishments:**

- Bridge Elimination Architecture achieving sql.js direct D3.js data binding with zero serialization overhead (eliminated 40KB MessageBridge)
- Janus Density Controls with orthogonal zoom (value density) and pan (extent density) and 300ms smooth animations
- Grid Continuum Views enabling seamless transitions between Grid, List, and Kanban projections with preserved selection state
- ViewEngine Architecture unifying "D3 renders, React controls" pattern with GridRenderer, ListRenderer, KanbanRenderer
- IndexedDB Persistence supporting large datasets (50MB+) with auto-save, quota monitoring, and pre-save checks
- PAFV Axis Switching enabling dynamic axis-to-plane remapping with real-time grid reorganization

**Stats:**

- 859 files modified (172,092 insertions, 36,956 deletions)
- 156,240 lines of TypeScript
- 9 phases, 27 plans
- 5 days from 2026-02-05 to ship

**Git range:** `feat(34-01)` -> `feat(42-03)`

**What's next:** Three-Canvas Notebook Integration (Capture, Shell, Preview) with Claude Code API integration

---

## v3.1 Live Database Integration (Shipped: 2026-02-01)

**Delivered:** Connected React frontend to native SQLite backend with real-time data synchronization and performance monitoring

**Phases completed:** 18-27 (7 phases, 18 plans total)

**Key accomplishments:**

- High-performance bridge infrastructure with MessagePack binary serialization achieving <16ms latency for 60fps UI responsiveness
- Real-time database synchronization using GRDB ValueObservation providing <100ms change notifications with event sequencing
- ACID transaction safety across React-native bridge boundaries with correlation IDs and automatic rollback capability
- Virtual scrolling optimization with TanStack Virtual integration and intelligent caching for large datasets
- Live query integration connecting useLiveQuery React hook to real-time database changes
- End-to-end application access with LiveDataProvider installed in main app providing full user access to live database features

**Stats:**

- 173 files created/modified (48,306 insertions, 890 deletions)
- 84,694 lines of TypeScript + Swift + Python
- 7 phases, 18 plans, ~150 tasks
- 3 days from start of Phase 18 to milestone completion

**Git range:** `feat(18-01)` -> `docs(27)`

**What's next:** Enhanced Apple Integration with live synchronization, real-time change detection, sophisticated conflict resolution, and seamless bidirectional sync with Apple Notes

---
