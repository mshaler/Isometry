# Architecture Research

**Domain:** Live Apple Notes Integration with Swift Actor + GRDB + CloudKit
**Researched:** 2026-02-01
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  SwiftUI │  │ WebView │  │  TCC    │  │ Progress│        │
│  │  Views   │  │ Bridge  │  │Manager  │  │  UI     │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                  Actor Coordination Layer                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              NotesIntegrationActor                   │    │
│  │  (FSEvents monitoring, conflict resolution)          │    │
│  └─────┬────────────────────────┬─────────────────────┘     │
│        │                        │                           │
├────────┴────────────────────────┴───────────────────────────┤
│                     Data Layer                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │AltoIndex │  │Isometry  │  │CloudKit  │                   │
│  │Importer  │  │Database  │  │Sync Mgr  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| NotesIntegrationActor | Live sync coordination, FSEvents monitoring, conflict resolution | Swift Actor with FileSystemEventStream |
| TCCManager | Privacy permissions management | Actor wrapping TCC database queries |
| ConflictResolver | Bidirectional sync conflict handling | Actor with strategy pattern for resolution |
| ChangeMonitor | Real-time Notes database monitoring | FSEvents wrapper with debouncing |
| AltoIndexImporter | Batch Notes import from exported data | Enhanced existing actor with live sync capability |
| IsometryDatabase | Local SQLite storage with GRDB | Existing Actor with additional Notes sync tables |
| CloudKitSyncManager | Bidirectional CloudKit synchronization | Enhanced existing actor with Notes record types |

## Recommended Project Structure

```
Sources/Isometry/
├── Integration/          # Live Notes integration components
│   ├── NotesIntegrationActor.swift    # Main coordination actor
│   ├── ChangeMonitor.swift           # FSEvents monitoring
│   ├── ConflictResolver.swift        # Conflict resolution strategies
│   ├── TCCManager.swift              # Privacy permissions management
│   └── NotesWatcher.swift            # File system change detection
├── Import/              # Enhanced import functionality
│   ├── AltoIndexImporter.swift       # Existing (enhanced for live sync)
│   └── LiveNotesImporter.swift       # New live import capability
├── Database/            # Enhanced database layer
│   ├── IsometryDatabase.swift        # Existing (add Notes sync tables)
│   ├── NotesChangeLog.swift          # Change tracking for sync
│   └── SyncConflict.swift            # Conflict metadata storage
├── Sync/                # Enhanced sync management
│   ├── CloudKitSyncManager.swift     # Existing (add Notes record types)
│   ├── NotesRecordTransformer.swift  # CloudKit ↔ Notes conversion
│   └── SyncCoordinator.swift         # Multi-source sync coordination
└── Resources/
    ├── schema.sql                    # Enhanced with Notes sync tables
    └── migrations/                   # Database migration scripts
        └── 002_add_notes_sync.sql
```

### Structure Rationale

- **Integration/:** Isolates live Notes-specific logic from existing import patterns, follows Actor model
- **Enhanced Import/:** Builds on proven AltoIndexImporter pattern, adds live sync without breaking batch import
- **Database/:** Extends existing GRDB Actor pattern, maintains transaction safety and CloudKit sync compatibility
- **Sync/:** Enhances existing CloudKit patterns, adds Notes-specific conflict resolution and record transformation

## Architectural Patterns

### Pattern 1: Actor-Based Isolation

**What:** Each major subsystem (monitoring, sync, conflict resolution) runs in its own Actor to maintain thread safety
**When to use:** Required for Swift concurrency with shared mutable state and external resource access
**Trade-offs:** Excellent safety and concurrency, but requires careful message passing design

**Example:**
```swift
public actor NotesIntegrationActor {
    private let changeMonitor: ChangeMonitor
    private let conflictResolver: ConflictResolver
    private let database: IsometryDatabase

    public func startLiveSync() async throws {
        try await changeMonitor.startWatching { [weak self] changes in
            await self?.processChanges(changes)
        }
    }
}
```

### Pattern 2: FSEvents + Debouncing

**What:** Monitor Notes database directory with FSEvents, debounce rapid changes to avoid sync storms
**When to use:** Real-time file system monitoring where changes come in bursts
**Trade-offs:** Near real-time responsiveness vs avoiding excessive processing

**Example:**
```swift
public actor ChangeMonitor {
    private var debounceTimer: Task<Void, Never>?
    private let debounceInterval: TimeInterval = 0.5

    private func handleFileSystemEvent() {
        debounceTimer?.cancel()
        debounceTimer = Task {
            await Task.sleep(nanoseconds: UInt64(debounceInterval * 1_000_000_000))
            await processQueuedChanges()
        }
    }
}
```

### Pattern 3: Bidirectional Conflict Resolution

**What:** Handle conflicts when both Notes.app and Isometry modify the same note simultaneously
**When to use:** Any bidirectional sync system with concurrent modification capability
**Trade-offs:** Preserves data integrity but requires careful timestamp tracking and user notification

**Example:**
```swift
public actor ConflictResolver {
    public enum Strategy {
        case notesWins, isometryWins, manualResolution, timestampBased
    }

    public func resolve(conflict: SyncConflict, strategy: Strategy) async throws -> Node {
        switch strategy {
        case .timestampBased:
            return conflict.notesVersion.modifiedAt > conflict.isometryVersion.modifiedAt
                ? conflict.notesVersion : conflict.isometryVersion
        case .manualResolution:
            // Queue for user decision
            try await database.queueConflictForResolution(conflict)
        }
    }
}
```

## Data Flow

### Live Sync Flow

```
[Notes.app modification]
    ↓
[FSEvents notification] → [ChangeMonitor] → [NotesIntegrationActor]
    ↓                                               ↓
[Protobuf parsing] → [AltoIndexImporter] → [IsometryDatabase]
    ↓                                               ↓
[CloudKitSyncManager] → [Conflict detection] → [ConflictResolver]
    ↓                                               ↓
[CloudKit push] ← [Resolved Node] ← [Strategy application]
```

### Conflict Resolution Flow

```
[Concurrent modification detected]
    ↓
[ConflictResolver] → [Strategy selection] → [Resolution method]
    ↓                        ↓                      ↓
[Database update] ← [User notification] ← [Manual resolution queue]
```

### Key Data Flows

1. **Live Change Detection:** FSEvents → ChangeMonitor → debounced processing → database sync
2. **Conflict Resolution:** Concurrent modification detection → strategy application → user notification if needed
3. **Bidirectional Sync:** Notes ↔ Isometry ↔ CloudKit with conflict detection at each boundary

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k notes | Direct Actor communication, single FSEvents monitor |
| 1k-10k notes | Batched change processing, selective sync by folder |
| 10k+ notes | Incremental sync with change tokens, background processing priority |

### Scaling Priorities

1. **First bottleneck:** FSEvents notification rate - solve with debouncing and batch processing
2. **Second bottleneck:** Protobuf parsing performance - solve with background processing and selective parsing

## Anti-Patterns

### Anti-Pattern 1: Synchronous FSEvents Processing

**What people do:** Process every FSEvents notification immediately in blocking manner
**Why it's wrong:** Causes UI freezing and sync storms during rapid Notes modifications
**Do this instead:** Use debouncing in ChangeMonitor Actor with async processing

### Anti-Pattern 2: Direct Notes Database Access

**What people do:** Directly read from NoteStore.sqlite bypassing Notes.app's locking
**Why it's wrong:** Can corrupt Notes database and violate SIP/TCC constraints
**Do this instead:** Use alto-index export pattern or monitor changes through FSEvents only

### Anti-Pattern 3: Aggressive CloudKit Sync

**What people do:** Push every local change immediately to CloudKit
**Why it's wrong:** Hits rate limits and creates excessive conflict scenarios
**Do this instead:** Batch changes and implement exponential backoff in CloudKitSyncManager

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Notes.app | FSEvents monitoring + alto-index export | Requires TCC permissions, respects app boundaries |
| CloudKit | Enhanced existing sync patterns | Add Notes record types, handle larger attachment sizes |
| File System | FSEvents with proper debouncing | Monitor ~/Library/Group\ Containers/group.com.apple.notes/ |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ NotesIntegrationActor | async/await with progress callbacks | Progress updates for long-running sync operations |
| Database ↔ Sync actors | GRDB transaction isolation | Maintain existing transaction patterns |
| Conflict resolution ↔ UI | Publisher/subscriber pattern | User notification for manual conflict resolution |

### Existing Architecture Integration

**AltoIndexImporter Enhancement:**
- Keep existing batch import functionality intact
- Add live sync capability through new `startLiveImport()` method
- Share protobuf parsing logic between batch and live modes

**IsometryDatabase Extension:**
- Add Notes-specific sync tables (notes_changes, sync_conflicts)
- Maintain existing CloudKit sync patterns
- Extend transaction methods for multi-source conflict detection

**CloudKitSyncManager Integration:**
- Add Notes record type alongside existing Node records
- Implement Notes-specific conflict resolution strategies
- Maintain existing chunked upload and retry patterns

## Apple Notes Technical Constraints

### Database Location & Access
- Notes stored at: `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`
- WAL mode active while Notes.app running (-wal, -shm files)
- TCC permissions required for `kTCCServiceAppleEvents` access
- SIP protection prevents direct database modification

### Data Format Challenges
- Note content stored as gzipped protobuf in ZICNOTEDATA.ZDATA column
- Protobuf structure changes between iOS versions (7 new columns in iOS 18)
- Embedded objects (tables, attachments) require separate parsing
- Tags stored as hashtag attachment types in protobuf structure

### Sync Limitations
- Notes.app sync timing unpredictable (can take hours)
- No official real-time sync API from Apple
- FSEvents monitoring adds ~0.5s latency for responsiveness
- Conflict resolution must handle Apple's eventual consistency model

## Performance Optimization

### FSEvents Monitoring
```swift
// Optimized FSEvents configuration
let streamRef = FSEventStreamCreate(
    nil, callback, &context,
    [notesContainerPath] as CFArray,
    FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
    0.5, // 500ms latency for responsiveness
    UInt32(kFSEventStreamCreateFlagUseCFTypes |
           kFSEventStreamCreateFlagNoDefer |
           kFSEventStreamCreateFlagFileEvents)
)
```

### Protobuf Parsing Strategy
- Parse only modified notes (timestamp comparison)
- Cache parsed protobuf structures
- Background parsing with priority queue
- Selective field extraction based on Isometry's needs

## Sources

- [Apple Notes Database Structure Research](https://github.com/threeplanetssoftware/apple_cloud_notes_parser)
- [FSEvents Documentation](https://developer.apple.com/documentation/coreservices/file_system_events)
- [TCC Framework Guidelines (macOS Sequoia)](https://atlasgondal.com/macos/priavcy-and-security/app-permissions-priavcy-and-security/a-guide-to-tcc-services-on-macos-sequoia-15-0/)
- [GRDB CloudKit Sync Patterns](https://github.com/groue/GRDB.swift/discussions/1569)
- [Swift Actor Concurrency Patterns](https://developer.apple.com/documentation/swift/actor)
- [Apple Notes iOS 18 Analysis (2024)](https://www.ciofecaforensics.com/2024/12/10/ios18-notes/)

---
*Architecture research for: Live Apple Notes Integration*
*Researched: 2026-02-01*