# Phase 11: Xcode Shell + WKURLSchemeHandler - Research

**Researched:** 2026-03-02
**Domain:** Swift/SwiftUI multiplatform Xcode app hosting TypeScript/D3.js web runtime in WKWebView via custom URL scheme handler
**Confidence:** HIGH for WKURLSchemeHandler and WASM MIME fix; HIGH for Vite native config pattern; MEDIUM for Web Worker + custom scheme interaction; MEDIUM for Xcode project creation approach

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Vite build for native:**
- Dual Vite configs: keep existing `vite.config.ts` for library/test use, add `vite.config.native.ts` that builds in app mode (with index.html, self-contained)
- `npm run build:native` produces output in `dist-native/` (parallel to existing `dist/`)
- sql.js stays as a separate chunk alongside the WASM file (not inlined) — scheme handler serves both with correct MIME types
- WASM file path stays as-is in `dist-native/assets/sql-wasm-fts5.wasm`

**Xcode project layout:**
- Xcode project lives in `native/` subdirectory: `native/Isometry.xcodeproj`
- Swift sources in `native/Isometry/`
- Single multiplatform target (iOS + macOS destinations), SwiftUI App lifecycle
- Use `#if os()` for platform-specific differences
- Deployment targets: iOS 17 / macOS 14
- Run Script reaches up to repo root for `npm run build:native`

**Dev/Release switching:**
- `#if DEBUG` compile flag toggles between Vite dev server and bundled assets
- In DEBUG: WKWebView loads `http://localhost:5173` directly (Vite HMR)
- In RELEASE: WKWebView loads `app://localhost/index.html` via scheme handler
- Scheme handler is NOT registered in DEBUG builds — skip it entirely
- Dev server URL hardcoded to `localhost:5173` — change in one place if needed
- Run Script (`npm run build:native`) runs on EVERY Xcode build, with input/output file lists for incremental skipping

**Scheme handler scope:**
- `app://` scheme handler serves ALL web content (HTML, JS, CSS, WASM, workers)
- WKWebView entry point: `app://localhost/index.html`
- MIME types via extension-based lookup table (~8 types: .html, .js, .mjs, .css, .wasm, .json, .svg, .png)
- No caching headers — files served from local bundle, WKWebView internal cache handles the rest

### Claude's Discretion

- WASM locateFile path strategy (hardcoded `app://` path vs relative path — pick what works with WKURLSchemeHandler)
- Web Worker handling under custom scheme (serve via `app://` if WKWebView allows, fall back to blob URLs if not)
- Xcode project creation approach (hand-write pbxproj vs Xcode template — pick what's most reliable)
- Exact input/output file lists for Run Script incremental build optimization
- Vite native config details (base URL, chunk naming, asset handling)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHELL-01 | User can open the app and see the web runtime rendering all 9 D3 views on both iOS and macOS | WebViewContainer (UIViewRepresentable / NSViewRepresentable pattern), Vite native build producing self-contained bundle, `app://localhost/index.html` load |
| SHELL-02 | WKURLSchemeHandler serves the Vite bundle via custom `app://` scheme with explicit `application/wasm` MIME type for sql.js | AssetsSchemeHandler pattern, UTType extension-based MIME lookup with explicit `.wasm` override, `task.didReceive(response)` / `task.didReceive(data)` / `task.didFinish()` protocol |
| SHELL-03 | Xcode Run Script build phase runs `npm run build` and copies `dist/` to app bundle as a folder reference | Run Script build phase with input/output file lists for incremental skipping, Folder Reference added to Copy Bundle Resources |
| SHELL-04 | In DEBUG builds, WKWebView loads from Vite dev server (`localhost:5173`) enabling HMR | `#if DEBUG` compile-time flag, `webView.isInspectable = true` for Safari Web Inspector, scheme handler registration gated on `#if !DEBUG` |
</phase_requirements>

---

## Summary

Phase 11 creates a minimal native SwiftUI shell hosting the existing TypeScript/D3.js web runtime inside WKWebView. The core technical challenge is WASM MIME type rejection: WKWebView's `fetch()` enforces `application/wasm` validation for `.wasm` files, and `file://` URLs cannot set HTTP headers. The solution — a custom `WKURLSchemeHandler` for the `app://` scheme — is the standard industry pattern for this exact problem, with extensive precedent in Apple documentation and community practice.

The phase has four work streams: (1) Vite native config producing a self-contained app bundle, (2) Xcode project structure with multiplatform single target, (3) the `AssetsSchemeHandler` Swift class that serves files with correct MIME types, and (4) the `#if DEBUG` / `#if !DEBUG` toggle between Vite dev server and bundled assets. All four streams are well-understood with clear implementation patterns. The highest-risk unknown is how WKWebView handles ES module Web Workers loaded from a custom `app://` scheme, which requires validation in the actual Simulator/device build.

The existing web runtime is entirely unchanged in this phase: no bridge messages, no new TypeScript, no modifications to WorkerBridge. This is a pure shell that loads the existing dist-native bundle. The deployment targets (iOS 17 / macOS 14) unlock `@Observable`, `isInspectable`, and other modern SwiftUI APIs with no compatibility shims needed.

**Primary recommendation:** Use Xcode's multiplatform app template (not hand-written pbxproj) to create the project, then wire the four components as independent Swift files. The template handles all pbxproj boilerplate correctly and is more reliable than manual generation.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WebKit (WKWebView) | iOS 17+ / macOS 14+ | WKURLSchemeHandler custom scheme, WKWebViewConfiguration | Only native WebView API; WKURLSchemeHandler available since iOS 11, mature on iOS 17 |
| SwiftUI | iOS 17+ / macOS 14+ | App lifecycle, ContentView, multiplatform wrapper | Native UI framework; multiplatform single target available since Xcode 14 |
| Foundation | iOS 17+ / macOS 14+ | Bundle resource lookup, Data I/O, URLResponse | Standard system framework |
| UniformTypeIdentifiers | iOS 14+ / macOS 11+ | UTType MIME type lookup for non-WASM assets | UTType replaces deprecated MIME type APIs; required for UTType(filenameExtension:) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vite 7.3 | Already in project | Native app mode build (without `build.lib`) | `vite.config.native.ts` switches to app mode by omitting `build.lib` |
| vite-plugin-static-copy 3.2 | Already in project | Copies `sql-wasm-fts5.wasm` to `dist-native/assets/` | Same as existing config; WASM must not be inlined |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WKURLSchemeHandler | Local HTTP server (GCDWebServer etc.) | More infrastructure, out-of-process; scheme handler is in-process and App Store clean |
| WKURLSchemeHandler | Monkey-patch `fetch()` in JS to use XHR | Requires modifying web runtime; brittle; temporary |
| Xcode template | Hand-written pbxproj | pbxproj is an undocumented format; template produces correct boilerplate with less risk of subtle errors |
| Folder Reference in Xcode | Run Script cp after build | Folder Reference preserves directory structure automatically; simpler |

---

## Architecture Patterns

### Recommended Project Structure

```
native/                              # NEW: Xcode project root
├── Isometry.xcodeproj/
│   └── project.pbxproj
└── Isometry/                        # Swift sources
    ├── IsometryApp.swift            # @main entry point
    ├── ContentView.swift            # WKWebView host
    ├── WebViewContainer.swift       # UIViewRepresentable / NSViewRepresentable
    ├── AssetsSchemeHandler.swift    # WKURLSchemeHandler — MIME + bundle serving
    └── WebBundle/                   # Folder Reference → populated by Run Script
        ├── index.html
        ├── assets/
        │   ├── sql-wasm-fts5.wasm
        │   └── worker-[hash].js
        └── ...

(project root)
├── vite.config.ts                   # UNCHANGED — library mode, existing tests
├── vite.config.native.ts            # NEW — app mode, dist-native/ output
├── package.json                     # MODIFIED — add "build:native" script
└── dist-native/                     # Vite native build output (gitignored)
```

### Pattern 1: WKURLSchemeHandler Asset Serving with Explicit WASM MIME

**What:** Register `AssetsSchemeHandler` for the `app://` scheme. Every request to `app://localhost/...` maps to a file in the `WebBundle` folder inside the app bundle. The handler reads the file, computes the correct MIME type (with explicit `.wasm` override), and returns an `HTTPURLResponse` with the data.

**When to use:** Always — this is the only way to serve WASM with the correct MIME type without a local HTTP server.

**Example:**

```swift
// AssetsSchemeHandler.swift
import Foundation
import UniformTypeIdentifiers
import WebKit

final class AssetsSchemeHandler: NSObject, WKURLSchemeHandler {

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }

        // Map app://localhost/path/to/file → WebBundle/path/to/file
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let resourcePath = path.isEmpty ? "index.html" : path

        guard
            let bundleDir = Bundle.main.url(
                forResource: "WebBundle", withExtension: nil
            ),
            let fileURL = Optional(bundleDir.appendingPathComponent(resourcePath)),
            let data = try? Data(contentsOf: fileURL)
        else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let mimeType = Self.mimeType(for: url)
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mimeType,
                "Content-Length": "\(data.count)",
            ]
        )!

        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        // Nothing to cancel for synchronous file reads
    }

    static func mimeType(for url: URL) -> String {
        // Explicit WASM override: UTType returns application/octet-stream for .wasm
        if url.pathExtension == "wasm" { return "application/wasm" }

        // Extension-based lookup table (handles .js, .mjs, .css, .html, .json, .svg, .png)
        let mimeMap: [String: String] = [
            "html": "text/html; charset=utf-8",
            "js":   "application/javascript",
            "mjs":  "application/javascript",
            "css":  "text/css",
            "json": "application/json",
            "svg":  "image/svg+xml",
            "png":  "image/png",
        ]
        if let mime = mimeMap[url.pathExtension.lowercased()] { return mime }

        // Fallback via UTType
        if let type = UTType(filenameExtension: url.pathExtension),
           let mime = type.preferredMIMEType {
            return mime
        }
        return "application/octet-stream"
    }
}
```

```swift
// WebViewContainer.swift — registration
let config = WKWebViewConfiguration()

#if !DEBUG
config.setURLSchemeHandler(AssetsSchemeHandler(), forURLScheme: "app")
#endif

let webView = WKWebView(frame: .zero, configuration: config)

#if DEBUG
// Load from Vite dev server — HMR works
webView.load(URLRequest(url: URL(string: "http://localhost:5173")!))
// Enable Safari Web Inspector in debug builds
if #available(iOS 16.4, macOS 13.3, *) {
    webView.isInspectable = true
}
#else
webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
#endif
```

### Pattern 2: Multiplatform WKWebView SwiftUI Wrapper

**What:** A single `WebViewContainer` struct that conditionally conforms to `UIViewRepresentable` (iOS) or `NSViewRepresentable` (macOS) using `#if os(macOS)`.

**When to use:** Required for any WKWebView in a multiplatform SwiftUI app — WKWebView is a UIKit/AppKit view, not a SwiftUI view.

**Example:**

```swift
// WebViewContainer.swift
import SwiftUI
import WebKit

struct WebViewContainer {
    let webView: WKWebView
}

#if os(macOS)
extension WebViewContainer: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView { webView }
    func updateNSView(_ webView: WKWebView, context: Context) {}
}
#else
extension WebViewContainer: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ webView: WKWebView, context: Context) {}
}
#endif
```

```swift
// ContentView.swift
struct ContentView: View {
    @State private var webView: WKWebView = makeWebView()

    var body: some View {
        WebViewContainer(webView: webView)
            .ignoresSafeArea()
    }

    private static func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        #if !DEBUG
        config.setURLSchemeHandler(AssetsSchemeHandler(), forURLScheme: "app")
        #endif
        let wv = WKWebView(frame: .zero, configuration: config)
        #if DEBUG
        wv.load(URLRequest(url: URL(string: "http://localhost:5173")!))
        if #available(iOS 16.4, macOS 13.3, *) { wv.isInspectable = true }
        #else
        wv.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
        #endif
        return wv
    }
}
```

### Pattern 3: Vite Native Config (App Mode)

**What:** A second Vite config file (`vite.config.native.ts`) that builds in app mode (no `build.lib`) with `index.html` as the entry point, outputting to `dist-native/`. The existing `vite.config.ts` remains unchanged for library builds and testing.

**Key differences from library config:**
- No `build.lib` — switches Vite to app mode with `index.html` entry
- `build.outDir: 'dist-native'` — parallel output, does not clobber `dist/`
- `base: './'` — relative asset paths so `app://localhost/` mapping works
- `build.rollupOptions.external` removed — sql.js is bundled as a chunk (not external)
- Workers remain as separate chunks (Vite default; `worker.format: 'es'` preserved)
- `viteStaticCopy` kept — still copies `sql-wasm-fts5.wasm` to `dist-native/assets/`

**Example:**

```typescript
// vite.config.native.ts
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  // No build.lib — app mode uses index.html as entry
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/sql-wasm-fts5.wasm',
          dest: 'assets'
        }
      ]
    })
  ],
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist-native',
    target: 'es2022',
    assetsInlineLimit: 0, // Never inline WASM
    base: './',           // Relative paths for app:// serving
    // No build.lib — entry point is index.html (must exist at project root)
    // No external: ['sql.js'] — sql.js bundled as its own chunk
  },
});
```

```json
// package.json — add build:native script
{
  "scripts": {
    "build:native": "tsc --noEmit && vite build --config vite.config.native.ts"
  }
}
```

The project needs an `index.html` at the project root that imports the TypeScript entry and mounts the D3 views. This is a new file for this phase.

### Pattern 4: Xcode Run Script with Input/Output File Lists

**What:** A Run Script build phase that runs `npm run build:native` and syncs the output to the Xcode project's `WebBundle/` Folder Reference. Input files list tracks source files; output files list contains `dist-native/index.html` so Xcode can detect when skipping is safe.

**Key Xcode details:**
- Run Script build phase: "Based on dependency analysis" mode (requires output files)
- Input file list: `$(SRCROOT)/../src/**` (all TS source files) — or just `$(SRCROOT)/../package.json` as a simpler sentinel
- Output file: `$(SRCROOT)/Isometry/WebBundle/index.html` — existence check tells Xcode whether to skip
- After `npm run build:native`, sync with `rsync -av --delete` from `dist-native/` to `Isometry/WebBundle/`

**Shell script example:**

```bash
#!/bin/bash
set -e

# Navigate to repo root (Xcode project is in native/)
cd "$SRCROOT/.."

# Run Vite native build
npm run build:native

# Sync output to Xcode WebBundle folder
rsync -av --delete dist-native/ "$SRCROOT/Isometry/WebBundle/"
```

### Anti-Patterns to Avoid

- **Loading via `file://` URL:** WKWebView's `fetch()` rejects WASM from `file://` (no headers → wrong MIME type). The error is: `"Unexpected response MIME type. Expected 'application/wasm'"`. This is a hard blocker.
- **Inlining WASM in JS:** `assetsInlineLimit` must be 0. Inlined WASM bypasses the custom scheme handler and cannot set MIME type.
- **Using `sql.js` as `external` in native build:** The library config makes sql.js external. The native app mode must bundle sql.js as a chunk — there is no CDN or require() in WKWebView.
- **Registering scheme handler in DEBUG:** Registering `app://` when loading `localhost:5173` causes scheme conflicts and breaks Vite HMR. Gate with `#if !DEBUG`.
- **Calling `task.didFinish()` after `task.didFailWithError()`:** The WKURLSchemeTask protocol throws an exception if you call completion methods after an error. Stop the function immediately after `task.didFailWithError()`.
- **Omitting `isInspectable = true` in DEBUG:** Since iOS 16.4, WKWebView content is not inspectable by default. Without it, Safari Web Inspector shows no debuggable target, making frontend debugging impossible.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME type lookup | Custom map for all types | UTType(filenameExtension:) from UniformTypeIdentifiers | Handles edge cases; only override .wasm explicitly |
| Multiplatform WKWebView | Separate iOS/macOS targets | Single target with `#if os(macOS)` extensions | Xcode multiplatform template handles this correctly |
| Xcode project file | Hand-written pbxproj | Xcode multiplatform app template | pbxproj format is undocumented; template produces correct boilerplate |
| HTTP range requests | Partial content responses | Full data responses (no streaming needed for <5MB JS files) | WKWebView does not request Range headers for bundled web assets |
| dev/prod config switching | Runtime detection heuristics | `#if DEBUG` compile-time flag | Compile-time is reliable, runtime detection can false-positive |

**Key insight:** The WKURLSchemeHandler protocol is deliberately simple (3 method calls: didReceive response, didReceive data, didFinish). There is no streaming, no range support, no caching API to implement. Hand-rolling anything beyond the three-call pattern is unnecessary for static file serving.

---

## Common Pitfalls

### Pitfall 1: WASM MIME Type Rejection (the gating risk)

**What goes wrong:** WKWebView's `fetch()` implementation rejects WASM files that don't arrive with `Content-Type: application/wasm`. The error in the JS console is: `TypeError: Response has unsupported MIME type`. The web app stalls at sql.js initialization with no visible error in the native layer.

**Why it happens:** `UTType(filenameExtension: "wasm")` on iOS/macOS returns `application/octet-stream` (generic binary), not `application/wasm`. If the scheme handler uses UTType without an explicit `.wasm` override, the wrong MIME type is served.

**How to avoid:** The explicit override must come first in `mimeType(for:)`:
```swift
if url.pathExtension == "wasm" { return "application/wasm" }
```
Validate in a Release Simulator build (not DEBUG, which uses the dev server). The WASM fix only matters for Release builds.

**Warning signs:** sql.js `initSqlJs()` never resolves; no Worker `ready` message; console shows MIME error.

### Pitfall 2: Web Workers Under Custom Scheme

**What goes wrong:** `new Worker('app://localhost/assets/worker-[hash].js', { type: 'module' })` may fail under custom schemes on some WebKit versions. The exact behavior is not well-documented in official Apple docs.

**Why it happens:** Custom `app://` scheme is not a "secure context" by default. Some WebKit features (SharedArrayBuffer, module workers) require a secure context. However, regular (non-module, non-shared) workers are more permissive. The existing worker uses ES module format (`{ type: 'module' }`) which depends on secure context classification.

**How to avoid (Claude's discretion — two options):**
- **Option A (preferred):** Serve workers via `app://` as-is. The `app://` scheme, while not technically HTTPS, is treated as a trusted app scheme by WebKit in native app contexts. Vite's worker chunking means `worker-[hash].js` is served by the same scheme handler and shares the same origin as `index.html`. This is the most likely path to work — test first.
- **Option B (fallback):** If module workers fail under `app://`, use blob URLs. Fetch the worker script as text from `app://localhost/assets/worker-[hash].js`, create a `Blob`, and pass the blob URL to `new Worker(blobURL, { type: 'module' })`. This requires a small shim in the web runtime.

**Warning signs:** Worker never sends `ready` message; console shows `SecurityError` or `Failed to fetch` for the worker URL.

### Pitfall 3: Bundle.main URL for Subdirectory Lookup

**What goes wrong:** `Bundle.main.url(forResource: resourcePath, withExtension: nil)` does not work for nested paths inside a Folder Reference. It only finds top-level resources.

**Why it happens:** The `url(forResource:withExtension:subdirectory:)` overload requires the subdirectory name as a separate parameter, not as part of the resource name. For arbitrary paths within `WebBundle/`, you need to get the base URL of the folder and append the path manually.

**How to avoid:**
```swift
// Correct: Get the WebBundle folder URL, then append the path
guard let bundleDir = Bundle.main.url(forResource: "WebBundle", withExtension: nil) else { ... }
let fileURL = bundleDir.appendingPathComponent(resourcePath)
```
Do NOT use `url(forResource: "WebBundle/assets/foo", withExtension: nil)` — it won't find the file.

**Warning signs:** All requests return 404; scheme handler always hits the `didFailWithError` path.

### Pitfall 4: sql.js locateFile Path

**What goes wrong:** sql.js uses a `locateFile` callback to find the WASM binary. In the existing library build, the WASM path is relative to the page. In the native app mode build, the base URL is `app://localhost/index.html`, so `assets/sql-wasm-fts5.wasm` resolves to `app://localhost/assets/sql-wasm-fts5.wasm`. This should work automatically if `base: './'` is set in the Vite native config.

**Why it happens:** If `base` is not `'./'` (e.g., it defaults to `/`), asset paths become absolute from the server root: `/assets/sql-wasm-fts5.wasm`, which resolves to `app://localhost/assets/sql-wasm-fts5.wasm` — still correct. Either way works as long as the scheme handler serves all paths under `app://localhost/`.

**How to avoid:** Set `base: './'` to make all asset paths relative. This is the safest choice for embedded web content where the base URL may not be `/`.

**Warning signs:** Browser network tab (Safari Web Inspector) shows the WASM fetch failing with 404 or no request at all; `initSqlJs()` rejects with WASM fetch error.

### Pitfall 5: WKURLSchemeTask Race Condition on `stop`

**What goes wrong:** If navigation is cancelled while the scheme handler is processing, `webView(_:stop:)` is called. Any subsequent calls to `task.didReceive(_:)` or `task.didFinish()` throw `NSInvalidArgumentException: "webView(_:stop:) was called but task was not cancelled"`.

**Why it happens:** The scheme handler's file reads are synchronous. For small files (<10MB), the read completes before `stop` is called. This is only a risk if navigation is cancelled mid-request or for very large files.

**How to avoid:** For Phase 11 (static bundle serving, files <1MB each), add a simple guard:
```swift
private var activeTasks: Set<ObjectIdentifier> = []

func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    activeTasks.insert(ObjectIdentifier(task))
    defer { activeTasks.remove(ObjectIdentifier(task)) }
    // ... read file and respond ...
}

func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
    activeTasks.remove(ObjectIdentifier(task))
}
```
This is more important in async implementations; synchronous reads are generally safe.

### Pitfall 6: Xcode Folder Reference vs Group

**What goes wrong:** If `WebBundle/` is added as a Xcode Group (yellow folder icon) instead of a Folder Reference (blue folder icon), the directory structure is flattened into the app bundle — all files land at the top level of the bundle, breaking subdirectory path lookups like `assets/sql-wasm-fts5.wasm`.

**Why it happens:** Xcode Groups enumerate individual files and add them without preserving directory structure. Folder References copy the directory as-is.

**How to avoid:** When adding `WebBundle/` to the Xcode project, choose "Create Folder References" (not "Create Groups"). The folder appears blue in the Project Navigator. Verify the final app bundle with `xcrun simctl` or by inspecting the `.app` contents.

**Warning signs:** `Bundle.main.url(forResource: "WebBundle", withExtension: nil)` returns `nil`; or the returned path does not contain the expected subdirectories.

---

## Code Examples

Verified patterns from official sources and prior ARCHITECTURE.md research:

### WKURLSchemeHandler Complete Registration

```swift
// ContentView.swift or dedicated factory function
import WebKit
import SwiftUI

func makeWebView() -> WKWebView {
    let config = WKWebViewConfiguration()

    #if !DEBUG
    // Register custom scheme handler (Release only)
    config.setURLSchemeHandler(AssetsSchemeHandler(), forURLScheme: "app")
    #endif

    let webView = WKWebView(frame: .zero, configuration: config)

    #if DEBUG
    // Dev server for HMR
    webView.load(URLRequest(url: URL(string: "http://localhost:5173")!))
    // Enable Safari Web Inspector (iOS 16.4+ / macOS 13.3+)
    if #available(iOS 16.4, macOS 13.3, *) {
        webView.isInspectable = true
    }
    #else
    // Load from bundled app:// scheme
    webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
    #endif

    return webView
}
```

### Minimum index.html for Native Build

```html
<!-- index.html (at project root — new file for this phase) -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Isometry</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Note: `src/main.ts` must be created (or an existing entry adapted) that instantiates the D3 views and WorkerBridge in the `#app` container.

### Run Script Build Phase

```bash
#!/bin/bash
# Xcode Run Script: "Build web bundle for native"
# Input Files: $(SRCROOT)/../package.json
# Output Files: $(SRCROOT)/Isometry/WebBundle/index.html

set -euo pipefail

REPO_ROOT="$(dirname "$SRCROOT")"

cd "$REPO_ROOT"

# Build Vite native bundle
npm run build:native

# Sync to Xcode WebBundle folder reference
rsync -av --delete "dist-native/" "$SRCROOT/Isometry/WebBundle/"

echo "Web bundle synced to WebBundle/"
```

### SwiftUI @main Entry Point

```swift
// IsometryApp.swift
import SwiftUI

@main
struct IsometryApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WKWebView `file://` URL | WKURLSchemeHandler with custom scheme | iOS 11 (2017) | WASM fetch works; MIME type controlled |
| `UIWebView` | `WKWebView` | iOS 12 (deprecated), iOS 15 (removed) | WKWebView is the only API |
| `webView.allowsInlineMediaPlayback` for debugging | `webView.isInspectable = true` | iOS 16.4 (2023) | Explicit opt-in required for Safari Web Inspector |
| Private `_registerURLSchemeAsSecure:` | App-Bound Domains for secure context | iOS 14 (2020) | Public API path exists but requires domain configuration |
| Two separate iOS/macOS targets | Single multiplatform target | Xcode 14 (2022) | Single codebase, shared build settings |

**Deprecated/outdated:**
- `_registerURLSchemeAsSecure:` private API: Cannot be used in App Store submissions. Not needed for this phase (single-threaded WASM does not require SharedArrayBuffer).
- `UIWebView`: Removed in iOS 15. All WKWebView.

---

## Open Questions

1. **ES Module Workers under `app://` scheme**
   - What we know: Regular workers are well-supported in WKWebView. ES module workers (`{ type: 'module' }`) require a secure context in browsers. Custom schemes may or may not qualify as secure in WKWebView's internal classification.
   - What's unclear: No official Apple documentation confirms whether `app://` custom scheme is treated as secure for module workers. The existing worker uses `{ type: 'module' }` per the WorkerBridge implementation.
   - Recommendation: Test directly in iOS Simulator with a Release build. If module workers fail, the fallback is fetching the worker script as text and creating a blob URL — a 10-line shim that does not modify the existing TypeScript source.

2. **index.html and main.ts entry point**
   - What we know: The existing project is a library (no `index.html`, no `main.ts`). Vite app mode requires an `index.html`. The existing `src/index.ts` is a library re-export file, not an app entry.
   - What's unclear: How much new TypeScript is needed to bootstrap the D3 views in a standalone page. Looking at `src/index.ts`, it exports everything but doesn't instantiate anything.
   - Recommendation: Create a minimal `src/main.ts` that creates a `WorkerBridge`, instantiates `ViewManager`, and mounts the default view to `#app`. This is the glue code that already conceptually exists for the web runtime but was never needed as a standalone page. Estimated: 30-50 lines of TypeScript.

3. **Xcode project creation approach**
   - What we know: Xcode's multiplatform app template is the standard approach. pbxproj hand-writing is error-prone. Tools like XcodeGen can generate from YAML but add a dependency.
   - What's unclear: Whether creating the Xcode project via Xcode GUI is reliable in a scripted/automated context.
   - Recommendation: Use Xcode's built-in template (File > New > Project > Multiplatform > App) and document the manual step. This is a one-time setup. The resulting project is committed to git. Future developers just open `native/Isometry.xcodeproj`.

4. **Incremental build input file list for Run Script**
   - What we know: Specifying output files enables Xcode to skip the Run Script when unchanged. Input files can be a list or `.xcfilelist`. Using `package.json` as the sole input is a simplification that triggers rebuilds on any dependency change.
   - What's unclear: Whether `$(SRCROOT)/../package.json` is sufficient or if TypeScript source files should also be listed.
   - Recommendation: Start with `package.json` as the single input sentinel and `WebBundle/index.html` as the output. This will run the build on any package change. For tighter incremental builds, a `.xcfilelist` with `$(SRCROOT)/../src/**/*.ts` can be added later.

---

## Sources

### Primary (HIGH confidence)

- Project's `.planning/research/ARCHITECTURE.md` — Complete AssetsSchemeHandler pattern with verified Swift code, WebViewContainer multiplatform pattern, startup hydration sequence, all component responsibilities for v2.0
- Project's `.planning/research/PITFALLS.md` — WKWebView WASM MIME rejection root cause (Pitfall 1), XHR vs fetch behavior, `file://` non-starter documentation
- Project's `.planning/phases/11-xcode-shell-wkurlschemehandler/11-CONTEXT.md` — All locked decisions, Vite config decisions, deployment targets, scheme handler scope

### Secondary (MEDIUM confidence)

- [WKURLSchemeHandler — Apple Developer Documentation](https://developer.apple.com/documentation/webkit/wkurlschemehandler) — Protocol methods, availability (iOS 11+)
- [setURLSchemeHandler(_:forURLScheme:) — Apple Developer Documentation](https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/2875766-seturlschemehandler) — Registration API
- [isInspectable — Apple Developer Documentation](https://developer.apple.com/documentation/webkit/wkwebview/isinspectable) — iOS 16.4+ explicit opt-in for Safari Web Inspector
- [Configuring a multiplatform app — Apple Developer Documentation](https://developer.apple.com/documentation/xcode/configuring-a-multiplatform-app-target) — Single target for iOS + macOS
- [Building for Production — Vite](https://vite.dev/guide/build) — App mode vs library mode, `build.lib` removal switches to `index.html` entry
- [Build Options — Vite](https://vite.dev/config/build-options) — `build.outDir`, `build.assetsInlineLimit`, worker.format
- [Getting WKWebView to treat a WKURLSchemeHandler as secure — DEV Community](https://dev.to/alastaircoote/getting-wkwebview-to-treat-a-custom-scheme-as-secure-3dl3) — Private API limitation (not App Store safe); App-Bound Domains as public alternative
- [Custom URL schemes in a WKWebView — Gualtiero Frigerio](https://www.gfrigerio.com/custom-url-schemes-in-a-wkwebview/) — WKURLSchemeHandler implementation pattern
- [Xcode Run Script input/output files — iOS Dev Recipes](https://www.iosdev.recipes/xcode/input-output-files/) — Incremental build skip mechanism
- [Running custom scripts during a build — Apple Developer Documentation](https://developer.apple.com/documentation/xcode/running-custom-scripts-during-a-build) — Build phase scripting

### Tertiary (LOW confidence — flag for validation)

- Web Worker ES module type + custom scheme interaction: No definitive Apple documentation found. Behavior under `app://` scheme for `{ type: 'module' }` workers must be validated empirically in Simulator.
- Service workers vs regular workers in WKWebView: Service Workers not available in WKWebView without browser entitlement. Regular workers are supported. The distinction matters for confirming the existing WorkerBridge works.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — WKURLSchemeHandler is the documented, standard API for this exact problem; Vite app mode is well-documented
- Architecture: HIGH — Pattern from existing `.planning/research/ARCHITECTURE.md` is detailed and verified; multiplatform WKWebView wrapper is a standard Swift pattern
- Pitfalls: HIGH for MIME type issue (documented in project's own research); MEDIUM for Worker/custom-scheme interaction (no official docs confirming behavior)

**Research date:** 2026-03-02
**Valid until:** 2026-09-02 (6 months — WKURLSchemeHandler is a stable API; no fast-moving parts)
