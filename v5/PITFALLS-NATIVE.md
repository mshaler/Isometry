# Native Platform Pitfalls

**Domain:** Native iOS/macOS SQLite + CloudKit sync with Swift Actors
**Companion to:** `.planning/research/PITFALLS.md` (web runtime pitfalls)
**Confidence:** MEDIUM-HIGH — based on Apple documentation, WWDC sessions, and common CloudKit failure patterns

---

## Critical Pitfalls

### Pitfall N1: CloudKit Zone Creation Race Condition

**What goes wrong:**
On first launch, the app attempts to save records before the custom zone exists. CloudKit returns `CKError.zoneNotFound`. The app retries, but the zone creation request is also in-flight, causing a second error `CKError.serverRecordChanged` when the zone creation completes and the retry races with it.

**Why it happens:**
Zone creation is asynchronous. If `setup()` doesn't `await` zone creation before any sync operation, the first sync races ahead. The naive fix—creating zone on every sync—causes `serverRecordChanged` errors on subsequent syncs.

**How to avoid:**
```swift
actor CloudKitSyncManager {
    private var zoneCreated = false
    
    func ensureZoneExists() async throws {
        guard !zoneCreated else { return }
        
        let zone = CKRecordZone(zoneID: zoneID)
        do {
            _ = try await database.modifyRecordZones(saving: [zone], deleting: [])
            zoneCreated = true
        } catch let error as CKError where error.code == .serverRecordChanged {
            // Zone already exists — this is fine
            zoneCreated = true
        }
    }
    
    func sync() async throws {
        try await ensureZoneExists()  // Always first
        // ... rest of sync
    }
}
```

**Warning signs:**
- First-launch sync fails with `zoneNotFound`
- Intermittent `serverRecordChanged` errors on zone operations
- Users report data not syncing until second app launch

**Phase to address:** Native shell setup — before any CloudKit sync code runs.

---

### Pitfall N2: Change Token Expiration Causes Silent Data Loss

**What goes wrong:**
CloudKit change tokens expire after ~30 days of inactivity. When a user opens the app after a long absence, `fetchRecordZoneChanges` returns `CKError.changeTokenExpired`. If the error handler simply logs and continues, the app never fetches the missed changes. Data modified on other devices during the gap is silently lost.

**Why it happens:**
CloudKit's incremental sync relies on change tokens. An expired token means "I don't know what you've seen — start over." But the default error handling often treats this as transient and retries with the same (expired) token.

**How to avoid:**
```swift
func pullRemoteChanges(token: Data?) async throws -> Int {
    // ... setup operation ...
    
    do {
        try await executeOperation()
    } catch let error as CKError where error.code == .changeTokenExpired {
        // CRITICAL: Clear token and do full sync
        logger.warning("Change token expired — performing full sync")
        var syncState = try await db.getSyncState()
        syncState.changeToken = nil  // Clear the expired token
        try await db.updateSyncState(syncState)
        
        // Retry with nil token (full sync)
        return try await pullRemoteChanges(token: nil)
    }
}
```

**Warning signs:**
- Users report missing data after not using app for weeks
- `changeTokenExpired` errors in logs without corresponding full sync
- Sync "succeeds" (no error) but data is stale

**Phase to address:** CloudKit sync implementation — error handling must be exhaustive.

---

### Pitfall N3: CKRecord Field Type Mismatches Cause Silent Failures

**What goes wrong:**
A `CKRecord` field set to `Int` on one device is read as `Int64` on another, but the Swift code expects `Int`. The cast fails silently (returns `nil`), and the field is treated as missing. Or worse: a field set to `String` is read back as `CKAsset` because CloudKit auto-promoted a large string.

**Why it happens:**
CloudKit has its own type system that doesn't map 1:1 to Swift types:
- `Int` becomes `Int64`
- Strings over 1MB become `CKAsset`
- `Date` becomes `Date` but with reduced precision
- Arrays have element type constraints

**How to avoid:**
```swift
// WRONG: Direct cast
let priority = record["priority"] as? Int  // nil if stored as Int64

// CORRECT: Handle CloudKit's type coercion
let priority: Int = {
    if let int = record["priority"] as? Int { return int }
    if let int64 = record["priority"] as? Int64 { return Int(int64) }
    return 0  // Default
}()

// For strings that might be assets:
let content: String? = {
    if let string = record["content"] as? String { return string }
    if let asset = record["content"] as? CKAsset,
       let url = asset.fileURL,
       let data = try? Data(contentsOf: url),
       let string = String(data: data, encoding: .utf8) {
        return string
    }
    return nil
}()
```

**Warning signs:**
- Fields are `nil` when they should have values
- Large content mysteriously disappearing
- Type mismatch crashes in production but not in testing (testing uses smaller data)

**Phase to address:** CloudKit record conversion — both `nodeToRecord` and `recordToNode`.

---

### Pitfall N4: Actor Reentrancy Causes Database Corruption

**What goes wrong:**
A Swift Actor method `await`s a CloudKit call. While suspended, another call enters the actor and mutates database state. When the first call resumes, it operates on stale assumptions. The classic symptom: duplicate records, or an UPDATE that clobbers a concurrent INSERT.

**Why it happens:**
Swift Actors are reentrant by design. When you `await`, the actor can accept other calls. This is different from serial `DispatchQueue` which blocks entirely.

**How to avoid:**
```swift
actor IsometryDatabase {
    // WRONG: State can change across await
    func syncThenSave(node: Node) async throws {
        let existing = try getNode(node.id)  // Read
        try await cloudKit.sync()            // Await — actor is reentrant here!
        if existing == nil {
            try insert(node)                 // Another call may have inserted
        }
    }
    
    // CORRECT: Capture state, validate after await
    func syncThenSave(node: Node) async throws {
        let existedBefore = try getNode(node.id) != nil
        try await cloudKit.sync()
        
        // Re-check after await
        let existsNow = try getNode(node.id) != nil
        if !existedBefore && !existsNow {
            try insert(node)
        } else if existedBefore && existsNow {
            try update(node)
        }
        // If state changed unexpectedly, the re-check handles it
    }
}
```

Better: use database transactions that are atomic and don't span `await` points.

```swift
func saveNode(_ node: Node) throws {
    // No await inside transaction
    try transaction {
        try execute(upsertSQL, params: nodeParams(node))
    }
}
```

**Warning signs:**
- Duplicate records appearing after sync
- "Unique constraint failed" errors intermittently
- Data inconsistency that's hard to reproduce

**Phase to address:** Database Actor design — establish patterns before any async database methods.

---

### Pitfall N5: CloudKit Rate Limiting Backoff Must Be Exponential

**What goes wrong:**
After hitting `CKError.requestRateLimited`, the app retries immediately or with fixed delay. CloudKit continues to reject requests, potentially for longer periods. The app enters a tight retry loop, draining battery and never syncing.

**Why it happens:**
CloudKit returns `requestRateLimited` with a `retryAfterSeconds` value in the error's `userInfo`. Ignoring this value and using a fixed backoff (or no backoff) doesn't respect CloudKit's signal to slow down.

**How to avoid:**
```swift
func handleCloudKitError(_ error: CKError) async {
    switch error.code {
    case .requestRateLimited, .zoneBusy, .serviceUnavailable:
        // Use CloudKit's suggested delay, or exponential backoff
        let suggestedDelay = error.userInfo[CKErrorRetryAfterKey] as? TimeInterval
        let delay = suggestedDelay ?? min(backoffDelay * 2, maxBackoff)
        
        backoffDelay = delay  // Update for next failure
        logger.info("Rate limited, waiting \(delay)s")
        
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        
        if !Task.isCancelled {
            await performSync()  // Retry
        }
        
    case .networkFailure, .networkUnavailable:
        // Network errors: shorter initial backoff, still exponential
        // ...
    }
}
```

**Warning signs:**
- Sync never completes after first rate limit
- Battery drain during sync attempts
- Console shows repeated `requestRateLimited` without increasing delays

**Phase to address:** CloudKit error handling — implement before any user-facing sync.

---

### Pitfall N6: SQLite WAL Checkpoint Starvation

**What goes wrong:**
With WAL mode enabled, long-running read transactions prevent checkpointing. The WAL file grows unbounded (hundreds of MB), eventually exhausting disk space or causing severe performance degradation.

**Why it happens:**
SQLite WAL checkpointing requires that no readers are active. If a read transaction stays open (common with prepared statements not freed, or long UI data fetches), the checkpoint is blocked. Every write appends to WAL but nothing is flushed to the main database file.

**How to avoid:**
```swift
// WRONG: Long-lived statement blocks checkpointing
let stmt = try db.prepare("SELECT * FROM cards")
// ... hold stmt open while user browses ...

// CORRECT: Short transactions, immediate finalization
func getCards(folder: String) throws -> [Node] {
    let stmt = try db.prepare("SELECT * FROM cards WHERE folder = ?")
    defer { stmt.finalize() }  // Always finalize
    
    var results: [Node] = []
    while try stmt.step() {
        results.append(nodeFromRow(stmt))
    }
    return results
}

// Also: periodic explicit checkpoint
func maintenance() throws {
    try db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
}
```

Add a maintenance routine that runs on app backgrounding:
```swift
func applicationDidEnterBackground() {
    Task {
        try? await database.checkpoint()
        try? await database.vacuum()  // Optional: reclaim space
    }
}
```

**Warning signs:**
- `.db-wal` file growing much larger than `.db` file
- Disk space warnings on device
- Read performance degrading over time

**Phase to address:** Database maintenance — implement checkpoint in app lifecycle handlers.

---

### Pitfall N7: Keychain Access Fails Silently in Background

**What goes wrong:**
OAuth tokens stored in Keychain are inaccessible when the app is backgrounded or device is locked. `SecItemCopyMatching` returns `errSecInteractionNotAllowed`. The app treats missing credentials as "logged out" and fails sync silently.

**Why it happens:**
Default Keychain accessibility is `kSecAttrAccessibleWhenUnlocked`. When device is locked or app is in background for sync, the Keychain items are encrypted and inaccessible.

**How to avoid:**
Use `kSecAttrAccessibleAfterFirstUnlock` for credentials needed during background sync:

```swift
func storeToken(_ token: String, for service: String) throws {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,  // Key!
        kSecValueData as String: token.data(using: .utf8)!
    ]
    
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess || status == errSecDuplicateItem else {
        throw KeychainError.storeFailed(status)
    }
}
```

**Warning signs:**
- Background sync fails but foreground sync works
- Users report needing to re-authenticate after device restart
- `errSecInteractionNotAllowed` in logs

**Phase to address:** Native shell Keychain integration — before any OAuth ETL.

---

## Moderate Pitfalls

### Pitfall N8: CKAsset File URLs Are Temporary

**What goes wrong:**
Code stores `CKAsset.fileURL` for later use. On next access, the file is gone. CloudKit deletes the temporary file after the record operation completes.

**How to avoid:**
Copy asset contents immediately:
```swift
if let asset = record["attachment"] as? CKAsset,
   let url = asset.fileURL {
    let data = try Data(contentsOf: url)
    // Store data, not URL
}
```

---

### Pitfall N9: CloudKit Subscription Push Notifications Require Entitlement

**What goes wrong:**
Background sync subscriptions never trigger because push notification entitlement is missing or remote notification background mode isn't enabled.

**How to avoid:**
In Xcode:
1. Capabilities → Push Notifications (enabled)
2. Capabilities → Background Modes → Remote notifications (checked)
3. Signing & Capabilities → iCloud → CloudKit (checked)

---

### Pitfall N10: Foreign Key Constraints Are Off by Default

**What goes wrong:**
SQLite foreign keys are defined in schema but never enforced. Orphaned connections remain after card deletion.

**How to avoid:**
```swift
// Run on every connection open
try db.execute("PRAGMA foreign_keys = ON")

// Verify in tests
let result = try db.query("PRAGMA foreign_keys")
assert(result.first?["foreign_keys"] as? Int == 1)
```

---

## CloudKit Conflict Resolution Patterns

### Last-Write-Wins (Simple but Lossy)

```swift
func resolveConflict(local: Node, remote: Node) -> Node {
    return local.modifiedAt > remote.modifiedAt ? local : remote
}
```

**Use when:** Conflicts are rare, data is easily re-created.

### Field-Level Merge (Complex but Preserving)

```swift
func resolveConflict(local: Node, remote: Node) -> Node {
    var merged = remote  // Start with remote as base
    
    // Local wins for fields modified more recently
    if local.nameModifiedAt > remote.nameModifiedAt {
        merged.name = local.name
    }
    if local.contentModifiedAt > remote.contentModifiedAt {
        merged.content = local.content
    }
    
    // Merge arrays
    merged.tags = Array(Set(local.tags + remote.tags))
    
    merged.version = max(local.version, remote.version) + 1
    return merged
}
```

**Use when:** Concurrent editing is common, data loss is unacceptable.

### User Resolution (Safest for Critical Data)

```swift
func resolveConflict(local: Node, remote: Node) -> ConflictResolution {
    // Check if auto-resolution is possible
    if local.content == remote.content {
        return .merge(mergeMetadata(local, remote))
    }
    
    // Content differs — need user input
    return .needsUserInput(local, remote)
}
```

**Use when:** Data is user-created content that can't be merged programmatically.

---

## Native ↔ Web Bridge Patterns

### Safe Message Passing

```swift
// Swift side
func sendToWeb(_ message: [String: Any]) {
    guard let json = try? JSONSerialization.data(withJSONObject: message),
          let jsonString = String(data: json, encoding: .utf8) else {
        return
    }
    
    webView.evaluateJavaScript("window.handleNativeMessage(\(jsonString))")
}

// Receiving from web
func userContentController(_ controller: WKUserContentController, 
                           didReceive message: WKScriptMessage) {
    guard let body = message.body as? [String: Any],
          let type = body["type"] as? String else {
        return
    }
    
    switch type {
    case "database-export":
        handleDatabaseExport(body)
    case "request-credentials":
        handleCredentialRequest(body)
    default:
        logger.warning("Unknown message type: \(type)")
    }
}
```

### Database Export/Import

```swift
// Export: Web Worker → Native
func handleDatabaseExport(_ message: [String: Any]) {
    guard let base64 = message["payload"] as? String,
          let data = Data(base64Encoded: base64) else {
        return
    }
    
    let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("isometry.db")
    
    try? data.write(to: url)
}

// Import: Native → Web Worker
func loadDatabaseIntoWeb() {
    let url = // ... database path
    guard let data = try? Data(contentsOf: url) else { return }
    
    let base64 = data.base64EncodedString()
    sendToWeb([
        "type": "database-import",
        "payload": base64
    ])
}
```

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Zone not found | LOW | Create zone, retry sync |
| Change token expired | MEDIUM | Clear token, perform full sync |
| CKRecord type mismatch | LOW | Add defensive type coercion |
| Actor reentrancy corruption | HIGH | Audit all async database methods, add transactions |
| Rate limiting loop | LOW | Implement proper backoff with `retryAfterSeconds` |
| WAL checkpoint starvation | MEDIUM | Add explicit checkpoint on background, finalize statements |
| Keychain background access | LOW | Change accessibility to `afterFirstUnlock` |
| Foreign keys not enforced | MEDIUM | Add PRAGMA, clean up orphaned records |

---

## Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| N1: Zone race condition | CloudKit setup | First-launch test passes |
| N2: Change token expiration | CloudKit sync | 30-day simulation test |
| N3: CKRecord type mismatch | Record conversion | Round-trip test with all field types |
| N4: Actor reentrancy | Database Actor design | Concurrent operation test |
| N5: Rate limiting | CloudKit error handling | Simulated rate limit test |
| N6: WAL starvation | Database maintenance | Long-session + checkpoint test |
| N7: Keychain background | Native shell | Background sync test on device |
| N8: CKAsset temp files | Record conversion | Asset round-trip test |
| N9: Push subscription | Xcode config | Background notification test |
| N10: Foreign keys | Database init | Orphan constraint test |

---

## Sources

- [Apple CloudKit Documentation](https://developer.apple.com/documentation/cloudkit)
- [WWDC 2021: Build Apps that Share Data Through CloudKit and Core Data](https://developer.apple.com/videos/play/wwdc2021/10015/)
- [WWDC 2020: Sync a Core Data Store with CloudKit](https://developer.apple.com/videos/play/wwdc2020/10650/)
- [CloudKit Error Handling Best Practices](https://developer.apple.com/documentation/cloudkit/ckerror)
- [SQLite WAL Mode](https://sqlite.org/wal.html)
- [Swift Actor Reentrancy](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/#Actors)
- [Keychain Services](https://developer.apple.com/documentation/security/keychain_services)

---

*Native platform pitfalls for: iOS/macOS SQLite + CloudKit sync with Swift Actors*
*Companion to: `.planning/research/PITFALLS.md`*
