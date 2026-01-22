# External Integrations

**Analysis Date:** 2026-01-21

## Cloud Services

### CloudKit (Native Only)
- **Container:** `iCloud.com.cardboard.app`
- **Zone:** `IsometryZone` (private database)
- **Subscription ID:** `isometry-changes`
- **Database:** Private CloudKit Database

**Implementation:** `native/Sources/Isometry/Sync/CloudKitSyncManager.swift`

**Features:**
- Bidirectional sync (push local → pull remote)
- Change tokens for incremental sync
- Conflict resolution strategies:
  - `.serverWins` - Server version takes precedence
  - `.localWins` - Client-only changes win
  - `.latestWins` - Timestamp-based (default)
  - `.fieldLevelMerge` - Per-field resolution
  - `.manualResolution` - Queue for user intervention
- Exponential backoff: 1s → 300s (5 min max)
- Error handling for common CloudKit errors

## Data Storage

### SQLite (Both Platforms)

**React Prototype:**
- Provider: sql.js (WASM in browser)
- Storage: IndexedDB persistence
- Client: Custom DatabaseContext
- Location: Browser storage (auto-persist)

**Native Apps:**
- Provider: Native SQLite via GRDB.swift
- Storage: Application Support directory
- Client: IsometryDatabase actor
- Location: `~/Library/Application Support/Isometry/isometry.sqlite`

**Pragmas:**
```sql
PRAGMA foreign_keys = ON
PRAGMA journal_mode = WAL
PRAGMA synchronous = NORMAL
PRAGMA cache_size = -64000  -- 64MB
```

## Data Import

### Apple Notes Import (Native Only)
- **Format:** alto-index markdown with YAML frontmatter
- **Importer:** `native/Sources/Isometry/Import/AltoIndexImporter.swift`
- **Source:** `~/Documents/alto-index/Notes/`
- **Fields parsed:** title, id, created, modified, folder, tags
- **Deduplication:** By sourceId + source name
- **Auto-import:** On first launch (6,891 notes imported)

## Authentication

### iCloud Account (Native Only)
- Required for CloudKit sync
- Detected via entitlements check
- No additional OAuth providers
- SwiftUI previews: CloudKit disabled

## Environment Configuration

### Development (React)
- Required: None (sql.js auto-loads from CDN)
- Storage: IndexedDB (browser-local)
- Database: In-memory with IndexedDB persistence

### Development (Native)
- Required: Xcode with signing configured
- Storage: Application Support directory
- CloudKit: Requires entitlements + code signing

### Production (Native)
- CloudKit container: `iCloud.com.cardboard.app`
- Entitlements: CloudKit capability required
- Database: Local SQLite with iCloud sync

## CDN Dependencies

### sql.js (React Prototype)
- **URL:** `https://sql.js.org/dist/sql-wasm.js`
- **WASM:** `https://sql.js.org/dist/sql-wasm.wasm`
- **Fallback:** None (app fails if CDN unavailable)
- **Note:** Development only, not in production native apps

## Webhooks & Callbacks

### Incoming
- **CloudKit Push Notifications** - Triggers sync when remote changes detected
  - Subscription: CKDatabaseSubscription
  - Handler: CloudKitSyncManager.handleRemoteNotification()

### Outgoing
- None

---

*Integration audit: 2026-01-21*
*Update when adding/removing external services*
