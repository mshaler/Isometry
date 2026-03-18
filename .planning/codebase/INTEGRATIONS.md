# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**Apple Ecosystem (iOS/macOS only):**
- CloudKit - Synchronization and data persistence across devices
  - SDK: Built-in (native Swift only, via CloudKit framework)
  - Auth: iCloud account (automatic via user's Apple ID)
- StoreKit 2 - In-app subscription and purchase management
  - SDK: Built-in (native Swift only)
  - Auth: Apple account (automatic)
- Reminders Framework - Integration with native Apple Reminders
  - SDK: Built-in (native Swift only, `RemindersAdapter.swift`)
  - Auth: User permission (ENRequestSchedulePermissions)
- Calendar Framework - Integration with native Apple Calendar
  - SDK: Built-in (native Swift only, `CalendarAdapter.swift`)
  - Auth: User permission (ENRequestSchedulePermissions)
- Apple Notes - Import/parse Apple Notes .sqlite files
  - SDK: Custom parser using NoteStoreProto.pb.swift (protobuf decoded)
  - Auth: User-granted file access via document picker

**Web-Only Services:**
- None - This is a local-first application with no cloud backends

## Data Storage

**Databases:**
- SQLite (via sql.js in WASM)
  - Connection: In-memory sql.js instance seeded from `dbData` base64 bytes
  - Client: sql.js 1.14.0 (library, not external service)
  - Location: `src/database/Database.ts` - Singleton instance
  - Features: FTS5 extension (sql-wasm-fts5.wasm) for full-text search
  - Persistence: Base64 checkpoint data posted to `window.webkit.messageHandlers.nativeBridge` (native)
  - Launch flow: `waitForLaunchPayload()` receives base64 dbData from Swift, decoded via `base64ToUint8Array()`
  - Checkpoint timing: 100ms debounced auto-save on mutations

**File Storage:**
- Local filesystem only (browser IndexedDB NOT used)
- Native: Application Support directory (`~/Library/Application Support/Isometry/`)
- ETL imports: File upload via `<input type="file">` (CSV, Excel, Markdown, JSON)
- Export: Generated CSV/Markdown files (browser download or native file write)

**Caching:**
- None - D3 data join IS the cache (selector pattern reuses DOM)
- In-memory Provider instances (StateCoordinator, PAFV, Filters, etc.)
- No persistent cache layer outside SQLite

## Authentication & Identity

**Auth Provider:**
- None for web
- Native: iCloud account (CloudKit + StoreKit automatically authenticate)
- Tier system: 'free' hardcoded in LaunchPayload (v4.0+), upgradeable to subscription tiers via StoreKit

**Access Control:**
- File permissions (native): User grants document picker access for imports
- Sync permissions (native): CloudKit zone sharing (private zone only, no sharing)

## Data Synchronization

**CloudKit Sync (iOS/macOS only):**
- Framework: CloudKit CKSyncEngine (v4.1+)
- Location: `native/Isometry/Isometry/SyncManager.swift`
- Database records: Two zones — cards and connections with automatic change tracking
- Sync flow:
  1. SyncManager actor initializes CKSyncEngine with persisted state serialization
  2. On mutation, pending changes queued via CKSyncEngine.add()
  3. CKSyncEngine handles fetch/push cycles with server-wins conflict resolution
  4. JSON encoding of state serialization (change tokens)
  5. Offline queue as sync-queue.json (fallback if CloudKit unavailable)
- Partition ordering: Cards before connections (FK constraint satisfaction)
- Conflict resolution: System fields archival via NSKeyedArchiver (server-wins)
- Reset: encryptedDataReset recovery endpoint exports all cards + connections

**No network services for:**
- Email delivery
- Analytics/telemetry
- User accounts/authentication (beyond iCloud)
- Backups (CloudKit handles this)

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to console only
- Native: Console.log capture to ErrorBanner UI component

**Logs:**
- Browser: console.log, console.error (no persistent log storage)
- Native: OSLog (standard Apple logging framework)
- Profiling: __PERF_INSTRUMENTATION__ compile-time gate for PerfTrace utility (tree-shaken in production)

**Performance Instrumentation:**
- PerfTrace utility (`src/profiling/PerfTrace.ts`) - Compile-time gateable
  - Measures: Database query time, render time, D3 layout computation
  - No production overhead (code removed via tree-shaking when __PERF_INSTRUMENTATION__ = false)
  - Benchmarks stored in `.benchmarks/main.json` for regression comparison

## CI/CD & Deployment

**Hosting (Web):**
- None - This is an embedded library, not a standalone web app
- Vite library build (dist/) exports Database + utilities for external consumers

**Hosting (Native):**
- iOS/macOS app via App Store
- Uses WKWebView to embed web runtime bundle (dist-native/)
- App Store provisioning profile + certificate (regeneration needed per v0.5)
- StoreKit 2 products configured in App Store Connect (needed for subscription tiers)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Jobs: typecheck, lint, test (parallel) + soft-gate benchmark
- No deployment automation (manual App Store submission)

## Webhooks & Callbacks

**Incoming:**
- None - Stateless WASM app, no HTTP servers or webhook receivers

**Outgoing:**
- CloudKit push notifications (Apple-managed, no custom webhooks)
- StoreKit transaction updates (Apple-managed, native listeners only)

**Bridge Callbacks (Native ↔ Web):**
- JavaScript → Swift: `window.webkit.messageHandlers.nativeBridge.postMessage(message)`
  - `native:ready` - Signals JS bootstrap complete, triggers LaunchPayload delivery
  - `native:action` - File imports/exports, checkpoint saves
  - `native:sync` - CloudKit sync signals (stub)
- Swift → JavaScript: `window.__isometry.receive(message)`
  - `LaunchPayload` - dbData (base64), platform, tier, viewport, safeAreaInsets
  - `sync:update` - CloudKit changes (stub)

## Environment Configuration

**Required env vars (None in production):**
- Development only: `NODE_ENV` (set by build scripts)
- CI only: `CI` environment variable (GitHub Actions, used to skip reusing Playwright server)

**Secrets location:**
- None - Application is entirely local-first
- No API keys, OAuth tokens, or credentials stored in code
- iCloud credentials handled automatically by OS

**Configuration files:**
- `.storekit` (App Store Connect config) - Not in repository, generated via Xcode
- Entitlements.plist - CloudKit + StoreKit capabilities (native only)

## Import/Export Integration

**Importers (ETL):**
- Apple Reminders - `RemindersAdapter.swift` (native)
- Apple Calendar - `CalendarAdapter.swift` (native)
- Apple Notes - `NotesAdapter.swift` (protobuf decoder, native)
- CSV - `CSVParser.ts` (web, via PapaParse)
- Excel - `ExcelParser.ts` (web, via xlsx)
- Markdown - `MarkdownParser.ts` (web, via gray-matter)
- JSON - `JSONParser.ts` (web, native JSON API)

**Exporters:**
- CSV - `CSVExporter.ts` (web)
- Markdown - `MarkdownExporter.ts` (web)
- Excel - `ExcelExporter.ts` (web, via xlsx)

**Native Import Flow:**
- `NativeImportAdapter.ts` - Receives file paths from Swift
- Chunks ETL data via `etl:import-native` worker requests
- Chunk accumulator pattern for multi-part imports

## Platform-Specific Integrations

**iOS-Specific:**
- Safe area insets (delivered in LaunchPayload)
- Keyboard avoidance (WKWebView automatic)
- Device orientation changes (app handles via message handler)
- File picker integration (UIDocumentPickerViewController from native)

**macOS-Specific:**
- Sidebar navigation (SwiftUI NavigationSplitView in native shell)
- Menu integration (native NSMenu coordination)
- Full-screen transitions (native window management)

**Cross-Platform (iOS + macOS):**
- CloudKit sync (CKSyncEngine)
- StoreKit 2 subscriptions (SKPaymentQueue)
- File system access (Application Support directory)
- WKWebView embedding and messaging

## Type Definitions

**TypeScript Declarations:**
- `declare global { interface Window { webkit?: { ... } } }` - WebKit message handler API
- `LaunchPayload` - dbData, platform, tier, viewport, safeAreaInsets
- `WorkerBridge` - Bidirectional Worker communication protocol

**Protobuf Models (Native):**
- `NoteStoreProto.pb.swift` - Apple Notes format decoding

---

*Integration audit: 2026-03-17*
