# Phase 39: CloudKit Architecture - Research

**Researched:** 2026-03-06
**Domain:** CKSyncEngine integration, database migration, bridge protocol extension, offline queue
**Confidence:** HIGH

## Summary

Phase 39 replaces the existing iCloud Documents (ubiquity container) file sync with CKSyncEngine record-level sync. This requires four coordinated changes: (1) migrating the database from the ubiquity container back to Application Support, (2) initializing CKSyncEngine with a custom record zone and persisted state, (3) extending the bridge protocol so incoming sync records flow into sql.js via `native:sync` and outgoing mutations carry changesets via enhanced `mutated` messages, and (4) persisting an offline edit queue as JSON in Application Support.

CKSyncEngine (iOS 17+ / macOS 14+) is Apple's modern sync API introduced at WWDC23. The project's deployment target is iOS 26.2+ / macOS 26.2+, so CKSyncEngine is available. The existing `sendSyncNotification()` stub in BridgeManager and the `native:sync` handler stub in NativeBridge.ts provide the starting points. The existing DatabaseManager contains iCloud ubiquity container logic (`resolveStorageDirectory`, `autoMigrateIfNeeded`, `saveCheckpointCoordinated`, `useCoordinator`) that must be stripped and replaced with a simpler Application Support-only path.

**Primary recommendation:** Follow Apple's sample-cloudkit-sync-engine architecture exactly: actor-based SyncManager conforming to CKSyncEngineDelegate, state serialization persisted to a file on every `stateUpdate` event, custom zone created on `accountChange(.signIn)`, and pending changes queued via `syncEngine.state.add(pendingRecordZoneChanges:)`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Database Migration**: Copy database from iCloud ubiquity container back to Application Support (reverse of existing autoMigrateIfNeeded). Non-destructive: leave the ubiquity container copy indefinitely (never auto-delete). Remove CloudDocuments entitlement entirely; add CloudKit entitlement. Strip NSFileCoordinator from DatabaseManager: remove useCoordinator flag, saveCheckpointCoordinated(), and iCloud ubiquity detection logic. DatabaseManager production init always uses Application Support/Isometry/ -- no more resolveStorageDirectory() iCloud preference.
- **Bridge Protocol Extension**: Incoming sync records: Swift sends via `native:sync` message with a batched array payload. JS-side SyncMerger runs INSERT OR REPLACE SQL directly against sql.js Worker. Bypasses ETL/ImportOrchestrator entirely. Outgoing mutations: Enhance the existing `mutated` bridge message to include a changeset payload: `{ cardId, fields, operation (insert/update/delete) }`. Swift queues these for CKSyncEngine. No new message type needed. Batch sync: all incoming records sent as a single `native:sync` message with an array. JS applies them in one sql.js transaction. Persistence after sync merge: reuse the existing dirty flag -> 30s autosave checkpoint cycle.
- **Offline Queue Storage**: Outgoing sync queue persisted as a JSON file in Application Support alongside isometry.db (Codable array of pending changes). No size cap on the queue. Flush timing: on connectivity restoration, flush all queued changes to CKSyncEngine in a single batch.
- **CKRecord Field Mapping**: All card columns mapped to CKRecord string/int/double fields directly (no CKAsset). Single custom record zone ("IsometryZone") for both Card and Connection record types. One change token tracks everything. Record type names: "Card" and "Connection". Connection source_id and target_id stored as CKRecord.Reference with .deleteSelf action.

### Claude's Discretion
- CKSyncEngine delegate implementation details
- Exact JSON schema for the offline queue file
- SyncMerger SQL implementation (INSERT OR REPLACE vs more nuanced merge)
- Error handling and retry logic for CKSyncEngine operations
- How to detect connectivity restoration (NWPathMonitor vs CKSyncEngine callbacks)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-03 | Sync uses change tokens for incremental-only fetches (no full re-sync) | CKSyncEngine.State.Serialization persists change tokens; restored on init via `stateSerialization` parameter; stateUpdate events deliver new serialization after every sync operation |
| SYNC-08 | Incoming sync records merge into sql.js database via bridge (not ImportOrchestrator) | `native:sync` message type already stubbed in both BridgeManager.sendSyncNotification() and NativeBridge.ts; SyncMerger runs INSERT OR REPLACE directly against Worker |
| SYNC-10 | Offline edits queue locally and sync automatically when connectivity resumes | CKSyncEngine.state.add(pendingRecordZoneChanges:) manages the sync queue; supplementary JSON file in Application Support provides crash-safe persistence; CKSyncEngine auto-retries on network restoration |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CloudKit (CKSyncEngine) | iOS 17+ / macOS 14+ | Record-level bidirectional sync | Apple's official sync engine, replaces manual CKModifyRecordsOperation patterns |
| CKSyncEngine.State.Serialization | Same | Change token + pending changes persistence | Apple's recommended approach for state survival across app restarts |
| CKRecord / CKRecordZone | Same | CloudKit record and zone types | Standard CloudKit data model |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Foundation (JSONEncoder/Decoder) | Built-in | Offline queue JSON serialization | Persist pending changes to Application Support |
| os.Logger | Built-in | Structured logging | All sync operations use subsystem "works.isometry.app" category "Sync" |

### Not Needed
| Instead of | Why Not |
|------------|---------|
| NWPathMonitor | CKSyncEngine handles network state internally; auto-retries on network restoration; no need for separate connectivity monitoring |
| Core Data / SwiftData | Database is opaque sql.js blob from Swift's perspective (D-011); CKSyncEngine maps directly to card/connection fields |
| Third-party sync libraries | CKSyncEngine is Apple's first-party solution specifically for this use case |

## Architecture Patterns

### Recommended Project Structure
```
native/Isometry/Isometry/
├── SyncManager.swift            # NEW: CKSyncEngine delegate + state persistence
├── SyncTypes.swift              # NEW: CKRecord <-> card/connection field mapping
├── DatabaseManager.swift        # MODIFIED: stripped of iCloud ubiquity logic
├── BridgeManager.swift          # MODIFIED: enhanced mutated handler, sync dispatch
├── Isometry.entitlements        # MODIFIED: CloudDocuments -> CloudKit
└── (existing files unchanged)
```

### Pattern 1: Actor-Based SyncManager
**What:** A dedicated actor conforming to CKSyncEngineDelegate that owns the CKSyncEngine instance, state persistence, and offline queue.
**When to use:** Always -- actor isolation matches DatabaseManager's pattern and ensures thread-safe access to sync state.
**Example:**
```swift
// Source: apple/sample-cloudkit-sync-engine + WWDC23 session
actor SyncManager: CKSyncEngineDelegate {
    private var syncEngine: CKSyncEngine?
    private let stateURL: URL  // Application Support/Isometry/sync-state.data
    private let queueURL: URL  // Application Support/Isometry/sync-queue.json

    func initialize() {
        let stateSerialization = loadStateSerialization()
        let config = CKSyncEngine.Configuration(
            database: CKContainer.default().privateCloudDatabase,
            stateSerialization: stateSerialization,
            delegate: self
        )
        syncEngine = CKSyncEngine(config)
    }

    func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        switch event {
        case .stateUpdate(let update):
            persistStateSerialization(update.stateSerialization)
        case .accountChange(let change):
            handleAccountChange(change)
        case .fetchedRecordZoneChanges(let changes):
            await handleFetchedChanges(changes)
        case .sentRecordZoneChanges(let sent):
            handleSentChanges(sent)
        default:
            break
        }
    }
}
```

### Pattern 2: State Serialization Persistence
**What:** Persist CKSyncEngine.State.Serialization to a file on every stateUpdate event. Restore on init.
**When to use:** Every time the sync engine posts a stateUpdate event (which includes change token updates).
**Example:**
```swift
// Source: apple/sample-cloudkit-sync-engine
private func persistStateSerialization(_ serialization: CKSyncEngine.State.Serialization) {
    do {
        let data = try NSKeyedArchiver.archivedData(
            withRootObject: serialization,
            requiringSecureCoding: true
        )
        try data.write(to: stateURL, options: .atomic)
    } catch {
        logger.error("Failed to persist sync state: \(error)")
    }
}

private func loadStateSerialization() -> CKSyncEngine.State.Serialization? {
    guard let data = try? Data(contentsOf: stateURL) else { return nil }
    return try? NSKeyedUnarchiver.unarchivedObject(
        ofClass: CKSyncEngine.State.Serialization.self,
        from: data
    )
}
```

### Pattern 3: Enhanced Mutated Message with Changeset
**What:** The existing `mutated` message (JS -> Swift) is enhanced to carry a changeset payload describing what changed.
**When to use:** Every card/connection mutation in JS posts this to Swift so SyncManager can queue changes for CKSyncEngine.
**Example:**
```typescript
// JS side: enhanced mutated message
window.webkit!.messageHandlers.nativeBridge.postMessage({
    id: crypto.randomUUID(),
    type: 'mutated',
    payload: {
        changes: [
            { recordType: 'Card', recordId: 'abc-123', operation: 'update', fields: { name: 'New Name' } },
            { recordType: 'Connection', recordId: 'conn-456', operation: 'insert' }
        ]
    },
    timestamp: Date.now(),
});
```

### Pattern 4: Database Migration (Reverse of autoMigrateIfNeeded)
**What:** One-time migration from iCloud ubiquity container to Application Support. Non-destructive -- leaves ubiquity copy.
**When to use:** On first launch after Phase 39 ships.
**Example:**
```swift
// Source: existing autoMigrateIfNeeded reversed
static func migrateFromUbiquityIfNeeded(to appSupportDir: URL) {
    let fm = FileManager.default
    let appSupportDB = appSupportDir.appendingPathComponent("isometry.db")

    // Skip if local db already exists (already migrated or never used iCloud)
    guard !fm.fileExists(atPath: appSupportDB.path) else { return }

    // Try to find iCloud container
    guard let containerURL = fm.url(forUbiquityContainerIdentifier: nil) else { return }
    let icloudDB = containerURL
        .appendingPathComponent("Isometry", isDirectory: true)
        .appendingPathComponent("isometry.db")

    guard fm.fileExists(atPath: icloudDB.path) else { return }

    // Copy iCloud -> Application Support (non-destructive)
    do {
        try fm.copyItem(at: icloudDB, to: appSupportDB)
        logger.info("Migrated database from iCloud to Application Support")
    } catch {
        logger.error("Migration failed: \(error)")
    }
}
```

### Pattern 5: CKRecord Field Mapping
**What:** Map card and connection columns to CKRecord fields. Keep record names matching card IDs.
**When to use:** In nextRecordZoneChangeBatch (outgoing) and handleFetchedChanges (incoming).
**Example:**
```swift
// Source: CONTEXT.md locked decisions
static let zoneID = CKRecordZone.ID(zoneName: "IsometryZone")

extension CKRecord {
    /// Populate CKRecord from card changeset fields
    func setCardFields(_ fields: [String: Any]) {
        for (key, value) in fields {
            switch key {
            case "name", "content", "summary", "folder", "tags", "status",
                 "card_type", "location_name", "url", "mime_type", "source",
                 "source_id", "source_url", "created_at", "modified_at",
                 "due_at", "completed_at", "event_start", "event_end", "deleted_at":
                self[key] = value as? CKRecordValue
            case "priority", "sort_order":
                self[key] = (value as? Int) as CKRecordValue?
            case "latitude", "longitude", "weight":
                self[key] = (value as? Double) as CKRecordValue?
            case "is_collective":
                self[key] = ((value as? Int) ?? 0) as CKRecordValue
            default:
                break
            }
        }
    }
}
```

### Anti-Patterns to Avoid
- **Calling fetchChanges()/sendChanges() inside handleEvent():** Creates infinite loops. Only add pending changes within delegate callbacks.
- **Multiple CKSyncEngine instances for the same database:** One engine per database only. Isometry uses only privateCloudDatabase.
- **Storing full CKRecord objects in memory:** Store only system fields metadata (`encodeSystemFields(with:)`) for conflict resolution. The CKRecord itself is heavy.
- **Using ImportOrchestrator for sync merges:** SYNC-08 explicitly forbids this. SyncMerger runs INSERT OR REPLACE directly.
- **Deleting the ubiquity container copy during migration:** CONTEXT.md says non-destructive. Leave it indefinitely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Change token management | Custom change token tracking | CKSyncEngine.State.Serialization | Apple manages change tokens, pending changes, retry queue internally |
| Network monitoring for sync | NWPathMonitor-based connectivity check | CKSyncEngine automatic retry | CKSyncEngine auto-pauses on network loss and resumes on restoration |
| Retry logic for transient errors | Custom exponential backoff | CKSyncEngine built-in retry | Handles networkFailure, networkUnavailable, zoneBusy, serviceUnavailable, requestRateLimited automatically |
| Push notification handling for sync | Manual CKSubscription + push processing | CKSyncEngine automatic fetch | CKSyncEngine listens for push notifications and fetches changes automatically |
| Batch upload sizing | Manual record batching | CKSyncEngine.RecordZoneChangeBatch | Engine handles 1MB upload batch limits internally |

**Key insight:** CKSyncEngine encapsulates ~70,000 lines of sync logic (per WWDC23). The delegate interface is intentionally minimal: handle events, provide record batches, persist state. Do not try to manage sync scheduling, retry logic, or network monitoring.

## Common Pitfalls

### Pitfall 1: Not Persisting State Serialization on Every Update
**What goes wrong:** Change tokens are lost. Next launch triggers a full re-sync instead of incremental fetch.
**Why it happens:** State serialization seems like overhead. Developers skip some updates.
**How to avoid:** Persist on EVERY `.stateUpdate` event. The serialization is small (a few KB). Write atomically to `sync-state.data`.
**Warning signs:** Full data re-download on every app launch.

### Pitfall 2: CKRecord System Fields Not Preserved for Conflict Resolution
**What goes wrong:** Every upload triggers a `serverRecordChanged` error because the record lacks metadata.
**Why it happens:** Creating a new CKRecord for each upload instead of restoring from archived system fields.
**How to avoid:** After each successful send or fetch, archive the CKRecord's system fields via `encodeSystemFields(with:)`. Before uploading, restore with `CKRecord(coder:)` and update field values.
**Warning signs:** Constant `serverRecordChanged` errors in sentRecordZoneChanges.

### Pitfall 3: Calling url(forUbiquityContainerIdentifier:) on Main Thread
**What goes wrong:** App freezes for 1-3 seconds on launch.
**Why it happens:** This API does IPC to iCloud daemon, blocks the calling thread.
**How to avoid:** The migration check must run on a background thread via Task.detached (existing pattern in DatabaseManager.makeForProduction).
**Warning signs:** App launch stuttering.

### Pitfall 4: Enum Values in CKRecord Fields
**What goes wrong:** Older app versions crash when encountering new enum cases from newer versions.
**Why it happens:** Swift enums are a finite set; adding a case breaks existing decoders.
**How to avoid:** Store enum-like values as strings in CKRecord fields. card_type, status are already strings in the schema.
**Warning signs:** Crashes on older devices after schema evolution.

### Pitfall 5: Zone Deletion Events (Purge vs Delete)
**What goes wrong:** User clears iCloud data via Settings; app does not reset sync state.
**Why it happens:** `.purged` zone deletion reason requires deleting local data AND resetting state serialization.
**How to avoid:** Handle all three zone deletion reasons: `.deleted` (normal cleanup), `.purged` (user cleared iCloud -- reset state token, delete local data), `.encryptedDataReset` (account recovery -- re-upload all data).
**Warning signs:** Stale data persisting after user clears iCloud storage.

### Pitfall 6: Dual Sync Mechanisms Running Simultaneously
**What goes wrong:** Both iCloud Documents (ubiquity container) and CKSyncEngine try to sync, causing data corruption.
**Why it happens:** CloudDocuments entitlement not removed or migration incomplete.
**How to avoid:** Phase 39 must be atomic: remove CloudDocuments entitlement, add CloudKit entitlement, migrate database. No overlap.
**Warning signs:** Database corruption, duplicate writes.

### Pitfall 7: Not Handling accountChange Events
**What goes wrong:** Sync continues with stale account context after sign-out or account switch.
**Why it happens:** accountChange events ignored.
**How to avoid:** On `.signOut`, clear sync state. On `.switchAccounts`, clear and re-initialize. On `.signIn`, ensure zone exists.
**Warning signs:** Data from wrong iCloud account appearing.

### Pitfall 8: Deletions Bypass Conflict Resolution
**What goes wrong:** A delete on Device A removes a record that Device B just edited.
**Why it happens:** CKSyncEngine fires deletions directly without serverRecordChanged checks.
**How to avoid:** This is by design in CloudKit. For Phase 39 (infrastructure), just implement the delete path. Phase 40 (card sync) handles last-writer-wins semantics for SYNC-04.
**Warning signs:** Not a bug -- expected CloudKit behavior.

## Code Examples

### Entitlements File (CloudDocuments -> CloudKit)
```xml
<!-- Source: Apple "Enabling CloudKit in Your App" documentation -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.icloud-services</key>
    <array>
        <string>CloudKit</string>
    </array>
    <key>com.apple.developer.icloud-container-identifiers</key>
    <array>
        <string>iCloud.works.isometry.Isometry</string>
    </array>
    <key>aps-environment</key>
    <string>development</string>
</dict>
</plist>
```

Note: `aps-environment` is required for CKSyncEngine push notification handling. Remove `com.apple.developer.ubiquity-container-identifiers` (no longer needed without CloudDocuments).

### Offline Queue JSON Schema (Claude's Discretion)
```swift
// Recommended: simple Codable struct array
struct PendingChange: Codable {
    let id: String           // UUID for dedup
    let recordType: String   // "Card" or "Connection"
    let recordId: String     // matches card.id or connection.id
    let operation: String    // "save" or "delete"
    let fields: [String: AnyCodableValue]?  // nil for deletes
    let timestamp: Date
}
```

### SyncMerger SQL (Claude's Discretion)
```sql
-- INSERT OR REPLACE for incoming sync records
-- This is appropriate because:
-- 1. card.id is the PRIMARY KEY
-- 2. Incoming records from CloudKit are authoritative (already conflict-resolved)
-- 3. FTS5 triggers fire on INSERT (after the implicit DELETE), keeping search index consistent
INSERT OR REPLACE INTO cards (
    id, card_type, name, content, summary,
    latitude, longitude, location_name,
    created_at, modified_at, due_at, completed_at, event_start, event_end,
    folder, tags, status,
    priority, sort_order,
    url, mime_type, is_collective,
    source, source_id, source_url,
    deleted_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
```

### CKRecord.Reference for Connections
```swift
// Source: CKRecord.Reference Apple documentation
func connectionToCKRecord(_ change: PendingChange, zoneID: CKRecordZone.ID) -> CKRecord {
    let recordID = CKRecord.ID(recordName: change.recordId, zoneID: zoneID)
    let record = CKRecord(recordType: "Connection", recordID: recordID)

    if let fields = change.fields {
        // source_id and target_id as CKRecord.Reference with .deleteSelf
        if let sourceId = fields["source_id"]?.stringValue {
            let sourceRecordID = CKRecord.ID(recordName: sourceId, zoneID: zoneID)
            record["source_id"] = CKRecord.Reference(
                recordID: sourceRecordID,
                action: .deleteSelf
            )
        }
        if let targetId = fields["target_id"]?.stringValue {
            let targetRecordID = CKRecord.ID(recordName: targetId, zoneID: zoneID)
            record["target_id"] = CKRecord.Reference(
                recordID: targetRecordID,
                action: .deleteSelf
            )
        }
        // Other fields as direct values
        record["label"] = fields["label"]?.stringValue as CKRecordValue?
        record["weight"] = fields["weight"]?.doubleValue as CKRecordValue?
        record["via_card_id"] = fields["via_card_id"]?.stringValue as CKRecordValue?
    }

    return record
}
```

### NativeBridge.ts SyncMerger (JS Side)
```typescript
// Replace the Phase 14 stub in initNativeBridge
case 'native:sync': {
    const payload = message.payload as {
        records: Array<{
            recordType: string;
            recordId: string;
            operation: string;
            fields: Record<string, unknown>;
        }>;
    };

    // Run all sync merges in a single transaction
    await bridge.send('db:exec', {
        statements: payload.records.map(rec => {
            if (rec.operation === 'delete') {
                const table = rec.recordType === 'Card' ? 'cards' : 'connections';
                return { sql: `DELETE FROM ${table} WHERE id = ?`, params: [rec.recordId] };
            }
            // INSERT OR REPLACE for saves
            return buildMergeSQL(rec);
        })
    });
    break;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CKModifyRecordsOperation + CKFetchRecordZoneChangesOperation | CKSyncEngine | iOS 17 (WWDC23) | Massive reduction in boilerplate; automatic scheduling, retry, push handling |
| Manual CKServerChangeToken persistence | CKSyncEngine.State.Serialization | iOS 17 | Engine manages tokens internally; app just persists the opaque blob |
| NSFileCoordinator + iCloud Documents | CKSyncEngine record-level sync | Phase 39 (this change) | Per-record granularity instead of whole-database checkpoint |
| iCloud ubiquity container | Application Support + CloudKit | Phase 39 | Database location decoupled from sync mechanism |

**Deprecated/outdated:**
- `CKModifyRecordsOperation` / `CKFetchRecordZoneChangesOperation`: Still available but CKSyncEngine is the recommended replacement
- iCloud Documents (ubiquity container) for database sync: Being replaced in Phase 39 with CKSyncEngine record-level sync
- `NSFileCoordinator` for database writes: No longer needed when database lives in Application Support

## Open Questions

1. **CKRecord System Fields Archival Location**
   - What we know: System fields must be archived for conflict resolution (Pitfall 2). Apple sample uses NSKeyedArchiver.
   - What's unclear: Where to store archived system fields -- in the offline queue JSON, or a separate cache file?
   - Recommendation: Store in the offline queue entry alongside the pending change. On successful send, discard. On fetch, archive the received record's system fields for future updates. This can be a separate `record-metadata.json` file.

2. **CKSyncEngine Initialization Timing**
   - What we know: Apple says "initialize very soon after app launch." The existing DatabaseManager uses async factory (`makeForProduction`).
   - What's unclear: Whether SyncManager should initialize in parallel with or after DatabaseManager.
   - Recommendation: Initialize SyncManager after DatabaseManager completes (serial). SyncManager needs the database path for state file location. Migration must complete before sync starts.

3. **Remote Notification Entitlement**
   - What we know: CKSyncEngine relies on push notifications for real-time sync. The `aps-environment` entitlement is required.
   - What's unclear: Whether the current provisioning profile includes push notification capability.
   - Recommendation: Add `aps-environment` to entitlements. May require provisioning profile regeneration in Apple Developer Portal (known existing technical debt).

## Sources

### Primary (HIGH confidence)
- [Apple sample-cloudkit-sync-engine](https://github.com/apple/sample-cloudkit-sync-engine) - SyncedDatabase.swift implementation patterns
- [WWDC23: Sync to iCloud with CKSyncEngine](https://developer.apple.com/videos/play/wwdc2023/10188/) - Official API introduction, delegate protocol, state management
- [CKSyncEngine documentation](https://developer.apple.com/documentation/cloudkit/cksyncengine-5sie5) - API reference, deployment targets
- [CKSyncEngine.State.Serialization](https://developer.apple.com/documentation/cloudkit/cksyncengine-5sie5/state-swift.class/serialization) - State persistence API
- Existing codebase: DatabaseManager.swift, BridgeManager.swift, NativeBridge.ts, Isometry.entitlements

### Secondary (MEDIUM confidence)
- [CKSyncEngine questions and answers (Christian Selig)](https://christianselig.com/2026/01/cksyncengine/) - Practical pitfalls, conflict resolution, enum handling, zone deletion reasons, batch upload limits
- [Superwall CKSyncEngine tutorial](https://superwall.com/blog/syncing-data-with-cloudkit-in-your-ios-app-using-cksyncengine-and-swift-and-swiftui/) - Implementation walkthrough with code

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - CKSyncEngine is Apple's official API with extensive documentation and sample code
- Architecture: HIGH - Apple sample project provides the exact delegate pattern; existing codebase has clear integration points
- Pitfalls: HIGH - Multiple verified sources document the same pitfalls; Christian Selig's post is particularly thorough
- Migration: HIGH - Existing autoMigrateIfNeeded provides the exact pattern to reverse
- Bridge protocol: HIGH - Existing stubs in both BridgeManager and NativeBridge.ts provide clear starting points

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (30 days -- CKSyncEngine API is stable since iOS 17)
