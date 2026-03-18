# Architecture

## Pattern

**Provider-based reactive architecture** with Worker thread isolation.

- No framework (React/Redux/etc.) — pure TypeScript + D3.js
- sql.js (WASM SQLite) is the system of record, running inside a Web Worker
- Main thread holds providers (state slices) + D3 views
- `WorkerBridge` provides async request/response messaging between main ↔ worker
- `StateCoordinator` batches cross-provider change notifications (setTimeout 16ms) so views receive ONE update per frame

## Layers

```
┌──────────────────────────────────────┐
│  Native Shell (Swift/WKWebView)      │  ← native/Isometry/
│  NativeBridge ↔ postMessage          │
├──────────────────────────────────────┤
│  UI Layer                            │  ← src/ui/, src/views/
│  WorkbenchShell, Explorers, Views    │
├──────────────────────────────────────┤
│  Provider Layer                      │  ← src/providers/
│  Filter, PAFV, Density, Selection,   │
│  Schema, State, Alias, Theme         │
├──────────────────────────────────────┤
│  Coordinator Layer                   │  ← src/providers/StateCoordinator.ts
│  Batches provider changes → views    │
├──────────────────────────────────────┤
│  Worker Bridge                       │  ← src/worker/WorkerBridge.ts
│  Async message protocol (req/res)    │
├──────────────────────────────────────┤
│  Worker Thread                       │  ← src/worker/
│  sql.js WASM DB, handlers, force sim │
├──────────────────────────────────────┤
│  ETL Pipeline                        │  ← src/etl/
│  Parsers, importers, exporters       │
└──────────────────────────────────────┘
```

## Data Flow

1. User interaction → Provider state change (e.g., `FilterProvider.setFilter()`)
2. Provider notifies subscribers via `queueMicrotask`
3. `StateCoordinator` batches notifications, fires after ~16ms
4. `ViewManager` receives coordinated update → calls `view.render()`
5. View builds SQL query via `QueryBuilder` → sends to `WorkerBridge`
6. Worker handler runs SQL on sql.js → returns result rows
7. View applies D3 data join with mandatory key function → updates DOM

## Key Abstractions

### IView Interface (`src/views/types.ts`)
All 9 views implement `IView`: `mount()`, `render()`, `destroy()`, `resize()`. ViewManager switches between them.

### Provider Pattern (`src/providers/`)
Each provider owns a single state slice with `subscribe(cb)` → `() => void` unsubscribe pattern. Providers don't know about each other — StateCoordinator is the sole cross-provider coordinator.

- `FilterProvider` — active column filters (SQL WHERE clauses)
- `PAFVProvider` — Plane/Axis/Field/Value projection mappings
- `DensityProvider` / `SuperDensityProvider` — cell density modes
- `SelectionProvider` — selected card IDs (Tier 3, never persisted)
- `SchemaProvider` — runtime PRAGMA table_info introspection with LATCH heuristic classification
- `StateManager` — persistence to `ui_state` table, state migration
- `AliasProvider` — display_name ↔ column mappings
- `ThemeProvider` — light/dark/system theme via CSS custom properties
- `SuperPositionProvider` — SuperGrid position state

### WorkerBridge Protocol (`src/worker/WorkerBridge.ts`)
Request/response messaging with typed message map. Each handler in `src/worker/handlers/` processes one message type. Force simulation runs in Worker via stop+tick loop (never on main thread).

### D3 Data Join
D3 `.data(rows, keyFn)` is the ONLY state management for DOM. Key function is mandatory on every `.data()` call (Decision D-003).

### Mutation System (`src/mutations/`)
`MutationManager` with undo/redo history stack. Each mutation has an inverse function (`src/mutations/inverses.ts`). `ActionToast` provides undo UI feedback.

## Entry Points

- **Web dev**: `src/main.ts` → Vite dev server via `index.html`
- **Native app**: `src/main.ts` → built with `vite.config.native.ts` → loaded by WKWebView
- **Worker**: `src/worker/worker.ts` → spawned by WorkerBridge
- **Library export**: `src/index.ts` → exports for programmatic use

## Native Shell (`native/Isometry/`)

Swift app using WKWebView to host the web runtime:
- `IsometryApp.swift` — @main entry, WKWebView warm-up
- `ContentView.swift` — SwiftUI view hosting WKWebView
- `BridgeManager.swift` — JS ↔ Swift postMessage bridge (6-message protocol)
- `NativeImportCoordinator.swift` — orchestrates native ETL (Notes, Reminders, Calendar)
- `DatabaseManager.swift` — Application Support storage, checkpoint management
- `SyncManager.swift` — CKSyncEngine actor for CloudKit sync
- `SubscriptionManager.swift` — StoreKit 2 subscriptions
- `FeatureGate.swift` — tier-based feature gating

## 9 Views

| View | File | D3 Pattern |
|------|------|-----------|
| List | `src/views/ListView.ts` | table rows via data join |
| Grid | `src/views/GridView.ts` | card grid via data join |
| Gallery | `src/views/GalleryView.ts` | HTML tiles (no D3 — tech debt) |
| Kanban | `src/views/KanbanView.ts` | columns + cards via nested join |
| Network | `src/views/NetworkView.ts` | force simulation (Worker) |
| Timeline | `src/views/TimelineView.ts` | temporal axis |
| Tree | `src/views/TreeView.ts` | d3.stratify + _children stash |
| Calendar | `src/views/CalendarView.ts` | month grid |
| SuperGrid | `src/views/SuperGrid.ts` | CSS Grid + virtual scrolling |
