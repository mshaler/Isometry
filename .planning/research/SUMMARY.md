# Project Research Summary

**Project:** Isometry v4.1 -- Sync + Audit
**Domain:** Change tracking / audit visualization, CloudKit bidirectional sync, CSS Grid virtual scrolling
**Researched:** 2026-03-06
**Confidence:** MEDIUM overall -- HIGH for SuperAudit and virtual scrolling (pure additive JS/CSS, no new deps); MEDIUM for CloudKit sync (CKSyncEngine is well-documented but the sql.js-in-WKWebView bridge architecture is unique with no direct precedents)

## Executive Summary

Isometry v4.1 adds three features at three distinct architectural layers, and the research is unanimous on one point: they are independent and should be built in strict priority order. SuperAudit (change tracking, source provenance, calculated field distinction) is entirely a JS/TypeScript concern requiring zero new dependencies and zero Swift changes -- it layers visual intelligence onto existing data using in-memory session state and CSS classes. Virtual scrolling for SuperGrid is purely a rendering optimization achievable with CSS `content-visibility: auto` (2 CSS rules, zero code changes) as a first pass, with custom JS windowing as a fallback only if benchmarks prove it necessary. CloudKit bidirectional sync is the architecturally significant feature -- it replaces the current iCloud Documents checkpoint sync (D-010) with per-record CKSyncEngine sync, requiring Swift to gain minimal awareness of card/connection records crossing the WKWebView bridge.

The recommended approach is: ship SuperAudit first (low risk, immediate user value), ship content-visibility CSS immediately as a zero-cost performance win, then tackle CloudKit sync last (highest risk, most complex testing). The key architectural decision is that CloudKit record-level sync must REPLACE iCloud Drive file sync, not supplement it -- running both creates a dual-sync scenario where checkpoint overwrites undo record-level changes, causing silent data loss. The checkpoint persistence pattern is preserved for local crash recovery only, not cross-device sync.

The primary risks concentrate in CloudKit sync: the existing "opaque blob" invariant (D-011) must be relaxed to let Swift map card JSON to CKRecord fields; the bridge must handle bulk sync mutations without starving user-initiated queries on the single Worker thread; and the migration from file sync to record sync is a one-way door. All three risks have clear mitigations identified in the research: JS-driven sync keeps the schema in one place, batched sync messages with user-query priority prevent Worker starvation, and a clean migration path (read existing ubiquity container, seed CloudKit, delete file sync copy) prevents dual-sync conflicts.

## Key Findings

### Recommended Stack

The v4.1 stack changes are dependency-light. SuperAudit adds zero dependencies (SQLite triggers for the `card_changes` audit trail, CSS custom properties for provenance colors, CSS `::before` for calculated field indicators). Virtual scrolling adds zero dependencies (CSS `content-visibility: auto` for the 80% case, ~50 LOC custom viewport calculator for the 20% case). CloudKit sync adds one system framework (CKSyncEngine via `import CloudKit`, already available on the target platforms) plus a Remote Notifications capability in Xcode.

**Core technologies:**
- **CKSyncEngine (iOS 17+ / macOS 14+):** Record-level bidirectional CloudKit sync -- encapsulates zone creation, change tokens, push notifications, retry, and batch operations in ~200 lines of delegate code vs ~2,000 lines of manual CKOperation code
- **CSS `content-visibility: auto`:** Browser-native rendering skip for off-screen CSS Grid cells -- 93% global support, zero JS, Safari 18+ (iOS 17 degrades silently to current behavior)
- **In-memory AuditTracker (TypeScript):** Session-scoped change tracking via `Map<string, ChangeType>` hooked to MutationManager -- NOT SQLite triggers (triggers cannot distinguish user edits from ETL imports)
- **`cards.source` column + SourceColorMap:** Source provenance visualization using existing schema data with a TypeScript constant map for deterministic color assignment

**Critical version note:** CKSyncEngine requires exactly iOS 17+ / macOS 14+, which matches Isometry's deployment targets. CSS `content-visibility: auto` requires Safari 18+ (iOS 18+), so iOS 17 users get no CSS optimization but the JS windowing fallback covers them.

### Expected Features

**Must have (table stakes):**
- Change tracking: new/modified/deleted visual indicators with color-coded cell backgrounds (green/amber/red) across all 9 views
- Change tracking session scope: indicators reset on explicit "Dismiss Changes" action, not on timer or lifecycle
- Source provenance color coding by import origin (Apple Notes, CSV, Markdown, etc.) with legend
- Calculated field visual distinction for SQL-derived aggregate values (SuperGrid only)
- Toggle audit overlay on/off
- CKSyncEngine integration with custom record zone, card CKRecord serialization, change token persistence
- Conflict resolution: field-level last-writer-wins by `modified_at` timestamp (no manual merge UI)
- On-open polling to catch up with edits from other devices
- Incoming record merge into sql.js via bridge
- Row virtualization for SuperGrid with frozen sticky headers and consistent scroll height

**Should have (differentiators):**
- Cross-view audit consistency (change indicators in ALL 9 views, not just SuperGrid)
- Real-time push via CKSubscription (CKSyncEngine manages automatically)
- Sync status indicator (idle/syncing/error)
- Connection sync (separate CKRecord type for connections)
- `content-visibility: auto` as progressive enhancement (zero-code, ships immediately)
- Offline queue with merge (CKSyncEngine handles natively)

**Defer (v5+):**
- Import diff detail panel (field-by-field card diff -- requires snapshot storage, HIGH complexity)
- Temporal audit / time-travel through import history (requires event sourcing)
- UI state sync (Tier 2 is device-local by D-005; syncing creates UX conflicts)
- Column virtualization (SuperGrid rarely exceeds 30-40 columns due to stacking)
- Incremental supergrid:query pagination (changes Worker protocol, only needed if windowing is insufficient)
- Per-field change tracking (cell-level diff highlighting -- OOM risk, complexity exceeds value)
- Multi-user collaborative editing (requires CRDT/OT, out of scope)
- Conflict resolution UI (auto-merge covers 95% of cases)

### Architecture Approach

The architecture separates cleanly along existing layer boundaries. SuperAudit lives entirely in the JS runtime as a new AuditProvider (Tier 3 ephemeral) with three sub-components: AuditTracker (session change map hooked to MutationManager), SourceColorMap (source-to-color mapping), and FieldMetadata (computed field registry). Views consume it via CSS classes in their existing D3 data joins. Virtual scrolling is a CSS-only change to SuperGrid cells (content-visibility) with an optional JS VirtualViewport fallback. CloudKit sync introduces a new SyncManager actor in Swift (CKSyncEngineDelegate) and a SyncAdapter in TypeScript (handles incoming/outgoing records), communicating via subtypes of the existing `native:sync` message -- preserving the 6-message bridge protocol.

**Major components:**
1. **AuditProvider + AuditTracker** -- Session-scoped change tracking (Tier 3), source provenance color mapping, and calculated field detection; consumed by all 9 views via CSS classes
2. **SyncManager (Swift actor)** -- Owns CKSyncEngine lifecycle, maps card/connection JSON to CKRecord fields as a pass-through mapper (no schema interpretation), handles zone creation and conflict events
3. **SyncAdapter (TypeScript)** -- Handles incoming sync records (upsert into sql.js), prepares outgoing records (dirty cards since last sync), resolves conflicts via field-level timestamp comparison
4. **VirtualViewport (optional)** -- Scroll position tracking and visible row range calculation for SuperGrid, only built if CSS content-visibility fails the 16ms render budget at 10K cards

### Critical Pitfalls

1. **Checkpoint-to-CKRecord decomposition breaks the "opaque blob" invariant (CRITICAL).** Swift must gain minimal knowledge of card fields to map them to CKRecords. Use JS-driven sync: JS maintains a change journal, Swift drains it via bridge, maps JSON to CKRecords without interpreting values. This preserves the schema in one place (JS). Accept that sync only occurs while the app is active.

2. **Change tracking via SQLite triggers generates false positives from ETL imports (CRITICAL).** DedupEngine classifies cards as insert/update/skip, and SQLiteWriter uses FTS trigger disable/rebuild during bulk operations. Schema-level triggers cannot distinguish user edits from ETL pipeline writes. Use an in-memory ChangeTracker hooked to MutationManager instead -- ETL imports bypass MutationManager and naturally avoid the tracker.

3. **Virtual scrolling destroys D3 data join assumptions (CRITICAL).** D3 expects to own all DOM elements; SuperGrid's `_renderCells()` does full DOM teardown on every call. Use data windowing (filter the dataset before D3 join), not DOM virtualization. Keep D3 as the sole DOM owner.

4. **iCloud Drive file sync and CloudKit record sync are mutually exclusive conflict models (CRITICAL).** Running both causes the checkpoint overwrite to undo record-level sync changes, creating silent data loss. CloudKit record sync must REPLACE file sync. Move the database file out of the ubiquity container to Application Support. Remove NSFileCoordinator usage. Migrate on first launch.

5. **Bridge message volume explosion during sync (MAJOR).** A batch of 100 incoming CKRecords creates 100 mutation messages competing with user queries on the single Worker thread. Design a dedicated `sync:apply-batch` message that accepts batched mutations, runs at lower priority (yield to user queries), and limits batch size to 50 records.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: SuperAudit Foundation
**Rationale:** Lowest risk, highest user-value density, zero architectural changes. All three SuperAudit capabilities are purely additive JS/CSS work that validates the audit tracking pattern before CloudKit sync complicates it (sync introduces remote-vs-local change distinction). Ships immediate visual intelligence.
**Delivers:** AuditTracker + MutationManager hook, SourceColorMap + CSS provenance styles, AuditProvider with card-level API consumed by all 9 views, FieldMetadata + SuperGrid calculated field distinction, audit toggle toolbar control
**Addresses:** Change tracking (table stakes), source provenance (table stakes), calculated field distinction (table stakes), toggle audit overlay (table stakes)
**Avoids:** Pitfall 2 (change tracking as schema mutation), Pitfall 5 (source provenance NULL handling), Pitfall 6 (calculated field metadata), Pitfall 10 (view-agnostic API), Pitfall 12 (session boundary), Pitfall 18 (density mode conflicts)

### Phase 2: Virtual Scrolling
**Rationale:** CSS content-visibility is a 2-rule change that can ship immediately as a zero-risk progressive enhancement. Benchmark before building the full JS windowing fallback. Independent of both SuperAudit and CloudKit sync. Low risk, potentially high impact.
**Delivers:** CSS `content-visibility: auto` + `contain-intrinsic-size` on SuperGrid data cells; benchmark results at 5K and 10K cards; if content-visibility insufficient: VirtualViewport with scroll-driven D3 data windowing
**Addresses:** Row virtualization (table stakes), consistent scroll height (table stakes), 60fps scroll target (table stakes)
**Avoids:** Pitfall 3 (D3 data join conflict -- data windowing, not DOM virtualization), Pitfall 9 (lasso selection -- coordinate-based hit testing), Pitfall 13 (content-visibility sticky header conflict -- exclude headers from content-visibility), Pitfall 15 (_renderCells full teardown -- refactor to incremental path first)

### Phase 3: CloudKit Sync -- Architecture + Schema Migration
**Rationale:** The architectural decisions (replace vs. supplement file sync, JS-driven vs. Swift-driven sync, bridge protocol extension) must be resolved before any implementation. Schema migration (sync columns on cards/connections) is a prerequisite for all sync code. This phase produces no user-visible features but is the foundation for Phases 4-5.
**Delivers:** Architectural decision record updating D-010; schema migration (sync_version, sync_status, sync_change_tag columns); SyncAdapter skeleton in JS; bridge protocol extension (sync:* subtypes on existing native:sync message); migration path from iCloud Documents to CKSyncEngine (move db to Application Support, seed CloudKit, delete ubiquity container copy)
**Addresses:** CloudKit architecture (table stakes), schema changes for sync (prerequisite)
**Avoids:** Pitfall 1 (checkpoint-to-CKRecord decomposition), Pitfall 4 (dual sync conflict model), Pitfall 7 (record zone setup)

### Phase 4: CloudKit Sync -- Card Sync + Conflict Resolution
**Rationale:** With architecture and schema in place, implement the core sync flow: CKSyncEngine initialization, card CKRecord serialization, outgoing change push, incoming change pull, and last-writer-wins conflict resolution. This is the highest-complexity phase and the most likely to surface unexpected issues.
**Delivers:** SyncManager actor (CKSyncEngineDelegate) in Swift; CardRecordMapper (JSON to CKRecord pass-through); custom record zone creation with state machine (uninitialized -> creating_zone -> zone_ready -> syncing -> idle); outgoing sync (MutationManager marks pending, JS drains change journal to Swift); incoming sync (Swift forwards CKRecords as JSON to JS via bridge, SyncAdapter upserts); conflict resolution (field-level last-writer-wins by modified_at); CKSyncEngine state persistence; Xcode capabilities (CloudKit, Push Notifications, Background Modes)
**Addresses:** CKSyncEngine integration (table stakes), card CKRecord serialization (table stakes), conflict resolution (table stakes), on-open polling (table stakes), real-time push (differentiator)
**Avoids:** Pitfall 8 (bridge message volume -- batched sync messages with 50-record limit), Pitfall 11 (CKRecord 1MB limit -- content size check), Pitfall 14 (quota exhaustion -- progressive batched upload with progress), Pitfall 17 (FTS trigger overhead during sync -- reuse trigger disable pattern), Pitfall 19 (Worker thread contention -- interleaved batches with user query priority)

### Phase 5: CloudKit Sync -- Polish + Connection Sync
**Rationale:** After card sync is stable, add connection sync (second CKRecord type), sync status UI indicator, and handle edge cases (soft-delete sync, account changes, initial sync progress). This phase validates multi-device scenarios end-to-end.
**Delivers:** ConnectionRecordMapper; connection CKRecord sync in same custom zone; SyncStatusProvider (idle/syncing/error) with SwiftUI overlay; soft-delete sync; initial sync progress UI ("Syncing 400/5000 cards..."); multi-device testing validation
**Addresses:** Connection sync (differentiator), sync status indicator (differentiator), offline queue (differentiator)
**Avoids:** Pitfall 16 (conflict resolution UI -- auto-merge only, no manual UI in v4.1), Pitfall 20 (base64 checkpoint overhead -- monitor but don't optimize in v4.1)

### Phase Ordering Rationale

- **SuperAudit first:** Purely additive, no architectural changes, immediate user value. Validates the audit tracking pattern (local-only) before CloudKit sync adds remote change tracking complexity. All research sources agree this is lowest risk.
- **Virtual scrolling second:** CSS content-visibility is a zero-risk CSS-only change that can ship alongside or immediately after SuperAudit. The full JS windowing fallback (if needed) is independent of sync.
- **CloudKit sync last (3 phases):** The most architecturally disruptive feature. It overrides D-010 (a locked decision), requires schema migration, new Swift components, bridge protocol extension, Xcode capability additions, and multi-device testing. It can be descoped entirely if timeline is tight -- existing iCloud Documents sync continues working. Breaking it into architecture/implementation/polish phases contains risk at each stage.
- **Architecture before implementation:** The dual-sync pitfall (Pitfall 4) is the single highest-severity risk in the entire v4.1 scope. The file-to-record migration strategy must be decided and tested before any CKSyncEngine code is written.
- **Card sync before connection sync:** Connections reference cards by ID. Card sync must be reliable before connection sync can work correctly (CKRecord.Reference requires the referenced record to exist).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (CloudKit Architecture):** The D-010 override is a first-order architectural decision affecting the native shell's fundamental responsibilities. Needs `/gsd:research-phase` to validate the migration strategy from iCloud Documents to CKSyncEngine, particularly the checkpoint coexistence model and the session ID lifecycle for SuperAudit.
- **Phase 4 (CloudKit Card Sync):** CKSyncEngine's delegate-based error handling for zone creation failures, throttling, and conflict resolution requires careful state machine design. The WKWebView bridge latency for sync payloads needs benchmarking. Connection CKRecord schema design (UNIQUE constraint preservation across devices) needs validation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (SuperAudit):** In-memory change tracking, CSS class application via D3 data join, source-to-color constant maps -- all well-documented patterns with no novel technical risk.
- **Phase 2 (Virtual Scrolling):** CSS `content-visibility: auto` is a 2-rule addition. If the JS windowing fallback is needed, D3 data windowing with scroll-position math is a ~50 LOC pattern well-documented in the D3 ecosystem.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies for SuperAudit and virtual scrolling. CKSyncEngine is a system framework on the exact platform versions Isometry targets. No version compatibility concerns. |
| Features | MEDIUM | SuperAudit and virtual scrolling features are well-understood from data grid ecosystem patterns. CloudKit sync feature scope is clear but the interaction with the existing bridge architecture (sql.js in WKWebView) has no published precedents. |
| Architecture | MEDIUM-HIGH | SuperAudit and virtual scrolling architectures are straightforward additive changes. CloudKit sync architecture is novel (CKSyncEngine bridged to sql.js via WKWebView) -- the hybrid checkpoint + CKSyncEngine model and the JS-driven sync approach are sound recommendations but unproven in this specific stack. |
| Pitfalls | MEDIUM-HIGH | 20 pitfalls identified across all severity levels. Critical pitfalls (dual sync conflict, trigger false positives, D3 join conflict, checkpoint-CKRecord decomposition) are well-evidenced with clear mitigations. CloudKit-specific pitfalls (quota exhaustion, zone setup silent failure) are from Apple documentation and experienced CloudKit developers. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **CKSyncEngine + WKWebView bridge latency:** The JS-to-Swift-to-CloudKit-to-Swift-to-JS round trip for sync has multiple bridge crossings. Need to benchmark bridge message overhead for diff payloads during Phase 3 architecture work.
- **content-visibility on iOS 17 WKWebView:** iOS 17 ships Safari 17.x which does NOT support `content-visibility: auto`. The CSS optimization only helps iOS 18+ users. JS windowing must be the primary performance mechanism, with CSS as bonus. Verify silent degradation in iOS 17 WKWebView during Phase 2.
- **CKRecord field mapping for connections:** Research focused on cards. The `UNIQUE(source_id, target_id, via_card_id, label)` constraint on connections must be preserved across devices. Design connection CKRecord schema during Phase 5.
- **Checkpoint sync coexistence during migration:** During the transition from file sync to record sync, the ubiquity container checkpoint must be cleanly migrated. Define the migration strategy (read existing, seed CloudKit, delete copy) during Phase 3.
- **Session ID lifecycle for SuperAudit:** The `card_changes` table (if used for audit persistence beyond Tier 3) needs a session ID that resets on app launch AND WKWebView reload. Define the injection mechanism during Phase 1.
- **_renderCells() full DOM teardown:** SuperGrid's current full teardown on every render is incompatible with virtual scrolling. If Phase 2 needs the JS windowing fallback, _renderCells() must be refactored into full-render and incremental-render paths first.

## Sources

### Primary (HIGH confidence)
- [CKSyncEngine Apple Documentation](https://developer.apple.com/documentation/cloudkit/cksyncengine-5sie5) -- API reference, iOS 17+ availability
- [WWDC23: Sync to iCloud with CKSyncEngine](https://developer.apple.com/videos/play/wwdc2023/10188/) -- Complete tutorial, delegate protocol, event handling, testing
- [Apple sample-cloudkit-sync-engine](https://github.com/apple/sample-cloudkit-sync-engine) -- Official reference implementation
- [CSS content-visibility browser support (caniuse)](https://caniuse.com/css-content-visibility) -- Safari 18+, Chrome 85+, Firefox 125+, 93% global support
- [Simon Willison: sqlite-chronicle](https://github.com/simonw/sqlite-chronicle) -- Trigger-based change tracking pattern
- [CloudKit Data Size Limits](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/PropertyMetrics.html) -- CKRecord 1MB limit

### Secondary (MEDIUM confidence)
- [CKSyncEngine Q&A by Christian Selig (2026)](https://christianselig.com/2026/01/cksyncengine/) -- Practical CKSyncEngine advice (enums, deletions, state persistence)
- [Superwall CKSyncEngine tutorial](https://superwall.com/blog/syncing-data-with-cloudkit-in-your-ios-app-using-cksyncengine-and-swift-and-swiftui/) -- Step-by-step setup
- [content-visibility performance blog](https://cekrem.github.io/posts/content-visibility-auto-performance/) -- Real-world measurements
- [Google data grid 10x faster with CSS](https://medium.com/@johan.isaksson/how-i-made-googles-data-grid-scroll-10x-faster-with-one-line-of-css-78cb1e8d9cb1) -- content-visibility in grids
- [React Datasheet Grid: Tracking Row Changes](https://react-datasheet-grid.netlify.app/docs/examples/tracking-rows-changes/) -- CSS class patterns for change indicators
- [Ryan Ashcraft: CloudKit sync library lessons](https://ryanashcraft.com/what-i-learned-writing-my-own-cloudkit-sync-library/) -- Practical sync experience

### Tertiary (LOW confidence)
- CloudKit quota/throttling behavior under checkpoint-to-record decomposition -- no published precedents for this exact approach
- D3 virtual scrolling patterns -- principles unchanged since 2014 but sparse modern documentation

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
