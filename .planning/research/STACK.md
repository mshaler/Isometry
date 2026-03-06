# Stack Research — v4.1 Sync + Audit: SuperAudit, CloudKit Bidirectional Sync, Virtual Scrolling

**Domain:** Change tracking/audit visualization, CloudKit record-level bidirectional sync, and CSS Grid virtual scrolling for 10K+ card scale
**Researched:** 2026-03-06
**Confidence:** HIGH for SuperAudit (pure SQLite triggers + CSS, no new deps); HIGH for CKSyncEngine (Apple first-party, iOS 17+/macOS 14+ matches deployment targets); MEDIUM for virtual scrolling (content-visibility supported in Safari 18+, but custom windowing needed for older targets)

---

## Context: Locked Existing Stack (Do Not Re-Research)

These are validated and final. No changes permitted:

| Technology | Version | Status |
|------------|---------|--------|
| TypeScript | 5.9 (strict) | Locked |
| sql.js | 1.14 (custom FTS5 WASM 756KB) | Locked |
| D3.js | v7.9 | Locked |
| Vite | 7.3 | Locked |
| Vitest | 4.0 | Locked |
| Swift | iOS 17+ / macOS 14+ | Locked |
| SwiftUI | iOS 17 / macOS 14 | Locked |
| WKWebView + WKURLSchemeHandler | iOS 17 / macOS 14 | Locked |
| Bridge protocol | 6 message types + native:blocked | Locked |
| DatabaseManager actor | Atomic .tmp/.bak/.db rotation | Locked |
| StoreKit 2 / FeatureGate | Free/Pro/Workbench tiers | Locked |
| SwiftProtobuf | 1.28+ | Locked |

**This document covers ONLY what is needed for the 3 new feature areas.**

---

## Conclusion Up Front

The stack changes for v4.1 are architecturally significant but dependency-light:

1. **SuperAudit: ZERO new dependencies.** Change tracking uses SQLite triggers (already proven in FTS5 sync triggers) writing to a new `card_changes` table. Source provenance color coding uses the existing `import_sources` table + CSS custom properties. Calculated field distinction is pure CSS class annotations on SQL-derived cells. All TypeScript, all in the existing sql.js WASM runtime.

2. **CloudKit Sync: ONE new framework (CKSyncEngine, system-provided).** This is the single biggest architectural change in v4.1. The current iCloud Documents checkpoint sync (D-010) gets REPLACED by record-level CloudKit sync using Apple's CKSyncEngine (iOS 17+ / macOS 14+). CKSyncEngine handles zone creation, change tokens, push notifications, conflict resolution retry, and scheduling -- eliminating thousands of lines of manual CloudKit code. The bridge protocol needs ONE new message type for sync state changes. Swift must learn to serialize/deserialize individual card records to CKRecord -- but critically, Swift STILL does not run SQL or understand the schema. It receives card diffs from JS and maps them to CKRecord fields.

3. **Virtual Scrolling: ZERO new dependencies.** CSS `content-visibility: auto` (Safari 18+ / all modern browsers) provides the 80% solution for free. For the remaining 20% (true windowing at 10K+ scale), a custom SuperGrid viewport calculator replaces D3 data joins with a windowed subset. No library needed -- the math is straightforward (visible rows = scroll offset / row height, render visible + buffer).

---

## Recommended Stack

### Feature 1: SuperAudit — Change Tracking, Source Provenance, Calculated Fields

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite triggers (sql.js) | Existing | Track INSERT/UPDATE/DELETE on `cards` table | Same trigger pattern already proven by FTS5 sync triggers (cards_fts_ai/ad/au). sql.js supports all SQLite trigger functionality. Zero dependency cost. |
| `card_changes` table (new schema) | N/A | Store per-row change events with timestamps and operation type | Simon Willison's sqlite-chronicle pattern: triggers write to a companion table with rowid, operation, timestamp, and session_id. Enables "what changed since session start" queries. |
| CSS custom properties | Existing | Source provenance color coding by import origin | Map `import_sources.source_type` to `--source-color-*` CSS variables. D3 data join applies class based on card's `source` field. Zero JS overhead per cell. |
| CSS `::before` pseudo-element | Existing | Calculated field visual distinction | SQL-derived aggregate values (COUNT, AVG, etc.) get a `.sg-calculated` class. CSS `::before` adds a subtle indicator (e.g., function icon or tinted border). Pure CSS, no DOM overhead. |

**No new npm or SPM dependencies for SuperAudit.**

#### Schema Addition: `card_changes` Table

```sql
-- Change tracking (SuperAudit)
CREATE TABLE card_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    changed_fields TEXT,  -- JSON array of field names that changed (UPDATE only)
    session_id TEXT NOT NULL,  -- UUID generated at app launch
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_card_changes_session ON card_changes(session_id);
CREATE INDEX idx_card_changes_card ON card_changes(card_id);

-- Triggers: track mutations
CREATE TRIGGER cards_audit_ai AFTER INSERT ON cards BEGIN
    INSERT INTO card_changes(card_id, operation, session_id, created_at)
    VALUES (NEW.id, 'insert', __session_id(), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
END;

CREATE TRIGGER cards_audit_au AFTER UPDATE ON cards BEGIN
    INSERT INTO card_changes(card_id, operation, changed_fields, session_id, created_at)
    VALUES (NEW.id, 'update', __changed_fields(OLD, NEW), __session_id(), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
END;

CREATE TRIGGER cards_audit_ad AFTER DELETE ON cards BEGIN
    INSERT INTO card_changes(card_id, operation, session_id, created_at)
    VALUES (OLD.id, 'delete', __session_id(), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
END;
```

**Note:** `__session_id()` and `__changed_fields()` are placeholder names. In sql.js, session ID will be injected as a bound parameter via the trigger body referencing a single-row config table (e.g., `SELECT value FROM _audit_config WHERE key = 'session_id'`). Changed fields will use `CASE WHEN OLD.name != NEW.name THEN 'name' ELSE NULL END` style JSON construction within the trigger.

#### Provenance Color Mapping

The existing `import_sources` table already tracks source types. SuperAudit adds a CSS variable map:

```typescript
const SOURCE_COLORS: Record<string, string> = {
  'apple-notes': '#FFD60A',    // Apple yellow
  'apple-reminders': '#FF6B6B', // Red
  'apple-calendar': '#4ECDC4',  // Teal
  'markdown': '#A8E6CF',        // Green
  'csv': '#95B8D1',             // Steel blue
  'excel': '#217346',           // Excel green
  'json': '#F7DC6F',            // JSON gold
  'html': '#E74C3C',            // HTML red
  'manual': '#B8B8B8',          // Gray (user-created)
};
```

Applied via D3 data join: `cell.style('--source-color', SOURCE_COLORS[d.source] ?? '#B8B8B8')`.

### Feature 2: CloudKit Bidirectional Sync — CKSyncEngine

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CKSyncEngine | iOS 17+ / macOS 14+ (system) | Record-level bidirectional CloudKit sync | Apple's first-party sync engine. Encapsulates zone creation, change token management, push notification handling, retry scheduling, and batch operations. Used by Apple's own Freeform app. Eliminates ~2,000 lines of manual CKFetchRecordZoneChangesOperation / CKModifyRecordsOperation code. Requires only 2 delegate methods: `handleEvent(_:syncEngine:)` and `nextRecordZoneChangeBatch(_:syncEngine:)`. |
| CloudKit framework | iOS 17+ / macOS 14+ (system) | CKRecord, CKRecordZone, CKContainer | System framework, zero dependency cost. Already entitled via iCloud capability. |
| Remote Notifications capability | iOS 17+ / macOS 14+ | Silent push for real-time sync | Required by CKSyncEngine for cross-device push. Must add capability in Xcode. |

**No new SPM dependencies for CloudKit sync. CKSyncEngine is a system framework.**

#### Architectural Decision: Record-Level vs. Checkpoint Sync

This is the most significant architectural change in v4.1. The current D-010 decision specifies:

> "No CKRecord, CKModifyRecordsOperation, or change tokens -- file sync only"

**v4.1 reverses this for sync while keeping checkpoint for persistence.** Rationale:

| Aspect | Checkpoint Sync (D-010 current) | Record-Level Sync (v4.1 new) |
|--------|-------------------------------|------------------------------|
| Conflict resolution | Last write wins (lossy) | Per-record merge (lossless) |
| Bandwidth | Full database every sync (~1MB+) | Only changed records (~KB) |
| Real-time sync | No (file-level iCloud Drive, minutes) | Yes (push notifications, seconds) |
| Concurrent editing | Overwrites other device's changes | Merges per-record |
| Complexity | Low (opaque blob) | Medium (record mapping) |

**The checkpoint persistence pattern is preserved for crash recovery and local persistence.** CKSyncEngine handles only the cross-device transport. The flow becomes:

```
JS mutates card → mutated message → BridgeManager
  ├── markDirty() → 30s autosave → checkpoint (local crash safety)
  └── cardDiff message → SyncManager → CKSyncEngine → CloudKit
```

#### Bridge Protocol Addition

One new message type needed:

| # | Direction | Type | Trigger | Payload |
|---|-----------|------|---------|---------|
| 7 | JS -> Swift | `sync:changes` | After MutationManager execute() | Array of `{ cardId, operation, fields }` diffs |
| 8 | Swift -> JS | `sync:incoming` | CKSyncEngine fetched changes | Array of `{ card, operation }` from server |

This keeps the "Swift doesn't understand SQL" boundary. JS sends card-level diffs (not SQL). Swift maps card fields to CKRecord fields and vice versa.

#### CKRecord Field Mapping

```swift
// Swift side -- map CanonicalCard fields to CKRecord
extension CKRecord {
    func populate(from card: [String: Any]) {
        self["name"] = card["name"] as? String
        self["content"] = card["content"] as? String
        self["folder"] = card["folder"] as? String
        self["card_type"] = card["card_type"] as? String
        self["status"] = card["status"] as? String
        self["tags"] = card["tags"] as? String  // JSON string
        self["priority"] = card["priority"] as? Int64
        self["source"] = card["source"] as? String
        self["source_id"] = card["source_id"] as? String
        // ... remaining card fields
    }
}
```

**CKRecord 1MB limit:** Individual card records are well under 1MB (typical card is <10KB including content). The `content` field is the largest -- if a card's content exceeds ~900KB, it should be stored as a CKAsset (file attachment). This is an edge case; most cards are under 100KB.

#### CKSyncEngine Initialization

```swift
actor SyncManager: CKSyncEngineDelegate {
    private var syncEngine: CKSyncEngine?
    private let container = CKContainer.default()

    func initialize(stateSerialization: CKSyncEngine.State.Serialization?) {
        let config = CKSyncEngine.Configuration(
            database: container.privateCloudDatabase,
            stateSerialization: stateSerialization,
            delegate: self
        )
        syncEngine = CKSyncEngine(config)
    }

    func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        switch event {
        case .stateUpdate(let update):
            // Persist state serialization for next launch
            persistSyncState(update.stateSerialization)
        case .fetchedRecordZoneChanges(let changes):
            // Forward to JS via bridge
            bridgeManager.sendSyncIncoming(changes)
        case .sentRecordZoneChanges(let sentChanges):
            // Handle conflicts, errors
            handleSentChanges(sentChanges)
        case .accountChange(let event):
            handleAccountChange(event)
        default: break
        }
    }

    func nextRecordZoneChangeBatch(
        _ context: CKSyncEngine.SendChangesContext,
        syncEngine: CKSyncEngine
    ) async -> CKSyncEngine.RecordZoneChangeBatch? {
        // Return pending card changes as CKRecords
    }
}
```

#### Conflict Resolution Strategy

Use **server-wins with merge** for text fields, **latest-timestamp-wins** for metadata:

- `name`, `content`, `tags`: If both devices edited, keep server version (simpler, avoids complex merge)
- `modified_at`, `status`, `priority`: Latest timestamp wins
- `deleted_at`: Deletion always wins (tombstone)
- On conflict, re-queue the local record with merged values for retry

CKSyncEngine handles transient errors (network, throttling) automatically with retry.

### Feature 3: Virtual Scrolling for SuperGrid

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS `content-visibility: auto` | Safari 18+ / Chrome 85+ / Firefox 125+ | Skip rendering of off-screen grid rows | One CSS property that tells the browser to skip painting off-screen elements. 93% global browser support (caniuse). SuperGrid uses `<div>` elements (NOT SVG), so the Safari SVG text painting bug does not apply. Combined with `contain-intrinsic-size` for stable scroll height. |
| CSS `contain-intrinsic-size` | Safari 17+ / Chrome 83+ | Provide placeholder dimensions for off-screen rows | Prevents layout thrashing when `content-visibility: auto` skips rendering. Set to row height estimate (e.g., `contain-intrinsic-size: auto 40px`). |
| Custom viewport calculator (TypeScript) | N/A | Compute visible row range from scroll position | Simple math: `firstVisible = Math.floor(scrollTop / rowHeight)`, `lastVisible = firstVisible + Math.ceil(viewportHeight / rowHeight) + buffer`. Feed into D3 data join to render only visible cells. No library needed. |

**No new npm or SPM dependencies for virtual scrolling.**

#### Implementation Strategy: Two-Tier Approach

**Tier 1 (CSS-only, no code changes to render pipeline):**
Apply `content-visibility: auto` to data row containers. The browser natively skips rendering off-screen rows. This handles 5K-10K cells with near-zero implementation cost.

```css
.supergrid-row {
    content-visibility: auto;
    contain-intrinsic-size: auto 40px; /* estimated row height */
}
```

**Tier 2 (JS windowing, for 10K+ cells):**
Only render visible rows plus a buffer zone. Requires modifying `_renderCells()` to filter the D3 data join input based on scroll position.

```typescript
private _getVisibleRange(): { start: number; end: number } {
    const scrollTop = this._rootEl!.scrollTop;
    const viewportHeight = this._rootEl!.clientHeight;
    const rowHeight = 40; // or computed from first rendered row
    const buffer = 10; // extra rows above/below viewport

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const end = Math.min(this._totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer);

    return { start, end };
}
```

The D3 data join receives only the visible slice of `_lastCells`, and a spacer `<div>` maintains scroll height for the full dataset.

**Why NOT a virtual scrolling library:**
- SuperGrid is not a standard table -- it has N-level stacked headers, CSS Grid spanning, collapse states, and PAFV-specific cell placement
- Libraries like AG Grid, Handsontable, etc. assume their own rendering model
- The viewport calculation is ~50 lines of code
- D3 data join already handles enter/update/exit efficiently

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CloudKit sync API | CKSyncEngine | CKFetchRecordZoneChangesOperation + CKModifyRecordsOperation | Manual operations require managing zone creation, change token persistence, push subscription setup, retry logic, batch sizing, and error handling -- all of which CKSyncEngine encapsulates. Apple dogfoods CKSyncEngine in Freeform. Manual operations are the 2018 approach; CKSyncEngine is 2023+. |
| CloudKit sync API | CKSyncEngine | NSPersistentCloudKitContainer (Core Data + CloudKit) | Requires Core Data. Isometry uses sql.js in WKWebView -- there is no Core Data stack. NSPersistentCloudKitContainer cannot be used without Core Data models. |
| CloudKit sync API | CKSyncEngine | iCloud Documents (current D-010) | Last-write-wins at file level. A 2-device edit scenario loses one device's changes entirely. Bandwidth-wasteful (re-uploads full ~1MB database on every sync). No real-time push. Acceptable for v2.0 but inadequate for v4.1 requirements. |
| Change tracking | SQLite triggers | Application-level tracking in MutationManager | MutationManager only catches JS-initiated writes. CloudKit incoming changes bypass MutationManager (they come from Swift). Triggers catch ALL writes regardless of source -- the database is the single source of truth. |
| Change tracking | SQLite triggers | SQLite session extension | sql.js WASM build does not include the session extension. Would require a custom WASM build. Triggers work with standard sql.js and are already proven (FTS5 sync triggers). |
| Virtual scrolling | CSS content-visibility + custom windowing | clusterize.js / virtual-scroll library | SuperGrid's CSS Grid layout with N-level stacked headers and collapse states is incompatible with standard list virtualization libraries. These libraries assume uniform row structures and control their own DOM. |
| Virtual scrolling | CSS content-visibility + custom windowing | Intersection Observer API | IntersectionObserver fires callbacks when elements enter/exit viewport. For 10K+ cells, creating 10K observers is worse than the scroll-position math approach. IntersectionObserver is better for lazy-loading images, not grid windowing. |
| Source provenance | CSS custom properties + D3 class | Separate provenance overlay | An overlay adds DOM complexity. CSS custom properties on existing cells are zero-cost -- the color information flows through the existing D3 data join. |
| Calculated field distinction | CSS class annotation | Inline SVG icon per cell | SVG icons per cell add DOM nodes. A CSS `::before` pseudo-element is zero-DOM-cost and can show a formula/function indicator via content property. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Core Data / NSPersistentCloudKitContainer | Isometry has no Core Data stack. sql.js in WKWebView is the database. Core Data would require a parallel native data model -- violating D-011. | CKSyncEngine with manual CKRecord mapping |
| GRDB + CloudKit sync (GRDB CloudKit extension) | GRDB is for reading system SQLite databases (v4.0 Notes adapter). CloudKit sync needs CKSyncEngine, not a SQLite wrapper. GRDB cannot replace CKSyncEngine. | CKSyncEngine (system framework) |
| Manual CKFetchRecordZoneChangesOperation | ~2,000 lines of boilerplate for zone creation, token persistence, subscription management, retry logic. CKSyncEngine does all of this in ~200 lines of delegate code. | CKSyncEngine |
| Third-party CloudKit sync libraries (IceCream, CloudCore, etc.) | These wrap Core Data. Isometry uses sql.js. They also add dependency risk -- CloudKit APIs change and these libraries may lag. | CKSyncEngine (Apple first-party) |
| AG Grid / Handsontable / other grid libraries | These are complete grid components that would replace SuperGrid entirely. Isometry's SuperGrid has 9 milestones of PAFV-specific behavior (N-level stacking, collapse, transpose, density, zoom, etc.) that no library replicates. | Custom viewport windowing (~50 LOC) |
| React Virtualized / react-window | Isometry is pure TypeScript + D3. No React. These libraries require React. | Custom viewport windowing + content-visibility CSS |
| SQLite WAL hook / update_hook for change tracking | sql.js WASM does not expose sqlite3_update_hook. Even if it did, it fires synchronously during writes and cannot safely post messages. | SQLite triggers writing to card_changes table |
| Enums for CKRecord field values | CKSyncEngine expert advice: never use enums for cloud-synced values. If a newer app version adds an enum case, older app versions cannot decode it. | String values for all CKRecord fields |

---

## Installation

### TypeScript Side (Zero New Dependencies)

```bash
# No new npm installs needed
# SuperAudit: schema.sql additions + new TypeScript modules
# Virtual Scrolling: CSS additions + SuperGrid._renderCells() modification
```

### Swift Side (Zero New SPM Dependencies)

```swift
// CKSyncEngine is a system framework -- import only
import CloudKit

// No Package.swift changes needed
// CKSyncEngine available via CloudKit framework (already imported for CKContainer)
```

### Xcode Capability Additions

```
1. CloudKit capability (if not already added)
   - Enable "CloudKit" in Signing & Capabilities
   - Create/select iCloud container: iCloud.works.isometry.app

2. Remote Notifications capability (NEW)
   - Required for CKSyncEngine push notifications
   - Enable "Push Notifications" in Signing & Capabilities
   - Enable "Background Modes" > "Remote notifications"
```

### Info.plist Additions

```xml
<!-- Background fetch for CloudKit sync (iOS) -->
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
    <string>fetch</string>
</array>
```

---

## Bridge Protocol Changes

### Current Protocol (6 message types)

| # | Direction | Type | Status |
|---|-----------|------|--------|
| 1 | JS -> Swift | native:ready | Unchanged |
| 2 | Swift -> JS | native:launch | Extended (add syncState) |
| 3 | JS -> Swift | checkpoint | Unchanged (still used for local persistence) |
| 4 | JS -> Swift | mutated | Extended (carries card diff) |
| 5 | JS -> Swift | native:action | Unchanged |
| 6 | Swift -> JS | native:sync | Repurposed (was stub, now carries CKSyncEngine changes) |

### Protocol Additions

**Extended `mutated` message payload:**
```typescript
// Current: { type: 'mutated' } (no payload)
// v4.1:   { type: 'mutated', payload: { diffs: CardDiff[] } }

interface CardDiff {
    cardId: string;
    operation: 'insert' | 'update' | 'delete';
    fields?: Record<string, unknown>;  // Changed field values (update only)
}
```

**Repurposed `native:sync` payload:**
```typescript
// Current: stub (logs and sends minimal payload)
// v4.1:   carries incoming CloudKit changes
{
    type: 'native:sync',
    payload: {
        action: 'incoming',
        changes: Array<{
            cardId: string;
            operation: 'insert' | 'update' | 'delete';
            fields?: Record<string, unknown>;
        }>
    }
}
```

This preserves the 6 existing message types (no new type needed). The `mutated` message gains an optional payload, and `native:sync` (which was always a stub) gets its real implementation.

---

## CKSyncEngine State Persistence

CKSyncEngine requires state serialization to be persisted across app launches. This is a `Data` blob (opaque to the app) that must be stored locally.

**Storage location:** New file alongside `isometry.db`:
```
{ubiquityContainer}/Isometry/isometry.db          -- database checkpoint
{ubiquityContainer}/Isometry/sync-engine-state.dat -- CKSyncEngine state
```

`DatabaseManager` gains one new method: `saveSyncState(_ data: Data)` / `loadSyncState() -> Data?`. Same atomic write pattern as checkpoint, but smaller (~KB vs ~MB).

**Critical: sync-engine-state.dat must NOT be in the iCloud ubiquity container.** It is device-specific (contains device-local change tokens). Store in Application Support instead.

---

## Version Compatibility

| Component | Requirement | Isometry Target | Status |
|-----------|-------------|-----------------|--------|
| CKSyncEngine | iOS 17+ / macOS 14+ | iOS 17+ / macOS 14+ | Exact match |
| CSS content-visibility: auto | Safari 18+ | iOS 18+ (WKWebView) | Partial -- iOS 17 users won't get CSS optimization; JS windowing covers them |
| CSS contain-intrinsic-size | Safari 17+ | iOS 17+ (WKWebView) | Full support |
| SQLite triggers | All versions | sql.js 1.14 | Full support (already used for FTS5) |
| Remote Notifications | iOS 17+ / macOS 14+ | iOS 17+ / macOS 14+ | Exact match |
| CKRecordZone | iOS 8+ | iOS 17+ | Full support |

### content-visibility iOS 17 Fallback

For iOS 17 users (where Safari version is 17.x, not 18.x), `content-visibility: auto` is not supported. The CSS property is simply ignored -- no error, no breakage. These users get the full DOM render (current behavior). The Tier 2 JS windowing provides the performance safety net for large datasets regardless of CSS support.

---

## Sources

- [CKSyncEngine Apple Documentation](https://developer.apple.com/documentation/cloudkit/cksyncengine-5sie5) -- CKSyncEngine API reference, iOS 17+ / macOS 14+ availability confirmed -- HIGH confidence (official Apple documentation)
- [WWDC23: Sync to iCloud with CKSyncEngine](https://developer.apple.com/videos/play/wwdc2023/10188/) -- Complete CKSyncEngine tutorial: delegate protocol, event handling, conflict resolution, state serialization, testing patterns. Two delegate methods: handleEvent and nextRecordZoneChangeBatch. Automatic sync scheduling via system task scheduler. -- HIGH confidence (official Apple WWDC session)
- [Apple sample-cloudkit-sync-engine](https://github.com/apple/sample-cloudkit-sync-engine) -- Official reference implementation. SyncedDatabase.swift demonstrates full CKSyncEngine integration with local persistence. Includes test patterns for simulating multi-device sync. -- HIGH confidence (official Apple sample code)
- [CKSyncEngine Q&A by Christian Selig (2026)](https://christianselig.com/2026/01/cksyncengine/) -- Practical CKSyncEngine advice: don't use enums for cloud values, deletions bypass conflict resolution, never call fetchChanges/sendChanges from delegate methods, store systemFieldsData via NSKeyedArchiver. -- HIGH confidence (experienced CloudKit developer, recent)
- [Superwall CKSyncEngine tutorial](https://superwall.com/blog/syncing-data-with-cloudkit-in-your-ios-app-using-cksyncengine-and-swift-and-swiftui/) -- Step-by-step CKSyncEngine setup with SwiftUI integration -- MEDIUM confidence (third-party tutorial, well-written)
- [CloudKit Data Size Limits](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/PropertyMetrics.html) -- CKRecord 1MB size limit, CKAsset 50MB (private DB) / 100MB (public DB) -- HIGH confidence (official Apple documentation)
- [CSS content-visibility browser support (caniuse)](https://caniuse.com/css-content-visibility) -- Safari 18+, Chrome 85+, Firefox 125+, 93% global support. iOS Safari 18.0+ confirmed. -- HIGH confidence (caniuse.com)
- [content-visibility performance blog](https://cekrem.github.io/posts/content-visibility-auto-performance/) -- Practical content-visibility: auto implementation with contain-intrinsic-size patterns -- MEDIUM confidence (developer blog)
- [Google data grid 10x faster with CSS (Johan Isaksson)](https://medium.com/@johan.isaksson/how-i-made-googles-data-grid-scroll-10x-faster-with-one-line-of-css-78cb1e8d9cb1) -- Real-world CSS containment performance improvement for grid layouts -- MEDIUM confidence (developer blog, paywalled)
- [Simon Willison: sqlite-chronicle](https://github.com/simonw/sqlite-chronicle) -- SQLite change tracking pattern: triggers write to companion table with rowid, timestamp, version number. Efficient polling for changes since last sync. -- HIGH confidence (well-known SQLite expert, open-source)
- [Simon Willison: track timestamped changes to SQLite table](https://til.simonwillison.net/sqlite/track-timestamped-changes-to-a-table) -- Trigger-based change tracking with millisecond timestamps. INSERT OR REPLACE pattern for deduplication. -- HIGH confidence (official TIL, working code)
- [D3 virtual scrolling for large datasets](https://billdwhite.com/wordpress/2014/05/17/d3-scalability-virtual-scrolling-for-large-visualizations/) -- D3-specific virtual scrolling: determine visible data range from scroll position, slice master dataset, reuse DOM elements via data join. -- MEDIUM confidence (established D3 pattern, older but principles unchanged)
- [Safari content-visibility SVG bug (adactio)](https://adactio.com/journal/21498) -- Known Safari bug: content-visibility: auto on elements containing SVG with text elements causes text to never paint. SuperGrid uses div-based CSS Grid (not SVG), so this bug does not apply. -- HIGH confidence (documented browser bug)
- [Ryan Ashcraft: CloudKit sync library lessons](https://ryanashcraft.com/what-i-learned-writing-my-own-cloudkit-sync-library/) -- Practical CloudKit sync lessons: keep one operation in flight, retry with CKErrorRetryAfterKey, handle transient errors. CKSyncEngine now handles most of this automatically. -- MEDIUM confidence (developer experience, pre-CKSyncEngine era)

---

## Open Questions (Phase Research Flags)

- **CKSyncEngine + WKWebView bridge latency:** The JS-to-Swift-to-CloudKit-to-Swift-to-JS round trip for sync operations has multiple bridge crossings. Need to verify that the `mutated` message with card diff payload does not measurably impact write latency. Mitigation: batch diffs and send asynchronously (CKSyncEngine's scheduler handles actual CloudKit operations on its own timeline). **Flag for Phase 1: benchmark bridge message overhead for diff payloads.**

- **content-visibility on iOS 17 WKWebView:** iOS 17 ships with Safari 17.x which does NOT support `content-visibility: auto`. Since Isometry targets iOS 17+, the CSS optimization only helps iOS 18+ users. The JS windowing (Tier 2) must be the primary performance mechanism, with CSS as a bonus. **Flag for Phase 3: verify content-visibility behavior in iOS 17 WKWebView (should silently degrade).**

- **CKRecord field mapping for connections table:** The research focused on cards. Connections (lightweight relations) also need to sync. Each connection maps to a separate CKRecord in its own record type. The `UNIQUE(source_id, target_id, via_card_id, label)` constraint must be preserved across devices. **Flag for Phase 2: design connection CKRecord schema.**

- **Checkpoint sync coexistence:** During the transition, both checkpoint sync (iCloud Documents) and record-level sync (CKSyncEngine) should not conflict. The checkpoint file in the ubiquity container should either be (a) moved to local-only storage, or (b) kept as a backup but not used for cross-device sync. **Flag for Phase 1: define migration strategy from D-010 checkpoint to CKSyncEngine.**

- **Session ID generation for SuperAudit:** The `card_changes` table needs a session ID to distinguish "changes since this session started." In the WKWebView context, a new session ID should be generated on each app launch AND on each WKWebView reload (crash recovery). The session ID needs to be injected into the sql.js database before triggers fire. **Flag for Phase 1: define session ID lifecycle.**

---

*Stack research for: Isometry v4.1 Sync + Audit -- SuperAudit, CloudKit bidirectional sync, virtual scrolling*
*Researched: 2026-03-06*
