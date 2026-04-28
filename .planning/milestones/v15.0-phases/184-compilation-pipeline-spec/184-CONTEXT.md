# Phase 184: Compilation Pipeline Spec - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the complete chip-arrangement-to-SQL compilation pipeline as `02-compilation-pipeline.md`. Covers: fixed SQL clause order mapping, Calculations dependency graph algorithm (topological sort, cycle detection), bind-value protocol, Marks post-query annotation algorithm, Audits post-query annotation algorithm, explain panel contract, and 10 worked chip-arrangement-to-SQL examples. Deliverable is a spec document, no code. All outputs land in `.planning/milestones/v15.0-formulas-explorer/`.

</domain>

<decisions>
## Implementation Decisions

### Worked Examples (COMP-08)
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

### Explain Panel (COMP-07)
- **D-03:** Explain panel shows raw SQL with `?` placeholders — the literal `(sql_text, [bind_values])` tuple the compiler produces. No named placeholder convention, no user-friendly rendering layer. Simplest to spec and matches the compiler's actual output shape.

### Marks/Audits Annotation (COMP-05, COMP-06)
- **D-04:** Annotation algorithms specified as pseudocode with explicit iteration over the result set. Includes: null handling (what happens when a predicate column is NULL), predicate evaluation error handling (malformed DSL — skip chip and surface error vs. abort), and the explicit prohibition against filtering rows. Unambiguous enough for an implementer to code from.

### Relationship to Existing Code (structural precedent)
- **D-05:** Spec explicitly references `FilterProvider.compile()` and `QueryBuilder` as the structural precedent. States that `FormulasProvider` should follow the same `(sql, params)` tuple shape. Notes where the new pipeline extends the pattern (dependency graph for Calculations, post-query annotation for Marks/Audits). Gives implementers a concrete anchor in the existing codebase.

### Carried Forward (Locked)
- Fixed SQL clause mapping: Calculations -> SELECT, Filters -> WHERE, Sorts -> ORDER BY (Phase 182, FE-RG-01)
- GROUP BY always comes from the view explorer, never Formulas (Phase 182, FE-RG-01)
- Filter AND-composition, no implicit OR across chips (Phase 182, FE-RG-03)
- Sort lexicographic by chip position (Phase 182, FE-RG-04)
- Calculation DAG with cycle detection (Phase 182, FE-RG-05)
- Cross-category references exist and are resolved by compilation pipeline (Phase 182, D-04)
- Marks v1: class assignment only, predicate -> CSS class (STATE.md)
- Marks annotation return type: `Map<rowId, string[]>` (FE-RG-16)
- Calculation identifier allowlist against SchemaProvider (FE-RG-17)
- Bind-value protocol: every DSL value produces `(placeholder, bind_value)`, never string concatenation (COMP-03)
- ChipWellOutputContract is the seam interface consumed by this pipeline (Phase 183, GEOM-05)

### Claude's Discretion
- Internal document structure (heading order, section breaks) — follow the WA-2 artifact description from the handoff
- Pseudocode style and notation for dependency graph and annotation algorithms
- Level of detail in edge case enumeration beyond the explicitly decided areas (null handling, error handling)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture Source
- `.planning/formulas-explorer-handoff-v2.md` — The primary source document. §WA-2 (lines ~184-230) specifies what `02-compilation-pipeline.md` must contain: clause mapping, dependency graph, bind-value protocol, Marks/Audits annotation, explain panel, 10 worked examples.

### Three-Explorer Boundary Spec (Phase 182 output)
- `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` — Defines chip well categories, type signatures, composition rules, and compilation targets per explorer. The compilation pipeline spec operationalizes what this spec declares.

### Chip-Well Geometry Contract (Phase 183 output)
- `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` — Defines the ChipWellOutputContract seam interface that the compilation pipeline consumes. §4 (data binding) and §9 (composition) are the key sections.

### Existing Compilation Pattern (codebase)
- `src/providers/FilterProvider.ts` — Existing `compile() -> CompiledFilter` pattern returning `(sql, params)` tuples. Structural precedent for the new pipeline.
- `src/providers/QueryBuilder.ts` — Assembles provider compile() outputs into complete queries. The sole SQL assembly point.
- `src/providers/allowlist.ts` — Runtime field/operator validation against SchemaProvider. Precedent for COMP-04 (Calculation identifier allowlist).
- `src/providers/types.ts` — `CompiledFilter`, `Filter`, `FilterField`, `FilterOperator` type definitions.

### Requirements
- `.planning/REQUIREMENTS.md` — Requirements COMP-01 through COMP-08, GARD-03, GARD-04 define acceptance criteria for this phase.

### Prior Decisions
- `.planning/STATE.md` §Accumulated Context — Contains locked decisions from the questioning session and phase-level decisions from Phases 182-183.

### Original Discussion
- `.planning/Formulas Explorer discussion.md` — Original hypothesis document. Examples from this document informed the three-explorer decomposition. Compilation pipeline must handle all chip types placed by Phase 182.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FilterProvider.compile()` — Returns `CompiledFilter` with `where: string` and `params: unknown[]`. The `(sql, params)` tuple pattern the new pipeline should follow.
- `QueryBuilder` — Sole SQL assembly point. Composes FilterProvider and PAFVProvider compile outputs. The new FormulasProvider would integrate here.
- `allowlist.ts` — `validateFilterField()` and `validateOperator()` validate against SchemaProvider-derived sets. Precedent for COMP-04 Calculation identifier allowlist.
- `SchemaProvider` — Runtime PRAGMA table_info() introspection with LATCH heuristic classification. Source of truth for valid column names.

### Established Patterns
- Provider compile pattern: each provider has a `compile()` method returning typed SQL fragments with bind params
- Double validation: field/operator validated at both addFilter() and compile() time
- `queueMicrotask` batched subscriber notifications after state changes
- sql.js parameterized queries: `db.prepare(sql).bind(params)` — never string concatenation

### Integration Points
- `QueryBuilder` — where FormulasProvider compile output would be composed with existing Filter/PAFV outputs
- Worker bridge — existing message protocol for SQL execution (`supergrid:query`, `supergrid:calc`)
- `PAFVProvider.getStackedGroupBySQL()` — how GROUP BY is currently generated (by the view, not by Formulas)
- `FormulasPanelStub.ts` — current stub panel that will eventually host the Formulas Explorer UI

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond what the handoff document WA-2 section and resolved open questions provide. The handoff is the canonical source — the compilation pipeline spec formalizes it with the decided level of detail (pseudocode for algorithms, real schema columns for examples, raw SQL for explain panel).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 184-compilation-pipeline-spec*
*Context gathered: 2026-04-27*
