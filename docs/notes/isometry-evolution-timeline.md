# Isometry Evolution Timeline

**Date:** 2026-01-23
**Source:** Git history, architecture docs, V1V2 port docs
**Status:** Living document

---

## Overview

Isometry (formerly CardBoard) has evolved through four major versions, each representing a fundamental architectural pivot. This timeline captures the evolution from complex React architecture → boring stack → native-first.

## Version History

### V1: CardBoard (Early 2024)

**Core Concept:** React-based polymorphic data visualization

**Tech Stack:**
- React + TypeScript
- Complex monorepo with packages
- Custom graph analytics
- Web-only

**Key Features:**
- SuperGrid (nested PAFV headers)
- DimensionNavigator (drag-drop axis assignment)
- Graph analytics (centrality, clustering)
- FilterNav accordion

**Lessons Learned:**
- React complexity tax for visualization
- Package architecture overhead
- Web-only limiting for mobile use
- Graph database unnecessary for use case

**Status:** Archived, features ported to V3

**References:**
- Source repo: `/Users/mshaler/Developer/Projects/CardBoard/`
- [[V1V2-PORT-IMPLEMENTATION-PLAN]] - Feature extraction plan

---

### V2: CardBoard Refinement (Mid 2024)

**Focus:** Performance optimization, UX improvements

**Changes from V1:**
- Virtual scrolling for large datasets
- Header spanning visual overlays
- Shift+drag bulk resize
- Connection suggestion engine
- Query result caching

**Tech Stack:** Same as V1 (React monorepo)

**Lessons Learned:**
- Optimizing React for visualization has diminishing returns
- D3 should own visualization, not React
- Need native apps for mobile experience
- Sync/offline support essential

**Status:** Archived, features ported to V3

**Key Conversations:**

- [[2025-09-13 - CardBoard.app UI CSS vs JavaScript]] - UI implementation approaches
- [[2025-09-16 - CardBoard app development strategy]] - Strategy planning
- [[2025-09-19 - CardBoard app development strategy]] - Strategy refinement

---

### V3: CardBoard "Boring Stack" (Late 2024 - Dec 2024)

**Philosophy Shift:** "The Boring Stack Wins"

**Key Decision:** [[2024-12-01-boring-stack-over-graph-db]]

**Tech Stack:**
- Pure D3.js (no React for visualization)
- SQLite + better-sqlite3
- TDD non-negotiable
- Conventional commits

**Architecture:**
- PAFV model formalized
- LATCH vs GRAPH duality defined
- SQLite recursive CTEs for graph queries
- No graph database needed

**Status:** Completed, evolved into Isometry V4

**Key Commits:**
- `315accd` (2026-01-16) - Phase 1-3 implementation with TDD
- `a59ebc2` (2026-01-16) - Phase 4-7: D3 visualizations, PAFV integration

**References:**

- [[cardboard-architecture-truth]] - PAFV + LATCH + GRAPH model
- [[V1V2-PORT-IMPLEMENTATION-PLAN]] - Port from V1/V2 to V3

**Key Conversations:**

- [[2025-10-24 - CardBoard project architecture review]] - Architecture assessment
- [[2025-10-30 - Maintaining data parity while iterating on D3.js UI]] - D3.js iteration
- [[2025-11-08 - D3 vs graph database for PageRank]] - Graph DB evaluation
- [[2025-11-11 - Organizing D3.js code with modules]] - D3.js organization
- [[2025-11-18 - CardBoard data model hierarchy definitions]] - Data model formalization
- [[2025-11-22 - Holistic systems thinking for CardBoard]] - Systems philosophy
- [[2025-11-26 - LLATCH FilterNav design framework]] - LATCH formalization
- [[2025-11-27 - Direct D3.js to SQLite architecture for CardBoardDB]] - SQLite decision
- [[2025-11-28 - D3.js CardCanvas architecture for UI components]] - Canvas architecture
- [[2025-12-05 - Porting D3.js to Swift]] - Swift migration planning
- [[2025-12-07 - Migrating CardBoardDB ETL from Python to D3.js]] - ETL migration
- [[2025-12-13 - Remapping LLATCH taxonomy concepts]] - LATCH refinement

---

### V4: Isometry Native-First (Jan 2026 - Present)

**Philosophy:** Native quality, web for rapid prototyping

**Key Decision:** [[2025-01-16-native-apps-over-electron]]

**Major Shift:** Renamed CardBoard → Isometry, dual implementation strategy

#### Native Apps (Production Target)

**Tech Stack:**
- Swift 5.9+ / SwiftUI
- GRDB.swift (SQLite wrapper)
- Native SQLite with FTS5, recursive CTEs
- CloudKit for sync (iOS 15+, macOS 12+)

**Architecture:**
- Swift Actor model for thread safety
- IsometryDatabase actor
- CloudKitSyncManager actor
- AltoIndexImporter actor (Apple Notes import)

**Key Features:**
- Full offline capability
- Cross-device sync (iPhone ↔ iPad ↔ Mac)
- FTS5 full-text search
- PageRank and Dijkstra algorithms in Swift
- Import 6,891+ notes from Apple Notes

**Status:** Active development

**Key Commits:**
- `ac8475e` (2026-01-16) - Native iOS/macOS SQLite with Swift actors
- `27371da` (2026-01-16) - macOS three-column navigation
- `cba2074` (2026-01-16) - Rename ios/ → native/
- `3e0beb1` (2026-01-16) - PageRank and Dijkstra algorithms
- `a55a77a` (2026-01-19) - CloudKit entitlements
- `4800178` (2026-01-19) - Alto-index Notes importer
- `7d00384` (2026-01-19) - Auto-import notes on first launch

#### React Prototype (Rapid UI Iteration)

**Tech Stack:**
- React 18 + TypeScript
- D3.js for visualization
- sql.js (SQLite in browser) - dev only
- Tailwind CSS + CSS variables
- Vite

**Purpose:** UI/UX experimentation without Xcode build cycles

**Architecture:**
- Provider hierarchy (Theme → Database → Filter → PAFV → Selection)
- ViewRenderer interface for view plugins
- LATCH filter compiler (LATCH → SQL WHERE)
- D3 hooks (useD3, useD3Zoom)

**Status:** Active, parallel to native

**Key Commits:**
- `3b12e36` (2026-01-16) - Wire state management, PAFV to Grid, LATCH filters
- `938bdce` (2026-01-16) - Stacked/nested PAFV headers (React+D3 hybrid)
- `d572128` (2026-01-16) - CardBoard D3 component integration
- `bc98095` (2026-01-16) - Theme utilities and D3 hooks

**Key Conversations:**

- [[2025-11-18 - Converting D3.js web view to iOS app]] - Web to iOS migration
- [[2025-12-10 - Managing Claude artifacts and project context]] - Context management

---

## Current State (2026-01-23)

**Completed:**
- ✅ SQLite schema (React + Native)
- ✅ Type definitions (TypeScript + Swift)
- ✅ Native iOS project structure
- ✅ Swift Actor database layer
- ✅ Graph query CTEs
- ✅ CloudKit sync manager
- ✅ macOS-specific UI
- ✅ Alto-index Notes importer (6,891 notes imported)
- ✅ React prototype with state management
- ✅ PAFV GridView implementation

**In Progress:**
- [ ] Canvas D3 rendering (React)
- [ ] View switching (React)
- [ ] Test CloudKit sync with developer account

**Next Phase:**
- D3 canvas visualization in React prototype
- View type implementations (Network, Timeline, Kanban)
- CloudKit production testing

---

## Key Architectural Decisions

1. [[2024-12-XX-boring-stack-over-graph-db]] - Why SQLite not Neo4j
2. [[2025-01-XX-native-apps-over-electron]] - Why Swift/SwiftUI
3. [[2025-01-XX-react-prototype-strategy]] - Why dual implementation
4. [[2025-01-XX-cloudkit-over-firebase]] - Why Apple ecosystem
5. [[2026-01-16-tdd-non-negotiable]] - Why tests before implementation

---

## Feature Lineage Map

See [[isometry-feature-lineage]] for detailed evolution of features across versions.

---

## References

- [[cardboard-architecture-truth]] - PAFV + LATCH + GRAPH model
- [[INTEGRATION-CONTRACT]] - React prototype architecture
- [[SQLITE-MIGRATION-PLAN]] - Native SQLite + CloudKit architecture
- [[ISOMETRY-MVP-GAP-ANALYSIS]] - Current roadmap
- [[V1V2-PORT-IMPLEMENTATION-PLAN]] - V1/V2 → V3 feature port
