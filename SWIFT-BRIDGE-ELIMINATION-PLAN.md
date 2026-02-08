# Swift Bridge Code Elimination Plan

**Analysis Date:** 2026-02-07
**Architecture Transition:** GRDB.swift → sql.js (WASM SQLite in browser)
**Goal:** Eliminate 40KB+ of JavaScript↔Swift bridge infrastructure

## Analysis Summary

The Isometry codebase currently contains extensive Swift bridge infrastructure that was designed to coordinate between React (JavaScript) and Swift/GRDB for database operations. With the transition to sql.js, this entire layer can be eliminated since SQLite now runs directly in the JavaScript runtime.

## Swift Code Categories

### 🗑️ ELIMINATE IMMEDIATELY - Bridge Infrastructure (40KB+)

These files implement the JavaScript↔Swift message bridge that is completely obsoleted by sql.js:

#### Core Bridge System
- `native/Sources/Isometry/Bridge/GraphMessageHandler.swift` (29KB)
- `native/Sources/Isometry/WebView/WebViewBridge.swift` (main coordinator)
- `native/Sources/Isometry/WebView/DatabaseMessageHandler.swift` (database operations)
- `native/Sources/Isometry/WebView/MessageHandlers.swift` (handler registry)

#### Specialized Message Handlers
- `native/Sources/Isometry/WebView/D3CanvasMessageHandler.swift`
- `native/Sources/Isometry/WebView/D3RenderingMessageHandler.swift`
- `native/Sources/Isometry/WebView/PAFVMessageHandler.swift`
- `native/Sources/Isometry/WebView/FilterBridgeHandler.swift`
- `native/Sources/Isometry/WebView/FileSystemMessageHandler.swift`
- `native/Sources/Isometry/WebView/CloudKitMessageHandler.swift`

#### Bridge Optimization Layer
- `native/Sources/Isometry/Bridge/Optimization/MessageBatcher.swift`
- `native/Sources/Isometry/Bridge/Optimization/BinarySerializer.swift`
- `native/Sources/Isometry/Bridge/Optimization/QueryPaginator.swift`
- `native/Sources/Isometry/Bridge/Monitoring/BridgeOptimizationMonitor.swift`

#### Real-Time Bridge Components
- `native/Sources/Isometry/Bridge/RealTime/LiveDataMessageHandler.swift`
- `native/Sources/Isometry/Bridge/RealTime/ChangeNotificationBridge.swift`
- `native/Sources/Isometry/Bridge/RealTime/RealTimeConflictResolver.swift`

#### Bridge Reliability
- `native/Sources/Isometry/Bridge/Reliability/CircuitBreaker.swift`
- `native/Sources/Isometry/Bridge/Transaction/TransactionBridge.swift`

#### Performance Monitoring (Bridge-Specific)
- `native/Sources/Isometry/Performance/BridgePerformanceMonitor.swift`
- `native/Sources/Isometry/WebView/SyncCoordinator.swift`

### 🗑️ ELIMINATE - GRDB Database Layer

All GRDB-based database operations are replaced by sql.js:

#### Core Database Infrastructure
- `native/Sources/Isometry/Database/IsometryDatabase.swift` (GRDB wrapper)
- `native/Sources/Isometry/Database/DatabaseOperations.swift`
- `native/Sources/Isometry/Database/DatabaseMigrator.swift`
- `native/Sources/Isometry/Database/DatabaseLifecycleManager.swift`
- `native/Sources/Isometry/Database/DatabaseVersionControl.swift`
- `native/Sources/Isometry/Database/TransactionCoordinator.swift`
- `native/Sources/Isometry/Database/RollbackManager.swift`
- `native/Sources/Isometry/Database/DatabaseError.swift`

#### Repository Pattern (Domain Layer)
- `native/Sources/IsometryCore/Infrastructure/SQLiteNodeRepository.swift`
- `native/Sources/IsometryCore/Infrastructure/SQLiteEdgeRepository.swift`
- `native/Sources/IsometryCore/Domain/Services/NodeService.swift`
- `native/Sources/IsometryCore/Domain/Services/GraphService.swift`
- `native/Sources/IsometryCore/Domain/Services/FilterService.swift`

#### Graph Query Components
- `native/Sources/Isometry/Graph/QueryCache.swift`
- `native/Sources/Isometry/Graph/ConnectionSuggestionEngine.swift`

### 🗑️ ELIMINATE - Legacy API Server

The Vapor-based API server duplicates sql.js functionality:

#### API Infrastructure
- `native/Sources/IsometryAPI/` (entire module)
- `native/Sources/IsometryAPIServer/main.swift`
- All Controllers, DTOs, Query translators

### ⚠️ DEFER - Platform-Specific Code

Keep for future Tauri desktop shell (Phase 4):

#### macOS Platform Integration
- `native/Sources/Isometry/Platform/macOS/WindowManager.swift` (window management)
- `native/Sources/Isometry/Platform/macOS/MenuBarIntegration.swift` (native menus)

#### iOS Platform Integration
- `native/Sources/Isometry/Platform/iOS/` (future mobile app)

#### File I/O & Storage
- `native/Sources/Isometry/Storage/AttachmentManager.swift` (file attachments)
- `native/Sources/Isometry/Storage/ContentAwareStorageManager.swift`
- `native/Sources/Isometry/Export/DatabaseExporter.swift` (base64 database export)

#### CloudKit Sync (Future iCloud Integration)
- `native/Sources/Isometry/Sync/CloudKitSyncManager.swift`
- `native/Sources/Isometry/Sync/CloudKitConflictResolver.swift`
- `native/Sources/Isometry/Sync/ConflictDetectionService.swift`
- `native/Sources/Isometry/WebView/CloudKitMessageHandler.swift`

### ⚠️ DEFER - SwiftUI Views

These may be useful for native companion apps:

#### Core UI
- `native/Sources/Isometry/Views/SuperGridView.swift` (SuperGrid prototype)
- `native/Sources/Isometry/Views/SuperGridViewModel.swift`
- `native/Sources/Isometry/Views/NodeListView.swift`

#### Notebook Views
- `native/Sources/Isometry/Views/Notebook/` (entire directory)

#### Settings & Configuration
- `native/Sources/Isometry/Views/Settings/`
- `native/Sources/Isometry/Views/macOS/MacOSSettingsView.swift`

### ⚠️ DEFER - Imports & ETL

These handle data import from external sources:

#### Import System
- `native/Sources/Isometry/Import/` (Apple Notes, SQLite, Office docs)
- `native/Sources/Isometry/ETL/` (ETL operations)

## Elimination Strategy

### Phase 1: Immediate Bridge Elimination

**Safe for deletion NOW** - These files have no dependencies in the sql.js architecture:

```bash
# Delete entire bridge infrastructure
rm -rf native/Sources/Isometry/Bridge/
rm -rf native/Sources/Isometry/WebView/

# Delete GRDB database layer
rm -rf native/Sources/Isometry/Database/
rm -rf native/Sources/IsometryCore/Infrastructure/
rm native/Sources/IsometryCore/Domain/Services/NodeService.swift
rm native/Sources/IsometryCore/Domain/Services/GraphService.swift
rm native/Sources/IsometryCore/Domain/Services/FilterService.swift

# Delete graph query components
rm -rf native/Sources/Isometry/Graph/

# Delete API server
rm -rf native/Sources/IsometryAPI/
rm -rf native/Sources/IsometryAPIServer/
```

**Estimated code reduction:** ~40,000 lines

### Phase 2: Package.swift Cleanup

Remove GRDB dependency and unused packages:

```swift
// Remove from dependencies array:
.package(url: "https://github.com/groue/GRDB.swift.git", from: "6.24.0"),
.package(url: "https://github.com/vapor/vapor.git", from: "4.89.0"),

// Update targets to remove GRDB references
```

### Phase 3: Import Cleanup

Search and remove imports in remaining files:

```bash
# Find remaining GRDB imports
grep -r "import GRDB" native/Sources/
grep -r "import Vapor" native/Sources/

# Remove bridge-related imports
grep -r "WebViewBridge\|MessageHandler\|GraphMessageHandler" native/Sources/
```

### Phase 4: Test Cleanup

Remove tests for eliminated components:

```bash
rm -rf native/Tests/IsometryTests/Views/SuperGrid/ # Bridge-dependent tests
# Keep structural tests that might be useful for future Swift components
```

## Safety Considerations

### ⚠️ DO NOT DELETE without Review:

1. **CloudKit Sync Code** - Needed for future iCloud sync
2. **File I/O Operations** - Required for database load/save
3. **Platform-Specific UI** - May be useful for desktop shell
4. **Import/ETL Systems** - Handle external data sources

### Dependency Analysis

**Safe to delete:** Any Swift code that:
- Implements WKScriptMessageHandler
- Imports GRDB
- Contains "Bridge" or "MessageHandler" in the name
- Lives in `/Bridge/` or `/WebView/` directories
- Implements database queries (now handled by sql.js)

**Keep for now:** Any Swift code that:
- Handles file system operations
- Manages CloudKit sync
- Provides platform-specific UI
- Handles data import from external sources

## Expected Benefits

### Code Reduction
- **~40,000 lines eliminated** (Bridge + GRDB layer)
- **~15 Swift files** in WebView directory
- **~20 Swift files** in Bridge directory
- **~10 Swift files** in Database directory
- **Entire IsometryAPI module** (~3,000 lines)

### Architecture Simplification
- **Direct sql.js queries** replace 40KB of bridge code
- **Synchronous database access** (no more async bridge messages)
- **Single-runtime execution** (JavaScript + WASM SQLite)
- **Eliminated serialization overhead** between Swift and JS

### Development Velocity
- **No bridge debugging** - all data operations in one runtime
- **Simpler dependency management** - fewer Swift packages
- **Faster builds** - less Swift code to compile
- **Easier testing** - unified JavaScript test environment

## Verification Checklist

Before deletion:
- [ ] Confirm no current web app features depend on Swift bridge
- [ ] Verify sql.js handles all database operations correctly
- [ ] Ensure D3.js can query sql.js directly (no bridge needed)
- [ ] Check that file I/O still works for database save/load
- [ ] Confirm CloudKit code is preserved for future use

After deletion:
- [ ] Swift package builds successfully
- [ ] Web app runs without bridge errors
- [ ] All D3 visualizations work with sql.js
- [ ] Database operations complete in single JavaScript runtime
- [ ] No references to deleted Swift classes remain

## Timeline

**Week 1:** Phase 1 bridge elimination (safe deletions)
**Week 2:** Package.swift cleanup and import removal
**Week 3:** Test cleanup and verification
**Week 4:** Documentation update and final verification

This elimination removes the complexity that made v3 challenging to maintain while preserving the Swift infrastructure needed for the future desktop shell and mobile companion apps.