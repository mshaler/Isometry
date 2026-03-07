# Phase 40: CloudKit Card Sync - Research

**Researched:** 2026-03-07
**Domain:** CKSyncEngine conflict resolution, push notifications, foreground polling, sync status UI, post-merge view refresh
**Confidence:** HIGH

## Summary

Phase 40 wires up end-to-end card sync on top of Phase 39's CKSyncEngine infrastructure. Five requirements need addressing: bidirectional card sync (SYNC-01), last-writer-wins conflict resolution (SYNC-04), foreground poll on scenePhase `.active` (SYNC-05), real-time push notification triggers (SYNC-06), and a sync status toolbar indicator (SYNC-09).

The existing codebase already has most of the plumbing. SyncManager handles `fetchedRecordZoneChanges` (incoming) and `sentRecordZoneChanges` (outgoing). BridgeManager's `didReceive("mutated")` queues outgoing changes. NativeBridge.ts SyncMerger runs INSERT OR REPLACE SQL for incoming records. What's missing: (1) conflict resolution in `handleSentRecordZoneChanges` for `.serverRecordChanged` errors, (2) foreground `fetchChanges()` call in `handleScenePhaseChange(.active)`, (3) remote notification registration and forwarding to CKSyncEngine, (4) a SwiftUI toolbar icon publishing SyncManager's state, (5) JS-internal post-merge refresh signal that does NOT trigger the `mutated` bridge message, and (6) `native:export-all-cards` bridge message for initial upload and encryptedDataReset recovery.

**Primary recommendation:** Implement server-wins conflict resolution (discard local edit, accept server record, archive system fields, re-queue to reconcile), foreground fetchChanges() on `.active`, and a `@MainActor` ObservableObject wrapper that publishes SyncManager's state to SwiftUI for the toolbar icon. For push notifications, CKSyncEngine handles zone subscriptions automatically -- the app only needs to register for remote notifications and the engine picks them up. For post-merge refresh, dispatch a JS CustomEvent that ViewManager or StateCoordinator can subscribe to.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Conflict Resolution**: Server wins silently on CKSyncEngine `serverRecordChanged` errors. Accept the server's version, archive its system fields, discard the local edit. No field-level merge. No user notification on conflict resolution. Conflicts are silent -- the card updates to the server version without any toast, alert, or visual signal. On `encryptedDataReset` (account recovery): full re-upload of all local cards. Queue every card in sql.js as a PendingChange save. CKSyncEngine handles upload batching.
- **Full Card Export for Re-upload**: New bridge message `native:export-all-cards`: Swift requests, JS responds with all card records as an array of `{ recordId, fields }` objects. Same message used for both first-launch initial upload and encryptedDataReset recovery. On first CKSyncEngine launch (no persisted state serialization), trigger initial full upload so the cloud has all existing local cards from day one.
- **Sync Status Indicator**: Native SwiftUI toolbar icon driven by SyncManager's published state. Not a JS-rendered element -- stays in the native chrome. 3 states matching SYNC-09: idle (cloud checkmark), syncing (animated cloud arrows), error (cloud with exclamation mark). Error details: tapping the error-state icon shows a brief popover with the error message. No interrupting alerts or toasts.
- **Push & Poll Triggers**: Foreground poll: call CKSyncEngine `fetchChanges()` every time scenePhase transitions to `.active`. No debouncing -- CKSyncEngine internally deduplicates if there are no changes. Real-time push: rely on CKSyncEngine's automatic zone subscription management. Register for remote notifications in the app and forward `didReceiveRemoteNotification` to CKSyncEngine. No manual CKDatabaseSubscription.
- **View Refresh After Sync**: After SyncMerger completes merging incoming records, trigger the active view's data provider to re-query sql.js. D3 data join handles enter/update/exit naturally -- same pattern as user edits. No visual distinction for synced cards. SyncMerger fires a JS-internal event to trigger provider re-query. Does NOT post `mutated` back to Swift via nativeBridge -- this prevents sync loops where incoming records get re-queued as outgoing changes.

### Claude's Discretion
- Exact SwiftUI toolbar icon SF Symbols and animation implementation
- How SyncManager publishes state to SwiftUI (ObservableObject wrapper, AsyncSequence, or Combine)
- CKSyncEngine fetchChanges() call pattern (direct method vs scheduling)
- JS-internal event mechanism for post-merge refresh (CustomEvent, callback, or direct provider call)
- Error popover SwiftUI implementation details
- Remote notification registration and forwarding plumbing (UIApplicationDelegate vs SwiftUI modifier)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | Cards sync bidirectionally between devices via CKSyncEngine with custom record zone | Phase 39 delivered outgoing (mutated -> PendingChange -> CKSyncEngine) and incoming (fetchedRecordZoneChanges -> native:sync -> SyncMerger) paths. Phase 40 completes the loop with conflict resolution, initial upload, post-merge refresh, and encryptedDataReset recovery |
| SYNC-04 | When two devices edit the same card, the later modification wins (last-writer-wins) | Server-wins on `.serverRecordChanged` error in `handleSentRecordZoneChanges`. Accept server record, archive its system fields, discard local edit. CKSyncEngine surfaces the conflict via `failedRecordSaves` with the server's version attached |
| SYNC-05 | App polls for CloudKit changes on launch and when returning to foreground | Call `syncEngine.fetchChanges()` in `handleScenePhaseChange(.active)`. CKSyncEngine internally deduplicates if no server changes. Do NOT call fetchChanges() inside handleEvent delegate methods |
| SYNC-06 | App receives real-time push notifications when another device makes changes | CKSyncEngine automatically manages zone subscriptions and listens for push notifications. App must (1) have `aps-environment` in entitlements (already present from Phase 39), (2) call `registerForRemoteNotifications()` at launch, (3) NOT need to forward `didReceiveRemoteNotification` manually -- CKSyncEngine listens directly |
| SYNC-09 | User can see sync status indicator (idle/syncing/error) in the UI | SwiftUI toolbar item with SF Symbol driven by `@Published` state on an ObservableObject wrapper around SyncManager's actor-isolated state. Use CKSyncEngine lifecycle events (willFetchChanges/didFetchChanges, willSendChanges/didSendChanges) to track syncing state |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CloudKit (CKSyncEngine) | iOS 17+ / macOS 14+ | Conflict resolution, fetchChanges, push notifications | Apple's official sync engine, already initialized in Phase 39 |
| SwiftUI (ToolbarItem, @Published) | Built-in | Sync status toolbar icon | Native chrome for status indicator per CONTEXT.md |
| UserNotifications (UNUserNotificationCenter) | Built-in | Remote notification registration | Required for CKSyncEngine push notification delivery |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SF Symbols | Built-in | Sync status icons | cloud.fill, arrow.triangle.2.circlepath.cloud, exclamationmark.icloud |
| os.Logger | Built-in | Structured logging | All sync operations use subsystem "works.isometry.app" category "Sync" |

### Not Needed
| Instead of | Why Not |
|------------|---------|
| Manual CKDatabaseSubscription | CKSyncEngine manages zone subscriptions automatically |
| NWPathMonitor | CKSyncEngine handles network state internally |
| Combine for state publishing | ObservableObject with @Published is simpler and matches existing BridgeManager pattern |
| JS-side sync status UI | CONTEXT.md locks this as native SwiftUI toolbar icon |

## Architecture Patterns

### Recommended Changes Map
```
native/Isometry/Isometry/
├── SyncManager.swift            # MODIFIED: conflict resolution, fetchChanges(), status publishing, export-all-cards, encryptedDataReset
├── SyncStatusView.swift         # NEW: SwiftUI toolbar content (icon + error popover)
├── BridgeManager.swift          # MODIFIED: export-all-cards handler, remote notification forwarding
├── IsometryApp.swift            # MODIFIED: foreground fetchChanges(), registerForRemoteNotifications, toolbar sync icon
├── ContentView.swift            # MODIFIED: toolbar item for sync status

src/native/
├── NativeBridge.ts              # MODIFIED: export-all-cards handler, post-merge refresh event
```

### Pattern 1: Server-Wins Conflict Resolution
**What:** When `handleSentRecordZoneChanges` receives a `failedRecordSaves` entry with `.serverRecordChanged` error code, accept the server record silently.
**When to use:** In the existing `for failedSave in sent.failedRecordSaves` loop in SyncManager.
**Example:**
```swift
// Source: apple/sample-cloudkit-sync-engine + CONTEXT.md locked decision
for failedSave in sent.failedRecordSaves {
    let recordId = failedSave.record.recordID.recordName
    let error = failedSave.error

    if error.code == .serverRecordChanged,
       let serverRecord = error.serverRecord {
        // Server wins: accept the server's version
        logger.info("Conflict on \(recordId): accepting server version")

        // Archive the server record's system fields for future uploads
        archiveSystemFields(for: serverRecord)

        // Forward server record to JS SyncMerger to update local database
        let fields = serverRecord.cardFieldsDictionary()
        var fieldDict: [String: Any] = [:]
        for (key, value) in fields {
            switch value {
            case .string(let s): fieldDict[key] = s
            case .int(let i): fieldDict[key] = i
            case .double(let d): fieldDict[key] = d
            case .bool(let b): fieldDict[key] = b
            case .null: fieldDict[key] = NSNull()
            }
        }

        let recordDicts: [[String: Any]] = [[
            "recordType": serverRecord.recordType,
            "recordId": recordId,
            "operation": "save",
            "fields": fieldDict,
        ]]
        let payload: [String: Any] = ["records": recordDicts]
        Task { @MainActor in
            self.bridgeManager?.sendSyncNotification(payload)
        }

        // Remove from pending changes (conflict resolved)
        pendingChanges.removeAll(where: { $0.recordId == recordId })
    } else {
        logger.error("Failed to send record \(recordId): \(error.localizedDescription)")
        // CKSyncEngine will retry automatically for transient errors
    }
}
```

### Pattern 2: Sync Status Publishing via ObservableObject Wrapper
**What:** A `@MainActor` class that wraps SyncManager's actor-isolated state for SwiftUI observation.
**When to use:** For the toolbar sync status icon. SyncManager is an actor (cannot be @StateObject). Use a wrapper that SyncManager updates via MainActor hop.
**Example:**
```swift
// Source: Claude's discretion -- matches existing BridgeManager @MainActor pattern
@MainActor
final class SyncStatusPublisher: ObservableObject {
    enum Status {
        case idle
        case syncing
        case error(String)
    }

    @Published var status: Status = .idle
}

// In SyncManager, update via MainActor hop:
// case .willFetchChanges, .willSendChanges:
//     Task { @MainActor in statusPublisher.status = .syncing }
// case .didFetchChanges, .didSendChanges:
//     Task { @MainActor in statusPublisher.status = .idle }
// On error:
//     Task { @MainActor in statusPublisher.status = .error(message) }
```

### Pattern 3: Foreground Poll via fetchChanges()
**What:** Call `syncEngine.fetchChanges()` when scenePhase transitions to `.active`.
**When to use:** In IsometryApp's `handleScenePhaseChange(.active)`, after the existing `startAutosave()` and `checkForSilentCrash()` calls.
**Critical constraint:** NEVER call `fetchChanges()` inside a `CKSyncEngineDelegate.handleEvent()` method -- this causes infinite loops.
**Example:**
```swift
// In IsometryApp handleScenePhaseChange(.active):
case .active:
    bridgeManager.startAutosave()
    bridgeManager.checkForSilentCrash()
    // SYNC-05: Poll for CloudKit changes on foreground
    Task {
        await bridgeManager.syncManager?.fetchChanges()
    }
```

```swift
// In SyncManager:
func fetchChanges() {
    syncEngine?.fetchChanges()
}
```

### Pattern 4: Remote Notification Registration
**What:** Register for remote notifications at app launch so CKSyncEngine can receive push updates.
**When to use:** In AppDelegate's `didFinishLaunchingWithOptions` (iOS) or in the macOS app delegate.
**Key insight:** CKSyncEngine automatically listens for push notifications once the app has registered. You do NOT need to manually forward `didReceiveRemoteNotification` -- the engine picks up the silent push internally.
**Example:**
```swift
// iOS: Add @UIApplicationDelegateAdaptor to IsometryApp
#if os(iOS)
@UIApplicationDelegateAdaptor(AppDelegateIOS.self) private var iosDelegate
#endif

// AppDelegate (iOS):
final class AppDelegateIOS: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        application.registerForRemoteNotifications()
        return true
    }
}

// macOS: In existing IsometryAppDelegate:
func applicationDidFinishLaunching(_ notification: Notification) {
    NSApplication.shared.registerForRemoteNotifications()
}
```

### Pattern 5: JS-Internal Post-Merge Refresh Event
**What:** After SyncMerger completes, dispatch a CustomEvent that triggers ViewManager's coordinator to re-query. Does NOT post `mutated` to nativeBridge.
**When to use:** At the end of `handleNativeSync()` in NativeBridge.ts, after all records are merged.
**Why CustomEvent:** Decoupled from the bridge (no sync loops). StateCoordinator subscribes to provider changes, but SyncMerger is not a provider. A CustomEvent on `window` is the simplest mechanism that avoids coupling to provider internals.
**Example:**
```typescript
// In handleNativeSync, after all records merged:
// Dispatch JS-internal event for view refresh
// CRITICAL: Do NOT post 'mutated' to nativeBridge -- prevents sync echo loops
window.dispatchEvent(new CustomEvent('isometry:sync-complete', {
    detail: { recordCount: successCount }
}));
```

```typescript
// In main.ts, after ViewManager is created:
if (isNative) {
    window.addEventListener('isometry:sync-complete', () => {
        // Trigger coordinator to re-query active view
        coordinator.forceUpdate();
    });
}
```

Note: StateCoordinator needs a `forceUpdate()` method (or the listener calls viewManager directly). This is Claude's discretion territory.

### Pattern 6: native:export-all-cards Bridge Message
**What:** Swift requests all cards from JS for initial upload or encryptedDataReset recovery.
**When to use:** On first CKSyncEngine launch (no persisted state serialization) and on `.encryptedDataReset` zone deletion.
**Example:**
```swift
// Swift side -- in BridgeManager:
func requestExportAllCards() {
    let js = "window.__isometry.exportAllCards();"
    Task {
        try? await webView?.evaluateJavaScript(js)
    }
}

// JS side -- in NativeBridge.ts initNativeBridge():
iso['exportAllCards'] = async () => {
    const rows = await bridge.send('db:query', {
        sql: 'SELECT * FROM cards WHERE deleted_at IS NULL',
        params: []
    });
    // Post back to Swift
    window.webkit!.messageHandlers.nativeBridge.postMessage({
        id: crypto.randomUUID(),
        type: 'native:export-all-cards',
        payload: { cards: rows },
        timestamp: Date.now(),
    });
};
```

```swift
// In BridgeManager.didReceive(), add case:
case "native:export-all-cards":
    let payload = body["payload"] as? [String: Any]
    let cards = payload?["cards"] as? [[String: Any]] ?? []
    Task {
        for card in cards {
            guard let recordId = card["id"] as? String else { continue }
            let fields = card.compactMapValues { CodableValue.from($0) }
            let pending = PendingChange(
                id: UUID().uuidString,
                recordType: SyncConstants.cardRecordType,
                recordId: recordId,
                operation: "save",
                fields: fields,
                timestamp: Date()
            )
            await syncManager?.addPendingChange(pending)
        }
    }
```

### Anti-Patterns to Avoid
- **Calling fetchChanges() inside handleEvent():** Creates infinite event loops. Only call fetchChanges() from outside the delegate (e.g., scenePhase handler).
- **Posting `mutated` after SyncMerger completes:** Creates sync echo loops where incoming records get re-queued as outgoing changes. The post-merge refresh MUST be JS-internal only.
- **Field-level merge for conflict resolution:** CONTEXT.md locks server-wins-silently. No partial field merging, no user notification, no conflict UI.
- **Creating multiple CKSyncEngine instances:** One instance per private database. Already initialized in Phase 39.
- **Blocking main thread for fetchChanges():** fetchChanges() is async on the sync engine -- always call from a Task context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zone subscription for push | Manual CKDatabaseSubscription creation | CKSyncEngine automatic zone subscription | CKSyncEngine manages subscriptions internally when initialized with a zone |
| Push notification forwarding | Manual didReceiveRemoteNotification -> CKSyncEngine | CKSyncEngine internal push listener | CKSyncEngine automatically listens after registerForRemoteNotifications |
| Sync scheduling | Custom timer or manual sendChanges() calls | CKSyncEngine automatic scheduling | Engine batches and schedules uploads intelligently |
| Network retry for sync | Custom exponential backoff | CKSyncEngine built-in retry | Handles transient errors (networkUnavailable, zoneBusy, requestRateLimited) |
| Conflict detection | Custom modified_at comparison | CKRecord system fields metadata | Server compares record metadata automatically; `.serverRecordChanged` surfaces conflicts |
| Batch upload sizing | Manual 1MB batch splitting | CKSyncEngine.RecordZoneChangeBatch | Engine handles batch limits internally |

**Key insight:** CKSyncEngine already handles push notification delivery, zone subscriptions, and retry scheduling. Phase 40's job is to handle the events the engine surfaces (conflicts, fetched changes) and wire up the UI indicators. Do not replicate CKSyncEngine's internal logic.

## Common Pitfalls

### Pitfall 1: Sync Echo Loop from Post-Merge mutated Message
**What goes wrong:** Incoming sync records get merged into sql.js, SyncMerger triggers `mutated` back to Swift, Swift re-queues them as outgoing changes, CKSyncEngine sends them back, creating an infinite loop.
**Why it happens:** The existing mutation hook in NativeBridge.ts posts `mutated` for ALL db:exec calls, including SyncMerger's INSERT OR REPLACE.
**How to avoid:** SyncMerger's post-merge refresh must use a JS-internal event (CustomEvent on window) that does NOT trigger the mutation hook. The mutation hook must exclude sync merge operations, or SyncMerger must bypass the hooked bridge.send().
**Warning signs:** Exponential record uploads after receiving sync data; CloudKit rate limiting.

### Pitfall 2: fetchChanges() Called Inside handleEvent()
**What goes wrong:** Infinite event delivery loop. Apple documentation explicitly forbids this.
**Why it happens:** Developer wants to "pull latest" after receiving a stateUpdate or sentRecordZoneChanges.
**How to avoid:** Only call fetchChanges() from outside CKSyncEngineDelegate methods (e.g., scenePhase handler).
**Warning signs:** App hangs or crashes in CKSyncEngine event loop.

### Pitfall 3: Not Archiving Server Record System Fields After Conflict Resolution
**What goes wrong:** Next upload of the same record triggers another `.serverRecordChanged` error because the record metadata is still stale.
**Why it happens:** Server-wins resolution accepts the server's data but doesn't archive the server record's system fields.
**How to avoid:** After accepting the server record in conflict resolution, call `archiveSystemFields(for: serverRecord)` before discarding.
**Warning signs:** Same record produces `.serverRecordChanged` on every upload cycle.

### Pitfall 4: Initial Upload Queued Before JS is Ready
**What goes wrong:** SyncManager tries to request export-all-cards before NativeBridge.ts has installed the `exportAllCards` handler on window.__isometry.
**Why it happens:** SyncManager.initialize() runs in a Task from onAppear, which can fire before JS signals native:ready.
**How to avoid:** Gate the initial upload trigger on `bridgeManager.isJSReady == true`. Use a callback or observation pattern.
**Warning signs:** evaluateJavaScript returns undefined or throws.

### Pitfall 5: registerForRemoteNotifications Not Called
**What goes wrong:** CKSyncEngine never receives push notifications. Real-time sync (SYNC-06) does not work. Only foreground polling (SYNC-05) triggers sync.
**Why it happens:** CKSyncEngine requires the app to register for remote notifications, but it does NOT call registerForRemoteNotifications itself.
**How to avoid:** Call `UIApplication.shared.registerForRemoteNotifications()` (iOS) or `NSApplication.shared.registerForRemoteNotifications()` (macOS) at app launch. Does NOT require user permission -- CloudKit uses silent push.
**Warning signs:** Sync only works when user manually opens the app; no background updates.

### Pitfall 6: Mutation Hook Catching SyncMerger's db:exec Calls
**What goes wrong:** SyncMerger runs `bridge.send('db:exec', ...)` for each incoming record. The mutation hook wrapping `bridge.send()` detects `db:exec` as a MUTATING_TYPE and posts `mutated` to Swift.
**Why it happens:** The mutation hook doesn't distinguish between user mutations and sync merges -- both use `db:exec`.
**How to avoid:** Either (a) add a flag/context parameter to bridge.send that the hook checks, (b) SyncMerger calls the original unwrapped bridge.send, or (c) add `db:exec` guard logic in the hook based on a sync-in-progress flag. Option (b) is simplest -- save a reference to the original `send` before the hook wraps it.
**Warning signs:** Same as Pitfall 1 -- sync echo loop.

## Code Examples

### SwiftUI Sync Status Toolbar Icon
```swift
// Source: Claude's discretion -- SF Symbols + animation
struct SyncStatusView: View {
    @ObservedObject var statusPublisher: SyncStatusPublisher
    @State private var showingErrorPopover = false

    var body: some View {
        Button {
            if case .error = statusPublisher.status {
                showingErrorPopover = true
            }
        } label: {
            Group {
                switch statusPublisher.status {
                case .idle:
                    Image(systemName: "checkmark.icloud")
                        .foregroundStyle(.secondary)
                case .syncing:
                    Image(systemName: "arrow.triangle.2.circlepath.icloud")
                        .foregroundStyle(.blue)
                        .symbolEffect(.rotate, options: .repeating)
                case .error:
                    Image(systemName: "exclamationmark.icloud")
                        .foregroundStyle(.red)
                }
            }
        }
        .buttonStyle(.plain)
        .popover(isPresented: $showingErrorPopover) {
            if case .error(let message) = statusPublisher.status {
                Text(message)
                    .font(.caption)
                    .padding()
                    .frame(maxWidth: 250)
            }
        }
    }
}
```

### SyncMerger Bypass of Mutation Hook
```typescript
// Source: existing installMutationHook pattern in NativeBridge.ts
// Save reference to original bridge.send BEFORE mutation hook wraps it
let originalBridgeSend: typeof bridge.send;

// In initNativeBridge, before installMutationHook:
originalBridgeSend = bridge.send.bind(bridge);
installMutationHook(bridge);

// In handleNativeSync, use originalBridgeSend to bypass mutation hook:
async function handleNativeSync(bridge, payload) {
    // ... existing code ...
    for (const stmt of statements) {
        try {
            // Use unwrapped send to avoid triggering mutated -> sync echo loop
            await originalBridgeSend('db:exec', stmt);
            successCount++;
        } catch (err) {
            console.error('[NativeBridge] native:sync: statement failed:', stmt.sql, err);
        }
    }

    // JS-internal refresh signal (NOT mutated to Swift)
    window.dispatchEvent(new CustomEvent('isometry:sync-complete', {
        detail: { recordCount: successCount }
    }));
}
```

### macOS Remote Notification Registration
```swift
// Source: Apple documentation + existing IsometryAppDelegate pattern
// In existing IsometryAppDelegate (macOS):
func applicationDidFinishLaunching(_ notification: Notification) {
    NSApplication.shared.registerForRemoteNotifications()
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CKSubscription + push handling | CKSyncEngine automatic push | iOS 17 (WWDC23) | No manual subscription management needed |
| Custom conflict resolution UI | Server-wins-silently | Phase 40 design decision | Simplest correct approach for single-user multi-device |
| Polling on timer for remote changes | Push + foreground poll | CKSyncEngine | Near-real-time updates without polling overhead |

**Deprecated/outdated:**
- Manual `CKDatabaseSubscription` creation: CKSyncEngine manages zone subscriptions automatically
- `didReceiveRemoteNotification` forwarding: Not needed -- CKSyncEngine listens for push notifications directly after `registerForRemoteNotifications()`

## Open Questions

1. **CKSyncEngine Push Notification Handling -- Forwarding Needed?**
   - What we know: Multiple sources state CKSyncEngine "automatically listens" for push notifications. Apple's sample app does not explicitly forward `didReceiveRemoteNotification` to the engine.
   - What's unclear: Some older documentation implies forwarding is needed. Christian Selig's January 2026 post says "let it do its own thing." The CONTEXT.md says "forward didReceiveRemoteNotification to CKSyncEngine."
   - Recommendation: Register for remote notifications at launch. If CKSyncEngine does NOT automatically pick up pushes during testing, add `didReceiveRemoteNotification` forwarding as a fallback. Start without explicit forwarding since that appears to be the current pattern.

2. **StateCoordinator forceUpdate() Method**
   - What we know: ViewManager re-queries when StateCoordinator fires. StateCoordinator fires when registered providers change. SyncMerger is not a provider.
   - What's unclear: Best way to trigger re-query from a non-provider event.
   - Recommendation: Add a `forceUpdate()` method to StateCoordinator that schedules the same batched notification it uses for provider changes. This is a 3-line method on an existing class.

3. **Initial Upload Timing vs JS Ready State**
   - What we know: SyncManager initializes in a Task from onAppear. JS might not be ready yet.
   - What's unclear: Whether to gate on isJSReady or use a deferred trigger.
   - Recommendation: In SyncManager.initialize(), after detecting first launch (no state serialization), set a flag. BridgeManager checks this flag after sendLaunchPayload() completes (when JS is definitely ready) and triggers the export.

## Sources

### Primary (HIGH confidence)
- [Apple sample-cloudkit-sync-engine](https://github.com/apple/sample-cloudkit-sync-engine) - SyncedDatabase.swift: conflict resolution pattern (mergeFromServerRecord + re-queue), state publishing via @Published
- [CKSyncEngine documentation](https://developer.apple.com/documentation/cloudkit/cksyncengine-5sie5) - API reference for fetchChanges(), Event lifecycle (willFetchChanges/didFetchChanges, willSendChanges/didSendChanges)
- [CKSyncEngine.Event](https://developer.apple.com/documentation/cloudkit/cksyncengine-5sie5/event) - Complete event type enumeration
- [WWDC23: Sync to iCloud with CKSyncEngine](https://developer.apple.com/videos/play/wwdc2023/10188/) - Official API introduction, automatic zone subscription, push notification handling
- Existing codebase: SyncManager.swift, BridgeManager.swift, NativeBridge.ts, IsometryApp.swift, ContentView.swift, SyncTypes.swift

### Secondary (MEDIUM confidence)
- [CKSyncEngine questions and answers (Christian Selig, January 2026)](https://christianselig.com/2026/01/cksyncengine/) - Practical pitfalls: serverRecordChanged conflict pattern, fetchChanges() constraints, encryptedDataReset re-upload, metadata archival importance, batch limits
- [Superwall CKSyncEngine tutorial](https://superwall.com/blog/syncing-data-with-cloudkit-in-your-ios-app-using-cksyncengine-and-swift-and-swiftui/) - fetchChanges() and sendChanges() one-liner patterns, notification center for UI refresh
- [SwiftUI UIApplicationDelegateAdaptor (Hacking with Swift)](https://www.hackingwithswift.com/quick-start/swiftui/what-is-the-uiapplicationdelegateadaptor-property-wrapper) - Pattern for registerForRemoteNotifications in SwiftUI App lifecycle

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Apple first-party APIs, already partially implemented in Phase 39
- Architecture: HIGH - Existing SyncManager/BridgeManager/NativeBridge.ts provide clear integration points; patterns from Apple sample verified
- Pitfalls: HIGH - Sync echo loop is the #1 risk; well-understood prevention (bypass mutation hook); multiple sources confirm CKSyncEngine constraints
- Conflict resolution: HIGH - Apple sample demonstrates exact pattern; CONTEXT.md locks server-wins; implementation is straightforward
- Push notifications: MEDIUM - CKSyncEngine documentation suggests automatic handling but exact behavior after registerForRemoteNotifications is partially verified; may need runtime testing

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- CKSyncEngine API stable since iOS 17)
