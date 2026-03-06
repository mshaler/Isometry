---
phase: 36-notes-content-extraction
plan: 01
subsystem: etl
tags: [swift, protobuf, gzip, zlib, swiftprotobuf, markdown, apple-notes]

# Dependency graph
requires:
  - phase: 35-notes-adapter
    provides: "NotesAdapter with SQLite3 C API, schema detection, folder hierarchy, hashtag extraction"
provides:
  - "NoteStoreProto.pb.swift: SwiftProtobuf message types for notestore.proto deserialization"
  - "GzipDecompressor.swift: zlib C API gzip decompression with MAX_WBITS+32"
  - "ProtobufToMarkdown.swift: AttributeRun walker with three-tier fallback, full Markdown reconstruction"
affects: [36-02-integration, notes-body-extraction, protobuf-parsing]

# Tech tracking
tech-stack:
  added: [SwiftProtobuf 1.28+, zlib C API]
  patterns: [three-tier-fallback, attributerun-walker, nonisolated-struct-sendable, uti-human-type-mapping]

key-files:
  created:
    - native/Isometry/Isometry/NoteStoreProto.pb.swift
    - native/Isometry/Isometry/GzipDecompressor.swift
    - native/Isometry/Isometry/ProtobufToMarkdown.swift
  modified:
    - native/Isometry/Isometry.xcodeproj/project.pbxproj
    - native/Isometry/Isometry/CalendarAdapter.swift

key-decisions:
  - "SwiftProtobuf 1.28+ (not 2.0 -- 2.0 does not exist yet); hand-written conformance since protoc-gen-swift plugin not installed"
  - "Types named with Note prefix (NoteDocument, NoteContent, NoteAttributeRun, etc.) to avoid SwiftUI naming collisions"
  - "nonisolated structs + nonisolated extensions required for SwiftProtobuf Sendable/Hashable conformance under SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor"
  - "Tables render as [Table] placeholder per user-approved deferral of CRDT-based MergableDataProto parsing"

patterns-established:
  - "Three-tier fallback: full Markdown -> plain text + hashtags -> ZSNIPPET (maximizes extraction on partial failure)"
  - "nonisolated struct + nonisolated extension pattern for SwiftProtobuf types under default MainActor isolation"
  - "UTI -> human-friendly type mapping (Image, Drawing, PDF, Audio, Video, Gallery, Table, Contact, Link, Scan, Attachment)"
  - "Note link detection: applenotes:, notes://, x-coredata:// URL patterns"

requirements-completed: [BODY-01, BODY-02, BODY-03]

# Metrics
duration: 10m 5s
completed: 2026-03-06
---

# Phase 36 Plan 01: Protobuf Extraction Infrastructure Summary

**SwiftProtobuf-generated types from notestore.proto, gzip decompressor via zlib C API, and ProtobufToMarkdown converter with full AttributeRun walker and three-tier fallback**

## Performance

- **Duration:** 10m 5s
- **Started:** 2026-03-06T18:57:15Z
- **Completed:** 2026-03-06T19:07:20Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- SwiftProtobuf SPM dependency added to Xcode project; hand-written .pb.swift conformance with all 9 protobuf message types (NoteStoreProto, NoteDocument, NoteContent, NoteAttributeRun, NoteParagraphStyle, NoteChecklist, NoteFont, NoteColor, NoteAttachmentInfo)
- GzipDecompressor using zlib C API with MAX_WBITS+32 for automatic gzip header detection (not Foundation .zlib which fails on gzip format)
- ProtobufToMarkdown converter with full AttributeRun walker implementing all paragraph styles (-1 body, 0 title, 1 heading, 2 subheading, 4 monospaced, 100-103 lists/checklists), inline formatting (bold/italic/strikethrough), note-to-note link detection, attachment placeholders with UTI mapping, hashtag re-extraction, summary generation, and ## Attachments section
- Three-tier fallback cascade: full Markdown -> plain text + hashtags -> ZSNIPPET with snippet-only tag

## Task Commits

Each task was committed atomically:

1. **Task 1: SwiftProtobuf dependency + NoteStoreProto.pb.swift + GzipDecompressor** - `d82f8663` (feat)
2. **Task 2: ProtobufToMarkdown converter with three-tier fallback** - `4cade2fd` (feat)

## Files Created/Modified
- `native/Isometry/Isometry/NoteStoreProto.pb.swift` - Hand-written SwiftProtobuf conformance for 9 protobuf message types from notestore.proto schema
- `native/Isometry/Isometry/GzipDecompressor.swift` - Gzip decompression utility using zlib C API with MAX_WBITS+32 auto-detection
- `native/Isometry/Isometry/ProtobufToMarkdown.swift` - AttributeRun walker with three-tier fallback, full Markdown reconstruction, attachment/link handling
- `native/Isometry/Isometry.xcodeproj/project.pbxproj` - SwiftProtobuf 1.28+ SPM dependency added
- `native/Isometry/Isometry/CalendarAdapter.swift` - Fixed pre-existing optional chaining on non-optional EKParticipant.url

## Decisions Made
- Used SwiftProtobuf 1.28+ (not 2.0 as plan suggested -- 2.0.0 does not exist on the swift-protobuf repo; latest is 1.35.1)
- Hand-wrote SwiftProtobuf Message conformance instead of using protoc-gen-swift (plugin not installed); schema is stable and well-documented
- Named types with Note prefix (NoteDocument, NoteContent, NoteAttributeRun, etc.) to avoid conflicts with SwiftUI.Font, SwiftUI.Color, and other system types
- Used nonisolated struct declarations and nonisolated extensions to satisfy SwiftProtobuf's Sendable+Hashable requirements under the project's SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor setting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CalendarAdapter optional chaining on non-optional URL**
- **Found during:** Task 1 (Xcode build verification)
- **Issue:** CalendarAdapter.swift line 254 used `participant.url?.absoluteString` but EKParticipant.url is non-optional (URL, not URL?)
- **Fix:** Changed to `participant.url.absoluteString`
- **Files modified:** native/Isometry/Isometry/CalendarAdapter.swift
- **Verification:** Build succeeds with zero errors
- **Committed in:** d82f8663 (Task 1 commit)

**2. [Rule 3 - Blocking] SwiftProtobuf version corrected from 2.0.0 to 1.28.0**
- **Found during:** Task 1 (SPM dependency resolution)
- **Issue:** Plan specified SwiftProtobuf 2.0.0 but no such version exists; latest is 1.35.1
- **Fix:** Changed minimumVersion in pbxproj from 2.0.0 to 1.28.0
- **Files modified:** native/Isometry/Isometry.xcodeproj/project.pbxproj
- **Verification:** SPM resolves 1.35.1 successfully, build succeeds
- **Committed in:** d82f8663 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered
- SwiftProtobuf Message protocol requires _MessageImplementationBase, _ProtoNameProviding, and _protobuf_nameMap -- discovered by examining actual generated .pb.swift code in the resolved package
- Project uses SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor (Xcode 26.3), requiring nonisolated on all protobuf struct declarations and extensions to satisfy Sendable/Hashable conformance

## User Setup Required
None - SwiftProtobuf is resolved automatically via Xcode SPM on first build.

## Next Phase Readiness
- All three infrastructure files ready for Plan 02 to wire into NotesAdapter
- Plan 02 needs to: add ZICNOTEDATA JOIN to notes query, call ProtobufToMarkdown.extract() per row, pass attachment lookup map, create note-link: source_url cards, extend TS handler for note-link: prefix
- NoteStoreProto deserialization pattern: `try NoteStoreProto(serializedBytes: decompressedData)`

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 36-notes-content-extraction*
*Completed: 2026-03-06*
