# Domain Pitfalls: v5.3 Dynamic Schema

**Domain:** Replacing hardcoded schema patterns with runtime introspection in an existing ~90K LOC TypeScript/D3/sql.js application
**Researched:** 2026-03-10
**Confidence:** HIGH (all pitfalls derived from direct codebase analysis with exact file/line references)

---

## Critical Pitfalls

Mistakes that cause crashes, data loss, SQL injection, or require architectural rewrites.

---

### Pitfall 1: Bootstrap Race -- StateManager.restore() Runs Before Schema Introspection

**What goes wrong:** The application bootstrap sequence is: Worker init -> Database.initialize() -> Worker posts `ready` -> main thread calls StateManager.restore() to rehydrate PAFVProvider, FilterProvider, etc. from ui_state. StateManager.restore() (line 168-184) calls `provider.setState(parsedJSON)`, which internally calls `validateAxisField()` / `validateFilterField()` on restored field names. If SchemaProvider is not yet initialized (schema introspection result hasn't been delivered), the validation function checks against an empty or default-only set.

**Why it happens:** The Worker posts `ready` and schema introspection data as potentially separate messages. If schema introspection is a separate Worker round-trip after `ready`, there is a timing window where `StateManager.restore()` tries to validate fields before SchemaProvider has populated its dynamic set.

**Consequences:**
- FilterProvider.setState() validates eagerly (line 350-353) and throws "SQL safety violation" for valid fields -> StateManager catches (line 178) -> calls resetToDefaults() -> user loses ALL filters, axis filters, and range filters
- PAFVProvider.setState() defers validation to compile() time (comment on line 597-598) -> loads silently -> crashes on first compile() or getStackedGroupBySQL() call -> SuperGrid render fails
- The error is silent (StateManager logs a warning and resets) -- user sees default view instead of saved configuration on every app restart

**Prevention:**
1. **Best:** Run `PRAGMA table_info(cards)` inside the Worker during `initialize()` (after schema.sql is applied, before `ready` message) and include the column list in the `ready` message payload. This eliminates the round-trip and timing gap entirely.
2. SchemaProvider on the main thread receives the column list from the ready message synchronously before any provider restore.
3. **Fallback:** Keep the current `ALLOWED_AXIS_FIELDS` and `ALLOWED_FILTER_FIELDS` frozen sets as a fallback floor. Validation passes if the field is in either the frozen set OR the dynamic set. The frozen set covers all fields that could have been persisted in any prior version.
4. Concrete change in `worker.ts` line 92-115: add `const schema = db.exec("PRAGMA table_info('cards')")` and include result in `readyMessage`.

**Detection:** Add `console.warn` when fallback set is used during validation (indicates schema:info hasn't arrived yet). Integration test: init full Worker -> Bridge -> Provider stack and assert SchemaProvider.getFields() returns non-empty before any setState().

---

### Pitfall 2: Worker-Side Validation Uses Stale Hardcoded Set

**What goes wrong:** The main-thread SchemaProvider receives schema introspection data and updates its dynamic sets. But the Worker-side validation functions (`validateAxisField` in supergrid.handler.ts line 10, chart.handler.ts line 10, histogram.handler.ts line 11) import from the module-level frozen sets in `allowlist.ts`. These are the same frozen sets that existed before v5.3. The Worker and main thread are **separate JavaScript contexts** -- they share no module instances.

**Why it happens:** allowlist.ts is imported independently in both contexts. Main-thread updates to SchemaProvider do not propagate to the Worker.

**Consequences:**
- User assigns a dynamically-discovered field to a SuperGrid axis via ProjectionExplorer (main-thread validation passes)
- Worker receives the supergrid:query with the new field
- Worker's `validateAxisField()` throws "SQL safety violation" -- query fails
- SuperGrid shows error state with no data
- Same failure for chart:query, histogram:query, db:distinct-values, and supergrid:calc

**Prevention:**
1. Worker-side must ALSO populate a dynamic set from PRAGMA at init time. The Worker already has the database -- it can run `PRAGMA table_info(cards)` during `initialize()`.
2. `allowlist.ts` exports a `setDynamicFields(fields: Set<string>)` function that the Worker calls at init. The validation functions check: `frozenSet.has(field) || dynamicSet.has(field)`.
3. The Worker-side dynamic set is populated BEFORE the `ready` message is sent (same initialization transaction).
4. Both main-thread and Worker use the same underlying validation -- the difference is just WHERE the dynamic set gets populated (SchemaProvider on main thread, PRAGMA result in Worker).

**Detection:** Worker error response with code 'INVALID_REQUEST' and message containing "SQL safety violation" for a field that SchemaProvider recognizes. Test: add a field to schema.sql that's not in the current hardcoded set, verify full pipeline works end-to-end.

---

### Pitfall 3: SQL Injection Through Dynamic Field Names Bypassing Parameterization

**What goes wrong:** The entire SQL safety model (D-003) relies on field names being validated against a known allowlist before string interpolation into SQL. All user VALUES go through `?` parameter binding, but field NAMES are interpolated directly across at least 7 files and 15+ interpolation sites:

| File | Interpolation Pattern | Count |
|------|----------------------|-------|
| `FilterProvider.compile()` | `${field} = ?`, `${field} IN (...)`, `${field} >= ?` | 6 |
| `SuperGridQuery.buildSuperGridQuery()` | `SELECT ${field}`, `GROUP BY ${field}`, `ORDER BY ${field}` | 5 |
| `SuperGridQuery.buildSuperGridCalcQuery()` | `SUM(${field})`, `AVG(${field})`, `"__agg__${field}"` | 4 |
| `chart.handler.ts` | `SELECT ${xField} AS label`, `GROUP BY ${xField}` | 4 |
| `histogram.handler.ts` | `MIN(${field})`, `MAX(${field})`, `CASE WHEN ${field} >= ?` | 5 |
| `supergrid.handler.ts handleDistinctValues()` | `SELECT DISTINCT ${payload.column}` | 2 |
| `LatchExplorers fetchDistinctValuesWithCounts()` | `SELECT ${field}, COUNT(*) AS count` | 1 |

When fields come from PRAGMA table_info, the field names come from the database schema itself (safe for Isometry's own schema). But if future features allow custom columns, or if a database is imported from an external source, column names could contain SQL metacharacters.

**Prevention:**
1. SchemaProvider must sanitize column names from PRAGMA output: **reject any column name containing characters outside `[a-zA-Z0-9_]`**. This is the simplest and most robust defense. The regex validation runs ONCE at introspection time, and the validated set is cached.
2. Defense-in-depth: quote all interpolated field names with double-quotes in SQL (`"${field}" = ?` instead of `${field} = ?`). SQLite double-quoted identifiers handle special characters safely.
3. The regex validation in SchemaProvider is a security gate -- it must exist before any dynamic field enters the validation pool.

**Detection:** Write a test that adds a column named `'); DROP TABLE cards; --` to the test database and verifies that SchemaProvider rejects it from the valid field set.

**Phase implication:** Must be addressed in the SchemaProvider implementation phase itself.

---

### Pitfall 4: Persisted Provider State References Fields That No Longer Exist

**What goes wrong:** Tier 2 providers serialize state to `ui_state` as JSON containing field names. If the schema changes between sessions (column renamed, custom column removed, schema version mismatch), the persisted JSON references non-existent fields.

Current behavior per provider:
- **FilterProvider:** setState() (line 350-353) validates eagerly -> throws -> StateManager catches -> resetToDefaults() -> user loses ALL filters, axis filters, range filters, and search query
- **PAFVProvider:** setState() (line 597-598) defers validation to compile() time -> loads silently -> crashes on first render
- **AliasProvider:** setState() (line 93) silently drops aliases for unknown fields via `isValidAxisField(key)` check -> harmless, just loses display names

**Prevention:**
1. Add a "field migration" step in StateManager.restore(): after parsing JSON but before setState(), filter out any fields not present in SchemaProvider's current column list. Log a warning for dropped fields.
2. In PAFVProvider.setState(), validate fields at load time (not just compile time). Replace invalid axis fields with the default axis for that view type rather than throwing or deferring.
3. Never throw during setState() for "field not found" -- degrade gracefully. A missing field should result in that field being removed from the restored state, not in the entire provider being reset.
4. AliasProvider.setState() should use SchemaProvider.isKnownField(key) instead of isValidAxisField(key) to preserve aliases for dynamic fields.

**Detection:** Write a test that saves PAFVProvider state with `colAxes: [{field: 'nonexistent', direction: 'asc'}]`, then restores. Must degrade to defaults for that axis slot, not crash or reset entire state.

---

### Pitfall 5: TypeScript Union Types Desync From Runtime Allowlist

**What goes wrong:** `types.ts` defines `FilterField` (16 literals) and `AxisField` (9 literals) as compile-time union types. These are used as parameter types throughout the codebase: `Filter.field: FilterField`, `AxisMapping.field: AxisField`, `AliasProvider.getAlias(field: AxisField)`, `LATCH_FAMILIES: Record<AxisField, LatchFamily>`, `SuperDensityState.displayField?: AxisField`. When SchemaProvider adds runtime fields not in the union, TypeScript rejects them at compile time.

**Consequences:** Either (a) every dynamic field call requires `as AxisField` casts creating unsafe assertion sprawl, or (b) the union types are widened to `string` losing compile-time safety that caught real bugs across 68 phases.

**Prevention (recommended -- preserve type safety):**
1. Keep the `AxisField` union as-is for KNOWN fields. It continues to protect hardcoded references against typos.
2. Widen `AxisMapping.field` from `AxisField` to `string`. This is the flow-through type used in FilterProvider, PAFVProvider, SuperGridQuery. All these paths ALREADY validate at runtime via `validateAxisField()` -- the runtime layer is the real safety net.
3. Functions that accept user-provided dynamic fields (SchemaProvider, ProjectionExplorer, PropertiesExplorer) use `string`. Functions that use known constants internally keep `AxisField` literals.
4. At boundaries where dynamic fields enter: use `validateAxisField(field)` which asserts the type. After validation, the `string` is narrowed by the assertion function.
5. `LATCH_FAMILIES: Record<AxisField, LatchFamily>` stays as-is for the 9 known fields. Dynamic fields get family assignment via `SchemaProvider.getLatchFamily(field: string)`.

**Detection:** `tsc --strict` flags every location where a `string` is passed to an `AxisField`-typed parameter. Count the change sites before choosing strategy.

**Phase implication:** Must be resolved alongside Pitfall 2. The type change and the runtime validation change are two halves of the same problem.

---

## Moderate Pitfalls

Mistakes that cause significant bugs or degraded UX but are recoverable.

---

### Pitfall 6: LATCH Family Map Returns undefined for Dynamic Fields

**What goes wrong:** `latch.ts` exports `LATCH_FAMILIES: Readonly<Record<AxisField, LatchFamily>>` mapping exactly 9 fields to their LATCH family letter. PropertiesExplorer (line 18), ProjectionExplorer (line 18), and LATCHExplorers use this map to group and color-code fields. For dynamic fields: `LATCH_FAMILIES[dynamicField]` returns `undefined`, causing:
- PropertiesExplorer's column grouping skips the field (iterates LATCH_ORDER then LATCH_FAMILIES)
- ProjectionExplorer's chip color is undefined (no color coding)
- LATCHExplorers has no section to render the field

**Prevention:**
1. Provide `SchemaProvider.getLatchFamily(field: string): LatchFamily` that checks: user override first -> built-in map second -> auto-classify by heuristic third -> fall back to 'C' (Category).
2. Auto-classification heuristic: name ends in `_at` -> 'T' (Time), type is INTEGER/REAL -> 'H' (Hierarchy), name is 'name' -> 'A' (Alphabet), else -> 'C' (Category).
3. Be conservative with auto-classification. Include an "Uncategorized" rendering path for ambiguous fields that appear in all LATCH sections until the user explicitly assigns them.
4. PropertiesExplorer must change from iterating `LATCH_FAMILIES` keys to iterating `SchemaProvider.getAxisFields()`, looking up family per field.

**Detection:** Mount PropertiesExplorer with a SchemaProvider containing a field not in LATCH_FAMILIES. Must render in a default column, not crash or vanish.

---

### Pitfall 7: VIEW_DEFAULTS Hardcode field names

**What goes wrong:** `PAFVProvider` VIEW_DEFAULTS (lines 58-85) hardcode `card_type`, `folder`, and `status` as default axes:
```typescript
supergrid: { colAxes: [{ field: 'card_type', direction: 'asc' }], rowAxes: [{ field: 'folder', direction: 'asc' }] }
kanban: { groupBy: { field: 'status', direction: 'asc' } }
```
If user-configurable LATCH mappings allow changing default fields, or if these fields are missing from a foreign database import, setViewType() sets invalid defaults that crash on compile().

**Prevention:**
1. VIEW_DEFAULTS stays as literal fallbacks (always safe for Isometry's own schema).
2. Add a `getViewDefaults(schema: SchemaProvider)` function that selects sensible defaults from available fields (first Category field for colAxes, first Alphabet/Category field for rowAxes).
3. PAFVProvider.setViewType() uses getViewDefaults() when SchemaProvider is available, falls back to current literals otherwise.

---

### Pitfall 8: Histogram and Chart Handlers Use Different Allowlists

**What goes wrong:** `histogram.handler.ts` validates against `validateFilterField()` (16 fields including latitude, longitude, location_name, event_start, event_end). `chart.handler.ts` validates against `validateAxisField()` (9 fields). This distinction is meaningful: you can bin a histogram on latitude but grouping a chart by latitude is nonsensical.

When fields become dynamic, the question is: which allowlist does each handler use? If SchemaProvider replaces both with a single "all columns" set, the distinction between "fields you can filter/bin" and "fields you can group by" is lost.

**Prevention:**
1. SchemaProvider exposes two APIs: `getFilterableFields()` (all queryable columns) and `getGroupableFields()` (columns meaningful for axis grouping).
2. Default: all canonical fields keep current classification. New dynamic fields default to "filterable but not groupable" until user promotes them via LATCH mapping UI.
3. Histogram validates against filterable set (it bins any numeric/date column). Chart validates against groupable set.

---

### Pitfall 9: deleted_at IS NULL Hardcoded in 12+ Query Paths

**What goes wrong:** `deleted_at IS NULL` is hardcoded as the base WHERE clause in:
- FilterProvider.compile() line 238
- SuperGridQuery.buildSuperGridQuery() line 175
- SuperGridQuery.buildSuperGridCalcQuery() line 334
- histogram.handler.ts line 43
- chart.handler.ts line 39
- cards.ts getCard line 95, listCards line 263
- search.ts line 61, graph.ts line 69
- DedupEngine.ts line 56
- ViewManager.ts line 486
- NativeBridge.ts line 281
- ExportOrchestrator.ts line 75

If a database checkpoint lacks the `deleted_at` column (older schema, foreign import), **every query fails** with "no such column: deleted_at".

**Prevention:**
1. **Recommended (simplest):** Ensure `deleted_at` always exists via schema migration. If a hydrated database lacks the column, add it: `ALTER TABLE cards ADD COLUMN deleted_at TEXT`. This is a one-time migration that guarantees all 12+ query paths work.
2. Alternative: SchemaProvider detects whether `deleted_at` exists and exports `getSoftDeleteClause()` returning either `'deleted_at IS NULL'` or `'1=1'`. All 12+ sites use this helper. More complex but handles foreign databases.
3. Given Isometry controls its own schema, option 1 is safer and simpler.

---

### Pitfall 10: SuperGridQuery NUMERIC_FIELDS and ALLOWED_TIME_FIELDS Are Stale

**What goes wrong:** SuperGridQuery.ts hardcodes two classification sets:
- `ALLOWED_TIME_FIELDS = new Set(['created_at', 'modified_at', 'due_at'])` (line 25) -- determines strftime() wrapping
- `NUMERIC_FIELDS = new Set(['priority', 'sort_order'])` (line 235) -- determines SUM/AVG eligibility

CalcExplorer.ts has its own `NUMERIC_FIELDS` (line 41). After SchemaProvider migration, some consumers might delegate to SchemaProvider while others still use local constants, creating split-brain classification.

**Prevention:**
1. SchemaProvider is the SOLE source for field classification. Export `isNumericField(field)`, `isTimeField(field)` based on PRAGMA type info.
2. Delete all per-module hardcoded sets and replace with SchemaProvider queries.
3. Worker-side code uses the Worker-side set populated from PRAGMA (per Pitfall 2 fix).

---

### Pitfall 11: SVG letter-spacing Cross-Browser Rendering

**What goes wrong:** The milestone mentions SVG letter-spacing rendering differences. Current codebase audit shows `letter-spacing` in 6 locations, **all on HTML elements** (CSS Grid cells, flex items, divs), NOT SVG `<text>` elements:
- command-palette.css:73 (0.05em), help-overlay.css:72 (0.05em), audit.css:262 (0.5px)
- latch-explorers.css:46 (0.5px), projection-explorer.css:46 (0.5px)
- SuperGrid.ts:2852 inline (0.05em on help overlay category heading)

SVG `<text>` `letter-spacing` behaves differently: Safari applies per-glyph with potential collapse at zoom levels, Chrome uses different sub-pixel metrics, Firefox renders correctly but with different rounding.

**Prevention:**
1. Current HTML usages are safe. No fix needed for existing CSS.
2. D3 chart blocks (Phase 65) render axis labels -- the existing ChartRenderer uses HTML overlays, not SVG `<text>`. Keep this pattern.
3. If the bug is about a specific SVG text element introduced recently, the fix is to move that label to HTML or remove letter-spacing from SVG text.
4. For any future SVG `<text>`, avoid letter-spacing. Use `dx` attributes for manual spacing if needed.

---

### Pitfall 12: Category Chips Query Unbounded Cardinality Fields

**What goes wrong:** Category chips query `SELECT field, COUNT(*) FROM cards WHERE ... GROUP BY field` for each LATCH Category field. When the field list becomes dynamic, a field with thousands of distinct values (e.g., a URL field, a free-text field) generates hundreds of chips, degrading UI performance.

**Prevention:**
1. Add a cardinality check: `SELECT COUNT(DISTINCT field) FROM cards WHERE ...`. If > 50, skip chips and show "too many values" placeholder. Fall back to histogram scrubber.
2. SchemaProvider metadata could include estimated cardinality from initial PRAGMA + sampling.

---

## Minor Pitfalls

---

### Pitfall 13: SchemaProvider Subscriber Notification Storm

**What goes wrong:** SchemaProvider.setSchema() fires subscribers. If 6+ UI components subscribe, all re-render simultaneously. Each re-render may trigger Worker queries (distinct values, histogram data), creating 15+ Worker requests in a burst.

**Prevention:** Use queueMicrotask batching (same as other providers). Components guard re-render with dirty flags -- only re-render if their relevant fields actually changed.

---

### Pitfall 14: PRAGMA table_info Column Order Assumption

**What goes wrong:** Code that assumes `PRAGMA table_info` results are in a specific order (columns[0] = id, etc.) breaks if the schema is ever modified. `ALTER TABLE ADD COLUMN` in SQLite appends to the end.

**Prevention:** Always use column names from PRAGMA result, never positional indices. SchemaProvider builds a `Map<string, ColumnInfo>` keyed by name.

---

### Pitfall 15: User LATCH Overrides Reference Nonexistent Fields

**What goes wrong:** User persists LATCH override `{ "old_column": "C" }`. On next launch, `old_column` doesn't exist (column removed or different database loaded).

**Prevention:** When restoring overrides from ui_state, validate each field against current PRAGMA result. Discard entries for fields not in the schema. Log a warning.

---

### Pitfall 16: fetchDistinctValuesWithCounts Lacks Validation

**What goes wrong:** LatchExplorers.ts `fetchDistinctValuesWithCounts()` builds SQL with direct field interpolation: `` `SELECT ${field}, COUNT(*) AS count FROM cards WHERE ...` ``. Currently safe because `field` comes from hardcoded arrays. After making these arrays dynamic, a corrupted LATCH override could inject a malicious field name.

**Prevention:** Add `validateFilterField(field)` call at top of `fetchDistinctValuesWithCounts()` before SQL interpolation. This was always a latent gap -- dynamic schema makes it urgent.

---

### Pitfall 17: CalcExplorer FIELD_DISPLAY_NAMES Returns undefined

**What goes wrong:** CalcExplorer has hardcoded `FIELD_DISPLAY_NAMES` Record with 9 entries. Dynamic fields fall back to raw column name (`event_start` instead of `Event Start`).

**Prevention:** `SchemaProvider.getDisplayName(field)` generates human-readable names: split on `_`, capitalize each word, join with spaces. AliasProvider overrides take precedence.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Bug fixes** | P9 (deleted_at optional), P11 (SVG letter-spacing) | Schema migration adds deleted_at if missing; audit HTML vs SVG text |
| **SchemaProvider core** | P1 (bootstrap race), P2 (Worker-side stale), P3 (SQL injection), P14 (column order) | PRAGMA in Worker init, include in ready message, regex sanitize names, name-keyed Map |
| **Type system migration** | P5 (union desync) | Widen AxisMapping.field to string; keep AxisField union for literals |
| **Replace hardcoded lists** | P6 (LATCH map), P7 (VIEW_DEFAULTS), P10 (NUMERIC/TIME sets), P16 (SQL interpolation), P17 (display names) | SchemaProvider as sole classification authority; delete per-module sets |
| **State persistence** | P4 (invalid fields in JSON), P15 (LATCH overrides) | Field migration in restore(); validate against current PRAGMA |
| **User LATCH config** | P8 (allowlist distinction), P12 (high cardinality), P13 (notification storm) | Two-tier field classification; cardinality threshold; microtask batching |

---

## Integration Risk Map

```
SchemaProvider (central new component)
  |
  +-- allowlist.ts .......... P1, P2, P3, P5 (validation model change)
  |     9+ files import; 16+ call sites; Worker + main thread contexts
  |
  +-- FilterProvider ........ P1, P4, P9 (compile interpolation, setState, deleted_at)
  |     compile() has 6 field interpolation sites
  |
  +-- PAFVProvider .......... P1, P4, P5, P7 (compile, setState defers, VIEW_DEFAULTS)
  |     setState() line 597: "We allow invalid fields here"
  |
  +-- AliasProvider ......... P4 (setState drops dynamic fields via isValidAxisField)
  |
  +-- latch.ts .............. P6 (LATCH_FAMILIES frozen Record<AxisField, LatchFamily>)
  |     Returns undefined for any field not in the 9-field union
  |
  +-- SuperGridQuery ........ P2, P3, P10 (Worker-side validation, interpolation, field sets)
  |     15+ interpolation sites; 2 hardcoded classification sets
  |
  +-- Worker handlers ....... P2, P3, P8 (stale validation, injection, allowlist split)
  |     4 handlers import different validation functions
  |
  +-- UI Explorers .......... P6, P12, P16, P17 (LATCH families, cardinality, SQL, display names)
  |     PropertiesExplorer, ProjectionExplorer, CalcExplorer, LatchExplorers
  |
  +-- StateManager .......... P1, P4 (timing, field migration)
       restore() must run AFTER SchemaProvider populated
```

**Highest risk:** `allowlist.ts` -- 9+ importing files, Worker + main thread dual-context, every validation function must transition to dynamic lookup.

**Second highest:** `StateManager.restore()` timing -- must occur AFTER SchemaProvider initialization but BEFORE any view render.

---

## Recommended Phase Ordering Based on Pitfall Dependencies

1. **Bug Fixes** (P9, P11) -- SVG letter-spacing and deleted_at optional. Independent of SchemaProvider.
2. **SchemaProvider + Allowlist Migration** (P1, P2, P3, P5) -- Foundation for everything. PRAGMA in Worker init, column name sanitization, type widening, ready message payload extension.
3. **Replace Hardcoded Field Lists** (P6, P7, P10, P14, P16, P17) -- Swap frozen constants for SchemaProvider across PropertiesExplorer, ProjectionExplorer, PAFVProvider, SuperGridQuery, CalcExplorer.
4. **State Persistence Migration** (P4, P15) -- Field migration in StateManager.restore(), AliasProvider setState fix. Requires SchemaProvider.
5. **User-Configurable LATCH Mappings** (P6, P8, P12, P13) -- Build configuration UI last, after all plumbing works.

---

## Sources

- Direct source code analysis:
  - `src/providers/allowlist.ts` lines 22-41, 67-79, 93-168 (frozen sets and validation functions)
  - `src/providers/types.ts` lines 17-70 (AxisField/FilterField union type definitions)
  - `src/providers/FilterProvider.ts` lines 238, 350-353, 597-598 (compile interpolation, setState validation)
  - `src/providers/PAFVProvider.ts` lines 58-85, 191-200, 279-302, 591-623 (VIEW_DEFAULTS, setColAxes, compile, setState)
  - `src/providers/AliasProvider.ts` lines 89-98 (setState isValidAxisField gate)
  - `src/providers/latch.ts` lines 36-46 (LATCH_FAMILIES frozen Record)
  - `src/providers/StateManager.ts` lines 168-184 (restore flow, error handling)
  - `src/views/supergrid/SuperGridQuery.ts` lines 25, 145-223, 235, 266-362 (TIME/NUMERIC sets, field interpolation)
  - `src/worker/handlers/supergrid.handler.ts` lines 10, 49-103, 116-145, 158-182 (validation, SQL construction)
  - `src/worker/handlers/histogram.handler.ts` lines 11, 33-53, 59-130 (validateFilterField, field interpolation)
  - `src/worker/handlers/chart.handler.ts` lines 10, 29-95 (validateAxisField, field interpolation)
  - `src/worker/worker.ts` lines 92-115 (Worker init sequence, ready message)
  - `src/ui/PropertiesExplorer.ts` lines 17, 78-79 (ALLOWED_AXIS_FIELDS usage, initial enabled set)
  - `src/ui/ProjectionExplorer.ts` lines 17-18 (ALLOWED_AXIS_FIELDS, LATCH_FAMILIES imports)
  - `src/database/schema.sql` lines 1-178 (canonical schema, deleted_at column definition)
- [SQLite PRAGMA table_info](https://www.sqlite.org/pragma.html#pragma_table_info) -- returns cid, name, type, notnull, dflt_value, pk per column
- Architectural decisions D-003 (SQL safety), D-005 (persistence tiers), D-008 (schema-on-read deferred) from CLAUDE-v5.md
