# Phase 39: CloudKit Architecture - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the sync infrastructure: migrate database storage from iCloud Documents (ubiquity container) to Application Support, set up CKSyncEngine with a custom record zone and change token persistence, extend the bridge protocol to carry sync records between Swift and sql.js, and persist an offline edit queue that survives app restart. This phase delivers the plumbing -- actual bidirectional card sync (Phase 40) and connection sync (Phase 41) build on top.

Requirements: SYNC-03 (change tokens for incremental fetches), SYNC-08 (incoming records merge via bridge, not ImportOrchestrator), SYNC-10 (offline edits queue locally, survive restart).

</domain>

<decisions>
## Implementation Decisions

### Database Migration
- Copy database from iCloud ubiquity container back to Application Support (reverse of existing autoMigrateIfNeeded). Non-destructive: leave the ubiquity container copy indefinitely (never auto-delete)
- Remove CloudDocuments entitlement entirely; add CloudKit entitlement. Clean break -- no ambiguity about which sync mechanism is active
- Strip NSFileCoordinator from DatabaseManager: remove useCoordinator flag, saveCheckpointCoordinated(), and iCloud ubiquity detection logic. Application Support doesn't need file coordination. Simpler code
- DatabaseManager production init always uses Application Support/Isometry/ -- no more resolveStorageDirectory() iCloud preference

### Bridge Protocol Extension
- Incoming sync records: Swift sends via `native:sync` message with a batched array payload. JS-side SyncMerger runs INSERT OR REPLACE SQL directly against sql.js Worker. Bypasses ETL/ImportOrchestrator entirely
- Outgoing mutations: Enhance the existing `mutated` bridge message to include a changeset payload: `{ cardId, fields, operation (insert/update/delete) }`. Swift queues these for CKSyncEngine. No new message type needed
- Batch sync: all incoming records sent as a single `native:sync` message with an array. JS applies them in one sql.js transaction. Fewer bridge round-trips, transactional consistency
- Persistence after sync merge: reuse the existing dirty flag -> 30s autosave checkpoint cycle. No immediate checkpoint after sync -- same persistence path as user edits

### Offline Queue Storage
- Outgoing sync queue persisted as a JSON file in Application Support alongside isometry.db (Codable array of pending changes)
- No size cap on the queue -- offline edits are small (card field changes); even 10K changes would be <1MB JSON
- Flush timing: on connectivity restoration, flush all queued changes to CKSyncEngine in a single batch. CKSyncEngine handles the actual upload scheduling
- CKSyncEngine state (including change tokens) persisted via CKSyncEngine.State.Serialization to a file in Application Support -- Apple's recommended approach

### CKRecord Field Mapping
- All card columns mapped to CKRecord string/int/double fields directly (no CKAsset). CloudKit supports up to 1MB per record -- card content is well under that
- Single custom record zone ("IsometryZone") for both Card and Connection record types. One change token tracks everything
- Record type names: "Card" and "Connection" -- simple, readable, 1:1 mapping to sql.js tables
- Connection source_id and target_id stored as CKRecord.Reference with .deleteSelf action. Matches ON DELETE CASCADE in SQL schema

### Claude's Discretion
- CKSyncEngine delegate implementation details
- Exact JSON schema for the offline queue file
- SyncMerger SQL implementation (INSERT OR REPLACE vs more nuanced merge)
- Error handling and retry logic for CKSyncEngine operations
- How to detect connectivity restoration (NWPathMonitor vs CKSyncEngine callbacks)

</decisions>

<specifics>
## Specific Ideas

- Migration is a one-time reverse of the existing autoMigrateIfNeeded() -- same pattern, opposite direction
- The existing `sendSyncNotification()` stub in BridgeManager is the starting point for the `native:sync` message path
- NativeImportCoordinator's chunked dispatch pattern is informational but NOT the model -- batched array in a single message is the chosen approach
- The enhanced `mutated` message carries both the dirty-flag signal (existing) and the sync changeset (new) -- backward compatible since JS already handles `mutated`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DatabaseManager` (actor): Checkpoint load/save pattern reusable. NSFileCoordinator and ubiquity logic will be stripped. Migration code reverses existing `autoMigrateIfNeeded()`
- `BridgeManager.sendSyncNotification()`: Existing stub sends `native:sync` messages to JS -- ready to be filled with real record data
- `NativeImportCoordinator`: Chunked bridge dispatch pattern shows how large payloads flow Swift -> JS (informational, not the sync model)
- `FeatureGate`: Can gate sync features by subscription tier if needed

### Established Patterns
- Actor-based DatabaseManager for thread-safe disk I/O
- @MainActor BridgeManager for all WKWebView interaction (evaluateJavaScript must be main thread)
- Bridge protocol: Swift <-> JS via `window.__isometry.receive()` and `nativeBridge` WKScriptMessageHandler
- Lifecycle management: `scenePhase` changes drive autosave start/stop and background save
- Database is opaque bytes from Swift's perspective (D-011 locked) -- CKSyncEngine is the first Swift code that understands record structure

### Integration Points
- `IsometryApp.handleScenePhaseChange(.active)`: Add foreground poll trigger for CKSyncEngine (Phase 40 will use this)
- `BridgeManager.didReceive()`: Handle enhanced `mutated` messages with changeset payloads
- `DatabaseManager.makeForProduction()`: Replace with simple Application Support init + one-time migration from ubiquity container
- `Isometry.entitlements`: Replace `CloudDocuments` with `CloudKit` capability
- `ContentView.setupWebView()`: DatabaseManager wiring stays the same (just simpler init path)

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 39-cloudkit-architecture*
*Context gathered: 2026-03-06*
