# Feature Landscape

**Domain:** Visual intelligence (SuperAudit), CloudKit bidirectional sync, virtual scrolling for SuperGrid
**Researched:** 2026-03-06
**Confidence:** MEDIUM -- SuperAudit patterns well-understood from data grid ecosystem; CKSyncEngine API confirmed via Apple WWDC23 and official sample code but architectural tension with existing checkpoint model requires careful design; virtual scrolling patterns well-established but CSS Grid interaction with N-level stacking needs validation.

---

## Context: What Already Exists vs. What Is New

**Already built (do not rebuild):**
- 9 D3 views with stable key functions and D3 data join rendering
- SuperGrid with CSS Grid layout, N-level axis stacking, collapse (aggregate/hide), drag reorder, sort, filter, FTS5 search, density, zoom, resize, selection, transpose, time hierarchy, aggregation cards
- ETL pipeline: 9 import sources (6 file-based + 3 native), DedupEngine with `source + source_id` dedup
- Data Catalog schema: `import_sources` and `import_runs` tables tracking provenance metadata
- `cards.source` and `cards.source_id` columns already in schema for every imported card
- iCloud Documents checkpoint sync (whole-database file-level, not per-card)
- DatabaseManager actor with atomic `.tmp/.bak/.db` rotation and NSFileCoordinator for iCloud
- BridgeManager with 6-message protocol (native:ready, native:launch, checkpoint, mutated, native:action, native:sync)
- StoreKit 2 with Free/Pro/Workbench tiers and FeatureGate enforcement
- `CellDatum` interface with `count`, `card_ids`, and dynamic axis keys
- SuperGrid renders group intersections (aggregate cells), not individual cards -- max ~2,500 cells

**v4.1 adds three new capabilities:**
- SuperAudit: visual intelligence layer across all views (change tracking, source provenance color coding, calculated field distinction)
- CloudKit Sync: full bidirectional per-record sync with custom zones, change tokens, conflict resolution, push notifications
- Virtual Scrolling: windowed rendering for SuperGrid at 10K+ card scale

---

## Feature Domain 1: SuperAudit (Change Tracking + Source Provenance + Calculated Fields)

### Table Stakes

Features users expect when "change tracking" and "source provenance" are promised.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Change tracking: new/modified/deleted visual indicators** | Users need to see what changed since last import/sync. Color-coded row/cell backgrounds (green=new, orange=modified, red=deleted) are universal in data grid UIs. | LOW | Existing `DedupEngine.process()` already classifies cards as insert/update/skip. Need to surface classification result to views. |
| **Change tracking session scope** | Change indicators must reset on explicit user action (e.g., "Acknowledge Changes" button), not persist forever. Session-only (Tier 3 per D-005). | LOW | In-memory Set<string> for each classification (inserted/updated/deleted IDs). Clear on user action. |
| **Source provenance color coding by import origin** | Cards imported from Apple Notes should be visually distinct from CSV imports. Color-coded badges or cell borders keyed on `cards.source` field. | LOW | `cards.source` already populated by all ETL paths. Query `SELECT DISTINCT source FROM cards WHERE deleted_at IS NULL` for palette assignment. |
| **Source legend/key** | Users must be able to see what each color means. A small legend showing source -> color mapping in the toolbar or sidebar. | LOW | Driven by distinct source values from the database. |
| **Calculated field visual distinction** | SQL-derived values (aggregation counts, summary cells) must look different from raw data. Users need to distinguish "this is a count" from "this is the actual value." | LOW | SuperGrid already has `isSummary: true` on aggregate cells (Phase 30). Extend to add a visual cue (italic text, different background shade, or "fx" icon). |
| **Toggle audit overlay on/off** | Change tracking and provenance coloring should be optional. Not all users want visual noise at all times. | LOW | Boolean toggle in toolbar. When off, standard styling applies. |

### Differentiators

Features that exceed baseline expectations and create genuine competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Cross-view audit consistency** | Change indicators visible in ALL 9 views (list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid), not just SuperGrid. Most data grid tools limit change tracking to the grid view only. | MEDIUM | Each view's render() method needs to check card ID against audit state Sets. D3 data join already uses `d.id` key -- add `.classed('audit-new', d => auditState.isNew(d.id))` in each view. |
| **Source provenance in SuperGrid headers** | When grouping by `source`, header cells show the source color automatically. Mixed-source groups show a multi-color indicator. | LOW | Special-case in `_createColHeaderCell` / row header creation when axis field is `source`. |
| **Import diff detail panel** | Click a change-indicator badge to see what changed: field-by-field diff between previous and current values. Similar to git diff for a single card. | HIGH | Requires storing the previous card state (snapshot before import run). Significant storage overhead. Defer unless validated. |
| **Temporal audit: "show state as of date X"** | Time-travel through import history to see the database at a prior import run. Like git blame for imported data. | HIGH | Requires event sourcing or snapshot storage. Not feasible with current architecture without major schema additions. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Per-field change tracking (cell-level diff highlighting)** | Requires storing full card snapshots before each import. OOM risk in WASM for large datasets. Complexity far exceeds value for v4.1. | Track change at the card level (inserted/updated/deleted), not field level. Card-level is sufficient for visual intelligence. |
| **Persistent audit log (Tier 1 durable)** | Audit state persisted across sessions bloats the database and conflicts with the existing `import_runs` provenance model. | Keep audit state Tier 3 (ephemeral). The `import_runs` table already provides durable provenance history for forensic queries. |
| **Real-time change streaming from native sources** | Watching NoteStore.sqlite or EventKit for live changes is fragile (WAL locks, TCC, schema changes). | Manual re-import with DedupEngine handles updates safely. Change indicators show what DedupEngine classified. |

---

## Feature Domain 2: CloudKit Bidirectional Sync

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **CKSyncEngine integration** | Apple's official sync engine (iOS 17+/macOS 14+) handles change tokens, batching, retry, and subscriptions. Using raw `CKModifyRecordsOperation` is reinventing what Apple provides. | HIGH | New Swift code in native shell. Requires `CloudKit.framework`, entitlements, and App Store Connect setup for container ID. |
| **Custom record zone** | All Isometry records live in a dedicated custom zone (not the default zone) because change tokens only work in custom zones. | LOW | Single zone creation in `handleEvent(.accountChange)`. Zone name: `IsometryData`. |
| **Card CKRecord serialization** | Cards must serialize to/from CKRecord for CloudKit storage. All 25 card columns need mapping. CKRecord supports String, Int64, Double, Date, Data, Asset, Location, and Reference. | MEDIUM | New `CardRecordMapper` that converts between `Card` columns and CKRecord keys. Timestamps become CKRecord Date fields. Tags (JSON string) becomes CKRecord String. |
| **Connection CKRecord serialization** | Connections need their own record type. source_id and target_id become CKRecord.Reference for referential integrity. | MEDIUM | `ConnectionRecordMapper` with CKRecord.Reference for endpoint cards. |
| **Change token persistence** | CKSyncEngine provides state serialization after each sync. This must be persisted locally so the next sync fetches only new changes. | LOW | Store as Data in a local file (not in the sql.js database -- Swift owns sync state). |
| **Conflict resolution: last-writer-wins with timestamps** | When two devices edit the same card, the one with the later `modified_at` wins. Simple, predictable, matches user mental model. | MEDIUM | In `handleEvent(.sentRecordZoneChanges)`, when error is `.serverRecordChanged`, compare `modified_at` of local vs server record. Keep the newer one. |
| **On-open polling** | When the app launches or returns to foreground, fetch changes from CloudKit to catch up with edits from other devices. | LOW | Call `engine.fetchChanges()` in `handleEvent(.accountChange)` and on `scenePhase == .active`. |
| **Incoming record merge into sql.js** | When records arrive from CloudKit, they must be injected into the sql.js database via the bridge. This means Swift must post card data to JS for insertion. | HIGH | New bridge message type or extension of `native:sync`. JS Worker needs a handler to INSERT/UPDATE/DELETE cards from sync payloads without going through ImportOrchestrator (sync is not an import). |
| **Soft-delete sync** | When a card is soft-deleted on device A, device B must mark it deleted too. CKSyncEngine handles this via record zone change deletions. | MEDIUM | Map `deleted_at IS NOT NULL` to CKSyncEngine pending deletion. Incoming deletions set `deleted_at` via bridge. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Real-time push via CKSubscription** | CKSyncEngine manages subscriptions and silent push notifications automatically. When device B edits a card, device A gets a push within seconds and auto-syncs. No polling delay. | MEDIUM | Requires push notification entitlement and capability in Xcode project. CKSyncEngine handles subscription lifecycle internally. |
| **Sync status indicator in UI** | Visual indicator showing sync state: idle (checkmark), syncing (spinner), error (red dot). Surfaces sync health to the user. | LOW | `@Published var syncStatus: SyncStatus` in a SyncManager class. SwiftUI overlay reads this. |
| **Connection sync** | Sync connections (not just cards) across devices. Connections reference cards by ID, so connection sync depends on card sync being reliable. | MEDIUM | Second record type in the same custom zone. CKRecord.Reference ensures referential integrity. |
| **UI state sync** | Sync Tier 2 state (filter settings, axis mappings, view config) so users see the same view on all devices. | HIGH | Adds complexity and conflict potential. Tier 2 state is session-level and view-specific. Syncing it creates confusing UX when two devices have different screens open. |
| **Offline queue with merge** | When offline, queue mutations locally. On reconnect, CKSyncEngine replays them. This is built into CKSyncEngine's pending changes mechanism. | LOW | CKSyncEngine handles this natively. No extra code needed beyond proper `pendingRecordZoneChanges` management. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Syncing ui_state table** | Tier 2 state (view configs, filter settings) is device-local by design (D-005). Syncing it creates conflicts when two devices have different views open. One device's "kanban by status" overwrites another's "timeline by date." | Keep ui_state Tier 2 (session, device-local). Only sync Tier 1 data (cards, connections). |
| **Syncing selection state** | Selection is Tier 3 ephemeral (D-005). It is transient pointer/touch state. Syncing it is nonsensical. | Selection remains Tier 3. Not synced. |
| **Full database checkpoint via CloudKit** | Uploading the entire sql.js database as a CKAsset on every change defeats the purpose of per-record sync. The existing iCloud Documents checkpoint is already this model. | Use per-record CKRecord sync. The iCloud Documents checkpoint path remains as a backup/fallback. |
| **Multi-user collaborative editing** | Real-time collaboration (Google Docs style) requires CRDT or OT, presence indicators, cursor sharing, and sub-second sync. Massively complex. Out of scope per PROJECT.md. | CloudKit sync is single-user, multi-device. Each user has their own private CloudKit container. |
| **Conflict resolution UI** | A merge dialog for every conflicting card is overwhelming for a data projection tool. Users don't want to resolve conflicts manually for bulk-imported data. | Last-writer-wins by `modified_at`. If this proves insufficient, upgrade to field-level merge (keep non-conflicting changes from both sides). |

---

## Feature Domain 3: Virtual Scrolling for SuperGrid

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Row virtualization** | Only render CSS Grid rows visible in the viewport plus a buffer. When scrolling, swap row elements in/out. Essential for 10K+ card datasets where group intersections can produce thousands of rows. | HIGH | SuperGrid currently renders ALL cells in `_renderCells()` via a single D3 data join. Virtualization requires intercepting the scroll event and computing visible row range. |
| **Frozen/sticky headers during virtual scroll** | Column headers and row headers must stay visible while data cells scroll. SuperGrid already uses `position: sticky` for headers -- this must continue to work with virtualized rows. | MEDIUM | Headers are outside the virtualized row range. They pin to top/left via CSS sticky positioning. Virtualized rows need correct `grid-row` assignments offset from the header zone. |
| **Consistent scroll height** | The scroll container must maintain the correct total height as if all rows were rendered. A spacer element or `padding-top/bottom` on the grid creates the illusion of full content. | MEDIUM | Calculate `totalRows * rowHeight` for the scroll sentinel. Place rendered rows at their correct scroll offset using CSS Grid `grid-row` assignments. |
| **Performance: 60fps scroll at 10K cards** | Users expect smooth scrolling. Virtual scrolling that jitters or shows blank rows during fast scroll is worse than no virtualization. | HIGH | Requires overscan buffer (render 2-3 screens of rows beyond viewport), rAF-throttled scroll handler, and efficient D3 join updates. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **content-visibility: auto as progressive enhancement** | CSS `content-visibility: auto` with `contain-intrinsic-size` tells the browser to skip rendering off-screen elements. As of September 2025, baseline-available across all major browsers. Much simpler than full virtual scrolling -- no scroll math, no DOM recycling. | LOW | Add `content-visibility: auto; contain-intrinsic-size: auto 40px;` to `.data-cell` CSS. This is a zero-code progressive enhancement. Can combine with full virtualization for belt-and-suspenders approach. |
| **Column virtualization** | In addition to row virtualization, virtualize columns for very wide grids (50+ columns). Only render columns visible in the horizontal viewport. | HIGH | More complex than row virtualization because CSS Grid `grid-template-columns` must be dynamically adjusted. Headers also need column virtualization. Likely unnecessary -- SuperGrid collapses at N-level, so visible columns rarely exceed 30-40. |
| **Incremental query (server-side pagination)** | Instead of fetching all group intersections from sql.js, fetch only the visible window. SQL `LIMIT/OFFSET` or cursor-based pagination for the supergrid:query. | HIGH | Requires changes to `SuperGridQuery` in the Worker, the bridge protocol, and the rendering pipeline. Would reduce initial load time but adds round-trip latency on scroll. |
| **Lazy card_ids loading** | `CellDatum.card_ids` can be large (thousands of IDs per cell). Load card_ids only for visible cells, not for all 2,500+ cells upfront. | MEDIUM | Deferred card_ids fetch via a secondary Worker call when a cell enters the viewport. Reduces initial payload size significantly. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Virtual scrolling for all 9 views** | Most views (list, grid, kanban, calendar, timeline, gallery, network, tree) have natural limits. Network and tree are graph layouts where virtual scrolling is architecturally incompatible. Gallery rebuilds tiles on render(). Only SuperGrid needs virtualization. | Target SuperGrid only. Other views handle 1K-5K cards without virtualization issues. |
| **Infinite scroll / lazy loading** | Loading data on demand as user scrolls implies the data is not fully in memory. But sql.js has the full dataset in WASM memory already. Infinite scroll adds complexity without benefit when the data is already local. | Render virtualization (DOM-only), not data virtualization. All data stays in sql.js; only the rendered DOM is windowed. |
| **Virtual scrolling for 100K+ rows** | PROJECT.md explicitly marks this out of scope: "Virtual scrolling for 100K+ rows -- grid renders group intersections (max 2,500 cells)." SuperGrid renders aggregate cells at group intersections, not raw rows. | Target 10K cards (which produce ~2,500-5,000 group intersection cells). The 100K row case would require server-side pagination, which changes the architecture. |
| **Third-party virtualization library** | Libraries like TanStack Virtual, react-window, or Clusterize.js assume React/framework DOM ownership. SuperGrid uses D3 data join on raw DOM. Mixing D3 `.join()` with a React virtualizer creates ownership conflicts. | Build a minimal custom virtualizer (~200 lines) that works with D3's `.join()` pattern. Compute visible row range from scroll position, filter `cellPlacements` before the D3 join. |

---

## Feature Dependencies

```
[SuperAudit: Change Tracking]
    requires: DedupEngine classification output surfaced to views (existing)
    requires: AuditState class (new, Tier 3 ephemeral)
    consumed-by: All 9 views (.classed() in D3 join)

[SuperAudit: Source Provenance Color Coding]
    requires: cards.source column (existing in schema)
    requires: SourceColorMapper (new, assigns colors to distinct source values)
    consumed-by: All 9 views

[SuperAudit: Calculated Field Distinction]
    requires: CellDatum.isSummary flag (existing, Phase 30)
    consumed-by: SuperGrid only (only view with aggregate cells)

[CloudKit Sync: CKSyncEngine]
    requires: CloudKit entitlement + container ID (Xcode config)
    requires: CardRecordMapper (new, Card <-> CKRecord)
    requires: ConnectionRecordMapper (new, Connection <-> CKRecord)
    requires: SyncManager actor (new, owns CKSyncEngine lifecycle)
    requires: Bridge extension for incoming sync records (new message or extended native:sync)
    requires: Worker handler for sync-originated inserts/updates/deletes (new)
    blocked-by: App Store Connect CloudKit container setup

[CloudKit Sync: Conflict Resolution]
    requires: CKSyncEngine event handling (above)
    requires: modified_at timestamp comparison logic

[CloudKit Sync: Push Notifications]
    requires: Push notification entitlement (Xcode capability)
    requires: CKSyncEngine (handles subscriptions internally)

[Virtual Scrolling: Row Virtualization]
    requires: SuperGrid._renderCells() refactor to accept visible row range
    requires: Scroll handler computing visible rows from scrollTop + rowHeight
    requires: Spacer element maintaining total scroll height
    does-not-require: Worker or bridge changes (all data already fetched)

[content-visibility: auto enhancement]
    requires: CSS change only (.data-cell rule)
    independent: No code changes needed
```

### Dependency Notes

- **SuperAudit is independent of CloudKit and Virtual Scrolling.** All three features can be developed in parallel.
- **CloudKit Sync is the most architecturally disruptive.** It changes the native shell's responsibility from "opaque blob handler" to "per-record sync participant." This contradicts the current `CLAUDE.md` for the native shell which explicitly states "Swift does not query, parse, or understand the database" and "Do NOT implement record-level CloudKit sync." This decision (D-010) needs to be revisited and a new decision recorded.
- **Virtual Scrolling is SuperGrid-only.** It does not affect other views, the Worker, or the native shell.
- **content-visibility: auto is a CSS-only progressive enhancement** that can ship immediately as a zero-risk improvement before full virtualization is built.

---

## MVP Recommendation

### Prioritize

1. **SuperAudit: Change tracking (new/modified/deleted indicators)** -- Immediate user value, LOW complexity, builds on existing DedupEngine classification output. Session-only (Tier 3).
2. **SuperAudit: Source provenance color coding** -- Immediate visual intelligence, LOW complexity, uses existing `cards.source` column. Distinct source count is typically 3-9 (manageable palette).
3. **SuperAudit: Calculated field distinction** -- LOW complexity, extends existing `isSummary` flag with a visual cue. SuperGrid only.
4. **content-visibility: auto CSS enhancement** -- Zero-risk, CSS-only, immediate performance benefit for SuperGrid and other views with many DOM elements.
5. **CloudKit Sync: CKSyncEngine with custom zone, card sync, last-writer-wins conflict resolution** -- HIGH complexity but essential for multi-device value proposition. This is the core sync upgrade from file-level to record-level.
6. **Virtual Scrolling: Row virtualization for SuperGrid** -- HIGH complexity, needed for 10K+ scale. Can defer if content-visibility: auto provides sufficient performance improvement.

### Defer

- **Import diff detail panel**: HIGH complexity, requires card snapshot storage. Validate need after basic change tracking ships.
- **UI state sync**: Architecturally problematic (D-005 says Tier 2 is device-local). Validate user demand before building.
- **Column virtualization**: SuperGrid rarely exceeds 30-40 visible columns due to N-level axis stacking. Row virtualization alone likely sufficient.
- **Incremental supergrid:query pagination**: Changes the Worker protocol and query pipeline. Only needed if virtual scrolling proves insufficient for 10K+ scale.
- **Connection sync**: Ship card sync first, validate stability, then add connection sync as a follow-up.

---

## Phase Ordering Rationale

SuperAudit should come first because:
1. It is the lowest-complexity highest-user-value feature
2. It is purely additive (no architectural changes)
3. Change tracking results from DedupEngine are already available but not surfaced

CloudKit Sync should come second because:
1. It is the most architecturally significant change (overrides D-010)
2. It requires entitlement and provisioning setup that may have lead times
3. The content-visibility: auto enhancement provides a quick performance win while full virtualization is deferred

Virtual Scrolling should come third because:
1. content-visibility: auto may provide 80% of the benefit with 1% of the effort
2. The full virtualization refactor of `_renderCells()` is substantial
3. It only benefits datasets >5,000 group intersections, which is an edge case with typical PAFV axis configurations

---

## Sources

### Change Tracking / Audit UX
- [React Datasheet Grid: Tracking Row Changes](https://react-datasheet-grid.netlify.app/docs/examples/tracking-rows-changes/) -- CSS class patterns (row-created green, row-updated orange, row-deleted red) and Set-based tracking
- [Telerik RadGridView: Tracking Changes](https://docs.telerik.com/devtools/winforms/controls/gridview/insert-update-delete-records/tracking-changes-in-radgridview) -- Row state indicators and edit state tracking
- [AG Grid: Change Detection](https://www.ag-grid.com/javascript-data-grid/change-detection/) -- Built-in change detection with minimal DOM updates
- [Data Provenance vs Data Lineage (Monte Carlo)](https://www.montecarlodata.com/blog-data-provenance-vs-data-lineage-difference/) -- Source provenance tracking patterns

### CloudKit / CKSyncEngine
- [Sync to iCloud with CKSyncEngine (WWDC23)](https://developer.apple.com/videos/play/wwdc2023/10188/) -- Official Apple session introducing CKSyncEngine
- [Apple sample-cloudkit-sync-engine (GitHub)](https://github.com/apple/sample-cloudkit-sync-engine) -- Official reference implementation with SyncedDatabase.swift
- [Superwall: Syncing Data with CKSyncEngine](https://superwall.com/blog/syncing-data-with-cloudkit-in-your-ios-app-using-cksyncengine-and-swift-and-swiftui/) -- Practical implementation guide with handleEvent and nextRecordZoneChangeBatch patterns
- [CKSyncEngine Questions and Answers (Christian Selig)](https://christianselig.com/2026/01/cksyncengine/) -- Practical Q&A on CKSyncEngine edge cases
- [Ryan Ashcraft: Writing My Own CloudKit Syncing Library](https://ryanashcraft.com/what-i-learned-writing-my-own-cloudkit-sync-library/) -- Pitfalls and lessons learned with change tokens and idempotent processing
- [Apple Developer: nextRecordZoneChangeBatch](https://developer.apple.com/documentation/cloudkit/cksyncenginedelegate-1q7g8/nextrecordzonechangebatch(_:syncengine:)) -- Official API documentation

### Virtual Scrolling
- [content-visibility: auto -- A Hidden Performance Gem](https://cekrem.github.io/posts/content-visibility-auto-performance/) -- CSS-only virtual scrolling alternative with contain-intrinsic-size
- [web.dev: content-visibility](https://web.dev/articles/content-visibility) -- 7x rendering boost on initial load; baseline-available September 2025
- [How I Made Google's Data Grid Scroll 10x Faster](https://medium.com/@johan.isaksson/how-i-made-googles-data-grid-scroll-10x-faster-with-one-line-of-css-78cb1e8d9cb1) -- content-visibility: auto applied to data grid
- [Virtual Scrolling for High-Performance Interfaces (OpenReplay)](https://blog.openreplay.com/virtual-scrolling-high-performance-interfaces/) -- Overview of virtualization patterns, overscan buffer sizing
- [Virtual List in Vanilla JavaScript (Sergi Mansilla)](https://sergimansilla.com/blog/virtual-scrolling/) -- Framework-free implementation maintaining ~30 DOM rows regardless of list size
- [DebugBear: content-visibility](https://www.debugbear.com/blog/content-visibility-api) -- Performance measurements and Safari Cmd+F limitation

---

*Feature research for: Isometry v4.1 Sync + Audit -- SuperAudit, CloudKit Sync, Virtual Scrolling*
*Researched: 2026-03-06*
