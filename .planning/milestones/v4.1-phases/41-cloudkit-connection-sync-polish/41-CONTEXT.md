# Phase 41: CloudKit Connection Sync + Polish - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Connections sync bidirectionally between devices alongside cards, soft-deleted cards propagate correctly via sync (as field updates, not CKRecord deletion), and multi-device workflows produce consistent data end-to-end. Phase 40 delivers card sync; this phase extends it to connections, wires up soft-delete propagation, expands the export-all path to include connections, and validates the complete sync pipeline.

Requirements: SYNC-02 (bidirectional connection sync), SYNC-07 (soft-delete propagation via sync).

</domain>

<decisions>
## Implementation Decisions

### Soft-delete propagation
- Soft-deletes sync as field updates: set `deleted_at` on the Card CKRecord and sync it as a normal field change. Card stays in CloudKit. CKRecord is NOT deleted.
- Connections to soft-deleted cards are hidden on the receiving device by existing `WHERE deleted_at IS NULL` join filters. Connections themselves stay in the DB -- they become visible again if the card is restored.
- No hard-purge path. Soft-deleted cards remain in CloudKit with `deleted_at` set indefinitely. Storage impact is negligible.
- Restoring a soft-deleted card (clearing `deleted_at`) syncs via the same mutation path -- just another field update. Connections reappear naturally. Zero new code needed for restore.

### Connection ordering in sync batches
- SyncMerger reorders each incoming batch to process Card records before Connection records. Ensures FK constraints are satisfied since `PRAGMA foreign_keys = ON` is enforced.
- If a connection still fails FK after sorting (card genuinely hasn't arrived yet in a split batch): log the error and skip. CKSyncEngine's change tracking will redeliver the connection on the next sync fetch. No local retry queue.
- Outgoing connections queue as PendingChanges independently -- no dependency tracking on whether referenced cards have synced yet. CloudKit has no FK constraints, so connection CKRecords upload fine regardless of card upload order.

### Export-all includes connections
- The `native:export-all-cards` bridge message (from Phase 40) must be extended to also export connections. Either rename to `native:export-all-records` or add a separate `native:export-all-connections` message.
- Both cards and connections are re-uploaded on `encryptedDataReset` recovery and first-launch initial upload. Ensures full data recovery.

### End-to-end validation
- TDD unit tests for: SyncMerger batch ordering (cards before connections), connection insert FK failure handling (graceful skip), soft-delete field propagation (deleted_at synced, connections hidden by existing queries).
- Manual multi-device test protocol documented in VERIFICATION.md as a step-by-step checklist: create card on A, verify on B, create connection, soft-delete, verify cascade, restore, verify reappear.

### Cascade edge cases
- Concurrent soft-delete + connect: both changes merge. Card X gets `deleted_at`, Connection Y->X is created. Connection exists in DB but hidden by join filters. If Card X is restored, connection reappears. No data loss.
- Parallel connection creation: both devices create different connections to the same card -- no conflict. Both connections have unique IDs, both sync normally via INSERT OR REPLACE, both end up on both devices.
- CKRecord.Reference `.deleteSelf` action is acceptable. Only triggers on CKRecord hard-deletion (zone purge/account reset), which is an extreme edge case. The `encryptedDataReset` path re-uploads everything from local DB anyway.

### Claude's Discretion
- Whether to rename `native:export-all-cards` to `native:export-all-records` or add a separate `native:export-all-connections` message
- Exact SyncMerger batch sort implementation (stable sort by recordType, or partition into two arrays)
- How to structure the FK failure logging (console.warn vs console.error, retry hint in message)
- Swift-side test approach (XCTest for SyncManager connection handling vs relying on JS-side tests)
- VERIFICATION.md checklist granularity and formatting

</decisions>

<specifics>
## Specific Ideas

- Most connection sync plumbing already exists from Phase 39: SyncManager handles Connection records in `handleFetchedRecordZoneChanges()`, `buildConnectionMergeSQL()` in SyncMerger does INSERT OR REPLACE, `BridgeManager.didReceive("mutated")` queues connection PendingChanges, `CKRecord.setConnectionFields()` maps fields with `.deleteSelf` references
- The primary new work is: batch ordering in SyncMerger, export-all expansion, soft-delete field propagation verification, and end-to-end validation
- Soft-delete propagation is nearly zero-code: `deleted_at` is already a synced card field, and existing query filters already exclude soft-deleted cards and their connections

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncManager.handleFetchedRecordZoneChanges()`: Already extracts connection fields (source_id, target_id, label, weight, via_card_id) and dispatches to JS SyncMerger. No changes needed for basic connection sync.
- `buildConnectionMergeSQL()` in NativeBridge.ts: Already builds INSERT OR REPLACE SQL for connection records. Needs batch ordering added above it.
- `BridgeManager.didReceive("mutated")`: Already queues PendingChange entries for connections with operation detection. Outgoing path is complete.
- `CKRecord.setConnectionFields()` / connection field extraction: Already maps source_id and target_id as CKRecord.Reference with `.deleteSelf` action.
- `SyncConstants.connectionRecordType = "Connection"`: Record type constant already defined.
- `deleted_at` field: Already in `cardStringFields` set in SyncTypes.swift, already synced as a CKRecord field, already used in partial indexes (`WHERE deleted_at IS NULL`).

### Established Patterns
- `PRAGMA foreign_keys = ON` enforced in Database.ts -- sync merges must respect FK constraints
- Partial indexes on `deleted_at IS NULL` -- soft-deleted cards automatically excluded from standard queries
- `ON DELETE CASCADE` on connections table FK refs -- if a card row is hard-deleted in SQL, connections auto-cascade
- SyncMerger processes records sequentially via `bridge.send('db:exec', stmt)` -- batch ordering is a sort before this loop
- Phase 40's `native:export-all-cards` bridge message pattern -- extend or parallel for connections

### Integration Points
- `handleNativeSync()` in NativeBridge.ts: Add batch sort (cards before connections) before the existing sequential execution loop
- Phase 40's export-all bridge message: Extend to include connections for `encryptedDataReset` and first-launch upload
- VERIFICATION.md: Add manual multi-device test protocol as a checklist section

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 41-cloudkit-connection-sync-polish*
*Context gathered: 2026-03-06*
