# Requirements: Isometry v5

**Defined:** 2026-02-27
**Last Updated:** 2026-02-27 (Codex review fixes applied)
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## Release Gates

This document covers **two separate release gates**:

| Release | Phases | Requirements | Can Ship When |
|---------|--------|--------------|---------------|
| **Web Runtime v1** | 1-6 | DB, SAFE, CARD, CONN, SRCH, PROV, WKBR, VIEW, ETL, PERF | All Phase 1-6 requirements pass |
| **Native App v1** | 7 | NSAFE | Web Runtime v1 + all NSAFE requirements pass |

The web runtime can ship independently. Native app requires the web runtime plus native shell implementation.

---

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Database Foundation (Phase 1)

- [x] **DB-01**: sql.js initializes successfully in dev, production, WKWebView, and Vitest; FTS5 capability verified with `SELECT * FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'`
- [x] **DB-02**: Canonical schema creates cards, connections, cards_fts, ui_state tables with all indexes
- [x] **DB-03**: FTS5 uses three separate sync triggers (insert, delete, update) to prevent index corruption
- [x] **DB-04**: FTS integrity-check passes after every mutation batch in tests
- [x] **DB-05**: Vite config correctly serves WASM with optimizeDeps exclude and ?url import
- [x] **DB-06**: PRAGMA foreign_keys = ON executes on every sql.js database open (prevents orphaned connections)

### SQL Safety (Phase 4)

- [ ] **SAFE-01**: FilterProvider validates fields against ALLOWED_FILTER_FIELDS allowlist
- [ ] **SAFE-02**: FilterProvider validates operators against ALLOWED_OPERATORS set
- [ ] **SAFE-03**: All dynamic query values use parameterized placeholders (?)
- [ ] **SAFE-04**: Unknown fields rejected — TypeScript union type enforces at compile time for literals; runtime validation throws for dynamic input
- [ ] **SAFE-05**: Unknown operators rejected — TypeScript union type enforces at compile time for literals; runtime validation throws for dynamic input
- [ ] **SAFE-06**: SQL injection test suite passes (injection strings in values, unknown field names)

### Card Operations (Phase 2)

- [ ] **CARD-01**: User can create a card with name and optional fields
- [ ] **CARD-02**: User can retrieve a card by ID
- [ ] **CARD-03**: User can update card fields (modified_at auto-updates)
- [ ] **CARD-04**: User can soft delete a card (deleted_at set, excluded from queries)
- [ ] **CARD-05**: User can list cards with filters (folder, status, card_type, source)
- [ ] **CARD-06**: User can undelete a soft-deleted card

### Connections (Phase 2)

- [ ] **CONN-01**: User can create a connection between two cards with a label
- [ ] **CONN-02**: User can retrieve outgoing, incoming, or bidirectional connections for a card
- [ ] **CONN-03**: User can create a connection with via_card_id for rich relationship context
- [ ] **CONN-04**: User can delete a connection
- [ ] **CONN-05**: Connections cascade-delete when referenced cards are hard-deleted

### Search (Phase 2 + Phase 5)

- [ ] **SRCH-01**: User can search cards by text query with BM25-ranked results
- [ ] **SRCH-02**: Search uses rowid joins (never id joins) per D-004
- [ ] **SRCH-03**: Search returns snippets with highlighted match context
- [ ] **SRCH-04**: Search completes in <100ms for 10K cards (see PERF test conditions)
- [ ] **SRCH-05**: Search input is debounced at 150ms
- [ ] **SRCH-06**: User can navigate search results with keyboard (arrow keys, Enter, Escape)
- [ ] **SRCH-07**: User can refine search with faceted chips (card_type, folder, status, source)

### Providers (Phase 4)

- [ ] **PROV-01**: FilterProvider compiles filters to parameterized SQL WHERE clauses
- [ ] **PROV-02**: AxisProvider compiles axis mappings to SQL ORDER BY/GROUP BY
- [ ] **PROV-03**: SelectionProvider holds selected card IDs in-memory only (Tier 3)
- [ ] **PROV-04**: DensityProvider controls row/column density settings (Tier 2)
- [ ] **PROV-05**: ViewProvider tracks current view type (Tier 2)
- [ ] **PROV-06**: Tier 2 state persists to ui_state table and restores on app launch
- [ ] **PROV-07**: Tier 3 state is never persisted to any storage

### Worker Bridge (Phase 3 + Phase 4)

- [ ] **WKBR-01**: WorkerBridge sends typed WorkerMessage with UUID correlation ID
- [ ] **WKBR-02**: Worker responds with WorkerResponse matching request correlation ID
- [ ] **WKBR-03**: Worker errors propagate to main thread with error code and message
- [ ] **WKBR-04**: All database operations execute in Web Worker (main thread never blocked)
- [ ] **WKBR-05**: MutationManager generates inverse SQL for every mutation (undo support) — per D-009 decision
- [ ] **WKBR-06**: MutationManager sets dirty flag on write and notifies subscribers
- [ ] **WKBR-07**: User can undo/redo mutations via command log (Cmd+Z / Cmd+Shift+Z)

### Views (Phase 5)

- [ ] **VIEW-01**: SuperGrid renders cards with nested dimensional headers via PAFV projection
- [ ] **VIEW-02**: List view renders cards sorted by a single axis
- [ ] **VIEW-03**: Grid view renders cards on two mapped axes
- [ ] **VIEW-04**: Kanban view renders cards grouped by category axis (status)
- [ ] **VIEW-05**: Calendar view renders cards on time axis (month view)
- [ ] **VIEW-06**: Timeline view renders cards on linear time axis
- [ ] **VIEW-07**: Gallery view renders cards as visual thumbnails
- [ ] **VIEW-08**: Network view renders cards as force-directed graph nodes
- [ ] **VIEW-09**: Tree view renders cards in hierarchy layout
- [ ] **VIEW-10**: Table view renders raw data in columns
- [ ] **VIEW-11**: All views use D3 data join with key function (d => d.id)
- [ ] **VIEW-12**: View transitions animate cards between projections (~300ms ease-in-out)
- [ ] **VIEW-13**: View render completes in <16ms for 100 visible cards (see PERF test conditions)

### ETL (Phase 6)

- [ ] **ETL-01**: Apple Notes importer maps notes to canonical cards
- [ ] **ETL-02**: Apple Notes importer extracts connections (mentions, links, contains)
- [ ] **ETL-03**: Import deduplication uses source + source_id uniqueness
- [ ] **ETL-04**: Re-import is idempotent (updates modified_at if newer, no duplicates)
- [ ] **ETL-05**: Batch imports execute in transactions (100 cards per batch)
- [ ] **ETL-06**: Import reports results (new, updated, skipped counts)

### Performance (Phase 2 + Phase 5)

**Test Conditions:**
- Hardware: MacBook Air M1, 16GB RAM
- Browser: Chrome 120+ or Safari 17+
- State: Warm (second run after initial load)
- Dataset: 10,000 cards, 50,000 connections, average content size 500 chars
- Metric: p95 latency (95th percentile of 100 runs)

- [ ] **PERF-01**: Card insert p95 <10ms (single card, existing db)
- [ ] **PERF-02**: Bulk insert p95 <1s (1000 cards, single transaction)
- [ ] **PERF-03**: FTS search p95 <100ms (10K cards, 3-word query)
- [ ] **PERF-04**: Graph traversal p95 <500ms (10K cards, 50K connections, depth 3)
- [ ] **PERF-05**: View render p95 <16ms (100 visible cards, SuperGrid)

### Native Platform Safety (Phase 7)

Requirements derived from `PITFALLS-NATIVE.md`.

> **Scope Note:** These requirements define acceptance criteria for the **native shell effort**
> (separate from the web runtime build). They are included here for completeness and to ensure
> the web runtime's `db.export()` contract is compatible with native persistence needs.
>
> **Phase 7 gates the Native App v1 release, not the Web Runtime v1 release.**

- [ ] **NSAFE-01**: CloudKit zone creation guard — `ensureZoneExists()` awaited before any sync operation; `serverRecordChanged` treated as success (N1)
- [ ] **NSAFE-02**: Change token expiration handling — `changeTokenExpired` clears stored token and triggers full sync, never retries with expired token (N2)
- [ ] **NSAFE-03**: CKRecord type coercion — all field reads handle Int/Int64 bridging, String/CKAsset promotion, and Date precision loss (N3)
- [ ] **NSAFE-04**: Actor reentrancy prevention — no database state assumptions held across `await` points; mutations use atomic transactions without suspension (N4)
- [ ] **NSAFE-05**: CloudKit rate limiting — exponential backoff using `CKErrorRetryAfterKey` from error userInfo; respects `requestRateLimited`, `zoneBusy`, `serviceUnavailable` (N5)
- [ ] **NSAFE-06**: WAL checkpoint management — explicit `PRAGMA wal_checkpoint(TRUNCATE)` on app background; all prepared statements finalized promptly (N6)
- [ ] **NSAFE-07**: Keychain `afterFirstUnlock` accessibility — credentials needed for background sync use `kSecAttrAccessibleAfterFirstUnlock`, not default `WhenUnlocked` (N7)
- [ ] **NSAFE-08**: CKAsset immediate copy — asset file contents copied to app storage immediately; temporary `fileURL` never stored for later use (N8)
- [ ] **NSAFE-09**: Push notification entitlements — Push Notifications capability, Remote notifications background mode, and CloudKit capability all enabled in Xcode (N9)
- [ ] **NSAFE-10**: Native SQLite PRAGMA foreign_keys = ON on every connection open; orphan constraint verified in tests (N10)

---

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Extended ETL
- **EETL-01**: Slack ETL importer
- **EETL-02**: Apple Reminders ETL importer
- **EETL-03**: Markdown with frontmatter ETL importer
- **EETL-04**: Excel/CSV ETL importer

### Schema Extensions
- **SEXT-01**: card_properties EAV table for schema-on-read extras (D-008)
- **SEXT-02**: Formula fields with DSL → AST → SQL pipeline

### Advanced Features
- **ADVF-01**: Semantic/vector search
- **ADVF-02**: Block-level editor (Notebook module)
- **ADVF-03**: Search history (recent + frequent queries)

---

## Out of Scope

Explicitly excluded from **both** v1 releases. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Parallel state store (Redux/MobX/Zustand) | D3 data join IS state management; duplicating SQLite data creates two sources of truth |
| Raw SQL from UI | Breaks allowlist safety model; FilterProvider is the interface |
| Persisting selection to SQLite | Selection is Tier 3 ephemeral by design (D-005) |
| OAuth tokens in SQLite | Keychain only for credentials (D-007) |
| Real-time collaboration | Requires CRDTs/OT; fundamentally changes local-first architecture |
| Fuzzy/typo-tolerant search | FTS5 doesn't support natively; porter stemmer handles morphological variants |
| Formula fields | Requires parser + AST + sandbox; SQL expressions cover 80% of grouping cases |
| Block-level editor | A product in itself; Markdown in content field is sufficient for v5 |

---

## Provider Naming Convention

Canonical provider names (no aliases):

| Provider | Purpose | Tier |
|----------|---------|------|
| `FilterProvider` | LATCH filter state → SQL WHERE | 2 |
| `AxisProvider` | PAFV axis→plane mapping → SQL ORDER BY/GROUP BY | 2 |
| `SelectionProvider` | Selected card IDs | 3 |
| `DensityProvider` | Row/column density settings | 2 |
| `ViewProvider` | Current view type | 2 |

> **Note:** There is no `PAFVProvider`. Axis mapping is handled by `AxisProvider`.

---

## View Taxonomy

Canonical view types (nine total):

| View | Type | D3 Layout | Primary Axis |
|------|------|-----------|--------------|
| `list` | LATCH | None (DOM) | Single axis sort |
| `grid` | LATCH | None (CSS Grid) | Two axes |
| `kanban` | LATCH | None (CSS Grid) | Category (status) |
| `calendar` | LATCH | None (CSS Grid) | Time (month) |
| `timeline` | LATCH | d3.timeline | Time (linear) |
| `gallery` | LATCH | CSS Grid | Visual thumbnails |
| `network` | GRAPH | d3.forceSimulation | Force-directed |
| `tree` | GRAPH | d3.tree / d3.cluster | Hierarchy |
| `table` | Raw | None (DOM table) | All columns |

> **Note:** `network` and `tree` are distinct views with different layout algorithms.

---

## Traceability

| Requirement | Phase | Release Gate | Status |
|-------------|-------|--------------|--------|
| DB-01..06 | 1 | Web Runtime v1 | Pending |
| CARD-01..06 | 2 | Web Runtime v1 | Pending |
| CONN-01..05 | 2 | Web Runtime v1 | Pending |
| SRCH-01..04 | 2 | Web Runtime v1 | Pending |
| PERF-01..04 | 2 | Web Runtime v1 | Pending |
| WKBR-01..04 | 3 | Web Runtime v1 | Pending |
| SAFE-01..06 | 4 | Web Runtime v1 | Pending |
| PROV-01..07 | 4 | Web Runtime v1 | Pending |
| WKBR-05..07 | 4 | Web Runtime v1 | Pending |
| VIEW-01..13 | 5 | Web Runtime v1 | Pending |
| SRCH-05..07 | 5 | Web Runtime v1 | Pending |
| PERF-05 | 5 | Web Runtime v1 | Pending |
| ETL-01..06 | 6 | Web Runtime v1 | Pending |
| NSAFE-01..10 | 7 | Native App v1 | Pending |

**Coverage:**
- Web Runtime v1: 68 requirements (Phases 1-6)
- Native App v1: 10 additional requirements (Phase 7)
- Total v1: 78 requirements
- Unmapped: 0 ✓

---

## Decision Cross-References

Requirements that implement specific architectural decisions:

| Requirement | Decision | Status |
|-------------|----------|--------|
| WKBR-05 | D-009 (Command log undo) | Decided ✓ |
| SRCH-02 | D-004 (FTS rowid joins) | Decided ✓ |
| PROV-03, PROV-07 | D-005 (Selection is Tier 3) | Decided ✓ |
| NSAFE-07 | D-007 (Keychain only) | Decided ✓ |
| DB-03 | PITFALLS.md P4 (Three triggers) | Documented ✓ |

---

*Requirements defined: 2026-02-27*
*Codex review fixes applied: 2026-02-27*
