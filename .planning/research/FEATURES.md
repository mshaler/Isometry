# Feature Landscape: v5.3 Dynamic Schema

**Domain:** Schema introspection, dynamic allowlists, configurable LATCH mappings, user display preferences, bug fixes
**Researched:** 2026-03-10
**Confidence:** HIGH -- patterns well-established from Metabase (semantic type mapping + auto-discovery), Airtable (user-configurable field types + display names), SQLite PRAGMA documentation (table_info introspection), and existing Isometry codebase (15 hardcoded field lists identified)

**Comparable products studied:** Metabase (automatic schema discovery + semantic type mapping), Airtable (configurable field types + user display preferences), Notion (database property configuration), DBeaver/DataGrip (live schema introspection), Excel Power Pivot (field type detection + measure/dimension classification), Tableau (auto-detection of dimensions vs measures with user override)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

### 1. SVG Letter-Spacing Bug Fix

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| SVG text elements render correctly in all browsers | Letter-spacing on SVG text causes rendering artifacts in Safari/WebKit (WKWebView). Existing `letter-spacing: 0.05em` on inline SuperGrid styles affects SVG text elements in chart blocks and histogram scrubbers | **Low** | SuperGrid.ts inline styles, CSS files | Remove or scope `letter-spacing` to HTML-only contexts. SVG `<text>` does not support CSS `letter-spacing` reliably across browsers |
| No visual regression in existing views | Fix must not alter appearance of HTML elements that correctly use letter-spacing | **Low** | Targeted selector scoping | Audit all `letter-spacing` usages (found in 6 files: SuperGrid.ts, projection-explorer.css, latch-explorers.css, help-overlay.css, command-palette.css, audit.css). SVG contexts need `letter-spacing: normal` override or scoped selectors |

**Implementation insight:** The fix is surgical. The `letter-spacing` in SuperGrid.ts line 2852 is an inline style on a section header (HTML `div`), not SVG. The CSS files apply `letter-spacing` to HTML elements. The bug likely manifests when D3 chart blocks or histogram scrubbers render SVG `<text>` elements that inherit `letter-spacing` from a parent HTML container. Fix: add `svg text { letter-spacing: normal; }` reset, or scope the property to `.sg-*` HTML selectors only.

**Existing code touchpoints:**
- `SuperGrid.ts` -- inline style on section header (HTML, not SVG -- verify no SVG inheritance path)
- `src/styles/*.css` -- 5 CSS files with `letter-spacing` declarations
- `src/ui/HistogramScrubber.ts` -- verify SVG `<text>` tick labels not inheriting
- `src/ui/charts/*.ts` -- verify chart SVG elements not inheriting

### 2. deleted_at Optional Handling

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| ETL and query paths handle NULL deleted_at gracefully | `deleted_at` is declared as `TEXT` (nullable) in schema.sql. Some code paths may treat it as always-present or fail when it is NULL | **Low** | ETL types.ts, query paths, FilterProvider compile() | Verify `deleted_at: string \| null` type annotation in etl/types.ts is honored throughout |
| Soft-delete filtering never errors on NULL | `WHERE deleted_at IS NULL` is the base clause in FilterProvider.compile(). Must work when column has no value (it does -- this IS the expected state for active cards) | **Trivial** | Already correct in FilterProvider | Verify no code path does string comparison on deleted_at without null guard |

**Implementation insight:** The `deleted_at` field is typed as `string | null` in `etl/types.ts` (line 87). The FilterProvider.compile() always starts with `deleted_at IS NULL` (correct SQL for NULL comparison). The bug is likely in a downstream consumer that treats `deleted_at` as a required string (e.g., doing `card.deleted_at.includes(...)` without null guard). Audit all usages of `deleted_at` outside of SQL WHERE clauses.

**Existing code touchpoints:**
- `src/etl/types.ts` -- CanonicalCard type definition
- `src/database/queries/cards.ts` -- soft-delete and restore operations
- `src/mutations/inverses.ts` -- undo/redo inverse generation

### 3. SchemaProvider with PRAGMA table_info Introspection

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Runtime schema discovery at startup | Every professional data tool (Metabase, DBeaver, Tableau, Power BI) discovers columns from the database rather than hardcoding them. The database IS the truth -- column lists should come FROM the database | **Medium** | WorkerBridge, sql.js PRAGMA support, new SchemaProvider class | `PRAGMA table_info('cards')` returns: cid, name, type, notnull, dflt_value, pk. sql.js supports PRAGMA via `db.exec()` |
| Column metadata includes type, nullability, default | Type information enables smart defaults: numeric fields get SUM/AVG, text fields get COUNT. Nullability determines filter options (IS NULL available only for nullable columns). Default values inform empty state display | **Low** | PRAGMA result parsing | Single query returns all metadata. Parse into `ColumnInfo[]` array |
| Schema cached after initial query | PRAGMA is fast but should run once at startup, not per-render. Schema is stable within a session (no ALTER TABLE in Isometry) | **Low** | In-memory cache pattern | SchemaProvider stores `Map<string, ColumnInfo>` populated once during Worker init or first query |
| Schema exposed via subscribe pattern | Downstream consumers (allowlist, PropertiesExplorer, CalcExplorer, LatchExplorers) subscribe to schema changes. In practice this fires once at startup, but the pattern enables future schema evolution | **Low** | Existing provider subscribe/notify pattern | Same queueMicrotask batching as FilterProvider, PAFVProvider |

**Implementation insight:** SQLite's `PRAGMA table_info('cards')` returns columns in schema order. For sql.js, this is executed via `db.exec("PRAGMA table_info('cards')")` which returns `[{columns: ['cid','name','type','notnull','dflt_value','pk'], values: [...]}]`. The SchemaProvider should:
1. Run PRAGMA once (in Worker, via new `schema:introspect` message type or during `wasm-init`)
2. Parse results into `ColumnInfo[]` with fields: `{ name: string, type: string, notnull: boolean, defaultValue: string | null, isPrimaryKey: boolean }`
3. Classify each column by LATCH family using heuristics (time fields by name pattern, numeric by SQLite type affinity, etc.)
4. Expose via `getColumns()`, `getFilterableColumns()`, `getAxisColumns()` accessors

**Existing code touchpoints:**
- New `src/providers/SchemaProvider.ts` -- core class
- `src/worker/worker.ts` -- add `schema:introspect` handler or extend `wasm-init`
- `src/worker/handlers/` -- new handler if separate message type

### 4. Replace Hardcoded Field Lists with Dynamic Schema

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| ALLOWED_FILTER_FIELDS sourced from SchemaProvider | Currently 16 fields hardcoded in `allowlist.ts`. If schema changes (column added/renamed), the allowlist is silently stale. Metabase auto-discovers all columns. Tableau auto-detects dimensions vs measures | **Medium** | SchemaProvider, allowlist.ts refactor | The allowlist must still EXIST for SQL safety (D-003), but it should be POPULATED from SchemaProvider rather than from a frozen literal. This preserves the security boundary while making it dynamic |
| ALLOWED_AXIS_FIELDS sourced from SchemaProvider | Currently 9 fields hardcoded. Same staleness risk. Not all columns should be axes -- need classification heuristic | **Medium** | SchemaProvider, type classification | Axis eligibility heuristic: exclude `id`, `content`, `summary`, `url`, `mime_type`, `source_id`, `source_url`, `deleted_at`, `is_collective`, `tags`. Include fields useful for GROUP BY/ORDER BY |
| FilterField and AxisField types become dynamic | Currently compile-time union types in `types.ts`. Must work with runtime strings validated against the dynamic allowlist | **Medium** | TypeScript type system adjustment | Change from literal union to branded string type or keep union as "known fields" with runtime string acceptance. The allowlist validation functions already accept `string` and narrow via assertion |
| LATCH_FAMILIES mapping sourced from SchemaProvider | Currently 9 fields mapped to L/A/T/C/H in `latch.ts`. New columns need classification. Heuristic: `*_at` fields -> Time, `latitude`/`longitude`/`location_*` -> Location, `name` -> Alphabet, `*_type`/`folder`/`status`/`source` -> Category, `priority`/`sort_order`/numeric -> Hierarchy | **Medium** | SchemaProvider, classification heuristic | Classification can be automatic (heuristic) with user override (Phase D feature). Heuristic covers the 25 known columns. Unknown columns default to Category |
| NUMERIC_FIELDS in CalcExplorer sourced from SchemaProvider | Currently `new Set(['priority', 'sort_order'])` hardcoded. Should use SQLite type affinity: INTEGER and REAL columns are numeric | **Low** | SchemaProvider.getNumericColumns() | SQLite type affinities: `INTEGER` -> numeric, `REAL` -> numeric, `TEXT` -> text, `BLOB` -> binary. CalcExplorer uses this for SUM/AVG eligibility |
| FIELD_DISPLAY_NAMES in CalcExplorer sourced from AliasProvider | Currently 9 field display names hardcoded. AliasProvider already manages display aliases. CalcExplorer should read from AliasProvider instead of maintaining its own map | **Low** | AliasProvider integration | Replace `FIELD_DISPLAY_NAMES` constant with `aliasProvider.getAlias(field)` calls |
| CATEGORY_FIELDS, HIERARCHY_FIELDS, TIME_FIELDS in LatchExplorers sourced dynamically | Currently 3 hardcoded arrays (lines 50-52). Should derive from SchemaProvider's LATCH classification | **Low** | SchemaProvider.getFieldsByFamily() | LatchExplorers already iterates these arrays. Replace literals with SchemaProvider accessor |

**Full inventory of hardcoded field lists to replace (15 locations):**

| File | Constant/Pattern | Current Content | Dynamic Source |
|------|-----------------|----------------|----------------|
| `providers/types.ts` | `FilterField` union type | 16 literal members | SchemaProvider.getFilterableColumns() |
| `providers/types.ts` | `AxisField` union type | 9 literal members | SchemaProvider.getAxisColumns() |
| `providers/allowlist.ts` | `ALLOWED_FILTER_FIELDS` | 16-member frozen Set | SchemaProvider.getFilterableColumns() |
| `providers/allowlist.ts` | `ALLOWED_AXIS_FIELDS` | 9-member frozen Set | SchemaProvider.getAxisColumns() |
| `providers/latch.ts` | `LATCH_FAMILIES` | 9-entry Record | SchemaProvider.getLatchFamilies() |
| `ui/PropertiesExplorer.ts` | imports ALLOWED_AXIS_FIELDS | iterates 9 fields | SchemaProvider subscription |
| `ui/ProjectionExplorer.ts` | imports ALLOWED_AXIS_FIELDS | iterates for available pool | SchemaProvider subscription |
| `ui/CalcExplorer.ts` | `NUMERIC_FIELDS` | Set(['priority','sort_order']) | SchemaProvider.getNumericColumns() |
| `ui/CalcExplorer.ts` | `FIELD_DISPLAY_NAMES` | 9-entry Record | AliasProvider.getAlias() |
| `ui/LatchExplorers.ts` | `CATEGORY_FIELDS` | ['folder','status','card_type'] | SchemaProvider.getFieldsByFamily('C') |
| `ui/LatchExplorers.ts` | `HIERARCHY_FIELDS` | ['priority','sort_order'] | SchemaProvider.getFieldsByFamily('H') |
| `ui/LatchExplorers.ts` | `TIME_FIELDS` | ['created_at','modified_at','due_at'] | SchemaProvider.getFieldsByFamily('T') |
| `views/supergrid/SuperGridQuery.ts` | `ALLOWED_TIME_FIELDS` | Set(['created_at','modified_at','due_at']) | SchemaProvider.getFieldsByFamily('T') |
| `providers/PAFVProvider.ts` | `VIEW_DEFAULTS` axis fields | 'card_type', 'folder' literals | SchemaProvider-aware defaults |
| `providers/SuperDensityProvider.ts` | `displayField` | references AxisField | SchemaProvider validation |

**Implementation insight:** The refactor must preserve SQL safety (D-003). The approach is NOT to remove allowlists, but to populate them dynamically. The sequence:
1. SchemaProvider runs PRAGMA at startup
2. SchemaProvider exposes classified column sets
3. `allowlist.ts` functions read from SchemaProvider instead of frozen literals
4. TypeScript types stay as branded strings (compile-time safety for known fields, runtime validation for dynamic fields)
5. All downstream consumers (PropertiesExplorer, ProjectionExplorer, CalcExplorer, LatchExplorers) subscribe to SchemaProvider

### 5. User-Configurable LATCH Mappings

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| User can reassign a field's LATCH family | Metabase: users override automatic semantic type detection. Airtable: users configure field types. The heuristic may misclassify -- user override is essential | **Medium** | SchemaProvider, ui_state persistence, LatchExplorers rebuild | Store overrides in ui_state as `latch:overrides` key. SchemaProvider merges heuristic + overrides |
| User can add/remove fields from filter list | Not all 25 columns are useful for filtering. Users should control which fields appear in filter UI. Airtable: "hide field" toggle per view | **Low** | PropertiesExplorer toggle already exists | PropertiesExplorer's `_enabledFields` Set already controls axis availability. Extend to filter field visibility |
| User can configure sort field options | Which fields appear in sort menus should be configurable. Currently all 9 axis fields are sort-eligible. With dynamic schema, more fields become available | **Low** | SchemaProvider + PropertiesExplorer enabled set | Sort eligibility = axis eligibility, already controlled by PropertiesExplorer toggles |
| User can set default sort for a view | Power users want to set their preferred sort order that persists across sessions. Currently defaults to PAFVProvider VIEW_DEFAULTS | **Low** | PAFVProvider setState, ui_state persistence | Already possible via PAFVProvider Tier 2 persistence. This is about adding a UI affordance (button/menu) to set defaults explicitly |

**Implementation insight:** Metabase's approach is instructive: automatic detection with manual override. When Metabase syncs a database, it automatically assigns semantic types based on column names and data types. Admins can then override these in the Table Metadata editor. Isometry should follow this pattern:
1. SchemaProvider heuristic auto-classifies columns into LATCH families
2. User overrides stored in ui_state (Tier 2 persistence)
3. SchemaProvider merges: `heuristic classification + user overrides = effective classification`
4. LatchExplorers, PropertiesExplorer, ProjectionExplorer all read effective classification

### 6. User Display Preferences

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Display name per field (already exists via AliasProvider) | Renaming `created_at` to "Date Created" for display. Already implemented in v5.0 via AliasProvider + PropertiesExplorer inline rename | **Already shipped** | AliasProvider (v5.0) | No new work. Verify AliasProvider is wired to all new dynamic consumers |
| Default display field preference | Which field shows in SuperGrid cells when in spreadsheet mode. Currently `name` field. User should be able to pick a different field | **Low** | SuperDensityProvider.displayField (already exists) | `displayField` on SuperDensityState already exists (Phase 55 PROJ-05). May need UI to set it |
| Column order preference in SuperGrid | User drags to reorder columns in SuperGrid. Already implemented via PAFVProvider axis reorder (v3.1) | **Already shipped** | PAFVProvider.reorderColAxes() (v3.1) | No new work |
| Saved view configurations | Save the current axis + filter + sort configuration as a named "view preset". Airtable calls these "Views", Notion calls them "Database Views" | **High** | New ViewPresetProvider, ui_state persistence, UI for preset management | Defer to future milestone -- significant scope beyond v5.3 |

**Implementation insight:** Most display preferences are already shipped. The v5.3 contribution is making them work with dynamic (not hardcoded) field lists. The key gap is ensuring AliasProvider, PropertiesExplorer, and ProjectionExplorer all read from SchemaProvider rather than ALLOWED_AXIS_FIELDS. When SchemaProvider reports more columns (e.g., `event_start`, `event_end`, `location_name`), the UIs should automatically show them.

---

## Differentiators

Features that set the product apart. Not expected by users, but valued when present.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Automatic LATCH classification heuristic** | No other local-first tool auto-classifies columns into Location/Alphabet/Time/Category/Hierarchy. Metabase has semantic types but not LATCH. This IS the Isometry differentiator | **Medium** | SchemaProvider, classification rules | Heuristic rules: `*_at` -> Time, `lat*/long*/location*` -> Location, `name` -> Alphabet, `*_type/folder/status` -> Category, numeric -> Hierarchy. Novel UX |
| **Schema-driven CalcExplorer** | Aggregate function options auto-adapt to column types. Numeric columns get SUM/AVG/MIN/MAX/COUNT. Text columns get COUNT only. No manual configuration needed | **Low** | SchemaProvider type affinity | Existing CalcExplorer already distinguishes NUMERIC_FIELDS. Making this dynamic is a small win with large perceived intelligence |
| **Field catalog with LATCH grouping** | PropertiesExplorer already groups fields by LATCH family. With dynamic schema, this becomes a true data dictionary that self-organizes by information architecture principle | **Low** | SchemaProvider + existing PropertiesExplorer | The LATCH grouping in PropertiesExplorer is already implemented. Dynamic schema makes it feel like "the app understands my data" |
| **Allowlist self-healing** | If a schema migration adds a column, the allowlist auto-extends. No code change needed. The app just works with new columns | **Medium** | SchemaProvider populating allowlists | This eliminates an entire class of "forgot to update the allowlist" bugs. Security boundary preserved (only columns that exist in the database can be used in SQL) |

---

## Anti-Features

Features to explicitly NOT build in v5.3.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **ALTER TABLE from UI** | Users should not add/remove/rename columns in the database. Schema is defined by ETL import sources. Allowing schema modification creates migration, sync, and data integrity nightmares | Schema is read-only from the app's perspective. New fields come from ETL imports that create columns. PRAGMA introspection is read-only |
| **EAV (Entity-Attribute-Value) table** | D-008 explicitly defers schema-on-read extras. EAV adds complexity (sparse queries, no type safety, JOIN overhead) for marginal flexibility gain | Fixed schema with PRAGMA introspection. Extra fields from ETL are dropped (per D-008). Future EAV if v6 needs it |
| **Custom column types** | Airtable-style "this field is a Phone Number" semantic typing. Requires type-specific renderers, validators, formatters. Massive scope | Use SQLite type affinity (INTEGER, REAL, TEXT) for numeric/text classification. LATCH family provides semantic grouping. No per-field custom renderers |
| **Dynamic SQL generation for unknown tables** | SchemaProvider should only introspect `cards` table. Supporting arbitrary tables would require query builder changes, new security model, multi-table JOIN support | `PRAGMA table_info('cards')` only. Single-table model per D-001. Connections table has fixed schema |
| **Runtime schema migration** | Detecting schema differences and running ALTER TABLE. Complex, risky, and unnecessary when ETL controls schema | SchemaProvider is read-only. If PRAGMA returns unexpected columns, include them. If expected columns are missing, use defaults |
| **View presets / saved configurations** | Named view configurations ("My Pivot", "Sales Dashboard") that save axis + filter + sort + display state. Airtable's core feature. Significant scope: preset CRUD, preset selector UI, preset persistence, preset sharing | Defer to future milestone. Current Tier 2 persistence saves ONE configuration per view type. Multiple presets is a v6 feature |
| **Drag-reorder LATCH families** | Rearranging the L-A-T-C-H column order in PropertiesExplorer. Adds interaction complexity for near-zero value -- the LATCH order is a conceptual framework, not a user preference | Fixed LATCH_ORDER: L, A, T, C, H. Users can collapse families they do not use |
| **Per-row field type override** | Different cards having different field types (this card's priority is a number, that card's priority is a label). This is EAV with extra steps | Uniform column types per SQLite schema. All cards share the same schema |

---

## Feature Dependencies

```
Phase A: Bug Fixes (independent, no dependencies)
  SVG letter-spacing fix -> audit 6 files, add SVG text reset
  deleted_at optional handling -> audit null guards in query/ETL paths

Phase B: SchemaProvider Foundation (depends on Worker infrastructure)
  wasm-init or schema:introspect Worker handler [new] -> PRAGMA table_info('cards')
  SchemaProvider class [new] -> parse PRAGMA results, classify columns
  SchemaProvider subscribe pattern [new] -> notify downstream consumers

Phase C: Dynamic Schema Integration (depends on Phase B)
  SchemaProvider [Phase B] -> allowlist.ts dynamic population
  SchemaProvider [Phase B] -> types.ts FilterField/AxisField adjustment
  SchemaProvider [Phase B] -> latch.ts LATCH_FAMILIES dynamic mapping
  SchemaProvider [Phase B] -> PropertiesExplorer dynamic field list
  SchemaProvider [Phase B] -> ProjectionExplorer available field pool
  SchemaProvider [Phase B] -> CalcExplorer numeric field detection
  SchemaProvider [Phase B] -> CalcExplorer display names from AliasProvider
  SchemaProvider [Phase B] -> LatchExplorers dynamic field arrays
  SchemaProvider [Phase B] -> SuperGridQuery time field detection
  SchemaProvider [Phase B] -> PAFVProvider default axis validation

Phase D: User Configuration (depends on Phase C)
  SchemaProvider [Phase C] -> LATCH family overrides in ui_state
  PropertiesExplorer [existing] -> field visibility toggles (already works)
  AliasProvider [existing] -> display names (already works)
  SuperDensityProvider [existing] -> display field preference
  PAFVProvider [existing] -> default sort persistence
```

**Critical dependency chain:**
1. **Bug fixes (Phase A) are fully independent** -- can ship first or in parallel
2. **SchemaProvider (Phase B) MUST ship before dynamic integration (Phase C)** -- all Phase C work depends on SchemaProvider being available
3. **Dynamic integration (Phase C) is the bulk of the work** -- 15 file touchpoints, each a small refactor
4. **User configuration (Phase D) depends on Phase C** -- LATCH overrides need the dynamic classification to exist before overrides make sense
5. **AliasProvider and PropertiesExplorer toggle state already provide display preference infrastructure** -- Phase D is extending existing patterns, not building new ones

---

## MVP Recommendation

### Phase A: Immediate Bug Fixes
Priority: **Highest** -- bugs block user confidence and should ship first.

1. SVG letter-spacing fix (audit 6 files, add SVG text reset rule)
2. deleted_at optional handling (audit null guards, fix any unsafe string operations on nullable field)

### Phase B: SchemaProvider Foundation
Priority: **High** -- enables all subsequent dynamic schema work.

3. PRAGMA table_info Worker handler (execute at startup, return column metadata)
4. SchemaProvider class (parse PRAGMA, classify by LATCH family, expose typed accessors)
5. SchemaProvider subscribe pattern (notify on schema load)
6. Column classification heuristic (auto-assign LATCH family based on name and type patterns)

### Phase C: Dynamic Schema Replacement
Priority: **High** -- the core deliverable of v5.3.

7. allowlist.ts refactor (populate ALLOWED_FILTER_FIELDS and ALLOWED_AXIS_FIELDS from SchemaProvider)
8. types.ts adjustment (FilterField/AxisField work with dynamic column sets)
9. latch.ts refactor (LATCH_FAMILIES derived from SchemaProvider classification)
10. UI consumer updates (PropertiesExplorer, ProjectionExplorer, CalcExplorer, LatchExplorers, SuperGridQuery)
11. PAFVProvider defaults validation (verify default axes exist in dynamic schema)

### Phase D: User-Configurable Preferences
Priority: **Medium** -- quality-of-life on top of dynamic schema.

12. LATCH family override persistence (ui_state key, SchemaProvider merge)
13. Sort field preference UI (expose sort field picker beyond current axis assignment)
14. Display field preference UI (expose SuperDensityProvider.displayField selector)

**Defer beyond v5.3:**
- View presets / saved configurations (significant scope, v6 feature)
- EAV table for extra fields (D-008 deferred)
- Custom column types / semantic typing (massive scope)
- ALTER TABLE from UI (out of scope by design)

---

## Complexity Assessment

| Feature | Lines of Code (est.) | Test Coverage Needed | Risk Level |
|---------|---------------------|---------------------|------------|
| SVG letter-spacing fix | 10-20 CSS | Visual regression check | **Trivial** -- CSS-only fix |
| deleted_at null guard | 20-50 TS | Null path unit tests | **Low** -- defensive code audit |
| SchemaProvider class | 200-350 TS | PRAGMA parsing, classification, subscribe pattern, column accessor tests | **Medium** -- new provider, well-established pattern |
| Worker handler for PRAGMA | 30-50 TS | Handler response format tests | **Low** -- minimal new code |
| allowlist.ts refactor | 80-120 TS | SQL safety preserved, dynamic set membership, existing injection tests still pass | **Medium** -- load-bearing security boundary, must not regress |
| types.ts adjustment | 30-50 TS | Type compatibility tests | **Low** -- minimal changes, branded string pattern |
| latch.ts refactor | 40-60 TS | Classification heuristic tests, LATCH family assignment accuracy | **Low** -- replacing literal map with function |
| PropertiesExplorer update | 30-50 TS | Dynamic field rendering, toggle state with new fields | **Low** -- already iterates ALLOWED_AXIS_FIELDS, change source |
| ProjectionExplorer update | 20-40 TS | Available field pool from SchemaProvider | **Low** -- same pattern as PropertiesExplorer |
| CalcExplorer update | 30-50 TS | Numeric detection from type affinity, display names from AliasProvider | **Low** -- replacing 2 hardcoded constants |
| LatchExplorers update | 30-50 TS | Dynamic field arrays per LATCH section | **Low** -- replacing 3 hardcoded arrays |
| SuperGridQuery update | 20-30 TS | Time field detection from SchemaProvider | **Low** -- replacing 1 hardcoded Set |
| LATCH override persistence | 60-100 TS | Override merge logic, ui_state round-trip, SchemaProvider integration | **Low** -- follows established ui_state pattern |
| Sort/display preference UI | 40-80 TS + 30 CSS | Preference widget rendering, state persistence | **Low** -- small UI additions |

**Total estimated new code:** ~650-1,100 TS + ~50 CSS lines
**Total estimated modified code:** ~200-350 TS across 15 existing files

**Risk assessment:** The highest-risk change is the allowlist.ts refactor. The allowlist is a load-bearing SQL safety boundary (D-003). The refactor must:
1. Preserve the validate/assert function pattern
2. Ensure the dynamic set is populated BEFORE any filter/axis operations execute
3. Handle the startup race: SchemaProvider must complete PRAGMA before any view renders
4. Pass all existing SQL injection tests without modification

---

## Sources

### Schema Introspection
- [SQLite PRAGMA Documentation](https://sqlite.org/pragma.html) -- table_info, table_xinfo column details (HIGH confidence)
- [sql.js GitHub Repository](https://github.com/sql-js/sql.js/) -- WASM SQLite in JavaScript (HIGH confidence)
- [4 Ways to Get Table Structure in SQLite](https://database.guide/4-ways-to-get-information-about-a-tables-structure-in-sqlite/) -- PRAGMA alternatives
- [SQLite Forum: PRAGMA table_info in WASM](https://sqlite.org/forum/info/895425b49a) -- WASM-specific considerations

### Semantic Type Mapping (Metabase Pattern)
- [Metabase Semantic Types Documentation](https://www.metabase.com/docs/latest/data-modeling/semantic-types) -- auto-detection + user override pattern (HIGH confidence)
- [Metabase Data and Field Types](https://www.metabase.com/docs/latest/data-modeling/field-types.html) -- column type classification (HIGH confidence)
- [Metabase Table Metadata Editing](https://www.metabase.com/docs/latest/data-modeling/metadata-editing) -- admin override UI pattern (MEDIUM confidence)

### User-Configurable Schema (Airtable/Notion Pattern)
- [Airtable Field Type Overview](https://support.airtable.com/docs/field-type-overview) -- user-configurable field types (MEDIUM confidence)
- [Airtable vs Notion Comparison](https://www.jotform.com/blog/airtable-vs-notion/) -- schema flexibility approaches (MEDIUM confidence)

### Dynamic Allowlist / SQL Safety
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) -- allowlist validation best practices (HIGH confidence)
- [Type-Safe SQL in TypeScript](https://medium.com/@2nick2patel2/type-safe-sql-in-ts-done-right-6b4b276e3942) -- runtime validation patterns (MEDIUM confidence)
- [Dynamic Type Validation in TypeScript](https://blog.logrocket.com/dynamic-type-validation-in-typescript/) -- runtime type safety approaches (MEDIUM confidence)
