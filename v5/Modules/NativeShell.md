# Isometry v5 Native Shell Specification

## Overview

The Native Shell is the thin host container that runs on Apple platforms (macOS and iOS). Its sole purpose is to provide native system integration while keeping all product logic inside the WebView.

**Guiding constraint:** As much TypeScript/JavaScript as possible, as little Swift/SwiftUI as possible.

## Distribution Variants

Native Shell supports two variants for macOS, iOS, and Android hosts, which enable a tiered distribution strategy differentiated by platform delivery:

| Variant | Target | Data Format | Features | Platform |
|---------|--------|-------------|----------|----------|
| **Designer Workbench** | Power users, builders | SQLite | Full ETL, all views, app composition | macOS primary |
| **Isometry Apps** | End users, doers | JSON file | Lightweight, single-purpose apps | iOS/Android |

### Variant 1: SQLite (Designer Workbench)
- Full-featured workbench for building Isometry apps
- Complete ETL/DB capabilities
- All 9 view types
- Interface Builder for app composition
- Targeted at sophisticated users at higher value

### Variant 2: JSON File (Lightweight Apps)
- Simple distribution mechanism for published Isometry apps
- JS/JSON only with thin reusable SwiftUI shell
- Targeted for iOS/Android end users
- Lower cost, drives awareness/demand generation
- Does one thing well

### Migration Path: JSON → SQLite
- iOS app users can migrate from JSON to SQLite when upgrading to Designer Workbench
- Import process syncs JSON payload to SQLite schema
- Preserves all cards, connections, and layout metadata

## Architecture: The Boundary

```
┌─────────────────────────────────────────────────────────┐
│  Native Shell (Swift/SwiftUI)                           │
│  ─────────────────────────────────────────────────────  │
│  • WKWebView container and lifecycle                    │
│  • CloudKit sync (file-level mirroring)                 │
│  • File system access (read/write isometry.db)          │
│  • Push notification handling (CloudKit change tokens)  │
│  • App lifecycle (background/foreground, iCloud status) │
│  • Native windowing and menus                           │
├─────────────────────────────────────────────────────────┤
│                    Bridge Contract                       │
│            WKScriptMessageHandler (narrow)              │
│  ─────────────────────────────────────────────────────  │
│  • On launch: Swift passes path to isometry.db          │
│  • All reads/writes go through sql.js in Worker         │
│  • Swift never touches data directly                    │
│  • Swift syncs the file that JavaScript owns            │
├─────────────────────────────────────────────────────────┤
│  WebView Runtime (D3.js + sql.js)                       │
│  ─────────────────────────────────────────────────────  │
│  • sql.js (WASM SQLite) in Web Worker                   │
│  • All SQL schema, queries, mutations                   │
│  • D3.js rendering pipeline                             │
│  • Observable layout store                              │
│  • PAFV/LATCH/GRAPH projection engine                   │
│  • DSL → AST → SQL compilation                          │
│  • All interaction logic                                │
└─────────────────────────────────────────────────────────┘
```

## What Lives in Swift (and only Swift)

| Responsibility | Why Native |
|----------------|------------|
| WKWebView container | Platform requirement |
| CloudKit sync | Apple API, no JS equivalent |
| File system access | Sandboxed, platform-specific |
| Push notifications | System integration |
| App lifecycle | OS-level events |
| Native menus | Platform UX expectations |
| Share sheets | System integration |

## What Lives in JavaScript (everything else)

| Component | Technology |
|-----------|------------|
| Query engine | sql.js (WASM SQLite) in Web Worker |
| Schema & queries | All SQL lives in JS |
| Rendering | D3.js (all views, all transitions) |
| State | Observable layout store |
| Projection | PAFV/LATCH/GRAPH engine |
| DSL | Parser, AST, SQL compiler |
| Interaction | Hit-testing, drag-and-drop, selection |

## The Bridge Contract

The bridge is intentionally minimal:

```typescript
// Swift → JavaScript (on launch)
interface LaunchPayload {
  dbPath: string;           // Path to isometry.db
  iCloudAvailable: boolean; // Account status
  initialViewport: Rect;    // Window dimensions
}

// JavaScript → Swift (on checkpoint)
interface CheckpointRequest {
  flushDatabase: boolean;   // Trigger file write
  syncNow: boolean;         // Trigger CloudKit push
}

// Swift → JavaScript (on sync)
interface SyncNotification {
  changeToken: string;      // CloudKit change token
  conflictResolution: 'local' | 'remote' | 'merge';
}
```

**Rule:** Swift never queries or mutates data directly. It only:
1. Passes the database file path on launch
2. Flushes the file to disk on checkpoint
3. Syncs the file to CloudKit
4. Notifies JavaScript of sync events

## sql.js vs Native SQLite

| Aspect | sql.js (in WebView) | Native SQLite |
|--------|---------------------|---------------|
| Runtime | WASM in JavaScript | Swift/C |
| Schema | Same (FTS5, recursive CTEs, WAL) | Same |
| Data access | Direct, synchronous | Would require bridge |
| Memory model | Database loaded in WASM memory | Native file handles |
| File sync | Swift loads/saves ArrayBuffer | Swift owns file |

**Why sql.js:** Eliminates the 40KB MessageBridge code that serialized every query across Swift↔JavaScript boundary. With sql.js, D3.js queries SQLite directly in the same memory space.

**The handoff:** Swift loads `isometry.db` into memory as ArrayBuffer, passes to WebView. JavaScript owns all reads/writes. On checkpoint, JavaScript returns the ArrayBuffer for Swift to persist.

## CloudKit Sync Strategy

### V1: File-Level Sync
- CloudKit mirrors the SQLite file (not record-by-record)
- Uses `CKRecord` with file attachment for `isometry.db`
- Change tokens track sync state

### Conflict Resolution
| Data Type | Strategy |
|-----------|----------|
| Layout metadata | Last-writer-wins |
| Cards/entities | Row-level merge on `id` + `modified_at` |
| Connections | Union merge (additive) |

### Sync Flow
```
Local change → SQLite mutation → Checkpoint → CloudKit push
                                              ↓
CloudKit notification → Pull → Merge → SQLite reload → D3 re-render
```

## Undo/Redo Architecture

Undo lives in SQLite, not in a separate log:

```sql
-- Every mutation wraps in a named savepoint
SAVEPOINT mutation_12345;
UPDATE cards SET status = 'done' WHERE id = ?;
-- Savepoint name stored in undo stack

-- Undo is rollback
ROLLBACK TO SAVEPOINT mutation_12345;

-- Redo is re-execution
RELEASE SAVEPOINT mutation_12345;
-- Re-run the saved mutation
```

**Benefits:**
- No separate undo log
- No client-side state diffing
- Deterministic: database state IS undo state

## Platform-Specific Considerations

### macOS
- Multi-window support via `NSWindowController`
- Native menu bar integration
- Keyboard shortcuts mapped to DSL commands
- Drag-and-drop from Finder

### iOS
- Single-window, tab-based navigation
- Share sheet integration for import
- Files app integration via Document Provider
- Background sync with CloudKit

### Android (V2)
- Kotlin equivalent of Swift shell
- Same thin-host architecture
- Local storage with backup sync

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold launch | < 2s | Time to first render |
| Database load | < 500ms | ArrayBuffer → sql.js init |
| Sync latency | < 1s | Local change → CloudKit push |
| Memory footprint | < 100MB | Typical 10K card dataset |

## Implementation Checklist

### Phase 1: Core Shell
- [ ] WKWebView container with sql.js loader
- [ ] Database file load/save bridge
- [ ] Basic app lifecycle handling
- [ ] Window/viewport management

### Phase 2: CloudKit Integration
- [ ] IsometryZone container setup
- [ ] File-level sync with change tokens
- [ ] Conflict detection and resolution
- [ ] Push notification for sync events

### Phase 3: Platform Polish
- [ ] Native menu integration (macOS)
- [ ] Share sheet import (iOS)
- [ ] Keyboard shortcut mapping
- [ ] Files app integration (iOS)

### Phase 4: JSON Variant
- [ ] Lightweight JSON loader
- [ ] JSON → SQLite migration tool
- [ ] Reusable app shell template

## Test Strategy

| Test Type | Scope | Tool |
|-----------|-------|------|
| Unit | Bridge message parsing | XCTest |
| Integration | Database load/save cycle | XCTest + sql.js |
| Sync | CloudKit round-trip | CloudKit test container |
| E2E | Full app launch to render | XCUITest |

## Key Principles

1. **Swift is plumbing, not product** — All user-facing logic lives in JavaScript
2. **The bridge is narrow** — One message type in each direction
3. **JavaScript owns data** — Swift only syncs the file, never queries it
4. **sql.js eliminates serialization** — Same memory space, no bridge overhead
5. **CloudKit syncs files, not records** — V1 simplification, V2 can add CRDT
