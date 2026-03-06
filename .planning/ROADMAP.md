# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads.

## Milestones

- ✅ **v0.1 Data Foundation** — Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** — Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** — Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** — Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** — Phases 11-14 (shipped 2026-03-03)
- ✅ **v3.0 SuperGrid Complete** — Phases 15-27 (shipped 2026-03-05)
- [ ] **v3.1 SuperStack** — Phases 28-32 (paused at Phase 28)
- [ ] **v4.0 Native ETL** — Phases 33-36 (in progress)

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

### v3.1 SuperStack (Paused at Phase 28)

**Milestone Goal:** Extend SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder within dimensions, and full compound D3 keying — removing all remaining depth limitations.

- [x] **Phase 28: N-Level Foundation** - Remove axis depth limit, compound D3 keys, multi-level cell placement, asymmetric depth validation (completed 2026-03-05)
- [x] **Phase 29: Multi-Level Row Headers** - Nested row header rendering at all levels with CSS Grid spanning and collision-free keys (completed 2026-03-05)
- [ ] **Phase 30: Collapse System** - Independent expand/collapse at any level with aggregate and hide modes, recursive child hiding, Tier 2 persistence
- [ ] **Phase 31: Drag Reorder** - Within-dimension level reorder, N-level cross-dimension transpose, animated transitions, Tier 2 persistence
- [ ] **Phase 32: Polish and Performance** - Persistence round-trip validation, compound key selection, render benchmarks, aggregation at all depths

### v4.0 Native ETL (In Progress)

**Milestone Goal:** Users can import their native macOS data (Notes, Reminders, Calendar) into Isometry via direct system database reads, with zero manual export steps. Swift adapters read system databases, transform rows to CanonicalCard JSON, and deliver through the existing WKWebView bridge to ImportOrchestrator — additive-only, no changes to the TypeScript ETL pipeline.

- [ ] **Phase 33: Native ETL Foundation** - NativeImportAdapter protocol, PermissionManager, CoreDataTimestampConverter, chunked bridge pipeline, MockAdapter end-to-end validation
- [ ] **Phase 34: Reminders + Calendar Adapters** - EventKit-based Reminders and Calendar adapters with attendee person cards and synthesized content
- [ ] **Phase 35: Notes Adapter — Title + Metadata** - NoteStore.sqlite title-only path with GRDB, schema version detection, encrypted note filtering, folder hierarchy
- [ ] **Phase 36: Notes Content Extraction** - Gzip decompression + protobuf body text extraction, attachment metadata, note-to-note link connections, FTS5 indexing

## Phase Details

### Phase 28: N-Level Foundation
**Goal**: SuperGrid accepts and correctly renders any number of stacking levels on any dimension with no hard depth limit
**Depends on**: Phase 27 (v3.0 complete)
**Requirements**: STAK-01, STAK-02, STAK-03, STAK-04, STAK-05
**Success Criteria** (what must be TRUE):
  1. PAFVProvider accepts 4+ axes per dimension without rejection or error
  2. D3 cell key function produces unique compound keys that incorporate all stacking levels (not just primary)
  3. Cells land in the correct CSS Grid position when row and column dimensions have different depths (e.g., 3 rows, 2 columns)
  4. SuperGridQuery GROUP BY and Worker round-trip produce correct results for 4+ level configurations
**Plans**: 3 plans
- [ ] 28-01-PLAN.md — PAFVProvider depth limit removal + compound key utility (TDD)
- [ ] 28-02-PLAN.md — SuperGrid compound key integration + asymmetric grid placement
- [ ] 28-03-PLAN.md — SuperGridQuery 4+ level validation tests

### Phase 29: Multi-Level Row Headers
**Goal**: Row headers render at every stacking level with the same visual structure and interaction affordances as column headers
**Depends on**: Phase 28
**Requirements**: RHDR-01, RHDR-02, RHDR-03, RHDR-04
**Success Criteria** (what must be TRUE):
  1. Row headers appear at all stacking levels (not just level 0) and visually nest like column SuperStackHeaders
  2. Each row header level has a visible drag grip for interaction
  3. Row headers use CSS Grid spanning that correctly merges parent groups across child rows
  4. No two row headers at different levels produce the same D3 key (parent-path collision prevention)
**Plans**: 2 plans
- [ ] 29-01-PLAN.md — buildGridTemplateColumns signature update + RHDR test scaffolds
- [ ] 29-02-PLAN.md — N-level row header rendering + integration

### Phase 30: Collapse System
**Goal**: Users can independently collapse any header at any level with a choice between aggregate summaries and complete hiding
**Depends on**: Phase 29
**Requirements**: CLPS-01, CLPS-02, CLPS-03, CLPS-04, CLPS-05, CLPS-06
**Success Criteria** (what must be TRUE):
  1. Clicking a collapse toggle on any header at any stacking level collapses that group independently without affecting siblings
  2. Collapsed headers in aggregate mode display count/sum of hidden children in place of the expanded rows/columns
  3. Collapsed headers in hide mode show no children and no aggregate row — the group simply disappears from the grid
  4. User can switch a specific header between aggregate and hide mode (via context menu or toggle indicator)
  5. Collapse state persists within a session across view transitions (Tier 2 via PAFVProvider serialization)
**Plans**: 3 plans
- [ ] 30-01-PLAN.md — PAFVProvider collapse state persistence + CLPS test scaffolds (TDD)
- [ ] 30-02-PLAN.md — SuperGrid collapse modes (aggregate + hide) with row/col symmetry
- [ ] 30-03-PLAN.md — Context menu mode switching + Tier 2 persistence wiring

### Phase 31: Drag Reorder
**Goal**: Users can reorder stacking levels within a dimension and transpose across dimensions with N-level stacks
**Depends on**: Phase 30
**Requirements**: DRAG-01, DRAG-02, DRAG-03, DRAG-04
**Success Criteria** (what must be TRUE):
  1. Dragging a stacking level header within its dimension (e.g., swapping row level 0 and level 1) reorders the axis stack and re-renders the grid
  2. Cross-dimension transpose (row to column, column to row) works correctly when either dimension has 2+ stacking levels
  3. All drag reorder operations animate with a 300ms D3 transition consistent with existing SuperDynamic behavior
  4. Reorder state persists in Tier 2 and survives view transitions within the LATCH family
**Plans**: TBD

### Phase 32: Polish and Performance
**Goal**: N-level stacking is production-ready with validated persistence, correct selection, acceptable performance, and aggregation at all depths
**Depends on**: Phase 31
**Requirements**: PRST-01, PRST-02, PRST-03, PRST-04
**Success Criteria** (what must be TRUE):
  1. Stacking order and collapse state survive a full app reload (Tier 2 persistence round-trip verified end-to-end)
  2. Lasso, Cmd+click, and Shift+click selection correctly identify and highlight cells using compound keys at any stacking depth
  3. Rendering a 4-level stacked 10x10 grid completes in under 16ms (matching v3.0 performance threshold)
  4. SuperCards (aggregation cards) render correctly at every nesting depth with accurate count/sum values
**Plans**: TBD

### Phase 33: Native ETL Foundation
**Goal**: The shared infrastructure for all native adapters exists and is validated end-to-end with a mock adapter before any real system database is read
**Depends on**: Phase 14 (v2.0 native shell complete)
**Requirements**: FNDX-01, FNDX-02, FNDX-03, FNDX-04, FNDX-05, FNDX-06, FNDX-07, FNDX-08
**Success Criteria** (what must be TRUE):
  1. User can trigger a native import from the app and see the existing ImportToast progress UI without any additional UI changes
  2. When the app lacks system database access, user sees a clear permission prompt with a deep link that opens directly to the relevant System Settings pane
  3. A MockAdapter returning 3 hardcoded cards produces correctly-deduped cards in Isometry — confirming the full Swift adapter → bridge → Worker → ImportOrchestrator pipeline
  4. All dates output by adapters are ISO 8601 strings with no 31-year offset (CoreDataTimestampConverter verified against a known reference date in XCTest)
  5. A 5,000-card mock import completes without WKWebView process termination (200-card chunked bridge dispatch validated)
**Plans**: 3 plans
Plans:
- [ ] 33-01-PLAN.md — Swift-side foundation: NativeImportAdapter protocol, CanonicalCard struct, CoreDataTimestampConverter, PermissionManager, NativeImportCoordinator
- [ ] 33-02-PLAN.md — TypeScript-side bridge: SourceType extension, NativeBridge chunk handler, etl-import-native worker handler, WorkerBridge.importNative()
- [ ] 33-03-PLAN.md — End-to-end wiring: MockAdapter, ImportSourcePickerView, PermissionSheetView, ContentView + BridgeManager integration

### Phase 34: Reminders + Calendar Adapters
**Goal**: Users can import their Reminders and Calendar data from macOS into Isometry as task and event cards with full metadata, attendee relationships, and dedup-safe re-import
**Depends on**: Phase 33
**Requirements**: RMDR-01, RMDR-02, RMDR-03, RMDR-04, RMDR-05, CALR-01, CALR-02, CALR-03, CALR-04, CALR-05, CALR-06
**Success Criteria** (what must be TRUE):
  1. User can import all incomplete reminders plus last-30-days completed reminders from macOS Reminders; each card has title, notes, due date, completion status, priority, and list name as folder
  2. User can re-import from Reminders without creating duplicate cards (dedup via calendarItemIdentifier)
  3. User can import all calendar events from macOS Calendar; each event card has title, start/end times, location, and calendar name as folder; multi-attendee events have is_collective set and each attendee appears as a person card with a links_to connection
  4. All-day events import with event_start and event_end reflecting full-day boundaries; events with no notes field have synthesized content from date range, location, and attendee names
  5. Recurring events import as individual expanded occurrences within the configured date range
**Plans**: TBD

### Phase 35: Notes Adapter — Title + Metadata
**Goal**: Users can import all non-encrypted Apple Notes with title, folder hierarchy, dates, and snippet preview — without touching protobuf content extraction
**Depends on**: Phase 33
**Requirements**: NOTE-01, NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-06
**Success Criteria** (what must be TRUE):
  1. User can import all non-encrypted notes from macOS Apple Notes; each card has title, folder, created/modified dates, and a 100-char snippet preview
  2. Imported notes preserve their Apple Notes folder hierarchy — nested folders appear as a path in the card's folder field via self-join on ZICCLOUDSYNCINGOBJECT
  3. Hashtags extracted from note text appear as tags on imported cards
  4. Password-protected notes are detected, skipped, and their count is reported in the import summary (none are silently dropped)
  5. Notes adapter detects the NoteStore.sqlite schema version at runtime and queries the correct column names (ZTITLE1 vs ZTITLE2, ZACCOUNT3 vs ZACCOUNT4) without any hardcoded version assumptions
**Plans**: TBD

### Phase 36: Notes Content Extraction
**Goal**: Users can import the full body text of Apple Notes — enabling FTS5 search across complete note content rather than just 100-char snippets
**Depends on**: Phase 35
**Requirements**: BODY-01, BODY-02, BODY-03, BODY-04, BODY-05
**Success Criteria** (what must be TRUE):
  1. Imported note cards contain the full body text of non-encrypted Apple Notes (not just the ZSNIPPET preview)
  2. Notes with unknown or malformed protobuf blobs fall back to the ZSNIPPET preview rather than failing the import — the user sees a partial result, not an error
  3. Attachment metadata (type and filename) from Apple Notes is preserved on imported cards
  4. Internal note-to-note links in Apple Notes create connections between the corresponding imported cards
  5. Imported note body content is indexed and searchable via FTS5 within Isometry (user can type a phrase from a note body and find it in SuperSearch)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order. v3.1 paused at Phase 28 — v4.0 proceeds at Phase 33. v3.1 resumes after v4.0 ships.

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
| 29. Multi-Level Row Headers | 2/2 | Complete    | 2026-03-05 | - |
| 30. Collapse System | v3.1 | 0/0 | Paused | - |
| 31. Drag Reorder | v3.1 | 0/0 | Paused | - |
| 32. Polish and Performance | v3.1 | 0/0 | Paused | - |
| 33. Native ETL Foundation | v4.0 | 0/3 | In progress | - |
| 34. Reminders + Calendar Adapters | v4.0 | 0/0 | Not started | - |
| 35. Notes Adapter — Title + Metadata | v4.0 | 0/0 | Not started | - |
| 36. Notes Content Extraction | v4.0 | 0/0 | Not started | - |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers shipped: 2026-03-02*
*v2.0 Native Shell shipped: 2026-03-03*
*v3.0 SuperGrid Complete shipped: 2026-03-05*
*v3.1 SuperStack roadmap created: 2026-03-05 (paused at Phase 28)*
*v4.0 Native ETL roadmap created: 2026-03-05*
