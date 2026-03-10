# Technology Stack: v5.3 Dynamic Schema

**Project:** Isometry v5.3 Dynamic Schema
**Researched:** 2026-03-10
**Confidence:** HIGH -- zero new dependencies; all features use existing sql.js capabilities and CSS patterns

## Recommendation: No New Dependencies

v5.3 requires zero new npm packages. Every feature -- schema introspection, dynamic query generation, user preferences persistence, and bug fixes -- is implemented with the existing stack. The milestone is about replacing hardcoded patterns with dynamic ones, not adding new technology.

## Recommended Stack

### Core (Unchanged)

| Technology | Version | v5.3 Purpose | Why |
|------------|---------|--------------|-----|
| TypeScript | 5.9 (strict) | SchemaProvider types, dynamic field unions | Existing -- type-safe column metadata representation |
| sql.js | 1.14 (FTS5 WASM) | `PRAGMA table_info(cards)` introspection | Existing -- PRAGMA is a standard SQLite statement, fully supported by sql.js |
| D3.js | v7.9 | No new D3 usage in v5.3 | Existing -- views consume schema dynamically but rendering is unchanged |
| Vite | 7.3 | Dev server + build | Existing |
| Vitest | 4.0 | Unit + integration tests | Existing |
| Biome | 2.4.6 | Lint + format | Existing |

### Infrastructure (Unchanged)

| Technology | Version | v5.3 Purpose | Why |
|------------|---------|--------------|-----|
| marked | latest | No changes | Existing -- notebook system stable from v5.2 |
| DOMPurify | latest | No changes | Existing -- sanitization unchanged |

## Key Technical Capabilities Used

### 1. PRAGMA table_info (sql.js)

`PRAGMA table_info(table_name)` returns one row per column with fields: `cid`, `name`, `type`, `notnull`, `dflt_value`, `pk`. This is a core SQLite feature supported by all sql.js versions including the custom FTS5 WASM build.

**Confidence: HIGH** -- sql.js wraps SQLite's C API directly. PRAGMA support is fundamental to SQLite, not an extension. The project already uses `PRAGMA foreign_keys = ON` successfully (Database.ts line 66/74). The native Swift layer also uses `PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)` for Apple Notes schema detection (NotesAdapter.swift line 168).

**Integration point:** Execute via existing `db.exec('PRAGMA table_info(cards)')` -- returns `{columns: ['cid','name','type','notnull','dflt_value','pk'], values: [...]}`. Each row describes one column. Parse into a `ColumnInfo[]` array at startup.

```typescript
// PRAGMA table_info(cards) returns:
// cid | name        | type    | notnull | dflt_value | pk
// 0   | id          | TEXT    | 1       | null       | 1
// 1   | card_type   | TEXT    | 1       | 'note'     | 0
// 2   | name        | TEXT    | 1       | null       | 0
// ... etc (25 columns total per schema.sql)
```

### 2. Dynamic Allowlist Generation

The current allowlist system (`src/providers/allowlist.ts`) uses frozen `ReadonlySet<T>` objects with compile-time union types (`FilterField`, `AxisField`). For v5.3, the SchemaProvider populates these sets at runtime from PRAGMA results instead of hardcoding them.

**Key constraint:** SQL safety (D-003) must be preserved. The allowlist validation functions (`validateFilterField`, `validateAxisField`) must still reject any field not in the set. The difference is the set is populated from the database schema, not from a TypeScript literal.

**Integration approach:** SchemaProvider initializes once at database startup (Worker `wasm-init` handler), introspects columns via PRAGMA, classifies each into filter/axis/excluded categories, and exposes frozen sets. Existing validation functions remain the enforcement boundary -- they just read from SchemaProvider instead of static constants.

### 3. ui_state for User Preferences

User-configurable LATCH mappings, sort fields, and display preferences persist to the existing `ui_state` table using the established `PersistableProvider` pattern. The project already has 6 providers persisting to ui_state (FilterProvider, PAFVProvider, DensityProvider, SuperDensityProvider, AliasProvider, ThemeProvider) plus CalcExplorer and NotebookExplorer.

**Pattern:** `bridge.send('ui:set', { key: 'latch:mappings', value: JSON.stringify(...) })` for writes. `bridge.send('ui:getAll')` at restore. StateManager coordinates save/restore lifecycle.

**No schema migration needed.** The `ui_state` table's key-value design handles arbitrary configuration data without DDL changes.

### 4. CSS letter-spacing Fix

The SVG letter-spacing bug occurs because CSS `letter-spacing` is an inherited property. When set on parent containers (`.latch-field-label` at `0.5px`, `.help-overlay__category` at `0.05em`, `.command-palette__category` at `0.05em`, `.audit-legend-label` at `0.5px`), it cascades into any SVG `<text>` elements rendered as descendants. SVG text elements honor inherited CSS `letter-spacing` but render it with incorrect positioning in some browsers (Safari/WebKit most notably).

**Fix pattern:** Reset `letter-spacing: normal` on SVG containers or on SVG `text` elements directly. This is a CSS-only fix -- no JavaScript or library changes needed.

```css
/* Reset inherited letter-spacing on SVG text */
svg text {
    letter-spacing: normal;
}
```

**Alternative (more targeted):** Ensure CSS classes with `letter-spacing` only target HTML elements, not SVG contexts. Since SuperGrid, NetworkView, TreeView, ListView, and TimelineView all render SVG text, the reset-on-svg approach is safest.

### 5. deleted_at Optional Column Handling

The current codebase hardcodes `deleted_at IS NULL` in WHERE clauses (FilterProvider.compile() always includes it, SuperGridQuery.ts line 175/334, chart.handler.ts line 39, histogram.handler.ts line 43). The "optional" bug likely refers to queries that fail to include the soft-delete guard or handle `deleted_at` inconsistently when the column could be absent.

**Fix pattern:** SchemaProvider validates that `deleted_at` exists in the cards schema at startup. All query paths that reference `deleted_at` check SchemaProvider for column presence. This is a code-level fix using the schema introspection already described above -- no new dependencies.

## What NOT to Add

| Rejected Option | Why Not |
|-----------------|---------|
| TypeORM / Drizzle / Kysely | D-003 mandates allowlist + parameters, not ORM. Adding a query builder contradicts the airtight QueryBuilder boundary |
| JSON Schema validator (ajv) | Schema shape is fixed in SQLite; PRAGMA gives everything needed. No external validation library required |
| Reactive state library (MobX, Zustand) | Violates D-003/D-009 -- D3 data join IS state management. SchemaProvider is read-once-at-startup, not reactive |
| Feature flag library (LaunchDarkly, Flagsmith) | FeatureGate already handles tier gating. Schema presence checks are simpler than feature flags |
| lodash / ramda | No utility function gap. Array methods + Set operations cover all schema comparison needs |
| @anthropic-ai/claude-code | Not a runtime dependency |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Schema introspection | PRAGMA table_info | sqlite_master + SQL parsing | PRAGMA returns structured data; parsing CREATE TABLE text is fragile |
| Dynamic type safety | Runtime Set validation | Code generation from schema | Code generation adds build step complexity; runtime validation matches existing pattern |
| Preference storage | ui_state table | localStorage | ui_state is already Tier 2, checkpoint-synced, and used by 6+ providers. localStorage is device-only |
| LATCH mapping config | JSON in ui_state | New `latch_config` table | Avoids schema migration; ui_state handles arbitrary config data |
| SVG letter-spacing fix | CSS `letter-spacing: normal` reset | SVG `dx` attribute | CSS reset is simpler, works globally, no per-element computation |
| SchemaProvider location | Worker-side singleton | Main thread provider | Schema data lives where SQL executes (Worker); main thread receives it via bridge response |

## SQL Capabilities Used (v5.3 Specific)

| SQL Feature | Purpose | Notes |
|-------------|---------|-------|
| `PRAGMA table_info(cards)` | Column introspection at startup | Returns cid, name, type, notnull, dflt_value, pk per column |
| `PRAGMA table_info(connections)` | Connection schema introspection | Same format; needed for export and graph queries |
| Dynamic `SELECT` column lists | Query only columns that exist | Replaces hardcoded `SELECT *` with validated column names |
| Dynamic `WHERE` clause generation | Filter on columns that exist | Replaces hardcoded field lists with schema-validated sets |
| Dynamic `GROUP BY` / `ORDER BY` | Axis operations on validated columns | Same validation pattern as current allowlist, populated from PRAGMA |

## Installation

```bash
# No changes to package.json
npm install  # (unchanged)
```

## Integration Points Summary

| Existing Module | v5.3 Change | How |
|-----------------|-------------|-----|
| `src/database/Database.ts` | None | Already supports `db.exec('PRAGMA ...')` |
| `src/providers/allowlist.ts` | Populate from SchemaProvider | Sets populated at init, frozen, validation functions unchanged |
| `src/providers/types.ts` | Widen union types or use `string` with runtime validation | Accept any schema-valid column, not just hardcoded literals |
| `src/providers/latch.ts` | LATCH_FAMILIES from user config | Read from ui_state instead of hardcoded `Object.freeze({...})` |
| `src/providers/FilterProvider.ts` | Use SchemaProvider for field validation | `compile()` references SchemaProvider sets instead of static ALLOWED_FILTER_FIELDS |
| `src/providers/PAFVProvider.ts` | Use SchemaProvider for axis validation | `validateAxisField()` references SchemaProvider instead of static ALLOWED_AXIS_FIELDS |
| `src/worker/worker.ts` | New `schema:introspect` handler | Runs PRAGMA, returns ColumnInfo[]; called once at init |
| `src/worker/handlers/chart.handler.ts` | Validate fields against SchemaProvider | Replace `validateAxisField(xField)` with SchemaProvider check |
| `src/worker/handlers/histogram.handler.ts` | Validate fields against SchemaProvider | Replace `validateFilterField(field)` with SchemaProvider check |
| `src/ui/LatchExplorers.ts` | Read LATCH family mapping from config | Replace hardcoded CATEGORY_FIELDS / HIERARCHY_FIELDS / TIME_FIELDS |
| `src/ui/PropertiesExplorer.ts` | Display schema-derived columns | Replace `ALLOWED_AXIS_FIELDS` iteration with SchemaProvider columns |
| CSS files | Add `svg text { letter-spacing: normal; }` | Global reset prevents inheritance issues |

## Sources

- [SQLite PRAGMA table_info documentation](https://sqlite.org/pragma.html) -- canonical reference for PRAGMA behavior
- [sql.js GitHub repository](https://github.com/sql-js/sql.js/) -- sql.js wraps SQLite C API; PRAGMA fully supported
- Existing codebase: `src/database/Database.ts` line 66 (`PRAGMA foreign_keys = ON` confirms PRAGMA execution works)
- Existing codebase: `native/Isometry/Isometry/NotesAdapter.swift` line 168 (`PRAGMA table_info` used in production)
- [MDN SVG letter-spacing](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/letter-spacing) -- SVG text inherits CSS letter-spacing
- [Cross browser alternatives to SVG Letter-Spacing](https://codepen.io/aamarks/pen/JdxGxW) -- documents the inheritance issue and fix patterns
