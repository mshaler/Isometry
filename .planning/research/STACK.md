# Stack Research — v2.0 Native Shell

**Domain:** Native Swift/SwiftUI app shell hosting a TypeScript/D3.js/sql.js web runtime via WKWebView
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH — Swift/SwiftUI/WKWebView APIs verified via Apple docs and official search results; WASM MIME workaround confirmed via WebKit bug discussions and working Pyodide example; GRDB version confirmed via GitHub; deployment targets confirmed via Apple Xcode support page; Swift Testing verified via official Swift blog; some WKWebView + Web Worker + custom-scheme interaction details are MEDIUM confidence (limited authoritative 2024+ sources)

---

## Context: What Already Exists (Do Not Re-Research)

The v1.1 Web Runtime is complete and locked. The following are validated and need no changes:

| Technology | Version | Status |
|------------|---------|--------|
| TypeScript | 5.9.x (strict) | Configured |
| sql.js | 1.14.0 (custom FTS5 WASM, 756KB) | Built, tested |
| Vite | 7.3.1 | Configured |
| Vitest | 4.0.18 | Configured |
| d3 | 7.9.0 | Installed |
| @vitest/web-worker | 4.0.18 | Installed |

**This document covers ONLY what must be ADDED for the v2.0 Native Shell milestone.**

---

## New Swift Capabilities Required

### 1. Swift Language and Toolchain

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Swift | 6.x (min 6.0) | Application language | Swift 6 ships with Xcode 16+ (confirmed current Xcode 26.3 includes Swift 6.2.3). Full concurrency checking is enabled by default in Swift 6, which is required for correct actor-based database manager and WKWebView coordinator patterns. Back-deploying to iOS 15 is supported. |
| Xcode | 16.x+ (current: 26.3 / Swift 6.2.3) | Build toolchain | Required for Swift 6, Swift Testing framework, and multiplatform target. |

**Deployment targets:**
- **iOS:** 16.0 minimum (rationale below)
- **macOS:** 13.0 minimum (rationale below)

**Why iOS 16 / macOS 13 (not iOS 15 / macOS 12):**
The NativeShell.md spec suggests iOS 15 / macOS 12, but the research reveals two constraints that push the minimum up:

1. `SharedArrayBuffer` in WKWebView became available in WebKit shipped with macOS 13.x / iOS 16.x. The existing sql.js runtime uses a Web Worker — while sql.js itself does not require SharedArrayBuffer (it runs single-threaded in the Worker), setting a 16/13 floor eliminates an entire class of edge-case debugging around WebKit feature availability.

2. Swift 6 + Xcode 16 have known issues with C++ interoperability modules targeting iOS < 16.0 (GitHub issue #77909 in swiftlang/swift). Since the project uses no C++ interop, this is not a direct blocker, but targeting iOS 16+ provides cleaner Swift 6 concurrency behavior for WKWebView APIs.

3. NavigationStack / NavigationSplitView (the modern SwiftUI navigation API used by the NativeShell spec's sidebar/toolbar patterns) are available from iOS 16 / macOS 13. Building against iOS 15 would require NavigationView fallbacks.

**If iOS 15 is a hard business requirement:** It is achievable but requires: (a) explicit `@available` guards around NavigationStack usage, (b) extra testing on the WASM MIME workaround under iOS 15's older WebKit build, and (c) NavigationView fallbacks for the native toolbar. Defer this decision to roadmap phase planning.

---

### 2. WKWebView Hosting

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WebKit (WKWebView) | System (iOS 16+ / macOS 13+) | Host the Vite-built web runtime | System framework, no external dependency. WKWebView is the only option for embedding a full web runtime on Apple platforms. |
| WKURLSchemeHandler | iOS 11+ / macOS 10.13+ | Serve WASM + JS bundle with correct MIME types | **Critical.** `fetch()` in WKWebView enforces `Content-Type: application/wasm` for `.wasm` files. When loading from `file://` URLs via `loadFileURL`, no HTTP server sets these headers. WKURLSchemeHandler intercepts requests on a custom scheme (e.g., `app://`) and serves files with correct `Content-Type` headers, solving the known WASM MIME rejection bug. |

**WKURLSchemeHandler implementation pattern (WASM-correct):**

```swift
import WebKit
import UniformTypeIdentifiers

class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let filePath = bundleFilePath(for: url) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        do {
            let data = try Data(contentsOf: URL(fileURLWithPath: filePath))
            let mimeType = mimeType(for: url)
            let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mimeType,
                    "Content-Length": "\(data.count)",
                    // Required for SharedArrayBuffer (macOS 13+ / iOS 16+)
                    "Cross-Origin-Opener-Policy": "same-origin",
                    "Cross-Origin-Embedder-Policy": "require-corp",
                ]
            )!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func bundleFilePath(for url: URL) -> String? {
        // url.path maps to WebApp/ subdirectory in bundle
        let relativePath = url.path.hasPrefix("/") ? String(url.path.dropFirst()) : url.path
        return Bundle.main.path(forResource: nil, ofType: nil, inDirectory: "WebApp/\(relativePath)")
               ?? Bundle.main.path(forResource: relativePath, ofType: nil, inDirectory: "WebApp")
    }

    private func mimeType(for url: URL) -> String {
        // Explicit WASM override — UTType does not reliably return application/wasm on all OS versions
        if url.pathExtension == "wasm" { return "application/wasm" }
        if let type = UTType(filenameExtension: url.pathExtension) {
            return type.preferredMIMEType ?? "application/octet-stream"
        }
        return "application/octet-stream"
    }
}
```

**Why explicit `.wasm` MIME override:** `UTType` may not return `application/wasm` reliably across all iOS/macOS versions because WebAssembly is a relatively new file type. Explicit mapping is the safe approach.

**Registration in WKWebViewConfiguration:**

```swift
let config = WKWebViewConfiguration()
config.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: "app")
// Load via custom scheme, not file://
webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
```

**Why NOT `loadFileURL`:** Loading via `file://` bypasses custom scheme handler and re-introduces the MIME type problem for WASM. The custom `app://` scheme serves all assets — HTML, JS, CSS, WASM — through the handler with correct headers.

**Why NOT a local HTTP server (GCDWebServer, Swifter, etc.):** A local HTTP server introduces another process concern, port conflicts, and App Store review complexity. WKURLSchemeHandler is the Apple-endorsed, sandboxed solution. No external dependency.

---

### 3. Swift ↔ JavaScript Bridge

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WKScriptMessageHandler | iOS 8+ / macOS 10.10+ | JS → Swift messages (checkpoint, native actions) | Simple, battle-tested. The existing NativeShell spec uses `webkit.messageHandlers.checkpoint.postMessage()` and `webkit.messageHandlers.nativeAction.postMessage()` — these map directly to `WKScriptMessageHandler`. |
| WKScriptMessageHandlerWithReply | iOS 14+ / macOS 11+ | JS → Swift with async reply | Modern alternative for request/response patterns. Returns a Promise to the JS caller. However, it has known Swift 6 strict concurrency issues (`WKScriptMessage` is not `Sendable`; the async method cannot be `@MainActor`). |
| evaluateJavaScript | iOS 3+ / macOS 10.10+ | Swift → JS calls | Standard way to call `window.nativebridge.receive(...)` from Swift. Must be called on main actor. |
| WKUserContentController | iOS 8+ / macOS 10.10+ | Register handlers + inject scripts | Required to register message handlers and inject the `window.nativebridge` receiver before page load. |

**Recommended bridge pattern for this project:**

Use `WKScriptMessageHandler` (not `WKScriptMessageHandlerWithReply`) for all JS → Swift messages. The NativeShell spec already defines a request/response correlation ID pattern in TypeScript (`pendingRequests` Map with `requestId`), making the Swift side a fire-and-forget receiver that calls `evaluateJavaScript` with the response.

Reason to avoid `WKScriptMessageHandlerWithReply`: The async method signature creates Swift 6 strict concurrency warnings that require `@preconcurrency import WebKit` or `MainActor.assumeIsolated` workarounds. The manual correlation ID pattern in the spec is already correct and simpler.

**WKUserScript for early bridge injection:**

```swift
// Inject before page loads so nativebridge is available at DOMContentLoaded
let bridgeScript = WKUserScript(
    source: "window._isNativeShell = true;",
    injectionTime: .atDocumentStart,
    forMainFrameOnly: true
)
config.userContentController.addUserScript(bridgeScript)
```

**Memory leak prevention:** WKWebView strongly retains message handler objects. Use a weak proxy pattern to avoid retain cycles:

```swift
// Weak proxy prevents WKWebView from strongly retaining the Coordinator
class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?
    init(_ delegate: WKScriptMessageHandler) { self.delegate = delegate }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(ucc, didReceive: message)
    }
}
// Registration:
config.userContentController.add(WeakScriptMessageHandler(coordinator), name: "checkpoint")
config.userContentController.add(WeakScriptMessageHandler(coordinator), name: "nativeAction")
```

---

### 4. SwiftUI Multiplatform App Shell

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SwiftUI | iOS 16+ / macOS 13+ | UI framework for shell chrome (sidebar, toolbar) | The NativeShell spec calls for minimal Swift UI — WKWebView fills the entire window. SwiftUI overlays handle sync status and upgrade prompts. The `typealias WebViewRepresentable` pattern (UIViewRepresentable on iOS, NSViewRepresentable on macOS) gives a single WKWebView wrapper for both platforms. |
| UIViewRepresentable / NSViewRepresentable | Same as SwiftUI | Wrap WKWebView in SwiftUI | Standard pattern for native views in SwiftUI. Conditional compilation with `#if os(iOS)` / `#if os(macOS)`. |
| NavigationSplitView | iOS 16+ / macOS 13+ | Optional native sidebar (macOS only) | Available from iOS 16 / macOS 13. For v2.0, the WebView fills the window — native sidebar is optional. |

**Multiplatform Xcode project structure:**

Use a **single multiplatform Xcode target** (not separate iOS + macOS targets). Xcode's "Multiplatform App" template creates one target that can be built for both platforms, sharing all Swift source files, with `#if os(iOS)` / `#if os(macOS)` for platform-specific code.

This is the right structure for this project because:
- Swift source is identical except platform-specific view representables and haptic feedback
- App bundle structure (WebApp/ resources) is shared
- Build settings (deployment target, entitlements) may differ per platform but single target manages this more cleanly than two separate targets for a WKWebView-heavy app

**Do NOT use Mac Catalyst.** Catalyst translates iPad apps to Mac but produces a degraded macOS experience. The NativeShell spec calls for native macOS menus and Commands — these only work properly with native macOS target, not Catalyst.

---

### 5. Database Management (Persistence Layer)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Foundation FileManager | System | Read/write the sql.js database file (Data blob) | The sql.js database is exported from the Web Worker as a `Uint8Array` → base64 → Swift `Data`. The Swift persistence layer writes this `Data` blob atomically to disk (`.tmp` then rename). No SQLite library needed on the Swift side — the file format is standard SQLite3, but Swift never queries it. |
| iCloud Documents (NSUbiquitousItemDownloadingStatus) | iOS 16+ / macOS 13+ | Store database file in iCloud Drive ubiquity container | The NativeShell spec uses `FileManager.default.url(forUbiquityContainerIdentifier:)` for the database path. This is the correct pattern for iCloud Documents-based sync. |

**Why no GRDB / SQLite.swift on the Swift side:**

The architecture decision is clear: **sql.js owns all data access**. Swift never runs SQL against the database. Swift only reads/writes the binary SQLite file as an opaque `Data` blob. Adding a native SQLite wrapper (GRDB, SQLite.swift) would create a parallel data access path that conflicts with the "JavaScript owns data" principle from NativeShell.md.

GRDB 7.10.0 (released 2026-02-15) requires Swift 6.1+ / Xcode 16.3+ and supports iOS 13+ / macOS 10.15+. It would be the correct choice IF native Swift needed to query the database — but it does not in this architecture.

---

### 6. CloudKit Sync

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| CloudKit (CKContainer, CKRecord, CKAsset) | iOS 15+ / macOS 12+ | Sync the SQLite file across devices | The NativeShell spec stores the entire database as a single `CKRecord` with a `CKAsset` containing the SQLite binary. This is the right approach for a file-based sync architecture. CloudKit private database handles user isolation automatically. |
| CKDatabaseSubscription | iOS 15+ / macOS 12+ | Push notifications for remote changes | Subscribe to database changes so the app knows when another device has pushed a new version of the database. |

**CloudKit entitlements required:**
- `com.apple.developer.icloud-services` (CloudKit)
- `com.apple.developer.icloud-container-identifiers` (`iCloud.com.isometry.app`)

---

### 7. Native File Picker (ETL Imports)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| UIDocumentPickerViewController (iOS) / NSOpenPanel (macOS) | iOS 14+ / macOS 10.15+ | Native file picker for importing files (Markdown, Excel, CSV, JSON, HTML) | The existing ETL parsers run in the Web Worker. Swift reads the file, passes the `ArrayBuffer` to the Worker via the bridge. `UIDocumentPickerViewController` handles sandbox access grants on iOS. `NSOpenPanel` is the macOS equivalent. |
| FileImporter (SwiftUI) | iOS 14+ / macOS 11+ | SwiftUI file picker wrapper | `fileImporter(isPresented:allowedContentTypes:onCompletion:)` modifier wraps both platforms in one call. Simpler than UIKit/AppKit directly. |

---

### 8. In-App Purchases

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| StoreKit 2 | iOS 15+ / macOS 12+ | Subscription tiers (Free / Pro / Workbench) | StoreKit 2 is the modern Swift async/await native API for in-app purchases. Replaces the error-prone completion-handler-based StoreKit 1. Provides `Transaction.currentEntitlements` for entitlement checking without a server. Supports local testing via StoreKit configuration files in Xcode. |

---

### 9. Testing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Swift Testing | Swift 6 / Xcode 16+ | Unit tests for Swift native code | Swift Testing (`@Test`, `#expect`) is the modern testing framework introduced at WWDC 2024, integrated with Swift Package Manager and Xcode 16. It runs tests in parallel by default, supports parameterized tests, and has better failure diagnostics than XCTest. Available when `swift-tools-version: 6.0` in Package.swift. |
| XCTest | Any | Legacy Swift unit tests (if needed) | XCTest is still the only choice for UI tests (XCUITest) and performance measurements. For pure unit tests, prefer Swift Testing. Both can coexist in the same target. |
| Vitest | 4.0.18 | Web runtime tests (unchanged) | The existing 1,433 Vitest tests for the TypeScript runtime are unchanged. No Vitest changes for the native shell milestone. |

**Test coexistence pattern:** Swift Testing tests live in `Tests/NativeShellTests/` alongside any retained XCTest files. Swift Testing does not require `XCTestCase` subclassing — each `@Test` function is independent.

---

## Xcode Project Structure

```
Isometry.xcodeproj/
├── Isometry/                        ← Single multiplatform target
│   ├── App/
│   │   ├── IsometryApp.swift        ← @main App entry point
│   │   └── AppState.swift           ← ObservableObject app state
│   ├── Views/
│   │   ├── ContentView.swift        ← Root view (WKWebView + overlays)
│   │   ├── IsometryWebView.swift    ← UIViewRepresentable / NSViewRepresentable
│   │   └── SyncStatusView.swift     ← Native sync overlay
│   ├── Bridge/
│   │   ├── AppSchemeHandler.swift   ← WKURLSchemeHandler (WASM MIME fix)
│   │   └── NativeBridgeCoordinator.swift ← WKScriptMessageHandler, evaluateJS
│   ├── Data/
│   │   ├── DatabaseManager.swift    ← Actor: read/write SQLite blob to disk
│   │   └── CloudKitSyncManager.swift ← Actor: CKRecord push/pull
│   ├── Features/
│   │   ├── FeatureGate.swift        ← Tier enforcement (Free/Pro/Workbench)
│   │   └── SubscriptionManager.swift ← StoreKit 2 purchases
│   ├── Platform/
│   │   ├── iOS/
│   │   │   └── iOSExtensions.swift  ← Haptics, iOS toolbar
│   │   └── macOS/
│   │       └── MacCommands.swift    ← Menu commands, NSOpenPanel
│   └── Resources/
│       ├── Info.plist
│       └── WebApp/                  ← Vite dist/ output (copied at build time)
│           ├── index.html
│           ├── assets/
│           │   ├── index-[hash].js
│           │   └── index-[hash].css
│           └── sql-wasm.wasm        ← The WASM binary served via AppSchemeHandler
├── Tests/
│   └── NativeShellTests/
│       ├── DatabaseManagerTests.swift
│       ├── AppSchemeHandlerTests.swift
│       └── FeatureGateTests.swift
└── Makefile / build-web.sh          ← npm run build && cp dist/ Isometry/Resources/WebApp/
```

**Build integration: Vite → Xcode:**

Add a Run Script build phase in Xcode (before "Compile Sources") that:

```bash
#!/bin/bash
set -e
cd "${SRCROOT}"
npm run build
rm -rf "${SRCROOT}/Isometry/Resources/WebApp"
cp -r dist "${SRCROOT}/Isometry/Resources/WebApp"
```

The `WebApp/` directory is added to "Copy Bundle Resources" as a folder reference (blue folder icon in Xcode, not a group). This preserves the directory structure and includes all files recursively.

**Important:** Add `dist/` and `Isometry/Resources/WebApp/` to `.gitignore`. The WebApp bundle is a build artifact generated from the TypeScript source. Only the TypeScript source is committed.

---

## Installation (No npm Changes)

The Native Shell is a pure Swift Xcode project. No new npm packages are needed for v2.0. The TypeScript runtime is unchanged.

Swift capabilities come from Apple system frameworks only:
- `WebKit` — WKWebView, WKURLSchemeHandler, WKScriptMessageHandler
- `CloudKit` — CKContainer, CKRecord, CKAsset
- `StoreKit` — Product, Transaction (StoreKit 2)
- `SwiftUI` — App shell, file picker
- `Foundation` — FileManager, Data, URLSession

No Swift Package Manager dependencies required for the core Native Shell. The CLAUDE.md constraint "no third-party database wrappers" extends to: no GCDWebServer, no Swifter, no GRDB, no SQLite.swift.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| WKURLSchemeHandler (`app://`) | `loadFileURL` + `allowFileAccessFromFileURLs` | `allowFileAccessFromFileURLs` is undocumented/unsupported private API (not a public exported symbol). WKURLSchemeHandler is the Apple-supported solution for serving local assets with correct MIME types. |
| WKURLSchemeHandler (`app://`) | Local HTTP server (GCDWebServer, Swifter, Vapor) | No external dependencies, no port conflicts, no App Store review risk. WKURLSchemeHandler is the idiomatic Apple solution. GCDWebServer also requires another dependency and runs outside the sandbox restrictions model. |
| WKURLSchemeHandler (`app://`) | JS `fetch` override (XHR fallback) | The XHR fetch workaround (in existing PITFALLS.md) is a JS-side patch, not a fix. It should be removed once WKURLSchemeHandler is in place. The handler is the correct solution. |
| `WKScriptMessageHandler` (manual correlation IDs) | `WKScriptMessageHandlerWithReply` | `WKScriptMessageHandlerWithReply` has Swift 6 strict concurrency issues (`WKScriptMessage` is not `Sendable`). The existing TypeScript bridge already implements correlation ID tracking in `NativeBridgeImpl` — the manual pattern works and avoids Swift 6 concurrency warnings. |
| Single multiplatform Xcode target | Separate iOS + macOS targets | Shared WKWebView hosting code makes a single target cleaner. Platform differences are handled via `#if os(iOS)` / `#if os(macOS)` in the bridge coordinator and extensions. |
| Mac (native macOS target) | Mac Catalyst | Catalyst produces a degraded macOS experience. The spec requires native macOS menus (`Commands`), which work only on native macOS targets. |
| Mac (native macOS target) | Mac (Designed for iPad) | "Designed for iPad" runs the iPad app on macOS Silicon but has restricted access to macOS-specific APIs. The `NSOpenPanel` and native menu `Commands` required by the spec need a native macOS target. |
| StoreKit 2 | StoreKit 1 | StoreKit 1 is callback-based, error-prone, and deprecated for new development. StoreKit 2 is async/await native, supports local testing, and handles entitlement checking without a server. |
| Swift Testing | XCTest only | Swift Testing runs tests in parallel by default, has better diagnostics via `#expect`, and is the modern Apple-recommended framework for new Swift 6 projects. XCTest remains for UI tests. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| GRDB.swift / SQLite.swift | Creates a parallel Swift data access path contradicting the "JavaScript owns data" architecture. Swift only stores the database blob — no SQL needed on the Swift side. | Foundation `FileManager` + `Data` for file I/O |
| SwiftData | ORM over CoreData, not compatible with sql.js SQLite file format. Architectural mismatch. | Foundation `FileManager` + `Data` |
| CoreData | Same architectural mismatch as SwiftData — cannot read a sql.js-format SQLite database directly as a CoreData store. | Foundation `FileManager` + `Data` |
| GCDWebServer / Swifter | External dependency for local HTTP server — WKURLSchemeHandler solves the same problem natively without any external dependency. | WKURLSchemeHandler |
| Mac Catalyst | Restricted macOS API access. Cannot use native macOS `Commands`, `NSOpenPanel`, or the full AppKit surface needed for a Workbench-tier product. | Native macOS target in multiplatform app |
| `allowFileAccessFromFileURLs` preference | Not a public API — undocumented WKWebView internal preference. Can be revoked by Apple at any OS release without notice. | WKURLSchemeHandler |
| `WKScriptMessageHandlerWithReply` | Swift 6 strict concurrency issues — `WKScriptMessage` is not `Sendable`. Requires `@preconcurrency import WebKit` or `MainActor.assumeIsolated` workarounds. | `WKScriptMessageHandler` with manual correlation ID (already in spec) |
| Service Workers | WKWebView Service Worker support requires App-Bound Domains configuration and `limitsNavigationsToAppBoundDomains = true`. Not needed here — the existing Web Worker (Dedicated Worker) model works without Service Workers. | Existing dedicated Web Worker via sql.js Worker Bridge |
| SwiftyStoreKit | Wrapper around StoreKit 1 — abandoned, Swift 6 incompatible. | StoreKit 2 native APIs |

---

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| WKURLSchemeHandler | iOS 11+ / macOS 10.13+ | Well within iOS 16 / macOS 13 target |
| WKScriptMessageHandler | iOS 8+ / macOS 10.10+ | No version concerns |
| Swift 6 concurrency | iOS 15.0+ (backdeployed from Xcode 13.2+) | Actor isolation and async/await backdeployable to iOS 15 |
| Swift Testing (`@Test`) | Requires Swift 6 toolchain + Xcode 16 | NOT backdeployable to Xcode 15. Tests run on iOS 16 simulator or device, not iOS 15 (simulator). |
| StoreKit 2 | iOS 15+ / macOS 12+ | Within iOS 16 / macOS 13 target |
| NavigationSplitView | iOS 16+ / macOS 13+ | Matches recommended deployment target |
| CloudKit (CKAsset) | iOS 8+ / macOS 10.10+ | No version concerns |
| SharedArrayBuffer in WKWebView | macOS 13+ / iOS 16+ | Available in WebKit shipped with these OS versions. sql.js does not require SharedArrayBuffer (single-threaded Worker), but having it available avoids edge cases. |
| `fileImporter` modifier | iOS 14+ / macOS 11+ | Within target |
| COOP/COEP headers from WKURLSchemeHandler | iOS 16+ / macOS 13+ | Setting `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers in the scheme handler response enables SharedArrayBuffer if needed by future runtime features. |

---

## Stack Patterns by Condition

**If the web runtime needs to call a native capability (file picker, haptics, purchase):**
- JS calls `webkit.messageHandlers.nativeAction.postMessage({ requestId, action })`
- Swift `WKScriptMessageHandler` receives it, dispatches to handler
- Swift calls `evaluateJavaScript("window.nativebridge.receive({...})")` with response

**If Swift needs to push data to JS (launch payload, sync notification, remote DB update):**
- Swift calls `webView.evaluateJavaScript(...)` on `@MainActor`
- JS `window.nativebridge.receive(payload)` handles it

**If the database needs to be persisted (autosave / explicit save / sync trigger):**
- JS exports `db.export()` as `Uint8Array`, base64-encodes it, posts `checkpoint` message
- Swift `DatabaseManager` actor decodes and writes atomically to disk
- CloudKit sync triggered if `reason === 'sync'`

**If deploying iOS 15 is required (deferred):**
- Replace `NavigationSplitView` with `NavigationView` (iOS 15 compatible) behind `@available(iOS 16, *)`
- Keep WKURLSchemeHandler (available iOS 11+)
- Add explicit testing for WASM MIME handling on older WebKit

---

## Sources

- Apple Xcode Support page — Swift 6.2.3 confirmed in current Xcode 26.3, iOS 15 minimum deployment target: https://developer.apple.com/support/xcode/
- WKURLSchemeHandler Apple docs — iOS 11+ API for custom URL scheme handling: https://developer.apple.com/documentation/webkit/wkurlschemehandler
- setURLSchemeHandler docs — registration pattern: https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/seturlschemehandler(_:forurlscheme:)
- GitHub gist (otmb) — WASM fetch() MIME error in WKWebView confirmed; XHR workaround verified working for Pyodide on iOS: https://gist.github.com/otmb/2eefc9249d347103469741542f135f5c
- Custom URL schemes in WKWebView (Gualtiero Frigerio) — UTType MIME detection pattern, AssetsSchemeHandler code: https://www.gfrigerio.com/custom-url-schemes-in-a-wkwebview/
- Building a WebView for iOS and macOS in SwiftUI (Daniel Saidi) — typealias UIViewRepresentable/NSViewRepresentable pattern: https://danielsaidi.com/blog/2022/04/24/building-a-webview-for-swiftui
- Tauri discussion #6269 — SharedArrayBuffer in WKWebView confirmed available macOS 13.x / iOS 16.x timeframe: https://github.com/tauri-apps/tauri/discussions/6269
- Swift Testing introduction — @Test macro, #expect, SPM integration, Swift 6 requirement: https://dev.to/raphacmartin/introduction-to-swift-testing-apples-new-testing-framework-51p4
- Swift Testing vs XCTest comparison (Infosys blog): https://blogs.infosys.com/digital-experience/mobility/swift-testing-vs-xctest-a-comprehensive-comparison.html
- GRDB.swift GitHub — version 7.10.0, Swift 6.1+, iOS 13+ / macOS 10.15+: https://github.com/groue/GRDB.swift
- StoreKit 2 Apple developer page — async/await APIs, multiplatform, iOS 15+: https://developer.apple.com/storekit/
- StoreKit 2 tutorial (StoreHelper GitHub) — iOS 15-17, macOS 12-14 support confirmed: https://github.com/russell-archer/StoreHelper
- WKScriptMessageHandlerWithReply Swift 6 concurrency issue — Apple Developer Forums #751086 (referenced in search results)
- iOS WKWebView Communication (John Lewis Engineering, Medium) — WKScriptMessageHandler pattern: https://medium.com/john-lewis-software-engineering/ios-wkwebview-communication-using-javascript-and-swift-ee077e0127eb
- Isometry NativeShell.md — canonical architecture spec for bridge contract and SwiftUI shell: /v5/Modules/NativeShell.md (project file)
- Existing PITFALLS.md — WASM MIME type rejection confirmed, XHR workaround documented: .planning/research/PITFALLS.md (project file)

---

*Stack research for: Isometry v2.0 Native Shell — Swift/SwiftUI multiplatform app hosting TypeScript/D3.js/sql.js web runtime*
*Researched: 2026-03-02*
