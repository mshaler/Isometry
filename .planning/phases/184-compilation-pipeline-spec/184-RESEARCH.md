# Phase 184: Compilation Pipeline Spec - Research

**Researched:** 2026-04-27
**Domain:** Specification writing — SQL compilation pipeline, dependency graphs, bind-value protocol, post-query annotation algorithms
**Confidence:** HIGH

## Summary

Phase 184 produces a single specification document (`02-compilation-pipeline.md`) that formalizes the chip-arrangement-to-SQL compilation algorithm in enough detail that a future implementer can write the compiler from it alone. The deliverable is pure prose and pseudocode — no code ships.

The compilation pipeline is not a new architectural invention. It operationalizes decisions already locked in Phase 182 (`01-three-explorer-spec.md`) and Phase 183 (`06-chip-well-geometry.md`). The spec has seven logical sections: SQL clause order mapping, Calculations dependency graph, Filters AND-composition, Sorts lexicographic rule, bind-value protocol, Marks post-query annotation, Audits post-query annotation, and the explain panel contract. These are backed by 10 worked examples using real Isometry schema columns.

The primary structural anchor in the codebase is `FilterProvider.compile()` → `CompiledFilter { where: string, params: unknown[] }` which already implements the `(sql_text, [bind_values])` tuple pattern. `QueryBuilder` is the sole SQL assembly point and represents the integration target for `FormulasProvider`. The spec documents the algorithm, not the code — but it must describe the pattern in enough detail that the code can follow it unambiguously.

**Primary recommendation:** Write the spec in section order matching WA-2's description in the handoff. Each section should be complete enough to stand alone. Worked examples come last and exercise all sections in combination.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All 10 worked examples use real Isometry schema columns (name, node_type, source, created_at, folder_l1, etc.) — grounded in the actual cards table, not abstract placeholders.
- **D-02:** The 10 scenarios are:
  1. Single Calculation (derived column): `UPPER(name) AS display_name`
  2. Single Filter (equality): `node_type = ?`
  3. Single Sort: `ORDER BY created_at DESC`
  4. Multi-filter AND composition: `node_type = ? AND source = ?`
  5. Multi-sort lexicographic: `ORDER BY folder_l1 ASC, name ASC`
  6. Calculation + Filter combo: derived column + WHERE predicate together
  7. Aggregation requiring GROUP BY from view: `COUNT(*) AS row_count` (GROUP BY comes from SuperGrid, not Formulas)
  8. Window function: `RANK() OVER (PARTITION BY source ORDER BY created_at DESC)`
  9. Cross-category reference (Filtered Totals): a SUM that applies only to filtered rows
  10. Dependency cycle error: two Calculations that reference each other -> CycleError
- **D-03:** Explain panel shows raw SQL with `?` placeholders — the literal `(sql_text, [bind_values])` tuple the compiler produces. No named placeholder convention, no user-friendly rendering layer.
- **D-04:** Annotation algorithms specified as pseudocode with explicit iteration over the result set. Includes: null handling (what happens when a predicate column is NULL), predicate evaluation error handling (malformed DSL — skip chip and surface error vs. abort), and the explicit prohibition against filtering rows. Unambiguous enough for an implementer to code from.
- **D-05:** Spec explicitly references `FilterProvider.compile()` and `QueryBuilder` as the structural precedent. States that `FormulasProvider` should follow the same `(sql, params)` tuple shape. Notes where the new pipeline extends the pattern (dependency graph for Calculations, post-query annotation for Marks/Audits).

**Carried Forward (Locked from Phase 182):**
- Fixed SQL clause mapping: Calculations -> SELECT, Filters -> WHERE, Sorts -> ORDER BY (FE-RG-01)
- GROUP BY always comes from the view explorer, never Formulas (FE-RG-01)
- Filter AND-composition, no implicit OR across chips (FE-RG-03)
- Sort lexicographic by chip position (FE-RG-04)
- Calculation DAG with cycle detection (FE-RG-05)
- Cross-category references exist and are resolved by compilation pipeline (D-04 Phase 182)
- Marks v1: class assignment only, predicate -> CSS class (STATE.md)
- Marks annotation return type: `Map<rowId, string[]>` (FE-RG-16)
- Calculation identifier allowlist against SchemaProvider (FE-RG-17)
- Bind-value protocol: every DSL value produces `(placeholder, bind_value)`, never string concatenation (COMP-03)
- ChipWellOutputContract is the seam interface consumed by this pipeline (Phase 183, GEOM-05)

### Claude's Discretion

- Internal document structure (heading order, section breaks) — follow the WA-2 artifact description from the handoff
- Pseudocode style and notation for dependency graph and annotation algorithms
- Level of detail in edge case enumeration beyond the explicitly decided areas (null handling, error handling)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | Fixed SQL clause order mapping (Calculations → SELECT, Filters → WHERE, Sorts → ORDER BY) with GROUP BY from view explorer | Locked in Phase 182 FE-RG-01; `01-three-explorer-spec.md` §Cross-Explorer Composition table is the canonical declaration. Spec formalizes with a complete clause-order table covering SELECT/FROM/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT/post-query annotations. |
| COMP-02 | Calculations dependency graph algorithm with pseudocode (topological sort, cycle detection, CycleError type with participants) | Phase 182 identified the DAG rule; Phase 184 must supply the algorithm. Kahn's algorithm is the standard approach for topological sort with cycle detection. CycleError must carry a `participants: string[]` field listing the chip identifiers in the cycle. |
| COMP-03 | Bind-value protocol: every DSL value produces parameter placeholder + bind value, never string concatenation | `FilterProvider.compile()` is the direct precedent — all values go into `params: unknown[]`, never interpolated. Spec must state this as a structural guard (FE-RG-17 equivalent). |
| COMP-04 | Calculation identifier allowlist step specified (column names validated against SchemaProvider, not just values) | `allowlist.ts` is the precedent (`validateFilterField()`, `validateOperator()`). For Calculations, the allowlist validates column references in expressions, not operators. SchemaProvider is the source of truth via PRAGMA table_info(). |
| COMP-05 | Marks post-query annotation algorithm: predicates produce `Map<rowId, string[]>` CSS class assignments, never filter rows | Return type locked by FE-RG-16. Algorithm iterates result set rows, evaluates each chip's predicate per row, accumulates class names. Must address null predicate column handling. |
| COMP-06 | Audits post-query annotation algorithm: predicates produce flag/badge annotations per row | Parallel structure to Marks. Return type is `Map<rowId, AuditAnnotation[]>` (analogous but for flags/warnings distinguishing anomaly vs. validation). Must address null handling. |
| COMP-07 | Explain panel contract: compiled SQL shown with bind-value placeholders | D-03 locks this: show the raw `(sql_text, [bind_values])` tuple. `?` placeholders remain as-is — no substitution in the display. No user-friendly rendering needed. |
| COMP-08 | 10 worked chip-arrangement-to-SQL examples with expected output verbatim | All 10 scenarios locked by D-02. Each example must show: chip arrangement description, expected SQL output verbatim (including `?` placeholders where bind values appear), and the corresponding bind values list. |
| GARD-03 | FE-RG-16 (Marks annotation return type `Map<rowId, string[]>`) documented as structural guard | Already locked in FE-RG-16. Spec must include this in a Regression Guards section with ID, guard statement, rationale, and grep-able verification check (same format as Phase 182 guards table). |
| GARD-04 | FE-RG-17 (Calculation identifier allowlist against SchemaProvider) documented as structural guard | Must be added to the guards table with the same format. Guard: "Column references in Calculation expressions must be validated against SchemaProvider's runtime PRAGMA table_info() result before compilation." |
</phase_requirements>

---

## Standard Stack

This phase produces a Markdown specification document. No libraries or packages are installed.

### Core
| Asset | Version | Purpose | Why Standard |
|-------|---------|---------|--------------|
| Markdown (.md) | — | Specification artifact | All v15.0 deliverables are .md files per STATE.md locked decision |
| Pseudocode (informal) | — | Algorithm specification | Implementation-language-agnostic; planner's discretion per CONTEXT.md |

### Supporting — Codebase References (read-only)
| File | Purpose in Spec |
|------|----------------|
| `src/providers/FilterProvider.ts` | Structural precedent for `(sql, params)` tuple pattern; `compile()` → `CompiledFilter` |
| `src/providers/QueryBuilder.ts` | Integration target; `CompiledQuery { sql: string, params: unknown[] }` type is the output shape |
| `src/providers/allowlist.ts` | Precedent for identifier allowlist (`validateFilterField`, `validateOperator`) |
| `src/providers/types.ts` | `CompiledFilter`, `Filter`, `FilterOperator`, `KnownFilterField` type definitions |
| `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | Upstream spec; compilation pipeline operationalizes its declarations |
| `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` | ChipWellOutputContract seam interface (§4 data binding, §9 composition) |

**Installation:** None — this is a spec-writing phase.

---

## Architecture Patterns

### Recommended Document Structure

Following WA-2's description in the handoff document (`.planning/formulas-explorer-handoff-v2.md` §WA-2):

```
02-compilation-pipeline.md
├── Preamble (relationship to 01-three-explorer-spec.md, structural precedent)
├── §1 Fixed SQL Clause Order Mapping
├── §2 Calculations Dependency Graph Algorithm
├── §3 Filters AND-Composition Rule
├── §4 Sorts Lexicographic Rule
├── §5 Bind-Value Protocol (FE-RG-02 / structural guard)
├── §6 Calculation Identifier Allowlist (COMP-04 / GARD-04)
├── §7 Marks Post-Query Annotation Algorithm
├── §8 Audits Post-Query Annotation Algorithm
├── §9 Explain Panel Contract
├── §10 Worked Examples (10 scenarios per D-02)
└── Appendix: Regression Guards (FE-RG-16, FE-RG-17 as new entries)
```

### Pattern 1: SQL Clause Order Table

**What:** A table mapping chip well categories to SQL clauses, with source and notes columns — exactly as established in `01-three-explorer-spec.md` §Cross-Explorer Composition.
**When to use:** Opening section of the spec; the authoritative mapping that all other sections extend.

```markdown
| Clause    | Source                              | Notes                                  |
|-----------|-------------------------------------|----------------------------------------|
| SELECT    | Formulas / Calculations             | Derived cols, aggregations, windows    |
| FROM      | Data layer (cards table)            | Static; not chip-controlled            |
| WHERE     | Formulas / Filters                  | AND-composed across chips              |
| GROUP BY  | Active view explorer (SuperGrid)    | Never owned by Formulas (FE-RG-01)    |
| HAVING    | View explorer (if needed)           | Not chip-controlled at v1              |
| ORDER BY  | Formulas / Sorts                    | Chip-position-ordered                  |
| LIMIT     | View explorer / pagination          | Not chip-controlled at v1              |
| Post-query CSS   | Marks / Conditional encoding | Evaluated after query returns          |
| Post-query flags | Audits / Anomaly + Validation | Evaluated after query returns          |
```

### Pattern 2: Topological Sort with Cycle Detection (Kahn's Algorithm)

**What:** Standard Kahn's algorithm on the Calculations dependency DAG. Processes chips with in-degree 0 first; detects cycles by checking for unprocessed nodes after the loop terminates.
**When to use:** §2 Calculations Dependency Graph Algorithm.

```
// Pseudocode for Calculation dependency resolution

function compileDependencyGraph(chips: CalculationChip[]): Result<CompiledChip[], CycleError> {
  // Step 1: Build adjacency list and in-degree map
  inDegree = Map<chipId, number>   // count of dependencies
  dependents = Map<chipId, chipId[]>  // which chips depend on this one
  
  for each chip in chips:
    inDegree[chip.id] = 0
    dependents[chip.id] = []
  
  for each chip in chips:
    for each ref in chip.columnReferences:
      if ref is another chip's output alias:
        // chip depends on refChip
        inDegree[chip.id] += 1
        dependents[refChip.id].push(chip.id)
  
  // Step 2: Kahn's BFS topological sort
  queue = chips where inDegree[chip.id] == 0
  sorted = []
  
  while queue is not empty:
    current = queue.dequeue()
    sorted.push(current)
    for each dependent of current:
      inDegree[dependent] -= 1
      if inDegree[dependent] == 0:
        queue.enqueue(dependent)
  
  // Step 3: Cycle detection
  if sorted.length < chips.length:
    cycleParticipants = chips where inDegree[chip.id] > 0
    return Error(CycleError { participants: cycleParticipants.map(c => c.id) })
  
  return Ok(sorted)
}
```

### Pattern 3: CycleError Type

**What:** Structured error type carrying the participant chip identifiers for UI visualization.
**When to use:** §2 and the Regression Guards appendix.

```typescript
// Type definition for the spec (pseudocode — not implementation code)
interface CycleError {
  kind: 'CycleError';
  participants: string[];  // chip IDs forming the cycle
  message: string;         // human-readable description
}
```

### Pattern 4: Bind-Value Protocol

**What:** Every DSL value that would otherwise be string-interpolated into SQL becomes a `?` placeholder, with the value appended to the bind array.
**When to use:** §5 and every worked example that includes user-supplied values.

```
// Correct — produces (sql_text, [bind_values])
// Input: node_type = 'note'
// Output:
sql_text = "node_type = ?"
bind_values = ['note']

// Structural guard violation — NEVER do this
// sql_text = "node_type = 'note'"   ← string concatenation, prohibited
```

This mirrors `FilterProvider.compile()` exactly:
```typescript
// From FilterProvider.ts — the structural precedent
compile(): CompiledFilter {
  const clauses: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  // ... all user values go into params, never into the SQL string
  return { where: clauses.join(' AND '), params };
}
```

### Pattern 5: Marks Post-Query Annotation Algorithm

**What:** Iterate the SQL result set rows; for each row, evaluate each Marks chip predicate; accumulate CSS class strings into a Map keyed by row ID.
**When to use:** §7 Marks Post-Query Annotation Algorithm.

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
          // NULL predicate column: skip this chip for this row
          // Do NOT treat NULL as TRUE or FALSE
          continue
        if predicateValue == TRUE:
          classes.push(chip.cssClass)
      catch PredicateEvalError:
        // Malformed DSL chip: skip this chip, surface chip-level error
        // Do NOT abort the entire annotation pass
        markChipAsErrored(chip)
        continue
    result.set(row.id, classes)
  
  // INVARIANT: result.size == rows.length (every row in, every row out)
  // Marks NEVER remove rows from this map (FE-RG-07)
  return result
}
```

### Pattern 6: Audits Post-Query Annotation Algorithm

**What:** Parallel structure to Marks but produces flag/badge metadata rather than CSS classes. Returns `Map<rowId, AuditAnnotation[]>`.
**When to use:** §8 Audits Post-Query Annotation Algorithm.

```
// AuditAnnotation type (pseudocode)
interface AuditAnnotation {
  chipId: string;
  kind: 'anomaly' | 'validation';
  label: string;   // human-readable flag label from chip config
}

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
          continue  // null handling same as Marks
        if predicateValue == TRUE:
          annotations.push({
            chipId: chip.id,
            kind: chip.category,  // 'anomaly' | 'validation'
            label: chip.label
          })
      catch PredicateEvalError:
        markChipAsErrored(chip)
        continue
    result.set(row.id, annotations)
  
  // INVARIANT: result.size == rows.length (every row in, every row out)
  // Audits NEVER remove rows from this map (FE-RG-08)
  return result
}
```

### Pattern 7: Worked Example Format

**What:** Each of the 10 examples follows a consistent structure: chip arrangement → expected SQL → bind values.
**When to use:** §10 throughout.

```markdown
### Example N: [Scenario Name]

**Chip arrangement:**
- [Explorer] / [Well]: `[DSL fragment]`

**Expected SQL (verbatim):**
\`\`\`sql
SELECT [columns]
FROM cards
WHERE [predicates]
ORDER BY [columns]
\`\`\`

**Bind values:** `[?, ?]` → `['value1', 'value2']`

**Notes:** [Any edge case or rule illustrated by this example]
```

### Anti-Patterns to Avoid

- **String concatenation in SQL construction:** Any code path that builds SQL by concatenating user-provided values is a structural violation of FE-RG-02. The spec must prohibit this explicitly, not just discourage it.
- **GROUP BY in FormulasProvider:** The spec must not show FormulasProvider emitting a GROUP BY clause in any worked example. GROUP BY always comes from the view explorer context.
- **Marks/Audits returning a filtered result set:** Both annotation algorithms must produce a Map with the same number of entries as input rows. Filtering is prohibited by FE-RG-07/FE-RG-08 and must be called out explicitly in the algorithm pseudocode as an invariant check.
- **Unsigned cycle detection:** The CycleError must name the specific participant chips (not just "a cycle was detected") so the chip well UI can visualize which chips are involved.
- **Cross-WA example drift:** Any DSL example in the spec must be drawn verbatim from `01-three-explorer-spec.md` Appendix A. No independent re-derivation. (FE-RG-15)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Topological sort | Custom DFS-based sort | Document Kahn's algorithm | Kahn's handles cycle detection as a natural consequence; DFS requires separate bookkeeping |
| Bind-value pattern | Document the concept abstractly | Reference FilterProvider.compile() directly | Concrete codebase precedent is more useful than abstract description |
| Marks return type | Define a new interface | Use the locked FE-RG-16 type `Map<rowId, string[]>` | Already decided; doc must match |
| Annotation algorithm | Invent a streaming approach | Document batch iteration over the result set | The result set is already fully materialized when annotation runs |

**Key insight:** The spec is not inventing new algorithms — it is formalizing decisions already locked in Phase 182. The planning task is to translate locked decisions into unambiguous pseudocode and worked examples, not to design new approaches.

---

## Common Pitfalls

### Pitfall 1: Missing NULL Handling in Annotation Algorithms
**What goes wrong:** Annotation algorithms omit what happens when the predicate column is NULL for a row. An implementer writes `if (value === true)` which in JavaScript silently skips NULL without documenting the intent.
**Why it happens:** NULL handling feels like an implementation detail, not a spec concern.
**How to avoid:** D-04 explicitly requires NULL handling in the annotation pseudocode. Spec must state: "If the predicate column is NULL for a row, the chip produces no annotation for that row. The row is still included in the output Map with an empty list."
**Warning signs:** Algorithm pseudocode that contains only `if predicateValue == TRUE` without a NULL branch.

### Pitfall 2: Worked Example Missing Bind Values
**What goes wrong:** Worked examples show the SQL text but omit the bind values list. A reader cannot hand-trace the full compiler output.
**Why it happens:** The SQL text is the visually salient part; bind values feel auxiliary.
**How to avoid:** Each example must show both: the SQL string with `?` placeholders AND the corresponding `['value1', ...]` array.
**Warning signs:** Examples with WHERE clauses that have no accompanying bind values list.

### Pitfall 3: Dependency Graph Pseudocode Missing the Cycle Output
**What goes wrong:** Pseudocode shows the topological sort succeeding but does not show the cycle error path — leaving the CycleError type and its format undefined.
**Why it happens:** The happy path is easier to write.
**How to avoid:** COMP-02 and worked Example 10 (D-02) both require the cycle path. Pseudocode must include the branch that fires when `sorted.length < chips.length` and must show the CycleError with `participants: string[]`.
**Warning signs:** Pseudocode with no error return path.

### Pitfall 4: Explain Panel Section Missing the Tuple Format
**What goes wrong:** The explain panel section describes what SQL looks like but not that it is a tuple `(sql_text, [bind_values])` — leaving the exact display format ambiguous.
**Why it happens:** D-03 is clear but might be read as "show the SQL" rather than "show the tuple."
**How to avoid:** The section must explicitly state: display = `(sql_text, [bind_values])` tuple; bind values shown as a bracketed list below the SQL; no value substitution in the SQL text itself.
**Warning signs:** Section that describes SQL display without mentioning bind values at all.

### Pitfall 5: Cross-Category Reference Algorithm Not Specified
**What goes wrong:** The Filtered Totals example (Example 9) requires the spec to explain how a Calculation that references a Filter predicate becomes SQL. Without an explicit resolution algorithm, Example 9 cannot be worked.
**Why it happens:** Cross-category references were deferred in WA-1 to WA-2 — but WA-2 must actually deliver the resolution algorithm.
**How to avoid:** §2 (or a dedicated §2.5) must state how cross-category references are resolved: the Calculation chip may embed a WHERE-subexpression inline using SQL subquery syntax (e.g., `SUM(CASE WHEN <filter_predicate> THEN column ELSE 0 END)`), with the filter predicate's bind values appended to the outer query's params.
**Warning signs:** Example 9 in the worked examples section that uses `[WHERE company = 'MSFT']` notation without a resolution algorithm preceding it.

### Pitfall 6: FE-RG-16 and FE-RG-17 Not in the Guards Table
**What goes wrong:** GARD-03 and GARD-04 require these two guards to appear as structural guards in the spec. A plan that writes the spec body but forgets to add these to the guards table will fail verification.
**Why it happens:** Guards feel like meta-content appended after the main spec.
**How to avoid:** Include a Regression Guards section in the spec (matching the table format from `01-three-explorer-spec.md` Appendix B). FE-RG-16 and FE-RG-17 must both appear with ID, guard statement, rationale, and grep-able verification check.
**Warning signs:** Spec body complete but guards section absent or missing FE-RG-16/FE-RG-17.

---

## Code Examples

### FilterProvider.compile() — The Structural Precedent

```typescript
// Source: src/providers/FilterProvider.ts
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

The spec must explicitly name this as the precedent and state that `FormulasProvider.compile()` follows the same `(sql, params)` tuple shape, extended with SELECT and ORDER BY fragments alongside the WHERE fragment.

### QueryBuilder — Integration Shape

```typescript
// Source: src/providers/QueryBuilder.ts
export interface CompiledQuery {
  sql: string;
  params: unknown[];
}
```

FormulasProvider's compiled output eventually feeds into a QueryBuilder-like assembly point. The spec need not design that integration (that is a future code phase), but should name QueryBuilder as the downstream consumer and note the `{ sql, params }` shape it expects.

### Allowlist Pattern — Identifier Validation

```typescript
// Source: src/providers/allowlist.ts (structural precedent for COMP-04)
// validateFilterField() checks field names against SchemaProvider-derived set
// The analogous check for Calculations validates column references in expressions
```

### Worked Example 10 Format — Cycle Error

```markdown
### Example 10: Dependency Cycle Error

**Chip arrangement:**
- Formulas / Calculations: `B_col = A_col + 1 AS B_col`  (chip A)
- Formulas / Calculations: `A_col = B_col - 1 AS A_col`  (chip B — depends on chip A's output)

**Expected compiler output:**
- Error (no SQL produced)
- CycleError: { participants: ['chip-A-id', 'chip-B-id'] }

**Bind values:** none (error path; no SQL emitted)

**Notes:** Both chips reference each other's output alias, forming a cycle of length 2.
The chip well UI must highlight both chips as participants in the cycle.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single Formulas Explorer (5 chip categories bundled) | Three peer explorers (Formulas/Marks/Audits, cleanly separated) | Phase 182 | Compilation pipeline now has clear phase boundaries: SQL fragments vs. post-query annotation |
| Abstract placeholder columns in examples | Real Isometry schema columns (name, node_type, source, created_at, folder_l1) | D-01 (Phase 184 context) | Worked examples are immediately verifiable against the live codebase |
| FilterProvider as sole compile pattern | FilterProvider + FormulasProvider (forthcoming) both producing `(sql, params)` tuples | Phase 184 spec (design time) | QueryBuilder extension point is identified; integration architecture is stable |

---

## Open Questions

1. **Cross-category reference resolution algorithm detail**
   - What we know: Example 9 (Filtered Totals) requires a SUM that applies only to filtered rows. The spec must show how a Calculation that embeds a Filter predicate resolves to SQL.
   - What's unclear: Whether the resolution is (a) a `FILTER (WHERE ...)` clause (SQLite 3.25+ supports this), (b) a `CASE WHEN predicate THEN value ELSE 0 END` inline, or (c) a subquery `SELECT SUM(col) FROM cards WHERE predicate`.
   - Recommendation: Use `SUM(CASE WHEN <predicate> THEN col ELSE 0 END)` — it is most broadly compatible with existing sql.js usage and avoids introducing `FILTER (WHERE ...)` syntax that may require version awareness. The spec should commit to one form and use it verbatim in Example 9. Since the DSL design is deferred, the spec can document the SQL output shape without requiring the DSL to support it explicitly today.

2. **Audits annotation return type name**
   - What we know: Marks return type is locked as `Map<rowId, string[]>` (FE-RG-16). Audits return type is analogous but carries structured flag metadata.
   - What's unclear: Whether the Audits annotation type should be named `AuditAnnotation` (a new interface) or something else.
   - Recommendation: Name it `AuditAnnotation` with `kind: 'anomaly' | 'validation'` and `label: string`. This is Claude's discretion per CONTEXT.md.

3. **Bind values rendering in explain panel for multi-chip arrangements**
   - What we know: D-03 says show the raw tuple. With 5+ chips and 10+ bind values, the bracketed list may be long.
   - What's unclear: Whether to show a flat list `['MSFT', '2025-01-01', '2025-12-31', ...]` or annotate which bind value corresponds to which `?`.
   - Recommendation: Show the flat ordered list (matches how sql.js actually consumes it). Annotating correspondence is a future UX concern, not a spec concern now.

---

## Environment Availability

Step 2.6: SKIPPED — this phase produces a Markdown specification document. No external tool dependencies, no code execution, no build system, no test runner invocation.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

However, Phase 184 produces **only a specification document** (`02-compilation-pipeline.md`). There is no executable code to test. The validation approach is structural review, not automated test execution.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing, no new setup needed) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | SQL clause order table present with all 8 rows | manual | grep check: `grep "GROUP BY" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |
| COMP-02 | Dependency graph pseudocode with CycleError | manual | grep check: `grep "CycleError" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |
| COMP-03 | Bind-value protocol section present | manual | grep check: `grep "bind.value" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |
| COMP-04 | Allowlist step for Calculations specified | manual | grep check: `grep "SchemaProvider" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |
| COMP-05 | Marks annotation pseudocode with `Map<rowId, string[]>` return | manual | grep check: `grep "Map<rowId" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |
| COMP-06 | Audits annotation pseudocode with flag/badge metadata | manual | grep check: `grep "AuditAnnotation" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |
| COMP-07 | Explain panel contract section showing `(sql_text, [bind_values])` tuple | manual | grep check: `grep "sql_text" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |
| COMP-08 | Exactly 10 worked examples present | manual | grep check: `grep -c "^### Example" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` returns 10 | ❌ Wave 0 (spec file) |
| GARD-03 | FE-RG-16 in guards table | manual | grep check: `grep "FE-RG-16" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |
| GARD-04 | FE-RG-17 in guards table | manual | grep check: `grep "FE-RG-17" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` | ❌ Wave 0 (spec file) |

### Sampling Rate

- **Per task commit:** grep checks above (all are sub-second)
- **Per wave merge:** All grep checks green
- **Phase gate:** All grep checks green + human review of spec completeness before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `.planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` — the spec document itself (the primary deliverable)

*(No test infrastructure gaps — this phase writes a spec, not code. The grep checks listed above are the verification mechanism.)*

---

## Sources

### Primary (HIGH confidence)
- `.planning/formulas-explorer-handoff-v2.md` §WA-2 — canonical description of what `02-compilation-pipeline.md` must contain
- `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` — upstream spec; all compilation decisions originate here
- `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` §4 (data binding), §9 (composition) — ChipWellOutputContract seam
- `src/providers/FilterProvider.ts` — structural precedent for `(sql, params)` tuple pattern
- `src/providers/QueryBuilder.ts` — integration target and `CompiledQuery` type shape
- `src/providers/allowlist.ts` — identifier allowlist precedent for COMP-04
- `src/providers/types.ts` — `CompiledFilter`, `Filter`, type definitions
- `.planning/phases/184-compilation-pipeline-spec/184-CONTEXT.md` — all 5 implementation decisions (D-01 through D-05)
- `.planning/REQUIREMENTS.md` — COMP-01 through COMP-08, GARD-03, GARD-04 acceptance criteria

### Secondary (MEDIUM confidence)
- Kahn's algorithm (topological sort with cycle detection) — standard computer science algorithm; applicable directly to Calculations DAG

### Tertiary (LOW confidence)
- None

---

## Project Constraints (from CLAUDE.md)

- **Simplicity First:** Minimum content that satisfies the requirements. No speculative sections, no extra edge cases beyond what D-04 explicitly requires.
- **Surgical Changes:** The spec document must not revisit or contradict decisions already locked in Phase 182 (`01-three-explorer-spec.md`). It operationalizes; it does not re-litigate.
- **Goal-Driven Execution:** Success criteria for each requirement are grep-verifiable (see Validation Architecture section). The plan should state these as success checks.
- **No cross-WA example drift:** All DSL examples must reference Appendix A of `01-three-explorer-spec.md` verbatim per FE-RG-15.

---

## Metadata

**Confidence breakdown:**
- Spec structure: HIGH — WA-2 description in handoff is explicit about all required sections
- Algorithm pseudocode: HIGH — Kahn's algorithm is well-established; the annotation algorithm structure follows directly from locked return types
- Worked examples: HIGH — all 10 scenarios and column names are locked in D-01/D-02
- Cross-category reference resolution (Example 9): MEDIUM — approach recommended (CASE WHEN) but not yet confirmed by a human decision; flagged in Open Questions

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable spec domain; no external dependencies)
