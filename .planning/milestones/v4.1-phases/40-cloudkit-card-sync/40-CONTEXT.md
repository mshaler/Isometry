# Phase 40: CloudKit Card Sync - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Bidirectional card sync between devices via CKSyncEngine with automatic conflict resolution, real-time push notification triggers, foreground polling, and a visible sync status indicator. Phase 39 delivered the infrastructure (SyncManager actor, offline queue, bridge protocol, SyncMerger). This phase wires up the actual card sync flow end-to-end. Connection sync and soft-delete propagation are Phase 41.

Requirements: SYNC-01 (bidirectional card sync), SYNC-04 (last-writer-wins conflict resolution), SYNC-05 (foreground poll), SYNC-06 (real-time push notifications), SYNC-09 (sync status indicator).

</domain>

<decisions>
## Implementation Decisions

### Conflict Resolution
- Server wins silently on CKSyncEngine `serverRecordChanged` errors. Accept the server's version, archive its system fields, discard the local edit. No field-level merge.
- No user notification on conflict resolution. Conflicts are silent -- the card updates to the server version without any toast, alert, or visual signal.
- On `encryptedDataReset` (account recovery): full re-upload of all local cards. Queue every card in sql.js as a PendingChange save. CKSyncEngine handles upload batching.

### Full Card Export for Re-upload
- New bridge message `native:export-all-cards`: Swift requests, JS responds with all card records as an array of `{ recordId, fields }` objects.
- Same message used for both first-launch initial upload and encryptedDataReset recovery. The caller context doesn't matter to JS -- it always returns all cards.
- On first CKSyncEngine launch (no persisted state serialization), trigger initial full upload so the cloud has all existing local cards from day one.

### Sync Status Indicator
- Native SwiftUI toolbar icon driven by SyncManager's published state. Not a JS-rendered element -- stays in the native chrome.
- 3 states matching SYNC-09: idle (cloud checkmark), syncing (animated cloud arrows), error (cloud with exclamation mark).
- Error details: tapping the error-state icon shows a brief popover with the error message. No interrupting alerts or toasts.

### Push & Poll Triggers
- Foreground poll: call CKSyncEngine `fetchChanges()` every time scenePhase transitions to `.active`. No debouncing -- CKSyncEngine internally deduplicates if there are no changes.
- Real-time push: rely on CKSyncEngine's automatic zone subscription management. Register for remote notifications in the app and forward `didReceiveRemoteNotification` to CKSyncEngine. No manual CKDatabaseSubscription.

### View Refresh After Sync
- After SyncMerger completes merging incoming records, trigger the active view's data provider to re-query sql.js. D3 data join handles enter/update/exit naturally -- same pattern as user edits.
- No visual distinction for synced cards. Synced cards look exactly like local cards -- sync is invisible plumbing.
- SyncMerger fires a JS-internal event to trigger provider re-query. Does NOT post `mutated` back to Swift via nativeBridge -- this prevents sync loops where incoming records get re-queued as outgoing changes.

### Claude's Discretion
- Exact SwiftUI toolbar icon SF Symbols and animation implementation
- How SyncManager publishes state to SwiftUI (ObservableObject wrapper, AsyncSequence, or Combine)
- CKSyncEngine fetchChanges() call pattern (direct method vs scheduling)
- JS-internal event mechanism for post-merge refresh (CustomEvent, callback, or direct provider call)
- Error popover SwiftUI implementation details
- Remote notification registration and forwarding plumbing (UIApplicationDelegate vs SwiftUI modifier)

</decisions>

<specifics>
## Specific Ideas

- The initial full upload and encryptedDataReset recovery share the same `native:export-all-cards` bridge message -- DRY, one code path
- SyncMerger's post-merge signal must be JS-internal only (no `mutated` to Swift) to prevent sync echo loops
- The toolbar sync icon should feel like iCloud's native sync indicators -- familiar, unobtrusive
- Server-wins conflict resolution is the simplest correct approach for single-user multi-device -- no user-facing conflict UI needed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncManager` (actor): CKSyncEngine delegate already handles `fetchedRecordZoneChanges`, `sentRecordZoneChanges`, state persistence, offline queue. Phase 40 extends it with conflict handling, foreground poll, and status publishing.
- `BridgeManager.sendSyncNotification()`: Already sends `native:sync` to JS with batched record arrays. Working end-to-end.
- `NativeBridge.ts SyncMerger`: Already handles `native:sync` messages, builds INSERT OR REPLACE SQL, executes via `bridge.send('db:exec')`. Needs post-merge refresh signal added.
- `NativeBridge.ts installMutationHook()`: Shows the pattern for hooking into bridge.send() -- the post-merge refresh can follow a similar event-dispatch approach.
- `BridgeManager.didReceive("mutated")`: Already extracts changesets and queues PendingChange entries to SyncManager. Outgoing path is complete.

### Established Patterns
- Actor-based SyncManager for thread-safe CKSyncEngine interaction
- @MainActor BridgeManager for all WKWebView JS evaluation
- `scenePhase` handler in IsometryApp for lifecycle events -- `.active` handler is the hook for foreground poll
- CKRecord system field archival via NSKeyedArchiver (Pitfall 2 prevention) -- already implemented
- Offline queue as Codable JSON file in Application Support -- already persists/loads

### Integration Points
- `IsometryApp.handleScenePhaseChange(.active)`: Add foreground `fetchChanges()` call on SyncManager
- `SyncManager.handleSentRecordZoneChanges()`: Add server-wins conflict resolution for `failedRecordSaves` with `.serverRecordChanged` error
- `SyncManager.handleFetchedDatabaseChanges()`: Implement `encryptedDataReset` re-upload (currently has a TODO comment)
- `ContentView` or `IsometryApp`: Add SwiftUI toolbar item for sync status icon
- `NativeBridge.ts handleNativeSync()`: Add JS-internal event dispatch after SyncMerger completes
- App delegate / SwiftUI: Register for remote notifications and forward to CKSyncEngine
- New bridge message: `native:export-all-cards` for initial upload and recovery

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 40-cloudkit-card-sync*
*Context gathered: 2026-03-06*
