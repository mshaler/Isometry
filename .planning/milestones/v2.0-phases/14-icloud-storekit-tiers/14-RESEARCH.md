# Phase 14: iCloud + StoreKit Tiers — Research

**Researched:** 2026-03-03
**Domain:** iCloud Documents file-level sync + StoreKit 2 subscriptions + Swift feature gating
**Confidence:** HIGH (iCloud Documents), HIGH (StoreKit 2 core APIs), MEDIUM (NSFileCoordinator/actor integration pattern)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TIER-01 | DatabaseManager path resolves to iCloud ubiquity container when available, enabling automatic cross-device file sync | iCloud Documents ubiquity container pattern: `FileManager.url(forUbiquityContainerIdentifier:)` with fallback to Application Support |
| TIER-02 | StoreKit 2 SubscriptionManager handles Free/Pro/Workbench tier purchases | StoreKit 2 `Product.products(for:)`, `product.purchase()`, `Transaction.currentEntitlements`, `Transaction.updates` listener |
| TIER-03 | LaunchPayload.tier field activates feature gating in the web runtime | BridgeManager already sends `tier: "free"` stub — replace with SubscriptionManager.currentTier |
| TIER-04 | FeatureGate.swift enforces tier restrictions before allowing native actions | Tier enum + switch on native:action kind before dispatching |
</phase_requirements>

---

## Summary

Phase 14 has two independent subsystems that can be planned and implemented in parallel: iCloud Documents for file-level database sync (TIER-01) and StoreKit 2 for subscription management plus feature gating (TIER-02/03/04).

**iCloud Documents** (TIER-01) is the simpler of the two. The approach is to resolve `FileManager.url(forUbiquityContainerIdentifier: nil)` at launch on a background thread, fall back to Application Support if iCloud is unavailable, and modify `DatabaseManager` to store its files in the ubiquity container. NSFileCoordinator is required for all file read/write operations in the ubiquity container — the existing atomic checkpoint write must be wrapped in `NSFileCoordinator.coordinate(writingItemAt:)`. The database file will sync automatically when iCloud Drive syncs the container. No CloudKit record-level code is needed; the file is treated as an opaque blob.

**StoreKit 2** (TIER-02/03/04) requires: a `SubscriptionManager` actor/class with `@MainActor` and `ObservableObject`, a local `.storekit` configuration file for sandbox testing, `Product.products(for:)` to load the product catalog, `product.purchase()` for the purchase flow, `Transaction.currentEntitlements` to check active entitlements at launch, and a `Transaction.updates` listener task started at app init. The manager exposes a `currentTier: Tier` published property that `BridgeManager.sendLaunchPayload()` reads for TIER-03. `FeatureGate.swift` is a simple switch on the tier before dispatching `native:action` handler calls (TIER-04).

**Primary recommendation:** Implement TIER-01 first (iCloud path resolution in DatabaseManager), then TIER-02 (SubscriptionManager + StoreKit config file), then TIER-03 (wire tier into LaunchPayload), then TIER-04 (FeatureGate). All four fit in a single phase with no external blockers except App Store Connect product setup (pre-known, mitigated by local .storekit file).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Foundation (FileManager) | built-in | `url(forUbiquityContainerIdentifier:)`, ubiquity container access | Only Apple-blessed API for iCloud Documents path resolution |
| Foundation (NSFileCoordinator) | built-in | Coordinated reads/writes to iCloud ubiquity container | Required by Apple; prevents corruption when iCloudDaemon and app access file concurrently |
| StoreKit 2 | built-in (iOS 15+, macOS 12+) | Product loading, purchase flow, entitlement checking | Native Apple framework; no third-party dependency needed for serverless subscription checking |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| StoreKit Configuration File (.storekit) | Xcode built-in | Local sandbox testing of in-app purchases | Always — allows testing without App Store Connect setup; supports both local and synced modes |
| NSMetadataQuery | built-in | Monitor iCloud sync status (download/upload progress) | Use if UX requires showing sync status indicator; not required for TIER-01 success criteria |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| iCloud Documents (file-level) | CloudKit CKRecord sync | CloudKit requires full schema migration + conflict resolution; explicitly deferred to v2.1+ per STATE.md |
| StoreKit 2 native | RevenueCat SDK | RevenueCat adds third-party dependency + cost; unnecessary for a two-tier subscription model |
| Local StoreKit config file | Full App Store Connect setup | ASC requires provisioning, agreements, banking — the config file unblocks development immediately |

**Installation:**
No new dependencies. All APIs are part of the iOS 15+ / macOS 12+ standard library. Add iCloud + StoreKit capabilities in Xcode's Signing & Capabilities tab.

---

## Architecture Patterns

### Recommended Project Structure

```
native/Isometry/Isometry/
├── DatabaseManager.swift        # MODIFY: add iCloud path resolution (TIER-01)
├── BridgeManager.swift          # MODIFY: wire subscriptionManager.currentTier into sendLaunchPayload (TIER-03)
├── SubscriptionManager.swift    # NEW: StoreKit 2 tier manager (TIER-02)
├── FeatureGate.swift            # NEW: tier enforcement before native:action dispatch (TIER-04)
├── Isometry.entitlements        # NEW: iCloud + StoreKit entitlements
└── Isometry.storekit            # NEW: local StoreKit configuration file
```

### Pattern 1: iCloud Documents Path Resolution with Fallback

**What:** Resolve the ubiquity container URL on a background thread at launch; fall back to Application Support if unavailable.

**When to use:** Always. `url(forUbiquityContainerIdentifier:)` blocks on local/remote services — never call from main thread.

**Key rule:** `url(forUbiquityContainerIdentifier:)` returns `nil` when iCloud is not signed in, disabled, or the entitlement is missing. Always use optional binding and fall back gracefully.

**Example:**
```swift
// Source: Apple Developer Documentation + fatbobman.com iCloud Documents guide
// Must be called from background thread — blocks on IPC to iCloud daemon

func resolveStorageURL() -> URL {
    // Always call url(forUbiquityContainerIdentifier:) from a background thread
    if let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) {
        // "Documents" subdirectory required — without it the folder won't appear in Files app
        let docsURL = containerURL.appendingPathComponent("Documents", isDirectory: true)
        try? FileManager.default.createDirectory(at: docsURL, withIntermediateDirectories: true)
        return docsURL
    }
    // iCloud unavailable — fall back to Application Support/Isometry/
    let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return appSupport.appendingPathComponent("Isometry", isDirectory: true)
}
```

### Pattern 2: NSFileCoordinator for Checkpoint Writes

**What:** Wrap all iCloud file writes in `NSFileCoordinator.coordinate(writingItemAt:)`. Reads should also be coordinated when the file may be modified by the sync daemon.

**When to use:** Whenever writing `isometry.db` in the ubiquity container. The existing atomic write sequence (write .tmp → rotate .db to .bak → rename .tmp to .db) must run inside the coordination block.

**Critical constraint:** NSFileCoordinator callbacks run synchronously on the calling thread. Do NOT call from the main thread — call from a background thread (or within a detached Task).

```swift
// Source: Apple Developer Documentation on NSFileCoordinator + fatbobman.com guide
// Coordination block runs synchronously on calling thread

func saveCheckpointCoordinated(_ data: Data, to url: URL) throws {
    var coordinationError: NSError?
    var writeError: Error?

    let coordinator = NSFileCoordinator(filePresenter: nil)
    coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { coordURL in
        do {
            try data.write(to: coordURL)
        } catch {
            writeError = error
        }
    }

    if let error = coordinationError { throw error }
    if let error = writeError { throw error }
}
```

**Important nuance for the existing atomic write pattern:** The `.db` → `.bak` rotation and `.tmp` → `.db` rename are file moves, not writes. Each FileManager.moveItem call that targets a ubiquity file needs its own coordination or the whole sequence should run inside a single `coordinate(writingItemAt: .db, options: .forReplacing)` block writing through the coordinated URL.

### Pattern 3: StoreKit 2 SubscriptionManager

**What:** `@MainActor` `ObservableObject` class that owns product loading, purchase flow, and entitlement state.

**When to use:** Single shared instance in the app, instantiated in `IsometryApp` and passed to `BridgeManager`.

```swift
// Source: swiftwithmajid.com/2023/08/01/mastering-storekit2 + createwithswift.com feature gating guide

enum Tier: String, Comparable {
    case free, pro, workbench

    static func < (lhs: Tier, rhs: Tier) -> Bool {
        let order: [Tier] = [.free, .pro, .workbench]
        return order.firstIndex(of: lhs)! < order.firstIndex(of: rhs)!
    }
}

@MainActor
final class SubscriptionManager: ObservableObject {
    @Published private(set) var currentTier: Tier = .free
    @Published private(set) var products: [Product] = []

    // Product identifiers — must match App Store Connect and .storekit file exactly
    static let productIDs: [String] = [
        "works.isometry.pro.monthly",
        "works.isometry.pro.yearly",
        "works.isometry.workbench.monthly",
        "works.isometry.workbench.yearly"
    ]

    private var updatesTask: Task<Void, Never>?

    init() {
        // Start listening BEFORE loading products — don't miss pending transactions
        updatesTask = listenForTransactionUpdates()
        Task { await loadProducts() }
        Task { await refreshEntitlements() }
    }

    deinit {
        updatesTask?.cancel()
    }

    // MARK: - Product Loading

    func loadProducts() async {
        do {
            products = try await Product.products(for: Self.productIDs)
        } catch {
            // Log error — app still functions without products loaded
        }
    }

    // MARK: - Purchase

    func purchase(_ product: Product) async throws -> Bool {
        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await refreshEntitlements()
            // CRITICAL: finish() only AFTER unlocking features
            await transaction.finish()
            return true
        case .userCancelled:
            return false
        case .pending:
            return false
        @unknown default:
            return false
        }
    }

    // MARK: - Entitlement Check

    func refreshEntitlements() async {
        var highestTier: Tier = .free
        for await entitlement in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(entitlement) else { continue }
            let tier = tierForProductID(transaction.productID)
            if tier > highestTier { highestTier = tier }
        }
        currentTier = highestTier
    }

    // MARK: - Transaction Updates Listener

    private func listenForTransactionUpdates() -> Task<Void, Never> {
        Task(priority: .background) {
            // Transaction.updates emits pending/renewed/revoked transactions
            // that occur outside the app (other device, renewal, Ask to Buy approval)
            for await update in Transaction.updates {
                guard let transaction = try? checkVerified(update) else { continue }
                await refreshEntitlements()
                await transaction.finish()
            }
        }
    }

    // MARK: - Verification

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            // StoreKit failed verification — do not grant entitlement
            throw StoreError.failedVerification
        case .verified(let value):
            return value
        }
    }

    // MARK: - Tier Mapping

    private func tierForProductID(_ productID: String) -> Tier {
        if productID.contains("workbench") { return .workbench }
        if productID.contains("pro") { return .pro }
        return .free
    }
}

enum StoreError: Error {
    case failedVerification
}
```

### Pattern 4: FeatureGate.swift

**What:** Simple enum + function that checks current tier before allowing native actions. Called from the `native:action` handler in `BridgeManager`.

**When to use:** Before dispatching any gated `native:action` (e.g., `cloudSave`, future `export`). `importFile` may be Free-tier as a product decision — confirm with requirements.

```swift
// FeatureGate.swift — TIER-04

enum NativeFeature {
    case fileImport   // Free tier (TIER-04: blocks only when tier < required)
    case cloudSave    // Pro tier
    case exportData   // Pro tier
}

struct FeatureGate {
    static func requiredTier(for feature: NativeFeature) -> Tier {
        switch feature {
        case .fileImport:  return .free
        case .cloudSave:   return .pro
        case .exportData:  return .pro
        }
    }

    static func isAllowed(_ feature: NativeFeature, for currentTier: Tier) -> Bool {
        currentTier >= requiredTier(for: feature)
    }
}
```

**BridgeManager integration:**
```swift
// In the native:action case in BridgeManager.didReceive(_:)
case "native:action":
    let payload = body["payload"] as? [String: Any]
    let kind = payload?["kind"] as? String ?? ""

    // TIER-04: Check feature gate before dispatching
    let feature: NativeFeature? = {
        switch kind {
        case "importFile": return .fileImport
        case "cloudSave":  return .cloudSave
        default:           return nil
        }
    }()

    if let feature, !FeatureGate.isAllowed(feature, for: subscriptionManager?.currentTier ?? .free) {
        logger.warning("FeatureGate blocked \(kind) — requires \(FeatureGate.requiredTier(for: feature))")
        // Optionally send a response back to JS indicating blocked
        return
    }
    handleNativeAction(kind: kind, payload: payload)
```

### Pattern 5: TIER-03 — Wire Tier Into LaunchPayload

**What:** Replace hardcoded `"free"` tier in `BridgeManager.sendLaunchPayload()` with the value from `SubscriptionManager.currentTier`.

```swift
// BridgeManager.swift — TIER-03
// Add property:
var subscriptionManager: SubscriptionManager?

// In sendLaunchPayload(), replace:
// let tier = "free"
// With:
let tier = subscriptionManager?.currentTier.rawValue ?? "free"
```

### Anti-Patterns to Avoid

- **Calling `url(forUbiquityContainerIdentifier:)` on main thread:** This blocks on IPC to iCloud daemon and can cause ANR. Always dispatch to background.
- **Writing files to ubiquity container without NSFileCoordinator:** The iCloud sync daemon can access the file concurrently; uncoordinated writes cause corruption.
- **Mirroring database to both Application Support AND ubiquity container:** Apple explicitly says: use iCloud exclusively OR local exclusively. Do not copy between them.
- **Calling `transaction.finish()` before unlocking features:** Finishing before updating entitlements means the transaction is consumed but features are never granted.
- **Not starting `Transaction.updates` listener at app init:** Pending transactions (Ask to Buy approvals, renewals that fired while app was closed) are delivered immediately on launch only if the listener is active.
- **Not checking `VerificationResult` before granting entitlement:** Jailbroken devices can forge unverified transactions. Always switch on `.verified` vs `.unverified`.
- **Force-unwrapping `url(forUbiquityContainerIdentifier:)`:** Returns `nil` when iCloud is not available. Never force-unwrap.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Receipt verification | Custom JWS signature parser | StoreKit 2 `VerificationResult` | Apple handles cryptographic verification of JWS-signed transactions on-device |
| Subscription renewal tracking | Polling logic / timer | `Transaction.updates` async sequence | Apple delivers renewal/expiry/revocation events automatically; the sequence handles cross-device scenarios |
| Purchase restore | "Restore Purchases" button + custom flow | `Transaction.currentEntitlements` | currentEntitlements reflects the latest state from all devices; eliminates need for explicit restore |
| File conflict resolution | Custom merge logic | iCloud file-level sync (file is atomic blob) | The database is a binary blob — field-level merge is impossible without restructuring to CKRecord; file-level sync is correct because writes only happen via checkpoint (one writer) |
| Concurrency for file writes | Custom lock | NSFileCoordinator | NSFileCoordinator is a system-wide reader-writer lock that coordinates with the iCloud daemon, not just in-process threads |

**Key insight:** Both iCloud Documents and StoreKit 2 are batteries-included frameworks. The entire Phase 14 can be implemented with zero third-party dependencies.

---

## Common Pitfalls

### Pitfall 1: Calling `url(forUbiquityContainerIdentifier:)` on the Main Thread

**What goes wrong:** App hangs, watchdog kills with ANR, or UI freezes for seconds.

**Why it happens:** The function synchronously contacts the iCloud daemon via IPC. On first call or when iCloud state has changed, this blocks for 100ms–2s.

**How to avoid:** Always call inside `Task.detached(priority: .userInitiated) { ... }` or in a `Task` from within an actor's background context. In `DatabaseManager.init()`, call it from a dedicated async init method rather than the synchronous `init`.

**Warning signs:** App freeze at launch on devices with slow iCloud sync, ANR reports in Instruments.

### Pitfall 2: iCloud Ubiquity Container Not Showing in Files App

**What goes wrong:** Files appear to sync but don't show in the iOS Files app.

**Why it happens:** Missing `appendingPathComponent("Documents")` on the container URL. Files must live inside the `Documents/` subdirectory of the ubiquity container to be visible in Files app.

**How to avoid:** Always append `"Documents"` to the container URL. Configure `NSUbiquitousContainerSupportedFolderLevels` in Info.plist.

**Warning signs:** App syncs but user can't see files in Files app.

### Pitfall 3: NSFileCoordinator Deadlock

**What goes wrong:** App deadlocks when a coordination block tries to coordinate again on the same file.

**Why it happens:** NSFileCoordinator coordination blocks must not re-enter coordination for the same file. Nested coordinators on the same queue can deadlock.

**How to avoid:** Never call NSFileCoordinator from inside another NSFileCoordinator block for the same file. The existing DatabaseManager actor serializes access, which prevents re-entrancy as long as coordination is done at the actor method level.

**Warning signs:** App hangs on checkpoint save, especially when backgrounding quickly after launch.

### Pitfall 4: Entitlements Not Configured — Container Returns nil

**What goes wrong:** `url(forUbiquityContainerIdentifier:)` always returns nil even when user has iCloud signed in.

**Why it happens:** Missing `com.apple.developer.ubiquity-container-identifiers` entitlement, or container identifier doesn't match between entitlement and the identifier passed to the function. Wildcard characters in container identifiers are not allowed.

**How to avoid:** Enable iCloud capability in Xcode → Signing & Capabilities. Verify the entitlements file includes `iCloud Documents` service. Use `nil` as identifier to get the default container (simplest path). Check the generated `.entitlements` file after enabling.

**Warning signs:** Always falls back to local Application Support even with iCloud enabled in Settings.

### Pitfall 5: StoreKit 2 Products Return Empty Array

**What goes wrong:** `Product.products(for: productIDs)` returns empty array.

**Why it happens:** Product identifiers in code don't match what's configured in either the local `.storekit` file or App Store Connect. Mismatch is silent — no error thrown, just empty results.

**How to avoid:** Use a local `.storekit` configuration file in Xcode scheme settings for testing. Product IDs in the config file must exactly match the identifiers passed to `Product.products(for:)`. Check Debug → StoreKit → Transaction Manager in Xcode for diagnostics.

**Warning signs:** Empty products array, purchase button never appears, `currentEntitlements` always empty.

### Pitfall 6: Transaction.updates Listener Started Too Late

**What goes wrong:** Transactions that completed while app was closed (e.g., subscription renewal, Ask to Buy approval) are never delivered.

**Why it happens:** `Transaction.updates` delivers pending transactions immediately when the listener is first created. If the listener is created after app setup completes, pending transactions may not be processed.

**How to avoid:** Create the `Transaction.updates` listener as the FIRST action in `SubscriptionManager.init()`, before loading products or checking `currentEntitlements`.

**Warning signs:** Users report that purchases made on another device aren't reflected; subscriptions not activating after parental approval.

### Pitfall 7: iCloud Sync is Not Real-Time

**What goes wrong:** User creates a card on iPhone, immediately opens iPad, doesn't see it.

**Why it happens:** iOS/macOS iCloud file sync is system-managed. The OS decides timing based on network, battery, Low Power Mode, and available storage. There is NO API to force immediate sync.

**How to avoid:** Set correct success criteria: "sees the card after iCloud sync completes" — not "immediately". For TIER-01, success criteria already says "after iCloud sync completes." Document this expectation to users.

**Warning signs:** Incorrect tests that assert immediate sync; user bug reports about "sync not working" when it's actually just delayed.

### Pitfall 8: NSFileCoordinator coordinateWriting with Existing Atomic Pattern

**What goes wrong:** The existing DatabaseManager uses a 3-step atomic rotation (write .tmp → rotate .db to .bak → rename .tmp to .db). Wrapping only the final write in NSFileCoordinator while leaving intermediate moves outside coordination can leave the file in an inconsistent state visible to the sync daemon.

**Why it happens:** NSFileCoordinator coordinates access to a specific URL. If the `.db` URL is coordinated but the `.tmp` and `.bak` URLs are not, the sync daemon can observe an incomplete state during the rotation.

**How to avoid:** When using iCloud path, simplify the write to a single coordinated write operation. Alternatively, use `coordinate(writingItemAt: dbURL, options: .forReplacing)` for the final rename only, since APFS guarantees that `rename()` is atomic even on the iCloud container (same volume). The `.tmp` file should live in the same directory.

---

## Code Examples

Verified patterns from official sources and trusted references:

### iCloud Container URL Resolution (background thread)
```swift
// Source: Apple Developer Documentation + fatbobman.com
// MUST be called from background thread

static func resolveStorageDirectory() -> URL {
    // url(forUbiquityContainerIdentifier:) blocks — background only
    if let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) {
        let dir = containerURL.appendingPathComponent("Documents/Isometry", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
    // Fallback: Application Support (iCloud unavailable)
    let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let dir = appSupport.appendingPathComponent("Isometry", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
}
```

### DatabaseManager Async Init (TIER-01 adaptation)
```swift
// The existing two-init pattern uses synchronous init.
// For iCloud path resolution, add an async factory method:

extension DatabaseManager {
    /// Async factory — resolves iCloud container on background thread, falls back to local.
    static func makeForProduction() async throws -> DatabaseManager {
        let dir = await Task.detached(priority: .userInitiated) {
            resolveStorageDirectory()
        }.value
        return try DatabaseManager(baseDirectory: dir)
    }
}
```

### StoreKit 2 — Check Entitlements at Launch
```swift
// Source: swiftwithmajid.com StoreKit 2 guide + Apple currentEntitlements docs
// iOS 15.0+ / macOS 12.0+

func refreshEntitlements() async {
    var highestTier: Tier = .free
    for await entitlement in Transaction.currentEntitlements {
        switch entitlement {
        case .verified(let transaction):
            let tier = tierForProductID(transaction.productID)
            if tier > highestTier { highestTier = tier }
        case .unverified:
            break  // Do NOT grant entitlement for unverified transactions
        }
    }
    currentTier = highestTier
}
```

### StoreKit 2 — Purchase Flow
```swift
// Source: swiftwithmajid.com + Superwall StoreKit 2 tutorial

func purchase(_ product: Product) async throws -> Transaction? {
    let result = try await product.purchase()
    switch result {
    case .success(let verification):
        switch verification {
        case .verified(let transaction):
            await refreshEntitlements()
            // CRITICAL: finish ONLY after updating entitlements
            await transaction.finish()
            return transaction
        case .unverified(_, let error):
            throw error
        }
    case .pending, .userCancelled:
        return nil
    @unknown default:
        return nil
    }
}
```

### StoreKit Configuration File — Product IDs
```
// .storekit file product identifiers (must match exactly):
works.isometry.pro.monthly
works.isometry.pro.yearly
works.isometry.workbench.monthly
works.isometry.workbench.yearly

// Subscription group: "Isometry"
// Pro tier: works.isometry.pro.monthly / .yearly
// Workbench tier: works.isometry.workbench.monthly / .yearly
```

### Entitlements File (Isometry.entitlements)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
    <!-- iCloud Documents (TIER-01) -->
    <key>com.apple.developer.icloud-services</key>
    <array>
        <string>CloudDocuments</string>
    </array>
    <key>com.apple.developer.ubiquity-container-identifiers</key>
    <array>
        <string>iCloud.works.isometry.Isometry</string>
    </array>
    <!-- StoreKit in-app purchases — no special entitlement needed for StoreKit 2 -->
</dict>
</plist>
```

Note: StoreKit 2 does NOT require a special entitlement. In-app purchases are enabled by default for any App Store distributed app. The capability is enabled in App Store Connect, not via entitlements.

### Info.plist Additions for iCloud Documents
```xml
<!-- Required for iCloud Documents container visibility in Files app -->
<key>NSUbiquitousContainers</key>
<dict>
    <key>iCloud.works.isometry.Isometry</key>
    <dict>
        <key>NSUbiquitousContainerIsDocumentScopePublic</key>
        <true/>
        <key>NSUbiquitousContainerName</key>
        <string>Isometry</string>
        <key>NSUbiquitousContainerSupportedFolderLevels</key>
        <string>One</string>
    </dict>
</dict>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| StoreKit 1 (SKPaymentQueue, receipt validation) | StoreKit 2 (async/await, on-device verification, Transaction.currentEntitlements) | iOS 15 / WWDC21 | No server-side receipt validation required; automatic cross-device entitlement sync |
| Manual `Transaction.restorePurchases()` | `Transaction.currentEntitlements` | iOS 15 | Eliminates need for explicit restore flow — entitlements reflect current state automatically |
| UIDocument subclassing for iCloud Documents | Direct file coordination + NSMetadataQuery | n/a | UIDocument is still valid but overkill for a single opaque binary blob (the sql.js database) |
| StoreKit 1 deprecated | StoreKit 2 fully replaces StoreKit 1 | WWDC24 confirmed deprecation | Use StoreKit 2 only; no migration path needed for new apps on iOS 15+ |

**Deprecated/outdated:**
- `SKPaymentQueue`: Deprecated in favor of StoreKit 2 APIs as of WWDC24. Do not use.
- `appStoreReceiptURL` + receipt base64 + server validation: Replaced by `VerificationResult` JWS on-device. Do not use for new apps.
- `SKProductsRequest`: Replaced by `Product.products(for:)`. Do not use.

**New in WWDC25 (StoreKit):**
- `appTransactionID` added to `AppTransaction` (back-deployed to iOS 15) — unique per Apple Account per app download
- New JWS-signed promotional offer APIs
- `SubscriptionOfferView` (iOS 18.4+) — not relevant for Phase 14 (iOS 15 deployment target)
- These additions are additive; the core StoreKit 2 pattern shown above is unchanged.

---

## Open Questions

1. **Which native:action kinds should be tier-gated?**
   - What we know: The requirements say "FeatureGate.swift enforces tier restrictions before allowing native actions (file import, cloud save)"
   - What's unclear: File import is listed as an example but may be free-tier. The requirements reference "cloud save" which is a future feature not yet in the bridge.
   - Recommendation: Gate `cloudSave` at Pro+; leave `importFile` at Free (accessible to all). FeatureGate should be easily extensible for future actions.

2. **Async DatabaseManager init — where does iCloud resolution happen?**
   - What we know: The current `DatabaseManager.init()` is synchronous. `url(forUbiquityContainerIdentifier:)` must be called from a background thread.
   - What's unclear: Whether to add an async factory method or change the existing init pattern.
   - Recommendation: Add `static func makeForProduction() async throws -> DatabaseManager` that resolves the path on a detached Task. Keep the synchronous `init(baseDirectory:)` for tests. Update `ContentView.setupWebView()` to use the async factory.

3. **StoreKit 2 requires App Store Connect product configuration for production**
   - What we know: Local `.storekit` config file unblocks development. Real purchases require ASC setup.
   - What's unclear: Whether to create ASC products as part of Phase 14 or defer.
   - Recommendation: Phase 14 implements the full Swift code using local config. ASC setup is a parallel external task. The local config is sufficient for all success criteria in Phase 14.

4. **NSFileCoordinator and the existing atomic write pattern**
   - What we know: The current pattern uses 3 FileManager operations (.tmp write, .db rotate to .bak, .tmp rename to .db). The rename is APFS-atomic.
   - What's unclear: Whether to wrap all 3 ops in one coordinator block or just the final rename.
   - Recommendation: Use `coordinate(writingItemAt: dbURL, options: .forReplacing)` for the whole rotation block. The coordination lock prevents the sync daemon from reading a half-written file. All intermediate files (.tmp, .bak) should live in the same directory as .db for APFS rename atomicity.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in config.json — skip automated test mapping.

The project uses Xcode's built-in unit/UI test targets. Phase 14 success criteria are primarily manual verification:

1. **TIER-01**: Create card on iPhone, open iPad, verify card appears after sync — manual device test.
2. **TIER-02**: Purchase Pro via StoreKit sandbox (Xcode Transaction Manager or Sandbox Apple ID) — manual test.
3. **TIER-03**: After Pro purchase, LaunchPayload.tier should be "pro" — verifiable via JS console log in DEBUG.
4. **TIER-04**: Trigger a gated native:action without Pro subscription — verify it logs "FeatureGate blocked" and does not execute.

Unit tests can cover:
- `FeatureGate.isAllowed(:for:)` — pure function, easily unit-testable.
- `Tier` ordering (`<` comparator).
- `SubscriptionManager.tierForProductID(:)` — pure function.

---

## Sources

### Primary (HIGH confidence)
- Apple Developer Documentation — `url(forUbiquityContainerIdentifier:)` — iCloud container URL resolution, nil behavior, background thread requirement
- Apple Developer Documentation — `NSFileCoordinator` — coordination API for ubiquity container writes
- Apple Developer Documentation — `Transaction.currentEntitlements` — StoreKit 2 entitlement sequence
- Apple Developer Documentation — `Transaction.updates` — async sequence for transaction monitoring
- Apple Developer Documentation — Setting up StoreKit Testing in Xcode — local .storekit config file setup
- Apple Developer Documentation — `VerificationResult` — transaction signature verification

### Secondary (MEDIUM confidence)
- [fatbobman.com — In-Depth Guide to iCloud Documents](https://fatbobman.com/en/posts/in-depth-guide-to-icloud-documents/) — iCloud Documents setup, NSFileCoordinator usage, Info.plist configuration (verified against Apple docs)
- [fatbobman.com — Advanced iCloud Documents](https://fatbobman.com/en/posts/advanced-icloud-documents/) — placeholder files, NSMetadataQuery, download status keys (verified against Apple NSURL attribute keys)
- [swiftwithmajid.com — Mastering StoreKit 2](https://swiftwithmajid.com/2023/08/01/mastering-storekit2/) — StoreKit 2 purchase patterns, Transaction.updates, finish() ordering (verified against Apple WWDC content)
- [createwithswift.com — Providing access to premium features with StoreKit 2](https://www.createwithswift.com/providing-access-to-premium-features-with-storekit-2/) — feature gating tier pattern (verified with StoreKit 2 concepts)
- [zottmann.org — iOS iCloud Drive Synchronization Deep Dive (2025)](https://zottmann.org/2025/09/08/ios-icloud-drive-synchronization-deep.html) — real-world sync timing behavior, NSFileCoordinator overhead, pitfall documentation

### Tertiary (LOW confidence)
- Multiple Medium/blog posts on StoreKit 2 pattern — used for corroboration only; not cited directly
- Apple Developer Forums threads on NSFileCoordinator/SQLite — historical; patterns match official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both iCloud Documents and StoreKit 2 are pure Apple built-ins with well-documented APIs; no version uncertainty for iOS 15+ targets
- Architecture: HIGH — patterns verified against multiple sources; iCloud fallback, NSFileCoordinator wrapping, StoreKit 2 entitlement check are all well-established
- Pitfalls: HIGH — iCloud sync timing (Pitfall 7), NSFileCoordinator thread requirements (Pitfall 1), and StoreKit finish() ordering (Pitfall 6) are confirmed by official docs + recent (2025) real-world reports
- Feature gating: MEDIUM — the specific tier mapping (which features require which tier) is a product decision not researchable; the mechanism is straightforward

**Research date:** 2026-03-03
**Valid until:** 2026-06-01 (iCloud Documents API is stable; StoreKit 2 receives additive updates but core APIs unchanged since iOS 15)
