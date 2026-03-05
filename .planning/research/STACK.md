# Stack Research — v4.0 Native ETL: macOS System SQLite Importers

**Domain:** macOS-native SQLite reading for Apple Notes, Reminders, and Calendar with protobuf content extraction, TCC permissions, and WKWebView bridge integration
**Researched:** 2026-03-05
**Confidence:** HIGH for Reminders/Calendar via EventKit; MEDIUM for Notes protobuf field extraction (reverse-engineered schema, no official Apple API); HIGH for compression, SQLite access patterns, and bridge integration

---

## Context: Locked Existing Stack (Do Not Re-Research)

These are validated and final. No changes permitted:

| Technology | Version | Status |
|------------|---------|--------|
| Swift | iOS 17+ / macOS 14+ | Locked |
| SwiftUI | iOS 17 / macOS 14 | Locked |
| WKWebView + WKURLSchemeHandler | iOS 17 / macOS 14 | Locked |
| Bridge protocol | 5 message types (LaunchPayload, checkpoint, mutated, native:action, sync) | Locked |
| native:action kind discriminator | Extensible for future actions (importFile established) | Locked |
| DatabaseManager actor | Atomic .tmp/.bak/.db rotation | Locked |
| JSONSerialization for bridge payloads | Handles special chars safely | Locked |
| StoreKit 2 / FeatureGate | Free/Pro/Workbench tiers | Locked |

**This document covers ONLY what is needed for the 3 new native SQLite adapters.**

---

## Conclusion Up Front

The stack additions for v4.0 are minimal but deliberate:

1. **GRDB.swift 7.x** — read-only access to system SQLite databases with WAL-safe open and proper immutable URI flag
2. **apple/swift-protobuf 1.35.x** — decode gzip-compressed protobuf blobs from `NoteStore.sqlite`; requires `.proto` schema generated from community-reverse-engineered definitions
3. **EventKit** (system framework, zero dependency) — the ONLY correct path for Reminders and Calendar on App Store builds; direct SQLite reading is NOT possible for sandboxed apps distributing via Mac App Store
4. **Foundation Compression** (built-in, zero dependency) — `NSData.decompress(using:)` for gzip decompression of Notes `ZDATA` blobs; available macOS 10.15+; no third-party library needed
5. **Zero new npm dependencies** — all 3 adapters output `CanonicalCard[]` JSON through the existing `native:action` bridge message; TypeScript ImportOrchestrator is unchanged

---

## Recommended Stack

### New Swift Dependencies (SPM)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| GRDB.swift | 7.10.0 | Read-only access to NoteStore.sqlite with WAL-safe immutable URI | Best-in-class Swift SQLite toolkit; WAL-mode system databases need the `?immutable=1` URI pattern that raw SQLite3 C API usage would require manually; GRDB handles connection lifecycle, Swift 6 actor isolation, and Task cancellation correctly; read-only config built-in |
| apple/swift-protobuf | 1.35.1 | Decode gzip-decompressed protobuf blobs from NoteStore.sqlite ZDATA | Official Apple-maintained Swift protobuf runtime; required to decode the `Note.note_text` field (field 2) from Notes' reverse-engineered `.proto`; generates type-safe Swift from `.proto` files; Swift 6 compatible |

### System Frameworks (Zero New Dependencies)

| Framework | Purpose | Why Not a Third Party |
|-----------|---------|----------------------|
| EventKit | Reminders (EKReminder) + Calendar (EKEvent) read access | Official Apple framework; the ONLY option for App Store sandboxed apps — direct SQLite access to Reminders/Calendar databases requires Full Disk Access which is unavailable to Mac App Store sandboxed apps; EventKit handles permission prompt, access revocation, and schema stability across OS versions |
| Foundation (NSData.decompress) | Gzip decompress NoteStore.sqlite ZDATA blobs | `NSData.decompress(using: .zlib)` available macOS 10.15+; handles gzip via the `.zlib` algorithm constant (Foundation uses `.zlib` to mean the gzip wrapper format in this context); zero bundle cost, zero dependency |
| SQLite3 (via GRDB) | Notes NoteStore.sqlite reading | GRDB wraps the system-supplied libsqlite3.dylib; no second SQLite copy added to binary |

### Protobuf Schema Files (Generated, Not Runtime)

| File | Purpose | Source |
|------|---------|--------|
| `notestore.proto` (generated .pb.swift) | Type-safe Swift struct for Notes protobuf message hierarchy | Community-reverse-engineered by threeplanetssoftware/apple_cloud_notes_parser; field 2 of Note message is `note_text` (the plaintext); generated once, checked into source |

---

## Database Locations and Schema

### Apple Notes — NoteStore.sqlite

**Path:** `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`

**Access method:** GRDB read-only with `?immutable=1` URI flag (WAL files present while Notes is open)

**Key tables:**

| Table | Purpose |
|-------|---------|
| ZICCLOUDSYNCINGOBJECT | Note metadata: title (ZTITLE2), folder (ZFOLDER), creation/modification dates (ZCREATIONDATE3, ZMODIFICATIONDATE1), UUID (ZIDENTIFIER), note data FK (ZNOTEDATA) |
| ZICNOTEDATA | Note content: Z_PK (joined from ZNOTEDATA), ZDATA (gzip-compressed protobuf blob) |

**Content extraction pipeline:**

```
ZICNOTEDATA.ZDATA
  → NSData.decompress(using: .zlib)  // gzip decompression
  → Data blob (raw protobuf)
  → NoteStoreProto.init(serializedBytes:)  // swift-protobuf
  → note.document.note.noteText  // field path: root → Document (field 2) → Note (field 3) → note_text (field 2)
```

**Core Data date offset:** Dates stored as seconds since 2001-01-01 (Core Data epoch). Convert: `Date(timeIntervalSinceReferenceDate: zDate)`

**SQL query for note index:**
```sql
SELECT
  obj.ZIDENTIFIER,
  obj.ZTITLE2,
  obj.ZCREATIONDATE3,
  obj.ZMODIFICATIONDATE1,
  obj.ZFOLDER,
  nd.ZDATA
FROM ZICCLOUDSYNCINGOBJECT obj
JOIN ZICNOTEDATA nd ON nd.Z_PK = obj.ZNOTEDATA
WHERE obj.ZNOTEDATA IS NOT NULL
  AND obj.ZMARKEDFORDELETION = 0
ORDER BY obj.ZMODIFICATIONDATE1 DESC
```

**Schema version detection:** Query `SELECT Z_VERSION FROM Z_METADATA` to detect the Notes schema version before issuing queries. Known stable fields (ZIDENTIFIER, ZTITLE2, ZNOTEDATA) are consistent across macOS 12–15. Column name changes between major versions are detectable via `PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)`.

### Apple Reminders — EventKit Only

**Why NOT direct SQLite:** The Reminders database is at `~/Library/Reminders/Container_v1/Stores/Data-[UUID].sqlite`. This path requires Full Disk Access. Full Disk Access is unavailable to App Store sandboxed apps — no entitlement grants it. Direct SQLite reading is also explicitly discouraged by Apple: "the location and format of that database is not considered API." EventKit is mandatory.

**EventKit access pattern:**
```swift
let store = EKEventStore()
let granted = try await store.requestFullAccessToReminders()  // macOS 14+ async API
guard granted else { throw NativeImportError.permissionDenied }
let predicate = store.predicateForReminders(in: nil)
let reminders: [EKReminder] = await withCheckedContinuation { continuation in
    store.fetchReminders(matching: predicate) { continuation.resume(returning: $0 ?? []) }
}
```

**Field mapping to CanonicalCard:**

| EKReminder property | CanonicalCard field |
|---------------------|---------------------|
| title | name |
| notes | content |
| dueDateComponents → Date | due_date |
| isCompleted | status ("done" / "pending") |
| priority (0–9) | priority |
| calendar.title | folder |
| calendarItemIdentifier | source_id |

### Apple Calendar — EventKit Only

**Why NOT direct SQLite:** The Calendar database is at `~/Library/Group Containers/group.com.apple.calendar/`. Access requires Full Disk Access — same App Store restriction as Reminders. Schema has changed across macOS versions (modern path uses `Calendar.sqlite.db`, older path used `Calendar Cache`). EventKit is mandatory.

**EventKit access pattern:**
```swift
let store = EKEventStore()
let granted = try await store.requestFullAccessToEvents()  // macOS 14+ async API
guard granted else { throw NativeImportError.permissionDenied }
let calendars = store.calendars(for: .event)
let start = Calendar.current.date(byAdding: .year, value: -2, to: Date())!
let end = Calendar.current.date(byAdding: .year, value: 1, to: Date())!
let predicate = store.predicateForEvents(withStart: start, end: end, calendars: calendars)
let events = store.events(matching: predicate)
```

**Field mapping to CanonicalCard:**

| EKEvent property | CanonicalCard field |
|------------------|---------------------|
| title | name |
| notes | content |
| startDate | due_date (ISO 8601 string) |
| endDate | tags (appended as "ends:DATE") |
| isAllDay | tags (appended as "all-day") |
| calendar.title | folder |
| calendarItemIdentifier | source_id |
| location | tags (appended as "location:VALUE") |

---

## TCC / Permission Architecture

### Mandatory Understanding

macOS TCC (Transparency, Consent, Control) governs access to protected system resources. For v4.0:

| Source | Permission Required | Available to App Store Sandbox? | Path |
|--------|--------------------|---------------------------------|------|
| Apple Notes | Full Disk Access (reads `~/Library/Group Containers/...`) | NO for App Store; YES for direct distribution | Direct SQLite via GRDB + NSOpenPanel fallback |
| Reminders | Reminders access via EventKit | YES — entitlement `com.apple.reminders` | EventKit (only option) |
| Calendar | Calendar access via EventKit | YES — entitlement `com.apple.calendars` | EventKit (only option) |

### Notes Access Strategy (Two-Path Architecture)

Notes requires Full Disk Access — not grantable via entitlement on Mac App Store. The adapter must support two paths:

**Path A: Full Disk Access granted (direct distribution)**
```swift
let notesDBPath = FileManager.default
    .homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Group Containers/group.com.apple.notes/NoteStore.sqlite")
// Open read-only with GRDB immutable URI
```

**Path B: User manually selects NoteStore.sqlite (App Store / no FDA)**
```swift
// NSOpenPanel presented to user targeting ~/Library/Group Containers/group.com.apple.notes/
// Stores security-scoped bookmark via existing Keychain integration
// User must close Notes.app before selecting (WAL files will be absent)
```

**Detection (not via TCC.db — that itself requires FDA):**
```swift
func hasNotesAccess() -> Bool {
    let path = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Group Containers/group.com.apple.notes/NoteStore.sqlite")
    return FileManager.default.isReadableFile(atPath: path.path)
}
// If returns false: present NSOpenPanel for manual selection
// If returns true: open directly with GRDB
```

Apple's recommendation for permission checking: "attempt the operation you need and handle errors" — do not query TCC.db (requires FDA itself). The `isReadableFile` probe is the correct lightweight check.

### WAL File Handling

NoteStore.sqlite uses WAL mode. The `-shm` and `-wal` companion files are present while Notes.app is open. Opening with `?immutable=1` URI flag tells SQLite to skip WAL recovery — safe for read-only access but means in-flight uncommitted Notes changes are not visible. This is acceptable for an import adapter (consistent snapshot semantics).

If the user has Notes open during import, the adapter reads the last committed checkpoint state. This is correct behavior — do not block on Notes being closed.

GRDB read-only with immutable flag:
```swift
var config = Configuration()
config.readonly = true
let immutablePath = notesDBURL.absoluteString + "?immutable=1"
let dbQueue = try DatabaseQueue(path: immutablePath, configuration: config)
```

### Required Info.plist Keys

```xml
<!-- Reminders access -->
<key>NSRemindersUsageDescription</key>
<string>Isometry imports your reminders as cards for PAFV projection.</string>

<!-- Calendar access -->
<key>NSCalendarsFullAccessUsageDescription</key>
<string>Isometry imports your calendar events as cards for PAFV projection.</string>

<!-- Notes (for NSOpenPanel path — no dedicated TCC key; FDA is user-granted in System Settings) -->
<!-- No plist key required for Notes; FDA is system-level user action -->
```

### Required Entitlements

```xml
<!-- Reminders (EventKit) -->
<key>com.apple.reminders</key>
<true/>

<!-- Calendar (EventKit) -->
<key>com.apple.calendars</key>
<true/>

<!-- Notes: Full Disk Access is NOT an entitlement key for App Store builds -->
<!-- Direct distribution only: no entitlement key needed; user grants in System Settings > Privacy & Security > Full Disk Access -->
```

---

## Bridge Integration

### Existing Bridge Pattern (Unchanged)

The existing `native:action` message type with `kind` discriminator handles native-to-JS payloads. v4.0 adds 3 new kind values following the established pattern:

```swift
// Swift side — existing pattern, new kinds:
let payload: [String: Any] = [
    "kind": "importNotes",          // or "importReminders", "importCalendar"
    "cards": canonicalCardsArray,   // [CanonicalCard] serialized as [String: Any]
    "source": "apple-notes",
    "runId": UUID().uuidString
]
let jsonData = try JSONSerialization.data(withJSONObject: payload)
let jsonString = String(data: jsonData, encoding: .utf8)!
webView.evaluateJavaScript("window.__bridge.receiveNativeAction(\(jsonString))")
```

The TypeScript `ImportOrchestrator` already handles `native:action` messages and routes `importFile` payloads to DedupEngine → SQLiteWriter → CatalogWriter. The 3 new kinds (`importNotes`, `importReminders`, `importCalendar`) follow the same routing. No TypeScript changes to the bridge protocol are needed — the ImportOrchestrator already accepts arbitrary canonical card arrays.

### CanonicalCard Fields Used by Native Adapters

| Field | Notes | Reminders | Calendar |
|-------|-------|-----------|----------|
| id | UUID().uuidString | UUID().uuidString | UUID().uuidString |
| name | ZTITLE2 | title | title |
| content | protobuf note_text | notes | notes |
| folder | parent folder name | calendar.title | calendar.title |
| source | "apple-notes" | "apple-reminders" | "apple-calendar" |
| source_id | ZIDENTIFIER | calendarItemIdentifier | calendarItemIdentifier |
| created_at | ZCREATIONDATE3 → ISO 8601 | creationDate → ISO 8601 | creationDate → ISO 8601 |
| updated_at | ZMODIFICATIONDATE1 → ISO 8601 | lastModifiedDate → ISO 8601 | lastModifiedDate → ISO 8601 |
| due_date | nil | dueDateComponents → ISO 8601 | startDate → ISO 8601 |
| status | nil | isCompleted ? "done" : "pending" | nil |
| priority | nil | priority (0–9 → "low"/"medium"/"high") | nil |
| tags | nil | hashtags from notes | isAllDay, location |

---

## NativeImportAdapter Protocol

The protocol that all 3 adapters conform to:

```swift
protocol NativeImportAdapter {
    var sourceName: String { get }
    func checkAccess() async -> Bool
    func requestAccess() async -> Bool
    func importCards(progress: @escaping (Double) -> Void) async throws -> [CanonicalCard]
}

struct CanonicalCard: Codable {
    let id: String
    let name: String
    let content: String?
    let folder: String?
    let source: String
    let source_id: String
    let created_at: String?
    let updated_at: String?
    let due_date: String?
    let status: String?
    let priority: String?
    let tags: [String]?
}
```

Adapters:
- `NotesAdapter: NativeImportAdapter` — GRDB + swift-protobuf + Foundation gzip
- `RemindersAdapter: NativeImportAdapter` — EventKit only
- `CalendarAdapter: NativeImportAdapter` — EventKit only

---

## Installation

```swift
// Package.swift additions — ONLY these two new dependencies:
dependencies: [
    // Existing (do not change):
    // ... (no existing Swift Package dependencies in v2.0/v3.0 native stack)

    // NEW for v4.0:
    .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.10.0"),
    .package(url: "https://github.com/apple/swift-protobuf.git", from: "1.35.1"),
],
targets: [
    .target(
        name: "Isometry",
        dependencies: [
            .product(name: "GRDB", package: "GRDB.swift"),
            .product(name: "SwiftProtobuf", package: "swift-protobuf"),
        ]
    )
]
```

**proto file generation (one-time, not in build pipeline):**
```bash
# Install protoc + swift-protobuf plugin
brew install protobuf swift-protobuf

# Generate Swift from reverse-engineered Notes proto (check into repo)
protoc --swift_out=Sources/NativeETL/ notestore.proto
```

The generated `.pb.swift` file is checked into the repo. The `protoc` step does NOT run as part of CI/CD — it's a one-time generation from the community `.proto` file checked into `Sources/NativeETL/proto/`.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| GRDB.swift for Notes SQLite | Raw SQLite3 C API | GRDB provides Swift actor isolation, Task cancellation via Swift 6 concurrency, type-safe query results, and correct `?immutable=1` URI handling. Raw C API requires manual unsafe pointer management and does not integrate with Swift concurrency. The "boring stack wins" principle applies: GRDB is the clear community standard for Swift SQLite access. |
| GRDB.swift for Notes SQLite | SQLite.swift | GRDB 7.x outperforms SQLite.swift in benchmarks (GRDB wiki performance data). GRDB is more actively maintained (7.10.0 Feb 2026 vs SQLite.swift 0.15.3). For read-only system database access, either works, but GRDB's `Configuration.readonly = true` + immutable URI pattern is better documented for WAL-mode databases. |
| EventKit for Reminders/Calendar | Direct SQLite reads of Reminders/Calendar databases | Full Disk Access is not available to Mac App Store sandboxed apps. Apple explicitly states the Reminders database schema/location is not API-stable. EventKit is the required path for any distributable app. |
| Foundation NSData.decompress for gzip | GzipSwift / DataCompression | Foundation's `NSData.decompress(using: .zlib)` handles the Notes gzip format (macOS 10.15+) with zero additional dependency. GzipSwift and DataCompression are wrappers around the same system zlib. "Boring stack wins" — no new dependency for what the system already provides. |
| apple/swift-protobuf for protobuf decoding | Manual protobuf varint parsing | Manual parsing of Notes protobuf fields is ~200+ lines of bit-twiddling code. swift-protobuf + generated `.pb.swift` from the community `.proto` schema produces type-safe, maintainable code. The `.proto` schema is a one-time checked-in artifact; the dependency cost (swift-protobuf runtime) is justified. |
| apple/swift-protobuf for protobuf decoding | AppleNotes JavaScript parser in existing ETL pipeline | The existing Apple Notes parser in the ETL pipeline reads the alto-index Markdown format exported via Share Sheet — it does NOT read raw NoteStore.sqlite protobuf directly. These are different code paths. |
| NativeImportAdapter protocol | Direct SwiftUI view calling GRDB/EventKit inline | Protocol provides testable, mockable boundary. XCTest for `NotesAdapter` can inject a mock GRDB connection. `RemindersAdapter` can be mocked without EventKit sandbox permission during tests. Same pattern as DatabaseManager actor — isolate I/O behind a protocol. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Direct Reminders SQLite (~/Library/Reminders/) | Requires Full Disk Access — unavailable to Mac App Store sandboxed apps. Apple explicitly states the schema is not API. Will break on OS updates. | EventKit (EKReminder) |
| Direct Calendar SQLite (~/Library/Group Containers/group.com.apple.calendar/) | Same as Reminders — Full Disk Access required, schema not API, path varies by macOS version. | EventKit (EKEvent) |
| PermissionsKit or FullDiskAccess Swift packages | Third-party TCC probing libraries. The `isReadableFile` probe against the Notes database path is sufficient — adding a dependency for this is wasteful. PermissionsKit also uses internal TCC.db reads which themselves require FDA. | `FileManager.isReadableFile(atPath:)` probe |
| SwiftData for reading system databases | SwiftData manages its own schema and container — it cannot open arbitrary third-party SQLite databases like NoteStore.sqlite. | GRDB (read-only) |
| Core Data for reading Notes/Reminders | Core Data cannot open system app databases. The entity classes, model versions, and container identifiers are all private to those apps. | GRDB (Notes) / EventKit (Reminders/Calendar) |
| alexeyxo/protobuf-swift | Third-party protobuf runtime, unmaintained relative to Apple's swift-protobuf. Last meaningful update 2019. | apple/swift-protobuf |
| GzipSwift / DataCompression / GZIP | Additional SPM dependency for gzip that Foundation already provides via `NSData.decompress(using:)`. | Foundation NSData.decompress |
| Async Notes text extraction (per-note protobuf decode on main actor) | Protobuf decode + gzip decompress for large note vaults (1,000+ notes) will block the main thread for seconds. | Swift actor or Task.detached for bulk decode |
| Hardcoded NoteStore.sqlite column names without schema version check | Notes schema changes between major macOS versions. ZTITLE2 was added; ZTITLE1 exists on older versions. | `PRAGMA table_info()` version detection + conditional column selection |

---

## Stack Patterns by Variant

**If app is distributed via Mac App Store:**
- Notes: present NSOpenPanel for user to manually select NoteStore.sqlite; store security-scoped bookmark
- Reminders: EventKit only
- Calendar: EventKit only
- No Full Disk Access pathway available

**If app is directly distributed (outside App Store):**
- Notes: attempt direct read of `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`; fall back to NSOpenPanel if `isReadableFile` returns false (user hasn't granted FDA in System Settings)
- Reminders: EventKit (still required — direct SQLite not worth the fragility even with FDA)
- Calendar: EventKit (same reasoning)

**If Notes.app is open during import:**
- Open NoteStore.sqlite with `?immutable=1` to read last committed checkpoint
- Do NOT close Notes.app or wait — immutable mode provides consistent read without requiring WAL checkpoint

**For schema version detection (all macOS 12–15 targets):**
- Query `PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)` before issuing queries
- Use column `ZTITLE2` if present (macOS 12+), fall back to `ZTITLE1`
- This runtime detection covers schema drift across OS versions without hardcoding version numbers

---

## Version Compatibility

| Component | Requirement | Notes |
|-----------|-------------|-------|
| GRDB.swift 7.10.0 | macOS 10.15+, Swift 6.1+, Xcode 16.3+ | Well within project targets (macOS 14+, Swift 6) |
| apple/swift-protobuf 1.35.1 | Swift 6.0+ (or Swift 5.10 with Xcode 15.3+) | Compatible with project Swift 6 toolchain |
| EventKit (requestFullAccessToReminders/Events) | macOS 14+ — new async API in TN3153 | Replaces completion-handler API deprecated in macOS 14; project target is macOS 14+, so new API is safe |
| Foundation NSData.decompress | macOS 10.15+ | Available on all project targets |
| NoteStore.sqlite gzip+protobuf format | macOS 12–15 confirmed, likely macOS 16 | Format stable since iOS 9 / macOS 10.11 (confirmed by apple_cloud_notes_parser active maintenance through 2024) |
| ZICCLOUDSYNCINGOBJECT schema | ZTITLE2 present on macOS 12+ | Detect at runtime via `PRAGMA table_info` |
| Core Data epoch offset | January 1, 2001 = timeIntervalSinceReferenceDate = 0 | All Notes/Reminders/Calendar dates use this reference; `Date(timeIntervalSinceReferenceDate:)` converts correctly |
| Calendar CalendarItem date encoding | `+31 years` offset = Core Data epoch (stored as seconds since 2001-01-01 in Calendar SQLite) | Only relevant if Calendar SQLite is accessed directly (not via EventKit); EventKit returns proper Swift `Date` objects |

---

## Sources

- [GRDB.swift GitHub](https://github.com/groue/GRDB.swift) — WAL-mode read-only access pattern with `?immutable=1` URI; Swift 6 concurrency integration; version 7.10.0 confirmed; macOS 10.15+ / iOS 13+ requirement confirmed — MEDIUM confidence (WebSearch verified against Swift Forums GRDB 7 announcement)
- [GRDB Swift Forums — open read-only](https://forums.swift.org/t/open-database-read-only/36314) — `Configuration.readonly = true` + `?immutable=1` URI flag pattern for WAL databases; confirmed applicable to system SQLite databases — HIGH confidence (official forum)
- [apple/swift-protobuf GitHub releases](https://github.com/apple/swift-protobuf/releases) — version 1.35.1 (February 2025) confirmed; Swift 6.0+ required — HIGH confidence (official Apple repo)
- [threeplanetssoftware/apple_cloud_notes_parser](https://github.com/threeplanetssoftware/apple_cloud_notes_parser) — community gold standard for NoteStore.sqlite schema and Notes protobuf message structure; maintained through 2024 (debug logs dated 2024-05-04); provides `notestore.proto` with reverse-engineered field structure — MEDIUM confidence (community reverse-engineering, not official Apple API)
- [Ciofeca Forensics — Notes Revisited Protobuf](https://ciofecaforensics.com/2020/09/18/apple-notes-revisited-protobuf/) — `note_text` field at position 2 in Note message; `NoteStoreProto → Document (field 2) → Note (field 3) → note_text (field 2)` hierarchy confirmed — MEDIUM confidence (forensic analysis, stable across macOS 12–15 based on ongoing tool maintenance)
- [Yogesh Khatri's forensic blog — Reading Notes database on macOS](http://www.swiftforensics.com/2018/02/reading-notes-database-on-macos.html) — ZICNOTEDATA.ZDATA gzip-compressed protobuf; ZICCLOUDSYNCINGOBJECT schema; NoteStore.sqlite path `~/Library/Group Containers/group.com.apple.notes/` confirmed — MEDIUM confidence (forensic, dated 2018 but format stable)
- [Apple Developer Forums — reliable Full Disk Access test](https://developer.apple.com/forums/thread/114452) — `FileManager.isReadableFile` probe as recommended permission detection approach; official Apple advice: "attempt the operation and handle errors" — HIGH confidence (official Apple Developer Forums)
- [Apple Developer Forums — Full Disk Access not available for sandboxed apps](https://developer.apple.com/forums/thread/124895) — Full Disk Access is unavailable as an entitlement for Mac App Store sandboxed apps; confirmed by multiple Apple engineers — HIGH confidence (official Apple Developer Forums, corroborated by multiple sources)
- [Apple Developer Documentation — TN3153 EventKit changes macOS 14](https://developer.apple.com/documentation/technotes/tn3153-adopting-api-changes-for-eventkit-in-ios-macos-and-watchos) — `requestFullAccessToReminders()` and `requestFullAccessToEvents()` async APIs on macOS 14+; replaces completion handler APIs deprecated in macOS 14 — HIGH confidence (official Apple TN)
- [Apple Developer Documentation — EKEventStore](https://developer.apple.com/documentation/eventkit/ekeventstore) — `fetchReminders(matching:completion:)` is not async-native; requires `withCheckedContinuation` wrapper; `predicateForReminders(in:)` and `predicateForEvents(withStart:end:calendars:)` confirmed — HIGH confidence (official Apple docs)
- [0xdevalias Reminders gist](https://gist.github.com/0xdevalias/ccc2b083ff58b52aa701462f2cfb3cc8) — ZREMCDREMINDER table, ZTITLE, ZCOMPLETED, ZNOTES column names; UUID-named .sqlite path pattern in `~/Library/Reminders/Container_v1/Stores/` — MEDIUM confidence (community research, corroborates EventKit necessity)
- [Calendar SQLite gist](https://gist.github.com/tom-juntunen/eb40a747510e601bef58ec29ee163896) — `Calendar.sqlitedb` path, CalendarItem table, Core Data epoch `+31 years` offset; confirms direct SQLite viable with FDA but fragile across OS versions — MEDIUM confidence (community gist, confirms EventKit preference)
- Isometry PROJECT.md — v4.0 requirements confirmed: NativeImportAdapter protocol, NoteStore.sqlite gzip+protobuf, TCC/FDA flow, CanonicalCard bridge output

---

## Open Questions (Phase Research Flags)

- **Notes protobuf stability on macOS 15 (Sequoia):** The `note_text` field at position 2 in the Note message has been stable since iOS 9. Confirmed maintained through 2024. If macOS 15 introduced a new protobuf schema version, the generated `.pb.swift` may need regeneration. **Flag for Phase 1 kickoff: test against macOS 15 NoteStore.sqlite before implementation.**
- **Notes attachment extraction:** The `NativeImportAdapter` spec in PROJECT.md covers text content only. Embedded images/drawings in notes are stored in separate ZICCLOUDSYNCINGOBJECT rows with `ZATTACHMENT1` references. Not in scope for v4.0 (PROJECT.md "Base64 attachment binary storage — OOM risk — metadata only"). The implementation should strip attachment placeholder characters (Unicode 0xFFFC) from note_text output.
- **Reminders subtasks (nested reminders):** EKReminder does not expose subtask hierarchy directly. macOS 15 added subtasks to the Reminders app UI. EventKit does not yet expose this via `EKReminder`. CanonicalCard connections (parent/child via `via_card_id`) could model this but the API does not surface the data. Accept flat import for now; connections not creatable without subtask data.

---

*Stack research for: Isometry v4.0 Native ETL — macOS system SQLite importers (Notes, Reminders, Calendar)*
*Researched: 2026-03-05*
