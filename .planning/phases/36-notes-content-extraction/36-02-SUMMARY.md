---
phase: 36-notes-content-extraction
plan: 02
subsystem: etl
tags: [swift, typescript, protobuf, notes-adapter, note-links, attachments, body-extraction, fts5]

# Dependency graph
requires:
  - phase: 36-notes-content-extraction
    plan: 01
    provides: "NoteStoreProto.pb.swift, GzipDecompressor.swift, ProtobufToMarkdown.swift with three-tier fallback"
  - phase: 35-notes-adapter
    provides: "NotesAdapter with SQLite3 C API, schema detection, folder hierarchy, hashtag extraction"
  - phase: 34-calendar-reminders
    provides: "CalendarAdapter attendee link card pattern, etl-import-native.handler.ts auto-connection creation"
provides:
  - "Full body text extraction from Apple Notes protobuf ZDATA blobs via NotesAdapter"
  - "Attachment metadata lookup map with batch query for ZTYPEUTI + ZFILENAME"
  - "Note-to-note link cards with colon-delimited source_id (notelink:{sourceZID}:{targetZID})"
  - "Placeholder cards for unresolved link targets (encrypted/deleted notes)"
  - "Bidirectional note-link connections in etl-import-native.handler.ts (links_to 0.5, linked_from 0.3)"
  - "Rebuilt WebBundle with updated handler"
affects: [notes-import, fts5-search, graph-visualization]

# Tech tracking
tech-stack:
  added: []
  patterns: [zdata-join-pattern, attachment-batch-lookup, colon-delimited-source-id, note-link-prefix-convention, placeholder-card-pattern]

key-files:
  created: []
  modified:
    - native/Isometry/Isometry/NotesAdapter.swift
    - src/worker/handlers/etl-import-native.handler.ts
    - native/Isometry/Isometry/WebBundle/index.html
    - native/Isometry/Isometry/WebBundle/assets/index-DMk3n-JE.js
    - native/Isometry/Isometry/WebBundle/assets/worker-CwPZlyDC.js
    - native/Isometry/Isometry.xcodeproj/project.pbxproj

key-decisions:
  - "Colon-delimited source_id format (notelink:{sourceZID}:{targetZID}) enables clean split(':') parsing on TS side -- safe because ZIDENTIFIERs are UUIDs (no colons)"
  - "Batch attachment metadata query (all attachments upfront) instead of per-note queries for performance"
  - "ZNOTEDATA column existence detected via schema detection to gracefully handle databases without ZICNOTEDATA table"
  - "WebBundle built with vite.config.native.ts (app mode with index.html entry) not vite.config.ts (lib mode)"

patterns-established:
  - "ZDATA JOIN pattern: LEFT JOIN ZICNOTEDATA nd ON n.ZNOTEDATA = nd.Z_PK for protobuf blob access"
  - "Attachment batch lookup: single query for all ZTYPEUTI+ZFILENAME metadata, passed to ProtobufToMarkdown.extract()"
  - "Colon-delimited source_id for multi-identifier link cards: notelink:{sourceZID}:{targetZID}"
  - "note-link: prefix convention (parallel to attendee-of:) for auto-connection creation on TS side"
  - "Placeholder cards with card_type 'collection' for unresolved note link targets"

requirements-completed: [BODY-01, BODY-02, BODY-03, BODY-04, BODY-05]

# Metrics
duration: 5m 51s
completed: 2026-03-06
---

# Phase 36 Plan 02: Notes Content Integration Summary

**Full protobuf body extraction wired into NotesAdapter with ZDATA JOIN, attachment metadata batch lookup, note-link cards with colon-delimited source_id, and bidirectional TS-side connection creation**

## Performance

- **Duration:** 5m 51s
- **Started:** 2026-03-06T19:14:21Z
- **Completed:** 2026-03-06T19:20:12Z
- **Tasks:** 2
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments
- NotesAdapter now JOINs ZICNOTEDATA for ZDATA blobs and calls ProtobufToMarkdown.extract() per note for full body text with three-tier fallback (full Markdown -> plain text -> ZSNIPPET)
- Attachment metadata batch-queried upfront (ZTYPEUTI + ZFILENAME from ZICCLOUDSYNCINGOBJECT self-join) and passed to protobuf converter for inline placeholders and ## Attachments section
- Note-to-note link cards emitted with colon-delimited source_id ("notelink:{sourceZID}:{targetZID}") and source_url ("note-link:{targetZID}") convention
- Placeholder cards created for unresolved link targets (encrypted/deleted notes) with card_type "collection"
- TypeScript handler extended with note-link: prefix for bidirectional connection creation (links_to weight 0.5, linked_from weight 0.3)
- WebBundle rebuilt with native Vite config and updated index.html asset references
- Import summary logs breakdown: "N notes (X full body, Y snippet fallback, Z encrypted skipped)"

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend NotesAdapter with ZDATA reading, protobuf extraction, attachment metadata, note-link cards** - `ebf855e8` (feat)
2. **Task 2: Extend TypeScript handler for note-link: connections + rebuild WebBundle** - `4dac9b0f` (feat)

## Files Created/Modified
- `native/Isometry/Isometry/NotesAdapter.swift` - Extended with ZICNOTEDATA JOIN, ProtobufToMarkdown.extract() integration, attachment batch lookup, note-link card emission, placeholder cards, extraction statistics
- `src/worker/handlers/etl-import-native.handler.ts` - Added note-link: prefix handling with colon-delimited source_id parsing and bidirectional connection creation
- `native/Isometry/Isometry/WebBundle/index.html` - Updated asset references for rebuilt bundle
- `native/Isometry/Isometry/WebBundle/assets/index-DMk3n-JE.js` - Rebuilt main app bundle
- `native/Isometry/Isometry/WebBundle/assets/worker-CwPZlyDC.js` - Rebuilt worker bundle with note-link handler
- `native/Isometry/Isometry.xcodeproj/project.pbxproj` - Updated fileSystemSynchronizedBuildFileExceptionSet for new asset hashes

## Decisions Made
- Used colon-delimited source_id format ("notelink:{sourceZID}:{targetZID}") instead of dash-delimited, because Apple ZIDENTIFIERs are UUIDs containing dashes but never colons -- makes split(':') parsing reliable on TS side
- Batch-queried all attachment metadata upfront (single SQL query) rather than per-note queries -- reduces SQLite round-trips for databases with many attachments
- Added ZNOTEDATA column detection to NoteStoreSchema to gracefully handle older NoteStore.sqlite versions that may lack the ZICNOTEDATA table
- Used `vite build --config vite.config.native.ts` (app mode) for WebBundle build, not the default `npm run build` which uses lib mode and produces non-HTML output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used native Vite config for WebBundle build**
- **Found during:** Task 2 (WebBundle rebuild)
- **Issue:** `npm run build` uses vite.config.ts (lib mode) which outputs `isometry.js` + root-level chunks without index.html. The native app needs app-mode output with index.html entry point.
- **Fix:** Used `npx vite build --config vite.config.native.ts` which outputs to dist-native/ with proper index.html and assets/ structure
- **Files modified:** WebBundle directory (build artifact)
- **Verification:** Xcode build succeeds; index.html correctly references new asset hashes

**2. [Rule 3 - Blocking] Cleaned old hashed WebBundle files to avoid Xcode duplicate error**
- **Found during:** Task 2 (Xcode build verification after WebBundle copy)
- **Issue:** Xcode's fileSystemSynchronizedGroups detected duplicate `xlsx-CF422ARu.js` files in both WebBundle root and assets/, causing "Multiple commands produce" build error
- **Fix:** Cleaned all old hashed JS/CSS/WASM/JSON files from WebBundle before copying fresh build output
- **Files modified:** WebBundle directory (build artifact cleanup)
- **Verification:** Xcode build succeeds with no duplicate file errors

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for successful build. No scope creep.

## Issues Encountered
- The plan specified `xcodebuild -destination 'platform=macOS' build` for verification, but macOS build has a pre-existing provisioning profile issue. Used iOS Simulator destination instead, which is the established pattern from Plan 01.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 36 is now complete: all BODY-01 through BODY-05 requirements implemented
- Full body text, attachment metadata, note-to-note link connections, and FTS5 searchability all functional
- Import summary reports extraction breakdown (full body / snippet fallback / encrypted skipped)
- No blockers for next phase

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 36-notes-content-extraction*
*Completed: 2026-03-06*
