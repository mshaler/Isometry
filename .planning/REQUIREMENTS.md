# Requirements: Isometry v5

**Defined:** 2026-02-27
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Database Foundation

- [ ] **DB-01**: sql.js initializes with custom FTS5 WASM build in dev, production, WKWebView, and Vitest
- [ ] **DB-02**: Canonical schema creates cards, connections, cards_fts, ui_state tables with all indexes
- [ ] **DB-03**: FTS5 uses three separate sync triggers (insert, delete, update) to prevent index corruption
- [ ] **DB-04**: FTS integrity-check passes after every mutation batch in tests
- [ ] **DB-05**: Vite config correctly serves WASM with optimizeDeps exclude and ?url import

### SQL Safety

- [ ] **SAFE-01**: FilterProvider validates fields against ALLOWED_FILTER_FIELDS allowlist
- [ ] **SAFE-02**: FilterProvider validates operators against ALLOWED_OPERATORS set
- [ ] **SAFE-03**: All dynamic query values use parameterized placeholders (?)
- [ ] **SAFE-04**: Unknown fields throw at compile time
- [ ] **SAFE-05**: Unknown operators throw at compile time
- [ ] **SAFE-06**: SQL injection test suite passes (injection strings in values, unknown field names)

### Card Operations

- [ ] **CARD-01**: User can create a card with name and optional fields
- [ ] **CARD-02**: User can retrieve a card by ID
- [ ] **CARD-03**: User can update card fields (modified_at auto-updates)
- [ ] **CARD-04**: User can soft delete a card (deleted_at set, excluded from queries)
- [ ] **CARD-05**: User can list cards with filters (folder, status, card_type, source)
- [ ] **CARD-06**: User can undelete a soft-deleted card

### Connections

- [ ] **CONN-01**: User can create a connection between two cards with a label
- [ ] **CONN-02**: User can retrieve outgoing, incoming, or bidirectional connections for a card
- [ ] **CONN-03**: User can create a connection with via_card_id for rich relationship context
- [ ] **CONN-04**: User can delete a connection
- [ ] **CONN-05**: Connections cascade-delete when referenced cards are hard-deleted

### Search

- [ ] **SRCH-01**: User can search cards by text query with BM25-ranked results
- [ ] **SRCH-02**: Search uses rowid joins (never id joins) per D-004
- [ ] **SRCH-03**: Search returns snippets with highlighted match context
- [ ] **SRCH-04**: Search completes in <100ms for 10K cards
- [ ] **SRCH-05**: Search input is debounced at 150ms
- [ ] **SRCH-06**: User can navigate search results with keyboard (arrow keys, Enter, Escape)
- [ ] **SRCH-07**: User can refine search with faceted chips (card_type, folder, status, source)

### Providers

- [ ] **PROV-01**: FilterProvider compiles filters to parameterized SQL WHERE clauses
- [ ] **PROV-02**: AxisProvider compiles axis mappings to SQL ORDER BY/GROUP BY
- [ ] **PROV-03**: SelectionProvider holds selected card IDs in-memory only (Tier 3)
- [ ] **PROV-04**: DensityProvider controls row/column density settings (Tier 2)
- [ ] **PROV-05**: ViewProvider tracks current view type (Tier 2)
- [ ] **PROV-06**: Tier 2 state persists to ui_state table and restores on app launch
- [ ] **PROV-07**: Tier 3 state is never persisted to any storage

### Worker Bridge

- [ ] **WKBR-01**: WorkerBridge sends typed WorkerMessage with UUID correlation ID
- [ ] **WKBR-02**: Worker responds with WorkerResponse matching request correlation ID
- [ ] **WKBR-03**: Worker errors propagate to main thread with error code and message
- [ ] **WKBR-04**: All database operations execute in Web Worker (main thread never blocked)
- [ ] **WKBR-05**: MutationManager generates inverse SQL for every mutation (undo support)
- [ ] **WKBR-06**: MutationManager sets dirty flag on write and notifies subscribers
- [ ] **WKBR-07**: User can undo/redo mutations via command log (Cmd+Z / Cmd+Shift+Z)

### Views

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
- [ ] **VIEW-13**: View render completes in <16ms for 100 visible cards

### ETL

- [ ] **ETL-01**: Apple Notes importer maps notes to canonical cards
- [ ] **ETL-02**: Apple Notes importer extracts connections (mentions, links, contains)
- [ ] **ETL-03**: Import deduplication uses source + source_id uniqueness
- [ ] **ETL-04**: Re-import is idempotent (updates modified_at if newer, no duplicates)
- [ ] **ETL-05**: Batch imports execute in transactions (100 cards per batch)
- [ ] **ETL-06**: Import reports results (new, updated, skipped counts)

### Performance

- [ ] **PERF-01**: Card insert completes in <10ms
- [ ] **PERF-02**: Bulk insert of 1000 cards completes in <1s
- [ ] **PERF-03**: FTS search completes in <100ms for 10K cards
- [ ] **PERF-04**: Graph traversal (depth 3) completes in <500ms for 10K cards + 50K connections
- [ ] **PERF-05**: View render completes in <16ms for 100 visible cards

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

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native Swift shell implementation | Separate effort, not part of web runtime build |
| CloudKit sync implementation | Native shell concern; web runtime provides db.export() |
| Parallel state store (Redux/MobX/Zustand) | D3 data join IS state management; duplicating SQLite data creates two sources of truth |
| Raw SQL from UI | Breaks allowlist safety model; FilterProvider is the interface |
| Persisting selection to SQLite | Selection is Tier 3 ephemeral by design (D-005) |
| OAuth tokens in SQLite | Keychain only for credentials (D-007) |
| Real-time collaboration | Requires CRDTs/OT; fundamentally changes local-first architecture |
| Fuzzy/typo-tolerant search | FTS5 doesn't support natively; porter stemmer handles morphological variants |
| Formula fields | Requires parser + AST + sandbox; SQL expressions cover 80% of grouping cases |
| Block-level editor | A product in itself; Markdown in content field is sufficient for v5 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| DB-05 | Phase 1 | Pending |
| SAFE-01 | Phase 4 | Pending |
| SAFE-02 | Phase 4 | Pending |
| SAFE-03 | Phase 4 | Pending |
| SAFE-04 | Phase 4 | Pending |
| SAFE-05 | Phase 4 | Pending |
| SAFE-06 | Phase 4 | Pending |
| CARD-01 | Phase 2 | Pending |
| CARD-02 | Phase 2 | Pending |
| CARD-03 | Phase 2 | Pending |
| CARD-04 | Phase 2 | Pending |
| CARD-05 | Phase 2 | Pending |
| CARD-06 | Phase 2 | Pending |
| CONN-01 | Phase 2 | Pending |
| CONN-02 | Phase 2 | Pending |
| CONN-03 | Phase 2 | Pending |
| CONN-04 | Phase 2 | Pending |
| CONN-05 | Phase 2 | Pending |
| SRCH-01 | Phase 2 | Pending |
| SRCH-02 | Phase 2 | Pending |
| SRCH-03 | Phase 2 | Pending |
| SRCH-04 | Phase 2 | Pending |
| SRCH-05 | Phase 5 | Pending |
| SRCH-06 | Phase 5 | Pending |
| SRCH-07 | Phase 5 | Pending |
| PROV-01 | Phase 4 | Pending |
| PROV-02 | Phase 4 | Pending |
| PROV-03 | Phase 4 | Pending |
| PROV-04 | Phase 4 | Pending |
| PROV-05 | Phase 4 | Pending |
| PROV-06 | Phase 4 | Pending |
| PROV-07 | Phase 4 | Pending |
| WKBR-01 | Phase 3 | Pending |
| WKBR-02 | Phase 3 | Pending |
| WKBR-03 | Phase 3 | Pending |
| WKBR-04 | Phase 3 | Pending |
| WKBR-05 | Phase 4 | Pending |
| WKBR-06 | Phase 4 | Pending |
| WKBR-07 | Phase 4 | Pending |
| VIEW-01 | Phase 5 | Pending |
| VIEW-02 | Phase 5 | Pending |
| VIEW-03 | Phase 5 | Pending |
| VIEW-04 | Phase 5 | Pending |
| VIEW-05 | Phase 5 | Pending |
| VIEW-06 | Phase 5 | Pending |
| VIEW-07 | Phase 5 | Pending |
| VIEW-08 | Phase 5 | Pending |
| VIEW-09 | Phase 5 | Pending |
| VIEW-10 | Phase 5 | Pending |
| VIEW-11 | Phase 5 | Pending |
| VIEW-12 | Phase 5 | Pending |
| VIEW-13 | Phase 5 | Pending |
| ETL-01 | Phase 6 | Pending |
| ETL-02 | Phase 6 | Pending |
| ETL-03 | Phase 6 | Pending |
| ETL-04 | Phase 6 | Pending |
| ETL-05 | Phase 6 | Pending |
| ETL-06 | Phase 6 | Pending |
| PERF-01 | Phase 2 | Pending |
| PERF-02 | Phase 2 | Pending |
| PERF-03 | Phase 2 | Pending |
| PERF-04 | Phase 2 | Pending |
| PERF-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 56 total
- Mapped to phases: 56
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after initial definition*
