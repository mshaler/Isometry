# Pitfalls Research

**Domain:** Adding formula/conditional-formatting/audit system with DSL-to-SQL compilation to an existing local-first TypeScript+sql.js data projection platform (v15.0 Formulas Explorer Architecture)
**Researched:** 2026-04-27
**Confidence:** HIGH — grounded in the live codebase, handoff v2, and the 14 existing regression guards (FE-RG-01..14)

---

## Critical Pitfalls

### Pitfall 1: DSL Grammar Left Undefined, Downstream Work Proceeds on Different Assumptions

**What goes wrong:**
The compilation pipeline spec (WA-2) describes the structure of chip → SQL mapping at the clause level, but does not define the DSL grammar at the token level. It defers grammar to "a dedicated DSL design milestone." Meanwhile, WA-3 (Formula Card schema) includes a `dsl` TEXT column, WA-4 (golden-test corpus) hand-writes DSL expressions in test cases, and WA-5 (UX spec) shows DSL fragments in chip wells. If each work area independently assumes different DSL syntax for the same concept — e.g., WA-2 uses `revenue - cost AS profit` while WA-4 uses `profit = revenue - cost` — the corpus test cases will not match the compiler, and UX wireframes will show syntax the grammar cannot parse.

**Why it happens:**
The handoff explicitly defers token-level syntax, but the examples used across work areas to illustrate concepts will implicitly encode syntax assumptions. Writers anchor to the examples and subsequent readers anchor to what the writer wrote. Syntax drift accumulates across six artifacts.

**How to avoid:**
Before WA-2 through WA-6 begin, create a single non-normative **DSL example lexicon** — a short table of ~15 canonical DSL fragments (one per concept: derived column, aggregation, window function, filter predicate, sort directive) that all WA authors must copy verbatim. Mark every example as "illustrative, not authoritative." The grammar milestone will validate or revise them; the architecture milestone's job is internal consistency, not final syntax. A grep check `grep -rE "(profit|revenue|urgent)" .planning/milestones/<this-milestone>/` across all six artifacts should show consistent fragment text.

**Warning signs:**
- WA-4 test cases contain DSL expressions not present in any WA-2 example
- WA-5 wireframes show a chip editing field with different operators than WA-2 uses
- Downstream DSL design milestone begins by asking "which syntax from the architecture docs should we implement?"

**Phase to address:**
WA-1 (Three-Explorer Spec). Establish the example lexicon as an appendix to WA-1 before any other work area is authored.

---

### Pitfall 2: Calculation Dependency Cycle Detection Deferred to Implementation

**What goes wrong:**
The handoff correctly identifies that Calculations form a dependency DAG and that cycles are compile-time errors (FE-RG-05). The compilation pipeline spec (WA-2) must specify the cycle-detection algorithm and the error surface format. If WA-2 only says "the compiler builds a dependency graph and topologically sorts; cycles are compile-time errors surfaced in the chip UI" without specifying the algorithm, the implementation milestone will make ad hoc decisions: which node in the cycle is highlighted? what is the error message format? how are transitive dependencies tracked when one Calculation references another Formula Card by ID?

**Why it happens:**
Cycle detection feels like an implementation detail. It isn't — the UX of the error state (which chips turn red, what text appears, whether the cycle is traceable back to the exact formula card reference) is a design decision that affects the chip-well geometry contract (WA-6) and the interaction spec (WA-5).

**How to avoid:**
WA-2 must specify the cycle-detection algorithm with pseudocode and the exact error surface: a `CycleError` type with `participants: string[]` (Formula Card IDs in cycle order), plus the UI contract — every chip participating in the cycle receives a `data-error="cycle"` attribute that WA-6 maps to a visual state. The chip-well geometry contract (WA-6) §7 States must include "cycle-participant" as a distinct state separate from "type-mismatch" and "drop-rejected."

**Warning signs:**
- WA-2 describes cycle detection as "handled by the compiler" without an error data structure
- WA-6 §7 States does not include a "cycle-participant" visual state
- WA-5 interaction spec shows a cycle error but WA-2's error type lacks enough fields to populate it

**Phase to address:**
WA-2 (Compilation Pipeline Spec), before WA-5 and WA-6 reference it.

---

### Pitfall 3: SQL Injection Through Bind Value Circumvention in Calculation Expressions

**What goes wrong:**
FE-RG-02 mandates `(sql_text, [bind_values])` tuples from the DSL→SQL compiler. This prevents injection in filter predicate values. However, Calculation expressions (`revenue - cost AS profit`) contain column names and SQL operators that cannot be bind parameters — `?` cannot substitute a column name. The structural rule "never concatenate user input" is easy to satisfy for literal values but hard to satisfy for column references. If the compiler accepts `revenue - cost` and emits `SELECT revenue - cost AS profit`, it must first validate that `revenue` and `cost` are allowlisted column names. If that validation step is missing or incomplete, a user can author `(SELECT password FROM admin_table) AS profit`, which the compiler will embed verbatim.

**Why it happens:**
The existing allowlist pattern (D-003: `allowlisted fields/operators`) is battle-tested in FilterProvider and PAFVProvider, where field names come from a finite set controlled by SchemaProvider. Formula Calculations introduce user-authored expressions where the set of valid identifiers is finite but may grow dynamically as new columns are added. The temptation is to trust that the DSL grammar will prevent invalid identifiers, but grammar validation and injection prevention are two different checks.

**How to avoid:**
WA-2 must specify a two-layer validation for Calculation expressions: (1) DSL grammar parse (structural correctness), (2) identifier allowlist validation (every identifier in the AST is checked against `SchemaProvider.getAllAxisColumns()` plus the set of previously-compiled Calculations). The `allowlist.ts` module's `setValidColumnNames()` pattern (D-015) is the correct extension point — WA-2 must name it explicitly. Operator allowlisting must be specified: arithmetic operators (`+`, `-`, `*`, `/`), aggregates (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`), and window functions are allowed; subquery keywords (`SELECT`, `FROM`, `WHERE` inside an expression position) are not.

**Warning signs:**
- WA-2 describes compilation with examples using column names but does not mention allowlist validation
- The compiler spec produces `(sql_text, [bind_values])` where `sql_text` contains identifiers that were never validated against SchemaProvider
- No reference to `allowlist.ts` or `setValidColumnNames()` in WA-2

**Phase to address:**
WA-2 (Compilation Pipeline Spec). The allowlist validation step must be in the spec, not deferred to implementation.

---

### Pitfall 4: Formula Card Type Signatures Tied Too Tightly to Current facet_type Enum

**What goes wrong:**
WA-3 defines a `type_signature` field on Formula Cards. The handoff recommends covering only existing `facet_type` values (text, number, date, select, multi_select, location) for v1, with richer types deferred. The pitfall is not the deferral itself — that is correct — but how the type signature is *stored*. If `type_signature` is a JSON blob encoding `{ input: facet_type[], output: facet_type }`, and later a formula needs to accept arrays or optional values, every stored type signature must be migrated. If instead the spec defines a versioned discriminated union (`{ version: 1, input: ..., output: ... }`), the migration surface is contained.

**Why it happens:**
WA-3 is a schema spec, and schemas feel stable. Type signature evolution feels speculative. But the handoff itself says "extensible for richer types (arrays, JSON, geo shapes)" — that extensibility promise is compromised if the storage format is a flat string.

**How to avoid:**
WA-3 must store `type_signature` as a `TEXT` column containing a versioned JSON structure with a `schema_version: number` discriminant. The spec should provide the v1 structure verbatim and explicitly state that future versions will add new discriminant values — migration code will handle the upgrade path. Do not store it as a comma-separated list of type names or as a flat string that implies no version.

**Warning signs:**
- WA-3's `type_signature` column schema is `TEXT` with no versioning guidance
- The worked examples in WA-3 store type signatures as bare strings like `"number,number -> number"`
- No mention of forward-compatibility or migration path for the type signature field

**Phase to address:**
WA-3 (Formula Card Schema and Lifecycle).

---

### Pitfall 5: Chip-Well Cross-Explorer Drag Semantics Not Specified Before WA-5 Locks In Interaction

**What goes wrong:**
The handoff identifies cross-well drag semantics as Open Question 8 and recommends "copy by default, modifier key for move, never reject." WA-6 (chip-well geometry) §11 lists it as an open question. If WA-5 (UX interaction spec) is authored without WA-6 being finalized first, WA-5 may lock in wireframes that assume a specific drag behavior (e.g., a "move" affordance with strikethrough on the source chip) that contradicts WA-6's coordinate system for the source chip's drag state. The dependency order in the handoff says WA-5 depends on WA-6 being complete — but if the authoring happens in parallel or out of order, this gap opens.

**Why it happens:**
WA-5 and WA-6 feel like they can be written in parallel because they cover different aspects (interaction semantics vs. spatial geometry). But cross-well drag requires both layers to agree: WA-6 must specify whether the source chip enters a "being-moved" visual state or remains unchanged (copy semantics), and WA-5 must specify what the modifier key affordance looks like. If they are written independently, one will be wrong.

**How to avoid:**
WA-6 must be co-authored with WA-5 as a blocking dependency, not a parallel track. Specifically, WA-6 §7 States must enumerate the "drag-source-copy" state (source chip stays visible, opacity 0.5) and the "drag-source-move" state (source chip shows strikethrough or ghosting), and these state names must be referenced verbatim in WA-5. The Open Question 8 decision ("copy by default, modifier key for move") must be codified in WA-6 §7 before WA-5 wireframes are drawn.

**Warning signs:**
- WA-5 wireframes show drag affordances not present in WA-6 §7 States
- WA-6 §11 still lists cross-well drag as "open" after WA-5 is authored
- The modifier key for "move" is specified in WA-5 but not in WA-6

**Phase to address:**
WA-6 must be completed before WA-5 is authored. In practice, resolve Open Question 8 in WA-1 as part of defining chip well categories, then carry the decision into WA-6.

---

### Pitfall 6: Marks Post-Query Annotation Bleeds Into Result Set Filtering

**What goes wrong:**
FE-RG-07 states Marks produce CSS classes and never alter row membership. The pitfall is the implementation path: post-query annotation runs after the SQL result set is returned. If the annotation function receives a row and checks `row.priority > 3` to emit `class 'urgent'`, and a developer later adds a "show only marked rows" affordance ("filter to urgent"), they will implement it by running the Marks predicate in the WHERE clause — converting a Mark into a Filter. This violates FE-RG-07 and FE-RG-08 but feels natural to implement. The guard in the spec must pre-empt this.

**Why it happens:**
The line between "highlight rows matching predicate" and "filter rows matching predicate" is architecturally important but operationally thin. The predicate is identical. The distinction is what happens to non-matching rows: Marks shows them with no class; Filters excludes them. Developers implementing a "filter to marked" feature will take the shortest path, which is reusing the Mark's predicate in a WHERE clause rather than adding a new Filter chip.

**How to avoid:**
WA-2 must specify that the post-query annotation function is structurally prevented from returning rows or affecting row counts — it receives `rows: ResultRow[]` and returns `annotations: Map<rowId, string[]>` (a class list per row), nothing else. The function signature makes it impossible to filter. A "filter to marked rows" feature, if ever implemented, must create a Filter chip whose predicate mirrors the Mark predicate — it cannot reuse the Mark annotation path. WA-1 should state this explicitly in the Marks out-of-scope list.

**Warning signs:**
- WA-2 specifies the Marks annotation function as returning `rows: ResultRow[]` instead of `annotations: Map<rowId, string[]>`
- WA-5 includes a "show only marked rows" interaction without specifying that it creates a new Filter chip
- A developer asks "can we filter by mark class?" during implementation

**Phase to address:**
WA-2 (Compilation Pipeline Spec) — the annotation function return type is the structural guard.

---

### Pitfall 7: Formula Card Versioning Creates Silent Schema Accumulation in sql.js

**What goes wrong:**
The handoff recommends retaining all Formula Card versions. At Brenda's scale (heavy iteration), this creates hundreds of rows in `formula_cards`. Each row has a `dsl` field containing potentially complex expressions, a `test_cases` JSON array, and provenance metadata. The sql.js database is a WASM-hosted in-memory database that checkpoints to a binary blob — every checkpoint includes all formula_cards rows. At 500 versions of 20 Formula Cards, the checkpoint cost grows. More critically, the golden-test corpus (WA-4) fixture dataset includes formula_cards rows — if the corpus fixture grows unboundedly, integration tests slow down.

**Why it happens:**
"Retain all versions" is the correct default for user data (users want rollback). But the spec does not constrain version accumulation, and the implementation will not add pruning until it becomes a visible problem. By then, the schema is locked and pruning requires careful migration to avoid breaking version references in `dependencies`.

**How to avoid:**
WA-3 must specify a version retention policy even if v1 is "retain all." The policy should be a named constant (`VERSION_RETENTION_POLICY: 'retain-all' | 'keep-last-N'`) stored in ui_state, so a future milestone can change the policy without a schema migration. WA-3 must also specify whether `dependencies` references a specific version (`formula_cards.id`) or a card's canonical identity (`formula_cards.canonical_id`) — version-independent references are safer and enable pruning of old versions without breaking the dependency graph.

**Warning signs:**
- WA-3 `formula_cards` schema has no `canonical_id` field — only auto-increment `id` — making version-independent references impossible
- WA-4 fixture loads all formula_cards versions into the test database, making the fixture grow with each corpus test added
- No retention policy constant defined in the schema spec

**Phase to address:**
WA-3 (Formula Card Schema and Lifecycle), before WA-4 builds its fixture against the schema.

---

### Pitfall 8: Undo/Redo Scope Ambiguity Between Chip Arrangement and Formula Card Saves

**What goes wrong:**
The handoff says chip arrangements are undo/redo-able. MutationManager already implements command-pattern undo/redo (D-009). Two distinct undo scopes exist: (1) chip arrangement changes (drag a chip to a new position → undo returns it), (2) Formula Card saves (bottom-up promotion: user clicks "Save as Formula" → undo deletes the saved card). If both scopes share the same MutationManager stack, a "Save as Formula" action gets interleaved with chip rearrangement actions, and undoing through the stack can produce states where a formula card exists but the chip arrangement that produced it is gone, or vice versa.

**Why it happens:**
MutationManager is the existing undo/redo infrastructure — it is natural to extend it for Formula Card operations. But chip arrangement state is ephemeral (Tier 3 per D-005); Formula Card saves are durable (Tier 1: database). Mixing ephemeral and durable operations in the same undo stack violates the three-tier persistence model.

**How to avoid:**
WA-5 must specify two distinct undo scopes: (1) chip arrangement undo is local to the explorer session — it is not MutationManager-mediated and does not persist; it uses a simple in-explorer arrangement history (an array of chip well snapshots). (2) Formula Card save/delete goes through MutationManager as a durable mutation. These scopes never interleave. WA-5 must also specify the keyboard UX: Cmd+Z in a chip well undoes the last chip arrangement change, not the last Formula Card save.

**Warning signs:**
- WA-5 says chip arrangement undo "goes through MutationManager" or "integrates with existing undo/redo"
- WA-3 does not specify the undo behavior for Formula Card save/delete as a MutationManager command
- The interaction spec does not distinguish Cmd+Z scope based on whether a chip well or the card library is focused

**Phase to address:**
WA-5 (UX Interaction Spec), drawing on the Tier distinction from D-005.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| DSL grammar deferred to next milestone with no example lexicon established | WA-1 ships faster | Each subsequent WA author independently assumes different DSL syntax; the grammar milestone inherits conflicting examples | Never — establish a non-normative example lexicon before WA-2 begins |
| `type_signature` stored as a plain string (e.g., `"number -> number"`) | Schema is simpler | Adding optional inputs or richer types requires parsing all existing values and migrating them | Only acceptable if spec explicitly states the format is temporary and provides a migration path |
| Chip arrangement undo wired through MutationManager | Reuses existing infrastructure | Ephemeral chip state and durable Formula Card saves interleave in the undo stack, violating three-tier persistence | Never — chip arrangement undo must be scoped to the explorer session |
| Golden test corpus cases added as comments in WA-2 examples rather than a separate fixture file | Reduces document count | Corpus is not runnable; anti-patching rule cannot be mechanically enforced | Never for regression cases; acceptable for illustrative examples |
| Formula Card `dependencies` referencing `formula_cards.id` (version-specific) | Simpler schema | Pruning old versions breaks the dependency graph; version-independent references (`canonical_id`) are required for retention policy flexibility | Never — `canonical_id` must be in the schema from the start |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SchemaProvider allowlist (allowlist.ts) | WA-2 compiler validates column names against a static list hardcoded in the compiler | The compiler must call `setValidColumnNames()` at initialization and re-validate when SchemaProvider notifies of schema changes (dynamic columns may be added) |
| FilterProvider (existing) | WA-2 assumes Formulas Explorer's Filter chips replace FilterProvider — they are the same thing | Formulas Filter chips must compile through FilterProvider's existing `addFilter()`/`compile()` interface; they do not bypass it. The compiler output feeds FilterProvider, not SQL directly |
| MutationManager | Formula Card save/delete treated as ephemeral — no undo support | Formula Card operations are Tier 1 (durable); every save and delete must be a MutationManager command with an inverse |
| StateManager persistence (three-tier) | Chip well arrangement state persisted to ui_state (Tier 1) | Chip arrangement is Tier 3 (ephemeral, session-only); only the compiled Formula Card IDs assigned to wells persist (Tier 2), not the ad hoc arrangement itself |
| CloudKit sync | Formula Cards synced as rows in the cards table (reusing existing sync infrastructure) | Formula Cards must sync independently as `formula_cards` table rows; using the cards table conflates user data with formula metadata and breaks SchemaProvider introspection |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Dependency DAG traversal on every chip rearrangement | Noticeable lag during drag — every chip move triggers a full topological sort | Topological sort only on compile (chip drop + "Save" action), not on every drag-over event | Immediately with >10 interdependent Calculation chips |
| Marks post-query annotation running on all rows before virtualization | Annotation O(N) cost visible at 10K+ cards | Annotation must run only on visible rows (post-virtualization slice), not the full result set | Any dataset >5K cards with Marks active |
| Formula Card type validation on every chip drag-over event | Drop targets stutter during drag | Type validation runs only on pointerup (chip drop), not pointerover | Immediately with >5 chip wells visible simultaneously |
| Compile-on-every-chip-change without debounce | Worker re-queries at ~60fps during chip drag | Debounce compilation at ≥200ms trailing edge; live preview fires after drag settles, not during drag motion | Immediately when a Filter chip is being dragged |
| Formula Card golden-test corpus loaded into in-memory sql.js for every test case | Test suite slowdown as corpus grows | Corpus fixture loaded once per test file (beforeAll), not per test case; use `realDb()` factory with pre-loaded fixture | When corpus reaches ~50+ test cases |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Calculation expression identifier not validated against allowlist | User-authored DSL expression embeds a subquery (`(SELECT secret FROM admin_table) AS label`) — compiler emits it verbatim into SELECT clause | WA-2 must specify two-layer validation: (1) grammar parse, (2) identifier allowlist against SchemaProvider. Subquery keywords in expression position are a grammar-level error |
| Bind values bypassed for SQL keywords in filter predicates | User types `1=1 OR 1` as a filter value — if the compiler naively wraps it in a parameter, it is safe; if it detects it looks like SQL and treats it differently, it may embed it | Bind values must never be inspected for SQL-likeness — every user value is a bind parameter without exception |
| DSL fragment stored in `formula_cards.dsl` and later eval'd at execution time | Stored DSL treated as trusted — a formula card edited via direct database manipulation (e.g., DB Utilities viewer) could inject malicious DSL | The compiler must always recompile from stored DSL — it cannot skip compilation and exec the stored `sql` field directly. The `sql` column is a cache for display; the `dsl` column is always recompiled through the validator |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Chip type-mismatch error shown only after drop, not during drag-over | User drags a chip into an incompatible well, releases it, then sees an error — the chip bounces back after commitment | Type validation must run on drag-over and update the drop zone's visual state (valid/invalid) before the user commits the drop |
| "Save as Formula" trigger not visually distinct from chip arrangement actions | User accidentally promotes an exploratory arrangement to a saved card | Promote/save is a secondary button with a confirmation step — never a single click in the primary drag area |
| Explain panel shows raw SQL with bind parameter placeholders (`?`) but no value preview | Brenda cannot verify the filter value is what she typed | Explain panel must show `?` annotated with the corresponding bind value: `WHERE priority > ?  /* 3 */` |
| Chip ordering implied to be flexible but Sort chips have semantic order | User reorders Sort chips thinking it is arbitrary — but chip order determines ORDER BY priority | Sort chip well shows numbered badges (1, 2, 3) indicating sort priority; reorder affordance makes explicit that changing order changes sort priority |
| Formula Card library shown as a flat list — card scope (dataset vs global) not visible | User applies a global formula card to the wrong dataset context | Card library groups by scope (dataset / global) with a scope badge on each card |

---

## Gaps in the Existing 14 Regression Guards (FE-RG-01..14)

The handoff's 14 regression guards are well-chosen but leave the following gaps:

**Gap 1 — No guard for example lexicon consistency across work areas (FE-RG-15 candidate).**
FE-RG-01..14 govern runtime behavior and architectural boundaries. No guard exists for spec-internal consistency: DSL examples used in WA-2, WA-4, and WA-5 drifting from each other. Proposed guard: "All DSL expressions in WA-2, WA-4, and WA-5 must be drawn from the canonical example lexicon in WA-1 Appendix. Novel syntax in downstream work areas is a spec error."

**Gap 2 — No guard for the Marks annotation return type (FE-RG-16 candidate).**
FE-RG-07 says Marks never alter row membership, but does not constrain the function signature. Proposed guard: "The Marks post-query annotation function signature is `(rows: ResultRow[]) => Map<string, string[]>` — input rows, output class list per rowId. Any signature that returns rows or a filtered subset is a violation of FE-RG-07."

**Gap 3 — No guard for chip arrangement vs Formula Card undo scope separation.**
D-005 (three-tier persistence) is established, but no FE-RG explicitly extends it to the Formulas Explorer undo story. Chip arrangement is Tier 3 (ephemeral); Formula Card saves are Tier 1 (durable). Without a guard, the undo scopes get conflated during implementation.

**Gap 4 — No guard for FilterProvider integration path.**
FE-RG-02 guards SQL injection at the compiler level. But nothing guards the integration boundary: Filter chips could bypass FilterProvider and write directly to the Worker SQL query, skipping FilterProvider's double-validation (D-003). A guard is needed: "Filter chip compilation output must flow through FilterProvider.addFilter() — direct SQL injection into the Worker query is a violation."

**Gap 5 — No guard for identifier allowlist validation in Calculation expressions.**
FE-RG-02 prevents literal value injection via parameterized queries. But Calculation identifiers (column names in expressions) cannot be bind parameters and must be allowlisted. No existing FE-RG covers this path. Proposed guard: "Every identifier in a Calculation expression must appear in `SchemaProvider.getAllAxisColumns()` or in the set of previously compiled Formula Card output names before the expression is emitted into SQL."

---

## "Looks Done But Isn't" Checklist

- [ ] **WA-2 Compilation Pipeline:** Clause order and bind value protocol documented — but verify the identifier allowlist step is specified for Calculation expressions (not just filter values).
- [ ] **WA-3 Formula Card Schema:** DDL is valid SQLite — but verify `canonical_id` exists for version-independent dependency references, and `type_signature` is stored with a version discriminant.
- [ ] **WA-4 Golden Test Corpus:** 30+ test cases hand-written — but verify each case's `expected_sql` can be mechanically checked (not just visually reviewed) and that the fixture SQL runs against an actual sql.js instance.
- [ ] **WA-5 UX Interaction Spec:** Chip drag-over shows valid/invalid state — but verify the validation runs on pointerover (not just pointerup) and that the state uses WA-6's enumerated state names verbatim.
- [ ] **WA-6 Chip-Well Geometry Contract:** §3 says "N/A — operator surface" — but verify it is not silently empty; the rationale must be present (FE-RG-13).
- [ ] **Cross-well drag semantics:** Open Question 8 is resolved in the handoff — but verify WA-6 §7 States includes both "drag-source-copy" and "drag-source-move" states, and WA-5 specifies the modifier key affordance.
- [ ] **Marks post-query annotation:** Defined in WA-2 — but verify the return type is `Map<rowId, string[]>`, not `ResultRow[]`.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| DSL syntax drift across work areas | MEDIUM | Add WA-1 example lexicon appendix; grep all work area artifacts for divergent syntax; reconcile before corpus test cases are finalized |
| Cycle detection not specified → implementation makes ad hoc choices | MEDIUM | Add `CycleError` type and chip state to WA-2; retrofit into WA-5 wireframes and WA-6 §7 States before implementation milestone begins |
| SQL injection via Calculation identifier | HIGH | Add identifier allowlist step to WA-2 compiler spec; the gap must be closed before the DSL grammar milestone begins implementing the compiler |
| Chip arrangement undo wired through MutationManager | MEDIUM | Refactor WA-5 undo scope section; explicitly separate Tier 3 arrangement history from Tier 1 MutationManager commands |
| Formula Card `dependencies` referencing version-specific IDs | HIGH | Requires schema migration to add `canonical_id` — catch before WA-4 builds its fixture; the fixture schema becomes the reference for the implementation milestone |
| Marks annotation returning rows (breaking FE-RG-07) | LOW in spec, HIGH in implementation | Correct WA-2 function signature; add to FE-RG as a proposed guard before implementation begins |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| DSL syntax drift across work areas | WA-1 (before any other WA begins) | Grep: all DSL examples in WA-2/4/5 match WA-1 appendix lexicon |
| Cycle detection underspecified | WA-2 | `CycleError` type present; WA-6 §7 States includes "cycle-participant" |
| Calculation identifier injection | WA-2 | Identifier allowlist step present in compiler flow; no code path produces SQL identifier from unvalidated user input |
| Type signature format not versioned | WA-3 | `type_signature` JSON includes `schema_version` discriminant; `canonical_id` column exists |
| Cross-well drag semantics unresolved | WA-6 (before WA-5) | WA-6 §7 includes "drag-source-copy" and "drag-source-move" states; Open Question 8 closed |
| Marks annotation bleeds into filtering | WA-2 | Annotation function returns `Map<string, string[]>`, not rows |
| Chip undo vs Formula Card undo scope | WA-5 | Two distinct undo scopes named; Tier 3 arrangement history vs Tier 1 MutationManager commands |
| Formula Card version accumulation | WA-3 | `canonical_id` present; `VERSION_RETENTION_POLICY` constant defined |
| FilterProvider bypass | WA-2 | Compilation output explicitly routed through FilterProvider.addFilter() |

---

## Sources

- Handoff document: `.planning/formulas-explorer-handoff-v2.md` — 14 regression guards, work area structure, open questions
- Project context: `.planning/PROJECT.md` — D-003 (allowlist + parameterized SQL), D-005 (three-tier persistence), D-009 (MutationManager undo), v6.1 anti-patching rule
- Codebase: `src/allowlist.ts`, `FilterProvider`, `SchemaProvider` — existing SQL safety infrastructure
- HyperFormula dependency graph documentation (hyperformula.handsontable.com) — formula engine dependency graph architecture and invalidation patterns
- OWASP SQL Injection Prevention Cheat Sheet — parameterized query and allowlist validation guidance
- Drag-and-drop UX best practices (smart-interface-design-patterns.com) — undo recovery, drag state management
- SQLBI DAX circular dependency analysis (sqlbi.com) — real-world formula cycle detection case study
- Tableau shelf/pill model (help.tableau.com) — same-primitive-different-role-per-shelf insight referenced in FE-RG-06
- Research: Practical specification pitfalls (practicallogix.com, fabrity.com) — over/under-specification patterns in architecture-only milestones

---
*Pitfalls research for: v15.0 Formulas Explorer Architecture — DSL compilation, formula dependency graph, type signatures, chip-well UX, spec-only milestone risks*
*Researched: 2026-04-27*
