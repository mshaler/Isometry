# CLAUDE.md — Isometry Native Shell (v9.0)

*Claude Code implementation guide for the Swift/WKWebView native shell.*
*When in doubt, this document wins over any other file in this directory.*

---

## What This Is

The native shell is **platform plumbing**, not a data layer. It exists to:

1. Serve the bundled web app via a custom `app://` URL scheme
2. Pass the SQLite database file to the JS runtime at launch
3. Receive checkpoint bytes from JS and write them to disk atomically
4. Expose platform capabilities (file import, subscriptions, CloudKit sync, native data import) that JS cannot access directly
5. Manage app lifecycle (autosave timer, iOS background save, macOS quit)
6. Sync records via CKSyncEngine (record-level CloudKit, not file sync)
7. Import native Apple data sources (Notes, Reminders, Calendar, Alto Index)
8. Report crash/hang diagnostics via MetricKit

**Swift does not query, parse, or understand the database.** All SQL runs in the sql.js Worker inside WKWebView. Swift treats `isometry.db` as an opaque blob of bytes.

---

## Architecture in One Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        SwiftUI Shell                              │
│                                                                    │
│  IsometryApp  ─── BridgeManager ─── DatabaseManager               │
│       │                │                    │                      │
│  lifecycle          bridge msgs          atomic                     │
│  (bg save,          (see below)          checkpoint                 │
│   autosave)             │                write                      │
│       │                │                                            │
│  MetricKitSubscriber   │        SyncManager (CKSyncEngine actor)    │
│  (crash+hang)          │        └─ state: sync-state.data          │
│                         │        └─ queue: sync-queue.json         │
│  NativeImportCoordinator│        └─ fields: record-metadata.json   │
│  └─ NotesAdapter        │        └─ SyncStatusPublisher            │
│  └─ RemindersAdapter    │                                           │
│  └─ CalendarAdapter     │                                           │
│  └─ AltoIndexAdapter    │                                           │
│                         │                                           │
│  PermissionManager      │                                           │
│  (TCC checks)           │                                           │
│                         │                                           │
│              ┌──────────▼──────────┐                               │
│              │  WKWebView          │                               │
│              │  (app:// scheme)    │                               │
│              │                     │                               │
│              │  JS Runtime         │                               │
│              │  ├─ sql.js Worker   │                               │
│              │  ├─ WorkerBridge    │                               │
│              │  ├─ Providers       │                               │
│              │  └─ D3 Views        │                               │
│              └─────────────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## The Bridge Protocol

This is the complete contract between Swift and JS. Do not add new types without an architectural review.

| # | Direction | Type | Trigger | Payload |
|---|-----------|------|---------|---------|
| 1 | JS → Swift | `native:ready` | JS runtime initialized | none |
| 2 | Swift → JS | `native:launch` | After `native:ready` | `dbData` (base64 or null), `platform`, `tier`, `viewport`, `safeAreaInsets` |
| 3 | JS → Swift | `checkpoint` | After mutations or explicit save | `dbData` (base64) |
| 4 | JS → Swift | `mutated` | Any write operation in Worker | none |
| 5 | JS → Swift | `native:action` | JS requests platform operation | `kind`, feature-specific fields |
| 6 | Swift → JS | `native:sync` | CKSyncEngine delivers incoming records | sync metadata |
| 7 | JS → Swift | `native:import-chunk-ack` | JS acknowledges an import chunk | `chunkIndex` |
| 8 | JS → Swift | `native:export-all-cards` | JS requests full card export for initial CloudKit upload | none |
| 9 | JS → Swift | `native:request-file-import` | JS triggers file import dialog | `kind` |
| — | Swift → JS | `native:blocked` | `FeatureGate` denies a `native:action` | `feature`, `requiredTier` |

`native:blocked` is a conditional response to `native:action`, not a standalone message type. File import also flows Swift → JS as a `native:action` with `kind: "importFile"` via `BridgeManager.sendFileImport()`.

**Key invariant:** `dbData` flows in both directions as base64-encoded bytes. Swift never interprets the bytes — it loads them from disk, sends them to JS at launch, and writes them back when JS checkpoints.

### Sequence: First Launch

```
App starts → DatabaseManager.loadDatabase() → nil (no file)
           → BridgeManager.sendLaunchPayload(dbData: nil)
           → JS initializes empty sql.js database
           → JS runs schema migrations
           → [user creates cards]
           → JS posts checkpoint message
           → Swift writes isometry.db
```

### Sequence: Subsequent Launch

```
App starts → DatabaseManager.loadDatabase() → Data (existing file)
           → BridgeManager.sendLaunchPayload(dbData: base64)
           → JS loads sql.js database from bytes
           → [session continues from last checkpoint]
```

---

## File Map

```
native/Isometry/Isometry/
├── IsometryApp.swift              — App entry point, lifecycle, macOS delegate, SwiftUI commands
├── ContentView.swift              — SwiftUI root view, WebViewContainer host, file import sheet
├── WebViewContainer.swift         — WKWebView wrapper (UIViewRepresentable / NSViewRepresentable)
├── AssetsSchemeHandler.swift      — Serves app:// URLs from WebBundle (path-traversal-hardened)
├── BridgeManager.swift            — 9-message bridge, autosave timer, crash recovery
├── DatabaseManager.swift          — Opaque checkpoint persistence (load/save isometry.db)
├── SubscriptionManager.swift      — StoreKit 2 subscription tiers (Free / Pro / Workbench)
├── FeatureGate.swift              — Tier enforcement for native actions
├── PaywallView.swift              — Upgrade UI
├── SettingsView.swift             — App settings (Subscription, Appearance, Cloud Sync, Diagnostics, About)
├── SyncManager.swift              — CKSyncEngine delegate actor, SyncStatusPublisher, SyncError
├── SyncStatusView.swift           — Toolbar sync icon (idle / syncing / error)
├── SyncErrorBanner.swift          — Persistent error banner with retry countdown (SUXR-01..02)
├── SyncTypes.swift                — PendingChange Codable type for offline queue
├── NativeImportCoordinator.swift  — Chunked bridge dispatch for native imports
├── NativeImportAdapter.swift      — Protocol definition for import adapters
├── MockAdapter.swift              — Test/debug adapter
├── NotesAdapter.swift             — Apple Notes (CoreData + Protobuf extraction)
├── RemindersAdapter.swift         — Apple Reminders (EventKit)
├── CalendarAdapter.swift          — Apple Calendar (EventKit)
├── AltoIndexAdapter.swift         — Alto Index JSON sources (books, calls, contacts, etc.)
├── PermissionManager.swift        — TCC permission check, request, deep links to System Settings
├── PermissionSheetView.swift      — Permission request sheet UI
├── ImportSourcePickerView.swift   — Native import source picker sheet
├── CoreDataTimestampConverter.swift — CoreData timestamp → Date conversion for Notes
├── ProtobufToMarkdown.swift       — NoteStoreProto protobuf → Markdown converter
├── NoteStoreProto.pb.swift        — Generated SwiftProtobuf types for Notes extraction
├── GzipDecompressor.swift         — zlib/gzip decompression for Notes attachments
├── MetricKitSubscriber.swift      — MXMetricManagerSubscriber for crash+hang diagnostics (MKIT-01..02)
└── PrivacyInfo.xcprivacy          — Apple privacy manifest (required for App Store submission)
```

---

## Shipped Components and Their Responsibilities

### `DatabaseManager` (actor)

Owns all disk I/O for the database file. Does **not** open, read, or query SQLite — it handles the file as raw `Data`.

- `loadDatabase() -> Data?` — reads `isometry.db`, falls back to `.bak` on corruption, returns `nil` on first launch
- `saveCheckpoint(_ data: Data)` — atomic write: write `.tmp` → rotate `.db` to `.bak` → rename `.tmp` to `.db`
- Storage path: Application Support/Isometry/ (not iCloud ubiquity container — since v4.1)
- `autoMigrateIfNeeded()` — one-time migration from legacy iCloud container path

### `BridgeManager` (@MainActor)

Owns the WKWebView communication channel. Implements `WKNavigationDelegate` for crash recovery.

- Registers `nativeBridge` script message handler (via weak proxy to avoid retain cycle)
- Dispatches incoming messages by `type` field (9 message types)
- `sendLaunchPayload()` — assembles and sends `native:launch` after JS ready signal
- `requestCheckpoint()` — asks JS to export database and post it back
- `startAutosave()` / `stopAutosave()` — 30-second timer that fires `requestCheckpoint()` when dirty
- `saveIfDirty()` — called on lifecycle events; no-ops if JS is not ready
- `checkForSilentCrash()` — detects WebKit bug #176855 (webView.url is nil without termination callback)

### `AssetsSchemeHandler`

Serves bundled web assets via `app://localhost/...`. Security-hardened:

- Rejects any path containing `..` or `.` components
- Validates that resolved file URL is contained within `bundleDir` using `hasPrefix`
- Guards `HTTPURLResponse` construction (no force unwrap)
- Tracks active tasks in a `Set<ObjectIdentifier>` for proper cancellation
- Explicit MIME map covering html, css, js, wasm, fonts, images, map files

### `SubscriptionManager` + `FeatureGate`

StoreKit 2 subscription management. Three tiers: `.free`, `.pro`, `.workbench`.

- `FeatureGate.isAllowed(_:for:)` — pure function, called from `BridgeManager` before dispatching `native:action`
- Blocked actions receive a `native:blocked` response so JS can show an upgrade prompt
- Currently gated to Pro: `fileImport`, `cloudSave`, `exportData`
- Views are **not** gated at the native level — view availability is enforced in JS

### `SyncManager` (actor)

CKSyncEngine delegate for record-level CloudKit sync. See **iCloud Sync Model** below.

- `initialize()` — creates CKSyncEngine with persisted state (or nil on first launch)
- State serialized via JSONEncoder → `sync-state.data` (change tokens)
- Offline queue: `sync-queue.json` — `[PendingChange]` array, survives app restart
- System fields archived to `record-metadata.json` (prevents data loss on server-side record merges)
- `fetchChanges()` — called on foreground to pull server changes
- `triggerResync()` — re-uploads all cards and connections (used by Settings > Cloud Sync)
- `statusPublisher: SyncStatusPublisher` — MainActor-observable status for toolbar/banner

### `NativeImportCoordinator` (@MainActor)

Orchestrates import from any `NativeImportAdapter` into the JS runtime.

- Accumulates cards from the adapter's `AsyncStream`
- Slices into 200-card chunks to avoid WKWebView memory pressure
- Base64-encodes each chunk and dispatches via `evaluateJavaScript`
- Awaits `native:import-chunk-ack` before sending the next chunk (sequential dispatch)

### `NotesAdapter`, `RemindersAdapter`, `CalendarAdapter`, `AltoIndexAdapter`

`NativeImportAdapter` protocol conformers. Each provides an `AsyncStream<[ImportedCard]>`.

- `NotesAdapter` — extracts Apple Notes via CoreData + SwiftProtobuf (handles inline content, attachments, tables as `[Table]` placeholder)
- `RemindersAdapter` — reads EKReminder from EventKit; groups by list; maps due date, priority, notes
- `CalendarAdapter` — reads EKEvent from EventKit; maps title, start, end, location, URL, notes
- `AltoIndexAdapter` — parses Alto Index JSON exports (books, calls, contacts, kindle, messages, reminders, safari, voice memos)

### `PermissionManager`

TCC permission management. Stateless — each call checks current authorization.

- `check(for:)` — returns `PermissionStatus` (`.notDetermined`, `.denied`, `.authorized`)
- `request(for:)` async — triggers system permission dialog
- `openSystemSettings(for:)` — deep links to relevant Privacy pane in System Settings

### `MetricKitSubscriber` (@MainActor)

Receives `MXDiagnosticPayload` from the OS (delivered next-day after crashes/hangs).

- Registered via `MXMetricManager.shared.add(self)` at app init
- `@Published var crashCount: Int` and `@Published var hangCount: Int` for Settings UI
- `exportJSON() -> Data?` — serializes all stored payloads as a JSON array for share/save
- Used by Settings > Diagnostics section

---

## What Is NOT in the Native Shell

These concerns belong entirely in the JS runtime. Do not add them to Swift:

| Concern | Lives In |
|---------|----------|
| SQL queries, CRUD, FTS5 search | sql.js Worker (`src/database/`) |
| LATCH filtering, PAFV projection | JS Providers (`src/providers/`) |
| Graph traversal (CTE queries) | `src/database/queries/graph.ts` |
| Graph algorithms (Dijkstra, betweenness, Louvain, etc.) | graphology in Worker (`src/database/queries/graph-metrics.ts`) |
| Card data models, Connection models | TypeScript types in `src/` |
| View rendering | D3.js + WorkerBridge |
| ETL / data import logic | `src/etl/` |
| Undo/redo command log | `src/worker/MutationManager.ts` |
| Conflict resolution UI | JS layer (server-wins — no UI required) |

---

## Schema and Data Model

The Swift layer has no knowledge of the schema. For reference only:

- **Primary tables:** `cards`, `connections` (see `src/database/schema.sql`)
- **Connections model:** Lightweight relations with optional `via_card_id` for rich context (D-001). Connections are **not** cards.
- **FTS5:** `cards_fts` virtual table with `rowid` joins (D-004)
- **State persistence tiers:** Durable (SQLite cards/connections) → Session (SQLite ui_state) → Ephemeral (in-memory only) (D-005)

Swift is unaware of all of the above. The schema lives in JS.

---

## iCloud Sync Model

The sync model is **record-level CloudKit sync via CKSyncEngine**, not whole-database file sync. Since v4.1 (Phases 39–41), the app uses `CKSyncEngine` for push/pull of individual card and connection records.

```
[JS mutates cards]
      ↓
[mutated message → BridgeManager marks dirty + queues PendingChange]
      ↓
[CKSyncEngine.nextRecordZoneChangeBatch() → SyncManager sends pending records]
      ↓
[server confirms → SyncManager persists updated change token to sync-state.data]
      ↓
[other devices receive silent push notification]
      ↓
[CKSyncEngine.handleReceivedDatabaseChanges() → SyncManager forwards to JS via native:sync]
      ↓
[JS merges incoming records via INSERT OR REPLACE]
```

**CloudKit zone:** `IsometryZone` custom zone. Record types: `Card`, `Connection`.

**State persistence:**
- `sync-state.data` — JSONEncoder-serialized `CKSyncEngine.State.Serialization` (change tokens)
- `sync-queue.json` — `[PendingChange]` offline queue, survives app restart
- `record-metadata.json` — system fields archived via `NSKeyedArchiver` (Pitfall 2 prevention)

**Conflict resolution:** Server-wins via `serverRecordChanged` delegate method. No user interaction required.

**Storage location:** Database (`isometry.db`) lives in Application Support/Isometry/, **not** in an iCloud ubiquity container. The iCloud Documents / ubiquity container model was the v2.0 architecture and was replaced in v4.1.

**macOS quit tradeoff:** `applicationWillTerminate` cannot complete the JS→Swift checkpoint round-trip synchronously. Maximum data loss on Cmd+Q is 30 seconds. Accepted tradeoff.

---

## Architectural Decisions (Binding)

These decisions are final. Do not revisit during native shell implementation.

| ID | Decision |
|----|----------|
| D-001 | Connections are lightweight relations, not cards. `via_card_id` provides richness. |
| D-005 | `SelectionProvider` is Tier 3 ephemeral — never persisted, never synced. |
| D-007 | OAuth tokens and API keys are Keychain-only. SQLite stores metadata only. |
| D-010 | Sync triggers: dirty flag + 30s autosave + lifecycle (background/quit) + explicit save (⌘S). |
| D-011 | Two-layer architecture is permanent. Swift does not model the data domain. CKSyncEngine is the sync engine — do not use `CKModifyRecordsOperation` directly. |

The following decisions are **resolved in CLAUDE-v5.md** and govern the JS runtime. Listed here as context for the bridge contract:

- D-002: WorkerBridge canonical spec is `Modules/Core/WorkerBridge.md`
- D-003: SQL safety via allowlisted fields + parameterized values
- D-004: FTS uses `cards_fts` with `rowid` joins
- D-006: Nine canonical view types (list, grid, kanban, calendar, timeline, network, tree, gallery, **supergrid**) with tier availability matrix

---

## Development Philosophy

### GSD + TDD

1. **Ship working code, not perfect code.**
2. **Tests must be minimal but real.** No placeholder test functions. Cover the security boundary.
3. **When stuck, simplify.** The shell has one job: checkpoint plumbing.

### Code Quality Gates

```bash
# Build must succeed with no errors
xcodebuild -scheme Isometry \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  build

# All tests must pass
xcodebuild -scheme Isometry \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  test
```

Zero compiler errors. Zero compiler warnings where avoidable.

### What NOT To Do

**❌ Don't open or query SQLite from Swift**
```swift
// WRONG
let db = try! Connection(dbURL.path)
let cards = try! db.prepare("SELECT * FROM cards")

// CORRECT: treat the file as opaque bytes
let data = databaseManager.loadDatabase()  // Data?, not rows
```

**❌ Don't add new bridge message types without review**
The 9-message protocol is intentionally minimal. Adding message types couples the Swift and JS layers and makes both harder to maintain.

**❌ Don't use CKModifyRecordsOperation directly**
CKSyncEngine is the sync engine. It handles batching, retry, and change token management. Direct `CKModifyRecordsOperation` or `CKFetchRecordZoneChangesOperation` bypasses the engine's state machine and will break sync.

**❌ Don't add Swift data models that mirror JS types**
There is no `Node`, `Edge`, `Card`, or `Connection` Swift struct. Swift does not model the data domain.

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `CLAUDE-v5.md` (repo root) | Canonical guide for the JS runtime — the other half of the system |
| `decision-log.md` (repo root) | All architectural decisions with rationale |
| `src/database/schema.sql` | Canonical schema (JS side) |
| `v5/Modules/Core/WorkerBridge.md` | Canonical bridge protocol spec (JS side) |
| `v5/Modules/Core/Contracts.md` | Type definitions (JS side) |
| `NATIVE_SHELL_SECURITY_FIX.md` (this dir) | P1 fix spec for AssetsSchemeHandler — already implemented |

**Do not reference:**
- `CLAUDE.md` (repo root) — archived Phase 7 plan; superseded by `CLAUDE-v5.md`
- Any document that introduces `IsometryDatabase`, `Node`/`Edge` Swift structs, or the v2.0 iCloud ubiquity file-sync model — those are stale v2.0 architecture concepts superseded by CKSyncEngine

---

## Go / No-Go Checklist

Before marking any native shell work complete:

- [ ] Xcode build succeeds with no errors
- [ ] `xcodebuild test` passes
- [ ] `AssetsSchemeHandler` rejects `..` path components
- [ ] `AssetsSchemeHandler` validates `hasPrefix` containment
- [ ] `HTTPURLResponse` construction is guarded (no force unwrap)
- [ ] Bridge handles all 9 message types without crashing on malformed input
- [ ] `native:blocked` sent correctly when `FeatureGate` denies action
- [ ] All logger subsystems are `"works.isometry.app"`
- [ ] `DatabaseManager.saveCheckpoint()` uses atomic write (`.tmp` → rotate → rename)
- [ ] `BridgeManager` weak-references `WKWebView` (no retain cycle)
- [ ] Script message handler uses `WeakScriptMessageHandler` proxy (no retain cycle)
- [ ] Autosave timer stops on background, starts on active
- [ ] iOS background save uses `UIBackgroundTaskIdentifier`
- [ ] macOS quit handled via `NSApplicationDelegate.applicationWillTerminate`
- [ ] SyncManager offline queue persists to disk (`sync-queue.json`)
- [ ] SyncManager state serialization persists to disk (`sync-state.data`)
- [ ] MetricKitSubscriber registered via `MXMetricManager.shared.add(self)` at app init
- [ ] `PrivacyInfo.xcprivacy` included in app bundle (file system synchronized root group)
- [ ] All native adapters handle TCC permission denial gracefully (show PermissionSheetView)
- [ ] Database stored in Application Support, not iCloud ubiquity container

---

*The shell's job is to get bytes in and bytes out. The interesting work happens in JS.*
