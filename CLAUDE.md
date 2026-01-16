# Isometry - Claude Code Context

## Quick Start

### React Prototype (for rapid UI iteration)

```bash
npm install
npm run dev
```

### Native iOS/macOS (production target)

```bash
cd ios
open Package.swift  # Opens in Xcode
```

## Architecture
- **PAFV**: Planes → Axes → Facets → Values (spatial projection)
- **LATCH**: Location, Alphabet, Time, Category, Hierarchy (filtering)
- **GRAPH**: Links, Nesting, Sequence (connections)

## Tech Stack

### React Prototype

- React 18 + TypeScript
- D3.js for visualization
- sql.js (SQLite in browser) - dev only
- Tailwind CSS
- Vite

### Native Apps (iOS/macOS)

- Swift 5.9+ / SwiftUI
- GRDB.swift (SQLite wrapper)
- Native SQLite with FTS5, recursive CTEs
- CloudKit for sync

## Key Files

### React Prototype Files

- `src/types/` - All TypeScript interfaces
- `src/db/` - SQLite schema, init, context
- `src/hooks/` - useSQLiteQuery, useD3, etc.
- `src/state/` - FilterContext, PAFVContext, SelectionContext
- `src/views/` - GridView, ListView, ViewRenderer interface
- `src/filters/` - Filter compiler (LATCH → SQL)
- `docs/` - Architecture docs, gap analysis

### Native iOS/macOS Files

- `ios/Sources/Isometry/Database/` - IsometryDatabase actor, migrations
- `ios/Sources/Isometry/Models/` - Node, Edge, SyncState (Codable, Sendable)
- `ios/Sources/Isometry/Sync/` - CloudKitSyncManager actor
- `ios/Sources/Isometry/Views/` - SwiftUI views
- `ios/Sources/Isometry/Resources/schema.sql` - Full schema with FTS5

## Current Phase

Phase 2: Native Implementation

- [x] SQLite schema (React + Native)
- [x] Type definitions (TypeScript + Swift)
- [x] Database initialization
- [x] Sample data
- [x] Provider hierarchy
- [x] Native iOS project structure
- [x] Swift Actor database layer
- [x] Graph query CTEs
- [x] CloudKit sync manager
- [ ] macOS-specific UI adaptations
- [ ] Canvas D3 rendering (React)
- [ ] View switching (React)

## Important Docs
1. `docs/cardboard-architecture-truth.md` - Core concepts
2. `docs/ISOMETRY-MVP-GAP-ANALYSIS.md` - Full roadmap
3. `docs/INTEGRATION-CONTRACT.md` - How pieces connect
4. `design/isometry-ui-handoff/FIGMA-HANDOFF.md` - UI integration

## Coding Patterns
- Use `useSQLiteQuery` for data fetching
- Use `useD3` for D3 container management
- Use contexts for shared state
- Views implement `ViewRenderer` interface
- Filter changes trigger query recompilation

## Theme System
Two themes: NeXTSTEP (retro) and Modern (glass)
Toggle via ThemeContext, CSS variables in index.css
