# Phase 11: Xcode Shell + WKURLSchemeHandler - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Create an Xcode multiplatform project that serves the existing TypeScript/D3.js/sql.js web runtime inside WKWebView on iOS and macOS, with a custom `app://` scheme handler for correct WASM MIME types. The web runtime loads and renders all 9 D3 views without errors. No bridge, no persistence, no native chrome — just the shell that loads the web runtime.

</domain>

<decisions>
## Implementation Decisions

### Vite build for native
- Dual Vite configs: keep existing `vite.config.ts` for library/test use, add `vite.config.native.ts` that builds in app mode (with index.html, self-contained)
- `npm run build:native` produces output in `dist-native/` (parallel to existing `dist/`)
- sql.js stays as a separate chunk alongside the WASM file (not inlined) — scheme handler serves both with correct MIME types
- WASM file path stays as-is in `dist-native/assets/sql-wasm-fts5.wasm`

### Xcode project layout
- Xcode project lives in `native/` subdirectory: `native/Isometry.xcodeproj`
- Swift sources in `native/Isometry/`
- Single multiplatform target (iOS + macOS destinations), SwiftUI App lifecycle
- Use `#if os()` for platform-specific differences
- Deployment targets: **iOS 17 / macOS 14** — gains @Observable, modern SwiftUI navigation, StoreKit 2 APIs needed for Phase 14
- Run Script reaches up to repo root for `npm run build:native`

### Dev/Release switching
- `#if DEBUG` compile flag toggles between Vite dev server and bundled assets
- In DEBUG: WKWebView loads `http://localhost:5173` directly (Vite HMR)
- In RELEASE: WKWebView loads `app://localhost/index.html` via scheme handler
- Scheme handler is NOT registered in DEBUG builds — skip it entirely
- Dev server URL hardcoded to `localhost:5173` — change in one place if needed
- Run Script (`npm run build:native`) runs on EVERY Xcode build, with input/output file lists for incremental skipping

### Scheme handler scope
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

</decisions>

<specifics>
## Specific Ideas

- The existing Vite config builds in library mode with sql.js external — the native config needs app mode with sql.js bundled as a chunk
- The WASM file is a custom FTS5 build: `sql-wasm-fts5.wasm` (756KB), not the stock sql.js WASM
- Web Workers are critical — the WorkerBridge runs sql.js in a Worker for main thread responsiveness
- The existing `dist/` output has: `isometry.js`, `worker-*.js`, `schema-*.js`, `xlsx-*.js`, plus `assets/sql-wasm-fts5.wasm`
- PITFALLS-NATIVE.md documents the WASM MIME type rejection issue that makes `file://` a non-starter

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vite.config.ts`: Existing Vite config with viteStaticCopy for WASM, worker format ES, assetsInlineLimit 0
- `package.json`: Build scripts (`npm run build` = `tsc && vite build`), all dependencies declared
- `src/index.ts`: Library entry point re-exporting WorkerBridge, Database, all view types
- `src/worker/`: Web Worker implementation for sql.js operations
- `src/assets/sql-wasm-fts5.wasm`: Custom FTS5 WASM binary (756KB)

### Established Patterns
- Vite 7.3 with ES2022 target, ESM worker format
- sql.js uses `locateFile` callback to find WASM binary
- WorkerBridge is the primary API (main thread never touches sql.js directly)
- All 9 D3 views render to a container element — need an HTML host page

### Integration Points
- `dist-native/` output directory → Xcode Run Script copies to app bundle
- `npm run build:native` → new script in package.json using vite.config.native.ts
- WKWebView loads `app://localhost/index.html` → scheme handler maps to bundle resources
- In DEBUG, WKWebView loads `http://localhost:5173` → existing Vite dev server

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-xcode-shell-wkurlschemehandler*
*Context gathered: 2026-03-02*
