# Phase 41: CloudKit Connection Sync + Polish - Research

**Researched:** 2026-03-07
**Domain:** CloudKit connection record sync, soft-delete field propagation, batch ordering for FK constraints, export-all extension, extractChangeset bug fixes, end-to-end multi-device validation
**Confidence:** HIGH

## Summary

Phase 41 extends Phase 40's card sync to connections and validates soft-delete propagation end-to-end. Two requirements remain: SYNC-02 (bidirectional connection sync) and SYNC-07 (soft-delete propagation via sync). The existing codebase already has most of the plumbing built. SyncManager.handleFetchedRecordZoneChanges() extracts connection fields (source_id, target_id, label, weight, via_card_id) and dispatches them to JS. BridgeManager.didReceive("mutated") queues connection PendingChanges with operation detection. SyncManager.buildBatch() populates CKRecord connection fields with CKRecord.Reference (`.deleteSelf` action). NativeBridge.ts buildConnectionMergeSQL() runs INSERT OR REPLACE for incoming connections.

The primary new work is: (1) batch ordering in handleNativeSync to process Card records before Connection records (FK constraint satisfaction), (2) graceful FK failure handling for split-batch edge cases, (3) extending the export-all bridge message to include connections, (4) fixing extractChangeset bugs (soft-delete operation mapping and missing fields for create operations), and (5) end-to-end validation.

Research uncovered two critical bugs in the existing `extractChangeset` function:
- **Bug 1 (SYNC-07 blocker):** `card:delete` returns `operation: 'delete'`, but the Worker performs a SOFT delete (`UPDATE cards SET deleted_at = ? WHERE id = ?`). BridgeManager maps this to a CKRecord DELETE, permanently removing the record from CloudKit. CONTEXT.md explicitly requires soft-deletes to sync as field updates.
- **Bug 2 (SYNC-02 blocker):** `card:create` and `connection:create` access `payload['id']`, but the payload shape is `{ input: CardInput }` / `{ input: ConnectionInput }` -- there is no top-level `id`. The `id` is generated inside the Worker and returned as the `result`. This means create operations produce changesets with `recordId: undefined`, creating broken PendingChange entries.

**Primary recommendation:** Fix extractChangeset to (a) pass `result` alongside `payload` for access to generated ids, (b) change `card:delete` to `operation: 'update'` with `deleted_at` field, (c) include connection fields from `payload.input` for `connection:create`. Then add batch ordering in handleNativeSync, extend exportAllCards to include connections, and write focused TDD tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Soft-deletes sync as field updates: set `deleted_at` on the Card CKRecord and sync it as a normal field change. Card stays in CloudKit. CKRecord is NOT deleted.
- Connections to soft-deleted cards are hidden on the receiving device by existing `WHERE deleted_at IS NULL` join filters. Connections themselves stay in the DB -- they become visible again if the card is restored.
- No hard-purge path. Soft-deleted cards remain in CloudKit with `deleted_at` set indefinitely. Storage impact is negligible.
- Restoring a soft-deleted card (clearing `deleted_at`) syncs via the same mutation path -- just another field update. Connections reappear naturally. Zero new code needed for restore.
- SyncMerger reorders each incoming batch to process Card records before Connection records. Ensures FK constraints are satisfied since `PRAGMA foreign_keys = ON` is enforced.
- If a connection still fails FK after sorting (card genuinely hasn't arrived yet in a split batch): log the error and skip. CKSyncEngine's change tracking will redeliver the connection on the next sync fetch. No local retry queue.
- Outgoing connections queue as PendingChanges independently -- no dependency tracking on whether referenced cards have synced yet. CloudKit has no FK constraints, so connection CKRecords upload fine regardless of card upload order.
- The `native:export-all-cards` bridge message (from Phase 40) must be extended to also export connections. Either rename to `native:export-all-records` or add a separate `native:export-all-connections` message.
- Both cards and connections are re-uploaded on `encryptedDataReset` recovery and first-launch initial upload. Ensures full data recovery.
- TDD unit tests for: SyncMerger batch ordering (cards before connections), connection insert FK failure handling (graceful skip), soft-delete field propagation (deleted_at synced, connections hidden by existing queries).
- Manual multi-device test protocol documented in VERIFICATION.md as a step-by-step checklist.
- Concurrent soft-delete + connect: both changes merge. Connection exists in DB but hidden by join filters. If card is restored, connection reappears. No data loss.
- Parallel connection creation: both devices create different connections to the same card -- no conflict. Both connections have unique IDs, both sync normally via INSERT OR REPLACE.
- CKRecord.Reference `.deleteSelf` action is acceptable. Only triggers on CKRecord hard-deletion (zone purge/account reset), which is an extreme edge case.

### Claude's Discretion
- Whether to rename `native:export-all-cards` to `native:export-all-records` or add a separate `native:export-all-connections` message
- Exact SyncMerger batch sort implementation (stable sort by recordType, or partition into two arrays)
- How to structure the FK failure logging (console.warn vs console.error, retry hint in message)
- Swift-side test approach (XCTest for SyncManager connection handling vs relying on JS-side tests)
- VERIFICATION.md checklist granularity and formatting

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-02 | Connections sync bidirectionally between devices alongside cards | Incoming path built (SyncManager extracts connection fields, SyncMerger runs INSERT OR REPLACE). Outgoing path has bugs: `connection:create` extractChangeset produces undefined recordId (Bug 2). Missing: batch ordering for FK constraints, export-all connection extension, extractChangeset fixes for connection:create |
| SYNC-07 | Soft-deleted cards on one device are marked deleted on other devices via sync | `deleted_at` field syncs correctly (in `cardStringFields`, merged via buildCardMergeSQL). **Critical bug:** extractChangeset maps `card:delete` to CKRecord DELETE instead of field update (Bug 1). Views correctly filter via `WHERE deleted_at IS NULL`. Connections hidden indirectly by card-level filtering |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CloudKit (CKSyncEngine) | iOS 17+ / macOS 14+ | Connection record sync, soft-delete field propagation | Already initialized, handles Card + Connection record types |
| sql.js (WASM) | 1.14 | INSERT OR REPLACE for incoming connections, FK constraint enforcement | `PRAGMA foreign_keys = ON` enforced in Database.ts |
| Vitest | 4.0 | Unit tests for batch ordering, FK failure handling, extractChangeset fixes | Existing test runner, established pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| os.Logger (Swift) | Built-in | Sync operation logging | Already used in SyncManager.swift |

### Not Needed
| Instead of | Why Not |
|------------|---------|
| New Swift data models | Connection CKRecord mapping already exists in SyncTypes.swift |
| New bridge message types | Extend existing `native:export-all-cards` to include connections |
| Custom retry queue for FK failures | CKSyncEngine redelivers on next sync fetch |
| Connection-level soft-delete | Connections don't have `deleted_at`; card-level filtering is sufficient |

## Architecture Patterns

### Recommended Changes Map
```
src/native/
  NativeBridge.ts              # MODIFIED: batch ordering in handleNativeSync, export-all extension,
                               #           extractChangeset bug fixes (card:delete, connection:create,
                               #           card:create), mutation hook passes result to extractChangeset

native/Isometry/Isometry/
  BridgeManager.swift          # MODIFIED: export-all handler extended to process connections

tests/
  NativeBridge.test.ts         # MODIFIED: new tests for batch ordering, FK failure handling,
                               #           extractChangeset fixes
```

### Pattern 1: Batch Ordering (Cards Before Connections)
**What:** Sort the incoming records array in handleNativeSync so all Card records are processed before Connection records, satisfying FK constraints.
**When to use:** At the top of handleNativeSync, before building SQL statements.
**Why partition over sort:** A simple partition (filter into two arrays, concat) is clearer than a sort comparator and guaranteed stable.
**Example:**
```typescript
// Source: CONTEXT.md locked decision + PRAGMA foreign_keys = ON requirement
// Partition records: cards first, then connections
const cards = payload.records.filter(r => r.recordType === 'Card');
const connections = payload.records.filter(r => r.recordType !== 'Card');
const ordered = [...cards, ...connections];
```

**Recommendation:** Use partition (two filter passes + concat) rather than Array.sort. Partition is O(n), guaranteed stable, and more readable than a sort comparator. The array sizes are small (CKSyncEngine batches are typically < 400 records).

### Pattern 2: FK Failure Graceful Skip
**What:** When a connection INSERT OR REPLACE fails with an FK constraint error, log the failure and skip to the next record. CKSyncEngine will redeliver the connection on the next sync fetch.
**When to use:** In the per-statement try/catch loop in handleNativeSync. Already implemented -- no changes needed.
**Why this works:** CKSyncEngine tracks which records have been successfully acknowledged. If we don't process a record, the engine will include it in the next fetch. No local retry queue is needed.
**Key insight:** The existing try/catch loop already handles this pattern. The only addition needed is ensuring batch ordering happens first (Pattern 1).

### Pattern 3: Export-All Extension for Connections
**What:** Extend the existing `exportAllCards` handler to also query and export connections. Both cards and connections are sent back to Swift in a single message.
**When to use:** In the `exportAllCards` handler on `window.__isometry` in NativeBridge.ts, and in BridgeManager.swift's `native:export-all-cards` handler.
**Recommendation:** Keep the existing message name `native:export-all-cards` but add a `connections` array to the payload. Avoids a new message type and keeps the export atomic.
**Example (JS side):**
```typescript
// Extended exportAllCards -- sends both cards and connections
iso['exportAllCards'] = async () => {
  try {
    const cards = await unwrappedSend('db:query' as any, {
      sql: 'SELECT * FROM cards WHERE deleted_at IS NULL',
      params: []
    });
    const connections = await unwrappedSend('db:query' as any, {
      sql: 'SELECT * FROM connections',
      params: []
    });
    window.webkit!.messageHandlers.nativeBridge.postMessage({
      id: crypto.randomUUID(),
      type: 'native:export-all-cards',
      payload: { cards, connections },
      timestamp: Date.now(),
    });
    console.log('[NativeBridge] exportAllCards: exported',
      (cards as any[])?.length ?? 0, 'cards,',
      (connections as any[])?.length ?? 0, 'connections');
  } catch (err) {
    console.error('[NativeBridge] exportAllCards failed:', err);
  }
};
```

**Example (Swift side):**
```swift
// In BridgeManager.didReceive(), extend "native:export-all-cards" case:
// After existing card processing loop, add connection processing:
let connections = payload["connections"] as? [[String: Any]] ?? []
for conn in connections {
    guard let recordId = conn["id"] as? String else { continue }
    var fields: [String: CodableValue] = [:]
    for (key, value) in conn {
        if key == "id" { continue }
        fields[key] = CodableValue.from(value)
    }
    let pending = PendingChange(
        id: UUID().uuidString,
        recordType: SyncConstants.connectionRecordType,
        recordId: recordId,
        operation: "save",
        fields: fields,
        timestamp: Date()
    )
    await syncManager?.addPendingChange(pending)
}
```

**Connection export query:** Use `SELECT * FROM connections` (all connections, including those referencing soft-deleted cards). Rationale: Connections referencing soft-deleted cards still reference valid CKRecords (since soft-deletes don't remove CKRecords). If the user later restores the card, the connection is already synced.

### Pattern 4: extractChangeset Bug Fixes
**What:** Fix three bugs in the extractChangeset function that break outgoing sync.
**When to use:** In NativeBridge.ts, modifying extractChangeset and the mutation hook that calls it.

**Bug 1 Fix: card:delete operation mapping (SYNC-07)**
```typescript
// BEFORE (broken):
case 'card:delete':
  return [{ recordType: 'Card', recordId: payload['id'] as string, operation: 'delete' }];

// AFTER (fixed):
case 'card:delete':
  // SYNC-07: Soft-delete syncs as field update, NOT CKRecord deletion
  // Worker runs UPDATE cards SET deleted_at = <timestamp> WHERE id = ?
  // We must sync this as a field update to preserve the CKRecord in CloudKit
  return [{
    recordType: 'Card',
    recordId: payload['id'] as string,
    operation: 'update',
    fields: { deleted_at: new Date().toISOString() }
  }];
```

**Bug 2 Fix: create operations missing id (SYNC-02)**
The mutation hook must pass the `result` to extractChangeset so create operations can access the generated id.

```typescript
// BEFORE (broken):
const changes = extractChangeset(type, payload);

// AFTER (fixed):
const changes = extractChangeset(type, payload, result);
```

```typescript
// Updated extractChangeset signature:
function extractChangeset(
  type: string,
  payload: any,
  result?: any  // Added: return value from bridge.send, contains generated id for create ops
): Array<{ ... }> | undefined {
  switch (type) {
    case 'card:create':
      // result is Card with generated id
      if (!result?.id) return undefined;
      return [{ recordType: 'Card', recordId: result.id, operation: 'insert' }];

    case 'card:update':
      return [{ recordType: 'Card', recordId: payload['id'], operation: 'update', fields: payload['updates'] }];

    case 'card:delete':
      return [{
        recordType: 'Card',
        recordId: payload['id'],
        operation: 'update',
        fields: { deleted_at: new Date().toISOString() }
      }];

    case 'card:undelete':
      return [{
        recordType: 'Card',
        recordId: payload['id'],
        operation: 'update',
        fields: { deleted_at: null }
      }];

    case 'connection:create':
      // result is Connection with generated id; payload.input has the fields
      if (!result?.id) return undefined;
      return [{
        recordType: 'Connection',
        recordId: result.id,
        operation: 'insert',
        fields: {
          source_id: payload['input']?.source_id,
          target_id: payload['input']?.target_id,
          label: payload['input']?.label ?? null,
          weight: payload['input']?.weight ?? 1.0,
          via_card_id: payload['input']?.via_card_id ?? null,
        }
      }];

    case 'connection:delete':
      return [{ recordType: 'Connection', recordId: payload['id'], operation: 'delete' }];

    default:
      return undefined;
  }
}
```

**Key insight:** The mutation hook already has access to `result` (the return value from `bridge.send`). It just doesn't pass it to `extractChangeset`. A one-line change in the hook + a signature update on `extractChangeset` fixes both create operation bugs.

### Pattern 5: Soft-Delete Propagation (Mostly Working, One Fix Needed)
**What:** When a card is soft-deleted, the `deleted_at` field syncs as a normal card field update.
**Current state:**
- Incoming path (Device B receives soft-delete from Device A): WORKING. `deleted_at` is in `cardStringFields`, synced as a CKRecord string field, merged via `buildCardMergeSQL` (INSERT OR REPLACE includes `deleted_at`). Views filter via `WHERE cards.deleted_at IS NULL`.
- Outgoing path (Device A sends soft-delete to CloudKit): BROKEN. `card:delete` in `extractChangeset` returns `operation: 'delete'`, which maps to CKRecord DELETE in CloudKit. Must be changed to `operation: 'update'` with `deleted_at` field (Bug 1 fix above).

**How connections are hidden:** The schema has `ON DELETE CASCADE` on connections FK refs, but that only fires on SQL row deletion (hard delete). For soft-deletes, connections stay in the DB. They are hidden by view queries that JOIN with `WHERE cards.deleted_at IS NULL` (graph.ts) or only query connections for non-deleted card IDs (NetworkView.ts fetches card IDs first, then queries connections for those IDs).

### Anti-Patterns to Avoid
- **Queuing card:delete as CKRecord DELETE:** Soft-deletes must sync as field updates. CKRecord deletion removes the record from CloudKit permanently, preventing restore and breaking the `deleted_at` propagation model.
- **Building a local retry queue for FK failures:** CKSyncEngine already tracks which records need redelivery. Let the engine handle it.
- **Adding `deleted_at` to the connections table:** Connections are hidden via card-level query filtering. Adding a separate soft-delete column on connections creates sync complexity for zero benefit.
- **Creating a new bridge message type for connection export:** Extending the existing `native:export-all-cards` payload is simpler and keeps the bridge protocol minimal.
- **Using extractChangeset payload['id'] for create operations:** The id is generated in the Worker and returned in `result`, not present in `payload`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Connection redelivery after FK failure | Custom retry queue with timers | CKSyncEngine automatic redelivery | Engine tracks unacknowledged records |
| Connection ordering for CloudKit upload | Outgoing dependency tracker | Direct PendingChange queuing | CloudKit has no FK constraints; order doesn't matter for uploads |
| Soft-delete propagation for connections | Connection-level deleted_at field | Card-level WHERE deleted_at IS NULL filters | Existing query patterns already exclude soft-deleted card connections |
| Full database re-upload orchestration | Custom upload coordinator | CKSyncEngine.RecordZoneChangeBatch | Engine handles batching and retry |

**Key insight:** Phase 41 is primarily about wiring together existing pieces and fixing two bugs in extractChangeset. The connection sync plumbing (Swift-side extraction, JS-side merge, outgoing queue, CKRecord field mapping) is all built. The work is batch ordering, export extension, extractChangeset fixes, and validation.

## Common Pitfalls

### Pitfall 1: FK Constraint Violation on Connection INSERT
**What goes wrong:** CKSyncEngine delivers a batch where a Connection record arrives before its referenced Card record. `PRAGMA foreign_keys = ON` causes the INSERT to fail.
**Why it happens:** CKSyncEngine does not guarantee record ordering within a batch. Cards and connections can arrive in any order.
**How to avoid:** Sort incoming records by recordType (Card first) before processing. Handle remaining FK failures gracefully (split-batch edge case where card hasn't arrived at all yet).
**Warning signs:** `FOREIGN KEY constraint failed` errors in console during sync.

### Pitfall 2: Soft-Delete Queued as CKRecord DELETE (CONFIRMED BUG)
**What goes wrong:** When a user soft-deletes a card (`card:delete` mutation), `extractChangeset` returns `operation: 'delete'`, and BridgeManager maps this to CKSyncEngine DELETE. This permanently removes the CKRecord from CloudKit, preventing restore and breaking SYNC-07.
**Root cause confirmed:** Worker's `deleteCard()` runs `UPDATE cards SET deleted_at = ? WHERE id = ?` (soft delete, line 257 of cards.ts). But `extractChangeset` returns `operation: 'delete'` (line 489 of NativeBridge.ts). BridgeManager maps `"delete"` to PendingChange `operation: "delete"` (line 179 of BridgeManager.swift). SyncManager queues `.deleteRecord(recordID)` for CKSyncEngine (line 104 of SyncManager.swift).
**How to avoid:** Change `card:delete` in extractChangeset to return `operation: 'update'` with `fields: { deleted_at: <timestamp> }`.
**Warning signs:** Soft-deleted cards disappear from CloudKit entirely; restoring a card fails because the CKRecord no longer exists.

### Pitfall 3: Create Operations Produce Undefined recordId (CONFIRMED BUG)
**What goes wrong:** `card:create` and `connection:create` in extractChangeset access `payload['id']`, but the payload shape is `{ input: CardInput }` / `{ input: ConnectionInput }`. There is no top-level `id`. The `id` is generated inside the Worker (`crypto.randomUUID()`) and returned as part of `result`.
**Root cause confirmed:** `WorkerPayloads['card:create']` is `{ input: CardInput }` (protocol.ts line 205). `WorkerPayloads['connection:create']` is `{ input: ConnectionInput }` (protocol.ts line 213). `WorkerResponses['card:create']` is `Card` (has `.id`). `WorkerResponses['connection:create']` is `Connection` (has `.id`).
**How to avoid:** Pass `result` (the return value from `bridge.send`) to `extractChangeset`. Use `result.id` for create operations.
**Warning signs:** PendingChange entries with undefined recordId; CKRecords created with undefined recordName.

### Pitfall 4: Connection Create Missing Fields in PendingChange
**What goes wrong:** `connection:create` in extractChangeset returns only `{ recordType, recordId, operation }` without fields. SyncManager.buildBatch creates a CKRecord with no fields set (except recordType and recordID). The CKRecord uploads to CloudKit with no source_id, target_id, label, or weight.
**Why it happens:** extractChangeset was designed to minimize payload size for the changeset. For card:update, it includes `fields: payload['updates']`. But for create operations, it includes no fields.
**How to avoid:** Include connection fields from `payload['input']` in the changeset for `connection:create`. For `card:create`, the full card should be included too -- but Phase 40's export-all-cards handles the initial upload case.
**Warning signs:** Connection CKRecords in CloudKit have empty fields; connections on Device B have NULL source_id/target_id.

### Pitfall 5: Export-All Missing Connections on encryptedDataReset
**What goes wrong:** After an encrypted data reset or first-launch upload, only cards are re-uploaded to CloudKit. Connections are lost.
**Why it happens:** Phase 40's exportAllCards only queries the `cards` table.
**How to avoid:** Extend exportAllCards to also query and export the `connections` table.
**Warning signs:** Connections missing on other device after account recovery.

### Pitfall 6: NetworkView Query References Non-Existent Column
**What goes wrong:** NetworkView.ts line 198 has `AND c.deleted_at IS NULL` where `c` aliases the `connections` table. Connections have no `deleted_at` column.
**Impact:** Benign -- SQLite evaluates `NULL IS NULL` as TRUE, so the filter passes all rows. No data loss. But it's technically incorrect SQL.
**Recommendation:** Note as pre-existing tech debt. Optional fix during this phase (change to card-level filtering or remove the clause since connections for non-deleted cards are already filtered by the cardIds IN clause).

## Code Examples

### Batch Ordering in handleNativeSync
```typescript
// Source: CONTEXT.md locked decision + schema.sql FK constraints
async function handleNativeSync(
  dbExec: (type: Parameters<WorkerBridge['send']>[0], payload: { sql: string; params: unknown[] }) => Promise<unknown>,
  payload: {
    records: Array<{
      recordType: string;
      recordId: string;
      operation: string;
      fields?: Record<string, unknown>;
    }>;
  }
): Promise<void> {
  if (!payload.records || payload.records.length === 0) return;

  // SYNC-02: Reorder batch -- cards before connections for FK constraint satisfaction
  const cardRecords = payload.records.filter(r => r.recordType === 'Card');
  const connectionRecords = payload.records.filter(r => r.recordType !== 'Card');
  const ordered = [...cardRecords, ...connectionRecords];

  const statements = ordered.map(rec => {
    if (rec.operation === 'delete') {
      const table = rec.recordType === 'Card' ? 'cards' : 'connections';
      return { sql: `DELETE FROM ${table} WHERE id = ?`, params: [rec.recordId] as unknown[] };
    }
    if (rec.recordType === 'Card') {
      return buildCardMergeSQL(rec.recordId, rec.fields ?? {});
    } else {
      return buildConnectionMergeSQL(rec.recordId, rec.fields ?? {});
    }
  });

  let successCount = 0;
  for (const stmt of statements) {
    try {
      await dbExec('db:exec' as Parameters<typeof dbExec>[0], stmt);
      successCount++;
    } catch (err) {
      // FK failure on connection: card hasn't arrived yet (split batch)
      // CKSyncEngine will redeliver on next sync fetch
      console.error('[NativeBridge] native:sync: statement failed:', stmt.sql, err);
    }
  }

  if (successCount > 0) {
    window.dispatchEvent(new CustomEvent('isometry:sync-complete', {
      detail: { recordCount: successCount }
    }));
  }
}
```

### Fixed extractChangeset with Result Access
```typescript
// Source: Bug investigation against protocol.ts WorkerPayloads/WorkerResponses
function extractChangeset(
  type: string,
  payload: any,
  result?: any  // Return value from bridge.send -- has generated id for create ops
): Array<{ recordType: string; recordId: string; operation: string; fields?: Record<string, unknown> }> | undefined {
  switch (type) {
    case 'card:create':
      if (!result?.id) return undefined;
      return [{ recordType: 'Card', recordId: result.id, operation: 'insert' }];

    case 'card:update':
      return [{ recordType: 'Card', recordId: payload['id'], operation: 'update', fields: payload['updates'] }];

    case 'card:delete':
      // SYNC-07: Soft-delete syncs as field update, NOT CKRecord deletion
      return [{
        recordType: 'Card',
        recordId: payload['id'],
        operation: 'update',
        fields: { deleted_at: new Date().toISOString() }
      }];

    case 'card:undelete':
      // SYNC-07: Restore syncs as field update clearing deleted_at
      return [{
        recordType: 'Card',
        recordId: payload['id'],
        operation: 'update',
        fields: { deleted_at: null }
      }];

    case 'connection:create':
      // SYNC-02: result has generated id; payload.input has connection fields
      if (!result?.id) return undefined;
      return [{
        recordType: 'Connection',
        recordId: result.id,
        operation: 'insert',
        fields: {
          source_id: payload['input']?.source_id,
          target_id: payload['input']?.target_id,
          label: payload['input']?.label ?? null,
          weight: payload['input']?.weight ?? 1.0,
          via_card_id: payload['input']?.via_card_id ?? null,
        }
      }];

    case 'connection:delete':
      return [{ recordType: 'Connection', recordId: payload['id'], operation: 'delete' }];

    case 'db:exec':
    case 'etl:import':
    case 'etl:import-native':
      return undefined;

    default:
      return undefined;
  }
}
```

### Mutation Hook Update (Pass Result)
```typescript
// Source: existing installMutationHook in NativeBridge.ts
// One-line change: pass result to extractChangeset
if (MUTATING_TYPES.has(type)) {
  try {
    const changes = extractChangeset(type, payload, result);  // <-- added result
    window.webkit!.messageHandlers.nativeBridge.postMessage({
      id: crypto.randomUUID(),
      type: 'mutated',
      payload: changes ? { changes } : {},
      timestamp: Date.now(),
    });
  } catch {
    // Silently swallow
  }
}
```

### Connection Export Extension (Swift)
```swift
// Source: existing native:export-all-cards handler in BridgeManager.swift
// Add connection processing after existing card loop:
let connections = payload["connections"] as? [[String: Any]] ?? []
logger.info("native:export-all-cards: received \(connections.count) connections for upload")
for conn in connections {
    guard let recordId = conn["id"] as? String else { continue }
    var fields: [String: CodableValue] = [:]
    for (key, value) in conn {
        if key == "id" { continue }
        fields[key] = CodableValue.from(value)
    }
    let pending = PendingChange(
        id: UUID().uuidString,
        recordType: SyncConstants.connectionRecordType,
        recordId: recordId,
        operation: "save",
        fields: fields,
        timestamp: Date()
    )
    await syncManager?.addPendingChange(pending)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Card-only sync (Phase 40) | Card + Connection sync | Phase 41 | Connections sync alongside cards with FK ordering |
| card:delete as CKRecord DELETE | card:delete as field update | Phase 41 fix | Preserves CKRecord for restore capability |
| Card-only export-all | Card + Connection export-all | Phase 41 | Full data recovery on encryptedDataReset |
| extractChangeset without result | extractChangeset with result | Phase 41 fix | Create operations get correct generated id |

**Key code already built (Phase 39-40):**
- SyncManager.handleFetchedRecordZoneChanges: Connection field extraction (source_id, target_id, label, weight, via_card_id as CKRecord.Reference dereference)
- SyncManager.buildBatch: Connection CKRecord population via setConnectionFields with .deleteSelf references
- BridgeManager.didReceive("mutated"): Connection changeset extraction and PendingChange queuing
- NativeBridge.ts buildConnectionMergeSQL: INSERT OR REPLACE SQL for incoming connection records
- NativeBridge.ts extractChangeset: connection:create and connection:delete operations (with bugs)
- SyncTypes.swift setConnectionFields/cardFieldsDictionary: CKRecord <-> CodableValue mapping

## Open Questions

1. **Connection Export Query -- Include All or Only Active?**
   - What we know: Cards are exported with `WHERE deleted_at IS NULL`. Connections don't have `deleted_at`.
   - Resolution: Export ALL connections (`SELECT * FROM connections`). Connections referencing soft-deleted cards will reference valid CKRecords (since soft-deletes don't remove CKRecords). If the user restores the card, the connection is already present. This matches CONTEXT.md: "Connections themselves stay in the DB."
   - **Confidence:** HIGH -- CONTEXT.md explicitly addresses this.

2. **card:create Missing Fields in PendingChange**
   - What we know: `card:create` extractChangeset returns only `{ recordType, recordId, operation }` without fields. SyncManager.buildBatch creates a CKRecord with no fields.
   - Impact: Newly created cards would upload to CloudKit as empty records. However, this is mitigated by the export-all-cards path which re-uploads all cards with full fields on first launch.
   - Recommendation: For card:create, include fields from `result` (the full Card object returned by the Worker). This ensures immediate sync without waiting for the export-all-cards path.
   - **Confidence:** MEDIUM -- need to verify if this is causing issues in practice. The export-all path may mask this bug.

## Sources

### Primary (HIGH confidence)
- **Existing codebase (verified by code inspection):**
  - SyncManager.swift lines 247-329: Connection field extraction, connection CKRecord.Reference handling
  - SyncTypes.swift lines 240-273: setConnectionFields with .deleteSelf references
  - NativeBridge.ts lines 452-467: buildConnectionMergeSQL INSERT OR REPLACE
  - NativeBridge.ts lines 478-504: extractChangeset with confirmed bugs
  - BridgeManager.swift lines 153-186: mutated changeset processing, PendingChange creation
  - cards.ts lines 255-258: deleteCard is UPDATE (soft delete), not DELETE
  - protocol.ts lines 205-213: WorkerPayloads shapes for card:create and connection:create
  - protocol.ts lines 272-280: WorkerResponses shapes (Card and Connection with .id)
  - schema.sql lines 71-95: connections table FK constraints with ON DELETE CASCADE
- **CONTEXT.md locked decisions:** Batch ordering, FK failure handling, soft-delete propagation model
- **Phase 40 RESEARCH.md:** CKSyncEngine patterns, sync echo loop prevention, export-all bridge message

### Secondary (MEDIUM confidence)
- CKSyncEngine documentation: Record redelivery behavior for unprocessed records

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components already exist from Phase 39-40; extending, not building
- Architecture: HIGH - Patterns established by Phase 40; batch ordering is partition + concat; export extension mirrors existing pattern
- Pitfalls: HIGH - Two confirmed bugs found via code inspection (extractChangeset card:delete + create operations). FK constraint handling is well-understood.
- Soft-delete propagation: HIGH - Incoming path confirmed working. Outgoing path has confirmed bug with clear fix path.

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- stable infrastructure, minimal external dependencies)
