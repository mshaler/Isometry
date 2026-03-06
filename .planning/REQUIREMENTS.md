# Requirements: Isometry v4.1 Sync + Audit

**Defined:** 2026-03-06
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v4.1 Requirements

Requirements for v4.1 milestone. Each maps to roadmap phases.

### SuperAudit

- [ ] **AUDIT-01**: User can see new cards (added since last import) via green visual indicator across all 9 views
- [ ] **AUDIT-02**: User can see modified cards (content changed since last import) via orange visual indicator across all 9 views
- [ ] **AUDIT-03**: User can see deleted cards (removed from source since last import) via red visual indicator across all 9 views
- [ ] **AUDIT-04**: Change indicators persist for the current session only and clear on app restart
- [ ] **AUDIT-05**: User can see source provenance color coding on cards based on import origin
- [ ] **AUDIT-06**: User can see a source legend showing the color-to-source mapping
- [ ] **AUDIT-07**: User can distinguish SQL-calculated values (aggregation cards) from raw data via visual styling in SuperGrid
- [ ] **AUDIT-08**: User can toggle the audit overlay on/off to show or hide all audit indicators

### CloudKit Sync

- [ ] **SYNC-01**: Cards sync bidirectionally between devices via CKSyncEngine with custom record zone
- [ ] **SYNC-02**: Connections sync bidirectionally between devices alongside cards
- [ ] **SYNC-03**: Sync uses change tokens for incremental-only fetches (no full re-sync)
- [ ] **SYNC-04**: When two devices edit the same card, the later modification wins (last-writer-wins)
- [ ] **SYNC-05**: App polls for CloudKit changes on launch and when returning to foreground
- [ ] **SYNC-06**: App receives real-time push notifications when another device makes changes
- [ ] **SYNC-07**: Soft-deleted cards on one device are marked deleted on other devices via sync
- [ ] **SYNC-08**: Incoming sync records merge into sql.js database via bridge (not ImportOrchestrator)
- [ ] **SYNC-09**: User can see sync status indicator (idle/syncing/error) in the UI
- [ ] **SYNC-10**: Offline edits queue locally and sync automatically when connectivity resumes

### Virtual Scrolling

- [ ] **VSCR-01**: SuperGrid data cells use CSS content-visibility: auto for browser-native rendering optimization
- [ ] **VSCR-02**: SuperGrid uses custom row virtualization, rendering only visible rows plus overscan buffer
- [ ] **VSCR-03**: Column and row headers remain frozen/sticky during virtual scrolling
- [ ] **VSCR-04**: Scroll container maintains correct total height as if all rows were rendered
- [ ] **VSCR-05**: SuperGrid renders at 60fps during scroll with 10K+ card datasets

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### SuperAudit Extended

- **AUDIT-F01**: Import diff detail panel showing field-by-field changes (requires card snapshot storage)
- **AUDIT-F02**: Temporal audit showing database state as of a specific import run (requires event sourcing)
- **AUDIT-F03**: Source provenance in SuperGrid headers when grouping by source

### CloudKit Sync Extended

- **SYNC-F01**: UI state sync (Tier 2 settings) across devices
- **SYNC-F02**: Conflict resolution UI for manual merge when last-writer-wins is insufficient

### Virtual Scrolling Extended

- **VSCR-F01**: Column virtualization for grids with 50+ visible columns
- **VSCR-F02**: Incremental supergrid:query with server-side pagination
- **VSCR-F03**: Lazy card_ids loading for visible cells only

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-field change tracking (cell-level diff) | Requires full card snapshots, OOM risk in WASM. Card-level tracking is sufficient. |
| Persistent audit log (Tier 1 durable) | Bloats database, conflicts with import_runs provenance model. Tier 3 sufficient. |
| Real-time native source watching | WAL locks, TCC, schema changes make watching NoteStore.sqlite/EventKit fragile. Manual re-import is safe. |
| UI state sync across devices | Tier 2 state is device-local by design (D-005). Syncing creates conflicts. |
| Selection state sync | Tier 3 ephemeral (D-005). Transient pointer state. Nonsensical to sync. |
| Full database checkpoint via CloudKit | Defeats purpose of per-record sync. File checkpoint remains for crash recovery only. |
| Multi-user collaborative editing | Requires CRDT/OT, presence, sub-second sync. Massively complex. CloudKit is single-user multi-device. |
| Virtual scrolling for all 9 views | Only SuperGrid needs it. Other views handle 1K-5K cards without issues. |
| Virtual scrolling for 100K+ rows | SuperGrid renders group intersections (max 2,500-5,000 cells), not raw rows. |
| Third-party virtualization library | Incompatible with D3 data join DOM ownership. Custom virtualizer required. |
| SuperCalc (HyperFormula) | Formula reference syntax for PAFV coordinates unsolved, ~500KB bundle. Deferred. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 37 | Pending |
| AUDIT-02 | Phase 37 | Pending |
| AUDIT-03 | Phase 37 | Pending |
| AUDIT-04 | Phase 37 | Pending |
| AUDIT-05 | Phase 37 | Pending |
| AUDIT-06 | Phase 37 | Pending |
| AUDIT-07 | Phase 37 | Pending |
| AUDIT-08 | Phase 37 | Pending |
| SYNC-01 | Phase 40 | Pending |
| SYNC-02 | Phase 41 | Pending |
| SYNC-03 | Phase 39 | Pending |
| SYNC-04 | Phase 40 | Pending |
| SYNC-05 | Phase 40 | Pending |
| SYNC-06 | Phase 40 | Pending |
| SYNC-07 | Phase 41 | Pending |
| SYNC-08 | Phase 39 | Pending |
| SYNC-09 | Phase 40 | Pending |
| SYNC-10 | Phase 39 | Pending |
| VSCR-01 | Phase 38 | Pending |
| VSCR-02 | Phase 38 | Pending |
| VSCR-03 | Phase 38 | Pending |
| VSCR-04 | Phase 38 | Pending |
| VSCR-05 | Phase 38 | Pending |

**Coverage:**
- v4.1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after roadmap creation (traceability populated)*
