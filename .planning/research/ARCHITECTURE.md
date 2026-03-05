# Architecture Research

**Domain:** Native macOS ETL — Swift SQLite adapters feeding existing WKWebView bridge
**Researched:** 2026-03-05
**Confidence:** HIGH

> **Note:** This document is scoped to v4.0 Native ETL. It does not supersede prior ARCHITECTURE.md content for other milestones (v3.0 SuperGrid is independently valid). This document covers only the new Swift adapter layer, bridge extension points, and TypeScript Worker additions.

---

## System Overview

The v4.0 Native ETL milestone adds macOS-native SQLite readers to an already-complete WKWebView architecture. The critical constraint is that the web-side ETL pipeline (ImportOrchestrator, DedupEngine, SQLiteWriter) is NOT modified. Swift reads the macOS system databases, transforms them to CanonicalCard JSON, and delivers the data through the existing bridge. The web Worker receives pre-parsed cards — from its perspective, this is indistinguishable from a user selecting a file via the existing `importFile` flow.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        macOS System Databases (read-only)                    │
│                                                                              │
│  ┌───────────────────┐  ┌────────────────────┐  ┌────────────────────┐      │
│  │  NoteStore.sqlite │  │ Reminders *.sqlite  │  │ Calendar.sqlitedb  │      │
│  │  ~/Library/Group  │  │ ~/Library/Group     │  │ ~/Library/         │      │
│  │  Containers/      │  │ Containers/         │  │ Calendars/         │      │
│  │  group.com.apple  │  │ group.com.apple     │  │                    │      │
│  │  .notes/          │  │ .reminders/         │  │                    │      │
│  └────────┬──────────┘  └────────┬────────────┘  └────────┬───────────┘     │
│           │                      │                         │                 │
└───────────┼──────────────────────┼─────────────────────────┼─────────────────┘
            │ Full Disk Access (TCC) required for all three
            ▼                      ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Swift Native Shell (new + extended)                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PermissionManager (NEW)                                             │    │
│  │  • Probes ~/Library/Calendars readable as TCC FDA test               │    │
│  │  • Opens System Preferences on denial                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  NativeImportAdapter protocol (NEW)                                  │    │
│  │  var source: String { get }                                          │    │
│  │  func databasePath() throws -> URL                                   │    │
│  │  func extractCards(from data: Data) throws -> [[String: Any]]       │    │
│  └──────────────────┬──────────────────────────────────────────────────┘    │
│           ▲          │ concrete implementations                              │
│  ┌────────┴──────┐  ┌┴────────────────┐  ┌──────────────────────────┐      │
│  │ NotesAdapter  │  │RemindersAdapter  │  │  CalendarAdapter          │      │
│  │ (NEW — HIGH   │  │ (NEW — LOW risk) │  │  (NEW — LOW risk)         │      │
│  │  risk:        │  │                  │  │                           │      │
│  │  gzip+proto)  │  │                  │  │                           │      │
│  └───────────────┘  └──────────────────┘  └───────────────────────────┘     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  BridgeManager (EXISTING — additive extension)                       │    │
│  │  • New case "importNative" in existing native:action dispatch switch  │    │
│  │  • Invokes PermissionManager → adapter.extractCards()                │    │
│  │  • Serializes [[String:Any]] → JSON string via JSONSerialization     │    │
│  │  • Delivers via evaluateJavaScript as native:action importNative     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ evaluateJavaScript (JSON string payload)
                 ┌───────────────────▼──────────────────────┐
                 │      WKWebView boundary (existing)        │
                 └───────────────────┬──────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                          JS Main Thread (existing)                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  NativeBridge.ts receive() handler (EXISTING — one branch added)    │    │
│  │  • case 'native:action' / kind 'importNative'                       │    │
│  │  • JSON.parse(payload.cards) → CanonicalCard[]                      │    │
│  │  • Calls bridge.importNativeCards(source, cards)                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  WorkerBridge.ts (EXISTING — one method added)                      │    │
│  │  • importNativeCards(source, cards): sends 'etl:importNative'       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │ postMessage                             │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                            Web Worker (existing)                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Worker Message Router (EXISTING — one case added)                  │    │
│  │  • case 'etl:importNative': calls handleNativeImport(payload)       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ImportOrchestrator / DedupEngine / SQLiteWriter (UNCHANGED)        │    │
│  │  • Receives CanonicalCard[] — identical to file-based ETL path      │    │
│  │  • source + source_id dedup works normally                          │    │
│  │  • 100-card batched writes to sql.js                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### New Components (Swift)

| Component | Responsibility | Risk |
|-----------|----------------|------|
| `PermissionManager` | Check TCC Full Disk Access via probe read; surface System Preferences URL; report denial via `native:blocked` | LOW |
| `NativeImportAdapter` (protocol) | Contract for source-specific SQLite readers and card extractors | LOW |
| `NotesAdapter` | Read NoteStore.sqlite via sqlite3_deserialize; query ZICCLOUDSYNCINGOBJECT; optionally decompress gzip ZDATA blobs and parse protobuf body | HIGH (protobuf step) |
| `RemindersAdapter` | Read group container Reminders SQLite; join ZREMCDREMINDER + ZREMCDLIST; produce CanonicalCards | LOW |
| `CalendarAdapter` | Read Calendar.sqlitedb; join ZCALENDARITEM + ZCALENDAR; produce CanonicalCards | LOW |

### Modified Components (Swift — additive only)

| Component | Change | Scope |
|-----------|--------|-------|
| `BridgeManager` | Add case `"importNative"` in existing native:action dispatch switch; async task invokes PermissionManager + adapter + serialization | One new switch case (~40 lines) |
| `FeatureGate` | Add `.nativeImport` feature constant; assign to Pro tier | One new case in enum and isAllowed() |

### New Components (TypeScript)

| Component | Responsibility | Risk |
|-----------|----------------|------|
| `nativeImport.ts` Worker handler | Receive CanonicalCard[] from payload; call existing DedupEngine + SQLiteWriter pipeline; report result | LOW |
| `WorkerBridge.importNativeCards()` | Typed wrapper method sending `'etl:importNative'` Worker message | LOW |

### Modified Components (TypeScript — additive only)

| Component | Change | Scope |
|-----------|--------|-------|
| `NativeBridge.ts` receive() | Add `else if (payload.kind === 'importNative')` branch in native:action case | ~15 lines |
| `protocol.ts` WorkerRequestType | Add `'etl:importNative'` to union | 1 line |
| `MUTATING_TYPES` set in NativeBridge.ts | Add `'etl:importNative'` so mutation hook fires after import | 1 line |

### Unchanged Components (both sides)

- `ImportOrchestrator`, `DedupEngine`, `SQLiteWriter`, `CatalogWriter` — receive CanonicalCard[] arrays; do not know or care about origin
- `WorkerBridge` request/response envelope — correlation IDs, timeouts, error handling unchanged
- `DatabaseManager`, `AssetsSchemeHandler`, `SubscriptionManager` — no modifications
- All TypeScript views, providers, and state management — no modifications
- Existing `native:action` kinds (`importFile`, `cloudSave`, `exportData`) — no modifications
- Existing `native:blocked` message type — reused for permission denial (no new type)

---

## Data Flow: Swift SQLite Read to ImportOrchestrator

### Full pipeline step-by-step

```
1. User triggers import (macOS menu item / toolbar button)
                │
                ▼
2. BridgeManager dispatch: case "importNative" in native:action switch
   ├── guard FeatureGate.isAllowed(.nativeImport, for: currentTier)
   │    else: send native:blocked { feature: 'nativeImport', requiredTier: 'pro' }
   │
   └── Task { @MainActor in
         ├── PermissionManager.hasFullDiskAccess()
         │    else: send native:blocked { feature: 'fullDiskAccess' }
         │
         ├── let url = try adapter.databasePath()
         ├── let data = try await Task.detached { try Data(contentsOf: url) }.value
         └── let cards = try await Task.detached { try adapter.extractCards(from: data) }.value
       }
                │
                ▼
3. adapter.extractCards(from data: Data) → [[String: Any]]

   NotesAdapter:
     openInMemory(data) via sqlite3_deserialize
     → SELECT Z_PK, ZTITLE1, ZCREATIONDATE1, ZMODIFICATIONDATE1, folder.ZTITLE2
       FROM ZICCLOUDSYNCINGOBJECT n
       LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON f.Z_PK = n.ZFOLDER
       WHERE n.ZTYPEUTI1 = 'com.apple.notes.note'
         AND n.ZISPASSWORDPROTECTED = 0
         AND n.ZMARKEDFORDELETION = 0
     → (optional body) SELECT ZDATA FROM ZICNOTEDATA WHERE ZNOTE = Z_PK
       → Data(zdata).gunzip() → parseProtobuf() → plain text string
     → CanonicalCard dict: source="apple_notes", source_id=String(Z_PK)

   RemindersAdapter:
     openInMemory(data) via sqlite3_deserialize
     → SELECT r.*, l.ZNAME FROM ZREMCDREMINDER r
       LEFT JOIN ZREMCDLIST l ON l.Z_PK = r.ZLIST
     → map ZPRIORITY (1→5, 5→3, 9→1, 0→0), ZDUEDATE (Core Data epoch)
     → CanonicalCard dict: source="apple_reminders", source_id=String(Z_PK)

   CalendarAdapter:
     openInMemory(data) via sqlite3_deserialize
     → SELECT e.*, c.ZTITLE FROM ZCALENDARITEM e
       LEFT JOIN ZCALENDAR c ON c.Z_PK = e.ZCALENDAR
     → map ZSTARTDATE, ZENDDATE (Core Data epoch), ZLOCATION
     → CanonicalCard dict: source="apple_calendar", source_id=String(Z_PK)

                │
                ▼
4. BridgeManager serializes cards to JSON
   let jsonData = try JSONSerialization.data(withJSONObject: cards)
   let jsonString = String(data: jsonData, encoding: .utf8)!
   (JSONSerialization handles all escaping — no string interpolation of user data)

                │
                ▼
5. BridgeManager.evaluateJavaScript:
   window.__isometry.receive({
     type: 'native:action',
     payload: { kind: 'importNative', source: 'apple_notes', cards: [JSON array] }
   });

                │ WKWebView boundary
                ▼
6. NativeBridge.ts receive() — kind: 'importNative' branch
   const cards: CanonicalCard[] = payload.cards as CanonicalCard[]
   await bridge.importNativeCards(payload.source, cards)

                │
                ▼
7. WorkerBridge.importNativeCards() — sends 'etl:importNative' message
   { type: 'etl:importNative', payload: { source, cards } }

                │ postMessage (structured clone — JSON arrays clone efficiently)
                ▼
8. Worker 'etl:importNative' handler
   const { source, cards } = payload
   const dedup = new DedupEngine(db)
   const writer = new SQLiteWriter(db)
   const result = await dedup.process(cards, [])
   await writer.writeCards(result.toInsert)
   await writer.updateCards(result.toUpdate)
   respond(id, 'success', { inserted, updated, skipped, errors: [] })

                │
                ▼
9. WorkerBridge.importNativeCards() Promise resolves
   NativeBridge.ts logs result
   MUTATING_TYPES hook fires 'mutated' → BridgeManager marks isDirty
   (Optionally: dispatch ImportToast notification via WorkerNotification protocol)
```

---

## Recommended Project Structure

### New Swift files

```
native/Isometry/Isometry/
├── PermissionManager.swift          # TCC Full Disk Access probe + prompt
├── NativeImportAdapter.swift        # Protocol definition
├── adapters/
│   ├── NotesAdapter.swift           # NoteStore.sqlite reader (gzip+proto optional)
│   ├── RemindersAdapter.swift       # Reminders group container SQLite reader
│   └── CalendarAdapter.swift        # Calendar.sqlitedb reader
└── [all existing files unchanged]
```

### New/modified TypeScript files

```
src/worker/handlers/
└── nativeImport.ts                  # NEW: 'etl:importNative' Worker handler

src/worker/
├── protocol.ts                      # MODIFIED: add 'etl:importNative' to WorkerRequestType
└── WorkerBridge.ts                  # MODIFIED: add importNativeCards() method

src/native/
└── NativeBridge.ts                  # MODIFIED: add 'importNative' branch + MUTATING_TYPES entry
```

### XCTest additions

```
native/Isometry/IsometryTests/
├── PermissionManagerTests.swift     # TCC probe logic (mock FileManager)
├── adapters/
│   ├── NotesAdapterTests.swift      # Mock NoteStore.sqlite fixture
│   ├── RemindersAdapterTests.swift  # Mock Reminders fixture
│   └── CalendarAdapterTests.swift   # Mock Calendar fixture
└── BridgeManagerNativeImportTests.swift  # Integration: mockAdapter → JS JSON delivery
```

---

## Architectural Patterns

### Pattern 1: Existing native:action kind Discriminator (zero bridge changes)

The `native:action` message type already uses a `kind` string discriminator, explicitly designed for this extension pattern. The v2.0 decision log entry reads: "native:action kind discriminator — Extensible for future actions without new message types." Adding `kind: "importNative"` requires zero changes to the bridge envelope, registration, or protocol. Only a new switch case in each of the two dispatch locations (Swift and TypeScript).

```swift
// BridgeManager.swift — existing switch, new case only
switch kind {
case "importFile":
    // existing handler
case "importNative":
    let source = payload?["source"] as? String ?? ""
    Task { await handleNativeImport(source: source, requestId: requestId) }
default:
    logger.warning("Unknown native:action kind: \(kind)")
}
```

```typescript
// NativeBridge.ts — existing native:action case, new branch only
if (payload.kind === 'importFile') {
  handleNativeFileImport(bridge, payload)...
} else if (payload.kind === 'importNative') {
  handleNativeImport(bridge, payload)...
} else {
  console.warn('[NativeBridge] Unknown native:action kind:', payload.kind);
}
```

### Pattern 2: NativeImportAdapter Protocol

A Swift protocol with two responsibilities: locating the system database and transforming its rows to CanonicalCard JSON dictionaries. Each adapter is self-contained and independently unit-testable using fixture Data objects.

```swift
// NativeImportAdapter.swift
protocol NativeImportAdapter {
    var source: String { get }
    func databasePath() throws -> URL
    func extractCards(from data: Data) throws -> [[String: Any]]
}

// Concrete example: RemindersAdapter
struct RemindersAdapter: NativeImportAdapter {
    let source = "apple_reminders"

    func databasePath() throws -> URL {
        let base = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Group Containers/group.com.apple.reminders/Container_v1/Stores")
        let files = try FileManager.default.contentsOfDirectory(at: base,
            includingPropertiesForKeys: nil)
        guard let db = files.first(where: { $0.pathExtension == "sqlite" }) else {
            throw AdapterError.databaseNotFound(source)
        }
        return db
    }

    func extractCards(from data: Data) throws -> [[String: Any]] {
        let db = try openInMemory(data: data)
        defer { sqlite3_close(db) }
        // query ZREMCDREMINDER JOIN ZREMCDLIST, map to dicts
        return try queryReminders(db: db)
    }
}
```

### Pattern 3: In-Memory SQLite via sqlite3_deserialize

All adapters open the system database as an in-memory copy using `sqlite3_deserialize` (raw C API, no SPM dependency). This avoids WAL file locking conflicts with the running Notes/Reminders/Calendar processes.

```swift
// Shared helper used by all adapters
func openInMemory(data: Data) throws -> OpaquePointer {
    var db: OpaquePointer?
    guard sqlite3_open(":memory:", &db) == SQLITE_OK else {
        throw AdapterError.sqliteOpenFailed
    }
    let bytes = [UInt8](data)
    // SQLITE_DESERIALIZE_READONLY: prevents modifications to the in-memory copy
    let rc = sqlite3_deserialize(db, "main",
        UnsafeMutablePointer(mutating: bytes),
        Int64(bytes.count), Int64(bytes.count),
        UInt32(SQLITE_DESERIALIZE_READONLY))
    guard rc == SQLITE_OK else {
        sqlite3_close(db)
        throw AdapterError.deserializeFailed(rc)
    }
    return db!
}
```

`sqlite3_deserialize` is available iOS 15+ / macOS 12+ — both within the project's deployment targets.

### Pattern 4: Notes Protobuf — Two-Step Strategy

Apple Notes stores note body content in `ZICNOTEDATA.ZDATA` as gzip-compressed protobuf (confirmed by forensic research; undocumented Apple format, schema reverse-engineered by the `apple_cloud_notes_parser` project). Two viable implementation steps:

**Step 1 (MVP — title and metadata only, zero risk):**

```swift
// NotesAdapter — title only (ships first)
let query = """
    SELECT DISTINCT
        n.Z_PK,
        n.ZTITLE1,
        n.ZCREATIONDATE1,
        n.ZMODIFICATIONDATE1,
        n.ZISPASSWORDPROTECTED,
        f.ZTITLE2 AS folder_name
    FROM ZICCLOUDSYNCINGOBJECT n
    LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON f.Z_PK = n.ZFOLDER
    WHERE n.ZTYPEUTI1 = 'com.apple.notes.note'
      AND n.ZISPASSWORDPROTECTED = 0
      AND n.ZMARKEDFORDELETION = 0
"""
// No ZICNOTEDATA read — content field left nil
```

**Step 2 (body content, HIGH risk — build separately after Step 1 ships):**

```swift
// Add to NotesAdapter after Step 1 is validated
import Compression  // Apple's built-in compression framework — no SPM dependency

func decompressGzip(_ data: Data) throws -> Data {
    // data[0...2] should be 0x1F8B08 (gzip magic bytes)
    var decompressed = Data(count: data.count * 8)
    let written = decompressed.withUnsafeMutableBytes { destPtr in
        data.withUnsafeBytes { srcPtr in
            compression_decode_buffer(
                destPtr.baseAddress!.assumingMemoryBound(to: UInt8.self),
                decompressed.count,
                srcPtr.baseAddress!.assumingMemoryBound(to: UInt8.self) + 10, // skip gzip header
                data.count - 10,
                nil,
                COMPRESSION_ZLIB
            )
        }
    }
    guard written > 0 else { throw AdapterError.decompressionFailed }
    return decompressed.prefix(written)
}

// Protobuf parsing: requires swift-protobuf SPM + reverse-engineered .proto schema
// Reference: apple_cloud_notes_parser Ruby project for protobuf field numbers
```

The `NativeImportAdapter` protocol accommodates both steps — Step 2 simply populates the `content` field that Step 1 leaves nil.

### Pattern 5: PermissionManager — TCC Full Disk Access

macOS sandboxed apps cannot read `~/Library/Group Containers/group.com.apple.*` or `~/Library/Calendars/` without Full Disk Access. The check uses a filesystem probe (more reliable than TCC APIs which are private).

```swift
@MainActor
final class PermissionManager {
    static func hasFullDiskAccess() -> Bool {
        // ~/Library/Calendars is reliably TCC-gated on macOS 11+
        let path = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Calendars").path
        return FileManager.default.isReadableFile(atPath: path)
    }

    static func openSystemPreferences() {
        // Deep link to FDA pane — opens System Settings > Privacy & Security > Full Disk Access
        let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")!
        NSWorkspace.shared.open(url)
    }
}
```

When Full Disk Access is denied, BridgeManager sends the existing `native:blocked` message (no new message type):

```swift
// Reuse existing native:blocked path
let js = """
window.__isometry.receive({
  type: 'native:blocked',
  payload: { feature: 'nativeImport', requiredTier: 'fullDiskAccess' }
});
"""
Task { try? await webView?.evaluateJavaScript(js) }
```

The JS side already handles `native:blocked` — it can display a "Grant Full Disk Access" prompt instead of a tier upgrade prompt by checking the `requiredTier` field.

### Pattern 6: Async Adapter Execution (avoid main thread blocking)

BridgeManager is `@MainActor`. Database file reads (50–200MB for Notes) must not block the UI.

```swift
// In BridgeManager — all blocking I/O off main actor
private func handleNativeImport(source: String, requestId: String) async {
    guard PermissionManager.hasFullDiskAccess() else {
        sendPermissionDenied(requestId: requestId)
        return
    }

    let adapter: NativeImportAdapter
    switch source {
    case "notes":      adapter = NotesAdapter()
    case "reminders":  adapter = RemindersAdapter()
    case "calendar":   adapter = CalendarAdapter()
    default:
        logger.error("Unknown native import source: \(source)")
        return
    }

    do {
        let url = try adapter.databasePath()
        // Task.detached: runs off @MainActor on a background thread
        let data = try await Task.detached(priority: .userInitiated) {
            try Data(contentsOf: url)
        }.value
        let cards = try await Task.detached(priority: .userInitiated) {
            try adapter.extractCards(from: data)
        }.value

        await serializeAndSend(cards: cards, source: source)
    } catch {
        logger.error("Native import failed: \(error.localizedDescription)")
        await sendImportError(error: error.localizedDescription, requestId: requestId)
    }
}
```

---

## Integration Points with Existing Bridge

### Existing bridge — what does NOT change

| Message type | Direction | Status |
|---|---|---|
| `native:ready` | JS → Swift | Unchanged |
| `native:launch` | Swift → JS | Unchanged |
| `checkpoint` | JS → Swift | Unchanged |
| `mutated` | JS → Swift | Unchanged |
| `native:sync` | Swift → JS | Unchanged |
| `native:blocked` | Swift → JS | Reused for permission denial — no new type |
| `native:action` kind `importFile` | Swift → JS | Unchanged — file picker path unaffected |

### What changes (additive only)

| Change | Location | Size |
|--------|----------|------|
| New `case "importNative"` in BridgeManager switch | `BridgeManager.swift` | ~40 lines |
| New `handleNativeImport()` async method | `BridgeManager.swift` | ~50 lines |
| New case `.nativeImport` in FeatureGate | `FeatureGate.swift` | ~5 lines |
| New `else if (kind === 'importNative')` branch | `NativeBridge.ts` | ~15 lines |
| New `'etl:importNative'` in WorkerRequestType | `protocol.ts` | 1 line |
| New `importNativeCards()` method | `WorkerBridge.ts` | ~10 lines |
| New `nativeImport` case in Worker router | `handlers/index.ts` | ~5 lines |
| New `'etl:importNative'` in MUTATING_TYPES | `NativeBridge.ts` | 1 line |

---

## Build Order and Risk Stratification

Risk-first ordering: prototyping the highest-risk item (NotesAdapter with gzip+protobuf) early determines whether the full implementation is feasible before the lower-risk adapters are built.

### Phase A: Pipeline Foundation (build first — validates the full end-to-end flow)

**What:** `NativeImportAdapter` protocol + `PermissionManager` + BridgeManager extension + TypeScript `etl:importNative` Worker handler + WorkerBridge method + NativeBridge branch

**Why first:** Establishes the entire pipeline using a `MockAdapter` that returns 3 hardcoded CanonicalCards. Validates bridge wiring end-to-end. If the bridge is wrong, it fails here on a trivial case — not buried in adapter complexity.

**Deliverables:**
- `NativeImportAdapter.swift` protocol
- `PermissionManager.swift` with TCC probe
- `BridgeManager.swift` — new `importNative` kind case + `handleNativeImport()` method
- `NativeBridge.ts` — new `importNative` branch + `'etl:importNative'` in MUTATING_TYPES
- `protocol.ts` — add `'etl:importNative'` to WorkerRequestType
- `WorkerBridge.ts` — add `importNativeCards()` method
- `nativeImport.ts` — Worker handler calling DedupEngine + SQLiteWriter (unchanged)
- Integration test: MockAdapter 3 hardcoded cards → 3 cards inserted in sql.js db

### Phase B: NotesAdapter Strategy A (title only — HIGH risk item de-risked first)

**What:** `NotesAdapter` reading NoteStore.sqlite via `sqlite3_deserialize`, querying `ZICCLOUDSYNCINGOBJECT`, no protobuf, content field null

**Why second:** Notes is the highest-value source (users' primary writing app) AND contains the risky gzip+protobuf content format. Building title-only first gives a shippable adapter while the protobuf feasibility is assessed separately.

**Before committing — spike these questions using an actual NoteStore.sqlite copy:**
- Does `sqlite3_deserialize` work correctly on a WAL-mode NoteStore snapshot?
- Is `ZTYPEUTI1 = 'com.apple.notes.note'` correct on the target macOS version?
- Does `ZISPASSWORDPROTECTED = 0` correctly exclude locked notes?
- Is the `ZICCLOUDSYNCINGOBJECT` table present (introduced macOS Catalina, stable since)?

### Phase C: RemindersAdapter + CalendarAdapter (LOW risk, build in parallel after Phase A)

**What:** Standard Core Data SQLite reads. Schemas are well-understood and documented in `AppleAppsETL.md`.

**Reminders path:** `~/Library/Group Containers/group.com.apple.reminders/Container_v1/Stores/*.sqlite` — glob for first `.sqlite` file (UUID in filename varies per installation).

**Calendar path:** `~/Library/Calendars/Calendar.sqlitedb` — stable path.

**Core Data epoch:** Both use seconds since `Date(timeIntervalSinceReferenceDate: 0)` (2001-01-01) — use `Date(timeIntervalSinceReferenceDate: timestamp)` in Swift.

### Phase D: NotesAdapter Strategy B (gzip + protobuf body, HIGH risk — only after Phase B ships)

**What:** Decompress `ZICNOTEDATA.ZDATA` (gzip via `Compression` framework) + parse protobuf body for note content text

**Dependencies:** Protobuf schema from `apple_cloud_notes_parser` project. Optionally: `swift-protobuf` SPM package. Alternative: manual protobuf varint decoding for the specific fields needed (avoids SPM dependency, reduces attack surface).

**Risk:** Apple's protobuf format is undocumented and has changed across macOS versions. If field numbers change, body extraction fails silently (returns empty content) — Notes title data remains intact. Strategy A is the fallback.

---

## Source ID Strategy for Deduplication

The existing DedupEngine uses `source` + `source_id` for idempotent re-import. Native adapters must produce stable, collision-free source_ids:

| Adapter | `source` value | `source_id` strategy | Dedup behavior |
|---------|---------------|----------------------|----------------|
| NotesAdapter | `"apple_notes"` | `String(Z_PK)` from ZICCLOUDSYNCINGOBJECT | Re-import: skips existing notes by Z_PK |
| RemindersAdapter | `"apple_reminders"` | `String(Z_PK)` from ZREMCDREMINDER | Re-import: updates modified reminders |
| CalendarAdapter | `"apple_calendar"` | `String(Z_PK)` from ZCALENDARITEM | Re-import: updates modified events |

Z_PK values are stable within a device's local Core Data store. They may differ across devices after iCloud sync — acceptable, since the sql.js database is per-device (synced as a whole file via iCloud Documents).

---

## Anti-Patterns

### Anti-Pattern 1: Sending Binary Database Data Through the Bridge

**What people do:** Read the NoteStore.sqlite as `Data`, base64-encode it (~33% size increase), send through `evaluateJavaScript`, then parse it inside the Worker using a sql.js instance.

**Why it's wrong:** NoteStore.sqlite is 50–200MB on active installations. base64 pushes this to 65–260MB. `evaluateJavaScript` is synchronous from the WebKit perspective — passing 200MB through it blocks the main thread for multiple seconds. The Worker would then need Apple's Core Data schema knowledge to parse it — adding 200MB of opaque parsing complexity.

**Do this instead:** Parse in Swift. Produce CanonicalCard JSON (typically 1–5MB for thousands of notes). Send the JSON. The bridge was designed for JSON payloads, not multi-hundred-megabyte blobs.

### Anti-Pattern 2: Opening isometry.db from Swift Directly

**What people do:** Open the Isometry `isometry.db` from Swift using SQLite3 to write CanonicalCards natively, bypassing the bridge entirely.

**Why it's wrong:** Decision D-011 (the two-layer architecture) is permanent. The CLAUDE.md for the native shell states explicitly: "Swift does not query, parse, or understand the database." Opening `isometry.db` from Swift while sql.js holds it open in the Worker creates concurrent writer conflict and corrupts the WAL file.

**Do this instead:** All writes to `isometry.db` happen in the sql.js Worker. Swift produces CanonicalCard JSON; the Worker writes it. This is the architectural contract.

### Anti-Pattern 3: New Bridge Message Types per Adapter

**What people do:** Add `native:importNotes`, `native:importReminders`, `native:importCalendar` as distinct message types.

**Why it's wrong:** The 6-message bridge protocol is intentionally minimal. The CLAUDE.md for the native shell warns: "Do not add new bridge message types without an architectural review." The `native:action` kind discriminator is the established extension mechanism.

**Do this instead:** `native:action` with `kind: 'importNative'` and a `source` field. One new case in two switch statements.

### Anti-Pattern 4: Blocking the Main Thread on Database File Read

**What people do:** Call `Data(contentsOf: noteStoreURL)` directly inside `BridgeManager` (which is `@MainActor`), freezing the UI during file read.

**Why it's wrong:** NoteStore.sqlite can be 50–200MB. Reading 200MB synchronously on the main actor blocks all UI rendering and input processing for several seconds.

**Do this instead:** Use `Task.detached(priority: .userInitiated)` to push the file read and card extraction off the main actor. Await the result before continuing to the evaluateJavaScript call.

### Anti-Pattern 5: Sending CanonicalCards as base64 JSON

**What people do:** Base64-encode the JSON payload before sending through `evaluateJavaScript` because binary data requires base64 in the bridge.

**Why it's wrong:** Base64 is required ONLY for binary data (Uint8Array) passing through WKScriptMessageHandler. `evaluateJavaScript` delivers a JSON string directly — no encoding needed. Base64 would add 33% overhead and require a decode step on the JS side.

**Do this instead:** Use `JSONSerialization.data(withJSONObject: cards)` + `String(data:encoding:.utf8)` and embed the raw JSON string in the JavaScript snippet. `JSONSerialization` handles all escaping for quotes, newlines, and special characters safely.

---

## Scaling Considerations

| Note count | NoteStore.sqlite | extractCards() | JSON payload | Worker DedupEngine |
|-----------|-----------------|----------------|--------------|-------------------|
| 1K notes | ~5MB | <100ms | ~500KB | <200ms |
| 10K notes | ~50MB | ~1s | ~5MB | ~1s |
| 50K notes | ~500MB | ~10s | ~50MB | ~5s |

The 50K case approaches the practical limit for `evaluateJavaScript` payload size (~50MB) and may require batching. For the MVP, 10K notes (most users) completes end-to-end in under 5 seconds — acceptable for an explicit user-triggered import action.

**Batching strategy for large imports:** If payload exceeds 10MB, split CanonicalCard[] into 1K-card batches. Each batch is a separate `importNativeCards()` call. The Worker's DedupEngine handles each batch independently; source_id deduplication ensures consistency across batches.

---

## Sources

- `native/Isometry/CLAUDE.md` — canonical native shell architecture constraints; D-011 two-layer permanence; 6-message bridge protocol; "do not add new message types" directive
- `native/Isometry/Isometry/BridgeManager.swift` — existing switch dispatch pattern; `sendFileImport()` as reference for Swift → JS native:action delivery; `@MainActor` constraint confirmed
- `src/native/NativeBridge.ts` — existing `native:action` kind dispatch; `MUTATING_TYPES` set; `handleNativeFileImport()` as reference pattern
- `v5/Modules/NativeShell.md` — `importAppleApp` kind already specced in NativeActionRequest union; bridge contract definition
- `v5/Modules/AppleAppsETL.md` — source schemas for Reminders (ZREMCDREMINDER + ZREMCDLIST), Calendar (ZCALENDARITEM + ZCALENDAR); Core Data timestamp handling; database paths; parser implementation patterns
- `v5/Modules/ExtendedAppleAppsETL.md` — extended Apple app schemas for Mail, Messages, Photos
- `.planning/PROJECT.md` — v4.0 requirements list; NativeImportAdapter protocol requirement; CanonicalCard[] as integration seam (validated v1.1)
- [apple_cloud_notes_parser (GitHub)](https://github.com/threeplanetssoftware/apple_cloud_notes_parser) — Ruby reference implementation; reverse-engineered protobuf schema for ZICNOTEDATA.ZDATA; confirms gzip+protobuf structure (MEDIUM confidence — undocumented Apple format)
- [Ciofeca Forensics: Revisiting Apple Notes](https://ciofecaforensics.com/2020/01/13/apple-notes-revisited-easy-embedded-objects/) — ZICNOTEDATA.ZDATA confirmed as gzip+protobuf; `0x1F8B08` gzip magic bytes; Unicode object replacement character in protobuf text (MEDIUM confidence)
- [swiftforensics.com: Reading Notes database on macOS](http://www.swiftforensics.com/2018/02/reading-notes-database-on-macos.html) — ZICCLOUDSYNCINGOBJECT table structure; ZTITLE1, ZTYPEUTI1 field names (LOW confidence — 2018 article, verify field names against current macOS version)
- [GitHub: ChrLipp/notes-import](https://github.com/ChrLipp/notes-import) — alternative Notes parser confirming ZICCLOUDSYNCINGOBJECT approach (MEDIUM confidence)
- [GitHub gist: 0xdevalias — Apple Reminders data on macOS](https://gist.github.com/0xdevalias/ccc2b083ff58b52aa701462f2cfb3cc8) — ZREMCDREMINDER table access, ZCKIDENTIFIER/ZTITLE fields confirmed (MEDIUM confidence)
- SQLite `sqlite3_deserialize` official documentation — in-memory database from Data blob; `SQLITE_DESERIALIZE_READONLY` flag; availability iOS 15+ / macOS 12+ (HIGH confidence)
- Apple Compression framework documentation — `compression_decode_buffer`, `COMPRESSION_ZLIB` algorithm for gzip decompression; no SPM dependency required (HIGH confidence — official Apple docs)

---

*Architecture research for: v4.0 Native ETL — Swift SQLite adapters for Apple Notes, Reminders, Calendar*
*Researched: 2026-03-05*
