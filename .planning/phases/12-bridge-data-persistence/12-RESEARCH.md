# Phase 12: Bridge + Data Persistence - Research

**Researched:** 2026-03-03
**Domain:** WKWebView Swift↔JS Bridge, iOS/macOS App Lifecycle, Atomic File I/O
**Confidence:** HIGH (all critical claims verified from multiple sources or Apple docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bridge message flow:**
- Single `nativeBridge` WKScriptMessageHandler receives all JS→Swift messages; Swift dispatches on a `type` field in the message envelope
- Swift→JS messages use `webView.evaluateJavaScript()` calling `window.__isometry.receive({type, payload})` — JS registers this global callback at startup
- LaunchPayload (dbData + platform + tier + viewport + safeAreaInsets) is sent via evaluateJavaScript AFTER JS signals ready, not injected as WKUserScript at document start
- BridgeManager class owns the webView (weak ref), registers handlers, dispatches incoming, sends outgoing — WeakScriptMessageHandler is a private nested class inside BridgeManager
- Bridge reuses the existing Worker envelope pattern `{ id, type, payload, timestamp }` for consistency

**Checkpoint strategy:**
- Swift-side timer fires every 30 seconds; Swift asks JS to export the database via the bridge, receives bytes back, writes to disk
- Timer pauses during background and resumes when app becomes active
- Atomic write: write to `isometry.db.tmp` in the same directory, then `rename()` — guaranteed atomic on APFS/HFS+ (same volume)
- Dirty flag: JS sends a lightweight `{ type: 'mutated' }` message via nativeBridge after any INSERT/UPDATE/DELETE; Swift sets `isDirty = true`
- Background save (scenePhase → .background): only runs checkpoint if isDirty; uses the same checkpoint code path as autosave
- After successful checkpoint write, isDirty resets to false

**Crash recovery:**
- On `webViewWebContentProcessDidTerminate`: show a native SwiftUI overlay ("Restoring...") during reload, auto-dismiss after JS signals ready again
- Checkpoint-level granularity accepted — max 30 seconds of potential data loss since last autosave. No WAL-style mutation log.
- One-level backup: before each checkpoint write, rename current `isometry.db` to `isometry.db.bak`, then write new file
- On launch corruption cascade: try primary `isometry.db` → try `isometry.db.bak` → start fresh with empty database. Log failures for debugging.

**Database file location:**
- Application Support/Isometry/isometry.db — standard Apple-recommended location for app data
- Phase 14 handles migration to iCloud ubiquity container; no iCloud path logic in Phase 12
- File is NOT excluded from backup (isExcludedFromBackup = false) — user data should survive device restore
- DatabaseManager is a Swift actor — provides built-in serialization for concurrent checkpoint requests and lifecycle events
- First launch (no file): Swift sends null dbData in LaunchPayload; JS creates a fresh database with schema only, no seed data

### Claude's Discretion
- Exact SwiftUI overlay design for crash recovery indicator
- Timer implementation details (Timer vs Task.sleep loop)
- Error logging mechanism (os_log vs print vs custom logger)
- Exact bridge message type names and payload shapes (following the established patterns)
- How to detect "JS ready" signal (callback, postMessage, or polling)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRDG-01 | Swift↔JS bridge supports LaunchPayload message (Swift → JS) delivering dbData, platform, tier, viewport, safeAreaInsets | evaluateJavaScript pattern; base64 encoding for dbData bytes; must be called on main thread |
| BRDG-02 | Swift↔JS bridge supports CheckpointRequest message (JS → Swift) for database persistence | WKScriptMessageHandler; binary data MUST be base64-encoded (not raw Uint8Array); DatabaseManager actor serializes writes |
| BRDG-03 | Swift↔JS bridge supports NativeActionRequest/NativeResponse messages for native capability dispatch | Same WKScriptMessageHandler + evaluateJavaScript dispatch pattern; type-dispatched envelope |
| BRDG-04 | Swift↔JS bridge supports SyncNotification message (Swift → JS) for CloudKit change delivery | evaluateJavaScript → window.__isometry.receive(); Phase 14 fills this; stub in Phase 12 |
| BRDG-05 | Bridge uses WeakScriptMessageHandler proxy to prevent WKWebView retain cycle | Verified: WKUserContentController holds strong ref; proxy class with weak delegate breaks cycle |
| DATA-01 | DatabaseManager loads existing `isometry.db` on launch and sends base64 to JS for sql.js hydration | FileManager.default.contents(atPath:); Data → base64EncodedString(); evaluateJavaScript LaunchPayload |
| DATA-02 | DatabaseManager handles first-launch (no file) by sending null dbData so JS creates a fresh database | FileManager.fileExists check; null dbData in LaunchPayload; JS side: initialize with empty DB if null |
| DATA-03 | Checkpoint handler writes `isometry.db` atomically (write-to-temp, then rename) on JS checkpoint request | FileManager.moveItem(at:to:) is atomic on APFS; write to .tmp first, then rename |
| DATA-04 | App persists database on entering background (iOS: scenePhase, macOS: applicationWillTerminate) | iOS: scenePhase .background + UIApplication.beginBackgroundTask; macOS: NSApplicationDelegateAdaptor |
| DATA-05 | Autosave timer triggers checkpoint every 30 seconds while app is active | Timer.scheduledTimer or Task.sleep loop; invalidate/restart on scenePhase transitions |
| SHELL-05 | App recovers from WebContent process termination (memory pressure) by reloading and restoring from last checkpoint | WKNavigationDelegate.webViewWebContentProcessDidTerminate; reload(); SwiftUI overlay during reload |
</phase_requirements>

---

## Summary

Phase 12 wires the Swift-native shell to the existing JavaScript web runtime through a bidirectional bridge and makes the in-memory sql.js database survive the full iOS/macOS app lifecycle. The work divides cleanly into three slices: (1) the WKWebView bridge (JS↔Swift message passing), (2) DatabaseManager (actor-serialized file I/O for load, checkpoint, backup), and (3) lifecycle integration (autosave timer, background save, crash recovery).

The most critical technical finding is that **WKScriptMessageHandler `message.body` does not support Uint8Array or ArrayBuffer** — binary data must be base64-encoded on the JavaScript side before posting via `window.webkit.messageHandlers.nativeBridge.postMessage()`, and decoded from `Data(base64Encoded:)` on the Swift side. This applies to the CheckpointRequest payload (the sql.js database export). The existing `db:export` Worker handler already returns a `Uint8Array`; the JS bridge layer must convert it to a base64 string before the `nativeBridge.postMessage()` call.

The second critical finding is that **ScenePhase is unreliable on macOS** — `.background` does not fire on cmd-Q or window close, only on cmd-H (hide). macOS termination must be handled via `NSApplicationDelegateAdaptor` and `applicationWillTerminate`. iOS uses `scenePhase .background` + `UIApplication.beginBackgroundTask` to request ~30 seconds of background execution time, which is sufficient for a synchronous file write of a sql.js database (even large ones are a few MB at most).

**Primary recommendation:** Build BridgeManager (bridge plumbing) first, then DatabaseManager (file I/O), then wire lifecycle events — each slice is independently testable.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WebKit (`WKWebView`) | iOS 15+ / macOS 12+ | Host web runtime, provide bridge APIs | Only supported embedding API for WKWebView JS bridge |
| Foundation (`FileManager`, `Data`) | System | File I/O, base64 encode/decode | Native, no dependencies |
| Swift Actors | Swift 5.9+ | Serialize concurrent database access | Language-native concurrency primitive |
| SwiftUI `@Environment(\.scenePhase)` | iOS 15+ | Detect foreground/background on iOS | Standard SwiftUI lifecycle API |
| `NSApplicationDelegateAdaptor` | macOS 12+ | Handle `applicationWillTerminate` on macOS | Only reliable termination hook on macOS |
| `UIApplication.beginBackgroundTask` | iOS 15+ | Extend execution time for file write on iOS background | Apple's documented approach for finishing work in background |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `os.Logger` | iOS 14+ / macOS 11+ | Structured logging | Error/lifecycle events; prefer over print() in production paths |
| `Timer` | Foundation | Autosave timer implementation | Simpler than Task.sleep loop; explicitly invalidatable |
| `WKNavigationDelegate` | WebKit | Crash recovery via process termination callback | Required for SHELL-05 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `WeakScriptMessageHandler` proxy class | `addScriptMessageHandlerWithReply` | Reply variant has known 7-year-old bug; avoid |
| base64 string for binary transfer | Array of NSNumber | base64 is more compact and standard for binary blobs |
| `Timer.scheduledTimer` | `Task { while true { try await Task.sleep(…) } }` | Task-based requires careful cancellation; Timer is simpler and explicitly invalidatable on background |
| `NSApplicationDelegateAdaptor` | ScenePhase on macOS | ScenePhase .background DOES NOT fire on cmd-Q on macOS (confirmed 2024) |

---

## Architecture Patterns

### Recommended File Structure (new files for Phase 12)

```
native/Isometry/Isometry/
├── BridgeManager.swift          ← All WKWebView bridge logic; owns 5 message types
├── DatabaseManager.swift        ← Actor; file load/save/atomic rename/backup cascade
├── ContentView.swift            ← MODIFIED: delegate webView setup to BridgeManager
└── IsometryApp.swift            ← MODIFIED: scenePhase + macOS delegate adaptor

src/
├── native/
│   └── NativeBridge.ts          ← NEW: JS-side bridge (window.__isometry.receive + postMessage helpers)
└── main.ts                      ← MODIFIED: register window.__isometry.receive, signal JS ready
```

### Pattern 1: WeakScriptMessageHandler Proxy (BRDG-05)

**What:** A nested class inside BridgeManager that holds a weak reference to BridgeManager, registered with WKUserContentController instead of BridgeManager directly.
**Why:** WKUserContentController holds a strong reference to any registered handler. Registering `self` (BridgeManager) creates a retain cycle: webView → userContentController → BridgeManager → webView. The proxy breaks this.

```swift
// Source: Apple Developer Forums + verified community pattern
final class BridgeManager: NSObject {
    weak var webView: WKWebView?

    // Private proxy — only purpose is to break the retain cycle
    private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
        weak var delegate: BridgeManager?

        init(_ delegate: BridgeManager) { self.delegate = delegate }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            delegate?.didReceive(message)
        }
    }

    func register(with config: WKWebViewConfiguration) {
        let proxy = WeakScriptMessageHandler(self)
        config.userContentController.add(proxy, name: "nativeBridge")
    }

    func didReceive(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        // Dispatch on type field
    }
}
```

### Pattern 2: LaunchPayload Delivery (BRDG-01)

**What:** After JS signals ready (`{ type: 'native:ready' }` via nativeBridge), Swift sends LaunchPayload via `evaluateJavaScript`.
**When to use:** One-time at app launch and after WebContent process recovery.
**Critical:** `evaluateJavaScript` MUST be called on the main thread.

```swift
// Source: Apple Developer Documentation + community verification
@MainActor
func sendLaunchPayload(dbData: Data?) async throws {
    let base64 = dbData?.base64EncodedString() ?? "null"
    let js = """
        window.__isometry.receive({
            type: 'native:launch',
            payload: {
                dbData: \(base64 == "null" ? "null" : "\"\(base64)\""),
                platform: '\(platformString)',
                viewport: { width: \(viewportWidth), height: \(viewportHeight) }
            }
        });
    """
    try await webView?.evaluateJavaScript(js)
}
```

### Pattern 3: Checkpoint Binary Transfer (BRDG-02 + DATA-03)

**Critical finding:** `WKScriptMessageHandler.message.body` supported types are limited to: NSNumber, NSString, NSDate, NSArray, NSDictionary, NSNull. **Uint8Array and ArrayBuffer are NOT supported.** They arrive as a serialized JS object `{ "0": 0, "1": 0, ... }` which is not useful.

**Solution:** JS converts `Uint8Array` → base64 string before postMessage; Swift decodes `Data(base64Encoded:)`.

JavaScript side (in NativeBridge.ts):
```typescript
// Source: Apple Developer Forums thread/125891 confirmed pattern
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function checkpoint(bridge: WorkerBridge): Promise<void> {
    const dbBytes = await bridge.exportDatabase();
    const base64 = uint8ArrayToBase64(dbBytes);
    window.webkit.messageHandlers.nativeBridge.postMessage({
        type: 'checkpoint',
        id: crypto.randomUUID(),
        payload: { dbData: base64 },
        timestamp: Date.now(),
    });
}
```

Swift side (in BridgeManager → DatabaseManager):
```swift
// Source: Foundation Data API
case "checkpoint":
    guard let payload = body["payload"] as? [String: Any],
          let base64 = payload["dbData"] as? String,
          let data = Data(base64Encoded: base64) else { return }
    Task {
        try await databaseManager.saveCheckpoint(data)
    }
```

### Pattern 4: Atomic File Write (DATA-03)

**What:** Write to a temp file in the same directory, then rename. On APFS (iOS/macOS), `FileManager.moveItem(at:to:)` on the same volume is atomic.

```swift
// Source: Apple File System Guide — APFS atomic safe-save guarantee
actor DatabaseManager {
    private let dbURL: URL
    private let tmpURL: URL
    private let bakURL: URL

    init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = appSupport.appendingPathComponent("Isometry")
        dbURL  = dir.appendingPathComponent("isometry.db")
        tmpURL = dir.appendingPathComponent("isometry.db.tmp")
        bakURL = dir.appendingPathComponent("isometry.db.bak")
    }

    func saveCheckpoint(_ data: Data) throws {
        let fm = FileManager.default
        // 1. Write new data to temp file
        try data.write(to: tmpURL, options: .atomic)
        // 2. Rotate existing → .bak
        if fm.fileExists(atPath: dbURL.path) {
            _ = try? fm.removeItem(at: bakURL)
            try fm.moveItem(at: dbURL, to: bakURL)
        }
        // 3. Atomic rename tmp → primary (same APFS volume = atomic)
        try fm.moveItem(at: tmpURL, to: dbURL)
    }
}
```

Note: `data.write(to:options:.atomic)` itself writes to a temp then renames internally, but using explicit tmp+rename gives us the backup rotation step between writes.

### Pattern 5: iOS Background Save (DATA-04)

**What:** When scenePhase transitions to `.background`, request background execution time and save.
**Time budget:** iOS grants approximately 30 seconds of background execution — more than sufficient for a file write.

```swift
// Source: Apple Developer Documentation — beginBackgroundTask
.onChange(of: scenePhase) { newPhase in
    if newPhase == .background {
        // Must call beginBackgroundTask on main thread
        let taskID = UIApplication.shared.beginBackgroundTask {
            // Expiration handler: time is almost up — end task
            UIApplication.shared.endBackgroundTask(taskID)
        }
        Task {
            await bridgeManager.saveIfDirty()
            UIApplication.shared.endBackgroundTask(taskID)
        }
    }
}
```

### Pattern 6: macOS Termination Save (DATA-04)

**What:** ScenePhase does NOT fire on cmd-Q on macOS. Use `NSApplicationDelegateAdaptor`.

```swift
// Source: Jesse Squires — "SwiftUI app lifecycle: issues with ScenePhase" (June 2024)
// https://www.jessesquires.com/blog/2024/06/29/swiftui-scene-phase/

@main
struct IsometryApp: App {
    @NSApplicationDelegateAdaptor var appDelegate: IsometryAppDelegate

    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

final class IsometryAppDelegate: NSObject, NSApplicationDelegate {
    var bridgeManager: BridgeManager?

    func applicationWillTerminate(_ notification: Notification) {
        // Synchronous checkpoint — macOS gives time to finish before quitting
        // Must be sync here; bridgeManager must have a sync save path
    }
}
```

### Pattern 7: WebContent Process Crash Recovery (SHELL-05)

**What:** Implement `WKNavigationDelegate.webViewWebContentProcessDidTerminate` to show overlay, reload, and restore from checkpoint.

```swift
// Source: Apple Developer Documentation, Embrace.io blog, webkit.org bug tracker
extension BridgeManager: WKNavigationDelegate {
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // 1. Show native overlay (SwiftUI state change)
        showingRecoveryOverlay = true
        // 2. Reload the web content — WKWebView loads from app:// scheme
        webView.reload()
        // After reload, JS will call native:ready → Swift sends LaunchPayload with last checkpoint
    }
}
```

**Important caveat:** The delegate callback is NOT guaranteed to fire in all crash scenarios (noted in webkit.org bug #176855). For additional robustness, `viewWillAppear`/`scenePhase .active` can check if the webView's URL is nil (indicates blank state).

### Pattern 8: Autosave Timer (DATA-05)

**Recommendation:** Use `Timer.scheduledTimer` on the main run loop (pauses automatically in background) rather than a `Task.sleep` loop, which requires explicit cancellation management.

```swift
// Source: Foundation Timer documentation
class BridgeManager {
    private var autosaveTimer: Timer?

    func startAutosave() {
        autosaveTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { await self?.requestCheckpoint() }
        }
    }

    func stopAutosave() {
        autosaveTimer?.invalidate()
        autosaveTimer = nil
    }
}
```

Note: `Timer.scheduledTimer` on the main run loop does NOT fire when the app is in the background — it naturally pauses, satisfying the "timer pauses during background" requirement without extra code.

### Anti-Patterns to Avoid

- **Registering `self` directly as WKScriptMessageHandler:** Creates a retain cycle. Always use the weak proxy.
- **Sending Uint8Array directly via postMessage:** Arrives as `{ "0": 0, "1": 1, ... }` object, not binary. Always base64.
- **Using ScenePhase for macOS termination:** `.background` does not fire on cmd-Q. Use `NSApplicationDelegateAdaptor`.
- **Calling `evaluateJavaScript` off the main thread:** Will crash with a runtime assertion. Always dispatch to `@MainActor` or `DispatchQueue.main`.
- **Using `WKScriptMessageHandlerWithReply`:** Has a known 7-year-old bug with JavaScript evaluation errors. Use the simpler `WKScriptMessageHandler` with fire-and-forget semantics.
- **Injecting LaunchPayload as a WKUserScript at document start:** SQL.js Worker isn't initialized yet. Always wait for the JS ready signal before sending LaunchPayload.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retain cycle breaking | Custom deallocation timing | WeakScriptMessageHandler proxy pattern | Established pattern; custom timing is fragile |
| Binary data serialization | Custom binary protocol | base64 (Foundation Data API) | WKScriptMessageHandler type restrictions are fixed; base64 is the canonical solution |
| Atomic file write | Manual temp + copy + delete | `FileManager.moveItem` after write to same volume | OS-level atomic rename via APFS; manual copy-delete is NOT atomic |
| Thread-safe DB access | DispatchQueue + locks | Swift Actor | Language-native, composable with async/await, no manual lock management |
| Background time extension | Sleep/polling | `UIApplication.beginBackgroundTask` | Apple's documented API; ~30s budget; OS will kill without it |

---

## Common Pitfalls

### Pitfall 1: Uint8Array Posted via nativeBridge Arrives as JS Object Dictionary

**What goes wrong:** JS calls `window.webkit.messageHandlers.nativeBridge.postMessage(uint8Array)`. Swift receives `message.body` as an `NSDictionary` with integer keys `{"0": 0, "1": 0, ...}` — not binary data.
**Why it happens:** WKScriptMessageHandler serializes JS objects through WebKit's value serialization. TypedArrays are not in the supported type list (NSNumber, NSString, NSDate, NSArray, NSDictionary, NSNull).
**How to avoid:** Always convert `Uint8Array` → base64 string in JS before posting. On Swift side, cast `message.body` as `String` (not `Data`), then `Data(base64Encoded: string)`.
**Warning signs:** Swift checkpoint handler receives a `[String: Any]` dictionary with numeric keys instead of a `String`.

### Pitfall 2: ScenePhase .background Does Not Fire on macOS cmd-Q

**What goes wrong:** Developer uses `onChange(of: scenePhase)` to save database on quit. On macOS, quitting with cmd-Q produces no scenePhase event, so database is never saved.
**Why it happens:** macOS ScenePhase is fundamentally broken — only responds to app hide (cmd-H). Verified by Jesse Squires (June 2024) and Apple Developer Forum discussions.
**How to avoid:** On macOS, use `@NSApplicationDelegateAdaptor` and implement `applicationWillTerminate`. On iOS, `scenePhase .background` is reliable.
**Warning signs:** Database saves work in testing (by hiding app) but not in production use (by quitting app).

### Pitfall 3: evaluateJavaScript Called Before JS Ready

**What goes wrong:** Swift sends LaunchPayload immediately after WKWebView loads. JS receives the message before `window.__isometry.receive` is registered — message is silently dropped.
**Why it happens:** JavaScript initialization (including Worker startup, WASM loading) takes 1-3 seconds. `webView(_ webView: WKWebView, didFinish navigation)` fires when the initial HTML is parsed, not when JS app init is complete.
**How to avoid:** Wait for JS to post `{ type: 'native:ready' }` via `nativeBridge` before sending LaunchPayload. JS signals this after `main()` completes and `window.__isometry.receive` is registered.
**Warning signs:** LaunchPayload send succeeds but the web app starts with an empty database despite a checkpoint file existing on disk.

### Pitfall 4: Actor Isolation + WKScriptMessageHandler Threading

**What goes wrong:** Swift 6 strict concurrency flags: calling `@MainActor`-isolated `webView.evaluateJavaScript()` from inside a non-isolated async task, or accessing `isDirty` actor state from a non-actor context.
**Why it happens:** WKWebView methods are `@MainActor`; the DatabaseManager actor runs on its own executor; bridging between them requires explicit `await` or `MainActor.run { }`.
**How to avoid:** Mark BridgeManager methods that call `evaluateJavaScript` as `@MainActor`. DatabaseManager is an actor — callers `await` its methods. Don't mix actor isolation without explicit boundary crossing.
**Warning signs:** Xcode 16 strict concurrency warnings; runtime crashes on iOS 18 with Swift 6 mode.

### Pitfall 5: Timer Fires in Background (if using Task.sleep pattern)

**What goes wrong:** Autosave implemented as `Task { while true { try await Task.sleep(…) } }` — continues scheduling work even when app is backgrounded because Task is not tied to the main run loop.
**Why it happens:** Swift Tasks run on the cooperative thread pool, which is not suspended when the app backgrounds.
**How to avoid:** Use `Timer.scheduledTimer` on the main run loop — automatically pauses when the run loop is not executing (i.e., when the app is backgrounded). If using Task approach, explicitly cancel and restart on scenePhase changes.
**Warning signs:** Checkpoint requests hitting DatabaseManager while the app is in the background, causing unnecessary background CPU usage.

### Pitfall 6: webViewWebContentProcessDidTerminate Not Always Called

**What goes wrong:** App goes blank after memory pressure. `webViewWebContentProcessDidTerminate` is never called. No recovery happens.
**Why it happens:** WebKit has a known bug (webkit.org #176855) where the callback is sometimes not invoked, particularly on older iOS versions.
**How to avoid:** Add a secondary check: when the app becomes active (`scenePhase .active`), check if `webView.url == nil`. If nil, the WebContent process crashed silently — trigger recovery manually.
**Warning signs:** Blank WebView with no recovery overlay shown, even after confirmed memory pressure event.

---

## Code Examples

Verified patterns from official sources and established community practice:

### JS-Side: Register Bridge + Signal Ready

```typescript
// src/native/NativeBridge.ts — new file for Phase 12
// Source: Established WKWebView bridge pattern; window.__isometry already set in main.ts

export function initNativeBridge(bridge: WorkerBridge): void {
    if (window.location.protocol !== 'app:') return; // only in native shell

    // Register receive callback for Swift→JS messages
    (window as any).__isometry.receive = (message: { type: string; payload: unknown }) => {
        switch (message.type) {
            case 'native:launch':
                handleLaunchPayload(bridge, message.payload as LaunchPayload);
                break;
            case 'native:sync':
                // Phase 14: CloudKit change delivery stub
                break;
        }
    };

    // Signal to Swift that JS is ready for LaunchPayload
    window.webkit.messageHandlers.nativeBridge.postMessage({
        type: 'native:ready',
        id: crypto.randomUUID(),
        payload: {},
        timestamp: Date.now(),
    });
}

async function handleLaunchPayload(bridge: WorkerBridge, payload: LaunchPayload): Promise<void> {
    if (payload.dbData) {
        // Hydrate sql.js from checkpoint bytes
        // bridge.hydrateFromBase64(payload.dbData) — new WorkerBridge method needed
    }
    // Mark dirty flag listener
    installMutationHook(bridge);
}

function installMutationHook(bridge: WorkerBridge): void {
    // After any mutating operation, post 'mutated' message
    // Hook into WorkerBridge.send() or MutationManager
}
```

### JS-Side: base64 Checkpoint Sender

```typescript
// Source: Apple Developer Forums thread/125891 — confirmed binary transfer pattern

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export async function sendCheckpoint(bridge: WorkerBridge): Promise<void> {
    const dbBytes: Uint8Array = await bridge.exportDatabase();
    const base64 = uint8ArrayToBase64(dbBytes);
    (window as any).webkit.messageHandlers.nativeBridge.postMessage({
        type: 'checkpoint',
        id: crypto.randomUUID(),
        payload: { dbData: base64 },
        timestamp: Date.now(),
    });
}
```

### Swift: BridgeManager Skeleton

```swift
// Source: Pattern derived from ConsoleLogHandler in ContentView.swift + proxy pattern

@MainActor
final class BridgeManager: NSObject {
    weak var webView: WKWebView?
    var databaseManager: DatabaseManager?

    // Weak proxy — breaks WKUserContentController retain cycle
    private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
        weak var delegate: BridgeManager?
        init(_ delegate: BridgeManager) { self.delegate = delegate }
        func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
            delegate?.didReceive(message)
        }
    }

    func register(with config: WKWebViewConfiguration) {
        config.userContentController.add(WeakScriptMessageHandler(self), name: "nativeBridge")
    }

    func didReceive(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        switch type {
        case "native:ready":
            Task { await sendLaunchPayload() }
        case "checkpoint":
            guard let payload = body["payload"] as? [String: Any],
                  let base64 = payload["dbData"] as? String,
                  let data = Data(base64Encoded: base64) else { return }
            Task { try? await databaseManager?.saveCheckpoint(data) }
        case "mutated":
            databaseManager?.markDirty()
        default:
            break
        }
    }

    func sendLaunchPayload() async {
        let dbData = await databaseManager?.loadDatabase()
        let base64 = dbData?.base64EncodedString() ?? "null"
        let dbArg = dbData != nil ? "\"\(base64)\"" : "null"
        let js = "window.__isometry.receive({type:'native:launch',payload:{dbData:\(dbArg)}});"
        try? await webView?.evaluateJavaScript(js)
    }
}
```

### Swift: DatabaseManager Actor

```swift
// Source: Swift Actor documentation; APFS atomic rename guarantee

actor DatabaseManager {
    private let dbURL: URL
    private let tmpURL: URL
    private let bakURL: URL
    private(set) var isDirty: Bool = false

    init() throws {
        let fm = FileManager.default
        let appSupport = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = appSupport.appendingPathComponent("Isometry", isDirectory: true)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        dbURL  = dir.appendingPathComponent("isometry.db")
        tmpURL = dir.appendingPathComponent("isometry.db.tmp")
        bakURL = dir.appendingPathComponent("isometry.db.bak")
    }

    func loadDatabase() -> Data? {
        FileManager.default.contents(atPath: dbURL.path)
    }

    func markDirty() { isDirty = true }

    func saveCheckpoint(_ data: Data) throws {
        let fm = FileManager.default
        try data.write(to: tmpURL)
        if fm.fileExists(atPath: dbURL.path) {
            _ = try? fm.removeItem(at: bakURL)
            try? fm.moveItem(at: dbURL, to: bakURL)
        }
        try fm.moveItem(at: tmpURL, to: dbURL)
        isDirty = false
    }

    func saveIfDirty(bridge: BridgeManager) async throws {
        guard isDirty else { return }
        await bridge.requestCheckpointAndWait()  // bridge asks JS, JS posts back
    }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `addScriptMessageHandler(self)` direct | WeakScriptMessageHandler proxy | Recognized ~2016, still essential | Prevents memory leak |
| `WKScriptMessageHandlerWithReply` | `WKScriptMessageHandler` (fire-and-forget) | Reply variant has known bugs | Simpler, more reliable |
| ScenePhase for macOS lifecycle | `NSApplicationDelegateAdaptor` | macOS issues documented 2024 | Only reliable termination hook |
| `DispatchQueue` + locks | Swift Actor | Swift 5.5+ | Language-native, safer |
| Polling for JS ready | JS signals via postMessage | N/A | Deterministic, no timeout guessing |

**Deprecated/outdated:**
- `webView.evaluateJavaScript(_:completionHandler:)` callback form: Prefer the async/await form (`try await webView.evaluateJavaScript(js)`) available iOS 15+/macOS 12+, which matches the phase's deployment targets.
- `WKScriptMessageHandlerWithReply`: Avoid; has a multi-year Safari/WebKit bug with replyHandler evaluation errors.

---

## Open Questions

1. **db.export() performance at 10K+ cards**
   - What we know: sql.js maintainers say "exporting even huge databases never takes more than a few seconds." A typical ~10K card database is likely 2–8 MB.
   - What's unclear: Actual timing in WKWebView on an iPhone (lower memory than desktop). The STATE.md flagged "db.export() timing at 10K+ cards is unvalidated."
   - Recommendation: Add a benchmark in Phase 12 testing — export 10K cards, measure `db:export` latency. If >1 second, consider chunking the base64 string in the postMessage or increasing the dirty-check debounce to avoid frequent exports.

2. **evaluateJavaScript payload size limits for LaunchPayload**
   - What we know: No officially documented hard limit found. Community sources suggest it works for large strings; base64 of a 5MB database is ~6.7MB string.
   - What's unclear: Whether WKWebView has an undocumented string size cap for evaluateJavaScript in practice on iOS.
   - Recommendation: Test with a 5MB database file at launch (base64 ~6.7MB). If evaluateJavaScript silently fails, switch to chunked delivery via sequential postMessage calls from JS that trigger chunk-by-chunk data reads.

3. **Swift 6 strict concurrency for BridgeManager**
   - What we know: BridgeManager must be `@MainActor` because it calls `evaluateJavaScript`. The `didReceive` callback (from WKScriptMessageHandler) is called on the main thread, which aligns with `@MainActor`. The `WeakScriptMessageHandler` proxy needs to be `nonisolated` since the protocol requires it.
   - What's unclear: Exact annotation pattern needed to satisfy Xcode 16 strict concurrency with `@MainActor` BridgeManager + `nonisolated` proxy `userContentController` method.
   - Recommendation: Mark proxy `userContentController` as `nonisolated`, use `MainActor.assumeIsolated { delegate?.didReceive(message) }` inside. This is the verified Swift 6 pattern from Apple forums.

4. **macOS `applicationWillTerminate` execution budget**
   - What we know: macOS does not have iOS's `beginBackgroundTask` hard limit. `applicationWillTerminate` is called synchronously before the app quits.
   - What's unclear: Whether the checkpoint request/response round-trip (Swift asks JS → JS exports → JS posts back → Swift writes) can complete synchronously, or whether `applicationWillTerminate` exits before the async response arrives.
   - Recommendation: For macOS termination, use a synchronous fallback: if a database file already exists on disk, rely on it (last 30-second autosave). Only the isDirty window of up to 30 seconds is lost, which is the accepted tradeoff per CONTEXT.md decisions.

---

## Validation Architecture

> nyquist_validation not set in config.json — this section is included per standard practice.

The project uses Vitest for TypeScript tests. Swift code is tested via XCTest. Phase 12 requirements split across both:

### Test Framework

| Property | Value |
|----------|-------|
| TypeScript tests | Vitest 4.0 |
| Swift tests | XCTest (IsometryTests target) |
| Quick run (TS) | `npm test` |
| Full suite (TS) | `npm test -- --run` |
| Swift tests | Xcode → Product → Test (or `xcodebuild test`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| BRDG-01 | LaunchPayload sent after JS ready signal | Integration (manual) | Xcode UI test or manual device test | Bridge JS↔Swift round-trip requires live WKWebView |
| BRDG-02 | CheckpointRequest delivers base64 bytes to Swift | Unit (TS) | `npm test -- NativeBridge` | Test uint8ArrayToBase64 conversion |
| BRDG-03 | NativeActionRequest dispatches on type field | Unit (Swift) | Xcode → IsometryTests | Test BridgeManager.didReceive() switching |
| BRDG-04 | SyncNotification stub compiles | Unit (Swift) | Xcode build | Type-check only for Phase 12 |
| BRDG-05 | WeakScriptMessageHandler does not retain BridgeManager | Unit (Swift) | Xcode → IsometryTests | `weak var ref = BridgeManager(); add proxy; ref = nil; XCTAssertNil(ref)` |
| DATA-01 | loadDatabase() returns Data for existing file | Unit (Swift) | Xcode → IsometryTests | Write temp file; assert Data returned |
| DATA-02 | loadDatabase() returns nil when no file exists | Unit (Swift) | Xcode → IsometryTests | Assert nil for missing path |
| DATA-03 | saveCheckpoint() is atomic — .bak created, .db updated | Unit (Swift) | Xcode → IsometryTests | Verify both files after save |
| DATA-04 | isDirty resets to false after successful checkpoint | Unit (Swift) | Xcode → IsometryTests | markDirty(); saveCheckpoint(); assert !isDirty |
| DATA-05 | Autosave timer fires at 30-second interval | Integration (manual) | Xcode simulator + console | Verify checkpoint call in console log |
| SHELL-05 | Recovery overlay shows + dismisses after reload | Integration (manual) | Xcode simulator | Simulate process termination via Memory Debugger |

### Wave 0 Gaps (new files needed before implementation)

- [ ] `tests/NativeBridge.test.ts` — covers BRDG-02 (base64 conversion), mutated message hook
- [ ] `native/Isometry/IsometryTests/BridgeManagerTests.swift` — covers BRDG-03, BRDG-05, DATA-01..04
- [ ] `native/Isometry/IsometryTests/DatabaseManagerTests.swift` — covers DATA-01..04 in isolation

---

## Sources

### Primary (HIGH confidence)
- Apple Developer Forums thread/125891 — WKScriptMessageHandler message.body type restrictions (Uint8Array not supported)
- tigi44.github.io WKScriptMessageHandler Memory Leak — WeakScriptMessageHandler Swift pattern, verified working
- Jesse Squires blog (June 2024) — ScenePhase broken on macOS; NSApplicationDelegateAdaptor is the only reliable solution
- Apple APFS Guide — Atomic safe-save via rename on same volume
- sql.js GitHub issue #302 — db.export() performance: "even huge databases never take more than a few seconds"

### Secondary (MEDIUM confidence)
- Apple Developer Forums thread/85066 — UIApplication.beginBackgroundTask ~30 second budget, endBackgroundTask required
- webkit.org bug #176855 — webViewWebContentProcessDidTerminate not always called; secondary check needed
- Embrace.io blog — webViewWebContentProcessDidTerminate recovery pattern with reload()
- Apple Developer Forums thread/751086 — WKScriptMessageHandlerWithReply known replyHandler bug (7-year-old); confirms avoiding it

### Tertiary (LOW confidence)
- WebSearch consensus on evaluateJavaScript size limits — no hard limit documented; practical testing recommended for payloads >5MB base64

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — WebKit/Foundation/Swift Actor are OS-native, well-documented
- Architecture: HIGH — WeakScriptMessageHandler proxy, atomic rename, actor serialization are all verified patterns
- Pitfalls: HIGH — binary postMessage limitation and macOS ScenePhase issue both confirmed by Apple forums and 2024 community reports
- Validation: MEDIUM — test structure is clear; exact XCTest async Actor patterns need verification during implementation

**Research date:** 2026-03-03
**Valid until:** 2026-06-03 (stable Apple APIs; ScenePhase macOS status may improve in future OS releases)
