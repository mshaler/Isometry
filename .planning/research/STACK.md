# Technology Stack: Live Apple Notes Integration

**Project:** Isometry - Enhanced Apple Notes Integration
**Researched:** 2026-02-01
**Focus:** Stack additions for live Apple Notes sync with conflict resolution
**Confidence:** HIGH

## Executive Summary

Building on proven AltoIndexImporter foundation (6,891 notes successfully imported), this milestone adds real-time Apple Notes monitoring and bidirectional sync. Key stack additions: FSEvents for filesystem monitoring, SwiftProtobuf for direct protobuf parsing, Foundation Compression for gzip handling, and enhanced TCC permission management.

## Current Stack Assessment

### Existing Infrastructure ✅
| Technology | Version | Purpose | Status |
|------------|---------|---------|---------|
| GRDB.swift | 6.24.0 | Native SQLite ORM | **Proven with AltoIndexImporter** |
| AltoIndexImporter | Current | Apple Notes import | **6,891 notes imported successfully** |
| CloudKitSyncManager | Current | Conflict resolution | **Handles bidirectional sync patterns** |
| Swift Actor pattern | Native | Concurrent database access | **Thread-safe, proven architecture** |

## Required Stack Additions

### 1. Real-Time File System Monitoring

**Current Gap:** Manual import via alto-index export
**Solution:** FSEvents API for live Notes database monitoring

#### Core Monitoring Technology
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FSEvents API | Native macOS | Directory tree change notifications | Apple's official low-level API; handles large Notes libraries without polling overhead |
| FileManager.DirectoryMonitor | iOS 17+/macOS 14+ | Modern monitoring API | Higher-level API for simple use cases, but FSEvents preferred for granular control |

#### Implementation Requirements
| Component | Purpose | Implementation |
|-----------|---------|----------------|
| `NotesFileWatcher` | Monitor ~/Library/Group Containers/group.com.apple.notes/ | FSEvents stream with kFSEventStreamCreateFlagFileEvents |
| `ChangeEventProcessor` | Filter and batch filesystem events | Swift Actor with event coalescing (100ms batches) |
| `TriggerImportManager` | Coordinate import pipeline | Integration with existing AltoIndexImporter |

```swift
// Package.swift - no new dependencies needed
// FSEvents is part of CoreServices framework (already available)
```

**Why FSEvents over alternatives:**
- Native Apple API with zero dependencies
- Efficient for monitoring entire directory trees
- Battle-tested for years in spotlight indexing, backup tools
- Supports both legacy and modern file events

### 2. Direct Protobuf Parsing

**Current:** Alto-index exports to markdown, parse YAML frontmatter
**Enhancement:** Direct ZDATA protobuf parsing for reduced latency

#### Add to Swift Package.swift
```swift
dependencies: [
    .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.24.0"), // Already included
    .package(url: "https://github.com/apple/swift-protobuf", from: "2.0.0"),
]

targets: [
    .target(
        name: "Isometry",
        dependencies: [
            .product(name: "GRDB", package: "GRDB.swift"),
            .product(name: "SwiftProtobuf", package: "swift-protobuf"),
        ]
    )
]
```

#### Core Protobuf Technology
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| SwiftProtobuf | 2.0.0+ | Parse gzipped protobuf blobs | Apple's official implementation; requires Swift 5.10+ for current SPM plugin support |
| Foundation Compression | Native | Gzip decompression | Zero external dependencies; handles ZICNOTEDATA.ZDATA gzipped blobs |

#### Implementation Architecture
```swift
struct ProtobufNotesParser {
    // Foundation.Compression for gzip decompression
    // SwiftProtobuf for protobuf parsing
    // Integration with existing AltoIndexImporter.ParsedNote
}
```

**Why SwiftProtobuf:**
- Official Apple library with active maintenance
- Handles Apple Notes' complex nested protobuf structures
- Type-safe code generation from .proto definitions
- Seamless integration with Swift's native types

### 3. TCC Permission Management

**Requirement:** Full Disk Access for ~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite
**Strategy:** Graceful degradation with user education

#### Permission Strategy
| Permission | Purpose | Fallback |
|------------|---------|----------|
| Full Disk Access | Direct Notes database access | Manual alto-index import |
| File System Events | Real-time monitoring | Periodic manual scans |

#### Implementation Approach
```swift
// No additional dependencies - use native TCC checking
import Security

class TCCPermissionManager {
    // Check current permissions without requesting
    // Provide clear user education about benefits
    // Graceful degradation if denied
}
```

**Why This Approach:**
- No third-party TCC libraries (security risk)
- User maintains control over permissions
- Clear value proposition: real-time sync vs manual import
- Preserves existing manual import workflow

### 4. Enhanced AltoIndexImporter

**Current:** File-based markdown import
**Enhancement:** Direct SQLite + protobuf parsing

#### Integration Points
| Enhancement | Purpose | Integration |
|-------------|---------|-------------|
| Live protobuf parsing | Reduce import latency | Extend existing `parseMarkdown()` with protobuf branch |
| SQLite direct access | Skip alto-index export step | New `importFromSQLite()` method alongside existing file import |
| Change detection | Avoid redundant imports | Enhanced sourceId tracking with Notes UUID correlation |

```swift
// Enhanced AltoIndexImporter - backwards compatible
public actor AltoIndexImporter {
    // Existing file-based import methods preserved

    // New direct SQLite methods
    public func importFromNotesDatabase() async throws -> ImportResult
    public func parseProtobufNote(_ data: Data) throws -> ParsedNote
    public func watchForChanges() async throws -> AsyncStream<NotesChange>
}
```

**Backwards Compatibility:**
- All existing AltoIndexImporter APIs preserved
- File-based import remains primary for bulk operations
- Direct parsing supplements for real-time updates

### 5. Compression and Performance

#### Add fallback compression library
```swift
dependencies: [
    .package(url: "https://github.com/mw99/DataCompression", from: "3.8.0"), // Fallback only
]
```

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Foundation Compression | Native | Primary gzip handling | Default for Apple Notes ZDATA blobs |
| DataCompression | 3.8.0+ | Fallback compression | If Foundation Compression insufficient for corrupted/partial data |

**Performance Optimizations:**
- Background queue processing for protobuf parsing
- Batch change notifications (100ms windows)
- Incremental imports (changed notes only)
- Memory-efficient streaming for large Notes libraries

## Alternative Technologies Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| FSEvents API | Polling via FileManager | Never for production - too slow for real-time sync |
| SwiftProtobuf | Manual protobuf parsing | Never - Apple Notes format is undocumented and changes |
| Foundation Compression | Third-party gzip libraries | Only if Foundation proves insufficient |
| Direct SQLite access | AppleScript automation | Only for legacy systems without TCC support |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Witness FSEvents wrapper | Unmaintained since 2017, compatibility issues | Custom FSEvents implementation or updated fork |
| Third-party TCC libraries | Security risk, frequent breaking changes | Native Security framework |
| Alto-index Ruby dependency | Eliminates real-time capabilities | Direct Swift protobuf parsing |
| Continuous polling | Battery drain, poor performance | FSEvents + change batching |

## Integration with Existing Isometry Stack

### Seamless Integration Points

**Enhanced AltoIndexImporter:**
```swift
// Current file-based import preserved
public func importNotes(from directoryURL: URL) async throws -> ImportResult

// New live import capabilities added
public func startLiveSync() async throws -> AsyncStream<ImportResult>
public func importFromProtobuf(_ data: Data) async throws -> Node
```

**GRDB Database Compatibility:**
- Existing `IsometryDatabase` actor handles all new operations
- Same `Node` model with enhanced `sourceId` correlation
- Current CloudKit sync pipeline handles Apple Notes changes

**CloudKit Conflict Resolution:**
- Existing `SyncConflictManager` handles Notes conflicts
- Enhanced with Notes-specific conflict detection
- Read-mostly strategy: Notes app wins, Isometry adapts

### New Components Architecture

```swift
// New: Real-time monitoring
public actor NotesFileWatcher {
    private let database: IsometryDatabase
    private let importer: AltoIndexImporter
    // FSEvents-based change monitoring
}

// Enhanced: Direct protobuf support
public struct ProtobufNotesParser {
    // SwiftProtobuf + Foundation Compression
    // Produces AltoIndexImporter.ParsedNote
}

// Enhanced: Permission management
public class NotesPermissionManager {
    // TCC status checking and user guidance
    // Graceful degradation strategies
}
```

## Performance Architecture

### Real-Time Sync Flow
```
Notes App Change → FSEvents Notification → Change Event Filter →
Protobuf Parse → AltoIndexImporter → GRDB → CloudKit Sync
```

### Conflict Resolution Flow
```
Notes App Conflict → Detect via sourceId → CloudKit Conflict Resolution →
User Notification → Manual Resolution UI → Update Both Systems
```

**Performance Targets:**
- Change detection: <100ms from Notes save to import trigger
- Protobuf parsing: <10ms per note (vs 100ms+ for alto-index export)
- Import pipeline: <1s for single note changes
- Bulk import: Maintains current ~6,891 notes in reasonable time

## Installation Instructions

### Swift Package Dependencies
```swift
// Add to Package.swift
dependencies: [
    .package(url: "https://github.com/apple/swift-protobuf", from: "2.0.0"),
    .package(url: "https://github.com/mw99/DataCompression", from: "3.8.0"), // Fallback
]

targets: [
    .target(
        name: "Isometry",
        dependencies: [
            // Existing dependencies preserved
            .product(name: "GRDB", package: "GRDB.swift"),
            // New additions
            .product(name: "SwiftProtobuf", package: "swift-protobuf"),
            .product(name: "DataCompression", package: "DataCompression"),
        ]
    )
]
```

### Development Tools
```bash
# Required for protobuf development (if defining custom .proto files)
brew install protobuf

# For testing Notes database access
brew install sqlite3
```

### Runtime Requirements
- macOS 14.0+ or iOS 17.0+ (existing requirements)
- Full Disk Access permission (user-granted)
- Apple Notes app installed and used

## Migration Strategy

### Phase 1: Add protobuf parsing (Week 1)
```swift
// Add SwiftProtobuf dependency
// Implement ProtobufNotesParser
// Test with existing Notes database
// Maintain file-based import as primary
```

### Phase 2: Add FSEvents monitoring (Week 2)
```swift
// Implement NotesFileWatcher
// Add change event batching
// Test real-time import pipeline
// Add TCC permission checking
```

### Phase 3: Enhanced conflict resolution (Week 3)
```swift
// Enhance CloudKit sync for Notes-specific conflicts
// Add user conflict resolution UI
// Implement read-mostly bidirectional strategy
// Performance optimization and testing
```

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| SwiftProtobuf 2.0.0+ | Swift 5.10+, Xcode 15.3+ | Required for current SPM plugin support |
| GRDB.swift 6.24.0+ | iOS 13+, macOS 10.15+ | Already validated in existing codebase |
| DataCompression 3.8.0+ | iOS 9+, macOS 10.11+ | Broader compatibility than Foundation Compression |
| FSEvents API | macOS 10.5+ | Native API, no version constraints |

## Security Considerations

### TCC Compliance
- Request minimal permissions (Full Disk Access only)
- Clear user education about permission benefits
- Graceful degradation if permissions denied
- No programmatic TCC database manipulation

### Data Protection
- Notes content encrypted at rest in SQLite
- Existing CloudKit encryption maintains security
- No plaintext Notes storage outside approved containers
- Audit trail for all Notes access attempts

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|---------|------------|
| Apple Notes format changes | Medium | High | Monitor Ruby parser updates, fallback to file import |
| TCC permission denial | High | Medium | Graceful degradation to manual import |
| FSEvents performance issues | Low | Medium | Configurable batching, fallback to polling |
| SwiftProtobuf compatibility | Low | High | Pin to stable versions, test across iOS releases |

## Sources

- **FSEvents API** — Apple Developer Documentation, Core Services (HIGH confidence)
- **SwiftProtobuf** — GitHub apple/swift-protobuf, official releases (HIGH confidence)
- **Apple Notes database format** — threeplanetssoftware/apple_cloud_notes_parser research (MEDIUM confidence)
- **TCC permissions** — macOS security documentation, developer forums (HIGH confidence)
- **Alto-index compatibility** — Existing AltoIndexImporter validation with 6,891 notes (HIGH confidence)

---
*Stack research for: Live Apple Notes Integration*
*Researched: 2026-02-01*