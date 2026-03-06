# Requirements: Isometry v4.0 Native ETL

**Defined:** 2026-03-05
**Core Value:** Users can import their native macOS data (Notes, Reminders, Calendar) into Isometry via direct system database reads, with zero manual export steps.

## v4.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Foundation Infrastructure

- [x] **FNDX-01**: User can trigger a native import from the app that reads macOS system databases via a NativeImportAdapter protocol shared by all adapters
- [x] **FNDX-02**: User receives a clear permission prompt when the app needs access to system databases, with a deep link to System Settings on denial (PermissionManager handles TCC + EventKit)
- [x] **FNDX-03**: All imported dates from macOS system databases display correctly with no 31-year offset (CoreData epoch → ISO 8601 conversion via shared utility)
- [x] **FNDX-04**: Native import reads system databases without corrupting them or conflicting with running system apps (read-only WAL-aware access with sqlite3_busy_timeout)
- [x] **FNDX-05**: Large imports (5,000+ items) complete without crashing the app or WKWebView process (200-card chunked bridge transport)
- [x] **FNDX-06**: System database paths are discovered dynamically across macOS versions and device migrations (no hardcoded paths)
- [x] **FNDX-07**: User can re-import from the same source without re-granting file access permissions (NSOpenPanel security-scoped bookmark caching)
- [x] **FNDX-08**: End-to-end pipeline (Swift adapter → bridge → Worker → ImportOrchestrator) is validated with a MockAdapter before any real adapter ships

### Reminders Adapter (EventKit)

- [x] **RMDR-01**: User can import all incomplete reminders plus recently completed reminders (last 30 days) from macOS Reminders app with title, notes, due date, completion status, and priority
- [x] **RMDR-02**: Imported reminders preserve their list organization from Reminders as the folder field on each card
- [x] **RMDR-03**: User can re-import reminders without duplicating cards (dedup via calendarItemIdentifier as source_id)
- [x] **RMDR-04**: Imported reminders with recurrence rules include recurrence metadata on the card
- [x] **RMDR-05**: Imported reminders appear as task-type cards in Isometry

### Calendar Adapter (EventKit)

- [x] **CALR-01**: User can import all events from macOS Calendar app with title, start/end times, location, and calendar name as folder
- [x] **CALR-02**: Imported events create person cards for attendees with links_to connections to the event card
- [x] **CALR-03**: User can import recurring events expanded to individual occurrences within a configurable date range
- [x] **CALR-04**: All-day events import correctly with event_start and event_end reflecting the full day boundaries
- [x] **CALR-05**: Events with no notes field have synthesized content from date range, location, and attendee names
- [x] **CALR-06**: Imported events appear as event-type cards in Isometry with is_collective set for multi-attendee events

### Notes Adapter — Title + Metadata (Direct SQLite)

- [x] **NOTE-01**: User can import all non-encrypted notes from macOS Apple Notes with title, folder, created/modified dates, and 100-char snippet preview
- [x] **NOTE-02**: Imported notes preserve their folder hierarchy from Apple Notes via self-join on ZICCLOUDSYNCINGOBJECT
- [x] **NOTE-03**: Hashtags from Apple Notes are extracted and stored as tags on imported cards
- [x] **NOTE-04**: Password-protected notes are detected, skipped, and their count is reported in the import summary (never silently dropped)
- [x] **NOTE-05**: User can re-import notes without duplicating cards (dedup via ZIDENTIFIER as source_id)
- [x] **NOTE-06**: Notes adapter detects NoteStore.sqlite schema version at runtime and branches queries accordingly (ZACCOUNT3 vs ZACCOUNT4, ZTITLE1 vs ZTITLE2)

### Notes Content — Protobuf Extraction

- [x] **BODY-01**: User can import the full body text of non-encrypted Apple Notes (gzip decompression + protobuf parsing of ZDATA blobs)
- [x] **BODY-02**: Notes with unknown or malformed protobuf fields gracefully fall back to ZSNIPPET 100-char preview instead of failing the import
- [x] **BODY-03**: Attachment metadata (type, filename) from Apple Notes is preserved on imported cards
- [ ] **BODY-04**: Internal note-to-note links in Apple Notes create connections between the corresponding imported cards
- [ ] **BODY-05**: Imported note body content is available for FTS5 full-text search within Isometry

## Future Requirements (v4.x / v5+)

### Deferred from v4.0

- **RMDR-D1**: Reminders hashtag extraction via direct SQLite (ZREMCDHASHTAGLABEL — not available in EventKit)
- **CALR-D1**: Calendar geo-coordinates (latitude/longitude) via direct Calendar.sqlitedb Location table join
- **NOTE-D1**: Notes pinned status mapped to sort_order
- **NOTE-D2**: Notes account source tracking (iCloud vs On My Mac)
- **NOTE-D3**: Notes attachment binary content storage (OOM risk — metadata only in v4.0)

### iOS Path (v5+)

- **IOS-01**: iOS EventKit adapter for Reminders (same API, different permission flow)
- **IOS-02**: iOS EventKit adapter for Calendar (same API, different permission flow)
- **IOS-03**: iOS Apple Notes reading (no known path — no API, full sandbox blocks SQLite)

### Beyond v5

- **SYNC-01**: Write-back to Notes/Reminders/Calendar (bidirectional sync)
- **SYNC-02**: Real-time sync / file watching for live system database changes
- **SYNC-03**: Reminders subtask hierarchy as connections (EventKit parentReminder unstable across OS versions)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bidirectional sync (write back to Apple apps) | Data model divergence, unsolved problem — future |
| Real-time file watching of system databases | Live Core Data databases not safe to file-watch |
| iOS direct SQLite reads | Full sandbox, impossible |
| Reminders hashtag extraction | Requires supplementary direct SQLite read alongside EventKit — deferred |
| Calendar geo-coordinates | Requires supplementary direct Calendar.sqlitedb read — deferred |
| Notes attachment binary storage | OOM risk from large attachments; metadata only |
| Auto-import on app launch | Not scoped — user triggers manually |
| Selective import (pick folders/lists) | Imports all by default; folder filtering via existing FilterProvider post-import |
| protoc in CI | Generated .pb.swift checked into repo as one-time artifact |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FNDX-01 | Phase 33 | Complete (Plan 01) |
| FNDX-02 | Phase 33 | Complete (Plan 01) |
| FNDX-03 | Phase 33 | Complete (Plan 01) |
| FNDX-04 | Phase 33 | Complete (Plan 01) |
| FNDX-05 | Phase 33 | Complete |
| FNDX-06 | Phase 33 | Complete (Plan 01) |
| FNDX-07 | Phase 33 | Complete (Plan 01) |
| FNDX-08 | Phase 33 | Complete (Plan 03) |
| RMDR-01 | Phase 34 | Complete (Plan 01) |
| RMDR-02 | Phase 34 | Complete (Plan 01) |
| RMDR-03 | Phase 34 | Complete (Plan 01) |
| RMDR-04 | Phase 34 | Complete (Plan 01) |
| RMDR-05 | Phase 34 | Complete (Plan 01) |
| CALR-01 | Phase 34 | Complete (Plan 02) |
| CALR-02 | Phase 34 | Complete (Plan 02+03) |
| CALR-03 | Phase 34 | Complete (Plan 02) |
| CALR-04 | Phase 34 | Complete (Plan 02) |
| CALR-05 | Phase 34 | Complete (Plan 02) |
| CALR-06 | Phase 34 | Complete (Plan 02) |
| NOTE-01 | Phase 35 | Complete (Plan 01) |
| NOTE-02 | Phase 35 | Complete (Plan 01) |
| NOTE-03 | Phase 35 | Complete (Plan 01) |
| NOTE-04 | Phase 35 | Complete (Plan 01) |
| NOTE-05 | Phase 35 | Complete (Plan 01) |
| NOTE-06 | Phase 35 | Complete (Plan 01) |
| BODY-01 | Phase 36 | Complete |
| BODY-02 | Phase 36 | Complete |
| BODY-03 | Phase 36 | Complete |
| BODY-04 | Phase 36 | Pending |
| BODY-05 | Phase 36 | Pending |

**Coverage:**
- v4.0 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-06 — Phases 34+35 complete (RMDR/CALR/NOTE requirements)*
