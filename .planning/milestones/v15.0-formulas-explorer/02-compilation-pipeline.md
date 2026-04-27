# Compilation Pipeline Specification

**Artifact:** `02-compilation-pipeline.md`
**Work Area:** WA-2
**Milestone:** v15.0 — Formulas Explorer Architecture
**Source:** `.planning/formulas-explorer-handoff-v2.md` (canonical)
**Status:** Authoritative
**Related:**
- `01-three-explorer-spec.md` — upstream boundary spec; this document operationalizes its declarations
- `06-chip-well-geometry.md` — input seam contract; `ChipWellOutputContract` (§9) is the interface this pipeline consumes

---

## Preamble

This document operationalizes the decisions locked in `01-three-explorer-spec.md` (Phase 182) and `06-chip-well-geometry.md` (Phase 183). Where that spec declares *what* each explorer produces (SELECT, WHERE, ORDER BY, post-query annotations), this spec specifies *how* the compiler produces it — the algorithm, the bind-value protocol, and the annotation passes.

**Structural precedent.** The existing codebase provides a direct anchor. `FilterProvider.compile()` returns a `CompiledFilter` value of shape `{ where: string, params: unknown[] }` — a `(sql_text, [bind_values])` tuple. `QueryBuilder` is the sole SQL assembly point that composes provider outputs into a complete query. `FormulasProvider` (forthcoming) must follow the same `(sql, params)` tuple shape, extended to carry SELECT and ORDER BY fragments alongside WHERE, so that `QueryBuilder` can absorb it without a new integration contract.

**Where the pipeline extends the pattern.** Two areas go beyond `FilterProvider`'s compile model:
1. **Dependency graph for Calculations** — Calculations may reference each other's output aliases, forming a DAG. The compiler must topologically sort them and detect cycles before emitting any SQL.
2. **Post-query annotation for Marks and Audits** — These explorers produce no SQL fragments. They annotate the result set *after* the query returns by iterating rows and evaluating predicates against already-materialized data.

**Input seam.** The `ChipWellOutputContract` (defined in `06-chip-well-geometry.md` §9 and further named as `GEOM-05`) is the interface this pipeline consumes. It delivers an ordered chip list per well, where each chip carries a type signature and a DSL fragment. The compiler treats this contract as its sole input; it has no direct access to chip-well UI state.

---

## 1. Fixed SQL Clause Order Mapping (COMP-01)

The compilation pipeline enforces a fixed SQL clause order regardless of chip arrangement. A user cannot change semantic clause order by rearranging chips — chips influence the *content* of clauses, not their sequence. The full mapping is:

| Clause | Source | Notes |
|--------|--------|-------|
| `SELECT` | Formulas / Calculations | Derived columns, aggregations, window functions; appended after `SELECT *` base |
| `FROM` | Data layer (`cards` table) | Static; never chip-controlled |
| `WHERE` | Formulas / Filters | AND-composed across chips; base clause always includes `deleted_at IS NULL` |
| `GROUP BY` | Active view explorer (e.g., SuperGrid PAFV) | Never owned by Formulas Explorer (FE-RG-01) |
| `HAVING` | View explorer (if needed) | Not chip-controlled at v1 |
| `ORDER BY` | Formulas / Sorts | Chip-position-ordered (FE-RG-04) |
| `LIMIT` | View explorer / pagination | Not chip-controlled at v1 |
| Post-query CSS annotations | Marks / Conditional encoding | Evaluated after query returns; `annotateMarks()` pass (FE-RG-07) |
| Post-query flag annotations | Audits / Anomaly + Validation rules | Evaluated after query returns; `annotateAudits()` pass (FE-RG-08) |

**Invariant:** `FormulasProvider` never emits `GROUP BY`, `HAVING`, or `LIMIT` clauses. These always come from the active view explorer context. The same Calculation chip (`COUNT(*) AS row_count`) produces `COUNT(*) AS row_count` in the SELECT clause regardless of whether the view is SuperGrid with `GROUP BY node_type` or a flat list with no grouping — Formulas provides the fragment; the view provides the grouping context.

---

## 2. Calculations Dependency Graph Algorithm (COMP-02)

Calculation chips may reference each other's output aliases. For example, a chip defining `profit = revenue - cost AS profit` depends on columns `revenue` and `cost`; if another chip defines `margin = profit / revenue AS margin`, it depends on the first chip's output alias `profit`. These dependencies form a directed acyclic graph (DAG). The compiler must resolve evaluation order before emitting SELECT fragments.

**CycleError type:**

```
// Type definition (pseudocode — not implementation code)
interface CycleError {
  kind: 'CycleError';
  participants: string[];  // chip IDs forming the cycle, for chip-well UI highlighting
  message: string;         // human-readable description, e.g. "Dependency cycle: chip-A-id <-> chip-B-id"
}
```

`participants` carries chip IDs, not column names, so the chip-well UI can highlight the offending chips directly.

**Algorithm — Kahn's topological sort with cycle detection:**

```
// Pseudocode for Calculation dependency resolution

function compileDependencyGraph(chips: CalculationChip[]): Result<CompiledChip[], CycleError> {

  // Step 1: Build adjacency list and in-degree map
  inDegree = Map<chipId, number>      // count of unresolved dependencies
  dependents = Map<chipId, chipId[]>  // which chips depend on this chip's output alias

  for each chip in chips:
    inDegree[chip.id] = 0
    dependents[chip.id] = []

  for each chip in chips:
    for each ref in chip.columnReferences:
      if ref matches another chip's output alias:
        // chip depends on refChip
        inDegree[chip.id] += 1
        dependents[refChip.id].push(chip.id)

  // Step 2: Kahn's BFS topological sort — process in-degree 0 nodes first
  queue = all chips where inDegree[chip.id] == 0
  sorted = []

  while queue is not empty:
    current = queue.dequeue()
    sorted.push(current)
    for each dependentId of dependents[current.id]:
      inDegree[dependentId] -= 1
      if inDegree[dependentId] == 0:
        queue.enqueue(chip with id == dependentId)

  // Step 3: Cycle detection — if any chips remain unprocessed, they form a cycle
  if sorted.length < chips.length:
    cycleParticipants = chips where inDegree[chip.id] > 0
    return Error(CycleError {
      kind: 'CycleError',
      participants: cycleParticipants.map(c => c.id),
      message: 'Dependency cycle detected: ' + cycleParticipants.map(c => c.id).join(' <-> ')
    })

  return Ok(sorted)
}
```

**Output.** When the graph is acyclic, `sorted` is the evaluation order for SELECT clause emission. The first chip in `sorted` has no dependencies on other chips in the list; the last chip has the most transitive dependencies. The SELECT fragments must appear in this order.

**On cycle.** No SQL is produced. The `CycleError` is surfaced to the chip-well UI, which highlights all participating chip IDs. The user must break the cycle before the compiler can proceed.

### 2.5 Cross-Category Reference Resolution

A Calculation chip may reference a Filter predicate. The canonical example from `01-three-explorer-spec.md` Appendix A (Example 8) is a "Filtered Total" — `SUM(revenue) [WHERE company = 'MSFT'] AS msft_revenue` — a Calculation that aggregates only over the rows satisfying a filter predicate.

**Resolution approach.** The compilation pipeline resolves cross-category references using inline `CASE WHEN` SQL:

```sql
SUM(CASE WHEN company = ? THEN revenue ELSE 0 END) AS msft_revenue
```

The filter predicate's bind values (`['MSFT']`) are appended to the outer query's `params` array in placeholder order alongside all other bind values. The resulting `?` placeholder occupies its natural ordinal position in the flat bind array.

This approach is chosen over `FILTER (WHERE ...)` syntax because it is broadly compatible with existing sql.js usage and does not require SQLite version awareness. The spec commits to `CASE WHEN` as the resolution form; the DSL design (how users express cross-category references) is WA-4's concern (Phase 187).

---

## 3. Filters AND-Composition Rule

Each Filter chip contributes exactly one conjunct to the SQL `WHERE` clause. Chips are joined by `AND`. There is no implicit `OR` across chips (FE-RG-03).

**Rule:** If a user needs OR semantics across two conditions, they write a single Filter chip whose DSL fragment contains `OR` internally (e.g., `node_type = 'note' OR node_type = 'task'`). Two separate Filter chips always mean AND, not OR.

**Commutativity and idempotence.** The composition is commutative: `filter_A AND filter_B` produces the same result set as `filter_B AND filter_A`. It is also idempotent: placing the same filter chip twice produces the same result as placing it once (the second chip adds a redundant but semantically identical conjunct).

**Structural precedent.** `FilterProvider.compile()` already implements this rule exactly:

```typescript
// From src/providers/FilterProvider.ts — the structural precedent
compile(): CompiledFilter {
  const clauses: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  for (const filter of this._filters) {
    validateFilterField(filter.field as string);
    validateOperator(filter.operator as string);
    const { clause, filterParams } = compileOperator(filter.field, filter.operator, filter.value);
    clauses.push(clause);
    params.push(...filterParams);
  }
  return { where: clauses.join(' AND '), params };
}
```

`FormulasProvider.compileFilters()` follows this pattern directly: collect clause strings, join with `' AND '`, collect bind values into a flat array in clause order.

---

## 4. Sorts Lexicographic Rule

Each Sort chip contributes one column reference with direction (`ASC` or `DESC`) to the SQL `ORDER BY` clause. Chips compose lexicographically by their position in the well: the first chip is the primary sort key, the second chip is the secondary sort key, and so on. (FE-RG-04)

**Rule:** Reordering chips changes sort priority. The compiler reads chips in well-position order and emits `ORDER BY column1 DIR1, column2 DIR2, ...` accordingly.

**No bind values.** Sort direction and column name are structural (not user-supplied text values), so no `?` placeholders appear in the ORDER BY clause. Column names must still be validated against the SchemaProvider allowlist (analogous to `validateFilterField()`) before being emitted into the SQL string.

---

## 5. Bind-Value Protocol (COMP-03)

Every DSL value that would otherwise appear as a literal in SQL becomes a `?` placeholder, with the value appended to the bind array in the order placeholders appear in the SQL text.

**Correct pattern:**

```
// Input chip DSL: node_type = 'note'
// Compiler output:
sql_text    = "node_type = ?"
bind_values = ['note']
```

**NEVER do this:**

```
// PROHIBITED — string concatenation embeds user input directly into SQL
sql_text = "node_type = 'note'"   // structural violation of FE-RG-02
```

**Multi-value example (multi-filter AND composition):**

```
// Chip 1: node_type = 'note'   → clause "node_type = ?",  bind ['note']
// Chip 2: source = 'apple-notes' → clause "source = ?", bind ['apple-notes']
// Composed:
sql_text    = "node_type = ? AND source = ?"
bind_values = ['note', 'apple-notes']
```

Bind values are in the same left-to-right order as the `?` placeholders appear in the SQL string. This matches how sql.js consumes them: `db.prepare(sql).bind(params)` — the bind array is positional. The compiler must never reorder the bind array relative to the placeholder sequence.

**Reference.** `FilterProvider.compile()` in `src/providers/FilterProvider.ts` is the direct structural precedent. All user-supplied values flow into `params: unknown[]`; none are concatenated into the SQL string. `FormulasProvider` follows this pattern without exception.

---

## 6. Calculation Identifier Allowlist (COMP-04)

Before emitting any SELECT clause fragment, every column reference appearing in a Calculation chip's expression must be validated against `SchemaProvider`'s runtime column set. `SchemaProvider` derives its column set from `PRAGMA table_info(cards)` at runtime — not a hardcoded list.

**Validation timing.** This check runs at compile time — before the SQL is emitted and before any query is executed. An invalid column reference produces a compile-time error surfaced in the chip-well UI, not a runtime SQL error surfaced to the user as a generic failure.

**Structural precedent.** `src/providers/allowlist.ts` provides `validateFilterField(field: string)` and `validateOperator(op: string)`, which validate against SchemaProvider-derived sets. The analogous check for Calculations applies the same pattern to column name references inside expressions:

```typescript
// Structural precedent from allowlist.ts:
export function validateFilterField(field: string): void;
// Throws if field is not in SchemaProvider's runtime column set.
// FormulasProvider applies an equivalent check to all column refs in Calculation expressions.
```

**Scope.** The allowlist validates column *references* (identifiers), not operator symbols or function names. SQL built-in functions (`UPPER`, `SUM`, `COUNT`, `RANK`, `CASE WHEN`, etc.) are not allowlisted through `SchemaProvider`; they are structural elements of the DSL grammar (WA-4's concern). The allowlist applies only to references to columns in the `cards` table.

**SchemaProvider is the source of truth.** The valid column set includes all columns returned by `PRAGMA table_info(cards)` at runtime, including dynamic columns added by the enrichment pipeline (`folder_l1`, `folder_l2`, `folder_l3`, `folder_l4`). The allowlist is never a hardcoded list — it is always derived from the live schema. (FE-RG-17)

---

## 7. Marks Post-Query Annotation Algorithm (COMP-05)

The Marks annotation pass runs after the SQL query returns a fully materialized result set. It evaluates each Marks chip's predicate against each row and accumulates CSS class names into a `Map` keyed by row ID.

**Return type (locked by FE-RG-16):** `Map<rowId, string[]>`

The `string[]` value is the list of CSS class names assigned to the row by all Marks chips. An empty list means no Marks chips matched for that row.

**Algorithm:**

```
// Pseudocode for Marks annotation

function annotateMarks(
  rows: ResultRow[],
  chips: MarksChip[]
): Map<rowId, string[]> {

  result = new Map()

  for each row in rows:
    classes = []
    for each chip in chips:
      try:
        predicateValue = evaluatePredicate(chip.predicate, row)

        if predicateValue is NULL:
          // NULL predicate column: skip this chip for this row.
          // Do NOT treat NULL as TRUE or FALSE.
          // The row is still included in the output Map with whatever classes
          // were accumulated from other chips.
          continue

        if predicateValue == TRUE:
          classes.push(chip.cssClass)

      catch PredicateEvalError:
        // Malformed DSL: skip this chip for all rows and surface the error.
        // Do NOT abort the entire annotation pass.
        // Other chips continue evaluating normally.
        markChipAsErrored(chip)
        continue

    result.set(row.id, classes)

  // INVARIANT: result.size == rows.length
  // Every input row produces exactly one output entry.
  // Marks NEVER remove rows from this Map (FE-RG-07).
  return result
}
```

**NULL handling.** When the predicate column is `NULL` for a given row, the chip produces no class for that row. The row remains in the output `Map` with an empty list (or the classes contributed by other chips). `NULL` is not treated as `FALSE` (which would be a silent exclusion) nor as `TRUE` (which would be an incorrect annotation).

**Error handling.** If evaluating a chip's predicate throws (e.g., malformed DSL, reference to a nonexistent column that slipped past allowlist validation), the error is chip-scoped: that chip is marked as errored, its predicate is skipped for all rows, and the annotation pass continues with remaining chips. The result set is never abandoned mid-pass.

**Row membership invariant.** `result.size` must equal `rows.length` after the loop. Marks never filter or remove rows. If a row has no matching Marks chips, it appears in the output `Map` with an empty `string[]`. (FE-RG-07)

---

## 8. Audits Post-Query Annotation Algorithm (COMP-06)

The Audits annotation pass is structurally parallel to the Marks pass. It runs after the SQL query returns and evaluates each Audits chip's predicate against each row, accumulating structured flag annotations.

**AuditAnnotation type:**

```
// Type definition (pseudocode)
interface AuditAnnotation {
  chipId: string;                       // which Audit chip produced this annotation
  kind: 'anomaly' | 'validation';       // Anomaly Rules vs. Validation Rules well category
  label: string;                        // human-readable flag label from chip config
}
```

**Return type:** `Map<rowId, AuditAnnotation[]>`

**Algorithm:**

```
// Pseudocode for Audits annotation

function annotateAudits(
  rows: ResultRow[],
  chips: AuditsChip[]
): Map<rowId, AuditAnnotation[]> {

  result = new Map()

  for each row in rows:
    annotations = []
    for each chip in chips:
      try:
        predicateValue = evaluatePredicate(chip.predicate, row)

        if predicateValue is NULL:
          // NULL handling same as Marks: skip this chip for this row.
          // Do NOT treat NULL as TRUE or FALSE.
          continue

        if predicateValue == TRUE:
          annotations.push({
            chipId: chip.id,
            kind: chip.category,   // 'anomaly' | 'validation'
            label: chip.label
          })

      catch PredicateEvalError:
        // Malformed DSL: skip this chip, surface chip-level error.
        // Do NOT abort the entire annotation pass.
        markChipAsErrored(chip)
        continue

    result.set(row.id, annotations)

  // INVARIANT: result.size == rows.length
  // Every input row produces exactly one output entry (possibly empty list).
  // Audits NEVER remove rows from this Map (FE-RG-08).
  return result
}
```

**NULL handling.** Identical to Marks: `NULL` predicate column means the chip produces no annotation for that row. The row remains in the output `Map`.

**Error handling.** Identical to Marks: chip-scoped errors skip the chip without aborting the pass.

**Row membership invariant.** `result.size` must equal `rows.length`. Audits surface attention; they never remove rows. If a row triggers no Audit chips, it appears in the `Map` with an empty `AuditAnnotation[]`. (FE-RG-08)

**Kind discrimination.** The `kind` field distinguishes Anomaly Rules from Validation Rules at annotation time, so the UI can render them with distinct affordances (different badge/icon) without re-examining which well the chip came from.

---

## 9. Explain Panel Contract (COMP-07)

The explain panel displays the exact `(sql_text, [bind_values])` tuple produced by the compiler — no more, no less.

**Display format:**

```
SQL:
SELECT *, UPPER(name) AS display_name
FROM cards
WHERE deleted_at IS NULL AND node_type = ? AND source = ?
ORDER BY created_at DESC

Bind values:
['note', 'apple-notes']
```

**Rules:**

1. `sql_text` is shown verbatim with `?` placeholders intact. No value substitution occurs in the display. The user sees exactly what is sent to sql.js.
2. `bind_values` is shown as a flat ordered list below the SQL. The list order matches the positional order of `?` placeholders in the SQL text — which is the order sql.js consumes them.
3. No named placeholder convention. No user-friendly rendering layer (e.g., "filter by node_type = note"). The raw tuple is the contract.
4. For multi-chip arrangements with many bind values, the list may be long. The display shows all values in order. Annotating correspondence between a specific `?` and its value is a future UX concern, not a v1 spec concern.

**Rationale (D-03).** Showing the raw tuple gives implementers and power users direct visibility into what the compiler produced, without a translation layer that could disagree with actual behavior. The simplest display is also the most honest.

---

## 9.5 Cross-Category Reference Resolution (Detail)

*(See §2.5 for the algorithm. This section confirms the explain-panel representation.)*

For a Filtered Total Calculation that embeds a Filter predicate, the explain panel shows the fully resolved SQL — the `CASE WHEN` expression — not the intermediate DSL form. Example:

```
SQL:
SELECT folder_l1, SUM(CASE WHEN source = ? THEN 1 ELSE 0 END) AS apple_notes_count
FROM cards
WHERE deleted_at IS NULL AND node_type = ?
GROUP BY folder_l1

Bind values:
['apple-notes', 'note']
```

The `CASE WHEN` bind value (`'apple-notes'`) appears before the outer Filter bind value (`'note'`) because the Calculation chip's expression is emitted into SELECT first (before WHERE in clause order), and its placeholders therefore appear earlier in the SQL text.

---

## 10. Worked Examples (COMP-08)

All examples use real Isometry schema columns per D-01: `name`, `node_type`, `source`, `created_at`, `folder_l1`, `folder_l2`, `id`. DSL fragments reference `01-three-explorer-spec.md` Appendix A per FE-RG-15.

---

### Example 1: Single Calculation (Derived Column)

**Chip arrangement:**
- Formulas / Calculations: `UPPER(name) AS display_name`

**Expected SQL (verbatim):**
```sql
SELECT *, UPPER(name) AS display_name
FROM cards
WHERE deleted_at IS NULL
```

**Bind values:** none

**Notes:** Simplest case. The Calculation adds a single expression to the SELECT clause beyond the base `SELECT *`. No Filters means only the base `deleted_at IS NULL` conjunct. No Sorts means no ORDER BY clause. This example exercises COMP-01 clause mapping and COMP-02 single-chip (no dependency graph needed).

---

### Example 2: Single Filter (Equality with Bind Value)

**Chip arrangement:**
- Formulas / Filters: `node_type = 'note'`

**Expected SQL (verbatim):**
```sql
SELECT *
FROM cards
WHERE deleted_at IS NULL AND node_type = ?
```

**Bind values:** `[?]` → `['note']`

**Notes:** Exercises the bind-value protocol (COMP-03). The string literal `'note'` from the DSL becomes the `?` placeholder in SQL and the value `'note'` in the bind array. The prohibited form (`WHERE node_type = 'note'`) would string-concatenate the value — a structural violation of FE-RG-02.

---

### Example 3: Single Sort

**Chip arrangement:**
- Formulas / Sorts: `created_at DESC`

**Expected SQL (verbatim):**
```sql
SELECT *
FROM cards
WHERE deleted_at IS NULL
ORDER BY created_at DESC
```

**Bind values:** none

**Notes:** Sort direction (`DESC`) is a structural element, not a bind value. The column name (`created_at`) is validated against the SchemaProvider allowlist (COMP-04) before being emitted into the SQL string. No Filters and no Calculations.

---

### Example 4: Multi-Filter AND Composition

**Chip arrangement:**
- Formulas / Filters (chip 1): `node_type = 'note'`
- Formulas / Filters (chip 2): `source = 'apple-notes'`

**Expected SQL (verbatim):**
```sql
SELECT *
FROM cards
WHERE deleted_at IS NULL AND node_type = ? AND source = ?
```

**Bind values:** `[?, ?]` → `['note', 'apple-notes']`

**Notes:** Exercises FE-RG-03 (AND-only composition). Two chips, two conjuncts. Bind values are ordered by chip position in the well: chip 1's value (`'note'`) appears before chip 2's value (`'apple-notes'`). Swapping chip order would swap the bind value order and the placeholder positions — the SQL text would change but the result set would be identical (commutative composition). See §3.

---

### Example 5: Multi-Sort Lexicographic Composition

**Chip arrangement:**
- Formulas / Sorts (chip 1, primary): `folder_l1 ASC`
- Formulas / Sorts (chip 2, secondary): `name ASC`

**Expected SQL (verbatim):**
```sql
SELECT *
FROM cards
WHERE deleted_at IS NULL
ORDER BY folder_l1 ASC, name ASC
```

**Bind values:** none

**Notes:** Exercises FE-RG-04 (lexicographic sort). Chip 1 (well-position 0) is the primary sort key (`folder_l1`); chip 2 (well-position 1) is the secondary key (`name`). Reordering the chips would reorder the `ORDER BY` clause and change sort priority, even though the result set membership remains the same.

---

### Example 6: Calculation + Filter Combo

**Chip arrangement:**
- Formulas / Calculations: `UPPER(name) AS display_name`
- Formulas / Filters: `node_type = 'note'`

**Expected SQL (verbatim):**
```sql
SELECT *, UPPER(name) AS display_name
FROM cards
WHERE deleted_at IS NULL AND node_type = ?
```

**Bind values:** `[?]` → `['note']`

**Notes:** Cross-category within Formulas Explorer. The Calculation contributes to SELECT; the Filter contributes to WHERE. Both chips compile independently and their outputs are composed by `QueryBuilder`. The bind values come only from the Filter chip (Calculations in this example have no bind values).

---

### Example 7: Aggregation with GROUP BY from View Context

**Chip arrangement:**
- Formulas / Calculations: `COUNT(*) AS row_count`
- View context: SuperGrid grouped by `node_type`

**Expected SQL (verbatim):**
```sql
SELECT node_type, COUNT(*) AS row_count
FROM cards
WHERE deleted_at IS NULL
GROUP BY node_type
```

**Bind values:** none

**Notes:** Exercises FE-RG-01. The `GROUP BY node_type` clause comes from SuperGrid's PAFV configuration — NOT from `FormulasProvider`. The Calculation chip only contributes `COUNT(*) AS row_count` to the SELECT clause. If the user switches to a flat list view with no grouping, the same chip produces `SELECT *, COUNT(*) AS row_count FROM cards WHERE deleted_at IS NULL` — no GROUP BY. The same Calculation chip, different view context, different SQL. `FormulasProvider` never emits a GROUP BY clause under any circumstances.

---

### Example 8: Window Function

**Chip arrangement:**
- Formulas / Calculations: `RANK() OVER (PARTITION BY source ORDER BY created_at DESC) AS source_rank`

**Expected SQL (verbatim):**
```sql
SELECT *, RANK() OVER (PARTITION BY source ORDER BY created_at DESC) AS source_rank
FROM cards
WHERE deleted_at IS NULL
```

**Bind values:** none

**Notes:** Window functions are SELECT-clause expressions like other Calculations. The `OVER (PARTITION BY ... ORDER BY ...)` clause is part of the expression, not a separate SQL clause. `FormulasProvider` emits it as a single SELECT fragment. The `PARTITION BY source` and `ORDER BY created_at DESC` inside the window clause are structural elements — no bind values. Columns (`source`, `created_at`) are validated against the SchemaProvider allowlist (COMP-04).

---

### Example 9: Cross-Category Reference (Filtered Totals)

**Chip arrangement:**
- Formulas / Calculations: `SUM(CASE WHEN source = 'apple-notes' THEN 1 ELSE 0 END) AS apple_notes_count`
- Formulas / Filters: `node_type = 'note'`
- View context: SuperGrid grouped by `folder_l1`

**Expected SQL (verbatim):**
```sql
SELECT folder_l1, SUM(CASE WHEN source = ? THEN 1 ELSE 0 END) AS apple_notes_count
FROM cards
WHERE deleted_at IS NULL AND node_type = ?
GROUP BY folder_l1
```

**Bind values:** `[?, ?]` → `['apple-notes', 'note']`

**Notes:** Exercises cross-category reference resolution (§2.5). The Calculation embeds a filter predicate inline using `CASE WHEN`. The filter predicate's bind value (`'apple-notes'`) is appended to the params array first because the SELECT clause is assembled before the WHERE clause — placeholder order follows SQL clause order. The outer Filter's bind value (`'note'`) appears second. The `GROUP BY folder_l1` comes from SuperGrid, not from FormulasProvider (FE-RG-01). This is the "Filtered Totals" example from `01-three-explorer-spec.md` Appendix A (Example 8).

---

### Example 10: Dependency Cycle Error

**Chip arrangement:**
- Formulas / Calculations (chip A): `B_col + 1 AS A_col` — references output alias `B_col` from chip B
- Formulas / Calculations (chip B): `A_col - 1 AS B_col` — references output alias `A_col` from chip A

**Expected compiler output:**
- Error — no SQL produced
- `CycleError: { kind: 'CycleError', participants: ['chip-A-id', 'chip-B-id'], message: 'Dependency cycle detected: chip-A-id <-> chip-B-id' }`

**Bind values:** none (error path; no SQL emitted)

**Notes:** Both chips reference each other's output alias, forming a cycle of length 2. Kahn's algorithm (§2) detects this when `sorted.length < chips.length` after the BFS pass — chips A and B remain with `inDegree > 0`. The `CycleError.participants` array carries both chip IDs so the chip-well UI can highlight them. The user must break the cycle (e.g., rename one alias or remove one chip) before compilation can proceed. This is the compile-time error form of FE-RG-05.

---

## Appendix: Regression Guards (GARD-03, GARD-04)

Guards new to this document appear first. Guards from `01-three-explorer-spec.md` that this pipeline spec reinforces are listed below with cross-references.

### New Guards (this document)

| ID | Guard Statement | Rationale | Verification Check |
|----|-----------------|-----------|-------------------|
| FE-RG-16 | Marks annotation return type is `Map<rowId, string[]>`. CSS class arrays are the only Marks output shape. | Richer objects (e.g., `Map<rowId, { classes: string[], opacity: number }>`) would break the view-layer-only constraint — they would mix rendering data into the annotation contract. CSS class strings are theme-agnostic and view-layer safe. | `grep "Map<rowId, string\[\]>" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` returns match |
| FE-RG-17 | Column references in Calculation expressions must be validated against SchemaProvider's runtime `PRAGMA table_info()` result before compilation. | Prevents invalid column names from reaching SQL execution; fail at compile time, not runtime. A runtime failure surfaces as a generic SQL error; a compile-time failure surfaces as a chip-level error with actionable context. | `grep "SchemaProvider.*table_info" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` returns match |

### Reinforced Guards (from `01-three-explorer-spec.md`)

These guards were first established in `01-three-explorer-spec.md` Appendix B. This pipeline spec reinforces them through its algorithm definitions.

| ID | Guard Statement | Reinforced By |
|----|-----------------|---------------|
| FE-RG-01 | Formulas Explorer never owns `GROUP BY`. | §1 invariant; Examples 7, 9 explicitly show GROUP BY from view context. |
| FE-RG-02 | The DSL→SQL compiler produces `(sql_text, [bind_values])` tuples. No string concatenation of user input into SQL. | §5 bind-value protocol; all examples with predicates show `?` placeholders and bind arrays. |
| FE-RG-03 | Filters compose by AND only across chips. OR lives inside a single chip's DSL. | §3; Example 4 shows multi-chip AND composition. |
| FE-RG-04 | Sorts compose lexicographically by chip order. | §4; Example 5 shows two chips producing `ORDER BY folder_l1 ASC, name ASC`. |
| FE-RG-05 | Calculations form a dependency DAG. Cycles are compile-time errors with chip-well visualization. | §2 algorithm with CycleError type; Example 10 shows the cycle error path. |
| FE-RG-07 | Marks never alter the result set's row membership. | §7 algorithm invariant: `result.size == rows.length`. |
| FE-RG-08 | Audits never alter the result set's row membership. | §8 algorithm invariant: `result.size == rows.length`. |

---

*End of `02-compilation-pipeline.md`*
*Version 1.0 — Phase 184, Plan 01*
*Canonical source: `.planning/formulas-explorer-handoff-v2.md`*
