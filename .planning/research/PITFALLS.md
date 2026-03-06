# Domain Pitfalls

**Domain:** Adding change tracking (SuperAudit), CloudKit bidirectional sync, and virtual scrolling to an existing TypeScript/D3.js + SwiftUI/WKWebView local-first app with sql.js checkpoint architecture
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH for change tracking and virtual scrolling pitfalls (derived from Isometry codebase analysis, D3.js patterns, CSS Grid behavior, and community experience). MEDIUM for CloudKit sync pitfalls (CKSyncEngine is well-documented by Apple and early adopters, but the sql.js-in-WKWebView bridge architecture is unique and has no direct precedents). LOW for specific CloudKit quota/throttling behavior under the checkpoint-to-record decomposition pattern (no one has published this exact approach).

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or architectural dead ends.

### Pitfall 1: Checkpoint-to-CKRecord Decomposition Breaks the "Opaque Blob" Invariant

**Severity:** CRITICAL -- architectural

**What goes wrong:**
The existing architecture (D-010, D-011) treats the sql.js database as an opaque binary blob. Swift never queries or interprets it. CloudKit record-level sync (`CKSyncEngine`) requires individual `CKRecord` objects for each card and connection. This creates a fundamental tension: something must decompose the blob into records and recompose records back into a blob. If Swift does this, it violates D-011 ("Swift does not query, parse, or understand the database"). If JavaScript does this, every sync event requires a round-trip through the WKWebView bridge, which is asynchronous and can fail silently if the web view has been terminated by iOS memory pressure.

**Why it happens:**
The v2.0 architecture was deliberately designed for file-level iCloud Drive sync (whole-checkpoint sync via ubiquity container). Moving to record-level CloudKit sync is a different technology with fundamentally different data requirements. Developers underestimate the gap because both are "iCloud" -- but iCloud Documents (file sync) and CloudKit (record-level CKDatabase) are entirely separate systems with separate APIs, separate quotas, and separate conflict models.

**Consequences:**
- If not addressed: either Swift gains schema awareness (violating D-011 and creating a parallel data model) or every sync operation requires JS to be alive and responsive (fragile)
- Bridge failures during sync can cause partial uploads (some records synced, others not) with no automatic recovery
- iOS can terminate the WKWebView process at any time (memory pressure, background transitions), orphaning in-flight sync operations

**Prevention:**
The sync bridge must be designed as a dedicated, well-defined contract. Two viable approaches:

1. **JS-driven sync with explicit lifecycle management:** JS maintains a change journal (insert/update/delete log with card IDs and payloads). Swift calls into JS to drain the journal, receives structured JSON arrays of changed records, and maps them to CKRecords. JS must be alive for sync -- so sync only occurs while the app is active. Accept that background sync is limited to "sync on next launch" for changes made right before backgrounding.

2. **Swift learns minimal schema (controlled D-011 relaxation):** Swift gains just enough knowledge to deserialize the checkpoint SQLite file, read the `cards` and `connections` tables, and produce CKRecords. This is a one-way read -- Swift never writes SQL. The checkpoint remains the source of truth. This approach enables background sync but requires maintaining Swift models in lockstep with the JS schema.

**Recommendation:** Approach 1 (JS-driven sync) is safer for this codebase. It preserves D-011, keeps the schema in one place (JS), and aligns with the existing bridge pattern. The 30-second autosave window (max data loss on quit) is already an accepted tradeoff -- sync latency of "next active session" is comparable.

**Phase:** Must be resolved in the CloudKit sync architecture phase before any implementation begins.

---

### Pitfall 2: Change Tracking as Schema Mutation Breaks Existing DedupEngine and Import Pipeline

**Severity:** CRITICAL -- data integrity

**What goes wrong:**
Adding `change_status` (new/modified/deleted) columns to the `cards` table, or adding a `changes` tracking table with triggers, seems like the obvious approach. But this interacts badly with the existing ETL pipeline:

1. **DedupEngine classifies cards as insert/update/skip** based on `source_id` + `modified_at` comparison. A re-import of the same Apple Notes file would mark all cards as "unchanged" (skip). But if a `change_status` column exists and defaults to 'new' on INSERT, re-imported cards that the DedupEngine classifies as "update" get marked as "modified" even though the user didn't change them -- the ETL pipeline did.

2. **SQLiteWriter uses 100-card batched transactions with FTS trigger disable/rebuild.** Adding change-tracking triggers on the `cards` table means those triggers fire during ETL import batches, generating thousands of false "change" events.

3. **Native ETL adapters** (Reminders, Calendar, Notes) bypass ImportOrchestrator and feed DedupEngine directly. If change tracking is schema-level (triggers), native imports generate the same false positives.

**Why it happens:**
Change tracking is conflated with data mutation tracking. The system has two distinct mutation sources -- user edits (should be tracked) and ETL imports (should not be tracked). Schema-level triggers cannot distinguish between them.

**Consequences:**
- Every import floods the change log with false "new" and "modified" entries
- Users see all imported cards marked as "new" indefinitely
- Change tracking becomes meaningless noise
- If triggers are disabled during import (like FTS triggers), the tracking misses legitimate changes made during import

**Prevention:**
Change tracking must be session-level, not schema-level. Use an in-memory change journal in the Worker, not SQLite triggers:

- `MutationManager` already intercepts all user-initiated writes (insert/update/delete) with command-pattern undo/redo
- Add a `ChangeTracker` that listens to MutationManager events and maintains an in-memory `Map<cardId, ChangeStatus>`
- ETL imports go through `SQLiteWriter`, not `MutationManager`, so they naturally bypass the change tracker
- Session-only persistence (Tier 3) aligns with the existing persistence tier model (D-005)
- On session start, all cards are "unchanged" -- the tracker only records mutations made during the current session

**Phase:** Must be addressed in the SuperAudit design phase. The change tracking mechanism choice gates everything downstream (visual rendering, source provenance, calculated field distinction).

---

### Pitfall 3: Virtual Scrolling Destroys D3 Data Join Assumptions Across All Views

**Severity:** CRITICAL -- architectural

**What goes wrong:**
SuperGrid's `_renderCells()` method uses D3's `.selectAll().data(items, keyFn).join()` pattern to manage DOM elements. Virtual scrolling fundamentally conflicts with this because:

1. **D3 expects to own all DOM elements for the data set.** Virtual scrolling removes elements from the DOM when they scroll out of view. D3's exit selection sees these removed elements and interprets them as data removal, potentially triggering exit transitions and cleanup.

2. **SuperGrid rebuilds the entire grid on each `_renderCells()` call** (line 1298: `while (grid.firstChild) grid.removeChild(grid.firstChild)`). This is a full DOM teardown + rebuild, not an incremental update. Virtual scrolling requires the opposite: keep the container structure stable and swap cell contents as the viewport moves.

3. **Sticky headers (position: sticky with z-index layering)** depend on being in the same scroll container as the data cells. Virtual scrolling typically uses a sentinel element to create a virtual scrollable area, which breaks the CSS stacking context that sticky positioning relies on.

4. **SuperZoom uses CSS Custom Properties** for zoom, which affects the container's scroll dimensions. Virtual scrolling calculations (visible viewport, item offsets) must account for zoom level, creating a coupling between two independent systems.

**Why it happens:**
SuperGrid was designed for moderate data sets (the spec explicitly notes "max ~2,500 cells" at group intersections). Virtual scrolling is being added for 10K+ card scale, which is a different rendering paradigm. The assumption that D3 manages all DOM lifecycle conflicts with the assumption that a virtualizer manages DOM lifecycle.

**Consequences:**
- Naive virtual scrolling implementation breaks D3 key functions, causing selection state loss
- Sticky headers float incorrectly or disappear during virtual scroll
- Lasso selection (SuperGridBBoxCache) breaks because bounding box cache assumes all cells are in the DOM
- Sort, filter, and density controls stop working because they rely on `_renderCells()` full rebuild
- Performance may actually worsen due to fighting between D3 and virtualizer for DOM control

**Prevention:**
Virtual scrolling for SuperGrid must be implemented as a **data windowing** approach, not a DOM virtualizing approach:

1. **Window the data, not the DOM.** Instead of rendering all cells and virtualizing which DOM nodes exist, query only the visible window of cells from the Worker. The existing `supergrid:query` handler already returns aggregated `CellDatum[]` -- add LIMIT/OFFSET or viewport-aware filtering to this query.

2. **Keep D3 as the sole DOM owner.** D3 continues to own all rendered cells via data join. The data set it receives is just smaller (only the visible window).

3. **Sentinel elements for scroll area.** Use a CSS Grid spacer row/column to maintain the correct total scroll area without rendering off-screen cells. This preserves sticky header behavior.

4. **Debounce scroll → re-query.** On scroll, debounce (100-200ms) and re-query the Worker for the new visible window. This matches the existing `_fetchAndRender()` pattern.

**Phase:** Virtual scrolling phase. Must be designed after understanding which views need it (SuperGrid only, per current requirements).

---

### Pitfall 4: iCloud Drive File Sync vs. CloudKit Record Sync Are Mutually Exclusive Conflict Models

**Severity:** CRITICAL -- data loss risk

**What goes wrong:**
The current system uses iCloud Drive file sync (ubiquity container) for cross-device sync. Adding CloudKit record-level sync creates a dual-sync scenario where the same data flows through two different sync channels:

1. **iCloud Drive** syncs the `isometry.db` checkpoint file as a binary blob. Conflict resolution is last-writer-wins at the file level.
2. **CloudKit** (CKSyncEngine) syncs individual CKRecords with per-record change tokens and server-side conflict detection.

If both are active, a card modified on Device A syncs via CloudKit records AND via the iCloud Drive checkpoint file. Device B receives both: the CKRecord change (which it applies to its local database) and the new checkpoint file (which overwrites its entire database). The checkpoint overwrite destroys the CKRecord change that was just applied.

**Why it happens:**
The existing iCloud Drive sync (D-010) is simple and works. Developers add CloudKit on top rather than replacing it, thinking "belt and suspenders." But two sync systems with different conflict models fighting over the same data store is a recipe for data loss.

**Consequences:**
- Checkpoint overwrites undo record-level sync changes
- Devices oscillate between states as file sync and record sync compete
- Data loss is silent -- no conflict UI, no error, just missing changes
- Impossible to debug because the problem is timing-dependent

**Prevention:**
CloudKit record-level sync must **replace** iCloud Drive file sync, not supplement it. This means:

1. **Move the database file out of the ubiquity container** to Application Support (local only)
2. **Remove `NSFileCoordinator` usage** from `DatabaseManager` (no longer needed)
3. **Remove `autoMigrateIfNeeded()`** (no more iCloud container migration)
4. **CloudKit becomes the sole cross-device sync mechanism**

The migration path: on first launch with CloudKit enabled, read the existing ubiquity container checkpoint, apply it as the initial local database, then delete the ubiquity container copy to prevent iCloud Drive from continuing to sync it.

**Phase:** CloudKit architecture phase. Must be decided before implementation begins. The migration from file sync to record sync is a one-way door.

---

## Major Pitfalls

Mistakes that cause significant rework or degraded UX, but are recoverable.

### Pitfall 5: Source Provenance Visualization Assumes `source` Column is Always Populated

**Severity:** MAJOR

**What goes wrong:**
Source provenance color coding ("cards from Apple Notes are blue, from CSV are green") relies on the `cards.source` column. But:

1. **Cards created manually** (via future in-app creation or MutationManager) have `source = NULL`
2. **Cards created before ETL** (early development, seed data) have no source metadata
3. **The `source` column contains the source_type string** (e.g., 'apple_notes', 'markdown', 'csv'), which is a technical identifier, not a user-friendly label
4. **Cards imported from the same file type but different files** share the same `source` value -- you can't distinguish "Notes Export 1" from "Notes Export 2"

**Why it happens:**
The `source` column was designed for DedupEngine deduplication, not for user-facing provenance visualization. It uniquely identifies a card's origin for re-import idempotency, not for visual categorization.

**Consequences:**
- NULL source cards get no color coding (confusing UX)
- Multiple imports from same source type are visually indistinguishable
- Source labels in the UI show internal identifiers ('apple_notes') instead of friendly names ('Apple Notes')

**Prevention:**
Use `import_sources` table (already exists with `name`, `source_type`, `created_at`) for provenance visualization, not the raw `source` column on cards. Join through `import_runs` to get the specific import instance. For cards with NULL source, display a "Manual" or "Unknown" category with its own color.

Map source_type values to display names and colors in a TypeScript constant map, not dynamically from the database. This keeps the color palette stable and deterministic.

**Phase:** SuperAudit design phase. Must define the provenance data model before building visualization.

---

### Pitfall 6: Calculated Field Distinction Requires Metadata That Doesn't Exist Yet

**Severity:** MAJOR

**What goes wrong:**
"Calculated field visual distinction" means visually marking values that come from SQL aggregation (COUNT, SUM, etc.) versus values that come directly from card data. SuperGrid already has calculated values -- the `count` field in `CellDatum` is a SQL `COUNT(*)` aggregate, and aggregation cards show aggregate counts. But there is no metadata on the datum itself that says "this value was calculated."

The SuperGrid `_renderCells()` method receives `CellDatum[]` from the Worker, where each datum has `count`, `card_ids`, and axis field values. The Worker handler runs a SQL query with `GROUP BY` and `COUNT(*)`. By the time the data reaches the view, the distinction between "raw value" and "calculated value" is lost.

**Why it happens:**
The Worker-to-view pipeline was designed for rendering, not for audit metadata. Adding audit metadata means either:
- Expanding the `CellDatum` interface with provenance fields (bloats the bridge message for all queries, even when audit mode is off)
- Running a separate audit query (doubles Worker load)

**Consequences:**
- Without metadata, the view cannot distinguish calculated from raw values
- Adding metadata to CellDatum affects all existing tests (774+ provider/view tests)
- Audit mode becomes a global concern that touches the Worker protocol, bridge messages, and all view render paths

**Prevention:**
Make audit metadata opt-in via a flag in the query request. When `auditMode: true` is set in the `supergrid:query` message, the Worker includes additional metadata in the response (e.g., `isCalculated: boolean` per field). When `auditMode: false` (default), the response is unchanged -- zero impact on existing code paths.

For non-SuperGrid views (list, grid, kanban, etc.), the audit distinction is simpler: these views render individual cards, not aggregates. The "calculated" concept only applies to SuperGrid aggregation cells. Other views only need change tracking (new/modified/deleted) and source provenance, which come from the ChangeTracker and `source` column respectively.

**Phase:** SuperAudit implementation phase, after the change tracking mechanism is decided.

---

### Pitfall 7: CKSyncEngine Requires Record Zone Setup Before First Sync -- Silent Failure Mode

**Severity:** MAJOR

**What goes wrong:**
CKSyncEngine requires that custom record zones are created in CloudKit before any records can be saved to them. If you call `CKSyncEngine.state.add(pendingRecordZoneChanges:)` before the zone exists, the sync engine returns a zone-not-found error. This error is delivered asynchronously via the delegate, not thrown synchronously. If the delegate error handler is not robust, the app silently fails to sync without any user-visible indication.

**Why it happens:**
CKSyncEngine's delegate pattern means errors arrive via callbacks, not exceptions. Developers test with a pre-existing zone (created during development) and never encounter the first-launch zone creation flow. The zone creation itself is also async and can fail (network offline, iCloud not signed in, quota exceeded).

**Consequences:**
- First-time users experience silent sync failure
- The app appears to work locally but nothing syncs to the cloud
- Users don't discover the problem until they try a second device
- Recovery requires detecting the missing zone and re-attempting creation

**Prevention:**
Zone creation must be the first operation in the sync lifecycle, with explicit success confirmation before queuing any record changes. Implement a sync state machine:

```
uninitialized → creating_zone → zone_ready → syncing → idle
                    ↓                                    ↓
               zone_error → retry (with backoff)    sync_error
```

Gate all record operations on `zone_ready` state. Surface zone creation errors to the user ("iCloud sync requires an iCloud account. Sign in to Settings > iCloud to enable sync.").

**Phase:** CloudKit sync implementation phase.

---

### Pitfall 8: Bridge Message Volume Explosion During Sync

**Severity:** MAJOR

**What goes wrong:**
The current bridge protocol has 6 message types, deliberately minimal. CloudKit sync introduces a new flow: Swift receives remote changes from CKSyncEngine, needs to apply them to the JS database, and then JS needs to acknowledge the changes. For a sync batch of 100 cards:

1. Swift receives 100 CKRecords from CloudKit
2. Swift sends 100 individual mutation messages to JS (or one batched message)
3. JS applies 100 mutations to sql.js
4. JS posts a `mutated` message back to Swift
5. Swift requests a checkpoint
6. JS exports the database and posts checkpoint bytes

If this happens while the user is actively editing, the mutation messages compete with user-initiated queries on the single Worker thread. The Worker is single-threaded (web workers are, by design), so sync mutations block user queries.

**Why it happens:**
The bridge was designed for user-initiated mutations (one at a time, infrequent) and checkpoint writes (every 30 seconds). Bulk sync operations are a new pattern that the bridge isn't optimized for.

**Consequences:**
- UI jank during sync (Worker blocked by batch mutations)
- User-initiated queries time out (WorkerBridge has correlation-ID-based timeouts)
- Race conditions between user edits and sync mutations on the same card
- Memory spikes from large sync batches in the bridge message queue

**Prevention:**
Design a dedicated sync message type (`sync:apply-batch`) that:
- Accepts a batch of mutations in a single message (not individual messages)
- Runs in a lower-priority queue (yield to user queries between batches)
- Uses a separate correlation ID namespace to avoid timeout conflicts
- Limits batch size to 50 records to bound Worker blocking time
- Returns a batch acknowledgment, not individual mutation confirmations

This is an extension of the existing `native:sync` message type (type #6 in the bridge protocol) rather than adding new message types.

**Phase:** CloudKit sync bridge design phase.

---

### Pitfall 9: Virtual Scrolling Breaks Lasso Selection and BBox Cache

**Severity:** MAJOR

**What goes wrong:**
SuperGridSelect implements lasso selection using a bounding box cache (`SuperGridBBoxCache`). On mount, it calls `getBoundingClientRect()` for every cell in the grid and caches the results. During mouse drag, it performs hit testing against the cached rects to determine which cells are selected.

Virtual scrolling means only a subset of cells exist in the DOM at any time. The bounding box cache:
1. Only contains rects for currently-rendered cells (the visible window)
2. Is invalidated every time the virtual scroll window changes
3. Cannot represent cells that haven't been rendered yet (no DOM element = no bounding rect)

**Why it happens:**
The bounding box cache was designed for grids where all cells exist in the DOM simultaneously. The spec explicitly notes that "max ~2,500 cells" is the expected scale, making full-DOM caching reasonable. Virtual scrolling changes this assumption.

**Consequences:**
- Lasso selection only selects visible cells, silently excluding off-screen cells
- Users expect lasso to select all cells in the dragged region, including scrolled-out ones
- BBox cache rebuild on every scroll event causes layout thrash (contradicting the cache's purpose)

**Prevention:**
For virtual scrolling, replace pixel-based hit testing with coordinate-based hit testing:

1. Each cell has a logical grid position (row index, column index) derived from its axis values
2. Lasso selection converts the drag rectangle from pixel coordinates to grid coordinates using the known row height and column widths
3. Hit testing checks grid coordinates against the full data set (not just rendered cells), using the `_lastCells` array
4. This eliminates the need for DOM bounding rects entirely

The existing `SuperGridSelect.classifyClickZone()` already uses data attributes (`data-col`, `data-row`) for zone classification. Extend this to lasso selection.

**Phase:** Virtual scrolling phase, after basic windowing works.

---

### Pitfall 10: Change Tracking Across 9 Views Requires View-Agnostic Change Indicator API

**Severity:** MAJOR

**What goes wrong:**
Building change tracking for SuperGrid first, then trying to retrofit it to the other 8 views, leads to SuperGrid-specific assumptions baked into the API. Each view renders cards differently:

| View | Render approach | Card representation |
|------|----------------|-------------------|
| SuperGrid | CSS Grid cells, D3 data join, CellDatum (aggregated) | Group intersection with count |
| ListView | SVG `<g>` elements, D3 data join | Individual card row |
| GridView | SVG `<g>` elements, D3 data join | Card tile |
| KanbanView | HTML divs, D3 data join | Card in column |
| CalendarView | SVG, D3 data join | Card in day cell |
| TimelineView | SVG, D3 data join | Card on timeline |
| GalleryView | Pure HTML (no D3) | HTML tile |
| NetworkView | SVG + force simulation | Node in graph |
| TreeView | SVG + hierarchy layout | Node in tree |

SuperGrid renders aggregated `CellDatum` (not individual cards), so change tracking there means "this group contains N new cards." Other views render individual `CardDatum` objects, so change tracking means "this card is new/modified/deleted."

**Why it happens:**
SuperGrid is the most complex view and the natural first target. But its aggregated data model is unique among the 9 views. Building the change API around CellDatum's aggregate model makes it incompatible with the per-card model used by all other views.

**Consequences:**
- SuperGrid-first change API requires adaptation layers for every other view
- GalleryView (pure HTML, no D3) needs a completely different integration path
- NetworkView and TreeView (force/hierarchy layouts) have additional complexity because node positions are computed, not data-driven

**Prevention:**
Design the ChangeTracker API at the card level, not the view level:

```typescript
interface ChangeTracker {
  getStatus(cardId: string): 'new' | 'modified' | 'deleted' | 'unchanged';
  getChangedCardIds(): Set<string>;
  getNewCount(): number;
  getModifiedCount(): number;
}
```

Each view consumes this API differently:
- SuperGrid: "Of the card_ids in this CellDatum, how many are new/modified?" (aggregate)
- ListView/GridView/etc.: "Is this card new/modified?" (per-card)
- GalleryView: Same per-card check, applied during HTML tile construction

The ChangeTracker is a standalone service, not a provider. It does not trigger re-renders -- views query it during their existing render cycle.

**Phase:** SuperAudit design phase, before any view-specific implementation.

---

## Moderate Pitfalls

### Pitfall 11: CKRecord Size Limit (1MB) vs. Card Content Size

**What goes wrong:**
`CKRecord` has a 1MB size limit per record. The `cards.content` field can contain full note bodies, HTML content, or long markdown documents. If a single card's content exceeds 1MB (after CKRecord overhead for other fields), the sync operation fails for that record. CKSyncEngine reports the error asynchronously and may retry indefinitely, blocking other records in the same batch.

**Prevention:**
- Enforce a content size check before creating CKRecords
- For oversized content, use `CKAsset` (file-based attachment) instead of inline string field
- Surface "card too large to sync" warnings to the user
- Realistically, most cards will be well under 1MB -- but Apple Notes imports can include large HTML bodies

**Phase:** CloudKit sync implementation.

---

### Pitfall 12: Change Tracking Session Boundary Ambiguity

**What goes wrong:**
If change tracking is session-only (Tier 3), when does a "session" end? On app backgrounding? On explicit "clear changes" action? On next import? If the session boundary is unclear, users see stale change indicators forever (if never cleared) or lose them unexpectedly (if cleared too aggressively).

**Prevention:**
Define explicit session boundaries:
- Session starts: on app launch (all cards are "unchanged")
- Session persists through: view switches, filter changes, axis reconfigurations
- Session clears: on explicit "Dismiss changes" action (button in audit toolbar), on app restart
- Import operations do NOT clear the session (user edits before import should remain visible)
- Optional: auto-clear after N minutes of inactivity (configurable)

**Phase:** SuperAudit design phase.

---

### Pitfall 13: CSS `content-visibility: auto` Breaks SuperGrid Header Stickiness

**What goes wrong:**
`content-visibility: auto` is often suggested as a lightweight virtual scrolling alternative. It tells the browser to skip rendering off-screen elements. However, applying it to CSS Grid cells breaks `position: sticky` on headers because `content-visibility: auto` creates a new containment context that interferes with the sticky positioning ancestor chain. Headers that should stick to the top/left edge instead scroll away.

**Prevention:**
Do not apply `content-visibility: auto` to any element that is an ancestor of a sticky-positioned header. It can safely be applied to data cells that are deep in the grid (leaf cells only), but only if they are not in the same containment context as sticky headers. In practice, this means `content-visibility` is only useful for cells in the non-sticky scrollable region, and its benefit is marginal compared to true data windowing.

**Phase:** Virtual scrolling phase, if `content-visibility` is considered as an approach.

---

### Pitfall 14: CloudKit Quota Exhaustion on First Sync of Large Database

**What goes wrong:**
A user with 5,000+ imported cards enables CloudKit sync for the first time. The initial sync uploads all 5,000 cards as individual CKRecords. CloudKit has request rate limits (throttling errors) and per-database size quotas. A burst of 5,000 record saves can trigger throttling, causing partial upload failures with retry-after headers.

CKSyncEngine handles throttling internally (automatic retry with backoff), but the user sees a sync progress indicator stuck at "Syncing... 40%" for minutes. If they force-quit, the next launch may re-attempt records that were already uploaded (if the change token wasn't persisted), creating duplicates.

**Prevention:**
- Implement progressive initial sync: upload in batches of 100 records with explicit progress reporting
- Persist CKSyncEngine state (change tokens) after each successful batch, not just at the end
- Show clear progress UI: "Syncing 400/5000 cards..."
- Handle throttling gracefully: pause progress, show "iCloud is busy, will resume shortly"
- Consider a "sync preview" step for first sync: "This will upload 5,000 cards to iCloud. Continue?"

**Phase:** CloudKit sync implementation phase.

---

### Pitfall 15: `_renderCells()` Full DOM Teardown Prevents Virtual Scroll Optimization

**What goes wrong:**
SuperGrid's `_renderCells()` begins with `while (grid.firstChild) grid.removeChild(grid.firstChild)` -- a complete DOM teardown on every render. Virtual scrolling optimization depends on keeping stable DOM structure and only updating changed cells. The full teardown means every scroll event triggers a complete DOM rebuild, which is exactly what virtual scrolling is supposed to avoid.

**Prevention:**
Refactor `_renderCells()` into two paths:
1. **Full render** (current behavior): Used for axis changes, filter changes, density changes -- anything that changes the grid structure
2. **Incremental render**: Used for scroll events -- updates cell contents within the existing grid structure, using D3's update selection to swap data

The incremental path requires that the grid template (rows/columns) stays stable during scrolling, which it will because scrolling doesn't change the axis configuration. Only the data within cells changes.

This refactor is a prerequisite for virtual scrolling, not part of it. Do it first.

**Phase:** Virtual scrolling preparation phase (before the main virtual scrolling implementation).

---

### Pitfall 16: CloudKit Conflict Resolution Requires User-Facing UI That Doesn't Exist

**What goes wrong:**
CKSyncEngine reports conflicts when a record was modified on both the local device and the server. The delegate receives both versions and must choose one. Most implementations default to "server wins" or "most recent timestamp wins." But Isometry has no conflict resolution UI -- there's no way to show the user "This card was modified on both devices. Which version do you want?"

Worse, the existing `MutationManager` undo stack is session-only. If a conflict is resolved by accepting the server version, the user's local changes are lost with no undo path.

**Prevention:**
Start with a simple, well-defined conflict resolution strategy that doesn't require UI:
- **Merge strategy for non-conflicting fields:** If Device A changed `name` and Device B changed `content`, merge both changes (no conflict)
- **Last-writer-wins for conflicting fields:** If both devices changed `name`, use the most recent `modified_at` timestamp
- **Log all conflicts** for debugging: store conflict events in a `sync_conflicts` table with both versions
- **Future:** Add a conflict resolution UI that surfaces logged conflicts for manual resolution

Do NOT implement "user picks a version" conflict UI in v4.1. It's a large UX surface area that can be deferred. Automatic merge + last-writer-wins covers 95% of real-world cases.

**Phase:** CloudKit sync implementation phase, conflict resolution strategy sub-phase.

---

## Minor Pitfalls

### Pitfall 17: FTS5 Triggers Fire During Sync-Applied Mutations

**What goes wrong:**
When CloudKit sync applies remote changes to the local database (inserting/updating cards), the FTS5 sync triggers fire for every mutation. For a sync batch of 200 cards, this means 200 FTS index updates. The existing FTS trigger optimization (disable triggers during bulk import, rebuild index after) should be applied to sync batches too, but it's easy to forget because sync uses a different code path than ETL import.

**Prevention:**
Reuse the existing FTS trigger disable/rebuild pattern from `SQLiteWriter` for sync batch operations. Extract it into a shared utility function that both SQLiteWriter and the sync handler can call.

**Phase:** CloudKit sync implementation.

---

### Pitfall 18: SuperAudit Visual Indicators Must Not Break Density Modes

**What goes wrong:**
SuperGrid has 4 density levels (Value, Extent, View, Region) that control how cells are rendered. Adding change tracking indicators (colored borders, badges, background tints) to cells can conflict with density mode styling:
- **Spreadsheet mode** (viewMode='matrix'): Cells show count badges. Adding a change indicator badge creates visual clutter.
- **Hide-empty mode**: Empty cells are removed. But a cell with "0 cards, 2 deleted" should arguably still show (it has audit information even though its count is 0).

**Prevention:**
Audit indicators should layer on top of existing density styling, not replace it. Use CSS classes (`audit-new`, `audit-modified`) that add subtle visual cues (left border color, small dot indicator) without disrupting the existing layout. Do not use background color changes -- they conflict with the existing density color scheme.

For hide-empty + audit interaction: audit mode should show cells with deleted cards even if their live count is 0. This is an explicit override of hide-empty behavior when audit mode is active.

**Phase:** SuperAudit visual implementation phase.

---

### Pitfall 19: Worker Thread Contention During Simultaneous Sync + User Query

**What goes wrong:**
The sql.js database runs in a single Web Worker. All queries (user-initiated `supergrid:query`, ETL `etl:import`, and sync-applied mutations) share this single thread. If sync applies a batch of mutations while the user scrolls SuperGrid (triggering `_fetchAndRender()` which calls `supergrid:query`), the queries are serialized on the Worker thread, causing visible lag.

**Prevention:**
Sync mutations should be interleaved with user queries, not block them:
- Process sync records in small batches (10-20 records per microtask)
- Yield to the message queue between batches (`setTimeout(0)` or `queueMicrotask`)
- User-initiated queries get priority (process them immediately, pause sync batch processing)
- Show a subtle "Syncing..." indicator so users understand brief delays

**Phase:** CloudKit sync Worker handler implementation.

---

### Pitfall 20: Base64 Encoding Overhead for Large Checkpoint Files

**What goes wrong:**
The current bridge sends checkpoint data as base64 strings. Base64 encoding adds ~33% overhead. For a database with 10,000 cards, the checkpoint file could be 5-10MB, making the base64-encoded string 7-13MB. This is sent through `WKScriptMessageHandler`, which has memory limits. Large payloads can trigger WKWebView process termination.

With CloudKit sync, checkpoint frequency may increase (sync applies remote changes, then checkpoints to persist). More frequent checkpoints of large databases amplify the problem.

**Prevention:**
- Monitor checkpoint size growth as the database scales
- Consider switching from base64 to `ArrayBuffer` transfer if WebKit supports it in the target iOS version
- Implement checkpoint compression (gzip the SQLite bytes before base64 encoding) -- SQLite databases compress well (60-70% reduction)
- If checkpoint size exceeds 5MB, consider incremental sync as the primary persistence mechanism and reduce checkpoint frequency

**Phase:** CloudKit sync optimization phase (not blocking for initial implementation).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| SuperAudit design | Change tracking mechanism choice (Pitfall 2) | Session-level ChangeTracker, not schema triggers |
| SuperAudit design | View-agnostic API (Pitfall 10) | Card-level API consumed differently by each view |
| SuperAudit design | Session boundary definition (Pitfall 12) | Explicit clear action, not implicit lifecycle |
| SuperAudit implementation | Source provenance data model (Pitfall 5) | Use import_sources table, not raw source column |
| SuperAudit implementation | Calculated field metadata (Pitfall 6) | Opt-in auditMode flag in query request |
| SuperAudit implementation | Density mode conflicts (Pitfall 18) | CSS class layering, not background color |
| CloudKit architecture | Checkpoint-to-CKRecord decomposition (Pitfall 1) | JS-driven sync with change journal |
| CloudKit architecture | File sync vs record sync conflict (Pitfall 4) | Replace file sync, don't supplement |
| CloudKit implementation | Record zone setup (Pitfall 7) | Sync state machine with zone_ready gate |
| CloudKit implementation | Bridge message volume (Pitfall 8) | Dedicated batch sync message type |
| CloudKit implementation | Conflict resolution (Pitfall 16) | Auto-merge + last-writer-wins, no UI in v4.1 |
| CloudKit implementation | Quota exhaustion (Pitfall 14) | Progressive batched upload with progress UI |
| CloudKit implementation | FTS trigger overhead (Pitfall 17) | Reuse SQLiteWriter trigger disable pattern |
| CloudKit implementation | Worker thread contention (Pitfall 19) | Small batch interleaving with user query priority |
| Virtual scrolling | D3 data join conflict (Pitfall 3) | Data windowing, not DOM virtualization |
| Virtual scrolling | Lasso selection breaks (Pitfall 9) | Coordinate-based hit testing, not pixel-based |
| Virtual scrolling | content-visibility sticky header conflict (Pitfall 13) | Avoid on sticky ancestors |
| Virtual scrolling | _renderCells full teardown (Pitfall 15) | Refactor to full + incremental render paths |

---

## Sources

### CloudKit / CKSyncEngine
- [Apple CKSyncEngine Documentation](https://developer.apple.com/documentation/cloudkit/cksyncengine-5sie5) -- official API reference
- [Superwall: Syncing with CKSyncEngine](https://superwall.com/blog/syncing-data-with-cloudkit-in-your-ios-app-using-cksyncengine-and-swift-and-swiftui/) -- practical implementation guide with gotchas
- [Christian Selig: CKSyncEngine Q&A](https://christianselig.com/2026/01/cksyncengine/) -- developer experience, batch size limits, zone questions
- [Ryan Ashcraft: What I Learned Writing My Own CloudKit Sync Library](https://ryanashcraft.com/what-i-learned-writing-my-own-cloudkit-sync-library/) -- operational pitfalls
- [Fat Bob Man: CloudKit Data Model Rules](https://fatbobman.com/en/snippet/rules-for-adapting-data-models-to-cloudkit/) -- schema constraints
- [Apple TN2336: Handling iCloud Version Conflicts](https://developer.apple.com/library/archive/technotes/tn2336/_index.html) -- file sync conflict model
- [GRDB CloudKit Discussion](https://github.com/groue/GRDB.swift/discussions/1569) -- foreign key challenges with CloudKit record ordering
- [Apple Sample CloudKit Sync Engine](https://github.com/apple/sample-cloudkit-sync-engine) -- reference implementation

### sql.js / Checkpoint Architecture
- [sql.js: Persisting a Modified Database](https://github.com/sql-js/sql.js/wiki/Persisting-a-Modified-Database) -- export patterns
- [sql.js Issue #367: Incremental Persistence](https://github.com/sql-js/sql.js/issues/367) -- no incremental export support
- [PowerSync: SQLite Persistence on the Web (2025)](https://www.powersync.com/blog/sqlite-persistence-on-the-web) -- WASM persistence landscape

### Virtual Scrolling / CSS Grid
- [Johan Isaksson: 10x Faster Grid Scroll with CSS](https://medium.com/@johan.isaksson/how-i-made-googles-data-grid-scroll-10x-faster-with-one-line-of-css-78cb1e8d9cb1) -- content-visibility technique
- [AG Grid: Scrolling Performance](https://www.ag-grid.com/javascript-data-grid/scrolling-performance/) -- professional grid virtual scrolling
- [Savvy: CSS Grid Performance Tips and Pitfalls](https://savvy.co.il/en/blog/wordpress-speed/css-grid-web-performance/) -- CSS Grid perf considerations
- [Gearheart: Smooth Virtual Scroll with Fixed Rows/Columns](https://gearheart.io/blog/smooth-react-virtual-scroll-with-fixed-rows-columns/) -- sticky + virtual scroll conflict
- [MDN: content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility) -- containment and stickiness interaction

### Change Tracking / Audit Trails
- [Simon Willison: Track Timestamped Changes to SQLite Table](https://til.simonwillison.net/sqlite/track-timestamped-changes-to-a-table) -- trigger-based change tracking
- [Simon Willison: JSON Audit Log in SQLite](https://til.simonwillison.net/sqlite/json-audit-log) -- audit log patterns
- [D3 Enter/Update/Exit Pattern](https://www.d3indepth.com/enterexit/) -- D3 data join lifecycle

### Isometry Codebase (PRIMARY)
- `CLAUDE-v5.md` -- D-010 (sync triggers), D-011 (two-layer architecture), D-005 (persistence tiers)
- `native/Isometry/CLAUDE.md` -- checkpoint bridge protocol, DatabaseManager actor, iCloud ubiquity container
- `src/views/SuperGrid.ts` -- _renderCells() full teardown, D3 data join, sticky headers, BBox cache
- `src/etl/DedupEngine.ts` -- source/source_id dedup contract
- `src/database/schema.sql` -- cards, connections, import_sources, import_runs tables
