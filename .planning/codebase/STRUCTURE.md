# Codebase Structure

**Analysis Date:** 2026-01-21

## Directory Layout

```
Isometry/
├── src/                    # React prototype source
│   ├── components/         # React UI components
│   ├── contexts/           # React Context providers
│   ├── d3/                 # D3.js visualization layer
│   ├── db/                 # Database (sql.js)
│   ├── dsl/                # Filter DSL (parser, compiler)
│   ├── filters/            # LATCH filter compiler
│   ├── hooks/              # Custom React hooks
│   ├── state/              # Additional state contexts
│   ├── styles/             # Theme definitions
│   ├── test/               # Test setup & utilities
│   └── types/              # TypeScript interfaces
├── native/                 # Swift Package (iOS/macOS)
│   ├── Sources/Isometry/   # Swift source code
│   │   ├── App/            # App entry, ContentView
│   │   ├── Database/       # IsometryDatabase actor
│   │   ├── Import/         # Data importers
│   │   ├── Models/         # Node, Edge, SyncState
│   │   ├── Sync/           # CloudKit sync manager
│   │   ├── Views/          # SwiftUI views
│   │   └── Resources/      # schema.sql, assets
│   └── Tests/              # Swift tests
├── ios/                    # iOS Xcode project
├── macos/                  # macOS Xcode project
├── docs/                   # Architecture documentation
├── design/                 # UI handoff files
└── .planning/              # Planning documents
```

## React Prototype Structure

### `src/types/` - Type Definitions
- `index.ts` - Barrel export
- `pafv.ts` - PAFV model (Facet, PAFVState, LATCHAxis)
- `filter.ts` - LATCH filters (FilterState, *Filter, CompiledQuery)
- `node.ts` - Node, Edge entities + rowToNode converter
- `view.ts` - ViewType, ViewRenderer interface, D3Container
- `lpg.ts` - Labeled Property Graph types

### `src/db/` - Database Layer
- `DatabaseContext.tsx` - Context + useDatabase() hook
- `init.ts` - initDatabase(), saveDatabase(), resetDatabase()
- `schema.sql` - SQLite DDL

### `src/contexts/` - State Providers
- `ThemeContext.tsx` - useTheme() (NeXTSTEP/Modern)
- `FilterContext.tsx` - useFilters() + compiledQuery
- `PAFVContext.tsx` - usePAFV() for axis assignments
- `AppStateContext.tsx` - useAppState() for current view

### `src/hooks/` - Custom Hooks
- `useSQLiteQuery.ts` - Generic SQL query with transform
- `useNodes.ts` - Convenience for node queries
- `useFilteredNodes.ts` - Filters + query combined
- `useD3.ts` - D3 container lifecycle
- `useComponentTheme.ts` - Theme-aware styling
- `useURLState.ts` - URL-based state persistence

### `src/d3/` - D3 Visualization
- `D3View.tsx` - Generic D3 wrapper component
- `factory.ts` - ViewRenderer factory
- `scales.ts` - D3 scale utilities
- `hooks.ts` - useD3Scales(), useD3DataBinding()
- `components/` - Card, Canvas components

### `src/components/` - UI Components
- `App.tsx` - Root with provider hierarchy
- `Canvas.tsx` - Main content, view selector
- `Toolbar.tsx` - Menu bar + actions
- `Navigator.tsx` - App/View/Dataset dropdowns
- `Sidebar.tsx` - LATCH filter UI
- `RightSidebar.tsx` - Formats + Settings
- `CommandBar.tsx` - DSL input
- `views/` - View implementations (Grid, List, Kanban, etc.)

## Native Structure

### `native/Sources/Isometry/App/`
- `IsometryApp.swift` - @main entry point
- `ContentView.swift` - Root SwiftUI view
- `AppState.swift` - ViewModel (@MainActor)

### `native/Sources/Isometry/Models/`
- `Node.swift` - Codable, Sendable, GRDB conformance
- `Edge.swift` - Relationship entity
- `SyncState.swift` - CloudKit sync tracking

### `native/Sources/Isometry/Database/`
- `IsometryDatabase.swift` - Thread-safe actor
- `DatabaseError.swift` - Custom error types
- Resources: `schema.sql` (full schema with FTS5)

### `native/Sources/Isometry/Sync/`
- `CloudKitSyncManager.swift` - Thread-safe sync actor

### `native/Sources/Isometry/Import/`
- `AltoIndexImporter.swift` - Apple Notes import

### `native/Sources/Isometry/Views/`
- `NodeListView.swift` - Master list
- `SyncStatusView.swift` - Sync status display
- macOS-specific views in subdirectory

## Key File Locations

### Entry Points
- `src/main.tsx` - React entry point
- `native/Sources/Isometry/App/IsometryApp.swift` - Native entry

### Configuration
- `package.json` - npm dependencies
- `tsconfig.json` - TypeScript config
- `vite.config.ts` - Build config
- `vitest.config.ts` - Test config
- `eslint.config.js` - Linting (ESLint v9)
- `tailwind.config.js` - Styling
- `native/Package.swift` - Swift dependencies

### Database Schemas
- `src/db/schema.sql` - React prototype schema
- `native/Sources/Isometry/Resources/schema.sql` - Native schema (with FTS5)

## Naming Conventions

### Files
- PascalCase.tsx: React components
- camelCase.ts: Utilities, hooks (prefixed with `use`)
- kebab-case.md: Documentation
- UPPERCASE.md: Important files (README, CLAUDE, CHANGELOG)

### Directories
- kebab-case for all directories
- Plural for collections: `components/`, `hooks/`, `views/`

### Special Patterns
- `*.test.ts` / `*.test.tsx`: Test files
- `index.ts`: Barrel exports

## Where to Add New Code

### New React Component
- Component: `src/components/{Name}.tsx`
- Tests: `src/components/{Name}.test.tsx`
- Types (if needed): `src/types/{name}.ts`

### New View Type
- Implementation: `src/components/views/{Name}View.tsx`
- Register in: `src/d3/factory.ts`
- Add to: ViewType enum in `src/types/view.ts`

### New Custom Hook
- Implementation: `src/hooks/use{Name}.ts`
- Tests: `src/hooks/use{Name}.test.ts`

### New Swift Feature
- Models: `native/Sources/Isometry/Models/`
- Database operations: `native/Sources/Isometry/Database/`
- Views: `native/Sources/Isometry/Views/`
- Tests: `native/Tests/IsometryTests/`

---

*Structure analysis: 2026-01-21*
*Update when directory structure changes*
