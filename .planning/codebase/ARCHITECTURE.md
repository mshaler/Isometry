---
version: 1.0
last_updated: 2026-01-28
---

# Architecture

**Analysis Date:** 2026-01-28

## Pattern Overview

**Overall:** Hybrid web + native system with a local API bridge

**Key Characteristics:**
- React web client for UI/UX prototyping and interaction
- Native Swift core (data, models, and services)
- Local HTTP API server (Vapor) to bridge web UI to native SQLite
- Optional direct Claude API integrations in both web and native layers

## Layers

**Web UI Layer:**
- Purpose: User-facing UI, views, and interactions
- Contains: React components, pages, styles
- Location: `src/components/`, `src/pages/`, `src/styles/`
- Depends on: Hooks, state, and data providers
- Used by: Vite entry point (`src/main.tsx`, `src/App.tsx`)

**Web Data/Service Layer:**
- Purpose: Client-side data access, command routing, state
- Contains: DB contexts, hooks, services, utilities
- Location: `src/db/`, `src/hooks/`, `src/services/`, `src/state/`
- Depends on: Native API client, configuration
- Used by: Web UI components

**Bridge/API Layer:**
- Purpose: Provide database/API access for the web client
- Contains: Native API client and server launcher
- Location: `src/db/NativeAPIClient.ts`, `src/server/native-api-server.ts`, `src/server/launch-native-server.js`
- Depends on: Native Swift server (`IsometryAPIServer`)
- Used by: Database providers in `src/db/` and app startup scripts

**Native Core Layer:**
- Purpose: Domain models, database access, core services
- Contains: Swift models, database layer, configuration, security
- Location: `native/Sources/Isometry/`
- Depends on: GRDB, system frameworks
- Used by: Native app targets and API server

**Native API Server Layer:**
- Purpose: HTTP API exposing database operations
- Contains: Vapor routes and server lifecycle
- Location: `native/Sources/IsometryAPI/`, `native/Sources/IsometryAPIServer/`
- Depends on: Vapor, GRDB, IsometryCore/Isometry
- Used by: Web client bridge in development/runtime

## Data Flow

**Web UI → Native DB (HTTP bridge):**
1. User action in React UI (`src/components/*`)
2. Hook/Context dispatches data action (`src/db/*`, `src/hooks/*`)
3. Native API client issues HTTP request (`src/db/NativeAPIClient.ts`)
4. Swift Vapor server handles request (`native/Sources/IsometryAPI/routes.swift`)
5. GRDB executes SQLite queries (`native/Sources/Isometry/Database/`)
6. Response returned to web UI

**Web UI → Claude API:**
1. User command in terminal UI (`src/components/notebook/*`)
2. Command router invokes Claude client (`src/hooks/useCommandRouter.ts`, `src/hooks/useClaudeAPI.ts`)
3. API call to Anthropic (direct or proxy)
4. Response formatted and rendered in UI

**Native UI → Claude API:**
1. SwiftUI command handling (`native/Sources/Isometry/Views/Notebook/*`)
2. ClaudeAPIClient call (`native/Sources/Isometry/API/ClaudeAPIClient.swift`)
3. Response formatting and presentation

**State Management:**
- Web: React state + context providers (`src/state/`, `src/contexts/`, `src/context/`)
- Native: Swift structs/actors, GRDB persistence, and in-memory state

## Key Abstractions

**Database Provider:**
- Purpose: Abstracts database access across WebView/HTTP/native
- Examples: `src/db/DatabaseContext.tsx`, `src/db/NativeDatabaseContext.tsx`, `src/db/WebViewDatabaseContext.tsx`
- Pattern: Context-based provider with swap-in backends

**Command Routing:**
- Purpose: Routes terminal commands between system and Claude
- Examples: `src/hooks/useCommandRouter.ts`, `src/utils/commandParsing.ts`
- Pattern: Command parsing + handler dispatch

**API Server:**
- Purpose: REST bridge to SQLite operations
- Examples: `native/Sources/IsometryAPI/IsometryAPIServer.swift`, `native/Sources/IsometryAPI/routes.swift`
- Pattern: Vapor routes with DTO mapping (`native/Sources/IsometryAPI/Models/DTOs/*`)

## Entry Points

**Web App:**
- Location: `src/main.tsx`
- Triggers: Vite dev server or build output
- Responsibilities: React app bootstrapping

**Native API Server:**
- Location: `native/Sources/IsometryAPIServer/main.swift`
- Triggers: `swift run IsometryAPIServer` or `npm run start:native-api`
- Responsibilities: Launch Vapor server and bind routes

**Native Apps:**
- Locations: `native/IsometryApp/`, `ios/Sources/IsometryApp/`, `macos/Isometry/`
- Triggers: Xcode/SwiftPM app execution
- Responsibilities: Native UI and system integrations

## Error Handling

**Strategy:** Errors bubble to feature boundaries with typed error handling

**Patterns:**
- Web: try/catch around API calls and command execution (`src/hooks/useClaudeAPI.ts`)
- Native: Swift `throws` and error enums (`native/Sources/IsometryAPI/IsometryAPIServer.swift`)

## Cross-Cutting Concerns

**Logging:**
- Web: console logging for diagnostics
- Native: OSLog/Logger usage in Swift

**Validation:**
- Configuration validation in `src/config/environment.ts` and `native/Sources/Isometry/Configuration/`

**Security:**
- Claude API key validation in web and native
- Native sandbox validation utilities (`native/Sources/Isometry/Security/`)

---

*Architecture analysis: 2026-01-28*
*Update when major patterns change*
