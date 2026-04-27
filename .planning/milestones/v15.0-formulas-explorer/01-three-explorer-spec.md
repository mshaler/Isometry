# Three-Explorer Boundary Specification

**Artifact:** `01-three-explorer-spec.md`
**Work Area:** WA-1
**Milestone:** v15.0 — Formulas Explorer Architecture
**Source:** `.planning/formulas-explorer-handoff-v2.md` (canonical; read that document for full background)
**Status:** Authoritative — downstream WA specs (02–06) must reference this document, not re-derive its content

---

## Preamble

This document defines the boundaries, chip well categories, compilation outputs, and composition rules for the three peer explorers that replace the original single-explorer hypothesis: **Formulas Explorer**, **Marks Explorer**, and **Audits Explorer**.

**Relationship to the handoff.** The architectural decisions are fully articulated in `.planning/formulas-explorer-handoff-v2.md`. This specification formalizes those decisions into a structured reference that downstream work areas (WA-2 through WA-6) can consume without re-reading the handoff. Where this document cites a decision, the handoff is the authoritative source of the reasoning behind it.

**Critical framing correction.** Formulas Explorer is **NOT the A in LATCH**. The original discussion framed Formulas as "the Alphanumeric component of LATCH analytics" — this is a category error. LATCH letters (Location, Alphabet, Time, Category, Hierarchy) are organizational axes that describe what dimension data is organized along. Formulas, Marks, and Audits are operator surfaces that act *upon* data organized along any axis. They are orthogonal concerns at different altitudes. (See FE-RG-11.)

**Locked decisions from the questioning session (STATE.md §Accumulated Context):**

- Navigation: single "Formulas" parent in the Analyze ribbon section, with three sub-explorers (Formulas / Marks / Audits)
- Marks v1: class assignment only (predicate → CSS class); full Tableau-marks model deferred
- Type signatures: extensible design accommodating richer types (arrays, JSON, geo shapes) from day one
- Cross-well drag: copy by default; modifier key for move; never reject (type signatures match for boolean predicates)
- Card scope: dataset-scoped at v1; story-scoped and global as later additions

---

## Formulas Explorer (data-layer)

Formulas Explorer is the data-layer operator surface. It produces SQL fragments (SELECT, WHERE, ORDER BY) that are executed by the compilation pipeline. It is **grouping-agnostic**: the `GROUP BY` clause always comes from whichever view explorer (SuperGrid, etc.) is active.

### Chip Well Categories

#### Calculations

**Type signature:** Accepts expressions that produce a typed value (numeric, text, date, boolean) from row columns or aggregations; compiles to the SQL `SELECT` clause.

Calculations cover three sub-shapes:

- **Derived columns** — row-level expressions: `revenue - cost AS profit`, `UPPER(company_name) AS display_name`
- **Aggregations** — group-level functions: `SUM(quantity)`, `COUNT(*) AS row_count`, `AVG(score) AS avg_score`
- **Window functions** — partition-relative expressions: `RANK() OVER (PARTITION BY region ORDER BY revenue DESC) AS rank_in_region`

All three sub-shapes live in the Calculations chip well. Their SQL compilation differs (SELECT clause fragment vs. window clause) but the user places them identically — as expressions over columns.

**Composition rule:** Calculations may depend on each other (e.g., `gross_margin = revenue - cost` requires `revenue` and `cost` to resolve). Dependencies form a directed acyclic graph (DAG). Cycles are compile-time errors surfaced in the chip well. The topological sort algorithm and cycle-detection error format are specified in WA-2 (Phase 184); this spec identifies that the DAG rule applies. (FE-RG-05)

**Cross-category references:** A Calculation may reference a Filter result (e.g., "Filtered Totals" — a `SUM` that applies only to rows satisfying a filter predicate). Cross-category references exist and are resolved by the compilation pipeline (WA-2). This spec identifies which explorer owns each side; WA-2 specifies the resolution algorithm. (D-04)

#### Filters

**Type signature:** Accepts predicates that return boolean over row columns; compiles to the SQL `WHERE` clause, composed by AND across chips.

Filters determine set membership — which rows appear in the result set. A Filter chip that returns `FALSE` for a row excludes that row.

**Composition rule:** Filter chips compose by AND only. Each chip contributes one conjunct to the `WHERE` clause. If a user needs OR semantics, they write a single filter chip whose DSL fragment contains `OR` internally. There is no implicit OR across chips. This rule is commutative and idempotent: adding the same filter twice produces the same result as adding it once. (FE-RG-03)

#### Sorts

**Type signature:** Accepts column references with direction (ASC/DESC); compiles to the SQL `ORDER BY` clause, ordered by chip position.

Sorts determine the ordering of rows in the result set within the active grouping context from the view explorer.

**Composition rule:** Sort chips compose lexicographically by chip position in the well. The first chip is the primary sort key; the second chip is the secondary sort key; and so on. Reordering chips reorders the `ORDER BY` clause. (FE-RG-04)

### Compilation Targets (Formulas Explorer)

| Category | SQL Clause | Notes |
|----------|-----------|-------|
| Calculations | `SELECT` clause | Derived columns inline; aggregations require GROUP BY from view explorer |
| Filters | `WHERE` clause | AND-composed |
| Sorts | `ORDER BY` clause | Chip-position-ordered |

### Out of Scope — Formulas Explorer

- **GROUP BY**: Formulas Explorer never owns `GROUP BY`. Grouping comes from whichever view explorer (SuperGrid, etc.) is active. The same Calculation chip produces different SQL depending on the view context — which is the polymorphic behavior PAFV already commits to. (FE-RG-01)
- **Post-query annotation**: Formulas produces SQL fragments; CSS class assignment and flag annotation are owned by Marks and Audits respectively.
- **Row membership from Sorts**: Sorts alter ordering, never set membership.
- **Theme palette, typography, banding**: Those are theme configuration, not formulas.

---

## Marks Explorer (view-layer)

Marks Explorer is the view-layer operator surface. It produces CSS class assignments per row, applied after the SQL query completes. It never modifies the result set's row membership or ordering.

### Chip Well Categories

#### Conditional Encoding

**Type signature:** Accepts boolean predicates over row columns; produces a `Map<rowId, string[]>` of CSS class assignments via post-query annotation; never modifies row membership.

The predicate is filter-shaped (it evaluates a boolean over row columns), but its *consequence* is rendering, not filtering. When the predicate returns `TRUE` for a row, the compiler assigns one or more CSS class names to that row. The active theme determines what those class names look like visually.

Examples: `priority > 3` → class `urgent`; `region = 'East'` → class `region-east`; `overdue = 1` → class `flagged`.

**Composition rule:** Multiple Conditional encoding chips apply independently. Each chip's predicate is evaluated per row; a row may accumulate classes from multiple chips simultaneously. Chips do not compose transitively (Chip A does not depend on Chip B's class output). Order of evaluation is unspecified because class assignment is additive and commutative.

**v1 scope:** Marks v1 is class assignment only (predicate → CSS class string). Full Tableau-style marks model (size, shape, opacity from data values) is deferred to a later milestone.

### Compilation Target (Marks Explorer)

| Category | Output | Notes |
|----------|--------|-------|
| Conditional encoding | Post-query `Map<rowId, string[]>` | Evaluated after SQL query returns; never alters result set |

### Out of Scope — Marks Explorer

- **Altering row membership**: Any chip that causes a row to be excluded is a Filter, not a Mark. Marks are view-layer; they annotate, they do not exclude. (FE-RG-07)
- **Altering row ordering**: Any chip that changes row order is a Sort, not a Mark.
- **Theme palette, typography, banding**: Marks decide which class a row receives; the active theme decides what that class looks like visually. Predicates must work across themes (NeXTSTEP, future themes) without rewriting. (FE-RG-09)
- **SQL execution**: Marks produce no SQL fragments; they post-process the result set from Formulas.

---

## Audits Explorer (semantic-flag layer)

Audits Explorer is the semantic-flag operator surface. It produces flag annotations per row, applied after the SQL query completes. It surfaces attention; it never modifies the result set's row membership.

### Chip Well Categories

#### Anomaly Rules

**Type signature:** Accepts boolean predicates that identify statistically or semantically anomalous rows; produces flag annotations per row via post-query annotation; never excludes rows.

Anomaly rules flag rows that are unexpected or statistically unusual. The predicate returns `TRUE` for anomalous rows; the flag annotation surfaces as a badge, overlay, or sidebar inbox entry. The row remains in the result set.

Examples: `z_score > 2` (statistical outlier); `balance != sum_of_transactions` (internal inconsistency); `RANK() OVER (ORDER BY revenue DESC) = 1 AND revenue < 0` (top-ranked but negative).

#### Validation Rules

**Type signature:** Accepts boolean predicates that identify data-quality violations; produces warning annotations per row via post-query annotation; never excludes rows.

Validation rules flag rows that violate data-quality constraints. The predicate returns `TRUE` for invalid rows; the warning annotation surfaces separately from anomaly flags (different badge/icon affordance per the Audits UI surface, to be specified in `audit-overlay-geometry.md` in the Audits implementation milestone).

Examples: `due_date IS NULL AND status = 'in_progress'` (incomplete required field); `email NOT LIKE '%@%'` (format violation); `created_at > updated_at` (temporal inconsistency).

**Composition rule (both categories):** Audit chips are independent. Each chip evaluates its predicate per row and applies its flag annotation without depending on other audit chips. A row may carry multiple audit flags simultaneously.

### Compilation Target (Audits Explorer)

| Category | Output | Notes |
|----------|--------|-------|
| Anomaly rules | Post-query flag annotations per row | Badge/overlay affordance; UI surface deferred to implementation milestone |
| Validation rules | Post-query warning annotations per row | Distinct affordance from anomaly flags |

### Out of Scope — Audits Explorer

- **Excluding rows from result set**: Audits surface attention; they do not exclude. Any chip that causes a row to be excluded is a Filter. (FE-RG-08)
- **Altering row ordering**: Ordering is a Sort concern.
- **Derived calculations**: "Calculated values" from the original discussion belong in Formulas / Calculations. The rendering hint (overlay display of a calculated value) is a view concern, not an Audits concern. (See Discussion.md Example Placement table.)
- **SQL execution**: Audits produce no SQL fragments; they post-process the result set from Formulas.

---

## Cross-Explorer Composition

The compilation pipeline enforces a fixed SQL clause order regardless of the visual arrangement of chips. Users cannot "put Sort before Filter" semantically — they can only reorder chips within a category.

### Fixed SQL Clause Order

| Clause | Source | Notes |
|--------|--------|-------|
| `SELECT` | Formulas / Calculations | Derived columns, aggregations, window functions |
| `FROM` | Data layer (cards table) | Static; not chip-controlled |
| `WHERE` | Formulas / Filters | AND-composed across chips |
| `GROUP BY` | Active view explorer (e.g., SuperGrid PAFV) | Never owned by Formulas Explorer (FE-RG-01) |
| `HAVING` | View explorer (if needed) | Not chip-controlled at v1 |
| `ORDER BY` | Formulas / Sorts | Chip-position-ordered |
| `LIMIT` | View explorer / pagination | Not chip-controlled at v1 |
| Post-query CSS annotations | Marks / Conditional encoding | Evaluated after query returns |
| Post-query flag annotations | Audits / Anomaly + Validation rules | Evaluated after query returns |

### Cross-Category References

Cross-category references exist and are expected. The canonical example is "Filtered Totals" — a Calculation that produces a `SUM` over only the rows satisfying a Filter predicate. In this case:

- The Filter chip (Formulas / Filters) owns the predicate side
- The Calculation chip (Formulas / Calculations) owns the aggregation side
- The compilation pipeline resolves how both sides become a single SQL expression

This spec identifies which explorer owns each side. WA-2 (Phase 184) specifies the dependency resolution algorithm and the SQL output for cross-category references. No pseudocode is included here. (D-04)

### Formula Card — Role Determined by Chip Well

A Formula Card has no intrinsic category. Its role is determined by which chip well receives it. The same predicate `priority > 3` can function as:

- A Filter (in Formulas / Filters well) — excludes rows where `priority <= 3`
- A Conditional encoding Mark (in Marks / Conditional encoding well) — adds class `urgent` to rows where `priority > 3`
- An Anomaly rule Audit (in Audits / Anomaly rules well) — flags rows where `priority > 3` as anomalous

This is the Tableau insight: same primitive, different role per shelf. (FE-RG-06)

### Chip↔Card Promotion

Chip-to-card promotion is always an explicit user action ("Save as Formula"). Ad hoc chip arrangements and saved Formula Cards are visually distinct. The promotion UI flow and card lifecycle are specified in WA-3 (Phase 185). (FE-RG-10)

---

## Anti-Features

The following behaviors are explicitly prohibited. Each entry states the rejected behavior, a one-sentence rationale, and the regression guard cross-reference. (SPEC-05, D-03 format)

1. **OR-composition across filter chips** — Composition is commutative and idempotent at the chip level; OR semantics must live inside a single chip's DSL fragment, not as a cross-chip combinator. (FE-RG-03)

2. **Marks altering result set row membership** — Marks are view-layer; any chip that excludes a row is a Filter, not a Mark, regardless of where it is placed in the UI. (FE-RG-07)

3. **Audits excluding rows from the result set** — Audits surface attention without modifying the data the user sees; excluding rows is Filter behavior and must live in Formulas / Filters. (FE-RG-08)

4. **FormulasProvider owning GROUP BY** — Grouping comes from view explorers; the same Calculation chip must produce identical semantics regardless of which view explorer provides the grouping context. Formulas owning GROUP BY would break polymorphic view composition. (FE-RG-01)

5. **Inline cell formula editing** — Formula Cards have rich content (Title, DSL, SQL, Notes, Version); formulas live in chip wells, not in cell-edit affordances. Inline cell editing bypasses the chip well's type-signature validation and version control. (FE-RG-06)

6. **Automatic chip-to-card promotion** — Promoting an ad hoc chip arrangement to a saved Formula Card must require an explicit user action ("Save as Formula"). Automatic promotion leads to accidental library accumulation of half-baked cards. (FE-RG-10)

7. **Theme palette, typography, or banding in Marks** — Marks decide which CSS class a row receives; the active theme decides what that class looks like. Predicates must be theme-agnostic so they work unchanged across NeXTSTEP and any future theme. (FE-RG-09)

8. **Formulas Explorer as the A in LATCH** — LATCH letters are organizational axes (Location, Alphabet, Time, Category, Hierarchy); Formulas, Marks, and Audits are orthogonal operator surfaces that act on data organized along those axes. Conflating them produces a category error that breaks the LATCH mental model. (FE-RG-11)

---

## Discussion.md Example Placement

Every example from `.planning/Formulas Explorer discussion.md` is placed unambiguously below. (SPEC-06)

| Item in discussion.md | Explorer / Category | Rationale |
|-----------------------|---------------------|-----------|
| Calculations well: "Totals" | Formulas / Calculations (Aggregations) | Aggregation expression (e.g., `SUM(revenue)`); compiles to `SELECT` clause; `GROUP BY` supplied by view explorer |
| Calculations well: "Subtotals" | Formulas / Calculations (Aggregations) | Aggregation at intermediate group level; same mechanism as Totals; group hierarchy from view explorer |
| Calculations well: "Filtered Totals" | Formulas / Calculations (cross-category ref, D-04) | Aggregation that references a Filter predicate; Formulas owns both sides; compilation pipeline (WA-2) resolves the cross-category dependency |
| Filters well: "Company = MSFT" | Formulas / Filters | Equality predicate over `company` column; compiles to `WHERE company = 'MSFT'`; excludes non-MSFT rows |
| Sorts well: "Company Ascending" | Formulas / Sorts | Column reference with ASC direction; compiles to `ORDER BY company ASC` at chip position |
| Formats: "Banded rows with parameterized D3.js palettes" | Theme config (not any explorer) | Static visual rule with no predicate; banding is every-other-row, not condition-driven; lives in active theme CSS |
| Audits column: "Calculated values" | Formulas / Calculations (with overlay rendering hint) | Derived value is data-layer (Calculations); the overlay rendering hint for displaying it is a view concern deferred to the Audits implementation milestone, not an Audits-layer operation |
| Formats category description: "Maybe all formatting in Isometry is conditional formatting?" | Marks / Conditional encoding (for conditional rules) + Theme config (for palettes, typography) | The conditional part (predicate → visual class) is Marks; the non-conditional part (palette, typography, banding) is theme config. The distinction is whether a predicate is involved. |
| Key question 3: "sorts only apply within a given grouping, not globally" | Formulas / Sorts + view explorer grouping | Confirmed by FE-RG-01: Sorts apply within the active grouping from the view explorer; no global sort across group boundaries |
| Key question 2: "how do we prevent SQL injections" | Compilation pipeline guard (FE-RG-02) | The DSL→SQL compiler produces `(sql_text, [bind_values])` tuples; never concatenates user input into SQL strings; specified in WA-2 |
| Appendix A: "Highlight rows where priority > 3" | Marks / Conditional encoding | Predicate `priority > 3` produces CSS class `urgent`; consequence is rendering, not row exclusion |
| Appendix A: "Flag rows where balance ≠ sum_of_transactions" | Audits / Validation rules | Data-quality predicate; surfaces as badge or inbox entry; row stays in result set |
| Appendix A: "Color-code by region using D3 ordinal palette" | Marks / Conditional encoding (predicate) + Theme config (palette colors) | Predicate `region IN (...)` produces region classes (`region-east`, `region-west`, etc.); theme defines palette colors per class |
| Appendix A: "Show subtotals per region in a totals row" | Formulas / Calculations + view explorer grouping | Calculation chip `SUM(revenue)`; SuperGrid's PAFV configuration provides `GROUP BY region`; Formulas owns the calculation, view explorer owns the grouping |

---

## Appendix A: DSL Example Lexicon

**Notation is illustrative, not normative — grammar design is WA-4's concern.** The examples below show the *shape* of each chip sub-type without committing to lexer tokens, operator symbols, or keyword casing. Downstream WA specs (02–06) must reference examples from this lexicon verbatim and must not paraphrase or independently re-derive them. (FE-RG-15)

### Formulas Explorer — Calculations

**1. Row-level derived column**
```
revenue - cost AS profit
```
Produces a new column `profit` for each row. Compiles to the `SELECT` clause.

**2. String transformation (row-level)**
```
UPPER(company_name) AS display_name
```
Produces a normalized display column. Compiles to the `SELECT` clause.

**3. Conditional value (CASE WHEN)**
```
CASE WHEN priority >= 4 THEN 'high' WHEN priority >= 2 THEN 'medium' ELSE 'low' END AS priority_label
```
Produces a categorical label column. Compiles to the `SELECT` clause.

**4. Aggregate calculation**
```
SUM(quantity) AS total_quantity
```
Aggregation expression; requires `GROUP BY` from the active view explorer. Compiles to the `SELECT` clause with the view explorer's `GROUP BY` in force.

**5. Count aggregation**
```
COUNT(*) AS row_count
```
Row count per group. Compiles to `SELECT` clause; `GROUP BY` from view explorer.

**6. Window function — rank within partition**
```
RANK() OVER (PARTITION BY region ORDER BY revenue DESC) AS rank_in_region
```
Partition-relative rank. Compiles to `SELECT` clause with explicit `PARTITION BY`; no `GROUP BY` required.

**7. Window function — running total**
```
SUM(revenue) OVER (PARTITION BY region ORDER BY created_at ASC) AS running_revenue
```
Cumulative sum within a partition. Compiles to `SELECT` clause.

**8. Cross-category reference: Filtered Total**
```
SUM(revenue) [WHERE company = 'MSFT'] AS msft_revenue
```
Aggregation that references a Filter predicate. Formulas owns both the aggregation (Calculations) and the predicate (Filters); the compilation pipeline (WA-2) resolves the cross-category dependency into a SQL subexpression.

### Formulas Explorer — Filters

**9. Equality filter**
```
Company = 'MSFT'
```
Single equality predicate. Compiles to `WHERE company = 'MSFT'`.

**10. Range filter**
```
priority > 3
```
Numeric comparison predicate. Compiles to `WHERE priority > 3`.

**11. String pattern filter**
```
tags CONTAINS 'urgent'
```
Substring / membership predicate. Compiles to `WHERE tags LIKE '%urgent%'` or equivalent.

**12. Date range filter**
```
created_at BETWEEN '2025-01-01' AND '2025-12-31'
```
Temporal range predicate. Compiles to `WHERE created_at BETWEEN ? AND ?` with bind values.

**13. Compound filter (single chip, single DSL)**
```
Company = 'MSFT' AND priority > 3
```
Compound predicate within a single chip. The chip contributes one conjunct to the `WHERE` clause. Cross-chip composition is always AND; OR within a single chip's DSL is allowed.

### Formulas Explorer — Sorts

**14. Single sort**
```
Company ASC
```
Single-column sort. Compiles to `ORDER BY company ASC`. Position in chip well = primary sort key.

**15. Multi-sort (two chips)**

Chip 1: `region ASC`
Chip 2: `revenue DESC`

Compiles to `ORDER BY region ASC, revenue DESC`. Chip order = sort priority; reordering chips reorders the `ORDER BY` clause.

### Marks Explorer — Conditional Encoding

**16. Priority highlight**
```
WHERE priority > 3 → class 'urgent'
```
Rows where `priority > 3` receive CSS class `urgent`. The active theme defines the visual appearance of `.urgent`. Post-query annotation; never alters row membership.

**17. Region color-coding**
```
WHERE region = 'East' → class 'region-east'
WHERE region = 'West' → class 'region-west'
```
Two chips, each producing a region class. A row satisfying neither predicate receives neither class. Theme defines the palette.

### Audits Explorer — Anomaly Rules

**18. Statistical outlier**
```
WHERE z_score > 2
```
Rows with a z-score above 2 receive an anomaly flag. Row stays in result set; flag surfaces as a badge.

**19. Internal inconsistency**
```
WHERE balance != sum_of_transactions
```
Rows where an accounting invariant fails receive an anomaly flag.

### Audits Explorer — Validation Rules

**20. Incomplete required field**
```
WHERE due_date IS NULL AND status = 'in_progress'
```
Rows with a missing required field on active items receive a validation warning.

**21. Format violation**
```
WHERE email NOT LIKE '%@%'
```
Rows with a malformed email address receive a validation warning.

---

## Appendix B: Regression Guards

All 14 regression guards from `.planning/formulas-explorer-handoff-v2.md` plus FE-RG-15 defined here. Each row has an ID, the guard statement, the rationale (why the guard exists), and a grep-able verification check. (GARD-01, GARD-02, D-02)

| ID | Guard | Rationale | Verification Check |
|----|-------|-----------|--------------------|
| FE-RG-01 | Formulas Explorer never owns `GROUP BY`. Grouping comes from view explorers (SuperGrid, etc.). | Prevents Formulas from becoming context-dependent; the same Calculation chip must produce identical semantics regardless of which view explorer provides grouping. | `grep -n "GROUP BY" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` — every match must be in a prohibition context or "view explorer owns" context, never a Formulas ownership claim. |
| FE-RG-02 | The DSL→SQL compiler produces `(sql_text, [bind_values])` tuples. No string concatenation of user input into SQL. | SQL injection is structurally impossible, not vigilance-dependent. A compiler that can concatenate user input can always inject. | `grep -n "concat\|interpolat\|f-string\|\+ sql" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` returns only prohibitions, never recommendations. |
| FE-RG-03 | Filters compose by AND only across chips. OR lives inside a single chip's DSL. | Composition is commutative and idempotent at the chip level; cross-chip OR would make composition order-dependent and non-idempotent. | `grep -n "\bOR\b" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` appears only in "inside a chip" context or as a prohibition, never as a cross-chip composition rule. |
| FE-RG-04 | Sorts compose lexicographically by chip order (left-to-right or top-to-bottom in the well). | Gives users direct, predictable control over sort priority via chip rearrangement. | The Sorts section of this spec names "chip position" as the composition rule explicitly. |
| FE-RG-05 | Calculations form a dependency DAG. Cycles are compile-time errors with chip-well visualization. | Prevents silent infinite loops or undefined evaluation order at query time. | The Calculations section of this spec names "DAG" and "compile-time errors" and cross-references WA-2; no pseudocode for the algorithm appears here. |
| FE-RG-06 | A Formula Card has no intrinsic category. Its role is determined by which chip well receives it. | Same primitive can function as Filter, Mark, or Audit depending on context — the Tableau insight. Intrinsic category would break this composability. | The Cross-Explorer Composition section names "role determined by chip well" without assigning a default category to the card. |
| FE-RG-07 | Marks produce CSS classes via post-query annotation. They never alter the result set's row membership or ordering. | Marks are view-layer; if they affect membership, they are Filters in disguise. Keeping the boundary clean makes each explorer testable in isolation. | The Marks Explorer out-of-scope list explicitly names "altering row membership" as prohibited. `grep -n "row membership" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` confirms the prohibition. |
| FE-RG-08 | Audits produce flag annotations via post-query annotation. They never alter the result set's row membership. | Audits surface attention so users can act; they do not preemptively remove data the user may need to see. Excluding rows is Filter behavior. | The Audits Explorer out-of-scope list explicitly names "excluding rows" as prohibited. `grep -n "exclud" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` confirms the prohibition context. |
| FE-RG-09 | Theme palette, typography, banding live in theme configuration, NOT in Marks. Marks decide which class; theme decides how that class looks. | Predicates work across themes without rewriting. Baking palette into Marks creates a 1:1 coupling between predicates and visual appearance that must be rewritten for every theme. | The Anti-Features section of this spec names this prohibition with rationale. |
| FE-RG-10 | Chip↔Card promotion is explicit user action ("Save as Formula"), never automatic. | Automatic promotion leads to accidental accumulation of an unintentional Formula Card library (half-baked, untitled cards). Users must consciously commit. | The Cross-Explorer Composition section names "explicit user action" and cross-references WA-3 for the promotion UI flow. |
| FE-RG-11 | Formulas Explorer is NOT the A in LATCH. LATCH letters are organizational axes; Formulas is an orthogonal operator surface. | Framing Formulas as a LATCH letter mixes two different architectural altitudes and confuses the mental model for all three explorers. | The Preamble of this spec contains the phrase "NOT the A in LATCH" and explains the orthogonality. `grep -n "NOT the A in LATCH" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` returns at least one match. |
| FE-RG-12 | Test corpus assertions are immutable. Bug fixes add cases; they never weaken existing assertions to make a test pass. | The anti-patching rule (established in v6.1 Test Harness). Weakening assertions degrades the corpus's ability to catch regressions. | Referenced in this spec as policy. Enforcement lives in WA-4 (Phase 187). `grep -n "anti-patching\|immutable" .planning/milestones/v15.0-formulas-explorer/04-golden-test-plan.md` confirms the policy is carried through. |
| FE-RG-13 | The chip-well geometry contract (WA-6) is operator-surface, not PAFV-bound. §3 of that contract must explicitly say "N/A — operator surface" with rationale, not be silently empty. | Honest contract boundaries signal to future readers that the absence is deliberate, not an oversight. | `grep -n "N/A" .planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` or `grep -n "operator surface" .planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` confirms the explicit rationale in §3. |
| FE-RG-14 | Per-explorer specifics (chip well categories, accepted types) do NOT live in `chip-well-geometry.md`. That contract is generic; specifics belong in WA-1 or per-explorer implementation specs. | The chip-well contract is reusable infrastructure; embedding explorer-specific rules would couple it to one consumer and make it non-reusable. | `grep -n "Calculations\|Filters\|Sorts\|Anomaly\|Validation\|Conditional encoding" .planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` returns no explorer-specific category names. |
| FE-RG-15 | The DSL example lexicon in Appendix A of `01-three-explorer-spec.md` is the single canonical reference for chip examples. Downstream WA specs (02 through 06) MUST cross-reference this lexicon when citing examples and MUST NOT paraphrase or independently re-derive examples. | A single canonical lexicon prevents notation drift across specs. If each WA author re-derives examples, they will diverge from each other and from this spec, making review and implementation ambiguous. | `grep -rn "for example\|e\.g\.,\|such as" .planning/milestones/v15.0-formulas-explorer/0[2-6]-*.md` should return cross-references to Appendix A of this spec, not independent example definitions. |

---

*End of `01-three-explorer-spec.md`*
*Version 1.0 — Phase 182, Plan 01*
*Canonical source: `.planning/formulas-explorer-handoff-v2.md`*
