# Feature Research

**Domain:** Native macOS SQLite importers for Apple Notes, Reminders, and Calendar
**Researched:** 2026-03-05
**Confidence:** MEDIUM — Schema structure confirmed via multiple forensic/tooling sources. Exact column names for Reminders date fields are MEDIUM (single-source). Calendar uses non-Z-prefixed table names (verified via kacos2000/queries and tom-juntunen gist). EventKit API changes for macOS 14 confirmed via Apple developer documentation links.

---

## Context: What Already Exists vs. What Is New

**Already built (do not rebuild):**
- `ImportOrchestrator` — routes `CanonicalCard[] + CanonicalConnection[]` into DedupEngine + SQLiteWriter
- `DedupEngine` — idempotent re-import via `source + source_id` matching
- `SQLiteWriter` — 100-card batched parameterized writes with FTS trigger optimization
- `NativeImportAdapter` protocol placeholder (defined in v4.0 requirements, not yet implemented)
- Native file picker wiring through `native:action importFile` bridge message
- `CanonicalCard` 26-field type contract — all adapters must output this shape

**v4.0 adds three native Swift adapters:**
- `NotesAdapter` — reads NoteStore.sqlite directly (Full Disk Access path)
- `RemindersAdapter` — reads via EventKit `EKReminder` (standard permission)
- `CalendarAdapter` — reads via EventKit `EKEvent` OR direct Calendar.sqlitedb (two viable approaches)

Each adapter outputs `CanonicalCard[]` JSON through the existing WKWebView bridge to `ImportOrchestrator`.

---

## Source Database Schemas

### Apple Notes — NoteStore.sqlite

**Location:** `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`
**Permission required:** Full Disk Access (`kTCCServiceSystemPolicyAllFiles`) — standard TCC prompt

**Primary tables:**

| Table | Role |
|-------|------|
| `ZICNOTEDATA` | Binary note content — `ZDATA` is gzip-compressed protobuf |
| `ZICCLOUDSYNCINGOBJECT` | All metadata — notes, folders, accounts, attachments (all entity types in one polymorphic table) |

**Key columns in `ZICCLOUDSYNCINGOBJECT` (self-joins to reconstruct hierarchy):**

For the note row (entity type = note):
- `Z_PK` — internal primary key
- `ZIDENTIFIER` — stable UUID for source_id
- `ZTITLE1` — note title
- `ZSNIPPET` — plain-text preview (first ~100 chars, Apple-generated, no protobuf needed)
- `ZCREATIONDATE1` — seconds since 2001-01-01 (Core Data time format)
- `ZMODIFICATIONDATE1` — seconds since 2001-01-01
- `ZLASTVIEWEDMODIFICATIONDATE` — last viewed timestamp
- `ZISPASSWORDPROTECTED` — 1 if locked (skip or flag)
- `ZISPINNED` — pinned status
- `ZACCOUNT2` — FK to account row (iCloud vs On My Mac)

For the folder row (joined via `ZACCOUNT2` chain):
- `ZTITLE2` — folder name (maps to `folder` in CanonicalCard)
- `ZIDENTIFIER` — folder UUID
- `ZACCOUNT3` or `ZACCOUNT4` — FK to account row (version-dependent column name)

For the account row:
- `ZNAME` — account name (e.g., "iCloud", "On My Mac")
- `ZACCOUNTTYPE` — account type integer

**Content extraction from `ZICNOTEDATA`:**
- `ZNOTE` — FK back to note's `Z_PK`
- `ZDATA` — gzip-compressed protobuf blob
- Decompress with `zlib` (available in Foundation), parse with `swift-protobuf`
- Protobuf schema is reverse-engineered (not public) — field IDs are known from community tools
- `ZSNIPPET` in ZICCLOUDSYNCINGOBJECT provides plain text preview WITHOUT protobuf parsing

**CoreTime timestamp conversion:** `Date(timeIntervalSinceReferenceDate: ZCREATIONDATE1)` — Swift's `Date(timeIntervalSinceReferenceDate:)` uses 2001-01-01 as epoch, matching Apple's CoreData format directly.

**Schema version detection:** `ZACCOUNT3` vs `ZACCOUNT4` column determines which JOIN path to use. Query `PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)` at adapter init to branch.

---

### Reminders — Core Data SQLite

**Location:** `~/Library/Group Containers/group.com.apple.reminders/Container_v1/Stores/Data-[UUID].sqlite`
**Permission:** EventKit `NSRemindersFullAccessUsageDescription` — standard per-app permission prompt (iOS 17+ / macOS 14+ API)

**Recommended approach: EventKit framework (`EKReminder`)** rather than direct SQLite, because:
1. Apple explicitly discourages direct SQLite access for Reminders/Calendar
2. Tags (hashtags) are not exposed in `EKReminder` API — requires direct SQLite for tag extraction
3. EventKit handles schema version differences across macOS releases automatically

**EventKit `EKReminder` properties available:**

| Property | Type | Maps To |
|----------|------|---------|
| `calendarItemIdentifier` | String | `source_id` |
| `title` | String | `name` |
| `notes` | String? | `content` |
| `calendar.title` | String | `folder` (list name) |
| `dueDateComponents` | DateComponents? | `due_at` |
| `startDateComponents` | DateComponents? | `created_at` proxy |
| `completionDate` | Date? | `completed_at` |
| `isCompleted` | Bool | `status = 'completed'` or `'open'` |
| `priority` | Int | `priority` (EK: 0=none, 1-4=high, 5=medium, 6-9=low) |
| `alarms` | [EKAlarm]? | not mapped (no CanonicalCard field) |
| `hasRecurrenceRules` | Bool | metadata only |
| `creationDate` | Date? | `created_at` |
| `lastModifiedDate` | Date? | `modified_at` |
| `calendar.calendarIdentifier` | String | provenance tracking |

**Direct SQLite approach (needed only for tags):**

Primary table: `ZREMCDREMINDER`
- `ZCKIDENTIFIER` / `ZDACALENDARITEMUNIQUEIDENTIFIER` — stable UUID
- `ZTITLE` — title
- `ZNOTES` — notes text
- `ZCOMPLETED` — 0 or 1
- `ZFLAGGED` — flagged status
- `ZPRIORITY` — numeric priority
- `ZLIST` — FK to list

Tag tables (not in EventKit API):
- `ZREMCDHASHTAGLABEL` — `ZNAME` column contains tag text
- `ZREMCDOBJECT` with `Z_ENT = 24` — hashtag association rows

**Priority mapping:** EKReminder priority 0 = none → CanonicalCard priority 0; 1-4 = high → priority 3; 5 = medium → priority 2; 6-9 = low → priority 1.

---

### Calendar — Calendar.sqlitedb

**Location (modern macOS 14+):** `~/Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb`
**Location (older):** `~/Library/Calendars/Calendar.sqlitedb`
**Permission:** EventKit `NSCalendarsFullAccessUsageDescription` — standard per-app permission prompt (iOS 17+ / macOS 14+ API)

**Recommended approach: EventKit framework (`EKEvent`)** for same reasons as Reminders (schema stability, Apple support). Direct SQLite is viable for enrichment (attendee email list).

**EventKit `EKEvent` properties available:**

| Property | Type | Maps To |
|----------|------|---------|
| `calendarItemIdentifier` | String | `source_id` |
| `title` | String | `name` |
| `notes` | String? | `content` |
| `location` | String? | `location_name` |
| `url` | URL? | `url` |
| `startDate` | Date | `event_start` |
| `endDate` | Date | `event_end` |
| `isAllDay` | Bool | informs `event_start`/`event_end` formatting |
| `calendar.title` | String | `folder` (calendar name) |
| `calendar.calendarIdentifier` | String | provenance tracking |
| `organizer?.name` | String? | not mapped directly |
| `attendees` | [EKParticipant]? | `is_collective = true` if attendees present |
| `creationDate` | Date? | `created_at` |
| `lastModifiedDate` | Date? | `modified_at` |
| `hasRecurrenceRules` | Bool | metadata only |
| `status` | EKEventStatus | `status` field (none/confirmed/tentative/cancelled) |

**Direct SQLite table `calendaritem` columns (verified):**

| Column | Type | Maps To |
|--------|------|---------|
| `summary` | TEXT | `name` |
| `description` | TEXT | `content` |
| `start_date` | REAL | `event_start` (seconds since 2001-01-01) |
| `end_date` | REAL | `event_end` |
| `creation_date` | REAL | `created_at` |
| `all_day` | INTEGER | format modifier |
| `location_id` | INTEGER | FK to `Location` table |
| `organizer_id` | INTEGER | FK to `Participant` table |
| `has_recurrences` | INTEGER | metadata |
| `due_date` | REAL | `due_at` (for task-type items) |
| `calendar_id` | INTEGER | FK to `Calendar` table |

**Direct SQLite table `Location` columns:**
- `title` — location name → `location_name`
- `address` — full address text
- `latitude`, `longitude` → `latitude`, `longitude`

**Direct SQLite table `Participant` columns:**
- `email` → not in CanonicalCard (no email field)
- `is_self` — identifies organizer

**Direct SQLite table `Calendar` columns:**
- `title` → `folder`
- `store_id` → FK to `Store`

**Date conversion:** `calendaritem` dates are seconds since 2001-01-01, same as CoreData. SQL: `datetime('2001-01-01', start_date || ' seconds')`. In Swift: `Date(timeIntervalSinceReferenceDate: start_date)`.

---

## CanonicalCard Field Mapping by Source

### Notes → CanonicalCard

| CanonicalCard Field | Source | Notes |
|--------------------|--------|-------|
| `id` | Generated UUID | New UUID per import run |
| `card_type` | Hardcoded `'note'` | Always note |
| `name` | `ZTITLE1` | Note title |
| `content` | Protobuf ZDATA (plain text extract) OR `ZSNIPPET` (preview) | ZSNIPPET is table stakes; full protobuf is differentiator |
| `summary` | `ZSNIPPET` | Always available without protobuf |
| `created_at` | `ZCREATIONDATE1` (CoreTime conversion) | |
| `modified_at` | `ZMODIFICATIONDATE1` | |
| `folder` | `ZTITLE2` from folder row | Via self-join on ZICCLOUDSYNCINGOBJECT |
| `source` | `'apple_notes'` | Fixed string |
| `source_id` | `ZIDENTIFIER` | Stable across re-imports |
| `tags` | `[]` | Not stored in NoteStore.sqlite directly |
| `status` | `null` | No status concept in Notes |
| `priority` | `0` | No priority concept in Notes |
| `latitude` | `null` | Notes has location attachments but not on note itself |
| `longitude` | `null` | Same |
| `due_at` | `null` | |
| `completed_at` | `null` | |
| `event_start` | `null` | |
| `event_end` | `null` | |
| `url` | `ZURLSTRING` from attachment rows | Linked URL attachments only |
| `is_collective` | `false` | |
| `deleted_at` | `null` | Soft delete is Isometry-side only |

**Fields NOT mappable:** `location_name`, `latitude`, `longitude`, `tags`, `sort_order`, `mime_type`

---

### Reminders → CanonicalCard

| CanonicalCard Field | Source | Notes |
|--------------------|--------|-------|
| `id` | Generated UUID | |
| `card_type` | Hardcoded `'task'` | Always task |
| `name` | `EKReminder.title` | |
| `content` | `EKReminder.notes` | |
| `summary` | First 160 chars of notes | Client-generated |
| `created_at` | `EKReminder.creationDate` | May be null; fall back to import time |
| `modified_at` | `EKReminder.lastModifiedDate` | |
| `due_at` | `EKReminder.dueDateComponents` → ISO 8601 | DateComponents → Date conversion needed |
| `completed_at` | `EKReminder.completionDate` | |
| `status` | `'completed'` or `'open'` | From `isCompleted` |
| `priority` | Mapped from EKReminder.priority (see table above) | |
| `folder` | `EKReminder.calendar.title` | Reminders "list" name |
| `source` | `'apple_reminders'` | |
| `source_id` | `EKReminder.calendarItemIdentifier` | |
| `tags` | `[]` via EventKit; requires direct SQLite for hashtag extraction | |
| `latitude` | `null` | Location-based reminders not mapped |
| `longitude` | `null` | |
| `location_name` | `null` | Location text not in EKReminder.notes |
| `event_start` | `null` | |
| `event_end` | `null` | |
| `url` | `null` | EKReminder has no url property |
| `is_collective` | `false` | |

**Fields NOT mappable without direct SQLite:** `tags` (hashtags only in ZREMCDHASHTAGLABEL)

---

### Calendar → CanonicalCard

| CanonicalCard Field | Source | Notes |
|--------------------|--------|-------|
| `id` | Generated UUID | |
| `card_type` | Hardcoded `'event'` | Always event |
| `name` | `EKEvent.title` | |
| `content` | `EKEvent.notes` | |
| `summary` | First 160 chars of notes | Client-generated |
| `created_at` | `EKEvent.creationDate` | |
| `modified_at` | `EKEvent.lastModifiedDate` | |
| `event_start` | `EKEvent.startDate` → ISO 8601 | |
| `event_end` | `EKEvent.endDate` → ISO 8601 | |
| `location_name` | `EKEvent.location` | Plain string only from EventKit |
| `latitude` | `null` via EventKit; `Location.latitude` via direct SQLite | Differentiator |
| `longitude` | `null` via EventKit; `Location.longitude` via direct SQLite | Differentiator |
| `url` | `EKEvent.url?.absoluteString` | |
| `folder` | `EKEvent.calendar.title` | Calendar name |
| `status` | `EKEvent.status` → `'confirmed'`, `'tentative'`, `'cancelled'` | |
| `is_collective` | `true` if `EKEvent.attendees != nil && !attendees.isEmpty` | |
| `source` | `'apple_calendar'` | |
| `source_id` | `EKEvent.calendarItemIdentifier` | |
| `tags` | `[]` | Not applicable |
| `priority` | `0` | No priority concept in Calendar |
| `due_at` | `null` | |
| `completed_at` | `null` | |

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are the minimum each adapter must provide. Missing these = adapter is not useful.

| Feature | Why Expected | Complexity | Source |
|---------|--------------|------------|--------|
| **Notes: Title + snippet content** | Users importing Notes expect the note title and readable text. ZSNIPPET is always available without protobuf; title from ZTITLE1. | LOW | ZICCLOUDSYNCINGOBJECT direct read |
| **Notes: Folder hierarchy** | Notes are organized in folders. Without folder mapping, all notes land in the same bucket — no LATCH grouping possible. | LOW | Self-join on ZICCLOUDSYNCINGOBJECT using ZACCOUNT2 chain |
| **Notes: Creation + modification timestamps** | Time-based LATCH filtering (calendar view, timeline) requires timestamps. | LOW | ZCREATIONDATE1, ZMODIFICATIONDATE1 (CoreTime conversion) |
| **Notes: Skip password-protected notes** | Importing encrypted notes would fail at the ZDATA decompression step. Silently skipping them with a count in import results is expected behavior. | LOW | Check ZISPASSWORDPROTECTED = 1, skip with log |
| **Notes: Schema version detection** | ZACCOUNT3 vs ZACCOUNT4 column varies by macOS version. Attempting the wrong JOIN crashes the query. | LOW | PRAGMA table_info() at init |
| **Reminders: Title + notes + list** | Core reminder data. Title maps to name, notes to content, list name to folder. | LOW | EKReminder.title, .notes, .calendar.title |
| **Reminders: Due date + completion status** | The primary value of importing tasks is seeing what is due and what is done. | LOW | EKReminder.dueDateComponents, .isCompleted, .completionDate |
| **Reminders: Priority** | Reminders has a priority field (high/medium/low/none). CanonicalCard has priority 0-3. Mapping is required. | LOW | EKReminder.priority (0/1-4/5/6-9) → CanonicalCard (0/1/2/3) |
| **Calendar: Event title + start/end dates** | The minimum for a calendar event to be useful in Isometry's timeline, calendar, and SuperGrid views. | LOW | EKEvent.title, .startDate, .endDate |
| **Calendar: Calendar name → folder** | Users organize events across multiple calendars. The calendar name must map to folder for LATCH grouping. | LOW | EKEvent.calendar.title |
| **Calendar: Location string** | Events frequently have location text. location_name field is available in CanonicalCard. | LOW | EKEvent.location |
| **TCC permission flow** | All three adapters require user permission. The permission request must be graceful: request once, store result, surface a helpful error if denied. | MEDIUM | NSRemindersFullAccessUsageDescription, NSCalendarsFullAccessUsageDescription in Info.plist; Full Disk Access prompt for Notes |
| **DedupEngine compatibility** | Re-importing the same source must produce insert/update/skip classifications, not duplicates. source_id must be stable across imports. | LOW | Use ZIDENTIFIER (Notes), calendarItemIdentifier (EK); already handled by DedupEngine |
| **Bridge output format** | All three adapters output CanonicalCard[] as JSON through the native:action bridge to ImportOrchestrator. Format must match exactly. | LOW | Existing bridge protocol; serialize to JSON with JSONSerialization |

### Differentiators (Competitive Advantage)

Features that exceed the baseline and make the adapters genuinely powerful in Isometry's PAFV model.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Notes: Full protobuf content extraction** | ZSNIPPET is limited to ~100 chars. Full protobuf parse yields the complete note body as plain text, enabling FTS5 search across the full content and richer card detail views. | HIGH | Requires swift-protobuf dependency; reverse-engineered schema; gzip → protobuf → plaintext pipeline. Encrypted notes remain skipped. |
| **Notes: Pinned status** | ZISPINNED maps to sort_order = 1 (pinned) vs 0 (not pinned). Users rely on pinned notes heavily; preserving this in SuperGrid sorts is a meaningful data fidelity win. | LOW | ZISPINNED column, directly available |
| **Notes: Account source tracking** | iCloud vs On My Mac distinctions matter for provenance. Store account name in source_url field or a tags entry. | LOW | ZACCOUNTTYPE and ZNAME from account row |
| **Notes: Attachment URL extraction** | Notes with linked URLs (web clippings) expose ZURLSTRING on attachment rows. These can populate the url field, creating resource cards or enriching note cards. | MEDIUM | Join to attachment rows in ZICCLOUDSYNCINGOBJECT via ZTYPEUTI filter |
| **Reminders: Hashtag extraction via direct SQLite** | EventKit does not expose hashtag/tag data. Direct SQLite read of ZREMCDHASHTAGLABEL and join to ZREMCDOBJECT yields the #tag strings. This is the only way to populate the `tags` field for reminders. | HIGH | Requires two-path approach: EventKit for main data, direct SQLite for tags; UUID cross-reference required |
| **Calendar: Geo-coordinates via direct SQLite** | EventKit provides location as a plain string only. Direct `calendaritem` → `Location` join yields latitude/longitude. These populate the latitude/longitude fields, enabling the map/location LATCH axis in SuperGrid. | MEDIUM | Direct SQLite read of Calendar.sqlitedb; Location table join on location_id |
| **Calendar: is_collective from attendees** | Events with attendees are meetings. Setting is_collective = true allows SuperGrid to distinguish personal events from meetings, enabling a meaningful LATCH category filter. | LOW | EKEvent.attendees != nil && !attendees.isEmpty |
| **Calendar: Event status** | EKEvent.status (confirmed/tentative/cancelled) maps directly to the status field. Tentative and cancelled events are common; preserving this enables status-based filtering. | LOW | EKEvent.status enum → string |
| **NativeImportAdapter protocol** | A protocol that all three adapters conform to. Enables future adapters (iOS EventKit, Contacts, etc.) to drop in without changing the bridge or ImportOrchestrator. | LOW | Define in Swift with `func fetchCards() async throws -> [CanonicalCard]` |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Write-back to Notes/Reminders/Calendar** | "Import + sync" is compelling — edit in Isometry, see it in Notes. | Isometry's data model (PAFV, LATCH, SuperGrid) diverges from Apple's. Writing back requires bidirectional schema mapping, conflict resolution, and real-time sync — all unsolved problems. The existing iCloud Documents sync covers Isometry-internal persistence. | Import is one-directional. Re-import with DedupEngine handles updates. Use export (Markdown/JSON/CSV) for round-trip workflows. |
| **Real-time sync / file watching** | "Automatically sync when I add a new reminder." | NoteStore.sqlite, Reminders DB, and Calendar DB are live-locked by their owner processes. File watching on a live CoreData database risks reading corrupt state mid-write. | Manual re-import is the correct model. Batch import + DedupEngine idempotency means re-imports are cheap and safe. |
| **Importing encrypted/locked Notes** | "I want ALL my notes, including locked ones." | Decrypting locked notes requires the user's password and Apple's keychain-stored wrapping key. This is not a forensic tool — implementing decryption would be complex, risky (keychain access entitlement), and fragile across macOS versions. | Skip locked notes with a clear count in import results: "X notes skipped (password protected)." |
| **Importing Notes attachments as binary blobs** | "I want my attached images/PDFs in Isometry." | Base64 binary storage is explicitly out-of-scope (MEMORY.md: "Base64 attachment binary storage (OOM risk — metadata only)"). WASM heap has realistic limits. | Store the attachment UUID and file path as source_url. The native shell can open the attachment file from ~/Library/Group Containers/group.com.apple.notes/Media/ when a card is tapped. |
| **Reminders subtask hierarchy as connections** | "Subtasks in Reminders should become connections in Isometry." | EKReminder has a `parentReminder` concept but it is not stable across OS versions and is poorly documented. ZREMCDREMINDER has subtask FK relationships but the schema varies. | Import all reminders as flat cards. The LATCH hierarchy (sort_order, folder) provides grouping without connections. |
| **EventKit write-only access for Calendar** | "Use the new iOS 17 write-only access level to add events." | Write-only access exists for apps that create events (like schedulers). Isometry reads events — write-only access provides no read capability and does not solve the import use case. | Use `requestFullAccessToEvents()` with `NSCalendarsFullAccessUsageDescription`. Read-only import uses full access. |

---

## Feature Dependencies

```
[NativeImportAdapter protocol]
    └──required-by──> [NotesAdapter]
    └──required-by──> [RemindersAdapter]
    └──required-by──> [CalendarAdapter]

[TCC permission flow]
    └──required-by──> [NotesAdapter] (Full Disk Access prompt)
    └──required-by──> [RemindersAdapter] (NSRemindersFullAccessUsageDescription)
    └──required-by──> [CalendarAdapter] (NSCalendarsFullAccessUsageDescription)

[NotesAdapter: snippet-only path]
    └──required-by──> table-stakes content import
    └──enhances-to──> [NotesAdapter: full protobuf content] (differentiator)

[NotesAdapter: schema version detection]
    └──required-by──> [NotesAdapter: folder hierarchy] (ZACCOUNT3 vs ZACCOUNT4 branch)

[RemindersAdapter: EventKit path]
    └──required-by──> title, notes, list, dates, priority, completion
    └──enhances-via──> [RemindersAdapter: direct SQLite hashtag path] (tags only)

[CalendarAdapter: EventKit path]
    └──required-by──> title, dates, location string, is_collective, status
    └──enhances-via──> [CalendarAdapter: direct SQLite geo path] (latitude/longitude)

[ImportOrchestrator] (already built)
    └──required-by──> all three adapters (output destination)

[DedupEngine] (already built)
    └──required-by──> stable source_id values from each adapter
```

### Dependency Notes

- **Protocol first, adapters second.** The `NativeImportAdapter` protocol must be defined before any adapter is implemented. It is the integration seam with ImportOrchestrator.
- **Notes is the most complex adapter.** Protobuf content extraction requires a third-party dependency (swift-protobuf) or manual binary parsing. The snippet-only path is table stakes; full protobuf is a differentiator that can ship in a later phase.
- **Reminders tags require two data paths.** EventKit covers everything except hashtags. If hashtag support is required at launch, the adapter must open the Reminders SQLite directly (UUID cross-reference between EK calendarItemIdentifier and ZDACALENDARITEMUNIQUEIDENTIFIER). This is optional — ship EventKit-only first.
- **Calendar geo-coordinates require direct SQLite.** EventKit's location is a plain string. If latitude/longitude are required for the map LATCH axis, the Calendar.sqlitedb must be read directly. This is a differentiator — ship EventKit-only first.
- **Schema version detection is table stakes for Notes, optional for Calendar.** The Calendar.sqlitedb schema is more stable across macOS versions. Notes ZACCOUNT3/ZACCOUNT4 branching is required before any folder hierarchy read.

---

## MVP Definition

### Launch With (v4.0 table stakes — all three adapters)

- [ ] `NativeImportAdapter` protocol with `fetchCards() async throws -> [CanonicalCard]`
- [ ] `NotesAdapter`: title, ZSNIPPET content, folder, created_at, modified_at, source_id; skip locked notes; schema version detection
- [ ] `RemindersAdapter` via EventKit: title, notes, list name, due date, completion status, priority; no hashtags
- [ ] `CalendarAdapter` via EventKit: title, notes, location string, start/end dates, calendar name, is_collective; no geo-coordinates
- [ ] TCC permission flow for all three sources with graceful denial handling
- [ ] All adapters output `CanonicalCard[]` JSON through existing `native:action` bridge to `ImportOrchestrator`
- [ ] DedupEngine compatibility: stable source_id values prevent duplicates on re-import
- [ ] Import results include skipped count for locked Notes

### Add After Validation (v4.x differentiators)

- [ ] `NotesAdapter` full protobuf content extraction (requires swift-protobuf or custom binary parser) — adds complete note text to FTS5 index
- [ ] `RemindersAdapter` hashtag extraction via direct SQLite (ZREMCDHASHTAGLABEL join) — adds tags[] field
- [ ] `CalendarAdapter` geo-coordinate enrichment via direct Calendar.sqlitedb (Location table join) — adds latitude/longitude

### Future Consideration (v5+)

- [ ] iOS EventKit adapter (same EKEvent/EKReminder APIs, different permission flow — add at iOS runtime path)
- [ ] Contacts adapter (EKParticipant email mapping to person cards)
- [ ] Incremental sync (timestamp-based re-import with DedupEngine update classification, triggered by menu bar action)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| NativeImportAdapter protocol | HIGH (unblocks all adapters) | LOW | P1 |
| NotesAdapter: title + snippet + folder + timestamps | HIGH (primary import use case) | LOW | P1 |
| NotesAdapter: schema version detection | HIGH (crashes without it) | LOW | P1 |
| NotesAdapter: skip locked notes | HIGH (safety) | LOW | P1 |
| RemindersAdapter: EventKit path (all fields) | HIGH | LOW | P1 |
| CalendarAdapter: EventKit path (all fields) | HIGH | LOW | P1 |
| TCC permission flow (all three) | HIGH (nothing works without it) | MEDIUM | P1 |
| Bridge output + ImportOrchestrator wiring | HIGH | LOW | P1 |
| NotesAdapter: pinned status → sort_order | MEDIUM | LOW | P2 |
| NotesAdapter: account source tracking | LOW | LOW | P2 |
| NotesAdapter: full protobuf content | HIGH | HIGH | P2 |
| CalendarAdapter: geo-coordinates via direct SQLite | MEDIUM | MEDIUM | P2 |
| RemindersAdapter: hashtag extraction | MEDIUM | HIGH | P2 |
| iOS EventKit adapter path | MEDIUM | MEDIUM | P3 |
| Incremental sync / re-import trigger | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v4.0 launch
- P2: Add after P1 validated, within v4.x
- P3: Defer to v5+

---

## Competitor / Prior Art Analysis

| Feature | alto-index (existing Notes parser) | apple_cloud_notes_parser (Ruby) | mac_apt notes.py (Python) | Isometry v4.0 Approach |
|---------|-----------------------------------|----------------------------------|---------------------------|------------------------|
| Notes content | JSON export (macOS Share extension) | Full protobuf parse | Full protobuf parse | ZSNIPPET (table stakes), protobuf (differentiator) |
| Notes folder | From alto-index JSON | Self-join on ZICCLOUDSYNCINGOBJECT | Self-join on ZICCLOUDSYNCINGOBJECT | Self-join, same approach |
| Reminders | Not supported | Not supported | Not supported | EventKit (new capability) |
| Calendar | Not supported | Not supported | Not supported | EventKit (new capability) |
| Permission model | Requires Share extension interaction | Requires forensic file access | Requires Full Disk Access | TCC per source (Notes = Full Disk, EK = standard prompt) |
| Platform | Web runtime (TypeScript) | Desktop Ruby | Desktop Python | Native Swift actor |

---

## Sources

- `mac_apt/plugins/notes.py` (ydkhatri) — SQL query showing exact ZICCLOUDSYNCINGOBJECT join pattern and column names: [github.com/ydkhatri/mac_apt](https://github.com/ydkhatri/mac_apt/blob/master/plugins/notes.py)
- `apple_cloud_notes_parser` (threeplanetssoftware) — protobuf parsing approach and ZDATA structure: [github.com/threeplanetssoftware/apple_cloud_notes_parser](https://github.com/threeplanetssoftware/apple_cloud_notes_parser)
- Velociraptor artifact MacOS.Applications.Notes — confirms query structure and ZICCLOUDSYNCINGOBJECT self-join: [docs.velociraptor.app](https://docs.velociraptor.app/exchange/artifacts/pages/macos.applications.notes/)
- Yogesh Khatri forensic blog — NoteStore.sqlite schema overview: [swiftforensics.com](http://www.swiftforensics.com/2018/02/reading-notes-database-on-macos.html)
- 0xdevalias gist — Reminders SQLite ZREMCDREMINDER table structure and hashtag tables: [gist.github.com/0xdevalias](https://gist.github.com/0xdevalias/ccc2b083ff58b52aa701462f2cfb3cc8)
- kacos2000/Queries calendar_sqlitedb.sql — complete Calendar SQLite schema with verified column names: [github.com/kacos2000/queries](https://github.com/kacos2000/queries/blob/master/calendar_sqlitedb.sql)
- tom-juntunen gist — Calendar.sqlitedb SELECT query confirming table names and date format: [gist.github.com/tom-juntunen](https://gist.github.com/tom-juntunen/eb40a747510e601bef58ec29ee163896)
- Apple TN3153 — EventKit API changes for iOS 17 / macOS 14 (NSCalendarsFullAccessUsageDescription): [developer.apple.com/documentation/technotes/tn3153](https://developer.apple.com/documentation/technotes/tn3153-adopting-api-changes-for-eventkit-in-ios-macos-and-watchos)
- EKEvent documentation — property list (title, startDate, endDate, location, url, attendees, isAllDay, status): [developer.apple.com/documentation/eventkit/ekevent](https://developer.apple.com/documentation/eventkit/ekevent)
- EKReminder documentation — property list (priority 0-9 scale, dueDateComponents, completionDate, isCompleted): [developer.apple.com/documentation/eventkit/ekreminder](https://developer.apple.com/documentation/eventkit/ekreminder)

---

*Feature research for: Isometry v4.0 Native ETL — Apple Notes, Reminders, Calendar macOS adapters*
*Researched: 2026-03-05*
