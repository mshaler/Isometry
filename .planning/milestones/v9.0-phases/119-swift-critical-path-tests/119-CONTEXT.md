# Phase 119: Swift Critical Path Tests - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Conversation analysis of Swift test gap assessment

<domain>
## Phase Boundary

This phase adds integration tests for the three highest-risk untested Swift files:
1. **SyncManager.swift** (642 LOC) — CKSyncEngine actor, state persistence, offline queue, conflict resolution
2. **ProtobufToMarkdown.swift** (535 LOC) — Tier 1 AttributeRun→Markdown conversion (helpers already tested, core conversion untested)
3. **NotesAdapter.swift** (553 LOC) — Raw SQLite3 C API queries against Apple NoteStore schema

These three files handle the data integrity pipeline: Notes DB → decompress → parse protobuf → Markdown → sync to CloudKit. A bug in any of them causes data loss or corruption.

**Out of scope:** CalendarAdapter, RemindersAdapter, AltoIndexAdapter, NativeImportCoordinator, IsometryApp lifecycle, SwiftUI views.
</domain>

<decisions>
## Implementation Decisions

### SyncManager Testing Strategy
- Mock CKSyncEngine events via protocol abstraction — do NOT use real CloudKit
- SyncManager is an `actor` — all tests must be async
- Test state serialization: encode SyncEngine.State → Data → decode, verify round-trip
- Test offline queue: add PendingChange → persist to JSON → restore, verify contents survive
- Test conflict resolution: create mock .serverRecordChanged event, verify server-wins behavior
- Test account change handling: verify queue and state are cleared on .accountChange
- Do NOT test CKSyncEngine.Event.willSendZoneChanges or CKSyncEngine.Event.fetchedDatabaseChanges — too tightly coupled to CloudKit internals

### ProtobufToMarkdown Tier 1 Testing Strategy
- Create real compressed protobuf fixtures by extracting ZDATA blobs from an actual NoteStore.sqlite
- If real fixtures are unavailable, construct NoteStoreProto programmatically using SwiftProtobuf API and compress with zlib
- Test cases: plain text, heading (styleType 0/1/2), bold (fontWeight 1), italic (fontWeight 2), bold+italic (fontWeight 3), strikethrough, checklist (done/undone), code block (styleType 4), blockquote, numbered list, bulleted list, attachment placeholder (U+FFFC), note-to-note link, external URL link
- Verify the full `extract(zdata:snippet:)` → ConversionResult path, not just the helper functions (those are already tested)

### NotesAdapter Testing Strategy
- Create a minimal fixture NoteStore.sqlite with known content (5-10 notes)
- Use SQLite3 C API directly to create the fixture (matching Apple's schema: ZICCLOUDSYNCINGOBJECT, ZICNOTEDATA)
- Test title extraction: verify ZTITLE1 vs ZTITLE2 version detection logic
- Test folder hierarchy: verify parent folder resolution
- Test encrypted note: insert a note with ZISPASSWORDPROTECTED=1, verify it's skipped
- Test note-to-note links: insert link runs in protobuf, verify link cards are generated
- Test attachment metadata: verify UTI and filename extraction from ZICATTACHMENT rows
- Do NOT test NSFileCoordinator or security-scoped bookmark resolution — those require sandbox context

### Claude's Discretion
- Exact protobuf fixture construction method (real ZDATA vs programmatic SwiftProtobuf)
- Whether to use a shared test fixture file or generate in-memory SQLite per test
- Actor isolation patterns for SyncManager test helpers
- Whether to extract SyncManager's state persistence into a testable protocol
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Files Under Test
- `native/Isometry/Isometry/SyncManager.swift` — CKSyncEngine actor (642 LOC)
- `native/Isometry/Isometry/SyncTypes.swift` — PendingChange, CodableValue, CKRecord extensions (274 LOC, already partially tested)
- `native/Isometry/Isometry/ProtobufToMarkdown.swift` — Three-tier extraction, AttributeRun walker (535 LOC)
- `native/Isometry/Isometry/GzipDecompressor.swift` — zlib C API decompression (71 LOC, already tested)
- `native/Isometry/Isometry/NotesAdapter.swift` — SQLite3 C API NoteStore reader (553 LOC)
- `native/Isometry/Isometry/NoteStoreProto.pb.swift` — SwiftProtobuf generated schema (688 LOC)

### Existing Test Files (pattern reference)
- `native/Isometry/IsometryTests/ProtobufToMarkdownTests.swift` — Existing helper tests to extend
- `native/Isometry/IsometryTests/SyncTypesTests.swift` — Existing CodableValue/PendingChange/CKRecord tests
- `native/Isometry/IsometryTests/GzipDecompressorTests.swift` — Existing decompression tests
- `native/Isometry/IsometryTests/FeatureGateTests.swift` — Swift Testing framework pattern reference

### Architecture
- `native/Isometry/CLAUDE.md` — Native shell architecture guide (bridge protocol, design constraints)
</canonical_refs>

<specifics>
## Specific Ideas

### Protobuf Fixture Construction
The NoteStoreProto.pb.swift file defines `NoteStoreProto`, `NoteContent`, `NoteAttributeRun`, `NoteParagraphStyle` etc. These can be constructed programmatically:
```swift
var note = NoteContent()
note.noteText = "Hello **bold** world"
var run1 = NoteAttributeRun()
run1.length = 6  // "Hello "
var run2 = NoteAttributeRun()
run2.length = 4  // "bold"
run2.fontWeight = 1  // bold
// ... etc
```
Then wrap in NoteStoreProto.document.note, serialize, gzip-compress, pass to `ProtobufToMarkdown.extract(zdata:snippet:)`.

### SyncManager State Persistence
SyncManager uses `JSONEncoder` to serialize CKSyncEngine.State. The state object can be tested by:
1. Creating a mock state via `CKSyncEngine.State(serializedState:)` with known bytes
2. Verifying the persistence path writes/reads correctly
3. Verifying offline queue JSON persists to `sync-queue.json` path

### NotesAdapter Fixture Schema
Key tables from Apple's NoteStore.sqlite:
- `ZICCLOUDSYNCINGOBJECT` — notes, folders, attachments
- `ZICNOTEDATA` — note body data (ZDATA gzip blob, ZSNIPPET text)
- `ZICATTACHMENT` — attachment metadata (ZTYPEUTI, ZFILENAME)
Columns: ZTITLE1 (older macOS), ZTITLE2 (newer), ZFOLDER (FK to folder Z_PK), ZISPASSWORDPROTECTED
</specifics>

<deferred>
## Deferred Ideas

- CalendarAdapter/RemindersAdapter tests (EventKit mocking is heavy — defer to Phase 111)
- SyncManager end-to-end with real CloudKit sandbox (requires App Store Connect setup)
- NotesAdapter tests against real user NoteStore.sqlite (privacy/portability concerns)
</deferred>

---

*Phase: 119-swift-critical-path-tests*
*Context gathered: 2026-03-22 via conversation analysis*
