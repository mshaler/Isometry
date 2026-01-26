# Codebase Structure

**Analysis Date:** 2026-01-25

## Directory Layout

```
Isometry/
├── src/                    # React web prototype
├── native/                 # Swift native apps (iOS/macOS)
├── docs/                   # Foam documentation system
├── .planning/              # GSD project management
├── scripts/                # Automation and sync scripts
├── design/                 # UI handoff and design assets
├── public/                 # Static web assets
└── dist/                   # Build output
```

## Directory Purposes

**src/**
- Purpose: React web application and development prototype
- Contains: Components, contexts, hooks, database clients, types
- Key files: `App.tsx`, `MVPDemo.tsx`, database contexts

**native/**
- Purpose: Production iOS and macOS applications
- Contains: Swift source code, resources, test suites
- Key files: SwiftUI views, database actors, sync managers

**native/Sources/Isometry/**
- Purpose: Main application module
- Contains: App logic, views, database, sync, import systems
- Key files: `App/IsometryApp.swift`, `Database/`, `Views/`

**native/Sources/IsometryCore/**
- Purpose: Core domain logic and protocols
- Contains: Shared entities, services, infrastructure abstractions
- Key files: Domain models, service protocols

**native/Sources/IsometryAPI/**
- Purpose: HTTP API server for React web integration
- Contains: Controllers, DTOs, API models
- Key files: Database controllers, model DTOs

**src/components/**
- Purpose: React UI components and widgets
- Contains: Views, UI primitives, demo components
- Key files: Canvas, navigation, sidebars, visualization components

**src/contexts/**
- Purpose: React state management and providers
- Contains: Global state contexts, theme management
- Key files: FilterContext, PAFVContext, AppStateContext

**src/db/**
- Purpose: Database abstraction and clients
- Contains: Environment-aware database providers
- Key files: DatabaseContext, NativeAPIClient, WebViewClient

**src/hooks/**
- Purpose: Custom React hooks and utilities
- Contains: Data fetching, D3 integration, UI utilities
- Key files: useSQLiteQuery, useD3, navigation hooks

**docs/**
- Purpose: Foam-based knowledge management
- Contains: Specifications, plans, decisions, notes
- Key files: Architecture docs, feature specs, Apple Notes import

**.planning/**
- Purpose: GSD project management and phase tracking
- Contains: Phase plans, codebase analysis, execution logs
- Key files: STATE.md, phase directories

**scripts/**
- Purpose: Development automation and data sync
- Contains: GitHub sync, Apple Notes import, setup scripts
- Key files: sync-github-issues.py, import-apple-notes.py

## Key File Locations

**Entry Points:**
- `src/App.tsx`: React application root with provider setup
- `src/MVPDemo.tsx`: Simplified entry point for MVP development
- `native/Sources/Isometry/App/IsometryApp.swift`: Native app entry point

**Configuration:**
- `package.json`: Node.js dependencies and scripts
- `native/Package.swift`: Swift package configuration
- `vite.config.ts`: React development server configuration
- `tsconfig.json`: TypeScript compiler settings

**Core Logic:**
- `src/contexts/`: React state management
- `src/db/DatabaseContext.tsx`: Environment-aware database provider
- `native/Sources/Isometry/Database/IsometryDatabase.swift`: Native database actor
- `native/Sources/Isometry/App/IsometryApp.swift`: Native app state management

**Testing:**
- `src/__tests__/`: React component and utility tests
- `src/**/__tests__/`: Co-located test files
- `native/Tests/IsometryTests/`: Native Swift test suites

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `Canvas.tsx`, `FilterContext.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useD3.ts`, `useEnvironment.ts`)
- Swift files: `PascalCase.swift` (e.g., `ContentView.swift`, `IsometryDatabase.swift`)
- Test files: `*.test.ts`, `*.test.tsx`, `*Tests.swift`

**Directories:**
- React: `kebab-case` or `camelCase` (e.g., `components/ui`, `d3/hooks`)
- Swift: `PascalCase` (e.g., `Sources/Isometry`, `Database/`)
- Documentation: `kebab-case` (e.g., `docs/specs`, `docs/decisions`)

**Variables:**
- React: `camelCase` for variables, `PascalCase` for components
- Swift: `camelCase` for properties, `PascalCase` for types
- Database: `snake_case` for SQL columns

## Where to Add New Code

**New React Component:**
- Primary code: `src/components/{category}/ComponentName.tsx`
- Tests: `src/components/{category}/__tests__/ComponentName.test.tsx`
- Export: Add to relevant index file or import directly

**New Context/Hook:**
- Context: `src/contexts/NameContext.tsx`
- Hook: `src/hooks/useName.ts`
- Tests: `src/hooks/__tests__/useName.test.ts`

**New Database Feature:**
- React client: `src/db/` (add to appropriate client)
- Native implementation: `native/Sources/Isometry/Database/`
- Migrations: Native database actor handles schema updates

**New Swift View:**
- Implementation: `native/Sources/Isometry/Views/{Category}/ViewName.swift`
- Platform-specific: `native/Sources/Isometry/Views/{iOS|macOS}/`

**New API Endpoint:**
- Controller: `native/Sources/IsometryAPI/Controllers/`
- Models: `native/Sources/IsometryAPI/Models/DTOs/`
- Client: `src/db/NativeAPIClient.ts` (add method)

**Utilities:**
- React: `src/utils/utility-name.ts`
- Swift: `native/Sources/Isometry/Utils/`
- Shared types: `src/types/` for TypeScript, `native/Sources/IsometryCore/Domain/` for Swift

## Special Directories

**.planning/codebase/**
- Purpose: Generated codebase analysis documents
- Generated: Yes (via GSD commands)
- Committed: Yes (for future reference)

**.planning/phases/**
- Purpose: Phase-specific implementation plans and logs
- Generated: Yes (via GSD workflow)
- Committed: Yes (tracks project progress)

**node_modules/**
- Purpose: NPM package dependencies
- Generated: Yes (via npm install)
- Committed: No (excluded by .gitignore)

**native/.build/**
- Purpose: Swift build artifacts and dependencies
- Generated: Yes (via Swift Package Manager)
- Committed: No (excluded by .gitignore)

**dist/**
- Purpose: React production build output
- Generated: Yes (via npm run build)
- Committed: No (excluded by .gitignore)

**docs/notes/**
- Purpose: Imported Apple Notes for knowledge management
- Generated: Yes (via sync scripts)
- Committed: Yes (source of truth for project documentation)

---

*Structure analysis: 2026-01-25*