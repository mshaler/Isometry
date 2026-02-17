# Isometry

**Domain:** Native knowledge management with hybrid PAFV+LATCH+GRAPH visualization
**Type:** Native iOS/macOS applications with React prototype bridge
**Timeline:** Production-ready native implementation

## Current Milestone: v6.9 Polymorphic Views & Foundation

**Goal:** Enable full Grid Continuum (Gallery/List/Kanban/Grid/SuperGrid) with CSS primitives, clean up technical debt, polish Network/Timeline views, and complete Three-Canvas notebook integration.

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
*Last updated: 2026-02-16 — Milestone v6.9 Polymorphic Views & Foundation started*
