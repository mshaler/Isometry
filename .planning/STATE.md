---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: SuperStack
status: unknown
last_updated: "2026-03-06T19:26:00.242Z"
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 17
  completed_plans: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v4.0 Native ETL -- COMPLETE. All 4 phases (33-36) done.

## Current Position

Phase: 36 of 36 (Notes Content Extraction)
Plan: 2 of 2 (COMPLETE)
Status: v4.0 milestone complete
Last activity: 2026-03-06 -- Phase 36 Plan 02 complete (integration + WebBundle rebuild)

Progress: [##########] 100% (v4.0 -- 4/4 phases complete, all 8 plans done)

## Performance Metrics

**Velocity:**
- Total plans completed: 13 (v3.1 Phases 28-30, v4.0 Phases 33-36)
- Phase 29 Plan 01: 5m 17s, 2 tasks, 5 files
- Phase 29 Plan 02: 7m, 1 task, 1 file
- Phase 33 Plan 01: 3m 37s, 2 tasks, 5 files
- Phase 33 Plan 02: 5m 32s, 2 tasks, 8 files
- Phase 30 Plan 01: 4m 15s, 2 tasks, 3 files
- Phase 30 Plan 02: 6m 15s, 1 task, 2 files
- Phase 30 Plan 03: 12m 20s, 2 tasks, 3 files
- Phase 33 Plan 03: ~20m, 3 tasks, 6 files
- Phase 34 Plans 01-03 + Phase 35 Plan 01: Merged parallel execution, ~25m total
- Phase 36 Plan 01: 10m 5s, 2 tasks, 5 files
- Phase 36 Plan 02: 5m 51s, 2 tasks, 6 files

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.
All v3.0 SuperGrid decisions documented in PROJECT.md Key Decisions table.

- v3.1 Phase 28-30 completed
- v4.0 Phase 33 completed: Native ETL Foundation (NativeImportAdapter protocol, PermissionManager, CoreDataTimestampConverter, chunked bridge pipeline, MockAdapter validation)
- v4.0 Phase 34 completed: RemindersAdapter (EventKit), CalendarAdapter (EventKit + attendee person cards + link cards)
- v4.0 Phase 35 completed: NotesAdapter (direct SQLite3 C API, schema version detection, folder hierarchy, encrypted note skip)
- Notes adapter uses raw SQLite3 C API (not GRDB) with copy-then-read strategy for WAL-safe access
- Attendee connections use "link cards" with source_url="attendee-of:{eventSourceId}" convention — TypeScript handler auto-creates CanonicalConnection records
- EKParticipant.url is non-optional (URL, not URL?) — no guard-let needed
- EKReminder.structuredLocation is on EKAlarm, not EKReminder — access via reminder.alarms?.first(where:)
- PermissionManager is an actor — cannot call copyDatabaseToTemp() synchronously; NotesAdapter inlines copy logic
- CalendarAdapter link cards must be appended to allCards (not discarded with _ = linkCard)
- SwiftProtobuf 1.28+ (not 2.0 -- latest is 1.35.1); hand-written .pb.swift conformance with nonisolated structs
- Protobuf types use Note prefix (NoteDocument, NoteContent, NoteAttributeRun) to avoid SwiftUI naming collisions
- nonisolated struct + nonisolated extension pattern required for SwiftProtobuf Sendable/Hashable under MainActor default isolation
- Tables render as [Table] placeholder (CRDT-based MergableDataProto parsing deferred per user approval)
- v4.0 Phase 36 completed: Notes Content Extraction (protobuf body extraction, attachment metadata, note-to-note link connections)
- Colon-delimited source_id format ("notelink:{sourceZID}:{targetZID}") for multi-identifier link cards -- colons safe because ZIDENTIFIERs are UUIDs
- Batch attachment metadata query (all attachments upfront) instead of per-note queries
- ZNOTEDATA column existence detected via schema detection for graceful handling of older NoteStore.sqlite versions
- WebBundle must be built with vite.config.native.ts (app mode) not vite.config.ts (lib mode)
- Note-link connections are bidirectional: links_to (weight 0.5) + linked_from (weight 0.3)

### Pending Todos

None.

### Blockers/Concerns

- SourceKit "Cannot find type" errors for CanonicalCard etc. are expected until files are added to the Xcode project
- Note-to-note link URL format(s) not verified against actual user data -- multiple patterns supported (applenotes:, notes://, x-coredata://)
- macOS build fails due to pre-existing provisioning profile issue (not code-related)

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed Phase 36 Plan 02 (v4.0 milestone complete)
Resume: v4.0 Native ETL milestone complete. All 4 phases (33-36), 8 plans done. Notes import now has full body text, attachment metadata, note-to-note link connections, and FTS5 searchability.
