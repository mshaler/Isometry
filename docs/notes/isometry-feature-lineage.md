# Isometry Feature Lineage

**Date:** 2026-01-23
**Source:** Git history, V1V2 port docs, architecture analysis
**Status:** Living document

---

## Overview

This document traces how features evolved across CardBoard V1/V2 → V3 → Isometry V4, showing what was kept, what was reimplemented, and what was discarded.

## Feature Evolution Map

### 1. SuperGrid / PAFV Grid View

**V1 (CardBoard):**
- Component: `SuperGrid.tsx` (React monorepo)
- Features:
  - Nested PAFV headers with visual spanning
  - Virtual scrolling for large datasets
  - Row/column resize with drag handles
  - Shift+drag bulk resize
  - MiniNav for quick navigation
- Tech: React components, custom virtual scroll
- Status: Complex, performance issues with >1000 cells

**V2 (CardBoard Refinement):**
- Enhanced virtual scrolling (better performance)
- Added header spanning overlays
- Improved resize UX with undo/redo
- Status: Still React-based, hitting React virtualization limits

**V3 (Boring Stack):**
- Component: `pafv-header.ts`, `virtual-grid-2d.ts` (Pure D3)
- Reimplemented as D3.js visualization (no React)
- Features ported:
  - ✅ Virtual scrolling (pure D3)
  - ✅ MiniNav basic implementation
  - 🚧 Header spanning (needed enhancement from V1/V2)
  - ❌ Shift+drag bulk resize (deferred)
  - ❌ Resize undo/redo (deferred)
- Tech: D3.js + SQLite
- Status: Functional core, missing V1/V2 polish

**V4 (Isometry):**

*React Prototype:*
- Component: `GridView.tsx` + D3 canvas (hybrid)
- Features:
  - ✅ Stacked/nested PAFV headers (React + D3 hybrid)
  - ✅ State management (PAFVContext)
  - ✅ Filter integration (LATCH → SQL WHERE)
  - 🚧 Canvas D3 rendering (in progress)
- Commit: `938bdce` (2026-01-16) - Stacked PAFV headers
- Status: Active development

*Native (Swift):*
- Not yet implemented (React prototype first)
- Planned: SwiftUI list + D3 rendering in WebView or native Canvas

**Lessons Learned:**
- React virtualization hits limits around 10k cells
- D3 handles larger datasets better (pure canvas rendering)
- Header spanning is critical for UX (worth the complexity)
- Resize undo/redo nice-to-have, not essential

---

### 2. DimensionNavigator / Axis Assignment

**V1 (CardBoard):**
- Component: `DimensionNavigator.tsx`
- Features:
  - Drag-drop axis assignment (L/A/T/C/H → x/y/z planes)
  - Visual preview of axis mappings
  - Undo/redo for axis changes
- Tech: React Beautiful DnD
- Status: Core feature, good UX

**V2 (CardBoard):**
- Same as V1, minor UX refinements

**V3 (Boring Stack):**
- Component: `axis-navigator.ts` (planned, not implemented)
- Features: Deferred to focus on core visualization
- Status: Missing from V3

**V4 (Isometry):**

*React Prototype:*
- Implemented via PAFVContext state management
- No drag-drop UI yet, axis assignment via code/settings
- Planned: Drag-drop UI similar to V1/V2
- Status: Backend ready, UI pending

*Native (Swift):*
- Not yet implemented
- Planned: Native SwiftUI drag-drop

**Status:** High-value feature deferred for MVP, will be ported from V1/V2

---

### 3. FilterNav / LATCH Filters

**V1 (CardBoard):**
- Component: `FilterNav.tsx` (accordion sidebar)
- Features:
  - Location filter (map-based)
  - Alphabet filter (A-Z search)
  - Time filter (date range picker)
  - Category filter (multi-select tags)
  - Hierarchy filter (priority sliders)
- Tech: React components
- Status: Functional but not connected to queries

**V2 (CardBoard):**
- Same as V1, better UX polish

**V3 (Boring Stack):**
- Component: `src/latch/` module
- Features:
  - ✅ LATCH filter → SQL WHERE clause compiler
  - ✅ Sort operations
  - ✅ Group by operations
- Tech: Pure TypeScript, compiles to SQL
- Status: Backend complete, no UI

**V4 (Isometry):**

*React Prototype:*
- Component: FilterContext + LATCH filter compiler
- Features:
  - ✅ Filter state management
  - ✅ LATCH → SQL WHERE compilation
  - 🚧 UI accordion (basic, needs V1/V2 UX)
- Commit: `3b12e36` (2026-01-16) - Wire LATCH filters
- Status: Backend complete, UI in progress

*Native (Swift):*
- Not yet implemented
- Planned: SwiftUI sidebar with filter controls

**Lessons Learned:**
- Separating filter logic from UI was smart (V3 decision)
- LATCH → SQL compiler is reusable across platforms
- V1/V2 filter UI was good, port it directly

---

### 4. Graph Analytics

**V1 (CardBoard):**
- Component: `graph-service.ts`
- Features:
  - Connection suggestions (based on shared tags/categories)
  - Query result caching
  - Path finding (A* algorithm in JS)
  - Centrality calculations (betweenness, closeness)
- Tech: Custom JS implementation
- Status: Slow for large graphs (>5k nodes)

**V2 (CardBoard):**
- Added Louvain clustering
- Improved caching strategy
- Still JS-based, still slow

**V3 (Boring Stack):**
- Component: `src/graph/` module
- Features:
  - ✅ Centrality algorithms (PageRank, betweenness)
  - ✅ Clustering (Louvain, label propagation)
  - ✅ Path finding via SQLite recursive CTEs
  - ✅ Query caching (planned)
- Tech: D3.js for algorithms, SQLite CTEs for traversal
- Status: Complete, faster than V1/V2

**V4 (Isometry):**

*React Prototype:*
- Uses V3 graph module directly
- SQLite CTEs for path finding
- D3 for PageRank, clustering
- Status: Backend ready, visualization pending

*Native (Swift):*
- Component: Native graph algorithms in Swift
- Features:
  - ✅ PageRank implementation in Swift
  - ✅ Dijkstra algorithm in Swift
  - ✅ SQLite recursive CTEs for traversal
- Commit: `3e0beb1` (2026-01-16) - PageRank and Dijkstra
- Status: Core algorithms implemented

**Lessons Learned:**
- SQLite recursive CTEs faster than JS graph traversal
- D3 algorithms (PageRank, clustering) reusable
- Native Swift implementations even faster
- Connection suggestions deferred (not essential for MVP)

---

### 5. Theme System

**V1/V2 (CardBoard):**
- Single theme, hardcoded colors
- No dark mode

**V3 (Boring Stack):**
- Minimal theming

**V4 (Isometry):**

*React Prototype:*
- Component: ThemeContext + CSS variables
- Features:
  - ✅ Dual themes: NeXTSTEP (retro) + Modern (glass)
  - ✅ Toggle via ThemeContext
  - ✅ CSS custom properties for design tokens
- Commit: `bc98095` (2026-01-16) - Theme utilities
- Status: Complete

*Native (Swift):*
- Not yet implemented
- Planned: SwiftUI Environment theming

**Status:** New feature in V4, not present in earlier versions

---

### 6. Data Import

**V1/V2 (CardBoard):**
- Manual JSON import only
- No native data source integrations

**V3 (Boring Stack):**
- JSON import
- CSV import (basic)

**V4 (Isometry):**

*Native (Swift):*
- Component: AltoIndexImporter actor
- Features:
  - ✅ Import from Apple Notes (alto-index format)
  - ✅ Parse 6,891 notes on first launch
  - ✅ Background import with progress tracking
- Commits:
  - `4800178` (2026-01-19) - Alto-index importer
  - `7d00384` (2026-01-19) - Auto-import on first launch
- Status: Complete, native-only feature

**Status:** Breakthrough feature in V4, enables "bring your own data" UX

---

### 7. Sync / Offline Support

**V1/V2 (CardBoard):**
- Component: ConflictResolutionService, OfflineSyncService
- Features:
  - Offline queue for edits
  - Conflict resolution (manual merge UI)
  - Custom sync backend
- Tech: IndexedDB + custom backend
- Status: Complex, brittle, never fully worked

**V3 (Boring Stack):**
- Deferred sync to future version
- Focus on local-only first

**V4 (Isometry):**

*Native (Swift):*
- Component: CloudKitSyncManager actor
- Features:
  - ✅ CloudKit custom zone
  - ✅ Change token tracking for incremental sync
  - ✅ Automatic offline queue
  - ✅ Exponential backoff on failures
  - ✅ Cross-device sync (iPhone ↔ iPad ↔ Mac)
- Commits:
  - `a55a77a` (2026-01-19) - CloudKit entitlements
  - `2655c56` (2026-01-19) - CloudKit container setup
- Decision: [[2025-01-19-cloudkit-over-firebase]]
- Status: Implemented, testing in progress

**Lessons Learned:**
- V1/V2 custom sync was over-engineered
- CloudKit "just works" with zero config
- Offline-first architecture (SQLite) makes sync simpler

---

## Feature Status Summary

| Feature | V1/V2 | V3 | V4 React | V4 Native | Status |
|---------|-------|----|-----------|-----------| -------|
| SuperGrid/PAFV Grid | ✅ | ✅ | 🚧 | ❌ | Porting to V4 |
| DimensionNavigator | ✅ | ❌ | 🚧 | ❌ | Deferred |
| FilterNav/LATCH | ✅ | ✅ | ✅ | ❌ | React complete |
| Graph Analytics | ✅ | ✅ | ✅ | ✅ | Native complete |
| Theme System | ❌ | ❌ | ✅ | ❌ | New in V4 |
| Data Import | ❌ | 🚧 | ❌ | ✅ | Native complete |
| Sync/Offline | 🚧 | ❌ | ❌ | ✅ | Native complete |

**Legend:**
- ✅ Complete
- 🚧 In progress
- ❌ Not implemented

---

## Discarded Features

These features existed in V1/V2 but were intentionally NOT ported:

1. **Shift+drag bulk resize** - Nice UX, not essential for MVP
2. **Resize undo/redo** - Complex state management, low value
3. **Connection suggestions** - Interesting but not core to PAFV model
4. **Custom sync backend** - Replaced by CloudKit (simpler, better UX)

---

## Related Documents

- [[isometry-evolution-timeline]] - Chronological version history
- [[V1V2-PORT-IMPLEMENTATION-PLAN]] - Detailed port plan from V1/V2 to V3
- [[cardboard-architecture-truth]] - PAFV + LATCH + GRAPH model (constant across versions)
- [[2024-12-01-boring-stack-over-graph-db]] - V3 architectural decision
- [[2025-01-16-native-apps-over-electron]] - V4 native decision
