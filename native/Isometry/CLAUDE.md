# CLAUDE.md — Isometry Native Shell (v2.0)

*Claude Code implementation guide for the Swift/WKWebView native shell.*
*When in doubt, this document wins over any other file in this directory.*

---

## What This Is

The native shell is **platform plumbing**, not a data layer. It exists to:

1. Serve the bundled web app via a custom `app://` URL scheme
2. Pass the SQLite database file to the JS runtime at launch
3. Receive checkpoint bytes from JS and write them to disk atomically
4. Expose platform capabilities (file import, subscriptions, iCloud sync) that JS cannot access directly
5. Manage app lifecycle (autosave timer, iOS background save, macOS quit)

**Swift does not query, parse, or understand the database.** All SQL runs in the sql.js Worker inside WKWebView. Swift treats `isometry.db` as an opaque blob of bytes.

---

## Architecture in One Diagram

```
┌─────────────────────────────────────────────────────┐
│                  SwiftUI Shell                       │
│                                                      │
│  IsometryApp  ─── BridgeManager ─── DatabaseManager │
│       │                │                             │
│  lifecycle          6-msg bridge        atomic       │
│  (bg save,          (see below)         checkpoint   │
│   autosave)             │               write        │
│                         │                            │
│              ┌──────────▼──────────┐                 │
│              │  WKWebView          │                 │
│              │  (app:// scheme)    │                 │
│              │                     │                 │
│              │  JS Runtime         │                 │
│              │  ├─ sql.js Worker   │                 │
│              │  ├─ WorkerBridge    │                 │
│              │  ├─ Providers       │                 │
│              │  └─ D3 Views        │                 │
│              └─────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

---

## The Bridge Protocol

This is the complete contract between Swift and JS. There are **six primary message types**, plus one conditional response (`native:blocked`). Do not add new types without an architectural review.

| # | Direction | Type | Trigger | Payload |
|---|-----------|------|---------|---------|
| 1 | JS → Swift | `native:ready` | JS runtime initialized | none |
| 2 | Swift → JS | `native:launch` | After `native:ready` | `dbData` (base64 or null), `platform`, `tier`, `viewport`, `safeAreaInsets` |
| 3 | JS → Swift | `checkpoint` | After mutations or explicit save | `dbData` (base64) |
| 4 | JS → Swift | `mutated` | Any write operation in Worker | none |
| 5 | JS → Swift | `native:action` | JS requests platform operation | `kind`, feature-specific fields |
| 6 | Swift → JS | `native:sync` | iCloud notification received | sync metadata |
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
├── IsometryApp.swift          — App entry point, lifecycle, macOS delegate, SwiftUI commands
├── ContentView.swift          — SwiftUI root view, WebViewContainer host, file import sheet
├── WebViewContainer.swift     — WKWebView wrapper (UIViewRepresentable / NSViewRepresentable)
├── AssetsSchemeHandler.swift  — Serves app:// URLs from WebBundle (path-traversal-hardened)
├── BridgeManager.swift        — 6-message bridge, autosave timer, crash recovery
├── DatabaseManager.swift      — Opaque checkpoint persistence (load/save isometry.db)
├── SubscriptionManager.swift  — StoreKit 2 subscription tiers (Free / Pro / Workbench)
├── FeatureGate.swift          — Tier enforcement for native actions
├── PaywallView.swift          — Upgrade UI
└── SettingsView.swift         — App settings
```

---

## Shipped Components and Their Responsibilities

### `DatabaseManager` (actor)

Owns all disk I/O for the database file. Does **not** open, read, or query SQLite — it handles the file as raw `Data`.

- `loadDatabase() -> Data?` — reads `isometry.db`, falls back to `.bak` on corruption, returns `nil` on first launch
- `saveCheckpoint(_ data: Data)` — atomic write: write `.tmp` → rotate `.db` to `.bak` → rename `.tmp` to `.db`
- Automatically uses `NSFileCoordinator` when the storage path is an iCloud ubiquity container
- `resolveStorageDirectory()` — tries iCloud container, falls back to Application Support
- `autoMigrateIfNeeded()` — copies local `.db` to iCloud container on first iCloud-enabled launch (one-time, non-destructive)

### `BridgeManager` (@MainActor)

Owns the WKWebView communication channel. Implements `WKNavigationDelegate` for crash recovery.

- Registers `nativeBridge` script message handler (via weak proxy to avoid retain cycle)
- Dispatches incoming messages by `type` field
- `sendLaunchPayload()` — assembles and sends `native:launch` after JS ready signal
- `requestCheckpoint()` — asks JS to export database and post it back
- `startAutosave()` / `stopAutosave()` — 30-second timer that fires `requestCheckpoint()` when dirty
- `saveIfDirty()` — called on lifecycle events; no-ops if JS is not ready
- `checkForSilentCrash()` — detects WebKit bug #176855 (webView.url is nil without termination callback)

### `AssetsSchemeHandler`

Serves bundled web assets via `app://localhost/...`. Security-hardened after P1 review:

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

---

## What Is NOT in the Native Shell

These concerns belong entirely in the JS runtime. Do not add them to Swift:

| Concern | Lives In |
|---------|----------|
| SQL queries, CRUD, FTS5 search | sql.js Worker (`src/database/`) |
| LATCH filtering, PAFV projection | JS Providers (`src/providers/`) |
| Graph traversal (CTE queries) | `src/database/queries/graph.ts` |
| Graph algorithms (centrality, clustering) | D3.js layer (`src/views/`) |
| Card data models, Connection models | TypeScript types in `src/` |
| View rendering | D3.js + WorkerBridge |
| ETL / data import logic | `src/etl/` |
| Undo/redo command log | `src/worker/MutationManager.ts` |
| Conflict resolution | JS layer |

---

## Schema and Data Model

The Swift layer has no knowledge of the schema. For reference only:

- **Primary tables:** `cards`, `connections` (see `src/database/schema.sql`)
- **Connections model:** Lightweight relations with optional `via_card_id` for rich context (D-001). Connections are **not** cards.
- **FTS5:** `cards_fts` virtual table with `rowid` joins (D-004)
- **State persistence tiers:** Durable (SQLite cards/connections) → Session (SQLite ui_state) → Ephemeral (in-memory only) (D-005)

Swift is unaware of all of the above. The schema lives in JS.

---

## Architectural Decisions (Binding)

These decisions are final. Do not revisit during native shell implementation.

| ID | Decision |
|----|----------|
| D-001 | Connections are lightweight relations, not cards. `via_card_id` provides richness. |
| D-005 | `SelectionProvider` is Tier 3 ephemeral — never persisted, never synced. |
| D-007 | OAuth tokens and API keys are Keychain-only. SQLite stores metadata only. |
| D-010 | Sync triggers: dirty flag + 30s autosave + lifecycle (background/quit) + explicit save (⌘S). |

The following decisions are **resolved in CLAUDE-v5.md** and govern the JS runtime. Listed here as context for the bridge contract:

- D-002: WorkerBridge canonical spec is `Modules/Core/WorkerBridge.md`
- D-003: SQL safety via allowlisted fields + parameterized values
- D-004: FTS uses `cards_fts` with `rowid` joins
- D-006: Nine canonical view types (list, grid, kanban, calendar, timeline, network, tree, gallery, **supergrid**) with tier availability matrix
- D-011: Two-layer architecture is permanent — no native SQLite migration

---

## iCloud Sync Model

The sync model is **whole-database checkpoint sync via iCloud ubiquity container**, not record-level CloudKit push/pull. iCloud Drive file sync (ubiquity containers) is a different Apple technology from CloudKit (`CKRecord`/`CKDatabase`). The native shell uses the former.

```
[JS mutates cards]
      ↓
[mutated message → BridgeManager marks dirty]
      ↓
[30s autosave or lifecycle event]
      ↓
[requestCheckpoint() → JS exports sql.js → base64 bytes]
      ↓
[checkpoint message → DatabaseManager.saveCheckpoint()]
      ↓
[isometry.db in iCloud ubiquity container root]
      ↓  (iCloud Drive syncs to other devices automatically)
[next app launch on other device reads isometry.db from container]
```

**Storage location:** The database lives in the ubiquity container root (`containerURL/Isometry/isometry.db`), **not** in `Documents/`. This hides it from the iOS Files app intentionally.

**macOS quit tradeoff:** `applicationWillTerminate` cannot complete the JS→Swift checkpoint round-trip synchronously. Maximum data loss on Cmd+Q is 30 seconds. Accepted tradeoff.

There is no `CKRecord`, `CKModifyRecordsOperation`, or `CKServerChangeToken` in the current architecture.

---

## Phase Roadmap (for orientation)

The native shell is **complete and permanent** (see D-011). It is not transitional — the WKWebView checkpoint model is the correct architecture for Isometry's local-first platform.

**Current native shell status:** Functional v2.0 with security hardening complete (P1 path traversal fix shipped).

Do not add complexity to the shell. Its job is checkpoint plumbing. The interesting work happens in JS.

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
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  build

# All tests must pass
xcodebuild -scheme Isometry \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
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
The six-message protocol is intentionally minimal. Adding message types couples the Swift and JS layers and makes both harder to maintain.

**❌ Don't implement record-level CloudKit sync**
The checkpoint model is the architecture. `CKRecord`, `CKModifyRecordsOperation`, and `CKServerChangeToken` are not part of v2.0 and should not be added.

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
- `SQLITE-MIGRATION-PLAN-v2.md` — retired architecture; document was never committed to the repo
- Any document that introduces `IsometryDatabase`, `Node`/`Edge` Swift structs, or `CKModifyRecordsOperation` — Phase 7 concepts, not v2.0

---

## Go / No-Go Checklist

Before marking any native shell work complete:

- [ ] Xcode build succeeds with no errors
- [ ] `xcodebuild test` passes
- [ ] `AssetsSchemeHandler` rejects `..` path components
- [ ] `AssetsSchemeHandler` validates `hasPrefix` containment
- [ ] `HTTPURLResponse` construction is guarded (no force unwrap)
- [ ] Bridge handles all 6 message types without crashing on malformed input
- [ ] `native:blocked` sent correctly when `FeatureGate` denies action
- [ ] All logger subsystems are `"works.isometry.app"`
- [ ] `DatabaseManager.saveCheckpoint()` uses atomic write (`.tmp` → rotate → rename)
- [ ] `saveCheckpoint()` uses `NSFileCoordinator` when path is iCloud ubiquity container
- [ ] Database stored in ubiquity container root, not `Documents/`
- [ ] `BridgeManager` weak-references `WKWebView` (no retain cycle)
- [ ] Script message handler uses `WeakScriptMessageHandler` proxy (no retain cycle)
- [ ] Autosave timer stops on background, starts on active
- [ ] iOS background save uses `UIBackgroundTaskIdentifier`
- [ ] macOS quit handled via `NSApplicationDelegate.applicationWillTerminate`

---

*The shell's job is to get bytes in and bytes out. The interesting work happens in JS.*
