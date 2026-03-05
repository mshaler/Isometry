# Pitfalls Research

**Domain:** Native macOS SQLite readers for Apple Notes, Reminders, and Calendar — adding direct system database access to existing SwiftUI/WKWebView app
**Researched:** 2026-03-05
**Confidence:** MEDIUM — Critical pitfalls derived from forensic reverse-engineering community (apple_cloud_notes_parser, Ciofeca Forensics, elusivedata.io, forensic blogs), SQLite official documentation, Apple Developer Forums, and first principles against the existing Isometry v5 codebase. LOW confidence for specific schema column names across Sequoia vs. Sonoma (no official Apple documentation exists; changes discovered empirically by the reverse-engineering community).

---

## Critical Pitfalls

### Pitfall 1: Protobuf ZDATA Parsing Crashes on Encrypted Notes — Silent Corruption Risk

**Severity:** CRITICAL

**What goes wrong:**
Apple Notes stores each note's content as a gzip-compressed protobuf blob in `ZICNOTEDATA.ZDATA`. When a note is password-protected, that ZDATA blob is AES-GCM encrypted *before* gzip compression is applied. Calling `Data.gunzipped()` on an encrypted ZDATA blob returns garbage or throws a decompression error. If the error is swallowed, the note appears to import successfully but its `content` field is empty or contains scrambled bytes. There is no obvious visual indicator in the import result.

**Why it happens:**
Developers read all rows from ZICNOTEDATA without first checking `ZICCLOUDSYNCINGOBJECT.ZISPASSWORDPROTECTED`. The check requires a JOIN across two tables, which many implementations skip for simplicity. The decompression error is caught generically (`catch { continue }`), silently skipping the note rather than flagging it as encrypted.

**How to avoid:**
Always JOIN `ZICNOTEDATA` with `ZICCLOUDSYNCINGOBJECT` on the note's primary key before attempting ZDATA decompression. Check `ZICCLOUDSYNCINGOBJECT.ZISPASSWORDPROTECTED = 1` first. If the flag is set, do NOT attempt to decompress or parse ZDATA — skip the note and add it to a separate `encryptedNotes` count in the import result. Surface this count to the user: "3 notes were skipped (password-protected)." Never silently drop encrypted notes.

```swift
// Correct JOIN before attempting ZDATA parse
let query = """
  SELECT d.ZDATA, o.ZISPASSWORDPROTECTED, o.ZTITLE
  FROM ZICNOTEDATA d
  JOIN ZICCLOUDSYNCINGOBJECT o ON d.ZNOTE = o.Z_PK
  WHERE o.ZMARKEDFORDELETION = 0
"""
// For each row: check ZISPASSWORDPROTECTED before gunzip
if isPasswordProtected == 1 {
    encryptedSkipCount += 1
    continue
}
```

**Warning signs:**
- Import succeeds with 0 errors but note count is lower than the Notes app shows
- Notes with lock icons in Notes.app are missing from import results entirely
- `Data.gunzipped()` throws `DataError.decompression` or similar on some rows
- Import result shows fewer notes than `SELECT COUNT(*) FROM ZICCLOUDSYNCINGOBJECT WHERE ZISPASSWORDPROTECTED = 0`

**Phase to address:** Notes adapter implementation phase — the encrypted note check must be the very first guard in the ZDATA processing pipeline.

---

### Pitfall 2: NoteStore.sqlite Path is NOT Universal — Hardcoded Path Fails on Sonoma+

**Severity:** CRITICAL

**What goes wrong:**
The NoteStore.sqlite path has changed across macOS versions and is not a stable hardcoded constant. Common incorrect assumptions:
- Older resources cite: `~/Library/Containers/com.apple.Notes/Data/Library/Notes/NoteStore.sqlite`
- Current path (Ventura–Sequoia): `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`

Hardcoding either path produces `SQLITE_CANTOPEN` on machines running a different macOS version. The `group.com.apple.notes` Group Containers path is also only accessible to sandboxed apps if the app has either Full Disk Access (FDA) or a group membership entitlement — neither of which is granted automatically.

**Why it happens:**
Older tutorials, Stack Overflow answers, and even some 2022–2023 forensics articles reference the Containers path. The Group Containers path became standard with macOS Monterey but the older path persists in many resources. Developers copy a path that works on their machine during development (which has FDA granted to Terminal/Xcode) and ship code that fails for sandboxed App Store builds.

**How to avoid:**
Use a path discovery strategy rather than a hardcoded constant. Attempt paths in priority order with existence checks:

```swift
static func noteStorePath() -> URL? {
    let fm = FileManager.default
    let home = fm.homeDirectoryForCurrentUser

    // Current path (Monterey+)
    let groupPath = home
        .appendingPathComponent("Library/Group Containers/group.com.apple.notes/NoteStore.sqlite")
    if fm.fileExists(atPath: groupPath.path) { return groupPath }

    // Legacy path (pre-Monterey)
    let legacyPath = home
        .appendingPathComponent("Library/Containers/com.apple.Notes/Data/Library/Notes/NoteStore.sqlite")
    if fm.fileExists(atPath: legacyPath.path) { return legacyPath }

    return nil
}
```

Also: the Reminders path uses a UUID-named file (`Data-<UUID>.sqlite`) inside `Container_v1/Stores/`. Use `FileManager.contentsOfDirectory` to find the `.sqlite` file dynamically, not a hardcoded UUID.

**Warning signs:**
- `SQLITE_CANTOPEN` (error code 14) in Swift when opening the database
- Path works in Xcode during development but fails after App Store submission
- `FileManager.fileExists(atPath:)` returns false for the hardcoded path on user machines
- Crash reporter shows 100% failure rate on macOS 13 or earlier while macOS 14+ succeeds

**Phase to address:** Path discovery must be implemented before any adapter logic. Define a `SystemDatabaseLocator` protocol with fallback path chains for all three databases on day one of the adapter phase.

---

### Pitfall 3: App Sandbox Blocks All System Database Reads — TCC and Sandbox Are Different Problems

**Severity:** CRITICAL

**What goes wrong:**
Two distinct security layers must both be bypassed:

1. **App Sandbox**: A sandboxed app can only read files in its own container and locations the user explicitly grants via Open panels. `~/Library/Group Containers/group.com.apple.notes/` is outside the app's sandbox. Any `sqlite3_open()` call against this path returns `SQLITE_CANTOPEN` with no TCC prompt shown to the user.

2. **TCC (Transparency, Consent, Control)**: Even after the sandbox is satisfied (e.g., the user grants the file via an Open panel, or the app has the `com.apple.security.temporary-exception.files.home-relative-path.read-only` entitlement for that path), TCC may still block access if the app does not have Full Disk Access. Notes' Group Container is protected under TCC's `kTCCServiceSystemPolicyAllFiles` (Full Disk Access) category.

These two layers are independent. Solving one does not solve the other. Many implementations solve TCC only (add Full Disk Access check in `AXIsProcessTrusted` or similar) but forget that the sandbox still blocks the file open.

**How to avoid:**
There are two viable approaches for an App Store app:

**Approach A (Recommended): File Picker + User Grant**
Display a native `NSOpenPanel` pre-pointed at `~/Library/Group Containers/group.com.apple.notes/`. The user selects the folder. The system grants sandbox access to the selected location via a security-scoped bookmark. Store the bookmark in `UserDefaults` and `startAccessingSecurityScopedResource()` on each subsequent launch. This requires no special entitlements and passes App Review.

**Approach B (Not App Store safe): Full Disk Access**
Add `com.apple.security.files.all` entitlement and prompt the user to grant Full Disk Access in System Settings → Privacy & Security → Full Disk Access. Apple rejects apps that require FDA unless justified. This approach is viable for developer tools distributed outside the App Store.

**Warning signs:**
- `SQLITE_CANTOPEN` when opening the database from a sandboxed context
- No system TCC prompt appears (sandbox blocks before TCC even sees the request)
- App works when run from Xcode (Xcode is not sandboxed) but fails from the app bundle
- `security-scoped bookmark` is missing from entitlements

**Phase to address:** First phase of Native ETL milestone, before any database reading code. The permission architecture must be decided (File Picker vs. FDA) and implemented before adapters can be tested end-to-end.

---

### Pitfall 4: WAL Mode Requires Three Files — Copying Only the .sqlite File Produces Stale or Corrupt Data

**Severity:** CRITICAL

**What goes wrong:**
All three Apple system databases (Notes, Reminders, Calendar) use WAL (Write-Ahead Logging) mode. In WAL mode, committed transactions that have not yet been checkpointed back into the main `.sqlite` file live in the `.sqlite-wal` file. If you open only the `.sqlite` file (and the `.sqlite-shm`/`.sqlite-wal` files are inaccessible or omitted), SQLite silently reads only the checkpointed data — missing all transactions from the active WAL. For an actively-used Notes database with frequent edits, this can mean missing the last hours or days of notes.

Opening the `.sqlite` file with `SQLITE_OPEN_READONLY` while the Notes app is running also races against the WAL checkpointing process, potentially seeing partially checkpointed state.

**Why it happens:**
Developers copy only the `.sqlite` file path into their `sqlite3_open_v2()` call. The WAL files have different extensions and are not obviously part of the "database." SQLite does not warn that it is operating without WAL data — it silently returns what it can read.

**How to avoid:**
Two strategies depending on the permission approach:

If using **File Picker**: Ask the user to grant access to the *directory*, not just the `.sqlite` file. This ensures the `.sqlite-shm` and `.sqlite-wal` files are accessible. Use `SQLITE_OPEN_READONLY | SQLITE_OPEN_URI` and open with `?mode=ro` URI parameter so SQLite can locate and read the WAL files.

If reading a copy: Copy all three files atomically (`.sqlite`, `.sqlite-shm`, `.sqlite-wal`) to a temp directory before opening. Use `NSFileCoordinator` to coordinate the copy — the system Notes process is a file presenter on these files.

Do NOT use `immutable=1` URI flag on actively-written system databases. That flag suppresses locking and change detection, producing incorrect results when the source is live.

**Warning signs:**
- Imported notes count is lower than what Notes.app shows
- Recent notes (created in last hour) never appear in imports
- Notes from two days ago appear but notes from this morning do not
- Querying `SELECT COUNT(*) FROM ZICCLOUDSYNCINGOBJECT` returns fewer rows than Notes.app count

**Phase to address:** Database reader utility layer (first phase), before adapter logic. Establish the three-file open strategy as a shared primitive used by all three adapters.

---

### Pitfall 5: Protobuf Schema Evolves Across macOS Versions — Hard Failure on Unknown Field Numbers

**Severity:** HIGH

**What goes wrong:**
Apple's Notes protobuf schema (`notestore.proto`) is reverse-engineered and not publicly documented. Apple silently adds new field numbers with each macOS/iOS release. The protobuf format introduced significant complexity changes in iOS 11 (MergableData for tables), iOS 13 (further nesting), and iOS 16/17 (encrypted note format changes). A parser built for Sonoma's schema will encounter unknown fields on Sequoia and either: (a) crash if the parser is strict, (b) silently skip content if using default protobuf behavior.

For the Isometry use case, the required fields are limited: plain text content, title, modification date, and folder/account. These are stable field numbers that have not changed since at least iOS 13. The dangerous assumption is that richer fields (tables, attachments, checklists) can also be parsed reliably — they cannot without tracking schema per OS version.

**Why it happens:**
Developers import a `.proto` file from the reverse-engineering community (e.g., apple_cloud_notes_parser's `notestore.proto`) and assume it covers all macOS versions. It covers the iOS/macOS version at the time of that tool's last update. Any field added in a newer OS version causes either a parse error or silent truncation.

**How to avoid:**
Scope the protobuf parsing to the minimum required fields for Isometry's CanonicalCard:
- Field 2: plain text (NoteStoreProto → Document → Note → text string)
- Do not attempt to parse `MergableDataProto` (tables, galleries, checklists) — these are unstable

Use a defensive unknown-field-preserving decoder. With Swift Protobuf (`apple/swift-protobuf`), unknown fields are preserved by default — use this library rather than a hand-rolled binary parser.

Add a schema version detection step: query `SELECT name, sql FROM sqlite_master WHERE type='table'` and compare to a known-good baseline. If unknown columns appear, log a warning and fall back to plaintext-only parsing.

**Warning signs:**
- Notes with tables or checklists import with empty content
- `SwiftProtobuf.BinaryDecodingError.malformedProtobuf` on notes with rich content
- Notes from iOS 18+ devices (via iCloud sync) fail while older notes succeed
- Import success rate drops after user upgrades to a new macOS version

**Phase to address:** Notes adapter phase. Scope the protobuf parser to a minimum viable field set on the first implementation pass. Rich content parsing (tables, checklists) requires a separate research pass and should be flagged as a phase-specific research requirement.

---

### Pitfall 6: CoreData Epoch Causes Silent Date Corruption — Off by 31 Years

**Severity:** HIGH

**What goes wrong:**
All three Apple databases store dates as CoreData timestamp doubles: seconds since **2001-01-01 00:00:00 UTC**, not the Unix epoch (1970-01-01). The offset is exactly 978,307,200 seconds (31 years). If dates are imported without applying this offset:
- A note modified at 2024-03-05 is imported as 1993-01-05 (31 years in the past)
- Calendar events in 2025 appear as events in 1994
- Reminders due today appear as due in 1993

The resulting dates are not obviously wrong at a glance in raw numbers — the values look like plausible Unix timestamps from the early 1990s. The bug often isn't caught until a user reports incorrect date sorting.

**Why it happens:**
Developers know SQLite stores dates as integers but assume Unix epoch. The CoreData epoch is a macOS/iOS-specific implementation detail not surfaced anywhere in the SQLite schema itself.

**How to avoid:**
Define a single conversion constant and apply it consistently everywhere:

```swift
// CoreData epoch offset: seconds between 1970-01-01 and 2001-01-01
let coredataEpochOffset: TimeInterval = 978_307_200

extension TimeInterval {
    /// Convert a CoreData timestamp to a Unix timestamp (Date)
    var fromCoreDataTimestamp: Date {
        Date(timeIntervalSince1970: self + coredataEpochOffset)
    }
}
```

Write a unit test with a known reference: a note created at a known time (e.g., 2024-03-05 00:00:00 UTC = CoreData timestamp 731462400.0). Assert that the conversion produces the correct Date. Apply to all date fields: modification date, creation date, due dates, event start/end.

**Warning signs:**
- All imported notes/events have dates in the 1990s
- Date sort order is inverted (newest appears at bottom as "oldest")
- Calendar events cluster around 1994 instead of the current year
- FTS5 date range queries return no results because the indexed dates don't match query bounds

**Phase to address:** Shared utility layer — establish `CoreDataTimestampConverter` before writing any adapter. All three adapters (Notes, Reminders, Calendar) must use it for every date field.

---

### Pitfall 7: Bridge Payload Chunking Required for Large Note Libraries — JSON Serialization OOM

**Severity:** HIGH

**What goes wrong:**
The existing bridge protocol sends import results as a JSON array of `CanonicalCard` objects through `WKScriptMessageHandler`. For a Notes library with 5,000 notes at ~2KB average JSON per card, the full payload is ~10MB of JSON. Serializing 10MB to a Swift `String` via `JSONSerialization`, then encoding to Base64 (adds ~33% overhead → ~13MB), then passing to `evaluateJavaScript()` stresses multiple limits simultaneously:
- The JavaScript string created in the WKWebView process from a 13MB base64 string consumes ~26MB of JS heap before `atob()` even runs
- The WASM Worker's `ImportOrchestrator` then processes the entire array at once, potentially exceeding the 100-card transaction batch limit established in v1.1
- `sql.js`'s WASM heap (default 32MB) can OOM during bulk inserts of large content blobs

The existing `ImportOrchestrator` already batches at 100 cards (v1.1 decision), but the bridge payload itself is not batched — it sends all cards in one message.

**Why it happens:**
The existing file-based ETL (Markdown, CSV, Excel) works with files the user explicitly opens, implying a size ceiling. System database imports have no inherent size ceiling — a power user's Notes library can have 10,000+ notes with rich content. The one-shot payload pattern that works for a 200-card CSV import fails for 5,000-note imports.

**How to avoid:**
Implement chunked bridge dispatch from the Swift native adapter. Split the `CanonicalCard` array into chunks of at most 200 cards before encoding and sending:

```swift
let chunkSize = 200
let chunks = cards.chunked(into: chunkSize)
for (index, chunk) in chunks.enumerated() {
    let payload = NativeImportPayload(
        cards: chunk,
        chunkIndex: index,
        totalChunks: chunks.count,
        importRunId: importRunId
    )
    await bridge.sendImportChunk(payload)
    // Wait for worker acknowledgment before sending next chunk
}
```

The Worker's `ImportOrchestrator` already handles `progress` callbacks — extend it to support multi-chunk import sessions with a shared `import_run_id`.

Cap individual note content at 50KB before bridging. Notes with content > 50KB (rare) should have their content truncated with a `[content truncated — open in Notes app]` marker.

**Warning signs:**
- App freezes for several seconds after triggering Notes import (JSON serialization on main thread)
- WKWebView process is killed by the OS during import (jetsam log entries)
- `sql.js` throws `RangeError: WebAssembly.Memory() out of memory` during bulk insert
- Import progress stops at exactly 100 cards (first batch succeeds, second OOMs)

**Phase to address:** Bridge integration phase — chunked dispatch must be part of the `NativeImportAdapter` protocol design from the start, before any specific adapter is built.

---

### Pitfall 8: Reading an Actively-Written System Database Produces SQLITE_BUSY on WAL Checkpoint

**Severity:** HIGH

**What goes wrong:**
The Notes, Reminders, and Calendar apps are running concurrently with the import. SQLite in WAL mode normally allows simultaneous readers and one writer. However, two edge cases cause `SQLITE_BUSY` or `SQLITE_LOCKED` even in WAL mode:

1. **WAL checkpoint**: Periodically, the system process acquires an EXCLUSIVE lock to flush the WAL back to the main database file. Any reader attempting to open or query during this window sees `SQLITE_BUSY`.
2. **Hot journal recovery**: If the system app crashes or force-quits with an uncommitted transaction, the next reader to open the database attempts WAL recovery — which requires an exclusive lock — blocking all other readers.

Neither condition is permanent (they resolve in milliseconds to seconds), but without retry logic, the import fails entirely on the first `SQLITE_BUSY` return.

**Why it happens:**
`sqlite3_open_v2()` called once without a busy timeout immediately returns `SQLITE_BUSY` if the database is being checkpointed. Most implementations do not set `sqlite3_busy_timeout()` because they assume read-only access is always non-blocking in WAL mode.

**How to avoid:**
Always set a busy timeout before issuing any queries:

```swift
sqlite3_busy_timeout(db, 5000) // 5 second timeout before SQLITE_BUSY is returned
```

Alternatively, use a busy handler with exponential backoff for up to 3 retries. Open databases with `SQLITE_OPEN_READONLY` to avoid becoming a writer, which prevents the app from accidentally triggering a checkpoint. Add a `try? db.interrupt()` / retry loop around the initial `SELECT COUNT(*)` probe query to detect live locking before the full import starts.

**Warning signs:**
- Import fails immediately with SQLite error 5 (SQLITE_BUSY) or error 6 (SQLITE_LOCKED)
- Import succeeds on second attempt (intermittent — indicates checkpoint collision)
- Failures correlate with the user actively using Notes/Reminders/Calendar app during import
- No failures when system apps are quit before import

**Phase to address:** Database reader utility layer — `sqlite3_busy_timeout()` must be set in the shared `SystemDatabaseReader` base class before any query runs.

---

### Pitfall 9: Reminders Database UUID Filename Requires Dynamic Discovery — Breaks on Migration

**Severity:** MEDIUM

**What goes wrong:**
The Reminders database is named `Data-<UUID>.sqlite` inside `~/Library/Group Containers/group.com.apple.reminders/Container_v1/Stores/`. The UUID portion changes when the user migrates to a new Mac, restores from Time Machine backup, or in some macOS upgrade scenarios. Any hardcoded path or cached path that stores the full filename (including UUID) becomes invalid after migration, producing `SQLITE_CANTOPEN`.

Additionally, on first launch of the Reminders app after a macOS upgrade, the database may be briefly absent while Core Data re-creates it from CloudKit — attempting to open during this window also fails.

**Why it happens:**
Developers discover the path via Finder on their dev machine, hardcode the UUID, and test only that one machine. The UUID discovery via `FileManager.contentsOfDirectory` is a one-time implementation cost that gets skipped.

**How to avoid:**
Always discover the Reminders database path dynamically:

```swift
static func remindersDBPath() -> URL? {
    let storesPath = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Group Containers/group.com.apple.reminders/Container_v1/Stores")

    guard let contents = try? FileManager.default.contentsOfDirectory(
        at: storesPath,
        includingPropertiesForKeys: nil
    ) else { return nil }

    return contents.first { $0.pathExtension == "sqlite" }
}
```

Do not cache the path across app launches — re-discover each time. The directory listing is fast (< 1ms).

The Calendar database (`Calendar.sqlitedb`) does NOT use a UUID suffix — it is stable at `~/Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb`. Notes (`NoteStore.sqlite`) is also stable without UUID suffix.

**Warning signs:**
- `SQLITE_CANTOPEN` after user migrates to new Mac
- Reminders adapter succeeds in development but fails after App Store distribution to users on recently migrated machines
- `FileManager.fileExists(atPath:)` returns false for the hardcoded path

**Phase to address:** Path discovery layer. Implement `RemindersSystemDatabaseLocator` using dynamic directory scan at the start of the Reminders adapter phase.

---

### Pitfall 10: Calendar Events Have No Plain Text Body — Content Field Strategy Must Change

**Severity:** MEDIUM

**What goes wrong:**
Apple Notes and Reminders both have a `notes`/`content` field suitable for mapping to `CanonicalCard.content`. The Calendar database `CalendarItem` table has a `summary` field (event title), a `notes` field (optional description), and `start_date`/`end_date` — but no rich-text body. Many events have `notes = NULL`. Importing Calendar events as CanonicalCards with empty `content` produces low-value imports: a card with only a title and dates, no body text.

The trap is building a Calendar adapter that maps `CalendarItem.notes` → `content` directly, producing hundreds of empty-content cards that clutter the database.

**Why it happens:**
The CanonicalCard contract requires `content`, so developers map the closest available field. For Calendar, that field is often NULL.

**How to avoid:**
For Calendar, synthesize `content` from available structured fields:

```
content = "[Date range] [Duration] [Location] [Notes text if present] [Attendee list if present]"
```

This produces searchable, FTS5-indexable content even for events with no explicit notes. The `folder` field maps to the calendar name. Apply a minimum content length check: if synthesized content is < 20 characters, skip the event (it is likely a birthday/holiday placeholder with no useful data).

Set appropriate expectations for the Calendar adapter: it is a structured-data importer, not a content importer. The primary value is temporal: events become cards on the Timeline view.

**Warning signs:**
- FTS5 search returns no Calendar events even for title queries (title is in `name`, not `content`)
- Calendar import imports 500 events but Timeline view appears empty (dates parsed wrong)
- User feedback: "My calendar events imported but have no content"

**Phase to address:** Calendar adapter design phase — establish the synthesized content strategy before writing the first query.

---

### Pitfall 11: Gzip Decompression in Swift Requires a Dependency — Standard Library Has No GZip Support

**Severity:** MEDIUM

**What goes wrong:**
The Notes ZDATA blobs are gzip-compressed. Swift's standard library has no built-in gzip support. Developers reach for:
- `Compression.framework` (Apple's `compression_decode_buffer()`) — supports LZFSE, ZLIB, LZ4 but NOT the standard gzip format (different header)
- `zlib` C library via `libcompression` — available but requires bridging header and manual C interop
- Third-party: `GzipSwift`, `DataCompression`

The `Compression.framework` `.zlib` algorithm handles raw DEFLATE but not gzip (which has a 10-byte header and CRC32 trailer). Using `COMPRESSION_ZLIB` on a gzip blob fails with a decompression error on the header bytes. This is a commonly-made mistake because "zlib" and "gzip" are often confused.

**Why it happens:**
Developers use `Compression.framework` because it is a first-party Apple framework and assume `.zlib` = gzip. The distinction between raw DEFLATE, zlib-wrapped DEFLATE, and gzip-wrapped DEFLATE is subtle.

**How to avoid:**
Use the `zlib` C library directly via its gzip-aware `inflate` APIs, or use a thin Swift wrapper. The recommended approach for Swift Package Manager projects:

```swift
// Add to Package.swift:
.package(url: "https://github.com/nicklockwood/GZIP", from: "1.3.0")
// OR use the built-in approach:
import Foundation
// NSData has built-in gzip decompression via zlibInflate... but requires private API
// Safe approach: use zlib.h directly
```

The cleanest dependency-free option: use `NSData` with `qUncompress()` via bridging, or add `DataCompression` as a Swift Package dependency (maintained, ~100 LOC, no binary dependency).

Verify gzip decompression works by testing against a known ZDATA blob extracted from a real NoteStore.sqlite. The first two bytes of a valid gzip blob are always `0x1f 0x8b`.

**Warning signs:**
- `EXC_BAD_ACCESS` or corrupted bytes on the first byte of ZDATA output
- All ZDATA decompression attempts fail while the bytes look valid in a hex dump
- `Compression.framework` with `.zlib` returns `nil` for all ZDATA blobs

**Phase to address:** Notes adapter phase, day one. Establish and unit-test the gzip decompression utility before any protobuf parsing begins.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode system database paths | Simpler code, faster first pass | Fails on migration, macOS version changes, non-standard installs | Never — dynamic discovery takes < 30 extra LOC |
| Open database without `SQLITE_OPEN_READONLY` | Avoids mode flag complexity | Risk of accidentally triggering WAL checkpoint or corrupting system data | Never — always open read-only |
| Skip encrypted note detection (ZISPASSWORDPROTECTED check) | Simpler query, no JOIN | Silent data loss: encrypted notes vanish without user notification | Never — surface encrypted note count in import result |
| Send full card array as single bridge payload | Matches existing ETL pattern | OOM for large libraries (>500 notes); WKWebView process kill | Acceptable only during development testing; must be chunked before production |
| Map Calendar `notes` field directly to CanonicalCard content | Obvious field mapping | Empty content for most calendar events; low FTS5 utility | Never — synthesize content from structured fields |
| Use `immutable=1` on live system database | Avoids locking complexity | Incorrect query results when Notes app writes concurrently | Never on live databases; only valid for copied snapshots |
| Use Compression.framework `.zlib` for ZDATA | First-party API | Fails on gzip format (different from DEFLATE/zlib); silent corruption | Never — use zlib.h directly or a gzip-aware library |

---

## Integration Gotchas

Common mistakes when connecting native SQLite readers to the existing WKWebView bridge and ETL pipeline.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Native adapter → bridge → ImportOrchestrator | Send all CanonicalCards in one postMessage | Chunk at 200 cards per message; use shared `import_run_id` across chunks |
| Swift Data (ZDATA blob) → bridge | Pass raw `Data` bytes through bridge | Bridge only accepts NSString/NSNumber/NSArray/NSDictionary — Base64-encode binary before serialization |
| Swift Date (CoreData timestamp) → CanonicalCard | Use `Date(timeIntervalSinceReferenceDate:)` (which applies 2001 offset automatically) | Verify output is correct; alternatively use `timeIntervalSince1970 + 978307200` explicitly to document the conversion |
| WAL-mode database → read-only open | Request access to just the `.sqlite` file | Request directory-level access to get all three WAL files; use `?mode=ro` URI parameter |
| Reminders `Z_PK` relationships | Join on `ZREMCDOBJECT.Z_PK` directly | Must join through `ZREMINDER` field (foreign key) to `ZREMCDOBJECT`; entity type discriminated by `Z_ENT` |
| Calendar dates → CanonicalCard `due_date` | Map `start_date` as the card's date | Use `start_date` for `due_date` AND synthesize duration in content; both `start_date` and `end_date` must be offset-corrected |
| FTS5 indexing of imported cards | Assume ImportOrchestrator handles FTS5 | FTS5 trigger disable/rebuild for bulk imports (>500 cards) is already implemented in v1.1 — verify the system adapter imports route through the same `ImportOrchestrator` code path |

---

## Performance Traps

Patterns that work at small scale but fail as large note libraries are encountered.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| SELECT * from ZICNOTEDATA without LIMIT | Reads all ZDATA blobs into Swift memory simultaneously | Always paginate: `LIMIT 100 OFFSET ?` or use a cursor pattern | >300 notes with average 5KB ZDATA each (~1.5MB heap minimum) |
| Protobuf decode on main thread | UI freeze during import | Dispatch all SQLite reads and protobuf decoding to a `Task { await ... }` background task | >50 notes |
| Gzip decompress all notes before protobuf decode | Peak memory = all notes decompressed at once | Decompress and decode one note at a time; discard decompressed Data before processing next | >200 notes at 10KB each (~2MB peak) |
| JSON serialize full CanonicalCard[] before chunking | Peak memory = Swift JSON string + base64 string + bridge buffer = 3x card array size | Serialize and dispatch one chunk at a time | >500 cards |
| Query all CalendarItems without `WHERE hidden = 0` | Includes hidden system calendar items (birthday events, holidays) that count against display | Always filter `WHERE hidden = 0` on CalendarItem queries | Any import — hidden items can outnumber visible events |
| Query all Reminders without completed filter | Imports thousands of old completed reminders with no recency | Add `WHERE ZCOMPLETED = 0 OR ZCOMPLETIONDATE > <90 days ago>` | Users with multi-year Reminders history (thousands of completed items) |

---

## Security Mistakes

Domain-specific security issues specific to reading system databases.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Opening system database with write access | Corruption of Notes/Reminders/Calendar data; liability | Always use `SQLITE_OPEN_READONLY` flag; never call `sqlite3_exec()` with DML statements on system databases |
| Logging ZDATA blob contents to console | Exposes note content (potentially sensitive) in crash logs and Console.app | Never log raw ZDATA bytes; log only metadata (note ID, byte count, error codes) |
| Caching security-scoped bookmark in unprotected UserDefaults | Another app can read the bookmark and access the system database | Store security-scoped bookmarks in the macOS Keychain or an encrypted plist, not plain UserDefaults |
| Importing encrypted note content after decryption without user consent | User's password-protected notes imported without the user knowing | Never attempt decryption; skip `ZISPASSWORDPROTECTED = 1` notes entirely and report the count |
| Forwarding full CanonicalCard content through unvalidated bridge | SQL injection via note content reaching the allowlisted query builder | CanonicalCard content fields are written via `db.prepare()` parameterized statements (v1.1 decision) — verify this path is used for system-database imports too |

---

## UX Pitfalls

Common user experience mistakes specific to native SQLite importers.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Starting import without permission check | User sees cryptic `SQLITE_CANTOPEN` error with no actionable guidance | Show a pre-import permission screen explaining what access is needed and how to grant it; gate the import behind a successful permission probe |
| No progress feedback for large libraries | User sees frozen app during 5,000-note import | Use existing `ImportToast` with chunked progress: "Importing Notes (1,234 / 5,000)..." |
| Silently skipping encrypted notes | User doesn't know why some notes are missing | After import, show: "Import complete. 3 password-protected notes were skipped." |
| Importing ALL reminders including completed | User's Isometry database fills with years of completed tasks | Default to importing only incomplete reminders + last 30 days of completed ones; let user override |
| Importing ALL calendar events including old ones | 10 years of historical events imported for a user who wanted this week | Default to a configurable date range (e.g., last 1 year) for Calendar import; let user extend |
| No dedup communication on re-import | User runs import twice and fears duplicates | Inform user that re-import is idempotent via DedupEngine (source=`apple_notes`, source_id=note UUID) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Notes adapter:** Import succeeds in development — but verify it works with App Sandbox enabled (run from app bundle, not Xcode). `SQLITE_CANTOPEN` in production is the most common post-submission failure.
- [ ] **Notes adapter:** Notes import with correct content — but verify encrypted notes are counted and reported (not silently dropped). Check with at least one password-protected note in the test library.
- [ ] **Notes adapter:** ZDATA decompresses successfully — but verify the first two bytes are `0x1f 0x8b` (gzip magic number) before decompressing. Gracefully handle malformed blobs.
- [ ] **All adapters:** Dates appear correct in the UI — but verify with a known reference date. Create a test note/reminder/event on a specific known date and assert the imported card's `due_date` matches exactly.
- [ ] **All adapters:** Import completes without error — but verify the three WAL files were accessible during the import. If `.sqlite-wal` was absent, data may be incomplete.
- [ ] **Reminders adapter:** Lists are imported as folders — but verify the `Z_ENT` discriminator correctly identifies `REMCDList` (entity 25) vs. `REMCDSmartList` (entity 30). Smart lists have no user-created items and should be excluded.
- [ ] **Calendar adapter:** Events import with dates — but verify `start_date` values use CoreData epoch offset. Query one event with a known start time and assert the offset-corrected value.
- [ ] **Bridge integration:** 100-card batch imports fine — but test with 2,000+ cards. Verify chunked dispatch does not trigger WKWebView process kill or WASM OOM.
- [ ] **Calendar adapter:** `hidden = 0` filter is applied — but verify birthday/holiday calendar events (system-generated) are excluded by the hidden filter.
- [ ] **DedupEngine:** Re-import does not create duplicates — but verify `source_id` maps to the correct stable identifier (`ZIDENTIFIER` for Notes UUID, `ZCALENDARITEMUNIQUEIDENTIFIER` for Calendar, `ZCKIDENTIFIER` for Reminders). Do not use `Z_PK` as source_id — it is a CoreData internal key that can change.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hardcoded paths fail on user machines | MEDIUM | Add path discovery with fallback chain; issue hotfix update; add pre-import probe that returns a clear error message instead of `SQLITE_CANTOPEN` |
| Encrypted notes silently dropped (discovered post-launch) | LOW | Add `WHERE ZISPASSWORDPROTECTED = 0` to existing query; add encrypted note count to result; no data model changes needed |
| CoreData epoch bug in shipped version | HIGH | All imported cards have wrong dates; must re-import all cards with corrected dates; apply a migration query to adjust all `due_date` values by +978307200 seconds; notify users |
| WKWebView process kill on large import | MEDIUM | Implement chunked dispatch; add import size warning (">1,000 notes — this may take a minute"); no data model changes needed |
| WAL files missed — incomplete import | MEDIUM | Prompt user to re-grant folder-level access; re-run import (DedupEngine prevents duplicates); add WAL file existence check before import starts |
| Protobuf parse fails on Sequoia schema | LOW-MEDIUM | Fall back to `ZPLAINTEXT` field if present (some Notes versions populate it); add schema version detection; flag affected notes with `content: "[content unavailable — schema update required]"` |
| SQLite WAL checkpoint race — import fails | LOW | Retry logic with `sqlite3_busy_timeout(5000)` resolves >99% of cases; for persistent failures, prompt user to quit Notes app before re-importing |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Encrypted note detection (ZISPASSWORDPROTECTED) | Notes adapter phase — first query | Test: import library with 1+ password-protected notes; verify skipped count in result, no crash |
| Hardcoded database paths | Path discovery utility (Phase 1) | Test: move NoteStore.sqlite to alternate valid path; verify discovery still finds it |
| Sandbox + TCC permission architecture | Permission layer (Phase 1 — before any adapter) | Test: build and run from app bundle (NOT Xcode) with sandbox enabled; verify `NSOpenPanel` flow works |
| WAL three-file access | Database reader utility (Phase 1) | Test: import with Notes app running; verify WAL-resident notes appear in result |
| CoreData epoch offset | Shared utility layer (Phase 1) | Test: known reference date asserted in unit test for all three adapters |
| Protobuf schema version detection | Notes adapter phase | Test: import from Sonoma database on Sequoia; verify graceful fallback on unknown fields |
| Bridge chunking for large imports | Bridge integration (before any adapter ships) | Test: import 2,000+ notes; verify no WKWebView process kill; verify progress updates at each chunk |
| SQLITE_BUSY / WAL checkpoint | Database reader utility (Phase 1) | Test: run import while actively editing in Notes app; verify no hard failures |
| Reminders UUID path | Reminders adapter phase | Test: simulate migration by moving database to new UUID-named path; verify dynamic discovery |
| Calendar synthesized content | Calendar adapter design | Test: import event with NULL notes field; verify synthesized content contains date range |
| Gzip decompression dependency | Notes adapter phase — day one | Unit test: known ZDATA blob decompresses to expected plaintext |
| Source_id stability (not Z_PK) | All adapter phases | Test: re-import same database twice; assert zero new cards created (DedupEngine catches all) |

---

## Sources

- [Apple Cloud Notes Parser (threeplanetssoftware)](https://github.com/threeplanetssoftware/apple_cloud_notes_parser) — authoritative protobuf schema reference; actively maintained; version-detection approach (MEDIUM confidence — reverse-engineered, not official)
- [Ciofeca Forensics: Revisiting Apple Notes — The Protobuf](https://ciofecaforensics.com/2020/09/18/apple-notes-revisited-protobuf/) — AttributeRun field structure, MergableDataProto complexity (MEDIUM confidence)
- [Ciofeca Forensics: Revisiting Apple Notes — Encrypted Notes](https://www.ciofecaforensics.com/2020/07/31/apple-notes-revisited-encrypted-notes/) — ZISPASSWORDPROTECTED field, encryption metadata fields (HIGH confidence — cross-referenced with elusivedata.io)
- [Decrypt Locked Apple Notes on iOS 16.x — elusivedata.io](https://elusivedata.io/decrypt-apple-notes-ios16/) — ZCRYPTOSALT, ZCRYPTOWRAPPEDKEY, AES-GCM structure (HIGH confidence for detection; LOW confidence for decryption — iOS 17/18 changed the format)
- [0xdevalias: Accessing Apple Reminders data on macOS (GitHub Gist)](https://gist.github.com/0xdevalias/ccc2b083ff58b52aa701462f2cfb3cc8) — Reminders schema: ZREMCDREMINDER, Z_ENT discriminator values, WAL pitfall (MEDIUM confidence)
- [Julik Tarkhanov: Turning Apple Calendar into a time tracker (2025)](https://blog.julik.nl/2025/08/turning-apple-calendar-into-time-tracker) — Calendar schema, CoreData epoch offset, `hidden = 0` filter, performance vs. AppleScript (HIGH confidence — author directly verified against macOS 15)
- [Clutterstack: Getting notes out of Apple Notes (2024)](https://clutterstack.com/posts/2024-09-27-applenotes) — protobuf complexity reality check, attachment structure limitations (MEDIUM confidence)
- [SQLite WAL mode documentation](https://sqlite.org/wal.html) — concurrent read/write behavior, checkpoint locking (HIGH confidence — official)
- [SQLite URI parameters: mode=ro, immutable](https://sqlite.org/c3ref/open.html) — read-only open behavior, WAL requirements (HIGH confidence — official)
- [TwocentStudios: Caveats Using Read-only SQLite Databases (2025)](https://twocentstudios.com/2025/06/07/sql-databases-bundle/) — WAL + read-only interaction, backup changes journal mode (HIGH confidence)
- [Apple Developer Forums: Granting Full Disk Access](https://developer.apple.com/forums/thread/124895) — TCC and sandbox independence (MEDIUM confidence)
- [Apple: App Sandbox Temporary Exception Entitlements](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/AppSandboxTemporaryExceptionEntitlements.html) — home-relative-path read-only entitlement (HIGH confidence — official, though archived)
- [Yogesh Khatri: Reading Notes database on macOS](http://www.swiftforensics.com/2018/02/reading-notes-database-on-macos.html) — ZICNOTEDATA schema, forensic context (LOW confidence — 2018, may not reflect Sonoma/Sequoia schema)
- SQLite error codes 5 (SQLITE_BUSY) and 6 (SQLITE_LOCKED) — [sqlite.org/rescode.html](https://sqlite.org/rescode.html) (HIGH confidence — official)

---
*Pitfalls research for: Native macOS SQLite readers — Apple Notes, Reminders, Calendar — adding to existing SwiftUI/WKWebView/sql.js app*
*Researched: 2026-03-05*
