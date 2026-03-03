# Native Shell Swift/SwiftUI Review

## Scope
Reviewed:
- `native/Isometry/Isometry/AssetsSchemeHandler.swift`
- `native/Isometry/Isometry/ContentView.swift`
- `native/Isometry/Isometry/WebViewContainer.swift`
- `native/Isometry/Isometry/IsometryApp.swift`
- `native/Isometry/IsometryTests/IsometryTests.swift`
- `native/Isometry/IsometryUITests/IsometryUITests.swift`
- `native/Isometry/IsometryUITests/IsometryUITestsLaunchTests.swift`

## Findings (ordered by severity)

### 1. Path traversal risk in custom URL scheme resolution (P1)
**File:** `native/Isometry/Isometry/AssetsSchemeHandler.swift:14-20`

`resourcePath` is built directly from `url.path` and appended to `WebBundle` without normalizing/validating containment. Requests like `app://localhost/../../Info.plist` can resolve outside the intended web bundle directory.

**Why this matters**
- A custom scheme handler should be treated as an untrusted request boundary.
- Without canonical path containment checks, a malicious or buggy script can read arbitrary files from the app bundle.

**Recommended fix**
- Resolve a canonical file URL from `bundleDir.appendingPathComponent(resourcePath).standardizedFileURL`.
- Reject requests whose resolved path is not under `bundleDir.standardizedFileURL`.
- Reject `..` path components explicitly before filesystem access.

**Suggested patch pattern**
```swift
let normalizedPath = url.path
    .split(separator: "/")
    .map(String.init)
    .filter { !$0.isEmpty }

if normalizedPath.contains("..") {
    task.didFailWithError(URLError(.noPermissionsToReadFile))
    return
}

let relativePath = normalizedPath.isEmpty ? "index.html" : normalizedPath.joined(separator: "/")
let root = bundleDir.standardizedFileURL
let fileURL = root.appendingPathComponent(relativePath).standardizedFileURL

guard fileURL.path.hasPrefix(root.path + "/") || fileURL.path == root.path else {
    task.didFailWithError(URLError(.noPermissionsToReadFile))
    return
}
```

### 2. Request handling is synchronous and uncancelable (P2)
**File:** `native/Isometry/Isometry/AssetsSchemeHandler.swift:17-46`

`Data(contentsOf:)` is synchronous, and `stop task` is a no-op. Large or many concurrent asset reads can increase latency, and canceled tasks still do full reads.

**Why this matters**
- Degrades perceived app responsiveness during heavy initial load.
- Prevents proper cancellation semantics expected by `WKURLSchemeHandler`.

**Recommended refactor**
- Move read work off-thread with `Task.detached` or a serial `DispatchQueue`.
- Track in-flight tasks by `ObjectIdentifier(task)`.
- Cancel and remove in `stop task`.

### 3. Potential crash via force-unwrapped HTTP response (P3)
**File:** `native/Isometry/Isometry/AssetsSchemeHandler.swift:29-37`

`HTTPURLResponse(...)!` introduces an avoidable crash path if headers/URL are invalid.

**Recommended fix**
Use a guarded response construction and fail gracefully:
```swift
guard let response = HTTPURLResponse(... ) else {
    task.didFailWithError(URLError(.cannotParseResponse))
    return
}
```

### 4. WebView ownership/lifecycle should be made explicit (P3)
**File:** `native/Isometry/Isometry/ContentView.swift:5`

`@State private var webView: WKWebView = ContentView.makeWebView()` works, but storing a reference-type object in `@State` makes lifecycle intent less clear and harder to extend.

**Recommended refactor**
- Introduce a dedicated `@StateObject` view model (`WebShellViewModel`) that owns `WKWebView`, delegates, and scheme handler.
- Keep `ContentView` focused on layout only.

### 5. No behavioral tests for Native Shell bootstrap and asset serving (P2)
**Files:**
- `native/Isometry/IsometryTests/IsometryTests.swift:12-14`
- `native/Isometry/IsometryUITests/IsometryUITests.swift:26-39`

Current tests are template placeholders and do not verify core shell behavior.

**Recommended tests to add**
- Unit: `mimeType(for:)` for `.wasm`, `.js`, `.css`, fallback extensions.
- Unit: scheme path validation rejects traversal (`..`) and unknown assets.
- UI smoke: launch app and assert a known DOM marker is visible (e.g., page title or accessibility marker from web app).
- UI error path: intentionally request missing asset in test build and assert graceful handling.

## Additional improvement recommendations

1. Add explicit logging for load failures
- Add a `WKNavigationDelegate` and log/report `didFail`/`didFailProvisionalNavigation`.

2. Expand MIME map for deterministic headers
- Consider adding `woff`, `woff2`, `ico`, `map`, `txt` to reduce reliance on platform MIME inference.

3. Improve error UX
- For unrecoverable initial-load failures, present a small native fallback view with retry instructions rather than failing silently.

## Proposed refactor shape

- `WebShellViewModel` (`ObservableObject`)
  - builds/owns `WKWebView`
  - owns `AssetsSchemeHandler`
  - configures scripts and delegates
- `AssetsSchemeHandler`
  - validates canonical path containment
  - async/cancelable read pipeline
  - central response builder
- `ContentView`
  - pure container: `WebViewContainer(webView: viewModel.webView)`

## Highest-priority fixes to implement first

1. Path traversal protection in `AssetsSchemeHandler`.
2. Async + cancelable request handling in `AssetsSchemeHandler`.
3. Add at least one unit test for traversal rejection and one UI launch smoke test.
