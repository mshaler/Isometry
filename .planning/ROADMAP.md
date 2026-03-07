# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads. v4.1 adds visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync.

## Milestones

- ✅ **v0.1 Data Foundation** — Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** — Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** — Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** — Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** — Phases 11-14 (shipped 2026-03-03)
- ✅ **v3.0 SuperGrid Complete** — Phases 15-27 (shipped 2026-03-05)
- ✅ **v4.0 Native ETL** — Phases 33-36 (shipped 2026-03-06)
- ✅ **v3.1 SuperStack** — Phases 28-32 (shipped 2026-03-06)
- 🚧 **v4.1 Sync + Audit** — Phases 37-41 (in progress)

## Phases

<details>
<summary>✅ v0.1 Data Foundation (Phases 1-2) — SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) — completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) — completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.5 Providers + Views (Phases 4-6) — SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) — completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) — completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) — completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.0 Web Runtime (Phases 3, 7) — SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) — completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) — completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.1 ETL Importers (Phases 8-10) — SHIPPED 2026-03-02</summary>

- [x] Phase 8: ETL Foundation + Apple Notes Parser (5/5 plans) — completed 2026-03-01
- [x] Phase 9: Remaining Parsers + Export Pipeline (5/5 plans) — completed 2026-03-02
- [x] Phase 10: Progress Reporting + Polish (2/2 plans) — completed 2026-03-02

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.0 Native Shell (Phases 11-14) — SHIPPED 2026-03-03</summary>

- [x] Phase 11: Xcode Shell + WKURLSchemeHandler (2/2 plans) — completed 2026-03-02
- [x] Phase 12: Bridge + Data Persistence (3/3 plans) — completed 2026-03-03
- [x] Phase 13: Native Chrome + File Import (3/3 plans) — completed 2026-03-03
- [x] Phase 14: iCloud + StoreKit Tiers (3/3 plans) — completed 2026-03-03

See: `.planning/milestones/v2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v3.0 SuperGrid Complete (Phases 15-27) — SHIPPED 2026-03-05</summary>

- [x] Phase 15: PAFVProvider Stacked Axes (2/2 plans) — completed 2026-03-04
- [x] Phase 16: SuperGridQuery Worker Wiring (2/2 plans) — completed 2026-03-04
- [x] Phase 17: SuperGrid Dynamic Axis Reads (2/2 plans) — completed 2026-03-04
- [x] Phase 18: SuperDynamic (2/2 plans) — completed 2026-03-04
- [x] Phase 19: SuperPosition + SuperZoom (3/3 plans) — completed 2026-03-04
- [x] Phase 20: SuperSize (2/2 plans) — completed 2026-03-05
- [x] Phase 21: SuperSelect (4/4 plans) — completed 2026-03-05
- [x] Phase 22: SuperDensity (3/3 plans) — completed 2026-03-05
- [x] Phase 23: SuperSort (3/3 plans) — completed 2026-03-05
- [x] Phase 24: SuperFilter (3/3 plans) — completed 2026-03-05
- [x] Phase 25: SuperSearch (3/3 plans) — completed 2026-03-05
- [x] Phase 26: SuperTime (3/3 plans) — completed 2026-03-05
- [x] Phase 27: SuperCards + Polish (3/3 plans) — completed 2026-03-05

See: `.planning/milestones/v3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v4.0 Native ETL (Phases 33-36) — SHIPPED 2026-03-06</summary>

- [x] Phase 33: Native ETL Foundation (3/3 plans) — completed 2026-03-06
- [x] Phase 34: Reminders + Calendar Adapters (3/3 plans) — completed 2026-03-06
- [x] Phase 35: Notes Adapter — Title + Metadata (1/1 plan) — completed 2026-03-06
- [x] Phase 36: Notes Content Extraction (2/2 plans) — completed 2026-03-06

See: `.planning/milestones/v4.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v3.1 SuperStack (Phases 28-32) — SHIPPED 2026-03-06</summary>

- [x] Phase 28: N-Level Foundation (3/3 plans) — completed 2026-03-05
- [x] Phase 29: Multi-Level Row Headers (2/2 plans) — completed 2026-03-05
- [x] Phase 30: Collapse System (3/3 plans) — completed 2026-03-06
- [x] Phase 31: Drag Reorder (2/2 plans) — completed 2026-03-06
- [x] Phase 32: Polish and Performance (2/2 plans) — completed 2026-03-06

See: `.planning/milestones/v3.1-ROADMAP.md` for full details.

</details>

### v4.1 Sync + Audit (In Progress)

**Milestone Goal:** Add visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at 10K+ card scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync.

- [ ] **Phase 37: SuperAudit** - Change tracking, source provenance, calculated field distinction, and audit toggle across all 9 views
- [ ] **Phase 38: Virtual Scrolling** - CSS content-visibility progressive enhancement and custom row virtualization for SuperGrid at scale
- [ ] **Phase 39: CloudKit Architecture** - Schema migration, bridge protocol extension, CKSyncEngine setup, and iCloud Documents to record sync migration
- [ ] **Phase 40: CloudKit Card Sync** - Bidirectional card sync with conflict resolution, push/poll triggers, and status indicator
- [ ] **Phase 41: CloudKit Connection Sync + Polish** - Connection sync, soft-delete propagation, and multi-device edge case validation

## Phase Details

### Phase 37: SuperAudit
**Goal**: Users can see at a glance which cards are new, modified, or deleted, where data came from, and which values are calculated -- across all views
**Depends on**: Nothing (first phase of v4.1, purely additive JS/CSS)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, AUDIT-06, AUDIT-07, AUDIT-08
**Success Criteria** (what must be TRUE):
  1. User can visually distinguish new (green), modified (orange), and deleted (red) cards in any of the 9 views after an import
  2. User can see which import source (Apple Notes, CSV, Markdown, etc.) each card came from via color coding, with a legend explaining the mapping
  3. User can see that aggregation card values in SuperGrid are visually distinct from raw data values
  4. User can toggle the audit overlay on/off and all audit indicators appear or disappear across all views
  5. User restarts the app and all audit indicators are cleared (session-only persistence)
**Plans**: 3 plans

Plans:
- [ ] 37-01-PLAN.md — Audit data layer: AuditState, ImportResult/DedupEngine extension, CardDatum source field
- [ ] 37-02-PLAN.md — CSS overlay + all 9 view renderers with audit data attributes
- [ ] 37-03-PLAN.md — Toggle UI, keyboard shortcut, floating legend, import result wiring

### Phase 38: Virtual Scrolling
**Goal**: SuperGrid renders smoothly at 10K+ card scale with frozen headers and correct scroll behavior
**Depends on**: Nothing (independent of Phase 37, can run in parallel)
**Requirements**: VSCR-01, VSCR-02, VSCR-03, VSCR-04, VSCR-05
**Success Criteria** (what must be TRUE):
  1. User can scroll through a 10K+ card SuperGrid at 60fps without visible jank
  2. User sees column and row headers remain frozen/sticky while scrolling through virtualized content
  3. User can scroll to any position and the scrollbar reflects correct total height as if all rows were rendered
  4. User can use lasso selection, density controls, and sort/filter without breaking virtualized rendering
**Plans**: TBD

Plans:
- [ ] 38-01: TBD
- [ ] 38-02: TBD

### Phase 39: CloudKit Architecture
**Goal**: The sync infrastructure is in place: schema columns for sync state, bridge protocol handles sync messages, CKSyncEngine is initialized with change token persistence, and the database has migrated from iCloud Documents to Application Support with CloudKit as the sync layer
**Depends on**: Phase 37 (SuperAudit establishes the session-level change tracking pattern that sync must coexist with)
**Requirements**: SYNC-03, SYNC-08, SYNC-10
**Success Criteria** (what must be TRUE):
  1. App launches successfully after migrating database from iCloud ubiquity container to Application Support (no data loss)
  2. CKSyncEngine initializes with a custom record zone and persists change tokens across app restarts
  3. Incoming sync records from CloudKit merge into the sql.js database via the bridge without using ImportOrchestrator
  4. Edits made while offline are queued locally and the queue survives app restart
**Plans**: TBD

Plans:
- [ ] 39-01: TBD
- [ ] 39-02: TBD
- [ ] 39-03: TBD

### Phase 40: CloudKit Card Sync
**Goal**: Cards sync bidirectionally between devices with automatic conflict resolution, real-time push notification triggers, and visible sync status
**Depends on**: Phase 39 (CKSyncEngine, schema, and bridge protocol must be in place)
**Requirements**: SYNC-01, SYNC-04, SYNC-05, SYNC-06, SYNC-09
**Success Criteria** (what must be TRUE):
  1. User creates a card on Device A and it appears on Device B without manual action
  2. User edits the same card on both devices while both are online, and the later edit wins without data corruption
  3. User opens the app (or returns from background) and sees cards updated by other devices via automatic poll
  4. User sees a sync status indicator showing idle, syncing, or error state
  5. User receives card updates pushed in real-time from another device without needing to reopen the app
**Plans**: TBD

Plans:
- [ ] 40-01: TBD
- [ ] 40-02: TBD
- [ ] 40-03: TBD

### Phase 41: CloudKit Connection Sync + Polish
**Goal**: Connections sync between devices alongside cards, soft-deletes propagate correctly, and multi-device scenarios work end-to-end
**Depends on**: Phase 40 (card sync must be stable before connection references can sync)
**Requirements**: SYNC-02, SYNC-07
**Success Criteria** (what must be TRUE):
  1. User creates a connection between two cards on Device A and the connection appears on Device B
  2. User soft-deletes a card on Device A and it appears as deleted on Device B (not orphaned)
  3. User performs a full workflow (import, edit, connect, delete, sync) across two devices and data is consistent on both
**Plans**: TBD

Plans:
- [ ] 41-01: TBD
- [ ] 41-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 1-36 complete across 8 milestones. v4.1 begins at Phase 37.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v0.1 | 4/4 | Complete | 2026-02-28 |
| 2. CRUD + Query Layer | v0.1 | 6/6 | Complete | 2026-02-28 |
| 3. Worker Bridge | v1.0 | 3/3 | Complete | 2026-03-01 |
| 4. Providers + MutationManager | v0.5 | 7/7 | Complete | 2026-02-28 |
| 5. Core D3 Views + Transitions | v0.5 | 4/4 | Complete | 2026-02-28 |
| 6. Time + Visual Views | v0.5 | 3/3 | Complete | 2026-02-28 |
| 7. Graph Views + SuperGrid | v1.0 | 4/4 | Complete | 2026-03-01 |
| 8. ETL Foundation + Apple Notes Parser | v1.1 | 5/5 | Complete | 2026-03-01 |
| 9. Remaining Parsers + Export Pipeline | v1.1 | 5/5 | Complete | 2026-03-02 |
| 10. Progress Reporting + Polish | v1.1 | 2/2 | Complete | 2026-03-02 |
| 11. Xcode Shell + WKURLSchemeHandler | v2.0 | 2/2 | Complete | 2026-03-02 |
| 12. Bridge + Data Persistence | v2.0 | 3/3 | Complete | 2026-03-03 |
| 13. Native Chrome + File Import | v2.0 | 3/3 | Complete | 2026-03-03 |
| 14. iCloud + StoreKit Tiers | v2.0 | 3/3 | Complete | 2026-03-03 |
| 15. PAFVProvider Stacked Axes | v3.0 | 2/2 | Complete | 2026-03-04 |
| 16. SuperGridQuery Worker Wiring | v3.0 | 2/2 | Complete | 2026-03-04 |
| 17. SuperGrid Dynamic Axis Reads | v3.0 | 2/2 | Complete | 2026-03-04 |
| 18. SuperDynamic | v3.0 | 2/2 | Complete | 2026-03-04 |
| 19. SuperPosition + SuperZoom | v3.0 | 3/3 | Complete | 2026-03-04 |
| 20. SuperSize | v3.0 | 2/2 | Complete | 2026-03-05 |
| 21. SuperSelect | v3.0 | 4/4 | Complete | 2026-03-05 |
| 22. SuperDensity | v3.0 | 3/3 | Complete | 2026-03-05 |
| 23. SuperSort | v3.0 | 3/3 | Complete | 2026-03-05 |
| 24. SuperFilter | v3.0 | 3/3 | Complete | 2026-03-05 |
| 25. SuperSearch | v3.0 | 3/3 | Complete | 2026-03-05 |
| 26. SuperTime | v3.0 | 3/3 | Complete | 2026-03-05 |
| 27. SuperCards + Polish | v3.0 | 3/3 | Complete | 2026-03-05 |
| 28. N-Level Foundation | v3.1 | 3/3 | Complete | 2026-03-05 |
| 29. Multi-Level Row Headers | v3.1 | 2/2 | Complete | 2026-03-05 |
| 30. Collapse System | v3.1 | 3/3 | Complete | 2026-03-06 |
| 31. Drag Reorder | v3.1 | 2/2 | Complete | 2026-03-06 |
| 32. Polish and Performance | v3.1 | 2/2 | Complete | 2026-03-06 |
| 33. Native ETL Foundation | v4.0 | 3/3 | Complete | 2026-03-06 |
| 34. Reminders + Calendar Adapters | v4.0 | 3/3 | Complete | 2026-03-06 |
| 35. Notes Adapter — Title + Metadata | v4.0 | 1/1 | Complete | 2026-03-06 |
| 36. Notes Content Extraction | v4.0 | 2/2 | Complete | 2026-03-06 |
| 37. SuperAudit | 2/3 | In Progress|  | - |
| 38. Virtual Scrolling | v4.1 | 0/2 | Not started | - |
| 39. CloudKit Architecture | v4.1 | 0/3 | Not started | - |
| 40. CloudKit Card Sync | v4.1 | 0/3 | Not started | - |
| 41. CloudKit Connection Sync + Polish | v4.1 | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers shipped: 2026-03-02*
*v2.0 Native Shell shipped: 2026-03-03*
*v3.0 SuperGrid Complete shipped: 2026-03-05*
*v4.0 Native ETL shipped: 2026-03-06*
*v3.1 SuperStack shipped: 2026-03-06*
*v4.1 Sync + Audit roadmap created: 2026-03-06*
