# Requirements: Isometry v5.3 Dynamic Schema

**Defined:** 2026-03-10
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v5.3 Requirements

Requirements for v5.3 Dynamic Schema milestone. Each maps to roadmap phases.

### Bug Fixes

- [ ] **BUGF-01**: SVG text elements render without letter-spacing artifacts — CSS `letter-spacing: normal` reset scoped to SVG text contexts prevents inheritance from HTML containers
- [ ] **BUGF-02**: All SVG-containing views (chart blocks, histogram scrubbers) verified free of letter-spacing regression across Safari/Chrome/Firefox
- [ ] **BUGF-03**: deleted_at field handled as optional (null-safe) across all non-SQL code paths — no null dereference when accessing card.deleted_at
- [ ] **BUGF-04**: Existing soft-delete filtering (`deleted_at IS NULL`) continues to work correctly for active card queries

### Schema Introspection

- [ ] **SCHM-01**: SchemaProvider reads PRAGMA table_info(cards) at Worker init and parses column metadata (name, type, nullability, default, primary key) into typed ColumnInfo array
- [ ] **SCHM-02**: PRAGMA results included in Worker `ready` message payload so schema is available synchronously before StateManager.restore()
- [ ] **SCHM-03**: SchemaProvider classifies columns into LATCH families via heuristic (name patterns + SQLite type affinity): *_at → Time, name → Alphabet, folder/status/card_type/source → Category, priority/sort_order → Hierarchy
- [ ] **SCHM-04**: SchemaProvider exposes typed accessors: getFilterableColumns(), getAxisColumns(), getNumericColumns(), getFieldsByFamily(family), getLatchFamilies()
- [ ] **SCHM-05**: SchemaProvider follows existing Provider subscribe/notify pattern with queueMicrotask batching
- [ ] **SCHM-06**: Worker-side validation Set populated from PRAGMA at init before any handler processes requests — Worker and main thread have independent validation sets
- [ ] **SCHM-07**: Column names validated at introspection time — reject any name containing characters outside [a-zA-Z0-9_] (SQL injection prevention at source)

### Dynamic Integration

- [ ] **DYNM-01**: allowlist.ts ALLOWED_FILTER_FIELDS and ALLOWED_AXIS_FIELDS populated from SchemaProvider instead of frozen literals, with hardcoded fallback during bootstrap
- [ ] **DYNM-02**: allowlist.ts validate/assert functions preserve existing D-003 security boundary — same function signatures, different backing data
- [ ] **DYNM-03**: FilterField and AxisField TypeScript types adjusted to accept dynamic fields — keep literal unions for known fields, widen flow-through types (AxisMapping.field) to string with runtime validation
- [ ] **DYNM-04**: LATCH_FAMILIES in latch.ts sourced from SchemaProvider.getLatchFamilies() with fallback to current hardcoded mapping
- [ ] **DYNM-05**: PropertiesExplorer iterates SchemaProvider columns instead of importing ALLOWED_AXIS_FIELDS
- [ ] **DYNM-06**: ProjectionExplorer available-field pool sourced from SchemaProvider instead of ALLOWED_AXIS_FIELDS import
- [ ] **DYNM-07**: CalcExplorer NUMERIC_FIELDS derived from SchemaProvider.getNumericColumns() — numeric columns get SUM/AVG/MIN/MAX, text columns get COUNT only
- [ ] **DYNM-08**: CalcExplorer FIELD_DISPLAY_NAMES replaced with AliasProvider.getAlias() calls
- [ ] **DYNM-09**: LatchExplorers CATEGORY_FIELDS, HIERARCHY_FIELDS, TIME_FIELDS derived from SchemaProvider.getFieldsByFamily()
- [ ] **DYNM-10**: SuperGridQuery ALLOWED_TIME_FIELDS derived from SchemaProvider.getFieldsByFamily('T')
- [ ] **DYNM-11**: PAFVProvider VIEW_DEFAULTS use SchemaProvider-aware field selection for default axes
- [ ] **DYNM-12**: SuperDensityProvider displayField validation uses SchemaProvider instead of compile-time AxisField type
- [ ] **DYNM-13**: All 15 hardcoded field list locations verified replaced — zero remaining frozen field literals in source (excluding test fixtures)

### State Persistence

- [ ] **PRST-01**: StateManager.restore() includes field migration step — filters out unknown fields from persisted state before calling provider setState()
- [ ] **PRST-02**: FilterProvider.setState() gracefully degrades when encountering fields not in current schema — removes invalid filters instead of resetting all state
- [ ] **PRST-03**: PAFVProvider.setState() validates axis fields against SchemaProvider — removes invalid axes instead of crashing at render time
- [ ] **PRST-04**: AliasProvider handles dynamic fields — aliases for fields not in schema are preserved (not deleted) for future schema changes

### User Configuration

- [ ] **UCFG-01**: User can override LATCH family assignment for any column — override persisted in ui_state (Tier 2) and merged by SchemaProvider
- [ ] **UCFG-02**: User can toggle axis-enabled state for individual fields — disabled fields excluded from PropertiesExplorer and ProjectionExplorer available pools
- [ ] **UCFG-03**: LATCH family overrides are global (not per-view) and survive session restart via ui_state persistence
- [ ] **UCFG-04**: LatchExplorers reflect user LATCH family overrides — moving a field from Category to Time causes it to appear in Time section with histogram scrubber
- [ ] **UCFG-05**: SchemaProvider merges heuristic classification with user overrides — user overrides always win over heuristic

## Future Requirements

Deferred to v6+. Tracked but not in current roadmap.

### View Presets

- **VPRE-01**: User can save named axis+filter+sort configurations as presets
- **VPRE-02**: User can switch between saved presets to quickly reconfigure views

### Schema Extension

- **SEXT-01**: EAV table for arbitrary user-defined fields (D-008 deferred)
- **SEXT-02**: ALTER TABLE from UI for schema modification

### Advanced Configuration

- **ACFG-01**: Per-view LATCH mapping overrides (different classification per view context)
- **ACFG-02**: Custom column renderers based on semantic type
- **ACFG-03**: Connections table introspection via SchemaProvider

## Out of Scope

| Feature | Reason |
|---------|--------|
| EAV table for extra fields | D-008 explicitly defers — schema-on-read adds complexity |
| ALTER TABLE from UI | Schema is read-only, controlled by ETL imports |
| Per-view LATCH overrides | Global scope sufficient for v5.3 — per-view adds complexity for marginal value |
| Connections table introspection | Cards schema is the primary concern; connections schema is simpler and stable |
| Custom column renderers | Requires semantic type system — massive scope |
| View presets / saved configs | Named snapshots are significant scope; deferred to v6+ |
| HyperFormula formula engine | Permanently replaced by SQL DSL in v5.2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUGF-01 | — | Pending |
| BUGF-02 | — | Pending |
| BUGF-03 | — | Pending |
| BUGF-04 | — | Pending |
| SCHM-01 | — | Pending |
| SCHM-02 | — | Pending |
| SCHM-03 | — | Pending |
| SCHM-04 | — | Pending |
| SCHM-05 | — | Pending |
| SCHM-06 | — | Pending |
| SCHM-07 | — | Pending |
| DYNM-01 | — | Pending |
| DYNM-02 | — | Pending |
| DYNM-03 | — | Pending |
| DYNM-04 | — | Pending |
| DYNM-05 | — | Pending |
| DYNM-06 | — | Pending |
| DYNM-07 | — | Pending |
| DYNM-08 | — | Pending |
| DYNM-09 | — | Pending |
| DYNM-10 | — | Pending |
| DYNM-11 | — | Pending |
| DYNM-12 | — | Pending |
| DYNM-13 | — | Pending |
| PRST-01 | — | Pending |
| PRST-02 | — | Pending |
| PRST-03 | — | Pending |
| PRST-04 | — | Pending |
| UCFG-01 | — | Pending |
| UCFG-02 | — | Pending |
| UCFG-03 | — | Pending |
| UCFG-04 | — | Pending |
| UCFG-05 | — | Pending |

**Coverage:**
- v5.3 requirements: 33 total
- Mapped to phases: 0
- Unmapped: 33 ⚠️

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
