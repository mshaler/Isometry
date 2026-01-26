# Architecture

**Analysis Date:** 2026-01-25

## Pattern Overview

**Overall:** Hybrid Dual-Stack Architecture (React Web + Swift Native)

**Key Characteristics:**
- Cross-platform data synchronization between web prototype and native apps
- Context-driven state management with React providers
- Actor-based concurrent database operations in Swift
- Bridge-based communication between React and native environments
- MVP-focused simplification with production-ready native implementation

## Layers

**Presentation Layer:**
- Purpose: User interface and interaction handling
- Location: `src/components`, `native/Sources/Isometry/Views`
- Contains: React components, SwiftUI views, theme providers
- Depends on: State management contexts, database abstractions
- Used by: Application entry points, routing systems

**Application Layer:**
- Purpose: Business logic orchestration and state management
- Location: `src/contexts`, `src/hooks`, `native/Sources/Isometry/App`
- Contains: React contexts, custom hooks, Swift app state actors
- Depends on: Data layer, external services
- Used by: Presentation components

**Data Layer:**
- Purpose: Data persistence, querying, and synchronization
- Location: `src/db`, `native/Sources/Isometry/Database`
- Contains: Database clients, migration logic, sync managers
- Depends on: External database engines (SQLite, CloudKit)
- Used by: Application layer hooks and contexts

**Infrastructure Layer:**
- Purpose: Cross-platform communication and environment abstraction
- Location: `src/utils`, `native/Sources/Isometry/WebView`
- Contains: WebView bridges, API clients, performance monitors
- Depends on: Platform-specific APIs
- Used by: Data layer for environment-aware operations

**Domain Layer:**
- Purpose: Core business entities and shared protocols
- Location: `src/types`, `native/Sources/IsometryCore/Domain`
- Contains: TypeScript interfaces, Swift protocols, data models
- Depends on: Nothing (pure domain logic)
- Used by: All other layers

## Data Flow

**React Web Prototype Flow:**

1. User interacts with React components (`src/components`)
2. Components trigger context actions (`src/contexts`)
3. Contexts execute database operations via environment-aware providers (`src/db`)
4. Database providers route to appropriate backend (Native API, WebView Bridge, or Mock)
5. Results flow back through contexts to update component state

**Native App Flow:**

1. User interacts with SwiftUI views (`native/Sources/Isometry/Views`)
2. Views trigger AppState actions (`native/Sources/Isometry/App/IsometryApp.swift`)
3. AppState coordinates with IsometryDatabase actor (`native/Sources/Isometry/Database`)
4. Database operations execute with CloudKit sync via CloudKitSyncManager
5. State updates propagate to views through SwiftUI's @Published properties

**Cross-Platform Communication:**

1. React web app detects native environment via `useEnvironment` hook
2. WebView bridge enables bidirectional message passing (`src/utils/webview-bridge.ts`)
3. Native app handles messages through DatabaseMessageHandler (`native/Sources/Isometry/WebView`)
4. Shared data models ensure consistency between platforms

**State Management:**
- React: Context-based with URLState synchronization
- Swift: Actor-based with @Published ObservableObject pattern
- Cross-platform: Message-based state synchronization

## Key Abstractions

**Database Abstraction:**
- Purpose: Environment-agnostic data access
- Examples: `src/db/DatabaseContext.tsx`, `native/Sources/Isometry/Database/IsometryDatabase.swift`
- Pattern: Factory pattern with environment detection

**Filter System (LATCH):**
- Purpose: Multi-dimensional data filtering
- Examples: `src/filters/compiler.ts`, `src/contexts/FilterContext.tsx`
- Pattern: Compiler pattern converting DSL to SQL

**Visualization Pipeline (PAFV):**
- Purpose: Data projection to spatial coordinates
- Examples: `src/d3/hooks.ts`, `src/contexts/PAFVContext.tsx`
- Pattern: Pipeline pattern with D3.js integration

**Sync Management:**
- Purpose: Data consistency across devices and platforms
- Examples: `native/Sources/Isometry/Sync/CloudKitSyncManager.swift`, `src/utils/sync-manager.ts`
- Pattern: Observer pattern with conflict resolution

**Component Composition:**
- Purpose: Modular UI construction with theme support
- Examples: `src/components/ui`, `native/Sources/Isometry/Views`
- Pattern: Composition pattern with provider injection

## Entry Points

**React Web App:**
- Location: `src/App.tsx`
- Triggers: Browser navigation, development server
- Responsibilities: Provider setup, environment detection, MVP demo routing

**MVP Demo Mode:**
- Location: `src/MVPDemo.tsx`
- Triggers: Default app configuration
- Responsibilities: Simplified context setup, Canvas rendering with mock data

**Native iOS/macOS:**
- Location: `native/Sources/Isometry/App/IsometryApp.swift`
- Triggers: App launch, system events
- Responsibilities: Database initialization, CloudKit setup, auto-import

**Native API Server:**
- Location: `src/server/native-api-server.ts`
- Triggers: Development environment setup
- Responsibilities: Bridge React web app to native database via HTTP API

## Error Handling

**Strategy:** Layered error boundaries with environment-specific fallbacks

**Patterns:**
- React: ErrorBoundary components with user-friendly error displays
- Swift: Result types with async/await error propagation
- Cross-platform: Graceful degradation when native APIs unavailable
- Database: Transaction rollback with detailed error context

## Cross-Cutting Concerns

**Logging:** Console-based development logging with performance metrics via PerformanceMonitor
**Validation:** TypeScript/Swift type safety with runtime validation at API boundaries
**Authentication:** CloudKit-based identity with graceful anonymous fallback
**Performance:** Query performance monitoring, lazy loading, and actor-based concurrency
**Environment Detection:** Automatic fallback chain (Native → WebView → Mock) based on runtime capabilities

---

*Architecture analysis: 2026-01-25*