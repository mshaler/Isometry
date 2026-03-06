# Architecture Research: v4.1 Sync + Audit

**Domain:** SuperAudit (change tracking, source provenance, calculated field distinction), CloudKit bidirectional sync, virtual scrolling
**Researched:** 2026-03-06
**Confidence:** HIGH (SuperAudit, Virtual Scrolling) / MEDIUM (CloudKit — architectural pivot required)

---

## Executive Summary

v4.1 introduces three features at different architectural layers. SuperAudit is **purely a JS/TypeScript concern** -- it adds visual intelligence to existing data using the existing `source`, `modified_at`, and computed SQL field metadata. Virtual scrolling is **purely a SuperGrid rendering concern** -- it changes how cells are drawn, not what is queried. CloudKit bidirectional sync is **the only feature that touches the Swift shell**, and it represents a significant architectural evolution from the current iCloud Documents checkpoint model.

The critical insight: the current iCloud Documents sync (whole-database checkpoint to ubiquity container) and CloudKit record-level sync (CKSyncEngine with CKRecord) are **mutually exclusive architectures**. PROJECT.md lists "CloudKit bidirectional sync with custom zones, change tokens, and conflict resolution" as an active requirement, which means upgrading from file-level sync to record-level sync. This requires Swift to gain knowledge of the data domain -- a direct contradiction of the current shell philosophy ("Swift does not query, parse, or understand the database").

This document recommends a **hybrid approach**: keep the checkpoint model as the primary persistence and local sync mechanism, but layer CKSyncEngine on top for cross-device record-level sync with change tokens and conflict resolution.

---

## 1. SuperAudit Architecture

### 1.1 What SuperAudit Needs

SuperAudit provides three visual capabilities across all views:

1. **Change tracking**: Visually distinguish new/modified/deleted cards within a session
2. **Source provenance**: Color-code cards by import origin (Apple Notes = blue, CSV = green, etc.)
3. **Calculated field distinction**: Visually distinguish SQL-derived values from raw data

### 1.2 Integration: Entirely in JS Runtime

SuperAudit requires **zero new schema tables** and **zero Swift changes**. All three capabilities are achievable with existing data + in-memory session state.

#### Change Tracking

Change tracking is **session-scoped** (Tier 3 ephemeral). It captures which cards have been created, modified, or soft-deleted during the current session.

**Where it hooks:** MutationManager. Every `execute()` call already records forward/inverse commands in a command log. SuperAudit adds a parallel tracking map.

```
MutationManager.execute(mutation)
  |
  v
AuditTracker.recordChange(mutation)
  |
  v
SessionChangeMap: Map<cardId, ChangeType>
  where ChangeType = 'new' | 'modified' | 'deleted'
```

**New component:** `AuditTracker` (session-scoped, Tier 3)
- Subscribes to MutationManager or wraps `execute()`
- Maintains an in-memory `Map<string, 'new' | 'modified' | 'deleted'>`
- On `card:create` forward command: marks card as 'new'
- On `card:update` forward command: marks card as 'modified' (unless already 'new')
- On `card:delete` forward command: marks card as 'deleted'
- On undo: reverses the change type (or removes entry)
- Cleared on session end (Tier 3)

**Integration with views:** AuditTracker exposes `getChangeType(cardId): ChangeType | null`. Views apply CSS classes:
- `.audit-new` -- green left border or background tint
- `.audit-modified` -- amber left border or background tint
- `.audit-deleted` -- red strikethrough or faded opacity

**No Worker query changes needed.** Change tracking is purely a visual overlay on existing data join results.

#### Source Provenance

Source provenance is **already stored** in the `cards.source` column. Every card has a `source` field set during ETL import (e.g., `'apple_notes'`, `'markdown'`, `'csv'`, `'native_reminders'`, `'native_calendar'`, `'native_notes'`).

**New component:** `SourceColorMap` (configuration, Tier 2 persistent)
- Maps source type strings to CSS custom properties
- Default palette: apple_notes=#007AFF, markdown=#8B5CF6, csv=#10B981, excel=#2563EB, json=#F59E0B, html=#EF4444, native_reminders=#FF9500, native_calendar=#34C759, native_notes=#5856D6
- User-customizable (future), stored in `ui_state`

**Integration with views:** SuperGrid cells and list/grid/kanban cards receive a `data-source` attribute from the card's `source` field. CSS rules apply background tint or left-border color.

```css
[data-source="apple_notes"] { --source-color: #007AFF; }
[data-source="markdown"]    { --source-color: #8B5CF6; }
/* etc. */
```

**No Worker query changes needed.** The `source` column is already in every card query result.

#### Calculated Field Distinction

Calculated fields are SQL-derived values that appear in SuperGrid cells but are not stored card properties -- they are computed at query time. In Isometry, these are:
- `count` (aggregation cards in SuperGrid)
- `strftime()` wrapped time values (SuperTime hierarchy)
- Future: HyperFormula calculations (SuperCalc, deferred)

**New component:** `FieldMetadata` (static configuration)
- Maintains a set of field names that are computed: `count`, plus any aliased strftime expression
- SuperGrid already knows which fields are axis-derived vs. data-derived

**Integration with views:** SuperGrid `_renderCells()` applies `.audit-calculated` class to cells whose values are derived from SQL aggregation rather than raw card properties. The SuperGridQuery already distinguishes between axis fields (GROUP BY) and aggregation fields (COUNT, GROUP_CONCAT).

**No Worker query changes needed.** The distinction between raw and computed values is already implicit in the query structure.

### 1.3 SuperAudit Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SuperAudit Layer                          │
│                                                                  │
│  ┌───────────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │ AuditTracker  │  │ SourceColorMap  │  │ FieldMetadata     │  │
│  │               │  │                 │  │                   │  │
│  │ Session Map   │  │ source→color    │  │ computed field    │  │
│  │ (Tier 3)      │  │ (Tier 2)        │  │ registry (static) │  │
│  └───────┬───────┘  └───────┬─────────┘  └─────────┬─────────┘  │
│          │                  │                       │            │
│          │                  │                       │            │
│          ▼                  ▼                       ▼            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   AuditProvider                              │ │
│  │                                                              │ │
│  │  getChangeType(cardId) → 'new'|'modified'|'deleted'|null    │ │
│  │  getSourceColor(source) → CSS color                         │ │
│  │  isCalculatedField(fieldName) → boolean                     │ │
│  │                                                              │ │
│  │  subscribe() → for re-render on change tracking updates     │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  All 9 Views (via D3 classes) │
              │                               │
              │  .audit-new                   │
              │  .audit-modified              │
              │  .audit-deleted               │
              │  [data-source]                │
              │  .audit-calculated            │
              └───────────────────────────────┘
```

### 1.4 Modified Existing Components

| Component | Modification | Impact |
|-----------|-------------|--------|
| MutationManager | Add AuditTracker hook (or wrap execute) | Minimal -- 5-10 lines |
| SuperGrid._renderCells() | Add data-source attribute, audit CSS classes | Moderate -- update D3 enter/update |
| Other views (list, grid, kanban, etc.) | Add data-source attribute, audit CSS classes | Minimal per view -- same pattern |
| StateCoordinator | Register AuditProvider | Minimal -- 2 lines |
| CSS | Add audit class styles | New file: audit.css |

### 1.5 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| AuditTracker | `src/audit/AuditTracker.ts` | Session change map |
| SourceColorMap | `src/audit/SourceColorMap.ts` | Source-to-color mapping |
| FieldMetadata | `src/audit/FieldMetadata.ts` | Computed field registry |
| AuditProvider | `src/providers/AuditProvider.ts` | Unified audit state provider |

---

## 2. CloudKit Bidirectional Sync Architecture

### 2.1 The Fundamental Challenge

The current architecture (D-010, D-011) uses **iCloud Documents checkpoint sync**:
- sql.js exports its entire database as a binary blob
- Swift writes the blob to an iCloud ubiquity container
- iCloud Drive syncs the file to other devices
- On launch, the other device reads the file and loads it into sql.js

This is whole-database, last-writer-wins sync. It works for single-device use with iCloud backup, but does NOT support:
- Conflict resolution (two devices editing concurrently)
- Change tokens (knowing what changed since last sync)
- Real-time push (subscriptions + silent push)
- Incremental sync (sending only changed records)

The v4.1 requirement explicitly calls for "CloudKit bidirectional sync with custom zones, change tokens, and conflict resolution." This is **record-level CloudKit sync** -- a fundamentally different architecture.

### 2.2 Architectural Options

#### Option A: CKSyncEngine (Recommended)

CKSyncEngine (iOS 17+, macOS 14+) is Apple's modern sync engine that handles the sync scheduling, change token management, push notification handling, retry logic, and batch operations. The app provides records and handles events.

**Key advantage:** Isometry already targets iOS 17+ / macOS 14+, so CKSyncEngine is available on all supported platforms.

**How it fits Isometry:**

The fundamental problem is that sql.js runs in WASM inside WKWebView, and CKSyncEngine runs in Swift. They must exchange change information. The bridge is the integration seam.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Swift Shell                               │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │ DatabaseManager  │    │     SyncManager                   │   │
│  │ (checkpoint)     │    │                                    │   │
│  │ atomic write     │    │  CKSyncEngine instance            │   │
│  │ iCloud container │    │  CKSyncEngineDelegate             │   │
│  │ (RETAINED)       │    │                                    │   │
│  └──────────────────┘    │  handleEvent():                    │   │
│                          │    .fetchedRecordZoneChanges       │   │
│                          │    .sentRecordZoneChanges          │   │
│                          │    .accountChange                  │   │
│                          │                                    │   │
│                          │  nextRecordZoneChangeBatch():      │   │
│                          │    maps pending changes to CKRec   │   │
│                          └──────────────┬─────────────────────┘   │
│                                         │                        │
│                              ┌──────────▼──────────┐             │
│                              │   BridgeManager     │             │
│                              │                     │             │
│                              │   NEW message types:│             │
│                              │   sync:push         │             │
│                              │   sync:pull         │             │
│                              │   sync:conflict     │             │
│                              └──────────┬──────────┘             │
└─────────────────────────────────────────┼────────────────────────┘
                                          │
                    ┌─────────────────────▼──────────────────────┐
                    │              JS Runtime                     │
                    │                                             │
                    │  ┌───────────────────────────────────────┐  │
                    │  │       SyncAdapter (new)                │  │
                    │  │                                        │  │
                    │  │  handlePull(records):                  │  │
                    │  │    upsert cards/connections from       │  │
                    │  │    incoming CKRecord JSON              │  │
                    │  │                                        │  │
                    │  │  preparePush():                        │  │
                    │  │    query dirty cards since last sync   │  │
                    │  │    return card JSON for Swift to       │  │
                    │  │    convert to CKRecord                 │  │
                    │  │                                        │  │
                    │  │  resolveConflict(local, remote):       │  │
                    │  │    field-level merge or last-write-wins│  │
                    │  └───────────────────────────────────────┘  │
                    └─────────────────────────────────────────────┘
```

#### Option B: Keep Checkpoint-Only (Simplest)

Keep the current iCloud Documents sync. Add a `modified_at`-based change detection on app launch to show what changed since last open. This does NOT meet the stated v4.1 requirements for "CloudKit bidirectional sync with custom zones, change tokens, and conflict resolution."

#### Option C: Hybrid (Recommended Implementation)

**Keep checkpoint sync AND add CKSyncEngine.** The checkpoint model remains the primary persistence mechanism (atomic file write, crash recovery). CKSyncEngine layers on top for cross-device incremental sync.

This is the recommended approach because:
1. Checkpoint persistence is proven and handles crash recovery
2. CKSyncEngine handles the sync complexity (tokens, push, retry)
3. If CKSyncEngine fails or is unavailable (no network, no iCloud), the app still functions
4. The checkpoint file serves as a local backup independent of CloudKit

### 2.3 Schema Changes for Sync

The current schema has NO sync metadata columns. CKSyncEngine requires knowing:
- Which records have changed since last sync
- The CKRecord system fields (recordChangeTag) for conflict detection
- Which records have been synced vs. pending

**New columns on `cards` table:**

```sql
-- Sync metadata (added via ALTER TABLE migration)
ALTER TABLE cards ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cards ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced', 'pending', 'conflict'));
ALTER TABLE cards ADD COLUMN sync_change_tag TEXT;  -- CKRecord.recordChangeTag
```

**New columns on `connections` table:**

```sql
ALTER TABLE connections ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE connections ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE connections ADD COLUMN sync_change_tag TEXT;
```

**New index for sync queries:**

```sql
CREATE INDEX idx_cards_sync_status ON cards(sync_status) WHERE sync_status = 'pending';
CREATE INDEX idx_conn_sync_status ON connections(sync_status) WHERE sync_status = 'pending';
```

**Sync state table (new):**

```sql
CREATE TABLE sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
-- Keys: 'last_sync_token', 'last_sync_at', 'device_id', 'sync_enabled'
```

### 2.4 Bridge Protocol Extension

The current bridge has 6 message types (native:ready, native:launch, checkpoint, mutated, native:action, native:sync). CKSyncEngine integration requires extending `native:sync` from a stub to a full sync protocol.

**Extended native:sync subtypes:**

| Direction | Subtype | Payload | When |
|-----------|---------|---------|------|
| Swift -> JS | `sync:incoming` | Array of card/connection JSON from CKRecord | CKSyncEngine fetched changes |
| Swift -> JS | `sync:conflict` | Local card JSON + remote card JSON | CKSyncEngine detected conflict |
| JS -> Swift | `sync:outgoing` | Array of card/connection JSON to push | MutationManager marks cards pending |
| JS -> Swift | `sync:resolved` | Resolved card JSON | User/auto resolved conflict |
| Swift -> JS | `sync:status` | Sync state (syncing/idle/error) | Sync engine state changed |

This does NOT require new top-level message types. The existing `native:sync` message carries a `kind` discriminator (like `native:action` does), keeping the bridge protocol at 6 message types.

### 2.5 CKRecord Mapping

Swift must map card/connection JSON to CKRecord fields. Swift does NOT need to understand the full card schema -- it acts as a **pass-through mapper** with a fixed field list.

```swift
// SyncManager maps JSON dict to CKRecord
func recordFromCard(_ cardJSON: [String: Any], zoneID: CKRecordZone.ID) -> CKRecord {
    let recordID = CKRecord.ID(recordName: cardJSON["id"] as! String, zoneID: zoneID)
    let record = CKRecord(recordType: "Card", recordID: recordID)

    // Map all fields from JSON to CKRecord
    // Swift doesn't interpret these -- it's a dumb mapper
    for (key, value) in cardJSON {
        if key == "id" { continue } // id is the recordName
        record[key] = value as? CKRecordValue
    }
    return record
}
```

### 2.6 Conflict Resolution Strategy

For v4.1, use **field-level last-writer-wins** with a `modified_at` timestamp comparison:

1. CKSyncEngine reports `serverRecordChanged` error
2. Swift sends both local and server versions to JS via `sync:conflict`
3. JS SyncAdapter compares `modified_at` timestamps per field
4. Most-recently-modified field value wins
5. Merged result sent back to Swift via `sync:resolved`
6. Swift resubmits the merged CKRecord

For cards that are simple (user hasn't edited the same fields), this auto-resolves. For true conflicts (same field edited on two devices), the newer write wins. This is acceptable for v4.1. More sophisticated merge (e.g., CRDT text merging for `content` field) is deferred.

### 2.7 Modified Existing Components (CloudKit)

| Component | Modification | Impact |
|-----------|-------------|--------|
| BridgeManager.swift | Handle sync:* subtypes in native:sync | Moderate |
| DatabaseManager.swift | No change -- checkpoint model retained | None |
| schema.sql | Add sync_version, sync_status, sync_change_tag columns | Schema migration |
| MutationManager.ts | Set sync_status='pending' on every write | Minor |
| Worker router | Add sync:* handlers | Moderate |
| Native bridge protocol | Extend native:sync with kind discriminator | Minor |

### 2.8 New Components (CloudKit)

| Component | Location | Purpose |
|-----------|----------|---------|
| SyncManager.swift | `native/Isometry/Isometry/SyncManager.swift` | CKSyncEngine owner, CKSyncEngineDelegate |
| SyncRecordMapper.swift | `native/Isometry/Isometry/SyncRecordMapper.swift` | Card/Connection JSON <-> CKRecord mapping |
| SyncAdapter.ts | `src/sync/SyncAdapter.ts` | JS-side sync record handling |
| ConflictResolver.ts | `src/sync/ConflictResolver.ts` | Field-level merge logic |
| SyncStatusProvider.ts | `src/providers/SyncStatusProvider.ts` | Sync state for UI (Tier 3) |

---

## 3. Virtual Scrolling Architecture

### 3.1 The Problem

SuperGrid currently renders ALL cells to the DOM. With N-level axis stacking, the cell count is the Cartesian product of all axis values across all stacking levels. At 10K cards with 3 axes (e.g., folder x status x month), the theoretical maximum is ~2,500 group intersection cells. But with finer granularity or more axes, this can grow.

The existing architecture uses CSS Grid with D3 data join for cell placement. Every cell is a `<div>` with `grid-column` and `grid-row` assignments. All cells are rendered, and the browser handles clipping via `overflow: auto` on the scroll container.

### 3.2 Approach: CSS content-visibility (Recommended)

The simplest and most architecturally consistent approach is **not custom virtual scrolling** but CSS `content-visibility: auto` with `contain-intrinsic-size`. This tells the browser to skip rendering off-screen cells while maintaining their layout dimensions.

**Why this fits Isometry:**

1. SuperGrid uses CSS Grid layout -- `content-visibility: auto` works natively with CSS Grid
2. No changes to D3 data join -- all cells remain in the DOM, they're just not rendered
3. No changes to scroll position tracking -- browser handles it
4. No changes to SuperZoom -- zoom CSS custom properties still work
5. No IntersectionObserver management code needed
6. Browser support: Safari 18.2+, Chrome 85+, Firefox 125+ -- all within Isometry's iOS 17+ / macOS 14+ targets (Safari 17+, and WKWebView uses the system Safari engine)

**Confidence:** HIGH -- this is a pure CSS addition.

```css
.supergrid-cell {
    content-visibility: auto;
    contain-intrinsic-size: auto 80px;  /* matches default cell height */
}

.supergrid-header {
    /* Headers should NOT use content-visibility -- they must remain visible
       for sticky positioning to work correctly */
}
```

### 3.3 Approach: True Virtual Scrolling (If content-visibility is Insufficient)

If content-visibility doesn't provide sufficient performance at 10K+ scale (the requirement says "10K+ card scale"), a true virtual scrolling implementation would be needed. This is more invasive.

**Architecture for true virtual scrolling:**

```
┌──────────────────────────────────────────────────────────────┐
│                    SuperGrid Scroll Container                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Spacer (top): height = rows_above_viewport * rowHeight │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  Visible Cells (D3 data join)                           │  │
│  │  Only cells within viewport + overscan buffer           │  │
│  │                                                         │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  Spacer (bottom): height = rows_below * rowHeight       │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Components for true virtual scrolling:**

| Component | Purpose |
|-----------|---------|
| VirtualViewport | Tracks scroll position, calculates visible row/col range |
| CellPool | Manages DOM element recycling (enter/exit/recycle) |
| SuperGrid._renderCells (modified) | Filters data to visible range before D3 join |

**This approach modifies the D3 data join** -- instead of binding ALL cells, it binds only visible cells and uses spacer divs for scroll height. The SuperStackHeader headers would need special handling (they must stay in the DOM for sticky positioning).

### 3.4 Recommended Phasing

1. **Phase 1: content-visibility CSS** (minimal effort, likely sufficient)
   - Add `content-visibility: auto` and `contain-intrinsic-size` to cell CSS
   - Benchmark with 10K cards
   - If rendering < 16ms: done

2. **Phase 2: True virtual scrolling** (only if Phase 1 is insufficient)
   - Implement VirtualViewport scroll tracking
   - Modify D3 data join to window cells
   - Handle header stickiness separately

### 3.5 Integration with SuperGrid

**content-visibility approach (Phase 1):**

| Component | Modification | Impact |
|-----------|-------------|--------|
| SuperGrid CSS | Add content-visibility: auto to cells | 2 CSS rules |
| SuperGrid._renderCells() | None | None |
| SuperZoom | None (CSS custom properties unaffected) | None |
| SuperStackHeader | Explicitly set content-visibility: visible | 1 CSS rule |

**True virtual scrolling (Phase 2, if needed):**

| Component | Modification | Impact |
|-----------|-------------|--------|
| SuperGrid.ts | Add scroll listener, compute visible range | Major refactor |
| SuperGrid._renderCells() | Filter data before D3 join | Moderate |
| SuperStackHeader | Keep in DOM always (not virtualized) | Minor |
| SuperZoom | Recalculate on zoom change | Minor |
| SuperGridBBoxCache | Invalidate on scroll | Minor |
| SuperGridSelect | Adjust lasso coordinates for scroll offset | Moderate |

### 3.6 New Components (Virtual Scrolling)

**Phase 1 (content-visibility):** No new components. CSS-only change.

**Phase 2 (true virtual scrolling, only if needed):**

| Component | Location | Purpose |
|-----------|----------|---------|
| VirtualViewport | `src/views/supergrid/VirtualViewport.ts` | Scroll position tracking, visible range calc |

---

## 4. Cross-Feature Data Flow

### 4.1 How Features Interact

```
User edits card
    │
    ├── MutationManager.execute()
    │       │
    │       ├── AuditTracker.recordChange()        ← SuperAudit
    │       │       updates session change map
    │       │
    │       ├── sync_status = 'pending' in SQL     ← CloudKit prep
    │       │
    │       └── dirty flag → checkpoint timer      ← Existing checkpoint
    │
    ├── StateCoordinator.notify()
    │       │
    │       ├── Views re-render with audit classes  ← SuperAudit visual
    │       │
    │       └── SuperGrid uses content-visibility   ← Virtual scroll
    │
    └── BridgeManager receives 'mutated'
            │
            └── SyncManager.addPendingChange()     ← CloudKit push queue
```

### 4.2 Launch Sequence with Sync

```
App Launch
    │
    ├── DatabaseManager.loadDatabase() → Data (existing)
    │
    ├── SyncManager.initialize()
    │       └── CKSyncEngine(configuration, stateSerialization, delegate)
    │
    ├── BridgeManager.sendLaunchPayload(dbData)
    │       └── JS loads sql.js, restores state
    │
    └── CKSyncEngine auto-fetches pending changes
            │
            └── SyncManager.handleEvent(.fetchedRecordZoneChanges)
                    │
                    └── BridgeManager → JS: sync:incoming
                            │
                            └── SyncAdapter.handlePull(records)
                                    │
                                    └── upsert cards/connections
                                            │
                                            └── checkpoint → save
```

### 4.3 Sync + Audit Interaction

When a remote device pushes changes via CKSyncEngine:
1. SyncAdapter receives incoming records
2. SyncAdapter upserts cards into sql.js
3. AuditTracker does NOT mark these as session changes (they are remote changes)
4. AuditTracker could optionally mark them as 'remote-modified' with a different visual treatment

This means AuditTracker needs to distinguish between:
- **Local changes** (user edited): tracked in session change map
- **Sync changes** (from remote device): optionally tracked separately
- **Import changes** (from ETL): tracked by source provenance, not session map

---

## 5. Component Boundary Summary

### 5.1 Existing Components: No Changes Required

| Component | Rationale |
|-----------|-----------|
| DatabaseManager.swift | Checkpoint model retained as-is |
| AssetsSchemeHandler.swift | No web asset changes |
| SubscriptionManager.swift | StoreKit tiers unchanged |
| FeatureGate.swift | May add sync-related gating later |
| FilterProvider.ts | No filter changes needed |
| PAFVProvider.ts | No axis changes needed |
| SelectionProvider.ts | No selection changes |
| DensityProvider.ts | No density changes |
| SuperStackHeader.ts | No header logic changes |
| SuperGridSizer.ts | No resize changes |
| SuperGridBBoxCache.ts | No cache changes (content-visibility approach) |
| SuperGridSelect.ts | No selection changes (content-visibility approach) |
| CatalogWriter.ts | Existing provenance tracking sufficient |
| DedupEngine.ts | No dedup changes |

### 5.2 Existing Components: Modified

| Component | What Changes | Feature |
|-----------|-------------|---------|
| MutationManager.ts | Hook for AuditTracker; set sync_status on writes | Audit + Sync |
| BridgeManager.swift | Handle sync:* subtypes in native:sync dispatch | Sync |
| SuperGrid.ts _renderCells() | Add data-source attr, audit CSS classes | Audit |
| Other views (list, grid, etc.) | Add data-source attr, audit CSS classes | Audit |
| schema.sql | Add sync columns via migration | Sync |
| Worker router (main.worker.ts) | Add sync:* message handlers | Sync |
| protocol.ts | Add sync message types | Sync |
| CSS files | Add content-visibility; add audit styles | VScroll + Audit |
| LaunchPayload | Include sync state/token | Sync |

### 5.3 New Components

| Component | Layer | Feature | Tier |
|-----------|-------|---------|------|
| AuditTracker.ts | JS | Audit | 3 (ephemeral) |
| AuditProvider.ts | JS | Audit | 3 (ephemeral) |
| SourceColorMap.ts | JS | Audit | 2 (session) |
| FieldMetadata.ts | JS | Audit | static |
| SyncManager.swift | Native | Sync | N/A |
| SyncRecordMapper.swift | Native | Sync | N/A |
| SyncAdapter.ts | JS | Sync | 1 (durable) |
| ConflictResolver.ts | JS | Sync | N/A |
| SyncStatusProvider.ts | JS | Sync | 3 (ephemeral) |

---

## 6. Recommended Build Order

The build order is driven by dependency chains and risk:

### Phase 1: SuperAudit (lowest risk, no architectural changes)

**Build first because:**
- Entirely in JS runtime -- no Swift changes, no schema migration
- No cross-device concerns
- Validates the audit tracking pattern before sync complicates it
- Delivers immediate visual value

**Order within phase:**
1. AuditTracker + MutationManager hook (foundation)
2. SourceColorMap + CSS styles (source provenance -- simplest visual)
3. AuditProvider + view integration (change tracking visuals)
4. FieldMetadata + SuperGrid calculated distinction
5. Integration tests across all 9 views

### Phase 2: Virtual Scrolling (low risk, CSS-only)

**Build second because:**
- CSS content-visibility is a 2-rule change
- Needs benchmarking before/after with large datasets
- If insufficient, Phase 2b (true virtual scroll) is a larger effort
- Independent of sync

**Order within phase:**
1. Add content-visibility CSS rules
2. Benchmark with 5K and 10K card datasets
3. If performance target met (<16ms render): done
4. If not: implement VirtualViewport (Phase 2b)

### Phase 3: CloudKit Sync (highest risk, architectural evolution)

**Build last because:**
- Requires schema migration (sync columns)
- Requires new Swift components (SyncManager)
- Requires bridge protocol extension
- Depends on SuperAudit being stable (audit distinguishes local vs remote changes)
- Most complex testing (multi-device simulation)
- Can be descoped if timeline is tight (existing iCloud Documents sync continues working)

**Order within phase:**
1. Schema migration (add sync columns)
2. SyncAdapter + ConflictResolver in JS
3. SyncManager + SyncRecordMapper in Swift
4. Bridge protocol extension (sync:* subtypes)
5. Integration: MutationManager -> SyncManager pending changes
6. Conflict resolution flow
7. SyncStatusProvider + UI indicators
8. Multi-device testing

---

## 7. Scalability Considerations

| Concern | At 1K cards | At 10K cards | At 100K cards |
|---------|-------------|--------------|---------------|
| SuperAudit session map | Negligible (Map<string, enum>) | Negligible | ~4MB Map -- still fine |
| Source provenance | CSS attribute -- zero overhead | Zero overhead | Zero overhead |
| Virtual scroll (content-visibility) | No benefit (all visible) | ~15-27% faster render | Essential -- prevents jank |
| CloudKit sync push | Seconds | ~30 seconds (batched) | Minutes -- needs pagination |
| Checkpoint size | ~100KB | ~1MB | ~10MB -- base64 transport concern |
| Conflict resolution | Rare | Occasional | Frequent -- needs batch merge |

### Checkpoint Size at Scale

At 100K cards, the checkpoint blob approaches 10MB. Base64 encoding inflates this to ~13MB. This is a concern for the WKWebView bridge (evaluateJavaScript string transport). The binary transport via Transferable objects in the Worker and base64 through the native bridge is the existing pattern and should continue to work, but may need profiling at 100K scale.

---

## 8. Patterns to Follow

### Pattern 1: Provider with Tier-Appropriate Persistence

AuditProvider follows the established provider pattern (subscribe/notify) with Tier 3 ephemeral persistence (like SelectionProvider). No persistence to ui_state, no sync.

```typescript
class AuditProvider {
    private tracker: AuditTracker;
    private colorMap: SourceColorMap;
    private subscribers = new Set<() => void>();

    getChangeType(cardId: string): ChangeType | null { ... }
    getSourceColor(source: string): string { ... }

    subscribe(cb: () => void): () => void { ... }
}
```

### Pattern 2: Bridge Message Subtyping

Use the existing `native:action` pattern (kind discriminator) for sync messages. This keeps the bridge at 6 message types while supporting extensible sync operations.

```swift
case "native:sync":
    let payload = body["payload"] as? [String: Any]
    let kind = payload?["kind"] as? String ?? ""
    switch kind {
    case "outgoing": handleSyncOutgoing(payload)
    case "resolved": handleSyncResolved(payload)
    default: break
    }
```

### Pattern 3: Schema Migration via Worker

Schema migrations run in the sql.js Worker at initialization time. The Worker checks a `schema_version` in `ui_state` and applies ALTER TABLE statements as needed. This is the same pattern used for existing schema evolution.

```typescript
// In Worker init, after db loaded
const version = getSchemaVersion(db); // reads ui_state 'schema_version'
if (version < 2) {
    db.exec("ALTER TABLE cards ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE cards ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'");
    // ... more migrations ...
    setSchemaVersion(db, 2);
}
```

---

## 9. Anti-Patterns to Avoid

### Anti-Pattern 1: Swift Understanding Card Schema

**What:** Making Swift parse or understand the card data model, create Swift structs that mirror Card, or run SQL queries against the database.

**Why bad:** Violates the shell architecture (D-011). Creates two sources of truth for the schema. Makes schema evolution require changes in both JS and Swift.

**Instead:** Swift treats card JSON as `[String: Any]` dictionaries. It maps keys to CKRecord fields mechanically without interpreting them. The field list is fixed and enumerated, but Swift doesn't validate field values.

### Anti-Pattern 2: Parallel State Store for Audit

**What:** Creating a SQLite table (`audit_log`) that records every change with old/new values.

**Why bad:** Doubles write overhead, grows without bound, must be synced or excluded from sync, complex cleanup logic.

**Instead:** Session-scoped in-memory Map. Changes are tracked only for the current session. If the user wants persistent audit history, that's a future feature.

### Anti-Pattern 3: Custom Virtual Scroll Before content-visibility

**What:** Implementing scroll event listeners, DOM element recycling pools, and visible range calculations before trying the CSS-only approach.

**Why bad:** Massive complexity for a problem that CSS `content-visibility: auto` may solve with 2 lines. Custom virtual scrolling also conflicts with SuperGrid's D3 data join pattern and sticky header positioning.

**Instead:** Try content-visibility first. Benchmark. Only build custom virtual scrolling if the CSS approach fails the 16ms render budget at 10K cards.

### Anti-Pattern 4: Full Database Sync via CKRecord

**What:** Converting the entire sql.js database into CKRecords on first sync (initial sync).

**Why bad:** 10K cards = 10K CKRecord operations = rate limiting, timeout, and potential data loss if interrupted.

**Instead:** Initial sync should be chunked (100-200 records per batch, matching the existing ETL batch size). Use CKSyncEngine's built-in batching and retry logic. Accept that initial sync may take minutes.

---

## 10. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CKSyncEngine requires record-level knowledge that contradicts D-011 | HIGH | Scope SyncRecordMapper as a thin pass-through, not a data model |
| content-visibility not sufficient for 10K cells | MEDIUM | Benchmark early; have VirtualViewport design ready as fallback |
| CloudKit rate limits during initial sync | MEDIUM | Chunk operations; accept slow initial sync |
| Conflict resolution loses data | HIGH | Always preserve both versions locally; auto-merge only when timestamps clearly diverge |
| Base64 checkpoint transport at 100K cards | LOW | Profile at scale; consider binary WebSocket transport if needed |
| WKWebView content-visibility support | LOW | WKWebView uses system Safari engine; Safari 17+ on iOS 17+ supports it (verify) |
| Bridge message ordering during sync | MEDIUM | Correlation IDs already exist; sync messages use same pattern |

---

## Sources

- [CKSyncEngine WWDC 2023](https://developer.apple.com/videos/play/wwdc2023/10188/) -- Apple's official session on CKSyncEngine
- [Superwall CKSyncEngine Tutorial](https://superwall.com/blog/syncing-data-with-cloudkit-in-your-ios-app-using-cksyncengine-and-swift-and-swiftui/) -- Practical CKSyncEngine implementation guide
- [Apple Sample: CloudKit Sync Engine](https://github.com/apple/sample-cloudkit-sync-engine) -- Apple's official sample project
- [Ryan Ashcraft: CloudKit Sync Library Lessons](https://ryanashcraft.com/what-i-learned-writing-my-own-cloudkit-sync-library/) -- Field experience with CloudKit sync
- [content-visibility: auto](https://web.dev/articles/content-visibility) -- Google's guide to content-visibility performance
- [CSS content-visibility MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility) -- Browser compatibility and usage
- [content-visibility Performance Gem](https://cekrem.github.io/posts/content-visibility-auto-performance/) -- Real-world performance measurements
- [Google's Data Grid 10x Faster](https://medium.com/@johan.isaksson/how-i-made-googles-data-grid-scroll-10x-faster-with-one-line-of-css-78cb1e8d9cb1) -- content-visibility in data grids
- [Instant SQLite Audit Trail](https://github.com/simon-weber/Instant-SQLite-Audit-Trail) -- SQLite trigger-based audit patterns
- [Mastering CloudKit: Complete Guide](https://medium.com/@serkankaraa/mastering-cloudkit-a-complete-guide-to-icloud-powered-app-sync-in-ios-775bcc296ba8) -- CloudKit sync overview
- [GRDB CloudKit Sync Discussion](https://github.com/groue/GRDB.swift/discussions/1569) -- Community discussion on SQLite + CloudKit patterns
