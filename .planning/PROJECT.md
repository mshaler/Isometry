# Isometry

**Domain:** Native knowledge management with hybrid PAFV+LATCH+GRAPH visualization
**Type:** Native iOS/macOS applications with React prototype bridge
**Timeline:** Production-ready native implementation

## Current Milestone: v6.9 Polymorphic Views & Foundation

**Goal:** Enable full Grid Continuum (Gallery/List/Kanban/Grid/SuperGrid) with CSS primitives, clean up technical debt, polish Network/Timeline views, and complete Three-Canvas notebook integration.

## Next Milestone: v7.0 Apple Notes Direct Sync

**Goal:** Replace alto-index.json intermediary with direct Apple Notes → sql.js synchronization, eliminating data integrity bugs (folder mapping errors, stale data, duplicates).

**Motivation:** Investigation of "phantom card" bug revealed alto-index.json has folder mapping errors — note "Under stress, Stacey channels mean Cindy" appears in `BairesDev/Operations` in alto-index but is actually in `Family/Stacey` in Apple Notes.

**Phase 117: Apple Notes SQLite Sync**
- **117-01**: ETL Module Integration — Integrate isometry-etl adapter ✅ COMPLETE
- **117-02**: NodeWriter Service — CanonicalNode → sql.js mapping with deduplication
- **117-03**: Sync Orchestration — Full/incremental sync with progress reporting
- **117-04**: UI + Migration — Sync button, auto-sync, deprecate alto-index

**Key Capabilities:**
- Direct SQLite access to NoteStore.sqlite (no intermediary files)
- Correct folder hierarchy via ZFOLDER + ZPARENT SQL joins
- Protobuf content extraction with markdown conversion
- Inline tag extraction from note text (#hashtags)
- Incremental sync via Core Data modification timestamps
- Live data — no more stale alto-index.json exports

**Technical Approach:**
- `better-sqlite3` for native Node.js SQLite access (read-only)
- Database: `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`
- Canonical format: CanonicalNode/CanonicalEdge with LATCH properties
- NEST edges for folder containment relationships
- Sync state persisted in Isometry settings table

**Verified:** Query confirms correct folder mapping:
```sql
SELECT n.ZTITLE1, f.ZTITLE2, pf.ZTITLE2 FROM ZICCLOUDSYNCINGOBJECT n ...
-- Result: "Under stress, Stacey channels mean Cindy" | "Stacey" | "Family"
-- ✅ Correct folder path: Family/Stacey
```

**Four Tracks:**

1. **Track A: View Continuum Integration** — Wire Gallery, List, Kanban modes to CSS Grid + PAFV axis allocation
2. **Track B: Technical Debt Sprint** — knip unused exports cleanup (275→<100), src/services directory health, TipTap test infrastructure
3. **Track C: Network/Timeline Polish** — SQL-driven data hooks, Preview tab integration, D3 force/timeline views
4. **Track D: Three-Canvas Notebook** — Full Capture+Shell+Preview experience per original spec

**Parallelization:** Tracks A+B run in parallel. Track C depends on A. Track D depends on C.

## Previous Milestones

### v6.8 CSS Primitives (SHIPPED 2026-02-16)
Three-tier CSS architecture (tokens → primitives → chrome) with design tokens, layout primitives for all view types, and chrome components (sticky headers, selection, scroll shadows, tooltips, sidebar, accordion, dialog).

### v6.7 CSS Grid Integration (SHIPPED 2026-02-16)
Bridge HeaderDiscoveryService (SuperStack) to SuperGridCSS with adapters and data hooks for live SQL-driven rendering.

### v6.6 CSS Grid SuperGrid (SHIPPED)
Replaced D3.js tabular rendering with React + CSS Grid for hierarchical header spanning. 84 unit tests, 4 themes.

### v6.5 Console Cleanup (SHIPPED)
Eliminated console errors and excessive debug logging. Clean browser console on page load.

### v6.4 Hardcoded Values Cleanup (SHIPPED)
SettingsService with CRUD, dynamic facet discovery, CardDetailModal with dynamic dropdowns, schema-flexible test fixtures.

### v6.3 SuperStack SQL Integration (SHIPPED)
Connected SuperStack headers to live SQLite via sql.js with query builders, React hooks, and integration tests.

### v6.2 Capture Writing Surface (SHIPPED)
World-class writing surface with Apple Notes fluency, Notion flexibility, Obsidian power, Isometry-native embeds.

### v6.1 SuperStack Enhancement (SHIPPED)
Nested hierarchical header system transforming SuperGrid into true dimensional pivot table.

### v6.0 Interactive Shell (SHIPPED)
Complete Shell implementation with Terminal, Claude AI, and GSD GUI tabs.

### v5.2 Cards & Connections (SHIPPED)
Schema migration from nodes/edges to cards/connections with 4-type constraint.

### v5.1 Notebook Integration (SHIPPED)
Collapsible NotebookLayout panel in IntegratedLayout with context wiring.

### v5.0 Type Safety Restoration (SHIPPED)
Eliminated all 1,347 TypeScript compilation errors. Pre-commit hook fully restored.

### v4.x Foundation Milestones (SHIPPED)
SuperGrid Foundation, Three-Canvas Notebook, Navigator Integration, PAFV Projection, Stacked Headers, Polish, Data Layer, Schema-on-Read.

## Core Value

Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

## Requirements

### Validated

(See MILESTONES.md for complete validated requirements from v3.1 through v6.8)

### Active

**Track A: View Continuum**
- [ ] Gallery mode rendering with CSS primitives (0-axis masonry)
- [ ] List mode rendering with CSS primitives (1-axis hierarchy)
- [ ] Kanban mode rendering with CSS primitives (1-facet columns)
- [ ] Grid Continuum mode switcher wired to CSS Grid views
- [ ] PAFV axis allocation for each continuum mode

**Track B: Technical Debt**
- [ ] knip unused exports reduced from 275 to <100
- [ ] src/services directory refactored (22→15 files)
- [ ] TipTap automated test infrastructure

**Track C: Network/Timeline**
- [ ] Network graph view with SQL-driven data hooks
- [ ] Timeline view with SQL-driven data hooks
- [ ] Preview tab integration for both views

**Track D: Three-Canvas**
- [ ] Full Capture + Shell + Preview integration
- [ ] Three-canvas layout with resize handles
- [ ] Cross-canvas data flow and selection sync

### Out of Scope

- Mobile/iOS port (desktop-first)
- Real-time collaboration (single-user focused)
- Advanced query builder UI (deferred)

## Context

**Current codebase state:** ~160,000 LOC TypeScript
**Tech stack:** React 18, sql.js (WASM), D3.js v7, TanStack Virtual, Tailwind CSS

**CSS Primitives delivered (v6.8):**
- `primitives-supergrid.css`, `primitives-kanban.css`, `primitives-timeline.css`, `primitives-gallery.css`
- Chrome components: sticky-headers, selection, scroll-shadows, tooltip, sidebar, accordion, dialog

**Grid Continuum infrastructure:**
- `GridContinuumController.ts` — 5-mode projection controller
- `ViewContinuum.ts` — D3 view orchestrator
- `GridContinuumSwitcher.tsx` — React mode switcher UI

**Technical debt:**
- knip: 275 unused exports (baseline ratchet at 1000)
- Directory health: src/services (22/15 files)
- TipTap: Manual test plan, needs automated infrastructure

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| CSS Grid for tabular views | Native spanning, no coordinate math | ✓ Good |
| D3.js for force/network | Force simulation requires D3 | ✓ Good |
| Parallel tracks A+B | Independent work streams | Pending |
| Track C after A | Views need CSS primitives wired | Pending |
| Track D after C | Canvas integration needs working views | Pending |

---
*Last updated: 2026-02-17 — v7.0 ETL Enrichment milestone planned*
