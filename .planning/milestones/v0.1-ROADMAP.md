# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge. After Phase 3, Providers (Phase 4) and ETL (Phase 6) can run in parallel; D3 views (Phase 5) depend on Phase 4. The native Swift shell (Phase 7) depends on completion of all web runtime phases (1-6). The web runtime (Phases 1-6) ships independently; the native app (Phase 7) wraps it.

## Release Gates

| Release | Phases | Ships When |
|---------|--------|------------|
| **Web Runtime v1** | 1-6 | All Phase 1-6 requirements pass |
| **Native App v1** | 7 | Web Runtime v1 + all NSAFE requirements pass |

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Database Foundation** - Custom sql.js WASM with FTS5, canonical schema, three-trigger sync, Vite/Vitest infrastructure (completed 2026-02-28)
- [x] **Phase 2: CRUD + Query Layer** - Card/Connection CRUD, FTS5 search, graph traversal, performance benchmarks (completed 2026-02-28, 151 tests)
- [ ] **Phase 3: Worker Bridge** - Typed message protocol with correlation IDs, all database operations off main thread
- [ ] **Phase 4: Providers + Mutation Safety** - SQL allowlist, five Providers, MutationManager with undo, three-tier state persistence
- [ ] **Phase 5: D3 Views + Search UI** - Nine views with PAFV projection, animated transitions, search UX, render performance
- [ ] **Phase 6: ETL Importers** - Apple Notes import with deduplication, idempotent re-import, batch transactions
- [ ] **Phase 7: Native Platform Safety** - WKWebView shell, CloudKit sync, Keychain credentials, native SQLite lifecycle

## Phase Details

### Phase 1: Database Foundation
**Goal**: sql.js with FTS5 initializes correctly in every target environment and the canonical schema enforces data integrity from the first query
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06
**Success Criteria** (what must be TRUE):
  1. sql.js WASM (custom FTS5 build) loads and initializes in Vitest, Vite dev server, and Vite production build without MIME type or path errors
  2. Canonical schema (cards, connections, cards_fts, ui_state) creates successfully with all indexes, and FTS5 capability is confirmed via pragma_compile_options
  3. FTS5 content sync uses three separate triggers (insert, delete, update) and integrity-check passes after every mutation batch in the test suite
  4. PRAGMA foreign_keys = ON executes on every database open and cascade deletion is verified in tests

**Risk Mitigations:**
- sql.js v1.14.0 does not ship FTS5 -- custom Emscripten build with -DSQLITE_ENABLE_FTS5 required before any feature work
- Vite must exclude sql.js from optimizeDeps and use ?url import for WASM path resolution
- WKWebView fetch() MIME type rejection solved with app:// scheme handler (integration spike here, full native shell in Phase 7)

**Plans**: 4 plans (3 waves)
- [x] 01-01-PLAN.md -- Project scaffolding + Vite/Vitest configuration (Wave 1)
- [x] 01-02-PLAN.md -- Custom FTS5 WASM build (Wave 1, parallel with 01)
- [x] 01-03-PLAN.md -- Database wrapper + schema + FTS triggers TDD (Wave 2)
- [x] 01-04-PLAN.md -- Production build verification + entry point (Wave 3) -- COMPLETE 2026-02-28

### Phase 2: CRUD + Query Layer
**Goal**: Users can create, read, update, and delete cards and connections, search with ranked results, and all operations meet performance thresholds on a 10K-card dataset
**Depends on**: Phase 1
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, CARD-06, CONN-01, CONN-02, CONN-03, CONN-04, CONN-05, SRCH-01, SRCH-02, SRCH-03, SRCH-04, PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. User can create a card, retrieve it by ID, update its fields (modified_at auto-updates), soft delete it, and undelete it
  2. User can create connections between cards (with optional via_card_id), query them by direction (outgoing/incoming/bidirectional), delete them, and cascade-delete triggers on hard-deleted cards
  3. User can search cards by text query and receive BM25-ranked results with highlighted snippets, using rowid joins (never id joins)
  4. Performance benchmarks pass on a 10K-card / 50K-connection dataset: single insert p95 <10ms, bulk 1000-card insert p95 <1s, FTS search p95 <100ms, graph traversal (depth 3) p95 <500ms
  5. Prepared statement wrapper pattern (`withStatement`) is established as the documented Phase 3+ pattern entry point in `helpers.ts`; Phase 2 query modules use `db.exec()`/`db.run()` directly (no `Database.prepare()` yet)

**Plans**: 6 plans (5 waves)
- [x] 02-01-PLAN.md -- Card CRUD TDD (Wave 1) -- COMPLETE 2026-02-28 (30 tests)
- [x] 02-02-PLAN.md -- Connection CRUD TDD (Wave 2) -- COMPLETE 2026-02-28 (23 tests)
- [x] 02-03-PLAN.md -- FTS5 Search TDD (Wave 2) -- COMPLETE 2026-02-28 (21 tests)
- [x] 02-04-PLAN.md -- Graph traversal queries TDD (Wave 3) -- COMPLETE 2026-02-28 (19 tests)
- [x] 02-05-PLAN.md -- Performance benchmarks + prepared statement patterns (Wave 4) -- COMPLETE 2026-02-28 (4 PERF thresholds verified)
- [ ] 02-06-PLAN.md -- Gap closure: docs + typecheck fixes (Wave 5, gap_closure)

### Phase 3: Worker Bridge
**Goal**: All database operations execute in a Web Worker with typed message passing, and the main thread is never blocked by SQL queries
**Depends on**: Phase 2
**Requirements**: WKBR-01, WKBR-02, WKBR-03, WKBR-04
**Success Criteria** (what must be TRUE):
  1. WorkerBridge sends typed WorkerMessage envelopes with UUID correlation IDs and receives WorkerResponse matching each request
  2. Worker errors propagate to the main thread with structured error codes and messages (not silent failures)
  3. All database operations (CRUD, search, graph traversal) execute exclusively in the Web Worker -- main thread contains zero sql.js calls
  4. Message serialization overhead is profiled and documented; query results use minimal projection (no SELECT *)

**Plans**: 3 estimated (2 waves)
- [ ] 03-01-PLAN.md -- Worker setup + message protocol (Wave 1)
- [ ] 03-02-PLAN.md -- Database operation handlers (Wave 1)
- [ ] 03-03-PLAN.md -- Error propagation + serialization profiling (Wave 2)

### Phase 4: Providers + Mutation Safety
**Goal**: UI state compiles to safe parameterized SQL through an allowlisted Provider system, mutations are undoable, and state persists correctly across the three-tier model
**Depends on**: Phase 3
**Requirements**: SAFE-01, SAFE-02, SAFE-03, SAFE-04, SAFE-05, SAFE-06, PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, WKBR-05, WKBR-06, WKBR-07
**Success Criteria** (what must be TRUE):
  1. FilterProvider compiles filter state to parameterized SQL WHERE clauses, validating fields against ALLOWED_FILTER_FIELDS and operators against ALLOWED_OPERATORS; unknown fields or operators are rejected at both compile time (TypeScript union) and runtime
  2. AxisProvider compiles axis mappings to SQL ORDER BY/GROUP BY; DensityProvider controls density settings; ViewProvider tracks current view type -- all Tier 2 state persists to ui_state and restores on launch
  3. SelectionProvider holds selected card IDs in-memory only (Tier 3) and this state is never written to any storage
  4. SQL injection test suite passes: injection strings in values, unknown field names, and operator manipulation all rejected
  5. User can undo and redo mutations via Cmd+Z / Cmd+Shift+Z; MutationManager generates inverse SQL for every mutation and sets dirty flag on writes

**Plans**: 4 estimated (2 waves)
- [ ] 04-01-PLAN.md -- FilterProvider + SQL safety TDD (Wave 1)
- [ ] 04-02-PLAN.md -- AxisProvider + DensityProvider + ViewProvider (Wave 1)
- [ ] 04-03-PLAN.md -- SelectionProvider + tier persistence (Wave 2)
- [ ] 04-04-PLAN.md -- MutationManager + undo/redo (Wave 2)

### Phase 5: D3 Views + Search UI
**Goal**: Users can view their data through nine distinct projections with animated transitions between views, search with keyboard navigation and faceted refinement, and all renders complete within 16ms
**Depends on**: Phase 4
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, VIEW-07, VIEW-08, VIEW-09, VIEW-10, VIEW-11, VIEW-12, VIEW-13, SRCH-05, SRCH-06, SRCH-07, PERF-05
**Success Criteria** (what must be TRUE):
  1. SuperGrid renders cards with nested dimensional headers via PAFV projection; axis changes recompile the SQL projection, not the data
  2. All nine views render correctly: list (single-axis sort), grid (two axes), kanban (category grouping), calendar (month), timeline (linear time), gallery (thumbnails), network (force-directed), tree (hierarchy), table (raw columns)
  3. All views use D3 data join with key function (d => d.id) and view transitions animate cards between projections with ~300ms ease-in-out
  4. Search input is debounced at 150ms; user can navigate results with keyboard (arrow keys, Enter, Escape) and refine with faceted chips (card_type, folder, status, source)
  5. View render completes in p95 <16ms for 100 visible cards; queries enforce LIMIT to stay under D3 SVG performance ceiling (~500 visible elements)

**Plans**: TBD

### Phase 6: ETL Importers
**Goal**: Users can import Apple Notes into Isometry with automatic graph extraction, deduplication, and idempotent re-import
**Depends on**: Phase 3 (can develop in parallel with Phases 4-5; uses CRUD layer and Worker Bridge directly)
**Requirements**: ETL-01, ETL-02, ETL-03, ETL-04, ETL-05, ETL-06
**Success Criteria** (what must be TRUE):
  1. Apple Notes importer maps notes to canonical cards and extracts connections (mentions, links, contains) as graph edges
  2. Import deduplication uses source + source_id uniqueness; re-import is idempotent (updates modified_at if newer, no duplicates created)
  3. Batch imports execute in transactions (100 cards per batch) and report results (new, updated, skipped counts)

**Research Flag:** Verify alto-index JSON schema format is fully documented before Phase 6 planning begins. If underdocumented, a format research spike is needed.

**Plans**: TBD

### Phase 7: Native Platform Safety
**Goal**: The web runtime runs inside a WKWebView native shell with correct WASM serving, Keychain credential storage, CloudKit sync, and all ten native platform pitfalls addressed
**Depends on**: Phases 1-6 (all Web Runtime phases complete)
**Requirements**: NSAFE-01, NSAFE-02, NSAFE-03, NSAFE-04, NSAFE-05, NSAFE-06, NSAFE-07, NSAFE-08, NSAFE-09, NSAFE-10
**Success Criteria** (what must be TRUE):
  1. WKWebView loads the web runtime via WKURLSchemeHandler (app:// scheme) with correct MIME types; WASM loads without fetch() rejection
  2. CloudKit sync works end-to-end: zone creation guard prevents race conditions, change token expiration triggers full sync, rate limiting uses exponential backoff with CKErrorRetryAfterKey
  3. CKRecord field reads handle all type coercions (Int/Int64, String/CKAsset, Date precision) and CKAsset file contents are copied immediately (never stored as temporary URLs)
  4. Actor reentrancy is prevented: no database state assumptions held across await points; mutations use atomic transactions without suspension
  5. Keychain uses kSecAttrAccessibleAfterFirstUnlock for background sync credentials; push notification entitlements and remote notification background mode are enabled; native SQLite enforces PRAGMA foreign_keys = ON on every connection

**Research Flag:** CloudKit conflict resolution semantics and binary blob sync patterns (1MB asset limit) need investigation before Phase 7 planning.

**Plans**: TBD

## Coverage

### Requirement-to-Phase Mapping

| Requirement | Phase | Category |
|-------------|-------|----------|
| DB-01 | 1 | 4/4 | Complete   | 2026-02-28 | 1 | Database Foundation |
| DB-03 | 1 | Database Foundation |
| DB-04 | 1 | Database Foundation |
| DB-05 | 1 | Database Foundation |
| DB-06 | 1 | Database Foundation |
| CARD-01 | 2 | 6/6 | Complete   | 2026-02-28 | 2 | Card Operations |
| CARD-03 | 2 | Card Operations |
| CARD-04 | 2 | Card Operations |
| CARD-05 | 2 | Card Operations |
| CARD-06 | 2 | Card Operations |
| CONN-01 | 2 | Connections |
| CONN-02 | 2 | Connections |
| CONN-03 | 2 | Connections |
| CONN-04 | 2 | Connections |
| CONN-05 | 2 | Connections |
| SRCH-01 | 2 | Search |
| SRCH-02 | 2 | Search |
| SRCH-03 | 2 | Search |
| SRCH-04 | 2 | Search |
| PERF-01 | 2 | Performance |
| PERF-02 | 2 | Performance |
| PERF-03 | 2 | Performance |
| PERF-04 | 2 | Performance |
| WKBR-01 | 3 | Worker Bridge |
| WKBR-02 | 3 | Worker Bridge |
| WKBR-03 | 3 | Worker Bridge |
| WKBR-04 | 3 | Worker Bridge |
| SAFE-01 | 4 | SQL Safety |
| SAFE-02 | 4 | SQL Safety |
| SAFE-03 | 4 | SQL Safety |
| SAFE-04 | 4 | SQL Safety |
| SAFE-05 | 4 | SQL Safety |
| SAFE-06 | 4 | SQL Safety |
| PROV-01 | 4 | Providers |
| PROV-02 | 4 | Providers |
| PROV-03 | 4 | Providers |
| PROV-04 | 4 | Providers |
| PROV-05 | 4 | Providers |
| PROV-06 | 4 | Providers |
| PROV-07 | 4 | Providers |
| WKBR-05 | 4 | Worker Bridge (Mutation) |
| WKBR-06 | 4 | Worker Bridge (Mutation) |
| WKBR-07 | 4 | Worker Bridge (Mutation) |
| VIEW-01 | 5 | Views |
| VIEW-02 | 5 | Views |
| VIEW-03 | 5 | Views |
| VIEW-04 | 5 | Views |
| VIEW-05 | 5 | Views |
| VIEW-06 | 5 | Views |
| VIEW-07 | 5 | Views |
| VIEW-08 | 5 | Views |
| VIEW-09 | 5 | Views |
| VIEW-10 | 5 | Views |
| VIEW-11 | 5 | Views |
| VIEW-12 | 5 | Views |
| VIEW-13 | 5 | Views |
| SRCH-05 | 5 | Search UI |
| SRCH-06 | 5 | Search UI |
| SRCH-07 | 5 | Search UI |
| PERF-05 | 5 | Performance |
| ETL-01 | 6 | ETL |
| ETL-02 | 6 | ETL |
| ETL-03 | 6 | ETL |
| ETL-04 | 6 | ETL |
| ETL-05 | 6 | ETL |
| ETL-06 | 6 | ETL |
| NSAFE-01 | 7 | Native Platform Safety |
| NSAFE-02 | 7 | Native Platform Safety |
| NSAFE-03 | 7 | Native Platform Safety |
| NSAFE-04 | 7 | Native Platform Safety |
| NSAFE-05 | 7 | Native Platform Safety |
| NSAFE-06 | 7 | Native Platform Safety |
| NSAFE-07 | 7 | Native Platform Safety |
| NSAFE-08 | 7 | Native Platform Safety |
| NSAFE-09 | 7 | Native Platform Safety |
| NSAFE-10 | 7 | Native Platform Safety |

**Coverage:** 78/78 requirements mapped (0 orphaned)
- Web Runtime v1 (Phases 1-6): 68 requirements
- Native App v1 (Phase 7): 10 requirements

**Note:** Both ROADMAP and REQUIREMENTS enumerate 78 total requirements. Any prior reference to "67" was a summary typo — now corrected.

## Execution Policy

**Primary rule:** Dependency-driven execution. A phase can start when all its dependencies are complete.

**Dependency graph:**
- Phase 2 requires Phase 1
- Phase 3 requires Phase 2
- Phase 4 requires Phase 3
- Phase 5 requires Phase 4
- Phase 6 requires Phase 3 (NOT Phase 4 or 5)
- Phase 7 requires Phases 1-6

**Parallelization:**
- Phases 4 and 6 MAY execute in parallel after Phase 3 completes
- Phase 5 cannot start until Phase 4 completes (views require Providers)
- If not parallelizing, execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

```
Phase 1: Database Foundation
    |
    v
Phase 2: CRUD + Query Layer
    |
    v
Phase 3: Worker Bridge
    |
    +------------------+
    |                  |
    v                  v
Phase 4: Providers   Phase 6: ETL (parallel-capable)
    |
    v
Phase 5: D3 Views
    |
    v
[Web Runtime v1 ships when Phases 1-6 pass]
    |
    v
Phase 7: Native Platform Safety
    |
    v
[Native App v1 ships when Phase 7 passes]
```

## Delete Lifecycle

### Soft Delete (User-Facing)
- **Trigger:** User deletes a card via UI (Delete key, context menu, etc.)
- **Effect:** `deleted_at` timestamp set; card excluded from normal queries
- **Reversible:** Yes, via undelete (CARD-06) or undo (WKBR-07)
- **Connections:** Soft-deleted cards retain their connections (hidden but intact)
- **Retention:** Soft-deleted cards remain indefinitely until hard deleted

### Hard Delete (System/Maintenance)
- **Trigger:**
  - Explicit "Empty Trash" action by user
  - Automated cleanup after retention period (v2 feature, not in v1)
  - ETL re-import with `replace` mode (replaces entire source dataset)
- **Effect:** Row removed from `cards` table; `ON DELETE CASCADE` removes connections
- **Reversible:** No — not in undo stack, not recoverable
- **Undo interaction:** Hard delete clears any pending undo entries for that card

### Cascade Behavior
- Soft delete: Connections preserved (can be restored with card)
- Hard delete: `ON DELETE CASCADE` removes all connections where card is source or target
- `via_card_id` reference: Set to NULL on hard delete (does not cascade-delete the connection)

### v1 Scope
- Soft delete: Full support (CARD-04, CARD-06)
- Hard delete: Available via direct SQL or debug tools only
- "Empty Trash" UI: v2 feature
- Retention-based cleanup: v2 feature

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Foundation | 4/4 | Complete | 2026-02-28 |
| 2. CRUD + Query Layer | 5/5 | Complete | 2026-02-28 |
| 3. Worker Bridge | 0/TBD | Not started | - |
| 4. Providers + Mutation Safety | 0/TBD | Not started | - |
| 5. D3 Views + Search UI | 0/TBD | Not started | - |
| 6. ETL Importers | 0/TBD | Not started | - |
| 7. Native Platform Safety | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-27*
*Depth: standard (7 phases -- derived from requirement dependency graph)*
