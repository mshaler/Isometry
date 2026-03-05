# Project Research Summary

**Project:** Isometry v4.0 — Native ETL: macOS System SQLite Importers
**Domain:** Native macOS SQLite/EventKit adapters for Apple Notes, Reminders, and Calendar
**Researched:** 2026-03-05
**Confidence:** MEDIUM overall — HIGH for stack and architecture patterns; MEDIUM for schema details (reverse-engineered, no official Apple API); LOW for protobuf field stability across future macOS versions

## Executive Summary

Isometry v4.0 adds three native Swift adapters that read Apple system databases (Notes, Reminders, Calendar) and pipe `CanonicalCard[]` JSON through the existing WKWebView bridge to `ImportOrchestrator`. The fundamental architectural insight is that the web-side ETL pipeline (DedupEngine, SQLiteWriter, CatalogWriter) remains completely unchanged — Swift reads, transforms to `CanonicalCard[]`, and delivers via the existing `native:action` kind discriminator. The TypeScript Worker sees this import as indistinguishable from a user-selected file import. This additive-only constraint is non-negotiable: it preserves the two-layer architecture (D-011) and avoids concurrent write conflicts on `isometry.db`.

The recommended approach uses two new SPM dependencies (GRDB.swift 7.10.0 for Notes SQLite, apple/swift-protobuf 1.35.1 for Notes content extraction) and two system frameworks (EventKit for Reminders and Calendar, Foundation NSData.decompress for gzip). Reminders and Calendar MUST use EventKit — direct SQLite access to these databases requires Full Disk Access, which is unavailable to Mac App Store sandboxed apps. Notes requires a two-path architecture: direct GRDB access for non-sandboxed/direct distribution, NSOpenPanel with security-scoped bookmarks for App Store builds. The bridge extension requires only a single new `kind: "importNative"` case in existing switch statements on both sides.

The key risks are concentrated in the Notes adapter: protobuf schema instability across macOS versions, WAL file handling, sandbox/TCC permission complexity, and large-library OOM via unsized bridge payloads. Mitigations are well-understood: ship Notes title-only first (zero protobuf risk), add protobuf content as a v4.x differentiator after title import is validated, enforce 200-card bridge chunking from day one, and implement a `CoreDataTimestampConverter` shared utility before any adapter writes a date. Reminders and Calendar adapters are low-risk and should be built in parallel once the bridge pipeline is proven.

## Key Findings

### Recommended Stack

The existing stack is locked (Swift/SwiftUI/WKWebView/sql.js/TypeScript). v4.0 adds exactly two new SPM dependencies and zero new npm dependencies. GRDB.swift handles WAL-safe read-only access to NoteStore.sqlite using the `?immutable=1` URI flag and Swift 6 actor isolation — the right tool for reading live Core Data SQLite files. apple/swift-protobuf generates type-safe Swift from the community-reverse-engineered `notestore.proto` schema; the generated `.pb.swift` is checked in as a one-time artifact (no `protoc` in CI). EventKit is mandatory for Reminders and Calendar: direct SQLite access to these databases is blocked by the App Store sandbox, Apple has explicitly stated the schema is not public API, and the schema has drifted across macOS versions. Foundation NSData.decompress handles gzip with zero extra dependency.

**Core technologies:**
- **GRDB.swift 7.10.0:** Read-only NoteStore.sqlite access with WAL-safe immutable URI — best Swift SQLite toolkit with Swift 6 actor isolation and Task cancellation
- **apple/swift-protobuf 1.35.1:** Decode Notes ZDATA protobuf blobs from community reverse-engineered schema — official Apple-maintained runtime
- **EventKit (system framework):** Reminders (EKReminder) + Calendar (EKEvent) read access — only viable path for App Store sandboxed apps
- **Foundation NSData.decompress:** Gzip decompression of Notes ZDATA — zero dependency, available macOS 10.15+
- **sqlite3_deserialize (raw C API):** In-memory copy of system databases — avoids WAL lock conflicts with live system apps, available iOS 15+/macOS 12+

### Expected Features

The research establishes a clear MVP boundary. All three adapters must ship together with TCC permission flows before any differentiator work begins.

**Must have (table stakes):**
- Notes: title (ZTITLE1 or ZTITLE2 — schema version detected at runtime), folder via self-join on ZICCLOUDSYNCINGOBJECT, created/modified timestamps, skip encrypted notes with reported count, schema version detection via `PRAGMA table_info`
- Reminders: title, notes, list name as folder, due date, completion status, priority — all via EventKit
- Calendar: title, notes, location string, start/end dates, calendar name as folder, is_collective, event status — all via EventKit
- TCC permission flow for all three sources with graceful denial and System Settings deep link
- All adapters output `CanonicalCard[]` JSON through existing `native:action` bridge to `ImportOrchestrator`
- DedupEngine compatibility via stable source_id (ZIDENTIFIER for Notes, calendarItemIdentifier for Reminders/Calendar)
- 200-card bridge chunking from day one — not retrofitted after MVP

**Should have (competitive — v4.x after table stakes validated):**
- Notes: full protobuf content extraction (complete note body for FTS5 search) via swift-protobuf
- Notes: pinned status mapped to sort_order, account source tracking (iCloud vs On My Mac)
- Reminders: hashtag extraction via direct SQLite (ZREMCDHASHTAGLABEL — not available in EventKit)
- Calendar: geo-coordinates (latitude/longitude) via direct Calendar.sqlitedb Location table join

**Defer (v5+):**
- Write-back to Notes/Reminders/Calendar (bidirectional sync — unsolved problem, data model divergence)
- Real-time sync / file watching (live Core Data databases are not safe to file-watch)
- iOS EventKit adapter path (same APIs, different permission flow)
- Reminders subtask hierarchy as connections (EventKit parentReminder is unstable across OS versions)

### Architecture Approach

The architecture is strictly additive to the existing v2.0 native shell. Swift reads system databases, transforms rows to `CanonicalCard` JSON dictionaries, and delivers them through `evaluateJavaScript` as a `native:action` with `kind: "importNative"`. The TypeScript side adds a single branch in NativeBridge.ts, one method in WorkerBridge.ts, one Worker handler (`nativeImport.ts`), and one entry in MUTATING_TYPES. Everything downstream (ImportOrchestrator, DedupEngine, SQLiteWriter) is unchanged. The `NativeImportAdapter` protocol defines the Swift seam: `source`, `databasePath()`, and `extractCards(from: Data)`. All adapters open system databases as in-memory copies via `sqlite3_deserialize`, which avoids WAL conflict with live system processes.

**Major components:**
1. **PermissionManager** — TCC Full Disk Access probe via `FileManager.isReadableFile` on `~/Library/Calendars`; opens System Settings deep link on denial; sends existing `native:blocked` message (no new message type needed)
2. **NativeImportAdapter protocol** — Swift protocol defining the source-specific contract; enables mockable XCTest fixtures for each adapter without live system databases
3. **NotesAdapter** — reads NoteStore.sqlite via GRDB with `?immutable=1`; two-step: title-only ships first, protobuf content added as v4.x differentiator; dynamic path discovery for Notes Store path across macOS versions
4. **RemindersAdapter** — EventKit EKReminder read access; macOS 14+ async API (`requestFullAccessToReminders`); dynamic Reminders database path discovery for UUID-named SQLite file
5. **CalendarAdapter** — EventKit EKEvent read access; macOS 14+ async API (`requestFullAccessToEvents`); synthesized content from structured fields for NULL-notes events
6. **BridgeManager extension** — new `case "importNative"` in existing switch; `Task.detached` for file reads off `@MainActor`; 200-card chunked dispatch with shared `import_run_id`
7. **nativeImport.ts Worker handler** — receives `CanonicalCard[]` from bridge; calls existing DedupEngine + SQLiteWriter pipeline; indistinguishable from file-import path

### Critical Pitfalls

1. **Encrypted Notes parsed without detection — silent data loss.** Always JOIN ZICNOTEDATA with ZICCLOUDSYNCINGOBJECT and check `ZISPASSWORDPROTECTED = 1` before attempting ZDATA decompression. Surface the skipped count to the user. Never silently drop encrypted notes.

2. **Hardcoded database paths fail across macOS versions and migrations.** NoteStore.sqlite path has two known locations across OS versions; Reminders uses a UUID-named file that changes on device migration. Implement dynamic path discovery with fallback chains for Notes and `contentsOfDirectory` glob for Reminders. Never cache the Reminders path across app launches.

3. **Sandbox + TCC are independent security layers — solving one doesn't solve the other.** A sandboxed app gets `SQLITE_CANTOPEN` on Notes even with TCC Full Disk Access, because the sandbox itself is not satisfied. Use NSOpenPanel with security-scoped bookmarks for App Store distribution, or Full Disk Access + direct path for non-App Store distribution. This decision must be made before Phase 1 begins.

4. **WAL mode requires all three files — opening only .sqlite yields stale or incomplete data.** Notes, Reminders, and Calendar all use WAL mode. Grant directory-level access (not just file-level) so `.sqlite-shm` and `.sqlite-wal` are accessible alongside `.sqlite`. Set `sqlite3_busy_timeout(5000)` to handle checkpoint races when the system app is running concurrently.

5. **Bridge payload OOM for large libraries — one-shot JSON array kills WKWebView process.** A 5,000-note import as a single JSON payload exceeds WASM heap limits. Implement 200-card chunked dispatch from the protocol design in Phase 1, before any adapter ships. Never send the full card array as a single bridge message.

6. **CoreData epoch offset causes silent 31-year date corruption.** All three databases store dates as seconds since 2001-01-01 (not Unix epoch). Implement a single `CoreDataTimestampConverter` shared utility with a unit test against a known reference date before writing any adapter date field.

7. **Gzip decompression using Compression.framework .zlib fails on Notes ZDATA blobs.** The `.zlib` algorithm in `Compression.framework` handles raw DEFLATE, not gzip (which has a 10-byte header and CRC32 trailer). Notes ZDATA is gzip, not raw DEFLATE. Use `NSData.decompress(using: .zlib)` from Foundation (which handles the gzip wrapper correctly) or `zlib.h` directly. Verify first two bytes are `0x1f 0x8b` before attempting decompression.

## Implications for Roadmap

Research identifies four natural phases with clear dependencies. The critical ordering constraint: infrastructure first, then bridge validation with a mock adapter, then low-risk adapters (Reminders/Calendar), then high-risk adapter (Notes title-only), then Notes content differentiator last.

### Phase 1: Foundation Infrastructure
**Rationale:** Every pitfall in the "Looks Done But Isn't" checklist traces back to a missing shared utility. Permission architecture, WAL handling, CoreData timestamp conversion, and chunked bridge dispatch must all exist before any real adapter can be tested correctly in production. Building adapters first and retrofitting these utilities is the highest-risk path.
**Delivers:** `PermissionManager` with TCC probe and NSOpenPanel fallback; `CoreDataTimestampConverter` shared utility with reference date unit test; shared `SystemDatabaseReader` with `sqlite3_busy_timeout` and WAL-aware directory-level access; path discovery utilities (`noteStorePath()`, `remindersDBPath()` via dynamic `contentsOfDirectory` scan); `NativeImportAdapter` protocol; full TypeScript bridge pipeline (`nativeImport.ts` Worker handler, `WorkerBridge.importNativeCards()`, NativeBridge branch, MUTATING_TYPES entry, `'etl:importNative'` in WorkerRequestType) validated with a `MockAdapter` returning 3 hardcoded cards end-to-end
**Addresses:** TCC permission flow (table stakes), DedupEngine compatibility (table stakes), bridge output format (table stakes)
**Avoids:** Pitfalls 2 (hardcoded paths), 3 (sandbox/TCC), 4 (WAL files), 5 (bridge OOM), 6 (CoreData epoch)

### Phase 2: Reminders + Calendar Adapters (Low Risk)
**Rationale:** Both adapters use EventKit — the official Apple path with stable schema, automatic TCC prompt, and no protobuf complexity. These ship first to validate the full pipeline end-to-end with real system data before tackling the riskier Notes adapter. Parallel development of both is appropriate after Phase 1 infrastructure is in place.
**Delivers:** `RemindersAdapter` (EKReminder: title, notes, list name, due date, completion status, priority); `CalendarAdapter` (EKEvent: title, notes, location string, start/end dates, calendar name, is_collective, event status, synthesized content for NULL-notes events); XCTest fixtures with mock EKEvent/EKReminder objects; dynamic Reminders path discovery from Phase 1; `Z_ENT` discriminator to exclude Smart Lists from Reminders
**Uses:** EventKit macOS 14+ async APIs, `CoreDataTimestampConverter`, `NativeImportAdapter` protocol, chunked dispatch from Phase 1
**Avoids:** Pitfall 10 (Calendar empty content — synthesize from date range + location + attendees when notes field is NULL), Pitfall 9 (Reminders UUID path — dynamic discovery from Phase 1)

### Phase 3: Notes Adapter — Title + Metadata (High Risk, Contained)
**Rationale:** Notes is the highest user value source but carries the most risk. Ship the title-only path first: `ZTITLE1/ZTITLE2` (detected at runtime via `PRAGMA table_info`), folder via self-join, timestamps, ZSNIPPET 100-char preview without protobuf. This validates NoteStore.sqlite access, WAL handling, schema version detection, and encrypted note filtering without touching the protobuf stack at all. Protobuf content extraction is explicitly deferred to Phase 4.
**Delivers:** `NotesAdapter` reading ZICCLOUDSYNCINGOBJECT + ZICNOTEDATA metadata; schema version detection via `PRAGMA table_info` (ZACCOUNT3 vs ZACCOUNT4 branching, ZTITLE1 vs ZTITLE2); encrypted note detection and skipped-count reporting via `ZISPASSWORDPROTECTED` JOIN check; folder hierarchy via self-join; GRDB integration with `?immutable=1` URI; XCTest with mock NoteStore fixture for both schema versions
**Uses:** GRDB.swift 7.10.0, `NativeImportAdapter` protocol, `PermissionManager` (NSOpenPanel or FDA path), WAL reader from Phase 1
**Implements:** NotesAdapter Strategy A (title-only) — validates feasibility before protobuf commitment
**Avoids:** Pitfall 1 (encrypted note detection required before any ZDATA attempt), Pitfall 2 (dynamic path discovery), Pitfall 5 (protobuf schema instability — fully deferred)

### Phase 4: Notes Content Extraction — Protobuf (Differentiator)
**Rationale:** Full note body text enables FTS5 search across all note content — a significant user value upgrade over ZSNIPPET's 100-char preview. This phase is isolated so protobuf complexity cannot destabilize the already-shipped title adapter. Build only after Phase 3 is validated on real user machines across macOS 13/14/15.
**Delivers:** ZDATA gzip decompression via Foundation NSData.decompress (with 0x1f 0x8b magic byte verification before decompression); apple/swift-protobuf integration with checked-in `notestore.pb.swift`; plaintext extraction from `Document (field 2) → Note (field 3) → note_text (field 2)` field path; graceful fallback to ZSNIPPET on unknown or malformed protobuf fields; attachment placeholder stripping (Unicode 0xFFFC); XCTest with known-good ZDATA fixture verifying both decompression and protobuf decode
**Uses:** apple/swift-protobuf 1.35.1, Foundation NSData.decompress, community `notestore.proto` (one-time `protoc` generation, result checked into repo)
**Avoids:** Pitfall 5 (protobuf schema evolution — scope to minimum required fields, use swift-protobuf's unknown-field preservation default), Pitfall 11 (gzip vs DEFLATE confusion — Foundation NSData.decompress handles gzip wrapper correctly, unlike Compression.framework `.zlib`)

### Phase Ordering Rationale

- **Infrastructure before adapters:** Six of eleven documented pitfalls (paths, WAL, CoreData epoch, TCC/sandbox, bridge OOM, SQLITE_BUSY) are cross-cutting concerns shared by all three adapters. Building shared utilities once in Phase 1 prevents each adapter phase from independently discovering these failure modes in production.
- **Reminders/Calendar before Notes:** EventKit adapters provide a clean end-to-end test of the bridge pipeline with low adapter-specific failure modes. Validating the pipeline on simpler sources means Notes problems are isolated to Notes-specific concerns, not confounded with pipeline issues.
- **Notes title before Notes content:** Protobuf content extraction is flagged as HIGH risk by all research sources (undocumented Apple format, schema evolved since iOS 9, macOS 15 compatibility unverified). The title-only path ships immediate user value and de-risks protobuf to a contained, independent phase.
- **Differentiators after MVP validated:** Hashtag extraction (Reminders direct SQLite), geo-coordinates (Calendar direct SQLite), and Notes full protobuf content are all v4.x additions after the EventKit + ZSNIPPET paths are validated and stable.

### Research Flags

Phases likely needing deeper research before or during planning:
- **Phase 3 (Notes Adapter):** Column name discrepancy across sources must be resolved empirically. STACK.md cites `ZTITLE2` for note title; FEATURES.md cites `ZTITLE1`. The `ZTYPEUTI1` column name (used to filter note rows in the ARCHITECTURE.md queries) is from a 2018 forensic blog (LOW confidence). Mandatory pre-implementation spike: run `PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)` against an actual macOS 14 and macOS 15 NoteStore.sqlite and document all column names before writing any query.
- **Phase 4 (Notes Protobuf):** The Notes protobuf schema is reverse-engineered and not publicly documented. Mandatory pre-implementation spike: extract a known ZDATA blob from a macOS 15 (Sequoia) NoteStore.sqlite and verify the `Document → Note → note_text` field path decodes correctly with the community `notestore.proto`. If the field path has changed in Sequoia, identify the correct path before any implementation begins.

Phases with standard patterns (skip deeper research):
- **Phase 1 (Infrastructure):** `sqlite3_busy_timeout`, CoreData epoch offset, dynamic path discovery, NSOpenPanel security-scoped bookmarks, and 200-card chunked bridge dispatch are all well-documented patterns with HIGH-confidence sources.
- **Phase 2 (Reminders/Calendar EventKit):** EventKit APIs are official Apple documentation. `requestFullAccessToReminders()` and `requestFullAccessToEvents()` macOS 14+ async signatures confirmed via Apple TN3153. Standard, well-documented implementation path.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | EventKit mandatory for Reminders/Calendar confirmed by Apple Developer Forums (official, multiple Apple engineers). GRDB.swift 7.x and swift-protobuf 1.35.x version requirements confirmed against official repos. Foundation NSData.decompress availability confirmed against Apple docs. sqlite3_deserialize availability on macOS 12+ confirmed from official SQLite C API docs. Only uncertainty: GRDB `?immutable=1` URI behavior with WAL databases warrants an early integration test against a real NoteStore.sqlite. |
| Features | MEDIUM | EventKit field mappings confirmed via official Apple documentation (EKReminder, EKEvent). Notes schema field names (ZTITLE1/ZTITLE2 discrepancy, ZICCLOUDSYNCINGOBJECT, ZICNOTEDATA) confirmed across multiple independent forensic sources but are reverse-engineered — no official Apple documentation. Tags (Reminders hashtags) and geo-coordinates (Calendar) require direct SQLite with MEDIUM-confidence schema references. |
| Architecture | HIGH | Architecture is additive to an existing validated codebase. The `native:action` kind discriminator extension pattern, `Task.detached` for off-main-actor I/O, `JSONSerialization` for bridge payloads, and `sqlite3_deserialize` for in-memory database copies are all well-established patterns. Anti-patterns (direct isometry.db write from Swift, new bridge message types per adapter, binary database bytes through bridge) are clearly identified with official rationale. |
| Pitfalls | MEDIUM | Critical pitfalls (encrypted notes, WAL files, CoreData epoch, bridge OOM, sandbox/TCC) are well-evidenced from multiple independent sources including official Apple Developer Forums and SQLite documentation. Notes protobuf schema pitfalls are MEDIUM confidence (reverse-engineered, community-maintained through 2024). Calendar schema pitfalls have HIGH confidence from a 2025 first-hand account verified against macOS 15 (Julik Tarkhanov). Reminders Z_ENT discriminator values are MEDIUM confidence (single community source). |

**Overall confidence:** MEDIUM-HIGH — The infrastructure, Reminders, and Calendar phases can be built with high confidence on well-documented APIs. Notes is the uncertainty source, and the two-step strategy (title first, protobuf second) is specifically designed to contain and isolate that risk.

### Gaps to Address

- **ZTITLE1 vs ZTITLE2 column name discrepancy:** STACK.md and FEATURES.md reference different column names for the note title field. STACK.md uses `ZTITLE2` (citing forensic blog 2020); FEATURES.md uses `ZTITLE1` (citing mac_apt Notes plugin). This needs resolution via `PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)` on actual macOS 14 and 15 before the Phase 3 query is written. The runtime schema version detection in Phase 3 handles this dynamically.
- **Notes protobuf macOS 15 compatibility:** The `note_text` field path through `Document (field 2) → Note (field 3) → note_text (field 2)` has been stable since iOS 9 but has not been independently verified against macOS 15 (Sequoia). Flag for Phase 4 kickoff: extract and verify a Sequoia ZDATA blob before implementation.
- **Reminders `Z_ENT` discriminator values:** The entity type discriminator for `REMCDList` (entity 25) vs `REMCDSmartList` (entity 30) is from a single community source (0xdevalias gist). These values must be verified against an actual Reminders SQLite database early in Phase 2 to ensure Smart Lists are correctly excluded.
- **App Store vs direct distribution decision:** The Notes adapter has two distinct code paths depending on distribution channel (NSOpenPanel + security-scoped bookmark vs. Full Disk Access + direct path). This business decision affects the permission architecture built in Phase 1 and should be confirmed before Phase 1 begins.
- **Bridge chunking acknowledgment protocol:** The research recommends waiting for Worker acknowledgment before sending the next 200-card chunk. The existing Worker message protocol supports this via correlation IDs, but the exact multi-chunk session flow (per-chunk ACK vs. final-chunk ACK, handling of mid-session failures) needs to be designed during Phase 1.
- **Completed Reminders import scope:** Importing all Reminders including years of completed items may overwhelm first-time importers. The research recommends a default scope of incomplete + last 30 days completed. This default needs to be confirmed as a product decision before Phase 2 ships.

## Sources

### Primary (HIGH confidence)
- Apple Developer Documentation — TN3153 EventKit macOS 14 API changes (`requestFullAccessToReminders`, `requestFullAccessToEvents` async APIs)
- Apple Developer Documentation — EKEvent, EKReminder property references (field mapping tables)
- Apple Developer Forums — Full Disk Access unavailable to App Store sandboxed apps (multiple Apple engineers confirmed, thread 124895)
- Apple Developer Forums — `FileManager.isReadableFile` as recommended TCC probe approach (thread 114452)
- SQLite official documentation — WAL mode behavior, `sqlite3_busy_timeout`, `sqlite3_deserialize`, URI parameters (`mode=ro`, `immutable=1`)
- apple/swift-protobuf GitHub — version 1.35.1 confirmed, Swift 6.0+ requirement confirmed
- Julik Tarkhanov (2025) — Calendar.sqlitedb schema verified against macOS 15 (`hidden = 0` filter, CoreData epoch, start_date/end_date column names)
- TwocentStudios (2025) — WAL + read-only SQLite interaction patterns, read-only open behavior

### Secondary (MEDIUM confidence)
- GRDB.swift GitHub + Swift Forums — WAL-mode read-only `?immutable=1` URI pattern, `Configuration.readonly = true`, Swift 6 actor isolation
- threeplanetssoftware/apple_cloud_notes_parser — Notes protobuf schema (`notestore.proto`), actively maintained through 2024; confirmed gzip+protobuf structure
- Ciofeca Forensics (2020) — ZDATA gzip+protobuf structure, encrypted note detection (`ZISPASSWORDPROTECTED`), AES-GCM encryption before gzip
- 0xdevalias gist — Reminders SQLite schema (ZREMCDREMINDER, hashtag tables, Z_ENT discriminator values for list vs. smart list)
- mac_apt Notes plugin (ydkhatri) — ZICCLOUDSYNCINGOBJECT join pattern and column names including ZTITLE1
- Clutterstack (2024) — Notes protobuf complexity reality check, attachment structure limitations
- kacos2000/Queries calendar_sqlitedb.sql — complete Calendar SQLite schema with verified column names

### Tertiary (LOW confidence)
- Yogesh Khatri forensic blog (2018) — ZICCLOUDSYNCINGOBJECT schema, ZTITLE2 and ZTYPEUTI1 field names (dated — must verify against current macOS with PRAGMA table_info before use)
- swiftforensics.com (2018) — ZICNOTEDATA schema, NoteStore.sqlite path (dated — verify path and field names against macOS 14+)

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
